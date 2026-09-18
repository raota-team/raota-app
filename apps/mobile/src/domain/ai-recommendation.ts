import type { Shop, TasteReport } from "@raota/shared"

import { distanceBetweenCoordinates } from "./shops"

export interface RecommendationOrigin {
  latitude: number
  longitude: number
}

export interface AIRecommendationInput {
  soup: string
  mood: string
  priority: string
  prompt?: string
  currentTasteReport?: TasteReport | null
  origin?: RecommendationOrigin | null
}

export interface RecommendationScoreBreakdown {
  quality: number
  soup: number
  mood: number
  priority: number
  prompt: number
  taste: number
  distance: number
}

export interface RankedShopRecommendation {
  shop: Shop
  score: number
  matchPercent: number
  breakdown: RecommendationScoreBreakdown
}

interface PrioritySignal {
  match: RegExp
  terms: string[]
}

const SOUP_SIGNALS: Record<string, string[]> = {
  쇼유: ["쇼유", "간장", "블랙쇼유", "닭청탕", "타레"],
  돈코츠: ["돈코츠", "돼지뼈", "이에케", "농후", "진한육수"],
  시오: ["시오", "소금", "유자", "청탕", "맑은"],
  미소: ["미소", "된장", "삿포로", "웍"],
  츠케멘: ["츠케멘", "찍어", "농축"],
  토리파이탄: ["토리파이탄", "파이탄", "닭백탕", "닭 육수", "크리미"],
}

const PRIORITY_SIGNALS: PrioritySignal[] = [
  {
    match: /진하고|묵직|농후|국물/,
    terms: [
      "진한",
      "묵직",
      "농후",
      "백탕",
      "돈코츠",
      "이에케",
      "미소",
      "크리미",
      "기름",
    ],
  },
  {
    match: /면|자가제면|탱글|꼬들/,
    terms: ["자가제면", "면", "탄력", "단단", "꼬들", "치지레"],
  },
  {
    match: /차슈|고기|토핑/,
    terms: ["차슈", "수비드", "고기", "토핑", "구성 알차"],
  },
  {
    match: /깔끔|감칠맛|깊은|담백/,
    terms: [
      "깔끔",
      "감칠맛",
      "청탕",
      "맑",
      "유자",
      "시오",
      "쇼유",
      "타레",
      "담백",
    ],
  },
]

const PROMPT_STOP_WORDS = new Set([
  "가까운",
  "그리고",
  "곳",
  "라멘",
  "맛집",
  "있는",
  "제공",
  "좋은",
  "추천",
  "해주세요",
])

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function normalizedText(value: string): string {
  return value.trim().toLocaleLowerCase("ko-KR").replace(/\s+/g, " ")
}

function shopSearchText(shop: Shop): string {
  const perks = shop.servicePerks
    ? Object.values(shop.servicePerks).filter(Boolean).join(" ")
    : ""
  const reviews = shop.reviews.map((review) => review.text).join(" ")

  return normalizedText(
    [
      shop.name,
      shop.branch,
      shop.address,
      shop.description,
      ...shop.tags,
      perks,
      reviews,
    ]
      .filter(Boolean)
      .join(" "),
  )
}

function matchedTermCount(haystack: string, terms: string[]): number {
  return new Set(
    terms.filter((term) => haystack.includes(normalizedText(term))),
  ).size
}

function selectedSoupKey(soup: string): string {
  const normalizedSoup = normalizedText(soup)
  return (
    Object.keys(SOUP_SIGNALS).find((key) => normalizedSoup.includes(key)) ??
    normalizedSoup.split(" ")[0]
  )
}

function distanceScore(distanceM: number): number {
  // 500m 안은 만점, 10km 밖은 거리 가점을 주지 않는다.
  return clamp(12 * (1 - Math.max(0, distanceM - 500) / 9_500), 0, 12)
}

function qualityScore(shop: Shop): number {
  const rating = clamp((shop.rating - 3.5) * 4, 0, 6)
  const preference = clamp(shop.matchScore / 12.5, 0, 8)
  const availability = shop.isOpen ? 3 : 0
  return rating + preference + availability
}

