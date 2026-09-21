import { act, fireEvent, render, waitFor } from "@testing-library/react-native"
import { useState, type ReactElement } from "react"
import { Linking, Pressable } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { createInitialPersistedState } from "@/src/data/fixtures"
import type { RaotaRepository } from "@/src/repository"
import { RaotaProvider, useRaota } from "@/src/state/RaotaStore"
import HomeScreen from "@/app/native/index"
import ShopDetailScreen from "@/app/(flows)/shop/[shopId]"
import AIRecommendScreen from "@/app/(flows)/ai-recommend"

const mockParams: { shopId?: string } = {}

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), canGoBack: jest.fn(() => true), navigate: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => mockParams),
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

// 떠 있는 기록 버튼은 계정·앱 구조 담당 부품이다. 여기서는 홈이 렌더하는지만 본다
jest.mock("@/src/components/RecordFab", () => {
  const React = require("react") as typeof import("react")
  const { View } = require("react-native") as typeof import("react-native")
  return { __esModule: true, default: () => React.createElement(View, { testID: "record-fab" }) }
})

const { router } = jest.requireMock("expo-router") as { router: Record<string, jest.Mock> }
const { track } = jest.requireMock("@/src/analytics") as { track: jest.Mock }

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

async function renderScreen(element: ReactElement, guest = false) {
  const view = await render(
    <SafeAreaProvider initialMetrics={safeArea}>
      <RaotaProvider repository={repository(guest)}>{element}</RaotaProvider>
    </SafeAreaProvider>,
  )
  return view
}

const INITIAL = createInitialPersistedState()
const NICKNAME = INITIAL.user?.nickname ?? ""

afterEach(() => {
  jest.useRealTimers()
})

beforeEach(() => {
  jest.clearAllMocks()
  delete mockParams.shopId
})

describe("home", () => {
  it("shows curator, today's pick, personal picks and nearby shops without match % or fake banners", async () => {
    const view = await renderScreen(<HomeScreen />)
    expect(await view.findByRole("button", { name: /님, 내 정보$/ })).toBeTruthy()
    expect(view.getByRole("button", { name: "오늘 뭐 먹지? AI 라멘 큐레이터" })).toBeTruthy()
    expect(view.getByText("오늘의 픽")).toBeTruthy()
    // 오늘의 픽은 원장에 있는 값으로만 고른 이유를 보여주고, 아래 목록에 같은 매장을 다시 넣지 않는다
    expect(view.getByText("1만~1.5만원")).toBeTruthy()
    expect(view.getByText("영업 중 · 라스트오더 20:30")).toBeTruthy()
    expect(view.getAllByText(/^멘야준/)).toHaveLength(1)
    // 데모 계정은 돈코츠를 가장 많이 먹었고 육수 농도 평균이 진한 쪽이다. 이유는 그 근거만 쓴다
    expect(view.getByText(`${NICKNAME}님이 좋아할 라멘집`)).toBeTruthy()
    expect(view.getAllByText(/돈코츠를 가장 자주 드셔서/).length).toBeGreaterThan(0)
    expect(view.getByText("가까운 라멘집")).toBeTruthy()
    expect(view.getByTestId("record-fab")).toBeTruthy()

    expect(view.queryByText(/%/)).toBeNull()
    expect(view.queryByText(/TODAY/)).toBeNull()
    expect(view.queryByText(/취향 리포트에 반영/)).toBeNull()
    expect(view.queryByText(/맞춤 추천이 갱신/)).toBeNull()
    expect(view.queryByRole("button", { name: /알림/ })).toBeNull()
  })

  it("opens the curator and leaves legal links to My and login", async () => {
    const view = await renderScreen(<HomeScreen />)
    await fireEvent.press(await view.findByRole("button", { name: "오늘 뭐 먹지? AI 라멘 큐레이터" }))
    expect(router.push).toHaveBeenCalledWith("/ai-recommend")
    expect(view.queryByText(/문의하기/)).toBeNull()
  })

  it("lets guests browse and offers login and sign-up", async () => {
    const view = await renderScreen(<HomeScreen />, true)
    await fireEvent.press(await view.findByRole("button", { name: "로그인" }))
    expect(router.push).toHaveBeenCalledWith("/auth/login")
    expect(view.getByRole("button", { name: "회원가입" })).toBeTruthy()
    expect(view.queryByRole("button", { name: /님, 내 정보$/ })).toBeNull()
    expect(view.getByText("처음이라면 여기부터")).toBeTruthy()
    expect(view.queryByText(/가장 자주 드셔서/)).toBeNull()
    expect(view.getByText("가까운 라멘집")).toBeTruthy()
  })
})

