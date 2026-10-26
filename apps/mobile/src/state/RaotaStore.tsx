import type {
  CommunityComment,
  CommunityPost,
  ContentReport,
  ContentReportReason,
  CreateCommunityCommentInput,
  CreateCommunityPostInput,
  CreateRamenLogCommentInput,
  CreateRamenLogInput,
  LoginInput,
  NewsItem,
  NotificationSettings,
  PersistedAppStateV1,
  ProfileUpdateInput,
  RamenLog,
  RamenLogComment,
  Shop,
  TasteMetric,
  TasteReport,
  UserProfile,
} from "@raota/shared"
import { DEMO_SAVED_SHOP_NAMES, DEMO_USER, REVISIT_SCORE, findShopByName } from "@raota/shared"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type PropsWithChildren,
} from "react"

import {
  createInitialPersistedState,
  INITIAL_COMMUNITY_POSTS,
  NEWS_ITEMS,
  SHOPS,
} from "../data/fixtures"
import {
  localRaotaRepository,
  migratePersistedState,
  type RaotaRepository,
} from "../repository"
import { track } from "../analytics"
import { isRemote, isRemoteWithAccount } from "../api/config"
import { createIdempotencyKey, isApiError, type AppMember, type OauthLoginRequest, type RemoteShop } from "../api"
import { signOutSocialProviders } from "../auth/social"
import {
  AlreadyHandledError,
  currentConsentDecisions,
  OnboardingProfileUpdateError,
  remoteReads,
  remoteWrites,
  subscribeSessionEndedToLogout,
  writeErrorMessage,
  type RemoteLedger,
} from "../data/remote"
import { remoteCache } from "../data/remoteCache"
import { validateRecordDraft } from "../domain/record"
import { isValidLogComment, type HiddenAuthor } from "../domain/lounge"
import { compareShopIds } from "../domain/shops"
import {
  clearPersistedMediaDirectory,
  deletePersistedMediaMany,
  persistMediaFile,
  persistMediaFiles,
} from "../storage/media"

type HydrationStatus = "loading" | "ready" | "error"

export interface PendingRecordDraft {
  shopId: string | null
  /**
   * 초안 키 = 서버 저장의 Idempotency-Key(#60). 화면을 열 때 하나 만들고, 저장을 몇 번 다시 눌러도
   * (내용을 고쳐도) 같은 키를 쓴다. 이미 지운 기록의 키였다면(409) 새 키로 바꾼다.
   */
  key: string
}

/**
 * 서버 회원의 내 데이터(auth remote). 기기에 저장하지 않고, 로그아웃·계정 전환 때 비운다.
 * 목록은 처음 읽은 값이고, 이번 로그인에서 쓴 결과(고친 기록·공감·댓글·찜·숨김·신고)는 그 위에 덧씌운다.
 */
export interface RemoteAccountState {
  /** 이 데이터의 주인. 로그아웃하면 null */
  memberId: string | null
  status: "idle" | "loading" | "ready" | "error"
  error: string | null
  /** 내 기록 요약(ramenLogs). 캘린더·취향·리포트 계산 */
  ledger: RemoteLedger | null
  /** 내 기록 목록(사진·메모 포함, 방문일 최신순). 다음 쪽은 logsCursor */
  logs: RamenLog[] | null
  logsCursor: string | null
  /** 고친·새로 쓴 기록(서버 응답). 라운지·상세 응답보다 앞선다 */
  savedLogs: Record<string, RamenLog>
  deletedLogIds: string[]
  /** 찜한 매장(shops) */
  bookmarks: Shop[] | null
  /** 막 누른 찜. 매장 응답의 isBookmarked와 찜 목록보다 앞선다 */
  bookmarkOverrides: Record<string, boolean>
  /** 숨긴(차단한) 사람(lounge) */
  hiddenAuthors: HiddenAuthor[] | null
  /** 이번 로그인에서 신고한 대상. 서버는 다음 응답부터 빼고 준다 */
  reports: ContentReport[]
  /** 공감(누른 직후에는 예상 값, 응답이 오면 서버 값) */
  likes: Record<string, { isLiked: boolean; likes: number }>
  /** 이번 로그인에서 단 댓글(다시 읽은 목록에 아직 없으면 끝에 붙인다)·지운 댓글 */
  addedComments: Record<string, RamenLogComment[]>
  deletedCommentIds: string[]
}

export function createRemoteAccountState(memberId: string | null = null): RemoteAccountState {
  return {
    memberId,
    status: "idle",
    error: null,
    ledger: null,
    logs: null,
    logsCursor: null,
    savedLogs: {},
    deletedLogIds: [],
    bookmarks: null,
    bookmarkOverrides: {},
    hiddenAuthors: null,
    reports: [],
    likes: {},
    addedComments: {},
    deletedCommentIds: [],
  }
}

export interface RaotaState extends PersistedAppStateV1 {
  hydrationStatus: HydrationStatus
  storageError: string | null
  recordDraft: PendingRecordDraft | null
  /**
   * 서버 회원이 현재 약관·처리방침에 다시 동의해야 하는가(auth remote).
   * 저장하지 않는다. 앱을 켤 때마다 서버 회원 정보로 다시 정한다.
   */
  consentRequired: boolean
  account: RemoteAccountState
}

export type RaotaAction =
  | { type: "HYDRATE"; payload: PersistedAppStateV1 }
  | { type: "STORAGE_ERROR"; payload: string | null }
  | { type: "START_RECORD_DRAFT"; payload: PendingRecordDraft }
  | { type: "SELECT_RECORD_DRAFT_SHOP"; payload: string }
  | { type: "RENEW_RECORD_DRAFT_KEY"; payload: string }
  | { type: "CLEAR_RECORD_DRAFT" }
  | {
      type: "LOGIN"
      payload: UserProfile
      /** 이 기기에서 처음 쓰는 계정이면 온보딩을 다시 거친다 */
      onboardingCompleted?: boolean
      /** 계정이 바뀌면 찜 목록도 그 계정 것으로 바꾼다 */
      bookmarkedShopIds?: string[]
    }
  | { type: "COMPLETE_ONBOARDING"; payload: UserProfile }
  /** 서버 회원으로 로그인했거나 회원 정보를 다시 읽었다(auth remote) */
  | { type: "MEMBER_SIGNED_IN"; payload: AppMember }
  | { type: "CONSENTS_AGREED" }
  | { type: "LOGOUT" }
  | { type: "WITHDRAW"; payload: PersistedAppStateV1 }
  | { type: "UPDATE_PROFILE"; payload: ProfileUpdateInput }
  | { type: "TOGGLE_BOOKMARK"; payload: string }
  | { type: "CREATE_LOG"; payload: RamenLog }
  | { type: "UPDATE_LOG"; payload: RamenLog }
  | { type: "DELETE_LOG"; payload: string }
  | { type: "TOGGLE_LOG_LIKE"; payload: string }
  | { type: "DELETE_LOG_COMMENT"; payload: { logId: string; commentId: string } }
  | {
      type: "ADD_LOG_COMMENT"
      payload: { logId: string; comment: RamenLogComment }
    }
  | { type: "TOGGLE_SHOP_SUBSCRIPTION"; payload: string }
  | { type: "CREATE_POST"; payload: CommunityPost }
  | {
      type: "ADD_COMMENT"
      payload: { postId: string; comment: CommunityComment }
    }
  | { type: "TOGGLE_POST_LIKE"; payload: string }
  | { type: "MARK_NOTIFICATION_READ"; payload: string }
  | { type: "MARK_ALL_NOTIFICATIONS_READ" }
  | { type: "DELETE_NOTIFICATION"; payload: string }
  | {
      type: "UPDATE_NOTIFICATION_SETTINGS"
      payload: Partial<NotificationSettings>
    }
  | { type: "REFRESH_TASTE_REPORT"; payload: TasteReport }
  | { type: "HIDE_AUTHOR"; payload: string }
  | { type: "UNHIDE_AUTHOR"; payload: string }
  | { type: "REPORT_CONTENT"; payload: ContentReport }
  /**
   * 서버 회원 데이터 바꾸기. memberId가 지금 계정과 다르면(응답이 오기 전에 로그아웃·계정 전환) 버린다.
   * update는 순수 함수여야 한다.
   */
  | { type: "ACCOUNT_UPDATE"; memberId: string; update: (state: RaotaState) => RaotaState }

/** 데모 계정의 찜 목록(웹과 같은 DEMO_SAVED_SHOP_NAMES) */
function demoBookmarkIds(): string[] {
  return DEMO_SAVED_SHOP_NAMES.map((name) => findShopByName(name)?.id).filter(
    (id): id is string => typeof id === "string",
  )
}

export function createInitialRaotaState(): RaotaState {
  return {
    ...createInitialPersistedState(),
    hydrationStatus: "loading",
    storageError: null,
    recordDraft: null,
    consentRequired: false,
    account: createRemoteAccountState(),
  }
}

export function selectPersistedState(state: RaotaState): PersistedAppStateV1 {
  return {
    version: 1,
    user: state.user,
    onboardingCompleted: state.onboardingCompleted,
    logs: state.logs,
    bookmarkedShopIds: state.bookmarkedShopIds,
    subscribedShopIds: state.subscribedShopIds,
    communityPosts: state.communityPosts,
    notifications: state.notifications,
    notificationSettings: state.notificationSettings,
    tasteReports: state.tasteReports,
    currentTasteReportId: state.currentTasteReportId,
    hiddenAuthorIds: state.hiddenAuthorIds,
    contentReports: state.contentReports,
  }
}

export function selectCurrentUser(state: RaotaState): UserProfile | null {
  return state.user?.isLoggedIn ? state.user : null
}

