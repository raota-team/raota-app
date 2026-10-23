import type * as ReactModule from "react"
import type * as ReactNativeModule from "react-native"
import { fireEvent, render, waitFor, within } from "@testing-library/react-native"
import { StyleSheet } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import MapScreen from "@/app/native/map"
import { SHOPS, createInitialPersistedState } from "@/src/data/fixtures"
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

const mockAnimateRegionTo = jest.fn()
const mockAnimateCameraTo = jest.fn()
const mockSetLocationTrackingMode = jest.fn()

jest.mock("@mj-studio/react-native-naver-map", () => {
  const React = require("react") as typeof ReactModule
  const { Pressable, View } = require("react-native") as typeof ReactNativeModule
  const NaverMapView = React.forwardRef(function NaverMapView(
    { children, onInitialized }: { children?: React.ReactNode; onInitialized?: () => void },
    ref,
  ) {
    React.useImperativeHandle(ref, () => ({
      animateRegionTo: mockAnimateRegionTo,
      animateCameraTo: mockAnimateCameraTo,
      setLocationTrackingMode: mockSetLocationTrackingMode,
    }))
    React.useEffect(() => {
      onInitialized?.()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    return React.createElement(View, { testID: "naver-map" }, children)
  })
  // 네이버 마커는 접근성 이름을 받지 못한다. 테스트는 좌표(accessibilityValue)로 어느 가게 핀인지 찾는다
  const NaverMapMarkerOverlay = ({
    children,
    image,
    latitude,
    longitude,
    onTap,
    width,
    height,
  }: {
    children?: React.ReactNode
    image?: unknown
    latitude: number
    longitude: number
    onTap?: () => void
    width?: number
    height?: number
  }) =>
    React.createElement(
      Pressable,
      {
        accessibilityValue: { text: `${latitude},${longitude}` },
        onPress: onTap,
        style: { width, height },
        testID: image === undefined ? "map-view-marker" : "map-image-marker",
      },
      children,
    )
  return { __esModule: true, NaverMapView, NaverMapMarkerOverlay }
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

/** 마커가 가리키는 가게(좌표가 같은 가게) */
function shopAt(marker: { props: { accessibilityValue?: { text?: string } } }) {
  const [lat, lng] = (marker.props.accessibilityValue?.text ?? "").split(",").map(Number)
  return SHOPS.find((shop) => shop.lat === lat && shop.lng === lng)
}

/** 기기에서는 투명한 사본이 그려지며 이름표 폭을 잰다. 테스트에서는 그 잰 값을 직접 보낸다 */
async function measureLabel(view: Awaited<ReturnType<typeof render>>, width = 80) {
  await fireEvent(view.getByTestId("map-pin-label-measure"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width, height: 28 } } })
}

describe("map location permission states", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    const { useLocalSearchParams } = jest.requireMock("expo-router") as { useLocalSearchParams: jest.Mock }
    useLocalSearchParams.mockReturnValue({})
  })

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
    // 거절해도 기본 지역의 지도는 그대로 쓰고, 내 위치 점은 켜지 않는다. 처음에는 아무 가게도 고르지 않아 카드가 없다
    expect(view.getByTestId("naver-map")).toBeTruthy()
    expect(mockSetLocationTrackingMode).not.toHaveBeenCalled()
    const regularPin = (await view.findAllByTestId("map-image-marker"))[0]
    expect(view.queryByTestId("map-pin-label")).toBeNull()
    expect(view.queryByRole("button", { name: /매장 상세 보기/ })).toBeNull()
    // 핀 원을 감싼 탭 영역은 최소 44pt이다.
    expect(StyleSheet.flatten(regularPin.props.style).width).toBeGreaterThanOrEqual(44)
    expect(StyleSheet.flatten(regularPin.props.style).height).toBeGreaterThanOrEqual(44)
    // 핀을 누르면 고르고 이름표와 카드가 뜬다. 카드의 ✕로 다시 풀 수 있다
    await fireEvent.press(regularPin)
    await measureLabel(view)
    expect(view.getByTestId("map-pin-label")).toBeTruthy()
    expect(within(view.getByTestId("map-surface")).getByRole("button", { name: /매장 상세 보기/ })).toBeTruthy()
    expect(StyleSheet.flatten(view.getByRole("button", { name: "기본 지역으로 이동" }).props.style).height).toBeGreaterThanOrEqual(44)
    await fireEvent.press(view.getByRole("button", { name: "선택 해제" }))
    expect(view.queryByTestId("map-pin-label")).toBeNull()
    expect(view.queryByRole("button", { name: /매장 상세 보기/ })).toBeNull()
  })

  it("reveals only the selected shop name and updates its quick view when a pin is pressed", async () => {
    const location = jest.requireMock("expo-location") as { requestForegroundPermissionsAsync: jest.Mock }
    location.requestForegroundPermissionsAsync.mockResolvedValue({ status: "denied" })

    const view = await render(<MapHarness />)
    const marker = (await view.findAllByTestId("map-image-marker"))[0]
    const name = shopAt(marker)?.name as string
    expect(name).toBeTruthy()

    await fireEvent.press(marker)
    // 이름표는 잰 폭이 오기 전에는 그리지 않는다(넓은 칸으로 찍히면 옆 묶음의 탭을 가로챈다)
    expect(view.queryByTestId("map-pin-label")).toBeNull()
    await measureLabel(view, 83.2)
    // 이름표는 고른 가게 하나에만 붙고, 마커 칸 폭은 잰 이름표 폭과 같다
    expect(view.getAllByTestId("map-pin-label")).toHaveLength(1)
    expect(within(view.getByTestId("map-pin-label")).getByText(name)).toBeTruthy()
    const labelMarker = view.getAllByTestId("map-view-marker").find((item) => within(item).queryByTestId("map-pin-label"))!
    expect(StyleSheet.flatten(labelMarker.props.style).width).toBe(84)
    expect(view.getByRole("button", { name: /매장 상세 보기/ }).props.accessibilityLabel).toContain(name)
  })

  it("focuses a shop from a BIGINT route ID and keeps that ID in navigation", async () => {
    const shopId = "9007199254740993123"
    const original = SHOPS[1]
    SHOPS[1] = { ...original, id: shopId }
    const location = jest.requireMock("expo-location") as { requestForegroundPermissionsAsync: jest.Mock }
    const { router, useLocalSearchParams } = jest.requireMock("expo-router") as {
      router: { push: jest.Mock }
      useLocalSearchParams: jest.Mock
    }
    location.requestForegroundPermissionsAsync.mockResolvedValue({ status: "denied" })
    useLocalSearchParams.mockReturnValue({ shopId, focus: "1" })
    try {
      const view = await render(<MapHarness />)
      const quickView = await view.findByRole("button", { name: /후쿠 라멘.*매장 상세 보기/ })
      await fireEvent.press(quickView)
      expect(router.push).toHaveBeenCalledWith({ pathname: "/shop/[shopId]", params: { shopId } })
    } finally {
      SHOPS[1] = original
    }
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
    const menyajun = SHOPS.find((shop) => shop.name === "멘야준")!
    await fireEvent.press(view.getAllByTestId("map-image-marker").find((marker) => shopAt(marker)?.id === menyajun.id)!)
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

  // 지도는 앱이 켜진 동안 마지막 내 위치(모듈 변수)에서 다시 시작한다. 아래 위치 허용 테스트가 강남 좌표를 남기면
  // 그 뒤 테스트의 지도는 강남에서 열려 망원 매장 핀이 화면 밖이 된다(보이는 곳의 핀만 그린다). 그래서 핀을 누르는 테스트는 그 위에 둔다
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

    await render(<MapHarness />)

    await waitFor(() => {
      expect(mockSetLocationTrackingMode).toHaveBeenCalledWith("NoFollow")
    })
  })

  it("centers on the user's location the first time the map opens", async () => {
    const location = jest.requireMock("expo-location") as {
      requestForegroundPermissionsAsync: jest.Mock
      getCurrentPositionAsync: jest.Mock
    }
    location.requestForegroundPermissionsAsync.mockResolvedValue({ status: "granted" })
    location.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 37.501, longitude: 127.039 } })
    mockAnimateRegionTo.mockClear()

    await render(<MapHarness />)

    // 네이버 지도의 영역은 남서쪽 모서리가 기준이다. 넘긴 영역의 가운데가 내 위치여야 한다
    await waitFor(() => {
      const target = mockAnimateRegionTo.mock.calls.at(-1)?.[0] as { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }
      expect(target.latitude + target.latitudeDelta / 2).toBeCloseTo(37.501, 6)
      expect(target.longitude + target.longitudeDelta / 2).toBeCloseTo(127.039, 6)
    })
  })
})
