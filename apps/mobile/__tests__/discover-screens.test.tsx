import { act, fireEvent, render, waitFor, within } from "@testing-library/react-native"
import type { ReactElement } from "react"
import { Linking, StyleSheet } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { createInitialPersistedState } from "@/src/data/fixtures"
import type * as FixturesModule from "@/src/data/fixtures"
import type { RaotaRepository } from "@/src/repository"
import type * as SharedModule from "@raota/shared"
import { RaotaProvider } from "@/src/state/RaotaStore"
import { colors } from "@/src/theme"
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


// SHOP_CATALOG에는 화면 확인용 더미 상세가 덧입혀져 있다. 정보가 빈 매장의 빈 상태를 보려고
// 후쿠 라멘(2)만 확인된 원장(SHOP_LEDGER) 값으로 되돌린다
jest.mock("@/src/data/fixtures", () => {
  const actual = jest.requireActual<typeof FixturesModule>("@/src/data/fixtures")
  const { SHOP_LEDGER } = jest.requireActual<typeof SharedModule>("@raota/shared")
  const sparse = SHOP_LEDGER.find((shop) => shop.id === 2)
  return { ...actual, SHOPS: actual.SHOPS.map((shop) => (shop.id === 2 && sparse ? sparse : shop)) }
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
    // 공개 라멘로그의 실제 5축 평가가 있을 때만 접근 가능한 맛 지문을 표시한다.
    expect(view.getByRole("text", { name: /^맛 지문\. 공개 라멘로그 2개 기준\. 만족도 4\.5, 육수 농도 4\.0/ }).props.accessibilityLabel).toContain("재방문 4.0")
    expect(track).toHaveBeenCalledWith("shop_viewed", { shopId: 2 })
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
    const initiallySaved = INITIAL.bookmarkedShopIds.includes(1)
    const saveLabel = initiallySaved ? "저장됨, 가고 싶어요 취소" : "가고 싶어요"
    await fireEvent.press(view.getByRole("button", { name: saveLabel }))
    expect(track).toHaveBeenCalledWith("bookmark_toggled", { shopId: 1, saved: !initiallySaved })
    expect(await view.findByRole("button", { name: initiallySaved ? "가고 싶어요" : "저장됨, 가고 싶어요 취소" })).toBeTruthy()

    await fireEvent.press(view.getByRole("button", { name: "먹은 라멘 기록하기" }))
    expect(router.push).toHaveBeenCalledWith({ pathname: "/record/new", params: { shopId: "1" } })
  })

  it("opens weekday hours as a dismissible sheet with today's row and actual break", async () => {
    // 묘코는 월·화 정기 휴무라 오늘 줄의 쉬는 시간이 요일마다 달라진다. 영업하는 수요일 낮으로 고정한다
    jest.useFakeTimers({ now: new Date("2026-10-21T12:00:00+09:00"), advanceTimers: true })
    mockParams.shopId = "5"
    const view = await renderScreen(<ShopDetailScreen />)
    await view.findByText(/^묘코/)
    const trigger = view.getByRole("button", { name: /^영업시간, 오늘/ })
    expect(trigger.props.accessibilityState.expanded).toBe(false)
    await fireEvent.press(trigger)

    expect(view.getByRole("header", { name: "영업시간" })).toBeTruthy()
    expect(view.getAllByText("정기 휴무")).toHaveLength(2)
    expect(view.getByText("수요일")).toBeTruthy()
    expect(view.getByText("오늘")).toBeTruthy()
    expect(view.getByText("라스트오더 20:30 · 15:00 ~ 17:30은 쉬는 시간")).toBeTruthy()
    const weekdayTime = view.getAllByText("12:00 ~ 15:00, 17:30 ~ 21:00")[0]
    expect(weekdayTime.props.numberOfLines).toBeUndefined()
    expect(StyleSheet.flatten(view.getAllByTestId("shop-hours-row")[0].props.style).paddingVertical).toBe(12)
    await fireEvent.press(view.getByRole("button", { name: "닫기" }))
    expect(view.queryByText("오늘")).toBeNull()
    expect(view.getByRole("button", { name: /^영업시간, 오늘/ }).props.accessibilityState.expanded).toBe(false)
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
    expect(view.getAllByText("—")).toHaveLength(4)
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
    await fireEvent.press(view.getByRole("radio", { name: "혼밥하기 좋은 곳" }))
    await fireEvent.press(view.getByRole("button", { name: "다음" }))
    expect(view.getByRole("button", { name: "중요한 요소를 골라주세요" })).toBeDisabled()
    await fireEvent.press(view.getByRole("radio", { name: "깔끔하고 깊은 감칠맛" }))
    await fireEvent.press(view.getByRole("button", { name: "다음" }))
    expect(view.getByText("4 / 4")).toBeTruthy()
    expect(view.getByText("돈코츠")).toBeTruthy()
    expect(view.getByText("추가 조건")).toBeTruthy()
    expect(view.getByText("자주 찾는 조건")).toBeTruthy()
    expect(view.getAllByText("—")).toHaveLength(1)
    expect(view.getByRole("button", { name: "웨이팅 적은 곳 추가" })).toBeTruthy()
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
    expect(view.getByText("오늘의 추천을 정리하고 있어요")).toBeTruthy()
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
    expect(view.getByText("RAOTA 식권 · 오늘의 한 그릇")).toBeTruthy()
    expect(view.getByText(/\d{2}\.\d{2}\.\d{2} · 1매/)).toBeTruthy()
    const resultTypeTag = view.getByRole("text", { name: "라멘 종류 돈코츠" })
    expect(StyleSheet.flatten(resultTypeTag.props.style).backgroundColor).toEqual(colors.photoPill)
    expect(StyleSheet.flatten(within(resultTypeTag).getByText("돈코츠").props.style).color).toEqual(colors.onPhotoPill)
    expect(view.queryByText(/%/)).toBeNull()
    expect(view.getByRole("button", { name: "이 가게 기록하기" })).toBeTruthy()

    await fireEvent.press(view.getByRole("button", { name: "매장 상세 보기" }))
    expect(router.push).toHaveBeenCalledWith({ pathname: "/shop/[shopId]", params: { shopId: "7" } })
    // 상세에 다녀와도 결과는 이 화면 상태에 그대로 남는다
    expect(view.getByText(/^하쿠텐/)).toBeTruthy()
    jest.useRealTimers()
  })

  it("lets guests see today's pick immediately when the local result is ready", async () => {
    jest.useFakeTimers()
    const view = await renderScreen(<AIRecommendScreen />, true)
    await view.findByText("1 / 4")
    await fireEvent.press(view.getByRole("radio", { name: "쇼유, 간장 타레" }))
    await fireEvent.press(view.getByRole("button", { name: "다음" }))
    await fireEvent.press(view.getByRole("radio", { name: "혼밥하기 좋은 곳" }))
    await fireEvent.press(view.getByRole("button", { name: "다음" }))
    await fireEvent.press(view.getByRole("radio", { name: "깔끔하고 깊은 감칠맛" }))
    await fireEvent.press(view.getByRole("button", { name: "다음" }))
    await fireEvent.press(view.getByRole("button", { name: "AI 맞춤 추천받기" }))
    // 결과가 준비됐으므로 발권 연출을 기다리지 않고 곧바로 볼 수 있다
    await fireEvent.press(view.getByRole("button", { name: "추천 바로 보기" }))
    expect(view.getByText("오늘의 추천")).toBeTruthy()
    jest.useRealTimers()
    await fireEvent.press(view.getByRole("button", { name: "이 가게 기록하기" }))
    expect(router.push).toHaveBeenCalledWith("/auth/login")
  })
})
