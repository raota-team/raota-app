export type TasteNoteKey = 'broth' | 'noodle' | 'seasoning' | 'topping'
export type TasteNotes = Record<TasteNoteKey, string[]>
export type RevisitOption = '자주 감' | '가끔 생각남' | '한번이면 충분'

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
  google_business_status: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY' | string
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
  revisit: RevisitOption
  likes: number
  isLiked: boolean
  isPublic: boolean
  createdAt: string
}

export const TASTE_FIELDS: Array<{ key: TasteNoteKey; label: string; options: string[] }> = [
  { key: 'broth', label: '국물', options: ['진해요', '깔끔해요', '감칠맛 좋아요', '기름져요', '어패류 향'] },
  { key: 'noodle', label: '면', options: ['탄력 있어요', '단단해요', '부드러워요', '국물이 잘 배어요', '양 많아요'] },
  { key: 'seasoning', label: '간', options: ['딱 좋아요', '슴슴해요', '짭짤해요', '매콤해요', '밥 생각나요'] },
  { key: 'topping', label: '토핑', options: ['차슈 좋아요', '계란 좋아요', '멘마 좋아요', '파 향 좋아요', '구성 알차요'] },
]

export const RAMEN_TYPES = ['쇼유', '돈코츠', '시오', '미소', '츠케멘', '탄탄멘', '마제소바', '아부라소바', '기타']
export const REVISIT_OPTIONS: RevisitOption[] = ['자주 감', '가끔 생각남', '한번이면 충분']

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

export type NotificationType = 'like' | 'comment' | 'level' | 'shop' | 'notice'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  content: string
  time: string
  isRead: boolean
  targetScreen?: string
  targetShopId?: number
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


