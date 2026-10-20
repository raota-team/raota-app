import { scoresFromLog, type RamenLog } from "@raota/shared"

/**
 * 가게 상세의 "이 가게의 맛". 여러 사람의 공개 라멘로그를 모아
 * 재방문 의향(얼마나 또 가고 싶어 하는지)과 네 칸(많이 먹은 메뉴 · 육수 · 면 · 토핑)으로 줄인다.
 * 말은 지어내지 않고, 기록들이 가장 많이 기운 쪽을 정해진 말로 고른다(3.5점 이상 높은 쪽, 2.5점 이하 낮은 쪽, 나머지 가운데).
 */

export interface ShopTasteSummary {
  count: number
  revisit: { often: number; sometimes: number; once: number }
  /** "특제 쇼유 라멘". 같은 수면 먼저 기록된 메뉴 */
  topMenu: string
  /** 그 메뉴를 기록한 수 */
  topMenuCount: number
  broth: string
  noodle: string
  topping: string
}

type Lean = "high" | "mid" | "low"

/** 가장 많은 쪽을 고른다. 같으면 가운데 → 높은 쪽 → 낮은 쪽 순 */
function leanOf(values: number[]): Lean {
  const counts = { high: 0, mid: 0, low: 0 }
  for (const value of values) {
    if (value >= 3.5) counts.high++
    else if (value <= 2.5) counts.low++
    else counts.mid++
  }
  return (["mid", "high", "low"] as const).reduce((best, next) => (counts[next] > counts[best] ? next : best), "mid" as Lean)
}

const BROTH: Record<Lean, string> = { high: "진한 편", mid: "중간", low: "맑은 편" }
const NOODLE: Record<Lean, string> = { high: "단단한 편", mid: "중간", low: "부드러운 편" }
const TOPPING: Record<Lean, string> = { high: "훌륭한 편", mid: "보통", low: "아쉬운 편" }

export function shopTasteSummaryOf(logs: readonly RamenLog[]): ShopTasteSummary | null {
  const rated = logs.flatMap((log) => {
    const scores = scoresFromLog(log)
    return scores ? [{ scores, revisit: log.revisit, menu: log.menuName.trim() }] : []
  })
  if (rated.length === 0) return null

  const revisit = { often: 0, sometimes: 0, once: 0 }
  const menus = new Map<string, number>()
  for (const log of rated) {
    if (log.revisit === "자주 감") revisit.often++
    else if (log.revisit === "가끔 생각남") revisit.sometimes++
    else revisit.once++
    if (log.menu) menus.set(log.menu, (menus.get(log.menu) ?? 0) + 1)
  }
  // Map은 넣은 순서를 지키므로 같은 수면 먼저 나온 메뉴가 남는다
  const [topMenu, topMenuCount] = [...menus.entries()].reduce((best, next) => (next[1] > best[1] ? next : best), ["", 0])

  return {
    count: rated.length,
    revisit,
    topMenu,
    topMenuCount,
    broth: BROTH[leanOf(rated.map(({ scores }) => scores.brothDensity))],
    noodle: NOODLE[leanOf(rated.map(({ scores }) => scores.noodleFirmness))],
    topping: TOPPING[leanOf(rated.map(({ scores }) => scores.topping))],
  }
}
