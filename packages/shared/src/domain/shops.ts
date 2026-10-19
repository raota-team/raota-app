import type { Shop } from "../types"

/**
 * 앱 전체가 공유하는 매장 원장. 상세, 지도, 기록, 알림, 찜은 모두 이 id와 이름을 쓴다.
 * SHOP_LEDGER에는 확인된 정보만 둔다(전화, 링크, 리뷰, 영업시간, 혜택은 모르면 비워 둔다).
 *
 * 서버가 아직 없어서, 화면이 정보가 다 찬 상태에서 어떻게 보이는지 확인하려고 SHOP_CATALOG에 DEMO_DETAILS를 덧입힌다.
 * DEMO_DETAILS는 전부 지어낸 값이다(전화는 실제로 쓰지 않는 070-0000 국번, 링크는 raota_demo_ 계정).
 * 서버 매장 API를 붙일 때 DEMO_DETAILS와 덧입히는 줄을 함께 지우면 SHOP_CATALOG가 SHOP_LEDGER와 같아진다.
 */

const PHOTO = {
  shoyu: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=800&h=600&fit=crop&auto=format&q=80',
  paitan: 'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=800&h=600&fit=crop&auto=format&q=80',
  miso: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=800&h=600&fit=crop&auto=format&q=80',
}

export interface ShopCatalogItem extends Shop {
  /** 대표 스타일(지도 필터, 월별 분포에 쓰는 이름) */
  style: string
  /** 지도 핀 한 글자 */
  pinLabel: string
  /** 한 줄 특징 */
  spec: string
  /** 오늘 라스트오더. 모르면 undefined */
  lastOrder?: string
}

const unknownShop = {
  phone: undefined,
  rating: 0,
  reviewCount: 0,
  openingHours: [] as string[],
  dineIn: true,
  delivery: false,
  reservable: false,
  reviews: [] as Shop['reviews'],
}