export function selectCurrentTasteReport(
  state: RaotaState,
): TasteReport | null {
  return (
    state.tasteReports.find(
      (report) => report.id === state.currentTasteReportId,
    ) ?? null
  )
}

export function selectUnreadNotificationCount(state: RaotaState): number {
  return state.notifications.reduce(
    (count, notification) => count + Number(!notification.isRead),
    0,
  )
}

function toggleId(items: string[], id: string): string[] {
  return items.includes(id)
    ? items.filter((item) => item !== id)
    : [...items, id]
}

export function raotaReducer(
  state: RaotaState,
  action: RaotaAction,
): RaotaState {
  switch (action.type) {
    case "HYDRATE":
      return {
        ...action.payload,
        hydrationStatus: "ready",
        storageError: null,
        recordDraft: null,
        consentRequired: false,
        account: state.account,
      }
    case "STORAGE_ERROR":
      return {
        ...state,
        hydrationStatus:
          state.hydrationStatus === "loading" ? "error" : state.hydrationStatus,
        storageError: action.payload,
      }
    case "START_RECORD_DRAFT":
      return {
        ...state,
        recordDraft: action.payload,
      }
    case "SELECT_RECORD_DRAFT_SHOP":
      return state.recordDraft
        ? {
            ...state,
            recordDraft: { ...state.recordDraft, shopId: action.payload },
          }
        : state
    case "RENEW_RECORD_DRAFT_KEY":
      return state.recordDraft ? { ...state, recordDraft: { ...state.recordDraft, key: action.payload } } : state
    case "CLEAR_RECORD_DRAFT":
      return { ...state, recordDraft: null }
    case "LOGIN":
      return {
        ...state,
        user: action.payload,
        onboardingCompleted: action.onboardingCompleted ?? state.onboardingCompleted,
        bookmarkedShopIds: action.bookmarkedShopIds ?? state.bookmarkedShopIds,
      }
    case "COMPLETE_ONBOARDING":
      return { ...state, user: action.payload, onboardingCompleted: true }
    case "MEMBER_SIGNED_IN": {
      const sameMember = state.user?.id === action.payload.profile.id
      const ledger = sameMember ? state.account.ledger : null
      return {
        ...state,
        user: ledger ? { ...action.payload.profile, revisitCount: ledger.revisitCount } : action.payload.profile,
        onboardingCompleted: action.payload.onboardingCompleted,
        consentRequired: action.payload.consentRequired,
        // 다른 계정이면 이 기기에 남은 앞 계정의 찜 목록·서버 데이터를 넘겨받지 않는다
        bookmarkedShopIds: sameMember ? state.bookmarkedShopIds : [],
        account:
          state.account.memberId === action.payload.profile.id
            ? state.account
            : createRemoteAccountState(action.payload.profile.id),
      }
    }
    case "CONSENTS_AGREED":
      return { ...state, consentRequired: false }
    case "LOGOUT":
      return {
        ...state,
        user: state.user ? { ...state.user, isLoggedIn: false } : null,
        consentRequired: false,
        recordDraft: null,
        account: createRemoteAccountState(),
      }
    case "WITHDRAW":
      return {
        ...action.payload,
        hydrationStatus: "ready",
        storageError: null,
        recordDraft: null,
        consentRequired: false,
        account: createRemoteAccountState(),
      }
    case "UPDATE_PROFILE":
      if (!state.user) return state
      return {
        ...state,
        user: { ...state.user, ...action.payload },
        logs: state.logs.map((log) =>
          log.author.id === state.user?.id
            ? {
                ...log,
                author: {
                  ...log.author,
                  name: action.payload.nickname ?? log.author.name,
                  avatar:
                    action.payload.avatar === undefined
                      ? log.author.avatar
                      : (action.payload.avatar ?? undefined),
                },
              }
            : log,
        ),
        communityPosts: state.communityPosts.map((post) => ({
          ...post,
          author:
            post.author.id === state.user?.id
              ? {
                  ...post.author,
                  name: action.payload.nickname ?? post.author.name,
                  avatar:
                    action.payload.avatar === undefined
                      ? post.author.avatar
                      : action.payload.avatar,
                }
              : post.author,
          comments: post.comments.map((comment) =>
            comment.author.id === state.user?.id
              ? {
                  ...comment,
                  author: {
                    ...comment.author,
                    name: action.payload.nickname ?? comment.author.name,
                    avatar:
                      action.payload.avatar === undefined
                        ? comment.author.avatar
                        : action.payload.avatar,
                  },
                }
              : comment,
          ),
        })),
      }
    case "TOGGLE_BOOKMARK":
      return {
        ...state,
        bookmarkedShopIds: toggleId(
          state.bookmarkedShopIds,
          action.payload,
        ),
      }
    case "CREATE_LOG": {
      const isOwned = action.payload.author.id === state.user?.id
      const isRevisit = isOwned && action.payload.revisit !== "한번이면 충분"
      return {
        ...state,
        logs: [action.payload, ...state.logs],
        user:
          state.user && isOwned
            ? {
                ...state.user,
                visitedCount: state.user.visitedCount + 1,
                revisitCount: state.user.revisitCount + Number(isRevisit),
              }
            : state.user,
      }
    }
    case "UPDATE_LOG": {
      const previous = state.logs.find((log) => log.id === action.payload.id)
      if (!previous) return state
      const isOwned = previous.author.id === state.user?.id
      const revisitChange =
        Number(action.payload.revisit !== "한번이면 충분") - Number(previous.revisit !== "한번이면 충분")
      return {
        ...state,
        logs: state.logs.map((log) => (log.id === action.payload.id ? action.payload : log)),
        user:
          state.user && isOwned && revisitChange !== 0
            ? { ...state.user, revisitCount: Math.max(0, state.user.revisitCount + revisitChange) }
            : state.user,
      }
    }
    case "DELETE_LOG": {
      const deleted = state.logs.find((log) => log.id === action.payload)
      if (!deleted) return state
      const isOwned = deleted.author.id === state.user?.id
      return {
        ...state,
        logs: state.logs.filter((log) => log.id !== action.payload),
        user:
          state.user && isOwned
            ? {
                ...state.user,
                visitedCount: Math.max(0, state.user.visitedCount - 1),
                revisitCount: Math.max(
                  0,
                  state.user.revisitCount -
                    Number(deleted.revisit !== "한번이면 충분"),
                ),
              }
            : state.user,
      }
    }
    case "TOGGLE_LOG_LIKE":
      return {
        ...state,
        logs: state.logs.map((log) =>
          log.id === action.payload
            ? {
                ...log,
                likes: Math.max(0, log.likes + (log.isLiked ? -1 : 1)),
                isLiked: !log.isLiked,
              }
          : log,
        ),
      }
    case "ADD_LOG_COMMENT":
      return {
        ...state,
        logs: state.logs.map((log) =>
          log.id === action.payload.logId
            ? {
                ...log,
                comments: [...(log.comments ?? []), action.payload.comment],
                commentCount: (log.commentCount ?? log.comments?.length ?? 0) + 1,
              }
            : log,
        ),
      }
    case "DELETE_LOG_COMMENT":
      return {
        ...state,
        logs: state.logs.map((log) =>
          log.id === action.payload.logId && log.comments?.some((comment) => comment.id === action.payload.commentId)
            ? {
                ...log,
                comments: log.comments.filter((comment) => comment.id !== action.payload.commentId),
                commentCount: Math.max(0, (log.commentCount ?? log.comments.length) - 1),
              }
            : log,
        ),
      }
    case "TOGGLE_SHOP_SUBSCRIPTION":
      return {
        ...state,
        subscribedShopIds: toggleId(
          state.subscribedShopIds,
          action.payload,
        ),
      }
    case "CREATE_POST":
      return {
        ...state,
        communityPosts: [action.payload, ...state.communityPosts],
      }
    case "ADD_COMMENT":
      return {
        ...state,
        communityPosts: state.communityPosts.map((post) =>
          post.id === action.payload.postId
            ? {
                ...post,
                comments: [...post.comments, action.payload.comment],
                commentCount: post.commentCount + 1,
              }
            : post,
        ),
      }
    case "TOGGLE_POST_LIKE":
      return {
        ...state,
        communityPosts: state.communityPosts.map((post) =>
          post.id === action.payload
            ? {
                ...post,
                likes: Math.max(0, post.likes + (post.isLiked ? -1 : 1)),
                isLiked: !post.isLiked,
              }
            : post,
        ),
      }
    case "MARK_NOTIFICATION_READ":
      return {
        ...state,
        notifications: state.notifications.map((notification) =>
          notification.id === action.payload
            ? { ...notification, isRead: true }
            : notification,
        ),
      }
    case "MARK_ALL_NOTIFICATIONS_READ":
      return {
        ...state,
        notifications: state.notifications.map((notification) => ({
          ...notification,
          isRead: true,
        })),
      }
    case "DELETE_NOTIFICATION":
      return {
        ...state,
        notifications: state.notifications.filter(
          (notification) => notification.id !== action.payload,
        ),
      }
    case "UPDATE_NOTIFICATION_SETTINGS":
      return {
        ...state,
        notificationSettings: {
          ...state.notificationSettings,
          ...action.payload,
        },
      }
    case "REFRESH_TASTE_REPORT":
      return {
        ...state,
        tasteReports: [
          action.payload,
          ...state.tasteReports.filter(
            (report) => report.id !== action.payload.id,
          ),
        ],
        currentTasteReportId: action.payload.id,
      }
    case "HIDE_AUTHOR":
      // 자기 자신은 숨길 수 없다
      if (!action.payload || action.payload === state.user?.id || state.hiddenAuthorIds.includes(action.payload)) return state
      return { ...state, hiddenAuthorIds: [...state.hiddenAuthorIds, action.payload] }
    case "UNHIDE_AUTHOR":
      return state.hiddenAuthorIds.includes(action.payload)
        ? { ...state, hiddenAuthorIds: state.hiddenAuthorIds.filter((id) => id !== action.payload) }
        : state
    case "REPORT_CONTENT":
      return { ...state, contentReports: [...state.contentReports, action.payload] }
    case "ACCOUNT_UPDATE":
      return state.account.memberId === action.memberId ? action.update(state) : state
  }
}

