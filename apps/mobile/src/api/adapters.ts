import {
  REVISIT_SCORE,
  TASTE_FIELDS,
  getRamenActivityLevel,
  type CommunityAuthor,
  type CreateRamenLogInput,
  type DemoBowl,
  type ProfileUpdateInput,
  type RamenLog,
  type RamenLogComment as AppRamenLogComment,
  type RevisitOption,
  type Shop,
  type ShopAISummary,
  type TasteNoteKey,
  type TasteNotes,
  type TasteScores,
  type UserProfile,
} from "@raota/shared"

import { ApiError } from "./client"
import type {
  Author,
  BusinessHour,
  BusinessStatus,
  CreateRamenLogRequest,
  Id,
  MapPin,
  MemberMe,
  RamenLogComment,
  RamenLogDetail,
  RamenLogScores,
  RamenLogSummary,
  RamenLogSummaryItem,
  RevisitIntention,
  ServicePerk,
  ShopDetail,
  ShopSummary,
  UpdateMemberRequest,
} from "./types"

/**
 * 전선(wire) 타입 ⇄ 앱 타입(@raota/shared) 변환. 순수 함수만 둔다(요청·저장 없음).
 * 화면은 앱 타입만 보고, 서버 필드 이름은 이 파일 밖으로 새지 않는다.
 *
 * TODO(앱 id): 앱 타입의 id는 아직 number(Shop.id, RamenLog.id, RamenLogComment.id)인데
 * 서버 id는 BIGINT 문자열이다. Number.MAX_SAFE_INTEGER를 넘는 id는 담을 수 없어
 * toAppId가 조용히 반올림하지 않고 UNSUPPORTED_ID 오류를 낸다.
 * 서버를 붙이기 전에 앱 타입의 id를 문자열로 옮기는 작업(별도 PR)이 필요하다.
 */

// ---------------------------------------------------------------------------
// id
// ---------------------------------------------------------------------------

const DECIMAL_ID = /^\d+$/

/** 서버 id(10진수 문자열) → 앱 id(number). 안전하게 담기지 않으면 오류를 낸다 */
export function toAppId(id: Id, label = "id"): number {
  const value = Number(id)
  if (typeof id !== "string" || !DECIMAL_ID.test(id) || !Number.isSafeInteger(value)) {
    throw new ApiError({
      status: 0,
      code: "UNSUPPORTED_ID",
      message: `서버 ${label}(${String(id)})를 앱에서 다룰 수 없어요. 앱 업데이트가 필요해요.`,
    })
  }
  return value
}

/** 앱 id(number) → 서버 id(문자열) */
export function toWireId(id: number | string): Id {
  return typeof id === "string" ? id : String(id)
}

// ---------------------------------------------------------------------------
// 글쓴이·등급
// ---------------------------------------------------------------------------

/** 탈퇴한 회원의 표시 이름 */
export const WITHDRAWN_AUTHOR_NAME = "탈퇴한 회원"

/** 기록 수 → 등급 이름("라멘집 탐험가"). 웹과 같은 계산(getRamenActivityLevel)을 쓴다 */
export function levelTitleOf(logCount: number): string {
  return getRamenActivityLevel(Math.max(0, Math.trunc(logCount) || 0)).title
}

/** 기록 수 → 등급 번호(1부터) */
export function levelNumberOf(logCount: number): number {
  return getRamenActivityLevel(Math.max(0, Math.trunc(logCount) || 0)).number
}

/** 라운지 카드에 쓰는 "라멘집 탐험가 (Lv.3)". 탈퇴한 회원은 등급을 보여주지 않는다 */
export function authorLevelLabel(author: Pick<Author, "id" | "logCount">): string {
  if (author.id === null) return ""
  const level = getRamenActivityLevel(Math.max(0, Math.trunc(author.logCount) || 0))
  return `${level.title} (Lv.${level.number})`
}

export function toAppAuthor(author: Author): RamenLog["author"] {
  return {
    // 탈퇴한 회원은 id가 없다 → 숨기기·신고 대상이 되지 않는다
    id: author.id ?? undefined,
    name: author.nickname || WITHDRAWN_AUTHOR_NAME,
    avatar: author.avatarUrl ?? undefined,
    level: authorLevelLabel(author),
  }
}