/** 확인된 정보만 담은 원장. 정보가 빈 매장의 빈 상태를 확인할 때도 이것을 쓴다 */
export const SHOP_LEDGER: ShopCatalogItem[] = [
  {
    id: 1,
    name: '멘야준',
    branch: '망원 본점',
    style: '쇼유 라멘',
    pinLabel: '준',
    spec: '자가제면 · 닭과 오리 더블 육수',
    address: '서울 마포구 동교로 128 (망원역 2번 출구 420m)',
    lat: 37.5559,
    lng: 126.9114,
    phone: '070-7798-2512',
    rating: 4.6,
    reviewCount: 482,
    businessStatus: 'OPERATIONAL',
    isOpen: true,
    lastOrder: '20:30',
    openingHours: [
      '월요일: 11:30 ~ 21:00',
      '화요일: 11:30 ~ 21:00',
      '수요일: 11:30 ~ 21:00',
      '목요일: 11:30 ~ 21:00',
      '금요일: 11:30 ~ 21:00',
      '토요일: 11:30 ~ 21:00',
      '일요일: 11:30 ~ 21:00',
    ],
    priceRange: '₩10,000 ~ ₩15,000',
    dineIn: true,
    delivery: false,
    reservable: false,
    googleMapsUri: 'https://maps.google.com/?q=멘야준+망원',
    websiteUri: 'https://instagram.com/menyajun_official',
    instagramUrl: 'https://instagram.com/menyajun_official',
    catchTableUrl: 'https://app.catchtable.co.kr/ct/shop/menyajun',
    photos: [PHOTO.shoyu, PHOTO.paitan, PHOTO.miso],
    tags: ['정통 쇼유 계보', '자가제면 1.5mm', '동물계와 해산물 더블', '매장 식사 가능'],
    matchScore: 91,
    distanceM: 420,
    servicePerks: {
      noodleRefill: '1회 무료 리필 가능',
      riceRefill: '요청 시 무료 제공',
    },
    description: '진한 동물계 육수 및 단단한 자가제면 식감을 자랑하며, 맑은 쇼유 타레 특유의 높은 감칠맛을 보유하고 있는 망원동의 대표 라멘집입니다.',
    // 더미: 서버 AI 요약이 붙으면 이 값을 그대로 받는다
    aiSummary: {
      text: '국물이 진하면서도 쇼유 향이 깔끔하게 남는다는 기록이 가장 많아요. 1.5mm 자가제면은 단단한 편이라 면을 중시하는 분들이 자주 추천하고, 주말 점심에는 웨이팅이 길다는 이야기가 이어져요.',
      keywords: ['진한 육수', '단단한 면', '주말 웨이팅'],
      generatedAt: '2026-09-18',
    },
    reviews: [
      {
        author: '하니 (라멘마니아)',
        level: '8레벨',
        rating: 5,
        text: '첫 모금부터 닭과 오리 육수의 깊은 감칠맛이 폭발합니다. 단단한 자가제면 스트레이트 면 식감이 예술이네요.',
        time: '3일 전',
      },
      {
        author: '멘덕후',
        level: '12레벨',
        rating: 5,
        text: '수비드 차슈가 부드럽고 국물 염도가 딱 맞습니다. 망원동 일대 쇼유 라멘 중 가장 완성도가 높습니다.',
        time: '1주 전',
      },
      {
        author: '구글 로컬 가이드',
        level: 'Lv.6 가이드',
        rating: 4,
        text: '깔끔한 매장 분위기와 친절한 접객. 웨이팅이 조금 있지만 회전율이 빨라 금방 입장했습니다.',
        time: '2주 전',
      },
    ],
  },
  {
    ...unknownShop,
    id: 2,
    name: '후쿠 라멘',
    branch: '합정점',
    style: '미소 라멘',
    pinLabel: '후',
    spec: '진한 삿포로 적된장 육수',
    address: '서울 마포구 독막로 18 (합정역 도보 680m)',
    lat: 37.5492,
    lng: 126.915,
    businessStatus: 'OPERATIONAL',
    isOpen: true,
    lastOrder: '21:00',
    photos: [PHOTO.miso],
    tags: ['삿포로 미소', '불향 채소', '치지레멘'],
    matchScore: 82,
    distanceM: 680,
    description: '볶은 채소의 불향과 진한 된장 타레, 탄력 있는 치지레멘이 조화를 이루는 삿포로식 미소 라멘집입니다.',
  },
  {
    ...unknownShop,
    id: 3,
    name: '오레노라멘',
    branch: '마포 본점',
    style: '토리파이탄',
    pinLabel: '오',
    spec: '닭백탕 · 미쉐린 빕구르망',
    address: '서울 마포구 독막로6길 14 (합정역 도보 1.4km)',
    lat: 37.5484,
    lng: 126.9208,
    businessStatus: 'OPERATIONAL',
    isOpen: true,
    lastOrder: '20:00',
    photos: [PHOTO.paitan],
    tags: ['토리파이탄', '닭백탕', '수비드 차슈'],
    matchScore: 75,
    distanceM: 1400,
    description: '곱게 거품 낸 농후한 닭 육수와 부드러운 수비드 차슈로 사랑받는 토리파이탄 전문점입니다.',
    // 더미: 서버 AI 요약이 붙으면 이 값을 그대로 받는다
    aiSummary: {
      text: '거품 낸 닭 육수가 크리미하고 묵직하다는 평이 많고, 수비드 차슈가 부드럽다는 기록이 자주 보여요. 간이 센 편이라 밥을 곁들이는 분들이 많아요.',
      keywords: ['크리미한 닭 육수', '수비드 차슈', '간은 센 편'],
      generatedAt: '2026-09-18',
    },
  },
  {
    ...unknownShop,
    id: 4,
    name: '세상끝의라멘',
    branch: '합정점',
    style: '쇼유 라멘',
    pinLabel: '세',
    spec: '오사카식 블랙 쇼유와 차슈 덮밥',
    address: '서울 마포구 양화로 7길 (합정역 도보 850m)',
    lat: 37.5502,
    lng: 126.9135,
    businessStatus: 'OPERATIONAL',
    isOpen: true,
    lastOrder: '20:30',
    photos: [PHOTO.shoyu],
    tags: ['블랙 쇼유', '오사카식', '두툼한 차슈'],
    matchScore: 88,
    distanceM: 850,
    description: '진한 간장 타레의 향과 두툼한 차슈가 인상적인 오사카식 블랙 쇼유 라멘집입니다.',
  },
  {
    ...unknownShop,
    id: 5,
    name: '묘코',
    branch: '연남점',
    style: '쇼유 라멘',
    pinLabel: '묘',
    spec: '깔끔한 청탕 오리 육수',
    address: '서울 마포구 동교로 39길 (연남동 1.1km)',
    lat: 37.562,
    lng: 126.924,
    businessStatus: 'OPERATIONAL',
    isOpen: false,
    lastOrder: '20:30',
    photos: [PHOTO.miso],
    tags: ['오리 청탕', '맑은 육수', '쇼유'],
    matchScore: 78,
    distanceM: 1100,
    description: '오리의 감칠맛을 맑게 끌어낸 청탕과 섬세한 쇼유 타레가 돋보이는 연남동 라멘집입니다.',
  },
  {
    ...unknownShop,
    id: 6,
    name: '멘지',
    branch: '망원 본점',
    style: '토리파이탄',
    pinLabel: '멘',
    spec: '극상의 진한 닭백탕 육수',
    address: '서울 마포구 망원동',
    lat: 37.5562,
    lng: 126.9065,
    businessStatus: 'OPERATIONAL',
    isOpen: true,
    lastOrder: '20:00',
    photos: [PHOTO.paitan],
    tags: ['토리파이탄', '자가제면'],
    matchScore: 84,
    distanceM: 550,
  },
  {
    ...unknownShop,
    id: 7,
    name: '하쿠텐',
    branch: '연남점',
    style: '돈코츠 라멘',
    pinLabel: '하',
    spec: '진한 요코하마식 이에케 라멘',
    address: '서울 마포구 연남동',
    lat: 37.5612,
    lng: 126.9255,
    businessStatus: 'OPERATIONAL',
    isOpen: true,
    lastOrder: '20:30',
    photos: [PHOTO.paitan],
    tags: ['이에케', '돈코츠', '농후 육수'],
    matchScore: 93,
    distanceM: 1200,
  },
  {
    ...unknownShop,
    id: 8,
    name: '담택',
    branch: '합정점',
    style: '시오 라멘',
    pinLabel: '담',
    spec: '깔끔한 닭육수 유자 시오 라멘',
    address: '서울 마포구 합정동',
    lat: 37.551,
    lng: 126.916,
    businessStatus: 'OPERATIONAL',
    isOpen: true,
    lastOrder: '20:00',
    photos: [PHOTO.shoyu],
    tags: ['유자 시오', '닭 청탕'],
    matchScore: 89,
    distanceM: 720,
  },
  {
    ...unknownShop,
    id: 9,
    name: '이리에라멘',
    branch: '망원점',
    style: '시오 라멘',
    pinLabel: '이',
    spec: '도미 뼈로 우려낸 감칠맛 도미 시오',
    address: '서울 마포구 망원동',
    lat: 37.5548,
    lng: 126.908,
    businessStatus: 'OPERATIONAL',
    isOpen: true,
    lastOrder: '20:30',
    photos: [PHOTO.miso],
    tags: ['도미 시오', '해산물 육수'],
    matchScore: 87,
    distanceM: 490,
  },
  {
    ...unknownShop,
    id: 10,
    name: '무타히로',
    branch: '홍대점',
    style: '쇼유 라멘',
    pinLabel: '무',
    spec: '멸치(니보시) 육수의 깊은 감칠맛',
    address: '서울 마포구 서교동',
    lat: 37.557,
    lng: 126.929,
    businessStatus: 'OPERATIONAL',
    isOpen: false,
    lastOrder: '20:30',
    photos: [PHOTO.shoyu],
    tags: ['니보시', '쇼유'],
    matchScore: 81,
    distanceM: 1500,
  },
]