describe("shop detail", () => {
  it("shows honest empty states for a shop with little data and no match section", async () => {
    mockParams.shopId = "2"
    const view = await renderScreen(<ShopDetailScreen />)
    expect(await view.findByText(/^후쿠 라멘/)).toBeTruthy()
    expect(view.getByText("가게 소개")).toBeTruthy()
    expect(view.queryByText("리뷰 요약")).toBeNull()
    // 공개 피드는 MVP 밖: 이 매장의 내 기록만 보여주고, 없으면 빈 상태
    expect(view.getByText("아직 이 가게 기록이 없어요")).toBeTruthy()
    expect(view.getByRole("button", { name: "첫 기록 남기기" })).toBeTruthy()
    expect(view.queryByText(/구글 리뷰/)).toBeNull()
    expect(view.getByText("영업시간 정보가 아직 없어요")).toBeTruthy()
    expect(view.queryByText(/일치도/)).toBeNull()
    expect(view.queryByText(/전화번호/)).toBeNull()
    expect(track).toHaveBeenCalledWith("shop_viewed", { shopId: 2 })
  })

  it("sends photos, menus and the address to Naver Map, app first then web", async () => {
    // 네이버 지도 앱이 없으면 앱 주소 열기가 실패하고 웹으로 넘어간다
    const openURL = jest
      .spyOn(Linking, "openURL")
      .mockImplementation((url: string) => (url.startsWith("nmap://") ? Promise.reject(new Error("no app")) : Promise.resolve(true)))
    mockParams.shopId = "2"
    const view = await renderScreen(<ShopDetailScreen />)
    await view.findByText(/^후쿠 라멘/)
    const query = encodeURIComponent("후쿠 라멘 합정점")

    // 네이버 매장 ID가 아직 없는 매장은 이름으로 네이버 지도 검색을 연다
    await fireEvent.press(view.getByRole("link", { name: "네이버 지도" }))
    expect(openURL).toHaveBeenCalledWith(`nmap://search?query=${query}&appname=com.raota.app`)
    await waitFor(() => expect(openURL).toHaveBeenLastCalledWith(`https://map.naver.com/p/search/${query}`))

    await fireEvent.press(view.getByRole("link", { name: /^주소, / }))
    await waitFor(() => expect(openURL).toHaveBeenLastCalledWith(`https://map.naver.com/p/search/${query}`))
    // 전화번호·예약·인스타그램이 없는 매장은 네이버 지도만 보여준다
    expect(view.queryByRole("link", { name: "전화" })).toBeNull()
    expect(view.queryByRole("link", { name: "캐치테이블" })).toBeNull()
    expect(view.queryByRole("link", { name: "인스타그램" })).toBeNull()
    openURL.mockRestore()
  })

  it("shows the AI summary as the shop intro with only an AI-made label", async () => {
    mockParams.shopId = "1"
    const view = await renderScreen(<ShopDetailScreen />)
    await view.findByText(/^멘야준/)

    expect(view.getByText("가게 소개")).toBeTruthy()
    expect(view.getByLabelText("AI가 요약했어요")).toBeTruthy()
    expect(view.getByText("#단단한 면")).toBeTruthy()
    expect(view.queryByText(/개를 AI가 요약/)).toBeNull()
  })

  it("puts call, Naver Map, CatchTable and Instagram shortcuts under the shop intro", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true)
    mockParams.shopId = "1"
    const view = await renderScreen(<ShopDetailScreen />)
    await view.findByText(/^멘야준/)

    await fireEvent.press(view.getByRole("link", { name: "전화" }))
    expect(openURL).toHaveBeenLastCalledWith("tel:070-7798-2512".replace(/-/g, ""))
    await fireEvent.press(view.getByRole("link", { name: "캐치테이블" }))
    expect(openURL).toHaveBeenLastCalledWith("https://app.catchtable.co.kr/ct/shop/menyajun")
    await fireEvent.press(view.getByRole("link", { name: "인스타그램" }))
    expect(openURL).toHaveBeenLastCalledWith("https://instagram.com/menyajun_official")
    expect(view.queryByText(/카카오맵/)).toBeNull()
    // 차콜 섹션의 전화번호 줄(정보)은 그대로 남는다
    expect(view.getByRole("link", { name: "전화번호, 070-7798-2512" })).toBeTruthy()
    openURL.mockRestore()
  })

  it("toggles the bookmark with analytics and starts a record for this shop", async () => {
    mockParams.shopId = "1"
    const view = await renderScreen(<ShopDetailScreen />)
    await view.findByText(/^멘야준/)
    const initiallySaved = INITIAL.bookmarkedShopIds.includes(1)
    const saveLabel = initiallySaved ? "저장됨, 가고 싶어요 취소" : "가고 싶어요"
    await fireEvent.press(view.getByRole("button", { name: saveLabel }))
    expect(track).toHaveBeenCalledWith("bookmark_toggled", { shopId: 1, saved: !initiallySaved })
    expect(await view.findByRole("button", { name: initiallySaved ? "가고 싶어요" : "저장됨, 가고 싶어요 취소" })).toBeTruthy()

    await fireEvent.press(view.getByRole("button", { name: "먹은 라멘 기록하기" }))
    expect(router.push).toHaveBeenCalledWith({ pathname: "/record/new", params: { shopId: "1" } })
  })

  it("lists only my own logs for this shop once I have recorded it", async () => {
    mockParams.shopId = "2"
    function RecordThenOpen() {
      const { actions } = useRaota()
      const [ready, setReady] = useState(false)
      if (ready) return <ShopDetailScreen />
      return (
        <Pressable
          accessibilityLabel="기록 생성"
          accessibilityRole="button"
          onPress={async () => {
            await actions.createLog({
              shopId: 2,
              menuName: "삿포로 미소 라멘",
              ramenType: "미소",
              visitedAt: "2026-09-18",
              note: "불향이 진했다",
              tasteNotes: { broth: [], noodle: [], seasoning: [], topping: [] },
              scores: { satisfaction: 4, brothDensity: 5, noodleFirmness: 4, topping: 3, revisit: 5 },
              revisit: "자주 감",
              isPublic: false,
            })
            setReady(true)
          }}
        />
      )
    }
    const view = await renderScreen(<RecordThenOpen />)
    await fireEvent.press(await view.findByRole("button", { name: "기록 생성" }))
    expect(await view.findByText("삿포로 미소 라멘")).toBeTruthy()
    expect(view.getByText("2026.09.18 · 미소 · 만족도 4점 · 재방문 자주 감")).toBeTruthy()
    expect(view.getByText("불향이 진했다")).toBeTruthy()
    expect(view.queryByText("아직 이 가게 기록이 없어요")).toBeNull()
  })

  it("sends guests to login instead of saving or recording", async () => {
    mockParams.shopId = "1"
    const view = await renderScreen(<ShopDetailScreen />, true)
    await view.findByText(/^멘야준/)
    await fireEvent.press(view.getByRole("button", { name: "가고 싶어요" }))
    await fireEvent.press(view.getByRole("button", { name: "먹은 라멘 기록하기" }))
    expect(router.push).toHaveBeenCalledTimes(2)
    expect(router.push).toHaveBeenNthCalledWith(1, "/auth/login")
    expect(router.push).toHaveBeenNthCalledWith(2, "/auth/login")
    expect(track).not.toHaveBeenCalledWith("bookmark_toggled", expect.anything())
  })
})

