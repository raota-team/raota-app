/**
 * 기본값은 mock(로컬 더미 데이터)이고, 공개 화면은 도메인 스위치를 켰을 때만 서버를 읽는다.
 * 서버 주소는 저장소에 적지 않는다. EXPO_PUBLIC_API_BASE_URL(.env, 커밋하지 않음)이 없으면 remote를 켜도 mock으로 돈다.
 *
 * Metro는 `process.env.EXPO_PUBLIC_*`를 "글자 그대로 쓴 자리"에서만 값으로 바꾼다.
 * 구조 분해(const { EXPO_PUBLIC_API_MODE } = process.env)나 동적 키는 빌드에서 undefined가 되니 쓰지 않는다.
 */

export type ApiMode = "mock" | "remote"

/** 한 번의 요청이 기다리는 최대 시간 */
export const DEFAULT_API_TIMEOUT_MS = 15_000

/** 사진 업로드는 더 오래 걸린다 */
export const UPLOAD_TIMEOUT_MS = 60_000

export function parseApiMode(raw: string | undefined | null): ApiMode {
  return raw?.trim().toLowerCase() === "remote" ? "remote" : "mock"
}

/** 끝의 "/"는 뗀다. 값이 없거나 http(s)가 아니면 null(서버 주소 없음) */
export function parseBaseUrl(raw: string | undefined | null): string | null {
  const value = raw?.trim()
  if (!value || !/^https?:\/\//i.test(value)) return null
  return value.replace(/\/+$/, "")
}

export function parseTimeoutMs(raw: string | undefined | null): number {
  const value = Number(raw?.trim())
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_API_TIMEOUT_MS
}

export const API_BASE_URL: string | null = parseBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL)
/** 서버 주소가 없으면 remote를 적어도 mock이다 */
export const API_MODE: ApiMode = API_BASE_URL ? parseApiMode(process.env.EXPO_PUBLIC_API_MODE) : "mock"
export const API_TIMEOUT_MS: number = parseTimeoutMs(process.env.EXPO_PUBLIC_API_TIMEOUT_MS)

/**
 * 화면을 도메인 단위로 하나씩 서버로 옮기기 위한 스위치.
 * EXPO_PUBLIC_API_REMOTE_DOMAINS="shops,lounge" 처럼 적으면 그 도메인만 서버를 본다.
 * 비워 두면 remote 모드에서 전부 서버를 본다. mock 모드에서는 무엇을 적어도 전부 로컬이다.
 *
 * - auth: 소셜 로그인·온보딩·약관 동의·세션 복원·로그아웃·탈퇴
 * - member: 내 정보 수정(프로필 사진 업로드)·닉네임 확인
 * - shops: 매장 목록·지도·상세·오늘의 큐레이션(비회원도 읽는다). 찜은 auth도 켜져 있어야 서버로 간다
 * - ramenLogs: 내 기록·요약·작성(사진 업로드)·수정·삭제·맛 노트 정의
 * - lounge: 라운지 피드·상세·댓글 읽기(비회원도 읽는다). 공감·댓글 쓰기·신고·차단은 auth도 켜져 있어야 서버로 간다
 * - recommendations: AI 추천
 */
export const API_DOMAINS = [
  "auth",
  "member",
  "shops",
  "ramenLogs",
  "lounge",
  "recommendations",
] as const

export type ApiDomain = (typeof API_DOMAINS)[number]

/** 회원 토큰이 있어야만 부를 수 있는 도메인. auth가 mock이면 적어도 로컬로 돈다(토큰 없이 서버를 부르지 않게) */
export const ACCOUNT_DOMAINS: readonly ApiDomain[] = ["member", "ramenLogs", "recommendations"]

export function parseRemoteDomains(mode: ApiMode, raw: string | undefined | null): ReadonlySet<ApiDomain> {
  if (mode !== "remote") return new Set()
  const value = raw?.trim()
  if (!value || value.toLowerCase() === "all") return new Set(API_DOMAINS)
  const wanted = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
  const domains = new Set(API_DOMAINS.filter((domain) => wanted.some((item) => item.toLowerCase() === domain.toLowerCase())))
  if (!domains.has("auth")) for (const domain of ACCOUNT_DOMAINS) domains.delete(domain)
  return domains
}

export const REMOTE_DOMAINS: ReadonlySet<ApiDomain> = parseRemoteDomains(
  API_MODE,
  process.env.EXPO_PUBLIC_API_REMOTE_DOMAINS,
)

/** 이 도메인을 서버에서 읽는가. 기본 빌드(mock)에서는 항상 false다 */
export function isRemote(domain: ApiDomain): boolean {
  return REMOTE_DOMAINS.has(domain)
}

/**
 * 이 도메인의 회원 쓰기(찜·공감·댓글·신고·차단)를 서버로 보내는가.
 * 공개 읽기만 서버로 가는 조합(auth mock)에서는 기기 안 계정으로 로컬에서 처리한다.
 */
export function isRemoteWithAccount(domain: ApiDomain): boolean {
  return isRemote(domain) && isRemote("auth")
}
