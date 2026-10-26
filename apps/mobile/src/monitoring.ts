import * as Sentry from "@sentry/react-native"
import type { ComponentType } from "react"

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() || null

/**
 * 오류·크래시 수집(Sentry). EXPO_PUBLIC_SENTRY_DSN이 없으면(개발·테스트 기본) 켜지 않는다.
 *
 * 개인정보는 처리방침(제2조·제7조·제10조)에 적은 만큼만 보낸다:
 * - sendDefaultPii를 끈다. 회원 ID·닉네임으로 사용자를 식별하지 않는다.
 * - IP 주소를 "0.0.0.0"으로 고정한다. 비워 두면 Sentry 서버가 접속 IP로 IP와 대략적인 위치(도시)를 채운다
 *   (2026.10.26 확인, Sentry 문서의 권장 방법). 프로젝트 설정 Prevent Storing of IP Addresses도 켜 두었다.
 * - 브레드크럼에서 콘솔 로그와 네트워크 요청 주소를 뺀다. 화면 이동 기록만 남긴다.
 * - 화면 녹화(Session Replay)와 성능 추적은 켜지 않는다. 오류와 크래시, 크래시 없는 세션 비율만 본다.
 */
export function startErrorMonitoring(): void {
  if (!DSN) return
  Sentry.init({
    dsn: DSN,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    environment: __DEV__ ? "development" : "production",
    integrations: [Sentry.breadcrumbsIntegration({ console: false, fetch: false, xhr: false })],
  })
  Sentry.setUser({ ip_address: "0.0.0.0" })
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
