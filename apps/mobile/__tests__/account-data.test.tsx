import { act, fireEvent, render, waitFor } from "@testing-library/react-native"
import type { CreateRamenLogInput, Shop } from "@raota/shared"
import { useEffect, useState } from "react"
import { Pressable, Text } from "react-native"

import type { MemberMe, RamenLogComment as WireComment, RamenLogDetail, RamenLogSummaryItem, ShopSummary } from "@/src/api/types"
import { idempotencyOutbox } from "@/src/api/outbox"
import { tokenStore } from "@/src/api/tokens"
import { toAppShopSummary } from "@/src/api/adapters"
import { createInitialPersistedState } from "@/src/data/fixtures"
import { useBookmarkedShops, useMyBowls, useMyLogs, useMyLogsOfType } from "@/src/data/hooks"
import { remoteCache } from "@/src/data/remoteCache"
import type { RaotaRepository } from "@/src/repository"
import { RaotaProvider, useRaota } from "@/src/state/RaotaStore"

/*
 * 서버 회원(모든 도메인 remote)의 내 데이터: 기록 저장 재시도, 찜 실패 되돌림, 로그아웃·계정 전환 때 비우기.
 * 서버는 fetch를 경로별로 흉내 내고, 토큰·아웃박스는 실제 구현을 쓴다.
 */

jest.mock("@/src/api/config", () => {
  const isRemote = jest.fn((_domain: string) => true)
  return {
    ...jest.requireActual("@/src/api/config"),
    isRemote,
    isRemoteWithAccount: jest.fn((domain: string) => isRemote(domain) && isRemote("auth")),
  }
})

jest.mock("@/src/auth/social", () => ({
  SocialSignInCancelled: class extends Error {},
  availableSocialProviders: jest.fn(() => ["kakao"]),
  socialCredential: jest.fn(async () => ({ provider: "KAKAO", accessToken: "kakao-access-token" })),
  signOutSocialProviders: jest.fn(async () => undefined),
}))

const memberA: MemberMe = {
  id: "77",
  nickname: "라멘러버",
  email: null,
  avatarUrl: null,
  bio: null,
  favoriteRamenType: null,
  status: "ACTIVE",
  logCount: 2,
  onboardingCompletedAt: "2026-10-19T08:00:00Z",
  consentRequired: false,
}
const memberB: MemberMe = { ...memberA, id: "99", nickname: "면탐험가", logCount: 0 }

const wireShop: ShopSummary = {
  id: "7",
  name: "하쿠텐",
  branchName: "연남점",
  address: "서울 마포구 연남동",
  region: "마포구",
  latitude: 37.56,
  longitude: 126.92,
  imageUrl: null,
  tagline: null,
  ramenTypes: ["돈코츠"],
  tags: [],
  logCount: 10,
  bookmarkCount: 3,
  isBookmarked: false,
  businessStatus: "OPERATIONAL",
  isOpen: true,
  distanceMeters: null,
}

/** 웹에서 옮겨 온 기록(점수 없음)과 앱에서 쓴 기록 */
const summaryA: RamenLogSummaryItem[] = [
  { id: "501", visitedAt: "2026-10-02", shop: { id: "7", name: "하쿠텐", branchName: "연남점" }, menuName: "이에케 라멘", ramenType: "이에케", scores: null },
  {
    id: "502",
    visitedAt: "2026-10-05",
    shop: { id: "7", name: "하쿠텐", branchName: "연남점" },
    menuName: "돈코츠 라멘",
    ramenType: "돈코츠",
    scores: { satisfaction: 4, brothDensity: 5, noodleFirmness: 4, topping: 4, revisit: 5 },
  },
]

interface FakeResponse {
  status: number
  ok: boolean
  headers: { get: () => null }
  text: () => Promise<string>
}

function respond(status: number, body?: unknown): FakeResponse {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => null },
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  }
}
const ok = (data: unknown, status = 200) => respond(status, { success: true, data, meta: { requestId: "req" } })
const fail = (status: number, code: string, message = "실패") =>
  respond(status, { success: false, error: { code, message, fields: [] }, meta: { requestId: "req" } })
