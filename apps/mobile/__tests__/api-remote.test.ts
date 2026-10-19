import type { MemberMe, RamenLogDetail } from "@/src/api/types"
import { tokenStore } from "@/src/api/tokens"
import { OnboardingProfileUpdateError, remoteReads, remoteWrites, subscribeSessionEndedToLogout, type CompleteOnboardingInput } from "@/src/data/remote"

/** 서버 읽기/쓰기 함수의 경로, 인증 및 화면용 변환을 테스트한다. */
function success<T>(data: T) {
  return {
    status: 200,
    ok: true,
    headers: { get: () => null },
    text: async () => JSON.stringify({ success: true, data, meta: { requestId: "req-remote" } }),
  }
}

const wireShop = {
  id: "7",
  name: "하쿠텐",
  branchName: "연남점",
  address: "서울 마포구 연남동",
  region: "마포구",
  latitude: 37.5612,
  longitude: 126.9255,
  imageUrl: null,
  tagline: "진한 요코하마식 이에케",
  ramenTypes: ["돈코츠"],
  tags: ["이에케"],
  logCount: 128,
  bookmarkCount: 31,
  isBookmarked: false,
  businessStatus: "OPERATIONAL",
  isOpen: true,
  distanceMeters: null,
}

const wireComment = {
  id: "201",
  logId: "101",
  author: { id: "12", nickname: "면탐험가", avatarUrl: null, logCount: 1 },
  content: "라면 좋아요",
  createdAt: "2026-09-18T12:00:00Z",
  isMine: false,
}

const wireLogDetail: RamenLogDetail = {
  id: "101",
  author: wireComment.author,
  shop: { id: "7", name: "하쿠텐", branchName: null, region: null },
  menuName: "쇼유 라멘",
  ramenType: "쇼유",
  visitedAt: "2026-09-18",
  imageUrls: [],
  note: "",
  tasteNoteCodes: [],
  revisitIntention: "OFTEN",
  visibility: "PUBLIC",
  scores: null,
  likeCount: 0,
  commentCount: 25,
  isLiked: false,
  isMine: false,
  createdAt: "2026-09-18T11:00:00Z",
  updatedAt: "2026-09-18T11:00:00Z",
  commentsPreview: [wireComment],
  commentsNextCursor: "page-2",
}

const wireMember: MemberMe = {
  id: "77",
  nickname: "라멘러버",
  email: null,
  avatarUrl: null,
  bio: null,
  favoriteRamenType: null,
  status: "ACTIVE",
  logCount: 0,
  onboardingCompletedAt: "2026-10-19T08:00:00Z",
}

const onboarding: CompleteOnboardingInput = {
  nickname: "라멘러버",
  consents: [{ type: "TERMS", documentVersion: "2026-10-19", granted: true }],
}

let fetchMock: jest.Mock

beforeEach(() => {
  fetchMock = jest.fn(async () => success({ items: [wireShop], nextCursor: "c2", hasNext: true }))
  ;(globalThis as { fetch: unknown }).fetch = fetchMock
})

afterEach(async () => {
  await tokenStore.clear()
})

