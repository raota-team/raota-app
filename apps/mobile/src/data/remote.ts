import type {
  ContentReport,
  ContentReportReason,
  CreateRamenLogCommentInput,
  CreateRamenLogInput,
  DemoBowl,
  ProfileUpdateInput,
  RamenLog,
  RamenLogComment,
  Shop,
} from "@raota/shared"

import {
  fileApi,
  fingerprintOf,
  idempotencyOutbox,
  isApiError,
  loungeApi,
  memberApi,
  ramenLogApi,
  recommendationApi,
  shopApi,
  subscribeSessionEnded,
  toAppBowls,
  toAppMapPin,
  toAppMember,
  toAppRamenLog,
  toAppRamenLogComment,
  toAppRamenLogComments,
  toAppShopDetail,
  toAppShopSummary,
  toCreateRamenLogBody,
  toUpdateMemberBody,
  toWireId,
  revisitCountOf,
  type AppMember,
  type CreateRamenLogRequest,
  type CursorPage,
  type LoungeSortParam,
  type RamenLogSummary,
  type RemoteMapPin,
  type ReportReason,
  type ShopListParams,
} from "../api"
import { LOUNGE_ALL_TYPES, type LoungeSort } from "../domain/lounge"

/**
 * 서버에서 읽고 쓰는 함수들. 지금은 아무 화면도 이 파일을 쓰지 않는다(기본값 mock).
 * src/data/hooks.ts가 "화면이 쓰는 데이터 입구"라는 규칙은 그대로다. 서버로 옮길 때도
 * 화면은 그대로 두고 hooks.ts 안쪽에서 이 함수들을 부른다.
 *
 * 옮기는 순서
 * 1) .env: EXPO_PUBLIC_API_MODE=remote, EXPO_PUBLIC_API_BASE_URL=<dev 주소(맥 LAN)>
 * 2) EXPO_PUBLIC_API_REMOTE_DOMAINS로 도메인을 하나씩 켠다(shops → lounge → ramenLogs → member)
 * 3) hooks.ts의 hook 안쪽만 바꾼다. { data, isLoading, error } 모양과 이름은 그대로 둔다
 *
 * hook ↔ 함수 ↔ 서버 경로
 * - useShops              → remoteReads.shops            GET /shops (커서)
 * - (지도)                 → remoteReads.mapPins          GET /shops/map-pins
 * - useShop               → remoteReads.shop             GET /shops/{id}
 * - useBookmarkedShops    → remoteReads.bookmarkedShops  GET /members/me/bookmarked-shops
 * - useMyLogs             → remoteReads.myLogs           GET /members/me/ramen-logs
 * - useMyBowls·useVisitedShops·useLongestStreak·useMonthlyReports·useTasteProfile
 *                         → remoteReads.myBowls          GET /members/me/ramen-logs/summary
 *                           (캘린더·방문 매장 API는 없다. 요약 목록 하나로 앱이 계산한다)
 * - useLog                → remoteReads.log              GET /ramen-logs/{id}
 * - useLoungeLogs         → remoteReads.loungeLogs       GET /ramen-logs?sort=LATEST|LIKES
 * - useLoungeLog          → remoteReads.loungeLog        GET /ramen-logs/{id} + /comments
 * - 홈 오늘의 큐레이션      → remoteReads.todayCuration    GET /curations/today
 * - AI 추천 화면           → remoteReads.recommendations  POST /ai/recommendations
 * - 스토어 actions(찜·기록·공감·댓글·신고·숨기기) → remoteWrites.*
 *
 * 스토어(RaotaProvider)가 붙일 것
 * - subscribeSessionEndedToLogout(() => actions.logout()) — 토큰이 무효화되면 로컬 로그인 상태도 내린다
 * - 로그아웃·탈퇴 때 idempotencyOutbox.clearAccount(userId)
 */

export interface RemotePage<T> {
  items: T[]
  nextCursor: string | null
  hasNext: boolean
}

function toPage<TWire, TApp>(page: CursorPage<TWire>, map: (item: TWire) => TApp): RemotePage<TApp> {
  return { items: (page.items ?? []).map(map), nextCursor: page.nextCursor ?? null, hasNext: Boolean(page.hasNext) }
}

/** 없는 자원(404)은 오류가 아니라 "없음"으로 다룬다 */
async function orNull<T>(request: Promise<T>): Promise<T | null> {
  try {
    return await request
  } catch (error) {
    if (isApiError(error, "RESOURCE_NOT_FOUND")) return null
    throw error
  }
}

const LOUNGE_SORT_TO_WIRE: Record<LoungeSort, LoungeSortParam> = { latest: "LATEST", likes: "LIKES" }

