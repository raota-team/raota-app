import type {
  CommunityComment,
  CommunityPost,
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
import { validateRecordDraft } from "../domain/record"
import {
  clearPersistedMediaDirectory,
  deletePersistedMediaMany,
  persistMediaFile,
  persistMediaFiles,
} from "../storage/media"

type HydrationStatus = "loading" | "ready" | "error"

export interface PendingRecordDraft {
  shopId: number | null
}

export interface RaotaState extends PersistedAppStateV1 {
  hydrationStatus: HydrationStatus
  storageError: string | null
  recordDraft: PendingRecordDraft | null
}

export type RaotaAction =
  | { type: "HYDRATE"; payload: PersistedAppStateV1 }
  | { type: "STORAGE_ERROR"; payload: string | null }
  | { type: "START_RECORD_DRAFT"; payload: number | null }
  | { type: "SELECT_RECORD_DRAFT_SHOP"; payload: number }
  | { type: "CLEAR_RECORD_DRAFT" }
  | {
      type: "LOGIN"
      payload: UserProfile
      /** 이 기기에서 처음 쓰는 계정이면 온보딩을 다시 거친다 */
      onboardingCompleted?: boolean
      /** 계정이 바뀌면 찜 목록도 그 계정 것으로 바꾼다 */
      bookmarkedShopIds?: number[]
    }
  | { type: "COMPLETE_ONBOARDING"; payload: UserProfile }
  | { type: "LOGOUT" }
  | { type: "WITHDRAW"; payload: PersistedAppStateV1 }
  | { type: "UPDATE_PROFILE"; payload: ProfileUpdateInput }
  | { type: "TOGGLE_BOOKMARK"; payload: number }
  | { type: "CREATE_LOG"; payload: RamenLog }
  | { type: "DELETE_LOG"; payload: number }
  | { type: "TOGGLE_LOG_LIKE"; payload: number }
  | {
      type: "ADD_LOG_COMMENT"
      payload: { logId: number; comment: RamenLogComment }
    }
  | { type: "TOGGLE_SHOP_SUBSCRIPTION"; payload: number }
  | { type: "CREATE_POST"; payload: CommunityPost }
  | {
      type: "ADD_COMMENT"
      payload: { postId: number; comment: CommunityComment }
    }
  | { type: "TOGGLE_POST_LIKE"; payload: number }
  | { type: "MARK_NOTIFICATION_READ"; payload: string }
  | { type: "MARK_ALL_NOTIFICATIONS_READ" }
  | { type: "DELETE_NOTIFICATION"; payload: string }
  | {
      type: "UPDATE_NOTIFICATION_SETTINGS"
      payload: Partial<NotificationSettings>
    }
  | { type: "REFRESH_TASTE_REPORT"; payload: TasteReport }

/** 데모 계정의 찜 목록(웹과 같은 DEMO_SAVED_SHOP_NAMES) */
function demoBookmarkIds(): number[] {
  return DEMO_SAVED_SHOP_NAMES.map((name) => findShopByName(name)?.id).filter(
    (id): id is number => typeof id === "number",
  )
}

export function createInitialRaotaState(): RaotaState {
  return {
    ...createInitialPersistedState(),
    hydrationStatus: "loading",
    storageError: null,
    recordDraft: null,
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

function toggleNumber(items: number[], id: number): number[] {
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
        recordDraft: { shopId: action.payload },
      }
    case "SELECT_RECORD_DRAFT_SHOP":
      return state.recordDraft
        ? {
            ...state,
            recordDraft: { ...state.recordDraft, shopId: action.payload },
          }
        : state
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
    case "LOGOUT":
      return {
        ...state,
        user: state.user ? { ...state.user, isLoggedIn: false } : null,
      }
    case "WITHDRAW":
      return {
        ...action.payload,
        hydrationStatus: "ready",
        storageError: null,
        recordDraft: null,
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
        bookmarkedShopIds: toggleNumber(
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
    case "TOGGLE_SHOP_SUBSCRIPTION":
      return {
        ...state,
        subscribedShopIds: toggleNumber(
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
  }
}

const CATEGORY_LABELS: Record<CreateCommunityPostInput["category"], string> = {
  REVIEW: "맛집후기",
  TIP: "꿀팁",
  QUESTION: "Q&A",
  FREE: "자유",
}

function nextNumericId(items: Array<{ id: number }>): number {
  return items.reduce((max, item) => Math.max(max, item.id), 0) + 1
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
  const shopCounts = logs.reduce<Record<number, number>>((counts, log) => {
    counts[log.shop.id] = (counts[log.shop.id] ?? 0) + 1
    return counts
  }, {})
  const topShopEntries = Object.entries(shopCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
  const fallbackTopShops = shops
    .slice(0, 3)
    .map((shop) => [String(shop.id), 0] as const)
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
        shops.find((item) => item.id === Number(shopId)) ??
        shops[index] ??
        SHOPS[0]
      return {
        rank: index + 1,
        shopId: shop.id,
        style: shop.tags[0] ?? favoriteStyle,
        matchPercent: Math.max(75, shop.matchScore - index * 2),
        mustTry: `${shop.tags[0] ?? favoriteStyle} 추천 메뉴`,
        reason: `${shop.name}에서 남긴 취향 기록과 높은 일치도를 보입니다.`,
        visitCount: Number(count),
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
  }
}

export interface RaotaActions {
  login(input?: LoginInput): UserProfile
  completeOnboarding(input?: ProfileUpdateInput): Promise<UserProfile>
  logout(): void
  withdraw(): Promise<void>
  updateProfile(input: ProfileUpdateInput): Promise<UserProfile | null>
  startRecordDraft(shopId?: number | null): void
  selectRecordDraftShop(shopId: number): void
  clearRecordDraft(): void
  toggleBookmark(shopId: number): void
  createLog(input: CreateRamenLogInput): Promise<RamenLog>
  deleteLog(logId: number): Promise<void>
  toggleLogLike(logId: number): void
  addLogComment(
    logId: number,
    input: CreateRamenLogCommentInput,
  ): RamenLogComment | null
  toggleShopSubscription(shopId: number): void
  createPost(input: CreateCommunityPostInput): Promise<CommunityPost>
  addComment(
    postId: number,
    input: CreateCommunityCommentInput,
  ): CommunityComment | null
  togglePostLike(postId: number): void
  markNotificationRead(notificationId: string): void
  markAllNotificationsRead(): void
  deleteNotification(notificationId: string): void
  updateNotificationSettings(settings: Partial<NotificationSettings>): void
  refreshTasteReport(): TasteReport
  dismissStorageError(): void
}

export interface RaotaContextValue {
  state: RaotaState
  isHydrated: boolean
  storageError: string | null
  shops: Shop[]
  newsItems: NewsItem[]
  currentUser: UserProfile | null
  currentTasteReport: TasteReport | null
  userLogs: RamenLog[]
  unreadNotificationCount: number
  bookmarkedShops: Shop[]
  subscribedNewsItems: NewsItem[]
  getShop(id: number): Shop | undefined
  getLog(id: number): RamenLog | undefined
  getPost(id: number): CommunityPost | undefined
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
  const allocatedIds = useRef({ log: 0, post: 0, comment: 0 })
  const saveQueue = useRef<Promise<void>>(Promise.resolve())

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
      state.currentTasteReportId,
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
   * 서버 인증(#44) 전의 기기 안 로그인.
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
    async (input: ProfileUpdateInput = {}): Promise<UserProfile> => {
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

  const logout = useCallback(() => dispatch({ type: "LOGOUT" }), [])

  const withdraw = useCallback(async () => {
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
  }, [repository])

  const updateProfile = useCallback(
    async (input: ProfileUpdateInput): Promise<UserProfile | null> => {
      if (!state.user) return null
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

  const toggleBookmark = useCallback(
    (shopId: number) => dispatch({ type: "TOGGLE_BOOKMARK", payload: shopId }),
    [],
  )

  const startRecordDraft = useCallback(
    (shopId: number | null = null) =>
      dispatch({ type: "START_RECORD_DRAFT", payload: shopId }),
    [],
  )
  const selectRecordDraftShop = useCallback(
    (shopId: number) =>
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
      const validationError = validateRecordDraft(input, {
        validShopIds: SHOPS.map((shop) => shop.id),
      })[0]
      if (validationError) throw new Error(validationError.message)

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
      const nextLogId = Math.max(
        nextNumericId(state.logs),
        allocatedIds.current.log + 1,
      )
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
    [state],
  )

  const deleteLog = useCallback(
    async (logId: number) => {
      const log = state.logs.find((item) => item.id === logId)
      if (!log) return
      const currentUser = selectCurrentUser(state)
      if (log.author.id !== currentUser?.id) return
      await deletePersistedMediaMany([log.imageUrl, ...(log.photos ?? [])])
      dispatch({ type: "DELETE_LOG", payload: logId })
    },
    [state.logs],
  )

  const toggleLogLike = useCallback(
    (logId: number) => dispatch({ type: "TOGGLE_LOG_LIKE", payload: logId }),
    [],
  )
  const addLogComment = useCallback(
    (
      logId: number,
      input: CreateRamenLogCommentInput,
    ): RamenLogComment | null => {
      const log = state.logs.find((item) => item.id === logId)
      const user = selectCurrentUser(state)
      const content = input.content.trim()
      if (!log || !user || !content) return null

      const allComments = state.logs.flatMap((item) => item.comments ?? [])
      const nextCommentId = Math.max(
        nextNumericId(allComments),
        allocatedIds.current.comment + 1,
      )
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
  const toggleShopSubscription = useCallback(
    (shopId: number) =>
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
      const nextPostId = Math.max(
        nextNumericId(state.communityPosts),
        allocatedIds.current.post + 1,
      )
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
      postId: number,
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
      const nextCommentId = Math.max(
        nextNumericId(allComments),
        allocatedIds.current.comment + 1,
      )
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
    (postId: number) => dispatch({ type: "TOGGLE_POST_LIKE", payload: postId }),
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

  const actions = useMemo<RaotaActions>(
    () => ({
      login,
      completeOnboarding,
      logout,
      withdraw,
      updateProfile,
      startRecordDraft,
      selectRecordDraftShop,
      clearRecordDraft,
      toggleBookmark,
      createLog,
      deleteLog,
      toggleLogLike,
      addLogComment,
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
    }),
    [
      addComment,
      addLogComment,
      clearRecordDraft,
      completeOnboarding,
      createLog,
      createPost,
      deleteLog,
      deleteNotification,
      dismissStorageError,
      login,
      logout,
      markAllNotificationsRead,
      markNotificationRead,
      refreshTasteReport,
      selectRecordDraftShop,
      startRecordDraft,
      toggleBookmark,
      toggleLogLike,
      toggleShopSubscription,
      togglePostLike,
      updateNotificationSettings,
      updateProfile,
      withdraw,
    ],
  )

  const value = useMemo<RaotaContextValue>(() => {
    const currentUser = selectCurrentUser(state)
    const userLogs = currentUser
      ? state.logs.filter((log) => log.author.id === currentUser.id)
      : []
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
      bookmarkedShops: SHOPS.filter((shop) =>
        state.bookmarkedShopIds.includes(shop.id),
      ),
      subscribedNewsItems: NEWS_ITEMS.filter((item) =>
        state.subscribedShopIds.includes(item.shopId),
      ),
      getShop: (id) => SHOPS.find((shop) => shop.id === id),
      getLog: (id) => state.logs.find((log) => log.id === id),
      getPost: (id) => state.communityPosts.find((post) => post.id === id),
      actions,
    }
  }, [actions, state])

  return <RaotaContext.Provider value={value}>{children}</RaotaContext.Provider>
}

export function useRaota(): RaotaContextValue {
  const value = useContext(RaotaContext)
  if (!value) throw new Error("useRaota must be used inside RaotaProvider")
  return value
}
