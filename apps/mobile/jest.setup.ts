import mockAsyncStorage from "@react-native-async-storage/async-storage/jest/async-storage-mock"

jest.mock("@react-native-async-storage/async-storage", () => mockAsyncStorage)

// expo-secure-store는 불러오는 순간 네이티브 모듈을 찾는다. 메모리 대체본(__mocks__)으로 바꿔 둔다
jest.mock("expo-secure-store")

// 공용 부품(칩, 시트, 사진 등)이 Reanimated로 움직이므로 모든 테스트에 기본 대체본을 깐다.
// 동작 줄이기·타이밍을 따로 봐야 하는 테스트는 파일 안에서 다시 mock해 덮어쓴다
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"))
jest.mock("react-native-reanimated", () => ({
  ...(require("react-native-reanimated/mock") as object),
  useReducedMotion: () => false,
}))
