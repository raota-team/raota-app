import { act, fireEvent, render, waitFor } from "@testing-library/react-native"
import type { ReactElement } from "react"
import { ActionSheetIOS, Text } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { createInitialPersistedState } from "@/src/data/fixtures"
import type { RaotaRepository } from "@/src/repository"
import { RaotaProvider, useRaota } from "@/src/state/RaotaStore"
import PolicySheet from "@/src/components/PolicySheet"
import RecordFab from "@/src/components/RecordFab"
import { RaotaTabBar } from "@/app/native/_layout"
import LoginScreen from "@/app/(flows)/auth/login"
import OnboardingScreen from "@/app/(flows)/auth/onboarding"

const mockFocus: { effect: (() => void | (() => void)) | null } = { effect: null }

jest.mock("expo-router", () => {
  const React = require("react") as typeof import("react")
  const { View } = require("react-native") as typeof import("react-native")
  const Tabs = ({ children }: { children?: React.ReactNode }) => React.createElement(View, null, children)
  Tabs.Screen = () => null
  return {
    Tabs,
    router: { back: jest.fn(), canGoBack: jest.fn(() => true), push: jest.fn(), replace: jest.fn(), setParams: jest.fn() },
    useLocalSearchParams: jest.fn(() => ({})),
    useFocusEffect: (effect: () => void | (() => void)) => {
      mockFocus.effect = effect
      React.useEffect(effect, [effect])
    },
  }
})
jest.mock("expo-notifications")
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light" },
  NotificationFeedbackType: { Success: "success" },
}))
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}))
jest.mock("@/src/analytics", () => ({ track: jest.fn() }))
jest.mock("lucide-react-native", () => {
  const React = require("react") as typeof import("react")
  const { View } = require("react-native") as typeof import("react-native")
  const Icon = (props: Record<string, unknown>) => React.createElement(View, props)
  return new Proxy({ __esModule: true }, {
    get: (target, property) => (property === "__esModule" ? target.__esModule : Icon),
  })
})

const { router, useLocalSearchParams } = jest.requireMock("expo-router") as {
  router: { back: jest.Mock; push: jest.Mock; replace: jest.Mock; canGoBack: jest.Mock; setParams: jest.Mock }
  useLocalSearchParams: jest.Mock
}
const { track } = jest.requireMock("@/src/analytics") as { track: jest.Mock }

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

/** 지금 로그인 상태를 글로 보여주는 탐침 */
function WhoAmI() {
  const { currentUser } = useRaota()
  return <Text testID="who">{currentUser ? currentUser.id : "guest"}</Text>
}

function renderApp(element: ReactElement, state = createInitialPersistedState()) {
  return render(
    <SafeAreaProvider initialMetrics={safeArea}>
      <RaotaProvider repository={repository(state)}>
        {element}
        <WhoAmI />
      </RaotaProvider>
    </SafeAreaProvider>,
  )
}

const guestState = () => {
  const state = createInitialPersistedState()
  return { ...state, user: state.user ? { ...state.user, isLoggedIn: false } : null }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockFocus.effect = null
  useLocalSearchParams.mockReturnValue({})
})

describe("MVP tab bar", () => {
  function tabProps(activeIndex = 0) {
    const names = ["index", "map", "lounge", "news", "my"]
    const titles: Record<string, string> = { index: "홈", map: "지도", lounge: "라운지", news: "라멘속보", my: "마이" }
    const routes = names.map((name) => ({ key: `${name}-key`, name, params: undefined }))
    const descriptors = Object.fromEntries(routes.map((route) => [route.key, { options: { title: titles[route.name] } }]))
    const navigation = { emit: jest.fn(() => ({ defaultPrevented: false })), navigate: jest.fn() }
    const props = {
      state: { index: activeIndex, routes },
      descriptors,
      navigation,
      insets: { top: 0, right: 0, bottom: 34, left: 0 },
    } as unknown as Parameters<typeof RaotaTabBar>[0]
    return { props, navigation }
  }

  it("shows only 홈 · 지도 · 마이 and marks the active tab", async () => {
    const { props } = tabProps(0)
    const view = await render(<RaotaTabBar {...props} />)

    expect(view.getAllByRole("tab").map((tab) => tab.props.accessibilityLabel)).toEqual(["홈 탭", "지도 탭", "마이 탭"])
    expect(view.queryByText("라운지")).toBeNull()
    expect(view.queryByText("라멘속보")).toBeNull()
    expect(view.getByRole("tab", { name: "홈 탭" }).props.accessibilityState).toEqual({ selected: true })
  })

  it("navigates when another tab is pressed", async () => {
    const { props, navigation } = tabProps(0)
    const view = await render(<RaotaTabBar {...props} />)

    await fireEvent.press(view.getByRole("tab", { name: "지도 탭" }))
    expect(navigation.navigate).toHaveBeenCalledWith("map", undefined)
  })
})

