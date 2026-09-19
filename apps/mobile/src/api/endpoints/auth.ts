import { apiClient, TOKEN_REISSUE_PATH, type ApiClient } from "../client"
import { tokenStore as defaultTokenStore, type TokenStore } from "../tokens"
import type { OauthLoginRequest, OauthLoginResponse, ReissueResponse } from "../types"

/**
 * 로그인·로그아웃(#44). 로그인과 재발급은 토큰 없이 부른다.
 * 애플은 앱이 만든 raw nonce를 함께 보낸다(서버 challenge 단계는 없어졌다).
 */
export function createAuthApi(client: ApiClient = apiClient, tokens: TokenStore = defaultTokenStore) {
  return {
    /** 제공자 자격 증명 → 토큰 + 회원 정보. 받은 토큰은 바로 보관한다 */
    async oauthLogin(body: OauthLoginRequest): Promise<OauthLoginResponse> {
      const result = await client.post<OauthLoginResponse>("/auth/oauth/login", body, { auth: "none" })
      if (result?.accessToken && result?.refreshToken) {
        await tokens.set({ accessToken: result.accessToken, refreshToken: result.refreshToken })
      }
      return result
    },

    /**
     * 토큰 재발급. 보통은 클라이언트가 401을 받고 알아서 부른다(single-flight).
     * 이 함수는 앱을 켤 때처럼 직접 갱신해야 할 때만 쓴다(재시도하지 않는다).
     */
    async reissue(refreshToken: string): Promise<ReissueResponse> {
      const issued = await client.post<ReissueResponse>(
        TOKEN_REISSUE_PATH,
        { refreshToken },
        { auth: "none", retry: false },
      )
      if (issued?.accessToken && issued?.refreshToken) {
        await tokens.set({ accessToken: issued.accessToken, refreshToken: issued.refreshToken })
      }
      return issued
    },

    /** 로그아웃. 서버 호출이 실패해도 기기의 토큰은 반드시 지운다 */
    async logout(): Promise<void> {
      const pair = await tokens.get()
      try {
        if (pair) await client.post<void>("/auth/logout", { refreshToken: pair.refreshToken })
      } finally {
        await tokens.clear()
      }
    },
  } as const
}

export const authApi = createAuthApi()
export type AuthApi = ReturnType<typeof createAuthApi>