/** 댓글 글쓴이. CommunityAuthor.id는 필수라서 탈퇴한 회원은 빈 문자열로 둔다 */
export function toAppCommentAuthor(author: Author): CommunityAuthor {
  return {
    id: author.id ?? "",
    name: author.nickname || WITHDRAWN_AUTHOR_NAME,
    level: authorLevelLabel(author),
    avatar: author.avatarUrl,
  }
}

// ---------------------------------------------------------------------------
// 맛 태그 코드 ⇄ 라벨
// ---------------------------------------------------------------------------

const TASTE_CODE_PREFIX: Record<TasteNoteKey, string> = {
  broth: "BROTH",
  noodle: "NOODLE",
  seasoning: "SEASONING",
  topping: "TOPPING",
}

/** BROTH_01 … TOPPING_05. 순서는 앱의 TASTE_FIELDS 보기 순서와 같다 */
export function tasteNoteCodeOf(key: TasteNoteKey, index: number): string {
  return `${TASTE_CODE_PREFIX[key]}_${String(index + 1).padStart(2, "0")}`
}

const CODE_TO_NOTE = new Map<string, { key: TasteNoteKey; label: string }>()
const NOTE_TO_CODE = new Map<string, string>()
for (const field of TASTE_FIELDS) {
  field.options.forEach((label, index) => {
    const code = tasteNoteCodeOf(field.key, index)
    CODE_TO_NOTE.set(code, { key: field.key, label })
    NOTE_TO_CODE.set(`${field.key}:${label}`, code)
  })
}

function emptyTasteNotes(): TasteNotes {
  return { broth: [], noodle: [], seasoning: [], topping: [] }
}

/** 서버 코드 → 앱 맛 태그. 모르는 코드는 버린다 */
export function toAppTasteNotes(codes: readonly string[] | null | undefined): TasteNotes {
  const notes = emptyTasteNotes()
  for (const code of codes ?? []) {
    const found = CODE_TO_NOTE.get(code)
    if (found && !notes[found.key].includes(found.label)) notes[found.key].push(found.label)
  }
  return notes
}

/** 앱 맛 태그 → 서버 코드(국물 → 면 → 간 → 토핑 순) */
export function toTasteNoteCodes(notes: TasteNotes | null | undefined): string[] {
  if (!notes) return []
  const codes: string[] = []
  for (const field of TASTE_FIELDS) {
    for (const label of notes[field.key] ?? []) {
      const code = NOTE_TO_CODE.get(`${field.key}:${label}`)
      if (code && !codes.includes(code)) codes.push(code)
    }
  }
  return codes
}

// ---------------------------------------------------------------------------
// 재방문 의사·공개 범위·점수
// ---------------------------------------------------------------------------

const REVISIT_FROM_WIRE: Record<RevisitIntention, RevisitOption> = {
  OFTEN: "자주 감",
  SOMETIMES: "가끔 생각남",
  ONCE_IS_ENOUGH: "한번이면 충분",
}

const REVISIT_TO_WIRE: Record<RevisitOption, RevisitIntention> = {
  "자주 감": "OFTEN",
  "가끔 생각남": "SOMETIMES",
  "한번이면 충분": "ONCE_IS_ENOUGH",
}

/** 모르는 값이 오면 가운데(가끔 생각남)로 둔다. 화면이 빈 값으로 무너지지 않게 */
export function revisitFromWire(intention: RevisitIntention | string): RevisitOption {
  return REVISIT_FROM_WIRE[intention as RevisitIntention] ?? "가끔 생각남"
}

export function revisitToWire(option: RevisitOption): RevisitIntention {
  return REVISIT_TO_WIRE[option] ?? "SOMETIMES"
}

/** 점수만 있는 기록(요약 목록)의 재방문 점수 → 재방문 의사 */
export function revisitFromScore(score: number | undefined): RevisitOption {
  if (score === undefined) return "가끔 생각남"
  if (score >= 5) return "자주 감"
  return score <= 1 ? "한번이면 충분" : "가끔 생각남"
}

