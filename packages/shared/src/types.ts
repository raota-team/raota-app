export type TasteNoteKey = "broth" | "noodle" | "seasoning" | "topping"
export type TasteNotes = Record<TasteNoteKey, string[]>
export type RevisitOption = "자주 감" | "가끔 생각남" | "한번이면 충분"

/** 라멘 한 그릇을 평가하는 5축. PRODUCT.md의 5축 테이스팅과 같은 순서다. */
export type TasteAxisKey = "satisfaction" | "brothDensity" | "noodleFirmness" | "topping" | "revisit"
/** 각 축 1~5점. revisit은 RevisitOption에서 파생된다. */
export type TasteScores = Record<TasteAxisKey, number>
/** 누적 평균 점수와 그 평균에 쓰인 그릇 수 */
export interface TasteProfile {
  count: number
  /** 화면 표시용, 소수 첫째 자리 */
  scores: TasteScores
  /** 반올림 전 평균. 한 그릇의 작은 변화를 계산할 때 쓴다. */
  exact?: TasteScores
}

/** 구글 지도 크롤링 원본 CSV 레코드 인터페이스 */
export interface GoogleShopCsvRecord {
  ramen_shop_id: number | string
  source_name: string
  google_place_id: string
  google_display_name_text: string
  google_formatted_address: string
  google_location_latitude: number
  google_location_longitude: number
  google_google_maps_uri: string
  google_website_uri?: string
  google_national_phone_number?: string
  google_business_status: "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY" | string
  google_primary_type?: string
  google_types?: string[] | string
  google_rating?: number
  google_user_rating_count?: number
  google_price_level?: string
  google_price_range_start_price_currency_code?: string
  google_price_range_start_price_units?: number
  google_price_range_end_price_currency_code?: string
  google_price_range_end_price_units?: number
  google_regular_opening_hours_weekday_descriptions?: string[] | string
  google_dine_in?: boolean
  google_delivery?: boolean
  google_reservable?: boolean
  google_photos?: string[] | string
  google_reviews?: Array<{
    author_name?: string
    rating?: number
    text?: string
    relative_time_description?: string
  }> | string
  google_place_json?: string
  google_match_name_similarity?: number
  google_match_address_similarity?: number
  google_match_distance_m?: number
  google_match_score?: number
  google_match_status?: string
}

/** 앱 내 정형화된 라멘 매장 인터페이스 (raota-front 스펙 일치) */
export interface Shop {
  id: number
  name: string
  branch?: string
  address: string
  lat: number
  lng: number
  phone?: string
  rating: number
  reviewCount: number
  businessStatus: string
  isOpen: boolean
  openingHours: string[]
  priceRange?: string
  dineIn: boolean
  delivery: boolean
  reservable: boolean
  googleMapsUri?: string
  websiteUri?: string
  instagramUrl?: string
  catchTableUrl?: string
  /** 카카오 로컬 place_url. 카카오 데이터 중 저장이 허용된 값이며 앱 밖(브라우저·카카오맵 앱)으로만 연다 */
  kakaoPlaceUrl?: string
  photos: string[]
  tags: string[]
  matchScore: number
  distanceM: number
  reviews: Array<{
    author: string
    level?: string
    rating: number
    text: string
    time: string
  }>
  description?: string
  servicePerks?: {
    noodleRefill?: string
    riceRefill?: string
    soupRefill?: string
    condiments?: string
  }
}

export interface RamenLog {
  id: number
  author: {
    /** Local account ownership. Older persisted fixtures may not have this field. */
    id?: string
    name: string
    avatar?: string
    level: string
  }
  shop: {
    id: number
    name: string
    branch?: string
    location?: string
  }
  menuName: string
  ramenType: string
  visitedAt: string
  imageUrl: string | null
  photos?: string[]
  note: string
  tasteNotes: TasteNotes
  /** 5축 평가. 5축 도입 전 기록에는 없다. */
  scores?: TasteScores
  revisit: RevisitOption
  likes: number
  isLiked: boolean
  isPublic: boolean
  createdAt: string
  commentCount?: number
  comments?: RamenLogComment[]
}

export interface RamenLogComment {
  id: number
  logId: number
  author: CommunityAuthor
  content: string
  createdAt: string
  likes: number
  isLiked: boolean
  parentId?: number
  parentAuthorName?: string
}

export const TASTE_FIELDS: Array<{
  key: TasteNoteKey
  label: string
  options: string[]
}> = [
  {
    key: "broth",
    label: "국물",
    options: ["진해요", "깔끔해요", "감칠맛 좋아요", "기름져요", "어패류 향"],
  },
  {
    key: "noodle",
    label: "면",
    options: [
      "탄력 있어요",
      "단단해요",
      "부드러워요",
      "국물이 잘 배어요",
      "양 많아요",
    ],
  },
  {
    key: "seasoning",
    label: "간",
    options: ["딱 좋아요", "슴슴해요", "짭짤해요", "매콤해요", "밥 생각나요"],
  },
  {
    key: "topping",
    label: "토핑",
    options: [
      "차슈 좋아요",
      "계란 좋아요",
      "멘마 좋아요",
      "파 향 좋아요",
      "구성 알차요",
    ],
  },
]

export const RAMEN_TYPES = [
  "쇼유",
  "돈코츠",
  "시오",
  "미소",
  "츠케멘",
  "탄탄멘",
  "마제소바",
  "아부라소바",
  "기타",
]
export const REVISIT_OPTIONS: RevisitOption[] = [
  "자주 감",
  "가끔 생각남",
  "한번이면 충분",
]