const demoLinks = (handle: string, reservable = false) => ({
  instagramUrl: `https://instagram.com/raota_demo_${handle}`,
  catchTableUrl: reservable ? `https://app.catchtable.co.kr/ct/shop/raota_demo_${handle}` : undefined,
  reservable,
})
const everyDay = (hours: string) => ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'].map(day => `${day}: ${hours}`)
const withDayOff = (hours: string, ...offDays: string[]) =>
  everyDay(hours).map(line => (offDays.some(day => line.startsWith(day)) ? `${line.split(':')[0]}: 정기 휴무` : line))

/** 화면 확인용 더미 상세. 위 주석대로 서버 연결 때 지운다 */
const DEMO_DETAILS: Record<number, Partial<ShopCatalogItem>> = {
  // 멘야준은 원장에 확인된 정보가 거의 다 있다. 비어 있던 혜택 두 칸만 채운다
  1: {
    servicePerks: { noodleRefill: '1회 무료 리필 가능', riceRefill: '요청 시 무료 제공', soupRefill: '육수 추가 1,000원', condiments: '흑후추 · 시치미 · 다진 생강' },
  },
  2: {
    phone: '070-0000-0102',
    rating: 4.4,
    reviewCount: 213,
    openingHours: withDayOff('11:30 ~ 21:30', '월요일'),
    priceRange: '₩11,000 ~ ₩14,000',
    ...demoLinks('fuku'),
    photos: [PHOTO.miso, PHOTO.shoyu, PHOTO.paitan],
    tags: ['삿포로 미소', '불향 채소', '치지레멘', '매장 식사 가능'],
    servicePerks: { noodleRefill: '추가 1,500원', riceRefill: '1회 무료', soupRefill: '요청 시 무료', condiments: '다진 마늘 · 고추기름 셀프' },
    aiSummary: {
      text: '볶은 채소의 불향이 국물에 그대로 배어 있다는 기록이 많아요. 꼬불한 치지레멘이 국물을 잘 머금고, 간이 진한 편이라 공깃밥을 곁들이는 분이 많아요.',
      keywords: ['불향 채소', '진한 미소', '공깃밥 추천'],
      generatedAt: '2026-10-12',
    },
    reviews: [
      { author: '삿포로덕후', level: '라멘 미식가 (Lv.5)', rating: 5, text: '숙주와 양배추를 센 불에 볶아 올려서 첫 입부터 불향이 확 나요. 버터 토핑 추가 추천.', time: '4일 전' },
      { author: '합정야식러', level: '라멘 입문자 (Lv.2)', rating: 4, text: '국물이 꽤 짜서 밥이 필요했어요. 면 식감은 최고.', time: '2주 전' },
    ],
  },
  3: {
    phone: '070-0000-0103',
    rating: 4.7,
    reviewCount: 896,
    openingHours: everyDay('11:00 ~ 15:00, 17:00 ~ 21:00'),
    priceRange: '₩11,000 ~ ₩16,000',
    ...demoLinks('oreno', true),
    photos: [PHOTO.paitan, PHOTO.shoyu, PHOTO.miso],
    tags: ['토리파이탄', '닭백탕', '수비드 차슈', '미쉐린 빕구르망'],
    servicePerks: { noodleRefill: '카에다마 2,000원', riceRefill: '무료', soupRefill: '진한 육수 추가 1,000원', condiments: '후추 · 유자 고추 · 생강 절임' },
    reviews: [
      { author: '닭육수연구소', level: '라멘 장인 (Lv.7)', rating: 5, text: '거품 낸 닭 육수가 카푸치노처럼 부드러워요. 수비드 차슈 두 종류가 다 좋습니다.', time: '1일 전' },
      { author: '면발탐정', level: '라멘집 탐험가 (Lv.3)', rating: 4, text: '점심 웨이팅 40분. 회전은 빠른 편이에요.', time: '1주 전' },
    ],
  },
  4: {
    address: '서울 마포구 양화로7길 21 (합정역 도보 850m)',
    phone: '070-0000-0104',
    rating: 4.3,
    reviewCount: 157,
    openingHours: withDayOff('11:30 ~ 21:00', '월요일'),
    priceRange: '₩10,000 ~ ₩15,000 (차슈 덮밥 세트 포함)',
    ...demoLinks('sekainohate'),
    photos: [PHOTO.shoyu, PHOTO.paitan, PHOTO.miso],
    tags: ['블랙 쇼유', '오사카식', '두툼한 차슈', '차슈 덮밥'],
    servicePerks: { noodleRefill: '추가 1,000원', riceRefill: '미니 차슈 덮밥 3,000원', soupRefill: '요청 시 무료', condiments: '흑후추 · 다진 양파' },
    aiSummary: {
      text: '검은 국물만큼 간장 향이 진하고 짭짤하다는 기록이 많아요. 두툼한 차슈와 차슈 덮밥 세트를 함께 시키는 분들이 대부분이에요.',
      keywords: ['진한 간장 향', '짭짤한 편', '차슈 덮밥 세트'],
      generatedAt: '2026-10-09',
    },
    reviews: [
      { author: '간장파', level: '라멘 미식가 (Lv.5)', rating: 4, text: '보기보다 짜지 않고 고소해요. 차슈가 정말 두껍습니다.', time: '5일 전' },
      { author: '국물한모금', level: '라멘 미식가 (Lv.5)', rating: 4, text: '덮밥 세트 가성비가 좋아요. 국물은 반만 마시게 되는 간.', time: '3주 전' },
    ],
  },
  5: {
    address: '서울 마포구 동교로39길 12 (연남동 1.1km)',
    phone: '070-0000-0105',
    rating: 4.5,
    reviewCount: 341,
    openingHours: withDayOff('12:00 ~ 15:00, 17:30 ~ 21:00', '월요일', '화요일'),
    priceRange: '₩12,000 ~ ₩16,000',
    ...demoLinks('myoko', true),
    photos: [PHOTO.miso, PHOTO.shoyu, PHOTO.paitan],
    tags: ['오리 청탕', '맑은 육수', '쇼유', '예약 가능'],
    servicePerks: { noodleRefill: '추가 1,500원', riceRefill: '오리 기름밥 2,000원', soupRefill: '요청 시 무료', condiments: '산초 · 유자 껍질' },
    aiSummary: {
      text: '맑은 오리 육수가 가볍지만 끝맛이 길다는 기록이 많아요. 저녁에만 나오는 오리 기름밥을 함께 추천하는 분이 많고, 월·화는 쉬어요.',
      keywords: ['맑은 오리 육수', '오리 기름밥', '월·화 휴무'],
      generatedAt: '2026-10-14',
    },
    reviews: [
      { author: '청탕러버', level: '라멘 장인 (Lv.7)', rating: 5, text: '오리 향이 은은하게 올라오는 청탕. 유자 껍질 조금 뿌려 먹으니 완벽.', time: '2일 전' },
      { author: '연남산책', level: '라멘 입문자 (Lv.2)', rating: 4, text: '양이 적은 편이라 기름밥 꼭 같이 드세요.', time: '1주 전' },
    ],
  },
  6: {
    address: '서울 마포구 망원로 54 (망원역 도보 550m)',
    phone: '070-0000-0106',
    rating: 4.5,
    reviewCount: 402,
    openingHours: withDayOff('11:30 ~ 20:30', '일요일'),
    priceRange: '₩11,000 ~ ₩14,000',
    ...demoLinks('menji'),
    photos: [PHOTO.paitan, PHOTO.miso, PHOTO.shoyu],
    tags: ['토리파이탄', '자가제면', '농후 닭육수'],
    servicePerks: { noodleRefill: '1회 무료', riceRefill: '요청 시 무료', soupRefill: '육수 추가 1,000원', condiments: '후추 · 고추냉이' },
    description: '닭 뼈를 오래 끓여 걸쭉하게 만든 닭백탕에 직접 뽑은 중간 굵기 면을 쓰는 망원동 토리파이탄 집입니다.',
    aiSummary: {
      text: '닭백탕이 걸쭉해서 면에 잘 붙는다는 기록이 많아요. 자가제면이 쫄깃하고, 1회 무료 면 리필로 양이 넉넉하다는 이야기가 이어져요.',
      keywords: ['걸쭉한 닭백탕', '쫄깃한 자가제면', '면 리필 무료'],
      generatedAt: '2026-10-10',
    },
    reviews: [
      { author: '면사리추가', level: '라멘집 탐험가 (Lv.3)', rating: 5, text: '면 리필이 무료라 두 번 먹었어요. 국물이 진해서 끝까지 맛있음.', time: '6일 전' },
      { author: '망원주민', level: '라멘 입문자 (Lv.2)', rating: 4, text: '일요일에 쉬는 거 모르고 갔다가 헛걸음. 평일엔 웨이팅 짧아요.', time: '2주 전' },
    ],
  },
  7: {
    address: '서울 마포구 성미산로 161 (연남동 1.2km)',
    phone: '070-0000-0107',
    rating: 4.6,
    reviewCount: 1024,
    openingHours: everyDay('11:00 ~ 21:00'),
    priceRange: '₩10,500 ~ ₩14,500',
    ...demoLinks('hakuten'),
    photos: [PHOTO.paitan, PHOTO.shoyu, PHOTO.miso],
    tags: ['이에케', '돈코츠 쇼유', '농후 육수', '밥 무료'],
    servicePerks: { noodleRefill: '추가 1,500원', riceRefill: '무료 무제한', soupRefill: '농도·기름·면 굵기 조절', condiments: '다진 마늘 · 두반장 · 식초 · 생강' },
    description: '돼지 뼈와 간장 타레를 섞은 요코하마식 이에케 라멘을 내는 곳으로, 면·기름·농도를 취향대로 고를 수 있습니다.',
    aiSummary: {
      text: '진하고 기름진 이에케 국물에 밥을 말아 먹는다는 기록이 가장 많아요. 면 단단하게, 기름 보통으로 주문하는 조합이 자주 추천돼요.',
      keywords: ['진한 이에케', '밥 무제한', '면·기름 조절'],
      generatedAt: '2026-10-15',
    },
    reviews: [
      { author: '면발탐정', level: '라멘집 탐험가 (Lv.3)', rating: 5, text: '김 세 장에 밥까지. 마늘 넣으면 완전히 다른 맛이 돼요.', time: '어제' },
      { author: '돈코츠중독', level: '라멘 미식가 (Lv.5)', rating: 4, text: '기름 많이로 시켰더니 조금 느끼했어요. 보통 추천.', time: '1주 전' },
    ],
  },
  8: {
    address: '서울 마포구 양화로 45 (합정역 도보 720m)',
    phone: '070-0000-0108',
    rating: 4.4,
    reviewCount: 268,
    openingHours: ['월요일', '화요일', '수요일', '목요일', '금요일'].map(day => `${day}: 11:30 ~ 15:00, 17:00 ~ 20:30`).concat(['토요일: 11:30 ~ 20:30', '일요일: 11:30 ~ 20:30']),
    priceRange: '₩10,000 ~ ₩13,000',
    ...demoLinks('damtaek'),
    photos: [PHOTO.shoyu, PHOTO.miso, PHOTO.paitan],
    tags: ['유자 시오', '닭 청탕', '깔끔한 국물'],
    servicePerks: { noodleRefill: '추가 1,000원', riceRefill: '유자 주먹밥 1,500원', soupRefill: '요청 시 무료', condiments: '유자 후추 · 시치미' },
    description: '맑은 닭 육수에 소금 타레와 유자 껍질을 더해 산뜻하게 마무리하는 시오 라멘집입니다.',
    aiSummary: {
      text: '국물이 맑고 유자 향이 산뜻해서 해장으로 찾는다는 기록이 많아요. 간이 약한 편이라 짠맛을 싫어하는 분들이 자주 추천해요.',
      keywords: ['유자 향', '맑은 닭 육수', '슴슴한 간'],
      generatedAt: '2026-10-11',
    },
    reviews: [
      { author: '해장전문', level: '라멘 미식가 (Lv.5)', rating: 5, text: '전날 과음하고 가면 최고. 유자 향이 정말 깔끔해요.', time: '3일 전' },
      { author: '짠맛파', level: '라멘 입문자 (Lv.2)', rating: 3, text: '저한텐 좀 싱거웠어요. 유자 후추 넣으니 나아짐.', time: '3주 전' },
    ],
  },
  9: {
    address: '서울 마포구 포은로 88 (망원역 도보 490m)',
    phone: '070-0000-0109',
    rating: 4.5,
    reviewCount: 289,
    openingHours: withDayOff('12:00 ~ 21:00', '화요일'),
    priceRange: '₩12,000 ~ ₩15,000',
    ...demoLinks('irie', true),
    photos: [PHOTO.miso, PHOTO.shoyu, PHOTO.paitan],
    tags: ['도미 시오', '해산물 육수', '도미 밥'],
    servicePerks: { noodleRefill: '추가 1,500원', riceRefill: '도미 오차즈케 2,500원', soupRefill: '오차즈케용 육수 무료', condiments: '유자 껍질 · 와사비' },
    description: '도미 뼈를 구워 우려낸 육수에 소금 타레를 맞춘 해산물 시오 라멘집입니다. 남은 국물로 오차즈케를 말아 먹을 수 있습니다.',
    aiSummary: {
      text: '도미 뼈 육수가 맑은데도 감칠맛이 길게 남는다는 기록이 많아요. 마지막에 남은 국물로 오차즈케를 말아 먹는 코스를 많이 추천해요.',
      keywords: ['도미 육수', '맑지만 진한 감칠맛', '오차즈케 마무리'],
      generatedAt: '2026-10-13',
    },
    reviews: [
      { author: '국물한모금', level: '라멘 미식가 (Lv.5)', rating: 5, text: '도미 뼈 육수가 맑은데도 끝맛이 길어요. 유자 껍질이 포인트.', time: '1주 전' },
      { author: '바다사람', level: '라멘집 탐험가 (Lv.3)', rating: 4, text: '오차즈케까지 먹어야 완성. 화요일 휴무 주의.', time: '2주 전' },
    ],
  },
  10: {
    address: '서울 마포구 와우산로 112 (홍대입구역 도보 1.5km)',
    phone: '070-0000-0110',
    rating: 4.3,
    reviewCount: 512,
    openingHours: withDayOff('11:30 ~ 15:00, 17:00 ~ 21:00', '월요일'),
    priceRange: '₩10,000 ~ ₩13,500',
    ...demoLinks('mutahiro'),
    photos: [PHOTO.shoyu, PHOTO.paitan, PHOTO.miso],
    tags: ['니보시', '쇼유', '두꺼운 멘마'],
    servicePerks: { noodleRefill: '추가 1,000원', riceRefill: '니보시 밥 2,000원', soupRefill: '진한 니보시 추가 1,000원', condiments: '다진 양파 · 흑후추' },
    description: '말린 멸치(니보시)를 듬뿍 우려 쓴맛과 감칠맛을 함께 살린 쇼유 라멘집입니다.',
    aiSummary: {
      text: '멸치 향이 첫 모금부터 강하게 올라와 호불호가 갈린다는 기록이 많아요. 두껍고 아삭한 멘마를 따로 추가하는 분이 많아요.',
      keywords: ['강한 니보시 향', '호불호', '두꺼운 멘마'],
      generatedAt: '2026-10-08',
    },
    reviews: [
      { author: '멘마수집가', level: '라멘 미식가 (Lv.5)', rating: 4, text: '니보시 좋아하면 무조건. 멘마 추가는 필수예요.', time: '2주 전' },
      { author: '라멘초보', level: '라멘 입문자 (Lv.2)', rating: 3, text: '멸치 향이 생각보다 세서 저는 반쯤 먹었어요.', time: '1달 전' },
    ],
  },
}

export const SHOP_CATALOG: ShopCatalogItem[] = SHOP_LEDGER.map(shop => ({ ...shop, ...DEMO_DETAILS[shop.id] }))

const ALIASES: Record<string, string> = {
  '하쿠텐 라멘': '하쿠텐',
  후쿠라멘: '후쿠 라멘',
}

export function findShopByName(name: string): ShopCatalogItem | undefined {
  const canonical = ALIASES[name] ?? name
  return SHOP_CATALOG.find(shop => shop.name === canonical)
}

export function findShopById(id: number): ShopCatalogItem | undefined {
  return SHOP_CATALOG.find(shop => shop.id === id)
}

/** 원장에 없는 가게는 이름만 있는 최소 정보로 만든다. 다른 가게 정보를 빌리지 않는다. */
export function getShopDetail(name: string): ShopCatalogItem {
  const found = findShopByName(name)
  if (found) return found
  return {
    ...unknownShop,
    id: 0,
    name,
    style: '라멘',
    pinLabel: name.slice(0, 1),
    spec: '',
    address: '',
    lat: 0,
    lng: 0,
    businessStatus: 'UNKNOWN',
    isOpen: false,
    photos: [],
    tags: [],
    matchScore: 0,
    distanceM: 0,
  }
}
