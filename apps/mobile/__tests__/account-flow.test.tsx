import { fireEvent, render, waitFor } from "@testing-library/react-native"
import type { ReactElement } from "react"
import { Pressable, Text } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { setLocale, t, type AppLocale } from "@raota/shared"

import type { MemberMe } from "@/src/api/types"
import { idempotencyOutbox } from "@/src/api/outbox"
import { tokenStore } from "@/src/api/tokens"
import { createInitialPersistedState } from "@/src/data/fixtures"
import type { RaotaRepository } from "@/src/repository"
import { RaotaProvider, useRaota } from "@/src/state/RaotaStore"
import LoginScreen from "@/app/(flows)/auth/login"
import ConsentScreen from "@/app/(flows)/auth/consent"
import OnboardingScreen from "@/app/(flows)/auth/onboarding"

/*
 * 서버 계정 흐름(auth·member remote). 제공자 SDK는 src/auth/social을 통째로 바꾸고,
 * 서버는 fetch를 경로별로 흉내 낸다. 토큰·아웃박스는 실제 구현(메모리 키체인·AsyncStorage 대체본)을 쓴다.
 */

jest.mock("@/src/api/config", () => {
  const isRemote = jest.fn((_domain: string) => true)
  return {
    ...jest.requireActual("@/src/api/config"),
    isRemote,
    isRemoteWithAccount: jest.fn((domain: string) => isRemote(domain) && isRemote("auth")),
  }
})

jest.mock("@/src/auth/social", () => {
  class SocialSignInCancelled extends Error {}
  return {
    SocialSignInCancelled,
    availableSocialProviders: jest.fn(() => ["apple", "kakao", "google"]),
    socialCredential: jest.fn(async () => ({ provider: "KAKAO", accessToken: "kakao-access-token" })),
    signOutSocialProviders: jest.fn(async () => undefined),
  }
})

jest.mock("expo-router", () => {
  const React = require("react") as typeof import("react")
  const { View } = require("react-native") as typeof import("react-native")
  const Stack = ({ children }: { children?: React.ReactNode }) => React.createElement(View, null, children)
  Stack.Screen = () => null
  return {
    Stack,
    router: { back: jest.fn(), canGoBack: jest.fn(() => true), push: jest.fn(), replace: jest.fn() },
    useLocalSearchParams: jest.fn(() => ({})),
  }
})

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}))

jest.mock("lucide-react-native", () => {
  const React = require("react") as typeof import("react")
  const { View } = require("react-native") as typeof import("react-native")
  const Icon = (props: Record<string, unknown>) => React.createElement(View, props)
  return new Proxy({ __esModule: true }, { get: (target, property) => (property === "__esModule" ? target.__esModule : Icon) })
})

const { router, useLocalSearchParams } = jest.requireMock("expo-router") as {
  router: { back: jest.Mock; replace: jest.Mock }
  useLocalSearchParams: jest.Mock
}
const social = jest.requireMock("@/src/auth/social") as {
  SocialSignInCancelled: new () => Error
  socialCredential: jest.Mock
  signOutSocialProviders: jest.Mock
}

const activeMember: MemberMe = {
  id: "77",
  nickname: "라멘러버",
  email: null,
  avatarUrl: null,
  bio: null,
  favoriteRamenType: null,
  status: "ACTIVE",
  logCount: 3,
  onboardingCompletedAt: "2026-10-19T08:00:00Z",
  consentRequired: false,
}

const onboardingMember: MemberMe = {
  ...activeMember,
  id: "88",
  nickname: null,
  status: "ONBOARDING",
  logCount: 0,
  onboardingCompletedAt: null,
}

interface FakeResponse {
  status: number
  ok: boolean
  headers: { get: () => null }
  text: () => Promise<string>
}

function respond(status: number, body: unknown): FakeResponse {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => null },
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  }
}

const ok = (data: unknown) => respond(200, { success: true, data, meta: { requestId: "req" } })
const fail = (status: number, code: string) =>
  respond(status, { success: false, error: { code, message: "실패", fields: [] }, meta: { requestId: "req" } })