export function isPublicFromWire(visibility: string): boolean {
  return visibility === "PUBLIC"
}

export function visibilityToWire(isPublic: boolean): "PUBLIC" | "PRIVATE" {
  return isPublic ? "PUBLIC" : "PRIVATE"
}

/**
 * 5축 점수. 재방문 점수는 재방문 의사 답에서 다시 계산한다(서버도 같은 규칙이라 값은 같다).
 * 점수가 없는 옛 기록(null)은 앱에서도 없음(undefined)이다.
 */
export function toAppScores(scores: RamenLogScores | null, revisit: RevisitOption): TasteScores | undefined {
  if (!scores) return undefined
  return {
    satisfaction: scores.satisfaction,
    brothDensity: scores.brothDensity,
    noodleFirmness: scores.noodleFirmness,
    topping: scores.topping,
    revisit: REVISIT_SCORE[revisit] ?? scores.revisit,
  }
}

// ---------------------------------------------------------------------------
// 라멘로그
// ---------------------------------------------------------------------------

export function toAppRamenLog(log: RamenLogSummary | RamenLogDetail): RamenLog {
  const detail = "commentsPreview" in log ? (log as RamenLogDetail) : null
  const revisit = revisitFromWire(log.revisitIntention)
  const photos = log.imageUrls ?? []
  return {
    id: toAppId(log.id, "라멘로그 id"),
    author: toAppAuthor(log.author),
    shop: {
      id: toAppId(log.shop.id, "매장 id"),
      name: log.shop.name,
      branch: log.shop.branchName ?? undefined,
      location: log.shop.region ?? undefined,
    },
    menuName: log.menuName,
    ramenType: log.ramenType,
    visitedAt: log.visitedAt,
    imageUrl: photos[0] ?? null,
    photos,
    note: log.note ?? "",
    tasteNotes: toAppTasteNotes(log.tasteNoteCodes),
    scores: toAppScores(log.scores, revisit),
    revisit,
    likes: log.likeCount,
    isLiked: log.isLiked,
    isPublic: isPublicFromWire(log.visibility),
    createdAt: log.createdAt,
    commentCount: log.commentCount,
    // 목록 응답에는 댓글이 없다(undefined = 아직 모름). 상세 응답은 미리보기 댓글을 채운다
    comments: detail ? detail.commentsPreview.map(toAppRamenLogComment) : undefined,
  }
}

/** 답글 없는 한 줄 댓글. 앱의 parentId·공감은 서버에 없어 비워 둔다 */
export function toAppRamenLogComment(comment: RamenLogComment): AppRamenLogComment {
  return {
    id: toAppId(comment.id, "댓글 id"),
    logId: toAppId(comment.logId, "라멘로그 id"),
    author: toAppCommentAuthor(comment.author),
    content: comment.content,
    createdAt: comment.createdAt,
    likes: 0,
    isLiked: false,
  }
}

export function toAppRamenLogComments(comments: readonly RamenLogComment[]): AppRamenLogComment[] {
  return comments.map(toAppRamenLogComment)
}

export interface CreateRamenLogBodyOptions {
  /** 업로드가 끝난 사진 주소(최대 3장) */
  imageUrls?: string[]
}

/**
 * 기록 작성 입력 → 생성 본문.
 * 재방문 점수(scores.revisit)는 보내지 않는다. 서버가 revisitIntention에서 만든다.
 */
export function toCreateRamenLogBody(
  input: CreateRamenLogInput,
  options: CreateRamenLogBodyOptions = {},
): CreateRamenLogRequest {
  return {
    shopId: toWireId(input.shopId),
    visitedAt: input.visitedAt,
    menuName: input.menuName.trim(),
    ramenType: input.ramenType,
    scores: {
      satisfaction: input.scores.satisfaction,
      brothDensity: input.scores.brothDensity,
      noodleFirmness: input.scores.noodleFirmness,
      topping: input.scores.topping,
    },
    revisitIntention: revisitToWire(input.revisit),
    note: input.note ?? "",
    tasteNoteCodes: toTasteNoteCodes(input.tasteNotes),
    visibility: visibilityToWire(input.isPublic),
    imageUrls: (options.imageUrls ?? []).slice(0, 3),
  }
}

