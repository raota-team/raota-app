/**
 * 서버 v2 계약(raota-server 이슈 #60·#44·#61·#62·#63·#46·#64·#59, 2026-09-19 3차 결정)의 전선(wire) 타입.
 * 앱 안에서 쓰는 타입(@raota/shared)과 섞지 않는다. 둘 사이 변환은 src/api/adapters.ts가 맡는다.
 *
 * 규칙
 * - id는 모두 10진수 문자열이다. BIGINT라서 Number()로 바꾸면 큰 값이 깨진다.
 * - 시간은 UTC ISO-8601 문자열, 날짜는 "YYYY-MM-DD".
 * - 없는 값은 null로 온다(키가 빠지지 않는다). 배열은 빈 배열로 온다.
 */

/** 10진수 문자열 id */
export type Id = string
/** ISO-8601 UTC */
export type DateTime = string
/** YYYY-MM-DD */
export type DateOnly = string

export type RamenType =
  | "쇼유"
  | "돈코츠"
  | "시오"
  | "미소"
  | "츠케멘"
  | "탄탄멘"
  | "마제소바"
  | "아부라소바"
  | "기타"

// ---------------------------------------------------------------------------
// 응답 봉투
// ---------------------------------------------------------------------------

export interface ResponseMeta {
  requestId: string
}

export interface ApiSuccessEnvelope<T> {
  success: true
  data: T
  meta?: ResponseMeta
}

export interface ApiErrorBody {
  code: string
  message: string
  fields?: Array<{ field: string; code: string; message: string }>
}

export interface ApiFailureEnvelope {
  success: false
  error: ApiErrorBody
  meta?: ResponseMeta
}

/** 커서 페이지. totalCount는 없다 */
export interface CursorPage<T> {
  items: T[]
  nextCursor: string | null
  hasNext: boolean
}

export interface CursorParams {
  cursor?: string | null
  /** 1~50, 기본 20 */
  size?: number
}

// ---------------------------------------------------------------------------
// 공통
// ---------------------------------------------------------------------------

/**
 * 글쓴이. 등급 이름표는 서버가 주지 않고 앱이 logCount로 만든다(getRamenActivityLevel).
 * 탈퇴한 회원은 id가 null이다.
 */
export interface Author {
  id: Id | null
  nickname: string
  avatarUrl: string | null
  logCount: number
}

export type MemberStatus = "ONBOARDING" | "ACTIVE"

export interface MemberMe {
  id: Id
  nickname: string | null
  email: string | null
  avatarUrl: string | null
  bio: string | null
  favoriteRamenType: RamenType | null
  status: MemberStatus
  /** 내가 남긴 라멘로그 수 */
  logCount: number
  onboardingCompletedAt: DateTime | null
}

// ---------------------------------------------------------------------------
// 인증 (#44)
// ---------------------------------------------------------------------------

export type OauthProvider = "KAKAO" | "GOOGLE" | "APPLE"

/**
 * 제공자별로 채우는 값이 다르다.
 * - GOOGLE: idToken
 * - KAKAO: accessToken
 * - APPLE: idToken(identityToken) + authorizationCode + nonce(앱이 만든 raw nonce)
 */
export interface OauthLoginRequest {
  provider: OauthProvider
  idToken?: string
  accessToken?: string
  authorizationCode?: string
  nonce?: string
}

export interface OauthLoginResponse {
  accessToken: string
  refreshToken: string
  /** 액세스 토큰 유효 시간(초) */
  expiresIn: number
  isNewMember: boolean
  member: MemberMe
}

export interface RefreshTokenRequest {
  refreshToken: string
}

export interface ReissueResponse {
  accessToken: string
  refreshToken: string
  expiresIn?: number
}

// ---------------------------------------------------------------------------
// 회원 (#44)
// ---------------------------------------------------------------------------

export interface UpdateMemberRequest {
  email?: string | null
  /** 업로드가 끝난 사진 주소 */
  avatarUrl?: string | null
  bio?: string | null
  favoriteRamenType?: RamenType | null
}

export type ConsentType = "TERMS" | "PRIVACY" | "MARKETING"

export interface OnboardingRequest {
  nickname: string
  consents: Array<{ type: ConsentType; documentVersion: string; granted: boolean }>
}

export interface NicknameAvailabilityResponse {
  available: boolean
}

export type WithdrawalReasonCode = "NOT_USING" | "INCONVENIENT" | "PRIVACY" | "OTHER"

