import { migratePersistedState } from "@/src/repository/migrations"

describe("migratePersistedState", () => {
  it("falls back to a complete V1 fixture for unreadable values", () => {
    const migrated = migratePersistedState({ version: 99, logs: "broken" })

    expect(migrated.version).toBe(1)
    expect(migrated.logs.length).toBeGreaterThan(0)
    expect(migrated.notificationSettings.pushEnabled).toBe(true)
  })

  it("keeps valid persisted collections and fills missing settings", () => {
    const migrated = migratePersistedState({
      version: 1,
      user: null,
      onboardingCompleted: false,
      logs: [],
      bookmarkedShopIds: [3],
      subscribedNewsIds: [2],
      communityPosts: [],
      notifications: [],
      notificationSettings: { pushEnabled: false },
      tasteReports: [],
      currentTasteReportId: null,
    })

    expect(migrated.user).toBeNull()
    expect(migrated.bookmarkedShopIds).toEqual([3])
    expect(migrated.subscribedShopIds).toEqual([3])
    expect(migrated.notificationSettings.pushEnabled).toBe(false)
    expect(typeof migrated.notificationSettings.likesEnabled).toBe("boolean")
  })

  it("drops malformed collection members instead of exposing crashable state", () => {
    const migrated = migratePersistedState({
      version: 1,
      user: {},
      onboardingCompleted: true,
      logs: [null, { id: 1 }],
      bookmarkedShopIds: [1, "2", -3],
      subscribedShopIds: [1, null],
      communityPosts: [false],
      notifications: [{ id: "broken" }],
      notificationSettings: {},
      tasteReports: [{ id: "broken" }],
      currentTasteReportId: "broken",
    })

    expect(migrated.user).toBeNull()
    expect(migrated.logs).toEqual([])
    expect(migrated.bookmarkedShopIds).toEqual([1])
    expect(migrated.subscribedShopIds).toEqual([1])
    expect(migrated.communityPosts).toEqual([])
    expect(migrated.notifications).toEqual([])
    expect(migrated.tasteReports).toEqual([])
    expect(migrated.currentTasteReportId).toBeNull()
  })
})