function withAccount(state: RaotaState, change: Partial<RemoteAccountState>): RaotaState {
  return { ...state, account: { ...state.account, ...change } }
}

/** 재방문 의사가 있는 그릇 수(서버 요약과 같은 기준: 재방문 점수 3 이상) */
function revisitCountOfLogs(logs: readonly RamenLog[]): number {
  return logs.reduce((count, log) => count + Number((log.scores?.revisit ?? 0) >= 3), 0)
}

function byVisitedDesc(a: { visitedAt: string; id: string }, b: { visitedAt: string; id: string }): number {
  return b.visitedAt.localeCompare(a.visitedAt) || compareShopIds(b.id, a.id)
}

/** 서버가 돌려준 내 기록(새로 쓴 것·고친 것)을 목록·요약·그릇 수에 반영한다 */
function accountWithSavedLog(state: RaotaState, log: RamenLog, created: boolean): RaotaState {
  const { account } = state
  const upsert = (logs: readonly RamenLog[]) =>
    [...logs.filter((item) => item.id !== log.id), log].sort(byVisitedDesc)
  let ledger = account.ledger
  if (ledger) {
    const ledgerLogs = upsert(ledger.logs)
    const bowl = {
      date: log.visitedAt,
      shop: log.shop.name,
      type: log.ramenType,
      menu: log.menuName,
      logId: log.id,
      shopId: log.shop.id,
      ...(log.scores ? { scores: log.scores } : {}),
    }
    const bowls = [...ledger.bowls.filter((item) => item.logId !== log.id), bowl].sort((a, b) =>
      b.date.localeCompare(a.date),
    )
    ledger = { bowls, logs: ledgerLogs, revisitCount: revisitCountOfLogs(ledgerLogs) }
  }
  const user = state.user
    ? {
        ...state.user,
        visitedCount: state.user.visitedCount + Number(created),
        revisitCount: ledger ? ledger.revisitCount : state.user.revisitCount,
      }
    : state.user
  return {
    ...withAccount(state, {
      ledger,
      logs: account.logs ? upsert(account.logs) : account.logs,
      savedLogs: { ...account.savedLogs, [log.id]: log },
      deletedLogIds: account.deletedLogIds.filter((id) => id !== log.id),
    }),
    user,
  }
}

/** 지운(또는 이미 지워져 있던) 내 기록을 목록·요약·그릇 수에서 뺀다 */
function accountWithoutLog(state: RaotaState, logId: string): RaotaState {
  const { account } = state
  const known = Boolean(account.ledger?.logs.some((log) => log.id === logId) || account.logs?.some((log) => log.id === logId))
  const ledgerLogs = account.ledger?.logs.filter((log) => log.id !== logId)
  const ledger =
    account.ledger && ledgerLogs
      ? {
          bowls: account.ledger.bowls.filter((bowl) => bowl.logId !== logId),
          logs: ledgerLogs,
          revisitCount: revisitCountOfLogs(ledgerLogs),
        }
      : account.ledger
  const { [logId]: _removed, ...savedLogs } = account.savedLogs
  return {
    ...withAccount(state, {
      ledger,
      logs: account.logs?.filter((log) => log.id !== logId) ?? null,
      savedLogs,
      deletedLogIds: account.deletedLogIds.includes(logId) ? account.deletedLogIds : [...account.deletedLogIds, logId],
    }),
    user:
      state.user && known
        ? {
            ...state.user,
            visitedCount: Math.max(0, state.user.visitedCount - 1),
            revisitCount: ledger ? ledger.revisitCount : state.user.revisitCount,
          }
        : state.user,
  }
}

const CATEGORY_LABELS: Record<CreateCommunityPostInput["category"], string> = {
  REVIEW: "맛집후기",
  TIP: "꿀팁",
  QUESTION: "Q&A",
  FREE: "자유",
}

function nextNumericId(items: Array<{ id: string }>, lastAllocatedId: string): string {
  let maxId = BigInt(lastAllocatedId)
  // 서버 BIGINT 문자열도 Number로 줄이지 않고 다음 데모 번호를 만든다.
  for (const item of items) {
    if (!/^\d+$/.test(item.id)) continue
    const id = BigInt(item.id)
    if (id > maxId) maxId = id
  }
  return (maxId + BigInt(1)).toString()
}

function formatKoreanDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}. ${month}. ${day}`
}

function scoreFromRatio(count: number, total: number, base: number): number {
  if (total === 0) return base
  return Math.min(5, Math.round((base + (count / total) * 2) * 10) / 10)
}

export function buildTasteReport(
  logs: RamenLog[],
  shops: Shop[] = SHOPS,
  now = new Date(),
  recordCount = logs.length,
  volumeNumber = recordCount,
): TasteReport {
  const noteCount = (field: keyof RamenLog["tasteNotes"], note: string) =>
    logs.reduce(
      (count, log) => count + Number(log.tasteNotes[field]?.includes(note)),
      0,
    )
  const total = Math.max(1, logs.length)
  const styleCounts = logs.reduce<Record<string, number>>((counts, log) => {
    counts[log.ramenType] = (counts[log.ramenType] ?? 0) + 1
    return counts
  }, {})
  const rankedStyles = Object.entries(styleCounts).sort((a, b) => b[1] - a[1])
  const favoriteStyle = rankedStyles[0]?.[0] ?? "쇼유"
  const shopCounts = logs.reduce<Record<string, number>>((counts, log) => {
    counts[log.shop.id] = (counts[log.shop.id] ?? 0) + 1
    return counts
  }, {})
  const topShopEntries = Object.entries(shopCounts)
    .sort((a, b) => b[1] - a[1] || compareShopIds(a[0], b[0]))
    .slice(0, 3)
  const fallbackTopShops = shops
    .slice(0, 3)
    .map((shop) => [shop.id, 0] as const)
  const selectedTopShops =
    topShopEntries.length > 0 ? topShopEntries : fallbackTopShops

  const metrics: TasteMetric[] = [
    {
      key: "brothRichness",
      label: "국물 농도",
      score: scoreFromRatio(noteCount("broth", "진해요"), total, 3.1),
      average: 3.1,
    },
    {
      key: "noodleFirmness",
      label: "면 경도",
      score: scoreFromRatio(noteCount("noodle", "단단해요"), total, 3),
      average: 3,
    },
    {
      key: "saltBalance",
      label: "염도 밸런스",
      score: scoreFromRatio(noteCount("seasoning", "딱 좋아요"), total, 3.2),
      average: 3.2,
    },
    {
      key: "umami",
      label: "타레 감칠맛",
      score: scoreFromRatio(noteCount("broth", "감칠맛 좋아요"), total, 3.4),
      average: 3.4,
    },
    {
      key: "oilRichness",
      label: "오일 리치함",
      score: scoreFromRatio(noteCount("broth", "기름져요"), total, 2.9),
      average: 2.9,
    },
  ]
  const strongest = [...metrics].sort((a, b) => b.score - a.score)[0]
  const month = String(now.getMonth() + 1).padStart(2, "0")

  return {
    id: `taste-${now.getTime()}`,
    volume: `Vol. ${String(Math.max(1, volumeNumber)).padStart(2, "0")}`,
    period: `${now.getFullYear()}년 ${month}월 갱신호`,
    publishedAt: formatKoreanDate(now),
    title: `${favoriteStyle}를 중심으로 취향을 넓히는 라오타`,
    levelLabel: logs.length >= 40 ? "Lv.5 라멘 미식가" : "Lv.3 라멘집 탐험가",
    levelNumber: logs.length >= 40 ? 5 : 3,
    quote: `${favoriteStyle}를 중심으로 국물과 면의 균형을 세심하게 기록하는 취향입니다.`,
    recordCount,
    tags: [`#${favoriteStyle}`, "#취향갱신", `#${recordCount}그릇분석`],
    strongestFeature: strongest
      ? `${strongest.label} ${strongest.score.toFixed(1)}`
      : "아직 분석 중",
    metrics,
    insights: [
      `${favoriteStyle} 기록 비중이 가장 높습니다.`,
      "새 기록을 추가할수록 국물·면·간·토핑 취향의 정확도가 높아집니다.",
    ],
    topShops: selectedTopShops.map(([shopId, count], index) => {
      const shop =
        shops.find((item) => item.id === shopId) ??
        shops[index] ??
        SHOPS[0]
      return {
        rank: index + 1,
        shopId: shop.id,
        style: shop.tags[0] ?? favoriteStyle,
        matchPercent: Math.max(75, shop.matchScore - index * 2),
        mustTry: `${shop.tags[0] ?? favoriteStyle} 추천 메뉴`,
        reason: `${shop.name}에서 남긴 취향 기록과 높은 일치도를 보입니다.`,
        visitCount: count,
      }
    }),
    styleShares: rankedStyles.length
      ? rankedStyles.map(([ramenType, count]) => ({
          ramenType,
          percentage: Math.round((count / total) * 100),
          count,
          note:
            ramenType === favoriteStyle
              ? "현재 가장 자주 기록한 스타일"
              : "취향을 넓히는 스타일",
        }))
      : [
          {
            ramenType: "쇼유",
            percentage: 0,
            count: 0,
            note: "첫 기록을 기다리고 있어요",
          },
        ],
    changeSummary:
      "방금 추가한 기록까지 반영해 취향 리포트를 새로 계산했습니다.",
  }
}

