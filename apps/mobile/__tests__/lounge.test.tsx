import { act, fireEvent, render, waitFor, within } from "@testing-library/react-native"
import type { ReactElement } from "react"
import { ActionSheetIOS } from "react-native"
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
  const base = state.logs.find((log) => log.id === 4) as RamenLog
  const othersPrivate: RamenLog = {
    ...base,
    id: 90,
    author: { id: "user-feed-900", name: "비공개작성자", level: "라멘 입문자 (Lv.2)" },
    menuName: "남의 비공개 라멘",
    isPublic: false,
    createdAt: "2026-09-19T09:00:00+09:00",
    comments: [],
    commentCount: 0,
  }
  const minePublic: RamenLog = {
    ...base,
    id: 91,
    author: { id: state.user?.id, name: state.user?.nickname ?? "", level: "라멘집 단골 (Lv.4)" },
    menuName: "내가 공개한 라멘",
    isPublic: true,
    createdAt: "2026-09-19T08:00:00+09:00",
    comments: [],
    commentCount: 0,
  }
  const minePrivate: RamenLog = { ...minePublic, id: 92, menuName: "내 비공개 라멘", isPublic: false, createdAt: "2026-09-19T07:00:00+09:00" }
  return { ...state, logs: [othersPrivate, minePublic, minePrivate, ...state.logs] }
}

beforeEach(() => {
  jest.clearAllMocks()
  useLocalSearchParams.mockReturnValue({})
})

