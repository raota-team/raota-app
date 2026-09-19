import type { Shop } from "@raota/shared"

/** 네이버 지도 앱에 넘기는 호출 앱 이름(번들 ID) */
export const NAVER_APP_NAME = "com.raota.app"

export interface NaverMapLinks {
  /** 먼저 여는 주소. 매장 ID가 있으면 매장 페이지, 없으면 네이버 지도 앱 검색 */
  primary: string
  /** primary를 열 수 없을 때(앱 없음) 여는 웹 주소. 매장 페이지를 바로 열 때는 없다 */
  fallback?: string
}

/**
 * 매장 상세의 "네이버 지도" 버튼이 여는 주소.
 * - 서버 naver_map_id(네이버 매장 ID)가 있으면 그 매장 페이지(사진·메뉴·리뷰)를 바로 연다.
 *   관리자가 ID 대신 전체 URL을 넣었으면 그 URL을 그대로 쓴다.
 * - 없으면 이름으로 검색한다: 네이버 지도 앱(nmap://) → 없으면 웹 검색.
 */
export function naverMapLinks(shop: Pick<Shop, "name" | "branch" | "naverMapId">): NaverMapLinks {
  const id = shop.naverMapId?.trim()
  if (id) {
    if (/^https?:\/\//.test(id)) return { primary: id }
    return { primary: `https://m.place.naver.com/place/${encodeURIComponent(id)}/home` }
  }
  const query = encodeURIComponent(`${shop.name}${shop.branch ? ` ${shop.branch}` : ""}`)
  return {
    primary: `nmap://search?query=${query}&appname=${NAVER_APP_NAME}`,
    fallback: `https://map.naver.com/p/search/${query}`,
  }
}
