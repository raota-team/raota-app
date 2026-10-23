import { fireEvent, render, within } from "@testing-library/react-native"
import type * as ReactModule from "react"
import type { ReactElement } from "react"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { SHOPS, createInitialPersistedState } from "@/src/data/fixtures"
import type { RaotaRepository } from "@/src/repository"
import { RaotaProvider } from "@/src/state/RaotaStore"
import HomeScreen from "@/app/native/index"

/* 홈의 인사, 큐레이터, 매장과 라운지 섹션 순서 및 실제 이동을 확인한다. */

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), canGoBack: jest.fn(() => true), navigate: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
  useFocusEffect: (effect: () => void | (() => void)) => jest.requireActual<typeof ReactModule>("react").useEffect(effect, [effect]),
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
  it("greets a member, links their real record status to My, and leads into curation without photo grid pins", async () => {
    const view = await renderHome()

    expect(await view.findByRole("button", { name: /님, 내 정보$/ })).toBeTruthy()
    expect(view.getByLabelText("RAOTA")).toBeTruthy()
    expect(view.getByText("나의 라멘 취향을 찾는 곳")).toBeTruthy()
    expect(view.getByText(/^오늘 (아침|점심|저녁|야식)은\s어떤 라멘으로 할까요\?$/)).toBeTruthy()
    const status = view.getByRole("button", { name: /^이번 달 \d+그릇 · 마지막 기록 (오늘|\d+일 전)$/ })
    await fireEvent.press(status)
    expect(router.navigate).toHaveBeenCalledWith("/native/my")

    const sections = ["home-header", "home-hero", "home-curator", "home-curation", "home-recommendations", "home-nearby", "home-lounge"]
      .map((id) => view.getByTestId(id))
    const scrollContent = sections[0].parent
    expect(sections.every((section) => section.parent === scrollContent)).toBe(true)
    expect(sections.map((section) => scrollContent?.children.indexOf(section))).toEqual([...sections.keys()])
    expect(view.queryByTestId("home-photo-feed")).toBeNull()

    await fireEvent.press(view.getByRole("button", { name: "오늘 뭐 먹지? AI 라멘 큐레이터" }))
    expect(router.push).toHaveBeenCalledWith("/ai-recommend")
    await fireEvent.press(view.getByRole("button", { name: "지도에서 보기" }))
    expect(router.navigate).toHaveBeenCalledWith("/native/map")
  })

  it("keeps the full AI summary below the photo and shop details, then opens that shop", async () => {
    const view = await renderHome()
    const curation = await view.findByTestId("home-curation")
    const summary = within(curation).getByTestId("home-curation-summary")
    const pick = within(curation).getByRole("button", { name: /오늘의 큐레이션, 멘야준/ })

    expect(within(curation).getByLabelText("멘야준 대표 사진")).toBeTruthy()
    expect(within(curation).getByText(/^멘야준/)).toBeTruthy()
    expect(within(curation).getByText(/자가제면 · 닭과 오리 더블 육수/)).toBeTruthy()
    expect(within(summary).queryByText(/^멘야준/)).toBeNull()
    expect(within(summary).getByText("AI가 요약했어요")).toBeTruthy()
    const text = within(summary).getByText(
      "국물이 진하면서도 쇼유 향이 깔끔하게 남는다는 기록이 가장 많아요. 1.5mm 자가제면은 단단한 편이라 면을 중시하는 분들이 자주 추천하고, 주말 점심에는 웨이팅이 길다는 이야기가 이어져요.",
    )
    expect(text.props.numberOfLines).toBeUndefined()
    expect(pick.props.accessibilityLabel).toContain("AI가 요약했어요")
    expect(pick.props.accessibilityLabel).toContain("주말 점심에는 웨이팅이 길다는 이야기가 이어져요.")

    await fireEvent.press(pick)
    expect(router.push).toHaveBeenCalledWith({ pathname: "/shop/[shopId]", params: { shopId: "1" } })
  })

  it("shows a shop description without an AI label when today's pick has no AI summary", async () => {
    const original = SHOPS[0]
    SHOPS[0] = { ...original, aiSummary: undefined }
    try {
      const view = await renderHome()
      const summary = await view.findByTestId("home-curation-summary")
      expect(within(summary).getByText(original.description!)).toBeTruthy()
      expect(within(summary).queryByText("AI가 요약했어요")).toBeNull()
      expect(view.getByRole("button", { name: /오늘의 큐레이션, 멘야준/ }).props.accessibilityLabel).toContain(original.description)
    } finally {
      SHOPS[0] = original
    }
  })

  it("offers guests login and sign-up without inventing a record status or taste counts", async () => {
    const view = await renderHome(true)
    expect(await view.findByTestId("home-curation")).toBeTruthy()
    expect(view.getByText("나의 라멘 취향을 찾는 곳")).toBeTruthy()
    expect(view.getByText(/^오늘 (아침|점심|저녁|야식)은\s어떤 라멘으로 할까요\?$/)).toBeTruthy()
    expect(view.queryByRole("button", { name: /^이번 달/ })).toBeNull()
    expect(view.getByText("처음이라면 여기부터")).toBeTruthy()
    expect(view.queryByText(/그릇 취향 기준/)).toBeNull()
    await fireEvent.press(view.getByRole("button", { name: "로그인" }))
    expect(router.push).toHaveBeenCalledWith("/auth/login")
    await fireEvent.press(view.getByRole("button", { name: "회원가입" }))
    expect(router.push).toHaveBeenCalledWith({ pathname: "/auth/login", params: { mode: "signup" } })
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
