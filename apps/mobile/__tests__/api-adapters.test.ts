import type { CreateRamenLogInput } from "@raota/shared"

import {
  authorLevelLabel,
  revisitCountOf,
  revisitFromWire,
  revisitToWire,
  toAppBowls,
  toAppId,
  toAppMapPin,
  toAppMember,
  toAppRamenLog,
  toAppRamenLogComments,
  toAppShopDetail,
  toAppShopSummary,
  toAppTasteNotes,
  toCreateRamenLogBody,
  toOpeningHours,
  toPriceRange,
  toServicePerks,
  toTasteNoteCodes,
  toWireId,
  todayLastOrder,
} from "@/src/api/adapters"
import type {
  MemberMe,
  RamenLogComment,
  RamenLogDetail,
  RamenLogSummary,
  RamenLogSummaryItem,
  ShopDetail,
  ShopSummary,
} from "@/src/api/types"

const author = { id: "77", nickname: "면발탐정", avatarUrl: null, logCount: 12 }

const wireLog: RamenLogSummary = {
  id: "101",
  author,
  shop: { id: "7", name: "하쿠텐", branchName: "연남점", region: "마포구" },
  menuName: "이에케 라멘",
  ramenType: "돈코츠",
  visitedAt: "2026-09-18",
  imageUrls: ["https://cdn.raota.app/logs/101-1.jpg", "https://cdn.raota.app/logs/101-2.jpg"],
  note: "면 단단하게",
  tasteNoteCodes: ["BROTH_01", "NOODLE_02", "UNKNOWN_99"],
  revisitIntention: "OFTEN",
  visibility: "PUBLIC",
  scores: { satisfaction: 4, brothDensity: 5, noodleFirmness: 4, topping: 4, revisit: 5 },
  likeCount: 5,
  commentCount: 1,
  isLiked: true,
  isMine: false,
  createdAt: "2026-09-18T11:14:00Z",
}

const wireShop: ShopSummary = {
  id: "7",
  name: "하쿠텐",
  branchName: "연남점",
  address: "서울 마포구 연남동",
  region: "마포구",
  latitude: 37.5612,
  longitude: 126.9255,
  imageUrl: "https://cdn.raota.app/shops/7.jpg",
  tagline: "진한 요코하마식 이에케",
  ramenTypes: ["돈코츠"],
  tags: ["이에케", "농후 육수"],
  logCount: 128,
  bookmarkCount: 31,
  isBookmarked: true,
  businessStatus: "OPERATIONAL",
  isOpen: true,
  distanceMeters: 1204.6,
}

describe("id 변환", () => {
  it("문자열 id를 number로 바꾼다", () => {
    expect(toAppId("1204")).toBe(1204)
    expect(toWireId(1204)).toBe("1204")
  })

  it("앱 number에 안전하게 담기지 않는 id는 조용히 반올림하지 않고 오류를 낸다", () => {
    expect(() => toAppId("9007199254740993", "매장 id")).toThrow(/앱에서 다룰 수 없어요/)
    expect(() => toAppId("abc")).toThrow()
  })
})