/**
 * 내 기록 요약 → 앱의 "그릇" 한 줄(캘린더·방문 매장·월별 분포가 이 목록으로 계산된다).
 * 서버가 캘린더·방문 매장 API를 주지 않기로 해서, 앱이 요약 목록 하나로 다 만든다.
 */
export function toAppBowl(item: RamenLogSummaryItem): DemoBowl {
  return {
    date: item.visitedAt,
    shop: item.shop.name,
    type: item.ramenType,
    menu: item.menuName,
  }
}

export function toAppBowls(items: readonly RamenLogSummaryItem[]): DemoBowl[] {
  return items.map(toAppBowl).sort((a, b) => b.date.localeCompare(a.date))
}

/** 재방문 의사가 있는 그릇 수(프로필의 "다시 갈 집"). 서버에 필드가 없어 요약 목록에서 센다 */
export function revisitCountOf(items: readonly RamenLogSummaryItem[]): number {
  return items.reduce((count, item) => count + Number((item.scores?.revisit ?? 0) >= 3), 0)
}

// ---------------------------------------------------------------------------
// 매장
// ---------------------------------------------------------------------------

/** 서버가 "모른다"(null)고 한 값. 화면은 이 항목을 단정해 보여주면 안 된다 */
export type ShopUnknownField = "isOpen" | "location" | "distance"

/**
 * 앱 Shop에 서버만 주는 값을 덧붙인 모양. Shop을 받는 화면은 그대로 쓰면 되고,
 * 매장 상세는 lastOrder·tagline까지 쓴다(ShopCatalogItem에 있던 값들).
 */
export interface RemoteShop extends Shop {
  ramenTypes: string[]
  bookmarkCount: number
  isBookmarked: boolean
  region?: string
  /** 한 줄 소개(원장의 spec 자리) */
  tagline?: string
  /** 오늘의 라스트오더 */
  lastOrder?: string
  /** "매주 월요일 휴무"처럼 영업시간으로 못 적는 휴무 안내 */
  closedDaysText?: string
  unknownFields: ShopUnknownField[]
}

/** 서버 영업 상태 → 화면이 쓰는 값(매장 상세 businessLabel) */
const BUSINESS_STATUS_TO_APP: Record<BusinessStatus, string> = {
  OPERATIONAL: "OPERATIONAL",
  TEMPORARILY_CLOSED: "CLOSED_TEMPORARILY",
  CLOSED: "CLOSED_PERMANENTLY",
  UNKNOWN: "UNKNOWN",
}

/** 요일 이름. 자리는 JS Date#getDay()와 같다(0=일) */
const DAY_NAMES = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"]
/** 화면에 보여주는 순서(월 → 일) */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

/**
 * TODO(contract): businessHours.dayOfWeek의 기준이 계약에 없다.
 * ISO(1=월 … 7=일)로 보고, 0=일(JS 기준)도 함께 받아 준다.
 */
export function normalizeDayOfWeek(dayOfWeek: number): number | null {
  if (!Number.isFinite(dayOfWeek)) return null
  const day = Math.trunc(dayOfWeek)
  if (day === 7) return 0
  return day >= 0 && day <= 6 ? day : null
}

/** "11:30:00" → "11:30" */
function toShortTime(value: string): string {
  return /^\d{2}:\d{2}(:\d{2})?$/.test(value) ? value.slice(0, 5) : value
}

/** 하루치 "11:30 ~ 15:00, 17:00 ~ 21:00". 시간을 모르면 null */
function hoursTextOf(hour: BusinessHour): string | null {
  if (hour.isClosed) return "휴무"
  if (!hour.opensAt || !hour.closesAt) return null
  const open = toShortTime(hour.opensAt)
  const close = toShortTime(hour.closesAt)
  if (hour.breakStart && hour.breakEnd) {
    return `${open} ~ ${toShortTime(hour.breakStart)}, ${toShortTime(hour.breakEnd)} ~ ${close}`
  }
  return `${open} ~ ${close}`
}