const page = (items: unknown[]) => ok({ items, nextCursor: null, hasNext: false })

type Handler = (url: string, init: RequestInit) => FakeResponse | Promise<FakeResponse> | undefined
let fetchMock: jest.Mock
let routes: Handler[] = []

function serve(...handlers: Handler[]) {
  routes = handlers
  fetchMock = jest.fn(async (url: string, init: RequestInit) => {
    for (const route of routes) {
      const response = route(url, init)
      if (response) return response
    }
    return fail(500, "INTERNAL_ERROR")
  })
  ;(globalThis as { fetch: unknown }).fetch = fetchMock
}

const on = (
  method: string,
  path: string | RegExp,
  response: (url: string, init: RequestInit) => FakeResponse | Promise<FakeResponse>,
): Handler =>
  (url, init) => {
    const pathname = url.split("?")[0]
    const matches = typeof path === "string" ? pathname.endsWith(path) : path.test(pathname)
    return (init.method ?? "GET") === method && matches ? response(url, init) : undefined
  }

/** 로그인한 회원의 계정 읽기(세션 복원·회원 데이터) */
function accountRoutes(member: MemberMe, summary: RamenLogSummaryItem[], bookmarks: ShopSummary[] = []): Handler[] {
  return [
    on("GET", "/members/me", () => ok(member)),
    on("GET", "/members/me/ramen-logs/summary", () => ok(summary)),
    on("GET", "/members/me/ramen-logs", () => page([])),
    on("GET", "/members/me/bookmarked-shops", () => page(bookmarks.map((shop) => ({ ...shop, isBookmarked: true })))),
    on("GET", "/members/me/blocks", () => ok([])),
    on("POST", "/auth/logout", () => respond(204)),
  ]
}

function signedInState(id: string) {
  return {
    ...createInitialPersistedState(),
    onboardingCompleted: true,
    user: {
      id,
      name: "라멘러버",
      nickname: "라멘러버",
      avatar: null,
      level: "라멘 입문자",
      levelNumber: 1,
      membershipNo: `#RT-${id}`,
      visitedCount: 0,
      revisitCount: 0,
      isLoggedIn: true,
    },
  }
}

function repository(state = signedInState(memberA.id)): RaotaRepository {
  return {
    load: jest.fn().mockResolvedValue(state),
    save: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  }
}

const recordInput = (menuName: string): CreateRamenLogInput => ({
  shopId: "7",
  shopName: "하쿠텐",
  menuName,
  ramenType: "쇼유",
  visitedAt: "2026-10-10",
  imageUrl: null,
  photos: [],
  note: "",
  tasteNotes: { broth: ["진해요"], noodle: [], seasoning: [], topping: [] },
  scores: { satisfaction: 4, brothDensity: 3, noodleFirmness: 3, topping: 4, revisit: 5 },
  revisit: "자주 감",
  isPublic: false,
})

