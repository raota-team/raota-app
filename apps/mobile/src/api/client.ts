import { API_BASE_URL, API_TIMEOUT_MS } from "./config"
import { tokenStore as defaultTokenStore, type TokenPair, type TokenStore } from "./tokens"
import type { ApiFailureEnvelope, ApiSuccessEnvelope, ReissueResponse } from "./types"

/**
 * 서버 v2와 이야기하는 유일한 통로. 화면과 데이터 계층은 이 클라이언트만 쓰고 fetch를 직접 부르지 않는다.
 *
 * 하는 일
 * - 성공/실패 봉투({ success, data, meta } / { success:false, error })를 풀어 준다
 * - 실패를 ApiError(코드·필드·requestId)로 바꿔 준다
 * - Bearer 토큰을 붙이고, 401 TOKEN_EXPIRED면 재발급을 한 번만(single-flight) 돌린 뒤 다시 보낸다
 * - 세션이 끝나면(SESSION_REVOKED·REFRESH_REUSED·재발급 거절) 토큰을 지우고 알린다
 * - Idempotency-Key가 있는 생성 요청만 1s·2s·4s(+지터)로 최대 3번 다시 보낸다
 */

// ---------------------------------------------------------------------------
// 오류
// ---------------------------------------------------------------------------

/** 서버가 쓰는 코드 + 서버에 닿기 전에 앱이 만드는 코드 */
export type ApiErrorCode =
  // 서버(계약 3차 결정의 작은 목록)
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "TOKEN_EXPIRED"
  | "OAUTH_CREDENTIAL_INVALID"
  | "FORBIDDEN"
  | "ONBOARDING_REQUIRED"
  | "RESOURCE_NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "RECOMMENDATION_UNAVAILABLE"
  | "INTERNAL_ERROR"
  // 더는 서버가 보내지 않지만 옛 서버·중간 장비가 보내면 그대로 받아 둔다
  | "SESSION_REVOKED"
  | "REFRESH_REUSED"
  | "IDEMPOTENCY_IN_PROGRESS"
  // 앱
  /** 서버에 닿지 못했다(비행기 모드, 끊긴 연결) */
  | "NETWORK_ERROR"
  /** 시간 안에 답이 오지 않았다 */
  | "TIMEOUT"
  /** 화면이 떠나서 요청을 취소했다 */
  | "ABORTED"
  /** 답을 받았지만 계약과 다른 모양이다 */
  | "INVALID_RESPONSE"
  /** 봉투 없이 온 HTTP 오류 */
  | "HTTP_ERROR"
  /** 서버 id(BIGINT)가 앱의 number id로 담기지 않는다 */
  | "UNSUPPORTED_ID"

export interface ApiFieldError {
  field: string
  code: string
  message: string
}

export interface ApiErrorInit {
  status: number
  code: ApiErrorCode | string
  message: string
  fields?: ApiFieldError[]
  requestId?: string | null
  /** 429·503·IDEMPOTENCY_IN_PROGRESS의 Retry-After를 ms로 바꾼 값 */
  retryAfterMs?: number | null
  cause?: unknown
}

/** 서버에 닿지 못했거나 답을 기다리지 못한 오류 */
const OFFLINE_CODES = new Set<string>(["NETWORK_ERROR", "TIMEOUT"])

export class ApiError extends Error {
  /** instanceof가 번들러에 따라 흔들릴 수 있어 표식을 같이 둔다 */
  readonly isApiError = true as const
  readonly status: number
  readonly code: string
  readonly fields: ApiFieldError[]
  readonly requestId: string | null
  readonly retryAfterMs: number | null

  constructor(init: ApiErrorInit) {
    super(init.message)
    // 트랜스파일된 클래스에서도 instanceof가 맞도록
    Object.setPrototypeOf(this, ApiError.prototype)
    this.name = "ApiError"
    this.status = init.status
    this.code = init.code
    this.fields = init.fields ?? []
    this.requestId = init.requestId ?? null
    this.retryAfterMs = init.retryAfterMs ?? null
    if (init.cause !== undefined) (this as { cause?: unknown }).cause = init.cause
  }

  /** 이 입력 항목에 붙은 서버 오류(없으면 undefined) */
  fieldError(field: string): ApiFieldError | undefined {
    return this.fields.find((item) => item.field === field)
  }