describe("라멘로그", () => {
  it("점수·재방문·공개 범위를 앱 모양으로 바꾼다", () => {
    const log = toAppRamenLog(wireLog)

    expect(log.id).toBe(101)
    expect(log.shop).toEqual({ id: 7, name: "하쿠텐", branch: "연남점", location: "마포구" })
    expect(log.revisit).toBe("자주 감")
    expect(log.scores).toEqual({ satisfaction: 4, brothDensity: 5, noodleFirmness: 4, topping: 4, revisit: 5 })
    expect(log.isPublic).toBe(true)
    expect(log.likes).toBe(5)
    expect(log.isLiked).toBe(true)
    // 대표 사진은 첫 장이다
    expect(log.imageUrl).toBe("https://cdn.raota.app/logs/101-1.jpg")
    expect(log.photos).toEqual(wireLog.imageUrls)
    // 모르는 맛 태그 코드는 버린다
    expect(log.tasteNotes).toEqual({ broth: ["진해요"], noodle: ["단단해요"], seasoning: [], topping: [] })
    // 등급 이름표는 서버가 주지 않고 기록 수로 앱이 만든다
    expect(log.author).toEqual({ id: "77", name: "면발탐정", avatar: undefined, level: "라멘집 탐험가 (Lv.3)" })
    // 목록 응답에는 댓글이 없다(아직 모름)
    expect(log.comments).toBeUndefined()
    expect(log.commentCount).toBe(1)
  })

  it("사진이 없으면 대표 사진도 없다", () => {
    const log = toAppRamenLog({ ...wireLog, imageUrls: [] })
    expect(log.imageUrl).toBeNull()
    expect(log.photos).toEqual([])
  })

  it("점수가 없는 옛 기록은 앱에서도 점수가 없다", () => {
    expect(toAppRamenLog({ ...wireLog, scores: null, revisitIntention: "ONCE_IS_ENOUGH" }).scores).toBeUndefined()
  })

  it("재방문 점수는 재방문 의사에서 다시 계산한다", () => {
    const log = toAppRamenLog({ ...wireLog, revisitIntention: "SOMETIMES" })
    expect(log.revisit).toBe("가끔 생각남")
    expect(log.scores?.revisit).toBe(3)
  })

  it("비공개 기록은 isPublic이 false다", () => {
    expect(toAppRamenLog({ ...wireLog, visibility: "PRIVATE" }).isPublic).toBe(false)
  })

  it("재방문 의사는 한국어 표기 ⇄ enum을 오간다", () => {
    for (const option of ["자주 감", "가끔 생각남", "한번이면 충분"] as const) {
      expect(revisitFromWire(revisitToWire(option))).toBe(option)
    }
    expect(revisitToWire("자주 감")).toBe("OFTEN")
    expect(revisitFromWire("ONCE_IS_ENOUGH")).toBe("한번이면 충분")
  })

  it("상세 응답은 미리보기 댓글을 채운다", () => {
    const detail: RamenLogDetail = {
      ...wireLog,
      updatedAt: "2026-09-18T12:00:00Z",
      commentsPreview: [],
      commentsNextCursor: null,
    }

    expect(toAppRamenLog(detail).comments).toEqual([])
  })
})

describe("탈퇴한 회원", () => {
  it("글쓴이는 이름만 남고 id·등급은 비운다", () => {
    const log = toAppRamenLog({
      ...wireLog,
      author: { id: null, nickname: "탈퇴한 회원", avatarUrl: null, logCount: 0 },
    })

    expect(log.author.id).toBeUndefined()
    expect(log.author.name).toBe("탈퇴한 회원")
    expect(log.author.level).toBe("")
    expect(authorLevelLabel({ id: null, logCount: 12 })).toBe("")
    expect(authorLevelLabel({ id: "77", logCount: 0 })).toBe("라멘 입문자 (Lv.1)")
  })
})

describe("댓글", () => {
  const comments: RamenLogComment[] = [
    {
      id: "201",
      logId: "101",
      author,
      content: "마늘 넣어보셨어요?",
      createdAt: "2026-09-18T12:02:00Z",
      isMine: false,
    },
    {
      id: "202",
      logId: "101",
      author: { id: null, nickname: "탈퇴한 회원", avatarUrl: null, logCount: 0 },
      content: "저도 좋아해요",
      createdAt: "2026-09-18T12:10:00Z",
      isMine: false,
    },
  ]

  it("답글 없는 한 줄 댓글로 바꾼다", () => {
    const [first, second] = toAppRamenLogComments(comments)

    expect(first.id).toBe(201)
    expect(first.logId).toBe(101)
    expect(first.author).toEqual({ id: "77", name: "면발탐정", level: "라멘집 탐험가 (Lv.3)", avatar: null })
    expect(first.parentId).toBeUndefined()
    // 탈퇴한 회원은 숨기기·신고 대상이 되지 않도록 id를 비운다
    expect(second.author.id).toBe("")
    expect(second.author.level).toBe("")
  })
})

