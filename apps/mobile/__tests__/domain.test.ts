import type { CreateRamenLogInput, RamenLog, Shop } from "@raota/shared"

import { INITIAL_LOGS, INITIAL_TASTE_REPORTS, SHOPS } from "@/src/data/fixtures"
import { revisitHeadlineOf, SHOP_TASTE_RATIO_MIN_LOGS, shopTasteSummaryOf } from "@/src/domain/shopTaste"
import {
  calculateMapClusters,
  filterAndSortShops,
  firstRecordValidationMessage,
  matchesShopRamenType,
  isValidLogComment,
  rankShopsForAIRecommendation,
  validateNickname,
  validateRecordDraft,
} from "@/src/domain"

const validRecord: CreateRamenLogInput = {
  shopId: "1",
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

describe("이 가게의 맛 요약", () => {
  const logWith = (scores: RamenLog["scores"], revisit: RamenLog["revisit"]): RamenLog => ({ ...INITIAL_LOGS[0], scores, revisit })

  it("counts revisit answers, the most-recorded menu, and where most logs lean", () => {
    const summary = shopTasteSummaryOf([
      { ...logWith({ satisfaction: 5, brothDensity: 5, noodleFirmness: 4, topping: 4, revisit: 5 }, "자주 감"), menuName: "특제 쇼유" },
      { ...logWith({ satisfaction: 4, brothDensity: 4, noodleFirmness: 2, topping: 3, revisit: 3 }, "가끔 생각남"), menuName: "니보시" },
      { ...logWith({ satisfaction: 4, brothDensity: 2, noodleFirmness: 4, topping: 4, revisit: 5 }, "자주 감"), menuName: "특제 쇼유" },
    ])
    expect(summary).toEqual({
      count: 3,
      revisit: { often: 2, sometimes: 1, once: 0 },
      topMenu: "특제 쇼유",
      topMenuCount: 2,
      broth: "진한 편",
      noodle: "단단한 편",
      topping: "훌륭한 편",
    })
  })

  it("says nothing when no log has scores", () => {
    expect(shopTasteSummaryOf([{ ...INITIAL_LOGS[0], scores: undefined }])).toBeNull()
  })

  it("speaks in head counts and draws the ratio only from five logs", () => {
    const summaryOf = (revisits: RamenLog["revisit"][]) =>
      shopTasteSummaryOf(revisits.map((revisit) => logWith({ satisfaction: 4, brothDensity: 3, noodleFirmness: 3, topping: 3, revisit: 4 }, revisit)))!
    expect(SHOP_TASTE_RATIO_MIN_LOGS).toBe(5)
    expect(revisitHeadlineOf(summaryOf(["자주 감", "자주 감"]))).toBe("2명 모두 또 가고 싶대요")
    expect(revisitHeadlineOf(summaryOf(["자주 감", "가끔 생각남", "자주 감"]))).toBe("3명 중 2명이 또 가고 싶대요")
    expect(revisitHeadlineOf(summaryOf(["자주 감"]))).toBe("1명이 또 가고 싶대요")
    expect(revisitHeadlineOf(summaryOf(["가끔 생각남"]))).toBe("1명이 한 번쯤 가 볼 만하대요")
  })
})

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
        shopId: "999",
        visitedAt: "2026-09-05",
        tasteNotes: {
          ...validRecord.tasteNotes,
          broth: ["존재하지 않는 태그"],
        },
      },
      { validShopIds: ["1", "2", "3"], now: new Date("2026-09-04T12:00:00+09:00") },
    )

    expect(errors.map((error) => error.field)).toEqual([
      "shopId",
      "visitedAt",
      "tasteNotes",
    ])
  })
})

describe("라운지 댓글 길이", () => {
  it("공백을 빼고 최소 2자부터 앱 입력 상한 300자까지만 허용한다", () => {
    expect(isValidLogComment(" 라 ")).toBe(false)
    expect(isValidLogComment("  라면  ")).toBe(true)
    expect(isValidLogComment("라".repeat(300))).toBe(true)
    expect(isValidLogComment("라".repeat(301))).toBe(false)
  })
})

