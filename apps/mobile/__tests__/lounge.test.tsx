import { act, fireEvent, render, waitFor, within } from "@testing-library/react-native"
import type { ReactElement } from "react"
import { ActionSheetIOS, View } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import type { PersistedAppStateV1, RamenLog } from "@raota/shared"
import { createInitialPersistedState } from "@/src/data/fixtures"
import type { RaotaRepository } from "@/src/repository"
import { migratePersistedState } from "@/src/repository/migrations"
import { RaotaProvider } from "@/src/state/RaotaStore"
import LoungeScreen from "@/app/native/lounge"
import LogDetailScreen from "@/app/(flows)/log/[logId]"

jest.mock("expo-router", () => {
  const React = require("react") as typeof import("react")
  return {
    router: { back: jest.fn(), canGoBack: jest.fn(() => true), push: jest.fn(), replace: jest.fn(), navigate: jest.fn() },
    useLocalSearchParams: jest.fn(() => ({})),
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(effect, [effect])
    },
  }
})
jest.mock("expo-notifications")
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light" },
  NotificationFeedbackType: { Success: "success" },
}))
jest.mock("@/src/analytics", () => ({ track: jest.fn() }))
jest.mock("lucide-react-native", () => {
  const React = require("react") as typeof import("react")
  const { View } = require("react-native") as typeof import("react-native")
  const Icon = (props: Record<string, unknown>) => React.createElement(View, props)
  return new Proxy({ __esModule: true }, {
    get: (target, property) => (property === "__esModule" ? target.__esModule : Icon),
  })
})
// 서버에서 읽은 상세(remote)를 흉내 낼 때만 켠다. 기본은 기기 저장소 모드
jest.mock("@/src/api/config", () => {
  const isRemote = jest.fn((_domain: string) => false)
  return {
    ...jest.requireActual("@/src/api/config"),
    isRemote,
    isRemoteWithAccount: jest.fn((domain: string) => isRemote(domain) && isRemote("auth")),
  }
})
jest.mock("@/src/data/remote", () => {
  const actual = jest.requireActual("@/src/data/remote")
  return { ...actual, remoteReads: { ...actual.remoteReads, loungeLog: jest.fn() } }
})

const { router, useLocalSearchParams } = jest.requireMock("expo-router") as {
  router: { push: jest.Mock; back: jest.Mock; replace: jest.Mock }
  useLocalSearchParams: jest.Mock
}
const { track } = jest.requireMock("@/src/analytics") as { track: jest.Mock }
const haptics = jest.requireMock("expo-haptics") as { impactAsync: jest.Mock }
const { isRemote } = jest.requireMock("@/src/api/config") as { isRemote: jest.Mock }
const { remoteReads } = jest.requireMock("@/src/data/remote") as { remoteReads: { loungeLog: jest.Mock } }

function repository(state: PersistedAppStateV1): RaotaRepository & { save: jest.Mock } {
  return {
    load: jest.fn().mockResolvedValue(state),
    save: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  }
}

const safeArea = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
}

async function renderWith(element: ReactElement, state = createInitialPersistedState()) {
  const repo = repository(state)
  const view = await render(
    <SafeAreaProvider initialMetrics={safeArea}>
      <RaotaProvider repository={repo}>{element}</RaotaProvider>
    </SafeAreaProvider>,
  )
  return { view, repo }
}

const guestState = () => {
  const state = createInitialPersistedState()
  return { ...state, user: state.user ? { ...state.user, isLoggedIn: false } : null }
}

