/**
 * jest용 expo-notifications. pnpm 링크 때문에 자동 적용되지 않으니 테스트 파일에서 jest.mock("expo-notifications")로 켠다.
 * 네이티브 모듈 없이 권한·예약·응답 리스너를 흉내 낸다. 테스트는 jest.requireMock으로 값을 바꾼다.
 */
export const DEFAULT_ACTION_IDENTIFIER = "expo.modules.notifications.actions.DEFAULT"

export enum SchedulableTriggerInputTypes {
  CALENDAR = "calendar",
  DAILY = "daily",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
  YEARLY = "yearly",
  DATE = "date",
  TIME_INTERVAL = "timeInterval",
}

export enum IosAuthorizationStatus {
  NOT_DETERMINED = 0,
  DENIED = 1,
  AUTHORIZED = 2,
  PROVISIONAL = 3,
  EPHEMERAL = 4,
}

const undetermined = { status: "undetermined", granted: false, canAskAgain: true, expires: "never" }
const granted = { status: "granted", granted: true, canAskAgain: true, expires: "never" }

export const getPermissionsAsync = jest.fn(async () => ({ ...undetermined }))
export const requestPermissionsAsync = jest.fn(async () => ({ ...granted }))
export const scheduleNotificationAsync = jest.fn(async (request: { identifier?: string }) => request.identifier ?? "mock-id")
export const cancelScheduledNotificationAsync = jest.fn(async () => undefined)
export const cancelAllScheduledNotificationsAsync = jest.fn(async () => undefined)
export const getAllScheduledNotificationsAsync = jest.fn(async () => [])
export const setNotificationHandler = jest.fn()
export const addNotificationResponseReceivedListener = jest.fn(() => ({ remove: jest.fn() }))
export const addNotificationReceivedListener = jest.fn(() => ({ remove: jest.fn() }))
export const getLastNotificationResponse = jest.fn(() => null)
export const getLastNotificationResponseAsync = jest.fn(async () => null)
export const clearLastNotificationResponse = jest.fn()
