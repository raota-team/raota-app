import { apiClient, isApiError, type ApiClient } from "../client"

/** 서버가 살아 있는지 확인(#59). 개발 중 주소·연결을 확인할 때 쓴다 */
export function createSystemApi(client: ApiClient = apiClient) {
  return {
    ping(): Promise<unknown> {
      return client.get<unknown>("/ping", { auth: "none" })
    },

    /** 연결되면 true. 서버에 닿지 못하면 false(그 밖의 오류는 그대로 올린다) */
    async isReachable(): Promise<boolean> {
      try {
        await client.get<unknown>("/ping", { auth: "none" })
        return true
      } catch (error) {
        if (isApiError(error) && error.isOffline) return false
        throw error
      }
    },
  } as const
}

export const systemApi = createSystemApi()
export type SystemApi = ReturnType<typeof createSystemApi>