const REPORT_REASON_TO_WIRE: Record<ContentReportReason, ReportReason> = {
  spam: "SPAM",
  abuse: "ABUSE",
  sexual: "SEXUAL",
  privacy: "PRIVACY",
  other: "OTHER",
}

export interface LoungeFeedRequest {
  /** "전체" 또는 RAMEN_TYPES 중 하나 */
  type?: string
  sort?: LoungeSort
  cursor?: string | null
  size?: number
}

export const remoteReads = {
  /** 매장 목록. 커서 페이지라서 화면은 이어 붙이며 보여준다 */
  async shops(params: ShopListParams = {}): Promise<RemotePage<Shop>> {
    return toPage(await shopApi.list(params), toAppShopSummary)
  },

  /** 지도 핀 전체. 좌표를 모르는 매장은 지도에 찍지 않는다 */
  async mapPins(): Promise<RemoteMapPin[]> {
    const pins = await shopApi.mapPins()
    return pins.map(toAppMapPin).filter((pin) => !pin.unknownFields.includes("location"))
  },

  /** 매장 하나. 없으면 null */
  async shop(shopId: number | string): Promise<Shop | null> {
    const detail = await orNull(shopApi.detail(toWireId(shopId)))
    return detail ? toAppShopDetail(detail) : null
  },

  async bookmarkedShops(cursor?: string | null): Promise<RemotePage<Shop>> {
    return toPage(await memberApi.bookmarkedShops({ cursor }), toAppShopSummary)
  },

  /** 내 기록(방문일 최신순) */
  async myLogs(cursor?: string | null, size?: number): Promise<RemotePage<RamenLog>> {
    return toPage(await memberApi.myRamenLogs({ cursor, size }), (log: RamenLogSummary) => toAppRamenLog(log))
  },

  /** 내가 먹은 모든 그릇(최신순). 캘린더·방문 매장·월별 분포가 이 목록에서 나온다 */
  async myBowls(): Promise<DemoBowl[]> {
    return toAppBowls(await memberApi.myRamenLogSummary())
  },

  async log(logId: number | string): Promise<RamenLog | null> {
    const detail = await orNull(ramenLogApi.get(toWireId(logId)))
    return detail ? toAppRamenLog(detail) : null
  },

  /** 라운지 피드. 차단·신고한 글은 서버가 이미 빼고 준다 */
  async loungeLogs({ type, sort = "latest", cursor, size }: LoungeFeedRequest = {}): Promise<RemotePage<RamenLog>> {
    const page = await loungeApi.feed({
      sort: LOUNGE_SORT_TO_WIRE[sort],
      ramenType: !type || type === LOUNGE_ALL_TYPES ? undefined : type,
      cursor,
      size,
    })
    return toPage(page, (log: RamenLogSummary) => toAppRamenLog(log))
  },

  /** 라멘로그 상세 + 댓글 첫 쪽 */
  async loungeLog(logId: number | string): Promise<{ log: RamenLog; comments: RamenLogComment[] } | null> {
    const id = toWireId(logId)
    const detail = await orNull(ramenLogApi.get(id))
    if (!detail) return null
    const comments = await loungeApi.comments(id)
    return { log: toAppRamenLog(detail), comments: toAppRamenLogComments(comments.items ?? []) }
  },

  /**
   * 내 계정. 재방문 그릇 수는 서버에 필드가 없어 내 기록 요약에서 센다.
   * 요약까지 받고 싶지 않으면 withRevisitCount를 false로 둔다.
   */
  async me(withRevisitCount = true): Promise<AppMember> {
    const [member, summary] = await Promise.all([
      memberApi.me(),
      withRevisitCount ? memberApi.myRamenLogSummary() : Promise.resolve([]),
    ])
    return toAppMember(member, { revisitCount: revisitCountOf(summary) })
  },

  /** 오늘의 큐레이션(없으면 null) */
  async todayCuration(): Promise<{ shop: Shop; title: string; reason: string } | null> {
    const curation = await recommendationApi.today()
    return curation ? { shop: toAppShopSummary(curation.shop), title: curation.title, reason: curation.reason } : null
  },

  /**
   * AI 추천. 만들지 못하면(503) 화면이 로컬 랭킹·인기순으로 내려간다.
   * appliedConditions는 "지금 영업 중"처럼 화면에 그대로 보여주는 말이다.
   */
  async recommendations(
    request: Parameters<typeof recommendationApi.recommend>[0],
  ): Promise<{ shops: Shop[]; appliedConditions: string[] }> {
    const result = await recommendationApi.recommend(request)
    return { shops: (result.shops ?? []).map(toAppShopSummary), appliedConditions: result.appliedConditions ?? [] }
  },
} as const

export interface CreateRamenLogOptions {
  /** 로그인한 계정 id. 주면 실패한 저장을 같은 Idempotency-Key로 다시 보낼 수 있다 */
  accountId?: string
}