/** 로그인한 데모 계정의 기록과 남의 비공개 기록을 하나씩 더한 상태 */
function stateWithPrivateLogs() {
  const state = createInitialPersistedState()
  const base = state.logs.find((log) => log.id === "4") as RamenLog
  const othersPrivate: RamenLog = {
    ...base,
    id: "90",
    author: { id: "user-feed-900", name: "비공개작성자", level: "라멘 입문자 (Lv.2)" },
    menuName: "남의 비공개 라멘",
    isPublic: false,
    createdAt: "2026-09-19T09:00:00+09:00",
    comments: [],
    commentCount: 0,
  }
  const minePublic: RamenLog = {
    ...base,
    id: "91",
    author: { id: state.user?.id, name: state.user?.nickname ?? "", level: "라멘집 단골 (Lv.4)" },
    menuName: "내가 공개한 라멘",
    isPublic: true,
    createdAt: "2026-09-19T08:00:00+09:00",
    comments: [],
    commentCount: 0,
  }
  const minePrivate: RamenLog = { ...minePublic, id: "92", menuName: "내 비공개 라멘", isPublic: false, createdAt: "2026-09-19T07:00:00+09:00" }
  return { ...state, logs: [othersPrivate, minePublic, minePrivate, ...state.logs] }
}

/**
 * 피드 순서. FlashList는 칸을 재활용해 화면 트리 순서가 데이터 순서와 다르므로 칸에 붙은 순번으로 읽는다.
 * 어느 열에 놓일지는 masonry가 실제 높이로 정한다.
 */
function pinOrder(view: Awaited<ReturnType<typeof renderWith>>["view"]) {
  const cells = view.queryAllByTestId(/^lounge-cell-\d+$/)
  const index = (cell: (typeof cells)[number]) => Number(String(cell.props.testID).replace("lounge-cell-", ""))
  return [...cells].sort((a, b) => index(a) - index(b)).map((cell) => within(cell).getByTestId(/^lounge-log-/).props.testID)
}

beforeEach(() => {
  jest.clearAllMocks()
  useLocalSearchParams.mockReturnValue({})
})

