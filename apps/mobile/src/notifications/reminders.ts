import AsyncStorage from "@react-native-async-storage/async-storage"
import * as Notifications from "expo-notifications"
import { useCallback, useEffect, useRef, useState } from "react"
import { Platform } from "react-native"

import { MONTHLY_REPORT_TARGET, monthlyReportStatus, seoulMonthKey } from "@raota/shared"

import { track } from "../analytics"

/*
 * 기록 리마인더. 서버 없이 기기 안에서 로컬 알림 두 개만 예약한다.
 * - 월간 리포트 마감 전: "이번 달 N그릇 더 기록하면 월간 리포트가 나와요"
 * - 마지막 기록 뒤 7일: "지난주에 먹은 라멘, 남겨볼까요?"
 * 기록을 저장할 때마다(완료 화면) 같은 식별자로 다시 예약해 중복을 막는다.
 * 권한은 첫 기록을 저장한 뒤 완료 화면에서 앱 안내 → 시스템 권한 순서로 한 번만 묻는다.
 */

export const REMINDER_IDS = {
  monthly: "raota.reminder.monthly-report",
  inactive: "raota.reminder.inactive-7d",
} as const

/** 앱 안내에 대한 답. 한 번 답하면 다시 묻지 않는다 */
export const REMINDER_DECISION_KEY = "raota.reminders.decision.v1"
export type ReminderDecision = "accepted" | "declined"

/** 알림을 누르면 여는 화면. 루트 레이아웃이 deepLinkToPath로 경로를 바꿔 연다 */
export const REMINDER_DEEP_LINK = "raota://record/select-shop?mode=nearby&source=reminder"

/** 알림이 열 수 있는 화면. 알림 데이터로 임의 경로를 열지 않도록 목록으로 막는다 */
const DEEP_LINK_PATHS = ["/record/select-shop", "/record/new", "/taste", "/native"] as const

const REMINDER_HOUR = 19
const INACTIVE_DAYS = 7
/** 월간 리포트 마감(다음 달 1일) 며칠 전에 알릴지 */
const MONTHLY_LEAD_DAYS = 3

export interface ReminderContext {
  /** 이번 달(서울 기준) 기록한 그릇 수 */
  monthCount: number
  /** 마지막 기록 시각. 기본은 지금(방금 저장한 기록) */
  lastRecordAt?: Date
  now?: Date
}

export interface PlannedReminder {
  identifier: string
  kind: "monthly" | "inactive"
  title: string
  body: string
  url: string
  date: Date
}

const atHour = (base: Date, dayOffset: number) => {
  const date = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset, REMINDER_HOUR, 0, 0, 0)
  return date
}

const bowlsLabel = (count: number) => (count === 1 ? "한 그릇" : `${count}그릇`)

/** 예약할 알림 목록(순수 함수). 이미 지난 시각이나 채운 목표는 넣지 않는다 */
export function planRecordReminders({ monthCount, lastRecordAt, now = new Date() }: ReminderContext): PlannedReminder[] {
  const plans: PlannedReminder[] = []
  const status = monthlyReportStatus({ [seoulMonthKey(now)]: monthCount }, now)

  if (status.remaining > 0) {
    // 기기 달력 기준 이번 달 마지막 날
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const leadDate = atHour(lastDay, -(MONTHLY_LEAD_DAYS - 1))
    const lastCall = atHour(lastDay, 0)
    const date = leadDate > now ? leadDate : lastCall > now ? lastCall : null
    if (date) {
      plans.push({
        identifier: REMINDER_IDS.monthly,
        kind: "monthly",
        title: `이번 달 ${bowlsLabel(status.remaining)} 더 기록하면 월간 리포트가 나와요`,
        body: `${status.month}월 기록이 ${MONTHLY_REPORT_TARGET}그릇이 되면 ${status.publishMonth}월 1일에 리포트가 나와요.`,
        url: REMINDER_DEEP_LINK,
        date,
      })
    }
  }

  const inactiveDate = atHour(lastRecordAt ?? now, INACTIVE_DAYS)
  if (inactiveDate > now) {
    plans.push({
      identifier: REMINDER_IDS.inactive,
      kind: "inactive",
      title: "지난주에 먹은 라멘, 남겨볼까요?",
      body: "가게를 고르면 바로 맛을 기록할 수 있어요.",
      url: REMINDER_DEEP_LINK,
      date: inactiveDate,
    })
  }
  return plans
}

/**
 * 'raota://record/select-shop?mode=nearby' → '/record/select-shop?mode=nearby'.
 * 허용한 화면이 아니면 null
 */