type Route = (url: string, init: RequestInit) => FakeResponse | undefined
let fetchMock: jest.Mock

/** 경로·메서드별 응답. 맞는 경로가 없으면 테스트가 바로 알 수 있게 500을 준다 */
function serve(...routes: Route[]) {
  fetchMock = jest.fn(async (url: string, init: RequestInit) => {
    for (const route of routes) {
      const response = route(url, init)
      if (response) return response
    }
    return fail(500, "INTERNAL_ERROR")
  })
  ;(globalThis as { fetch: unknown }).fetch = fetchMock
}

const on = (method: string, path: string, response: () => FakeResponse): Route =>
  (url, init) => ((init.method ?? "GET") === method && url.split("?")[0].endsWith(path) ? response() : undefined)

function loginAs(member: MemberMe): Route {
  return on("POST", "/auth/oauth/login", () =>
    ok({ accessToken: "server-access", refreshToken: "server-refresh", expiresIn: 1800, isNewMember: member.status === "ONBOARDING", member }),
  )
}

function bodyOf(method: string, path: string): unknown {
  const calls: Array<[string, RequestInit]> = fetchMock.mock.calls
  const call = calls.find(([url, init]) => init.method === method && url.endsWith(path))
  return call ? JSON.parse(String(call[1].body)) : undefined
}

function repository(state = createInitialPersistedState()): RaotaRepository {
  return {
    load: jest.fn().mockResolvedValue(state),
    save: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  }
}

function signedInState(id: string) {
  const state = createInitialPersistedState()
  return {
    ...state,
    onboardingCompleted: true,
    user: {
      id,
      name: "라멘러버",
      nickname: "라멘러버",
      avatar: null,
      level: "라멘 입문자",
      levelNumber: 1,
      membershipNo: `#RT-${id}`,
      visitedCount: 0,
      revisitCount: 0,
      isLoggedIn: true,
    },
  }
}

async function renderWithStore(element: ReactElement, repo = repository()) {
  return await render(
    <SafeAreaProvider
      initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}
    >
      <RaotaProvider repository={repo}>{element}</RaotaProvider>
    </SafeAreaProvider>,
  )
}

function SessionProbe() {
  const { currentUser, state, actions } = useRaota()
  return (
    <>
      <Text testID="session">
        {state.hydrationStatus === "loading"
          ? "loading"
          : `${currentUser?.id ?? "guest"}:${state.onboardingCompleted ? "onboarded" : "onboarding"}:${state.consentRequired ? "consent" : "ok"}`}
      </Text>
      <Pressable accessibilityLabel="로그아웃" accessibilityRole="button" onPress={actions.logout} />
    </>
  )
}

beforeEach(async () => {
  jest.clearAllMocks()
  setLocale("ko")
  useLocalSearchParams.mockReturnValue({})
  await tokenStore.clear()
  await idempotencyOutbox.clear()
})

afterEach(() => setLocale("ko"))