describe("서버 닉네임 형식", () => {
  it("trim 뒤 NFKC 정규화하고 대소문자 무시 값을 만든다", () => {
    expect(validateNickname("  ＡＢ＿９  ")).toMatchObject({ display: "AB_9", normalized: "ab_9", length: 4, error: null })
    expect(validateNickname(" a ").display).toBe("a")
    expect(validateNickname(" \u00a0가나").error).toBe("닉네임은 한글·영문·숫자·밑줄만 쓸 수 있어요.")
  })

  it("코드포인트 2~12자만 허용하고 공백·이모지는 거부한다", () => {
    expect(validateNickname("").error).toBe("닉네임을 입력해 주세요. 2~12자로 쓸 수 있어요.")
    expect(validateNickname("가").error).toBe("닉네임이 너무 짧아요. 1자만 더 적어 주세요.")
    expect(validateNickname("가나").error).toBeNull()
    expect(validateNickname("가".repeat(12)).error).toBeNull()
    expect(validateNickname("가".repeat(13)).error).toBe("닉네임은 12자까지예요. 지금 13자예요.")
    expect(validateNickname("가😀")).toMatchObject({ length: 2, error: "닉네임은 한글·영문·숫자·밑줄만 쓸 수 있어요." })
    expect(validateNickname("가 나").error).toBe("닉네임은 한글·영문·숫자·밑줄만 쓸 수 있어요.")
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

    expect(result.map((shop) => shop.id)).toEqual(["1"])
  })

  it("matches an 이에케 shop only to the 이에케 filter, even if its tags also say 돈코츠", () => {
    const ieke = { ...SHOPS[6], ramenTypes: ["이에케"], style: "이에케 라멘" }
    expect(matchesShopRamenType(ieke, "이에케")).toBe(true)
    expect(matchesShopRamenType(ieke, "돈코츠")).toBe(false)
    expect(filterAndSortShops([ieke], { ramenType: "이에케" })).toEqual([ieke])
    expect(filterAndSortShops([ieke], { ramenType: "돈코츠" })).toEqual([])
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

    expect(centroid?.shopIds).toEqual(["1", "2", "3"])
    expect(centroid?.latitude).toBeCloseTo(
      shops.reduce((sum, shop) => sum + shop.lat, 0) / shops.length,
    )
  })

  it("preserves the order and identity of adjacent BIGINT shop IDs", () => {
    const bigger = "9007199254740993124"
    const smaller = "9007199254740993123"
    const clusters = calculateMapClusters(
      [{ ...shops[0], id: bigger }, { ...shops[1], id: smaller }],
      { latitudeDelta: 0.03, longitudeDelta: 0.03 },
    )

    expect(clusters.map((cluster) => cluster.shopIds)).toEqual([[smaller], [bigger]])
  })

  it("does not merge shops that fall into distant spatial buckets", () => {
    // 원장 가게는 모두 마포 안이라, 도시 반대편에 있는 가상 가게로 확인한다
    const mapo = SHOPS[0]
    const farAway = { ...mapo, id: "99", lat: mapo.lat + 0.05, lng: mapo.lng + 0.05 }
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
      shopId = "1",
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
    ["쇼유 (간장)", "1"],
    ["돈코츠 (돼지뼈)", "7"],
    ["시오 (소금)", "8"],
    ["미소 (된장)", "2"],
    ["토리파이탄 (닭백탕)", "3"],
  ])("keeps the selected %s lineage meaningful", (soup, expectedShopId) => {
    const [winner] = rankShopsForAIRecommendation(SHOPS, {
      ...baseInput,
      soup,
    })

    expect(winner.shop.id).toBe(expectedShopId)
  })

  it("does not score an explicitly typed 이에케 shop as a 돈코츠 match", () => {
    const ieke = { ...SHOPS[6], ramenTypes: ["이에케"], style: "이에케 라멘" }
    const soupScore = (soup: string) =>
      rankShopsForAIRecommendation([ieke], {
        ...baseInput,
        soup,
        currentTasteReport: null,
      })[0].breakdown.soup

    expect(soupScore("돈코츠 (돼지뼈)")).toBe(0)
    expect(soupScore("이에케 (돈코츠쇼유)")).toBeGreaterThan(0)
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