describe("RecordFab", () => {
  async function layout(view: Awaited<ReturnType<typeof renderApp>>) {
    const container = view.getByTestId("record-fab").parent?.parent
    if (!container) throw new Error("container not found")
    await act(async () => {
      fireEvent(container, "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 700 } } })
    })
  }

  it("sends a guest to login instead of opening the menu", async () => {
    const view = await renderApp(<RecordFab />, guestState())

    await fireEvent.press(view.getByRole("button", { name: "라멘 기록하기" }))
    expect(router.push).toHaveBeenCalledWith("/auth/login")
    expect(view.queryByRole("button", { name: "주변 라멘집 기록하기" })).toBeNull()
  })

  it("opens three record methods and routes each to the shop picker", async () => {
    const view = await renderApp(<RecordFab />)
    await layout(view)

    await fireEvent.press(view.getByRole("button", { name: "라멘 기록하기" }))
    const toggle = view.getByRole("button", { name: "기록 메뉴 닫기" })
    expect(toggle.props.accessibilityState).toEqual(expect.objectContaining({ expanded: true }))
    expect(view.getByRole("button", { name: "주변 라멘집 기록하기" })).toBeTruthy()
    expect(view.getByRole("button", { name: "직접 검색해서 기록하기" })).toBeTruthy()

    await fireEvent.press(view.getByRole("button", { name: "찜한 가게에서 기록하기" }))
    expect(track).toHaveBeenCalledWith("record_started", { mode: "saved", source: "fab" })
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/record/select-shop",
      params: { mode: "saved", source: "fab" },
    })
    expect(view.queryByRole("button", { name: "주변 라멘집 기록하기" })).toBeNull()
  })

  it("closes the menu from the backdrop and when the screen loses focus", async () => {
    const view = await renderApp(<RecordFab />)
    await layout(view)

    await fireEvent.press(view.getByRole("button", { name: "라멘 기록하기" }))
    await fireEvent.press(view.getByTestId("record-fab-backdrop"))
    expect(view.queryByRole("button", { name: "주변 라멘집 기록하기" })).toBeNull()

    await fireEvent.press(view.getByRole("button", { name: "라멘 기록하기" }))
    const cleanup = mockFocus.effect?.()
    await act(async () => {
      if (typeof cleanup === "function") cleanup()
    })
    expect(view.queryByRole("button", { name: "주변 라멘집 기록하기" })).toBeNull()
  })

  it("offers a VoiceOver action that moves the button back to its home spot", async () => {
    const view = await renderApp(<RecordFab />)
    await layout(view)
    const fab = view.getByRole("button", { name: "라멘 기록하기" })

    expect(fab.props.accessibilityActions).toEqual(
      expect.arrayContaining([{ name: "moveToDefault", label: "기본 위치로 옮기기" }]),
    )
    await act(async () => {
      fab.props.onAccessibilityAction({ nativeEvent: { actionName: "activate" } })
    })
    expect(view.getByRole("button", { name: "주변 라멘집 기록하기" })).toBeTruthy()
  })
})

describe("RecordFab dev reminder test (Expo Go)", () => {
  it("long-press opens the dev action sheet and schedules a 5-second test reminder", async () => {
    const notifications = jest.requireMock("expo-notifications") as {
      getPermissionsAsync: jest.Mock
      scheduleNotificationAsync: jest.Mock
    }
    notifications.getPermissionsAsync.mockResolvedValue({ status: "granted", granted: true, canAskAgain: true })
    const sheet = jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation((_options, callback) => callback(1))
    const view = await renderApp(<RecordFab />)

    await act(async () => {
      fireEvent(view.getByRole("button", { name: "라멘 기록하기" }), "longPress")
    })

    expect(sheet).toHaveBeenCalledWith(expect.objectContaining({ title: "개발용 리마인더 테스트" }), expect.any(Function))
    await waitFor(() =>
      expect(notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: "raota.reminder.dev-test",
          content: expect.objectContaining({
            title: "지난주에 먹은 라멘, 남겨볼까요?",
            data: expect.objectContaining({ url: "raota://record/select-shop?mode=nearby&source=reminder" }),
          }),
          trigger: expect.objectContaining({ type: "timeInterval", seconds: 5 }),
        }),
      ),
    )
    sheet.mockRestore()
  })
})

