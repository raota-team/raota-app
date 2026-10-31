import type * as ReactModule from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { act, fireEvent, render } from "@testing-library/react-native"
import type { Shop } from "@raota/shared"
import { SafeAreaProvider } from "react-native-safe-area-context"

import HomeScreen from "@/app/native"
import { createInitialPersistedState } from "@/src/data/fixtures"
import { pickFirstTicket } from "@/src/domain/firstTicket"
import { completeOnboardingTask, loadOnboarding, type OnboardingProgress } from "@/src/onboarding"
import { RAOTA_STORAGE_KEY } from "@/src/repository/LocalRaotaRepository"
import type { RaotaRepository } from "@/src/repository"
import { RaotaProvider } from "@/src/state/RaotaStore"

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), canGoBack: jest.fn(() => true), navigate: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
  useFocusEffect: (effect: () => void | (() => void)) => jest.requireActual<typeof ReactModule>("react").useEffect(effect, [effect]),
}))
jest.mock("lucide-react-native", () => {
  const React = require("react") as typeof import("react")
  const { View } = require("react-native") as typeof import("react-native")
  const Icon = (props: Record<string, unknown>) => React.createElement(View, props)
  return new Proxy({ __esModule: true }, { get: (target, property) => (property === "__esModule" ? target.__esModule : Icon) })
})
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"))
jest.mock("react-native-reanimated", () => ({ ...(require("react-native-reanimated/mock") as object), useReducedMotion: () => false }))
jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: "denied" })),
  getLastKnownPositionAsync: jest.fn(() => Promise.resolve(null)),
  getCurrentPositionAsync: jest.fn(),
}))
jest.mock("@/src/analytics", () => ({ track: jest.fn() }))

const { router } = jest.requireMock("expo-router") as { router: Record<string, jest.Mock> }
const { track } = jest.requireMock("@/src/analytics") as { track: jest.Mock }

function shop(id: string, fields: Partial<Shop>): Shop {
  return { id, name: id, lat: 37.55, lng: 126.91, isOpen: true, reviewCount: 0, rating: 0, distanceM: 0, tags: [], photos: [], ...fields } as unknown as Shop
}

/** 앱을 새로 켠 것처럼 모듈 상태 없이 진행을 읽는다 */
async function relaunch(): Promise<OnboardingProgress | null> {
  let read: OnboardingProgress | null = null
  await jest.isolateModulesAsync(async () => {
    const onboarding = jest.requireActual<typeof import("@/src/onboarding")>("@/src/onboarding")
    await onboarding.loadOnboarding()
    read = onboarding.getOnboardingProgress()
  })
  return read
}

describe("first ticket pick", () => {
  const near = { latitude: 37.5496, longitude: 126.9139 }
  const shops = [
    shop("closed-shoyu-next-door", { lat: 37.5497, lng: 126.914, isOpen: false, style: "쇼유 라멘" } as Partial<Shop>),
    shop("open-shoyu-far", { lat: 37.56, lng: 126.93, reviewCount: 90 }),
    shop("open-shoyu-near", { lat: 37.5501, lng: 126.9145, reviewCount: 1 }),
    shop("open-miso-nearest", { lat: 37.5496, lng: 126.9139, reviewCount: 500 }),
  ]
  const isShoyu = (candidate: Shop) => candidate.id.includes("shoyu")

  it("picks the nearest open shop of the chosen soup", () => {
    const pick = pickFirstTicket(shops, isShoyu, near)
    expect(pick.ranked.map(({ id }) => id)).toEqual(["open-shoyu-near", "open-shoyu-far"])
    expect(pick.ranked[0].distanceM).toBeGreaterThan(0)
    expect(pick).toMatchObject({ soupMatched: true, openOnly: true })
  })

  it("orders by ramen logs without a location, and widens the soup or open filter only when nothing is left", () => {
    expect(pickFirstTicket(shops, isShoyu, null).ranked.map(({ id }) => id)).toEqual(["open-shoyu-far", "open-shoyu-near"])
    const noSoup = pickFirstTicket(shops, () => false, null)
    expect(noSoup.soupMatched).toBe(false)
    expect(noSoup.ranked[0].id).toBe("open-miso-nearest")
    const allClosed = pickFirstTicket([shops[0]], isShoyu, near)
    expect(allClosed).toMatchObject({ openOnly: false })
    expect(allClosed.ranked.map(({ id }) => id)).toEqual(["closed-shoyu-next-door"])
  })
})

