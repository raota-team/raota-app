import type { TasteScores } from "../types"
import { DEMO_MONTHLY_RECORD_COUNTS, DEMO_TYPE_COUNTS } from "./demoProfile"
import { findShopByName } from "./shops"

/** 원장 계산에 필요한 기록의 최소 모양. 웹과 앱의 기록 타입이 모두 만족한다. */
export interface BowlLogLike {
  visitedAt: string
  shop: { name: string }
  ramenType: string
  menuName: string
}

/**
 * 데모 계정이 먹은 42그릇 하나하나의 원장.
 * 월별 그릇 수는 DEMO_MONTHLY_RECORD_COUNTS, 종류별 합계는 DEMO_TYPE_COUNTS와 같아야 한다.
 * 마이 화면(방문 매장, 캘린더, 최근 기록), 월별 리포트, 종합 리포트가 모두 여기서 계산한다.
 */
export interface DemoBowl {
  /** YYYY-MM-DD */
  date: string
  shop: string
  /** RAMEN_TYPES 중 하나 */
  type: string
  menu: string
}

const bowl = (date: string, shop: string, type: string, menu: string): DemoBowl => ({ date, shop, type, menu })

export const DEMO_BOWLS: DemoBowl[] = [
  // 3월 · 4그릇
  bowl('2026-03-08', '하쿠텐', '돈코츠', '이에케 라멘'),
  bowl('2026-03-14', '오레노라멘', '돈코츠', '토리파이탄 라멘'),
  bowl('2026-03-21', '멘지', '돈코츠', '토리파이탄 라멘'),
  bowl('2026-03-28', '멘야준', '쇼유', '특제 쇼유 라멘'),
  // 4월 · 5그릇
  bowl('2026-04-04', '멘지', '돈코츠', '토리파이탄 라멘'),
  bowl('2026-04-11', '멘야준', '쇼유', '특제 쇼유 라멘'),
  bowl('2026-04-18', '담택', '시오', '유자 시오 라멘'),
  bowl('2026-04-25', '오레노라멘', '돈코츠', '토리파이탄 라멘'),
  bowl('2026-04-29', '멘야준', '아부라소바', '아부라소바'),
  // 5월 · 7그릇
  bowl('2026-05-02', '오레노라멘', '돈코츠', '토리파이탄 라멘'),
  bowl('2026-05-09', '이리에라멘', '시오', '도미 시오 라멘'),
  bowl('2026-05-15', '후쿠 라멘', '미소', '삿포로 미소 라멘'),
  bowl('2026-05-17', '멘야준', '아부라소바', '아부라소바'),
  bowl('2026-05-23', '하쿠텐', '돈코츠', '이에케 라멘'),
  bowl('2026-05-27', '담택', '시오', '유자 시오 라멘'),
  bowl('2026-05-30', '무타히로', '츠케멘', '니보시 츠케멘'),
  // 6월 · 7그릇
  bowl('2026-06-03', '하쿠텐', '돈코츠', '이에케 라멘'),
  bowl('2026-06-07', '멘야준', '쇼유', '특제 쇼유 라멘'),
  bowl('2026-06-12', '부탄츄', '돈코츠', '돈코츠 라멘'),
  bowl('2026-06-16', '하쿠텐', '돈코츠', '이에케 라멘'),
  bowl('2026-06-20', '멘야준', '쇼유', '특제 쇼유 라멘'),
  bowl('2026-06-25', '하쿠텐', '돈코츠', '이에케 라멘'),
  bowl('2026-06-28', '무타히로', '츠케멘', '니보시 츠케멘'),
  // 7월 · 9그릇
  bowl('2026-07-02', '라멘베라보', '쇼유', '특제 쇼유 라멘'),
  bowl('2026-07-05', '하쿠텐', '돈코츠', '이에케 라멘'),
  bowl('2026-07-09', '세상끝의라멘', '쇼유', '끝라멘'),
  bowl('2026-07-12', '라멘베라보', '쇼유', '특제 쇼유 라멘'),
  bowl('2026-07-16', '담택', '시오', '유자 시오 라멘'),
  bowl('2026-07-19', '세상끝의라멘', '쇼유', '끝라멘'),
  bowl('2026-07-23', '후쿠 라멘', '미소', '삿포로 미소 라멘'),
  bowl('2026-07-26', '라멘베라보', '쇼유', '특제 쇼유 라멘'),
  bowl('2026-07-30', '하쿠텐', '돈코츠', '이에케 라멘'),
  // 8월 · 8그릇
  bowl('2026-08-02', '담택', '시오', '유자 시오 라멘'),
  bowl('2026-08-06', '이리에라멘', '시오', '도미 시오 라멘'),
  bowl('2026-08-10', '하쿠텐', '돈코츠', '이에케 라멘'),
  bowl('2026-08-14', '묘코', '쇼유', '오리 청탕 쇼유 라멘'),
  bowl('2026-08-15', '후쿠 라멘', '미소', '삿포로 미소 라멘'),
  bowl('2026-08-19', '이리에라멘', '시오', '도미 시오 라멘'),
  bowl('2026-08-22', '멘야준', '쇼유', '특제 쇼유 라멘'),
  bowl('2026-08-28', '담택', '시오', '유자 시오 라멘'),
  // 9월 · 2그릇 (집계 중)
  bowl('2026-09-03', '세상끝의라멘', '쇼유', '끝라멘'),
  bowl('2026-09-10', '후쿠 라멘', '미소', '삿포로 미소 라멘'),
]

