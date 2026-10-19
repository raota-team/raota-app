import { act, fireEvent, render, waitFor, within } from "@testing-library/react-native"
import type { ReactElement } from "react"
import type * as Reanimated from "react-native-reanimated"
import appConfig from "../app.json"
import { Share, processColor } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { createInitialPersistedState } from "@/src/data/fixtures"
import type { RaotaRepository } from "@/src/repository"
import { RaotaProvider } from "@/src/state/RaotaStore"
import { soupColorOf } from "@/src/theme"
import MyScreen from "@/app/native/my"
import SettingsScreen from "@/app/(flows)/settings"
import TasteReportScreen from "@/app/(flows)/taste/index"
import MonthlyTasteScreen from "@/app/(flows)/taste/archive"
import MonthlyTasteReportScreen from "@/app/(flows)/taste/[reportId]"

const mockParams: Record<string, string | undefined> = {}

jest.mock("expo-router", () => {
  const React = require("react") as typeof import("react")
  const { View } = require("react-native") as typeof import("react-native")
  const Stack = ({ children }: { children?: React.ReactNode }) => React.createElement(View, null, children)
  Stack.Screen = () => null
  return {
    Stack,
    Redirect: ({ href }: { href: string }) => React.createElement(View, { testID: `redirect:${href}` }),
    router: { back: jest.fn(), canGoBack: jest.fn(() => true), push: jest.fn(), replace: jest.fn() },
    useIsFocused: jest.fn(() => true),
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

jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"))
jest.mock("react-native-reanimated", () => {
  const animation = require("react-native-reanimated/mock") as typeof Reanimated
  return {
    ...animation,
    useReducedMotion: jest.fn(() => false),
    withDelay: jest.fn(animation.withDelay),
    withTiming: jest.fn(animation.withTiming),
  }
})

jest.mock("@/src/analytics", () => ({ track: jest.fn() }))
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}))


const { router } = jest.requireMock("expo-router") as { router: Record<string, jest.Mock> }
const { track } = jest.requireMock("@/src/analytics") as { track: jest.Mock }
const imagePicker = jest.requireMock("expo-image-picker") as {
  requestMediaLibraryPermissionsAsync: jest.Mock
  launchImageLibraryAsync: jest.Mock
}
const { useReducedMotion, withDelay, withTiming } = jest.requireMock("react-native-reanimated") as {
  useReducedMotion: jest.Mock
  withDelay: jest.Mock
  withTiming: jest.Mock
}

