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
import { legalDocumentVersion, t } from "@raota/shared"

import {
  applyTasteNoteDefinitions,
  authApi,
  fileApi,
  fingerprintOf,
  idempotencyOutbox,
  isApiError,
  isPermanentFailure,
  loungeApi,
  memberApi,
  ramenLogApi,
  recommendationApi,
  shopApi,
  subscribeSessionEnded,
  tokenStore,
  toAppBowls,
  toAppLedgerLog,
  toAppMember,
  toAppRamenLog,
  toAppRamenLogComment,
  toAppShopDetail,
  toAppShopSummary,
  toCreateRamenLogBody,
  toUpdateMemberBody,
  revisitCountOf,
  WITHDRAWN_AUTHOR_NAME,
  type AppMember,
  type ConsentDecision,
  type CreateRamenLogRequest,
  type CursorPage,
  type LoungeSortParam,
  type MemberMe,
  type OauthLoginRequest,
  type OnboardingRequest,
  type RamenLogDetail,
  type RamenLogSummary,
  type RecommendationTicket,
  type ReportReason,
  type ShopListParams,
  type ShopMapParams,
  type ShopSummary,
  type TasteNoteField,
} from "../api"
import { LOUNGE_ALL_TYPES, type HiddenAuthor, type LoungeSort } from "../domain/lounge"
import { remoteCache, ticketKey, TICKET_HISTORY_KEY } from "./remoteCache"

/**
 * 서버 읽기/쓰기 함수. 공개 읽기는 src/data/hooks.ts에서, 계정과 회원 데이터·쓰기는
 * 스토어 actions(src/state/RaotaStore.tsx)에서 연결한다. 기본값(mock)에서는 로컬 스토어만 사용한다.
 * 괄호는 도메인 스위치(src/api/config.ts). "+auth"는 auth도 remote여야 서버로 간다(토큰 없이 부르지 않는다).
 *
 * hook ↔ 함수 ↔ 서버 경로
 * - useShops             → remoteReads.shops             GET /shops (커서, shops)
 * - useMapShops          → remoteReads.mapShops          GET /shops/map (shops)
 * - useShop              → remoteReads.shop              GET /shops/{id} (shops, 로그인했으면 찜 여부 포함)
 * - useTodayCuration     → remoteReads.todayCuration     GET /curations/today (shops)
 * - useLoungeLogs        → remoteReads.loungeLogs        GET /ramen-logs (커서, lounge)
 * - useLoungeLog         → remoteReads.loungeLog         GET /ramen-logs/{id} (lounge)
 * - 댓글 다음 쪽         → remoteReads.loungeLogComments GET /ramen-logs/{id}/comments (커서, lounge)
 * - useLog               → remoteReads.log               GET /ramen-logs/{id} (ramenLogs, 내 목록에 없을 때)
 * - useTasteNoteFields   → remoteReads.tasteNoteFields   GET /taste-note-definitions (ramenLogs)
 * - useNicknameAvailability → remoteReads.nicknameAvailability GET /members/nickname-availability (member)
 * - AI 추천 화면         → remoteReads.recommendations   POST /ai/recommendations (recommendations)
 *   매장 상세 보기       → remoteWrites.markRecommendationOpened POST /ai/recommendations/{id}/shops/{shopId}/open
 *
 * 스토어 actions ↔ 함수 ↔ 서버 경로
 * - 앱 시작               → remoteReads.restoreSession     GET /members/me (auth, 저장된 토큰이 있을 때)
 * - 회원 데이터(로그인 뒤) → remoteReads.myLedger           GET /members/me/ramen-logs/summary (ramenLogs)
 *                        → remoteReads.myLogs             GET /members/me/ramen-logs (커서, ramenLogs)
 *                        → remoteReads.bookmarkedShops    GET /members/me/bookmarked-shops (shops+auth)
 *                        → remoteReads.blockedMembers     GET /members/me/blocks (lounge+auth)
 * - signIn                → remoteWrites.signIn            POST /auth/oauth/login (auth)
 * - completeOnboarding    → remoteWrites.completeOnboarding PUT /members/me/onboarding (+ PATCH /members/me)
 * - agreeToConsents       → remoteWrites.agreeToConsents   PUT /members/me/consents
 * - updateProfile         → remoteWrites.updateProfile     PATCH /members/me (member)
 * - logout                → remoteWrites.signOut           POST /auth/logout
 * - withdraw              → remoteWrites.withdraw          POST /members/me/withdrawal
 * - toggleBookmark        → remoteWrites.toggleBookmark    PUT|DELETE /shops/{id}/bookmark (shops+auth)
 * - createLog             → remoteWrites.createRamenLog    POST /files/upload-tickets → 저장소 업로드 → POST /ramen-logs (ramenLogs)
 * - updateLog             → remoteWrites.updateRamenLog    PATCH /ramen-logs/{id} (ramenLogs)
 * - deleteLog             → remoteWrites.deleteRamenLog    DELETE /ramen-logs/{id} (ramenLogs)
 * - toggleLogLike         → remoteWrites.toggleLogLike     PUT|DELETE /ramen-logs/{id}/like (lounge+auth)
 * - addLogComment         → remoteWrites.addLogComment     POST /ramen-logs/{id}/comments (lounge+auth)
 * - deleteLogComment      → remoteWrites.deleteLogComment  DELETE /ramen-log-comments/{id} (lounge+auth)
 * - reportContent         → remoteWrites.reportContent     POST /reports (lounge+auth)
 * - hideAuthor·unhideAuthor → remoteWrites.hideAuthor·unhideAuthor PUT|DELETE /members/{id}/block (lounge+auth)
 */

