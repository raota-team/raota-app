/**
 * 서버 API 설정. 백엔드 v2가 아직 없어서 기본값은 mock(로컬 더미 데이터)이고,
 * 화면은 지금도 src/data/hooks.ts(로컬 스토어)만 읽는다. 서버를 붙일 때 env로 remote를 켠다.
 *
 * Metro는 `process.env.EXPO_PUBLIC_*`를 "글자 그대로 쓴 자리"에서만 값으로 바꾼다.
 * 구조 분해(const { EXPO_PUBLIC_API_MODE } = process.env)나 동적 키는 빌드에서 undefined가 되니 쓰지 않는다.
 */

export type ApiMode = "mock" | "remote"

/** 기본 서버 주소. dev 서버는 EXPO_PUBLIC_API_BASE_URL로 바꾼다 */
export const DEFAULT_API_BASE_URL = "https://api.raota.app/api/v2"

/** 한 번의 요청이 기다리는 최대 시간 */
export const DEFAULT_API_TIMEOUT_MS = 15_000

/** 사진 업로드는 더 오래 걸린다 */
export const UPLOAD_TIMEOUT_MS = 60_000

export function parseApiMode(raw: string | undefined | null): ApiMode {
  return raw?.trim().toLowerCase() === "remote" ? "remote" : "mock"
}

/** 끝의 "/"는 떼고, 값이 없거나 http(s)가 아니면 기본 주소를 쓴다 */
export function parseBaseUrl(raw: string | undefined | null): string {
  const value = raw?.trim()
  if (!value || !/^https?:\/\//i.test(value)) return DEFAULT_API_BASE_URL
  return value.replace(/\/+$/, "")
}

export function parseTimeoutMs(raw: string | undefined | null): number {
  const value = Number(raw?.trim())
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_API_TIMEOUT_MS
}

export const API_MODE: ApiMode = parseApiMode(process.env.EXPO_PUBLIC_API_MODE)
export const API_BASE_URL: string = parseBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL)
export const API_TIMEOUT_MS: number = parseTimeoutMs(process.env.EXPO_PUBLIC_API_TIMEOUT_MS)

/**
 * 화면을 도메인 단위로 하나씩 서버로 옮기기 위한 스위치.
 * EXPO_PUBLIC_API_REMOTE_DOMAINS="shops,lounge" 처럼 적으면 그 도메인만 서버를 본다.
 * 비워 두면 remote 모드에서 전부 서버를 본다. mock 모드에서는 무엇을 적어도 전부 로컬이다.
 */
export const API_DOMAINS = [
  "auth",
  "member",
  "shops",
  "ramenLogs",
  "lounge",
  "files",
  "recommendations",
] as const

export type ApiDomain = (typeof API_DOMAINS)[number]

export function parseRemoteDomains(mode: ApiMode, raw: string | undefined | null): ReadonlySet<ApiDomain> {
  if (mode !== "remote") return new Set()
  const value = raw?.trim()
  if (!value || value.toLowerCase() === "all") return new Set(API_DOMAINS)
  const wanted = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
  return new Set(API_DOMAINS.filter((domain) => wanted.some((item) => item.toLowerCase() === domain.toLowerCase())))
}

export const REMOTE_DOMAINS: ReadonlySet<ApiDomain> = parseRemoteDomains(
  API_MODE,
  process.env.EXPO_PUBLIC_API_REMOTE_DOMAINS,
)

/** 이 도메인을 서버에서 읽는가. 지금은 어디서도 true가 아니다(기본값 mock) */
export function isRemote(domain: ApiDomain): boolean {
  return REMOTE_DOMAINS.has(domain)
}