function repository(state = createInitialPersistedState()): RaotaRepository {
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

function renderScreen(element: ReactElement, state = createInitialPersistedState()) {
  return render(
    <SafeAreaProvider initialMetrics={safeArea}>
      <RaotaProvider repository={repository(state)}>{element}</RaotaProvider>
    </SafeAreaProvider>,
  )
}

beforeEach(() => {
  for (const key of Object.keys(mockParams)) delete mockParams[key]
  jest.clearAllMocks()
  useReducedMotion.mockReturnValue(false)
})

afterEach(() => jest.useRealTimers())

describe("my screen (demo account)", () => {
  it("shows the compact profile, grouped appraisal and the only report entry", async () => {
    const view = await renderScreen(<MyScreen />)

    expect(await view.findByText("뿡")).toBeTruthy()
    expect(view.getByText("12시간 농축 동물계 육수와 꼬들한 면을 애호합니다.")).toBeTruthy()
    expect(view.getByLabelText("총 라멘로그 42그릇")).toBeTruthy()
    expect(view.getByRole("button", { name: "다음 등급까지 8그릇" })).toBeTruthy()
    await fireEvent.press(view.getByRole("button", { name: "다음 등급까지 8그릇" }))
    expect(view.getByText("라멘 활동 등급")).toBeTruthy()
    await fireEvent.press(view.getByRole("button", { name: "확인" }))
    await fireEvent.press(view.getByRole("button", { name: /^등급 안내, Lv\.4/ }))
    expect(view.getByText("라멘 활동 등급")).toBeTruthy()
    await fireEvent.press(view.getByRole("button", { name: "확인" }))
    expect(view.getByTestId("my-report-ticket")).toBeTruthy()
    expect(view.getByText("종합 감정 · 42그릇")).toBeTruthy()
    expect(view.getByText("진한 돈골파")).toBeTruthy()
    expect(view.getByLabelText(/^그릇 감정서\. 돈코츠 14그릇/)).toBeTruthy()
    expect(view.getByText("돈코츠 14 · 쇼유 12 · 시오 8 · 미소 4 · 기타 4")).toBeTruthy()
    expect(view.queryByText(/^이번 달 \d+그릇$/)).toBeNull()
    expect(view.queryByRole("button", { name: "최근 기록으로 다시 정리" })).toBeNull()

    await fireEvent.press(view.getByRole("button", { name: "종합 리포트 보기" }))
    expect(router.push).toHaveBeenCalledWith("/taste")
  })

  it("edits the status and photo together, then can remove the photo", async () => {
    imagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true })
    imagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///profile-square.jpg" }],
    })
    const view = await renderScreen(<MyScreen />)
    await view.findByText("뿡")

    await fireEvent.press(view.getByRole("button", { name: "프로필 사진과 상태 메시지 바꾸기" }))
    expect(view.getByText("프로필 편집")).toBeTruthy()
    expect(view.getByDisplayValue("12시간 농축 동물계 육수와 꼬들한 면을 애호합니다.")).toBeTruthy()
    await fireEvent.press(view.getByRole("button", { name: "프로필 사진 변경" }))
    expect(imagePicker.launchImageLibraryAsync).toHaveBeenCalledWith({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.82,
    })
    expect(view.getByRole("button", { name: "프로필 사진 삭제" })).toBeTruthy()
    await fireEvent.changeText(view.getByLabelText("상태 메시지"), "60자 이내 소개")
    expect(view.getByText("9/60")).toBeTruthy()
    await fireEvent.press(view.getByRole("button", { name: "저장" }))
    expect(await view.findByText("60자 이내 소개")).toBeTruthy()

    await fireEvent.press(view.getByRole("button", { name: "프로필 사진과 상태 메시지 바꾸기" }))
    expect(view.getByRole("button", { name: "프로필 사진 삭제" })).toBeTruthy()
    await fireEvent.press(view.getByRole("button", { name: "프로필 사진 삭제" }))
    expect(view.queryByRole("button", { name: "프로필 사진 삭제" })).toBeNull()
    await fireEvent.press(view.getByRole("button", { name: "저장" }))
    await fireEvent.press(view.getByRole("button", { name: "프로필 사진과 상태 메시지 바꾸기" }))
    expect(view.queryByRole("button", { name: "프로필 사진 삭제" })).toBeNull()
  })

  it("lets a new member add a status from the empty-state prompt without saving a canceled draft", async () => {
    const state = createInitialPersistedState()
    state.user = { ...state.user!, bio: "", avatar: null }
    const view = await renderScreen(<MyScreen />, state)
    await view.findByText("뿡")

    await fireEvent.press(view.getByRole("button", { name: "상태 메시지를 남겨 보세요" }))
    await fireEvent.changeText(view.getByLabelText("상태 메시지"), "다음엔 쇼유")
    await fireEvent.press(view.getByRole("button", { name: "닫기" }))
    expect(view.getByRole("button", { name: "상태 메시지를 남겨 보세요" })).toBeTruthy()

    await fireEvent.press(view.getByRole("button", { name: "상태 메시지를 남겨 보세요" }))
    expect(view.getByDisplayValue("")).toBeTruthy()
    await fireEvent.changeText(view.getByLabelText("상태 메시지"), "다음엔 쇼유")
    await fireEvent.press(view.getByRole("button", { name: "저장" }))
    expect(await view.findByText("다음엔 쇼유")).toBeTruthy()
  })

  it("shows the highest level without a next target", async () => {
    const state = createInitialPersistedState()
    state.user = { ...state.user!, visitedCount: 100 }
    const view = await renderScreen(<MyScreen />, state)
    await view.findByText("뿡")
    expect(view.getByRole("button", { name: "최고 등급이에요" })).toBeTruthy()
    await fireEvent.press(view.getByRole("button", { name: "최고 등급이에요" }))
    expect(view.getByText("라멘 활동 등급")).toBeTruthy()
  })

  it("opens monthly reports from the card under the appraisal", async () => {
    const view = await renderScreen(<MyScreen />)
    await view.findByText("뿡")
    expect(view.queryByTestId("monthly-taste-ledger")).toBeNull()
    await fireEvent.press(view.getByRole("button", { name: /^월별 취향 변화, / }))
    expect(router.push).toHaveBeenCalledWith("/taste/archive")
  })

  it("has only three activity tabs and keeps the calendar under 라멘로그", async () => {
    const view = await renderScreen(<MyScreen />)
    await view.findByText("뿡")

    const tabs = view.getAllByRole("tab")
    expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual(["라멘로그 42", expect.stringMatching(/^방문매장 \d+$/), "가고싶어요 4"])
    expect(view.queryByText("작성글")).toBeNull()
    expect(view.getByText("라멘로그 캘린더")).toBeTruthy()

    await fireEvent.press(view.getByRole("tab", { name: /^방문매장/ }))
    expect(view.queryByText("라멘로그 캘린더")).toBeNull()
    expect(view.getByText(/방문 수를 더하면 총 42그릇이에요/)).toBeTruthy()

    await fireEvent.press(view.getByRole("tab", { name: "가고싶어요 4" }))
    await fireEvent.press(view.getByRole("button", { name: "멘야준 저장 해제" }))
    expect(view.getByRole("tab", { name: "가고싶어요 3" })).toBeTruthy()
    expect(view.getByText("'멘야준' 저장을 해제했어요")).toBeTruthy()
  })

  it("shows compact navigation after the measured profile scrolls off without resizing the sticky tabs", async () => {
    const view = await renderScreen(<MyScreen />)
    await view.findByText("뿡")
    const stickyStyle = view.getByTestId("my-sticky-tabs").props.style

    await fireEvent(view.getByTestId("my-profile"), "layout", { nativeEvent: { layout: { height: 360 } } })
    await fireEvent.scroll(view.getByTestId("my-main-scroll"), {
      nativeEvent: { contentOffset: { y: 320 }, layoutMeasurement: { height: 844 }, contentSize: { height: 2400 } },
    })

    const sticky = view.getByTestId("my-sticky-tabs", { includeHiddenElements: true })
    expect(sticky.props.style).toEqual(stickyStyle)
    expect(sticky.props.accessibilityElementsHidden).toBe(true)
    const compact = view.getByTestId("my-compact-overlay")
    expect(within(compact).getAllByRole("tab")).toHaveLength(3)
    await fireEvent.press(within(compact).getByRole("button", { name: "설정" }))
    expect(router.push).toHaveBeenCalledWith("/settings")
  })

  it("confirms logout in settings and then My shows only the guest prompt", async () => {
    // 마이와 설정을 같은 스토어에 함께 띄워, 설정에서 로그아웃하면 마이가 비회원 화면으로 바뀌는지 본다
    const view = await renderScreen(
      <>
        <MyScreen />
        <SettingsScreen />
      </>,
    )
    await view.findByText("뿡")

    await fireEvent.press(view.getByRole("button", { name: "로그아웃" }))
    expect(view.getByText("로그아웃할까요?")).toBeTruthy()
    expect(view.getByText("기록과 취향 리포트는 계정에 그대로 남아 있어요.")).toBeTruthy()
    const buttons = view.getAllByRole("button", { name: "로그아웃" })
    await fireEvent.press(buttons[buttons.length - 1])

    expect(await view.findByText("내 라멘 취향을 모아보세요")).toBeTruthy()
    expect(view.queryByText("뿡")).toBeNull()
    expect(view.queryByText("진한 돈골파")).toBeNull()
    expect(view.getByRole("button", { name: "로그인" })).toBeTruthy()
    expect(view.getByRole("button", { name: "회원가입" })).toBeTruthy()
    // 로그아웃한 설정 화면은 마이로 돌아간다
    expect(view.getByTestId("redirect:/native/my")).toBeTruthy()
  })

  it("pages recent bowls inside their five-row frame, not the main scroll", async () => {
    const view = await renderScreen(<MyScreen />)
    await view.findByText("뿡")
    const list = view.getByTestId("my-logs-list")
    const remaining = () =>
      Number(/(\d+)그릇 남음/.exec(view.getByRole("button", { name: /^기록 더 보기/ }).props.accessibilityLabel)?.[1])
    const total = Number(/총 (\d+)그릇/.exec(view.getByText(/^총 \d+그릇$/).props.children.join(""))?.[1])

    expect(list.props.nestedScrollEnabled).toBe(true)
    expect(remaining()).toBe(total - 5)
    await fireEvent.scroll(view.getByTestId("my-main-scroll"), {
      nativeEvent: { contentOffset: { y: 1400 }, layoutMeasurement: { height: 840 }, contentSize: { height: 2200 } },
    })
    expect(remaining()).toBe(total - 5)
    const bottom = { nativeEvent: { contentOffset: { y: 40 }, layoutMeasurement: { height: 360 }, contentSize: { height: 404 } } }
    await fireEvent.scroll(list, bottom)
    expect(remaining()).toBe(total - 10)
    // 목록이 늘어난 뒤 다시 바닥에 닿으면 다음 5개를 붙인다
    await fireEvent.scroll(list, bottom)
    expect(remaining()).toBe(total - 15)
    await fireEvent.press(view.getByRole("button", { name: /^기록 더 보기/ }))
    expect(remaining()).toBe(total - 20)
  })

  it("pages visits inside the frame and keeps the shorter saved list searchable", async () => {
    const view = await renderScreen(<MyScreen />)
    await view.findByText("뿡")
    await fireEvent.press(view.getByRole("tab", { name: /^방문매장/ }))
    const visits = view.getByTestId("my-visits-list")
    expect(visits.props.nestedScrollEnabled).toBe(true)
    expect(view.getByRole("button", { name: /^방문매장 더 보기, 2곳 남음$/ })).toBeTruthy()
    await fireEvent.scroll(visits, {
      nativeEvent: { contentOffset: { y: 40 }, layoutMeasurement: { height: 720 }, contentSize: { height: 764 } },
    })
    expect(view.queryByRole("button", { name: /^방문매장 더 보기/ })).toBeNull()

    await fireEvent.press(view.getByRole("tab", { name: "가고싶어요 4" }))
    const saved = view.getByTestId("my-saved-list")
    expect(saved.props.nestedScrollEnabled).toBe(true)
    expect(view.queryByRole("button", { name: /^저장한 매장 더 보기/ })).toBeNull()
    await fireEvent.changeText(view.getByLabelText("저장한 라멘집 검색"), "멘야준")
    expect(within(saved).getByRole("button", { name: "멘야준 저장 해제" })).toBeTruthy()
    expect(within(saved).queryByRole("button", { name: "묘코 저장 해제" })).toBeNull()
  })

  it("moves account, terms and contact into settings behind the gear button", async () => {
    const view = await renderScreen(<MyScreen />)
    await view.findByText("뿡")
    expect(view.queryByRole("button", { name: "로그아웃" })).toBeNull()
    await fireEvent.press(view.getByRole("button", { name: "설정" }))
    expect(router.push).toHaveBeenCalledWith("/settings")
  })

  it("opens the full terms page and contact from settings", async () => {
    const view = await renderScreen(<SettingsScreen />)
    await view.findByText("bbung@raota.net")
    await fireEvent.press(view.getByRole("button", { name: "이용약관" }))
    expect(router.push).toHaveBeenCalledWith({ pathname: "/legal/[doc]", params: { doc: "terms" } })
    expect(view.getByRole("button", { name: "문의하기, contact@raota.net" })).toBeTruthy()
    expect(view.getByText(`앱 버전 ${appConfig.expo.version}`)).toBeTruthy()
  })

  it("shows a natural empty state for a new member with zero bowls", async () => {
    const state = createInitialPersistedState()
    state.user = { ...state.user!, id: "local-new", nickname: "새회원", name: "새회원", visitedCount: 0, membershipNo: "#RT-000001" }
    state.bookmarkedShopIds = []
    const view = await renderScreen(<MyScreen />, state)

    expect(await view.findByText("새회원")).toBeTruthy()
    expect(view.getByRole("button", { name: "다음 등급까지 1그릇" })).toBeTruthy()
    expect(view.getByLabelText("총 라멘로그 0그릇")).toBeTruthy()
    expect(view.getByText("아직 취향을 모으는 중")).toBeTruthy()
    expect(view.getByText("아직 기록이 없어요")).toBeTruthy()
    expect(view.queryByText("진한 돈골파")).toBeNull()
    expect(view.queryByLabelText(/^그릇 감정서/)).toBeNull()
    expect(view.queryByRole("button", { name: "최근 기록으로 다시 정리" })).toBeNull()
    await fireEvent.press(view.getAllByRole("button", { name: "첫 그릇 기록하기" })[0])
    expect(router.push).toHaveBeenCalledWith({ pathname: "/record/select-shop", params: { mode: "nearby" } })
  })
})

