import { act, fireEvent, render, waitFor, within } from "@testing-library/react-native"
import type { ReactElement } from "react"
import type * as Reanimated from "react-native-reanimated"
import appConfig from "../app.json"
import { AccessibilityInfo, Linking, Share, StyleSheet, processColor } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { createInitialPersistedState } from "@/src/data/fixtures"
import type { RaotaRepository } from "@/src/repository"
import { RaotaProvider } from "@/src/state/RaotaStore"
import { colors, soupColorOf } from "@/src/theme"
import MyScreen from "@/app/native/my"
import SettingsScreen from "@/app/(flows)/settings"
import TasteReportScreen from "@/app/(flows)/taste/index"
import MonthlyTasteScreen from "@/app/(flows)/taste/archive"
import MonthlyTasteReportScreen from "@/app/(flows)/taste/[reportId]"
import MyTypeScreen from "@/app/(flows)/my-type/[type]"
import { bowlTypes } from "@/src/domain/myBowls"

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
  getMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ status: "undetermined", granted: false })),
  getCameraPermissionsAsync: jest.fn(() => Promise.resolve({ status: "undetermined", granted: false })),
  requestCameraPermissionsAsync: jest.fn(),
}))
jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: "undetermined", granted: false })),
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: "granted", granted: true })),
}))
jest.mock("expo-haptics", () => ({
  ImpactFeedbackStyle: { Light: "light" },
  NotificationFeedbackType: { Success: "success" },
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
}))


