import { act, fireEvent, render, waitFor } from "@testing-library/react-native"
import type { ReactElement } from "react"
import { Alert, StyleSheet } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"

import { SHOPS, createInitialPersistedState } from "@/src/data/fixtures"
import type { RaotaRepository } from "@/src/repository"
import { RaotaProvider } from "@/src/state/RaotaStore"
import LoginScreen from "@/app/(flows)/auth/login"
import OnboardingScreen from "@/app/(flows)/auth/onboarding"
import NewRecordScreen from "@/app/(flows)/record/new"
import { RamenTypeTag, ScoreSegment, SoupDot } from "@/src/components/ui"
import { TasteFingerprint } from "@/src/components/TasteFingerprint"
import { ShopTasteCard } from "@/src/components/ShopTasteCard"
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

jest.mock("expo-router/react-navigation", () => ({ usePreventRemove: jest.fn() }))

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

  it("announces the taste fingerprint as one readable set of axes, highlighting only quality axes", async () => {
    const view = await render(
      <TasteFingerprint
        meta="회원 23명의 기록"
        rows={[
          { key: "satisfaction", label: "만족도", value: 4.3, text: "4.3" },
          // 육수 농도는 스타일 축이라 더 높아도 강조하지 않는다
          { key: "brothDensity", label: "육수 농도", value: 4.8, text: "진한 편" },
          { key: "topping", label: "토핑", value: 4.3, text: "4.3" },
        ]}
      />,
    )

    expect(view.getByLabelText("맛 지문. 회원 23명의 기록. 만족도 4.3, 육수 농도 진한 편, 토핑 4.3. 가장 높은 평가 만족도, 토핑")).toBeTruthy()
  })

  it("shows the revisit ratio ring only once a shop has five rated logs", async () => {
    const summary = { revisit: { often: 2, sometimes: 0, once: 0 }, topMenu: "특제 쇼유", topMenuCount: 2, broth: "진한 편", noodle: "중간", topping: "보통" }
    const view = await render(
      <>
        <ShopTasteCard summary={{ ...summary, count: 2 }} />
        <ShopTasteCard summary={{ ...summary, count: 5, revisit: { often: 4, sometimes: 1, once: 0 } }} />
      </>,
    )
    expect(view.getByRole("text", { name: /^이 가게의 맛\. 공개 라멘로그 2개\. 2명 모두 또 가고 싶대요\. 기록이 5개 이상 쌓이면 비율로 보여드려요\. 많이 먹은 메뉴 / })).toBeTruthy()
    expect(view.getByRole("text", { name: /^이 가게의 맛\. 공개 라멘로그 5개\. 또 갈래요 80%, 5명 중 4명이 또 가고 싶대요, 가끔 생각남 1명\. 많이 먹은 메뉴 / })).toBeTruthy()
  })
})