export interface WithdrawalRequest {
  reasonCode: WithdrawalReasonCode
  /** 반드시 "WITHDRAW" */
  confirmation: "WITHDRAW"
}

/** 차단한 회원 */
export interface BlockedMember {
  id: Id
  nickname: string
  avatarUrl: string | null
}

// ---------------------------------------------------------------------------
// 매장 (#61)
// ---------------------------------------------------------------------------

export type ShopSort = "POPULAR" | "DISTANCE" | "LATEST"

export type BusinessStatus = "OPERATIONAL" | "TEMPORARILY_CLOSED" | "CLOSED" | "UNKNOWN"

export interface ShopSummary {
  id: Id
  name: string
  branchName: string | null
  address: string
  region: string | null
  latitude: number | null
  longitude: number | null
  imageUrl: string | null
  /** 한 줄 소개 */
  tagline: string | null
  ramenTypes: RamenType[]
  tags: string[]
  logCount: number
  bookmarkCount: number
  isBookmarked: boolean
  businessStatus: BusinessStatus
  /** 영업시간이 확인된 매장만 true·false. 확인 전이면 null("영업 정보 확인 필요") */
  isOpen: boolean | null
  distanceMeters: number | null
}

export type ServicePerkType = "NOODLE_REFILL" | "RICE_REFILL" | "SOUP_REFILL" | "CONDIMENT"
export type ServicePerkStatus = "FREE" | "PAID" | "NOT_OFFERED" | "UNKNOWN"

export interface ServicePerk {
  type: ServicePerkType
  status: ServicePerkStatus
  price: number | null
  conditionText: string | null
  verifiedAt: DateTime | null
}

/** 요일당 한 줄. 브레이크 타임과 라스트오더가 같이 온다 */
export interface BusinessHour {
  /** TODO(contract): 기준이 계약에 없다. ISO(1=월 … 7=일)로 보고 0=일(JS)도 받아 준다 */
  dayOfWeek: number
  opensAt: string | null
  closesAt: string | null
  breakStart: string | null
  breakEnd: string | null
  lastOrderAt: string | null
  isClosed: boolean
}

export interface ShopImage {
  url: string
}

export interface ShopDetail extends ShopSummary {
  description: string | null
  phone: string | null
  instagramUrl: string | null
  reservationUrl: string | null
  websiteUrl: string | null
  naverPlaceId: string | null
  kakaoPlaceId: string | null
  priceMin: number | null
  priceMax: number | null
  closedDaysText: string | null
  hoursVerifiedAt: DateTime | null
  images: ShopImage[]
  businessHours: BusinessHour[]
  servicePerks: ServicePerk[]
  /** 매장 상세 "가게 소개" 자리에 "AI가 요약했어요" 표시와 함께 들어간다 */
  aiReviewSummary: string | null
  aiSummaryKeywords: string[]
  aiSummaryGeneratedAt: DateTime | null
  /** 라오타 기록의 만족도 평균(외부 평점이 아니다) */
  averageSatisfaction?: number | null
}

export interface ShopListParams extends CursorParams {
  sort?: ShopSort
  query?: string
  region?: string
  ramenType?: RamenType | string
  openNow?: boolean
  /** DISTANCE 정렬에는 위·경도가 필요하다 */
  latitude?: number
  longitude?: number
}

/** 지도 핀(전체 매장, 페이지 없음) */
export interface MapPin {
  id: Id
  name: string
  branchName: string | null
  latitude: number | null
  longitude: number | null
  ramenTypes: RamenType[]
  isOpen: boolean | null
}

// ---------------------------------------------------------------------------
// 라멘로그 (#62)
// ---------------------------------------------------------------------------

export type RevisitIntention = "OFTEN" | "SOMETIMES" | "ONCE_IS_ENOUGH"
export type LogVisibility = "PUBLIC" | "PRIVATE"

/** 만들 때 보내는 4축(재방문 점수는 서버가 revisitIntention에서 만든다) */
export interface RamenLogScoreInput {
  satisfaction: number
  brothDensity: number
  noodleFirmness: number
  topping: number
}

/** 응답의 5축. v1에서 옮겨 온 기록은 null */
export interface RamenLogScores extends RamenLogScoreInput {
  revisit: number
}

export interface RamenLogShopRef {
  id: Id
  name: string
  branchName: string | null
  region: string | null
}

