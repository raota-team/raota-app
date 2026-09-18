import type { Shop } from "../types"

/**
 * 앱 전체가 공유하는 매장 원장. 상세, 지도, 기록, 알림, 찜은 모두 이 id와 이름을 쓴다.
 * 확인되지 않은 정보(전화, 링크, 리뷰, 영업시간, 혜택)는 비워 두고 화면이 빈 상태를 보여준다.
 * 다른 매장의 정보를 빌려 채우지 않는다.
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

export const SHOP_CATALOG: ShopCatalogItem[] = [
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
