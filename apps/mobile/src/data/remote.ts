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
import { legalDocumentVersion } from "@raota/shared"

import {
  authApi,
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
  tokenStore,
  toAppBowls,
  toAppMember,
  toAppRamenLog,
  toAppRamenLogComment,
  toAppShopDetail,
  toAppShopSummary,
  toCreateRamenLogBody,
  toUpdateMemberBody,
  revisitCountOf,
  type AppMember,
  type ConsentDecision,
  type CreateRamenLogRequest,
  type CursorPage,
  type LoungeSortParam,
  type MemberMe,
  type OauthLoginRequest,
  type OnboardingRequest,
  type RamenLogSummary,
  type ReportReason,
  type ShopListParams,
  type ShopMapParams,
} from "../api"
import { LOUNGE_ALL_TYPES, type LoungeSort } from "../domain/lounge"

/**
 * 서버 읽기/쓰기 함수. 공개 매장·라운지 읽기는 src/data/hooks.ts에서, 계정(로그인·온보딩·약관 동의·
 * 내 정보·로그아웃·탈퇴)은 스토어 actions(src/state/RaotaStore.tsx)에서 연결한다.
 * 기본값(mock)에서는 로컬 스토어만 사용한다.
 *
 * 현재 연결된 hook ↔ 함수 ↔ 서버 경로
 * - useShops             → remoteReads.shops             GET /shops (커서)
 * - useMapShops          → remoteReads.mapShops          GET /shops/map (전체 매장)
 * - useShop              → remoteReads.shop              GET /shops/{id}
 * - useTodayCuration     → remoteReads.todayCuration     GET /curations/today
 * - useLoungeLogs        → remoteReads.loungeLogs        GET /ramen-logs (커서)
 * - useLoungeLog         → remoteReads.loungeLog         GET /ramen-logs/{id}
 * - 댓글 다음 쪽         → remoteReads.loungeLogComments GET /ramen-logs/{id}/comments (커서)
 * - useNicknameAvailability → remoteReads.nicknameAvailability GET /members/nickname-availability (member)
 *
 * 스토어 actions ↔ 함수 ↔ 서버 경로(auth, 내 정보 수정은 member)
 * - 앱 시작               → remoteReads.restoreSession     GET /members/me (저장된 토큰이 있을 때)
 * - signIn                → remoteWrites.signIn            POST /auth/oauth/login
 * - completeOnboarding    → remoteWrites.completeOnboarding PUT /members/me/onboarding (+ PATCH /members/me)
 * - agreeToConsents       → remoteWrites.agreeToConsents   PUT /members/me/consents
 * - updateProfile         → remoteWrites.updateProfile     PATCH /members/me (member)
 * - logout                → remoteWrites.signOut           POST /auth/logout
 * - withdraw              → remoteWrites.withdraw          POST /members/me/withdrawal
 *
 * 회원 기록·찜·AI 추천·기록 쓰기 API는 화면/스토어에 연결하지 않았다.
 */

export interface RemotePage<T> {
  items: T[]
  nextCursor: string | null
  hasNext: boolean
}

function toPage<TWire, TApp>(page: CursorPage<TWire>, map: (item: TWire) => TApp): RemotePage<TApp> {
  return { items: (page.items ?? []).map(map), nextCursor: page.nextCursor ?? null, hasNext: Boolean(page.hasNext) }
}

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

  async log(logId: string): Promise<RamenLog | null> {
    const detail = await orNull(ramenLogApi.get(logId))
    return detail ? toAppRamenLog(detail) : null
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
  ): Promise<{ shops: Shop[]; appliedConditions: string[] }> {
    const result = await recommendationApi.recommend(request)
    return { shops: (result.shops ?? []).map(toAppShopSummary), appliedConditions: result.appliedConditions ?? [] }
  },
} as const

export interface CreateRamenLogOptions {
  /** 로그인한 계정 id. 주면 실패한 저장을 같은 Idempotency-Key로 다시 보낼 수 있다 */
  accountId?: string
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

  async toggleBookmark(shopId: string, saved: boolean): Promise<void> {
    await (saved ? shopApi.bookmark(shopId) : shopApi.removeBookmark(shopId))
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

  async deleteRamenLog(logId: string): Promise<void> {
    await ramenLogApi.remove(logId)
  },

  /** 공감. 서버가 바뀐 공감 수를 돌려주므로 화면은 그 값으로 맞춘다 */
  async toggleLogLike(logId: string, liked: boolean): Promise<{ liked: boolean; likeCount: number }> {
    return liked ? loungeApi.like(logId) : loungeApi.unlike(logId)
  },

  /** 댓글 작성(답글은 없다) */
  async addLogComment(
    logId: string,
    input: CreateRamenLogCommentInput,
    options: CreateRamenLogOptions = {},
  ): Promise<RamenLogComment> {
    const body = { content: input.content.trim() }
    const comment = await loungeApi.createComment(logId, body, {
      accountId: options.accountId,
      fingerprint: fingerprintOf({ operation: "CREATE_COMMENT", logId, body }),
    })
    return toAppRamenLogComment(comment)
  },

  async deleteLogComment(commentId: string): Promise<void> {
    await loungeApi.deleteComment(commentId)
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
