import { t, ph } from "@lingui/core/macro";
import { t as legacyT } from "@raota/shared"
/**
 * 매장 영업시간. 서버 영업시간(adapters의 toOpeningHours)과 데모 원장이 같은 "요일: 시간" 문자열을 쓰므로
 * 화면은 이 모듈 하나로 읽고, 묶고, 지금 상태를 정한다.
 * 시간은 분 단위다. 자정을 넘겨 닫으면 끝 시각이 1440(24:00)보다 크다.
 */

export const DAY_NAMES = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"]
export const DAY_SHORT = ["일", "월", "화", "수", "목", "금", "토"]

const MINUTES_PER_DAY = 24 * 60
/** 한국 매장이라 기기 시간대와 상관없이 서울 시각으로 상태를 정한다 */
const SEOUL_OFFSET_MINUTES = 9 * 60

export interface OpenRange {
  start: number
  end: number
}

export interface DayHours {
  /** 0=일 … 6=토(Date.getDay와 같다) */
  day: number
  closed: boolean
  /** 시작 순으로 정렬한 영업 구간. 두 구간 사이가 쉬는 시간이다 */
  ranges: OpenRange[]
}

export interface HoursGroup {
  /** 월요일부터 이어지는 요일들 */
  days: number[]
  /** "매일", "월요일", "토·일", "화–금" */
  label: string
  closed: boolean
  ranges: OpenRange[]
}

export type HoursStatus =
  /** breakNext면 closesAt에 문을 닫는 게 아니라 쉬는 시간에 들어간다 */
  | { kind: "open"; closesAt: number; breakNext: boolean }
  | { kind: "break"; reopensAt: number }
  | { kind: "beforeOpen"; opensAt: number }
  /** next는 다음에 여는 때. 그 사이에 영업시간을 모르는 날이 끼면 지어내지 않고 null이다 */
  | { kind: "closed"; closedToday: boolean; next: { dayOffset: number; day: number; opensAt: number } | null }

export interface SeoulTime {
  day: number
  minute: number
}

const TIME_RANGE = /(\d{1,2}):(\d{2})\s*[~–-]\s*(\d{1,2}):(\d{2})/g

/** "월요일: 11:00 ~ 15:00, 17:00 ~ 20:30" / "화요일: 휴무" 목록을 요일별 영업시간으로. 읽지 못한 줄은 버린다 */
export function parseOpeningHours(lines: readonly string[]): DayHours[] {
  const week: DayHours[] = []
  for (const line of lines) {
    const separator = line.indexOf(":")
    if (separator < 0) continue
    const day = DAY_NAMES.indexOf(line.slice(0, separator).trim())
    if (day < 0 || week.some((entry) => entry.day === day)) continue
    const text = line.slice(separator + 1)
    const ranges = [...text.matchAll(TIME_RANGE)].map(([, openHour, openMinute, closeHour, closeMinute]) => {
      const start = Number(openHour) * 60 + Number(openMinute)
      const close = Number(closeHour) * 60 + Number(closeMinute)
      // 닫는 시각이 여는 시각보다 이르면 다음 날 새벽에 닫는다
      return { start, end: close <= start ? close + MINUTES_PER_DAY : close }
    })
    if (ranges.length) {
      week.push({ day, closed: false, ranges: ranges.sort((a, b) => a.start - b.start) })
    } else if (text.includes("휴무")) {
      week.push({ day, closed: true, ranges: [] })
    }
  }
  return week
}

/** 월요일을 한 주의 처음으로 */
function weekOrder(day: number): number {
  return (day + 6) % 7
}

function sameSchedule(a: DayHours, b: DayHours): boolean {
  if (a.closed !== b.closed || a.ranges.length !== b.ranges.length) return false
  return a.ranges.every((range, index) => range.start === b.ranges[index].start && range.end === b.ranges[index].end)
}

function groupLabel(days: number[]): string {
  if (days.length === 7) return t`매일`
  if (days.length === 1) return legacyT(DAY_NAMES[days[0]])
  if (days.length === 2) return `${legacyT(DAY_SHORT[days[0]])}·${legacyT(DAY_SHORT[days[1]])}`
  return `${legacyT(DAY_SHORT[days[0]])}–${legacyT(DAY_SHORT[days[days.length - 1]])}`
}