describe("기록 저장 본문", () => {
  const input: CreateRamenLogInput = {
    shopId: 7,
    menuName: "  특제 쇼유 라멘  ",
    ramenType: "쇼유",
    visitedAt: "2026-09-19",
    note: "",
    tasteNotes: { broth: ["진해요"], noodle: [], seasoning: ["딱 좋아요"], topping: [] },
    scores: { satisfaction: 4, brothDensity: 5, noodleFirmness: 4, topping: 3, revisit: 5 },
    revisit: "자주 감",
    isPublic: true,
    photos: ["file:///tmp/a.jpg"],
  }

  it("점수는 4축만 보내고 재방문은 의사로만, 사진은 업로드가 끝난 주소로 보낸다", () => {
    const body = toCreateRamenLogBody(input, { imageUrls: ["https://cdn.raota.app/logs/a.jpg"] })

    expect(body).toEqual({
      shopId: "7",
      visitedAt: "2026-09-19",
      menuName: "특제 쇼유 라멘",
      ramenType: "쇼유",
      scores: { satisfaction: 4, brothDensity: 5, noodleFirmness: 4, topping: 3 },
      revisitIntention: "OFTEN",
      note: "",
      tasteNoteCodes: ["BROTH_01", "SEASONING_01"],
      visibility: "PUBLIC",
      imageUrls: ["https://cdn.raota.app/logs/a.jpg"],
    })
    expect("revisit" in body.scores).toBe(false)
  })

  it("사진은 3장까지만 보낸다", () => {
    const body = toCreateRamenLogBody(input, { imageUrls: ["a", "b", "c", "d"] })
    expect(body.imageUrls).toEqual(["a", "b", "c"])
  })

  it("비공개 기록은 PRIVATE로 보낸다", () => {
    expect(toCreateRamenLogBody({ ...input, isPublic: false }).visibility).toBe("PRIVATE")
  })

  it("맛 태그는 코드와 이름표를 오간다", () => {
    const codes = toTasteNoteCodes(input.tasteNotes)
    expect(codes).toEqual(["BROTH_01", "SEASONING_01"])
    expect(toAppTasteNotes(codes)).toEqual({ broth: ["진해요"], noodle: [], seasoning: ["딱 좋아요"], topping: [] })
  })
})

describe("내 기록 요약", () => {
  const items: RamenLogSummaryItem[] = [
    {
      id: "1",
      visitedAt: "2026-09-10",
      shop: { id: "7", name: "하쿠텐", branchName: "연남점" },
      menuName: "이에케 라멘",
      ramenType: "돈코츠",
      scores: { satisfaction: 4, brothDensity: 5, noodleFirmness: 4, topping: 4, revisit: 5 },
    },
    {
      id: "2",
      visitedAt: "2026-09-18",
      shop: { id: "1", name: "멘야준", branchName: "망원 본점" },
      menuName: "특제 쇼유",
      ramenType: "쇼유",
      scores: { satisfaction: 3, brothDensity: 3, noodleFirmness: 3, topping: 3, revisit: 1 },
    },
    {
      id: "3",
      visitedAt: "2026-09-01",
      shop: { id: "1", name: "멘야준", branchName: "망원 본점" },
      menuName: "미소 라멘",
      ramenType: "미소",
      scores: null,
    },
  ]

  it("캘린더·방문 매장이 쓰는 그릇 목록(최신순)으로 바꾼다", () => {
    expect(toAppBowls(items)).toEqual([
      { date: "2026-09-18", shop: "멘야준", type: "쇼유", menu: "특제 쇼유" },
      { date: "2026-09-10", shop: "하쿠텐", type: "돈코츠", menu: "이에케 라멘" },
      { date: "2026-09-01", shop: "멘야준", type: "미소", menu: "미소 라멘" },
    ])
  })

  it("재방문 의사가 있는 그릇 수를 센다(서버에 필드가 없다)", () => {
    expect(revisitCountOf(items)).toBe(1)
  })
})

