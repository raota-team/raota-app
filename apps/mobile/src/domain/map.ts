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

export interface MapRegion extends ClusterViewport {
  latitude: number
  longitude: number
}

/** 지도 위에 떠서 가리는 높이(pt). 위는 검색·필터 머리, 아래는 고른 가게 카드 */
export interface MapInsets {
  top: number
  bottom: number
}

/**
 * 묶음을 누르면 갈 자리(사용자 결정, 2026.10.23). 그 묶음의 가게가 머리·카드에 가리지 않는 칸에 모두 들어오는 만큼 확대한다.
 * 묶음은 그만큼 갈라지고, 아주 촘촘한 곳은 작은 숫자로 남아 다시 누르면 마저 풀린다.
 * 한 번에 다 풀 만큼 더 들어가면 묶음 가게 일부가 화면 밖으로 나간다(홍대 13곳: 3배 확대에 5곳이 밖으로).
 * - 적어도 지금의 두 배로 확대하고, 골목 수준(묶지 않는 폭)보다 더 들어가지는 않는다. 같은 건물의 가게는 거기서 갈라진다
 * 경도 1도는 위도 1도보다 cos(위도)만큼 짧아, 세로(위도) 기준으로 맞춘 뒤 가로 폭을 cos로 나눈다.
 */
export function regionToSpread(
  shops: Array<Pick<Shop, "lat" | "lng">>,
  current: ClusterViewport,
  frame: ClusterFrame,
  insets: MapInsets,
): MapRegion {
  const lats = shops.map((shop) => shop.lat)
  const lngs = shops.map((shop) => shop.lng)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const cos = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180)
  // 가장자리 핀이 반쯤 잘리지 않게 사방으로 묶음 거리만큼 비운다
  const usableWidth = Math.max(frame.width - MAP_MERGE_DISTANCE_PT * 2, 1)
  const usableHeight = Math.max(frame.height - insets.top - insets.bottom - MAP_MERGE_DISTANCE_PT * 2, 1)
  const fitted = Math.max((maxLat - minLat) / usableHeight, ((maxLng - minLng) * cos) / usableWidth)
  const atLeastTwice = current.latitudeDelta / frame.height / 2
  const streetLevel = (MAP_CLOSEST_CLUSTER_DELTA * 0.9) / frame.height
  const latitudePerPt = Math.max(Math.min(fitted, atLeastTwice), streetLevel)
  return {
    // 위도가 클수록 화면 위쪽이다. 머리가 가린 만큼 가운데를 북쪽으로 올려 가게들이 보이는 칸 한가운데 오게 한다
    latitude: (minLat + maxLat) / 2 + ((insets.top - insets.bottom) / 2) * latitudePerPt,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: latitudePerPt * frame.height,
    longitudeDelta: (latitudePerPt * frame.width) / cos,
  }
}
