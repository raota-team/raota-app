import AsyncStorage from "@react-native-async-storage/async-storage"

import { createIdempotencyKey, isApiError } from "./client"

/**
 * 멱등 생성 요청(라멘로그·댓글)의 로컬 아웃박스.
 *
 * 왜 필요한가: 저장을 눌렀는데 답이 오지 않으면 서버에 만들어졌는지 알 수 없다.
 * 같은 Idempotency-Key로 다시 보내면 서버가 같은 결과를 돌려주므로(24시간) 기록이 두 번 생기지 않는다.
 * 그래서 보내기 전에 (계정, 키, 작업, 본문, 처음 보낸 시각)을 남겨 두고, 앱을 껐다 켜도 같은 키를 다시 쓴다.
 *
 * 24시간이 지나면 서버가 키를 잊는다. 그때는 항목을 버리고 자동 재시도도 멈춘다(그 뒤엔 사용자에게 묻는다).
 */

export const OUTBOX_STORAGE_KEY = "@raota/idempotency-outbox"

/** 서버가 같은 키를 기억하는 시간 */
export const OUTBOX_TTL_MS = 24 * 60 * 60 * 1000

export type OutboxOperation = "CREATE_RAMEN_LOG" | "CREATE_COMMENT"

export interface OutboxEntry {
  /** 계정마다 따로 본다(로그아웃 후 다른 계정이 남의 키를 쓰지 않게) */
  accountId: string
  /** Idempotency-Key (uuid v4) */
  key: string
  operation: OutboxOperation
  /** 다시 보낼 경로. 댓글은 로그마다 다르다 */
  path: string
  /**
   * 같은 요청인지 가리는 값. 사진을 올리기 전 원본(로컬 URI 등)으로 만들면
   * 재시도 때 사진을 다시 올리지 않고 같은 키·같은 본문으로 보낼 수 있다.
   */
  fingerprint: string
  /** 실제로 보낸 본문. 다시 보낼 때 그대로 쓴다(본문이 달라지면 서버가 409로 막는다) */
  body: unknown
  /** 처음 보낸 시각(ISO) */
  firstSentAt: string
}

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

/** 키 순서를 맞춘 JSON. 같은 내용이면 항상 같은 문자열이 된다 */
export function fingerprintOf(value: unknown): string {
  return JSON.stringify(sortValue(value))
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue)
  if (typeof value !== "object" || value === null) return value
  const record = value as Record<string, unknown>
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key) => [key, sortValue(record[key])]),
  )
}

function isEntry(value: unknown): value is OutboxEntry {
  if (typeof value !== "object" || value === null) return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry.accountId === "string" &&
    typeof entry.key === "string" &&
    typeof entry.operation === "string" &&
    typeof entry.path === "string" &&
    typeof entry.fingerprint === "string" &&
    typeof entry.firstSentAt === "string"
  )
}

export class IdempotencyOutbox {
  /** 읽고 쓰는 사이에 다른 호출이 끼어들지 않게 한 줄로 세운다 */
  private queue: Promise<unknown> = Promise.resolve()

  constructor(
    private readonly storage: KeyValueStorage = AsyncStorage,
    private readonly now: () => number = Date.now,
    private readonly newKey: () => string = createIdempotencyKey,
  ) {}

  /** 아직 결과를 모르는, 같은 요청의 항목(없으면 null) */
  async find(accountId: string, operation: OutboxOperation, fingerprint: string): Promise<OutboxEntry | null> {
    const entries = await this.serialize(() => this.read())
    return (
      entries.find(
        (entry) => entry.accountId === accountId && entry.operation === operation && entry.fingerprint === fingerprint,
      ) ?? null
    )
  }

  /** 보낼 요청을 적어 두고 키를 준다. 같은 요청이 이미 있으면 그 키를 그대로 쓴다 */
  async begin(input: Omit<OutboxEntry, "key" | "firstSentAt"> & { key?: string }): Promise<OutboxEntry> {
    return this.serialize(async () => {
      const entries = await this.read()
      const existing = entries.find(
        (entry) =>
          entry.accountId === input.accountId &&
          entry.operation === input.operation &&
          entry.fingerprint === input.fingerprint,
      )
      if (existing) return existing
      const entry: OutboxEntry = {
        ...input,
        key: input.key ?? this.newKey(),
        firstSentAt: new Date(this.now()).toISOString(),
      }
      await this.write([...entries, entry])
      return entry
    })
  }

  /** 끝난 요청(성공했거나 다시 보내도 소용없는 실패)을 지운다 */
  async complete(key: string): Promise<void> {
    await this.serialize(async () => {
      const entries = await this.read()
      const next = entries.filter((entry) => entry.key !== key)
      if (next.length !== entries.length) await this.write(next)
    })
  }

