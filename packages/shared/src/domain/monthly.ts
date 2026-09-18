import {
  MENU_CATEGORY_NAMES,
  bowlsFromLogs,
  bowlsInMonth,
  menuCategoryOf,
  styleRowsOf,
  type BowlLogLike,
  type PastReportItem,
} from "./ledger"

export const MONTHLY_REPORT_TARGET = 3

export function recordMonthKey(date: string) {
  const match = date.match(/^(\d{4})[.\-/]\s*(\d{1,2})[.\-/]/)
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) return null
  return `${match[1]}-${match[2].padStart(2, '0')}`
}

/** 서울 기준 오늘. 기기 시간대와 무관하게 'YYYY-MM-DD'를 돌려준다. */
export function seoulToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export const seoulMonthKey = (now = new Date()) => seoulToday(now).slice(0, 7)

export function monthlyReportStatus(counts: Record<string, number>, now = new Date()) {
  const today = seoulToday(now)
  const [year, month, day] = today.split('-').map(Number)
  const key = today.slice(0, 7)
  const count = Math.max(0, counts[key] ?? 0)
  const remaining = Math.max(0, MONTHLY_REPORT_TARGET - count)
  const daysLeft = Math.round((Date.UTC(year, month, 1) - Date.UTC(year, month - 1, day)) / 86400000)
  return { key, month, count, remaining, daysLeft, publishMonth: (month % 12) + 1, progress: Math.min(1, count / MONTHLY_REPORT_TARGET) }
}

/** 월별 분포 차트가 받는 최소 모양. PastReportItem과 집계 중인 달이 모두 이 모양이다. */
export interface DistributionSource {
  id: string
  /** '2026년 8월' */
  period: string
  styleRows: { name: string; count: number }[]
}

/**
 * 종류별 분포. 순서는 MENU_CATEGORY_NAMES로 고정해 달을 바꿔도 흔들리지 않는다.
 * pct는 라벨 합이 100%가 되도록 나머지를 소수부가 큰 순서로 나눈다. 색은 각 플랫폼이 이름으로 붙인다.
 */
export function menuDistribution(source: DistributionSource | undefined) {
  const counts = MENU_CATEGORY_NAMES.map(() => 0)
  for (const row of source?.styleRows ?? []) {
    const index = MENU_CATEGORY_NAMES.indexOf(menuCategoryOf(row.name))
    if (Number.isFinite(row.count) && row.count > 0) counts[index] += row.count
  }
  const total = counts.reduce((sum, count) => sum + count, 0)
  const shares = counts.map(count => (total ? (count / total) * 100 : 0))
  const percentages = shares.map(Math.floor)
  const remainder = total ? 100 - percentages.reduce((sum, value) => sum + value, 0) : 0
  const ranked = shares
    .map((value, index) => ({ index, fraction: value - percentages[index] }))
    .sort((a, b) => b.fraction - a.fraction)
  for (let index = 0; index < remainder; index++) percentages[ranked[index].index]++
  return {
    total,
    items: MENU_CATEGORY_NAMES.map((name, index) => ({ name, count: counts[index], share: shares[index], pct: percentages[index] })),
  }
}


export function reportMonthIndex(report: DistributionSource) {
  const [year, month] = report.period.match(/\d+/g)?.map(Number) ?? []
  return year * 12 + month - 1
}

export function chronologicalReports<T extends DistributionSource>(reports: T[]) {
  return [...reports].sort((a, b) => reportMonthIndex(a) - reportMonthIndex(b))
}

export function shortReportMonth(report: DistributionSource, includeYear = false) {
  const parts = report.period.split(' ')
  return includeYear ? report.period : parts[parts.length - 1]
}

/** 집계 중인 이번 달. 지난 달 리포트와 같은 모양이라 분포 차트가 그대로 받는다. */
export interface CurrentMonthReport extends DistributionSource {
  monthKey: string
  inProgress: true
  /** 이번 달 실제 기록 수(App의 monthlyRecordCounts) */
  recordCount: number
  /** 종류가 확인된 그릇 수. recordCount보다 작으면 나머지는 이 화면에 종류가 전달되지 않은 기록이다. */
  typedCount: number
}

export const CURRENT_MONTH_ID = 'current-month'

/**
 * 이번 달을 만든다. 데모 원장(past 리포트에 이미 담긴 달 제외)에 있는 이번 달 그릇과
 * 이번 세션에 남긴 기록을 합친다. 기록이 하나도 없으면 null.
 */
export function currentMonthReport(
  monthlyRecordCounts: Record<string, number>,
  ownedLogs: BowlLogLike[],
  demoBowls: Parameters<typeof bowlsInMonth>[0],
  now = new Date(),
): CurrentMonthReport | null {
  const monthKey = seoulMonthKey(now)
  const recordCount = monthlyRecordCounts[monthKey] ?? 0
  if (recordCount <= 0) return null
  const bowls = [...bowlsInMonth(demoBowls, monthKey), ...bowlsInMonth(bowlsFromLogs(ownedLogs), monthKey)]
  const [year, month] = monthKey.split('-').map(Number)
  return {
    id: CURRENT_MONTH_ID,
    monthKey,
    period: `${year}년 ${month}월`,
    inProgress: true,
    recordCount,
    typedCount: Math.min(recordCount, bowls.length),
    styleRows: styleRowsOf(bowls),
  }
}

export const isPastReport = (report: DistributionSource): report is PastReportItem => 'topShops' in report
