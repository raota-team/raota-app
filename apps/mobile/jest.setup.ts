import mockAsyncStorage from "@react-native-async-storage/async-storage/jest/async-storage-mock"

jest.mock("@react-native-async-storage/async-storage", () => mockAsyncStorage)

// expo-secure-store는 불러오는 순간 네이티브 모듈을 찾는다. 메모리 대체본(__mocks__)으로 바꿔 둔다
jest.mock("expo-secure-store")