describe("src/data/remote", () => {
  it("매장 목록을 서버에서 읽어 앱 Shop으로 돌려준다", async () => {
    const page = await remoteReads.shops({ sort: "POPULAR", size: 20 })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("/shops?sort=POPULAR&size=20")
    expect(init.method).toBe("GET")
    // 비회원도 볼 수 있는 읽기라 토큰 없이 나간다
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined()
    expect(page.nextCursor).toBe("c2")
    expect(page.items[0]).toMatchObject({ id: "7", name: "하쿠텐", branch: "연남점", reviewCount: 128 })
  })

  it("지도 전체 매장은 필터만 보내고 응답을 Shop[]으로 변환한다", async () => {
    fetchMock.mockResolvedValueOnce(success([wireShop, { ...wireShop, id: "8", name: "좌표 없음", latitude: null, longitude: null }]))
    const shops = await remoteReads.mapShops({ query: "566", sort: "POPULAR" })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("/shops/map?sort=POPULAR&query=566")
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined()
    expect(shops).toHaveLength(2)
    expect(shops[1]).toMatchObject({ name: "좌표 없음", lat: 0, lng: 0 })
  })

  it("상세 응답의 댓글 미리보기와 다음 커서만 쓰고 첫 댓글을 재요청하지 않는다", async () => {
    fetchMock.mockResolvedValueOnce(success(wireLogDetail))

    const detail = await remoteReads.loungeLog("101")

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toContain("/ramen-logs/101")
    expect(detail).toMatchObject({
      log: { id: "101", commentsNextCursor: "page-2" },
      comments: [{ id: "201", logId: "101", content: "라면 좋아요" }],
      commentCount: 25,
      nextCursor: "page-2",
      hasNext: true,
    })
  })

  it("댓글 다음 쪽은 상세 커서로 따로 이어 읽는다", async () => {
    fetchMock.mockResolvedValueOnce(success({ items: [wireComment], nextCursor: null, hasNext: false }))

    const page = await remoteReads.loungeLogComments("101", "page-2", 10)

    expect(fetchMock.mock.calls[0][0]).toContain("/ramen-logs/101/comments?cursor=page-2&size=10")
    expect(page).toMatchObject({ items: [{ id: "201" }], nextCursor: null, hasNext: false })
  })

  it("필터로 빈 피드는 다음 커서를 읽어 데이터 쪽을 돌려준다", async () => {
    fetchMock.mockResolvedValueOnce(success({ items: [], nextCursor: "filtered-2", hasNext: true }))
      .mockResolvedValueOnce(success({ items: [wireLogDetail], nextCursor: "visible-3", hasNext: true }))

    const page = await remoteReads.loungeLogs({ type: "쇼유", sort: "likes", size: 10 })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][0]).toContain(`cursor=filtered-2&size=10`)
    expect(page).toMatchObject({ items: [{ id: "101" }], nextCursor: "visible-3", hasNext: true })
  })

  it("빈 댓글을 넘어 다음 쪽을 돌려주고 연속 빈 쪽은 다섯 번만 읽는다", async () => {
    fetchMock.mockResolvedValueOnce(success({ items: [], nextCursor: "filtered-2", hasNext: true }))
      .mockResolvedValueOnce(success({ items: [wireComment], nextCursor: null, hasNext: false }))

    const visible = await remoteReads.loungeLogComments("101", "start")
    expect(visible).toMatchObject({ items: [{ id: "201" }], nextCursor: null, hasNext: false })
    expect(fetchMock).toHaveBeenCalledTimes(2)

    fetchMock.mockReset().mockImplementation(async () =>
      success({ items: [], nextCursor: `page-${fetchMock.mock.calls.length}`, hasNext: true }))
    const empty = await remoteReads.loungeLogComments("101", "page-0")
    expect(fetchMock).toHaveBeenCalledTimes(5)
    expect(empty).toEqual({ items: [], nextCursor: "page-5", hasNext: true })
  })

  it("추가 프로필이 없으면 닉네임·동의만 PUT하고 PATCH를 생략한다", async () => {
    await tokenStore.set({ accessToken: "a1", refreshToken: "r1" })
    fetchMock.mockResolvedValueOnce(success(wireMember))

    const member = await remoteWrites.completeOnboarding({ ...onboarding, profile: { avatar: null, bio: "" } })

    expect(member).toMatchObject({ onboardingCompleted: true, profile: { nickname: "라멘러버" } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("/members/me/onboarding")
    expect(init.method).toBe("PUT")
    expect(JSON.parse(String(init.body))).toEqual(onboarding)
  })

  it("선택 프로필만 이어서 PATCH하고 최종 회원을 돌려준다", async () => {
    await tokenStore.set({ accessToken: "a1", refreshToken: "r1" })
    fetchMock.mockResolvedValueOnce(success(wireMember))
      .mockResolvedValueOnce(success({ ...wireMember, avatarUrl: "https://cdn.test/avatar.png", bio: "소개", favoriteRamenType: "돈코츠" }))

    const member = await remoteWrites.completeOnboarding({
      ...onboarding,
      profile: { bio: " 소개 ", favoriteRamenType: "돈코츠", avatar: "https://cdn.test/avatar.png" },
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [, put] = fetchMock.mock.calls[0] as [string, RequestInit]
    const [patchUrl, patch] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(JSON.parse(String(put.body))).toEqual(onboarding)
    expect(patchUrl).toContain("/members/me")
    expect(patch.method).toBe("PATCH")
    expect(JSON.parse(String(patch.body))).toEqual({ bio: "소개", favoriteRamenType: "돈코츠", avatarUrl: "https://cdn.test/avatar.png" })
    expect(member.profile).toMatchObject({ bio: "소개", favoriteRamenType: "돈코츠", avatar: "https://cdn.test/avatar.png" })
  })

  it("PATCH 실패는 가입이 끝난 회원을 오류에 남겨 PUT 재제출을 막는다", async () => {
    await tokenStore.set({ accessToken: "a1", refreshToken: "r1" })
    fetchMock.mockResolvedValueOnce(success(wireMember)).mockResolvedValueOnce({
      status: 503,
      ok: false,
      headers: { get: () => null },
      text: async () => JSON.stringify({ success: false, error: { code: "INTERNAL_ERROR", message: "저장 실패" } }),
    })

    const error: unknown = await remoteWrites.completeOnboarding({ ...onboarding, profile: { bio: "소개" } })
      .catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(OnboardingProfileUpdateError)
    expect(error).toMatchObject({ onboardingCompleted: true, member: { onboardingCompleted: true, profile: { nickname: "라멘러버" } } })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("회원 remote 연결용 닉네임 중복 확인 결과를 읽는다", async () => {
    await tokenStore.set({ accessToken: "a1", refreshToken: "r1" })
    fetchMock.mockResolvedValueOnce(success({ available: false }))

    expect(await remoteReads.nicknameAvailability("AB_9")).toBe(false)
    expect(fetchMock.mock.calls[0][0]).toContain("/members/nickname-availability?nickname=AB_9")
  })

  it("hook마다 대응하는 함수가 준비돼 있다", () => {
    for (const name of ["shops", "mapShops", "shop", "bookmarkedShops", "myLogs", "myBowls", "log", "loungeLogs", "loungeLog", "loungeLogComments", "nicknameAvailability", "me", "todayCuration", "recommendations"] as const) {
      expect(typeof remoteReads[name]).toBe("function")
    }
    for (const name of ["completeOnboarding", "toggleBookmark", "createRamenLog", "deleteRamenLog", "toggleLogLike", "addLogComment", "deleteLogComment", "reportContent", "hideAuthor", "unhideAuthor", "updateProfile"] as const) {
      expect(typeof remoteWrites[name]).toBe("function")
    }
  })

  it("세션이 끝나면 스토어가 로그아웃하도록 붙일 수 있다", () => {
    const logout = jest.fn()
    const unsubscribe = subscribeSessionEndedToLogout(logout)

    expect(typeof unsubscribe).toBe("function")
    unsubscribe()
    expect(logout).not.toHaveBeenCalled()
  })
})
