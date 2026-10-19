import type {
  AppNotification,
  CommunityAuthor,
  CommunityComment,
  CommunityPost,
  ContentReport,
  NotificationSettings,
  PersistedAppStateV1,
  RamenLog,
  RamenLogComment,
  TasteMetric,
  TasteReport,
  TasteStyleShare,
  TasteTopShop,
  UserProfile,
} from "@raota/shared"
import { isTasteScores } from "@raota/shared"

import { createInitialPersistedState, NEWS_ITEMS } from "../data/fixtures"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === "string"
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString)
}

/** 예전 숫자 ID만 문자열로 올린다. 서버 BIGINT 문자열은 Number로 바꾸지 않는다. */
function entityId(value: unknown): string | null {
  if (isString(value)) return value.trim() ? value : null
  return isFiniteNumber(value) && Number.isSafeInteger(value) && value > 0
    ? String(value)
    : null
}

function cleanEntityIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(entityId).filter((id): id is string => id !== null))]
}

function withEntityIds(value: Record<string, unknown>, ...fields: string[]): Record<string, unknown> {
  const migrated = { ...value }
  for (const field of fields) {
    const id = entityId(migrated[field])
    if (id !== null) migrated[field] = id
  }
  return migrated
}

function migratedComment(value: unknown, relation: "logId" | "postId"): unknown {
  if (!isRecord(value)) return value
  return {
    ...withEntityIds(value, "id", relation, "parentId"),
    author: isRecord(value.author) ? withEntityIds(value.author, "id") : value.author,
  }
}

function migratedLog(value: unknown): unknown {
  if (!isRecord(value)) return value
  return {
    ...withEntityIds(value, "id"),
    author: isRecord(value.author) ? withEntityIds(value.author, "id") : value.author,
    shop: isRecord(value.shop) ? withEntityIds(value.shop, "id") : value.shop,
    comments: Array.isArray(value.comments)
      ? value.comments.map((comment) => migratedComment(comment, "logId"))
      : value.comments,
  }
}

function migratedPost(value: unknown): unknown {
  if (!isRecord(value)) return value
  return {
    ...withEntityIds(value, "id", "shopId"),
    author: isRecord(value.author) ? withEntityIds(value.author, "id") : value.author,
    comments: Array.isArray(value.comments)
      ? value.comments.map((comment) => migratedComment(comment, "postId"))
      : value.comments,
  }
}

function migratedTasteReport(value: unknown): unknown {
  if (!isRecord(value)) return value
  return {
    ...value,
    // 리포트의 id/volume은 월호 식별자라 바꾸지 않고, 추천 매장 참조만 올린다.
    topShops: Array.isArray(value.topShops)
      ? value.topShops.map((shop) => isRecord(shop) ? withEntityIds(shop, "shopId") : shop)
      : value.topShops,
  }
}

const REPORT_REASONS: ReadonlyArray<ContentReport["reason"]> = ["spam", "abuse", "sexual", "privacy", "other"]

function isContentReport(value: unknown): value is ContentReport {
  return (
    isRecord(value) &&
    isString(value.id) &&
    (value.kind === "log" || value.kind === "comment") &&
    isString(value.targetId) &&
    REPORT_REASONS.includes(value.reason as ContentReport["reason"]) &&
    isString(value.createdAt)
  )
}

function isCommunityAuthor(value: unknown): value is CommunityAuthor {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isString(value.level) &&
    (value.avatar === undefined ||
      value.avatar === null ||
      isString(value.avatar))
  )
}

function isTasteNotes(value: unknown): value is RamenLog["tasteNotes"] {
  return (
    isRecord(value) &&
    isStringArray(value.broth) &&
    isStringArray(value.noodle) &&
    isStringArray(value.seasoning) &&
    isStringArray(value.topping)
  )
}

function isRamenLogComment(value: unknown): value is RamenLogComment {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.logId) &&
    isCommunityAuthor(value.author) &&
    isString(value.content) &&
    isString(value.createdAt) &&
    isFiniteNumber(value.likes) &&
    typeof value.isLiked === "boolean" &&
    (value.parentId === undefined || isString(value.parentId)) &&
    (value.parentAuthorName === undefined || isString(value.parentAuthorName))
  )
}

