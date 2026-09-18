import type {
  AppNotification,
  CommunityAuthor,
  CommunityComment,
  CommunityPost,
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

function cleanNumberIds(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value.filter(
        (item): item is number =>
          isFiniteNumber(item) && Number.isInteger(item) && item > 0,
      ),
    ),
  ]
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
    isFiniteNumber(value.id) &&
    isFiniteNumber(value.logId) &&
    isCommunityAuthor(value.author) &&
    isString(value.content) &&
    isString(value.createdAt) &&
    isFiniteNumber(value.likes) &&
    typeof value.isLiked === "boolean" &&
    (value.parentId === undefined || isFiniteNumber(value.parentId)) &&
    (value.parentAuthorName === undefined || isString(value.parentAuthorName))
  )
}

function isRamenLog(value: unknown): value is RamenLog {
  if (!isRecord(value) || !isRecord(value.author) || !isRecord(value.shop))
    return false
  return (
    isFiniteNumber(value.id) &&
    (value.author.id === undefined || isString(value.author.id)) &&
    isString(value.author.name) &&
    isString(value.author.level) &&
    (value.author.avatar === undefined || isString(value.author.avatar)) &&
    isFiniteNumber(value.shop.id) &&
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
    isFiniteNumber(value.id) &&
    isFiniteNumber(value.postId) &&
    isCommunityAuthor(value.author) &&
    isString(value.content) &&
    isString(value.createdAt) &&
    isFiniteNumber(value.likes) &&
    typeof value.isLiked === "boolean" &&
    (value.parentId === undefined || isFiniteNumber(value.parentId)) &&
    (value.parentAuthorName === undefined || isString(value.parentAuthorName))
  )
}

function isCommunityPost(value: unknown): value is CommunityPost {
  if (!isRecord(value)) return false
  return (
    isFiniteNumber(value.id) &&
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
    (value.shopId === undefined || isFiniteNumber(value.shopId)) &&
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
    (value.targetShopId === undefined || isFiniteNumber(value.targetShopId)) &&
    (value.targetLogId === undefined || isFiniteNumber(value.targetLogId)) &&
    (value.targetPostId === undefined || isFiniteNumber(value.targetPostId)) &&
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
    isFiniteNumber(value.shopId) &&
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

function migratedShopSubscriptions(raw: Record<string, unknown>): number[] {
  if (Array.isArray(raw.subscribedShopIds))
    return cleanNumberIds(raw.subscribedShopIds)

  // Compatibility with early local V1 builds that accidentally persisted news IDs.
  return cleanNumberIds(raw.subscribedNewsIds)
    .map((newsId) => NEWS_ITEMS.find((item) => item.id === newsId)?.shopId)
    .filter((shopId): shopId is number => shopId !== undefined)
}

/**
 * Produces a complete, runtime-safe V1 value. Invalid collection members are
 * discarded individually so one interrupted write cannot crash every screen.
 */
export function migratePersistedState(raw: unknown): PersistedAppStateV1 {
  const fallback = createInitialPersistedState()
  if (!isRecord(raw) || raw.version !== 1) return fallback

  const logs = Array.isArray(raw.logs)
    ? raw.logs.filter(isRamenLog).map(withValidScores)
    : []
  const communityPosts = Array.isArray(raw.communityPosts)
    ? raw.communityPosts.filter(isCommunityPost)
    : []
  const notifications = Array.isArray(raw.notifications)
    ? raw.notifications.filter(isNotification)
    : []
  const tasteReports = Array.isArray(raw.tasteReports)
    ? raw.tasteReports.filter(isTasteReport)
    : []
  const requestedReportId = isString(raw.currentTasteReportId)
    ? raw.currentTasteReportId
    : null

  return {
    version: 1,
    user: raw.user === null ? null : isUserProfile(raw.user) ? raw.user : null,
    onboardingCompleted:
      typeof raw.onboardingCompleted === "boolean"
        ? raw.onboardingCompleted
        : fallback.onboardingCompleted,
    logs,
    bookmarkedShopIds: cleanNumberIds(raw.bookmarkedShopIds),
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
  }
}