describe("taste report", () => {
  it("shows the identity, type distribution and frequent shops, and tracks the view", async () => {
    const view = await renderScreen(<TasteReportScreen />)

    expect(await view.findByText("진한 돈골파")).toBeTruthy()
    expect(view.getByLabelText("돈코츠 14그릇, 33%")).toBeTruthy()
    expect(view.getByLabelText(/^맛 지문\. 육수 농도 진한 편 3\.9, 면 삶기 단단한 편 4\.0$/)).toBeTruthy()
    expect(view.getByText("자주 간 라멘집")).toBeTruthy()
    expect(view.getByText(/숙주와 양배추를 센 불에 볶아 올려서/)).toBeTruthy()
    expect(view.getByText("별점 5")).toBeTruthy()
    expect(track).toHaveBeenCalledWith("report_viewed", { kind: "overall", bowls: 42 })
    const nextShop = view.getAllByRole("button", { name: /매장 보기$/ })[0]
    await fireEvent.press(nextShop)
    expect(router.push).toHaveBeenCalledWith({ pathname: "/shop/[shopId]", params: { shopId: expect.any(String) } })
  })

  it("keeps recomputing available only from the full report", async () => {
    const view = await renderScreen(<TasteReportScreen />)
    await view.findByText("진한 돈골파")
    await fireEvent.press(view.getByRole("button", { name: "최근 기록으로 다시 정리" }))
    expect(view.getByText("라멘 취향 감정서")).toBeTruthy()
    await fireEvent.press(view.getByRole("button", { name: "리포트 바로 보기" }))
    expect(view.getByText("종류별로 먹은 라멘")).toBeTruthy()
  })

  it("closes quietly when the share sheet is dismissed", async () => {
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: Share.dismissedAction })
    const view = await renderScreen(<TasteReportScreen />)
    await view.findByText("진한 돈골파")

    await fireEvent.press(view.getByRole("button", { name: "취향 리포트 공유" }))
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("진한 돈골파") }),
    )
    expect(view.queryByText(/공유했어요|복사했어요/)).toBeNull()
    expect(view.queryByText("공유하지 못했어요")).toBeNull()
  })

  it("offers the text to copy when sharing fails", async () => {
    jest.spyOn(Share, "share").mockRejectedValue(new Error("unsupported"))
    const view = await renderScreen(<TasteReportScreen />)
    await view.findByText("진한 돈골파")

    await fireEvent.press(view.getByRole("button", { name: "취향 리포트 공유" }))
    await waitFor(() => expect(view.getByText("공유하지 못했어요")).toBeTruthy())
  })

  it("fills real bowls in order, groups them, then shows the identity", async () => {
    mockParams.analyze = "1"
    jest.useFakeTimers()
    const view = await renderScreen(<TasteReportScreen />)

    expect(await view.findByText("기록한 42그릇을 바탕으로 분석해요")).toBeTruthy()
    expect(view.getByText("라멘 취향 감정서")).toBeTruthy()
    expect(view.getByText("No. RT-0842")).toBeTruthy()
    expect(view.getAllByTestId(/^report-bowl-\d+$/)).toHaveLength(42)
    expect(view.queryByTestId("report-bowl-result")).toBeNull()
    expect(view.queryByText("종류별로 먹은 라멘")).toBeNull()
    expect(view.getByText("라멘 기록을 모으고 있어요")).toBeTruthy()

    await act(async () => jest.advanceTimersByTimeAsync(950))
    expect(view.getByText("그릇마다 국물을 채우고 있어요")).toBeTruthy()
    await act(async () => jest.advanceTimersByTimeAsync(1900))
    expect(view.getByText("종류별로 모으고 있어요")).toBeTruthy()
    await act(async () => jest.advanceTimersByTimeAsync(900))
    expect(view.getByLabelText("기타 4그릇")).toBeTruthy()
    await act(async () => jest.advanceTimersByTimeAsync(300))
    expect(view.getByText("진한 돈골파")).toBeTruthy()
    expect(view.getByText("42그릇 중 돈코츠 14그릇")).toBeTruthy()
    expect(view.queryByTestId("report-stamp")).toBeNull()
    expect(view.getByText("나의 라멘 취향이 정리됐어요")).toBeTruthy()

    await act(async () => jest.advanceTimersByTimeAsync(1200))
    expect(view.getByText("종류별로 먹은 라멘")).toBeTruthy()
  })

  it("uses every bowl for a short ledger, preserving its record order and soup colors", async () => {
    mockParams.analyze = "1"
    const state = createInitialPersistedState()
    state.user = { ...state.user!, id: "local-taste", visitedCount: 2, membershipNo: "#RT-0022" }
    state.logs.push(
      { ...state.logs[0], id: "901", author: { ...state.logs[0].author, id: "local-taste" }, visitedAt: "2026. 10. 01", ramenType: "쇼유" },
      { ...state.logs[0], id: "902", author: { ...state.logs[0].author, id: "local-taste" }, visitedAt: "2026. 10. 02", ramenType: "시오" },
    )
    const view = await renderScreen(<TasteReportScreen />, state)

    expect(await view.findByText("기록한 2그릇을 바탕으로 분석해요")).toBeTruthy()
    expect(view.getByText("No. RT-0022")).toBeTruthy()
    expect(view.getAllByTestId(/^report-bowl-\d+$/)).toHaveLength(2)
    expect(within(view.getByTestId("report-bowl-0")).getByTestId("report-bowl-soup-0").props.fill).toEqual(
      expect.objectContaining({ payload: processColor(soupColorOf("쇼유")) }),
    )
    expect(within(view.getByTestId("report-bowl-1")).getByTestId("report-bowl-soup-1").props.fill).toEqual(
      expect.objectContaining({ payload: processColor(soupColorOf("시오")) }),
    )
    expect(view.queryByText(/그릇 1개 ≈/)).toBeNull()
  })

  it("caps a large ledger at 42 icons but reports the actual per-type totals", async () => {
    mockParams.analyze = "1"
    jest.useFakeTimers()
    const state = createInitialPersistedState()
    state.user = { ...state.user!, visitedCount: 43 }
    state.logs.push({
      ...state.logs[0],
      id: "903",
      author: { ...state.logs[0].author, id: state.user!.id },
      visitedAt: "2026. 10. 15",
      ramenType: "츠케멘",
    })
    const view = await renderScreen(<TasteReportScreen />, state)

    expect(await view.findByText("기록한 43그릇을 바탕으로 분석해요")).toBeTruthy()
    const icons = view.getAllByTestId(/^report-bowl-\d+$/)
    expect(icons).toHaveLength(42)
    // 최대 잔여 배분: 기타는 츠케멘·아부라소바를 묶어 다섯 종류로 읽는다
    const soupColors = icons.map((icon, index) => within(icon).getByTestId(`report-bowl-soup-${index}`).props.fill.payload)
    expect(soupColors.filter((color) => color === processColor(soupColorOf("돈코츠")))).toHaveLength(13)
    expect(soupColors.filter((color) => color === processColor(soupColorOf("기타")))).toHaveLength(5)
    await act(async () => jest.advanceTimersByTimeAsync(3750))
    expect(view.getByLabelText("기타 5그릇")).toBeTruthy()
    expect(view.getByText("그릇 1개 ≈ 1.02그릇 · 전체 43그릇")).toBeTruthy()
  })

  it("does not animate an empty account when an analysis link opens before hydration", async () => {
    mockParams.analyze = "1"
    const state = createInitialPersistedState()
    state.user = { ...state.user!, id: "local-empty", visitedCount: 0 }
    const view = await renderScreen(<TasteReportScreen />, state)

    expect(await view.findByText("아직 보여드릴 취향이 없어요")).toBeTruthy()
    expect(view.queryByText("라멘 취향 감정서")).toBeNull()
  })

  it("skips on request and shows the final filled sheet immediately for Reduce Motion", async () => {
    mockParams.analyze = "1"
    const view = await renderScreen(<TasteReportScreen />)
    expect(await view.findByText("라멘 취향 감정서")).toBeTruthy()
    await fireEvent.press(view.getByRole("button", { name: "리포트 바로 보기" }))
    expect(await view.findByText("진한 돈골파")).toBeTruthy()
    expect(view.getByText("전체 42그릇으로 취향을 다시 정리했어요")).toBeTruthy()
    await view.unmount()

    useReducedMotion.mockReturnValue(true)
    jest.useFakeTimers()
    const reduced = await renderScreen(<TasteReportScreen />)
    expect(await reduced.findByText("라멘 취향 감정서")).toBeTruthy()
    expect(reduced.getByTestId("report-bowl-result")).toBeTruthy()
    expect(reduced.queryByTestId("report-stamp")).toBeNull()
    expect(reduced.getByLabelText("돈코츠 14그릇")).toBeTruthy()
    await act(async () => jest.advanceTimersByTimeAsync(500))
    await act(async () => jest.advanceTimersByTimeAsync(4800))
    expect(reduced.getByText("종류별로 먹은 라멘")).toBeTruthy()
  })
})