/** 기록 쓰기 화면처럼: 열 때 초안을 시작하고, 메뉴를 고쳐 다시 저장할 수 있다 */
function RecordProbe() {
  const { actions, currentUser, isHydrated } = useRaota()
  const [menu, setMenu] = useState("쇼유 라멘")
  const [message, setMessage] = useState("")
  const { startRecordDraft } = actions
  // 화면은 저장소를 다 읽은 뒤에 열린다
  const ready = isHydrated && Boolean(currentUser)
  useEffect(() => {
    if (ready) startRecordDraft("7")
  }, [ready, startRecordDraft])
  const save = async () => {
    try {
      const log = await actions.createLog(recordInput(menu))
      setMessage(`저장됨:${log.id}:${log.menuName}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "")
    }
  }
  return (
    <>
      <Text testID="user">{currentUser?.id ?? "guest"}</Text>
      <Text testID="message">{message}</Text>
      <Pressable accessibilityLabel="메뉴 고치기" onPress={() => setMenu("미소 라멘")} />
      <Pressable accessibilityLabel="저장" onPress={() => void save()} />
    </>
  )
}

/** 서버에 붙은 가짜 기록 저장소. 같은 (회원, 키)면 처음 만든 기록을 돌려준다 */
function fakeRamenLogServer() {
  const byKey = new Map<string, RamenLogDetail>()
  const deletedKeys = new Set<string>()
  let nextId = 900
  const keys: string[] = []
  const detailOf = (id: string, body: Record<string, unknown>): RamenLogDetail => ({
    id,
    author: { id: memberA.id, nickname: "라멘러버", avatarUrl: null, logCount: 3 },
    shop: { id: "7", name: "하쿠텐", branchName: "연남점", region: "마포구" },
    menuName: String(body.menuName),
    ramenType: String(body.ramenType) as RamenLogDetail["ramenType"],
    visitedAt: String(body.visitedAt),
    imageUrls: (body.imageUrls as string[]) ?? [],
    note: String(body.note ?? ""),
    tasteNoteCodes: (body.tasteNoteCodes as string[]) ?? [],
    revisitIntention: "OFTEN",
    visibility: "PRIVATE",
    scores: { ...(body.scores as { satisfaction: number; brothDensity: number; noodleFirmness: number; topping: number }), revisit: 5 },
    likeCount: 0,
    commentCount: 0,
    isLiked: false,
    isMine: true,
    createdAt: "2026-10-10T12:00:00Z",
    updatedAt: "2026-10-10T12:00:00Z",
    commentsPreview: [],
    commentsNextCursor: null,
  })
  return {
    keys,
    byKey,
    deletedKeys,
    /** 저장은 되지만 첫 응답은 실패로 돌아간다(응답을 받지 못한 경우) */
    loseFirstResponse: true,
    create(init: RequestInit): FakeResponse {
      const key = (init.headers as Record<string, string>)["Idempotency-Key"]
      keys.push(key)
      if (deletedKeys.has(key)) return fail(409, "CONFLICT", "이미 삭제된 기록의 요청입니다.")
      const existing = byKey.get(key)
      if (existing) return ok(existing, 201)
      const created = detailOf(String(nextId++), JSON.parse(String(init.body)))
      byKey.set(key, created)
      if (this.loseFirstResponse) {
        this.loseFirstResponse = false
        return fail(429, "RATE_LIMITED", "잠시 후 다시 시도해 주세요.")
      }
      return ok(created, 201)
    },
    patch(url: string, init: RequestInit): FakeResponse {
      const id = url.split("?")[0].split("/").pop()
      const [key, current] = [...byKey.entries()].find(([, log]) => log.id === id) ?? []
      if (!key || !current) return fail(404, "RESOURCE_NOT_FOUND")
      const updated = { ...current, ...JSON.parse(String(init.body)) } as RamenLogDetail
      byKey.set(key, updated)
      return ok(updated)
    },
  }
}

async function renderSignedIn(element: React.ReactElement, member = memberA) {
  await tokenStore.set({ accessToken: "access", refreshToken: "refresh" })
  const view = await render(<RaotaProvider repository={repository(signedInState(member.id))}>{element}</RaotaProvider>)
  await waitFor(() => expect(view.getByTestId("user").props.children).toBe(member.id))
  return view
}

beforeEach(async () => {
  jest.clearAllMocks()
  remoteCache.clear()
  await tokenStore.clear()
  await idempotencyOutbox.clear()
})

describe("기록 저장 재시도(초안 하나에 Idempotency-Key 하나)", () => {
  it("응답을 못 받은 뒤 메뉴를 고쳐 다시 저장하면 같은 키로 보내 기록이 하나만 생기고, 고친 메뉴로 맞춘다", async () => {
    const server = fakeRamenLogServer()
    serve(
      ...accountRoutes(memberA, summaryA),
      on("POST", "/ramen-logs", (_url, init) => server.create(init)),
      on("PATCH", /\/ramen-logs\/\d+$/, (url, init) => server.patch(url, init)),
    )
    const view = await renderSignedIn(<RecordProbe />)

    await fireEvent.press(view.getByLabelText("저장"))
    await waitFor(() => expect(view.getByTestId("message").props.children).toBe("잠시 후 다시 시도해 주세요."))

    await fireEvent.press(view.getByLabelText("메뉴 고치기"))
    await fireEvent.press(view.getByLabelText("저장"))
    await waitFor(() => expect(view.getByTestId("message").props.children).toBe("저장됨:900:미소 라멘"))

    expect(server.keys).toHaveLength(2)
    expect(server.keys[1]).toBe(server.keys[0])
    expect(server.byKey.size).toBe(1)
    expect([...server.byKey.values()][0].menuName).toBe("미소 라멘")
    // 끝난 요청은 아웃박스에 남지 않는다
    expect(await idempotencyOutbox.pending(memberA.id)).toEqual([])
  })

  it("다시 저장했는데 그 키의 기록이 이미 지워졌으면(409) 이미 처리됨으로 알리고, 다음 저장은 새 키로 새 기록을 만든다", async () => {
    const server = fakeRamenLogServer()
    serve(...accountRoutes(memberA, summaryA), on("POST", "/ramen-logs", (_url, init) => server.create(init)))
    const view = await renderSignedIn(<RecordProbe />)

    await fireEvent.press(view.getByLabelText("저장"))
    await waitFor(() => expect(view.getByTestId("message").props.children).toBe("잠시 후 다시 시도해 주세요."))
    // 그사이 다른 기기에서 그 기록을 지웠다
    server.deletedKeys.add(server.keys[0])

    await fireEvent.press(view.getByLabelText("저장"))
    await waitFor(() =>
      expect(view.getByTestId("message").props.children).toBe("이 기록은 이미 저장했다가 지웠어요. 다시 저장하면 새 기록으로 남겨요."),
    )

    await fireEvent.press(view.getByLabelText("저장"))
    await waitFor(() => expect(view.getByTestId("message").props.children).toMatch(/^저장됨:/))
    expect(server.keys[2]).not.toBe(server.keys[0])
  })
})

/** 라운지 글 상세의 댓글 입력처럼: 내용을 고쳐 다시 보낼 수 있다 */
function CommentProbe() {
  const { actions, currentUser } = useRaota()
  const [content, setContent] = useState("국물이 진해요")
  const [message, setMessage] = useState("")
  const send = async () => {
    try {
      const comment = await actions.addLogComment("501", { content })
      setMessage(`보냄:${comment?.content ?? ""}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "")
    }
  }
  return (
    <>
      <Text testID="user">{currentUser?.id ?? "guest"}</Text>
      <Text testID="message">{message}</Text>
      <Pressable accessibilityLabel="댓글 고치기" onPress={() => setContent("면이 단단해요")} />
      <Pressable accessibilityLabel="댓글 보내기" onPress={() => void send()} />
    </>
  )
}

