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

const { router, useLocalSearchParams } = jest.requireMock("expo-router") as {
  router: { push: jest.Mock; back: jest.Mock; replace: jest.Mock }
  useLocalSearchParams: jest.Mock
}
const { track } = jest.requireMock("@/src/analytics") as { track: jest.Mock }
const haptics = jest.requireMock("expo-haptics") as { impactAsync: jest.Mock }

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

beforeEach(() => {
  jest.clearAllMocks()
  useLocalSearchParams.mockReturnValue({})
})

describe("라운지 피드", () => {
  it("starts with an unselected 전체 sort chip while keeping the feed newest first", async () => {
    const { view } = await renderWith(<LoungeScreen />)
    const chip = view.getByRole("button", { name: "정렬, 전체" })
    expect(chip.props.accessibilityHint).toContain("정렬 메뉴")
    expect(chip.props.accessibilityState.selected).toBe(false)
    expect(view.getByText("전체 ▾")).toBeTruthy()
    expect((await view.findByTestId("lounge-log-4")).props.testID).toBe("lounge-log-4")
    expect(within(view.getByTestId("lounge-column-0")).getAllByTestId(/^lounge-log-/)[0].props.testID).toBe("lounge-log-4")
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
    // 두 열은 최신순으로 번갈아 배치되므로 첫 줄의 왼쪽과 오른쪽에 두 최신 기록이 놓인다.
    const left = within(view.getByTestId("lounge-column-0")).getAllByTestId(/^lounge-log-/)
    const right = within(view.getByTestId("lounge-column-1")).getAllByTestId(/^lounge-log-/)
    expect([left[0].props.testID, right[0].props.testID]).toEqual(["lounge-log-91", "lounge-log-4"])
    expect(track).toHaveBeenCalledWith("lounge_viewed")
    // 화면 문구에 내부 용어를 쓰지 않는다
    expect(view.queryByText(/5축|취향 여권/)).toBeNull()
  })

  it("filters by ramen type and chooses, dismisses, and resets the anchored sort menu", async () => {
    const measure = jest.spyOn(View.prototype, "measureInWindow").mockImplementation((callback) => callback(16, 120, 96, 40))
    const { view } = await renderWith(<LoungeScreen />)
    await view.findByTestId("lounge-log-4")

    await fireEvent.press(view.getByRole("button", { name: "시오 라멘만 보기" }))
    expect(within(view.getByTestId("lounge-column-0")).getByTestId("lounge-log-5")).toBeTruthy()
    expect(within(view.getByTestId("lounge-column-1")).getByTestId("lounge-log-8")).toBeTruthy()
    expect(view.getByRole("button", { name: "시오 라멘만 보기" }).props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    )

    await fireEvent.press(view.getByRole("button", { name: "정렬, 전체" }))
    expect(measure).toHaveBeenCalled()
    expect(view.getByTestId("lounge-sort-menu")).toBeTruthy()
    expect(view.getByRole("button", { name: "전체" }).props.accessibilityState.selected).toBe(true)
    expect(view.getByRole("button", { name: "최신순" }).props.accessibilityState.selected).toBe(false)
    await fireEvent.press(view.getByTestId("lounge-sort-dismiss", { includeHiddenElements: true }))
    expect(view.queryByTestId("lounge-sort-menu")).toBeNull()
    expect(view.getByRole("button", { name: "정렬, 전체" }).props.accessibilityState.selected).toBe(false)

    await fireEvent.press(view.getByRole("button", { name: "정렬, 전체" }))
    await fireEvent.press(view.getByRole("button", { name: "최신순" }))
    expect(view.getByRole("button", { name: "정렬, 최신순" }).props.accessibilityState.selected).toBe(true)
    expect(view.getByText("최신순 ▾")).toBeTruthy()
    expect(within(view.getByTestId("lounge-column-0")).getByTestId("lounge-log-5")).toBeTruthy()

    await fireEvent.press(view.getByRole("button", { name: "정렬, 최신순" }))
    expect(view.getByRole("button", { name: "최신순" }).props.accessibilityState.selected).toBe(true)
    await fireEvent.press(view.getByRole("button", { name: "인기순" }))
    expect(view.getByRole("button", { name: "정렬, 인기순" }).props.accessibilityState.selected).toBe(true)
    expect(within(view.getByTestId("lounge-column-0")).getByTestId("lounge-log-8")).toBeTruthy()
    expect(within(view.getByTestId("lounge-column-1")).getByTestId("lounge-log-5")).toBeTruthy()

    await fireEvent.press(view.getByRole("button", { name: "정렬, 인기순" }))
    expect(view.getByRole("button", { name: "인기순" }).props.accessibilityState.selected).toBe(true)
    await fireEvent.press(view.getByRole("button", { name: "전체" }))
    expect(view.getByRole("button", { name: "정렬, 전체" }).props.accessibilityState.selected).toBe(false)
    expect(within(view.getByTestId("lounge-column-0")).getByTestId("lounge-log-5")).toBeTruthy()

    // 결과가 없는 종류는 빈 상태와 "전체 보기"
    await fireEvent.press(view.getByRole("button", { name: "탄탄멘 라멘만 보기" }))
    expect(view.getByText("탄탄멘 라멘로그가 아직 없어요")).toBeTruthy()
    await fireEvent.press(view.getByRole("button", { name: "전체 보기" }))
    expect(within(view.getByTestId("lounge-column-0")).getAllByTestId(/^lounge-log-/)[0].props.testID).toBe("lounge-log-4")
    measure.mockRestore()
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