export interface RemotePage<T> {
  items: T[]
  nextCursor: string | null
  hasNext: boolean
}

function toPage<TWire, TApp>(page: CursorPage<TWire>, map: (item: TWire) => TApp): RemotePage<TApp> {
  return { items: (page.items ?? []).map(map), nextCursor: page.nextCursor ?? null, hasNext: Boolean(page.hasNext) }
}

/** 내 기록 한 쪽(서버 최대 50) */
export const MY_LOG_PAGE_SIZE = 50
const BOOKMARK_PAGE_SIZE = 50
/** 찜 목록을 끝까지 읽되, 커서가 끝나지 않는 서버를 만나도 멈추게 */
const MAX_BOOKMARK_PAGE_READS = 40

/** 내 기록 요약(GET /members/me/ramen-logs/summary)을 화면 계산용으로 바꾼 값 */
export interface RemoteLedger {
  /** 캘린더·방문 매장·월별 분포용 그릇(최신순) */
  bowls: DemoBowl[]
  /** 취향·리포트 계산용 기록(사진·메모·맛 태그 없음) */
  logs: RamenLog[]
  /** 재방문 의사가 있는 그릇 수(프로필) */
  revisitCount: number
}

let tasteNoteFieldsRequest: Promise<TasteNoteField[]> | null = null

/** 서버가 숨긴 항목만 읽힌 페이지도 다음 커서로 몇 묶음 더 찾아본다. */
const MAX_FILTERED_PAGE_READS = 5

