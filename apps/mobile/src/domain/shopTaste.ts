import { scoresFromLog, type RamenLog } from "@raota/shared"

/**
 * 가게 상세의 "이 가게의 맛". 여러 사람의 공개 라멘로그를 한 문장과 근거 칩으로 줄인다.
 * 문장은 지어내지 않고, 기록들이 가장 많이 기운 쪽(진한·맑은·중간 등)을 정해진 말로 잇는다.
 */

export interface ShopTasteChip {
  /** "#진한 육수" */
  label: string
  /** "65%" 또는 "4.2" */
  value: string
}

export interface ShopTasteSummary {
  count: number
  /** 첫 줄에서 파랗게 강조할 두 마디와 그 사이 글 */
  broth: string
  noodle: string
  /** 둘째 줄: "또 찾는 사람이 많은 집" */
  closing: string
  satisfaction: number
  chips: ShopTasteChip[]
}

type Lean = "high" | "mid" | "low"

const percent = (part: number, total: number) => `${Math.round((part / total) * 100)}%`

/** 1~2점은 낮은 쪽, 3점은 가운데, 4~5점은 높은 쪽. 가장 많은 쪽과 그 몫을 고른다(같으면 가운데 → 높은 쪽 순) */
function leanOf(values: number[]): { lean: Lean; count: number } {
  const counts = { high: 0, mid: 0, low: 0 }
  for (const value of values) {
    if (value >= 3.5) counts.high++
    else if (value <= 2.5) counts.low++
    else counts.mid++
  }
  const order: Lean[] = ["mid", "high", "low"]
  const lean = order.reduce((best, next) => (counts[next] > counts[best] ? next : best), "mid" as Lean)
  return { lean, count: counts[lean] }
}

const BROTH: Record<Lean, string> = { high: "진한 육수", mid: "적당한 농도의 육수", low: "맑은 육수" }
const BROTH_CHIP: Record<Lean, string> = { high: "#진한 육수", mid: "#중간 농도", low: "#맑은 육수" }
const NOODLE: Record<Lean, string> = { high: "단단한 면", mid: "알맞게 삶은 면", low: "부드러운 면" }
const NOODLE_CHIP: Record<Lean, string> = { high: "#단단한 면", mid: "#중간 면", low: "#부드러운 면" }
const TOPPING_CHIP: Record<Lean, string> = { high: "#토핑 훌륭", mid: "#토핑 보통", low: "#토핑 아쉬움" }

const REVISIT: Record<RamenLog["revisit"], { closing: string; chip: string }> = {
  "자주 감": { closing: "또 찾는 사람이 많은 집", chip: "#또 갈래요" },
  "가끔 생각남": { closing: "가끔 생각나는 집", chip: "#가끔 생각나요" },
  "한번이면 충분": { closing: "한 번쯤 가 볼 만한 집", chip: "#한 번이면 충분" },
}

export function shopTasteSummaryOf(logs: readonly RamenLog[]): ShopTasteSummary | null {
  const rated = logs.flatMap((log) => {
    const scores = scoresFromLog(log)
    return scores ? [{ scores, revisit: log.revisit }] : []
  })
  const total = rated.length
  if (total === 0) return null

  const broth = leanOf(rated.map(({ scores }) => scores.brothDensity))
  const noodle = leanOf(rated.map(({ scores }) => scores.noodleFirmness))
  const topping = leanOf(rated.map(({ scores }) => scores.topping))
  const revisitCounts = new Map<RamenLog["revisit"], number>()
  for (const { revisit } of rated) revisitCounts.set(revisit, (revisitCounts.get(revisit) ?? 0) + 1)
  // 같은 수면 더 다시 가고 싶은 쪽을 고른다
  const revisit = (["자주 감", "가끔 생각남", "한번이면 충분"] as const).reduce((best, next) =>
    (revisitCounts.get(next) ?? 0) > (revisitCounts.get(best) ?? 0) ? next : best,
  )
  const satisfaction = Math.round((rated.reduce((sum, { scores }) => sum + scores.satisfaction, 0) / total) * 10) / 10

  return {
    count: total,
    broth: BROTH[broth.lean],
    noodle: NOODLE[noodle.lean],
    closing: REVISIT[revisit].closing,
    satisfaction,
    chips: [
      { label: BROTH_CHIP[broth.lean], value: percent(broth.count, total) },
      { label: NOODLE_CHIP[noodle.lean], value: percent(noodle.count, total) },
      { label: TOPPING_CHIP[topping.lean], value: percent(topping.count, total) },
      { label: REVISIT[revisit].chip, value: percent(revisitCounts.get(revisit) ?? 0, total) },
    ],
  }
}
