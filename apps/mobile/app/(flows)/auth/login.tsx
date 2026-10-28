import { t, msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core"
import { translate } from "@raota/shared"
import { useLocale } from "@/src/i18n"
import { useEffect, useState, type ReactElement } from "react"
import { router, useLocalSearchParams } from "expo-router"
import { StatusBar } from "expo-status-bar"
import * as Haptics from "expo-haptics"
import { Image, Platform, Pressable, ScrollView, StyleSheet, View, useColorScheme, useWindowDimensions, type ColorValue } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg"
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated"

import { track } from "@/src/analytics"
import { isApiError } from "@/src/api/client"
import { isRemote } from "@/src/api/config"
import { availableSocialProviders, socialCredential, SocialSignInCancelled, type SocialProvider } from "@/src/auth/social"
import { ResilientUriImage } from "@/src/components/ResilientUriImage"
import { AppText, Toast } from "@/src/components/ui"
import { useRaota } from "@/src/state/RaotaStore"
import { colors, line, pressFade, radii, spacing, touchTarget, typography, usePalette } from "@/src/theme"

/*
 * 로그인. 실제 라멘 사진을 먼저 보여주고 소개·간편 로그인을 이어 놓는다.
 * MVP 로그인 수단은 Apple · 카카오 · Google 세 가지다.
 * params.mode === "signup"(마이·홈의 "회원가입")이면 같은 화면을 가입 흐름으로 보여준다:
 * 간편 로그인으로 계정을 만든 뒤 바로 온보딩(닉네임·약관)으로 간다.
 * 데모 계정(42그릇) 버튼은 두지 않는다. 개발 빌드(mock)에서만 로고를 길게 누르면 들어간다.
 *
 * - auth remote: 제공자 SDK(src/auth/social)로 자격 증명을 받아 서버에 로그인한다. 키가 없는 제공자 버튼은 숨긴다.
 *   회원 상태로 다음 화면을 정한다: 온보딩 전이면 온보딩, 약관 다시 동의가 필요하면 동의 화면, 아니면 가려던 곳.
 * - mock(기본): actions.login({ provider })로 기기 안에서만 로그인한다.
 */

const LOGIN_FAILED = msg`로그인하지 못했어요. 잠시 후 다시 시도해 주세요.`
const LOGIN_OFFLINE = msg`인터넷 연결을 확인하고 다시 시도해 주세요.`
const LOGIN_UNAVAILABLE_ACCOUNT = msg`이 계정으로는 로그인할 수 없어요. 탈퇴한 계정은 30일이 지나야 다시 가입할 수 있어요.`

function loginErrorMessage(error: unknown): string {
  if (!isApiError(error)) return translate(LOGIN_FAILED)
  if (error.isOffline) return translate(LOGIN_OFFLINE)
  return translate(error.code === "UNAUTHORIZED" ? LOGIN_UNAVAILABLE_ACCOUNT : LOGIN_FAILED)
}

/** 제공자 브랜드 가이드가 정한 색. RAOTA 토큰 밖의 예외라 이 화면에만 둔다 */
const PROVIDER_BRAND = {
  kakaoContainer: "#FEE500",
  kakaoLabel: "#191919",
  googleBlue: "#4285F4",
  googleGreen: "#34A853",
  googleYellow: "#FBBC05",
  googleRed: "#EA4335",
} as const

// 승인된 시안의 장식 사진 여섯 장. 특정 매장이나 기록의 사진이라고 주장하지 않는다.
const COLLAGE_PHOTOS = [
  "https://images.unsplash.com/photo-1742633882713-593c13e90231?w=290&h=360&fit=crop&auto=format&q=80",
  "https://images.unsplash.com/photo-1635379511574-bc167ca085c8?w=290&h=330&fit=crop&auto=format&q=80",
  "https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=290&h=430&fit=crop&auto=format&q=80",
  "https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=290&h=310&fit=crop&auto=format&q=80",
  "https://images.unsplash.com/photo-1533787761082-492a5b83e614?w=290&h=320&fit=crop&auto=format&q=80",
  "https://images.unsplash.com/photo-1780822734757-e45178b6b79c?w=290&h=380&fit=crop&auto=format&q=80",
]
const COLLAGE_GAP = 6
/**
 * 열마다 다른 사진 두 장씩 써서 같은 사진이 옆 열과 나란히 지나가지 않게 하고, 높이·속도도 달리한다.
 * 한 바퀴 높이는 화면 콜라주(최대 312 + 열 어긋남 36)보다 길어야 끊김 없이 이어진다.
 */
const COLLAGE_COLUMNS = [
  { photos: [0, 3], heights: [190, 210], durationMs: 22_000 },
  { photos: [2, 5], heights: [225, 185], durationMs: 28_000 },
  { photos: [4, 1], heights: [200, 215], durationMs: 25_000 },
] as const

/** 사진 열 하나가 천천히 아래로 흐른다. 같은 묶음을 두 번 쌓아 한 묶음 높이만큼 내려가면 처음으로 돌아가 이음매가 보이지 않는다 */
function CollageColumn({ column, index }: { column: (typeof COLLAGE_COLUMNS)[number]; index: number }) {
  const reducedMotion = useReducedMotion()
  const cycle = column.heights.reduce((sum, height) => sum + height + COLLAGE_GAP, 0)
  const offset = useSharedValue(-cycle)

  useEffect(() => {
    if (reducedMotion) {
      offset.value = -cycle
      return
    }
    offset.value = -cycle
    offset.value = withRepeat(withTiming(0, { duration: column.durationMs, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(offset)
  }, [column.durationMs, cycle, offset, reducedMotion])

  const flow = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }))

  return (
    <View style={[styles.collageColumn, index === 1 && styles.collageColumnMiddle, index === 2 && styles.collageColumnLast]}>
      <Animated.View style={[styles.collageStack, flow]}>
        {[0, 1].map((copy) =>
          column.photos.map((photo, order) => (
            <ResilientUriImage
              accessibilityLabel={t`라멘 사진`}
              key={`${copy}-${order}`}
              style={[styles.collagePhoto, { height: column.heights[order] }]}
              uri={COLLAGE_PHOTOS[photo]}
            />
          )),
        )}
      </Animated.View>
    </View>
  )
}

function RamenCollage({ height }: { height: number }) {
  const { paper } = usePalette()
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.collage, { height }]}
    >
      {COLLAGE_COLUMNS.map((column, index) => (
        <CollageColumn column={column} index={index} key={index} />
      ))}
      <Svg height={130} pointerEvents="none" style={styles.collageFade} width="100%">
        <Defs>
          <LinearGradient id="fadeToCanvas" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor={paper} stopOpacity="0" />
            <Stop offset="1" stopColor={paper} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect fill="url(#fadeToCanvas)" height="100%" width="100%" />
      </Svg>
    </View>
  )
}