export const remoteWrites = {
  async toggleBookmark(shopId: number | string, saved: boolean): Promise<void> {
    const id = toWireId(shopId)
    await (saved ? shopApi.bookmark(id) : shopApi.removeBookmark(id))
  },

  /**
   * 기록 저장: 사진 업로드 → 생성.
   * 지문(fingerprint)은 사진을 올리기 전 입력으로 만든다. 그래야 재시도할 때
   * 이미 올린 사진을 다시 올리지 않고, 아웃박스에 남은 본문과 키를 그대로 쓴다.
   */
  async createRamenLog(input: CreateRamenLogInput, options: CreateRamenLogOptions = {}): Promise<RamenLog> {
    const fingerprint = fingerprintOf({ operation: "CREATE_RAMEN_LOG", input })
    const pending = options.accountId
      ? await idempotencyOutbox.find(options.accountId, "CREATE_RAMEN_LOG", fingerprint)
      : null

    const body: CreateRamenLogRequest = pending
      ? (pending.body as CreateRamenLogRequest)
      : toCreateRamenLogBody(input, { imageUrls: await fileApi.uploadImages("RAMEN_LOG", input.photos ?? []) })

    const detail = await ramenLogApi.create(body, { accountId: options.accountId, fingerprint })
    return toAppRamenLog(detail)
  },

  async deleteRamenLog(logId: number | string): Promise<void> {
    await ramenLogApi.remove(toWireId(logId))
  },

  /** 공감. 서버가 바뀐 공감 수를 돌려주므로 화면은 그 값으로 맞춘다 */
  async toggleLogLike(logId: number | string, liked: boolean): Promise<{ liked: boolean; likeCount: number }> {
    const id = toWireId(logId)
    return liked ? loungeApi.like(id) : loungeApi.unlike(id)
  },

  /** 댓글 작성(답글은 없다) */
  async addLogComment(
    logId: number | string,
    input: CreateRamenLogCommentInput,
    options: CreateRamenLogOptions = {},
  ): Promise<RamenLogComment> {
    const body = { content: input.content.trim() }
    const comment = await loungeApi.createComment(toWireId(logId), body, {
      accountId: options.accountId,
      fingerprint: fingerprintOf({ operation: "CREATE_COMMENT", logId: toWireId(logId), body }),
    })
    return toAppRamenLogComment(comment)
  },

  async deleteLogComment(commentId: number | string): Promise<void> {
    await loungeApi.deleteComment(toWireId(commentId))
  },

  /** 신고. 같은 대상을 다시 신고해도 성공이다 */
  async reportContent(input: {
    kind: ContentReport["kind"]
    id: number | string
    reason: ContentReportReason
  }): Promise<void> {
    await loungeApi.report({
      targetType: input.kind === "log" ? "RAMEN_LOG" : "RAMEN_LOG_COMMENT",
      targetId: toWireId(input.id),
      reason: REPORT_REASON_TO_WIRE[input.reason],
    })
  },

  /** 숨기기(차단). 서버가 목록을 갖고 있어 기기를 바꿔도 유지된다 */
  async hideAuthor(authorId: string): Promise<void> {
    await loungeApi.block(authorId)
  },

  async unhideAuthor(authorId: string): Promise<void> {
    await loungeApi.unblock(authorId)
  },

  /** 내가 숨긴 사람들 */
  async hiddenAuthorIds(): Promise<string[]> {
    const blocks = await loungeApi.myBlocks()
    return blocks.map((member) => member.id)
  },

  /** 프로필 수정. 사진은 먼저 올리고 주소를 보낸다 */
  async updateProfile(input: ProfileUpdateInput): Promise<AppMember> {
    const avatarUrl = await uploadedAvatarUrl(input)
    return toAppMember(await memberApi.updateMe(toUpdateMemberBody(input, avatarUrl)))
  },
} as const

/** 새로 고른 사진이면 올려서 주소를 만들고, 지웠으면 null, 그대로면 undefined(보내지 않는다) */
async function uploadedAvatarUrl(input: ProfileUpdateInput): Promise<string | null | undefined> {
  if (input.avatar === undefined) return undefined
  if (input.avatar === null) return null
  if (/^https?:\/\//i.test(input.avatar)) return undefined
  return (await fileApi.uploadImages("PROFILE", [input.avatar]))[0] ?? null
}

/**
 * 토큰이 무효화되면(다른 기기에서 로그아웃·탈퇴, refresh 재사용) 알림이 온다.
 * 스토어가 이걸 받아 로컬 로그인 상태를 내린다. remote 모드가 아니면 아무 일도 일어나지 않는다.
 */
export function subscribeSessionEndedToLogout(logout: () => void): () => void {
  return subscribeSessionEnded(() => logout())
}