describe("record screens", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    const { useLocalSearchParams } = jest.requireMock("expo-router") as { useLocalSearchParams: jest.Mock }
    useLocalSearchParams.mockReturnValue({ shopId: "1" })
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

  /** 메뉴를 적고 점수 넷과 재방문을 골라 마지막 장(추가 감정)까지 간다. 답마다 "다음"을 누른다 */
  async function answerRequired(view: Awaited<ReturnType<typeof renderWithStore>>) {
    await fireEvent.changeText(await view.findByLabelText("먹은 메뉴"), "특제 쇼유 라멘")
    await fireEvent.press(view.getByRole("button", { name: "다음" }))
    for (const name of [/^전체 만족도 4점/, /^육수 농도 3점/, /^면 삶기 5점/, /^토핑 2점/, /^재방문 의사 자주 감/]) {
      await fireEvent.press(await view.findByRole("radio", { name }))
      await fireEvent.press(view.getByRole("button", { name: "다음" }))
    }
    expect(await view.findByText("더 남길 감정이 있나요?")).toBeTruthy()
  }

  it("starts with the meal question and keeps it until the menu is filled", async () => {
    const view = await renderWithStore(<NewRecordScreen />)

    expect(await view.findByText("멘야준 · 망원 본점")).toBeTruthy()
    expect(view.getByText("무엇을 먹었나요?")).toBeTruthy()
    expect(view.getByRole("button", { name: /^방문일, / })).toBeTruthy()
    // 멘야준(쇼유 라멘)은 라멘 종류가 미리 골라져 있다
    expect(view.getByRole("radio", { name: "쇼유" }).props.accessibilityState.checked).toBe(true)

    await fireEvent.press(view.getByRole("button", { name: "다음" }))
    expect(view.getByText("먹은 메뉴를 채워주세요")).toBeTruthy()
    expect(view.getByText("무엇을 먹었나요?")).toBeTruthy()

    await fireEvent.changeText(view.getByLabelText("먹은 메뉴"), "특제 쇼유 라멘")
    await fireEvent.press(view.getByRole("button", { name: "다음" }))
    expect(await view.findByText("전체 만족도는 어땠나요?")).toBeTruthy()
    expect(view.getAllByRole("radio", { name: /^전체 만족도/ })).toHaveLength(5)
  })

  it("selects a shop by its full BIGINT route ID on the record form", async () => {
    const shopId = "9007199254740993123"
    const original = SHOPS[0]
    const { useLocalSearchParams } = jest.requireMock("expo-router") as { useLocalSearchParams: jest.Mock }
    SHOPS[0] = { ...original, id: shopId }
    useLocalSearchParams.mockReturnValue({ shopId })
    try {
      const view = await renderWithStore(<NewRecordScreen />)
      expect(await view.findByText("멘야준 · 망원 본점")).toBeTruthy()
    } finally {
      SHOPS[0] = original
    }
  })

  it("waits for Next after an answer, fills the ticket, and returns to a question from its ticket cell", async () => {
    const view = await renderWithStore(<NewRecordScreen />)
    await fireEvent.changeText(await view.findByLabelText("먹은 메뉴"), "특제 쇼유 라멘")
    await fireEvent.press(view.getByRole("button", { name: "다음" }))

    await fireEvent.press(await view.findByRole("radio", { name: /^전체 만족도 4점/ }))
    // 고르기만 해서는 넘어가지 않는다
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500))
    })
    expect(view.getByText("전체 만족도는 어땠나요?")).toBeTruthy()
    await fireEvent.press(view.getByRole("button", { name: "다음" }))
    expect(await view.findByText("육수 농도는 어땠나요?")).toBeTruthy()

    await fireEvent.press(view.getByRole("button", { name: "전체 만족도 4점, 눌러서 이 질문으로 가요" }))
    expect(await view.findByText("전체 만족도는 어땠나요?")).toBeTruthy()
    expect(view.getByRole("radio", { name: /^전체 만족도 4점/ }).props.accessibilityState.checked).toBe(true)
    // 아직 닿지 않은 질문의 칸은 누를 수 없다
    expect(view.getByRole("button", { name: /^토핑 아직 비어 있음/ }).props.accessibilityState.disabled).toBe(true)
  })

  it("saves a public-by-default five-axis record with extra tags and opens the completion screen", async () => {
    const { router } = jest.requireMock("expo-router") as {
      router: { replace: jest.Mock }
    }
    const repository = repositoryWith()
    const view = await renderWithStore(<NewRecordScreen />, repository)
    await answerRequired(view)

    expect(view.getByRole("button", { name: "공개" }).props.accessibilityState.selected).toBe(true)
    expect(view.getByRole("button", { name: "나만 보기" }).props.accessibilityState.selected).toBe(false)
    await fireEvent.press(view.getByRole("button", { name: "국물 진해요" }))
    expect(view.getByRole("button", { name: "추가 감정 1개" })).toBeTruthy()
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
          logs: expect.arrayContaining([
            expect.objectContaining({ menuName: "특제 쇼유 라멘", isPublic: true, tasteNotes: expect.objectContaining({ broth: ["진해요"] }) }),
          ]),
        }),
      ),
    )
  })

  it("sends Save back to the first unanswered question instead of saving", async () => {
    const { router } = jest.requireMock("expo-router") as {
      router: { replace: jest.Mock }
    }
    const view = await renderWithStore(<NewRecordScreen />)
    await answerRequired(view)

    // 앞 질문으로 돌아가 메뉴를 지운 뒤 칸을 눌러 마지막 장으로 온다
    for (let index = 0; index < 6; index += 1) await fireEvent.press(view.getByRole("button", { name: "이전 질문" }))
    await fireEvent.changeText(await view.findByLabelText("먹은 메뉴"), "")
    await fireEvent.press(view.getByRole("button", { name: /^추가 감정 아직 비어 있음, 눌러서/ }))
    const save = await view.findByRole("button", { name: "기록 저장하기, 남은 필수 1개" })
    // 미완성이어도 눌리는 버튼이다. disabled를 주면 VoiceOver가 "흐림"으로 읽어 이 길이 닫힌다
    expect(save.props.accessibilityState?.disabled).toBeFalsy()

    await fireEvent.press(save)
    expect(await view.findByText("무엇을 먹었나요?")).toBeTruthy()
    expect(router.replace).not.toHaveBeenCalled()
  })

  it("asks before leaving a record that has input", async () => {
    const expoRouter = jest.requireMock("expo-router") as {
      useNavigation: jest.Mock
    }
    const { usePreventRemove } = jest.requireMock("expo-router/react-navigation") as {
      usePreventRemove: jest.Mock
    }
    const dispatch = jest.fn()
    expoRouter.useNavigation.mockReturnValue({
      addListener: jest.fn(() => jest.fn()),
      dispatch,
    })
    const view = await renderWithStore(<NewRecordScreen />)

    await fireEvent.changeText(await view.findByLabelText("먹은 메뉴"), "시오")
    const [preventing, onPrevented] = usePreventRemove.mock.calls.at(-1) as [boolean, (event: unknown) => void]
    expect(preventing).toBe(true)
    const action = { type: "GO_BACK" }
    await act(async () => {
      onPrevented({ data: { action } })
    })

    expect(view.getByText("작성을 그만둘까요?")).toBeTruthy()
    await fireEvent.press(view.getByRole("button", { name: "나가기" }))
    expect(usePreventRemove.mock.calls.at(-1)?.[0]).toBe(false)
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