function isRamenLog(value: unknown): value is RamenLog {
  if (!isRecord(value) || !isRecord(value.author) || !isRecord(value.shop))
    return false
  return (
    isString(value.id) &&
    (value.author.id === undefined || isString(value.author.id)) &&
    isString(value.author.name) &&
    isString(value.author.level) &&
    (value.author.avatar === undefined || isString(value.author.avatar)) &&
    isString(value.shop.id) &&
    isString(value.shop.name) &&
    (value.shop.branch === undefined || isString(value.shop.branch)) &&
    (value.shop.location === undefined || isString(value.shop.location)) &&
    isString(value.menuName) &&
    isString(value.ramenType) &&
    isString(value.visitedAt) &&
    (value.imageUrl === null || isString(value.imageUrl)) &&
    (value.photos === undefined || isStringArray(value.photos)) &&
    isString(value.note) &&
    isTasteNotes(value.tasteNotes) &&
    ["자주 감", "가끔 생각남", "한번이면 충분"].includes(
      String(value.revisit),
    ) &&
    isFiniteNumber(value.likes) &&
    typeof value.isLiked === "boolean" &&
    typeof value.isPublic === "boolean" &&
    isString(value.createdAt) &&
    (value.commentCount === undefined || isFiniteNumber(value.commentCount)) &&
    (value.comments === undefined ||
      (Array.isArray(value.comments) && value.comments.every(isRamenLogComment)))
  )
}

/** 5축 점수가 망가졌으면 기록은 살리고 점수만 뺀다. 5축 도입 전 기록에는 점수가 없다. */
function withValidScores(log: RamenLog): RamenLog {
  if (log.scores === undefined || isTasteScores(log.scores)) return log
  const { scores: _dropped, ...rest } = log
  return rest
}

function isCommunityComment(value: unknown): value is CommunityComment {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.postId) &&
    isCommunityAuthor(value.author) &&
    isString(value.content) &&
    isString(value.createdAt) &&
    isFiniteNumber(value.likes) &&
    typeof value.isLiked === "boolean" &&
    (value.parentId === undefined || isString(value.parentId)) &&
    (value.parentAuthorName === undefined || isString(value.parentAuthorName))
  )
}

function isCommunityPost(value: unknown): value is CommunityPost {
  if (!isRecord(value)) return false
  return (
    isString(value.id) &&
    ["REVIEW", "TIP", "QUESTION", "FREE", "POPULAR"].includes(
      String(value.category),
    ) &&
    isString(value.categoryLabel) &&
    isString(value.title) &&
    isString(value.content) &&
    (value.detailedContent === undefined ||
      isStringArray(value.detailedContent)) &&
    isCommunityAuthor(value.author) &&
    isString(value.createdAt) &&
    isFiniteNumber(value.likes) &&
    isFiniteNumber(value.commentCount) &&
    isFiniteNumber(value.viewCount) &&
    typeof value.isLiked === "boolean" &&
    (value.shopId === undefined || isString(value.shopId)) &&
    (value.shopName === undefined || isString(value.shopName)) &&
    isStringArray(value.imageUrls) &&
    Array.isArray(value.comments) &&
    value.comments.every(isCommunityComment)
  )
}

function isNotification(value: unknown): value is AppNotification {
  if (!isRecord(value)) return false
  return (
    isString(value.id) &&
    ["like", "comment", "level", "shop", "notice"].includes(
      String(value.type),
    ) &&
    isString(value.title) &&
    isString(value.content) &&
    isString(value.time) &&
    typeof value.isRead === "boolean" &&
    (value.targetScreen === undefined || isString(value.targetScreen)) &&
    (value.targetShopId === undefined || isString(value.targetShopId)) &&
    (value.targetLogId === undefined || isString(value.targetLogId)) &&
    (value.targetPostId === undefined || isString(value.targetPostId)) &&
    (value.targetReportId === undefined || isString(value.targetReportId))
  )
}

function isTasteMetric(value: unknown): value is TasteMetric {
  return (
    isRecord(value) &&
    isString(value.key) &&
    isString(value.label) &&
    isFiniteNumber(value.score) &&
    isFiniteNumber(value.average)
  )
}

function isTasteTopShop(value: unknown): value is TasteTopShop {
  return (
    isRecord(value) &&
    isFiniteNumber(value.rank) &&
    isString(value.shopId) &&
    isString(value.style) &&
    (value.matchPercent === undefined || isFiniteNumber(value.matchPercent)) &&
    isString(value.mustTry) &&
    isString(value.reason) &&
    (value.visitCount === undefined || isFiniteNumber(value.visitCount))
  )
}

function isTasteStyleShare(value: unknown): value is TasteStyleShare {
  return (
    isRecord(value) &&
    isString(value.ramenType) &&
    isFiniteNumber(value.percentage) &&
    isFiniteNumber(value.count) &&
    isString(value.note)
  )
}

function isTasteReport(value: unknown): value is TasteReport {
  if (!isRecord(value)) return false
  return (
    isString(value.id) &&
    isString(value.volume) &&
    isString(value.period) &&
    isString(value.publishedAt) &&
    isString(value.title) &&
    isString(value.levelLabel) &&
    isFiniteNumber(value.levelNumber) &&
    isString(value.quote) &&
    isFiniteNumber(value.recordCount) &&
    isStringArray(value.tags) &&
    isString(value.strongestFeature) &&
    Array.isArray(value.metrics) &&
    value.metrics.every(isTasteMetric) &&
    isStringArray(value.insights) &&
    Array.isArray(value.topShops) &&
    value.topShops.every(isTasteTopShop) &&
    Array.isArray(value.styleShares) &&
    value.styleShares.every(isTasteStyleShare)
  )
}

