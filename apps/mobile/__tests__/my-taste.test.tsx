import { fireEvent, render, waitFor, within } from "@testing-library/react-native"
import type { ReactElement } from "react"
import { Share } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { createInitialPersistedState } from "@/src/data/fixtures"
import type { RaotaRepository } from "@/src/repository"
import { RaotaProvider } from "@/src/state/RaotaStore"
import MyScreen from "@/app/native/my"
import TasteReportScreen from "@/app/(flows)/taste/index"
import MonthlyTasteScreen from "@/app/(flows)/taste/archive"
import MonthlyTasteReportScreen from "@/app/(flows)/taste/[reportId]"

const mockParams: Record<string, string | undefined> = {}

jest.mock("expo-router", () => {
  const React = require("react") as typeof import("react")
  const { View } = require("react-native") as typeof import("react-native")
  const Stack = ({ children }: { children?: React.ReactNode }) => React.createElement(View, null, children)
  Stack.Screen = () => null
  return {
    Stack,
    router: { back: jest.fn(), canGoBack: jest.fn(() => true), push: jest.fn(), replace: jest.fn() },
    useIsFocused: jest.fn(() => true),
    useLocalSearchParams: jest.fn(() => mockParams),
  }
})

jest.mock("lucide-react-native", () => {
  const React = require("react") as typeof import("react")
  const { View } = require("react-native") as typeof import("react-native")
  const Icon = (props: Record<string, unknown>) => React.createElement(View, props)
  return new Proxy({ __esModule: true }, {
    get: (target, property) => (property === "__esModule" ? target.__esModule : Icon),
  })
})

jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"))
jest.mock("react-native-reanimated", () => ({
  ...(require("react-native-reanimated/mock") as object),
  useReducedMotion: () => false,
}))

jest.mock("@/src/analytics", () => ({ track: jest.fn() }))

// 약관 시트는 계정·앱 구조 담당 부품이다. 여기서는 열린 종류만 확인한다
jest.mock("@/src/components/PolicySheet", () => {
  const React = require("react") as typeof import("react")
  const { Text } = require("react-native") as typeof import("react-native")
  return {
    __esModule: true,
    default: ({ type }: { type: string | null }) => (type ? React.createElement(Text, null, `policy:${type}`) : null),
  }
})

const { router } = jest.requireMock("expo-router") as { router: Record<string, jest.Mock> }
const { track } = jest.requireMock("@/src/analytics") as { track: jest.Mock }

