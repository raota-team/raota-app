import type { RevisitOption, TasteAxisKey, TasteProfile, TasteScores } from "../types"

/** 기록 화면, 완료 화면, 취향 리포트가 함께 쓰는 5축 정의 */
export const TASTE_AXES: Array<{ key: TasteAxisKey; label: string; low: string; high: string }> = [
  { key: "satisfaction", label: "전체 만족도", low: "아쉬움", high: "최고" },
  { key: "brothDensity", label: "육수 농도", low: "맑음", high: "진함" },
  { key: "noodleFirmness", label: "면 삶기", low: "부드럽게", high: "단단하게" },
  { key: "topping", label: "토핑", low: "아쉬움", high: "훌륭함" },
  { key: "revisit", label: "재방문 의사", low: "한 번이면 충분", high: "자주 갈래요" },
]

export const REVISIT_SCORE: Record<RevisitOption, number> = {
  "자주 감": 5,
  "가끔 생각남": 3,
  "한번이면 충분": 1,
}

/** 5축 계산에 필요한 기록의 최소 모양. 웹과 앱의 RamenLog가 모두 만족한다. */
export interface TasteLogLike {
  scores?: TasteScores
  revisit: RevisitOption
}

/** 1~5 사이의 유한한 점수 다섯 개인지 확인한다. 저장소 복구에도 쓴다. */
export function isTasteScores(value: unknown): value is TasteScores {
  if (typeof value !== "object" || value === null) return false
  const record = value as Record<string, unknown>
  return TASTE_AXES.every(({ key }) => {
    const score = record[key]
    return typeof score === "number" && Number.isFinite(score) && score >= 1 && score <= 5
  })
}

export function scoresFromLog(log: TasteLogLike): TasteScores | null {
  if (!log.scores) return null
  return { ...log.scores, revisit: REVISIT_SCORE[log.revisit] ?? log.scores.revisit }
}

const round1 = (value: number) => Math.round(value * 10) / 10
const round2 = (value: number) => Math.round(value * 100) / 100

/** 기존 누적 평균에 새 기록들을 더한 평균. 점수가 없는 기록은 건너뛴다. */
export function mergeProfile(base: TasteProfile, logs: TasteLogLike[]): TasteProfile {
  let count = base.count
  const baseScores = base.exact ?? base.scores
  const sums = Object.fromEntries(
    TASTE_AXES.map(({ key }) => [key, baseScores[key] * base.count]),
  ) as TasteScores
  for (const log of logs) {
    const scores = scoresFromLog(log)
    if (!scores) continue
    count++
    for (const { key } of TASTE_AXES) sums[key] += scores[key]
  }
  if (count === 0) return base
  const exact = Object.fromEntries(TASTE_AXES.map(({ key }) => [key, sums[key] / count])) as TasteScores
  return {
    count,
    scores: Object.fromEntries(TASTE_AXES.map(({ key }) => [key, round1(exact[key])])) as TasteScores,
    exact,
  }
}

/** after - before, 반올림 전 평균 기준 소수 둘째 자리. 변화가 없으면 0. */
export function profileDelta(before: TasteProfile, after: TasteProfile): TasteScores {
  const a = after.exact ?? after.scores
  const b = before.exact ?? before.scores
  return Object.fromEntries(
    TASTE_AXES.map(({ key }) => [key, round2(a[key] - b[key])]),
  ) as TasteScores
}

export const EMPTY_PROFILE: TasteProfile = {
  count: 0,
  scores: { satisfaction: 0, brothDensity: 0, noodleFirmness: 0, topping: 0, revisit: 0 },
}
