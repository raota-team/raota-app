import PostHog from "posthog-react-native"

import { setAnalyticsSink } from "./index"

/**
 * 분석 이벤트를 PostHog로 보낸다. EXPO_PUBLIC_POSTHOG_KEY가 없거나 개발 빌드(__DEV__)면 아무것도 보내지 않는다.
 * 개발 중 시뮬레이터 이벤트가 실제 DAU·MAU에 섞이지 않게 하기 위해서다.
 *
 * 개인정보처리방침(2026-11-03)과 맞춘 약속:
 * - 회원 ID·닉네임·이메일과 연결하지 않는다(identify를 부르지 않는다). SDK가 설치 때 만든 임의 기기 식별값으로만 묶는다.
 * - IP로 위치를 추정하지 않는다(disableGeoip). PostHog 프로젝트 설정의 "Discard client IP data"도 켠다.
 * - 이벤트 속성에는 개인정보를 넣지 않는다(./index의 track 규칙).
 */
export function startPostHogAnalytics(): void {
  const apiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY
  if (!apiKey || __DEV__) return
  const client = new PostHog(apiKey, {
    host: process.env.EXPO_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    disableGeoip: true,
    personProfiles: "never",
  })
  setAnalyticsSink((event, props) => {
    client.capture(event, props)
  })
}