function AppleMark({ color }: { color: ColorValue }) {
  return (
    <Svg height={20} viewBox="0 0 24 24" width={20}>
      <Path
        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
        fill={color}
      />
    </Svg>
  )
}

/** 카카오 로그인 디자인 가이드의 말풍선 심볼(18×18). 예전 경로는 오른쪽 끝이 뾰족하게 꺾였다 */
function KakaoMark() {
  return (
    <Svg height={20} viewBox="0 0 18 18" width={20}>
      <Path
        d="M9 .6C4.029.6 0 3.712 0 7.552c0 2.389 1.558 4.494 3.932 5.745l-.999 3.648c-.088.322.28.579.563.392l4.377-2.889c.37.036.745.057 1.127.057 4.97 0 9-3.112 9-6.953C18 3.712 13.97.6 9 .6"
        fill={PROVIDER_BRAND.kakaoLabel}
      />
    </Svg>
  )
}

function GoogleMark() {
  return (
    <Svg height={20} viewBox="0 0 24 24" width={20}>
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill={PROVIDER_BRAND.googleBlue}
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill={PROVIDER_BRAND.googleGreen}
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill={PROVIDER_BRAND.googleYellow}
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill={PROVIDER_BRAND.googleRed}
      />
    </Svg>
  )
}

const PROVIDERS: Array<{ id: SocialProvider; label: MessageDescriptor; Mark: (props: { color: ColorValue }) => ReactElement }> = [
  // Apple은 iOS 밝은 화면에서 검정, 어두운 화면에서 흰 버튼으로 제공한다.
  { id: "apple", label: msg`Apple로 계속하기`, Mark: AppleMark },
  { id: "kakao", label: msg`카카오로 계속하기`, Mark: KakaoMark },
  { id: "google", label: msg`Google로 계속하기`, Mark: GoogleMark },
]

function ProviderButton({ id, label, Mark, onPress, disabled }: (typeof PROVIDERS)[number] & { onPress: () => void; disabled: boolean }) {
  const scheme = useColorScheme()
  const darkApple = id === "apple" && Platform.OS === "ios" && scheme === "dark"
  const textColor = id === "apple" ? (darkApple ? colors.black : colors.white) : id === "kakao" ? PROVIDER_BRAND.kakaoLabel : colors.black
  return (
    <Pressable
      accessibilityLabel={translate(label)}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.provider,
        id === "apple" && styles.providerApple,
        darkApple && styles.providerAppleDark,
        id === "kakao" && styles.providerKakao,
        id === "google" && styles.providerGoogle,
        pressed && pressFade,
      ]}
      testID={`login-${id}`}
    >
      <View style={styles.providerMark}>
        <Mark color={textColor} />
      </View>
      <AppText maxFontSizeMultiplier={1.3} numberOfLines={1} style={{ color: textColor }} variant="button">
        {translate(label)}
      </AppText>
    </Pressable>
  )
}