describe("AI curator", () => {
  it("walks four steps, shows only applied conditions while loading and a result without match %", async () => {
    jest.useFakeTimers()
    const view = await renderScreen(<AIRecommendScreen />)
    expect(await view.findByText("1 / 4")).toBeTruthy()
    expect(view.getByRole("radio", { name: "쇼유, 간장 타레", checked: true })).toBeTruthy()

    await fireEvent.press(view.getByRole("radio", { name: "돈코츠, 돼지뼈 육수" }))
    await fireEvent.press(view.getByRole("button", { name: "다음" }))
    expect(view.getByText("2 / 4")).toBeTruthy()
    await fireEvent.press(view.getByRole("button", { name: "다음" }))
    await fireEvent.press(view.getByRole("button", { name: "다음" }))
    expect(view.getByText("4 / 4")).toBeTruthy()
    await fireEvent.press(view.getByRole("button", { name: "AI 맞춤 추천받기" }))

    expect(track).toHaveBeenCalledWith("ai_recommend_requested", {
      soup: "tonkotsu",
      mood: "solo",
      priority: "clean",
      hasPrompt: false,
    })
    // 로딩에는 반영된 조건만 보인다(혼밥 분위기는 매장 정보가 없어 참고만 → 표시 안 함)
    expect(view.getByText(/돈코츠 계보/)).toBeTruthy()
    expect(view.queryByText(/혼밥하기 좋은 곳/)).toBeNull()

    await act(async () => {
      jest.advanceTimersByTime(4000)
    })
    await waitFor(() => expect(view.getByText(`오늘 ${NICKNAME}님을 위한 라멘집`)).toBeTruthy())
    expect(view.getByText("추천에 쓴 조건")).toBeTruthy()
    expect(view.getByText(/^하쿠텐/)).toBeTruthy()
    expect(view.queryByText(/%/)).toBeNull()
    expect(view.getByRole("button", { name: "이 가게 기록하기" })).toBeTruthy()

    await fireEvent.press(view.getByRole("button", { name: "매장 상세 보기" }))
    expect(router.push).toHaveBeenCalledWith({ pathname: "/shop/[shopId]", params: { shopId: "7" } })
    // 상세에 다녀와도 결과는 이 화면 상태에 그대로 남는다
    expect(view.getByText(/^하쿠텐/)).toBeTruthy()
    jest.useRealTimers()
  })

  it("titles guest results as today's pick and skips the loading screen", async () => {
    const view = await renderScreen(<AIRecommendScreen />, true)
    await view.findByText("1 / 4")
    await fireEvent.press(view.getByRole("button", { name: "다음" }))
    await fireEvent.press(view.getByRole("button", { name: "다음" }))
    await fireEvent.press(view.getByRole("button", { name: "다음" }))
    await fireEvent.press(view.getByRole("button", { name: "AI 맞춤 추천받기" }))
    await fireEvent.press(view.getByRole("button", { name: "추천 바로 보기" }))
    expect(await view.findByText("오늘의 추천")).toBeTruthy()
    await fireEvent.press(view.getByRole("button", { name: "이 가게 기록하기" }))
    expect(router.push).toHaveBeenCalledWith("/auth/login")
  })
})