describe("monthly taste", () => {
  it("opens on the latest finished month and compares it with the previous month", async () => {
    const view = await renderScreen(<MonthlyTasteScreen />)
    expect(await view.findByText("8월의 취향")).toBeTruthy()
    expect(view.getByRole("tab", { name: "2026년 8월" }).props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    )
    expect(view.getByText("맑은 시오파")).toBeTruthy()
    expect(view.getByText("지난달과 달라진 메뉴")).toBeTruthy()
    expect(within(view.getByLabelText("2026년 8월 라멘 종류별 그릇 수와 비율")).getAllByText(/%p|—/).length).toBeGreaterThan(0)
    await fireEvent.press(view.getByRole("tab", { name: "2026년 7월" }))
    expect(view.getByText("7월의 취향")).toBeTruthy()
    await fireEvent.press(view.getByRole("tab", { name: "2026년 6월" }))
    expect(view.getByText("6월의 취향")).toBeTruthy()
    expect(view.getByText("첫 월별 기록이에요. 다음 달부터 변화를 비교해요.")).toBeTruthy()
    expect(view.getByText("종류별로 먹은 라멘")).toBeTruthy()
  })

  it("animates both monthly distributions again on selection, but skips motion when requested", async () => {
    const view = await renderScreen(<MonthlyTasteScreen />)
    expect(await view.findByLabelText(/^2026년 8월 메뉴 분포/)).toBeTruthy()
    expect(withTiming).toHaveBeenCalledWith(1, expect.objectContaining({ easing: expect.any(Function) }))
    // 두 막대는 차례로 펼쳐진다
    expect(withDelay.mock.calls.some(([delay]: [number]) => delay > 0)).toBe(true)

    const previousAnimations = withTiming.mock.calls.length
    await fireEvent.press(view.getByRole("tab", { name: "2026년 7월" }))
    expect(withTiming.mock.calls.length).toBeGreaterThan(previousAnimations)
    expect(view.getByLabelText(/^2026년 7월 메뉴 분포/)).toBeTruthy()
    await view.unmount()

    withTiming.mockClear()
    withDelay.mockClear()
    useReducedMotion.mockReturnValue(true)
    const reduced = await renderScreen(<MonthlyTasteScreen />)
    expect(await reduced.findByLabelText(/^2026년 8월 메뉴 분포/)).toBeTruthy()
    await fireEvent.press(reduced.getByRole("tab", { name: "2026년 7월" }))
    expect(withTiming).not.toHaveBeenCalled()
    expect(withDelay).not.toHaveBeenCalled()
  })

  it("opens the month given by the route id", async () => {
    mockParams.reportId = "2026-07"
    const view = await renderScreen(<MonthlyTasteReportScreen />)
    expect(await view.findByText("7월의 취향")).toBeTruthy()
    expect(view.getByRole("tab", { name: "2026년 7월" }).props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    )
  })
})