function LegalLink({ doc, label }: { doc: "terms" | "privacy"; label: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
      onPress={() => router.push({ pathname: "/legal/[doc]", params: { doc } })}
      style={({ pressed }) => pressed && styles.pressedWash}
    >
      <AppText style={styles.legalLinkText} tone="sub" variant="meta">
        {label}
      </AppText>
    </Pressable>
  )
}

export default function LoginScreen() {
  useLocale()
  const params = useLocalSearchParams<{ mode?: string; next?: string }>()
  const signup = params.mode === "signup"
  const { state, currentUser, actions } = useRaota()
  const { height } = useWindowDimensions()
  const remoteAuth = isRemote("auth")
  const providers = remoteAuth ? PROVIDERS.filter(({ id }) => availableSocialProviders().includes(id)) : PROVIDERS
  const [pending, setPending] = useState<SocialProvider | null>(null)
  const [toast, setToast] = useState<{ message: string; critical: boolean } | null>(null)

  const leave = () => {
    if (router.canGoBack()) router.back()
    else router.replace("/native")
  }

  /*
   * 로그인 직후의 state는 아직 이전 값이라 결과로 판단한다.
   * needsOnboarding: 닉네임·약관 전(서버 ONBOARDING, mock에서는 이 기기에서 처음 쓰는 계정이거나 가입 흐름)
   * needsConsent: 현재 약관·처리방침에 다시 동의해야 하는 서버 회원
   */
  const afterLogin = (needsOnboarding: boolean, needsConsent = false) => {
    if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
    if (needsOnboarding) {
      router.replace("/auth/onboarding")
      return
    }
    const next = typeof params.next === "string" && params.next.startsWith("/") && !params.next.startsWith("/auth") ? params.next : null
    if (needsConsent) {
      router.replace({ pathname: "/auth/consent", params: next ? { next } : {} })
      return
    }
    // 가드에 막혀 들어왔다면 열려던 화면으로 보낸다. back으로는 갈 수 없다 — 가드가 replace로 지웠다
    if (next) {
      router.replace(next as Parameters<typeof router.replace>[0])
      return
    }
    // 그 밖에는 로그인이 필요해 들어온 화면(기록, 마이 등)으로 돌아간다
    leave()
  }

  const remoteLogin = async (provider: SocialProvider) => {
    if (pending) return
    setPending(provider)
    setToast(null)
    try {
      const member = await actions.signIn(await socialCredential(provider))
      track("login", { provider, signup })
      afterLogin(!member.onboardingCompleted, member.consentRequired)
    } catch (error) {
      // 제공자 SDK 오류인지 서버 거절인지 가려야 고칠 수 있다. 토큰 같은 자격 증명은 남기지 않는다
      if (__DEV__ && !(error instanceof SocialSignInCancelled)) {
        const sdkCode = error && typeof error === "object" && "code" in error ? error.code : undefined
        const detail = isApiError(error)
          ? { kind: "server", status: error.status, code: error.code, message: error.message }
          : error instanceof Error
            ? { kind: "sdk", name: error.name, code: sdkCode, message: error.message }
            : { kind: "unknown", value: String(error) }
        console.warn("[login] failed", provider, JSON.stringify(detail))
      }
      setToast(
        error instanceof SocialSignInCancelled
          ? { message: t`로그인을 취소했어요.`, critical: false }
          : { message: loginErrorMessage(error), critical: true },
      )
    } finally {
      setPending(null)
    }
  }

  const socialLogin = (provider: SocialProvider) => {
    if (remoteAuth) {
      void remoteLogin(provider)
      return
    }
    const previousUserId = state.user?.id
    const profile = actions.login({ provider })
    track("login", { provider, signup })
    // 가입 흐름이거나 새 계정이면 곧바로 닉네임·약관 단계로 간다
    afterLogin(signup || profile.id !== previousUserId)
  }

  // 개발 빌드 전용: provider 없이 login()을 부르면 데모 계정(42그릇)으로 들어간다. 리포트·월별 화면 확인용
  const demoLogin = () => {
    actions.login()
    track("login", { provider: "demo" })
    afterLogin(false)
  }

  // 진짜 비회원으로 둘러본다. 데모 계정으로 들어가지 않는다
  const browseAsGuest = () => {
    if (currentUser) actions.logout()
    router.replace("/native")
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.root}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <RamenCollage height={Math.min(312, Math.max(240, height - 568))} />
        <View style={styles.brand}>
          <Pressable
            accessible={false}
            delayLongPress={800}
            disabled={!__DEV__ || remoteAuth}
            onLongPress={demoLogin}
          >
            <Image
              accessibilityIgnoresInvertColors
              accessibilityLabel="RAOTA"
              resizeMode="contain"
              source={require("@/assets/images/logo.png")}
              style={styles.logo}
            />
          </Pressable>
          <AppText accessibilityRole="header" lineBreakStrategyIOS="hangul-word" style={styles.headline} variant="screenTitle">
            {t`좋았던 한 그릇, 잊지 않도록 `}</AppText>
          <AppText lineBreakStrategyIOS="hangul-word" style={styles.subtitle} tone="sub" variant="secondary">
            {t`가고 싶은 곳, 다녀온 곳을 라오타에 모아두세요. `}</AppText>
        </View>
        <View style={styles.providers}>
          {providers.map((provider) => (
            <ProviderButton
              disabled={pending !== null}
              key={provider.id}
              {...provider}
              onPress={() => socialLogin(provider.id)}
            />
          ))}
        </View>
        <Pressable
          accessibilityHint={t`로그인하지 않고 홈으로 가요`}
          accessibilityLabel={t`로그인 없이 둘러보기`}
          accessibilityRole="button"
          onPress={browseAsGuest}
          style={({ pressed }) => [styles.guest, pressed && styles.pressedWash]}
        >
          <AppText variant="button">{t`로그인 없이 둘러보기`}</AppText>
        </Pressable>
        <View style={styles.legal}>
          <AppText lineBreakStrategyIOS="hangul-word" style={styles.center} tone="muted" variant="meta">
            {t`처음이면 간편 로그인 뒤 닉네임과 약관 동의만 하면 가입이 끝나요. `}</AppText>
          <View style={styles.legalLinks}>
            <LegalLink doc="terms" label={t`이용약관`} />
            <AppText tone="sub" variant="meta">·</AppText>
            <LegalLink doc="privacy" label={t`개인정보처리방침`} />
          </View>
        </View>
      </ScrollView>
      <Toast
        message={toast?.message ?? ""}
        onDismiss={() => setToast(null)}
        variant={toast?.critical ? "critical" : "neutral"}
        visible={Boolean(toast)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  // 약관 줄의 paddingBottom(16)과 더해 홈 인디케이터 위 32pt
  content: { flexGrow: 1, paddingBottom: spacing.x4 },
  collage: { flexDirection: "row", gap: 6, marginHorizontal: 10, overflow: "hidden", borderRadius: radii.sm },
  collageColumn: { flex: 1, overflow: "hidden" },
  collageStack: { gap: COLLAGE_GAP },
  collageColumnMiddle: { marginTop: -36 },
  collageColumnLast: { marginTop: -14 },
  collagePhoto: { width: "100%", borderRadius: radii.sm },
  collageFade: { position: "absolute", bottom: 0, left: 0, right: 0 },
  center: { textAlign: "center" },
  pressedWash: { backgroundColor: colors.surfacePressed, borderRadius: radii.sm },
  brand: { alignItems: "center", marginTop: -25, paddingHorizontal: spacing.x4 },
  logo: { width: 60, height: 60 },
  headline: { ...typography.screenTitle, fontSize: 22, lineHeight: 28, letterSpacing: -0.6, textAlign: "center", marginTop: spacing.x3 },
  subtitle: { fontSize: 13, lineHeight: 18, textAlign: "center", marginTop: 4 },
  providers: { gap: spacing.x4, marginTop: spacing.x12, marginHorizontal: 24 },
  provider: {
    minHeight: 48,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.x12,
  },
  providerApple: { backgroundColor: colors.black },
  providerAppleDark: { backgroundColor: colors.white },
  providerKakao: { backgroundColor: PROVIDER_BRAND.kakaoContainer },
  providerGoogle: { backgroundColor: colors.white, borderWidth: line.hair, borderColor: colors.border },
  providerMark: { position: "absolute", left: spacing.x4, top: 0, bottom: 0, justifyContent: "center" },
  legal: { alignItems: "center", gap: spacing.x3, paddingHorizontal: 24, paddingTop: spacing.x4, paddingBottom: spacing.x4, marginTop: "auto" },
  legalLinks: { flexDirection: "row", alignItems: "center", gap: 8 },
  legalLinkText: { textDecorationLine: "underline" },
  guest: {
    minHeight: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    paddingHorizontal: 16,
    marginTop: spacing.x4,
  },
})
