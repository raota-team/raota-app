import { act, fireEvent, render, waitFor } from "@testing-library/react-native"
import type { ReactElement } from "react"
import { Alert } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { createInitialPersistedState } from "@/src/data/fixtures"
import type { RaotaRepository } from "@/src/repository"
import { RaotaProvider } from "@/src/state/RaotaStore"
import LoginScreen from "@/app/(flows)/auth/login"
import OnboardingScreen from "@/app/(flows)/auth/onboarding"
import NewRecordScreen from "@/app/(flows)/record/new"
import SelectShopScreen from "@/app/(flows)/record/select-shop"

jest.mock("expo-router", () => {
  const React = require("react") as typeof import("react")
  const { View } = require("react-native") as typeof import("react-native")
  const Stack = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, null, children)
  Stack.Screen = () => null
  return {
    Stack,
    router: {
      back: jest.fn(),
      canGoBack: jest.fn(() => true),
      push: jest.fn(),
      replace: jest.fn(),
    },
    useLocalSearchParams: jest.fn(() => ({ shopId: "1" })),
    useNavigation: jest.fn(() => ({
      addListener: jest.fn(() => jest.fn()),
      dispatch: jest.fn(),
    })),
  }
})

jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"))
jest.mock("react-native-reanimated", () => {
  const mock = require("react-native-reanimated/mock")
  return { ...mock, __esModule: true, default: mock.default ?? mock, useReducedMotion: () => true }
})

jest.mock("lucide-react-native", () => {
  const React = require("react") as typeof import("react")
  const { View } = require("react-native") as typeof import("react-native")
  const Icon = (props: Record<string, unknown>) =>
    React.createElement(View, props)
  return new Proxy({ __esModule: true }, {
    get: (target, property) =>
      property === "__esModule" ? target.__esModule : Icon,
  })
})

jest.mock("@react-native-community/datetimepicker", () => {
  const React = require("react") as typeof import("react")
  const { View } = require("react-native") as typeof import("react-native")
  return function MockDateTimePicker() {
    return React.createElement(View, { accessibilityLabel: "방문일 선택" })
  }
})

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}))

function repositoryWith(
  state = createInitialPersistedState(),
): RaotaRepository {
  return {
    load: jest.fn().mockResolvedValue(state),
    save: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  }
}

async function renderWithStore(
  element: ReactElement,
  repository = repositoryWith(),
) {
  return render(
    <RaotaProvider repository={repository}>{element}</RaotaProvider>,
  )
}

/** 기록 화면은 하단 고정 바가 safe area를 읽으므로 기기 값을 넣어 렌더한다 */
async function renderRecordFlow(element: ReactElement) {
  return renderWithStore(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      {element}
    </SafeAreaProvider>,
  )
}

describe("authentication and onboarding screens", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("offers Apple, Kakao and Google login with a separate demo entry", async () => {
    const view = await renderWithStore(<LoginScreen />)

    for (const name of ["Apple로 계속하기", "카카오로 계속하기", "Google로 계속하기", "데모 계정으로 체험", "로그인 없이 둘러보기"]) {
      expect(view.getByRole("button", { name })).toBeTruthy()
    }
    expect(view.queryByText("이메일로 로그인")).toBeNull()
  })

  it("completes onboarding and routes to the tab shell", async () => {
    const view = await renderWithStore(<OnboardingScreen />)
    const { router } = jest.requireMock("expo-router") as {
      router: { replace: jest.Mock }
    }

    await fireEvent.changeText(view.getByLabelText("닉네임"), "면탐험가")
    await fireEvent.press(view.getByRole("checkbox", { name: "약관 전체 동의" }))
    await fireEvent.press(view.getByRole("button", { name: "회원가입 완료" }))
    await fireEvent.press(await view.findByRole("button", { name: "라오타 시작하기" }))

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/native"))
  })

  it("offers settings and a photo-free fallback when photo permission is denied", async () => {
    const imagePicker = jest.requireMock("expo-image-picker") as {
      requestMediaLibraryPermissionsAsync: jest.Mock
    }
    imagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
      granted: false,
    })
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined)
    const view = await renderWithStore(<OnboardingScreen />)

    await fireEvent.press(view.getByLabelText("프로필 사진 선택"))

    await waitFor(() => {
      expect(alert).toHaveBeenCalledWith(
        "사진 접근 권한이 필요해요",
        expect.stringContaining("사진 없이도 계속"),
        expect.any(Array),
      )
    })
    alert.mockRestore()
  })
})