export interface UserProfile {
  id: string
  name: string
  nickname: string
  email?: string
  avatar: string | null
  level: string
  levelNumber: number
  membershipNo: string
  bio?: string
  favoriteRamenType?: string
  visitedCount: number
  revisitCount: number
  isLoggedIn: boolean
}

export type NotificationType = "like" | "comment" | "level" | "shop" | "notice"

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  content: string
  time: string
  isRead: boolean
  targetScreen?: string
  targetShopId?: number
  targetLogId?: number
  targetPostId?: number
  targetReportId?: string
  avatar?: string
  senderName?: string
  shopName?: string
}

export interface NotificationSettings {
  pushEnabled: boolean
  likesEnabled: boolean
  commentsEnabled: boolean
  levelUpEnabled: boolean
  shopNewsEnabled: boolean
}

export type AuthProvider = "email" | "apple" | "kakao" | "google"

export interface LoginInput {
  provider?: AuthProvider
  email?: string
  name?: string
  nickname?: string
  avatar?: string | null
}

export type ProfileUpdateInput = Partial<Pick<UserProfile, "name" | "nickname" | "email" | "avatar" | "bio" | "favoriteRamenType">>

export interface CreateRamenLogInput {
  shopId: number
  shopName?: string
  branch?: string
  menuName: string
  ramenType: string
  visitedAt: string
  imageUrl?: string | null
  photos?: string[]
  /** 선택. 빈 문자열이면 메모 없음 */
  note: string
  /** 선택. 빈 배열이면 태그 없음 */
  tasteNotes: TasteNotes
  /** 필수 5축 평가. revisit 점수는 revisit 답에서 다시 계산된다 */
  scores: TasteScores
  revisit: RevisitOption
  isPublic: boolean
}

export type NewsCategory = "한정 메뉴" | "영업 공지" | "이벤트" | "신메뉴"

export interface NewsItem {
  id: number
  shopId: number
  shopName: string
  branch?: string
  handle: string
  category: NewsCategory
  title: string
  summary: string[]
  publishedAt: string
  imageUrl?: string | null
  instagramUrl: string
}

export type CommunityPostCategory = "REVIEW" | "TIP" | "QUESTION" | "FREE" | "POPULAR"

export interface CommunityAuthor {
  id: string
  name: string
  level: string
  avatar?: string | null
}

export interface CommunityComment {
  id: number
  postId: number
  author: CommunityAuthor
  content: string
  createdAt: string
  likes: number
  isLiked: boolean
  parentId?: number
  parentAuthorName?: string
}

export interface CommunityPost {
  id: number
  category: CommunityPostCategory
  categoryLabel: string
  title: string
  content: string
  detailedContent?: string[]
  author: CommunityAuthor
  createdAt: string
  likes: number
  commentCount: number
  viewCount: number
  isLiked: boolean
  shopId?: number
  shopName?: string
  imageUrls: string[]
  comments: CommunityComment[]
}

export interface CreateCommunityPostInput {
  category: Exclude<CommunityPostCategory, "POPULAR">
  title: string
  content: string
  detailedContent?: string[]
  shopId?: number
  imageUrls?: string[]
}

export interface CreateCommunityCommentInput {
  content: string
  parentId?: number
}

export interface CreateRamenLogCommentInput {
  content: string
  parentId?: number
}

export type TasteMetricKey = "brothRichness" | "noodleFirmness" | "saltBalance" | "umami" | "oilRichness"

export interface TasteMetric {
  key: TasteMetricKey
  label: string
  score: number
  average: number
}

export interface TasteTopShop {
  rank: number
  shopId: number
  style: string
  matchPercent?: number
  mustTry: string
  reason: string
  visitCount?: number
}

export interface TasteStyleShare {
  ramenType: string
  percentage: number
  count: number
  note: string
}

export interface TasteReport {
  id: string
  volume: string
  period: string
  publishedAt: string
  title: string
  levelLabel: string
  levelNumber: number
  quote: string
  recordCount: number
  tags: string[]
  strongestFeature: string
  metrics: TasteMetric[]
  insights: string[]
  topShops: TasteTopShop[]
  styleShares: TasteStyleShare[]
  changeSummary?: string
}

/** 라운지 신고 사유. 앱 심사 가이드라인 1.2(사용자 제작 콘텐츠)의 신고 기능 */
export type ContentReportReason = "spam" | "abuse" | "sexual" | "privacy" | "other"

export interface ContentReport {
  id: string
  kind: "log" | "comment"
  /** 신고한 라멘로그 또는 댓글의 id */
  targetId: number
  reason: ContentReportReason
  createdAt: string
}

/**
 * 로컬 저장소의 첫 공개 스키마. 새 필드는 optional로 추가하지 말고 다음
 * 버전으로 migrate해 오래 설치된 앱의 데이터를 안전하게 읽는다.
 * (hiddenAuthorIds·contentReports는 필수 필드로 추가하고, 없는 옛 저장본은 migratePersistedState가 빈 배열로 채운다)
 */
export interface PersistedAppStateV1 {
  version: 1
  user: UserProfile | null
  onboardingCompleted: boolean
  logs: RamenLog[]
  bookmarkedShopIds: number[]
  /** Shop IDs whose future news should also remain subscribed. */
  subscribedShopIds: number[]
  communityPosts: CommunityPost[]
  notifications: AppNotification[]
  notificationSettings: NotificationSettings
  tasteReports: TasteReport[]
  currentTasteReportId: string | null
  /** 라운지에서 숨긴 사용자(작성자 id). 그 사람의 라멘로그와 댓글을 보이지 않게 한다 */
  hiddenAuthorIds: string[]
  /** 이 기기에서 보낸 신고. 서버 신고 API가 붙기 전까지의 기록이다 */
  contentReports: ContentReport[]
}