function soupScore(shopText: string, selectedSoup: string): number {
  const terms = SOUP_SIGNALS[selectedSoup] ?? [selectedSoup]
  const exactMatch = shopText.includes(normalizedText(selectedSoup))
  const relatedMatches = matchedTermCount(shopText, terms)
  return clamp((exactMatch ? 40 : 0) + relatedMatches * 4, 0, 52)
}

function moodScore(shop: Shop, mood: string, proximity: number): number {
  const normalizedMood = normalizedText(mood)
  if (/혼밥|혼자/.test(normalizedMood)) {
    return (
      (shop.dineIn ? 5 : 0) +
      (shop.isOpen ? 3 : 0) +
      proximity * 0.42 +
      (shop.reviewCount <= 650 ? 2 : 0)
    )
  }
  if (/데이트|아늑/.test(normalizedMood)) {
    return (
      clamp((shop.rating - 4) * 8, 0, 6) +
      (shop.photos.length >= 2 ? 3 : 0) +
      (shop.reservable ? 3 : 0) +
      (shop.description ? 2 : 0)
    )
  }
  if (/웨이팅|감수|맛집/.test(normalizedMood)) {
    return (
      clamp(Math.log10(Math.max(10, shop.reviewCount)) * 3.5 - 5, 0, 8) +
      clamp((shop.rating - 4) * 8, 0, 6)
    )
  }
  if (/빠르|든든|한 끼/.test(normalizedMood)) {
    const freeRefill = Object.values(shop.servicePerks ?? {}).some((value) =>
      value?.includes("무료"),
    )
    return (
      (shop.isOpen ? 5 : 0) +
      proximity * 0.45 +
      (freeRefill ? 4 : 0) +
      (shop.dineIn ? 1 : 0)
    )
  }
  return 0
}

function priorityScore(shopText: string, priority: string): number {
  const signals = PRIORITY_SIGNALS.find(({ match }) => match.test(priority))
  if (!signals) return 0
  return clamp(matchedTermCount(shopText, signals.terms) * 4.5, 0, 20)
}

function promptScore(
  shop: Shop,
  shopText: string,
  prompt: string,
  proximity: number,
): number {
  const normalizedPrompt = normalizedText(prompt)
  if (!normalizedPrompt) return 0

  let score = 0
  if (/덜 짠|안 짠|짜지|저염|슴슴/.test(normalizedPrompt)) {
    score +=
      matchedTermCount(shopText, [
        "깔끔",
        "맑",
        "청탕",
        "시오",
        "유자",
        "담백",
      ]) * 2.5
    if (/짭짤|진한 타레|블랙쇼유/.test(shopText)) score -= 4
  }
  if (/차슈|고기|수비드/.test(normalizedPrompt)) {
    score += matchedTermCount(shopText, ["차슈", "수비드", "고기", "토핑"]) * 4
  }
  if (/웨이팅.*적|안 기다|대기.*적|빠른/.test(normalizedPrompt)) {
    score += clamp(8 - shop.reviewCount / 180, 0, 8) + proximity * 0.3
  }
  if (/밥.*무료|무료.*밥/.test(normalizedPrompt)) {
    score += shop.servicePerks?.riceRefill?.includes("무료") ? 14 : 0
  }
  if (/면.*무료|무료.*면|면.*리필/.test(normalizedPrompt)) {
    score += shop.servicePerks?.noodleRefill?.includes("무료") ? 12 : 0
  }
  if (/가까|근처|역세권|역에서/.test(normalizedPrompt)) score += proximity
  if (
    /맵지 않|안 매운|순한/.test(normalizedPrompt) &&
    !/매운|매콤|탄탄/.test(shopText)
  ) {
    score += 6
  }
  if (/영업 중|지금.*여|바로.*여/.test(normalizedPrompt))
    score += shop.isOpen ? 6 : -6

  for (const [soup, terms] of Object.entries(SOUP_SIGNALS)) {
    if (normalizedPrompt.includes(soup)) {
      score += matchedTermCount(shopText, [soup, ...terms]) * 3
    }
  }

  const tokens = normalizedPrompt
    .replace(/[^0-9a-zA-Z가-힣\s]/g, " ")
    .split(/\s+/)
    .map((token) =>
      token.replace(
        /(으로|에서|하고|이나|거나|한테|부터|까지|보다|이랑|랑|을|를|은|는|이|가|도)$/u,
        "",
      ),
    )
    .filter((token) => token.length >= 2 && !PROMPT_STOP_WORDS.has(token))
  score += matchedTermCount(shopText, tokens) * 1.5

  return clamp(score, -6, 26)
}

