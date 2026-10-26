import * as Sentry from "@sentry/react-native"
import type { ComponentType } from "react"

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() || null

/**
 * 오류·크래시 수집(Sentry). EXPO_PUBLIC_SENTRY_DSN이 없으면(개발·테스트 기본) 켜지 않는다.
 *
 * 개인정보는 최소로 보낸다:
 * - sendDefaultPii를 끈다. IP 주소와 사용자 정보를 붙이지 않는다.
 * - 회원 ID·닉네임으로 사용자를 식별하지 않는다(setUser를 부르지 않는다).
 * - 화면 녹화(Session Replay)와 성능 추적은 켜지 않는다. 오류와 크래시, 크래시 없는 세션 비율만 본다.
 * 켜기 전에 개인정보처리방침에 국외 위탁(Sentry, 미국)과 수집 항목을 먼저 적는다.
 */
export function startErrorMonitoring(): void {
  if (!DSN) return
  Sentry.init({
    dsn: DSN,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    environment: __DEV__ ? "development" : "production",
  })
}

/**
 * 루트 화면을 감싸 렌더 중 오류와 네이티브 크래시를 받는다.
 * 켜지 않았으면 감싸지 않는다(init 없이 감싸면 앱을 열 때마다 Sentry가 경고를 남긴다).
 */
export function withErrorMonitoring<P extends Record<string, unknown>>(Root: ComponentType<P>): ComponentType<P> {
  return DSN ? Sentry.wrap(Root) : Root
}

/** 직접 잡은 오류를 보낸다. 켜지 않았으면 아무것도 하지 않는다 */
export function reportError(error: unknown): void {
  Sentry.captureException(error)
}
