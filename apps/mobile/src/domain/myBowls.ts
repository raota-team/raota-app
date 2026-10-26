import { RAMEN_TYPES, type DemoBowl, type RamenLog, type Shop } from "@raota/shared"

/** 마이·종류별 화면이 그리는 그릇 한 줄. shop은 매장 원장(없을 수 있다), name은 기록에 남은 가게 이름 */
export type BowlRow = Omit<DemoBowl, "shop"> & {
  name: string
  shop?: Shop
  branch?: string
  photo?: string
}

/** 그릇을 화면용 줄로 맞춘다. 사진은 기록 사진이 먼저, 없으면 매장 대표 사진 */
export function toBowlRow(bowl: DemoBowl, myLogs: RamenLog[], shops: Shop[]): BowlRow {
  if (bowl.logId) {
    // 서버 기록: 이름이 같은 지점이 섞이지 않게 기록 id와 매장 id로 맞춘다
    const log = myLogs.find((item) => item.id === bowl.logId)
    const shop = (bowl.shopId ? shops.find((item) => item.id === bowl.shopId) : undefined) ?? shops.find((item) => item.name === bowl.shop)
    const branch = log?.shop.branch ?? myLogs.find((item) => item.shop.id === bowl.shopId)?.shop.branch ?? shop?.branch
    return { ...bowl, shop, branch, name: bowl.shop, photo: log?.imageUrl ?? shop?.photos[0] }
  }
  const shop = shops.find((item) => item.name === bowl.shop)
  const log = myLogs.find((item) => item.shop.name === bowl.shop && item.menuName === bowl.menu)
  return { ...bowl, shop, branch: shop?.branch, name: bowl.shop, photo: log?.imageUrl ?? shop?.photos[0] }
}

/** 보이는 서버 기록 중 아직 안 읽은 내 기록 쪽에 있는 것이 있는가(있으면 다음 쪽을 읽어 사진을 채운다) */
export function needsMoreLogs(rows: BowlRow[], myLogs: RamenLog[]): boolean {
  return rows.some((row) => row.logId && !myLogs.some((log) => log.id === row.logId))
}

/** 기록에 고른 종류. RAMEN_TYPES에 없는 옛 종류는 기타로 본다 */
export function bowlTypeOf(bowl: DemoBowl): string {
  return (RAMEN_TYPES as readonly string[]).includes(bowl.type) ? bowl.type : "기타"
}

/**
 * 기록에 고른 실제 종류(RAMEN_TYPES)별 그릇 수. 많이 먹은 순, 같으면 RAMEN_TYPES 순이고 기타는 늘 마지막.
 * 츠케멘·마제소바처럼 월별 분포에서 기타로 묶이는 종류도 따로 센다.
 */
export function bowlTypes(bowls: DemoBowl[]): { type: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const bowl of bowls) counts.set(bowlTypeOf(bowl), (counts.get(bowlTypeOf(bowl)) ?? 0) + 1)
  const rank = (type: string) => (type === "기타" ? RAMEN_TYPES.length : RAMEN_TYPES.indexOf(type))
  return [...counts]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => Number(a.type === "기타") - Number(b.type === "기타") || b.count - a.count || rank(a.type) - rank(b.type))
}