/** 같은 키면 처음 단 댓글을 돌려주는 가짜 댓글 저장소. first는 첫 요청을 어떻게 실패시킬지 정한다 */
function fakeCommentServer(first: "lose-response" | "never-arrived") {
  const byKey = new Map<string, WireComment>()
  const keys: string[] = []
  let nextId = 300
  return {
    keys,
    byKey,
    create(init: RequestInit): FakeResponse {
      const key = (init.headers as Record<string, string>)["Idempotency-Key"]
      keys.push(key)
      // 처리 전에 거절된 요청(저장하지 않음)
      if (keys.length === 1 && first === "never-arrived") return fail(429, "RATE_LIMITED", "잠시 후 다시 시도해 주세요.")
      const existing = byKey.get(key)
      if (existing) return ok(existing, 201)
      const { content } = JSON.parse(String(init.body)) as { content: string }
      const created: WireComment = {
        id: String(nextId++),
        logId: "501",
        author: { id: memberA.id, nickname: "라멘러버", avatarUrl: null, logCount: 3 },
        content,
        createdAt: "2026-10-10T12:00:00Z",
        isMine: true,
      }
      byKey.set(key, created)
      if (keys.length === 1) return fail(429, "RATE_LIMITED", "잠시 후 다시 시도해 주세요.")
      return ok(created, 201)
    },
  }
}

