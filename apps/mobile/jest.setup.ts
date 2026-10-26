import mockAsyncStorage from "@react-native-async-storage/async-storage/jest/async-storage-mock"

// 서버 주소는 저장소에 없다. config를 읽는 테스트 파일보다 먼저 가짜 주소를 넣어 둔다
process.env.EXPO_PUBLIC_API_BASE_URL ??= "https://api.example.test/api/v2"
// 취향 리포트는 출시 빌드에서 꺼져 있지만, 화면 테스트는 켜진 상태를 기본으로 본다. 끈 상태는 해당 테스트가 따로 mock한다
process.env.EXPO_PUBLIC_FEATURE_TASTE_REPORT ??= "true"

jest.mock("@react-native-async-storage/async-storage", () => mockAsyncStorage)

// expo-secure-store는 불러오는 순간 네이티브 모듈을 찾는다. 메모리 대체본(__mocks__)으로 바꿔 둔다
jest.mock("expo-secure-store")

// 소셜 로그인 SDK는 네이티브 모듈이다. 스토어가 로그아웃 때 부르므로 모든 테스트에 대체본을 깐다.
// 로그인 흐름을 보는 테스트는 src/auth/social을 직접 mock한다
jest.mock("@react-native-kakao/core", () => ({ initializeKakaoSDK: jest.fn(async () => undefined) }))
jest.mock("@react-native-kakao/user", () => ({
  login: jest.fn(async () => ({ accessToken: "kakao-access-token" })),
  logout: jest.fn(async () => undefined),
}))
jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: jest.fn(),
    signIn: jest.fn(async () => ({ type: "success", data: { idToken: "google-id-token" } })),
    signOut: jest.fn(async () => null),
  },
  isErrorWithCode: jest.fn(() => false),
  statusCodes: { SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED" },
}))
jest.mock("expo-apple-authentication", () => ({
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  signInAsync: jest.fn(async () => ({ identityToken: "apple-id-token", authorizationCode: "apple-code" })),
}))

// 공용 부품(칩, 시트, 사진 등)이 Reanimated로 움직이므로 모든 테스트에 기본 대체본을 깐다.
// 동작 줄이기·타이밍을 따로 봐야 하는 테스트는 파일 안에서 다시 mock해 덮어쓴다
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"))
jest.mock("react-native-reanimated", () => ({
  ...(require("react-native-reanimated/mock") as object),
  useReducedMotion: () => false,
}))

// 테스트 환경에는 레이아웃 측정이 없어 FlashList가 칸을 그리지 못한다. 고정 크기로 재게 한다.
// (라이브러리의 jestSetup.js는 2.x에서 없어진 RecyclerView export를 찾아 쓰지 못한다)
jest.mock("@shopify/flash-list/dist/recyclerview/utils/measureLayout", () => ({
  ...jest.requireActual("@shopify/flash-list/dist/recyclerview/utils/measureLayout"),
  measureParentSize: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  measureFirstChildLayout: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  measureItemLayout: () => ({ x: 0, y: 0, width: 195, height: 100 }),
}))
