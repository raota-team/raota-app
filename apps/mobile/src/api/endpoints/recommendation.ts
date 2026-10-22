import { apiClient, type ApiClient } from "../client"
import type { RecommendationRequest, RecommendationResponse, TodayCuration } from "../types"

/**
 * AI 추천과 오늘의 큐레이션(#46).
 * 추천은 1분에 10번(429 RATE_LIMITED)이고, 만들지 못하면 503 RECOMMENDATION_UNAVAILABLE이 온다.
 * 그때는 화면이 로컬 랭킹(src/domain/ai-recommendation.ts)이나 인기·거리순으로 내려간다.
 */
export function createRecommendationApi(client: ApiClient = apiClient) {
  return {
    /** 서버가 검색을 20초까지 기다리므로 기본 15초보다 길게 기다린다. 짧으면 서버 답보다 앱 시간 초과가 먼저 난다 */
    recommend(body: RecommendationRequest): Promise<RecommendationResponse> {
      return client.post<RecommendationResponse>("/ai/recommendations", body, { timeoutMs: 25_000 })
    },

    /** 오늘의 큐레이션. 오늘 고른 매장이 없으면 null */
    today(): Promise<TodayCuration | null> {
      return client.get<TodayCuration | null>("/curations/today", { auth: "optional" })
    },
  } as const
}

export const recommendationApi = createRecommendationApi()
export type RecommendationApi = ReturnType<typeof createRecommendationApi>