function createWithdrawnState(): PersistedAppStateV1 {
  const initial = createInitialPersistedState()
  return {
    ...initial,
    user: null,
    onboardingCompleted: false,
    bookmarkedShopIds: [],
    subscribedShopIds: [],
    communityPosts: JSON.parse(
      JSON.stringify(INITIAL_COMMUNITY_POSTS),
    ) as CommunityPost[],
    notifications: [],
    tasteReports: [],
    currentTasteReportId: null,
    hiddenAuthorIds: [],
    contentReports: [],
  }
}

export interface ReportContentInput {
  kind: ContentReport["kind"]
  /** 라멘로그 id 또는 댓글 id */
  id: string
  reason: ContentReportReason
}

export interface CompleteOnboardingOptions {
  /** [선택] 라멘 추천 및 소식 수신 동의 */
  marketing?: boolean
}

export interface RaotaActions {
  /** 기기 안 로그인(mock). provider가 없으면 데모 계정 */
  login(input?: LoginInput): UserProfile
  /**
   * 서버 로그인(auth remote). 제공자 자격 증명으로 로그인하고 회원 상태(온보딩·약관 동의 필요 여부)를 돌려준다.
   * 화면은 결과로 온보딩·동의·원래 화면 중 어디로 갈지 정한다.
   */
  signIn(credential: OauthLoginRequest): Promise<AppMember>
  /**
   * 가입 마무리(닉네임·약관·선택 프로필). auth remote면 서버 온보딩을 부른다.
   * 가입은 됐지만 선택 프로필만 못 올렸으면 OnboardingProfileUpdateError를 던진다(이때 계정은 이미 가입 완료 상태다).
   */
  completeOnboarding(input?: ProfileUpdateInput, options?: CompleteOnboardingOptions): Promise<UserProfile>
  /** 현재 약관·처리방침 동의(웹에서 옮긴 회원, 문서 개정 뒤) */
  agreeToConsents(marketing: boolean): Promise<void>
  /** 로그아웃. auth remote면 서버에도 알리지만, 실패해도 기기에서는 로그아웃한다 */
  logout(): void
  /** 탈퇴. auth remote면 서버 탈퇴가 성공해야 기기 데이터를 지운다(실패하면 던진다) */
  withdraw(): Promise<void>
  updateProfile(input: ProfileUpdateInput): Promise<UserProfile | null>
  /** 기록 쓰기 화면을 열 때. 초안 키(Idempotency-Key)를 새로 만든다 */
  startRecordDraft(shopId?: string | null): void
  selectRecordDraftShop(shopId: string): void
  clearRecordDraft(): void
  /**
   * 찜·찜 해제. 서버 회원(shops·auth remote)이면 화면을 먼저 바꾸고 서버에 보낸다.
   * 실패하면 되돌리고 화면에 보여줄 문구로 던진다.
   */
  toggleBookmark(shop: Shop): Promise<void>
  /**
   * 기록 저장. 서버 회원(ramenLogs remote)이면 초안 키로 보내 다시 눌러도 기록이 하나만 생긴다.
   * 실패하면 화면에 보여줄 문구로 던진다. 이미 처리된 초안(지운 기록의 키)이면 AlreadyHandledError
   */
  createLog(input: CreateRamenLogInput): Promise<RamenLog>
  /** 내 기록 고치기(가게는 바꿀 수 없다). 실패하면 화면에 보여줄 문구로 던진다 */
  updateLog(logId: string, input: CreateRamenLogInput): Promise<RamenLog>
  /** 내 기록 지우기. 이미 지워진 기록이면 지운 것으로 본다 */
  deleteLog(logId: string): Promise<void>
  /** 공감·공감 취소. 화면을 먼저 바꾸고, 실패하면 되돌리고 던진다 */
  toggleLogLike(log: RamenLog): Promise<void>
  /** 댓글 쓰기. 로그인하지 않았거나 빈 댓글이면 null, 서버 실패는 화면에 보여줄 문구로 던진다 */
  addLogComment(
    logId: string,
    input: CreateRamenLogCommentInput,
  ): Promise<RamenLogComment | null>
  /** 내 댓글 지우기. 이미 지워진 댓글이면 지운 것으로 본다 */
  deleteLogComment(logId: string, commentId: string): Promise<void>
  /** 서버 회원 데이터(내 기록·찜·숨긴 사람)를 다시 읽는다 */
  refreshAccount(): Promise<void>
  /** 내 기록 다음 쪽 */
  loadMoreMyLogs(): Promise<void>
  toggleShopSubscription(shopId: string): void
  createPost(input: CreateCommunityPostInput): Promise<CommunityPost>
  addComment(
    postId: string,
    input: CreateCommunityCommentInput,
  ): CommunityComment | null
  togglePostLike(postId: string): void
  markNotificationRead(notificationId: string): void
  markAllNotificationsRead(): void
  deleteNotification(notificationId: string): void
  updateNotificationSettings(settings: Partial<NotificationSettings>): void
  refreshTasteReport(): TasteReport
  dismissStorageError(): void
  /**
   * 라운지에서 이 사용자의 라멘로그와 댓글을 숨긴다(앱 심사 가이드라인 1.2 차단 기능).
   * 서버 회원이면 서버 차단 목록에 넣는다(기기를 바꿔도 유지). 로그인하지 않았거나 자기 자신이거나 실패하면 false
   */
  hideAuthor(author: HiddenAuthor): Promise<boolean>
  /** 숨김을 되돌린다(토스트의 "되돌리기", 설정의 숨긴 사용자). 실패하면 화면에 보여줄 문구로 던진다 */
  unhideAuthor(authorId: string): Promise<void>
  /**
   * 라멘로그·댓글 신고. 신고한 사람에게는 그 글을 더 보여주지 않는다. 서버 회원이면 운영 검토로 보낸다.
   * 로그인하지 않았으면 null, 서버 실패는 화면에 보여줄 문구로 던진다
   */
  reportContent(input: ReportContentInput): Promise<ContentReport | null>
}

export interface RaotaContextValue {
  state: RaotaState
  isHydrated: boolean
  storageError: string | null
  shops: Shop[]
  newsItems: NewsItem[]
  currentUser: UserProfile | null
  currentTasteReport: TasteReport | null
  /** 내 기록(취향·리포트 계산용). 서버 회원이면 내 기록 요약이라 사진·메모가 없다 */
  userLogs: RamenLog[]
  unreadNotificationCount: number
  bookmarkedShops: Shop[]
  subscribedNewsItems: NewsItem[]
  /** 이 매장을 찜했는가. 서버 회원이면 막 누른 값 → 매장 응답의 찜 여부 → 찜 목록 순으로 본다 */
  isShopBookmarked(shop: Shop): boolean
  getShop(id: string): Shop | undefined
  /** 기기·스토어에 있는 기록. 서버 회원이면 내 기록 목록과 이번에 쓴 기록에서 찾는다 */
  getLog(id: string): RamenLog | undefined
  getPost(id: string): CommunityPost | undefined
  actions: RaotaActions
}

const RaotaContext = createContext<RaotaContextValue | null>(null)

export interface RaotaProviderProps extends PropsWithChildren {
  repository?: RaotaRepository
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "로컬 데이터를 저장하지 못했습니다."
}

