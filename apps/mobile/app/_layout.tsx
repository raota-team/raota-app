import { Buffer } from "buffer"
import { Redirect, Stack, useSegments } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { StatusBar } from "expo-status-bar"
import { useEffect } from "react"
import { ActivityIndicator, StyleSheet, Text, View } from "react-native"
import "react-native-reanimated"

import { Toast } from "@/src/components/ui"
import { RaotaProvider, useRaota } from "@/src/state/RaotaStore"
import { fonts } from "@/src/theme"

;(globalThis as typeof globalThis & { Buffer?: typeof Buffer }).Buffer ??=
  Buffer

export { ErrorBoundary } from "expo-router"

export const unstable_settings = {
  initialRouteName: "index",
}

void SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  useEffect(() => {
    void SplashScreen.hideAsync()
  }, [])

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <RaotaProvider>
        <HydratedNavigation />
      </RaotaProvider>
    </View>
  )
}

function HydratedNavigation() {
  const { state, currentUser, isHydrated, storageError, actions } = useRaota()
  const segments = useSegments()

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
        <ActivityIndicator color="#E60000" size="small" />
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
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#FFFFFF" },
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
    backgroundColor: "#FFFFFF",
  },
  wordmark: {
    color: "#25282B",
    fontFamily: fonts.display,
    fontSize: 36,
  },
  dot: { color: "#E60000" },
})
