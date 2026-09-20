import { Buffer } from "buffer"
import * as Notifications from "expo-notifications"
import { Redirect, Stack, router, useSegments } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { StatusBar } from "expo-status-bar"
import { useEffect, useRef } from "react"
import { ActivityIndicator, AppState, Platform, StyleSheet, Text, View } from "react-native"
import "react-native-reanimated"

import { track } from "@/src/analytics"
import { Toast } from "@/src/components/ui"
import { cancelRecordReminders, configureReminderPresentation, deepLinkToPath } from "@/src/notifications"
import { RaotaProvider, useRaota } from "@/src/state/RaotaStore"
import { colors, fonts } from "@/src/theme"

;(globalThis as typeof globalThis & { Buffer?: typeof Buffer }).Buffer ??=
  Buffer

export { ErrorBoundary } from "expo-router"

export const unstable_settings = {
  initialRouteName: "index",
}

void SplashScreen.preventAutoHideAsync()
configureReminderPresentation()

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

export default function RootLayout() {
  useEffect(() => {
    void SplashScreen.hideAsync()
  }, [])
  useAppOpenTracking()

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <RaotaProvider>
        <HydratedNavigation />
      </RaotaProvider>
    </View>
  )
}

function HydratedNavigation() {
  const { state, currentUser, isHydrated, storageError, actions } = useRaota()
  const segments = useSegments()
  const signedIn = Boolean(currentUser)

  // 로그아웃하면 그 계정 기준으로 예약한 기록 리마인더를 지운다
  useEffect(() => {
    if (isHydrated && !signedIn) void cancelRecordReminders()
  }, [isHydrated, signedIn])

  if (!isHydrated) {
    return (
      <View
        accessibilityLabel="RAOTA 데이터 불러오는 중"
        style={styles.loading}
      >
        <StatusBar style="dark" />
        <Text style={styles.wordmark}>
          RAOTA<Text style={styles.dot}>.</Text>
        </Text>
        <ActivityIndicator color={colors.brand} size="small" />
      </View>
    )
  }

  const isOnboardingRoute =
    segments[0] === "(flows)" &&
    segments[1] === "auth" &&
    segments[2] === "onboarding"
  const isNativeRoute = (segments[0] as string) === "native"

  if (isNativeRoute && currentUser && !state.onboardingCompleted && !isOnboardingRoute) {
    return <Redirect href="/auth/onboarding" />
  }

  return (
    <View style={styles.navigationRoot}>
      <StatusBar style="dark" />
      <ReminderDeepLinks />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.paper },
          animation: "slide_from_right",
          gestureEnabled: true,
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
  navigationRoot: { flex: 1 },
  storageToast: { bottom: 92, zIndex: 100 },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    backgroundColor: colors.paper,
  },
  wordmark: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: 36,
    fontWeight: "900",
  },
  dot: { color: colors.brand },
})
