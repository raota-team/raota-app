import { useState } from "react"
import { router } from "expo-router"
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import {
  Check,
  Eye,
  EyeOff,
  Fingerprint,
  MessageCircle,
} from "lucide-react-native"
import {
  // Keep the flow shell shared with every other native screen.
  ActionButton,
  FlowHeader,
  FlowPage,
  FlowScroll,
  InlineNotice,
  flowStyles,
  palette,
} from "../_layout"

import { useRaota } from "@/src/state/RaotaStore"

type Provider = "kakao" | "google" | "passkey"

function ProviderButton({
  provider,
  label,
  loading,
  disabled,
  onPress,
}: {
  provider: Provider
  label: string
  loading: boolean
  disabled: boolean
  onPress: () => void
}) {
  const isPasskey = provider === "passkey"
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: loading, disabled }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.providerButton,
        isPasskey && styles.providerButtonPrimary,
        (disabled || loading) && styles.providerButtonDisabled,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.providerIcon}>
        {provider === "kakao" ? (
          <MessageCircle color="#3C1E1E" fill="#FEE500" size={19} />
        ) : provider === "google" ? (
          <Text style={styles.googleMark}>G</Text>
        ) : (
          <Fingerprint color={palette.canvas} size={20} strokeWidth={2} />
        )}
      </View>
      {loading ? (
        <View style={styles.providerLoading}>
          <ActivityIndicator color={isPasskey ? palette.canvas : palette.ink} />
          <Text
            style={[
              styles.providerLabel,
              isPasskey && styles.providerLabelInverse,
            ]}
          >
            로그인 중…
          </Text>
        </View>
      ) : (
        <Text
          style={[styles.providerLabel, isPasskey && styles.providerLabelInverse]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  )
}

export default function LoginScreen() {
  const { state, actions } = useRaota()
  const [emailMode, setEmailMode] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState<Provider | "email" | "guest" | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)

  const finishLogin = async (input: Parameters<typeof actions.login>[0]) => {
    setError(null)
    await Promise.resolve(actions.login(input))
    if (state.onboardingCompleted) router.replace("/native")
    else router.replace("/auth/onboarding")
  }

  const socialLogin = async (provider: Provider) => {
    setLoading(provider)
    try {
      await new Promise((resolve) => setTimeout(resolve, 650))
      await finishLogin({
        // The local repository keeps the existing AuthProvider union. The
        // visual passkey entry point is intentionally mapped to the mock
        // Apple provider until a real passkey service is connected.
        provider: provider === "passkey" ? "apple" : provider,
        name:
          provider === "kakao"
            ? "카카오 라멘러"
            : provider === "google"
              ? "구글 라멘러"
              : "생체보안 라멘러",
      })
    } finally {
      setLoading(null)
    }
  }

  const emailLogin = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("올바른 이메일 주소를 입력해주세요.")
      return
    }
    if (password.length < 8) {
      setError("비밀번호는 8자 이상 입력해주세요.")
      return
    }
    setLoading("email")
    try {
      await new Promise((resolve) => setTimeout(resolve, 650))
      await finishLogin({
        provider: "email",
        email: email.trim(),
        name: email.split("@")[0],
      })
    } finally {
      setLoading(null)
    }
  }

  const guestLogin = async () => {
    setLoading("guest")
    try {
      await new Promise((resolve) => setTimeout(resolve, 450))
      await finishLogin({ name: "라멘 탐험가", nickname: "라멘 탐험가" })
    } finally {
      setLoading(null)
    }
  }

  return (
    <FlowPage>
      <FlowHeader
        title="로그인"
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="회원가입"
            onPress={() => router.push("/auth/onboarding")}
            style={styles.headerLink}
          >
            <Text style={styles.headerLinkText}>회원가입</Text>
          </Pressable>
        }
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FlowScroll contentContainerStyle={styles.content}>
          <View style={styles.brandBlock}>
            <View style={styles.logoBox}>
              <Image
                source={require("@/assets/images/logo.png")}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.eyebrow}>RAOTA LOGIN</Text>
            <Text style={styles.heroTitle}>
              좋았던 한 그릇을{`\n`}
              <Text style={styles.heroTitleAccent}>잊지 않도록</Text>
            </Text>
            <Text style={styles.heroDescription}>
              가고 싶은 곳, 다녀온 곳, 다시 먹고 싶은 한 그릇을
              라오타에 모아두세요.
            </Text>
          </View>

          {!!error && <InlineNotice text={error} tone="error" />}

          <View style={styles.buttonStack}>
            <ProviderButton
              provider="kakao"
              label="카카오로 시작하기"
              loading={loading === "kakao"}
              disabled={loading !== null}
              onPress={() => socialLogin("kakao")}
            />
            <ProviderButton
              provider="google"
              label="Google로 시작하기"
              loading={loading === "google"}
              disabled={loading !== null}
              onPress={() => socialLogin("google")}
            />
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>또는</Text>
            <View style={styles.divider} />
          </View>

          <ProviderButton
            provider="passkey"
            label="패스키로 시작하기"
            loading={loading === "passkey"}
            disabled={loading !== null}
            onPress={() => socialLogin("passkey")}
          />

          <View style={styles.quickActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={emailMode ? "간편 로그인 접기" : "이메일로 로그인"}
              accessibilityState={{ expanded: emailMode }}
              onPress={() => {
                setEmailMode((value) => !value)
                setError(null)
              }}
              style={styles.emailToggle}
            >
              <Text style={styles.emailToggleText}>
                {emailMode ? "간편 로그인 접기" : "이메일로 로그인"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={loading !== null}
              onPress={guestLogin}
              style={styles.guestButton}
            >
              <Text style={styles.guestText}>
                {loading === "guest" ? "접속 중…" : "게스트로 둘러보기"}
              </Text>
            </Pressable>
          </View>

          {emailMode && (
            <View style={styles.emailForm}>
              <Text style={flowStyles.label}>이메일 주소</Text>
              <TextInput
                accessibilityLabel="이메일 주소"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="ramen@example.com"
                placeholderTextColor={palette.quiet}
                returnKeyType="next"
                style={flowStyles.input}
                value={email}
              />
              <View style={styles.passwordLabelRow}>
                <Text style={[flowStyles.label, { marginBottom: 0 }]}>비밀번호</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    Alert.alert(
                      "비밀번호 찾기",
                      "입력한 이메일로 재설정 안내를 보내드리는 모의 기능입니다.",
                    )
                  }
                  style={styles.resetButton}
                >
                  <Text style={styles.resetText}>비밀번호 찾기</Text>
                </Pressable>
              </View>
              <View style={styles.passwordField}>
                <TextInput
                  accessibilityLabel="비밀번호"
                  autoComplete="current-password"
                  onChangeText={setPassword}
                  onSubmitEditing={emailLogin}
                  placeholder="8자 이상 영문, 숫자 조합"
                  placeholderTextColor={palette.quiet}
                  returnKeyType="go"
                  secureTextEntry={!showPassword}
                  style={[flowStyles.input, { flex: 1, paddingRight: 48 }]}
                  value={password}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                  onPress={() => setShowPassword((value) => !value)}
                  style={styles.eyeButton}
                >
                  {showPassword ? (
                    <EyeOff color={palette.muted} size={20} />
                  ) : (
                    <Eye color={palette.muted} size={20} />
                  )}
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: rememberMe }}
                onPress={() => setRememberMe((value) => !value)}
                style={styles.rememberRow}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                  {rememberMe && <Check color={palette.canvas} size={12} strokeWidth={3} />}
                </View>
                <Text style={styles.rememberText}>로그인 상태 유지</Text>
              </Pressable>
              <ActionButton
                label="로그인 완료"
                accessibilityLabel="이메일로 로그인"
                variant="dark"
                shape="rounded"
                loading={loading === "email"}
                disabled={loading !== null}
                onPress={emailLogin}
              />
            </View>
          )}
          <Text style={styles.legal}>
            계속하면 RAOTA의 이용약관과 개인정보 처리방침에 동의한 것으로 간주됩니다.
          </Text>
        </FlowScroll>
      </KeyboardAvoidingView>
    </FlowPage>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 8, paddingTop: 22, paddingBottom: 36, gap: 14 },
  headerLink: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerLinkText: { color: palette.red, fontSize: 12, fontWeight: "900" },
  brandBlock: { alignItems: "center", paddingHorizontal: 12, paddingBottom: 7 },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: palette.wash,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logo: { width: 48, height: 48 },
  eyebrow: {
    color: palette.red,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 6,
  },
  heroTitle: {
    color: palette.ink,
    fontSize: 24,
    lineHeight: 31,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.7,
  },
  heroTitleAccent: { color: palette.red },
  heroDescription: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 8,
  },
  buttonStack: { gap: 10 },
  providerButton: {
    alignItems: "center",
    backgroundColor: palette.canvas,
    borderColor: palette.line,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16,
    position: "relative",
  },
  providerButtonPrimary: { backgroundColor: palette.red, borderColor: palette.red },
  providerButtonDisabled: { opacity: 0.58 },
  providerIcon: { left: 15, position: "absolute", width: 22, alignItems: "center" },
  providerLabel: { color: palette.ink, fontSize: 13, fontWeight: "800" },
  providerLabelInverse: { color: palette.canvas },
  providerLoading: { alignItems: "center", flexDirection: "row", gap: 8 },
  googleMark: { color: "#4285F4", fontSize: 18, fontWeight: "900" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 1 },
  divider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.line,
  },
  dividerText: { color: palette.quiet, fontSize: 11, fontWeight: "700" },
  quickActions: { flexDirection: "row", gap: 8 },
  emailToggle: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.wash,
  },
  emailToggleText: { color: palette.ink, fontSize: 11.5, fontWeight: "800" },
  emailForm: { borderTopColor: palette.line, borderTopWidth: StyleSheet.hairlineWidth, gap: 10, paddingTop: 12 },
  passwordLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  resetButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  resetText: { color: palette.muted, fontSize: 10, fontWeight: "700" },
  passwordField: { position: "relative", flexDirection: "row" },
  eyeButton: {
    position: "absolute",
    right: 2,
    top: 2,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  guestButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.ink,
    borderRadius: 8,
  },
  guestText: {
    color: palette.canvas,
    fontSize: 11.5,
    fontWeight: "700",
  },
  rememberRow: { alignItems: "center", flexDirection: "row", gap: 8, minHeight: 36 },
  checkbox: { alignItems: "center", borderColor: palette.muted, borderRadius: 3, borderWidth: 1, height: 16, justifyContent: "center", width: 16 },
  checkboxActive: { backgroundColor: palette.red, borderColor: palette.red },
  rememberText: { color: palette.muted, fontSize: 11, fontWeight: "600" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  legal: {
    color: palette.quiet,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    paddingHorizontal: 20,
  },
})
