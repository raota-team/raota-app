import type * as ReactModule from "react"
import type * as ReactNativeModule from "react-native"
import { fireEvent, render, waitFor, within } from "@testing-library/react-native"
import { StyleSheet } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import MapScreen from "@/app/native/map"
import { createInitialPersistedState } from "@/src/data/fixtures"
import type { RaotaRepository } from "@/src/repository"
import { RaotaProvider } from "@/src/state/RaotaStore"
import { colors } from "@/src/theme"

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  // 홈 "스타일로 찾기"가 넘기는 메뉴 필터 파라미터. 이 테스트에서는 없다
  useLocalSearchParams: jest.fn(() => ({})),
  useIsFocused: jest.fn(() => true),
}))

jest.mock("lucide-react-native", () => {
  const React = require("react") as typeof ReactModule
  const { View } = require("react-native") as typeof ReactNativeModule
  const Icon = (props: Record<string, unknown>) =>
    React.createElement(View, props)
  return new Proxy({ __esModule: true }, {
    get: (target, property) =>
      property === "__esModule" ? target.__esModule : Icon,
  })
})

const mockAnimateToRegion = jest.fn()

jest.mock("react-native-maps", () => {
  const React = require("react") as typeof ReactModule
  const { Pressable, View } = require("react-native") as typeof ReactNativeModule
  const MapView = React.forwardRef(function MapView(
    {
      children,
      showsUserLocation,
    }: {
      children?: React.ReactNode
      showsUserLocation?: boolean
    },
    ref,
  ) {
    React.useImperativeHandle(ref, () => ({ animateToRegion: mockAnimateToRegion }))
    return React.createElement(
      View,
      {
        testID: "apple-map",
        accessibilityState: { selected: Boolean(showsUserLocation) },
      },
      children,
    )
  })
  const Marker = ({
    children,
    accessibilityLabel,
    onPress,
  }: {
    children?: React.ReactNode
    accessibilityLabel?: string
    onPress?: () => void
  }) => React.createElement(Pressable, { accessibilityLabel, onPress }, children)
  return { __esModule: true, default: MapView, Marker, UrlTile: () => null }
})

jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"))
jest.mock("react-native-reanimated", () => ({
  ...(require("react-native-reanimated/mock") as object),
  useReducedMotion: () => false,
}))
jest.mock("expo-haptics", () => ({ selectionAsync: jest.fn(() => Promise.resolve()) }))

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(() => Promise.resolve(null)),
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
    // 거절해도 기본 지역의 지도와 지도 위 퀵뷰는 그대로 쓴다
    expect(view.getByTestId("apple-map").props.accessibilityState.selected).toBe(false)
    expect(await view.findByRole("button", { name: /매장 상세 보기/ })).toBeTruthy()
    expect(within(view.getByTestId("map-surface")).getByRole("button", { name: /매장 상세 보기/ })).toBeTruthy()
    const selectedPin = await view.findByTestId("selected-map-pin")
    const regularPin = view.getAllByTestId("unselected-map-pin")[0]
    expect(within(regularPin).queryByTestId("map-pin-label")).toBeNull()
    expect(within(selectedPin).getByTestId("map-pin-label")).toBeTruthy()
    expect(within(selectedPin).getByTestId("map-pin-logo")).toBeTruthy()
    // 핀이 선택되지 않았을 때도 원을 감싼 탭 영역은 최소 44pt이다.
    expect(StyleSheet.flatten(regularPin.props.style).minWidth).toBeGreaterThanOrEqual(44)
    expect(StyleSheet.flatten(regularPin.props.style).height).toBeGreaterThanOrEqual(44)
    expect(StyleSheet.flatten(selectedPin.props.style).height).toBeGreaterThanOrEqual(44)
    expect(StyleSheet.flatten(view.getByRole("button", { name: "기본 지역으로 이동" }).props.style).height).toBeGreaterThanOrEqual(44)
  })

  it("reveals only the selected shop name and updates its quick view when a pin is pressed", async () => {
    const location = jest.requireMock("expo-location") as { requestForegroundPermissionsAsync: jest.Mock }
    location.requestForegroundPermissionsAsync.mockResolvedValue({ status: "denied" })

    const view = await render(<MapHarness />)
    const regularPin = (await view.findAllByTestId("unselected-map-pin"))[0]
    const marker = regularPin.parent
    const name = marker?.props.accessibilityLabel as string
    expect(name).toBeTruthy()

    await fireEvent.press(marker!)
    const selectedPin = view.getByTestId("selected-map-pin")
    expect(within(selectedPin).getByText(name)).toBeTruthy()
    expect(within(selectedPin).getByTestId("map-pin-label")).toBeTruthy()
    expect(view.getByRole("button", { name: /매장 상세 보기/ }).props.accessibilityLabel).toContain(name)
    expect(view.getAllByTestId("unselected-map-pin").every((pin) => within(pin).queryByTestId("map-pin-label") === null)).toBe(true)
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

  it("centers on the user's location the first time the map opens", async () => {
    const location = jest.requireMock("expo-location") as {
      requestForegroundPermissionsAsync: jest.Mock
      getCurrentPositionAsync: jest.Mock
    }
    location.requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted" })
    location.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 37.501, longitude: 127.039 } })
    mockAnimateToRegion.mockClear()

    await render(<MapHarness />)

    await waitFor(() => {
      expect(mockAnimateToRegion).toHaveBeenCalledWith(expect.objectContaining({ latitude: 37.501, longitude: 127.039 }), expect.any(Number))
    })
  })

  it("keeps the open lamp, reset and list sort usable across map/list views", async () => {
    const location = jest.requireMock("expo-location") as {
      requestForegroundPermissionsAsync: jest.Mock
    }
    location.requestForegroundPermissionsAsync.mockResolvedValue({ status: "denied" })

    const view = await render(<MapHarness />)
    const openFilter = view.getByRole("switch", { name: "영업 중인 곳만 보기" })
    expect(StyleSheet.flatten(openFilter.props.style).gap).toBe(6)
    expect(StyleSheet.flatten(openFilter.props.style).height).toBe(40)
    expect(StyleSheet.flatten(view.getByRole("button", { name: /메뉴 필터/ }).props.style).height).toBe(40)
    expect(StyleSheet.flatten(view.getByTestId("map-open-lamp").props.style).backgroundColor).toEqual(colors.open)
    const quickView = await view.findByRole("button", { name: /매장 상세 보기/ })
    expect(StyleSheet.flatten(within(quickView).getByTestId("map-open-status-lamp").props.style).backgroundColor).toEqual(colors.open)
    expect(StyleSheet.flatten(within(quickView).getByText("영업 중").props.style).color).toEqual(colors.open)
    expect(view.getByRole("switch", { name: "영업 중인 곳만 보기" }).props.accessibilityState.checked).toBe(false)
    await fireEvent.press(view.getByRole("switch", { name: "영업 중인 곳만 보기" }))
    expect(view.getByRole("switch", { name: "영업 중인 곳만 보기" }).props.accessibilityState.checked).toBe(true)
    await fireEvent.press(view.getByRole("button", { name: "필터 초기화" }))
    expect(view.getByRole("switch", { name: "영업 중인 곳만 보기" }).props.accessibilityState.checked).toBe(false)
    await fireEvent.changeText(view.getByLabelText("라멘집 검색"), "없는라멘집")
    expect(within(view.getByTestId("map-surface")).getByText("조건에 맞는 라멘집이 없어요")).toBeTruthy()
    await fireEvent.press(view.getByRole("button", { name: "검색어 지우기" }))

    await fireEvent.press(view.getByRole("button", { name: "목록으로 보기" }))
    expect(view.queryByTestId("map-surface")).toBeNull()
    expect(view.getByText("위치 권한이 없어 망원·합정 일대를 보여드려요.")).toBeTruthy()
    expect((await view.findAllByRole("button", { name: /매장 상세 보기/ })).length).toBeGreaterThan(0)
    const listRow = view.getAllByRole("button", { name: /매장 상세 보기/ })[0]
    expect(StyleSheet.flatten(within(listRow).getByTestId("map-open-status-lamp").props.style).backgroundColor).toEqual(colors.open)
    expect(StyleSheet.flatten(within(listRow).getByText("영업 중").props.style).color).toEqual(colors.open)
    expect(StyleSheet.flatten(listRow.props.style).paddingVertical).toBe(12)
    expect(StyleSheet.flatten(within(listRow).getByTestId("map-list-meta").props.style).flexWrap).toBe("wrap")
    expect(view.getByRole("radio", { name: "거리순" }).props.accessibilityState.checked).toBe(true)
    await fireEvent.press(view.getByRole("radio", { name: "인기순" }))
    expect(view.getByRole("radio", { name: "인기순" }).props.accessibilityState.checked).toBe(true)
  })
})
