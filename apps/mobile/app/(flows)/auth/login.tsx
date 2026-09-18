import { useState, type ReactElement } from "react"
import { router, useLocalSearchParams } from "expo-router"
import { StatusBar } from "expo-status-bar"
import * as Haptics from "expo-haptics"
import { Compass } from "lucide-react-native"
import { Image, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import Svg, { Path } from "react-native-svg"

import type { AuthProvider } from "@raota/shared"
import { track } from "@/src/analytics"
import { AppText, Header, Toast } from "@/src/components/ui"
import { useRaota } from "@/src/state/RaotaStore"
import { colors, radii, spacing, touchTarget, typography } from "@/src/theme"

/*
 * 로그인. 로고·소개·간편 로그인을 화면 가운데에 모으고, 둘러보기와 약관 링크는 아래에 둔다.
 * MVP 로그인 수단은 Apple · 카카오 · Google 세 가지다.
 * params.mode === "signup"(마이·홈의 "회원가입")이면 같은 화면을 가입 흐름으로 보여준다:
 * 간편 로그인으로 계정을 만든 뒤 바로 온보딩(닉네임·약관)으로 간다.
 * 데모 계정(42그릇) 버튼은 두지 않는다. 개발 빌드에서만 로고를 길게 누르면 들어간다.
 * 지금은 인증 API가 없어 actions.login({ provider })로 기기 안에서만 로그인한다.
 * TODO(#44): Apple은 expo-apple-authentication의 signInAsync, 카카오·Google은 각 SDK로 토큰을 받아
 *   서버 #44(소셜 로그인)에 보내고, 응답의 사용자·신규 여부로 온보딩 이동을 정한다.
 */

type SocialProvider = Extract<AuthProvider, "apple" | "kakao" | "google">

/** 제공자 브랜드 가이드가 정한 색. RAOTA 토큰 밖의 예외라 이 화면에만 둔다 */
const PROVIDER_BRAND = {
  kakaoContainer: "#FEE500",
  kakaoLabel: "#191919",
  googleBlue: "#4285F4",
  googleGreen: "#34A853",
  googleYellow: "#FBBC05",
  googleRed: "#EA4335",
} as const

function AppleMark() {
  return (
    <Svg height={20} viewBox="0 0 24 24" width={20}>
      <Path
        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
        fill={colors.white}
      />
    </Svg>
  )
}

function KakaoMark() {
  return (
    <Svg height={20} viewBox="0 0 24 24" width={20}>
      <Path
        d="M12 3C6.477 3 2 6.477 2 10.767c0 2.766 1.87 5.187 4.675 6.485-.205.768-.744 2.783-.852 3.203-.133.522.191.516.402.377.275-.182 4.37-2.96 5.09-3.46.88.13 1.777.195 2.685.195 5.523 0 10-3.477 10-7.767C22 6.477 17.523 3 12 3z"
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

const PROVIDERS: Array<{ id: SocialProvider; label: string; Mark: () => ReactElement }> = [
  // Apple 로그인은 다른 간편 로그인보다 눈에 덜 띄면 안 된다(App Store 가이드라인 4.8). 맨 위 검은 버튼
  { id: "apple", label: "Apple로 계속하기", Mark: AppleMark },
  { id: "kakao", label: "카카오로 계속하기", Mark: KakaoMark },
  { id: "google", label: "Google로 계속하기", Mark: GoogleMark },
]

function ProviderButton({ id, label, Mark, onPress }: (typeof PROVIDERS)[number] & { onPress: () => void }) {
  const textColor = id === "apple" ? colors.white : id === "kakao" ? PROVIDER_BRAND.kakaoLabel : colors.ink
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.provider,
        id === "apple" && styles.providerApple,
        id === "kakao" && styles.providerKakao,
        id === "google" && styles.providerGoogle,
        pressed && styles.pressed,
      ]}
      testID={`login-${id}`}
    >
      <View style={styles.providerMark}>
        <Mark />
      </View>
      <AppText maxFontSizeMultiplier={1.3} numberOfLines={1} style={[styles.providerLabel, { color: textColor }]}>
        {label}
      </AppText>
    </Pressable>
  )
}

function LegalLink({ doc, label }: { doc: "terms" | "privacy"; label: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
      onPress={() => router.push({ pathname: "/legal/[doc]", params: { doc } })}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <AppText style={styles.legalLinkText} tone="sub" variant="meta">
        {label}
      </AppText>
    </Pressable>
  )
}

