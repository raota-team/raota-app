import { render, waitFor } from "@testing-library/react-native"
import type { ReactElement } from "react"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { createInitialPersistedState } from "@/src/data/fixtures"
import { REMINDER_IDS, deepLinkToPath, planRecordReminders } from "@/src/notifications"
import type { RaotaRepository } from "@/src/repository"
import { RaotaProvider } from "@/src/state/RaotaStore"
import FlowLayout from "@/app/(flows)/_layout"
import RecordCompleteScreen from "@/app/(flows)/record/complete"
import MyScreen from "@/app/native/my"

// 출시 빌드처럼 취향 리포트를 끈 상태. 켠 상태는 다른 화면 테스트들이 본다(jest.setup.ts)
jest.mock("@/src/features", () => ({ TASTE_REPORT_ENABLED: false }))

const mockParams: Record<string, string | undefined> = {}
const mockSegments = { current: ["(flows)", "taste"] }

jest.mock("expo-router", () => {
  const React = require("react") as typeof import("react")
  const { View } = require("react-native") as typeof import("react-native")
  const Stack = ({ children }: { children?: React.ReactNode }) => React.createElement(View, null, children)
  Stack.Screen = () => null
  return {
    Stack,
    Redirect: ({ href }: { href: string }) => React.createElement(View, { testID: `redirect:${href}` }),
    router: { back: jest.fn(), canGoBack: jest.fn(() => true), push: jest.fn(), replace: jest.fn() },
    useIsFocused: jest.fn(() => true),
    useLocalSearchParams: jest.fn(() => mockParams),
    usePathname: jest.fn(() => `/${mockSegments.current.slice(1).join("/")}`),
    useSegments: jest.fn(() => mockSegments.current),
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

jest.mock("expo-notifications")
jest.mock("@/src/analytics", () => ({ track: jest.fn() }))
jest.mock("expo-haptics", () => ({
  ImpactFeedbackStyle: { Light: "light" },
  NotificationFeedbackType: { Success: "success" },
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
}))

const { router } = jest.requireMock("expo-router") as { router: Record<string, jest.Mock> }

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
  mockSegments.current = ["(flows)", "taste"]
  jest.clearAllMocks()
})

describe("taste report switched off (release build)", () => {
  it.each([
    [["(flows)", "taste"]],
    [["(flows)", "taste", "archive"]],
    [["(flows)", "taste", "[reportId]"]],
  ])("sends %j home before asking guests to log in", async (segments) => {
    const state = createInitialPersistedState()
    state.user = null
    mockSegments.current = segments
    await renderScreen(<FlowLayout />, state)
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/native"))
    expect(router.replace).not.toHaveBeenCalledWith(expect.objectContaining({ pathname: "/auth/login" }))
  })

  it("keeps the record flow behind login as before", async () => {
    const state = createInitialPersistedState()
    state.user = null
    mockSegments.current = ["(flows)", "record", "new"]
    await renderScreen(<FlowLayout />, state)
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith({ pathname: "/auth/login", params: { next: "/record/new" } }))
  })

  it("drops the report entries from My but keeps the rest of the tab", async () => {
    const view = await renderScreen(<MyScreen />)

    expect(await view.findByText("라멘로그 캘린더")).toBeTruthy()
    expect(view.queryByTestId("my-report-ticket")).toBeNull()
    expect(view.queryByTestId("my-monthly-entry")).toBeNull()
  })

  it("leaves home as the only action after saving a bowl", async () => {
    mockParams.logId = "1"
    const view = await renderScreen(<RecordCompleteScreen />)

    expect(await view.findByText("취향 기록지")).toBeTruthy()
    expect(view.queryByRole("button", { name: "취향 리포트 보기" })).toBeNull()
    expect(view.getByRole("button", { name: "홈으로" })).toBeTruthy()
  })

  it("schedules only the 7-day reminder and never opens /taste from a notification", () => {
    // 9월 10일, 이번 달 1그릇: 켜져 있으면 월간 리포트 알림도 예약되는 날이다
    const plans = planRecordReminders({ monthCount: 1, now: new Date(2026, 8, 10, 12, 0, 0) })
    expect(plans.map((plan) => plan.identifier)).toEqual([REMINDER_IDS.inactive])

    expect(deepLinkToPath("raota:///taste")).toBeNull()
    expect(deepLinkToPath("raota://record/select-shop?mode=nearby")).toBe("/record/select-shop?mode=nearby")
  })
})
