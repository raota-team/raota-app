import { act, renderHook, waitFor } from "@testing-library/react-native"
import type { PropsWithChildren } from "react"

import { isRemote } from "@/src/api/config"
import { createInitialPersistedState, SHOPS } from "@/src/data/fixtures"
import { useAllShops, useLoungeLog, useLoungeLogs, useMapShops, useShop, useShops, useTodayCuration } from "@/src/data/hooks"
import { remoteCache } from "@/src/data/remoteCache"
import type { RaotaRepository } from "@/src/repository"
import { RaotaProvider } from "@/src/state/RaotaStore"

jest.mock("@/src/api/config", () => ({
  ...jest.requireActual("@/src/api/config"),
  isRemote: jest.fn(),
}))

const remoteSwitch = isRemote as jest.MockedFunction<typeof isRemote>
const repository: RaotaRepository = {
  load: jest.fn().mockResolvedValue({ ...createInitialPersistedState(), user: null, onboardingCompleted: false }),
  save: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
}
function wrapper({ children }: PropsWithChildren) {
  return <RaotaProvider repository={repository}>{children}</RaotaProvider>
}

function success(data: unknown) {
  return {
    status: 200,
    ok: true,
    headers: { get: () => null },
    text: async () => JSON.stringify({ success: true, data, meta: { requestId: "public-hook-test" } }),
  }
}

const wireShop = {
  id: "288", name: "566라멘", branchName: null, address: "서울 마포구 연남로3길 33", region: "마포구",
  latitude: 37.56, longitude: 126.92, imageUrl: null, tagline: "지로계 라멘",
  ramenTypes: ["기타"], tags: ["지로계"], logCount: 0, bookmarkCount: 0,
  isBookmarked: false, businessStatus: "OPERATIONAL", isOpen: null, distanceMeters: null,
}

let fetchMock: jest.Mock
beforeEach(() => {
  remoteSwitch.mockReturnValue(false)
  fetchMock = jest.fn()
  ;(globalThis as { fetch: unknown }).fetch = fetchMock
})

afterEach(() => {
  remoteSwitch.mockReset()
})