describe("댓글 재시도(댓글 초안 하나에 Idempotency-Key 하나)", () => {
  it("응답을 못 받은 뒤 내용을 고쳐 다시 보내도 같은 키로 보내 댓글이 하나만 생긴다", async () => {
    const server = fakeCommentServer("lose-response")
    serve(...accountRoutes(memberA, summaryA), on("POST", "/ramen-logs/501/comments", (_url, init) => server.create(init)))
    const view = await renderSignedIn(<CommentProbe />)

    await fireEvent.press(view.getByLabelText("댓글 보내기"))
    await waitFor(() => expect(view.getByTestId("message").props.children).toBe("잠시 후 다시 시도해 주세요."))
    await fireEvent.press(view.getByLabelText("댓글 고치기"))
    await fireEvent.press(view.getByLabelText("댓글 보내기"))
    // 서버에 이미 닿았던 요청이라 처음 단 댓글이 그대로 남는다
    await waitFor(() => expect(view.getByTestId("message").props.children).toBe("보냄:국물이 진해요"))

    expect(server.keys).toHaveLength(2)
    expect(server.keys[1]).toBe(server.keys[0])
    expect(server.byKey.size).toBe(1)
    expect(await idempotencyOutbox.pending(memberA.id)).toEqual([])
  })

  it("첫 요청이 서버에 닿지 못했으면 같은 키로 고친 내용을 보내 고친 댓글이 남는다", async () => {
    const server = fakeCommentServer("never-arrived")
    serve(...accountRoutes(memberA, summaryA), on("POST", "/ramen-logs/501/comments", (_url, init) => server.create(init)))
    const view = await renderSignedIn(<CommentProbe />)

    await fireEvent.press(view.getByLabelText("댓글 보내기"))
    await waitFor(() => expect(view.getByTestId("message").props.children).not.toBe(""))
    await fireEvent.press(view.getByLabelText("댓글 고치기"))
    await fireEvent.press(view.getByLabelText("댓글 보내기"))
    await waitFor(() => expect(view.getByTestId("message").props.children).toBe("보냄:면이 단단해요"))

    expect(server.keys[1]).toBe(server.keys[0])
    expect([...server.byKey.values()].map((comment) => comment.content)).toEqual(["면이 단단해요"])
  })

  it("댓글을 남긴 뒤 다음 댓글은 새 키로 보내 새 댓글이 된다", async () => {
    const server = fakeCommentServer("lose-response")
    serve(...accountRoutes(memberA, summaryA), on("POST", "/ramen-logs/501/comments", (_url, init) => server.create(init)))
    const view = await renderSignedIn(<CommentProbe />)

    await fireEvent.press(view.getByLabelText("댓글 보내기"))
    await waitFor(() => expect(view.getByTestId("message").props.children).toBe("잠시 후 다시 시도해 주세요."))
    await fireEvent.press(view.getByLabelText("댓글 보내기"))
    await waitFor(() => expect(view.getByTestId("message").props.children).toBe("보냄:국물이 진해요"))
    await fireEvent.press(view.getByLabelText("댓글 보내기"))
    await waitFor(() => expect(server.keys).toHaveLength(3))

    expect(server.keys[2]).not.toBe(server.keys[0])
    expect(server.byKey.size).toBe(2)
  })
})

/** 매장 상세의 찜 버튼처럼: 지금 찜 여부와 실패 문구를 보여준다 */
function BookmarkProbe({ shop }: { shop: Shop }) {
  const { actions, currentUser, isShopBookmarked } = useRaota()
  const saved = useBookmarkedShops()
  const [message, setMessage] = useState("")
  return (
    <>
      <Text testID="user">{currentUser?.id ?? "guest"}</Text>
      <Text testID="saved">{isShopBookmarked(shop) ? "찜함" : "안 찜함"}</Text>
      <Text testID="list">{saved.data.map((item) => item.name).join(",")}</Text>
      <Text testID="message">{message}</Text>
      <Pressable
        accessibilityLabel="찜"
        onPress={() => void actions.toggleBookmark(shop).then(() => setMessage(""), (error: Error) => setMessage(error.message))}
      />
    </>
  )
}