describe("PolicySheet", () => {
  it("renders nothing while closed", async () => {
    const view = await render(<PolicySheet onClose={jest.fn()} type={null} />)
    expect(view.queryByText("1. 목적")).toBeNull()
  })

  it("shows the web terms (same shared source) and a 닫기 button", async () => {
    const onClose = jest.fn()
    const view = await render(<PolicySheet onClose={onClose} type="terms" />)

    expect(view.getByText("이용약관")).toBeTruthy()
    expect(view.getByText("시행일 2026년 6월 11일")).toBeTruthy()
    for (const heading of ["1. 목적", "6. 회원의 의무와 금지행위", "13. 문의"]) {
      expect(view.getByText(heading)).toBeTruthy()
    }
    await fireEvent.press(view.getByRole("button", { name: "닫기" }))
    expect(onClose).toHaveBeenCalled()
  })

  it("shows the privacy policy and lets a footer replace 닫기", async () => {
    const view = await render(
      <PolicySheet footer={<Text>확인하고 동의</Text>} onClose={jest.fn()} title="개인정보 수집 및 이용 동의" type="privacy" />,
    )
    expect(view.getByText("개인정보 수집 및 이용 동의")).toBeTruthy()
    expect(view.getByText("2. 처리하는 개인정보 항목")).toBeTruthy()
    expect(view.getByText("12. 개인정보 보호책임자 및 문의")).toBeTruthy()
    expect(view.getByText("확인하고 동의")).toBeTruthy()
    expect(view.queryByRole("button", { name: "닫기" })).toBeNull()
  })
})

describe("login", () => {
  it("logs in with Apple through the dummy provider and goes on to sign-up for a new person", async () => {
    // 저장된 사용자가 없는 상태(탈퇴 뒤)
    const fresh = { ...createInitialPersistedState(), user: null, onboardingCompleted: false }
    const view = await renderApp(<LoginScreen />, fresh)
    expect(view.getByTestId("who").props.children).toBe("guest")

    await fireEvent.press(view.getByRole("button", { name: "Apple로 계속하기" }))

    expect(track).toHaveBeenCalledWith("login", { provider: "apple", signup: false })
    const who = view.getByTestId("who").props.children
    expect(who).not.toBe("guest")
    expect(who).not.toBe("user-demo")
    expect(router.replace).toHaveBeenCalledWith("/auth/onboarding")
  })

  it("returns to the screen that asked for login when the account is already set up", async () => {
    // 이 기기에서 카카오로 가입을 마친 뒤 로그아웃한 상태
    const base = createInitialPersistedState()
    const kakaoUser = { ...base.user!, id: "local-kakao", nickname: "카카오러", isLoggedIn: false }
    const view = await renderApp(<LoginScreen />, { ...base, user: kakaoUser, onboardingCompleted: true })

    await fireEvent.press(view.getByRole("button", { name: "카카오로 계속하기" }))

    expect(track).toHaveBeenCalledWith("login", { provider: "kakao", signup: false })
    expect(router.back).toHaveBeenCalled()
    expect(view.getByTestId("who").props.children).toBe("local-kakao")
  })

  it("starts a new account from the demo device and sends it to onboarding", async () => {
    const view = await renderApp(<LoginScreen />, guestState())

    await fireEvent.press(view.getByRole("button", { name: "카카오로 계속하기" }))

    expect(view.getByTestId("who").props.children).toBe("local-kakao")
    expect(router.replace).toHaveBeenCalledWith("/auth/onboarding")
  })

  it("shows the sign-up flow for mode=signup and goes straight to onboarding", async () => {
    useLocalSearchParams.mockReturnValue({ mode: "signup" })
    const view = await renderApp(<LoginScreen />, guestState())

    expect(view.getByRole("header", { name: "회원가입" })).toBeTruthy()
    expect(view.queryByRole("button", { name: "데모 계정으로 체험" })).toBeNull()
    await fireEvent.press(view.getByRole("button", { name: "Google로 계속하기" }))

    expect(track).toHaveBeenCalledWith("login", { provider: "google", signup: true })
    expect(router.replace).toHaveBeenCalledWith("/auth/onboarding")
    // 첫 설치(데모 사용자가 남아 있는 기기)에서도 소셜 가입은 새 계정으로 시작한다
    expect(view.getByTestId("who").props.children).toBe("local-google")
  })

  it("switches between login and sign-up from the header link", async () => {
    const view = await renderApp(<LoginScreen />, guestState())
    await fireEvent.press(view.getByRole("button", { name: "회원가입" }))
    expect(router.setParams).toHaveBeenCalledWith({ mode: "signup" })
  })

  it("browses as a real guest, not the demo account", async () => {
    const view = await renderApp(<LoginScreen />)
    expect(view.getByTestId("who").props.children).toBe("user-demo")

    await fireEvent.press(view.getByRole("button", { name: "로그인 없이 둘러보기" }))

    expect(view.getByTestId("who").props.children).toBe("guest")
    expect(router.replace).toHaveBeenCalledWith("/native")
  })

  it("keeps the demo account off screen, behind a dev-only long press on the logo", async () => {
    const view = await renderApp(<LoginScreen />, guestState())
    expect(view.queryByText("데모 계정으로 체험")).toBeNull()

    await fireEvent(view.getByLabelText("RAOTA"), "longPress")

    expect(view.getByTestId("who").props.children).toBe("user-demo")
    expect(track).toHaveBeenCalledWith("login", { provider: "demo" })
  })
})

