import { act, fireEvent, render, waitFor, within } from "@testing-library/react-native"
import type * as ReactModule from "react"
import type { ReactElement } from "react"
import { Linking, StyleSheet } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { createInitialPersistedState } from "@/src/data/fixtures"
import { remoteReads, remoteWrites } from "@/src/data/remote"
import type * as FixturesModule from "@/src/data/fixtures"
import type { RaotaRepository } from "@/src/repository"
import type * as SharedModule from "@raota/shared"
import { RaotaProvider } from "@/src/state/RaotaStore"
import { colors } from "@/src/theme"
import HomeScreen from "@/app/native/index"
import ShopDetailScreen from "@/app/(flows)/shop/[shopId]"
import AIRecommendScreen from "@/app/(flows)/ai-recommend"

const mockParams: { shopId?: string; ticket?: string } = {}

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), canGoBack: jest.fn(() => true), navigate: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => mockParams),
  useFocusEffect: (effect: () => void | (() => void)) => jest.requireActual<typeof ReactModule>("react").useEffect(effect, [effect]),
}))

jest.mock("expo-router/react-navigation", () => ({ usePreventRemove: jest.fn() }))

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
jest.mock("@/src/api/config", () => {
  const isRemote = jest.fn((_domain: string) => false)
  return {
    ...jest.requireActual("@/src/api/config"),
    isRemote,
    isRemoteWithAccount: jest.fn((domain: string) => isRemote(domain) && isRemote("auth")),
  }
})


// SHOP_CATALOG에는 화면 확인용 더미 상세가 덧입혀져 있다. 정보가 빈 매장의 빈 상태를 보려고
// 후쿠 라멘(2)만 확인된 원장(SHOP_LEDGER) 값으로 되돌린다
jest.mock("@/src/data/fixtures", () => {
  const actual = jest.requireActual<typeof FixturesModule>("@/src/data/fixtures")
  const { SHOP_LEDGER } = jest.requireActual<typeof SharedModule>("@raota/shared")
  const sparse = SHOP_LEDGER.find((shop) => shop.id === "2")
  return { ...actual, SHOPS: actual.SHOPS.map((shop) => (shop.id === "2" && sparse ? sparse : shop)) }
})

const { router } = jest.requireMock("expo-router") as { router: Record<string, jest.Mock> }
const { track } = jest.requireMock("@/src/analytics") as { track: jest.Mock }
const { usePreventRemove } = jest.requireMock("expo-router/react-navigation") as { usePreventRemove: jest.Mock }
const { isRemote } = jest.requireMock("@/src/api/config") as { isRemote: jest.Mock }

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
// 데모 계정의 그릇은 공유 원장(DEMO_BOWLS)에 앱에서 남긴 기록을 더한 것이다(마이 화면과 같은 수)
const MY_BOWL_COUNT =
  jest.requireActual<typeof SharedModule>("@raota/shared").DEMO_BOWLS.length +
  INITIAL.logs.filter((log) => log.author.id === INITIAL.user?.id).length

afterEach(() => {
  jest.useRealTimers()
})

beforeEach(() => {
  jest.clearAllMocks()
  delete mockParams.shopId
  delete mockParams.ticket
})

describe("home", () => {
  it("shows curator, today's pick, personal picks and nearby shops without match % or fake banners", async () => {
    const view = await renderScreen(<HomeScreen />)
    expect(await view.findByRole("button", { name: "오늘 뭐 먹지? AI 라멘 큐레이터" })).toBeTruthy()
    expect(view.queryByText("오늘의 픽")).toBeNull()
    expect(view.getByTestId("home-curation-summary")).toBeTruthy()
    expect(view.getByText("AI가 요약했어요")).toBeTruthy()
    expect(view.getByText(/주말 점심에는 웨이팅이 길다는 이야기가 이어져요/)).toBeTruthy()
    expect(view.getByRole("button", { name: /오늘의 큐레이션, 멘야준.*AI가 요약했어요/ })).toBeTruthy()
    // 오늘의 큐레이션 매장은 아래 추천 목록에서 반복하지 않는다.
    expect(view.getAllByText(/^멘야준/)).toHaveLength(1)
    // 데모 계정은 돈코츠를 가장 많이 먹었고 육수 농도 평균이 진한 쪽이다. 이유는 그 근거만 쓴다
    expect(view.getByText(`${NICKNAME}님이 좋아할 라멘집`)).toBeTruthy()
    expect(view.getAllByText(/돈코츠를 가장 자주 드셔서/).length).toBeGreaterThan(0)
    expect(view.getByText("가까운 라멘집")).toBeTruthy()

    expect(view.queryByText(/%/)).toBeNull()
    expect(view.queryByText(/TODAY/)).toBeNull()
    expect(view.queryByText(/취향 리포트에 반영/)).toBeNull()
    expect(view.queryByText(/맞춤 추천이 갱신/)).toBeNull()
    expect(view.queryByRole("button", { name: /알림/ })).toBeNull()
  })

  it("opens the curator and lets a member reach My from the account link", async () => {
    const view = await renderScreen(<HomeScreen />)
    const account = await view.findByRole("button", { name: `${NICKNAME}님, 내 정보` })
    await fireEvent.press(account)
    expect(router.navigate).toHaveBeenCalledWith("/native/my")
    await fireEvent.press(view.getByRole("button", { name: "오늘 뭐 먹지? AI 라멘 큐레이터" }))
    expect(router.push).toHaveBeenCalledWith("/ai-recommend")
    expect(view.queryByText(/문의하기/)).toBeNull()
  })

  it("lets guests browse the home and sign in or create an account", async () => {
    const view = await renderScreen(<HomeScreen />, true)
    expect(await view.findByRole("button", { name: "오늘 뭐 먹지? AI 라멘 큐레이터" })).toBeTruthy()
    expect(view.getByRole("button", { name: "로그인" })).toBeTruthy()
    expect(view.getByRole("button", { name: "회원가입" })).toBeTruthy()
    expect(view.queryByRole("button", { name: /님, 내 정보$/ })).toBeNull()
    expect(view.getByText("처음이라면 여기부터")).toBeTruthy()
    expect(view.queryByText(/가장 자주 드셔서/)).toBeNull()
    expect(view.getByText("가까운 라멘집")).toBeTruthy()
  })
})

