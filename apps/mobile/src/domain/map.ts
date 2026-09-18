import type { Shop } from "@raota/shared"

export interface MapCluster {
  id: string
  latitude: number
  longitude: number
  shopIds: number[]
}

export interface ClusterViewport {
  latitudeDelta: number
  longitudeDelta: number
}

/**
 * Uses deterministic screen-scale buckets when zoomed out. Nearby shops merge,
 * while shops in another part of the city remain independently selectable.
 */
export function calculateMapClusters(
  shops: Shop[],
  viewport: ClusterViewport,
  aggregateThreshold = 0.075,
): MapCluster[] {
  if (shops.length === 0) return []

  const ordered = [...shops].sort((left, right) => left.id - right.id)
  if (viewport.latitudeDelta <= aggregateThreshold || ordered.length === 1) {
    return ordered.map((shop) => ({
      id: `shop-${shop.id}`,
      latitude: shop.lat,
      longitude: shop.lng,
      shopIds: [shop.id],
    }))
  }

  const minimumLatitude = Math.min(...ordered.map((shop) => shop.lat))
  const minimumLongitude = Math.min(...ordered.map((shop) => shop.lng))
  const latitudeCell = Math.max(viewport.latitudeDelta / 3, 0.005)
  const longitudeCell = Math.max(viewport.longitudeDelta / 3, 0.005)
  const buckets = new Map<string, Shop[]>()

  for (const shop of ordered) {
    const latitudeIndex = Math.floor(
      (shop.lat - minimumLatitude) / latitudeCell,
    )
    const longitudeIndex = Math.floor(
      (shop.lng - minimumLongitude) / longitudeCell,
    )
    const key = `${latitudeIndex}:${longitudeIndex}`
    buckets.set(key, [...(buckets.get(key) ?? []), shop])
  }

  return [...buckets.values()]
    .map((items): MapCluster => {
      const shopIds = items
        .map((shop) => shop.id)
        .sort((left, right) => left - right)
      return {
        id:
          shopIds.length === 1
            ? `shop-${shopIds[0]}`
            : `cluster-${shopIds.join("-")}`,
        latitude: items.reduce((sum, shop) => sum + shop.lat, 0) / items.length,
        longitude:
          items.reduce((sum, shop) => sum + shop.lng, 0) / items.length,
        shopIds,
      }
    })
    .sort((left, right) => left.id.localeCompare(right.id))
}
