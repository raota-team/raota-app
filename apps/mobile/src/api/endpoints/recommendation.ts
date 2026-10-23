import { apiClient, type ApiClient } from "../client"
import type { RecommendationRequest, RecommendationResponse, TodayCuration, TodayRecommendations } from "../types"

/**
 * AI 추천과 오늘의 큐레이션(#46).
 * 추천은 1분에 10번(429 RATE_LIMITED), 하루 식권 수(기본 3장)를 넘으면 429 DAILY_LIMIT_EXCEEDED이고,
 * 만들지 못하면 503 RECOMMENDATION_UNAVAILABLE이 온다. 그때는 화면이 인기·거리순으로 내려간다.
 */
export function createRecommendationApi(client: ApiClient = apiClient) {
  return {
    /** 서버가 검색을 20초까지 기다리므로 기본 15초보다 길게 기다린다. 짧으면 서버 답보다 앱 시간 초과가 먼저 난다 */
    recommend(body: RecommendationRequest): Promise<RecommendationResponse> {
      return client.post<RecommendationResponse>("/ai/recommendations", body, { timeoutMs: 25_000 })
    },

    /** 오늘 뽑은 식권(최신순)과 남은 장수. 로그인한 회원만 */
    todayTickets(): Promise<TodayRecommendations> {
      return client.get<TodayRecommendations>("/ai/recommendations/today")
    },

    /** 추천 결과에서 매장을 열었다고 알린다(204). 처음 연 시각만 남고, 내 추천이 아니거나 그 추천에 없는 매장이면 404 */
    markOpened(recommendationId: string, shopId: string): Promise<void> {
      return client.post<void>(
        `/ai/recommendations/${encodeURIComponent(recommendationId)}/shops/${encodeURIComponent(shopId)}/open`,
      )
    },

    /** 오늘의 큐레이션. 오늘 고른 매장이 없으면 null */
    today(): Promise<TodayCuration | null> {
      return client.get<TodayCuration | null>("/curations/today", { auth: "optional" })
    },
  } as const
}

export const recommendationApi = createRecommendationApi()
export type RecommendationApi = ReturnType<typeof createRecommendationApi>