describe("찜", () => {
  it("누르면 바로 찜으로 바뀌고, 서버가 실패하면 원래대로 되돌리며 이유를 알려준다", async () => {
    // PUT 응답을 붙잡아 두었다가 실패로 돌려준다
    let answer: (value: FakeResponse) => void = () => undefined
    const held = new Promise<FakeResponse>((resolve) => {
      answer = resolve
    })
    serve(...accountRoutes(memberA, summaryA), on("PUT", "/shops/7/bookmark", () => held))
    const view = await renderSignedIn(<BookmarkProbe shop={toAppShopSummary(wireShop)} />)

    await fireEvent.press(view.getByLabelText("찜"))
    await waitFor(() => expect(view.getByTestId("saved").props.children).toBe("찜함"))

    await act(async () => answer(fail(500, "INTERNAL_ERROR")))
    await waitFor(() => expect(view.getByTestId("saved").props.children).toBe("안 찜함"))
    expect(view.getByTestId("message").props.children).toBe("찜하지 못했어요. 다시 시도해 주세요.")
    expect(view.getByTestId("list").props.children).toBe("")
  })

  it("찜에 성공하면 내 찜 목록에도 바로 들어간다", async () => {
    serve(...accountRoutes(memberA, summaryA), on("PUT", "/shops/7/bookmark", () => respond(204)))
    const view = await renderSignedIn(<BookmarkProbe shop={toAppShopSummary(wireShop)} />)

    await fireEvent.press(view.getByLabelText("찜"))
    await waitFor(() => expect(view.getByTestId("list").props.children).toBe("하쿠텐"))
    expect(view.getByTestId("saved").props.children).toBe("찜함")
  })
})

/** 마이 탭처럼: 그릇 수·찜 목록·내 기록, 로그아웃과 다시 로그인 */
function MyProbe() {
  const { actions, currentUser } = useRaota()
  const bowls = useMyBowls()
  const saved = useBookmarkedShops()
  const logs = useMyLogs()
  return (
    <>
      <Text testID="user">{currentUser?.id ?? "guest"}</Text>
      <Text testID="bowls">{bowls.data.map((bowl) => bowl.menu).join(",")}</Text>
      <Text testID="saved">{saved.data.map((shop) => shop.name).join(",")}</Text>
      <Text testID="logs">{String(logs.data.length)}</Text>
      <Pressable accessibilityLabel="로그아웃" onPress={actions.logout} />
      <Pressable
        accessibilityLabel="다른 계정으로 로그인"
        onPress={() => void actions.signIn({ provider: "KAKAO", accessToken: "other" })}
      />
      <Pressable accessibilityLabel="기록 지우기" onPress={() => void actions.deleteLog("502")} />
    </>
  )
}

describe("내 기록·찜(서버 회원)", () => {
  it("웹에서 옮겨 온 기록까지 내 그릇으로 보여준다", async () => {
    serve(...accountRoutes(memberA, summaryA, [wireShop]))
    const view = await renderSignedIn(<MyProbe />)

    await waitFor(() => expect(view.getByTestId("bowls").props.children).toBe("돈코츠 라멘,이에케 라멘"))
    expect(view.getByTestId("saved").props.children).toBe("하쿠텐")
  })

  it("이미 지워진 기록(404)을 지우면 지운 것으로 보고 목록에서 뺀다", async () => {
    serve(...accountRoutes(memberA, summaryA), on("DELETE", "/ramen-logs/502", () => fail(404, "RESOURCE_NOT_FOUND")))
    const view = await renderSignedIn(<MyProbe />)
    await waitFor(() => expect(view.getByTestId("bowls").props.children).toBe("돈코츠 라멘,이에케 라멘"))

    await fireEvent.press(view.getByLabelText("기록 지우기"))
    await waitFor(() => expect(view.getByTestId("bowls").props.children).toBe("이에케 라멘"))
  })

  it("로그아웃하면 서버에서 받은 내 데이터와 응답 캐시를 비우고, 다른 계정으로 들어가도 앞 계정 데이터가 보이지 않는다", async () => {
    serve(...accountRoutes(memberA, summaryA, [wireShop]))
    const view = await renderSignedIn(<MyProbe />)
    await waitFor(() => expect(view.getByTestId("saved").props.children).toBe("하쿠텐"))
    // 라운지 상세처럼 내 공감 여부가 담긴 응답이 캐시에 있다
    await remoteCache.load("lounge:detail:1", async () => ({ isLiked: true }))

    await fireEvent.press(view.getByLabelText("로그아웃"))
    await waitFor(() => expect(view.getByTestId("user").props.children).toBe("guest"))
    expect(view.getByTestId("bowls").props.children).toBe("")
    expect(view.getByTestId("saved").props.children).toBe("")
    expect(remoteCache.get("lounge:detail:1")).toBeUndefined()

    routes = [
      on("POST", "/auth/oauth/login", () =>
        ok({ accessToken: "b-access", refreshToken: "b-refresh", expiresIn: 1800, isNewMember: false, member: memberB }),
      ),
      ...accountRoutes(memberB, []),
    ]
    await fireEvent.press(view.getByLabelText("다른 계정으로 로그인"))
    await waitFor(() => expect(view.getByTestId("user").props.children).toBe(memberB.id))
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/members/me/ramen-logs/summary"))).toBe(true))
    expect(view.getByTestId("bowls").props.children).toBe("")
    expect(view.getByTestId("saved").props.children).toBe("")
  })
})