/**
 * 영업시간 → 매장 상세가 읽는 문자열 목록.
 * 화면이 "요일: 시간" 모양을 그대로 쓴다(월요일부터, 브레이크 타임은 쉼표로 잇는다).
 */
export function toOpeningHours(hours: readonly BusinessHour[] | null | undefined): string[] {
  if (!hours?.length) return []
  const byDay = new Map<number, BusinessHour>()
  for (const hour of hours) {
    const day = normalizeDayOfWeek(hour.dayOfWeek)
    if (day !== null && !byDay.has(day)) byDay.set(day, hour)
  }

  const lines: string[] = []
  for (const day of WEEK_ORDER) {
    const hour = byDay.get(day)
    if (!hour) continue
    const text = hoursTextOf(hour)
    // 시간을 모르는 날은 아예 적지 않는다(빈 시간으로 보여 주지 않는다)
    if (text) lines.push(`${DAY_NAMES[day]}: ${text}`)
  }
  return lines
}

/** 오늘의 라스트오더. 오늘 자리가 없거나 휴무면 undefined */
export function todayLastOrder(
  hours: readonly BusinessHour[] | null | undefined,
  today: Date = new Date(),
): string | undefined {
  const day = today.getDay()
  const hour = hours?.find((item) => normalizeDayOfWeek(item.dayOfWeek) === day)
  if (!hour || hour.isClosed || !hour.lastOrderAt) return undefined
  return toShortTime(hour.lastOrderAt)
}

function formatWon(price: number): string {
  return `${Math.round(price)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}원`
}

/** "₩10,000 ~ ₩15,000". 한쪽만 알면 그쪽만 적고, 둘 다 모르면 undefined */
export function toPriceRange(priceMin: number | null, priceMax: number | null): string | undefined {
  const won = (price: number) => `₩${formatWon(price).replace("원", "")}`
  if (priceMin !== null && priceMax !== null) {
    return priceMin === priceMax ? won(priceMin) : `${won(priceMin)} ~ ${won(priceMax)}`
  }
  if (priceMin !== null) return `${won(priceMin)} ~`
  return priceMax !== null ? `~ ${won(priceMax)}` : undefined
}

/**
 * 서비스 혜택 → 매장 상세가 보여주는 한 줄.
 * NOT_OFFERED·UNKNOWN은 비워 둔다. 앱은 "값이 있으면 제공한다"로 읽기 때문이다.
 * FREE는 "무료"라는 말을 반드시 담는다(AI 추천이 이 말로 무료 리필을 찾는다).
 */
export function toServicePerks(perks: readonly ServicePerk[] | null | undefined): Shop["servicePerks"] | undefined {
  if (!perks?.length) return undefined
  const result: NonNullable<Shop["servicePerks"]> = {}
  for (const perk of perks) {
    const base =
      perk.status === "FREE"
        ? "무료"
        : perk.status === "PAID"
          ? perk.price === null
            ? "유료"
            : `유료 ${formatWon(perk.price)}`
          : null
    if (!base) continue
    const text = perk.conditionText ? `${base} · ${perk.conditionText}` : base
    switch (perk.type) {
      case "NOODLE_REFILL":
        result.noodleRefill = text
        break
      case "RICE_REFILL":
        result.riceRefill = text
        break
      case "SOUP_REFILL":
        result.soupRefill = text
        break
      case "CONDIMENT":
        result.condiments = text
        break
    }
  }
  return Object.keys(result).length > 0 ? result : undefined
}

/** AI 요약 소개. 글이 없으면 undefined(화면은 description을 보여준다) */
export function toShopAISummary(detail: ShopDetail): ShopAISummary | undefined {
  const text = detail.aiReviewSummary?.trim()
  if (!text) return undefined
  const keywords = (detail.aiSummaryKeywords ?? []).map((keyword) => keyword.trim()).filter(Boolean)
  const generatedAt = detail.aiSummaryGeneratedAt?.slice(0, 10)
  return {
    text,
    ...(keywords.length > 0 ? { keywords: keywords.slice(0, 4) } : {}),
    ...(generatedAt ? { generatedAt } : {}),
  }
}

