import type { Shop } from "@raota/shared"

import { compareShopIds } from "./shops"

export interface MapCluster {
  id: string
  latitude: number
  longitude: number
  shopIds: string[]
}

export interface ClusterViewport {
  latitudeDelta: number
  longitudeDelta: number
}

/** 지도 칸의 크기(pt). 좌표 차이를 화면 거리로 바꿀 때 쓴다 */
export interface ClusterFrame {
  width: number
  height: number
}

/** 화면에서 이보다 가까운 핀은 하나로 묶는다. 묶음 알약(44×36pt)끼리도 겹치지 않고 사이가 조금 남는 거리 */
export const MAP_MERGE_DISTANCE_PT = 56
/**
 * 이만큼(위도 폭) 가까이 보면 묶지 않는다. 같은 건물에 있는 가게는 아무리 확대해도 겹치니,
 * 끝까지 묶으면 영영 하나씩 고를 수 없다.
 */
export const MAP_CLOSEST_CLUSTER_DELTA = 0.004

/**
 * 화면에서 겹칠 만큼 가까운 핀을 묶는다(사용자 결정, 2026.10.23). 확대 수준과 상관없이 같은 기준이라,
 * 한 단계 확대했다고 묶음이 한꺼번에 풀려 핀이 겹겹이 쌓이지 않는다.
 * 매장 ID 순으로 돌며 앞선 묶음의 첫 핀에서 56pt 안이면 그 묶음에 넣는다(사슬처럼 길게 이어 묶지 않는다).
 * 묶음은 첫 핀 자리에 둔다. 가운데(평균)에 두면 이웃 묶음 쪽으로 밀려 서로 겹친다. 첫 핀끼리는 늘 56pt 넘게 떨어져 있다.
 * 같은 확대 수준에서는 늘 같은 묶음이 나온다.
 */
export function calculateMapClusters(
  shops: Array<Pick<Shop, "id" | "lat" | "lng">>,
  viewport: ClusterViewport,
  frame: ClusterFrame,
): MapCluster[] {
  if (shops.length === 0) return []

  const ordered = [...shops].sort((left, right) => compareShopIds(left.id, right.id))
  if (viewport.latitudeDelta <= MAP_CLOSEST_CLUSTER_DELTA || ordered.length === 1) {
    return ordered.map((shop) => ({
      id: `shop-${shop.id}`,
      latitude: shop.lat,
      longitude: shop.lng,
      shopIds: [shop.id],
    }))
  }

  const xPerLongitude = frame.width / viewport.longitudeDelta
  const yPerLatitude = frame.height / viewport.latitudeDelta
  const groups: Array<{ x: number; y: number; items: Array<Pick<Shop, "id" | "lat" | "lng">> }> = []
  for (const shop of ordered) {
    const x = shop.lng * xPerLongitude
    const y = shop.lat * yPerLatitude
    const group = groups.find((candidate) => Math.hypot(candidate.x - x, candidate.y - y) < MAP_MERGE_DISTANCE_PT)
    if (group) group.items.push(shop)
    else groups.push({ x, y, items: [shop] })
  }

  return groups
    .map(({ items }): MapCluster => {
      const shopIds = items.map((shop) => shop.id)
      return {
        id: shopIds.length === 1 ? `shop-${shopIds[0]}` : `cluster-${shopIds.join("-")}`,
        latitude: items[0].lat,
        longitude: items[0].lng,
        shopIds,
      }
    })
    .sort((left, right) =>
      Number(left.shopIds.length === 1) - Number(right.shopIds.length === 1) ||
      compareShopIds(left.shopIds[0], right.shopIds[0]),
    )
}