describe("매장", () => {
  it("목록 항목을 앱 Shop으로 바꾼다", () => {
    const shop = toAppShopSummary(wireShop)

    expect(shop.id).toBe(7)
    expect(shop.branch).toBe("연남점")
    expect(shop.tags).toEqual(["이에케", "농후 육수"])
    // 라멘로그 수를 매장 상세의 "라멘로그 N개" 자리에 쓴다(외부 평점은 계약에서 빠졌다)
    expect(shop.reviewCount).toBe(128)
    expect(shop.rating).toBe(0)
    expect(shop.reviews).toEqual([])
    expect(shop.distanceM).toBe(1205)
    expect(shop.isBookmarked).toBe(true)
    expect(shop.tagline).toBe("진한 요코하마식 이에케")
    expect(shop.unknownFields).toEqual([])
  })

  it("영업 중인지 모르면 '영업 정보 확인 필요'로 보이게 둔다", () => {
    const shop = toAppShopSummary({ ...wireShop, isOpen: null, latitude: null, longitude: null, distanceMeters: null })

    // 화면은 businessStatus로 문구를 고른다. OPERATIONAL + 모름이면 "준비 중"으로 단정하지 않는다
    expect(shop.businessStatus).toBe("UNKNOWN")
    expect(shop.isOpen).toBe(false)
    expect(shop.distanceM).toBe(0)
    expect(shop.unknownFields).toEqual(["isOpen", "location", "distance"])
  })

  it("영업 상태 표기를 화면이 읽는 값으로 바꾼다", () => {
    expect(toAppShopSummary({ ...wireShop, businessStatus: "TEMPORARILY_CLOSED" }).businessStatus).toBe("CLOSED_TEMPORARILY")
    expect(toAppShopSummary({ ...wireShop, businessStatus: "CLOSED" }).businessStatus).toBe("CLOSED_PERMANENTLY")
    expect(toAppShopSummary({ ...wireShop, businessStatus: "UNKNOWN" }).businessStatus).toBe("UNKNOWN")
    // 임시 휴업은 영업 여부를 몰라도 그대로 임시 휴업이다
    expect(toAppShopSummary({ ...wireShop, businessStatus: "TEMPORARILY_CLOSED", isOpen: null }).businessStatus).toBe(
      "CLOSED_TEMPORARILY",
    )
  })

  const wireDetail: ShopDetail = {
    ...wireShop,
    description: "요코하마식 이에케",
    phone: "02-000-0000",
    instagramUrl: "https://instagram.com/hakuten",
    reservationUrl: "https://app.catchtable.co.kr/ct/shop/hakuten",
    websiteUrl: "https://hakuten.example",
    naverPlaceId: "1234567890",
    kakaoPlaceId: "26338954",
    priceMin: 10000,
    priceMax: 15000,
    closedDaysText: "매주 월요일 휴무",
    hoursVerifiedAt: "2026-09-10T00:00:00Z",
    images: [{ url: "https://cdn.raota.app/shops/7-1.jpg" }],
    businessHours: [
      {
        dayOfWeek: 1,
        opensAt: "11:30:00",
        closesAt: "21:00:00",
        breakStart: "15:00:00",
        breakEnd: "17:00:00",
        lastOrderAt: "20:30:00",
        isClosed: false,
      },
      { dayOfWeek: 2, opensAt: null, closesAt: null, breakStart: null, breakEnd: null, lastOrderAt: null, isClosed: true },
    ],
    servicePerks: [],
    aiReviewSummary: "  진한 육수와 단단한 면이 좋다는 기록이 많아요.  ",
    aiSummaryKeywords: ["진한 육수", "단단한 면"],
    aiSummaryGeneratedAt: "2026-09-18T00:00:00Z",
    averageSatisfaction: 4.3,
  }

  it("상세는 링크·소개·가격대·영업시간을 채운다", () => {
    // 월요일에 보는 화면
    const shop = toAppShopDetail(wireDetail, new Date("2026-09-14T10:00:00+09:00"))

    expect(shop.naverMapId).toBe("1234567890")
    expect(shop.kakaoPlaceUrl).toBe("https://place.map.kakao.com/26338954")
    expect(shop.catchTableUrl).toBe("https://app.catchtable.co.kr/ct/shop/hakuten")
    expect(shop.instagramUrl).toBe("https://instagram.com/hakuten")
    expect(shop.websiteUri).toBe("https://hakuten.example")
    expect(shop.photos).toEqual(["https://cdn.raota.app/shops/7-1.jpg"])
    expect(shop.priceRange).toBe("₩10,000 ~ ₩15,000")
    expect(shop.rating).toBe(4.3)
    expect(shop.aiSummary).toEqual({
      text: "진한 육수와 단단한 면이 좋다는 기록이 많아요.",
      keywords: ["진한 육수", "단단한 면"],
      generatedAt: "2026-09-18",
    })
    expect(shop.openingHours).toEqual(["월요일: 11:30 ~ 15:00, 17:00 ~ 21:00", "화요일: 휴무"])
    expect(shop.lastOrder).toBe("20:30")
    expect(shop.closedDaysText).toBe("매주 월요일 휴무")
  })

  it("오늘 자리가 없으면 라스트오더를 지어내지 않는다", () => {
    // 수요일에는 영업시간 자료가 없다
    expect(todayLastOrder(wireDetail.businessHours, new Date("2026-09-16T10:00:00+09:00"))).toBeUndefined()
    // 화요일은 휴무라 라스트오더가 없다
    expect(todayLastOrder(wireDetail.businessHours, new Date("2026-09-15T10:00:00+09:00"))).toBeUndefined()
  })

  it("영업시간은 월요일부터 적고, 일요일은 7(ISO)과 0(JS) 둘 다 받아 준다", () => {
    const base = { breakStart: null, breakEnd: null, lastOrderAt: null, isClosed: false }
    expect(
      toOpeningHours([
        { ...base, dayOfWeek: 7, opensAt: "11:00", closesAt: "20:00" },
        { ...base, dayOfWeek: 6, opensAt: "11:00", closesAt: "21:00" },
        // 시간을 모르는 날은 아예 적지 않는다
        { ...base, dayOfWeek: 3, opensAt: null, closesAt: null },
      ]),
    ).toEqual(["토요일: 11:00 ~ 21:00", "일요일: 11:00 ~ 20:00"])

    expect(toOpeningHours([{ ...base, dayOfWeek: 0, opensAt: "11:00", closesAt: "20:00" }])).toEqual([
      "일요일: 11:00 ~ 20:00",
    ])
    expect(toOpeningHours([])).toEqual([])
  })

  it("가격대는 아는 쪽만 적는다", () => {
    expect(toPriceRange(9000, 9000)).toBe("₩9,000")
    expect(toPriceRange(9000, null)).toBe("₩9,000 ~")
    expect(toPriceRange(null, 15000)).toBe("~ ₩15,000")
    expect(toPriceRange(null, null)).toBeUndefined()
  })

  it("서비스 혜택은 무료·유료만 보여주고 모름·없음은 비운다", () => {
    expect(
      toServicePerks([
        { type: "NOODLE_REFILL", status: "FREE", price: null, conditionText: "1회", verifiedAt: null },
        { type: "RICE_REFILL", status: "PAID", price: 1000, conditionText: null, verifiedAt: null },
        { type: "SOUP_REFILL", status: "NOT_OFFERED", price: null, conditionText: null, verifiedAt: null },
        { type: "CONDIMENT", status: "UNKNOWN", price: null, conditionText: null, verifiedAt: null },
      ]),
    ).toEqual({ noodleRefill: "무료 · 1회", riceRefill: "유료 1,000원" })
    expect(toServicePerks([])).toBeUndefined()
  })

  it("지도 핀은 좌표를 모르면 표시해 둔다", () => {
    expect(
      toAppMapPin({ id: "7", name: "하쿠텐", branchName: "연남점", latitude: 37.5, longitude: 126.9, ramenTypes: ["돈코츠"], isOpen: null }),
    ).toEqual({
      id: 7,
      name: "하쿠텐",
      branch: "연남점",
      lat: 37.5,
      lng: 126.9,
      ramenTypes: ["돈코츠"],
      isOpen: false,
      unknownFields: ["isOpen"],
    })
  })
})

