import type { Shop } from "@raota/shared"

export type ShopSort = "distance" | "match" | "rating"

export interface ShopFilters {
  query?: string
  ramenType?: string
  area?: string
  openOnly?: boolean
  sort?: ShopSort
  origin?: { latitude: number; longitude: number } | null
}

const EARTH_RADIUS_M = 6_371_000

export function distanceBetweenCoordinates(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180
  const latitudeDelta = radians(to.latitude - from.latitude)
  const longitudeDelta = radians(to.longitude - from.longitude)
  const fromLatitude = radians(from.latitude)
  const toLatitude = radians(to.latitude)
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(haversine))
}

function searchableText(shop: Shop): string {
  return [shop.name, shop.branch, shop.address, shop.description, ...shop.tags]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLocaleLowerCase("ko-KR")
}

export function filterAndSortShops(
  shops: Shop[],
  filters: ShopFilters,
): Shop[] {
  const query = filters.query?.trim().toLocaleLowerCase("ko-KR") ?? ""
  const ramenType = filters.ramenType?.trim().toLocaleLowerCase("ko-KR") ?? ""
  const area = filters.area?.trim().toLocaleLowerCase("ko-KR") ?? ""

  const candidates = filters.origin
    ? shops.map((shop) => ({
        ...shop,
        distanceM: Math.round(
          distanceBetweenCoordinates(filters.origin!, {
            latitude: shop.lat,
            longitude: shop.lng,
          }),
        ),
      }))
    : [...shops]

  const filtered = candidates.filter((shop) => {
    const haystack = searchableText(shop)
    const matchesQuery = !query || haystack.includes(query)
    const matchesType =
      !ramenType || ramenType === "전체" || haystack.includes(ramenType)
    const matchesArea =
      !area ||
      area === "전체 지역" ||
      shop.address.toLocaleLowerCase("ko-KR").includes(area) ||
      Boolean(shop.branch?.toLocaleLowerCase("ko-KR").includes(area))
    const matchesOpen = !filters.openOnly || shop.isOpen

    return matchesQuery && matchesType && matchesArea && matchesOpen
  })

  return filtered.sort((left, right) => {
    if (filters.sort === "match") return right.matchScore - left.matchScore
    if (filters.sort === "rating") return right.rating - left.rating
    return left.distanceM - right.distanceM
  })
}
