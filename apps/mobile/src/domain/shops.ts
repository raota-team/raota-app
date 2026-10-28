import type { Shop, ShopCatalogItem } from "@raota/shared"

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

/** 숫자형 매장 ID는 "10"이 "2"보다 앞서지 않도록 정밀도를 잃지 않고 비교한다. */
export function compareShopIds(left: string, right: string): number {
  if (/^\d+$/.test(left) && /^\d+$/.test(right)) {
    const leftId = BigInt(left)
    const rightId = BigInt(right)
    if (leftId !== rightId) return leftId < rightId ? -1 : 1
  }
  return left.localeCompare(right)
}

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

/**
 * 위치에서 가까운 순. 거리를 다시 재고, 좌표가 없는 매장(서버가 null로 보내 0으로 바뀐 매장)은 뺀다.
 * 거리를 쟀으니 "거리 모름"(unknownFields의 distance) 표시도 지운다.
 * 거리순은 전체 매장으로 재야 한다. 커서로 받은 첫 쪽(20곳)으로 재면 가까운 곳이 빠진다(2026.10.28 QA)
 */
export function nearestShops<T extends Shop>(shops: readonly T[], origin: { latitude: number; longitude: number }): T[] {
  return shops
    .filter((shop) => shop.lat && shop.lng)
    .map((shop) => {
      const distanceM = Math.round(distanceBetweenCoordinates(origin, { latitude: shop.lat, longitude: shop.lng }))
      const unknown = (shop as { unknownFields?: unknown }).unknownFields
      return Array.isArray(unknown)
        ? { ...shop, distanceM, unknownFields: unknown.filter((field) => field !== "distance") }
        : { ...shop, distanceM }
    })
    .sort((a, b) => a.distanceM - b.distanceM)
}

function searchableText(shop: Shop): string {
  return [shop.name, shop.branch, shop.address, shop.description, ...shop.tags]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLocaleLowerCase("ko-KR")
}

/** 서버 종류가 있으면 우선하고, 옛 원장은 대표 스타일로 돈코츠와 이에케를 구분한다. */
export function matchesShopRamenType(
  shop: Shop,
  type: string,
  keys?: readonly string[],
): boolean {
  if ((type === "돈코츠" || type === "이에케") && shop.ramenTypes?.length) {
    return shop.ramenTypes.includes(type)
  }
  const catalog =
    shop as Shop & Partial<Pick<ShopCatalogItem, "style" | "spec">>
  const style = catalog.style?.replace(/\s*라멘$/, "").trim()
  if (
    (type === "돈코츠" || type === "이에케") &&
    (style === "돈코츠" || style === "이에케")
  ) {
    return style === type
  }
  const hasKey = (key: string) =>
    Boolean(
      catalog.style?.includes(key) ||
        catalog.spec?.includes(key) ||
        shop.tags.some((tag) => tag.includes(key)),
    )
  if (type === "돈코츠" && hasKey("이에케")) return false
  return keys ? keys.some(hasKey) : hasKey(type)
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
      !ramenType ||
      ramenType === "전체" ||
      (ramenType === "돈코츠" || ramenType === "이에케"
        ? matchesShopRamenType(shop, ramenType)
        : haystack.includes(ramenType))
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