describe("회원", () => {
  const member: MemberMe = {
    id: "9001",
    nickname: "뿡",
    email: "bbung@raota.net",
    avatarUrl: null,
    bio: "진한 육수 좋아요",
    favoriteRamenType: "돈코츠",
    status: "ACTIVE",
    logCount: 42,
    onboardingCompletedAt: "2026-05-01T00:00:00Z",
  }

  it("등급은 기록 수로 계산하고 온보딩 여부를 함께 만든다", () => {
    const { profile, onboardingCompleted } = toAppMember(member, { revisitCount: 28 })

    expect(profile.id).toBe("9001")
    expect(profile.level).toBe("라멘집 단골")
    expect(profile.levelNumber).toBe(4)
    expect(profile.visitedCount).toBe(42)
    expect(profile.revisitCount).toBe(28)
    expect(profile.membershipNo).toBe("#RT-9001")
    expect(profile.isLoggedIn).toBe(true)
    expect(onboardingCompleted).toBe(true)
  })

  it("온보딩 중인 계정은 닉네임이 비어 있고 온보딩이 끝나지 않았다", () => {
    const { profile, onboardingCompleted } = toAppMember({
      ...member,
      nickname: null,
      status: "ONBOARDING",
      onboardingCompletedAt: null,
    })

    expect(profile.nickname).toBe("")
    expect(profile.name).toBe("")
    expect(profile.revisitCount).toBe(0)
    expect(onboardingCompleted).toBe(false)
  })
})
