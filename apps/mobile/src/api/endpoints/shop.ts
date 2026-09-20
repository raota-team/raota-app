import { apiClient, type ApiClient } from "../client"
import type { CursorPage, Id, MapPin, ShopDetail, ShopListParams, ShopSummary } from "../types"

/**
 * 매장 목록·지도 핀·상세·찜(#61).
 * 목록과 상세는 비회원도 볼 수 있다(로그인했으면 찜 여부까지 함께 온다 → auth: "optional").
 */
export function createShopApi(client: ApiClient = apiClient) {
  return {
    list(params: ShopListParams = {}): Promise<CursorPage<ShopSummary>> {
      return client.get<CursorPage<ShopSummary>>("/shops", {
        auth: "optional",
        query: {
          sort: params.sort,
          query: params.query,
          region: params.region,
          ramenType: params.ramenType,
          openNow: params.openNow,
          // DISTANCE 정렬에는 위·경도가 둘 다 있어야 한다(서버가 400으로 막는다)
          latitude: params.latitude,
          longitude: params.longitude,
          cursor: params.cursor,
          size: params.size,
        },
      })
    },

    /** 지도에 찍을 전체 매장. 페이지가 없다 */
    mapPins(): Promise<MapPin[]> {
      return client.get<MapPin[]>("/shops/map-pins", { auth: "optional" })
    },

    detail(shopId: Id): Promise<ShopDetail> {
      return client.get<ShopDetail>(`/shops/${encodeURIComponent(shopId)}`, { auth: "optional" })
    },

    /** 찜하기. 이미 찜한 상태여도 성공한다 */
    bookmark(shopId: Id): Promise<void> {
      return client.put<void>(`/shops/${encodeURIComponent(shopId)}/bookmark`)
    },

    /** 찜 해제. 찜한 적이 없어도 성공한다 */
    removeBookmark(shopId: Id): Promise<void> {
      return client.delete<void>(`/shops/${encodeURIComponent(shopId)}/bookmark`)
    },
  } as const
}

export const shopApi = createShopApi()
export type ShopApi = ReturnType<typeof createShopApi>
