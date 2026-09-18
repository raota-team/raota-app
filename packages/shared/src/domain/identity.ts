import type { TasteAxisKey, TasteProfile } from "../types"
import { TASTE_AXES } from "./taste"
import { MENU_CATEGORY_NAMES, bowlsFromLogs, typeCountsOf, type BowlLogLike, type MenuCategoryName } from "./ledger"

/** 누적 종류 분포 = 기존 원장 + 이번 세션 기록 */
export function typeCountsWithLogs(base: Record<string, number>, logs: BowlLogLike[]): Record<MenuCategoryName, number> {
  const counts = typeCountsOf(bowlsFromLogs(logs))
  for (const name of MENU_CATEGORY_NAMES) counts[name] += base[name] ?? 0
  return counts
}

export const DENSE_BROTH_THRESHOLD = 3.5

const TYPE_WORD: Record<MenuCategoryName, string> = {
  돈코츠: '돈골파',
  쇼유: '쇼유파',
  시오: '시오파',
  미소: '미소파',
  기타: '탐험파',
}

export interface TasteIdentity {
  /** '진한 돈골파' */
  title: string
  /** 한 줄 설명 */
  description: string
  /** 판정 근거. 예: 누적 42그릇 중 돈코츠 14그릇 · 육수 농도 평균 3.9 */
  evidence: string
  tags: string[]
  leader: { name: MenuCategoryName; count: number } | null
  dense: boolean
  total: number
}

/**
 * 취향 정체성. 가장 많이 먹은 종류와 육수 농도 평균(3.5 이상이면 진한 쪽)으로만 정한다.
 * scope는 근거 문장의 앞머리("누적", "8월")다.
 */
export function tasteIdentity(typeCounts: Record<string, number>, profile: TasteProfile, scope = '누적'): TasteIdentity {
  const total = MENU_CATEGORY_NAMES.reduce((sum, name) => sum + (typeCounts[name] ?? 0), 0)
  const leaderName = MENU_CATEGORY_NAMES.reduce((best, name) => ((typeCounts[name] ?? 0) > (typeCounts[best] ?? 0) ? name : best), MENU_CATEGORY_NAMES[0])
  const leader = total > 0 ? { name: leaderName, count: typeCounts[leaderName] ?? 0 } : null
  const dense = profile.scores.brothDensity >= DENSE_BROTH_THRESHOLD
  const brothWord = dense ? '진한' : '맑은'
  if (!leader || profile.count === 0) {
    return {
      title: '아직 취향을 모으는 중',
      description: '첫 그릇을 기록하면 어떤 라멘을 좋아하는지 보여드려요.',
      evidence: `${scope} 0그릇`,
      tags: [],
      leader: null,
      dense,
      total,
    }
  }
  const firmness = profile.scores.noodleFirmness >= 3.5 ? '단단한 면' : '부드러운 면'
  const tags = [`${brothWord} 육수`, firmness]
  if (profile.scores.revisit >= 4) tags.push('단골형')
  else if (profile.scores.topping >= 4) tags.push('토핑 중시')
  return {
    title: `${brothWord} ${TYPE_WORD[leader.name]}`,
    description: `${leader.name}를 가장 많이 먹었고, 육수는 ${brothWord} 쪽을 좋아해요.`,
    evidence: `${scope} ${total}그릇 중 ${leader.name} ${leader.count}그릇 · 육수 농도 평균 ${profile.scores.brothDensity.toFixed(1)}`,
    tags,
    leader,
    dense,
    total,
  }
}

export interface MetricItem {
  key: TasteAxisKey
  label: string
  /** 1~5점 */
  score: number
  /** 0~1, 레이더 반지름 비율 */
  myVal: number
}

/** 5축 평균을 레이더와 막대에 쓰는 모양으로 바꾼다. 순서는 TASTE_AXES와 같다. */
export function metricsFromProfile(profile: TasteProfile): MetricItem[] {
  return TASTE_AXES.map(axis => {
    const score = Math.max(0, Math.min(5, profile.scores[axis.key]))
    return { key: axis.key, label: axis.label, score, myVal: score / 5 }
  })
}

/** 가장 높은 두 축. 예: 전체 만족도 4.3 · 토핑 4.1 */
export function strongestAxes(metrics: MetricItem[], count = 2) {
  return [...metrics].sort((a, b) => b.score - a.score).slice(0, count)
}

// ----------------------------------------------------
// 라멘 활동 등급 (공개 라멘로그 수 기준)
// ----------------------------------------------------
export interface RamenActivityLevel {
  min: number
  title: string
  nextTarget: number | null
  desc: string
}

export const RAMEN_ACTIVITY_LEVELS: RamenActivityLevel[] = [
  { min: 0, title: '라멘 입문자', nextTarget: 1, desc: '첫 기록 전' },
  { min: 1, title: '라멘을 즐기는 자', nextTarget: 10, desc: '라멘로그 1그릇 이상' },
  { min: 10, title: '라멘집 탐험가', nextTarget: 30, desc: '라멘로그 10그릇 이상' },
  { min: 30, title: '라멘집 단골', nextTarget: 50, desc: '라멘로그 30그릇 이상' },
  { min: 50, title: '라멘 미식가', nextTarget: 100, desc: '라멘로그 50그릇 이상' },
  { min: 100, title: '라멘 마스터', nextTarget: null, desc: '라멘로그 100그릇 이상' },
]

export const getRamenActivityLevel = (logCount: number) => {
  let index = 0
  RAMEN_ACTIVITY_LEVELS.forEach((level, position) => { if (logCount >= level.min) index = position })
  const current = RAMEN_ACTIVITY_LEVELS[index]
  const nextLevel = current.nextTarget ? RAMEN_ACTIVITY_LEVELS.find(level => level.min === current.nextTarget) ?? null : null
  const progress = current.nextTarget
    ? Math.min(100, ((logCount - current.min) / (current.nextTarget - current.min)) * 100)
    : 100
  return { ...current, number: index + 1, nextLevel, progress: Math.max(0, progress) }
}
