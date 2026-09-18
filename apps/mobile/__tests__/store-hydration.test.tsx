import { render, waitFor } from "@testing-library/react-native"
import { Text } from "react-native"

import { createInitialPersistedState } from "@/src/data/fixtures"
import type { RaotaRepository } from "@/src/repository"
import { RaotaProvider, useRaota } from "@/src/state/RaotaStore"

function HydrationProbe() {
  const { isHydrated, currentUser, unreadNotificationCount } = useRaota()
  return (
    <Text>
      {isHydrated ? "ready" : "loading"}:{currentUser?.nickname ?? "guest"}:
      {unreadNotificationCount}
    </Text>
  )
}

describe("RaotaProvider hydration", () => {
  it("hydrates repository state before exposing the persisted session", async () => {
    const persisted = {
      ...createInitialPersistedState(),
      user: null,
      onboardingCompleted: false,
      notifications: [],
    }
    const repository: RaotaRepository = {
      load: jest.fn().mockResolvedValue(persisted),
      save: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
    }

    const view = await render(
      <RaotaProvider repository={repository}>
        <HydrationProbe />
      </RaotaProvider>,
    )

    expect(await view.findByText("ready:guest:0")).toBeTruthy()
    await waitFor(() => expect(repository.save).toHaveBeenCalledWith(persisted))
  })

  it("recovers from unreadable storage with a complete fixture and an error state", async () => {
    const repository: RaotaRepository = {
      load: jest.fn().mockRejectedValue(new Error("storage unavailable")),
      save: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
    }

    function ErrorProbe() {
      const { isHydrated, storageError } = useRaota()
      return <Text>{isHydrated ? storageError : "loading"}</Text>
    }

    const view = await render(
      <RaotaProvider repository={repository}>
        <ErrorProbe />
      </RaotaProvider>,
    )

    expect(await view.findByText("storage unavailable")).toBeTruthy()
  })
})