/** 월별 분포에 쓰는 종류. 그 밖의 종류(츠케멘, 아부라소바 등)는 기타로 센다. */
export const MENU_CATEGORY_NAMES = ['돈코츠', '쇼유', '시오', '미소', '기타'] as const
export type MenuCategoryName = (typeof MENU_CATEGORY_NAMES)[number]

export function menuCategoryOf(type: string): MenuCategoryName {
  return (MENU_CATEGORY_NAMES as readonly string[]).includes(type) && type !== '기타' ? (type as MenuCategoryName) : '기타'
}

/** 'YYYY-MM-DD' 또는 'YYYY. MM. DD' → 'YYYY-MM-DD'. 못 읽으면 null */
export function isoDate(value: string): string | null {
  const match = value.match(/(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/)
  if (!match) return null
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
}

/** 이번 세션에 남긴 기록을 원장과 같은 모양으로 바꾼다. 날짜를 못 읽으면 제외한다. */
export function bowlFromLog(log: BowlLogLike): DemoBowl | null {
  const date = isoDate(log.visitedAt)
  if (!date) return null
  return { date, shop: log.shop.name, type: log.ramenType, menu: log.menuName }
}

export function bowlsFromLogs(logs: BowlLogLike[]): DemoBowl[] {
  return logs.map(bowlFromLog).filter((item): item is DemoBowl => item !== null)
}

export const monthKeyOfDate = (date: string) => date.slice(0, 7)

export function bowlsInMonth(bowls: DemoBowl[], monthKey: string) {
  return bowls.filter(item => monthKeyOfDate(item.date) === monthKey)
}

/** 종류별 그릇 수. 합계는 bowls.length와 같다. */
export function typeCountsOf(bowls: DemoBowl[]): Record<MenuCategoryName, number> {
  const counts = Object.fromEntries(MENU_CATEGORY_NAMES.map(name => [name, 0])) as Record<MenuCategoryName, number>
  for (const item of bowls) counts[menuCategoryOf(item.type)]++
  return counts
}

export interface StyleRow {
  name: string
  count: number
  pct: number
  note?: string
}

/** 종류별 행. count 합계는 bowls.length, pct는 그릇 수 기준 반올림이다. 0그릇인 종류는 뺀다. */
export function styleRowsOf(bowls: DemoBowl[], notes: Partial<Record<MenuCategoryName, string>> = {}): StyleRow[] {
  const counts = typeCountsOf(bowls)
  const total = bowls.length
  return MENU_CATEGORY_NAMES.filter(name => counts[name] > 0).map(name => ({
    name,
    count: counts[name],
    pct: total ? Math.round((counts[name] / total) * 100) : 0,
    note: notes[name],
  }))
}

export interface ShopVisit {
  name: string
  branch?: string
  style: string
  photo?: string
  visitCount: number
  lastVisited: string
  /** 가장 많이 먹은 메뉴 */
  topMenu: string
  /** 그 매장에서 가장 많이 먹은 종류 */
  topType: MenuCategoryName
}

/** 매장별 방문 수. visitCount 합계는 bowls.length와 같다. 방문 많은 순, 같으면 최근 순. */
export function shopVisitsOf(bowls: DemoBowl[]): ShopVisit[] {
  const map = new Map<string, { bowls: DemoBowl[] }>()
  for (const item of bowls) {
    const entry = map.get(item.shop) ?? { bowls: [] }
    entry.bowls.push(item)
    map.set(item.shop, entry)
  }
  return [...map.entries()].map(([name, { bowls: visits }]) => {
    const catalog = findShopByName(name)
    const menuCounts = new Map<string, number>()
    for (const visit of visits) menuCounts.set(visit.menu, (menuCounts.get(visit.menu) ?? 0) + 1)
    const topMenu = [...menuCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
    const typeCounts = typeCountsOf(visits)
    const topType = MENU_CATEGORY_NAMES.reduce((best, current) => (typeCounts[current] > typeCounts[best] ? current : best), MENU_CATEGORY_NAMES[0])
    return {
      name: catalog?.name ?? name,
      branch: catalog?.branch,
      style: catalog?.style ?? '라멘',
      photo: catalog?.photos[0],
      visitCount: visits.length,
      lastVisited: [...visits.map(visit => visit.date)].sort().reverse()[0] ?? '',
      topMenu,
      topType,
    }
  }).sort((a, b) => b.visitCount - a.visitCount || b.lastVisited.localeCompare(a.lastVisited))
}

/** 하루도 빠지지 않고 이어서 기록한 최장 일수 */
export function longestStreak(bowls: DemoBowl[]): number {
  const days = [...new Set(bowls.map(item => item.date))].sort()
  let best = days.length ? 1 : 0
  let run = 1
  for (let index = 1; index < days.length; index++) {
    const gap = (Date.parse(days[index]) - Date.parse(days[index - 1])) / 86400000
    run = gap === 1 ? run + 1 : 1
    best = Math.max(best, run)
  }
  return best
}

/** 지난 달들의 월별 리포트. 그릇 수와 분포는 DEMO_BOWLS에서 계산한다. */
export interface PastReportItem {
  id: string
  /** YYYY-MM */
  monthKey: string
  /** '2026년 8월' */
  period: string
  recordCount: number
  /** 그 달의 5축 평균 */
  scores: TasteScores
  styleRows: StyleRow[]
  topShops: ShopVisit[]
  /** 그 달을 한 줄로 요약한 편집 문장 */
  note: string
}

interface MonthReportSource {
  monthKey: string
  scores: TasteScores
  note: string
  rowNotes?: Partial<Record<MenuCategoryName, string>>
}

const periodOf = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number)
  return `${year}년 ${month}월`
}