describe("onboarding", () => {
  const freshState = () => ({ ...createInitialPersistedState(), user: null, onboardingCompleted: false })

  it("shows inline nickname and agreement errors instead of submitting", async () => {
    const view = await renderApp(<OnboardingScreen />, freshState())

    await fireEvent.changeText(view.getByLabelText("닉네임"), "면")
    expect(view.getByText("닉네임이 너무 짧아요. 1자만 더 적어 주세요.")).toBeTruthy()

    await fireEvent.changeText(view.getByLabelText("닉네임"), "면탐험가")
    await fireEvent.press(view.getByRole("button", { name: "회원가입 완료" }))
    expect(view.getByText("필수 약관 두 가지에 동의해야 가입할 수 있어요.")).toBeTruthy()
    expect(track).not.toHaveBeenCalledWith("sign_up", expect.anything())
  })

  it("checks a required term from the policy sheet's 확인하고 동의", async () => {
    const view = await renderApp(<OnboardingScreen />, freshState())
    const terms = view.getByRole("checkbox", { name: "필수, 서비스 이용약관 동의" })
    expect(terms.props.accessibilityState).toEqual({ checked: false })

    await fireEvent.press(view.getByRole("button", { name: "서비스 이용약관 보기" }))
    await fireEvent.press(view.getByRole("button", { name: "확인하고 동의" }))

    expect(view.getByRole("checkbox", { name: "필수, 서비스 이용약관 동의" }).props.accessibilityState).toEqual({
      checked: true,
    })
    expect(view.getByRole("checkbox", { name: "필수, 개인정보 수집 및 이용 동의" }).props.accessibilityState).toEqual({
      checked: false,
    })
  })

  it("signs up a new person with zero bowls and tracks sign_up", async () => {
    const view = await renderApp(<OnboardingScreen />, freshState())

    await fireEvent.changeText(view.getByLabelText("닉네임"), "면탐험가")
    await fireEvent.press(view.getByRole("button", { name: "쇼유 (간장)" }))
    await fireEvent.press(view.getByRole("checkbox", { name: "필수, 서비스 이용약관 동의" }))
    await fireEvent.press(view.getByRole("checkbox", { name: "필수, 개인정보 수집 및 이용 동의" }))
    await fireEvent.press(view.getByRole("button", { name: "회원가입 완료" }))

    expect(await view.findByText("면탐험가님, 반가워요")).toBeTruthy()
    expect(track).toHaveBeenCalledWith("sign_up", { hasPhoto: false, marketing: false, hasFavorite: true })
    expect(view.getByTestId("who").props.children).not.toBe("user-demo")

    await fireEvent.press(view.getByRole("button", { name: "라오타 시작하기" }))
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/native"))
  })
})
