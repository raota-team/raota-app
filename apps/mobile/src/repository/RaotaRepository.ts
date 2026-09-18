import type { PersistedAppStateV1 } from "@raota/shared"

/** Data boundary used by the store so a remote API can replace local mocks later. */
export interface RaotaRepository {
  load(): Promise<unknown | null>
  save(state: PersistedAppStateV1): Promise<void>
  clear(): Promise<void>
}