async function readVisiblePage<TWire, TApp>(
  read: (cursor: string | null) => Promise<CursorPage<TWire>>,
  initialCursor: string | null,
  map: (item: TWire) => TApp,
): Promise<RemotePage<TApp>> {
  let cursor = initialCursor
  for (let reads = 0; ; reads++) {
    const page = await read(cursor)
    if (page.items?.length || !page.hasNext || reads === MAX_FILTERED_PAGE_READS - 1) return toPage(page, map)
    // 잘못된 커서를 반복하면 호출자가 같은 빈 페이지를 계속 요청하지 않게 멈춘다.
    if (!page.nextCursor || page.nextCursor === cursor) return { items: [], nextCursor: null, hasNext: false }
    cursor = page.nextCursor
  }
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

export interface RemoteLoungeLogDetail {
  log: RamenLog
  comments: RamenLogComment[]
  commentCount: number
  nextCursor: string | null
  hasNext: boolean
}

export const remoteReads = {
  /** 매장 목록. 커서 페이지라서 화면은 이어 붙이며 보여준다 */
  async shops(params: ShopListParams = {}): Promise<RemotePage<Shop>> {
    return toPage(await shopApi.list(params), toAppShopSummary)
  },

  /** 지도와 목록의 전체 매장. 좌표 없는 매장도 목록에는 남겨 둔다. */
  async mapShops(params: ShopMapParams = {}): Promise<Shop[]> {
    return (await shopApi.map(params)).map(toAppShopSummary)
  },

  /** 매장 하나. 없으면 null */
  async shop(shopId: string): Promise<Shop | null> {
    const detail = await orNull(shopApi.detail(shopId))
    return detail ? toAppShopDetail(detail) : null
  },

  /** 찜한 매장 전부(최근 찜한 순). 내 찜 화면은 검색·개수를 보여주므로 끝까지 읽는다 */
  async bookmarkedShops(): Promise<Shop[]> {
    const shops: Shop[] = []
    let cursor: string | null = null
    for (let reads = 0; reads < MAX_BOOKMARK_PAGE_READS; reads++) {
      const page: CursorPage<ShopSummary> = await memberApi.bookmarkedShops({ cursor, size: BOOKMARK_PAGE_SIZE })
      shops.push(...(page.items ?? []).map(toAppShopSummary))
      if (!page.hasNext || !page.nextCursor || page.nextCursor === cursor) break
      cursor = page.nextCursor
    }
    return shops
  },

  /** 내 기록(방문일 최신순, 비공개 포함). 사진·메모가 있는 목록이다. ramenType을 주면 그 종류만 */
  async myLogs(cursor?: string | null, size = MY_LOG_PAGE_SIZE, ramenType?: string): Promise<RemotePage<RamenLog>> {
    return toPage(await memberApi.myRamenLogs({ cursor, size, ramenType }), (log: RamenLogSummary) => toAppRamenLog(log))
  },

  /**
   * 내가 먹은 모든 그릇(최신 2000개, 페이지 없음). 캘린더·방문 매장·월별·취향 계산이 이 목록 하나에서 나온다.
   * 웹에서 옮겨 온 기록(점수 없음)도 들어 있다.
   */
  async myLedger(): Promise<RemoteLedger> {
    const items = await memberApi.myRamenLogSummary()
    return { bowls: toAppBowls(items), logs: items.map(toAppLedgerLog), revisitCount: revisitCountOf(items) }
  },

  /** 기록 하나(내 비공개 기록도 토큰이 있으면 읽힌다). 없으면 null */
  async log(logId: string): Promise<RamenLog | null> {
    const detail = await orNull(ramenLogApi.get(logId))
    return detail ? toAppRamenLog(detail) : null
  },

  /** 내가 숨긴(차단한) 사람들. 최근에 숨긴 순 */
  async blockedMembers(): Promise<HiddenAuthor[]> {
    return (await memberApi.blocks()).map((member) => ({
      id: member.id,
      name: member.nickname ?? WITHDRAWN_AUTHOR_NAME,
      avatar: member.avatarUrl ?? null,
    }))
  },

  /**
   * 맛 노트 보기(서버가 정한 코드·이름표). 한 번 읽어 앱 변환표에 적용하고 그 보기를 돌려준다.
   * 실패하면 다음에 다시 읽는다(그동안은 앱에 넣어 둔 같은 목록을 쓴다).
   */
  tasteNoteFields(): Promise<TasteNoteField[]> {
    tasteNoteFieldsRequest ??= ramenLogApi
      .tasteNoteDefinitions()
      .then(applyTasteNoteDefinitions)
      .catch((error: unknown) => {
        tasteNoteFieldsRequest = null
        throw error
      })
    return tasteNoteFieldsRequest
  },

  /** 라운지 피드. 차단·신고로 빈 쪽이 오면 다음 커서를 이어 읽는다 */
  async loungeLogs({ type, sort = "latest", cursor, size }: LoungeFeedRequest = {}): Promise<RemotePage<RamenLog>> {
    return readVisiblePage(
      (nextCursor) => loungeApi.feed({
        sort: LOUNGE_SORT_TO_WIRE[sort],
        ramenType: !type || type === LOUNGE_ALL_TYPES ? undefined : type,
        cursor: nextCursor,
        size,
      }),
      cursor ?? null,
      toAppRamenLog,
    )
  },

  /** 상세 응답의 댓글 미리보기(최대 20개). 다음 쪽은 커서로 별도 요청한다 */
  async loungeLog(logId: string): Promise<RemoteLoungeLogDetail | null> {
    const detail = await orNull(ramenLogApi.get(logId))
    if (!detail) return null
    const log = toAppRamenLog(detail)
    return {
      log,
      comments: log.comments ?? [],
      commentCount: detail.commentCount,
      nextCursor: detail.commentsNextCursor,
      hasNext: detail.commentsNextCursor !== null,
    }
  },

  /** 상세 미리보기 뒤의 댓글 페이지. 걸러진 빈 쪽은 다음 커서를 이어 읽는다 */
  async loungeLogComments(logId: string, cursor: string | null, size?: number): Promise<RemotePage<RamenLogComment>> {
    return readVisiblePage(
      (nextCursor) => loungeApi.comments(logId, { cursor: nextCursor, size }),
      cursor,
      toAppRamenLogComment,
    )
  },

  /** member remote로 연결할 때만 화면에서 디바운스해 호출한다 */
  async nicknameAvailability(nickname: string): Promise<boolean> {
    const result = await memberApi.nicknameAvailability(nickname)
    return result.available
  },

  /**
   * 저장된 토큰으로 로그인 상태를 되살린다. 토큰이 없으면 null.
   * 온보딩 중인 회원은 내 기록 요약을 읽을 수 없으므로(403) 회원 정보만 읽는다.
   */
  async restoreSession(): Promise<AppMember | null> {
    if (!(await tokenStore.get())) return null
    return remoteReads.me(false)
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
  ): Promise<{ recommendationId: string | null; shops: Shop[]; appliedConditions: string[]; reasons: Record<string, string> }> {
    const result = await recommendationApi.recommend(request)
    // 식권이 한 장 늘었다. 지난 식권 목록을 다시 읽게 한다
    if (result.recommendationId) remoteCache.invalidate(TICKET_HISTORY_KEY)
    return {
      recommendationId: result.recommendationId ?? null,
      shops: (result.shops ?? []).map(toAppShopSummary),
      appliedConditions: result.appliedConditions ?? [],
      reasons: result.reasons ?? {},
    }
  },

  /** 오늘 뽑은 식권(최신순)과 남은 장수 */
  async recommendationTickets(): Promise<RemoteTodayTickets> {
    const today = await recommendationApi.todayTickets()
    return {
      dailyLimit: today.dailyLimit,
      remaining: today.remaining,
      tickets: (today.tickets ?? []).map(toRemoteTicket),
    }
  },

  /** 지금까지 뽑은 식권 한 쪽(오늘 포함, 최신순). 받은 식권은 큐레이터가 id로 다시 열 수 있게 캐시에 둔다 */
  async recommendationHistory(cursor?: string): Promise<RemotePage<RemoteTicket>> {
    const page = toPage(await recommendationApi.history({ cursor, size: TICKET_HISTORY_PAGE_SIZE }), toRemoteTicket)
    for (const ticket of page.items) remoteCache.put(ticketKey(ticket.id), ticket)
    return page
  },
} as const

/** 지난 식권 한 쪽. 하루 3장이라 일주일치쯤 */
export const TICKET_HISTORY_PAGE_SIZE = 20

function toRemoteTicket(ticket: RecommendationTicket): RemoteTicket {
  return {
    id: ticket.recommendationId,
    createdAt: ticket.createdAt,
    shops: (ticket.shops ?? []).map(toAppShopSummary),
    appliedConditions: ticket.appliedConditions ?? [],
    reasons: ticket.reasons ?? {},
  }
}

/** 지난 식권 목록에서 받아 둔 식권. 큐레이터가 ?ticket=id로 열 때 오늘 식권에 없으면 여기서 찾는다 */
export function knownTicket(id: string): RemoteTicket | null {
  const entry = remoteCache.get(ticketKey(id))
  return entry && "value" in entry ? (entry.value as RemoteTicket) : null
}

export interface RemoteTicket {
  id: string
  /** ISO 시각 */
  createdAt: string
  shops: Shop[]
  appliedConditions: string[]
  reasons: Record<string, string>
}

export interface RemoteTodayTickets {
  dailyLimit: number
  remaining: number
  /** 최신순 */
  tickets: RemoteTicket[]
}

export interface CreateRamenLogOptions {
  /** 로그인한 계정 id. 주면 보낸 요청을 아웃박스에 남겨 실패한 저장을 같은 키로 다시 보낼 수 있다 */
  accountId?: string
  /** 초안 키 = Idempotency-Key. 한 초안은 몇 번을 다시 저장해도(내용을 고쳐도) 같은 키를 쓴다 */
  draftKey: string
}

export interface CreateCommentOptions {
  /** 로그인한 계정 id. 주면 실패한 댓글을 같은 Idempotency-Key로 다시 보낼 수 있다 */
  accountId?: string
  /** 댓글 초안 하나에 하나인 Idempotency-Key. 재시도하면서 내용을 고쳐도 같은 키를 쓴다 */
  draftKey: string
}

/**
 * 다시 보낸 요청이 "이미 처리됨"이었다(#60). 서버에 이미 반영됐거나 대상이 사라졌으니
 * 화면은 실패로 다루지 말고 최신 상태를 다시 읽는다.
 * - 기록 저장 409: 이 초안 키로 만든 기록을 이미 지웠다
 * - 댓글 409: 이 키로 단 댓글을 이미 지웠다
 */
export class AlreadyHandledError extends Error {
  constructor(message: string, readonly cause: unknown) {
    super(message)
    this.name = "AlreadyHandledError"
  }
}

/** 화면에 보여줄 쓰기 실패 문구. 서버 문구가 있으면 쓰고, 연결 문제는 앱 문구로 바꾼다 */
export function writeErrorMessage(error: unknown, fallback: string): string {
  if (!isApiError(error)) return t(error instanceof Error && error.message ? error.message : fallback)
  if (error.isOffline) return t("연결을 확인한 뒤 다시 시도해 주세요.")
  if (error.status === 401) return t("로그인이 끝났어요. 다시 로그인해 주세요.")
  if (error.code === "RATE_LIMITED" || error.code === "VALIDATION_ERROR") return error.message || t(fallback)
  if (error.code === "RESOURCE_NOT_FOUND") return t("이미 삭제됐거나 볼 수 없는 글이에요.")
  if (error.code === "FORBIDDEN") return t("내가 쓴 글만 고치거나 지울 수 있어요.")
  return t(fallback)
}

export interface CompleteOnboardingInput extends OnboardingRequest {
  profile?: Pick<ProfileUpdateInput, "bio" | "favoriteRamenType" | "avatar">
}

/** PUT은 끝났다. 화면은 온보딩을 다시 제출하지 말고 회원을 유지한 채 프로필만 다시 저장한다. */
export class OnboardingProfileUpdateError extends Error {
  readonly onboardingCompleted = true

  constructor(readonly member: AppMember, readonly cause: unknown) {
    super("가입은 완료됐지만 추가 프로필을 저장하지 못했어요.")
    this.name = "OnboardingProfileUpdateError"
  }
}

/**
 * 지금 앱이 보여주는 약관·처리방침 버전에 대한 동의. 필수 둘은 항상 동의로 보낸다(서버는 철회를 받지 않는다).
 * 마케팅 수신은 따로 문서가 없어 수신 동의 문구가 있는 개인정보처리방침의 버전을 쓴다.
 */
export function currentConsentDecisions(marketing: boolean): ConsentDecision[] {
  const privacyVersion = legalDocumentVersion("privacy")
  return [
    { type: "TERMS", documentVersion: legalDocumentVersion("terms"), granted: true },
    { type: "PRIVACY", documentVersion: privacyVersion, granted: true },
    { type: "MARKETING", documentVersion: privacyVersion, granted: marketing },
  ]
}

/**
 * 온보딩 PUT. 같은 요청을 다시 보내 409가 오면 회원을 다시 읽는다.
 * 이미 ACTIVE면 앞선 요청이 성공한 것이니 그 회원으로 이어 가고, 아니면 닉네임 충돌이니 오류를 그대로 올린다.
 */
async function onboardOnce(body: OnboardingRequest): Promise<MemberMe> {
  try {
    return await memberApi.onboarding(body)
  } catch (error) {
    if (!isApiError(error, "CONFLICT")) throw error
    const current = await memberApi.me()
    if (current.status !== "ACTIVE") throw error
    return current
  }
}

export const remoteWrites = {
  /** 제공자 자격 증명으로 로그인한다. 토큰은 authApi가 키체인에 넣는다 */
  async signIn(credential: OauthLoginRequest): Promise<AppMember> {
    const result = await authApi.oauthLogin(credential)
    return toAppMember(result.member)
  },

  /** 서버 로그아웃. 실패해도 기기의 토큰은 지워진다(authApi.logout) */
  async signOut(): Promise<void> {
    await authApi.logout()
  },

  /** 서버 추천 결과에서 매장을 열었다고 알린다. 추천 성과 집계용이라 실패해도 화면은 그대로 둔다 */
  async markRecommendationOpened(recommendationId: string, shopId: string): Promise<void> {
    await recommendationApi.markOpened(recommendationId, shopId)
  },

  /**
   * 기기에 남은 계정 흔적을 지운다: 토큰과 그 계정이 보내다 만 요청(아웃박스).
   * 세션이 끝났거나 로그아웃·탈퇴한 뒤에 부른다. 여러 번 불러도 된다.
   */
  async forgetAccount(accountId: string | null): Promise<void> {
    await Promise.all([tokenStore.clear(), accountId ? idempotencyOutbox.clearAccount(accountId) : undefined])
  },

  /** 탈퇴 요청. 확인 문구는 앱이 채운다. 서버가 모든 토큰을 끊으므로 기기 토큰도 지운다 */
  async withdraw(): Promise<void> {
    await memberApi.withdraw({ reasonCode: "OTHER", confirmation: "WITHDRAW" })
    await tokenStore.clear()
  },

  /** 현재 약관·처리방침 동의(웹에서 옮긴 회원, 문서 개정 뒤) */
  async agreeToConsents(marketing: boolean): Promise<AppMember> {
    return toAppMember(await memberApi.consents({ consents: currentConsentDecisions(marketing) }))
  },

  async completeOnboarding({ nickname, consents, profile }: CompleteOnboardingInput): Promise<AppMember> {
    const member = toAppMember(await onboardOnce({ nickname, consents }))
    const extras: ProfileUpdateInput = {}
    if (profile?.favoriteRamenType) extras.favoriteRamenType = profile.favoriteRamenType
    if (profile?.bio?.trim()) extras.bio = profile.bio.trim()
    if (profile?.avatar) extras.avatar = profile.avatar
    if (!extras.favoriteRamenType && !extras.bio && !extras.avatar) return member

    try {
      return await remoteWrites.updateProfile(extras)
    } catch (cause) {
      throw new OnboardingProfileUpdateError(member, cause)
    }
  },

  /** 찜·찜 해제. 둘 다 여러 번 보내도 결과가 같다 */
  async toggleBookmark(shopId: string, saved: boolean): Promise<void> {
    await (saved ? shopApi.bookmark(shopId) : shopApi.removeBookmark(shopId))
  },

  /**
   * 기록 저장: (아직 안 올린) 사진 업로드 → 생성. Idempotency-Key는 초안 키다.
   * - 다시 저장하면 같은 키로 보내고, 이미 올린 사진은 다시 올리지 않는다
   * - 앞선 요청이 서버에 닿았으면 서버는 그때 만든 기록을 돌려준다. 그 뒤에 고친 내용은 PATCH로 맞춘다
   * - 409(이 키로 만든 기록을 이미 지웠다)는 AlreadyHandledError
   */
  async createRamenLog(input: CreateRamenLogInput, { accountId, draftKey }: CreateRamenLogOptions): Promise<RamenLog> {
    const pending = accountId ? await idempotencyOutbox.find(accountId, "CREATE_RAMEN_LOG", draftKey) : null
    const photos = input.photos ?? []
    const uploads = await uploadNewPhotos(photos, pending?.uploads)
    const body = toCreateRamenLogBody(input, { imageUrls: photos.map((uri) => uploads[uri] ?? uri) })
    if (accountId) {
      if (pending) await idempotencyOutbox.revise(pending.key, { body, uploads })
      else {
        await idempotencyOutbox.begin({
          accountId,
          operation: "CREATE_RAMEN_LOG",
          path: "/ramen-logs",
          fingerprint: draftKey,
          key: draftKey,
          body,
          uploads,
        })
      }
    }

    let detail: RamenLogDetail
    try {
      detail = await ramenLogApi.create(body, { idempotencyKey: pending?.key ?? draftKey })
      if (pending && differsFromDetail(body, detail)) {
        const { shopId: _shopId, ...changes } = body
        detail = await ramenLogApi.update(detail.id, changes)
      }
    } catch (error) {
      const handled = isApiError(error, "CONFLICT")
      if (accountId && (handled || isPermanentFailure(error))) await idempotencyOutbox.complete(pending?.key ?? draftKey)
      if (handled) throw new AlreadyHandledError("이 기록은 이미 저장했다가 지웠어요. 다시 저장하면 새 기록으로 남겨요.", error)
      throw error
    }
    if (accountId) await idempotencyOutbox.complete(pending?.key ?? draftKey)
    return toAppRamenLog(detail)
  },

  /** 기록 고치기(가게는 바꿀 수 없다). 새로 고른 사진만 올리고, 이미 올라간 사진 주소는 그대로 보낸다 */
  async updateRamenLog(logId: string, input: CreateRamenLogInput): Promise<RamenLog> {
    const photos = input.photos ?? []
    const uploads = await uploadNewPhotos(photos)
    const { shopId: _shopId, ...changes } = toCreateRamenLogBody(input, {
      imageUrls: photos.map((uri) => uploads[uri] ?? uri),
    })
    return toAppRamenLog(await ramenLogApi.update(logId, changes))
  },

  /** 기록 삭제. 이미 지운 기록(404)은 처리된 것으로 본다 */
  async deleteRamenLog(logId: string): Promise<void> {
    await orNull(ramenLogApi.remove(logId))
  },

  /** 공감. 서버가 바뀐 공감 수를 돌려주므로 화면은 그 값으로 맞춘다 */
  async toggleLogLike(logId: string, liked: boolean): Promise<{ liked: boolean; likeCount: number }> {
    return liked ? loungeApi.like(logId) : loungeApi.unlike(logId)
  },

  /**
   * 댓글 작성(답글은 없다). 409(이 키로 단 댓글을 이미 지웠다)는 AlreadyHandledError.
   * 응답이 끊긴 뒤 내용을 고쳐 다시 보내도 초안 키가 같아 댓글이 두 개 생기지 않는다.
   * 첫 요청이 서버에 닿지 못했으면 고친 내용이 남고, 닿았으면 처음 내용이 남는다(댓글은 수정 API가 없다).
   */
  async addLogComment(logId: string, input: CreateRamenLogCommentInput, { accountId, draftKey }: CreateCommentOptions): Promise<RamenLogComment> {
    const body = { content: input.content.trim() }
    const pending = accountId ? await idempotencyOutbox.find(accountId, "CREATE_COMMENT", draftKey) : null
    if (pending) await idempotencyOutbox.revise(pending.key, { body })
    try {
      const comment = await loungeApi.createComment(logId, body, { accountId, fingerprint: draftKey, idempotencyKey: draftKey })
      return toAppRamenLogComment(comment)
    } catch (error) {
      if (isApiError(error, "CONFLICT")) throw new AlreadyHandledError("이미 처리된 댓글이에요. 댓글을 새로 불러왔어요.", error)
      throw error
    }
  },

  /** 내 댓글 삭제. 이미 지운 댓글(404)은 처리된 것으로 본다 */
  async deleteLogComment(commentId: string): Promise<void> {
    await orNull(loungeApi.deleteComment(commentId))
  },

  /** 신고. 같은 대상을 다시 신고해도 성공이다 */
  async reportContent(input: {
    kind: ContentReport["kind"]
    id: string
    reason: ContentReportReason
  }): Promise<void> {
    await loungeApi.report({
      targetType: input.kind === "log" ? "RAMEN_LOG" : "RAMEN_LOG_COMMENT",
      targetId: input.id,
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

  /** 프로필 수정. 사진은 먼저 올리고 주소를 보낸다 */
  async updateProfile(input: ProfileUpdateInput): Promise<AppMember> {
    const avatarUrl = await uploadedAvatarUrl(input)
    return toAppMember(await memberApi.updateMe(toUpdateMemberBody(input, avatarUrl)))
  },
} as const

/** 아직 올리지 않은 기기 사진만 올린다. 이미 올린 사진(이전 시도)과 서버 주소는 그대로 둔다. 기기 URI → 올린 주소 */
async function uploadNewPhotos(photos: readonly string[], uploaded: Record<string, string> = {}): Promise<Record<string, string>> {
  const kept = Object.fromEntries(photos.filter((uri) => uploaded[uri]).map((uri) => [uri, uploaded[uri]]))
  const fresh = photos.filter((uri) => !kept[uri] && !/^https?:\/\//i.test(uri))
  const urls = await fileApi.uploadImages("RAMEN_LOG", fresh)
  fresh.forEach((uri, index) => {
    kept[uri] = urls[index]
  })
  return kept
}

/** 같은 키로 다시 보냈을 때 서버가 돌려준 기록이 이번 본문과 다른가(앞선 시도의 내용이 저장돼 있다) */
function differsFromDetail(body: CreateRamenLogRequest, detail: RamenLogDetail): boolean {
  const sent = {
    visitedAt: body.visitedAt,
    menuName: body.menuName,
    ramenType: body.ramenType,
    scores: body.scores,
    revisitIntention: body.revisitIntention,
    note: body.note,
    tasteNoteCodes: [...body.tasteNoteCodes].sort(),
    visibility: body.visibility,
    imageUrls: body.imageUrls,
  }
  const saved = {
    visitedAt: detail.visitedAt,
    menuName: detail.menuName,
    ramenType: detail.ramenType,
    scores: detail.scores
      ? {
          satisfaction: detail.scores.satisfaction,
          brothDensity: detail.scores.brothDensity,
          noodleFirmness: detail.scores.noodleFirmness,
          topping: detail.scores.topping,
        }
      : null,
    revisitIntention: detail.revisitIntention,
    note: detail.note ?? "",
    tasteNoteCodes: [...(detail.tasteNoteCodes ?? [])].sort(),
    visibility: detail.visibility,
    imageUrls: detail.imageUrls ?? [],
  }
  return fingerprintOf(sent) !== fingerprintOf(saved)
}

/** 고른 사진은 업로드하고, URL은 그대로 보내며, 삭제는 서버에 빈 문자열로 보낸다 */
async function uploadedAvatarUrl(input: ProfileUpdateInput): Promise<string | null | undefined> {
  if (input.avatar === undefined) return undefined
  if (input.avatar === null || input.avatar === "") return null
  if (/^https?:\/\//i.test(input.avatar)) return input.avatar
  return (await fileApi.uploadImages("PROFILE", [input.avatar]))[0] ?? null
}

/**
 * 토큰이 무효화되면(다른 기기에서 로그아웃·탈퇴, refresh 재사용) 알림이 온다.
 * 스토어가 이걸 받아 로컬 로그인 상태를 내린다. remote 모드가 아니면 아무 일도 일어나지 않는다.
 */
export function subscribeSessionEndedToLogout(logout: () => void): () => void {
  return subscribeSessionEnded(() => logout())
}
