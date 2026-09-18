import AsyncStorage from "@react-native-async-storage/async-storage"
import type { PersistedAppStateV1 } from "@raota/shared"

import type { RaotaRepository } from "./RaotaRepository"

export const RAOTA_STORAGE_KEY = "@raota/persisted-app-state"

export class LocalRaotaRepository implements RaotaRepository {
  constructor(private readonly storageKey = RAOTA_STORAGE_KEY) {}

  async load(): Promise<unknown | null> {
    const serialized = await AsyncStorage.getItem(this.storageKey)
    if (!serialized) return null

    try {
      return JSON.parse(serialized) as unknown
    } catch {
      // Treat damaged local JSON as an empty install. The store will re-seed it.
      return null
    }
  }

  async save(state: PersistedAppStateV1): Promise<void> {
    await AsyncStorage.setItem(this.storageKey, JSON.stringify(state))
  }

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(this.storageKey)
  }
}

export const localRaotaRepository = new LocalRaotaRepository()
