/**
 * 제품 분석 이벤트. MVP의 핵심 지표(7일 안에 두 번째 기록, D1·D7 리텐션)를 재기 위한 최소 목록이다.
 * 전송은 PostHog(./posthog.ts)가 맡는다. 키가 없으면 보내지 않는다. 도구를 바꾸면 setAnalyticsSink만 바꾸고 개인정보 라벨·처리방침을 맞춘다.
 * 이벤트 속성에는 개인정보(이메일, 메모 본문, 사진 경로)를 넣지 않는다.
 */
export type AnalyticsEvent =
  | "app_open"
  | "sign_up"
  | "login"
  | "shop_viewed"
  | "bookmark_toggled"
  | "record_started"
  | "record_saved"
  | "report_viewed"
  | "ai_recommend_requested"
  | "reminder_scheduled"
  | "reminder_opened"
  // 라운지(라멘로그 피드). 속성에는 기록·댓글 id나 본문을 넣지 않는다
  | "lounge_viewed"
  | "log_liked"
  | "log_commented"
  | "content_reported"
  | "author_hidden"

export type AnalyticsProps = Record<string, string | number | boolean | null>

type Sink = (event: AnalyticsEvent, props: AnalyticsProps) => void

let sink: Sink | null = null

export function setAnalyticsSink(next: Sink | null) {
  sink = next
}

export function track(event: AnalyticsEvent, props: AnalyticsProps = {}) {
  try {
    sink?.(event, props)
  } catch {
    // 분석 실패가 사용자 동작을 막지 않는다
  }
  if (__DEV__ && process.env.NODE_ENV !== "test") console.log(`[analytics] ${event}`, props)
}