  /** 아직 결과를 모르는 요청들(앱을 다시 켰을 때 이어서 보낼 목록) */
  async pending(accountId: string): Promise<OutboxEntry[]> {
    const entries = await this.serialize(() => this.read())
    return entries.filter((entry) => entry.accountId === accountId)
  }

  /** 로그아웃·탈퇴 때 그 계정 항목을 지운다 */
  async clearAccount(accountId: string): Promise<void> {
    await this.serialize(async () => {
      const entries = await this.read()
      await this.write(entries.filter((entry) => entry.accountId !== accountId))
    })
  }

  async clear(): Promise<void> {
    await this.serialize(() => this.storage.removeItem(OUTBOX_STORAGE_KEY))
  }

  private serialize<T>(task: () => Promise<T>): Promise<T> {
    const next = this.queue.then(task, task)
    this.queue = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }

  /** 읽을 때마다 24시간이 지난 항목을 버린다 */
  private async read(): Promise<OutboxEntry[]> {
    let raw: string | null = null
    try {
      raw = await this.storage.getItem(OUTBOX_STORAGE_KEY)
    } catch {
      return []
    }
    if (!raw) return []
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return []
    }
    if (!Array.isArray(parsed)) return []
    const limit = this.now() - OUTBOX_TTL_MS
    const fresh = parsed.filter(
      (entry): entry is OutboxEntry => isEntry(entry) && Date.parse(entry.firstSentAt) > limit,
    )
    if (fresh.length !== parsed.length) await this.write(fresh)
    return fresh
  }

  private async write(entries: OutboxEntry[]): Promise<void> {
    try {
      if (entries.length === 0) await this.storage.removeItem(OUTBOX_STORAGE_KEY)
      else await this.storage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(entries))
    } catch {
      // 저장 실패가 요청 자체를 막지는 않는다. 다만 앱을 껐다 켜면 같은 키를 못 쓴다
    }
  }
}

export const idempotencyOutbox = new IdempotencyOutbox()

/** 다시 보내도 결과가 같은 실패(본문·권한·대상 문제). 이런 항목은 아웃박스에서 지운다 */
export function isPermanentFailure(error: unknown): boolean {
  if (!isApiError(error)) return false
  if (error.isOffline) return false
  if (error.code === "IDEMPOTENCY_IN_PROGRESS") return false
  // 429·408은 시간이 지나면 같은 키로 다시 보낼 수 있다. 401도 다시 로그인하면 된다
  if (error.status === 401 || error.status === 408 || error.status === 429) return false
  return error.status >= 400 && error.status < 500
}

export interface IdempotentRequest {
  operation: OutboxOperation
  path: string
  /** 보낼 본문. 기다리던 항목이 있으면 그 본문을 다시 쓰고 이 함수는 부르지 않는다 */
  buildBody: () => unknown | Promise<unknown>
  /** 로그인한 계정 id. 없으면 아웃박스를 쓰지 않고 매번 새 키로 보낸다 */
  accountId?: string
  /** 기본값은 본문 지문. 사진 업로드 전 원본으로 만들고 싶으면 직접 넘긴다 */
  fingerprint?: string
  idempotencyKey?: string
  outbox?: IdempotencyOutbox
}

/**
 * 아웃박스를 거쳐 멱등 생성 요청을 보낸다.
 * 성공하거나 "다시 보내도 같은" 실패면 항목을 지우고, 연결·서버 문제면 남겨 둬서 다음에 같은 키로 보낸다.
 */
export async function sendIdempotent<T>(
  request: IdempotentRequest,
  send: (payload: { idempotencyKey: string; body: unknown }) => Promise<T>,
): Promise<T> {
  if (!request.accountId) {
    const body = await request.buildBody()
    return send({ idempotencyKey: request.idempotencyKey ?? createIdempotencyKey(), body })
  }

  const outbox = request.outbox ?? idempotencyOutbox
  // fingerprint를 안 넘겼으면 본문으로 만든다(본문은 한 번만 만든다)
  let built: { body: unknown } | null = null
  let fingerprint = request.fingerprint
  if (fingerprint === undefined) {
    built = { body: await request.buildBody() }
    fingerprint = fingerprintOf({ operation: request.operation, path: request.path, body: built.body })
  }

  const existing = await outbox.find(request.accountId, request.operation, fingerprint)
  const entry =
    existing ??
    (await outbox.begin({
      accountId: request.accountId,
      operation: request.operation,
      path: request.path,
      fingerprint,
      body: built ? built.body : await request.buildBody(),
      key: request.idempotencyKey,
    }))

  try {
    const result = await send({ idempotencyKey: entry.key, body: entry.body })
    await outbox.complete(entry.key)
    return result
  } catch (error) {
    if (isPermanentFailure(error)) await outbox.complete(entry.key)
    throw error
  }
}