export interface RamenLogSummary {
  id: Id
  author: Author
  shop: RamenLogShopRef
  menuName: string
  ramenType: RamenType
  visitedAt: DateOnly
  /** 최대 3장. 대표 사진은 첫 장 */
  imageUrls: string[]
  note: string
  tasteNoteCodes: string[]
  revisitIntention: RevisitIntention
  visibility: LogVisibility
  scores: RamenLogScores | null
  likeCount: number
  commentCount: number
  isLiked: boolean
  isMine: boolean
  createdAt: DateTime
}

/** 답글 없는 한 줄 댓글 */
export interface RamenLogComment {
  id: Id
  logId: Id
  author: Author
  content: string
  createdAt: DateTime
  isMine: boolean
}

export interface RamenLogDetail extends RamenLogSummary {
  updatedAt: DateTime
  commentsPreview: RamenLogComment[]
  commentsNextCursor: string | null
}

/** 내 기록 전체를 가볍게(페이지 없음). 캘린더·방문 매장·월별·취향은 앱이 이 목록으로 계산한다 */
export interface RamenLogSummaryItem {
  id: Id
  visitedAt: DateOnly
  shop: { id: Id; name: string; branchName: string | null }
  menuName: string
  ramenType: RamenType
  scores: RamenLogScores | null
}

export interface CreateRamenLogRequest {
  shopId: Id
  visitedAt: DateOnly
  menuName: string
  ramenType: RamenType | string
  scores: RamenLogScoreInput
  revisitIntention: RevisitIntention
  /** 0~500자, 빈 문자열 허용 */
  note: string
  tasteNoteCodes: string[]
  visibility: LogVisibility
  /** 업로드가 끝난 사진 주소, 최대 3장 */
  imageUrls: string[]
}

export type UpdateRamenLogRequest = Partial<Omit<CreateRamenLogRequest, "shopId">>

export interface TasteNoteDefinitionsResponse {
  version: string
  groups: Array<{
    category: "BROTH" | "NOODLE" | "SEASONING" | "TOPPING" | string
    notes: Array<{ code: string; label: string }>
  }>
}

// ---------------------------------------------------------------------------
// 라운지 (#63)
// ---------------------------------------------------------------------------

export type LoungeSortParam = "LATEST" | "LIKES"

export interface LoungeFeedParams extends CursorParams {
  sort?: LoungeSortParam
  ramenType?: RamenType | string
  shopId?: Id
}

export interface LikeResponse {
  liked: boolean
  likeCount: number
}

export interface CreateCommentRequest {
  /** 2~500자 */
  content: string
}

export type ReportTargetType = "RAMEN_LOG" | "RAMEN_LOG_COMMENT"
export type ReportReason = "SPAM" | "ABUSE" | "SEXUAL" | "PRIVACY" | "OTHER"

export interface ReportRequest {
  targetType: ReportTargetType
  targetId: Id
  reason: ReportReason
}

// ---------------------------------------------------------------------------
// 파일 업로드 (#62)
// ---------------------------------------------------------------------------

export type UploadPurpose = "PROFILE" | "RAMEN_LOG"

export interface UploadTicketRequest {
  purpose: UploadPurpose
  files: Array<{ contentType: string; extension: string }>
}

/**
 * 업로드 한 장. 두 방식이 온다.
 * - method POST + fields: multipart/form-data로 fields와 file을 함께(Cloudinary)
 * - method PUT + headers: 파일 그대로 PUT(OCI presigned)
 * 업로드가 끝나면 imageUrl을 생성 본문에 넣는다.
 */
export interface UploadTicket {
  method: "PUT" | "POST"
  url: string
  fields: Record<string, string> | null
  headers: Record<string, string> | null
  imageUrl: string
}

export interface UploadTicketResponse {
  uploads: UploadTicket[]
}

// ---------------------------------------------------------------------------
// AI (#46)
// ---------------------------------------------------------------------------

export interface RecommendationRequest {
  soup?: string
  mood?: string
  priority?: string
  text?: string
  latitude?: number
  longitude?: number
  region?: string
}

export interface RecommendationResponse {
  /** 최대 6곳 */
  shops: ShopSummary[]
  /** "지금 영업 중", "1km 이내"처럼 화면에 그대로 보여주는 말 */
  appliedConditions: string[]
}

/** 오늘의 큐레이션. 없으면 null */
export interface TodayCuration {
  shop: ShopSummary
  title: string
  reason: string
}