describe("record screens", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("keeps an incomplete ramen record on screen and names what is missing", async () => {
    const { router } = jest.requireMock("expo-router") as {
      router: { replace: jest.Mock }
    }
    const view = await renderRecordFlow(<NewRecordScreen />)

    // 멘야준(쇼유 라멘)은 라멘 종류가 미리 골라져 있고 방문일은 오늘이다.
    expect(
      await view.findByText(
        "먹은 메뉴, 전체 만족도, 육수 농도 외 3개를 채워주세요",
      ),
    ).toBeTruthy()
    const save = view.getByRole("button", { name: "기록 저장하기, 남은 필수 6개" })
    expect(save.props.accessibilityState).toMatchObject({ disabled: true })

    await fireEvent.press(save)

    expect(view.getByText("채워주세요")).toBeTruthy()
    expect(view.getAllByText("골라주세요")).toHaveLength(5)
    expect(router.replace).not.toHaveBeenCalled()
  })

  it("saves a complete five-axis record and opens the completion screen", async () => {
    const { router } = jest.requireMock("expo-router") as {
      router: { replace: jest.Mock }
    }
    const view = await renderRecordFlow(<NewRecordScreen />)

    await fireEvent.changeText(
      await view.findByLabelText("먹은 메뉴"),
      "특제 쇼유 라멘",
    )
    for (const name of [
      /^전체 만족도 4점/,
      /^육수 농도 3점/,
      /^면 삶기 5점/,
      /^토핑 2점/,
      /^재방문 의사 자주 감/,
    ]) {
      await fireEvent.press(view.getByRole("radio", { name }))
    }

    expect(view.getByText("필수 항목을 모두 채웠어요")).toBeTruthy()
    await fireEvent.press(view.getByRole("button", { name: "기록 저장하기" }))

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith({
        pathname: "/record/complete",
        params: { logId: expect.any(String) },
      }),
    )
  })

  it("asks before leaving a record that has input", async () => {
    const expoRouter = jest.requireMock("expo-router") as {
      useNavigation: jest.Mock
    }
    let beforeRemove: ((event: unknown) => void) | undefined
    const dispatch = jest.fn()
    expoRouter.useNavigation.mockReturnValue({
      addListener: jest.fn((_name: string, listener: (event: unknown) => void) => {
        beforeRemove = listener
        return jest.fn()
      }),
      dispatch,
    })
    const view = await renderRecordFlow(<NewRecordScreen />)

    await fireEvent.changeText(await view.findByLabelText("먹은 메뉴"), "시오")
    const preventDefault = jest.fn()
    const action = { type: "GO_BACK" }
    await act(async () => {
      beforeRemove?.({ preventDefault, data: { action } })
    })

    expect(preventDefault).toHaveBeenCalled()
    expect(view.getByText("작성을 그만둘까요?")).toBeTruthy()
    await fireEvent.press(view.getByRole("button", { name: "나가기" }))
    expect(dispatch).toHaveBeenCalledWith(action)
  })

  it("starts a record from the saved-shop tab of the shop picker", async () => {
    const { router } = jest.requireMock("expo-router") as {
      router: { replace: jest.Mock }
    }
    const view = await renderRecordFlow(<SelectShopScreen />)

    await fireEvent.press(await view.findByRole("tab", { name: "찜한 가게 4곳" }))
    await fireEvent.press(view.getByRole("button", { name: /^오레노라멘/ }))

    expect(router.replace).toHaveBeenCalledWith({
      pathname: "/record/new",
      params: { shopId: "3" },
    })
  })

  it("shows an empty state when a shop search has no match", async () => {
    const view = await renderRecordFlow(<SelectShopScreen />)

    await fireEvent.press(await view.findByRole("tab", { name: "검색" }))
    await fireEvent.changeText(view.getByLabelText("가게 검색"), "없는가게")

    expect(view.getByText("검색 결과가 없어요")).toBeTruthy()
  })
})
