import { findShopByName, type DemoBowl, type Shop, type TasteMetric, type TasteProfile, type TasteReport } from "@raota/shared"

/** 큐레이터 랭킹이 단골 가점을 주는 매장 수(취향 리포트의 단골 TOP 3와 같다) */
const TOP_SHOP_COUNT = 3

/**
 * 내 그릇 목록(useMyBowls)과 5축 평균(useTasteProfile)으로 큐레이터 랭킹에 넣을 취향 리포트를 만든다.
 * 저장된 취향 리포트는 마지막으로 갱신한 시점 것이라 지금 그릇 수와 어긋날 수 있어, 화면을 열 때마다 새로 계산한다.
 * 랭킹이 읽는 값(종류 비중, 단골 매장, 국물 농도·면 경도)만 실제 기록으로 채우고, 기록에 없는 축은 넣지 않는다.
 * 기록이 없으면(비회원 포함) null이라 취향을 반영했다고 말하지 않는다.
 */
export function curatorTasteReport(bowls: DemoBowl[], profile: TasteProfile, shops: Shop[]): TasteReport | null {
  if (bowls.length === 0) return null

  const typeCounts: Record<string, number> = {}
  const shopCounts: Record<string, number> = {}
  for (const bowl of bowls) {
    typeCounts[bowl.type] = (typeCounts[bowl.type] ?? 0) + 1
    shopCounts[bowl.shop] = (shopCounts[bowl.shop] ?? 0) + 1
  }
  const styleShares = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([ramenType, count]) => ({ ramenType, count, percentage: Math.round((count / bowls.length) * 100), note: "" }))

  // 원장은 매장 이름으로 남아 있다. 지금 목록(로컬·서버)에서 같은 이름의 매장만 단골로 친다
  const visited = Object.entries(shopCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => {
      const canonical = findShopByName(name)?.name ?? name
      return { shop: shops.find((item) => item.name === canonical), count }
    })
    .filter((entry): entry is { shop: Shop; count: number } => Boolean(entry.shop))
    .slice(0, TOP_SHOP_COUNT)

  // 5축 중 랭킹 지표로 옮길 수 있는 것은 국물 농도와 면 경도뿐이다
  const metrics: TasteMetric[] =
    profile.count > 0
      ? [
          { key: "brothRichness", label: "국물 농도", score: profile.scores.brothDensity, average: profile.scores.brothDensity },
          { key: "noodleFirmness", label: "면 경도", score: profile.scores.noodleFirmness, average: profile.scores.noodleFirmness },
        ]
      : []

  return {
    id: "curator-taste",
    volume: "",
    period: "",
    publishedAt: "",
    title: "",
    levelLabel: "",
    levelNumber: 0,
    quote: "",
    recordCount: bowls.length,
    tags: styleShares.map(({ ramenType }) => ramenType),
    strongestFeature: "",
    metrics,
    insights: [],
    topShops: visited.map(({ shop, count }, index) => ({
      rank: index + 1,
      shopId: shop.id,
      style: shop.tags[0] ?? "",
      mustTry: "",
      reason: "",
      visitCount: count,
    })),
    styleShares,
  }
}