export function deepLinkToPath(url: unknown): string | null {
  if (typeof url !== "string") return null
  const match = url.match(/^(?:raota:\/\/\/?|\/)([^?#]*)(\?[^#]*)?/)
  if (!match) return null
  const path = `/${match[1].replace(/\/+$/, "")}`
  if (!(DEEP_LINK_PATHS as readonly string[]).includes(path)) return null
  return `${path}${match[2] ?? ""}`
}

const isSupported = () => Platform.OS === "ios" || Platform.OS === "android"

const isGranted = (permission: Notifications.NotificationPermissionsStatus) =>
  permission.granted || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL

export type ReminderStatus = "unsupported" | "granted" | "ask" | "decided"

/** 안내를 띄울지 판단한다. 이미 답했거나 시스템에서 거절했으면 다시 묻지 않는다 */
export async function getReminderStatus(): Promise<ReminderStatus> {
  if (!isSupported()) return "unsupported"
  try {
    const permission = await Notifications.getPermissionsAsync()
    if (isGranted(permission)) return "granted"
    const decision = await AsyncStorage.getItem(REMINDER_DECISION_KEY)
    if (decision) return "decided"
    if (permission.status === "denied" || !permission.canAskAgain) return "decided"
    return "ask"
  } catch {
    return "unsupported"
  }
}

/** 권한이 있을 때만 두 알림을 같은 식별자로 교체 예약한다. 예약한 개수를 돌려준다 */
export async function syncRecordReminders(context: ReminderContext): Promise<number> {
  if (!isSupported()) return 0
  try {
    const permission = await Notifications.getPermissionsAsync()
    if (!isGranted(permission)) return 0
    await cancelRecordReminders()
    const plans = planRecordReminders(context)
    for (const plan of plans) {
      await Notifications.scheduleNotificationAsync({
        identifier: plan.identifier,
        content: { title: plan.title, body: plan.body, data: { url: plan.url, kind: plan.kind }, sound: "default" },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: plan.date },
      })
      track("reminder_scheduled", { kind: plan.kind })
    }
    return plans.length
  } catch {
    // 알림 예약 실패가 기록 흐름을 막지 않는다
    return 0
  }
}

export const TEST_REMINDER_ID = "raota.reminder.dev-test"

export type TestReminderResult = "scheduled" | "denied" | "unsupported"

/**
 * 개발용(Expo Go 확인): 실제 리마인더와 같은 문구·딥링크로 N초 뒤 알림 하나를 예약한다.
 * 권한이 없으면 먼저 시스템 권한을 요청한다. 화면 쪽에서 __DEV__일 때만 부른다.
 */
export async function scheduleTestReminder(
  seconds = 5,
  kind: PlannedReminder["kind"] = "inactive",
  monthCount = 0,
): Promise<TestReminderResult> {
  if (!isSupported()) return "unsupported"
  try {
    let permission = await Notifications.getPermissionsAsync()
    if (!isGranted(permission)) {
      permission = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowSound: true, allowBadge: false },
      })
    }
    if (!isGranted(permission)) return "denied"
    const plans = planRecordReminders({ monthCount })
    const plan = plans.find((item) => item.kind === kind) ?? plans[plans.length - 1]
    if (!plan) return "unsupported"
    await Notifications.scheduleNotificationAsync({
      identifier: TEST_REMINDER_ID,
      content: { title: plan.title, body: plan.body, data: { url: plan.url, kind: plan.kind, test: true }, sound: "default" },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(1, seconds), repeats: false },
    })
    return "scheduled"
  } catch {
    return "unsupported"
  }
}

/** 로그아웃처럼 알림이 더는 맞지 않을 때 지운다 */
export async function cancelRecordReminders(): Promise<void> {
  if (!isSupported()) return
  try {
    await Promise.all(Object.values(REMINDER_IDS).map((id) => Notifications.cancelScheduledNotificationAsync(id)))
  } catch {
    // 지울 알림이 없으면 무시한다
  }
}

/** 앱 안내에서 "알림 받기"를 누른 뒤 시스템 권한을 요청한다. 허용되면 바로 예약한다 */
export async function acceptReminders(context: ReminderContext): Promise<boolean> {
  await AsyncStorage.setItem(REMINDER_DECISION_KEY, "accepted").catch(() => undefined)
  if (!isSupported()) return false
  try {
    const permission = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    })
    if (!isGranted(permission)) return false
    await syncRecordReminders(context)
    return true
  } catch {
    return false
  }
}

export async function declineReminders(): Promise<void> {
  await AsyncStorage.setItem(REMINDER_DECISION_KEY, "declined").catch(() => undefined)
}

/** 앱이 앞에 있을 때도 배너로 보여준다. 루트 레이아웃에서 한 번 부른다 */
export function configureReminderPresentation() {
  if (!isSupported()) return
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  })
}

/**
 * 앱 안내를 띄우기 전 완료 화면을 먼저 읽게 둔다.
 * 도장 250ms + 본문 등장 450ms으로 연출이 끝나므로, 그 뒤 티켓·그릇 수·취향 변화를 읽을 시간까지 준다.
 * 이 화면은 앱에서 유일한 축하 장면이고, 권한은 보상을 인식한 뒤에 물어야 수락률도 높다.
 */
export const REMINDER_PROMPT_DELAY = 3500

/**
 * 완료 화면용. 권한이 있으면 조용히 다시 예약하고, 처음이면 앱 안내를 띄운다.
 * enabled가 true가 될 때 판단한다(완료 화면에서는 기록을 찾은 뒤 한 번).
 */
export function useRecordReminderPrompt(enabled: boolean, monthCount: number) {
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const countRef = useRef(monthCount)
  countRef.current = monthCount

  useEffect(() => {
    if (!enabled) return
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    void getReminderStatus().then((status) => {
      if (!active) return
      if (status === "granted") void syncRecordReminders({ monthCount: countRef.current })
      else if (status === "ask") timer = setTimeout(() => active && setVisible(true), REMINDER_PROMPT_DELAY)
    })
    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }, [enabled])

  const accept = useCallback(async () => {
    setBusy(true)
    try {
      await acceptReminders({ monthCount: countRef.current })
    } finally {
      setBusy(false)
      setVisible(false)
    }
  }, [])

  const decline = useCallback(() => {
    setVisible(false)
    void declineReminders()
  }, [])

  return { visible, busy, accept, decline }
}