/** 종류별 모아 보기처럼: 이 종류 내 기록과 사진 */
function TypeLogsProbe({ type }: { type: string }) {
  const logs = useMyLogsOfType(type)
  return <Text testID="type-logs">{logs.data.map((log) => `${log.id}:${log.imageUrl ?? "-"}`).join(",")}</Text>
}

describe("종류별 내 기록(서버 회원)", () => {
  it("그 종류만 서버에 물어 사진을 채우고, 새 기록을 저장하면 다시 읽는다", async () => {
    const server = fakeRamenLogServer()
    server.loseFirstResponse = false
    const shoyu = (id: string, image: string | null) => ({
      id,
      author: { id: memberA.id, nickname: "라멘러버", avatarUrl: null, logCount: 3 },
      shop: { id: "7", name: "하쿠텐", branchName: "연남점", region: "마포구" },
      menuName: "쇼유 라멘",
      ramenType: "쇼유",
      visitedAt: "2026-10-03",
      imageUrls: image ? [image] : [],
      note: "",
      tasteNoteCodes: [],
      revisitIntention: "OFTEN",
      visibility: "PRIVATE",
      scores: null,
      likeCount: 0,
      commentCount: 0,
      isLiked: false,
      isMine: true,
      createdAt: "2026-10-03T12:00:00Z",
    })
    const typeRequests: string[] = []
    serve(
      // 종류를 붙인 요청만 여기서 받는다. 저장 전에는 한 그릇, 저장 뒤에는 방금 쓴 기록(사진 없음)이 앞에 붙는다
      (url, init) => {
        if ((init.method ?? "GET") !== "GET" || !url.split("?")[0].endsWith("/members/me/ramen-logs") || !url.includes("ramenType=")) return undefined
        typeRequests.push(decodeURIComponent(url))
        return page(server.byKey.size ? [shoyu("900", null), shoyu("601", "https://img.test/601.jpg")] : [shoyu("601", "https://img.test/601.jpg")])
      },
      ...accountRoutes(memberA, summaryA),
      on("POST", "/ramen-logs", (_url, init) => server.create(init)),
    )
    const view = await renderSignedIn(<><RecordProbe /><TypeLogsProbe type="쇼유" /></>)

    await waitFor(() => expect(view.getByTestId("type-logs").props.children).toBe("601:https://img.test/601.jpg"))
    // 로그인을 되살리며 캐시를 한 번 비우므로 횟수는 보지 않는다. 늘 이 종류만 묻는다
    expect(typeRequests.length).toBeGreaterThan(0)
    expect(typeRequests.every((url) => url.includes("ramenType=쇼유"))).toBe(true)
    const before = typeRequests.length

    await fireEvent.press(view.getByLabelText("저장"))
    await waitFor(() => expect(view.getByTestId("message").props.children).toMatch(/^저장됨:900/))
    await waitFor(() => expect(view.getByTestId("type-logs").props.children).toBe("900:-,601:https://img.test/601.jpg"))
    expect(typeRequests.length).toBeGreaterThan(before)
  })
})