describe("public data hooks", () => {
  it("mock에서는 기존 매장을 동기로 돌려주고 네트워크를 호출하지 않는다", async () => {
    const { result } = await renderHook(() => useShops(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toBe(SHOPS)
    expect(result.current.hasMore).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("remote 기록·취향 화면의 전체 매장은 서버에만 있는 매장도 포함하고 지도와 같은 요청을 함께 쓴다", async () => {
    remoteSwitch.mockImplementation((domain) => domain === "shops")
    remoteCache.clear()
    fetchMock.mockResolvedValueOnce(success([{ ...wireShop, id: "10000001", name: "서버에만 있는 집" }]))
    const { result } = await renderHook(() => ({ all: useAllShops(), map: useMapShops() }), { wrapper })
    await waitFor(() => expect(result.current.all.data.map((shop) => shop.name)).toEqual(["서버에만 있는 집"]))
    expect(result.current.map.data).toEqual(result.current.all.data)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("지도와 목록은 같은 전체 매장을 쓰며 좌표 없는 매장도 목록에 남긴다", async () => {
    remoteSwitch.mockImplementation((domain) => domain === "shops")
    fetchMock.mockResolvedValueOnce(success([
      wireShop,
      { ...wireShop, id: "missing-location", name: "좌표 없음", latitude: null, longitude: null },
    ]))
    const { result } = await renderHook(() => useMapShops({ query: "566", ramenType: "기타" }), { wrapper })
    await waitFor(() => expect(result.current.data.map((shop) => shop.name)).toEqual(["566라멘", "좌표 없음"]))
    expect(result.current.data[1]).toMatchObject({ id: "missing-location", lat: 0, lng: 0 })
    expect(fetchMock.mock.calls[0][0]).toContain("/shops/map?query=566&ramenType=")
    expect(fetchMock.mock.calls[0][0]).not.toMatch(/cursor=|size=/)
  })

  it("mock 지도 목록은 기존 전체 원장으로 유지하며 네트워크에 접속하지 않는다", async () => {
    const { result } = await renderHook(() => useMapShops({ query: "566" }), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toBe(SHOPS)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("remote 매장 목록은 커서 요청 후 다음 페이지를 이어 붙이고 중복 ID를 없앤다", async () => {
    remoteSwitch.mockImplementation((domain) => domain === "shops")
    fetchMock.mockResolvedValueOnce(success({ items: [wireShop], nextCursor: "second", hasNext: true }))
      .mockResolvedValueOnce(success({ items: [wireShop, { ...wireShop, id: "289", name: "라멘롱시즌" }], nextCursor: null, hasNext: false }))

    const { result } = await renderHook(() => useShops({ query: "hook-page-test" }), { wrapper })
    expect(result.current.data.every((shop) => shop.id !== "7")).toBe(true)
    await waitFor(() => expect(result.current.data.map((shop) => shop.name)).toEqual(["566라멘"]))
    expect(result.current.hasMore).toBe(true)
    await act(async () => { result.current.loadMore() })
    await waitFor(() => expect(result.current.data.map((shop) => shop.name)).toEqual(["566라멘", "라멘롱시즌"]))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][0]).toContain("query=hook-page-test&cursor=second&size=20")
    expect(result.current.hasMore).toBe(false)
  })

  it("첫 페이지 실패는 데모 매장으로 대체하지 않고 오류를 보여준다", async () => {
    remoteSwitch.mockImplementation((domain) => domain === "shops")
    fetchMock.mockResolvedValueOnce({
      status: 400, ok: false, headers: { get: () => null },
      text: async () => JSON.stringify({ success: false, error: { code: "BAD_REQUEST", message: "서버가 매장 요청을 거절했어요" } }),
    })
    const { result } = await renderHook(() => useShops({ query: "hook-error-test" }), { wrapper })
    await waitFor(() => expect(result.current.error).toBe("서버가 매장 요청을 거절했어요"))
    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toEqual([])
  })

  it("검색 키가 바뀌면 오래된 응답을 무시한다", async () => {
    remoteSwitch.mockImplementation((domain) => domain === "shops")
    const oldResponse = Promise.withResolvers<ReturnType<typeof success>>()
    fetchMock.mockImplementationOnce(() => oldResponse.promise)
      .mockResolvedValueOnce(success({ items: [{ ...wireShop, id: "299", name: "새 검색 결과" }], nextCursor: null, hasNext: false }))
    const { result, rerender } = await renderHook(({ query }: { query: string }) => useShops({ query }), { wrapper, initialProps: { query: "old-hook-key" } })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await rerender({ query: "new-hook-key" })
    await waitFor(() => expect(result.current.data[0]?.name).toBe("새 검색 결과"))
    await act(async () => oldResponse.resolve(success({ items: [wireShop], nextCursor: null, hasNext: false })))
    expect(result.current.data.map((shop) => shop.name)).toEqual(["새 검색 결과"])
  })

  it("오늘의 픽이 null이면 로컬 매장을 가장하지 않고, 상세에서는 서버 매장을 읽는다", async () => {
    remoteSwitch.mockImplementation((domain) => domain === "shops")
    fetchMock.mockImplementation(async (url: string) => success(url.includes("curations") ? null : {
      ...wireShop, description: "진한 한 그릇", phone: null, instagramUrl: null, reservationUrl: null,
      websiteUrl: null, naverPlaceId: null, kakaoPlaceId: null, priceMin: null, priceMax: null,
      closedDaysText: null, hoursVerifiedAt: null, images: [], businessHours: [], servicePerks: [],
      aiReviewSummary: null, aiSummaryKeywords: [], aiSummaryGeneratedAt: null,
    }))
    const { result } = await renderHook(() => ({ curation: useTodayCuration(), detail: useShop("288") }), { wrapper })
    await waitFor(() => expect(result.current.detail.data?.name).toBe("566라멘"))
    await waitFor(() => expect(result.current.curation.isLoading).toBe(false))
    expect(result.current.curation.data).toBeNull()
    expect(result.current.curation.remote).toBe(true)
  })

  it("라운지 상세의 댓글 미리보기 뒤에서만 다음 커서를 읽는다", async () => {
    remoteSwitch.mockImplementation((domain) => domain === "lounge")
    const author = { id: "13", nickname: "면탐험가", avatarUrl: null, logCount: 1 }
    const comment = { id: "201", logId: "301", author, content: "첫 댓글", createdAt: "2026-10-19T12:00:00Z", isMine: false }
    const log = {
      id: "301", author, shop: { id: "288", name: "566라멘", branchName: null, region: "마포구" },
      menuName: "지로 라멘", ramenType: "기타", visitedAt: "2026-10-19", imageUrls: [], note: "맛있어요",
      tasteNoteCodes: [], revisitIntention: "OFTEN", visibility: "PUBLIC", scores: null,
      likeCount: 0, commentCount: 2, isLiked: false, isMine: false,
      createdAt: "2026-10-19T11:00:00Z", updatedAt: "2026-10-19T11:00:00Z",
      commentsPreview: [comment], commentsNextCursor: "comments-second",
    }
    fetchMock.mockResolvedValueOnce(success(log))
      .mockResolvedValueOnce(success({ items: [{ ...comment, id: "202", content: "두 번째 댓글" }], nextCursor: null, hasNext: false }))
    const { result } = await renderHook(() => useLoungeLog("301"), { wrapper })
    await waitFor(() => expect(result.current.data?.comments).toHaveLength(1))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.current.data?.commentCount).toBe(2)
    await act(async () => { result.current.loadMoreComments() })
    await waitFor(() => expect(result.current.data?.comments.map((item) => item.content)).toEqual(["첫 댓글", "두 번째 댓글"]))
    expect(fetchMock.mock.calls[1][0]).toContain("cursor=comments-second")
    expect(result.current.hasMoreComments).toBe(false)
  })

  it("remote 라운지 빈 피드는 로컬 픽스처 대신 빈 목록을 반환한다", async () => {
    remoteSwitch.mockImplementation((domain) => domain === "lounge")
    fetchMock.mockResolvedValueOnce(success({ items: [], nextCursor: null, hasNext: false }))
    const { result } = await renderHook(() => useLoungeLogs({ type: "전체", sort: "latest" }), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data).toEqual([])
    expect(result.current.error).toBeNull()
  })
})