function reportMetric(report: TasteReport, key: string): number {
  return report.metrics.find((metric) => metric.key === key)?.score ?? 0
}

function tasteScore(
  shop: Shop,
  shopText: string,
  report?: TasteReport | null,
): number {
  if (!report) return 0

  let score = 0
  const topShop = report.topShops.find(
    (candidate) => candidate.shopId === shop.id,
  )
  if (topShop) {
    score += clamp(17 - (topShop.rank - 1) * 3, 8, 17)
    score += clamp(((topShop.matchPercent ?? 80) - 75) / 5, 0, 4)
  }

  const styleShare = report.styleShares.find(({ ramenType }) =>
    shopText.includes(normalizedText(ramenType)),
  )
  if (styleShare) score += clamp(styleShare.percentage / 7, 1, 6)

  const richness =
    reportMetric(report, "brothRichness") + reportMetric(report, "oilRichness")
  const noodleFirmness = reportMetric(report, "noodleFirmness")
  const cleanUmami =
    reportMetric(report, "saltBalance") + reportMetric(report, "umami")
  if (
    matchedTermCount(shopText, [
      "진한",
      "농후",
      "백탕",
      "돈코츠",
      "미소",
      "기름",
    ])
  ) {
    score += richness / 4
  }
  if (matchedTermCount(shopText, ["자가제면", "단단", "탄력", "꼬들", "면"])) {
    score += noodleFirmness / 2.5
  }
  if (
    matchedTermCount(shopText, [
      "깔끔",
      "감칠맛",
      "청탕",
      "타레",
      "시오",
      "쇼유",
    ])
  ) {
    score += cleanUmami / 4
  }

  const reportText = normalizedText(
    [
      report.title,
      report.quote,
      report.strongestFeature,
      ...report.tags,
      ...report.insights,
    ].join(" "),
  )
  const reportTokens = reportText
    .replace(/[^0-9a-zA-Z가-힣\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2)
  score += clamp(matchedTermCount(shopText, reportTokens) * 0.6, 0, 3)

  return clamp(score, 0, 28)
}

/**
 * 모든 매장을 같은 로컬 규칙으로 점수화한다. 외부 API나 난수 없이 입력과
 * fixture만으로 결정되므로 같은 상태에서는 항상 같은 순위를 반환한다.
 */
export function rankShopsForAIRecommendation(
  shops: Shop[],
  input: AIRecommendationInput,
): RankedShopRecommendation[] {
  const soup = selectedSoupKey(input.soup)

  return shops
    .map((originalShop) => {
      const distanceM = input.origin
        ? Math.round(
            distanceBetweenCoordinates(input.origin, {
              latitude: originalShop.lat,
              longitude: originalShop.lng,
            }),
          )
        : originalShop.distanceM
      const shop =
        distanceM === originalShop.distanceM
          ? originalShop
          : { ...originalShop, distanceM }
      const shopText = shopSearchText(shop)
      const proximity = distanceScore(distanceM)
      const breakdown: RecommendationScoreBreakdown = {
        quality: qualityScore(shop),
        soup: soupScore(shopText, soup),
        mood: moodScore(shop, input.mood, proximity),
        priority: priorityScore(shopText, input.priority),
        prompt: promptScore(shop, shopText, input.prompt ?? "", proximity),
        taste: tasteScore(shop, shopText, input.currentTasteReport),
        distance: proximity,
      }
      const score = Object.values(breakdown).reduce(
        (sum, value) => sum + value,
        0,
      )

      return {
        shop,
        score: Math.round(score * 100) / 100,
        matchPercent: Math.round(clamp(55 + score * 0.32, 55, 99)),
        breakdown,
      }
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.shop.matchScore - left.shop.matchScore ||
        right.shop.rating - left.shop.rating ||
        left.shop.id - right.shop.id,
    )
}