function unknownFieldsOf(shop: ShopSummary): ShopUnknownField[] {
  const unknown: ShopUnknownField[] = []
  if (shop.isOpen === null) unknown.push("isOpen")
  if (shop.latitude === null || shop.longitude === null) unknown.push("location")
  if (shop.distanceMeters === null) unknown.push("distance")
  return unknown
}

/**
 * 영업 중인지 모르는 매장(isOpen null)은 "준비 중"이 아니라 "영업 정보 확인 필요"로 보여야 한다.
 * 화면은 businessStatus로 그 문구를 고르므로 OPERATIONAL + 모름이면 UNKNOWN으로 바꾼다.
 * (임시 휴업·폐업은 그대로 둔다. 원래 값은 unknownFields로 남는다)
 */
function businessStatusOf(shop: ShopSummary): string {
  if (shop.businessStatus === "OPERATIONAL" && shop.isOpen === null) return "UNKNOWN"
  return BUSINESS_STATUS_TO_APP[shop.businessStatus] ?? "UNKNOWN"
}

/**
 * 매장 목록 항목 → 앱 Shop.
 *
 * 앱 Shop은 아직 "모름"을 담지 못한다(isOpen은 boolean, 거리·좌표는 number).
 * 서버가 null로 보낸 값은 false·0으로 두되 unknownFields에 남겨, 화면이 "확인 필요"로 보여줄 수 있게 한다.
 * rating·reviews는 외부 평점이 계약에서 빠져 비어 있고, reviewCount에는 라멘로그 수(logCount)가 들어간다.
 */
export function toAppShopSummary(shop: ShopSummary): RemoteShop {
  return {
    id: toAppId(shop.id, "매장 id"),
    name: shop.name,
    branch: shop.branchName ?? undefined,
    address: shop.address,
    lat: shop.latitude ?? 0,
    lng: shop.longitude ?? 0,
    rating: 0,
    reviewCount: shop.logCount,
    businessStatus: businessStatusOf(shop),
    isOpen: shop.isOpen ?? false,
    openingHours: [],
    dineIn: true,
    delivery: false,
    reservable: false,
    photos: shop.imageUrl ? [shop.imageUrl] : [],
    tags: shop.tags ?? [],
    // 서버에는 로컬 랭킹 점수가 없다. 화면의 "추천순"은 지금도 로컬 계산을 쓴다
    matchScore: 0,
    distanceM: Math.round(shop.distanceMeters ?? 0),
    reviews: [],
    ramenTypes: shop.ramenTypes ?? [],
    bookmarkCount: shop.bookmarkCount,
    isBookmarked: shop.isBookmarked,
    ...(shop.region ? { region: shop.region } : {}),
    ...(shop.tagline ? { tagline: shop.tagline } : {}),
    unknownFields: unknownFieldsOf(shop),
  }
}

/** 매장 상세 → 앱 Shop. 목록 매핑에 상세 필드를 더한다 */
export function toAppShopDetail(shop: ShopDetail, today: Date = new Date()): RemoteShop {
  const lastOrder = todayLastOrder(shop.businessHours, today)
  const priceRange = toPriceRange(shop.priceMin, shop.priceMax)
  return {
    ...toAppShopSummary(shop),
    phone: shop.phone ?? undefined,
    openingHours: toOpeningHours(shop.businessHours),
    websiteUri: shop.websiteUrl ?? undefined,
    instagramUrl: shop.instagramUrl ?? undefined,
    // 예약 링크는 화면의 "캐치테이블" 버튼이 쓴다
    catchTableUrl: shop.reservationUrl ?? undefined,
    naverMapId: shop.naverPlaceId ?? undefined,
    kakaoPlaceUrl: shop.kakaoPlaceId ? `https://place.map.kakao.com/${shop.kakaoPlaceId}` : undefined,
    photos: shop.images?.length ? shop.images.map((image) => image.url) : shop.imageUrl ? [shop.imageUrl] : [],
    description: shop.description ?? undefined,
    aiSummary: toShopAISummary(shop),
    servicePerks: toServicePerks(shop.servicePerks),
    // 라오타 기록의 만족도 평균. 외부 평점이 아니라서 없으면 0(화면이 감춘다)
    rating: shop.averageSatisfaction ?? 0,
    ...(priceRange ? { priceRange } : {}),
    ...(lastOrder ? { lastOrder } : {}),
    ...(shop.closedDaysText ? { closedDaysText: shop.closedDaysText } : {}),
  }
}

