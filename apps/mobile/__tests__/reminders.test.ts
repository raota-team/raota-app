import AsyncStorage from "@react-native-async-storage/async-storage"

import { track } from "@/src/analytics"
import {
  REMINDER_DECISION_KEY,
  REMINDER_IDS,
  acceptReminders,
  declineReminders,
  deepLinkToPath,
  getReminderStatus,
  planRecordReminders,
  scheduleTestReminder,
  syncRecordReminders,
} from "@/src/notifications"

jest.mock("@/src/analytics", () => ({ track: jest.fn() }))
// __mocks__/expo-notifications.ts를 쓴다
jest.mock("expo-notifications")

type Mocked = {
  getPermissionsAsync: jest.Mock
  requestPermissionsAsync: jest.Mock
  scheduleNotificationAsync: jest.Mock
  cancelScheduledNotificationAsync: jest.Mock
}
const notifications = jest.requireMock("expo-notifications") as Mocked

const granted = { status: "granted", granted: true, canAskAgain: true, expires: "never" }
const denied = { status: "denied", granted: false, canAskAgain: false, expires: "never" }
const undetermined = { status: "undetermined", granted: false, canAskAgain: true, expires: "never" }

beforeEach(async () => {
  jest.clearAllMocks()
  notifications.getPermissionsAsync.mockResolvedValue(undetermined)
  await AsyncStorage.clear()
})

describe("planRecordReminders", () => {
  it("plans the monthly report reminder with the bowls still needed and a 7-day nudge", () => {
    // 9월 10일 12시(서울), 이번 달 1그릇
    const now = new Date(2026, 8, 10, 12, 0, 0)
    const plans = planRecordReminders({ monthCount: 1, now })

    const monthly = plans.find((plan) => plan.identifier === REMINDER_IDS.monthly)
    expect(monthly?.title).toBe("이번 달 2그릇 더 기록하면 월간 리포트가 나와요")
    expect(monthly?.body).toBe("9월 기록이 3그릇이 되면 10월 1일에 리포트가 나와요.")
    // 마감 사흘 전(9/28) 19시
    expect(monthly?.date).toEqual(new Date(2026, 8, 28, 19, 0, 0))

    const inactive = plans.find((plan) => plan.identifier === REMINDER_IDS.inactive)
    expect(inactive?.title).toBe("지난주에 먹은 라멘, 남겨볼까요?")
    expect(inactive?.date).toEqual(new Date(2026, 8, 17, 19, 0, 0))
    expect(inactive?.url).toBe("raota://record/select-shop?mode=nearby&source=reminder")
  })

  it("says 한 그릇 when one bowl is left and falls back to the last day near month end", () => {
    const now = new Date(2026, 8, 29, 9, 0, 0)
    const [monthly] = planRecordReminders({ monthCount: 2, now })
    expect(monthly.title).toBe("이번 달 한 그릇 더 기록하면 월간 리포트가 나와요")
    expect(monthly.date).toEqual(new Date(2026, 8, 30, 19, 0, 0))
  })

  it("skips the monthly reminder once the month already has three bowls", () => {
    const now = new Date(2026, 8, 10, 12, 0, 0)
    const plans = planRecordReminders({ monthCount: 3, now })
    expect(plans.map((plan) => plan.identifier)).toEqual([REMINDER_IDS.inactive])
  })
})

describe("deepLinkToPath", () => {
  it("turns an allowed raota:// link into a router path and rejects others", () => {
    expect(deepLinkToPath("raota://record/select-shop?mode=nearby")).toBe("/record/select-shop?mode=nearby")
    expect(deepLinkToPath("raota:///taste")).toBe("/taste")
    expect(deepLinkToPath("raota://notifications")).toBeNull()
    expect(deepLinkToPath("https://evil.example/record/select-shop")).toBeNull()
    expect(deepLinkToPath(undefined)).toBeNull()
  })
})

describe("permission and scheduling", () => {
  it("asks only when nothing was decided and the system can still ask", async () => {
    expect(await getReminderStatus()).toBe("ask")

    await declineReminders()
    expect(await AsyncStorage.getItem(REMINDER_DECISION_KEY)).toBe("declined")
    expect(await getReminderStatus()).toBe("decided")
  })

  it("does not ask again after the system permission was denied", async () => {
    notifications.getPermissionsAsync.mockResolvedValueOnce(denied)
    expect(await getReminderStatus()).toBe("decided")
  })

  it("requests the system permission after the in-app yes and schedules both reminders", async () => {
    notifications.getPermissionsAsync.mockResolvedValue(granted)
    const accepted = await acceptReminders({ monthCount: 1, now: new Date(2026, 8, 10, 12) })

    expect(accepted).toBe(true)
    expect(notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1)
    expect(await AsyncStorage.getItem(REMINDER_DECISION_KEY)).toBe("accepted")
    expect(notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2)
    expect(track).toHaveBeenCalledWith("reminder_scheduled", { kind: "monthly" })
    expect(track).toHaveBeenCalledWith("reminder_scheduled", { kind: "inactive" })
  })

  it("replaces reminders under the same identifiers on every record instead of stacking them", async () => {
    notifications.getPermissionsAsync.mockResolvedValue(granted)
    await syncRecordReminders({ monthCount: 1, now: new Date(2026, 8, 10, 12) })
    await syncRecordReminders({ monthCount: 2, now: new Date(2026, 8, 11, 12) })

    const identifiers = notifications.scheduleNotificationAsync.mock.calls.map(([request]) => request.identifier)
    expect(new Set(identifiers)).toEqual(new Set([REMINDER_IDS.monthly, REMINDER_IDS.inactive]))
    expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(REMINDER_IDS.monthly)
    const lastMonthly = notifications.scheduleNotificationAsync.mock.calls
      .map(([request]) => request)
      .filter((request) => request.identifier === REMINDER_IDS.monthly)
      .pop()
    expect(lastMonthly.content.title).toBe("이번 달 한 그릇 더 기록하면 월간 리포트가 나와요")
    expect(lastMonthly.content.data.url).toBe("raota://record/select-shop?mode=nearby&source=reminder")
  })

  it("schedules nothing without permission", async () => {
    expect(await syncRecordReminders({ monthCount: 0 })).toBe(0)
    expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled()
  })
})

describe("scheduleTestReminder (dev)", () => {
  it("asks for permission first, then schedules the real copy a few seconds out", async () => {
    notifications.getPermissionsAsync.mockResolvedValue(undetermined)
    notifications.requestPermissionsAsync.mockResolvedValue(granted)

    expect(await scheduleTestReminder(5, "monthly", 1)).toBe("scheduled")
    expect(notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1)
    const [request] = notifications.scheduleNotificationAsync.mock.calls[0]
    expect(request.content.title).toMatch(/그릇 더 기록하면 월간 리포트가 나와요$/)
    expect(request.content.data.url).toBe("raota://record/select-shop?mode=nearby&source=reminder")
    expect(request.trigger).toEqual({ type: "timeInterval", seconds: 5, repeats: false })
  })

  it("reports denied without scheduling", async () => {
    notifications.requestPermissionsAsync.mockResolvedValueOnce(denied)
    expect(await scheduleTestReminder()).toBe("denied")
    expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled()
  })
})
