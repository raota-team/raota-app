import type { CreateRamenLogInput, Shop } from "@raota/shared"

import { INITIAL_TASTE_REPORTS, SHOPS } from "@/src/data/fixtures"
import {
  calculateMapClusters,
  filterAndSortShops,
  firstRecordValidationMessage,
  rankShopsForAIRecommendation,
  validateRecordDraft,
} from "@/src/domain"

const validRecord: CreateRamenLogInput = {
  shopId: 1,
  menuName: "특제 쇼유 라멘",
  ramenType: "쇼유",
  visitedAt: "2026-09-04",
  note: "국물과 면의 균형이 아주 좋았어요.",
  tasteNotes: {
    broth: ["깔끔해요"],
    noodle: ["단단해요"],
    seasoning: ["딱 좋아요"],
    topping: ["차슈 좋아요"],
  },
  scores: { satisfaction: 4, brothDensity: 5, noodleFirmness: 4, topping: 3, revisit: 5 },
  revisit: "자주 감",
  isPublic: true,
}

describe("record validation", () => {
  it("accepts a complete record DTO", () => {
    expect(validateRecordDraft(validRecord)).toEqual([])
    expect(firstRecordValidationMessage(validRecord)).toBeNull()
  })

  it("returns errors in the same order the form asks for corrections", () => {
    const errors = validateRecordDraft({
      ...validRecord,
      shopId: null,
      menuName: " ",
      scores: { satisfaction: 4, topping: 3 },
    })

    expect(errors.map((error) => error.axis ?? error.field)).toEqual([
      "shopId",
      "menuName",
      "brothDensity",
      "noodleFirmness",
    ])
    expect(errors[3].message).toBe("면 삶기를 골라주세요.")
  })

  it("treats memo and taste tags as optional", () => {
    expect(
      validateRecordDraft({
        ...validRecord,
        note: "",
        tasteNotes: { broth: [], noodle: [], seasoning: [], topping: [] },
      }),
    ).toEqual([])
    expect(validateRecordDraft({ ...validRecord, note: "라".repeat(501) })[0].field).toBe("note")
  })

  it("asks for the revisit answer and uses the right particle for 토핑", () => {
    const errors = validateRecordDraft({ ...validRecord, scores: {}, revisit: null })
    expect(errors.map((error) => error.message)).toEqual([
      "전체 만족도를 골라주세요.",
      "육수 농도를 골라주세요.",
      "면 삶기를 골라주세요.",
      "토핑을 골라주세요.",
      "재방문 의사를 골라주세요.",
    ])
  })

  it("rejects unknown shops, future dates, and unsupported taste tags", () => {
    const errors = validateRecordDraft(
      {
        ...validRecord,
        shopId: 999,
        visitedAt: "2026-09-05",
        tasteNotes: {
          ...validRecord.tasteNotes,
          broth: ["존재하지 않는 태그"],
        },
      },
      { validShopIds: [1, 2, 3], now: new Date("2026-09-04T12:00:00+09:00") },
    )

    expect(errors.map((error) => error.field)).toEqual([
      "shopId",
      "visitedAt",
      "tasteNotes",
    ])
  })
})

describe("shop filtering and sorting", () => {
  it("combines Korean search, type, area, and open filters", () => {
    const result = filterAndSortShops(SHOPS, {
      query: "자가제면",
      ramenType: "쇼유",
      area: "마포",
      openOnly: true,
    })

    expect(result.map((shop) => shop.id)).toEqual([1])
  })

  it("sorts a copy without mutating fixture order", () => {
    const originalIds = SHOPS.map((shop) => shop.id)
    const sorted = filterAndSortShops(SHOPS, { sort: "match" })

    expect(sorted[0].matchScore).toBeGreaterThanOrEqual(sorted[1].matchScore)
    expect(SHOPS.map((shop) => shop.id)).toEqual(originalIds)
  })

  it("recomputes distance ordering from the granted device location", () => {
    const result = filterAndSortShops(SHOPS, {
      sort: "distance",
      origin: { latitude: SHOPS[2].lat, longitude: SHOPS[2].lng },
    })

    expect(result[0].id).toBe(SHOPS[2].id)
    expect(result[0].distanceM).toBe(0)
  })
})