const MONTH_REPORT_SOURCES: MonthReportSource[] = [
  {
    monthKey: '2026-06',
    scores: { satisfaction: 4.2, brothDensity: 4.4, noodleFirmness: 4.1, topping: 4.0, revisit: 3.6 },
    note: '하쿠텐의 이에케와 부탄츄의 돈코츠까지, 진한 돼지뼈 육수를 집중해서 먹은 달이에요.',
    rowNotes: { 돈코츠: '이에케 · 하카타식', 쇼유: '자가제면 쇼유', 기타: '니보시 츠케멘' },
  },
  {
    monthKey: '2026-07',
    scores: { satisfaction: 4.3, brothDensity: 3.8, noodleFirmness: 4.0, topping: 4.2, revisit: 3.8 },
    note: '라멘베라보와 세상끝의라멘을 오가며 간장 타레의 깊이를 비교한 달이에요.',
    rowNotes: { 쇼유: '숙성 간장 · 블랙 쇼유', 돈코츠: '이에케', 시오: '유자 시오', 미소: '삿포로 미소' },
  },
  {
    monthKey: '2026-08',
    scores: { satisfaction: 4.4, brothDensity: 3.3, noodleFirmness: 3.9, topping: 4.1, revisit: 3.7 },
    note: '담택과 이리에라멘의 맑은 닭·도미 청탕을 자주 찾으며 가벼운 쪽으로 기운 달이에요.',
    rowNotes: { 시오: '유자 시오 · 도미 시오', 쇼유: '오리 청탕 · 자가제면', 돈코츠: '이에케', 미소: '삿포로 미소' },
  },
]

export const PAST_REPORTS: PastReportItem[] = MONTH_REPORT_SOURCES.map(source => {
  const bowls = bowlsInMonth(DEMO_BOWLS, source.monthKey)
  return {
    id: source.monthKey,
    monthKey: source.monthKey,
    period: periodOf(source.monthKey),
    recordCount: bowls.length,
    scores: source.scores,
    styleRows: styleRowsOf(bowls, source.rowNotes),
    topShops: shopVisitsOf(bowls).slice(0, 3),
    note: source.note,
  }
})

// 원장이 demoProfile과 어긋나면 콘솔에 바로 알린다.
{
  const monthly = new Map<string, number>()
  for (const item of DEMO_BOWLS) monthly.set(monthKeyOfDate(item.date), (monthly.get(monthKeyOfDate(item.date)) ?? 0) + 1)
  for (const [key, count] of Object.entries(DEMO_MONTHLY_RECORD_COUNTS)) {
    if (monthly.get(key) !== count) console.error(`[tasteReports] ${key} 그릇 수 불일치: 원장 ${monthly.get(key) ?? 0} vs demoProfile ${count}`)
  }
  const types = typeCountsOf(DEMO_BOWLS)
  for (const [name, count] of Object.entries(DEMO_TYPE_COUNTS)) {
    if (types[name as MenuCategoryName] !== count) console.error(`[tasteReports] ${name} 종류 수 불일치: 원장 ${types[name as MenuCategoryName]} vs demoProfile ${count}`)
  }
}
