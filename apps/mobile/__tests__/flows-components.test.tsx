import { act, fireEvent, render, waitFor } from "@testing-library/react-native"
import type { ReactElement } from "react"
import { Alert, StyleSheet } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { createInitialPersistedState } from "@/src/data/fixtures"
import type { RaotaRepository } from "@/src/repository"
import { RaotaProvider } from "@/src/state/RaotaStore"
import LoginScreen from "@/app/(flows)/auth/login"
import OnboardingScreen from "@/app/(flows)/auth/onboarding"
import NewRecordScreen from "@/app/(flows)/record/new"
import { RamenTypeTag, ScoreSegment, SoupDot } from "@/src/components/ui"
import { TasteFingerprint } from "@/src/components/TasteFingerprint"
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
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <RaotaProvider repository={repository}>{element}</RaotaProvider>
    </SafeAreaProvider>,
  )
}

describe("authentication and onboarding screens", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("offers Apple, Kakao and Google login and guest browsing without a demo button", async () => {
    const view = await renderWithStore(<LoginScreen />)

    for (const name of ["Apple로 계속하기", "카카오로 계속하기", "Google로 계속하기", "로그인 없이 둘러보기"]) {
      expect(view.getByRole("button", { name })).toBeTruthy()
    }
    expect(view.queryByText("데모 계정으로 체험")).toBeNull()
    expect(view.queryByText("이메일로 로그인")).toBeNull()
  })

  it("opens the full terms and privacy pages from the login footer", async () => {
    const { router } = jest.requireMock("expo-router") as {
      router: { push: jest.Mock }
    }
    const view = await renderWithStore(<LoginScreen />)

    await fireEvent.press(view.getByRole("link", { name: "개인정보처리방침" }))

    expect(router.push).toHaveBeenCalledWith({ pathname: "/legal/[doc]", params: { doc: "privacy" } })
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

describe("shared taste marks", () => {
  it("renders plain ramen type labels and leaves standalone soup keys decorative", async () => {
    const view = await render(
      <>
        <RamenTypeTag type="쇼유 라멘" />
        <RamenTypeTag inList type="시오" />
        <RamenTypeTag onImage type="미소" />
        <SoupDot type="돈코츠" />
      </>,
    )

    expect(view.getByLabelText("라멘 종류 쇼유").children).toHaveLength(1)
    expect(view.getByLabelText("라멘 종류 시오").children).toHaveLength(1)
    expect(view.getByLabelText("라멘 종류 미소").children).toHaveLength(1)
    expect(view.queryByLabelText("돈코츠")).toBeNull()
  })

  it("announces the taste fingerprint as one readable set of axes", async () => {
    const view = await render(
      <TasteFingerprint
        meta="회원 23명의 기록"
        rows={[
          { key: "satisfaction", label: "만족도", value: 4.3, text: "4.3" },
          { key: "brothDensity", label: "육수 농도", value: 4, text: "진한 편" },
        ]}
      />,
    )

    expect(view.getByLabelText("맛 지문. 회원 23명의 기록. 만족도 4.3, 육수 농도 진한 편")).toBeTruthy()
  })
})

describe("record screens", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("keeps five radio choices for both score kinds, with hero feedback and invalid guidance", async () => {
    const onChange = jest.fn()
    const view = await render(
      <ScoreSegment
        hero
        high="진함"
        invalid
        kind="quality"
        label="육수 농도"
        low="맑음"
        onChange={onChange}
        value={null}
        words={["아주 맑음", "맑은 편", "중간", "진한 편", "아주 진함"]}
      />,
    )

    expect(view.getAllByRole("radio")).toHaveLength(5)
    expect(view.getByText("골라주세요")).toBeTruthy()
    expect(view.getByText("맑음")).toBeTruthy()
    expect(view.getByText("진함")).toBeTruthy()
    await fireEvent.press(view.getByRole("radio", { name: /^육수 농도 4점/ }))
    expect(onChange).toHaveBeenCalledWith(4)

    await view.rerender(
      <ScoreSegment
        high="진함"
        kind="spectrum"
        label="육수 농도"
        low="맑음"
        onChange={onChange}
        value={4}
        words={["아주 맑음", "맑은 편", "중간", "진한 편", "아주 진함"]}
      />,
    )
    expect(view.getByText("진한 편")).toBeTruthy()
    expect(view.getByRole("radio", { name: /^육수 농도 4점/ }).props.accessibilityState.checked).toBe(true)
  })

  it("shows the selected shop, editable menu, visit date and folded optional details", async () => {
    const view = await renderWithStore(<NewRecordScreen />)

    expect(await view.findByText("멘야준 · 망원 본점")).toBeTruthy()
    await fireEvent.changeText(view.getByLabelText("먹은 메뉴"), "특제 쇼유 라멘")
    expect(view.getByLabelText("먹은 메뉴").props.value).toBe("특제 쇼유 라멘")
    expect(view.getByRole("button", { name: /^방문일, / })).toBeTruthy()
    expect(view.getAllByRole("radio", { name: /^재방문 의사/ })).toHaveLength(3)
    expect(view.queryByText("맛 태그")).toBeNull()
    expect(view.getByRole("button", { name: "사진 추가" })).toBeTruthy()
    expect(view.queryByLabelText("기억해둘 점")).toBeNull()

    const details = view.getByRole("button", { name: "상세 추가" })
    expect(details.props.accessibilityState.expanded).toBe(false)
    await fireEvent.press(details)

    expect(view.getByText("맛 태그")).toBeTruthy()
    expect(view.getByRole("button", { name: "사진 추가" })).toBeTruthy()
    expect(view.getByLabelText("기억해둘 점")).toBeTruthy()
    expect(details.props.accessibilityState.expanded).toBe(true)
  })

  it("offers a private default and an explicit public choice beside Save", async () => {
    const view = await renderWithStore(<NewRecordScreen />)
    const privateButton = await view.findByRole("button", { name: "나만 보기" })
    const publicButton = view.getByRole("button", { name: "공개" })

    expect(privateButton.props.accessibilityState.selected).toBe(true)
    expect(publicButton.props.accessibilityState.selected).toBe(false)
    expect(view.queryByRole("switch", { name: "내 기록 공개하기" })).toBeNull()
    expect(view.queryByText("공개 기록")).toBeNull()

    await fireEvent.press(publicButton)
    expect(publicButton.props.accessibilityState.selected).toBe(true)
    await fireEvent.press(privateButton)
    expect(privateButton.props.accessibilityState.selected).toBe(true)
  })

  it("keeps an incomplete ramen record on screen and names what is missing", async () => {
    const { router } = jest.requireMock("expo-router") as {
      router: { replace: jest.Mock }
    }
    const view = await renderWithStore(<NewRecordScreen />)

    // 멘야준(쇼유 라멘)은 라멘 종류가 미리 골라져 있고 방문일은 오늘이다.
    expect(
      await view.findByText(
        "먹은 메뉴, 전체 만족도, 육수 농도 외 3개를 채워주세요",
      ),
    ).toBeTruthy()
    const save = view.getByRole("button", { name: "기록 저장하기, 남은 필수 6개" })
    // 미완성이어도 눌리는 버튼이다(누르면 빠진 첫 항목으로 데려다준다).
    // disabled를 주면 VoiceOver가 "흐림"으로 읽어 이 길이 화면을 못 보는 사용자에게만 닫힌다
    expect(save.props.accessibilityState?.disabled).toBeFalsy()
    expect(save.props.accessibilityHint).toBe("누르면 빠진 첫 항목으로 이동해요")

    await fireEvent.press(save)

    expect(view.getByText("채워주세요")).toBeTruthy()
    expect(view.getAllByText("골라주세요")).toHaveLength(5)
    expect(router.replace).not.toHaveBeenCalled()
  })

  it("saves a complete five-axis record and opens the completion screen", async () => {
    const { router } = jest.requireMock("expo-router") as {
      router: { replace: jest.Mock }
    }
    const repository = repositoryWith()
    const view = await renderWithStore(<NewRecordScreen />, repository)

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
    await waitFor(() =>
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          logs: expect.arrayContaining([expect.objectContaining({ menuName: "특제 쇼유 라멘", isPublic: false })]),
        }),
      ),
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
    const view = await renderWithStore(<NewRecordScreen />)

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
    const view = await renderWithStore(<SelectShopScreen />)

    await fireEvent.press(await view.findByRole("tab", { name: "찜한 가게 4곳" }))
    await fireEvent.press(view.getByRole("button", { name: /^오레노라멘/ }))

    expect(router.replace).toHaveBeenCalledWith({
      pathname: "/record/new",
      params: { shopId: "3" },
    })
  })

  it("shows an empty state when a shop search has no match", async () => {
    const view = await renderWithStore(<SelectShopScreen />)

    await fireEvent.press(await view.findByRole("tab", { name: "검색" }))
    await fireEvent.changeText(view.getByLabelText("가게 검색"), "없는가게")

    expect(view.getByText("검색 결과가 없어요")).toBeTruthy()
  })
})
