import type { Shop } from "@raota/shared"

import { nearestShops } from "@/src/domain/shops"

export interface FirstTicketPick<T extends Shop> {
  /** 순위순 후보. 위치가 있으면 거리(distanceM)를 다시 잰 매장이다 */
  ranked: T[]
  /** 고른 국물의 매장이 있어 그 안에서 골랐는지. 없으면 전체 라멘집으로 넓혔다 */
  soupMatched: boolean
  /** 지금 영업 중인 곳만 남겼는지 */
  openOnly: boolean
}

const byPopularity = (a: Shop, b: Shop) => b.reviewCount - a.reviewCount || b.rating - a.rating

/**
 * 처음 켠 비회원의 첫 식권. 서버 AI 추천은 회원만 쓸 수 있어 앱이 고른다(AI가 골랐다고 쓰지 않는다).
 * 고른 국물 → 지금 영업 중 → (위치가 있으면) 가까운 순, 없으면 라멘로그·평점이 많은 순.
 * 국물이나 영업 중으로 좁혀 아무것도 안 남으면 그 조건은 넓힌다.
 */
export function pickFirstTicket<T extends Shop>(
  shops: readonly T[],
  matchesSoup: (shop: T) => boolean,
  origin: { latitude: number; longitude: number } | null,
): FirstTicketPick<T> {
  const placed = shops.filter((shop) => shop.lat && shop.lng)
  const soupPool = placed.filter(matchesSoup)
  const soupMatched = soupPool.length > 0
  const pool = soupMatched ? soupPool : placed
  const openPool = pool.filter((shop) => shop.isOpen)
  const openOnly = openPool.length > 0
  const candidates = openOnly ? openPool : pool
  const ranked = origin
    ? [...nearestShops(candidates, origin)].sort((a, b) => a.distanceM - b.distanceM || byPopularity(a, b))
    : [...candidates].sort(byPopularity)
  return { ranked, soupMatched, openOnly }
}
