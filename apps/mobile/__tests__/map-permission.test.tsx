import { render, waitFor } from "@testing-library/react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { createInitialPersistedState } from "@/src/data/fixtures"
import type { RaotaRepository } from "@/src/repository"
import { RaotaProvider } from "@/src/state/RaotaStore"
import MapScreen from "@/app/native/map"

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  // 홈 "스타일로 찾기"가 넘기는 메뉴 필터 파라미터. 이 테스트에서는 없다
  useLocalSearchParams: jest.fn(() => ({})),
}))

jest.mock("lucide-react-native", () => {
  const React = require("react") as typeof import("react")
  const { View } = require("react-native") as typeof import("react-native")
  const Icon = (props: Record<string, unknown>) =>
    React.createElement(View, props)
  return new Proxy({ __esModule: true }, {
    get: (target, property) =>
      property === "__esModule" ? target.__esModule : Icon,
  })
})

jest.mock("react-native-maps", () => {
  const React = require("react") as typeof import("react")
  const { View } = require("react-native") as typeof import("react-native")
  const MapView = ({
    children,
    showsUserLocation,
  }: {
    children?: React.ReactNode
    showsUserLocation?: boolean
  }) =>
    React.createElement(
      View,
      {
        testID: "apple-map",
        accessibilityState: { selected: Boolean(showsUserLocation) },
      },
      children,
    )
  const Marker = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, null, children)
  return { __esModule: true, default: MapView, Marker }
})

jest.mock("expo-haptics", () => ({ selectionAsync: jest.fn(() => Promise.resolve()) }))

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}))

function repository(): RaotaRepository {
  return {
    load: jest.fn().mockResolvedValue(createInitialPersistedState()),
    save: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  }
}

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
}

function MapHarness() {
  return (
    <SafeAreaProvider initialMetrics={safeAreaMetrics}>
      <RaotaProvider repository={repository()}>
        <MapScreen />
      </RaotaProvider>
    </SafeAreaProvider>
  )
}

describe("map location permission states", () => {
  beforeEach(() => jest.clearAllMocks())

  it("keeps a manual Seoul fallback and settings path when permission is denied", async () => {
    const location = jest.requireMock("expo-location") as {
      requestForegroundPermissionsAsync: jest.Mock
    }
    location.requestForegroundPermissionsAsync.mockResolvedValue({
      status: "denied",
    })

    const view = await render(<MapHarness />)

    expect(
      await view.findByText("위치 권한이 없어 망원·합정 일대를 보여드려요."),
    ).toBeTruthy()
    expect(view.getByRole("button", { name: "설정 열기" })).toBeTruthy()
    // 거절해도 기본 지역의 지도와 하단 퀵뷰는 그대로 쓴다
    expect(view.getByTestId("apple-map").props.accessibilityState.selected).toBe(false)
    expect(view.getByRole("button", { name: /매장 상세 보기/ })).toBeTruthy()
  })

  it("enables the native user-location layer after permission is granted", async () => {
    const location = jest.requireMock("expo-location") as {
      requestForegroundPermissionsAsync: jest.Mock
      getCurrentPositionAsync: jest.Mock
    }
    location.requestForegroundPermissionsAsync.mockResolvedValue({
      status: "granted",
    })
    location.getCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 37.55, longitude: 126.91 },
    })

    const view = await render(<MapHarness />)

    await waitFor(() => {
      expect(
        view.getByTestId("apple-map").props.accessibilityState.selected,
      ).toBe(true)
    })
  })
})