describe("서버 로그인 화면", () => {
  it("새 회원(ONBOARDING)은 온보딩으로 보낸다", async () => {
    serve(loginAs(onboardingMember))
    const view = await renderWithStore(<LoginScreen />)

    await fireEvent.press(await view.findByRole("button", { name: "카카오로 계속하기" }))

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/auth/onboarding"))
    expect(social.socialCredential).toHaveBeenCalledWith("kakao")
    expect(bodyOf("POST", "/auth/oauth/login")).toEqual({ provider: "KAKAO", accessToken: "kakao-access-token" })
    expect(tokenStore.peek()).toEqual({ accessToken: "server-access", refreshToken: "server-refresh" })
  })

  it("약관 다시 동의가 필요한 회원은 가려던 곳을 들고 동의 화면으로 간다", async () => {
    useLocalSearchParams.mockReturnValue({ next: "/record/new" })
    serve(loginAs({ ...activeMember, consentRequired: true }))
    const view = await renderWithStore(<LoginScreen />)

    await fireEvent.press(await view.findByRole("button", { name: "Google로 계속하기" }))

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({ pathname: "/auth/consent", params: { next: "/record/new" } }),
    )
  })

  it("가입을 마친 회원은 가려던 곳으로 간다", async () => {
    useLocalSearchParams.mockReturnValue({ next: "/taste" })
    serve(loginAs(activeMember))
    const view = await renderWithStore(<LoginScreen />)

    await fireEvent.press(await view.findByRole("button", { name: "Apple로 계속하기" }))

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/taste"))
  })

  it("가려던 곳이 없으면 로그인을 연 화면으로 돌아간다", async () => {
    serve(loginAs(activeMember))
    const view = await renderWithStore(<LoginScreen />)

    await fireEvent.press(await view.findByRole("button", { name: "Apple로 계속하기" }))

    await waitFor(() => expect(router.back).toHaveBeenCalled())
    expect(router.replace).not.toHaveBeenCalled()
  })

  it("제공자 화면을 닫으면 서버에 보내지 않고 화면에 머문다", async () => {
    serve(loginAs(activeMember))
    social.socialCredential.mockRejectedValueOnce(new social.SocialSignInCancelled())
    const view = await renderWithStore(<LoginScreen />)

    await fireEvent.press(await view.findByRole("button", { name: "카카오로 계속하기" }))

    expect(await view.findByText("로그인을 취소했어요.")).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(router.replace).not.toHaveBeenCalled()
  })

  it("서버가 자격 증명을 거절하면 실패를 알리고 토큰을 남기지 않는다", async () => {
    serve(on("POST", "/auth/oauth/login", () => fail(401, "OAUTH_CREDENTIAL_INVALID")))
    const view = await renderWithStore(<LoginScreen />)

    await fireEvent.press(await view.findByRole("button", { name: "카카오로 계속하기" }))

    expect(await view.findByText("로그인하지 못했어요. 잠시 후 다시 시도해 주세요.")).toBeTruthy()
    expect(tokenStore.peek()).toBeNull()
    expect(router.replace).not.toHaveBeenCalled()
  })

  it.each([
    { locale: "en", failure: "credentials", expected: "Couldn’t sign in. Please try again shortly." },
    { locale: "zh", failure: "unavailable", expected: "无法使用此账号登录，注销满30天后方可重新注册。" },
    { locale: "ja", failure: "offline", expected: "インターネット接続を確認して、もう一度お試しください。" },
    { locale: "en", failure: "canceled", expected: "Sign-in canceled." },
  ])("$locale 로그인 $failure 안내는 앱 언어로 표시한다", async ({ locale, failure, expected }) => {
    setLocale(locale as AppLocale)
    serve(on("POST", "/auth/oauth/login", () => fail(401, failure === "unavailable" ? "UNAUTHORIZED" : "OAUTH_CREDENTIAL_INVALID")))
    if (failure === "canceled") {
      social.socialCredential.mockRejectedValueOnce(new social.SocialSignInCancelled())
    } else if (failure === "offline") {
      fetchMock.mockRejectedValueOnce(new TypeError("Network connection lost"))
    }
    const view = await renderWithStore(<LoginScreen />)

    await fireEvent.press(await view.findByRole("button", { name: t("카카오로 계속하기") }))

    expect(await view.findByText(expected)).toBeTruthy()
    expect(tokenStore.peek()).toBeNull()
    expect(router.replace).not.toHaveBeenCalled()
    if (failure === "canceled") expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("약관 다시 동의 화면", () => {
  it("필수 두 가지에 동의하기 전에는 서버에 보내지 않는다", async () => {
    serve(on("PUT", "/members/me/consents", () => ok(activeMember)))
    const view = await renderWithStore(<ConsentScreen />)

    await fireEvent.press(await view.findByRole("checkbox", { name: "필수, 서비스 이용약관 동의" }))
    await fireEvent.press(view.getByRole("button", { name: "동의하고 계속하기" }))

    expect(await view.findByText("필수 약관 두 가지에 동의해야 계속할 수 있어요.")).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(router.replace).not.toHaveBeenCalled()
  })

  it("현재 문서 버전으로 동의를 보내고 가려던 곳으로 간다", async () => {
    await tokenStore.set({ accessToken: "a", refreshToken: "r" })
    useLocalSearchParams.mockReturnValue({ next: "/record/new" })
    serve(
      on("GET", "/members/me", () => ok({ ...activeMember, consentRequired: true })),
      on("PUT", "/members/me/consents", () => ok(activeMember)),
    )
    const view = await renderWithStore(<ConsentScreen />, repository(signedInState("77")))

    await fireEvent.press(await view.findByRole("checkbox", { name: "필수, 서비스 이용약관 동의" }))
    await fireEvent.press(view.getByRole("checkbox", { name: "필수, 개인정보 수집 및 이용 동의" }))
    await fireEvent.press(view.getByRole("button", { name: "동의하고 계속하기" }))

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/record/new"))
    expect(bodyOf("PUT", "/members/me/consents")).toEqual({
      consents: [
        { type: "TERMS", documentVersion: "2026-11-03", granted: true },
        { type: "PRIVACY", documentVersion: "2026-11-03", granted: true },
        { type: "MARKETING", documentVersion: "2026-11-03", granted: false },
      ],
    })
  })
})

describe("서버 세션", () => {
  it("저장된 토큰으로 회원 상태를 되살린다", async () => {
    await tokenStore.set({ accessToken: "a", refreshToken: "r" })
    serve(on("GET", "/members/me", () => ok({ ...activeMember, consentRequired: true })))
    const view = await renderWithStore(<SessionProbe />)

    await waitFor(() => expect(view.getByTestId("session").props.children).toBe("77:onboarded:consent"))
  })

  it("토큰 없이 남은 로그인 흔적(mock 시절)은 로그아웃 상태로 시작한다", async () => {
    serve()
    const view = await renderWithStore(<SessionProbe />, repository(signedInState("local-kakao")))

    await waitFor(() => expect(view.getByTestId("session").props.children).toBe("guest:onboarded:ok"))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  /** 새로 설치한 기기: 저장된 앱 상태가 없다(iOS는 앱을 지워도 키체인의 로그인 토큰은 남는다) */
  const freshInstall = (): RaotaRepository => ({
    load: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  })

  /** 첫 화면이 거친 상태를 차례로 모은다(불러오는 중 → 누구로 보였는지) */
  function startSequence() {
    const seen: string[] = []
    function StartProbe() {
      const { isHydrated, currentUser } = useRaota()
      const shown = isHydrated ? (currentUser?.nickname ?? "guest") : "loading"
      if (seen.at(-1) !== shown) seen.push(shown)
      return null
    }
    return { seen, StartProbe }
  }

  it("새로 설치한 기기는 저장된 로그인을 되살리는 동안 데모 계정(뿡) 대신 불러오는 화면을 보인다", async () => {
    await tokenStore.set({ accessToken: "a", refreshToken: "r" })
    const me = Promise.withResolvers<FakeResponse>()
    fetchMock = jest.fn(() => me.promise)
    globalThis.fetch = fetchMock
    const { seen, StartProbe } = startSequence()
    await renderWithStore(<StartProbe />, freshInstall())

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(seen).toEqual(["loading"])
    me.resolve(ok(activeMember))
    await waitFor(() => expect(seen).toEqual(["loading", "라멘러버"]))
  })

  it("로그인한 적 없는 새 기기는 데모 계정(뿡)이 아니라 비회원으로 시작한다", async () => {
    serve()
    const { seen, StartProbe } = startSequence()
    await renderWithStore(<StartProbe />, freshInstall())

    await waitFor(() => expect(seen).toEqual(["loading", "guest"]))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("세션이 끝나면(재발급 거절) 기기에서도 로그아웃하고 그 계정의 아웃박스를 비운다", async () => {
    await tokenStore.set({ accessToken: "old", refreshToken: "old-refresh" })
    await idempotencyOutbox.begin({ accountId: "77", operation: "CREATE_RAMEN_LOG", path: "/ramen-logs", fingerprint: "f", body: {} })
    serve(
      on("GET", "/members/me", () => fail(401, "TOKEN_EXPIRED")),
      on("POST", "/auth/token/reissue", () => fail(401, "UNAUTHORIZED")),
    )
    const view = await renderWithStore(<SessionProbe />, repository(signedInState("77")))

    await waitFor(() => expect(view.getByTestId("session").props.children).toBe("guest:onboarded:ok"))
    await waitFor(async () => expect(await idempotencyOutbox.pending("77")).toEqual([]))
    expect(tokenStore.peek()).toBeNull()
    expect(social.signOutSocialProviders).toHaveBeenCalled()
  })

  it("로그아웃은 서버에 알리고, 서버에 닿지 못해도 기기 토큰을 지운다", async () => {
    await tokenStore.set({ accessToken: "a", refreshToken: "r" })
    serve(on("GET", "/members/me", () => ok(activeMember)))
    const view = await renderWithStore(<SessionProbe />)
    await waitFor(() => expect(view.getByTestId("session").props.children).toBe("77:onboarded:ok"))

    fetchMock.mockRejectedValue(new TypeError("Network request failed"))
    await fireEvent.press(view.getByRole("button", { name: "로그아웃" }))

    await waitFor(() => expect(view.getByTestId("session").props.children).toBe("guest:onboarded:ok"))
    await waitFor(() => expect(tokenStore.peek()).toBeNull())
    expect(fetchMock.mock.calls.some(([url]: [string]) => url.endsWith("/auth/logout"))).toBe(true)
    expect(social.signOutSocialProviders).toHaveBeenCalled()
  })
})

describe("서버 온보딩", () => {
  it("입력이 멈추면 닉네임 중복을 확인해 이미 쓰는 닉네임을 알린다", async () => {
    await tokenStore.set({ accessToken: "a", refreshToken: "r" })
    serve(
      on("GET", "/members/me", () => ok(onboardingMember)),
      on("GET", "/members/nickname-availability", () => ok({ nickname: "면탐험가", available: false })),
    )
    const view = await renderWithStore(<OnboardingScreen />)

    await fireEvent.changeText(await view.findByLabelText("닉네임"), "면탐험가")

    expect(await view.findByText("이미 사용 중인 닉네임이에요. 다른 닉네임을 적어 주세요.")).toBeTruthy()
    const calls: Array<[string, RequestInit]> = fetchMock.mock.calls
    expect(calls.filter(([url]) => url.includes("/nickname-availability"))).toHaveLength(1)
  })

  it("닉네임과 현재 문서 버전의 동의로 가입을 마친다", async () => {
    await tokenStore.set({ accessToken: "a", refreshToken: "r" })
    serve(
      on("GET", "/members/me", () => ok(onboardingMember)),
      on("GET", "/members/nickname-availability", () => ok({ nickname: "면탐험가", available: true })),
      on("PUT", "/members/me/onboarding", () => ok({ ...activeMember, id: "88", nickname: "면탐험가" })),
    )
    const view = await renderWithStore(<OnboardingScreen />)

    await fireEvent.changeText(await view.findByLabelText("닉네임"), "면탐험가")
    expect(await view.findByText("사용할 수 있는 닉네임이에요.")).toBeTruthy()
    await fireEvent.press(view.getByRole("checkbox", { name: "필수, 서비스 이용약관 동의" }))
    await fireEvent.press(view.getByRole("checkbox", { name: "필수, 개인정보 수집 및 이용 동의" }))
    await fireEvent.press(view.getByRole("button", { name: "회원가입 완료" }))

    expect(await view.findByText("면탐험가님, 반가워요")).toBeTruthy()
    expect(bodyOf("PUT", "/members/me/onboarding")).toEqual({
      nickname: "면탐험가",
      consents: [
        { type: "TERMS", documentVersion: "2026-11-03", granted: true },
        { type: "PRIVACY", documentVersion: "2026-11-03", granted: true },
        { type: "MARKETING", documentVersion: "2026-11-03", granted: false },
      ],
    })
  })
})