  /** 서버에 닿지 못한 오류인가(연결·시간 초과) */
  get isOffline(): boolean {
    return OFFLINE_CODES.has(this.code)
  }
}

export function isApiError(error: unknown, code?: ApiErrorCode | string): error is ApiError {
  const isError = error instanceof ApiError || (typeof error === "object" && error !== null && (error as ApiError).isApiError === true)
  if (!isError) return false
  return code === undefined || (error as ApiError).code === code
}

/** 이 입력 항목에 붙은 서버 오류 메시지(없으면 null) */
export function fieldErrorMessage(error: unknown, field: string): string | null {
  return isApiError(error) ? (error.fieldError(field)?.message ?? null) : null
}

// ---------------------------------------------------------------------------
// 쿼리스트링
// ---------------------------------------------------------------------------

export type QueryValue = string | number | boolean | null | undefined | ReadonlyArray<string | number | boolean>

/** undefined·null인 값은 아예 보내지 않는다. 배열은 같은 이름을 여러 번 쓴다 */
export function buildQuery(params?: Record<string, QueryValue> | null): string {
  if (!params) return ""
  const parts: string[] = []
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    const values = Array.isArray(value) ? value : [value as string | number | boolean]
    for (const item of values) {
      if (item === undefined || item === null) continue
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`)
    }
  }
  return parts.length > 0 ? `?${parts.join("&")}` : ""
}

// ---------------------------------------------------------------------------
// Idempotency-Key
// ---------------------------------------------------------------------------

/**
 * uuid v4. Hermes에 crypto가 없을 수도 있어 단계적으로 내려간다.
 * 마지막 Math.random 단계는 암호학적으로 안전하지 않지만, 여기서는 "겹치지 않는 값"이면 된다.
 */
export function createIdempotencyKey(): string {
  const cryptoRef = (globalThis as { crypto?: Crypto }).crypto
  if (typeof cryptoRef?.randomUUID === "function") return cryptoRef.randomUUID()
  const bytes = new Uint8Array(16)
  if (typeof cryptoRef?.getRandomValues === "function") {
    cryptoRef.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

// ---------------------------------------------------------------------------
// 요청·응답
// ---------------------------------------------------------------------------

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

/** 토큰을 어떻게 다룰지. optional은 공개 읽기(로그인했으면 내 공감 여부까지 받는다) */
export type AuthMode = "required" | "optional" | "none"

export interface RequestOptions {
  method?: HttpMethod
  query?: Record<string, QueryValue> | null
  body?: unknown
  auth?: AuthMode
  /** 생성 요청의 멱등 키. 있으면 재시도 정책이 켜진다 */
  idempotencyKey?: string
  /** 재시도를 직접 끄고 켠다(기본값: idempotencyKey가 있으면 켠다) */
  retry?: boolean
  headers?: Record<string, string>
  signal?: AbortSignal
  timeoutMs?: number
}

export interface ApiResponse<T> {
  data: T
  status: number
  requestId: string | null
}

/** fetch의 최소 모양. 테스트에서 가짜 응답을 만들기 쉽게 좁혀 둔다 */
export interface ResponseLike {
  status: number
  ok?: boolean
  headers?: { get(name: string): string | null }
  text(): Promise<string>
}

export type FetchLike = (input: string, init: RequestInit) => Promise<ResponseLike>

export interface RetryPolicy {
  /** 처음 요청 뒤 다시 보내는 최대 횟수 */
  maxRetries: number
  /** 1s → 2s → 4s */
  baseDelayMs: number
  maxDelayMs: number
  /** 기다리는 시간에 더하는 흔들림 비율 */
  jitterRatio: number
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 8_000,
  jitterRatio: 0.3,
}

export interface SessionEndedEvent {
  /** SESSION_REVOKED · REFRESH_REUSED · 재발급 거절 코드 */
  code: string
  requestId: string | null
}

export type SessionEndedListener = (event: SessionEndedEvent) => void

export interface ApiClientOptions {
  baseUrl?: string
  timeoutMs?: number
  fetch?: FetchLike
  tokens?: TokenStore
  retry?: Partial<RetryPolicy>
  /** 테스트에서 시간을 건너뛰기 위해 갈아 끼운다 */
  sleep?: (ms: number) => Promise<void>
  random?: () => number
}

/** 토큰 재발급 경로. 이 요청만은 재시도하지 않는다 */
export const TOKEN_REISSUE_PATH = "/auth/token/reissue"

const OFFLINE_MESSAGE = "네트워크 연결을 확인해 주세요."

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function headerOf(response: ResponseLike, name: string): string | null {
  try {
    return response.headers?.get(name) ?? null
  } catch {
    return null
  }
}

/** "3"(초) 또는 HTTP-date를 ms로 */
export function parseRetryAfter(raw: string | null, now: number = Date.now()): number | null {
  if (!raw) return null
  const seconds = Number(raw.trim())
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000
  const at = Date.parse(raw)
  if (Number.isFinite(at)) return Math.max(0, at - now)
  return null
}

function parseJson(text: string): unknown {
  if (!text.trim()) return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

function isFieldErrorList(value: unknown): value is ApiFieldError[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "object" && item !== null && typeof (item as ApiFieldError).field === "string")
  )
}

/** 봉투를 풀어 데이터만 돌려준다. 실패 봉투와 봉투가 아닌 답은 ApiError로 바꾼다 */
export async function readResponse<T>(response: ResponseLike): Promise<ApiResponse<T>> {
  const status = response.status
  const headerRequestId = headerOf(response, "X-Request-Id")
  const retryAfterMs = parseRetryAfter(headerOf(response, "Retry-After"))
  const ok = response.ok ?? (status >= 200 && status < 300)

  if (status === 204) return { data: undefined as T, status, requestId: headerRequestId }

  const payload = parseJson(await response.text()) as
    | ApiSuccessEnvelope<T>
    | ApiFailureEnvelope
    | undefined
  const requestId = (payload as { meta?: { requestId?: string } } | undefined)?.meta?.requestId ?? headerRequestId

  if (payload && typeof payload === "object" && "success" in payload) {
    if (payload.success === true) return { data: payload.data, status, requestId }
    const error = (payload as ApiFailureEnvelope).error
    throw new ApiError({
      status,
      code: error?.code ?? "INVALID_RESPONSE",
      message: error?.message ?? "요청을 처리하지 못했어요.",
      fields: isFieldErrorList(error?.fields) ? error.fields : [],
      requestId,
      retryAfterMs,
    })
  }

  if (ok) {
    // 봉투 없이 온 성공 응답(빈 본문 포함). 빈 본문은 204처럼 다룬다
    if (payload === undefined) return { data: undefined as T, status, requestId }
    throw new ApiError({
      status,
      code: "INVALID_RESPONSE",
      message: "서버 응답 형식이 올바르지 않아요.",
      requestId,
    })
  }

  throw new ApiError({
    status,
    code: "HTTP_ERROR",
    message: `요청이 실패했어요. (HTTP ${status})`,
    requestId,
    retryAfterMs,
  })
}

function toOfflineError(error: unknown, timedOut: boolean, aborted: boolean): ApiError {
  if (timedOut) {
    return new ApiError({ status: 0, code: "TIMEOUT", message: "응답이 너무 늦어요. 잠시 후 다시 시도해 주세요.", cause: error })
  }
  if (aborted) {
    return new ApiError({ status: 0, code: "ABORTED", message: "요청을 취소했어요.", cause: error })
  }
  return new ApiError({ status: 0, code: "NETWORK_ERROR", message: OFFLINE_MESSAGE, cause: error })
}

/**
 * 멱등 생성 요청만 다시 보낸다: 연결 실패·시간 초과·5xx.
 * (IDEMPOTENCY_IN_PROGRESS는 계약에서 빠졌지만 오면 Retry-After를 지키고 다시 보낸다)
 */
export function isRetryableError(error: unknown): boolean {
  if (!isApiError(error)) return false
  if (error.code === "ABORTED") return false
  if (error.isOffline) return true
  if (error.status >= 500) return true
  return error.status === 409 && error.code === "IDEMPOTENCY_IN_PROGRESS"
}

export class ApiClient {
  private readonly baseUrl: string
  private readonly timeoutMs: number
  private readonly tokens: TokenStore
  private readonly retryPolicy: RetryPolicy
  private readonly sleep: (ms: number) => Promise<void>
  private readonly random: () => number
  private readonly fetchImpl?: FetchLike
  private readonly listeners = new Set<SessionEndedListener>()
  /** 동시에 401을 받아도 재발급은 한 번만 돈다 */
  private reissuing: Promise<TokenPair> | null = null

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? API_BASE_URL
    this.timeoutMs = options.timeoutMs ?? API_TIMEOUT_MS
    this.tokens = options.tokens ?? defaultTokenStore
    this.retryPolicy = { ...DEFAULT_RETRY_POLICY, ...options.retry }
    this.sleep = options.sleep ?? defaultSleep
    this.random = options.random ?? Math.random
    this.fetchImpl = options.fetch
  }

  /** 세션이 끝났을 때(토큰이 지워졌을 때) 알림. 스토어가 이걸 받아 로그아웃한다 */
  onSessionEnded(listener: SessionEndedListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** 데이터만 필요한 보통의 호출 */
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const response = await this.send<T>(path, options)
    return response.data
  }

  get<T>(path: string, options: Omit<RequestOptions, "method" | "body"> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: "GET" })
  }

  post<T>(path: string, body?: unknown, options: Omit<RequestOptions, "method" | "body"> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: "POST", body })
  }

  put<T>(path: string, body?: unknown, options: Omit<RequestOptions, "method" | "body"> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: "PUT", body })
  }

  patch<T>(path: string, body?: unknown, options: Omit<RequestOptions, "method" | "body"> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: "PATCH", body })
  }

  delete<T>(path: string, options: Omit<RequestOptions, "method" | "body"> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: "DELETE" })
  }

  /** 상태 코드와 requestId까지 필요할 때 */
  async send<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const retryable = options.retry ?? Boolean(options.idempotencyKey)
    let attempt = 0
    for (;;) {
      try {
        return await this.attempt<T>(path, options)
      } catch (error) {
        const delay = retryable ? this.retryDelay(error, attempt) : null
        if (delay === null) throw error
        attempt += 1
        await this.sleep(delay)
      }
    }
  }

  /** 다음 재시도까지 기다릴 시간(ms). 더 보내면 안 되면 null */
  private retryDelay(error: unknown, attempt: number): number | null {
    if (attempt >= this.retryPolicy.maxRetries || !isRetryableError(error)) return null
    const base = Math.min(this.retryPolicy.baseDelayMs * 2 ** attempt, this.retryPolicy.maxDelayMs)
    const wait = base + base * this.retryPolicy.jitterRatio * this.random()
    const retryAfter = isApiError(error) ? error.retryAfterMs : null
    // 서버가 Retry-After로 알려 준 시간보다 일찍 보내지 않는다
    return retryAfter === null ? wait : Math.max(retryAfter, wait)
  }

  /** 토큰을 붙여 한 번 보내고, 401 TOKEN_EXPIRED면 재발급 뒤 딱 한 번 더 보낸다 */
  private async attempt<T>(path: string, options: RequestOptions): Promise<ApiResponse<T>> {
    const auth = options.auth ?? "required"
    if (auth === "none") return this.dispatch<T>(path, options, null)

    const pair = await this.tokens.get()
    if (!pair) {
      if (auth === "required") {
        throw new ApiError({ status: 401, code: "UNAUTHORIZED", message: "로그인이 필요해요." })
      }
      return this.dispatch<T>(path, options, null)
    }

    try {
      return await this.dispatch<T>(path, options, pair.accessToken)
    } catch (error) {
      if (!isApiError(error) || error.status !== 401) throw error

      // 옛 서버가 보내던 "세션이 끝났다" 코드. 재발급을 시도할 것도 없다
      if (error.code === "SESSION_REVOKED" || error.code === "REFRESH_REUSED") {
        await this.endSession(error.code, error.requestId, pair)
        if (auth === "optional") return this.dispatch<T>(path, options, null)
        throw error
      }

      // 토큰을 붙여 보냈는데 401이면(TOKEN_EXPIRED·UNAUTHORIZED) 재발급을 한 번 돌린다
      let next: TokenPair
      try {
        next = await this.reissue(pair)
      } catch (reissueError) {
        // 세션이 끝났으면 공개 읽기만 비회원으로 한 번 더 시도한다
        if (auth === "optional" && isApiError(reissueError) && !reissueError.isOffline) {
          return this.dispatch<T>(path, options, null)
        }
        throw reissueError
      }
      // 새 토큰으로 딱 한 번만 다시 보낸다(여기서 또 401이면 그대로 올린다)
      return this.dispatch<T>(path, options, next.accessToken)
    }
  }

  /**
   * 토큰 재발급. 동시에 여러 요청이 401을 받아도 한 번만 돈다.
   * 이미 다른 요청이 새 토큰을 받아 왔으면 그 토큰을 그대로 쓴다
   * (refresh는 한 번 쓰면 돌아간다. 이미 쓴 refresh로 또 재발급하면 401이 나고 로그아웃된다).
   */
  private async reissue(used: TokenPair): Promise<TokenPair> {
    const current = await this.tokens.get()
    if (!current) {
      throw new ApiError({ status: 401, code: "UNAUTHORIZED", message: "다시 로그인해 주세요." })
    }
    if (current.refreshToken !== used.refreshToken) return current
    if (!this.reissuing) {
      this.reissuing = this.requestReissue(current).finally(() => {
        this.reissuing = null
      })
    }
    return this.reissuing
  }

  private async requestReissue(used: TokenPair): Promise<TokenPair> {
    let issued: ReissueResponse
    try {
      const response = await this.dispatch<ReissueResponse>(
        TOKEN_REISSUE_PATH,
        { method: "POST", body: { refreshToken: used.refreshToken } },
        null,
      )
      issued = response.data
    } catch (error) {
      // 서버가 refresh를 거절하면(401 등 4xx) 세션이 끝난 것이다.
      // 연결 문제(오프라인·시간 초과), 서버 오류(5xx), 요청 과다(429)면 토큰을 남겨 두고 다음에 다시 시도한다
      if (isApiError(error) && !error.isOffline && error.status >= 400 && error.status < 500 && error.status !== 429) {
        await this.endSession(error.code, error.requestId, used)
      }
      throw error
    }

    if (!issued?.accessToken || !issued?.refreshToken) {
      throw new ApiError({ status: 0, code: "INVALID_RESPONSE", message: "토큰을 다시 받지 못했어요." })
    }
    const pair: TokenPair = { accessToken: issued.accessToken, refreshToken: issued.refreshToken }
    await this.tokens.set(pair)
    return pair
  }

  /** 토큰을 지우고 한 번만 알린다 */
  private async endSession(code: string, requestId: string | null, used: TokenPair | null): Promise<void> {
    const current = this.tokens.peek()
    if (!current) return
    // 그 사이 다시 로그인해 새 토큰이 들어왔으면 건드리지 않는다
    if (used && current.accessToken !== used.accessToken && current.refreshToken !== used.refreshToken) return
    const clearing = this.tokens.clear()
    for (const listener of [...this.listeners]) {
      try {
        listener({ code, requestId })
      } catch {
        // 알림을 받는 쪽 잘못으로 요청 흐름이 멈추지 않게 한다
      }
    }
    await clearing
  }

  /** 실제 fetch 한 번 */
  private async dispatch<T>(path: string, options: RequestOptions, accessToken: string | null): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}${buildQuery(options.query)}`
    const headers: Record<string, string> = { Accept: "application/json", ...options.headers }
    if (options.body !== undefined) headers["Content-Type"] = "application/json"
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`
    if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey

    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, options.timeoutMs ?? this.timeoutMs)
    const abortFromCaller = () => controller.abort()
    options.signal?.addEventListener("abort", abortFromCaller)

    try {
      const send = this.fetchImpl ?? (globalThis.fetch as unknown as FetchLike)
      const response = await send(url, {
        method: options.method ?? "GET",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      })
      return await readResponse<T>(response)
    } catch (error) {
      if (isApiError(error)) throw error
      throw toOfflineError(error, timedOut, options.signal?.aborted ?? false)
    } finally {
      clearTimeout(timer)
      options.signal?.removeEventListener("abort", abortFromCaller)
    }
  }
}

/** 앱 전체가 쓰는 클라이언트 */
export const apiClient = new ApiClient()

/** 세션이 끝나면(토큰 무효화) 알림을 받는다. 스토어가 로그아웃 처리를 붙일 자리 */
export function subscribeSessionEnded(listener: SessionEndedListener): () => void {
  return apiClient.onSessionEnded(listener)
}
