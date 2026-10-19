import { createInitialPersistedState } from "@/src/data/fixtures"
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
    expect(migrated.bookmarkedShopIds).toEqual(["3"])
    expect(migrated.subscribedShopIds).toEqual(["3"])
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
    expect(migrated.bookmarkedShopIds).toEqual(["1", "2"])
    expect(migrated.subscribedShopIds).toEqual(["1"])
    expect(migrated.communityPosts).toEqual([])
    expect(migrated.notifications).toEqual([])
    expect(migrated.tasteReports).toEqual([])
    expect(migrated.currentTasteReportId).toBeNull()
  })

  it("upgrades nested legacy numeric IDs without losing records or BIGINT strings", () => {
    const initial = createInitialPersistedState()
    const raw = JSON.parse(JSON.stringify({
      ...initial,
      user: { ...initial.user, id: 42 },
      logs: [{
        ...initial.logs[0],
        id: 7,
        author: { ...initial.logs[0].author, id: 42 },
        shop: { ...initial.logs[0].shop, id: "9223372036854775807" },
        comments: [{
          ...initial.logs[0].comments![0],
          id: 8,
          logId: 7,
          author: { ...initial.logs[0].comments![0].author, id: 43 },
        }, {
          ...initial.logs[0].comments![1],
          id: 9,
          logId: 7,
          parentId: 8,
        }],
      }],
      bookmarkedShopIds: [3, "9223372036854775807"],
      subscribedShopIds: [3],
      communityPosts: [{
        ...initial.communityPosts[0],
        id: 11,
        shopId: 3,
        author: { ...initial.communityPosts[0].author, id: 44 },
        comments: [{
          ...initial.communityPosts[0].comments[0],
          id: 12,
          postId: 11,
        }, {
          ...initial.communityPosts[0].comments[1],
          id: 13,
          postId: 11,
          parentId: 12,
        }],
      }],
      notifications: [{
        ...initial.notifications[0],
        id: 14,
        targetShopId: 3,
        targetLogId: 7,
        targetPostId: 11,
        targetReportId: "vol-04",
      }],
      tasteReports: [{
        ...initial.tasteReports[0],
        topShops: [{ ...initial.tasteReports[0].topShops[0], shopId: 3 }],
      }],
      hiddenAuthorIds: ["42", 42],
      contentReports: [{
        id: 21,
        kind: "comment",
        targetId: 8,
        reason: "spam",
        createdAt: "2026-09-01T00:00:00Z",
      }],
    }))

    const migrated = migratePersistedState(raw)

    expect(migrated.user?.id).toBe("42")
    expect(migrated.logs).toHaveLength(1)
    expect(migrated.logs[0].id).toBe("7")
    expect(migrated.logs[0].author.id).toBe("42")
    expect(migrated.logs[0].shop.id).toBe("9223372036854775807")
    expect(migrated.logs[0].comments).toMatchObject([
      { id: "8", logId: "7", author: { id: "43" } },
      { id: "9", logId: "7", parentId: "8" },
    ])
    expect(migrated.logs[0].comments?.find(
      (comment) => comment.id === migrated.logs[0].comments?.[1].parentId,
    )?.id).toBe("8")
    expect(migrated.bookmarkedShopIds).toEqual(["3", "9223372036854775807"])
    expect(migrated.subscribedShopIds).toEqual(["3"])
    expect(migrated.communityPosts).toHaveLength(1)
    expect(migrated.communityPosts[0]).toMatchObject({
      id: "11", shopId: "3", author: { id: "44" },
      comments: [
        { id: "12", postId: "11" },
        { id: "13", postId: "11", parentId: "12" },
      ],
    })
    expect(migrated.bookmarkedShopIds.includes(migrated.communityPosts[0].shopId!)).toBe(true)
    expect(migrated.notifications[0].targetPostId).toBe(migrated.communityPosts[0].id)
    expect(migrated.notifications[0]).toMatchObject({
      id: "14", targetShopId: "3", targetLogId: "7", targetPostId: "11",
      targetReportId: "vol-04",
    })
    expect(migrated.tasteReports[0].id).toBe("vol-04")
    expect(migrated.tasteReports[0].recordCount).toBe(42)
    expect(migrated.tasteReports[0].topShops[0].shopId).toBe("3")
    expect(migrated.currentTasteReportId).toBe("vol-04")
    expect(migrated.hiddenAuthorIds).toEqual(["42"])
    expect(migrated.contentReports).toEqual([{
      id: "21", kind: "comment", targetId: "8", reason: "spam",
      createdAt: "2026-09-01T00:00:00Z",
    }])
  })
})