export interface RemoteMapPin {
  id: number
  name: string
  branch?: string
  lat: number
  lng: number
  ramenTypes: string[]
  isOpen: boolean
  unknownFields: ShopUnknownField[]
}

/** 지도 핀. 좌표를 모르는 매장은 지도에 찍을 수 없어 호출하는 쪽에서 걸러 낸다 */
export function toAppMapPin(pin: MapPin): RemoteMapPin {
  const unknownFields: ShopUnknownField[] = []
  if (pin.isOpen === null) unknownFields.push("isOpen")
  if (pin.latitude === null || pin.longitude === null) unknownFields.push("location")
  return {
    id: toAppId(pin.id, "매장 id"),
    name: pin.name,
    branch: pin.branchName ?? undefined,
    lat: pin.latitude ?? 0,
    lng: pin.longitude ?? 0,
    ramenTypes: pin.ramenTypes ?? [],
    isOpen: pin.isOpen ?? false,
    unknownFields,
  }
}

// ---------------------------------------------------------------------------
// 회원
// ---------------------------------------------------------------------------

export interface AppMember {
  profile: UserProfile
  /** 온보딩(닉네임·약관)을 마쳤는가 */
  onboardingCompleted: boolean
}

export interface AppMemberOptions {
  /**
   * 재방문 의사가 있는 그릇 수. 서버에 필드가 없어 내 기록 요약(revisitCountOf)에서 센다.
   * 아직 못 셌으면 0으로 둔다.
   */
  revisitCount?: number
}

/**
 * 서버 회원 → 앱 사용자.
 *
 * TODO(contract): 회원번호(membershipNo)가 계약에 없다. 지금은 회원 id로 만든다.
 * 등급은 서버가 주지 않고 기록 수로 앱이 계산한다(웹과 같은 getRamenActivityLevel).
 */
export function toAppUserProfile(member: MemberMe, options: AppMemberOptions = {}): UserProfile {
  const nickname = member.nickname ?? ""
  return {
    id: member.id,
    name: nickname,
    nickname,
    email: member.email ?? undefined,
    avatar: member.avatarUrl,
    level: levelTitleOf(member.logCount),
    levelNumber: levelNumberOf(member.logCount),
    membershipNo: `#RT-${member.id}`,
    bio: member.bio ?? "",
    favoriteRamenType: member.favoriteRamenType ?? undefined,
    visitedCount: member.logCount,
    revisitCount: options.revisitCount ?? 0,
    isLoggedIn: true,
  }
}

export function toAppMember(member: MemberMe, options: AppMemberOptions = {}): AppMember {
  return {
    profile: toAppUserProfile(member, options),
    onboardingCompleted: member.status === "ACTIVE" && Boolean(member.onboardingCompletedAt),
  }
}

/**
 * 프로필 수정 입력 → 서버 본문.
 * 닉네임은 온보딩(PUT /members/me/onboarding)에서만 정한다. 사진은 업로드한 주소로 보낸다.
 */
export function toUpdateMemberBody(input: ProfileUpdateInput, avatarUrl?: string | null): UpdateMemberRequest {
  const body: UpdateMemberRequest = {}
  if (input.email !== undefined) body.email = input.email ?? null
  if (input.bio !== undefined) body.bio = input.bio ?? null
  if (input.favoriteRamenType !== undefined) {
    body.favoriteRamenType = (input.favoriteRamenType ?? null) as UpdateMemberRequest["favoriteRamenType"]
  }
  if (avatarUrl !== undefined) body.avatarUrl = avatarUrl
  return body
}
