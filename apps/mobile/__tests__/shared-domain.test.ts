import {
  DEMO_BASE_PROFILE,
  DEMO_BOWLS,
  DEMO_MONTHLY_RECORD_COUNTS,
  DEMO_TOTAL_BOWLS,
  DEMO_TYPE_COUNTS,
  PAST_REPORTS,
  SHOP_CATALOG,
  findShopById,
  getShopDetail,
  isTasteScores,
  menuDistribution,
  mergeProfile,
  profileDelta,
  shopVisitsOf,
  tasteIdentity,
  typeCountsOf,
  type RamenLog,
} from "@raota/shared"

import { migratePersistedState } from "@/src/repository/migrations"
import { createInitialPersistedState } from "@/src/data/fixtures"

const log = (overrides: Partial<RamenLog> = {}): RamenLog => ({
  id: 9001,
  author: { name: "테스터", level: "라멘 입문자" },
  shop: { id: 2, name: "후쿠 라멘", branch: "합정점" },
  menuName: "삿포로 미소 라멘",
  ramenType: "미소",
  visitedAt: "2026-09-18",
  imageUrl: null,
  note: "",
  tasteNotes: { broth: [], noodle: [], seasoning: [], topping: [] },
  scores: { satisfaction: 5, brothDensity: 5, noodleFirmness: 4, topping: 4, revisit: 5 },
  revisit: "자주 감",
  likes: 0,
  isLiked: false,
  isPublic: true,
  createdAt: "방금 전",
  ...overrides,
})

describe("shared ledger", () => {
  it("keeps the demo ledger consistent with its monthly and type totals", () => {
    expect(DEMO_BOWLS).toHaveLength(DEMO_TOTAL_BOWLS)
    expect(DEMO_TOTAL_BOWLS).toBe(42)
    for (const [month, count] of Object.entries(DEMO_MONTHLY_RECORD_COUNTS)) {
      expect(DEMO_BOWLS.filter(bowl => bowl.date.startsWith(month))).toHaveLength(count)
    }
    expect(typeCountsOf(DEMO_BOWLS)).toEqual(DEMO_TYPE_COUNTS)
  })

  it("sums shop visits to the bowl count and never exceeds a month in reports", () => {
    expect(shopVisitsOf(DEMO_BOWLS).reduce((sum, shop) => sum + shop.visitCount, 0)).toBe(42)
    for (const report of PAST_REPORTS) {
      expect(report.styleRows.reduce((sum, row) => sum + row.count, 0)).toBe(report.recordCount)
      for (const shop of report.topShops) expect(shop.visitCount).toBeLessThanOrEqual(report.recordCount)
    }
  })

  it("does not borrow another shop's details for sparse catalog entries", () => {
    const ids = SHOP_CATALOG.map(shop => shop.id)
    expect(new Set(ids).size).toBe(ids.length)
    const fuku = getShopDetail("후쿠 라멘")
    expect(fuku.reviews).toEqual([])
    expect(fuku.phone).toBeUndefined()
    expect(fuku.instagramUrl).toBeUndefined()
    expect(findShopById(4)?.name).toBe("세상끝의라멘")
    expect(getShopDetail("없는 가게").id).toBe(0)
  })

  it("rounds menu distribution labels to exactly 100 percent", () => {
    const { total, items } = menuDistribution({ id: "x", period: "2026년 8월", styleRows: [{ name: "시오", count: 1 }, { name: "쇼유", count: 1 }, { name: "미소", count: 1 }] })
    expect(total).toBe(3)
    expect(items.reduce((sum, item) => sum + item.pct, 0)).toBe(100)
    expect(items.find(item => item.name === "미소")?.count).toBe(1)
  })
})

describe("5-axis taste profile", () => {
  it("adds a new bowl to the 42-bowl average and reports a visible delta", () => {
    const after = mergeProfile(DEMO_BASE_PROFILE, [log()])
    expect(after.count).toBe(43)
    const delta = profileDelta(DEMO_BASE_PROFILE, after)
    expect(delta.brothDensity).toBeGreaterThan(0)
    expect(delta.brothDensity).toBeLessThan(0.1)
  })

  it("derives revisit from the revisit answer and skips logs without scores", () => {
    const after = mergeProfile({ count: 0, scores: { satisfaction: 0, brothDensity: 0, noodleFirmness: 0, topping: 0, revisit: 0 } }, [
      log({ revisit: "한번이면 충분" }),
      log({ id: 2, scores: undefined }),
    ])
    expect(after.count).toBe(1)
    expect(after.scores.revisit).toBe(1)
  })

  it("explains the identity with its evidence", () => {
    const identity = tasteIdentity(DEMO_TYPE_COUNTS, DEMO_BASE_PROFILE)
    expect(identity.title).toBe("진한 돈골파")
    expect(identity.evidence).toBe("누적 42그릇 중 돈코츠 14그릇 · 육수 농도 평균 3.9")
  })

  it("validates stored scores", () => {
    expect(isTasteScores(log().scores)).toBe(true)
    expect(isTasteScores({ satisfaction: 9 })).toBe(false)
  })
})

describe("persisted 5-axis scores", () => {
  const persisted = (logs: unknown[]) => ({ ...createInitialPersistedState(), logs })

  it("keeps valid scores across a reload", () => {
    const migrated = migratePersistedState(persisted([log()]))
    expect(migrated.logs[0]?.scores?.brothDensity).toBe(5)
  })

  it("keeps the log but drops broken scores", () => {
    const migrated = migratePersistedState(persisted([log({ scores: { satisfaction: 42 } as never })]))
    expect(migrated.logs).toHaveLength(1)
    expect(migrated.logs[0]?.scores).toBeUndefined()
  })
})
