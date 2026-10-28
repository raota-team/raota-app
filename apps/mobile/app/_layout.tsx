import { Buffer } from "buffer"
import * as Notifications from "expo-notifications"
import { ErrorBoundary as RouterErrorBoundary, Redirect, Stack, router, useSegments, type ErrorBoundaryProps } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { StatusBar } from "expo-status-bar"
import { useEffect, useRef } from "react"
import { AppState, Platform, StyleSheet, View } from "react-native"
import "react-native-reanimated"

import { track } from "@/src/analytics"
import { startPostHogAnalytics } from "@/src/analytics/posthog"
import { Toast } from "@/src/components/ui"
import LaunchCover from "@/src/components/LaunchCover"
import { cancelRecordReminders, configureReminderPresentation, deepLinkToPath } from "@/src/notifications"
import { RaotaProvider, useRaota } from "@/src/state/RaotaStore"
import { reportError, startErrorMonitoring, withErrorMonitoring } from "@/src/monitoring"
import { colors } from "@/src/theme"
import { useDeviceLocale, useLocale } from "@/src/i18n"

;(globalThis as typeof globalThis & { Buffer?: typeof Buffer }).Buffer ??=
  Buffer

/**
 * 화면 렌더 오류는 이 경계가 먼저 잡아 루트의 Sentry 경계까지 올라가지 않는다. 그래서 여기서 직접 보내고
 * 화면은 Expo Router 기본 오류 화면(다시 시도)을 그대로 쓴다.
 */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  useEffect(() => reportError(props.error), [props.error])
  return <RouterErrorBoundary {...props} />
}

export const unstable_settings = {
  initialRouteName: "index",
}

void SplashScreen.preventAutoHideAsync()
configureReminderPresentation()
startErrorMonitoring()
startPostHogAnalytics()

/** 앱 열기(D1·D7 리텐션용). 처음 뜰 때와 백그라운드에서 돌아올 때 한 번씩 */
function useAppOpenTracking() {
  useEffect(() => {
    track("app_open", { cold: true })
    let previous = AppState.currentState
    const subscription = AppState.addEventListener("change", (next) => {
      if (previous.match(/inactive|background/) && next === "active") track("app_open", { cold: false })
      previous = next
    })
    return () => subscription.remove()
  }, [])
}

/**
 * 기록 리마인더를 누르면 알림에 담긴 딥링크(raota://record/select-shop 등)로 해당 화면을 연다.
 * 앱이 꺼져 있다가 알림으로 켜진 경우(마지막 응답)와 켜져 있을 때(리스너)를 모두 받는다.
 * 저장소를 불러온 뒤에만 렌더되므로 이동할 화면이 준비돼 있다.
 */
function ReminderDeepLinks() {
  const handled = useRef<string | null>(null)
  useEffect(() => {
    if (Platform.OS === "web") return
    const open = (response: Notifications.NotificationResponse | null) => {
      if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return
      const { identifier } = response.notification.request
      const key = `${identifier}:${response.notification.date}`
      if (handled.current === key) return
      handled.current = key
      // 다음 실행 때 같은 알림으로 다시 이동하지 않게 지운다
      Notifications.clearLastNotificationResponse?.()
      const path = deepLinkToPath(response.notification.request.content.data?.url)
      if (!path) return
      track("reminder_opened", { kind: String(response.notification.request.content.data?.kind ?? "unknown") })
      router.push(path as Parameters<typeof router.push>[0])
    }
    // 알림으로 앱이 켜졌으면 스택이 붙은 다음 프레임에 연다
    const coldStart = setTimeout(() => {
      try {
        open(Notifications.getLastNotificationResponse())
      } catch {
        // 마지막 응답을 읽지 못해도 리스너는 그대로 둔다
      }
    }, 0)
    const subscription = Notifications.addNotificationResponseReceivedListener(open)
    return () => {
      clearTimeout(coldStart)
      subscription.remove()
    }
  }, [])
  return null
}

function RootLayout() {
  useDeviceLocale()
  useLocale()
  useAppOpenTracking()

  // 네이티브 스플래시는 LaunchCover가 같은 로고를 그린 뒤에 내린다
  return (
    <View style={styles.root}>
      <RaotaProvider>
        <HydratedNavigation />
        <LaunchCover />
      </RaotaProvider>
    </View>
  )
}

export default withErrorMonitoring(RootLayout)

function HydratedNavigation() {
  const { state, currentUser, isHydrated, storageError, actions } = useRaota()
  const segments = useSegments()
  const signedIn = Boolean(currentUser)

  // 로그아웃하면 그 계정 기준으로 예약한 기록 리마인더를 지운다
  useEffect(() => {
    if (isHydrated && !signedIn) void cancelRecordReminders()
  }, [isHydrated, signedIn])

  // 저장소와 로그인을 불러오는 동안은 LaunchCover가 덮고 있다. 그 아래에 아무것도 그리지 않는다
  if (!isHydrated) return <View style={styles.root} />

  const isOnboardingRoute =
    segments[0] === "(flows)" &&
    segments[1] === "auth" &&
    segments[2] === "onboarding"
  const isNativeRoute = (segments[0] as string) === "native"

  if (isNativeRoute && currentUser && !state.onboardingCompleted && !isOnboardingRoute) {
    return <Redirect href="/auth/onboarding" />
  }
  // 현재 약관에 다시 동의해야 하는 서버 회원은 동의 화면을 먼저 거친다(로그아웃은 동의 화면에서 할 수 있다)
  if (isNativeRoute && currentUser && state.consentRequired) {
    return <Redirect href="/auth/consent" />
  }

  return (
    <View style={styles.navigationRoot}>
      <StatusBar style="auto" />
      <ReminderDeepLinks />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
          animation: "slide_from_right",
          gestureEnabled: true,
          // 웹 뒤로 가기처럼 화면 어디서 오른쪽으로 밀어도 뒤로 간다(iOS 26부터는 기본, 그 전 iOS도 맞춘다).
          // 옆으로 넘기는 영역의 첫 장에서 민 경우는 modules/back-swipe가 이 제스처에 넘겨준다
          fullScreenGestureEnabled: true,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="dev-webview" />
        <Stack.Screen name="native" />
        <Stack.Screen name="(flows)" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <Toast
        message={storageError ?? ""}
        onDismiss={actions.dismissStorageError}
        variant="critical"
        visible={Boolean(storageError)}
        style={styles.storageToast}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  navigationRoot: { flex: 1 },
  storageToast: { bottom: 92, zIndex: 100 },
})