describe("라운지 피드", () => {
  it("starts with an unselected 최신순 sort chip (not a second 전체) and no search shortcut", async () => {
    const { view } = await renderWith(<LoungeScreen />)
    const chip = view.getByRole("button", { name: "정렬, 최신순" })
    expect(chip.props.accessibilityHint).toContain("정렬 메뉴")
    expect(chip.props.accessibilityState.selected).toBe(false)
    expect(view.getByText("최신순 ▾")).toBeTruthy()
    // 정렬 칩과 종류 칩이 나란히 "전체"로 읽히지 않는다
    expect(view.getAllByText("전체")).toHaveLength(1)
    // 라운지에는 검색이 없으니 지도로 튀는 검색 버튼도 두지 않는다
    expect(view.queryByLabelText("라멘집 검색")).toBeNull()
    await view.findByTestId("lounge-log-4")
    expect(pinOrder(view)[0]).toBe("lounge-log-4")
  })

  it("navigates with the full BIGINT ID from a lounge pin", async () => {
    const logId = "9007199254740993123"
    const state = createInitialPersistedState()
    state.logs.unshift({ ...state.logs[0], id: logId, createdAt: "2026-10-19T12:00:00Z", comments: [], commentCount: 0 })
    const { view } = await renderWith(<LoungeScreen />, state)

    await fireEvent.press(await view.findByTestId(`lounge-log-${logId}`))
    expect(router.push).toHaveBeenCalledWith({ pathname: "/log/[logId]", params: { logId } })
  })

  it("shows public logs only (mine included), newest first, and tracks the visit", async () => {
    const { view } = await renderWith(<LoungeScreen />, stateWithPrivateLogs())

    expect(await view.findByRole("button", { name: /내가 공개한 라멘/ })).toBeTruthy()
    expect(view.queryByText("남의 비공개 라멘")).toBeNull()
    expect(view.queryByText("내 비공개 라멘")).toBeNull()
    // 피드에서는 가벼운 핀만 보이고 신고·숨기기 메뉴는 상세에서 열린다.
    const mine = view.getByTestId("lounge-log-91")
    expect(within(mine).queryByLabelText(/라멘로그 메뉴/)).toBeNull()
    // 두 최신 기록이 피드 맨 앞(첫 줄 왼쪽·오른쪽)에 놓인다. 열 배치는 FlashList masonry가 맡는다.
    expect(pinOrder(view).slice(0, 2)).toEqual(["lounge-log-91", "lounge-log-4"])
    expect(track).toHaveBeenCalledWith("lounge_viewed")
    // 화면 문구에 내부 용어를 쓰지 않는다
    expect(view.queryByText(/5축|취향 여권/)).toBeNull()
  })

  it("filters by ramen type and chooses, dismisses, and resets the anchored sort menu", async () => {
    const measure = jest.spyOn(View.prototype, "measureInWindow").mockImplementation((callback) => callback(16, 120, 96, 40))
    const { view } = await renderWith(<LoungeScreen />)
    await view.findByTestId("lounge-log-4")

    await fireEvent.press(view.getByRole("button", { name: "시오 라멘만 보기" }))
    expect(pinOrder(view)).toEqual(["lounge-log-5", "lounge-log-8"])
    expect(view.getByRole("button", { name: "시오 라멘만 보기" }).props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    )

    await fireEvent.press(view.getByRole("button", { name: "정렬, 최신순" }))
    expect(measure).toHaveBeenCalled()
    expect(view.getByTestId("lounge-sort-menu")).toBeTruthy()
    // 메뉴는 최신순 · 인기순 둘뿐이고 기본 최신순에 체크가 있다
    expect(within(view.getByTestId("lounge-sort-menu")).getAllByRole("button").map((option) => option.props.accessibilityLabel)).toEqual(["최신순", "인기순"])
    expect(view.getByRole("button", { name: "최신순" }).props.accessibilityState.selected).toBe(true)
    await fireEvent.press(view.getByTestId("lounge-sort-dismiss", { includeHiddenElements: true }))
    expect(view.queryByTestId("lounge-sort-menu")).toBeNull()
    expect(view.getByRole("button", { name: "정렬, 최신순" }).props.accessibilityState.selected).toBe(false)

    await fireEvent.press(view.getByRole("button", { name: "정렬, 최신순" }))
    await fireEvent.press(view.getByRole("button", { name: "인기순" }))
    // 기본이 아닌 정렬을 고르면 칩이 선택 상태가 된다
    expect(view.getByRole("button", { name: "정렬, 인기순" }).props.accessibilityState.selected).toBe(true)
    expect(view.getByText("인기순 ▾")).toBeTruthy()
    expect(pinOrder(view)).toEqual(["lounge-log-8", "lounge-log-5"])

    await fireEvent.press(view.getByRole("button", { name: "정렬, 인기순" }))
    expect(view.getByRole("button", { name: "인기순" }).props.accessibilityState.selected).toBe(true)
    await fireEvent.press(view.getByRole("button", { name: "최신순" }))
    expect(view.getByRole("button", { name: "정렬, 최신순" }).props.accessibilityState.selected).toBe(false)
    expect(pinOrder(view)).toEqual(["lounge-log-5", "lounge-log-8"])

    // 결과가 없는 종류는 빈 상태와 "전체 보기"
    await fireEvent.press(view.getByRole("button", { name: "탄탄멘 라멘만 보기" }))
    expect(view.getByText("탄탄멘 라멘로그가 아직 없어요")).toBeTruthy()
    await fireEvent.press(view.getByRole("button", { name: "전체 보기" }))
    expect(pinOrder(view)[0]).toBe("lounge-log-4")
    measure.mockRestore()
  })

  it("retries a failed first page from the server with 다시 불러오기, keeping the chosen type", async () => {
    isRemote.mockImplementation((domain: string) => domain === "lounge")
    const page = { items: createInitialPersistedState().logs.filter((log) => log.isPublic && log.ramenType === "시오"), nextCursor: null, hasNext: false }
    const loungeLogs = jest.spyOn(remoteReads as unknown as { loungeLogs: (...args: unknown[]) => Promise<unknown> }, "loungeLogs")
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(page)
    try {
      const { view } = await renderWith(<LoungeScreen />)
      await view.findByText("라멘로그를 불러오지 못했어요")
      await fireEvent.press(view.getByRole("button", { name: "시오 라멘만 보기" }))
      await view.findByText("라멘로그를 불러오지 못했어요")

      await fireEvent.press(view.getByRole("button", { name: "다시 불러오기" }))
      expect(await view.findByTestId(`lounge-log-${page.items[0].id}`)).toBeTruthy()
      expect(loungeLogs).toHaveBeenLastCalledWith(expect.objectContaining({ type: "시오", sort: "latest" }))
      expect(view.getByRole("button", { name: "시오 라멘만 보기" }).props.accessibilityState.selected).toBe(true)
    } finally {
      loungeLogs.mockRestore()
      isRemote.mockImplementation(() => false)
    }
  })

  it("opens a photo pin without a score overlay while keeping its soup type and photo count", async () => {
    const { view } = await renderWith(<LoungeScreen />)
    const pin = await view.findByTestId("lounge-log-6")

    expect(within(pin).queryByText(/만족도 4 ·/)).toBeNull()
    expect(within(pin).getByText("쇼유")).toBeTruthy()
    expect(within(pin).getByText("2")).toBeTruthy()
    await fireEvent.press(pin)
    expect(router.push).toHaveBeenCalledWith({ pathname: "/log/[logId]", params: { logId: "6" } })
    expect(within(pin).queryByRole("button", { name: /공감 \d+개/ })).toBeNull()
  })

  it("loads the next page near the end and unmounts pins scrolled far off screen", async () => {
    const state = createInitialPersistedState()
    const base = state.logs.find((log) => log.id === "4") as RamenLog
    // 최신순 맨 앞에 오도록 데모보다 늦은 시각으로 공개 기록 40개를 더한다
    const many = Array.from({ length: 40 }, (_, i) => ({
      ...base,
      id: String(1000 + i),
      createdAt: new Date(Date.UTC(2026, 9, 19, 12, 0, 40 - i)).toISOString(),
      comments: [],
      commentCount: 0,
    }))
    const { view } = await renderWith(<LoungeScreen />, { ...state, logs: [...many, ...state.logs] })
    await view.findByTestId("lounge-log-1000")
    const loaded = pinOrder(view).length
    expect(loaded).toBeLessThan(40)

    // 테스트의 칸 높이는 100pt로 고정이라 한참 내려 끝에 닿게 한다
    await fireEvent.scroll(view.getByTestId("lounge-feed"), {
      nativeEvent: { contentOffset: { x: 0, y: 3000 }, contentSize: { width: 390, height: 4000 }, layoutMeasurement: { width: 390, height: 844 } },
    })
    await waitFor(() => expect(view.queryAllByTestId(/^lounge-cell-\d+$/).length).toBeGreaterThan(0))
    // 다음 쪽이 붙었고, 맨 위 첫 핀은 화면에서 멀어져 내려갔다(칸이 재활용돼 다른 기록을 그린다)
    expect(Math.max(...pinOrder(view).map((id) => Number(id.replace("lounge-log-", ""))))).toBeGreaterThanOrEqual(1000 + loaded)
    expect(view.queryByTestId("lounge-log-1000")).toBeNull()
  })

  it("keeps pins short in the feed so the grid doesn't look crowded", async () => {
    const { view } = await renderWith(<LoungeScreen />)
    const quote = await view.findByTestId("lounge-log-5")
    const note = within(quote).getByText(
      "도미 뼈 육수가 맑은데도 끝맛이 길게 남아요. 유자 껍질 조금 올라간 게 포인트. 간이 약한 편이라 슴슴한 걸 좋아하면 추천합니다.",
    )
    expect(note.props.numberOfLines).toBe(5)

    const photo = view.getByTestId("lounge-log-4")
    expect(within(photo).getByText("면 단단하게, 기름 보통으로 주문. 김 세 장에 밥까지 말아 먹으니 완벽한 저녁이었어요. 시금치가 생각보다 많이 들어가서 좋았음.").props.numberOfLines).toBe(2)
    expect(within(photo).getByText(/면발탐정 · 하쿠텐/).props.numberOfLines).toBe(1)
  })

  it("opens 공감 on the pin detail, toggles it with a haptic, and keeps the count in the store", async () => {
    useLocalSearchParams.mockReturnValue({ logId: "4" })
    const { view } = await renderWith(<LogDetailScreen />)
    const like = await view.findByRole("button", { name: "공감 5개" })

    await fireEvent.press(like)
    const liked = view.getByRole("button", { name: "공감 6개" })
    expect(liked.props.accessibilityState).toEqual(expect.objectContaining({ selected: true }))
    expect(haptics.impactAsync).toHaveBeenCalled()
    expect(track).toHaveBeenCalledWith("log_liked")

    await fireEvent.press(liked)
    expect(view.getByRole("button", { name: "공감 5개" })).toBeTruthy()
  })

  it("sends a guest who presses detail 공감 to login without changing the count", async () => {
    useLocalSearchParams.mockReturnValue({ logId: "4" })
    const { view } = await renderWith(<LogDetailScreen />, guestState())
    const like = await view.findByRole("button", { name: "공감 5개" })
    await fireEvent.press(like)
    expect(router.push).toHaveBeenCalledWith("/auth/login")
    expect(view.getByRole("button", { name: "공감 5개" })).toBeTruthy()
  })

  it("hides a detail's author, persists it, and can undo", async () => {
    const sheet = jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation((_options, callback) => callback(1))
    useLocalSearchParams.mockReturnValue({ logId: "6" })
    const { view, repo } = await renderWith(<LogDetailScreen />)
    await fireEvent.press(await view.findByLabelText("멘마수집가님의 라멘로그 메뉴"))
    expect(sheet).toHaveBeenCalledWith(
      expect.objectContaining({ options: ["신고하기", "이 사용자 숨기기", "취소"] }),
      expect.any(Function),
    )
    expect(await view.findByText("멘마수집가님의 글을 숨겼어요")).toBeTruthy()
    expect(track).toHaveBeenCalledWith("author_hidden")
    await waitFor(() =>
      expect(repo.save).toHaveBeenLastCalledWith(expect.objectContaining({ hiddenAuthorIds: ["user-201"] })),
    )
    await fireEvent.press(within(view.getByText("멘마수집가님의 글을 숨겼어요").parent!).getByRole("button", { name: "되돌리기" }))
    expect(await view.findByText("니보시 쇼유 라멘")).toBeTruthy()
    sheet.mockRestore()
  })

  it("reports a log from its detail and stops showing it to the reporter", async () => {
    const sheet = jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation((_options, callback) => callback(0))
    useLocalSearchParams.mockReturnValue({ logId: "4" })
    const { view, repo } = await renderWith(<LogDetailScreen />)
    await fireEvent.press(await view.findByLabelText("면발탐정님의 라멘로그 메뉴"))
    expect(view.getByText("라멘로그 신고하기")).toBeTruthy()
    const submit = view.getByRole("button", { name: "신고하기" })
    expect(submit.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }))
    await fireEvent.press(view.getByRole("radio", { name: "스팸·홍보" }))
    await fireEvent.press(view.getByRole("button", { name: "신고하기" }))
    expect(view.getByText("신고를 접수했어요")).toBeTruthy()
    expect(track).toHaveBeenCalledWith("content_reported", { kind: "log", reason: "spam" })
    await waitFor(() =>
      expect(repo.save).toHaveBeenLastCalledWith(
        expect.objectContaining({ contentReports: [expect.objectContaining({ kind: "log", targetId: "4", reason: "spam" })] }),
      ),
    )
    sheet.mockRestore()
  })

  it("sends a guest who picks 신고하기 on a detail to login", async () => {
    const sheet = jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation((_options, callback) => callback(0))
    useLocalSearchParams.mockReturnValue({ logId: "4" })
    const { view } = await renderWith(<LogDetailScreen />, guestState())
    await fireEvent.press(await view.findByLabelText("면발탐정님의 라멘로그 메뉴"))
    expect(router.push).toHaveBeenCalledWith("/auth/login")
    expect(view.queryByText("라멘로그 신고하기")).toBeNull()
    sheet.mockRestore()
  })
})