export default function LoginScreen() {
  const params = useLocalSearchParams<{ mode?: string }>()
  const signup = params.mode === "signup"
  const { state, currentUser, actions } = useRaota()
  const [notice, setNotice] = useState<string | null>(null)

  const leave = () => {
    if (router.canGoBack()) router.back()
    else router.replace("/native")
  }

  // newAccount: 이 기기에서 처음 쓰는 계정이면 온보딩을 거친다. 로그인 직후의 state는 아직 이전 값이라 결과로 판단한다
  const afterLogin = (newAccount: boolean) => {
    if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
    // 가입 흐름이거나 새 계정이면 곧바로 닉네임·약관 단계로 간다
    if (signup || newAccount) {
      router.replace("/auth/onboarding")
      return
    }
    // 로그인이 필요해 들어온 화면(기록, 마이 등)으로 돌아간다
    leave()
  }

  const socialLogin = (provider: SocialProvider) => {
    // TODO(#44): 실제 인증으로 교체. 지금은 기기 안 더미 로그인
    const previousUserId = state.user?.id
    const profile = actions.login({ provider })
    track("login", { provider, signup })
    afterLogin(profile.id !== previousUserId)
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
      <StatusBar style="dark" />
      <Header
        backLabel="뒤로가기"
        onBack={leave}
        right={
          <Pressable
            accessibilityLabel={signup ? "로그인" : "회원가입"}
            accessibilityRole="button"
            hitSlop={4}
            onPress={() => router.setParams({ mode: signup ? "login" : "signup" })}
            style={({ pressed }) => [styles.headerLink, pressed && styles.pressed]}
          >
            <AppText capScale tone="brand" variant="bodyStrong">
              {signup ? "로그인" : "회원가입"}
            </AppText>
          </Pressable>
        }
        title={signup ? "회원가입" : "로그인"}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.main}>
        <View style={styles.brand}>
          <Pressable
            accessible={false}
            delayLongPress={800}
            disabled={!__DEV__}
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
          <AppText accessibilityRole="header" style={styles.center} variant="headline">
            좋았던 한 그릇을{"\n"}
            <AppText tone="brand" variant="headline">
              잊지 않도록
            </AppText>
          </AppText>
          <AppText lineBreakStrategyIOS="hangul-word" style={styles.center} tone="muted" variant="body">
            {signup
              ? "간편 로그인으로 가입하고, 닉네임과 약관 동의만 하면 첫 기록을 남길 수 있어요."
              : "가고 싶은 곳, 다녀온 곳, 다시 먹고 싶은 한 그릇을 라오타에 모아두세요."}
          </AppText>
        </View>

        <View style={styles.providers}>
          {PROVIDERS.map((provider) => (
            <ProviderButton key={provider.id} {...provider} onPress={() => socialLogin(provider.id)} />
          ))}
        </View>

        </View>

        <View style={styles.bottom}>
          <Pressable
            accessibilityHint="로그인하지 않고 홈으로 가요"
            accessibilityLabel="로그인 없이 둘러보기"
            accessibilityRole="button"
            onPress={browseAsGuest}
            style={({ pressed }) => [styles.guest, pressed && styles.pressed]}
          >
            <Compass color={colors.inkSub} size={16} />
            <AppText style={styles.bold} tone="sub" variant="body">
              로그인 없이 둘러보기
            </AppText>
          </Pressable>
          <View style={styles.legal}>
            <AppText lineBreakStrategyIOS="hangul-word" style={styles.center} tone="muted" variant="meta">
              처음이면 간편 로그인 뒤 닉네임과 약관 동의만 하면 가입이 끝나요.
            </AppText>
            <View style={styles.legalLinks}>
              <LegalLink doc="terms" label="이용약관" />
              <AppText tone="muted" variant="meta">
                ·
              </AppText>
              <LegalLink doc="privacy" label="개인정보처리방침" />
            </View>
          </View>
        </View>
      </ScrollView>
      <Toast message={notice ?? ""} onDismiss={() => setNotice(null)} visible={Boolean(notice)} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.x4,
    paddingBottom: spacing.x4,
  },
  // 로고·소개·간편 로그인 묶음을 남는 높이의 가운데에 둔다(헤더를 빼고 조금 위로 보이도록 아래 여백을 더 준다)
  main: { flexGrow: 1, justifyContent: "center", gap: spacing.x3, paddingBottom: spacing.x8 },
  center: { textAlign: "center" },
  bold: { fontWeight: "700" },
  pressed: { opacity: 0.85 },
  headerLink: { minHeight: touchTarget, justifyContent: "center", paddingHorizontal: spacing.x2 },
  brand: { alignItems: "center", gap: spacing.x2, marginBottom: spacing.x4 },
  logo: { width: 56, height: 56, marginBottom: spacing.x1 },
  providers: { gap: spacing.x2_5 },
  provider: {
    minHeight: 48,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.transparent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.x12,
  },
  providerApple: { backgroundColor: colors.black, borderColor: colors.black },
  providerKakao: { backgroundColor: PROVIDER_BRAND.kakaoContainer, borderColor: PROVIDER_BRAND.kakaoContainer },
  providerGoogle: { backgroundColor: colors.canvas, borderColor: colors.border },
  providerMark: { position: "absolute", left: spacing.x5, top: 0, bottom: 0, justifyContent: "center" },
  providerLabel: { ...typography.cardTitle },
  bottom: { paddingTop: spacing.x4, alignItems: "center", gap: spacing.x2 },
  legal: { alignItems: "center", gap: spacing.x1 },
  legalLinks: { flexDirection: "row", alignItems: "center", gap: spacing.x2 },
  legalLinkText: { textDecorationLine: "underline" },
  guest: {
    minHeight: touchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.x1_5,
    paddingHorizontal: spacing.x3,
  },
})
