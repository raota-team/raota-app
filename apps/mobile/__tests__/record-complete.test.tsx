import AsyncStorage from "@react-native-async-storage/async-storage"
import { act, fireEvent, render, waitFor } from "@testing-library/react-native"
import { useState, type ReactElement } from "react"
import { Pressable, StyleSheet } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import type { CreateRamenLogInput } from "@raota/shared"
import { createInitialPersistedState } from "@/src/data/fixtures"
import type { RaotaRepository } from "@/src/repository"
import { RaotaProvider, useRaota } from "@/src/state/RaotaStore"
import RecordCompleteScreen from "@/app/(flows)/record/complete"
import { REMINDER_DECISION_KEY, REMINDER_PROMPT_DELAY } from "@/src/notifications"

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

/** 데모 계정의 42그릇 평균을 기준으로 재방문 점수가 가장 크게 벗어나는 기록 */
const logInput: CreateRamenLogInput = {
  shopId: "1",
  menuName: "특제 쇼유 라멘",
  ramenType: "쇼유",
  visitedAt: "2026-09-18",
  note: "",
  tasteNotes: { broth: [], noodle: [], seasoning: [], topping: [] },
  scores: { satisfaction: 4, brothDensity: 5, noodleFirmness: 4, topping: 4, revisit: 5 },
  revisit: "자주 감",
  isPublic: false,
}

