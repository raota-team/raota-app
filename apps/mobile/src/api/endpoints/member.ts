import { apiClient, type ApiClient } from "../client"
import type {
  BlockedMember,
  CursorPage,
  CursorParams,
  MemberMe,
  NicknameAvailabilityResponse,
  OnboardingRequest,
  RamenLogSummary,
  RamenLogSummaryItem,
  ShopSummary,
  UpdateMemberRequest,
  WithdrawalRequest,
} from "../types"

/**
 * 내 계정(#44).
 * 온보딩 중(status=ONBOARDING)에는 me·onboarding·닉네임 확인·업로드 티켓·로그아웃만 되고,
 * 다른 쓰기는 403 ONBOARDING_REQUIRED가 온다.
 */
export function createMemberApi(client: ApiClient = apiClient) {
  return {
    me(): Promise<MemberMe> {
      return client.get<MemberMe>("/members/me")
    },

    updateMe(body: UpdateMemberRequest): Promise<MemberMe> {
      return client.patch<MemberMe>("/members/me", body)
    },

    /** 닉네임 + 약관 동의(TERMS·PRIVACY 필수). 끝나면 계정이 ACTIVE가 된다 */
    onboarding(body: OnboardingRequest): Promise<MemberMe> {
      return client.put<MemberMe>("/members/me/onboarding", body)
    },

    nicknameAvailability(nickname: string): Promise<NicknameAvailabilityResponse> {
      return client.get<NicknameAvailabilityResponse>("/members/nickname-availability", { query: { nickname } })
    },

    /** 탈퇴. confirmation은 반드시 "WITHDRAW" */
    withdraw(body: WithdrawalRequest): Promise<void> {
      return client.post<void>("/members/me/withdrawal", body)
    },

    /** 내 기록(방문일 최신순, 커서) */
    myRamenLogs(params: CursorParams = {}): Promise<CursorPage<RamenLogSummary>> {
      return client.get<CursorPage<RamenLogSummary>>("/members/me/ramen-logs", {
        query: { cursor: params.cursor, size: params.size },
      })
    },

    /**
     * 내 기록 전체를 가볍게(페이지 없음).
     * 캘린더·방문 매장·월별 분포·취향 계산은 서버 API 없이 이 목록 하나로 앱이 만든다.
     */
    myRamenLogSummary(): Promise<RamenLogSummaryItem[]> {
      return client.get<RamenLogSummaryItem[]>("/members/me/ramen-logs/summary")
    },

    bookmarkedShops(params: CursorParams = {}): Promise<CursorPage<ShopSummary>> {
      return client.get<CursorPage<ShopSummary>>("/members/me/bookmarked-shops", {
        query: { cursor: params.cursor, size: params.size },
      })
    },

    /** 내가 차단한 사람들 */
    blocks(): Promise<BlockedMember[]> {
      return client.get<BlockedMember[]>("/members/me/blocks")
    },
  } as const
}

export const memberApi = createMemberApi()
export type MemberApi = ReturnType<typeof createMemberApi>