describe("shop detail", () => {
  it("shows only available shop information and an actionable sticky record button", async () => {
    mockParams.shopId = "2"
    const view = await renderScreen(<ShopDetailScreen />)
    expect(await view.findByText(/^후쿠 라멘/)).toBeTruthy()
    expect(view.getByText("가게 소개")).toBeTruthy()
    const intro = within(view.getByTestId("shop-intro-card"))
    expect(intro.getByText("볶은 채소의 불향과 진한 된장 타레, 탄력 있는 치지레멘이 조화를 이루는 삿포로식 미소 라멘집입니다.")).toBeTruthy()
    expect(StyleSheet.flatten(view.getByTestId("shop-intro-card").props.style).padding).toBe(16)
    expect(StyleSheet.flatten(view.getByTestId("shop-status-cap").props.style).height).toBe(47)
    expect(intro.queryByLabelText("AI가 요약했어요")).toBeNull()
    expect(view.queryByText("리뷰 요약")).toBeNull()
    expect(view.queryByText("내 라멘로그")).toBeNull()
    expect(view.getByRole("button", { name: "먹은 라멘 기록하기" })).toBeTruthy()
    expect(view.queryByText(/구글 리뷰/)).toBeNull()
    expect(view.getByText("영업시간 정보가 아직 없어요")).toBeTruthy()
    expect(view.queryByText(/일치도/)).toBeNull()
    expect(view.queryByText(/전화번호/)).toBeNull()
    // 공개 라멘로그의 실제 평가가 있을 때만 "이 가게의 맛"(재방문 의향 + 네 칸)을 보여 준다.
    // 기록이 5개보다 적으면 비율(원) 대신 사람 수 문장과 안내만 읽는다
    expect(view.getByRole("text", { name: /^이 가게의 맛\. 공개 라멘로그 2개\. 2명 (모두|중 \d명이) .*기록이 5개 이상 쌓이면 비율로 보여드려요\. 많이 먹은 메뉴 .*육수 .*면 .*토핑 / })).toBeTruthy()
    expect(view.queryByText("또 갈래요")).toBeNull()
    expect(track).toHaveBeenCalledWith("shop_viewed", { shopId: "2" })
  })

  it("opens the shop on the app map, and the address in Naver Map app first then web", async () => {
    // 네이버 지도 앱이 없으면 앱 주소 열기가 실패하고 웹으로 넘어간다
    const openURL = jest
      .spyOn(Linking, "openURL")
      .mockImplementation((url: string) => (url.startsWith("nmap://") ? Promise.reject(new Error("no app")) : Promise.resolve(true)))
    mockParams.shopId = "2"
    const view = await renderScreen(<ShopDetailScreen />)
    await view.findByText(/^후쿠 라멘/)
    const query = encodeURIComponent("후쿠 라멘 합정점")

    // 바로가기는 앱의 지도 탭에서 이 가게를 고른다. 바깥 앱을 열지 않는다
    await fireEvent.press(view.getByRole("link", { name: "지도에서 보기" }))
    expect(router.navigate).toHaveBeenCalledWith({ pathname: "/native/map", params: expect.objectContaining({ shopId: "2" }) })
    expect(openURL).not.toHaveBeenCalled()

    // 네이버 매장 ID가 아직 없는 매장은 주소 줄에서 이름으로 네이버 지도 검색을 연다
    await fireEvent.press(view.getByRole("link", { name: /^주소, / }))
    expect(openURL).toHaveBeenCalledWith(`nmap://search?query=${query}&appname=com.raota.app`)
    await waitFor(() => expect(openURL).toHaveBeenLastCalledWith(`https://map.naver.com/p/search/${query}`))
    // 전화번호·예약·인스타그램이 없는 매장은 지도 바로가기만 보여준다
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
    const intro = within(view.getByTestId("shop-intro-card"))
    expect(intro.getByLabelText("AI가 요약했어요")).toBeTruthy()
    expect(intro.getByText(/국물이 진하면서도 쇼유 향이 깔끔하게/)).toBeTruthy()
    expect(intro.getByText("#단단한 면")).toBeTruthy()
    expect(StyleSheet.flatten(intro.getByText("#단단한 면").parent!.props.style).backgroundColor).toEqual(colors.canvas)
    expect(view.getByRole("button", { name: "공유" })).toBeTruthy()
    expect(view.getByRole("button", { name: "더보기" })).toBeTruthy()
    expect(view.queryByText(/개를 AI가 요약/)).toBeNull()
    expect(view.getByLabelText("멘야준 사진 3장")).toBeTruthy()
    // 여러 장이면 사진 왼쪽 아래 썸네일로 바로 고른다
    expect(within(view.getByLabelText("매장 사진 선택")).getAllByRole("button")).toHaveLength(3)
    expect(view.getByText("비슷한 한 그릇")).toBeTruthy()
    expect(view.getByRole("button", { name: "세상끝의라멘 합정점, 매장 상세 보기" })).toBeTruthy()
    const similar = view.getByRole("button", { name: "세상끝의라멘 합정점, 매장 상세 보기" })
    const photoPillText = within(similar).getByText("쇼유 라멘")
    expect(StyleSheet.flatten(photoPillText.parent!.props.style).backgroundColor).toEqual(colors.photoPill)
    expect(StyleSheet.flatten(photoPillText.props.style).color).toEqual(colors.onPhotoPill)
    await fireEvent.press(view.getByRole("button", { name: "세상끝의라멘 합정점, 매장 상세 보기" }))
    expect(router.push).toHaveBeenCalledWith({ pathname: "/shop/[shopId]", params: { shopId: "4" } })
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
    // 정보 줄에서도 전화 동작을 유지한다
    expect(view.getByRole("link", { name: "전화번호, 070-7798-2512" })).toBeTruthy()
    openURL.mockRestore()
  })

  it("toggles the bookmark with analytics and starts a record for this shop", async () => {
    mockParams.shopId = "1"
    const view = await renderScreen(<ShopDetailScreen />)
    await view.findByText(/^멘야준/)
    const initiallySaved = INITIAL.bookmarkedShopIds.includes("1")
    const saveLabel = initiallySaved ? "저장됨, 가고 싶어요 취소" : "가고 싶어요"
    await fireEvent.press(view.getByRole("button", { name: saveLabel }))
    expect(track).toHaveBeenCalledWith("bookmark_toggled", { shopId: "1", saved: !initiallySaved })
    expect(await view.findByRole("button", { name: initiallySaved ? "가고 싶어요" : "저장됨, 가고 싶어요 취소" })).toBeTruthy()

    await fireEvent.press(view.getByRole("button", { name: "먹은 라멘 기록하기" }))
    expect(router.push).toHaveBeenCalledWith({ pathname: "/record/new", params: { shopId: "1" } })
  })

  it("keeps a BIGINT shop ID intact from detail lookup through record and map routes", async () => {
    const shopId = "9007199254740993123"
    const { SHOPS } = jest.requireMock("@/src/data/fixtures") as typeof FixturesModule
    const original = SHOPS[0]
    SHOPS[0] = { ...original, id: shopId }
    mockParams.shopId = shopId
    try {
      const view = await renderScreen(<ShopDetailScreen />)
      expect(await view.findByText(/^멘야준/)).toBeTruthy()
      await fireEvent.press(view.getByRole("button", { name: "먹은 라멘 기록하기" }))
      expect(router.push).toHaveBeenCalledWith({ pathname: "/record/new", params: { shopId } })
      await fireEvent.press(view.getByRole("link", { name: "지도에서 보기" }))
      expect(router.navigate).toHaveBeenCalledWith({ pathname: "/native/map", params: expect.objectContaining({ shopId }) })
    } finally {
      SHOPS[0] = original
    }
  })

  it("shows the live hours status and opens a sheet with today's timeline and grouped days", async () => {
    // 묘코는 월·화 정기 휴무, 수–일 12:00 ~ 15:00, 17:30 ~ 21:00이다. 영업하는 수요일 낮으로 고정한다
    jest.useFakeTimers({ now: new Date("2026-10-21T12:00:00+09:00"), advanceTimers: true })
    mockParams.shopId = "5"
    const view = await renderScreen(<ShopDetailScreen />)
    await view.findByText(/^묘코/)
    // 정보 줄은 지금 상태를 먼저 말하고, 오늘 시간과 쉬는 시간을 따로 적는다. 다음이 쉬는 시간이면 "닫아요"가 아니라 "쉬어요"다
    const trigger = view.getByRole("button", { name: "영업시간, 영업 중, 15:00부터 쉬어요. 오늘(수) 12:00 – 21:00 · 쉬는 시간 15:00 – 17:30" })
    expect(StyleSheet.flatten(within(trigger).getByTestId("shop-hours-status-dot").props.style).backgroundColor).toEqual(colors.open)
    expect(trigger.props.accessibilityState.expanded).toBe(false)
    await fireEvent.press(trigger)

    expect(view.getByRole("header", { name: "영업시간" })).toBeTruthy()
    // 같은 시간인 요일은 한 줄로 묶고, 오늘이 든 줄에 "오늘"을 단다
    const rows = view.getAllByTestId("shop-hours-row").map((row) => row.props.accessibilityLabel)
    expect(rows).toEqual(["월·화, 휴무", "수–일, 오늘, 12:00 – 21:00, 쉬는 시간 15:00부터 17:30까지"])
    expect(view.getByTestId("shop-hours-now", { includeHiddenElements: true })).toBeTruthy()
    expect(view.getByText("오늘 라스트오더 20:30")).toBeTruthy()
    await fireEvent.press(view.getByRole("button", { name: "닫기" }))
    // 시트는 닫히는 동안 잠깐 남아 있다가 사라진다
    await waitFor(() => expect(view.queryAllByTestId("shop-hours-row")).toHaveLength(0))
    expect(view.getByRole("button", { name: /^영업시간, 영업 중/ }).props.accessibilityState.expanded).toBe(false)
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
  it("keeps chosen answers on the display and prints a ticket after pressing each condition key", async () => {
    jest.useFakeTimers()
    const view = await renderScreen(<AIRecommendScreen />)
    expect(await view.findByText("1 / 4")).toBeTruthy()
    // 아직 고르지 않은 조건은 "—" 없이 이름만 남는다
    expect(view.queryAllByText("—")).toHaveLength(0)
    expect(view.getByLabelText("고른 조건 없음")).toBeTruthy()
    expect(view.getByRole("radio", { name: "쇼유, 간장 타레", checked: false })).toBeTruthy()
    expect(view.getByRole("button", { name: "국물을 골라주세요" })).toBeDisabled()

    expect(view.getByRole("radio", { name: "이에케, 돈코츠쇼유" })).toBeTruthy()
    await fireEvent.press(view.getByRole("radio", { name: "돈코츠, 돼지뼈 육수" }))
    expect(view.getByRole("radio", { name: "돈코츠, 돼지뼈 육수", checked: true })).toBeTruthy()
    expect(view.getAllByText("돈코츠").length).toBeGreaterThan(1)
    await fireEvent.press(view.getByRole("button", { name: "다음" }))
    expect(view.getByText("2 / 4")).toBeTruthy()
    expect(view.getByText("돈코츠")).toBeTruthy()
    expect(view.getByRole("button", { name: "상황을 골라주세요" })).toBeDisabled()
    await fireEvent.press(view.getByRole("radio", { name: "혼밥하기 좋은 곳, 혼자 편하게" }))
    await fireEvent.press(view.getByRole("button", { name: "다음" }))
    expect(view.getByRole("button", { name: "중요한 요소를 골라주세요" })).toBeDisabled()
    await fireEvent.press(view.getByRole("radio", { name: "깔끔하고 깊은 감칠맛, 청탕 · 맑은 국물" }))
    await fireEvent.press(view.getByRole("button", { name: "다음" }))
    expect(view.getByText("4 / 4")).toBeTruthy()
    expect(view.getByText("돈코츠")).toBeTruthy()
    expect(view.getByText("추가 조건")).toBeTruthy()
    expect(view.getByText("자주 찾는 조건")).toBeTruthy()
    expect(view.queryAllByText("—")).toHaveLength(0)
    expect(view.getByRole("button", { name: "지금 영업 중인 곳 추가" })).toBeTruthy()
    // 고른 조건 네 칸은 값이 길어져도 같은 높이를 지켜 아래 질문이 밀리지 않는다. 전체 값은 묶음 라벨이 읽어 준다
    const cellHeights = ["국물", "상황", "중요", "추가"].map((label) => StyleSheet.flatten(view.getByTestId(`ai-condition-${label}`).props.style).height)
    expect(typeof cellHeights[0]).toBe("number")
    expect(new Set(cellHeights).size).toBe(1)
    expect(view.getByLabelText(/^고른 조건\. 국물 돈코츠, 상황 혼밥하기 좋은 곳, 중요 깔끔하고 깊은 감칠맛/)).toBeTruthy()
    expect(StyleSheet.flatten(view.getByLabelText("더 바라는 점").props.style).minHeight).toBe(96)
    await fireEvent.press(view.getByRole("button", { name: "AI 맞춤 추천받기" }))

    expect(track).toHaveBeenCalledWith("ai_recommend_requested", {
      soup: "tonkotsu",
      mood: "solo",
      priority: "clean",
      hasPrompt: false,
    })
    expect(view.getByLabelText("국물, 돈코츠, 확인 중")).toBeTruthy()
    expect(view.getByLabelText("상황, 혼밥하기 좋은 곳, 확인 중")).toBeTruthy()
    expect(view.getByLabelText("중요, 깔끔하고 깊은 감칠맛, 확인 중")).toBeTruthy()
    expect(view.getByRole("button", { name: "추천 바로 보기" })).toBeTruthy()
    // 고르지 않은 '추가'는 칩으로 나오지 않아 세 조건만 차례로 켜진다(300 + 3 × 500ms 뒤 발권)
    await act(async () => {
      jest.advanceTimersByTime(1400)
    })
    expect(view.getByLabelText("국물, 돈코츠, 확인했어요")).toBeTruthy()
    expect(view.getByLabelText("상황, 혼밥하기 좋은 곳, 확인했어요")).toBeTruthy()
    expect(view.getByLabelText("중요, 깔끔하고 깊은 감칠맛, 확인했어요")).toBeTruthy()
    expect(view.queryByText("오늘의 한 그릇")).toBeNull()
    expect(view.getByText("어울리는 라멘집을 찾고 있어요")).toBeTruthy()
    await act(async () => {
      jest.advanceTimersByTime(900)
    })
    expect(view.getByText("식권을 뽑고 있어요")).toBeTruthy()
    expect(view.queryByText("오늘의 한 그릇")).toBeNull()
    await act(async () => {
      jest.advanceTimersByTime(900)
    })
    expect(view.getByText("오늘의 추천이 준비됐어요")).toBeTruthy()
    expect(view.getByText("오늘의 한 그릇을 찾았어요")).toBeTruthy()
    expect(view.getByText("오늘의 한 그릇")).toBeTruthy()
    expect(view.getByText(/\d{2}\.\d{2}\.\d{2} · 1매/)).toBeTruthy()
    await act(async () => {
      jest.advanceTimersByTime(1700)
    })
    await waitFor(() => expect(view.getByText(`오늘 ${NICKNAME}님을 위한 라멘집`)).toBeTruthy())
    expect(view.getByText("추천에 쓴 조건")).toBeTruthy()
    expect(view.getByText(/^하쿠텐/)).toBeTruthy()
    const resultTicket = view.getByTestId("ai-result-ticket")
    expect(within(resultTicket).getByText("오늘의 한 그릇")).toBeTruthy()
    expect(within(resultTicket).getByText("RAOTA 식권")).toBeTruthy()
    expect(within(resultTicket).getByText(/\d{2}\.\d{2}\.\d{2} · 1매/)).toBeTruthy()
    const resultTypeTag = view.getByRole("text", { name: "라멘 종류 돈코츠" })
    expect(StyleSheet.flatten(resultTypeTag.props.style).backgroundColor).toEqual(colors.photoPill)
    expect(StyleSheet.flatten(within(resultTypeTag).getByText("돈코츠").props.style).color).toEqual(colors.onPhotoPill)
    // 기록이 있는 회원은 랭킹에 내 기록의 취향 리포트가 들어가고, 그 사실을 실제 그릇 수로 알린다
    expect(MY_BOWL_COUNT).toBeGreaterThan(0)
    expect(view.getByText(`내 기록 ${MY_BOWL_COUNT}그릇의 취향을 반영했어요`)).toBeTruthy()
    expect(view.queryByText(/%/)).toBeNull()
    expect(view.getByRole("button", { name: "이 가게 기록하기" })).toBeTruthy()

    await fireEvent.press(view.getByRole("button", { name: "매장 상세 보기" }))
    expect(router.push).toHaveBeenCalledWith({ pathname: "/shop/[shopId]", params: { shopId: "7" } })
    // 상세에 다녀와도 결과는 이 화면 상태에 그대로 남는다
    expect(view.getByText(/^하쿠텐/)).toBeTruthy()
    jest.useRealTimers()
  })

  it("keeps the soup pick in the result, steps back on swipe and shows the next candidate on restart", async () => {
    jest.useFakeTimers()
    const view = await renderScreen(<AIRecommendScreen />)
    await view.findByText("1 / 4")
    // 1단계에서는 스와이프로 평소처럼 나간다
    expect(usePreventRemove.mock.calls.at(-1)?.[0]).toBe(false)
    await fireEvent.press(view.getByRole("radio", { name: "쇼유, 간장 타레" }))
    await fireEvent.press(view.getByRole("button", { name: "다음" }))
    await fireEvent.press(view.getByRole("radio", { name: "혼밥하기 좋은 곳, 혼자 편하게" }))
    await fireEvent.press(view.getByRole("button", { name: "다음" }))
    expect(view.getByText("3 / 4")).toBeTruthy()

    // 2~4단계의 스와이프 뒤로 가기는 플로우를 나가지 않고 한 단계만 올라간다(고른 답은 남는다)
    const [preventing, onPrevented] = usePreventRemove.mock.calls.at(-1) as [boolean, (event: unknown) => void]
    expect(preventing).toBe(true)
    await act(async () => {
      onPrevented({ data: { action: { type: "GO_BACK" } } })
    })
    expect(view.getByText("2 / 4")).toBeTruthy()
    expect(view.getByRole("radio", { name: "혼밥하기 좋은 곳, 혼자 편하게", checked: true })).toBeTruthy()
    await fireEvent.press(view.getByRole("button", { name: "다음" }))
    await fireEvent.press(view.getByRole("radio", { name: "깔끔하고 깊은 감칠맛, 청탕 · 맑은 국물" }))
    await fireEvent.press(view.getByRole("button", { name: "다음" }))

    // 대조할 수 없는 조건은 자주 찾는 조건으로 내놓지 않는다
    for (const unmatchable of ["국물이 덜 짠 곳", "주차 가능한 곳", "매운맛 조절 가능한 곳", "웨이팅 적은 곳"]) {
      expect(view.queryByRole("button", { name: `${unmatchable} 추가` })).toBeNull()
    }
    await fireEvent.press(view.getByRole("button", { name: "AI 맞춤 추천받기" }))
    await fireEvent.press(view.getByRole("button", { name: "추천 바로 보기" }))

    // 쇼유를 고르면 쇼유 매장이 있는 한 다른 종류가 나오지 않는다. 사진 위 표시와 조건 줄이 같은 이름을 쓴다
    expect(view.getByRole("text", { name: "라멘 종류 쇼유" })).toBeTruthy()
    expect(view.getByText(/^쇼유 계보 \d+곳 중에서 골랐어요$/)).toBeTruthy()
    await fireEvent.press(view.getByRole("button", { name: "매장 상세 보기" }))
    const firstId = router.push.mock.calls.at(-1)?.[0].params.shopId

    // 다시 추천받기는 같은 답으로 다음 순위 후보를 보여 준다
    await fireEvent.press(view.getByRole("button", { name: "다시 추천받기" }))
    expect(view.getByText(`오늘 ${NICKNAME}님을 위한 라멘집`)).toBeTruthy()
    expect(view.getByRole("text", { name: "라멘 종류 쇼유" })).toBeTruthy()
    await fireEvent.press(view.getByRole("button", { name: "매장 상세 보기" }))
    const secondId = router.push.mock.calls.at(-1)?.[0].params.shopId
    expect(secondId).toBeTruthy()
    expect(secondId).not.toBe(firstId)
  })

  it("lets guests see today's pick immediately when the local result is ready", async () => {
    jest.useFakeTimers()
    const view = await renderScreen(<AIRecommendScreen />, true)
    await view.findByText("1 / 4")
    await fireEvent.press(view.getByRole("radio", { name: "쇼유, 간장 타레" }))
    await fireEvent.press(view.getByRole("button", { name: "다음" }))
    await fireEvent.press(view.getByRole("radio", { name: "혼밥하기 좋은 곳, 혼자 편하게" }))
    await fireEvent.press(view.getByRole("button", { name: "다음" }))
    await fireEvent.press(view.getByRole("radio", { name: "깔끔하고 깊은 감칠맛, 청탕 · 맑은 국물" }))
    await fireEvent.press(view.getByRole("button", { name: "다음" }))
    await fireEvent.press(view.getByRole("button", { name: "AI 맞춤 추천받기" }))
    // 결과가 준비됐으므로 발권 연출을 기다리지 않고 곧바로 볼 수 있다
    await fireEvent.press(view.getByRole("button", { name: "추천 바로 보기" }))
    expect(view.getByText("오늘의 추천")).toBeTruthy()
    // 기록이 없는 비회원에게는 취향을 반영했다고 말하지 않는다
    expect(view.queryByText(/그릇의 취향을 반영했어요/)).toBeNull()
    jest.useRealTimers()
    await fireEvent.press(view.getByRole("button", { name: "이 가게 기록하기" }))
    expect(router.push).toHaveBeenCalledWith("/auth/login")
  })

  it("moves to the ticket screen right away while the server recommendation is still on its way", async () => {
    isRemote.mockImplementation((domain: string) => domain === "recommendations")
    const { SHOPS } = jest.requireMock("@/src/data/fixtures") as typeof FixturesModule
    const answer = Promise.withResolvers<{
      recommendationId: string | null
      shops: (typeof SHOPS)[number][]
      appliedConditions: string[]
      reasons: Record<string, string>
    }>()
    const recommendations = jest
      .spyOn(remoteReads as unknown as { recommendations: (...args: unknown[]) => Promise<unknown> }, "recommendations")
      .mockReturnValue(answer.promise)
    const tickets = jest
      .spyOn(remoteReads as unknown as { recommendationTickets: () => Promise<unknown> }, "recommendationTickets")
      .mockResolvedValue({ dailyLimit: 3, remaining: 3, tickets: [] })
    const opened = jest.spyOn(remoteWrites, "markRecommendationOpened").mockResolvedValue()
    try {
      jest.useFakeTimers()
      const view = await renderScreen(<AIRecommendScreen />)
      await view.findByText("1 / 4")
      await fireEvent.press(view.getByRole("radio", { name: "쇼유, 간장 타레" }))
      await fireEvent.press(view.getByRole("button", { name: "다음" }))
      await fireEvent.press(view.getByRole("radio", { name: "혼밥하기 좋은 곳, 혼자 편하게" }))
      await fireEvent.press(view.getByRole("button", { name: "다음" }))
      await fireEvent.press(view.getByRole("radio", { name: "깔끔하고 깊은 감칠맛, 청탕 · 맑은 국물" }))
      await fireEvent.press(view.getByRole("button", { name: "다음" }))
      // 남은 식권을 아는 서버 추천은 쓰기 전에 묻는다. 취소하면 서버를 부르지 않는다
      await fireEvent.press(view.getByRole("button", { name: "AI 맞춤 추천받기" }))
      expect(view.getByText("식권 1장을 쓸까요?")).toBeTruthy()
      expect(view.getByText("오늘 남은 식권 3장 중 1장을 써요. 자정에 다시 3장이 채워져요.")).toBeTruthy()
      await fireEvent.press(view.getByRole("button", { name: "취소" }))
      expect(recommendations).not.toHaveBeenCalled()
      await fireEvent.press(view.getByRole("button", { name: "AI 맞춤 추천받기" }))
      await fireEvent.press(view.getByRole("button", { name: "식권 쓰기" }))

      // 서버가 아직 답하지 않았어도 발권 화면이 떠 있고, 결과가 없으니 건너뛰기는 아직 없다
      expect(recommendations).toHaveBeenCalledTimes(1)
      expect(view.getByLabelText("국물, 쇼유, 확인 중")).toBeTruthy()
      expect(view.queryByRole("button", { name: "추천 바로 보기" })).toBeNull()
      expect(view.getByTestId("curation-loading-dots", { includeHiddenElements: true })).toBeTruthy()

      await act(async () => {
        answer.resolve({
          recommendationId: "501",
          shops: [{ ...SHOPS[0], id: "9001", name: "서버추천라멘" }, { ...SHOPS[1], id: "9002", name: "두번째라멘" }],
          appliedConditions: ["쇼유"],
          reasons: { "9001": "맑은 쇼유 국물을 혼자 편하게 즐기기 좋아요" },
        })
      })
      // 답이 오면 기다림 표시는 사라지고 건너뛰기가 나온다
      expect(view.queryByTestId("curation-loading-dots", { includeHiddenElements: true })).toBeNull()
      await fireEvent.press(view.getByRole("button", { name: "추천 바로 보기" }))
      expect(view.getByText(`오늘 ${NICKNAME}님을 위한 라멘집`)).toBeTruthy()
      expect(view.getAllByText(/서버추천라멘/).length).toBeGreaterThan(0)
      // AI가 쓴 이유가 있으면 고른 조건 목록 대신 그 이유를 보여준다
      expect(within(view.getByTestId("ai-recommend-reason")).getByText("맑은 쇼유 국물을 혼자 편하게 즐기기 좋아요")).toBeTruthy()
      expect(view.queryByText("추천에 쓴 조건")).toBeNull()

      // 이유가 없는 다음 후보로 넘기면 앞 매장의 이유가 남지 않고 조건 목록으로 돌아간다
      await fireEvent.press(view.getByRole("button", { name: "다시 추천받기" }))
      expect(view.getAllByText(/두번째라멘/).length).toBeGreaterThan(0)
      expect(view.queryByTestId("ai-recommend-reason")).toBeNull()
      expect(view.getByText("추천에 쓴 조건")).toBeTruthy()
      // 새 식권을 뽑았으니 남은 장수를 다시 읽는다
      expect(tickets).toHaveBeenCalledTimes(2)

      // 지금 보이는 후보의 상세를 열면 그 추천 기록과 매장으로 열었다고 알린다
      jest.useRealTimers()
      await fireEvent.press(view.getByRole("button", { name: "매장 상세 보기" }))
      expect(opened).toHaveBeenCalledWith("501", "9002")
      expect(router.push).toHaveBeenCalledWith({ pathname: "/shop/[shopId]", params: { shopId: "9002" } })
    } finally {
      recommendations.mockRestore()
      tickets.mockRestore()
      opened.mockRestore()
      isRemote.mockImplementation(() => false)
    }
  })

  it("blocks the curator steps once today's tickets are used up but still reopens a drawn ticket", async () => {
    isRemote.mockImplementation((domain: string) => domain === "recommendations")
    const { SHOPS } = jest.requireMock("@/src/data/fixtures") as typeof FixturesModule
    const drawn = {
      id: "77",
      createdAt: "2026-10-23T02:05:00Z",
      shops: [{ ...SHOPS[0], id: "9101", name: "아까뽑은라멘" }],
      appliedConditions: ["이에케", "가까운 순"],
      reasons: { "9101": "이에케 국물이 진하고 차슈가 두툼하다는 기록이 많아요." },
    }
    const tickets = jest
      .spyOn(remoteReads as unknown as { recommendationTickets: () => Promise<unknown> }, "recommendationTickets")
      .mockResolvedValue({ dailyLimit: 3, remaining: 0, tickets: [drawn] })
    const recommendations = jest.spyOn(remoteReads as unknown as { recommendations: () => Promise<unknown> }, "recommendations")
    try {
      const view = await renderScreen(<AIRecommendScreen />)
      expect(await view.findByText("오늘 식권을 다 뽑았어요")).toBeTruthy()
      expect(view.getByText("식권은 하루 3장이에요. 내일 다시 뽑을 수 있어요.")).toBeTruthy()
      // 다 쓴 날은 단계 화면이 열리지 않아 서버를 부를 길이 없다
      expect(view.queryByRole("radio", { name: "쇼유, 간장 타레" })).toBeNull()
      expect(recommendations).not.toHaveBeenCalled()

      // 오늘 뽑은 식권은 그때의 매장과 추천 이유 그대로 다시 열린다. 언제 뽑았는지는 서울 날짜까지 적는다
      await fireEvent.press(view.getByRole("button", { name: "뽑은 식권 보기" }))
      await fireEvent.press(view.getByRole("button", { name: "2026년 10월 23일 11:05에 뽑은 식권, 아까뽑은라멘, 이에케, 가까운 순" }))
      expect(view.getAllByText(/아까뽑은라멘/).length).toBeGreaterThan(0)
      expect(within(view.getByTestId("ai-recommend-reason")).getByText("이에케 국물이 진하고 차슈가 두툼하다는 기록이 많아요.")).toBeTruthy()
    } finally {
      tickets.mockRestore()
      recommendations.mockRestore()
      isRemote.mockImplementation(() => false)
    }
  })

  it("lists today's tickets on home without leaving it, then opens the picked ticket's result directly", async () => {
    isRemote.mockImplementation((domain: string) => domain === "recommendations")
    const { SHOPS } = jest.requireMock("@/src/data/fixtures") as typeof FixturesModule
    const drawn = (id: string, name: string, reason: string) => ({
      id,
      createdAt: "2026-10-23T02:05:00Z",
      shops: [{ ...SHOPS[0], id: `91${id}`, name }],
      appliedConditions: ["쇼유"],
      reasons: { [`91${id}`]: reason },
    })
    const tickets = jest
      .spyOn(remoteReads as unknown as { recommendationTickets: () => Promise<unknown> }, "recommendationTickets")
      .mockResolvedValue({
        dailyLimit: 3,
        remaining: 1,
        tickets: [drawn("2", "두번째식권라멘", "두번째 식권의 이유예요."), drawn("1", "첫식권라멘", "첫 식권의 이유예요.")],
      })
    const opened = jest.spyOn(remoteWrites, "markRecommendationOpened").mockResolvedValue()
    try {
      const home = await renderScreen(<HomeScreen />)
      await fireEvent.press(await home.findByRole("button", { name: "오늘 뽑은 식권 2장, 남은 식권 1장" }))
      // 홈을 떠나지 않고 홈 위에서 목록을 연다
      expect(router.push).not.toHaveBeenCalled()
      await fireEvent.press(home.getByRole("button", { name: /에 뽑은 식권, 첫식권라멘/ }))
      expect(router.push).toHaveBeenCalledWith({ pathname: "/ai-recommend", params: { ticket: "1" } })

      // 고른 식권으로 들어오면 추천 단계를 건너뛰고 그 식권의 결과가 바로 열린다
      mockParams.ticket = "1"
      const curator = await renderScreen(<AIRecommendScreen />)
      expect(await curator.findByTestId("ai-recommend-reason")).toBeTruthy()
      expect(within(curator.getByTestId("ai-recommend-reason")).getByText("첫 식권의 이유예요.")).toBeTruthy()
      expect(curator.queryByText("1 / 4")).toBeNull()
      // 다시 본 식권에서 상세를 열어도 그 식권의 추천 기록으로 알린다
      await fireEvent.press(curator.getByRole("button", { name: "매장 상세 보기" }))
      expect(opened).toHaveBeenCalledWith("1", "911")
    } finally {
      tickets.mockRestore()
      opened.mockRestore()
      isRemote.mockImplementation(() => false)
    }
  })

  it("does not report opening a shop from the popular fallback when the server recommendation fails", async () => {
    isRemote.mockImplementation((domain: string) => domain === "recommendations")
    const { SHOPS } = jest.requireMock("@/src/data/fixtures") as typeof FixturesModule
    const recommendations = jest
      .spyOn(remoteReads as unknown as { recommendations: (...args: unknown[]) => Promise<unknown> }, "recommendations")
      .mockRejectedValue(new Error("recommendation down"))
    const popular = jest
      .spyOn(remoteReads as unknown as { shops: (...args: unknown[]) => Promise<unknown> }, "shops")
      .mockResolvedValue({ items: [{ ...SHOPS[0], id: "9101", name: "인기라멘" }] })
    const tickets = jest
      .spyOn(remoteReads as unknown as { recommendationTickets: () => Promise<unknown> }, "recommendationTickets")
      .mockResolvedValue({ dailyLimit: 3, remaining: 3, tickets: [] })
    const opened = jest.spyOn(remoteWrites, "markRecommendationOpened").mockResolvedValue()
    try {
      jest.useFakeTimers()
      const view = await renderScreen(<AIRecommendScreen />)
      await view.findByText("1 / 4")
      await fireEvent.press(view.getByRole("radio", { name: "쇼유, 간장 타레" }))
      await fireEvent.press(view.getByRole("button", { name: "다음" }))
      await fireEvent.press(view.getByRole("radio", { name: "혼밥하기 좋은 곳, 혼자 편하게" }))
      await fireEvent.press(view.getByRole("button", { name: "다음" }))
      await fireEvent.press(view.getByRole("radio", { name: "깔끔하고 깊은 감칠맛, 청탕 · 맑은 국물" }))
      await fireEvent.press(view.getByRole("button", { name: "다음" }))
      await fireEvent.press(view.getByRole("button", { name: "AI 맞춤 추천받기" }))
      await fireEvent.press(view.getByRole("button", { name: "식권 쓰기" }))
      await fireEvent.press(await view.findByRole("button", { name: "추천 바로 보기" }))
      expect(view.getAllByText(/인기라멘/).length).toBeGreaterThan(0)
      jest.useRealTimers()
      await fireEvent.press(view.getByRole("button", { name: "매장 상세 보기" }))
      expect(router.push).toHaveBeenCalledWith({ pathname: "/shop/[shopId]", params: { shopId: "9101" } })
      expect(opened).not.toHaveBeenCalled()
    } finally {
      recommendations.mockRestore()
      popular.mockRestore()
      tickets.mockRestore()
      opened.mockRestore()
      isRemote.mockImplementation(() => false)
    }
  })

  it("keeps home from entering the curator once today's tickets are used up", async () => {
    isRemote.mockImplementation((domain: string) => domain === "recommendations")
    const { SHOPS } = jest.requireMock("@/src/data/fixtures") as typeof FixturesModule
    const tickets = jest
      .spyOn(remoteReads as unknown as { recommendationTickets: () => Promise<unknown> }, "recommendationTickets")
      .mockResolvedValue({
        dailyLimit: 3,
        remaining: 0,
        tickets: ["3", "2", "1"].map((id) => ({
          id,
          createdAt: "2026-10-23T02:05:00Z",
          shops: [{ ...SHOPS[0], id: `91${id}`, name: `식권라멘${id}` }],
          appliedConditions: ["쇼유"],
          reasons: {},
        })),
      })
    try {
      const home = await renderScreen(<HomeScreen />)
      const card = await home.findByRole("button", { name: "오늘 뭐 먹지? AI 라멘 큐레이터, 오늘 식권을 다 뽑았어요" })
      await fireEvent.press(card)
      expect(router.push).not.toHaveBeenCalledWith("/ai-recommend")
      // 대신 뽑아 둔 식권 목록이 홈 위에 열린다
      expect(home.getByRole("button", { name: /에 뽑은 식권, 식권라멘1/ })).toBeTruthy()
    } finally {
      tickets.mockRestore()
      isRemote.mockImplementation(() => false)
    }
  })
})
