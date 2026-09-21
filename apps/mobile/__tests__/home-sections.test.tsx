import { fireEvent, render } from "@testing-library/react-native"
import type { ReactElement } from "react"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { createInitialPersistedState } from "@/src/data/fixtures"
import type { RaotaRepository } from "@/src/repository"
import { RaotaProvider } from "@/src/state/RaotaStore"
import HomeScreen from "@/app/native/index"

/*
 * 홈의 인사·스타일로 찾기·라운지 미리보기. 기존 홈 테스트(discover-screens)는 그대로 두고 새 섹션만 본다.
 */

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), canGoBack: jest.fn(() => true), navigate: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}))

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

jest.mock("expo-haptics", () => ({
  ImpactFeedbackStyle: { Light: "light" },
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
}))

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: "denied" })),
  getLastKnownPositionAsync: jest.fn(() => Promise.resolve(null)),
  getCurrentPositionAsync: jest.fn(),
}))

jest.mock("@/src/analytics", () => ({ track: jest.fn() }))

jest.mock("@/src/components/RecordFab", () => {
  const React = require("react") as typeof import("react")
  const { View } = require("react-native") as typeof import("react-native")
  return { __esModule: true, default: () => React.createElement(View, { testID: "record-fab" }) }
})

const { router } = jest.requireMock("expo-router") as { router: Record<string, jest.Mock> }

function repository(guest = false): RaotaRepository {
  const state = createInitialPersistedState()
  if (guest) state.user = null
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

async function renderHome(guest = false): Promise<ReturnType<typeof render>> {
  const element: ReactElement = (
    <SafeAreaProvider initialMetrics={safeArea}>
      <RaotaProvider repository={repository(guest)}>
        <HomeScreen />
      </RaotaProvider>
    </SafeAreaProvider>
  )
  return render(element)
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe("home sections", () => {
  it("greets a member with a meal-time question and their record status", async () => {
    const view = await renderHome()

    // 인사는 헤더 오른쪽 계정 바로가기로 옮겼다(누르면 마이 탭)
    expect(await view.findByRole("button", { name: /님, 내 정보$/ })).toBeTruthy()
    expect(view.getByText(/^오늘 (아침|점심|저녁|야식)은\s어떤 라멘으로 할까요\?$/)).toBeTruthy()
    await fireEvent.press(view.getByRole("button", { name: /^이번 달 \d+그릇 · 마지막 기록/ }))
    expect(router.navigate).toHaveBeenCalledWith("/native/my")
  })

  it("keeps the meal-time question for guests without a member status line", async () => {
    const view = await renderHome(true)

    expect(await view.findByText(/어떤 라멘으로 할까요\?$/)).toBeTruthy()
    expect(view.queryByRole("button", { name: /님, 내 정보$/ })).toBeNull()
    expect(view.queryByRole("button", { name: /^이번 달/ })).toBeNull()
  })

  it("opens the map filtered by a ramen style from the style tiles", async () => {
    const view = await renderHome()

    await fireEvent.press(await view.findByRole("button", { name: /^쇼유 라멘집 \d+곳$/ }))
    expect(router.navigate).toHaveBeenCalledWith({ pathname: "/native/map", params: { menu: "쇼유" } })
  })

  it("previews the latest public ramen logs and opens one", async () => {
    const view = await renderHome(true)

    expect(await view.findByText("라운지 새 라멘로그")).toBeTruthy()
    const cards = view.getAllByRole("button", { name: /의 라멘로그, / })
    expect(cards.length).toBeGreaterThan(0)
    expect(cards.length).toBeLessThanOrEqual(5)
    await fireEvent.press(cards[0])
    expect(router.push).toHaveBeenCalledWith({ pathname: "/log/[logId]", params: { logId: expect.any(String) } })

    await fireEvent.press(view.getByRole("button", { name: "라운지 가기" }))
    expect(router.navigate).toHaveBeenCalledWith("/native/lounge")
  })
})