describe("라운지 피드", () => {
  it("shows public logs only (mine included), newest first, and tracks the visit", async () => {
    const { view } = await renderWith(<LoungeScreen />, stateWithPrivateLogs())

    expect(await view.findByText("내가 공개한 라멘")).toBeTruthy()
    expect(view.queryByText("남의 비공개 라멘")).toBeNull()
    expect(view.queryByText("내 비공개 라멘")).toBeNull()
    // 내 기록에는 신고·숨기기 메뉴가 없다
    const mine = view.getByTestId("lounge-log-91")
    expect(within(mine).getByText("내 기록")).toBeTruthy()
    expect(within(mine).queryByLabelText(/라멘로그 메뉴/)).toBeNull()
    // 최신순: 방금 공개한 내 기록 → 9월 18일 이에케
    const cards = view.getAllByTestId(/^lounge-log-/).map((card) => card.props.testID)
    expect(cards.slice(0, 2)).toEqual(["lounge-log-91", "lounge-log-4"])
    expect(track).toHaveBeenCalledWith("lounge_viewed")
    // 화면 문구에 내부 용어를 쓰지 않는다
    expect(view.queryByText(/5축|취향 여권/)).toBeNull()
  })

  it("filters by ramen type and sorts by 공감순", async () => {
    const { view } = await renderWith(<LoungeScreen />)
    await view.findByTestId("lounge-log-4")

    await fireEvent.press(view.getByRole("button", { name: "시오 라멘만 보기" }))
    const shio = view.getAllByTestId(/^lounge-log-/).map((card) => card.props.testID)
    expect(shio).toEqual(["lounge-log-5", "lounge-log-8"])
    expect(view.getByRole("button", { name: "시오 라멘만 보기" }).props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    )

    await fireEvent.press(view.getByRole("button", { name: "공감순 정렬" }))
    expect(view.getAllByTestId(/^lounge-log-/).map((card) => card.props.testID)).toEqual(["lounge-log-8", "lounge-log-5"])

    // 결과가 없는 종류는 빈 상태와 "전체 보기"
    await fireEvent.press(view.getByRole("button", { name: "탄탄멘 라멘만 보기" }))
    expect(view.getByText("탄탄멘 라멘로그가 아직 없어요")).toBeTruthy()
    await fireEvent.press(view.getByRole("button", { name: "전체 보기" }))
    expect(view.getAllByTestId(/^lounge-log-/)[0].props.testID).toBe("lounge-log-11")
  })

  it("toggles 공감 with a haptic and keeps the count in the store", async () => {
    const { view } = await renderWith(<LoungeScreen />)
    const card = await view.findByTestId("lounge-log-4")

    await fireEvent.press(within(card).getByRole("button", { name: "공감 5개" }))
    const liked = within(view.getByTestId("lounge-log-4")).getByRole("button", { name: "공감 6개" })
    expect(liked.props.accessibilityState).toEqual(expect.objectContaining({ selected: true }))
    expect(haptics.impactAsync).toHaveBeenCalled()
    expect(track).toHaveBeenCalledWith("log_liked")

    await fireEvent.press(liked)
    expect(within(view.getByTestId("lounge-log-4")).getByRole("button", { name: "공감 5개" })).toBeTruthy()
  })

  it("sends a guest who presses 공감 to login without changing the count", async () => {
    const { view } = await renderWith(<LoungeScreen />, guestState())
    const card = await view.findByTestId("lounge-log-4")

    await fireEvent.press(within(card).getByRole("button", { name: "공감 5개" }))
    expect(router.push).toHaveBeenCalledWith("/auth/login")
    expect(within(view.getByTestId("lounge-log-4")).getByRole("button", { name: "공감 5개" })).toBeTruthy()
  })

  it("hides every log of an author at once, persists it, and can undo", async () => {
    const sheet = jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation((_options, callback) => callback(1))
    const { view, repo } = await renderWith(<LoungeScreen />)
    await view.findByTestId("lounge-log-4")
    await fireEvent.press(view.getByRole("button", { name: "공감순 정렬" }))
    // 공감순: 삿포로 미소(11) · 멘마수집가의 니보시(6) · 멘마수집가의 멘야준(1) · 유자 시오(8)
    expect(view.getByTestId("lounge-log-6")).toBeTruthy()
    expect(view.getByTestId("lounge-log-1")).toBeTruthy()

    await fireEvent.press(within(view.getByTestId("lounge-log-6")).getByLabelText("멘마수집가님의 라멘로그 메뉴"))
    expect(sheet).toHaveBeenCalledWith(
      expect.objectContaining({ options: ["신고하기", "이 사용자 숨기기", "취소"] }),
      expect.any(Function),
    )
    expect(view.queryByTestId("lounge-log-6")).toBeNull()
    expect(view.queryByTestId("lounge-log-1")).toBeNull()
    expect(view.getByText("멘마수집가님의 글을 더 이상 보여주지 않아요.")).toBeTruthy()
    // 그 사람이 남의 기록에 단 댓글도 세지 않는다(상세와 같은 수)
    expect(within(view.getByTestId("lounge-log-8")).getByRole("button", { name: "댓글 0개" })).toBeTruthy()
    expect(track).toHaveBeenCalledWith("author_hidden")
    await waitFor(() =>
      expect(repo.save).toHaveBeenLastCalledWith(expect.objectContaining({ hiddenAuthorIds: ["user-201"] })),
    )

    await fireEvent.press(view.getByRole("button", { name: "되돌리기" }))
    expect(view.getByTestId("lounge-log-6")).toBeTruthy()
    sheet.mockRestore()
  })

  it("reports a log with a reason, then stops showing it to the reporter", async () => {
    const sheet = jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation((_options, callback) => callback(0))
    const { view, repo } = await renderWith(<LoungeScreen />)
    const card = await view.findByTestId("lounge-log-4")

    await fireEvent.press(within(card).getByLabelText("면발탐정님의 라멘로그 메뉴"))
    expect(view.getByText("라멘로그 신고하기")).toBeTruthy()
    const submit = view.getByRole("button", { name: "신고하기" })
    expect(submit.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }))
    expect(view.getByText("신고 사유를 고르면 보낼 수 있어요")).toBeTruthy()

    await fireEvent.press(view.getByRole("radio", { name: "스팸·홍보" }))
    await fireEvent.press(view.getByRole("button", { name: "신고하기" }))

    expect(view.getByText("신고를 접수했어요. 검토 후 조치할게요.")).toBeTruthy()
    expect(view.queryByTestId("lounge-log-4")).toBeNull()
    expect(track).toHaveBeenCalledWith("content_reported", { kind: "log", reason: "spam" })
    await waitFor(() =>
      expect(repo.save).toHaveBeenLastCalledWith(
        expect.objectContaining({ contentReports: [expect.objectContaining({ kind: "log", targetId: 4, reason: "spam" })] }),
      ),
    )
    sheet.mockRestore()
  })

  it("sends a guest who picks 신고하기 to login instead of opening the form", async () => {
    const sheet = jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation((_options, callback) => callback(0))
    const { view } = await renderWith(<LoungeScreen />, guestState())
    const card = await view.findByTestId("lounge-log-4")

    await fireEvent.press(within(card).getByLabelText("면발탐정님의 라멘로그 메뉴"))
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
    expect(view.getByText("맛 평가")).toBeTruthy()
    expect(view.getByText("아주 맑음")).toBeTruthy()
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
  })
})

// act 경고 없이 비동기 저장이 끝나도록 마지막에 한 번 흘려보낸다
afterEach(async () => {
  await act(async () => undefined)
})
