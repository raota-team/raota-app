import { fireEvent, render, waitFor } from "@testing-library/react-native"
import type { ReactElement } from "react"
import { Alert } from "react-native"

import { createInitialPersistedState } from "@/src/data/fixtures"
import type { RaotaRepository } from "@/src/repository"
import { RaotaProvider } from "@/src/state/RaotaStore"
import LoginScreen from "@/app/(flows)/auth/login"
import OnboardingScreen from "@/app/(flows)/auth/onboarding"
import NotificationsScreen from "@/app/(flows)/notifications"
import NewRecordScreen from "@/app/(flows)/record/new"

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

describe("authentication and onboarding screens", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("shows inline validation for an invalid email login", async () => {
    const view = await renderWithStore(<LoginScreen />)

    await fireEvent.press(view.getByRole("button", { name: "이메일로 로그인" }))
    await fireEvent.changeText(
      view.getByLabelText("이메일 주소"),
      "not-an-email",
    )
    await fireEvent.press(view.getByRole("button", { name: "이메일로 로그인" }))

    expect(
      await view.findByText("올바른 이메일 주소를 입력해주세요."),
    ).toBeTruthy()
  })

  it("completes onboarding and routes to the tab shell", async () => {
    const view = await renderWithStore(<OnboardingScreen />)
    const { router } = jest.requireMock("expo-router") as {
      router: { replace: jest.Mock }
    }

    await fireEvent.changeText(view.getByLabelText("닉네임"), "면탐험가")
    await fireEvent.press(view.getByRole("button", { name: "RAOTA 시작하기" }))

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

describe("record and notification screens", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("keeps an incomplete ramen record on screen with a useful error", async () => {
    const view = await renderWithStore(<NewRecordScreen />)

    await fireEvent.press(
      view.getByRole("button", { name: "라멘로그 저장하기" }),
    )

    expect(
      await view.findByText("국물·면·간·토핑에서 느낌을 하나 이상 골라주세요."),
    ).toBeTruthy()
  })

  it("disables category switches when the master notification switch is off", async () => {
    const view = await renderWithStore(<NotificationsScreen />)

    await fireEvent.press(view.getByLabelText("알림 설정"))
    await fireEvent(view.getByLabelText("푸시 알림 알림"), "valueChange", false)

    await waitFor(() =>
      expect(view.getByLabelText("공감 알림").props.disabled).toBe(true),
    )
  })
})