const { router } = jest.requireMock("expo-router") as { router: Record<string, jest.Mock> }
const { track } = jest.requireMock("@/src/analytics") as { track: jest.Mock }
const imagePicker = jest.requireMock("expo-image-picker") as {
  requestMediaLibraryPermissionsAsync: jest.Mock
  launchImageLibraryAsync: jest.Mock
}
const haptics = jest.requireMock("expo-haptics") as { impactAsync: jest.Mock }
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
    expect(view.getByText("진한 돈골파 · 지금까지")).toBeTruthy()
    expect(view.getByText("42그릇을 기록했어요")).toBeTruthy()
    expect(view.getByText("4장 이야기")).toBeTruthy()
    expect(view.queryByText(/^이번 달 \d+그릇$/)).toBeNull()
    expect(view.queryByRole("button", { name: "리포트 다시 뽑기" })).toBeNull()

    await fireEvent.press(view.getByRole("button", { name: /^종합 리포트 보기\. 진한 돈골파, 42그릇을 기록했어요/ }))
    expect(router.push).toHaveBeenCalledWith("/taste")
  })

  it("counts every number on My from the bowl ledger even when the profile counter lags", async () => {
    const state = createInitialPersistedState()
    // 프로필 카운터는 42인데 그릇 목록은 앱 기록 하나가 더해져 43그릇이다
    state.user = { ...state.user!, visitedCount: 42 }
    state.logs.push({ ...state.logs[0], id: "904", author: { ...state.logs[0].author, id: state.user!.id }, visitedAt: "2026. 10. 15" })
    const view = await renderScreen(<MyScreen />, state)

    expect(await view.findByLabelText("총 라멘로그 43그릇")).toBeTruthy()
    expect(view.getByRole("tab", { name: "라멘로그 43" })).toBeTruthy()
    expect(view.getByText("43그릇을 기록했어요")).toBeTruthy()
    expect(view.getByText("총 43그릇")).toBeTruthy()
    expect(view.getByRole("button", { name: "다음 등급까지 7그릇" })).toBeTruthy()
    expect(view.queryByText(/(^|\D)42그릇/)).toBeNull()
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
    // 등급은 그릇 목록 길이로 정한다. 데모 원장 42그릇에 앱 기록 58개를 더해 100그릇을 채운다
    for (let index = 0; index < 58; index++) {
      state.logs.push({ ...state.logs[0], id: `max-${index}`, author: { ...state.logs[0].author, id: state.user!.id }, visitedAt: "2026. 10. 15" })
    }
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

  it("confirms logout in settings, goes straight to login and leaves no guest My page", async () => {
    // 마이와 설정을 같은 스토어에 함께 띄워, 설정에서 로그아웃하면 로그인 화면으로 가고 마이에는 회원 정보가 남지 않는지 본다
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

    expect(router.replace).toHaveBeenCalledWith("/auth/login")
    await waitFor(() => expect(view.queryByText("뿡")).toBeNull())
    expect(view.queryByText("진한 돈골파")).toBeNull()
    // 비회원이 마이에 남아 있으면(로그인에서 뒤로 등) 홈으로 보낸다. 비회원 전용 화면은 없다
    expect(view.getAllByTestId("redirect:/native").length).toBeGreaterThan(0)
    expect(view.queryByRole("button", { name: "회원가입" })).toBeNull()
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

  it("shows each permission's state in settings, asks when not asked yet and sends answered ones to the Settings app", async () => {
    const location = jest.requireMock("expo-location") as { getForegroundPermissionsAsync: jest.Mock; requestForegroundPermissionsAsync: jest.Mock }
    const picker = jest.requireMock("expo-image-picker") as { getMediaLibraryPermissionsAsync: jest.Mock }
    let asked = false
    location.getForegroundPermissionsAsync.mockImplementation(() =>
      Promise.resolve(asked ? { status: "granted", granted: true } : { status: "undetermined", granted: false }),
    )
    location.requestForegroundPermissionsAsync.mockImplementation(() => {
      asked = true
      return Promise.resolve({ status: "granted", granted: true })
    })
    picker.getMediaLibraryPermissionsAsync.mockResolvedValue({ status: "denied", granted: false })
    const openSettings = jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined)
    try {
      const view = await renderScreen(<SettingsScreen />)
      // 묻기 전이면 그 자리에서 권한창을 띄우고, 답을 다시 읽어 보여 준다
      await fireEvent.press(await view.findByRole("button", { name: "위치, 묻기 전" }))
      expect(location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1)
      expect(await view.findByRole("button", { name: "위치, 허용" })).toBeTruthy()
      expect(openSettings).not.toHaveBeenCalled()
      // 한 번 거절한 권한은 앱이 다시 물을 수 없어 설정 앱을 연다
      await fireEvent.press(view.getByRole("button", { name: "사진, 꺼짐" }))
      expect(openSettings).toHaveBeenCalledTimes(1)
    } finally {
      openSettings.mockRestore()
    }
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
    expect(view.queryByText(/그릇을 기록했어요$/)).toBeNull()
    expect(view.queryByRole("button", { name: "리포트 다시 뽑기" })).toBeNull()
    await fireEvent.press(view.getAllByRole("button", { name: "첫 그릇 기록하기" })[0])
    expect(router.push).toHaveBeenCalledWith({ pathname: "/record/select-shop", params: { mode: "nearby" } })
  })
})

describe("taste report", () => {
  it("shows the identity, type distribution and frequent shops, and tracks the view", async () => {
    const view = await renderScreen(<TasteReportScreen />)

    expect(await view.findByText("진한 돈골파")).toBeTruthy()
    expect(view.getByLabelText("돈코츠 14그릇, 33%")).toBeTruthy()
    expect(view.getByLabelText(/^나의 취향\. 진한 육수에 단단한 면\. 진한 돈골파 · #진한 육수 #단단한 면/)).toBeTruthy()
    expect(view.getByText(/^1 \/ 4/)).toBeTruthy()
    expect(view.getByText("자주 간 라멘집")).toBeTruthy()
    expect(view.getByText(/숙주와 양배추를 센 불에 볶아 올려서/)).toBeTruthy()
    expect(view.getByText("별점 5")).toBeTruthy()
    expect(track).toHaveBeenCalledWith("report_viewed", { kind: "overall", bowls: 42 })
    const nextShop = view.getAllByRole("button", { name: /매장 보기$/ })[0]
    await fireEvent.press(nextShop)
    expect(router.push).toHaveBeenCalledWith({ pathname: "/shop/[shopId]", params: { shopId: expect.any(String) } })
  })

  it("cues the hidden story cards and advances one card per tap", async () => {
    const view = await renderScreen(<TasteReportScreen />)
    await view.findByText("진한 돈골파")

    for (const page of [2, 3, 4]) {
      await fireEvent.press(view.getByRole("button", { name: "다음 장 넘겨 보기" }))
      expect(view.getByText(new RegExp(`^${page} / 4`))).toBeTruthy()
    }
    // 마지막 장에서는 더 넘길 곳이 없으니 화살표 버튼이 사라지고 쪽수만 남는다
    expect(view.queryByRole("button", { name: "다음 장 넘겨 보기" })).toBeNull()
    expect(view.getByText("4 / 4")).toBeTruthy()
  })

  it("ends the report on drawing it again, with sharing only in the header", async () => {
    const view = await renderScreen(<TasteReportScreen />)
    await view.findByText("진한 돈골파")

    // 공유는 헤더 하나뿐이다. 끝에 같은 공유 버튼을 또 두지 않는다
    expect(view.queryByRole("button", { name: "리포트 공유하기" })).toBeNull()
    await fireEvent.press(view.getByRole("button", { name: "리포트 다시 뽑기" }))
    expect(view.getByTestId("report-bowl-stage")).toBeTruthy()
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

  it("drops real bowls into per-type towers, highlights the tallest, then shows the identity", async () => {
    mockParams.analyze = "1"
    jest.useFakeTimers()
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility")
    const view = await renderScreen(<TasteReportScreen />)

    expect(await view.findByText("라멘 취향 감정서")).toBeTruthy()
    expect(view.getByText("No. RT-0842")).toBeTruthy()
    // 시작 안내는 포커스를 받는 제목이 맡는다
    expect(view.getByLabelText("42그릇을 정리하고 있어요")).toBeTruthy()
    expect(view.getByText("그릇을 쌓고 있어요")).toBeTruthy()
    expect(view.getAllByTestId(/^report-bowl-\d+$/)).toHaveLength(42)
    expect(view.getByText("0그릇")).toBeTruthy()
    // 개수와 결과는 나중에 뜨지만 자리는 처음부터 잡혀 있다
    expect(view.queryByTestId(/^report-tower-count-/)).toBeNull()
    expect(view.queryByTestId("report-bowl-result")).toBeNull()
    expect(view.queryByText("종류별로 먹은 라멘")).toBeNull()

    // 첫 그릇이 닿으면 숫자와 기간이 흐르기 시작한다(오래된 기록부터)
    await act(async () => jest.advanceTimersByTimeAsync(700))
    expect(view.getByText("1그릇")).toBeTruthy()
    expect(view.getByTestId("report-bowl-period").props.children).toMatch(/^\d{4}\.\d{2} ~ \d{4}\.\d{2}$/)

    // 3.65초쯤 마지막 그릇이 닿는다. 탑마다 다 쌓이면 개수가 뜨고, 아직 빨강·진동은 없다
    await act(async () => jest.advanceTimersByTimeAsync(3000))
    expect(view.getByText("42그릇")).toBeTruthy()
    expect(view.getByTestId("report-tower-count-돈코츠").props.children).toBe(14)
    expect(view.getByTestId("report-tower-count-기타").props.children).toBe(4)
    expect(StyleSheet.flatten(view.getByTestId("report-tower-count-돈코츠").props.style).color).not.toBe(colors.brandText)
    expect(haptics.impactAsync).not.toHaveBeenCalled()
    expect(announce).not.toHaveBeenCalled()

    // 가장 높은 탑만 짚는다: 숫자 하나만 빨강, 김, 가벼운 진동 한 번
    await act(async () => jest.advanceTimersByTimeAsync(250))
    expect(view.getByText("가장 높이 쌓인 건")).toBeTruthy()
    expect(StyleSheet.flatten(view.getByTestId("report-tower-count-돈코츠").props.style).color).toBe(colors.brandText)
    expect(StyleSheet.flatten(view.getByTestId("report-tower-count-쇼유").props.style).color).not.toBe(colors.brandText)
    expect(within(view.getByTestId("report-tower-돈코츠")).getAllByTestId(/^report-tower-steam-/)).toHaveLength(3)
    expect(view.getAllByTestId(/^report-tower-steam-/)).toHaveLength(3)
    expect(haptics.impactAsync).toHaveBeenCalledTimes(1)
    expect(haptics.impactAsync).toHaveBeenCalledWith("light")
    expect(view.getByLabelText(/^42그릇을 종류별로 쌓았어요\. 돈코츠 14그릇, /)).toBeTruthy()

    await act(async () => jest.advanceTimersByTimeAsync(500))
    expect(view.getByTestId("report-bowl-result")).toBeTruthy()
    expect(view.getByText("진한 돈골파")).toBeTruthy()
    expect(view.getByText("42그릇 중 돈코츠 14그릇 · 33%")).toBeTruthy()
    expect(announce).toHaveBeenCalledTimes(1)
    expect(announce).toHaveBeenCalledWith("진한 돈골파, 돈코츠 14그릇")

    await act(async () => jest.advanceTimersByTimeAsync(1200))
    expect(view.getByText("종류별로 먹은 라멘")).toBeTruthy()
    expect(view.getByText("전체 42그릇으로 취향을 다시 정리했어요")).toBeTruthy()
  })

  it("uses every bowl for a short ledger in record order and highlights every tied tower", async () => {
    mockParams.analyze = "1"
    jest.useFakeTimers()
    const state = createInitialPersistedState()
    state.user = { ...state.user!, id: "local-taste", visitedCount: 2, membershipNo: "#RT-0022" }
    state.logs.push(
      { ...state.logs[0], id: "901", author: { ...state.logs[0].author, id: "local-taste" }, visitedAt: "2026. 09. 01", ramenType: "쇼유" },
      { ...state.logs[0], id: "902", author: { ...state.logs[0].author, id: "local-taste" }, visitedAt: "2026. 10. 02", ramenType: "시오" },
    )
    const view = await renderScreen(<TasteReportScreen />, state)

    expect(await view.findByText("No. RT-0022")).toBeTruthy()
    expect(view.getAllByTestId(/^report-bowl-\d+$/)).toHaveLength(2)
    expect(within(view.getByTestId("report-tower-쇼유")).getByTestId("report-bowl-soup-0").props.fill).toEqual(
      expect.objectContaining({ payload: processColor(soupColorOf("쇼유")) }),
    )
    expect(within(view.getByTestId("report-tower-시오")).getByTestId("report-bowl-soup-1").props.fill).toEqual(
      expect.objectContaining({ payload: processColor(soupColorOf("시오")) }),
    )
    expect(view.queryByText(/그릇 1개 ≈/)).toBeNull()

    await act(async () => jest.advanceTimersByTimeAsync(1000))
    expect(view.getByText("2그릇")).toBeTruthy()
    expect(view.getByText("2026.09 ~ 2026.10")).toBeTruthy()
    await act(async () => jest.advanceTimersByTimeAsync(800))
    for (const type of ["쇼유", "시오"]) {
      expect(StyleSheet.flatten(view.getByTestId(`report-tower-count-${type}`).props.style).color).toBe(colors.brandText)
      expect(within(view.getByTestId(`report-tower-${type}`)).getAllByTestId(/^report-tower-steam-/)).toHaveLength(3)
    }
    expect(haptics.impactAsync).toHaveBeenCalledTimes(1)
    expect(view.getByText("2그릇 중 쇼유·시오 각 1그릇 · 50%")).toBeTruthy()
  })

  it("draws every bowl of an ordinary 43-bowl ledger without a scale note", async () => {
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

    expect(await view.findByLabelText("43그릇을 정리하고 있어요")).toBeTruthy()
    expect(view.getAllByTestId(/^report-bowl-\d+$/)).toHaveLength(43)
    // 기타는 츠케멘·아부라소바를 묶어 다섯 종류로 읽는다
    expect(within(view.getByTestId("report-tower-돈코츠")).getAllByTestId(/^report-bowl-\d+$/)).toHaveLength(14)
    expect(within(view.getByTestId("report-tower-기타")).getAllByTestId(/^report-bowl-\d+$/)).toHaveLength(5)
    expect(view.queryByText(/그릇 1개 ≈/)).toBeNull()

    await act(async () => jest.advanceTimersByTimeAsync(3700))
    expect(view.getByText("43그릇")).toBeTruthy()
    expect(view.getByTestId("report-tower-count-기타").props.children).toBe(5)
  })

  it("caps a ledger over 60 bowls at 60 drawn bowls but reports the actual per-type totals", async () => {
    mockParams.analyze = "1"
    jest.useFakeTimers()
    const state = createInitialPersistedState()
    state.user = { ...state.user!, visitedCount: 90 }
    // 데모 원장 42그릇 + 돈코츠·츠케멘 24그릇씩 = 90그릇
    for (let index = 0; index < 48; index += 1) {
      state.logs.push({
        ...state.logs[0],
        id: `95${index}`,
        author: { ...state.logs[0].author, id: state.user!.id },
        visitedAt: `2026. 10. ${String(1 + (index % 28)).padStart(2, "0")}`,
        ramenType: index % 2 ? "츠케멘" : "돈코츠",
      })
    }
    const view = await renderScreen(<TasteReportScreen />, state)

    expect(await view.findByLabelText("90그릇을 정리하고 있어요")).toBeTruthy()
    const icons = view.getAllByTestId(/^report-bowl-\d+$/)
    expect(icons).toHaveLength(60)
    const drawn = Object.fromEntries(
      ["돈코츠", "이에케", "쇼유", "시오", "미소", "기타"]
        .filter((type) => view.queryByTestId(`report-tower-${type}`))
        .map((type) => [type, within(view.getByTestId(`report-tower-${type}`)).queryAllByTestId(/^report-bowl-\d+$/).length]),
    )
    // 최대 잔여 배분(×60/90): 돈코츠 38→25, 기타 28→19, 쇼유 12→8, 시오 8→5, 미소 4→3
    expect(drawn).toEqual({ 돈코츠: 25, 기타: 19, 쇼유: 8, 시오: 5, 미소: 3 })
    expect(view.getByText("그릇 1개 ≈ 1.5그릇 · 전체 90그릇")).toBeTruthy()

    await act(async () => jest.advanceTimersByTimeAsync(3700))
    expect(view.getByText("90그릇")).toBeTruthy()
    expect(view.getByTestId("report-tower-count-돈코츠").props.children).toBe(38)
    expect(view.getByTestId("report-tower-count-기타").props.children).toBe(28)
  })

  it("does not animate an empty account when an analysis link opens before hydration", async () => {
    mockParams.analyze = "1"
    const state = createInitialPersistedState()
    state.user = { ...state.user!, id: "local-empty", visitedCount: 0 }
    const view = await renderScreen(<TasteReportScreen />, state)

    expect(await view.findByText("아직 보여드릴 취향이 없어요")).toBeTruthy()
    expect(view.queryByText("라멘 취향 감정서")).toBeNull()
  })

  it("skips on request and shows the final stacked sheet immediately for Reduce Motion", async () => {
    mockParams.analyze = "1"
    const view = await renderScreen(<TasteReportScreen />)
    expect(await view.findByText("라멘 취향 감정서")).toBeTruthy()
    await fireEvent.press(view.getByRole("button", { name: "리포트 바로 보기" }))
    expect(await view.findByText("진한 돈골파")).toBeTruthy()
    expect(view.getByText("전체 42그릇으로 취향을 다시 정리했어요")).toBeTruthy()
    await view.unmount()

    useReducedMotion.mockReturnValue(true)
    jest.useFakeTimers()
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility")
    const reduced = await renderScreen(<TasteReportScreen />)
    expect(await reduced.findByText("라멘 취향 감정서")).toBeTruthy()
    expect(reduced.getByTestId("report-bowl-result")).toBeTruthy()
    expect(reduced.getByText("42그릇")).toBeTruthy()
    expect(reduced.getByText("42그릇 중 돈코츠 14그릇 · 33%")).toBeTruthy()
    expect(reduced.getByTestId("report-tower-count-기타").props.children).toBe(4)
    expect(StyleSheet.flatten(reduced.getByTestId("report-tower-count-돈코츠").props.style).color).toBe(colors.brandText)
    expect(reduced.getByLabelText(/^42그릇을 종류별로 쌓았어요\. 돈코츠 14그릇, /)).toBeTruthy()
    // 움직임 없이: 김도, 진동도 없다
    expect(reduced.queryByTestId(/^report-tower-steam-/)).toBeNull()
    await act(async () => jest.advanceTimersByTimeAsync(500))
    // 앞 화면의 토스트 안내가 늦게 섞일 수 있어, 이 연출의 끝 안내가 한 번인지만 본다
    expect(announce.mock.calls.filter(([message]) => message === "진한 돈골파, 돈코츠 14그릇")).toHaveLength(1)
    await act(async () => jest.advanceTimersByTimeAsync(1800))
    expect(reduced.getByText("종류별로 먹은 라멘")).toBeTruthy()
    expect(haptics.impactAsync).not.toHaveBeenCalled()
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
    expect(view.getByText("지난달과 달라진 종류")).toBeTruthy()
    expect(within(view.getByLabelText("2026년 8월 라멘 종류별 그릇 수와 비율")).getAllByText(/%p/).length).toBeGreaterThan(0)
    // 변화 없는 칸은 비워 두고 "—"로 채우지 않는다
    expect(view.queryAllByText("—")).toHaveLength(0)
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

describe("ramen types on My", () => {
  it("gives every recorded type its own board, most eaten first, and opens that type", async () => {
    const view = await renderScreen(<MyScreen />)
    await view.findByText("뿡")
    // 츠케멘·아부라소바도 기타로 묶이지 않고 따로. 같은 수면 기록 종류 순(츠케멘이 먼저)
    const boards = view.getAllByLabelText(/^\S+ \d+그릇$/).filter((node) => node.props.accessibilityHint === "이 종류 기록만 모아 봐요")
    expect(boards.map((node) => node.props.accessibilityLabel)).toEqual([
      "돈코츠 14그릇", "쇼유 12그릇", "시오 8그릇", "미소 4그릇", "츠케멘 2그릇", "아부라소바 2그릇",
    ])
    await fireEvent.press(view.getByRole("button", { name: "쇼유 12그릇" }))
    expect(router.push).toHaveBeenCalledWith({ pathname: "/my-type/[type]", params: { type: "쇼유" } })
  })

  it("keeps 기타 last even when it is the most eaten, and counts unknown old types as 기타", () => {
    const bowl = (type: string) => ({ date: "2026-07-01", shop: "가게", type, menu: "메뉴" })
    expect(bowlTypes([bowl("기타"), bowl("中華そば"), bowl("기타"), bowl("쇼유")])).toEqual([
      { type: "쇼유", count: 1 },
      { type: "기타", count: 3 },
    ])
  })

  it("collects one type on its own screen with its own summary", async () => {
    mockParams.type = "쇼유"
    const view = await renderScreen(<MyTypeScreen />)
    expect(await view.findByText("12그릇")).toBeTruthy()
    expect(view.getByText("가게 4곳 · 처음 2026.03.28 · 최근 2026.09.03")).toBeTruthy()
    expect(view.getByText(/^자주 간 곳 멘야준 5번$/)).toBeTruthy()
    // 카드는 쇼유 그릇 12개뿐, 최신순
    const cards = view.getAllByLabelText(/, \d{4}\.\d\d\.\d\d$/)
    expect(cards).toHaveLength(12)
    expect(cards[0].props.accessibilityLabel).toMatch(/, 2026\.09\.03$/)
  })

  it("says so when there are no bowls of that type", async () => {
    mockParams.type = "지로"
    const view = await renderScreen(<MyTypeScreen />)
    expect(await view.findByText("지로 기록이 없어요")).toBeTruthy()
  })
})