describe("라멘로그 상세", () => {
  it("shows the whole log and adds a comment", async () => {
    useLocalSearchParams.mockReturnValue({ logId: "5" })
    const { view } = await renderWith(<LogDetailScreen />)

    expect(await view.findByText("도미 시오 라멘")).toBeTruthy()
    expect(view.getByLabelText(/맛 지문.*육수 농도 아주 맑음/)).toBeTruthy()
    expect(view.getByText("첫 댓글을 남겨 대화를 시작해 보세요.")).toBeTruthy()

    const post = view.getByRole("button", { name: "등록" })
    expect(post.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }))

    await fireEvent.changeText(view.getByLabelText("댓글 입력"), "  맑은 시오 좋아하는데 가봐야겠어요  ")
    await fireEvent.press(view.getByRole("button", { name: "등록" }))

    expect(view.getByText("맑은 시오 좋아하는데 가봐야겠어요")).toBeTruthy()
    expect(view.getByText("댓글 1")).toBeTruthy()
    expect(view.getByLabelText("댓글 입력").props.value).toBe("")
    expect(track).toHaveBeenCalledWith("log_commented")
  })

  it("공백을 빼고 1자면 등록을 막고 2자부터 허용한다", async () => {
    useLocalSearchParams.mockReturnValue({ logId: "5" })
    const { view } = await renderWith(<LogDetailScreen />)
    const input = view.getByLabelText("댓글 입력")
    await fireEvent(input, "focus")
    await fireEvent.changeText(input, " 라 ")
    expect(view.getByText("댓글을 2자 이상 입력해 주세요")).toBeTruthy()
    expect(view.getByRole("button", { name: "등록" }).props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }))

    await fireEvent.changeText(input, " 라면 ")
    expect(view.getByRole("button", { name: "등록" }).props.accessibilityState).toEqual(expect.objectContaining({ disabled: false }))
    await fireEvent.press(view.getByRole("button", { name: "등록" }))
    expect(view.getByText("라면")).toBeTruthy()
  })

  it("opens and comments on a BIGINT log without rounding its log or shop ID", async () => {
    const logId = "9007199254740993123"
    const shopId = "9007199254740993124"
    const state = createInitialPersistedState()
    state.logs.unshift({
      ...state.logs[0],
      id: logId,
      shop: { ...state.logs[0].shop, id: shopId },
      comments: [],
      commentCount: 0,
    })
    useLocalSearchParams.mockReturnValue({ logId })
    const { view, repo } = await renderWith(<LogDetailScreen />, state)
    expect(await view.findByTestId("log-detail")).toBeTruthy()

    await fireEvent.press(view.getByRole("button", { name: /매장 정보$/ }))
    expect(router.push).toHaveBeenCalledWith({ pathname: "/shop/[shopId]", params: { shopId } })
    await fireEvent.changeText(view.getByLabelText("댓글 입력"), "큰 ID 댓글")
    await fireEvent.press(view.getByRole("button", { name: "등록" }))
    await waitFor(() => expect(repo.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        logs: expect.arrayContaining([expect.objectContaining({
          id: logId,
          comments: expect.arrayContaining([expect.objectContaining({ logId, content: "큰 ID 댓글" })]),
        })]),
      }),
    ))
  })

  it("shows every taste axis, the photo count, and a shop link on a log detail", async () => {
    useLocalSearchParams.mockReturnValue({ logId: "6" })
    const { view } = await renderWith(<LogDetailScreen />)

    expect(await view.findByText("1 / 2")).toBeTruthy()
    expect(view.getByLabelText(/맛 지문.*만족도.*육수 농도.*면 삶기.*토핑.*재방문/)).toBeTruthy()
    await fireEvent.press(view.getByRole("button", { name: /매장 정보$/ }))
    expect(router.push).toHaveBeenCalledWith({ pathname: "/shop/[shopId]", params: { shopId: expect.any(String) } })
  })

  it("shows the full note on a log detail without clipping", async () => {
    useLocalSearchParams.mockReturnValue({ logId: "6" })
    const { view } = await renderWith(<LogDetailScreen />)
    const note = await view.findByText("멸치 향이 첫 모금부터 확 올라옴. 호불호는 있겠지만 니보시 좋아하면 무조건. 멘마가 두껍고 아삭해서 따로 추가할 만해요.")
    expect(note.props.numberOfLines).toBeUndefined()
  })

  it("shows the counter near the 300-character limit", async () => {
    useLocalSearchParams.mockReturnValue({ logId: "5" })
    const { view } = await renderWith(<LogDetailScreen />)
    const input = await view.findByLabelText("댓글 입력")

    expect(input.props.maxLength).toBe(300)
    await fireEvent.changeText(input, "가".repeat(260))
    expect(view.getByText("260/300")).toBeTruthy()
    await fireEvent.changeText(input, "가".repeat(300))
    expect(view.getByText("댓글은 300자까지 쓸 수 있어요")).toBeTruthy()
  })

  it("lets guests read comments but asks them to log in to write", async () => {
    useLocalSearchParams.mockReturnValue({ logId: "6" })
    const { view } = await renderWith(<LogDetailScreen />, guestState())

    expect(await view.findByText("멘마 추가 팁 감사합니다. 다음엔 꼭 추가해볼게요.")).toBeTruthy()
    expect(view.queryByLabelText("댓글 입력")).toBeNull()
    await fireEvent.press(view.getByRole("button", { name: "로그인하고 댓글 남기기" }))
    expect(router.push).toHaveBeenCalledWith("/auth/login")
  })

  it("hides a commenter's comments right away", async () => {
    const sheet = jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation((_options, callback) => callback(1))
    useLocalSearchParams.mockReturnValue({ logId: "6" })
    const { view } = await renderWith(<LogDetailScreen />)

    await view.findByText("니보시 향이 강하다고 해서 망설였는데 용기 내볼게요.")
    await fireEvent.press(view.getByLabelText("시오러버님의 댓글 메뉴"))
    expect(view.queryByText("니보시 향이 강하다고 해서 망설였는데 용기 내볼게요.")).toBeNull()
    expect(view.getByText("댓글 1")).toBeTruthy()
    sheet.mockRestore()
  })

  it("lets the owner delete their own log after confirming, then leaves the screen", async () => {
    const sheet = jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation((_options, callback) => callback(1))
    useLocalSearchParams.mockReturnValue({ logId: "91" })
    const { view, repo } = await renderWith(<LogDetailScreen />, stateWithPrivateLogs())

    await fireEvent.press(await view.findByLabelText("내 라멘로그 메뉴"))
    expect(sheet).toHaveBeenCalledWith(
      expect.objectContaining({ options: ["수정하기", "삭제하기", "취소"], destructiveButtonIndex: 1 }),
      expect.any(Function),
    )
    expect(view.getByText("이 라멘로그를 삭제할까요?")).toBeTruthy()
    await fireEvent.press(view.getByRole("button", { name: "삭제" }))

    await waitFor(() => expect(router.back).toHaveBeenCalled())
    expect(await view.findByText("라멘로그를 삭제했어요")).toBeTruthy()
    await waitFor(() => {
      const saved = repo.save.mock.lastCall?.[0] as PersistedAppStateV1
      expect(saved.logs.some((log) => log.id === "91")).toBe(false)
    })
    sheet.mockRestore()
  })

  it("keeps the owner's log when the delete confirmation is cancelled", async () => {
    const sheet = jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation((_options, callback) => callback(1))
    useLocalSearchParams.mockReturnValue({ logId: "91" })
    const { view } = await renderWith(<LogDetailScreen />, stateWithPrivateLogs())

    await fireEvent.press(await view.findByLabelText("내 라멘로그 메뉴"))
    await fireEvent.press(view.getByRole("button", { name: "취소" }))
    expect(router.back).not.toHaveBeenCalled()
    expect(view.getByText("내가 공개한 라멘")).toBeTruthy()
    sheet.mockRestore()
  })

  it("opens the record form to edit the owner's log, also for a server-loaded log", async () => {
    const sheet = jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation((_options, callback) => callback(0))
    const state = stateWithPrivateLogs()
    const mine = state.logs.find((log) => log.id === "91") as RamenLog
    isRemote.mockImplementation((domain: string) => domain === "lounge")
    remoteReads.loungeLog.mockResolvedValue({ log: { ...mine, id: "501" }, comments: [], commentCount: 0, nextCursor: null, hasNext: false })
    useLocalSearchParams.mockReturnValue({ logId: "501" })
    try {
      const { view } = await renderWith(<LogDetailScreen />, state)
      expect(await view.findByText("내가 공개한 라멘")).toBeTruthy()
      await fireEvent.press(view.getByLabelText("내 라멘로그 메뉴"))
      expect(router.push).toHaveBeenCalledWith({ pathname: "/record/new", params: { logId: "501" } })
    } finally {
      isRemote.mockImplementation(() => false)
      sheet.mockRestore()
    }
  })

  it("shows an empty state for private, hidden, or unknown logs", async () => {
    const state = stateWithPrivateLogs()
    useLocalSearchParams.mockReturnValue({ logId: "90" })
    const privateView = (await renderWith(<LogDetailScreen />, state)).view
    expect(await privateView.findByText("라멘로그를 볼 수 없어요")).toBeTruthy()
    await privateView.unmount()

    useLocalSearchParams.mockReturnValue({ logId: "4" })
    const hiddenView = (await renderWith(<LogDetailScreen />, { ...createInitialPersistedState(), hiddenAuthorIds: ["user-feed-104"] })).view
    expect(await hiddenView.findByText("라멘로그를 볼 수 없어요")).toBeTruthy()
    await hiddenView.unmount()

    useLocalSearchParams.mockReturnValue({ logId: "9999" })
    const missingView = (await renderWith(<LogDetailScreen />)).view
    expect(await missingView.findByText("라멘로그를 볼 수 없어요")).toBeTruthy()
  })
})

describe("라운지 저장 필드", () => {
  it("loads saves from before the lounge with empty hide and report lists", () => {
    const { hiddenAuthorIds: _hidden, contentReports: _reports, ...old } = createInitialPersistedState()
    const migrated = migratePersistedState(old)
    expect(migrated.hiddenAuthorIds).toEqual([])
    expect(migrated.contentReports).toEqual([])
    expect(migrated.logs.length).toBeGreaterThan(0)
  })

  it("drops malformed hide and report entries", () => {
    const migrated = migratePersistedState({
      ...createInitialPersistedState(),
      hiddenAuthorIds: ["user-1", "", 3, "user-1"],
      contentReports: [{ id: "r1", kind: "log", targetId: 4, reason: "spam", createdAt: "2026-09-19T00:00:00Z" }, { id: "bad", kind: "post" }],
    })
    expect(migrated.hiddenAuthorIds).toEqual(["user-1"])
    expect(migrated.contentReports).toHaveLength(1)
    expect(migrated.contentReports[0].targetId).toBe("4")
  })
})

// act 경고 없이 비동기 저장이 끝나도록 마지막에 한 번 흘려보낸다
afterEach(async () => {
  await act(async () => undefined)
})
