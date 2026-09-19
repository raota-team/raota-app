import AsyncStorage from "@react-native-async-storage/async-storage"
import { act, fireEvent, render, waitFor, within } from "@testing-library/react-native"
import { useState, type ReactElement } from "react"
import { Pressable } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import type { CreateRamenLogInput } from "@raota/shared"
import { createInitialPersistedState } from "@/src/data/fixtures"
import type { RaotaRepository } from "@/src/repository"
import { RaotaProvider, useRaota } from "@/src/state/RaotaStore"
import RecordCompleteScreen from "@/app/(flows)/record/complete"
import { REMINDER_DECISION_KEY } from "@/src/notifications"

const mockParams: { logId?: string } = {}

jest.mock("expo-router", () => {
  const React = require("react") as typeof import("react")
  const { View } = require("react-native") as typeof import("react-native")
  const Stack = ({ children }: { children?: React.ReactNode }) => React.createElement(View, null, children)
  Stack.Screen = () => null
  return {
    Stack,
    router: { back: jest.fn(), canGoBack: jest.fn(() => true), push: jest.fn(), replace: jest.fn() },
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

// 기록 리마인더 권한·예약은 __mocks__/expo-notifications.ts로 흉내 낸다
jest.mock("expo-notifications")

// jest에는 worklets 네이티브 모듈이 없어 공식 mock을 쓴다. mock에 없는 useReducedMotion만 채운다
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"))
jest.mock("react-native-reanimated", () => ({
  ...(require("react-native-reanimated/mock") as object),
  useReducedMotion: () => false,
}))

function repository(state = createInitialPersistedState()): RaotaRepository {
  return {
    load: jest.fn().mockResolvedValue(state),
    save: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  }
}

/** 데모 계정(42그릇)에 5축 점수가 있는 기록을 하나 더한다. 육수 농도 3.9 평균에 5점 → 3.90 → 3.93 */
const logInput: CreateRamenLogInput = {
  shopId: 1,
  menuName: "특제 쇼유 라멘",
  ramenType: "쇼유",
  visitedAt: "2026-09-18",
  note: "",
  tasteNotes: { broth: [], noodle: [], seasoning: [], topping: [] },
  scores: { satisfaction: 4, brothDensity: 5, noodleFirmness: 4, topping: 3, revisit: 5 },
  revisit: "자주 감",
  isPublic: false,
}

/** 기록을 만든 뒤 그 logId로 완료 화면을 띄운다(작성 화면의 router.replace와 같은 순서) */
function CreateThenComplete() {
  const { actions } = useRaota()
  const [ready, setReady] = useState(false)
  if (ready) return <RecordCompleteScreen />
  return (
    <Pressable
      accessibilityLabel="기록 생성"
      accessibilityRole="button"
      onPress={async () => {
        const log = await actions.createLog(logInput)
        mockParams.logId = String(log.id)
        setReady(true)
      }}
    />
  )
}

const safeArea = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
}

function renderScreen(element: ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={safeArea}>
      <RaotaProvider repository={repository()}>{element}</RaotaProvider>
    </SafeAreaProvider>,
  )
}

async function renderCreatedLog() {
  const view = await renderScreen(<CreateThenComplete />)
  await fireEvent.press(view.getByRole("button", { name: "기록 생성" }))
  await view.findByLabelText("내 취향 변화")
  return view
}

beforeEach(() => {
  delete mockParams.logId
})

describe("record complete screen", () => {
  it("shows the 43rd bowl, its ticket, and an honest one-line summary", async () => {
    const view = await renderCreatedLog()

    expect(view.getByLabelText("43번째 그릇")).toBeTruthy()
    expect(view.getByText("티켓 2026-0918-43")).toBeTruthy()
    expect(view.getByText("특제 쇼유 라멘")).toBeTruthy()
    expect(view.getByText(/2026\.09\.18/)).toBeTruthy()
    expect(view.getByLabelText("사진 없음")).toBeTruthy()
    expect(
      view.getByText("멘야준의 쇼유 한 그릇. 이번 그릇은 육수 농도 5점이 가장 높았고, 재방문 의사는 ‘자주 감’으로 남겼어요."),
    ).toBeTruthy()
  })

  it("shows the five-axis change with an arrow and a two-decimal delta", async () => {
    const view = await renderCreatedLog()
    const section = view.getByLabelText("내 취향 변화")

    expect(within(section).getByText("42그릇 → 43그릇 평균")).toBeTruthy()
    // 육수 농도: 42그릇 평균 3.9에 5점 → 반올림 전 3.9256 → "3.90 → 3.93", +0.03
    const broth = within(section).getByLabelText("육수 농도 이번 그릇 5점, 평균 3.90 → 3.93, +0.03")
    expect(within(broth).getByText(/3\.90 →/)).toBeTruthy()
    expect(within(broth).getByText("+0.03")).toBeTruthy()
    // 면 삶기: 평균 4.0에 4점 → 변화 없음
    expect(within(section).getByText("변화 없음")).toBeTruthy()
    expect(within(section).getAllByText(/→/).length).toBeGreaterThanOrEqual(5)
    expect(within(section).getAllByText(/^(?:[+-]\d\.\d{2}|변화 없음)$/)).toHaveLength(5)
  })

  it("hides the change section when the log has no five-axis scores", async () => {
    // 데모 계정의 기존 기록(id 1)은 점수 없이 남은 옛 기록이다
    mockParams.logId = "1"
    const view = await renderScreen(<RecordCompleteScreen />)

    expect(await view.findByText("특제 쇼유 라멘")).toBeTruthy()
    expect(view.queryByLabelText("내 취향 변화")).toBeNull()
    expect(view.queryByText("내 취향 변화")).toBeNull()
  })

  it("shows the empty state for an unknown logId", async () => {
    mockParams.logId = "9999"
    const view = await renderScreen(<RecordCompleteScreen />)

    expect(await view.findByText("기록을 찾을 수 없어요")).toBeTruthy()
    expect(view.getByRole("button", { name: "홈으로" })).toBeTruthy()
  })

  it("shows both CTAs immediately and routes them with replace", async () => {
    const { router } = jest.requireMock("expo-router") as { router: { replace: jest.Mock } }
    const view = await renderCreatedLog()

    const taste = view.getByRole("button", { name: "취향 리포트 보기" })
    const home = view.getByRole("button", { name: "홈으로" })
    expect(taste).toBeTruthy()
    expect(home).toBeTruthy()

    await fireEvent.press(taste)
    expect(router.replace).toHaveBeenCalledWith("/taste")
    await fireEvent.press(home)
    expect(router.replace).toHaveBeenCalledWith("/native")
  })
})

describe("record reminder opt-in on the complete screen", () => {
  const notifications = jest.requireMock("expo-notifications") as {
    getPermissionsAsync: jest.Mock
    requestPermissionsAsync: jest.Mock
    scheduleNotificationAsync: jest.Mock
  }
  const undetermined = { status: "undetermined", granted: false, canAskAgain: true, expires: "never" }
  const granted = { status: "granted", granted: true, canAskAgain: true, expires: "never" }
  const prompt = "다음 달 리포트가 나올 즈음 알려드릴까요?"
  /** 안내는 인장 연출 뒤(0.9초)에 뜬다. 그보다 오래 기다려도 안 뜨는지 본다 */
  const waitLongerThanPromptDelay = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 1200)))

  beforeEach(async () => {
    jest.clearAllMocks()
    notifications.getPermissionsAsync.mockResolvedValue(undetermined)
    await AsyncStorage.clear()
  })

  it("explains first, then asks the system permission and schedules reminders", async () => {
    const view = await renderCreatedLog()

    expect(await view.findByText(prompt, undefined, { timeout: 2000 })).toBeTruthy()
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled()

    notifications.getPermissionsAsync.mockResolvedValue(granted)
    await fireEvent.press(view.getByRole("button", { name: "알림 받기" }))

    await waitFor(() => expect(notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(notifications.scheduleNotificationAsync).toHaveBeenCalled())
    expect(await AsyncStorage.getItem(REMINDER_DECISION_KEY)).toBe("accepted")
    await waitFor(() => expect(view.queryByText(prompt)).toBeNull())
  })

  it("remembers a no without asking the system", async () => {
    const view = await renderCreatedLog()
    await fireEvent.press(await view.findByRole("button", { name: "괜찮아요" }, { timeout: 2000 }))

    await waitFor(() => expect(view.queryByText(prompt)).toBeNull())
    expect(await AsyncStorage.getItem(REMINDER_DECISION_KEY)).toBe("declined")
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled()
  })

  it("does not ask again once an answer is stored", async () => {
    await AsyncStorage.setItem(REMINDER_DECISION_KEY, "declined")
    const view = await renderCreatedLog()

    await waitLongerThanPromptDelay()
    expect(view.queryByText(prompt)).toBeNull()
  })

  it("quietly reschedules without asking when permission is already granted", async () => {
    notifications.getPermissionsAsync.mockResolvedValue(granted)
    const view = await renderCreatedLog()

    await waitFor(() => expect(notifications.scheduleNotificationAsync).toHaveBeenCalled())
    await waitLongerThanPromptDelay()
    expect(view.queryByText(prompt)).toBeNull()
  })
})
