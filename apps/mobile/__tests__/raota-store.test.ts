import {
  buildTasteReport,
  createInitialRaotaState,
  raotaReducer,
  selectUnreadNotificationCount,
} from "@/src/state/RaotaStore"

describe("raotaReducer", () => {
  it("toggles a ramen-log like without allowing a negative count", () => {
    const state = createInitialRaotaState()
    const target = state.logs[0]
    const next = raotaReducer(state, {
      type: "TOGGLE_LOG_LIKE",
      payload: target.id,
    })
    const changed = next.logs.find((log) => log.id === target.id)

    expect(changed?.isLiked).toBe(!target.isLiked)
    expect(changed?.likes).toBeGreaterThanOrEqual(0)
  })

  it("marks all notifications as read", () => {
    const state = createInitialRaotaState()
    expect(selectUnreadNotificationCount(state)).toBeGreaterThan(0)

    const next = raotaReducer(state, { type: "MARK_ALL_NOTIFICATIONS_READ" })
    expect(selectUnreadNotificationCount(next)).toBe(0)
  })

  it("keeps the selected shop in an ephemeral record draft", () => {
    const state = createInitialRaotaState()
    const started = raotaReducer(state, {
      type: "START_RECORD_DRAFT",
      payload: null,
    })
    const selected = raotaReducer(started, {
      type: "SELECT_RECORD_DRAFT_SHOP",
      payload: 3,
    })
    const cleared = raotaReducer(selected, { type: "CLEAR_RECORD_DRAFT" })

    expect(started.recordDraft).toEqual({ shopId: null })
    expect(selected.recordDraft).toEqual({ shopId: 3 })
    expect(cleared.recordDraft).toBeNull()
  })

  it("updates visit and revisit totals when a log is created", () => {
    const state = createInitialRaotaState()
    const source = state.logs[0]
    const created = {
      ...source,
      author: { ...source.author, id: state.user?.id },
      id: 9999,
      revisit: "자주 감" as const,
      createdAt: "2026-09-04T00:00:00.000Z",
    }

    const next = raotaReducer(state, { type: "CREATE_LOG", payload: created })
    expect(next.logs[0].id).toBe(9999)
    expect(next.user?.visitedCount).toBe((state.user?.visitedCount ?? 0) + 1)
    expect(next.user?.revisitCount).toBe((state.user?.revisitCount ?? 0) + 1)
  })
})

describe("buildTasteReport", () => {
  it("creates a deterministic five-axis report from logs", () => {
    const state = createInitialRaotaState()
    const report = buildTasteReport(
      state.logs,
      undefined,
      new Date("2026-09-04T09:00:00Z"),
    )

    expect(report.id).toBe("taste-1788512400000")
    expect(report.metrics).toHaveLength(5)
    expect(report.recordCount).toBe(state.logs.length)
    expect(report.topShops.length).toBeGreaterThan(0)
  })
})