function isUserProfile(value: unknown): value is UserProfile {
  if (!isRecord(value)) return false
  return (
    isString(value.id) &&
    isString(value.name) &&
    isString(value.nickname) &&
    (value.email === undefined || isString(value.email)) &&
    (value.avatar === null || isString(value.avatar)) &&
    isString(value.level) &&
    isFiniteNumber(value.levelNumber) &&
    isString(value.membershipNo) &&
    (value.bio === undefined || isString(value.bio)) &&
    (value.favoriteRamenType === undefined ||
      isString(value.favoriteRamenType)) &&
    isFiniteNumber(value.visitedCount) &&
    isFiniteNumber(value.revisitCount) &&
    typeof value.isLoggedIn === "boolean"
  )
}

function settingsFrom(
  raw: unknown,
  fallback: NotificationSettings,
): NotificationSettings {
  const settings = isRecord(raw) ? raw : {}
  return {
    pushEnabled:
      typeof settings.pushEnabled === "boolean"
        ? settings.pushEnabled
        : fallback.pushEnabled,
    likesEnabled:
      typeof settings.likesEnabled === "boolean"
        ? settings.likesEnabled
        : fallback.likesEnabled,
    commentsEnabled:
      typeof settings.commentsEnabled === "boolean"
        ? settings.commentsEnabled
        : fallback.commentsEnabled,
    levelUpEnabled:
      typeof settings.levelUpEnabled === "boolean"
        ? settings.levelUpEnabled
        : fallback.levelUpEnabled,
    shopNewsEnabled:
      typeof settings.shopNewsEnabled === "boolean"
        ? settings.shopNewsEnabled
        : fallback.shopNewsEnabled,
  }
}

function migratedShopSubscriptions(raw: Record<string, unknown>): string[] {
  if (Array.isArray(raw.subscribedShopIds))
    return cleanEntityIds(raw.subscribedShopIds)

  // 예전 로컬 V1이 뉴스 id로 저장한 구독은 매장 id로 돌려놓는다.
  return cleanEntityIds(raw.subscribedNewsIds)
    .map((newsId) => NEWS_ITEMS.find((item) => item.id === newsId)?.shopId)
    .filter((shopId): shopId is string => shopId !== undefined)
}

/**
 * Produces a complete, runtime-safe V1 value. Invalid collection members are
 * discarded individually so one interrupted write cannot crash every screen.
 */
export function migratePersistedState(raw: unknown): PersistedAppStateV1 {
  const fallback = createInitialPersistedState()
  if (!isRecord(raw) || raw.version !== 1) return fallback

  const logs = Array.isArray(raw.logs)
    ? raw.logs.map(migratedLog).filter(isRamenLog).map(withValidScores)
    : []
  const communityPosts = Array.isArray(raw.communityPosts)
    ? raw.communityPosts.map(migratedPost).filter(isCommunityPost)
    : []
  const notifications = Array.isArray(raw.notifications)
    ? raw.notifications
        .map((value) => isRecord(value)
          ? withEntityIds(value, "id", "targetShopId", "targetLogId", "targetPostId")
          : value)
        .filter(isNotification)
    : []
  const tasteReports = Array.isArray(raw.tasteReports)
    ? raw.tasteReports.map(migratedTasteReport).filter(isTasteReport)
    : []
  const requestedReportId = isString(raw.currentTasteReportId)
    ? raw.currentTasteReportId
    : null
  const user = isRecord(raw.user) ? withEntityIds(raw.user, "id") : raw.user

  return {
    version: 1,
    user: user === null ? null : isUserProfile(user) ? user : null,
    onboardingCompleted:
      typeof raw.onboardingCompleted === "boolean"
        ? raw.onboardingCompleted
        : fallback.onboardingCompleted,
    logs,
    bookmarkedShopIds: cleanEntityIds(raw.bookmarkedShopIds),
    subscribedShopIds: migratedShopSubscriptions(raw),
    communityPosts,
    notifications,
    notificationSettings: settingsFrom(
      raw.notificationSettings,
      fallback.notificationSettings,
    ),
    tasteReports,
    currentTasteReportId:
      requestedReportId &&
      tasteReports.some((report) => report.id === requestedReportId)
        ? requestedReportId
        : (tasteReports[0]?.id ?? null),
    // 라운지 숨김·신고는 나중에 추가한 필드다. 없는 옛 저장본은 빈 목록으로 시작한다
    hiddenAuthorIds: Array.isArray(raw.hiddenAuthorIds)
      ? [...new Set(raw.hiddenAuthorIds.filter(isString).filter((id) => Boolean(id.trim())))]
      : [],
    contentReports: Array.isArray(raw.contentReports)
      ? raw.contentReports
          .map((value) => isRecord(value) ? withEntityIds(value, "id", "targetId") : value)
          .filter(isContentReport)
      : [],
  }
}