export function RaotaProvider({
  children,
  repository = localRaotaRepository,
}: RaotaProviderProps) {
  const [state, dispatch] = useReducer(
    raotaReducer,
    undefined,
    createInitialRaotaState,
  )
  const allocatedIds = useRef({ log: "0", post: "0", comment: "0" })
  const saveQueue = useRef<Promise<void>>(Promise.resolve())
  /** 기록마다 보내는 중인 댓글 초안의 Idempotency-Key. 성공하거나 이미 처리됐다고 확인되면 새 키로 바꾼다 */
  const commentDraftKeys = useRef(new Map<string, string>())

  useEffect(() => {
    let active = true
    repository
      .load()
      .then((raw) => {
        if (active)
          dispatch({ type: "HYDRATE", payload: migratePersistedState(raw) })
      })
      .catch((error: unknown) => {
        if (!active) return
        dispatch({ type: "HYDRATE", payload: createInitialPersistedState() })
        dispatch({ type: "STORAGE_ERROR", payload: errorMessage(error) })
      })
    return () => {
      active = false
    }
  }, [repository])

  const persistedState = useMemo(
    () => selectPersistedState(state),
    [
      state.bookmarkedShopIds,
      state.communityPosts,
      state.contentReports,
      state.currentTasteReportId,
      state.hiddenAuthorIds,
      state.logs,
      state.notificationSettings,
      state.notifications,
      state.onboardingCompleted,
      state.subscribedShopIds,
      state.tasteReports,
      state.user,
    ],
  )

  useEffect(() => {
    if (state.hydrationStatus !== "ready") return
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(() => repository.save(persistedState))
    saveQueue.current.catch((error: unknown) => {
      dispatch({ type: "STORAGE_ERROR", payload: errorMessage(error) })
    })
  }, [persistedState, repository, state.hydrationStatus])

  /**
   * 로그아웃·세션 종료 뒤 서버 계정 흔적(토큰·보내다 만 요청·제공자 SDK 로그인)을 지운다.
   * 앞 계정 기준으로 받은 서버 응답(내 공감·찜·내 댓글 표시)도 버린다
   */
  const forgetRemoteAccount = useCallback((accountId: string | null) => {
    remoteCache.clear()
    void remoteWrites.forgetAccount(accountId).catch(() => undefined)
    void signOutSocialProviders()
  }, [])

  // 세션 종료 알림은 렌더와 무관하게 오므로 지금 로그인한 계정 id를 ref로 들고 있는다
  const signedInAccountId = useRef<string | null>(null)
  useEffect(() => {
    signedInAccountId.current = state.user?.isLoggedIn ? state.user.id : null
  }, [state.user])

  /*
   * 서버 세션(auth remote).
   * - 다른 기기에서 로그아웃·탈퇴했거나 재발급이 거절되면 클라이언트가 토큰을 지우고 알린다 → 기기에서도 로그아웃
   * - 앱을 켜면 저장된 토큰으로 회원 정보를 다시 읽는다. 토큰이 없으면(예: mock으로 쓰던 기기) 로그아웃 상태로 시작한다.
   *   연결 오류면 저장된 화면 상태를 그대로 두고, 세션이 끝난 경우는 위 알림이 처리한다
   */
  useEffect(() => {
    if (!isRemote("auth")) return
    return subscribeSessionEndedToLogout(() => {
      const accountId = signedInAccountId.current
      dispatch({ type: "LOGOUT" })
      forgetRemoteAccount(accountId)
    })
  }, [forgetRemoteAccount])

  const sessionRestored = useRef(false)
  useEffect(() => {
    if (state.hydrationStatus !== "ready" || sessionRestored.current || !isRemote("auth")) return
    sessionRestored.current = true
    remoteReads
      .restoreSession()
      .then((member) => {
        // 세션을 되살리기 전에 비회원으로 받은 응답(공감·찜 여부 없음)을 버린다
        if (member) remoteCache.clear()
        dispatch(member ? { type: "MEMBER_SIGNED_IN", payload: member } : { type: "LOGOUT" })
      })
      .catch(() => undefined)
  }, [state.hydrationStatus])

  const signIn = useCallback(async (credential: OauthLoginRequest): Promise<AppMember> => {
    const member = await remoteWrites.signIn(credential)
    remoteCache.clear()
    dispatch({ type: "MEMBER_SIGNED_IN", payload: member })
    return member
  }, [])

  /**
   * 서버 회원 데이터 읽기: 내 기록 요약·첫 쪽(ramenLogs), 찜(shops), 숨긴 사람(lounge).
   * 하나가 실패해도 읽은 것은 쓰고, 실패 문구를 남긴다
   */
  const loadAccount = useCallback(async (memberId: string) => {
    dispatch({ type: "ACCOUNT_UPDATE", memberId, update: (current) => withAccount(current, { status: "loading", error: null }) })
    const [ledger, logs, bookmarks, hiddenAuthors] = await Promise.allSettled([
      isRemote("ramenLogs") ? remoteReads.myLedger() : null,
      isRemote("ramenLogs") ? remoteReads.myLogs(null) : null,
      isRemoteWithAccount("shops") ? remoteReads.bookmarkedShops() : null,
      isRemoteWithAccount("lounge") ? remoteReads.blockedMembers() : null,
    ])
    const failure = [ledger, logs, bookmarks, hiddenAuthors].find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    )
    dispatch({
      type: "ACCOUNT_UPDATE",
      memberId,
      update: (current) => {
        const change: Partial<RemoteAccountState> = {
          status: failure ? "error" : "ready",
          error: failure ? writeErrorMessage(failure.reason, "내 기록을 불러오지 못했어요.") : null,
        }
        if (ledger.status === "fulfilled" && ledger.value) change.ledger = ledger.value
        if (logs.status === "fulfilled" && logs.value) {
          change.logs = logs.value.items
          change.logsCursor = logs.value.hasNext ? logs.value.nextCursor : null
        }
        if (bookmarks.status === "fulfilled" && bookmarks.value) change.bookmarks = bookmarks.value
        if (hiddenAuthors.status === "fulfilled" && hiddenAuthors.value) change.hiddenAuthors = hiddenAuthors.value
        const next = withAccount(current, change)
        return change.ledger && next.user ? { ...next, user: { ...next.user, revisitCount: change.ledger.revisitCount } } : next
      },
    })
  }, [])

  // 가입을 마친 서버 회원이 확인되면(세션 복원·로그인) 내 데이터를 한 번 읽는다. 다시 읽기는 refreshAccount
  const accountMemberId = state.account.memberId
  const accountToLoad =
    isRemote("auth") &&
    state.user?.isLoggedIn &&
    state.onboardingCompleted &&
    state.account.status === "idle" &&
    accountMemberId === state.user.id
      ? accountMemberId
      : null
  useEffect(() => {
    if (accountToLoad) void loadAccount(accountToLoad)
  }, [accountToLoad, loadAccount])

  const refreshAccount = useCallback(async () => {
    if (accountMemberId) await loadAccount(accountMemberId)
  }, [accountMemberId, loadAccount])

  const loadingMoreLogs = useRef(false)
  const loadMoreMyLogs = useCallback(async () => {
    const memberId = state.account.memberId
    const cursor = state.account.logsCursor
    if (!memberId || !cursor || loadingMoreLogs.current) return
    loadingMoreLogs.current = true
    try {
      const page = await remoteReads.myLogs(cursor)
      dispatch({
        type: "ACCOUNT_UPDATE",
        memberId,
        update: (current) => {
          const known = new Set((current.account.logs ?? []).map((log) => log.id))
          return withAccount(current, {
            logs: [...(current.account.logs ?? []), ...page.items.filter((log) => !known.has(log.id))],
            logsCursor: page.hasNext ? page.nextCursor : null,
          })
        },
      })
    } finally {
      loadingMoreLogs.current = false
    }
  }, [state.account.logsCursor, state.account.memberId])

  const agreeToConsents = useCallback(async (marketing: boolean): Promise<void> => {
    if (!isRemote("auth")) {
      dispatch({ type: "CONSENTS_AGREED" })
      return
    }
    dispatch({ type: "MEMBER_SIGNED_IN", payload: await remoteWrites.agreeToConsents(marketing) })
  }, [])

  /**
   * 기기 안 로그인(mock. auth remote에서는 signIn을 쓰고, 이 함수는 개발 빌드의 데모 계정만 쓴다).
   * - provider 없음: 데모 계정 체험. 항상 데모 계정(42그릇)으로 들어가고 찜 목록도 데모 기준으로 돌린다.
   * - provider 있음(apple·kakao·google): 로그인 수단마다 기기 안 고정 id(local-<provider>)를 쓴다.
   *   처음이면 0그릇·빈 찜 목록으로 시작하고 온보딩을 거친다. 같은 수단으로 다시 로그인하면 이전 기록이 돌아온다.
   */
  const login = useCallback(
    (input: LoginInput = {}): UserProfile => {
      if (!input.provider) {
        const wasDemo = state.user?.id === DEMO_USER.id
        const profile: UserProfile = { ...(wasDemo && state.user ? state.user : DEMO_USER), isLoggedIn: true }
        dispatch({
          type: "LOGIN",
          payload: profile,
          onboardingCompleted: true,
          bookmarkedShopIds: wasDemo ? undefined : demoBookmarkIds(),
        })
        return profile
      }

      const id = `local-${input.provider}`
      if (state.user?.id === id) {
        const profile: UserProfile = { ...state.user, isLoggedIn: true }
        dispatch({ type: "LOGIN", payload: profile })
        return profile
      }

      const freshName = input.name ?? input.nickname ?? "라멘 탐험가"
      const profile: UserProfile = {
        id,
        name: freshName,
        nickname: input.nickname ?? freshName,
        email: input.email,
        avatar: input.avatar ?? null,
        level: "라멘 입문자",
        levelNumber: 1,
        membershipNo: `#RT-${String(Date.now()).slice(-6)}`,
        bio: "",
        favoriteRamenType: undefined,
        visitedCount: 0,
        revisitCount: 0,
        isLoggedIn: true,
      }
      dispatch({ type: "LOGIN", payload: profile, onboardingCompleted: false, bookmarkedShopIds: [] })
      return profile
    },
    [state.user],
  )

  const completeOnboarding = useCallback(
    async (input: ProfileUpdateInput = {}, options: CompleteOnboardingOptions = {}): Promise<UserProfile> => {
      if (isRemote("auth")) {
        try {
          const member = await remoteWrites.completeOnboarding({
            nickname: input.nickname ?? "",
            consents: currentConsentDecisions(options.marketing ?? false),
            profile: { bio: input.bio, favoriteRamenType: input.favoriteRamenType, avatar: input.avatar },
          })
          dispatch({ type: "MEMBER_SIGNED_IN", payload: member })
          return member.profile
        } catch (error) {
          // 가입은 끝났다. 화면이 온보딩을 다시 보내지 않고 프로필만 다시 저장하게 계정 상태를 먼저 맞춘다
          if (error instanceof OnboardingProfileUpdateError) {
            dispatch({ type: "MEMBER_SIGNED_IN", payload: error.member })
          }
          throw error
        }
      }
      const previousAvatar = state.user?.avatar
      const durableAvatar =
        typeof input.avatar === "string" && input.avatar !== state.user?.avatar
          ? await persistMediaFile(input.avatar, "avatar")
          : input.avatar
      const normalizedInput =
        input.avatar === undefined
          ? input
          : { ...input, avatar: durableAvatar ?? null }
      const current =
        state.user ??
        login({
          // 로그인 수단 없이 바로 가입하는 경우는 이메일 가입 새 계정으로 만든다(provider가 없으면 데모 계정이 된다)
          provider: "email",
          name:
            normalizedInput.nickname ?? normalizedInput.name ?? "라멘 탐험가",
          nickname: normalizedInput.nickname,
          avatar: normalizedInput.avatar,
        })
      const profile = { ...current, ...normalizedInput, isLoggedIn: true }
      dispatch({ type: "COMPLETE_ONBOARDING", payload: profile })
      if (previousAvatar && previousAvatar !== profile.avatar) {
        await deletePersistedMediaMany([previousAvatar])
      }
      return profile
    },
    [login, state.user],
  )

  const logout = useCallback(() => {
    const accountId = state.user?.isLoggedIn ? state.user.id : null
    dispatch({ type: "LOGOUT" })
    if (!isRemote("auth")) return
    // 앞 계정 데이터는 바로 감춘다. 토큰을 지운 뒤(forgetRemoteAccount) 한 번 더 비워 비회원 응답으로 다시 읽게 한다
    remoteCache.clear()
    // 서버에 refresh 토큰 폐기를 알린다. 네트워크가 안 돼도 기기 토큰은 지운다(authApi.logout)
    void remoteWrites
      .signOut()
      .catch(() => undefined)
      .finally(() => forgetRemoteAccount(accountId))
  }, [forgetRemoteAccount, state.user])

  const withdraw = useCallback(async () => {
    if (isRemote("auth")) {
      const accountId = state.user?.isLoggedIn ? state.user.id : null
      await remoteWrites.withdraw()
      forgetRemoteAccount(accountId)
    }
    let cleanupError: string | null = null
    const cleanupResults = await Promise.allSettled([
      clearPersistedMediaDirectory(),
      repository.clear(),
    ])
    const failedCleanup = cleanupResults.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    )
    if (failedCleanup) {
      cleanupError = errorMessage(failedCleanup.reason)
    }
    dispatch({ type: "WITHDRAW", payload: createWithdrawnState() })
    if (cleanupError)
      dispatch({ type: "STORAGE_ERROR", payload: cleanupError })
  }, [forgetRemoteAccount, repository, state.user])

  const updateProfile = useCallback(
    async (input: ProfileUpdateInput): Promise<UserProfile | null> => {
      if (!state.user) return null
      // 서버 회원(auth·member remote): 사진은 올린 주소로, 지운 값은 빈 문자열로 보낸다. 서버가 돌려준 값으로 맞춘다
      if (isRemote("auth") && isRemote("member")) {
        const { profile } = await remoteWrites.updateProfile(input)
        const changes: ProfileUpdateInput = {
          email: profile.email,
          avatar: profile.avatar,
          bio: profile.bio,
          favoriteRamenType: profile.favoriteRamenType,
        }
        dispatch({ type: "UPDATE_PROFILE", payload: changes })
        return { ...state.user, ...changes }
      }
      const previousAvatar = state.user.avatar
      const nextAvatar =
        input.avatar && input.avatar !== previousAvatar
          ? await persistMediaFile(input.avatar, "avatar")
          : input.avatar
      const changes =
        input.avatar === undefined
          ? input
          : { ...input, avatar: nextAvatar ?? null }
      dispatch({ type: "UPDATE_PROFILE", payload: changes })
      if (previousAvatar && previousAvatar !== changes.avatar) {
        await deletePersistedMediaMany([previousAvatar])
      }
      return { ...state.user, ...changes }
    },
    [state.user],
  )

  const isShopBookmarked = useCallback(
    (shop: Shop): boolean => {
      if (!state.user?.isLoggedIn) return false
      if (!isRemoteWithAccount("shops")) return state.bookmarkedShopIds.includes(shop.id)
      const override = state.account.bookmarkOverrides[shop.id]
      if (override !== undefined) return override
      const fromServer = (shop as Partial<RemoteShop>).isBookmarked
      if (typeof fromServer === "boolean") return fromServer
      return state.account.bookmarks?.some((item) => item.id === shop.id) ?? false
    },
    [state.account.bookmarkOverrides, state.account.bookmarks, state.bookmarkedShopIds, state.user?.isLoggedIn],
  )

  const toggleBookmark = useCallback(
    async (shop: Shop): Promise<void> => {
      const user = selectCurrentUser(state)
      if (!user) return
      if (!isRemoteWithAccount("shops")) {
        dispatch({ type: "TOGGLE_BOOKMARK", payload: shop.id })
        return
      }
      const memberId = user.id
      const saved = !isShopBookmarked(shop)
      const previous = state.account.bookmarkOverrides[shop.id]
      const setOverride = (value: boolean | undefined) =>
        dispatch({
          type: "ACCOUNT_UPDATE",
          memberId,
          update: (current) => {
            const { [shop.id]: _old, ...rest } = current.account.bookmarkOverrides
            return withAccount(current, { bookmarkOverrides: value === undefined ? rest : { ...rest, [shop.id]: value } })
          },
        })
      // 화면은 바로 바꾸고, 실패하면 누르기 전으로 되돌린다
      setOverride(saved)
      try {
        await remoteWrites.toggleBookmark(shop.id, saved)
      } catch (error) {
        setOverride(previous)
        throw new Error(writeErrorMessage(error, saved ? "찜하지 못했어요. 다시 시도해 주세요." : "찜을 해제하지 못했어요. 다시 시도해 주세요."))
      }
      dispatch({
        type: "ACCOUNT_UPDATE",
        memberId,
        update: (current) => {
          const others = (current.account.bookmarks ?? []).filter((item) => item.id !== shop.id)
          return withAccount(current, { bookmarks: saved ? [shop, ...others] : others })
        },
      })
    },
    [isShopBookmarked, state],
  )

  const startRecordDraft = useCallback(
    (shopId: string | null = null) =>
      dispatch({ type: "START_RECORD_DRAFT", payload: { shopId, key: createIdempotencyKey() } }),
    [],
  )
  const selectRecordDraftShop = useCallback(
    (shopId: string) =>
      dispatch({ type: "SELECT_RECORD_DRAFT_SHOP", payload: shopId }),
    [],
  )
  const clearRecordDraft = useCallback(
    () => dispatch({ type: "CLEAR_RECORD_DRAFT" }),
    [],
  )

  const createLog = useCallback(
    async (input: CreateRamenLogInput): Promise<RamenLog> => {
      const user = selectCurrentUser(state)
      if (!user) throw new Error("로그인 후 라멘 기록을 저장할 수 있어요.")
      const remote = isRemote("ramenLogs")
      // 서버 매장은 기기 원장에 없다. 매장이 있는지는 서버가 확인한다(404)
      const validationError = validateRecordDraft(input, remote ? {} : {
        validShopIds: SHOPS.map((shop) => shop.id),
      })[0]
      if (validationError) throw new Error(validationError.message)

      if (remote) {
        const memberId = user.id
        try {
          const log = await remoteWrites.createRamenLog(input, {
            accountId: memberId,
            draftKey: state.recordDraft?.key ?? createIdempotencyKey(),
          })
          dispatch({ type: "ACCOUNT_UPDATE", memberId, update: (current) => accountWithSavedLog(current, log, true) })
          remoteCache.invalidate("lounge:", `shop:${input.shopId}`)
          return log
        } catch (error) {
          if (error instanceof AlreadyHandledError) {
            // 이 초안으로 만든 기록은 이미 지워졌다. 내 기록을 다시 읽고, 다시 저장하면 새 기록이 되게 키를 바꾼다
            dispatch({ type: "RENEW_RECORD_DRAFT_KEY", payload: createIdempotencyKey() })
            void loadAccount(memberId)
            throw error
          }
          throw new Error(writeErrorMessage(error, "기록을 저장하지 못했어요. 다시 시도해 주세요."))
        }
      }

      const originalPhotos = input.photos ?? []
      const persistedPhotos = await persistMediaFiles(
        originalPhotos,
        "ramen-log",
      )
      const imageIndex = input.imageUrl
        ? originalPhotos.indexOf(input.imageUrl)
        : -1
      const imageUrl = input.imageUrl
        ? imageIndex >= 0
          ? persistedPhotos[imageIndex]
          : await persistMediaFile(input.imageUrl, "ramen-log-cover")
        : (persistedPhotos[0] ?? null)
      const shop = SHOPS.find((item) => item.id === input.shopId)
      const nextLogId = nextNumericId(state.logs, allocatedIds.current.log)
      allocatedIds.current.log = nextLogId
      const log: RamenLog = {
        id: nextLogId,
        author: {
          id: user.id,
          name: user.nickname,
          avatar: user.avatar ?? undefined,
          level: `${user.level} (Lv.${user.levelNumber})`,
        },
        shop: {
          id: input.shopId,
          name: input.shopName ?? shop?.name ?? "새 라멘집",
          branch: input.branch ?? shop?.branch,
          location: shop?.address,
        },
        menuName: input.menuName,
        ramenType: input.ramenType,
        visitedAt: input.visitedAt,
        imageUrl,
        photos: persistedPhotos,
        note: input.note,
        tasteNotes: input.tasteNotes,
        // 재방문 의사 점수는 revisit 답에서 다시 계산해 둘이 어긋나지 않게 한다.
        scores: { ...input.scores, revisit: REVISIT_SCORE[input.revisit] },
        revisit: input.revisit,
        likes: 0,
        isLiked: false,
        isPublic: input.isPublic,
        createdAt: new Date().toISOString(),
        commentCount: 0,
        comments: [],
      }
      dispatch({ type: "CREATE_LOG", payload: log })
      const ownedLogs = [log, ...state.logs].filter(
        (item) => item.author.id === user.id,
      )
      dispatch({
        type: "REFRESH_TASTE_REPORT",
        payload: buildTasteReport(
          ownedLogs,
          SHOPS,
          new Date(),
          user.visitedCount + 1,
          state.tasteReports.length + 1,
        ),
      })
      return log
    },
    [loadAccount, state],
  )

  const updateLog = useCallback(
    async (logId: string, input: CreateRamenLogInput): Promise<RamenLog> => {
      const user = selectCurrentUser(state)
      if (!user) throw new Error("로그인 후 기록을 고칠 수 있어요.")
      const validationError = validateRecordDraft(input)[0]
      if (validationError) throw new Error(validationError.message)

      if (isRemote("ramenLogs")) {
        const memberId = user.id
        try {
          const log = await remoteWrites.updateRamenLog(logId, input)
          dispatch({ type: "ACCOUNT_UPDATE", memberId, update: (current) => accountWithSavedLog(current, log, false) })
          remoteCache.invalidate("lounge:", `log:${logId}`)
          return log
        } catch (error) {
          if (isApiError(error, "RESOURCE_NOT_FOUND")) {
            dispatch({ type: "ACCOUNT_UPDATE", memberId, update: (current) => accountWithoutLog(current, logId) })
            remoteCache.invalidate("lounge:", `log:${logId}`)
            throw new Error("이미 삭제된 기록이에요.")
          }
          throw new Error(writeErrorMessage(error, "기록을 고치지 못했어요. 다시 시도해 주세요."))
        }
      }

      const previous = state.logs.find((item) => item.id === logId)
      if (!previous || previous.author.id !== user.id) throw new Error("내가 남긴 기록만 고칠 수 있어요.")
      const previousPhotos = previous.photos ?? (previous.imageUrl ? [previous.imageUrl] : [])
      const nextPhotos = input.photos ?? []
      const added = nextPhotos.filter((uri) => !previousPhotos.includes(uri))
      const persisted = await persistMediaFiles(added, "ramen-log")
      const photos = nextPhotos.map((uri) => {
        const index = added.indexOf(uri)
        return index >= 0 ? persisted[index] : uri
      })
      const log: RamenLog = {
        ...previous,
        menuName: input.menuName,
        ramenType: input.ramenType,
        visitedAt: input.visitedAt,
        imageUrl: photos[0] ?? null,
        photos,
        note: input.note,
        tasteNotes: input.tasteNotes,
        scores: { ...input.scores, revisit: REVISIT_SCORE[input.revisit] },
        revisit: input.revisit,
        isPublic: input.isPublic,
      }
      dispatch({ type: "UPDATE_LOG", payload: log })
      await deletePersistedMediaMany(previousPhotos.filter((uri) => !nextPhotos.includes(uri)))
      return log
    },
    [state],
  )

  const deleteLog = useCallback(
    async (logId: string) => {
      const currentUser = selectCurrentUser(state)
      if (!currentUser) return
      if (isRemote("ramenLogs")) {
        try {
          await remoteWrites.deleteRamenLog(logId)
        } catch (error) {
          throw new Error(writeErrorMessage(error, "기록을 지우지 못했어요. 다시 시도해 주세요."))
        }
        dispatch({ type: "ACCOUNT_UPDATE", memberId: currentUser.id, update: (current) => accountWithoutLog(current, logId) })
        remoteCache.invalidate("lounge:", `log:${logId}`)
        return
      }
      const log = state.logs.find((item) => item.id === logId)
      if (!log) return
      if (log.author.id !== currentUser.id) return
      await deletePersistedMediaMany([log.imageUrl, ...(log.photos ?? [])])
      dispatch({ type: "DELETE_LOG", payload: logId })
    },
    [state],
  )

  const toggleLogLike = useCallback(
    async (log: RamenLog): Promise<void> => {
      const user = selectCurrentUser(state)
      if (!user) return
      if (!isRemoteWithAccount("lounge")) {
        dispatch({ type: "TOGGLE_LOG_LIKE", payload: log.id })
        return
      }
      const memberId = user.id
      const previous = state.account.likes[log.id]
      const setLike = (value: { isLiked: boolean; likes: number } | undefined) =>
        dispatch({
          type: "ACCOUNT_UPDATE",
          memberId,
          update: (current) => {
            const { [log.id]: _old, ...rest } = current.account.likes
            return withAccount(current, { likes: value ? { ...rest, [log.id]: value } : rest })
          },
        })
      const liked = !log.isLiked
      setLike({ isLiked: liked, likes: Math.max(0, log.likes + (liked ? 1 : -1)) })
      try {
        const result = await remoteWrites.toggleLogLike(log.id, liked)
        setLike({ isLiked: result.liked, likes: result.likeCount })
      } catch (error) {
        setLike(previous)
        if (isApiError(error, "RESOURCE_NOT_FOUND")) remoteCache.invalidate("lounge:")
        throw new Error(writeErrorMessage(error, "공감을 반영하지 못했어요. 다시 시도해 주세요."))
      }
    },
    [state],
  )
  const addLogComment = useCallback(
    async (
      logId: string,
      input: CreateRamenLogCommentInput,
    ): Promise<RamenLogComment | null> => {
      const user = selectCurrentUser(state)
      const content = input.content.trim()
      if (!user || !isValidLogComment(content)) return null

      if (isRemoteWithAccount("lounge")) {
        const memberId = user.id
        const draftKey = commentDraftKeys.current.get(logId) ?? createIdempotencyKey()
        commentDraftKeys.current.set(logId, draftKey)
        try {
          const comment = await remoteWrites.addLogComment(logId, { content }, { accountId: memberId, draftKey })
          commentDraftKeys.current.delete(logId)
          dispatch({
            type: "ACCOUNT_UPDATE",
            memberId,
            update: (current) =>
              withAccount(current, {
                addedComments: {
                  ...current.account.addedComments,
                  [logId]: [...(current.account.addedComments[logId] ?? []), comment],
                },
              }),
          })
          remoteCache.invalidate(`lounge:detail:${logId}`)
          return comment
        } catch (error) {
          if (error instanceof AlreadyHandledError) {
            commentDraftKeys.current.delete(logId)
            remoteCache.invalidate(`lounge:detail:${logId}`)
            throw error
          }
          if (isApiError(error, "RESOURCE_NOT_FOUND")) {
            commentDraftKeys.current.delete(logId)
            remoteCache.invalidate("lounge:")
          }
          throw new Error(writeErrorMessage(error, "댓글을 남기지 못했어요. 다시 시도해 주세요."))
        }
      }

      const log = state.logs.find((item) => item.id === logId)
      if (!log) return null

      const allComments = state.logs.flatMap((item) => item.comments ?? [])
      const nextCommentId = nextNumericId(allComments, allocatedIds.current.comment)
      allocatedIds.current.comment = nextCommentId
      const parent = input.parentId
        ? (log.comments ?? []).find((comment) => comment.id === input.parentId)
        : undefined
      const comment: RamenLogComment = {
        id: nextCommentId,
        logId,
        author: {
          id: user.id,
          name: user.nickname,
          level: `${user.level} (Lv.${user.levelNumber})`,
          avatar: user.avatar,
        },
        content,
        createdAt: new Date().toISOString(),
        likes: 0,
        isLiked: false,
        parentId: parent?.id,
        parentAuthorName: parent?.author.name,
      }
      dispatch({ type: "ADD_LOG_COMMENT", payload: { logId, comment } })
      return comment
    },
    [state],
  )
  const deleteLogComment = useCallback(
    async (logId: string, commentId: string): Promise<void> => {
      const user = selectCurrentUser(state)
      if (!user) return
      if (isRemoteWithAccount("lounge")) {
        try {
          await remoteWrites.deleteLogComment(commentId)
        } catch (error) {
          throw new Error(writeErrorMessage(error, "댓글을 지우지 못했어요. 다시 시도해 주세요."))
        }
        dispatch({
          type: "ACCOUNT_UPDATE",
          memberId: user.id,
          update: (current) =>
            withAccount(current, {
              deletedCommentIds: [...current.account.deletedCommentIds, commentId],
              addedComments: {
                ...current.account.addedComments,
                [logId]: (current.account.addedComments[logId] ?? []).filter((comment) => comment.id !== commentId),
              },
            }),
        })
        remoteCache.invalidate(`lounge:detail:${logId}`)
        return
      }
      const comment = state.logs.find((log) => log.id === logId)?.comments?.find((item) => item.id === commentId)
      if (comment?.author.id !== user.id) return
      dispatch({ type: "DELETE_LOG_COMMENT", payload: { logId, commentId } })
    },
    [state],
  )
  const toggleShopSubscription = useCallback(
    (shopId: string) =>
      dispatch({ type: "TOGGLE_SHOP_SUBSCRIPTION", payload: shopId }),
    [],
  )

  const createPost = useCallback(
    async (input: CreateCommunityPostInput): Promise<CommunityPost> => {
      const user = selectCurrentUser(state)
      if (!user) throw new Error("로그인 후 게시글을 작성할 수 있어요.")
      const imageUrls = await persistMediaFiles(
        input.imageUrls ?? [],
        "community-post",
      )
      const shop = input.shopId
        ? SHOPS.find((item) => item.id === input.shopId)
        : undefined
      const nextPostId = nextNumericId(state.communityPosts, allocatedIds.current.post)
      allocatedIds.current.post = nextPostId
      const post: CommunityPost = {
        id: nextPostId,
        category: input.category,
        categoryLabel: CATEGORY_LABELS[input.category],
        title: input.title.trim(),
        content: input.content.trim(),
        detailedContent: input.detailedContent,
        author: {
          id: user.id,
          name: user.nickname,
          level: `${user.level} (Lv.${user.levelNumber})`,
          avatar: user.avatar,
        },
        createdAt: new Date().toISOString(),
        likes: 0,
        commentCount: 0,
        viewCount: 0,
        isLiked: false,
        shopId: input.shopId,
        shopName: shop?.name,
        imageUrls,
        comments: [],
      }
      dispatch({ type: "CREATE_POST", payload: post })
      return post
    },
    [state],
  )

  const addComment = useCallback(
    (
      postId: string,
      input: CreateCommunityCommentInput,
    ): CommunityComment | null => {
      const post = state.communityPosts.find((item) => item.id === postId)
      if (!post || !input.content.trim()) return null
      const user = selectCurrentUser(state)
      if (!user) return null
      const parent = input.parentId
        ? post.comments.find((comment) => comment.id === input.parentId)
        : undefined
      const allComments = state.communityPosts.flatMap((item) => item.comments)
      const nextCommentId = nextNumericId(allComments, allocatedIds.current.comment)
      allocatedIds.current.comment = nextCommentId
      const comment: CommunityComment = {
        id: nextCommentId,
        postId,
        author: {
          id: user.id,
          name: user.nickname,
          level: `${user.level} (Lv.${user.levelNumber})`,
          avatar: user.avatar,
        },
        content: input.content.trim(),
        createdAt: new Date().toISOString(),
        likes: 0,
        isLiked: false,
        parentId: parent?.id,
        parentAuthorName: parent?.author.name,
      }
      dispatch({ type: "ADD_COMMENT", payload: { postId, comment } })
      return comment
    },
    [state],
  )

  const togglePostLike = useCallback(
    (postId: string) => dispatch({ type: "TOGGLE_POST_LIKE", payload: postId }),
    [],
  )
  const markNotificationRead = useCallback(
    (notificationId: string) =>
      dispatch({ type: "MARK_NOTIFICATION_READ", payload: notificationId }),
    [],
  )
  const markAllNotificationsRead = useCallback(
    () => dispatch({ type: "MARK_ALL_NOTIFICATIONS_READ" }),
    [],
  )
  const deleteNotification = useCallback(
    (notificationId: string) =>
      dispatch({ type: "DELETE_NOTIFICATION", payload: notificationId }),
    [],
  )
  const updateNotificationSettings = useCallback(
    (settings: Partial<NotificationSettings>) =>
      dispatch({ type: "UPDATE_NOTIFICATION_SETTINGS", payload: settings }),
    [],
  )
  const dismissStorageError = useCallback(
    () => dispatch({ type: "STORAGE_ERROR", payload: null }),
    [],
  )
  const refreshTasteReport = useCallback((): TasteReport => {
    const user = selectCurrentUser(state)
    if (!user) throw new Error("로그인 후 취향 리포트를 만들 수 있어요.")
    const ownedLogs = state.logs.filter(
      (log) => log.author.id === state.user?.id,
    )
    const report = buildTasteReport(
      ownedLogs,
      SHOPS,
      new Date(),
      user.visitedCount,
      state.tasteReports.length + 1,
    )
    dispatch({ type: "REFRESH_TASTE_REPORT", payload: report })
    return report
  }, [
    state.logs,
    state.tasteReports.length,
    state.user?.id,
    state.user?.isLoggedIn,
    state.user?.visitedCount,
  ])

  const hideAuthor = useCallback(
    async (author: HiddenAuthor): Promise<boolean> => {
      const user = selectCurrentUser(state)
      if (!user || !author.id || author.id === user.id) return false
      if (isRemoteWithAccount("lounge")) {
        const memberId = user.id
        const setHidden = (hidden: boolean) =>
          dispatch({
            type: "ACCOUNT_UPDATE",
            memberId,
            update: (current) => {
              const others = (current.account.hiddenAuthors ?? []).filter((item) => item.id !== author.id)
              return withAccount(current, { hiddenAuthors: hidden ? [author, ...others] : others })
            },
          })
        // 바로 감추고, 서버 차단이 실패하면 다시 보여준다
        setHidden(true)
        try {
          await remoteWrites.hideAuthor(author.id)
        } catch {
          setHidden(false)
          return false
        }
        remoteCache.invalidate("lounge:")
      } else {
        dispatch({ type: "HIDE_AUTHOR", payload: author.id })
      }
      track("author_hidden")
      return true
    },
    [state],
  )
  const unhideAuthor = useCallback(
    async (authorId: string): Promise<void> => {
      const user = selectCurrentUser(state)
      if (!user) return
      if (!isRemoteWithAccount("lounge")) {
        dispatch({ type: "UNHIDE_AUTHOR", payload: authorId })
        return
      }
      try {
        await remoteWrites.unhideAuthor(authorId)
      } catch (error) {
        throw new Error(writeErrorMessage(error, "숨김을 풀지 못했어요. 다시 시도해 주세요."))
      }
      dispatch({
        type: "ACCOUNT_UPDATE",
        memberId: user.id,
        update: (current) =>
          withAccount(current, { hiddenAuthors: (current.account.hiddenAuthors ?? []).filter((item) => item.id !== authorId) }),
      })
      remoteCache.invalidate("lounge:")
    },
    [state],
  )
  const reportContent = useCallback(
    async (input: ReportContentInput): Promise<ContentReport | null> => {
      const user = selectCurrentUser(state)
      if (!user) return null
      const remote = isRemoteWithAccount("lounge")
      const reports = remote ? state.account.reports : state.contentReports
      const existing = reports.find((report) => report.kind === input.kind && report.targetId === input.id)
      if (existing) return existing
      if (remote) {
        try {
          await remoteWrites.reportContent(input)
        } catch (error) {
          throw new Error(writeErrorMessage(error, "신고를 보내지 못했어요. 다시 시도해 주세요."))
        }
      }
      const report: ContentReport = {
        id: `report-${input.kind}-${input.id}-${Date.now()}`,
        kind: input.kind,
        targetId: input.id,
        reason: input.reason,
        createdAt: new Date().toISOString(),
      }
      if (remote) {
        dispatch({
          type: "ACCOUNT_UPDATE",
          memberId: user.id,
          update: (current) => withAccount(current, { reports: [...current.account.reports, report] }),
        })
      } else {
        dispatch({ type: "REPORT_CONTENT", payload: report })
      }
      track("content_reported", { kind: input.kind, reason: input.reason })
      return report
    },
    [state],
  )

  const actions = useMemo<RaotaActions>(
    () => ({
      login,
      signIn,
      completeOnboarding,
      agreeToConsents,
      logout,
      withdraw,
      updateProfile,
      startRecordDraft,
      selectRecordDraftShop,
      clearRecordDraft,
      toggleBookmark,
      createLog,
      updateLog,
      deleteLog,
      toggleLogLike,
      addLogComment,
      deleteLogComment,
      refreshAccount,
      loadMoreMyLogs,
      toggleShopSubscription,
      createPost,
      addComment,
      togglePostLike,
      markNotificationRead,
      markAllNotificationsRead,
      deleteNotification,
      updateNotificationSettings,
      refreshTasteReport,
      dismissStorageError,
      hideAuthor,
      unhideAuthor,
      reportContent,
    }),
    [
      addComment,
      addLogComment,
      agreeToConsents,
      clearRecordDraft,
      completeOnboarding,
      createLog,
      createPost,
      deleteLog,
      deleteLogComment,
      deleteNotification,
      dismissStorageError,
      hideAuthor,
      loadMoreMyLogs,
      login,
      logout,
      markAllNotificationsRead,
      markNotificationRead,
      refreshAccount,
      refreshTasteReport,
      reportContent,
      selectRecordDraftShop,
      signIn,
      startRecordDraft,
      toggleBookmark,
      toggleLogLike,
      toggleShopSubscription,
      togglePostLike,
      unhideAuthor,
      updateLog,
      updateNotificationSettings,
      updateProfile,
      withdraw,
    ],
  )

  const value = useMemo<RaotaContextValue>(() => {
    const currentUser = selectCurrentUser(state)
    const { account } = state
    // 서버 회원의 내 기록은 서버 요약·목록에서 온다(이 기기의 로컬 기록과 섞지 않는다)
    const remoteLogs = Boolean(currentUser) && isRemote("ramenLogs")
    const userLogs = !currentUser
      ? []
      : remoteLogs
        ? (account.ledger?.logs ?? [])
        : state.logs.filter((log) => log.author.id === currentUser.id)
    const bookmarkedShops = isRemoteWithAccount("shops")
      ? currentUser
        ? (account.bookmarks ?? []).filter((shop) => account.bookmarkOverrides[shop.id] !== false)
        : []
      : SHOPS.filter((shop) => state.bookmarkedShopIds.includes(shop.id))
    return {
      state,
      isHydrated: state.hydrationStatus !== "loading",
      storageError: state.storageError,
      shops: SHOPS,
      newsItems: NEWS_ITEMS,
      currentUser,
      currentTasteReport: selectCurrentTasteReport(state),
      userLogs,
      unreadNotificationCount: selectUnreadNotificationCount(state),
      bookmarkedShops,
      subscribedNewsItems: NEWS_ITEMS.filter((item) =>
        state.subscribedShopIds.includes(item.shopId),
      ),
      isShopBookmarked,
      getShop: (id) => SHOPS.find((shop) => shop.id === id),
      getLog: remoteLogs
        ? (id) => (account.deletedLogIds.includes(id) ? undefined : (account.savedLogs[id] ?? account.logs?.find((log) => log.id === id)))
        : (id) => state.logs.find((log) => log.id === id),
      getPost: (id) => state.communityPosts.find((post) => post.id === id),
      actions,
    }
  }, [actions, isShopBookmarked, state])

  return <RaotaContext.Provider value={value}>{children}</RaotaContext.Provider>
}

export function useRaota(): RaotaContextValue {
  const value = useContext(RaotaContext)
  if (!value) throw new Error("useRaota must be used inside RaotaProvider")
  return value
}