function repository(state = createInitialPersistedState()): RaotaRepository {
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

function renderScreen(element: ReactElement, state = createInitialPersistedState()) {
  return render(
    <SafeAreaProvider initialMetrics={safeArea}>
      <RaotaProvider repository={repository(state)}>{element}</RaotaProvider>
    </SafeAreaProvider>,
  )
}

beforeEach(() => {
  for (const key of Object.keys(mockParams)) delete mockParams[key]
  jest.clearAllMocks()
})

describe("my screen (demo account)", () => {
  it("shows the charcoal profile, identity report card, and ledger numbers", async () => {
    const view = await renderScreen(<MyScreen />)

    expect(await view.findByText("뿡")).toBeTruthy()
    expect(view.getByText("라오타 라멘클럽 회원 · #RT-0842")).toBeTruthy()
    expect(view.getByLabelText("총 라멘로그 42그릇")).toBeTruthy()
    // 정체성 제목과 그 아래 판정 근거
    expect(view.getByText("진한 돈골파")).toBeTruthy()
    expect(view.getByText("누적 42그릇 중 돈코츠 14그릇 · 육수 농도 평균 3.9")).toBeTruthy()
    expect(view.getByText("#진한 육수")).toBeTruthy()

    await fireEvent.press(view.getByRole("button", { name: "종합 리포트 보기" }))
    expect(router.push).toHaveBeenCalledWith("/taste")
    await fireEvent.press(view.getByRole("button", { name: "최근 기록으로 다시 정리" }))
    expect(router.push).toHaveBeenCalledWith({ pathname: "/taste", params: { analyze: "1" } })
  })

  it("has only three activity tabs and keeps the calendar under 라멘로그", async () => {
    const view = await renderScreen(<MyScreen />)
    await view.findByText("뿡")

    const tabs = view.getAllByRole("tab")
    expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual(["라멘로그 42", expect.stringMatching(/^방문매장 \d+$/), "가고싶어요 4"])
    expect(view.queryByText("작성글")).toBeNull()
    expect(view.getByText("라멘로그 캘린더")).toBeTruthy()

    await fireEvent.press(view.getByRole("tab", { name: /^방문매장/ }))
    expect(view.queryByText("라멘로그 캘린더")).toBeNull()
    expect(view.getByText(/방문 수를 더하면 총 42그릇이에요/)).toBeTruthy()

    await fireEvent.press(view.getByRole("tab", { name: "가고싶어요 4" }))
    await fireEvent.press(view.getByRole("button", { name: "멘야준 저장 해제" }))
    expect(view.getByRole("tab", { name: "가고싶어요 3" })).toBeTruthy()
    expect(view.getByText("'멘야준' 저장을 해제했어요")).toBeTruthy()
  })

  it("confirms logout in a dialog and then shows only the guest prompt", async () => {
    const view = await renderScreen(<MyScreen />)
    await view.findByText("뿡")

    await fireEvent.press(view.getByRole("button", { name: "로그아웃" }))
    expect(view.getByText("로그아웃할까요?")).toBeTruthy()
    expect(view.getByText("기록과 취향 리포트는 계정에 그대로 남아 있어요.")).toBeTruthy()
    const buttons = view.getAllByRole("button", { name: "로그아웃" })
    await fireEvent.press(buttons[buttons.length - 1])

    expect(await view.findByText("내 라멘 취향을 모아보세요")).toBeTruthy()
    expect(view.queryByText("뿡")).toBeNull()
    expect(view.queryByText("진한 돈골파")).toBeNull()
    expect(view.getByRole("button", { name: "로그인" })).toBeTruthy()
    expect(view.getByRole("button", { name: "회원가입" })).toBeTruthy()
  })

  it("shows five recent bowls first and loads five more at a time", async () => {
    const view = await renderScreen(<MyScreen />)
    await view.findByText("뿡")
    const remaining = () =>
      Number(/(\d+)그릇 남음/.exec(view.getByRole("button", { name: /^기록 더 보기/ }).props.accessibilityLabel)?.[1])
    const total = Number(/총 (\d+)그릇/.exec(view.getByText(/^총 \d+그릇$/).props.children.join(""))?.[1])

    expect(remaining()).toBe(total - 5)
    await fireEvent.press(view.getByRole("button", { name: /^기록 더 보기/ }))
    expect(remaining()).toBe(total - 10)
  })

  it("opens the full terms page from the info section", async () => {
    const view = await renderScreen(<MyScreen />)
    await view.findByText("뿡")
    await fireEvent.press(view.getByRole("button", { name: "이용약관" }))
    expect(router.push).toHaveBeenCalledWith({ pathname: "/legal/[doc]", params: { doc: "terms" } })
    expect(view.getByRole("button", { name: "문의하기, contact@raota.net" })).toBeTruthy()
  })

  it("shows a natural empty state for a new member with zero bowls", async () => {
    const state = createInitialPersistedState()
    state.user = { ...state.user!, id: "local-new", nickname: "새회원", name: "새회원", visitedCount: 0, membershipNo: "#RT-000001" }
    state.bookmarkedShopIds = []
    const view = await renderScreen(<MyScreen />, state)

    expect(await view.findByText("새회원")).toBeTruthy()
    expect(view.getByLabelText("총 라멘로그 0그릇")).toBeTruthy()
    expect(view.getByText("아직 취향을 모으는 중")).toBeTruthy()
    expect(view.getByText("아직 기록이 없어요")).toBeTruthy()
    expect(view.queryByText("진한 돈골파")).toBeNull()
  })
})

describe("taste report", () => {
  it("shows the identity, five axes from the real average, and tracks the view", async () => {
    const view = await renderScreen(<TasteReportScreen />)

    expect(await view.findByText("진한 돈골파")).toBeTruthy()
    expect(view.getByLabelText(/^항목별 맛 평가 그래프\. 전체 만족도 4\.3점, 육수 농도 3\.9점/)).toBeTruthy()
    expect(view.getByLabelText("돈코츠 14그릇, 33%")).toBeTruthy()
    expect(view.getByText("자주 간 라멘집")).toBeTruthy()
    expect(track).toHaveBeenCalledWith("report_viewed", { kind: "overall", bowls: 42 })
  })

  it("closes quietly when the share sheet is dismissed", async () => {
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: Share.dismissedAction })
    const view = await renderScreen(<TasteReportScreen />)
    await view.findByText("진한 돈골파")

    await fireEvent.press(view.getByRole("button", { name: "취향 리포트 공유" }))
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("진한 돈골파") }),
    )
    expect(view.queryByText(/공유했어요|복사했어요/)).toBeNull()
    expect(view.queryByText("공유하지 못했어요")).toBeNull()
  })

  it("offers the text to copy when sharing fails", async () => {
    jest.spyOn(Share, "share").mockRejectedValue(new Error("unsupported"))
    const view = await renderScreen(<TasteReportScreen />)
    await view.findByText("진한 돈골파")

    await fireEvent.press(view.getByRole("button", { name: "취향 리포트 공유" }))
    await waitFor(() => expect(view.getByText("공유하지 못했어요")).toBeTruthy())
  })

  it("shows the short analysis first when asked, with a skip button", async () => {
    mockParams.analyze = "1"
    const view = await renderScreen(<TasteReportScreen />)

    expect(await view.findByText("기록한 42그릇을 바탕으로 분석해요")).toBeTruthy()
    await fireEvent.press(view.getByRole("button", { name: "결과 바로 보기" }))
    expect(await view.findByText("진한 돈골파")).toBeTruthy()
    expect(view.getByText("전체 42그릇으로 취향을 다시 정리했어요")).toBeTruthy()
  })
})

describe("monthly taste", () => {
  it("lets the user pick a past month and compares it with the previous month", async () => {
    const view = await renderScreen(<MonthlyTasteScreen />)
    await view.findByText("월별 취향 변화")

    await fireEvent.press(view.getByRole("tab", { name: "2026년 8월" }))
    expect(view.getByText("8월의 취향")).toBeTruthy()
    expect(view.getByText("지난달과 달라진 메뉴")).toBeTruthy()
    expect(within(view.getByLabelText("2026년 8월 라멘 종류별 그릇 수와 비율")).getAllByText(/%p|—/).length).toBeGreaterThan(0)
  })

  it("opens the month given by the route id", async () => {
    mockParams.reportId = "2026-07"
    const view = await renderScreen(<MonthlyTasteReportScreen />)
    expect(await view.findByText("7월의 취향")).toBeTruthy()
    expect(view.getByRole("tab", { name: "2026년 7월" }).props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    )
  })
})