describe("map clusters", () => {
  const shops = SHOPS.slice(0, 3) as Shop[]

  it("keeps exact markers at close zoom", () => {
    const clusters = calculateMapClusters(shops, {
      latitudeDelta: 0.03,
      longitudeDelta: 0.03,
    })
    expect(clusters).toHaveLength(3)
    expect(clusters.every((cluster) => cluster.shopIds.length === 1)).toBe(true)
  })

  it("builds a deterministic centroid at wide zoom", () => {
    const clusters = calculateMapClusters(shops, {
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    })
    const centroid = clusters.find((cluster) => cluster.shopIds.length === 3)

    expect(centroid?.shopIds).toEqual([1, 2, 3])
    expect(centroid?.latitude).toBeCloseTo(
      shops.reduce((sum, shop) => sum + shop.lat, 0) / shops.length,
    )
  })

  it("does not merge shops that fall into distant spatial buckets", () => {
    // 원장 가게는 모두 마포 안이라, 도시 반대편에 있는 가상 가게로 확인한다
    const mapo = SHOPS[0]
    const farAway = { ...mapo, id: 99, lat: mapo.lat + 0.05, lng: mapo.lng + 0.05 }
    const clusters = calculateMapClusters([mapo, farAway], {
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    })

    expect(clusters).toHaveLength(2)
  })
})

describe("AI shop recommendation", () => {
  const baseInput = {
    soup: "쇼유 (간장)",
    mood: "혼밥하기 좋은 곳",
    priority: "깔끔하고 깊은 감칠맛",
    prompt: "",
    currentTasteReport: INITIAL_TASTE_REPORTS[0],
  }

  it("scores every shop and returns the same deterministic order", () => {
    const first = rankShopsForAIRecommendation(SHOPS, baseInput)
    const second = rankShopsForAIRecommendation(SHOPS, baseInput)

    expect(first).toHaveLength(SHOPS.length)
    expect(first.map(({ shop }) => shop.id).sort()).toEqual(
      SHOPS.map(({ id }) => id).sort(),
    )
    expect(first.map(({ shop }) => shop.id)).toEqual(
      second.map(({ shop }) => shop.id),
    )
    expect(
      first.every(
        (item, index) => index === 0 || first[index - 1].score >= item.score,
      ),
    ).toBe(true)
  })

  it("uses soup, mood, priority, prompt, and taste report as real score inputs", () => {
    const scoreForShop = (
      input: Parameters<typeof rankShopsForAIRecommendation>[1],
      shopId = 1,
    ) =>
      rankShopsForAIRecommendation(SHOPS, input).find(
        ({ shop }) => shop.id === shopId,
      )!

    const baseline = scoreForShop(baseInput)
    const changedSoup = scoreForShop({ ...baseInput, soup: "돈코츠 (돼지뼈)" })
    const changedMood = scoreForShop({
      ...baseInput,
      mood: "웨이팅도 감수할 맛집",
    })
    const changedPriority = scoreForShop({
      ...baseInput,
      priority: "두툼하고 부드러운 차슈",
    })
    const withPrompt = scoreForShop({ ...baseInput, prompt: "밥 무료 제공" })
    const withoutTaste = scoreForShop({
      ...baseInput,
      currentTasteReport: null,
    })

    expect(changedSoup.breakdown.soup).not.toBe(baseline.breakdown.soup)
    expect(changedMood.breakdown.mood).not.toBe(baseline.breakdown.mood)
    expect(changedPriority.breakdown.priority).not.toBe(
      baseline.breakdown.priority,
    )
    expect(withPrompt.breakdown.prompt).toBeGreaterThan(
      baseline.breakdown.prompt,
    )
    expect(baseline.breakdown.taste).toBeGreaterThan(
      withoutTaste.breakdown.taste,
    )
  })

  it.each([
    ["쇼유 (간장)", 1],
    ["돈코츠 (돼지뼈)", 7],
    ["시오 (소금)", 8],
    ["미소 (된장)", 2],
    ["토리파이탄 (닭백탕)", 3],
  ])("keeps the selected %s lineage meaningful", (soup, expectedShopId) => {
    const [winner] = rankShopsForAIRecommendation(SHOPS, {
      ...baseInput,
      soup,
    })

    expect(winner.shop.id).toBe(expectedShopId)
  })

  it("recomputes both score and displayed distance from a device origin", () => {
    const target = SHOPS[4]
    const ranked = rankShopsForAIRecommendation(SHOPS, {
      ...baseInput,
      prompt: "지금 위치에서 가까운 곳",
      origin: { latitude: target.lat, longitude: target.lng },
    })
    const scoredTarget = ranked.find(({ shop }) => shop.id === target.id)

    expect(scoredTarget?.shop.distanceM).toBe(0)
    expect(scoredTarget?.breakdown.distance).toBe(12)
  })
})
