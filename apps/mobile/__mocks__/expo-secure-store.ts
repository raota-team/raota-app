/**
 * jest용 expo-secure-store. 진짜 모듈은 불러오는 순간 네이티브 모듈을 찾아 테스트에서 터진다.
 * jest.setup.ts에서 jest.mock("expo-secure-store")로 켜 둔다(pnpm 링크 때문에 자동 적용되지 않는다).
 * 기기 대신 메모리에 저장하고, 테스트는 __resetSecureStore()로 비운다.
 */
const store = new Map<string, string>()

export const AFTER_FIRST_UNLOCK = 1
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 2
export const ALWAYS = 3
export const ALWAYS_THIS_DEVICE_ONLY = 4
export const WHEN_PASSCODE_SET_THIS_DEVICE_ONLY = 5
export const WHEN_UNLOCKED = 6
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 7

export const isAvailableAsync = jest.fn(async () => true)

export const getItemAsync = jest.fn(async (key: string) => store.get(key) ?? null)

export const setItemAsync = jest.fn(async (key: string, value: string) => {
  store.set(key, value)
})

export const deleteItemAsync = jest.fn(async (key: string) => {
  store.delete(key)
})

export const getItem = jest.fn((key: string) => store.get(key) ?? null)

export const setItem = jest.fn((key: string, value: string) => {
  store.set(key, value)
})

export const canUseBiometricAuthentication = jest.fn(() => false)

/** 테스트 사이에 저장된 값과 호출 기록을 비운다 */
export function __resetSecureStore() {
  store.clear()
  isAvailableAsync.mockClear()
  getItemAsync.mockClear()
  setItemAsync.mockClear()
  deleteItemAsync.mockClear()
}
