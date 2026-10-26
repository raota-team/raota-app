/*
 * 기능 스위치. 출시에 아직 내보내지 않는 기능은 진입점만 막고 코드는 main에 남긴다.
 * Metro는 process.env.EXPO_PUBLIC_*를 "글자 그대로 쓴 자리"에서만 값으로 바꾸므로 구조 분해나 동적 키로 읽지 않는다.
 */

/**
 * 취향 리포트(/taste, 월간 리포트 보관함). "true"일 때만 켠다(사용자 결정 2026.10.26, 출시 빌드는 숨김).
 * 기본이 꺼짐이라 출시 빌드에서 값을 빠뜨려도 리포트가 새어 나가지 않는다.
 * 꺼져 있으면 마이 탭 입구, 기록 완료 화면 버튼, /taste 주소(딥링크 포함), 월간 리포트 알림이 모두 사라진다.
 */
export const TASTE_REPORT_ENABLED = process.env.EXPO_PUBLIC_FEATURE_TASTE_REPORT?.trim() === "true"
