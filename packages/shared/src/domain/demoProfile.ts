import type { TasteProfile, UserProfile } from "../types"

/**
 * 데모 계정(뿡)의 단일 기록 원장.
 * 마이, 월별 리포트, 종합 리포트, 기록 완료 화면의 모든 숫자는 여기서 파생한다.
 */
export const DEMO_MONTHLY_RECORD_COUNTS: Record<string, number> = {
  '2026-03': 4,
  '2026-04': 5,
  '2026-05': 7,
  '2026-06': 7,
  '2026-07': 9,
  '2026-08': 8,
  '2026-09': 2,
}

/** 위 월별 합계. 신규 기록은 App 상태에서 더해진다. */
export const DEMO_TOTAL_BOWLS = Object.values(DEMO_MONTHLY_RECORD_COUNTS).reduce((sum, count) => sum + count, 0)

/** 누적 그릇의 라멘 종류 분포. 합계는 DEMO_TOTAL_BOWLS와 같다. */
export const DEMO_TYPE_COUNTS: Record<string, number> = {
  돈코츠: 14,
  쇼유: 12,
  시오: 8,
  미소: 4,
  기타: 4,
}

/** 기존 42그릇의 5축 평균. 신규 기록은 mergeProfile로 합쳐진다. */
export const DEMO_BASE_PROFILE: TasteProfile = {
  count: DEMO_TOTAL_BOWLS,
  scores: {
    satisfaction: 4.3,
    brothDensity: 3.9,
    noodleFirmness: 4.0,
    topping: 4.1,
    revisit: 3.7,
  },
}

export const DEMO_SAVED_SHOP_NAMES = ['멘야준', '오레노라멘', '묘코', '세상끝의라멘']

/** 데모 계정. 로그인 화면의 데모 로그인과 앱 초기 상태가 같은 객체를 쓴다. */
export const DEMO_USER: UserProfile = {
  id: 'user-demo',
  name: '뿡',
  nickname: '뿡',
  email: 'bbung@raota.net',
  avatar: null,
  level: '라멘집 단골',
  levelNumber: 4,
  membershipNo: '#RT-0842',
  bio: '12시간 농축 동물계 육수와 꼬들한 면을 애호합니다.',
  favoriteRamenType: '돈코츠',
  visitedCount: DEMO_TOTAL_BOWLS,
  revisitCount: 28,
  isLoggedIn: true,
}
