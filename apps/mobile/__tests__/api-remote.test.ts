import { remoteReads, remoteWrites, subscribeSessionEndedToLogout } from "@/src/data/remote"

/**
 * 서버로 옮길 때 쓸 자리(src/data/remote.ts)가 실제로 굴러가는지 본다.
 * 화면은 아직 이 파일을 쓰지 않아서(기본값 mock) 여기서 한 번은 불러 봐야
 * 모듈 연결(api/index → endpoints → adapters)과 전역 fetch 호출이 맞는지 확인할 수 있다.
 */
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

let fetchMock: jest.Mock

beforeEach(() => {
  fetchMock = jest.fn(async () => success({ items: [wireShop], nextCursor: "c2", hasNext: true }))
  ;(globalThis as { fetch: unknown }).fetch = fetchMock
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
    expect(page.items[0]).toMatchObject({ id: 7, name: "하쿠텐", branch: "연남점", reviewCount: 128 })
  })

  it("hook마다 대응하는 함수가 준비돼 있다", () => {
    for (const name of ["shops", "mapPins", "shop", "bookmarkedShops", "myLogs", "myBowls", "log", "loungeLogs", "loungeLog", "me", "todayCuration", "recommendations"] as const) {
      expect(typeof remoteReads[name]).toBe("function")
    }
    for (const name of ["toggleBookmark", "createRamenLog", "deleteRamenLog", "toggleLogLike", "addLogComment", "deleteLogComment", "reportContent", "hideAuthor", "unhideAuthor", "updateProfile"] as const) {
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