/** 월요일부터 이어진 요일 중 시간이 같은 날을 한 줄로 묶는다. 떨어진 요일은 시간이 같아도 따로 둔다 */
export function groupWeek(week: readonly DayHours[]): HoursGroup[] {
  const ordered = [...week].sort((a, b) => weekOrder(a.day) - weekOrder(b.day))
  const groups: { first: DayHours; days: number[] }[] = []
  for (const entry of ordered) {
    const last = groups.at(-1)
    const lastDay = last?.days.at(-1)
    if (last && lastDay !== undefined && weekOrder(entry.day) === weekOrder(lastDay) + 1 && sameSchedule(last.first, entry)) {
      last.days.push(entry.day)
    } else {
      groups.push({ first: entry, days: [entry.day] })
    }
  }
  return groups.map(({ first, days }) => ({ days, label: groupLabel(days), closed: first.closed, ranges: first.ranges }))
}

export function seoulTime(date: Date = new Date()): SeoulTime {
  const shifted = new Date(date.getTime() + SEOUL_OFFSET_MINUTES * 60_000)
  return { day: shifted.getUTCDay(), minute: shifted.getUTCHours() * 60 + shifted.getUTCMinutes() }
}

function nextOpening(byDay: Map<number, DayHours>, today: number): { dayOffset: number; day: number; opensAt: number } | null {
  for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
    const day = (today + dayOffset) % 7
    const entry = byDay.get(day)
    if (!entry) return null
    if (!entry.closed && entry.ranges.length) return { dayOffset, day, opensAt: entry.ranges[0].start }
  }
  return null
}

/** 지금 상태. 오늘 영업시간을 모르면(전날 새벽 영업 중도 아니면) null */
export function hoursStatusAt(week: readonly DayHours[], now: SeoulTime): HoursStatus | null {
  const byDay = new Map(week.map((entry) => [entry.day, entry]))
  // 어제 자정을 넘겨 이어지는 영업
  const yesterday = byDay.get((now.day + 6) % 7)
  const lateNight = yesterday?.ranges.find((range) => range.end > MINUTES_PER_DAY && now.minute < range.end - MINUTES_PER_DAY)
  if (lateNight) return { kind: "open", closesAt: lateNight.end, breakNext: false }

  const today = byDay.get(now.day)
  if (!today) return null
  if (today.closed || !today.ranges.length) return { kind: "closed", closedToday: true, next: nextOpening(byDay, now.day) }
  for (const [index, range] of today.ranges.entries()) {
    if (now.minute < range.start) {
      return index === 0 ? { kind: "beforeOpen", opensAt: range.start } : { kind: "break", reopensAt: range.start }
    }
    if (now.minute < range.end) return { kind: "open", closesAt: range.end, breakNext: index < today.ranges.length - 1 }
  }
  return { kind: "closed", closedToday: false, next: nextOpening(byDay, now.day) }
}

/** 시각 표기. 자정을 넘긴 시각은 "다음 날 02:00" */
export function formatTime(minutes: number): string {
  const nextDay = minutes > MINUTES_PER_DAY
  const value = nextDay ? minutes - MINUTES_PER_DAY : minutes
  const text = `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`
  return nextDay ? t`다음 날 ${ph({ time: text })}` : text
}

/** 영업 구간 전체(첫 여는 시각 – 마지막 닫는 시각) */
export function spanText(ranges: readonly OpenRange[]): string {
  return `${formatTime(ranges[0].start)} – ${formatTime(ranges[ranges.length - 1].end)}`
}

/** 구간 사이의 쉬는 시간들 */
export function breaksOf(ranges: readonly OpenRange[]): OpenRange[] {
  return ranges.slice(1).map((range, index) => ({ start: ranges[index].end, end: range.start }))
}

/** 상태 이름과 다음 일. "쉬는 시간" + "17:00에 다시 열어요" */
export function statusText(status: HoursStatus): { label: string; detail: string | null } {
  switch (status.kind) {
    case "open":
      // 다음이 쉬는 시간이면 "닫아요"라고 하면 오늘 영업이 끝나는 것처럼 들린다
      return { label: t`영업 중`, detail: status.breakNext ? t`${ph({ time: formatTime(status.closesAt) })}부터 쉬어요` : t`${ph({ time: formatTime(status.closesAt) })}에 닫아요` }
    case "break":
      return { label: t`쉬는 시간`, detail: t`${ph({ time: formatTime(status.reopensAt) })}에 다시 열어요` }
    case "beforeOpen":
      return { label: t`준비 중`, detail: t`${ph({ time: formatTime(status.opensAt) })}에 열어요` }
    case "closed": {
      const label = status.closedToday ? t`오늘 휴무` : t`영업 종료`
      if (!status.next) return { label, detail: null }
      const when = status.next.dayOffset === 1 ? t`내일` : legacyT(DAY_NAMES[status.next.day])
      return { label, detail: t`${when} ${ph({ time: formatTime(status.next.opensAt) })}에 열어요` }
    }
  }
}