/** 기록을 만든 뒤 그 logId로 완료 화면을 띄운다(작성 화면의 router.replace와 같은 순서) */
function CreateThenComplete({ input = logInput }: { input?: CreateRamenLogInput }) {
  const { actions } = useRaota()
  const [ready, setReady] = useState(false)
  if (ready) return <RecordCompleteScreen />
  return (
    <Pressable
      accessibilityLabel="기록 생성"
      accessibilityRole="button"
      onPress={async () => {
        const log = await actions.createLog(input)
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

function renderScreen(element: ReactElement, state = createInitialPersistedState()) {
  return render(
    <SafeAreaProvider initialMetrics={safeArea}>
      <RaotaProvider repository={repository(state)}>{element}</RaotaProvider>
    </SafeAreaProvider>,
  )
}

async function renderCreatedLog(input = logInput, state = createInitialPersistedState()) {
  const view = await renderScreen(<CreateThenComplete input={input} />, state)
  await fireEvent.press(view.getByRole("button", { name: "기록 생성" }))
  await view.findByText("기록이 저장됐어요")
  return view
}

beforeEach(() => {
  delete mockParams.logId
})

describe("record complete screen", () => {
  it("shows a five-axis ticket and the largest honest difference for the 43rd bowl", async () => {
    const view = await renderCreatedLog()

    expect(view.getByLabelText("43번째 그릇")).toBeTruthy()
    expect(view.getByText("기록이 저장됐어요")).toBeTruthy()
    expect(view.getByText("멘야준 · 특제 쇼유 라멘")).toBeTruthy()
    expect(view.getByText("· 2026.09.18 · No. 0043")).toBeTruthy()
    expect(view.getByLabelText("전체 만족도 4점")).toBeTruthy()
    expect(view.getByLabelText("육수 농도 5점")).toBeTruthy()
    expect(view.getByLabelText("면 삶기 4점")).toBeTruthy()
    expect(view.getByLabelText("토핑 4점")).toBeTruthy()
    expect(view.getByLabelText("재방문 자주 감")).toBeTruthy()
    expect(view.queryByText("나만 보기")).toBeNull()
    expect(view.getByText("RAOTA 식권 · 한 그릇")).toBeTruthy()
    expect(view.getByLabelText("완식 도장, 26.09.18")).toBeTruthy()
    expect(view.getByText("평소보다 재방문 의사를 높게 남긴 그릇이에요.")).toBeTruthy()
    expect(StyleSheet.flatten(view.getByTestId("record-complete-meta").props.style).flexWrap).toBe("wrap")
    expect(view.getByText("자주").props.numberOfLines).toBeUndefined()
    expect(StyleSheet.flatten(view.getByText("평소보다 재방문 의사를 높게 남긴 그릇이에요.").props.style).marginTop).toBe(16)
    expect(view.queryByText("내 취향 변화")).toBeNull()
  })

  it("shows the log photo on the ticket when one was saved", async () => {
    const view = await renderCreatedLog({ ...logInput, imageUrl: "https://example.com/ramen.jpg", photos: ["https://example.com/ramen.jpg"] })

    expect(view.getByLabelText("특제 쇼유 라멘 사진")).toBeTruthy()
    expect(view.queryByText("RAOTA 식권 · 한 그릇")).toBeNull()
  })

  it("puts the saved memo before a derived score summary", async () => {
    const view = await renderCreatedLog({ ...logInput, note: "  국물 향이 오래 남았어요.  ", isPublic: true })

    expect(view.getByText("국물 향이 오래 남았어요.")).toBeTruthy()
    expect(view.queryByText("평소보다 재방문 의사를 높게 남긴 그릇이에요.")).toBeNull()
    expect(view.queryByText("공개")).toBeNull()
  })

  it("describes the broth direction when broth differs most from previous bowls", async () => {
    const view = await renderCreatedLog({ ...logInput, revisit: "가끔 생각남" })

    expect(view.getByLabelText("재방문 가끔 생각남")).toBeTruthy()
    expect(view.getByText("평소보다 육수를 진하게 느낀 그릇이에요.")).toBeTruthy()
  })

  it("describes the first scored bowl without claiming a previous average", async () => {
    const state = createInitialPersistedState()
    state.user = { ...state.user!, id: "user-new", visitedCount: 0 }
    state.logs = []
    const view = await renderCreatedLog(logInput, state)

    expect(view.getByLabelText("1번째 그릇")).toBeTruthy()
    expect(view.getByText("첫 기록이에요.")).toBeTruthy()
  })

  it("shows the saved note for a legacy log without scores", async () => {
    const state = createInitialPersistedState()
    state.logs[0].scores = undefined
    mockParams.logId = "1"
    const view = await renderScreen(<RecordCompleteScreen />, state)

    expect(await view.findByText("멘야준 · 특제 쇼유 라멘")).toBeTruthy()
    expect(view.getByText(state.logs[0].note)).toBeTruthy()
    expect(view.queryByText("내 취향 변화")).toBeNull()
  })

  it("finds a saved log by its full BIGINT route ID", async () => {
    const logId = "9007199254740993123"
    const state = createInitialPersistedState()
    state.logs[0].id = logId
    mockParams.logId = logId
    const view = await renderScreen(<RecordCompleteScreen />, state)

    expect(await view.findByText("멘야준 · 특제 쇼유 라멘")).toBeTruthy()
    expect(view.queryByText("기록을 찾을 수 없어요")).toBeNull()
  })

  it("shows the empty state for an unknown logId", async () => {
    mockParams.logId = "9999"
    const view = await renderScreen(<RecordCompleteScreen />)

    expect(await view.findByText("기록을 찾을 수 없어요")).toBeTruthy()
    expect(view.getByRole("button", { name: "홈으로" })).toBeTruthy()
  })

  it("routes both fixed actions", async () => {
    const { router } = jest.requireMock("expo-router") as { router: { replace: jest.Mock } }
    router.replace.mockClear()
    const view = await renderCreatedLog()

    await fireEvent.press(view.getByRole("button", { name: "취향 리포트 보기" }))
    expect(router.replace).toHaveBeenLastCalledWith("/taste")
    await fireEvent.press(view.getByRole("button", { name: "홈으로" }))
    expect(router.replace).toHaveBeenCalledTimes(2)
    expect(router.replace).toHaveBeenLastCalledWith("/native")
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
  /** 안내는 완료 화면을 읽을 시간을 준 뒤에 뜬다. 그보다 오래 기다려도 안 뜨는지 본다 */
  const promptTimeout = REMINDER_PROMPT_DELAY + 1500
  const waitLongerThanPromptDelay = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, REMINDER_PROMPT_DELAY + 300)))

  beforeEach(async () => {
    jest.clearAllMocks()
    notifications.getPermissionsAsync.mockResolvedValue(undetermined)
    await AsyncStorage.clear()
  })

  it("explains first, then asks the system permission and schedules reminders", async () => {
    const view = await renderCreatedLog()

    expect(await view.findByText(prompt, undefined, { timeout: promptTimeout })).toBeTruthy()
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
    await fireEvent.press(await view.findByRole("button", { name: "괜찮아요" }, { timeout: promptTimeout }))

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