describe("onboarding progress", () => {
  beforeEach(async () => {
    await AsyncStorage.clear()
    jest.clearAllMocks()
  })

  it("treats a device that already had app data as returning: no intro and no start card", async () => {
    await AsyncStorage.setItem(RAOTA_STORAGE_KEY, "{}")
    expect(await relaunch()).toEqual({ introShown: true, cardDismissed: true, done: {} })
  })

  it("starts a fresh install with the intro and card, and remembers finished tasks across launches", async () => {
    expect(await relaunch()).toEqual({ introShown: false, cardDismissed: false, done: {} })
    await jest.isolateModulesAsync(async () => {
      const onboarding = jest.requireActual<typeof import("@/src/onboarding")>("@/src/onboarding")
      await onboarding.loadOnboarding()
      onboarding.completeOnboardingTask("map")
      onboarding.completeOnboardingTask("map")
    })
    // 같은 일을 두 번 해도 한 번만 센다
    expect(track.mock.calls.filter(([event]) => event === "onboarding_task_completed")).toEqual([["onboarding_task_completed", { task: "map" }]])
    await act(async () => undefined)
    expect(await relaunch()).toEqual({ introShown: false, cardDismissed: false, done: { map: true } })
  })
})

describe("home for a brand-new guest", () => {
  function guestRepository(): RaotaRepository {
    const state = createInitialPersistedState()
    state.user = null
    return { load: jest.fn().mockResolvedValue(state), save: jest.fn().mockResolvedValue(undefined), clear: jest.fn().mockResolvedValue(undefined) }
  }
  const renderHome = () =>
    render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 } }}>
        <RaotaProvider repository={guestRepository()}>
          <HomeScreen />
        </RaotaProvider>
      </SafeAreaProvider>,
    )

  it("opens the first ticket once, then the start card tracks real actions until it is closed", async () => {
    await AsyncStorage.clear()
    await loadOnboarding()

    const home = await renderHome()
    expect(await home.findByText("처음이라면 이것부터")).toBeTruthy()
    expect(router.push).toHaveBeenCalledWith({ pathname: "/ai-recommend", params: { welcome: "1" } })
    expect(home.getByLabelText("3가지 중 0가지 했어요")).toBeTruthy()

    await act(async () => completeOnboardingTask("map"))
    expect(home.getByLabelText("3가지 중 1가지 했어요")).toBeTruthy()
    expect(home.getByRole("button", { name: "내 근처 문 연 라멘집 보기, 했어요" })).toBeTruthy()
    await fireEvent.press(home.getByRole("button", { name: "오늘의 식권 한 장 뽑기" }))
    expect(router.push).toHaveBeenCalledWith("/ai-recommend")
    await home.unmount()

    // 다시 켜도 첫 식권은 다시 열지 않는다
    router.push.mockClear()
    const again = await renderHome()
    expect(await again.findByText("처음이라면 이것부터")).toBeTruthy()
    expect(router.push).not.toHaveBeenCalledWith({ pathname: "/ai-recommend", params: { welcome: "1" } })
    await fireEvent.press(again.getByRole("button", { name: "처음 안내 닫기" }))
    expect(again.queryByText("처음이라면 이것부터")).toBeNull()
    await again.unmount()
    const closed = await renderHome()
    expect(await closed.findByRole("button", { name: "오늘 뭐 먹지? AI 라멘 큐레이터" })).toBeTruthy()
    expect(closed.queryByText("처음이라면 이것부터")).toBeNull()
  })
})
