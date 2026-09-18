import { useRef, useState, type ReactNode } from "react"
import { router } from "expo-router"
import { StatusBar } from "expo-status-bar"
import * as Haptics from "expo-haptics"
import * as ImagePicker from "expo-image-picker"
import { Image } from "expo-image"
import { Camera, Check, ChevronRight, MapPin, Soup, Sparkles, UserRound, X, type LucideIcon } from "lucide-react-native"
import {
  AccessibilityInfo,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  findNodeHandle,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import type { UserProfile } from "@raota/shared"
import { track } from "@/src/analytics"
import PolicySheet, { type PolicyType } from "@/src/components/PolicySheet"
import { AppText, Button, Chip, Header } from "@/src/components/ui"
import { useRaota } from "@/src/state/RaotaStore"
import { colors, radii, spacing, touchTarget, typography } from "@/src/theme"

/*
 * 회원가입(온보딩). 웹 RegisterScreen과 같은 구성이다.
 * 프로필 사진(선택) → 닉네임(필수, 2~12자) → 선호 스타일(선택) → 한줄 소개(선택) → 약관 동의 → 가입 완료 안내.
 * 약관 "보기"는 PolicySheet로 열고, "확인하고 동의"를 누르면 그 항목이 체크된다.
 */

const NICKNAME_MIN = 2
const NICKNAME_MAX = 12
const BIO_MAX = 60

const RAMEN_STYLE_OPTIONS = [
  { name: "쇼유 (간장)", key: "쇼유" },
  { name: "돈코츠 (돼지뼈)", key: "돈코츠" },
  { name: "토리파이탄 (닭백탕)", key: "토리파이탄" },
  { name: "시오 (소금)", key: "시오" },
  { name: "미소 (된장)", key: "미소" },
  { name: "츠케멘", key: "츠케멘" },
  { name: "마제소바", key: "마제소바" },
]

const QUICK_BIO_TAGS = ["진한 국물파", "자가제면 탐험가", "라멘 성지순례 중", "꼬들면 애호가"]

const ONBOARDING_FEATURES: Array<{ Icon: LucideIcon; title: string; desc: string }> = [
  { Icon: MapPin, title: "내 주변 라멘집 찾기", desc: "지도에서 영업 여부와 라스트오더를 확인하고 바로 찾아가요." },
  { Icon: Soup, title: "한 그릇 라멘로그", desc: "먹은 라멘을 5가지 축으로 기록하면 취향 리포트가 쌓여요." },
  { Icon: Sparkles, title: "AI 큐레이터", desc: "원하는 국물과 분위기를 고르면 오늘의 한 곳을 골라 드려요." },
]

function nicknameErrorOf(value: string): string | null {
  const length = value.trim().length
  if (length === 0) return `닉네임을 입력해 주세요. ${NICKNAME_MIN}~${NICKNAME_MAX}자로 쓸 수 있어요.`
  if (length < NICKNAME_MIN) return `닉네임이 너무 짧아요. ${NICKNAME_MIN - length}자만 더 적어 주세요.`
  if (length > NICKNAME_MAX) return `닉네임은 ${NICKNAME_MAX}자까지예요. 지금 ${length}자예요.`
  return null
}

function success() {
  if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
}

/** 체크박스 행. 보이는 상자는 20pt, 행 전체가 44pt 터치 영역 */
function CheckRow({
  checked,
  onChange,
  label,
  children,
  strong = false,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  children: ReactNode
  strong?: boolean
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [styles.checkRow, pressed && styles.pressed]}
    >
      <View style={[styles.checkBox, checked && styles.checkBoxOn]}>
        {checked ? <Check color={colors.onDark} size={14} strokeWidth={3} /> : null}
      </View>
      <AppText style={[styles.flexShrink, strong && styles.checkStrong]} tone={strong ? "ink" : "sub"} variant={strong ? "cardTitle" : "body"}>
        {children}
      </AppText>
    </Pressable>
  )
}

export default function OnboardingScreen() {
  const { state, currentUser, actions } = useRaota()
  const [avatar, setAvatar] = useState<string | null>(currentUser?.avatar ?? null)
  const [nickname, setNickname] = useState("")
  const [favorite, setFavorite] = useState<string | null>(null)
  const [bio, setBio] = useState("")
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [agreeMarketing, setAgreeMarketing] = useState(false)
  const [policy, setPolicy] = useState<PolicyType | null>(null)
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [registered, setRegistered] = useState<UserProfile | null>(null)

  const scrollRef = useRef<ScrollView>(null)
  const nicknameRef = useRef<TextInput>(null)
  const nicknameBlockY = useRef(0)

  const nicknameError = nicknameErrorOf(nickname)
  const showNicknameError = Boolean(nicknameError) && (attempted || nickname.length > 0)
  const agreementError = attempted && (!agreeTerms || !agreePrivacy) ? "필수 약관 두 가지에 동의해야 가입할 수 있어요." : null
  const allAgreed = agreeTerms && agreePrivacy && agreeMarketing

  const toggleAll = (next: boolean) => {
    setAgreeTerms(next)
    setAgreePrivacy(next)
    setAgreeMarketing(next)
  }

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert(
        "사진 접근 권한이 필요해요",
        "설정에서 사진 접근을 허용하거나, 사진 없이도 계속 가입할 수 있어요.",
        [
          { text: "사진 없이 계속", style: "cancel" },
          { text: "설정 열기", onPress: () => void Linking.openSettings() },
        ],
      )
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.82,
    })
    if (!result.canceled && result.assets[0]?.uri) setAvatar(result.assets[0].uri)
  }

  const focusNickname = () => {
    scrollRef.current?.scrollTo({ y: Math.max(0, nicknameBlockY.current - spacing.x4), animated: true })
    nicknameRef.current?.focus()
    const node = findNodeHandle(nicknameRef.current)
    if (node) AccessibilityInfo.setAccessibilityFocus(node)
  }

  const submit = async () => {
    if (saving) return
    setAttempted(true)
    if (nicknameError) {
      AccessibilityInfo.announceForAccessibility?.(nicknameError)
      focusNickname()
      return
    }
    if (!agreeTerms || !agreePrivacy) {
      AccessibilityInfo.announceForAccessibility?.("필수 약관 두 가지에 동의해야 가입할 수 있어요.")
      return
    }
    const trimmed = nickname.trim()
    setSaving(true)
    setSaveError(null)
    try {
      // TODO(#44): 서버 가입 API로 교체하면서 마케팅 수신 동의(agreeMarketing)도 함께 저장한다
      const profile = await actions.completeOnboarding({
        name: trimmed,
        nickname: trimmed,
        avatar,
        bio: bio.trim() || undefined,
        ...(favorite ? { favoriteRamenType: favorite } : {}),
      })
      track("sign_up", { hasPhoto: Boolean(avatar), marketing: agreeMarketing, hasFavorite: Boolean(favorite) })
      success()
      setRegistered(profile)
    } catch {
      setSaveError("프로필을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.")
    } finally {
      setSaving(false)
    }
  }

  const leave = () => {
    // 간편 로그인 뒤 가입을 마치지 않고 나가면 반쯤 만든 계정으로 남기지 않는다
    if (currentUser && !state.onboardingCompleted) {
      actions.logout()
      router.replace("/native")
    } else if (router.canGoBack()) {
      router.back()
    } else {
      router.replace("/native")
    }
  }

  // ------------------------------------------------------------------
  // 가입 완료
  // ------------------------------------------------------------------
  if (registered) {
    return (
      <SafeAreaView edges={["top", "bottom"]} style={styles.root}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.doneContent} showsVerticalScrollIndicator={false}>
          <View style={styles.doneHead}>
            <View style={styles.doneAvatar}>
              {registered.avatar ? (
                <Image accessibilityLabel="프로필 사진" contentFit="cover" source={{ uri: registered.avatar }} style={styles.fill} />
              ) : (
                <UserRound color={colors.textMuted} size={36} />
              )}
            </View>
            <AppText accessibilityRole="header" style={styles.center} variant="headline">
              {registered.nickname}님, 반가워요
            </AppText>
            <AppText lineBreakStrategyIOS="hangul-word" style={styles.center} tone="muted" variant="body">
              {registered.level} Lv.{registered.levelNumber} · 첫 그릇을 기록하면 취향 분석이 시작돼요
            </AppText>
          </View>
          <View style={styles.features}>
            {ONBOARDING_FEATURES.map(({ Icon, title, desc }, index) => (
              <View accessible key={title} style={[styles.feature, index > 0 && styles.featureDivider]}>
                <View style={styles.featureIcon}>
                  <Icon color={colors.brand} size={20} />
                </View>
                <View style={styles.flexShrink}>
                  <AppText variant="cardTitle">{title}</AppText>
                  <AppText lineBreakStrategyIOS="hangul-word" tone="muted" variant="secondary">
                    {desc}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
        <View style={styles.doneFooter}>
          <Button
            fullWidth
            onPress={() => router.replace("/native")}
            rightIcon={<ChevronRight color={colors.onDark} size={20} />}
            size="large"
            title="라오타 시작하기"
          />
        </View>
      </SafeAreaView>
    )
  }

  // ------------------------------------------------------------------
  // 가입 폼
  // ------------------------------------------------------------------
  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.root}>
      <StatusBar style="dark" />
      <Header
        backLabel="뒤로가기"
        onBack={leave}
        right={
          currentUser ? null : (
            <Pressable
              accessibilityLabel="로그인"
              accessibilityRole="button"
              onPress={() => router.replace("/auth/login")}
              style={({ pressed }) => [styles.headerLink, pressed && styles.pressed]}
            >
              <AppText capScale tone="brand" variant="bodyStrong">
                로그인
              </AppText>
            </Pressable>
          )
        }
        title="회원가입"
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.intro}>
            <AppText accessibilityRole="header" variant="headline">
              반가워요!{"\n"}
              <AppText tone="brand" variant="headline">
                기본 정보
              </AppText>
              를 알려주세요
            </AppText>
            <AppText tone="muted" variant="body">
              라오타에서 쓸 닉네임과 취향을 정해요.
            </AppText>
          </View>

          {/* 프로필 사진(선택) */}
          <View style={styles.avatarBlock}>
            <View>
              <Pressable
                accessibilityHint="사진 보관함에서 골라요"
                accessibilityLabel="프로필 사진 선택"
                accessibilityRole="button"
                onPress={() => void pickAvatar()}
                style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
              >
                {avatar ? (
                  <Image accessibilityLabel="고른 프로필 사진" contentFit="cover" source={{ uri: avatar }} style={styles.fill} />
                ) : (
                  <UserRound color={colors.textMuted} size={40} />
                )}
              </Pressable>
              <View pointerEvents="none" style={styles.cameraBadge}>
                <Camera color={colors.onDark} size={14} />
              </View>
              {avatar ? (
                <Pressable
                  accessibilityLabel="고른 사진 지우기"
                  accessibilityRole="button"
                  onPress={() => setAvatar(null)}
                  style={styles.avatarClear}
                >
                  <View style={styles.avatarClearDot}>
                    <X color={colors.textMuted} size={16} />
                  </View>
                </Pressable>
              ) : null}
            </View>
            <AppText style={styles.bold} tone="muted" variant="secondary">
              프로필 사진 (선택)
            </AppText>
          </View>

          {/* 닉네임 */}
          <View onLayout={(event) => (nicknameBlockY.current = event.nativeEvent.layout.y)} style={styles.field}>
            <View style={styles.fieldHead}>
              <AppText nativeID="nickname-label" variant="bodyStrong">
                닉네임 <AppText tone="brand" variant="bodyStrong">*</AppText>
              </AppText>
              <AppText capScale style={styles.tabular} tone="muted" variant="secondary">
                {nickname.length}/{NICKNAME_MAX}
              </AppText>
            </View>
            <TextInput
              accessibilityHint={showNicknameError && nicknameError ? nicknameError : `한글, 영문, 숫자 ${NICKNAME_MIN}~${NICKNAME_MAX}자`}
              accessibilityLabel="닉네임"
              autoComplete="nickname"
              autoCorrect={false}
              maxLength={NICKNAME_MAX}
              onChangeText={setNickname}
              onSubmitEditing={() => void submit()}
              placeholder="예: 라멘러버, 멘마수집가"
              placeholderTextColor={colors.textMuted}
              ref={nicknameRef}
              returnKeyType="done"
              style={[styles.input, showNicknameError ? styles.inputError : !nicknameError && styles.inputValid]}
              textContentType="nickname"
              value={nickname}
            />
            {showNicknameError ? (
              <AppText accessibilityLiveRegion="polite" style={styles.fieldNote} tone="critical" variant="secondary">
                {nicknameError}
              </AppText>
            ) : (
              <AppText style={styles.fieldNote} tone="muted" variant="secondary">
                한글, 영문, 숫자 {NICKNAME_MIN}~{NICKNAME_MAX}자
              </AppText>
            )}
          </View>

          {/* 선호 스타일(선택) */}
          <View accessibilityLabel="선호 라멘 스타일" style={styles.field}>
            <AppText variant="bodyStrong">선호 라멘 스타일 (선택)</AppText>
            <View style={styles.chips}>
              {RAMEN_STYLE_OPTIONS.map((style) => (
                <Chip
                  key={style.key}
                  label={style.name}
                  onPress={() => setFavorite((previous) => (previous === style.key ? null : style.key))}
                  selected={favorite === style.key}
                />
              ))}
            </View>
          </View>

          {/* 한줄 소개(선택) */}
          <View style={styles.field}>
            <View style={styles.fieldHead}>
              <AppText variant="bodyStrong">한줄 소개 (선택)</AppText>
              <AppText capScale style={styles.tabular} tone="muted" variant="secondary">
                {bio.length}/{BIO_MAX}
              </AppText>
            </View>
            <TextInput
              accessibilityLabel="한줄 소개"
              maxLength={BIO_MAX}
              multiline
              onChangeText={setBio}
              placeholder="라멘에 진심인 편입니다. 깊은 국물 맛을 찾아다녀요."
              placeholderTextColor={colors.textMuted}
              style={[styles.input, styles.textarea]}
              textAlignVertical="top"
              value={bio}
            />
            <ScrollView contentContainerStyle={styles.quickTags} horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false}>
              {QUICK_BIO_TAGS.map((tag) => (
                <Pressable
                  accessibilityLabel={`소개에 ${tag} 넣기`}
                  accessibilityRole="button"
                  key={tag}
                  onPress={() => setBio(tag)}
                  style={({ pressed }) => [styles.quickTag, pressed && styles.pressed]}
                >
                  <View style={styles.quickTagPill}>
                    <AppText capScale tone="sub" variant="secondary">
                      + {tag}
                    </AppText>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* 약관 */}
          <View style={styles.terms}>
            <View style={styles.termsAll}>
              <CheckRow checked={allAgreed} label="약관 전체 동의" onChange={toggleAll} strong>
                약관 전체 동의
              </CheckRow>
            </View>
            <View style={styles.termRow}>
              <CheckRow checked={agreeTerms} label="필수, 서비스 이용약관 동의" onChange={setAgreeTerms}>
                <AppText style={styles.bold} tone="brand" variant="body">
                  [필수]
                </AppText>{" "}
                서비스 이용약관 동의
              </CheckRow>
              <Pressable
                accessibilityLabel="서비스 이용약관 보기"
                accessibilityRole="button"
                onPress={() => setPolicy("terms")}
                style={({ pressed }) => [styles.viewLink, pressed && styles.pressed]}
              >
                <AppText capScale style={styles.underline} tone="muted" variant="secondary">
                  보기
                </AppText>
              </Pressable>
            </View>
            <View style={styles.termRow}>
              <CheckRow checked={agreePrivacy} label="필수, 개인정보 수집 및 이용 동의" onChange={setAgreePrivacy}>
                <AppText style={styles.bold} tone="brand" variant="body">
                  [필수]
                </AppText>{" "}
                개인정보 수집 및 이용 동의
              </CheckRow>
              <Pressable
                accessibilityLabel="개인정보 수집 및 이용 동의 보기"
                accessibilityRole="button"
                onPress={() => setPolicy("privacy")}
                style={({ pressed }) => [styles.viewLink, pressed && styles.pressed]}
              >
                <AppText capScale style={styles.underline} tone="muted" variant="secondary">
                  보기
                </AppText>
              </Pressable>
            </View>
            <CheckRow checked={agreeMarketing} label="선택, 라멘 추천 및 소식 수신 동의" onChange={setAgreeMarketing}>
              <AppText style={styles.bold} tone="muted" variant="body">
                [선택]
              </AppText>{" "}
              라멘 추천 및 소식 수신 동의
            </CheckRow>
            {agreementError ? (
              <AppText accessibilityLiveRegion="polite" tone="critical" variant="secondary">
                {agreementError}
              </AppText>
            ) : null}
          </View>

          {saveError ? (
            <AppText accessibilityLiveRegion="polite" tone="critical" variant="secondary">
              {saveError}
            </AppText>
          ) : null}

          <Button
            fullWidth
            loading={saving}
            onPress={() => void submit()}
            rightIcon={<ChevronRight color={colors.onDark} size={20} />}
            size="large"
            style={styles.submit}
            title="회원가입 완료"
          />

          {currentUser ? null : (
            <View style={styles.loginRow}>
              <AppText tone="muted" variant="body">
                이미 계정이 있으신가요?
              </AppText>
              <Pressable
                accessibilityLabel="로그인하기"
                accessibilityRole="button"
                onPress={() => router.replace("/auth/login")}
                style={({ pressed }) => [styles.headerLink, pressed && styles.pressed]}
              >
                <AppText style={styles.underline} variant="bodyStrong">
                  로그인하기
                </AppText>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <PolicySheet
        footer={
          <Button
            fullWidth
            onPress={() => {
              if (policy === "terms") setAgreeTerms(true)
              if (policy === "privacy") setAgreePrivacy(true)
              setPolicy(null)
            }}
            title="확인하고 동의"
            variant="secondary"
          />
        }
        onClose={() => setPolicy(null)}
        title={policy === "privacy" ? "개인정보 수집 및 이용 동의" : policy === "terms" ? "서비스 이용약관" : undefined}
        type={policy}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1, minWidth: 0 },
  fill: { width: "100%", height: "100%" },
  center: { textAlign: "center" },
  bold: { fontWeight: "700" },
  underline: { textDecorationLine: "underline" },
  tabular: { fontVariant: ["tabular-nums"] },
  pressed: { opacity: 0.7 },
  headerLink: { minHeight: touchTarget, justifyContent: "center", paddingHorizontal: spacing.x2 },
  content: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.x6,
    paddingBottom: spacing.x8,
    gap: spacing.x6,
  },
  intro: { gap: spacing.x1_5 },
  avatarBlock: { alignItems: "center", gap: spacing.x2 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.canvasSoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  cameraBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.canvas,
    backgroundColor: colors.ink,
    padding: spacing.x1_5,
  },
  avatarClear: {
    position: "absolute",
    right: -spacing.x3,
    top: -spacing.x3,
    width: touchTarget,
    height: touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarClearDot: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  field: { gap: spacing.x1_5 },
  fieldHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  input: {
    ...typography.body,
    fontSize: 15,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.x4,
    paddingVertical: spacing.x3,
    color: colors.ink,
    backgroundColor: colors.canvas,
  },
  inputError: { borderColor: colors.critical },
  inputValid: { borderColor: colors.ink },
  textarea: { minHeight: 72, fontSize: 14 },
  fieldNote: { marginTop: spacing.x0_5 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x1_5 },
  quickTags: { gap: spacing.x1 },
  quickTag: { minHeight: touchTarget, justifyContent: "center" },
  quickTagPill: {
    borderRadius: radii.pill,
    backgroundColor: colors.canvasSoft,
    paddingHorizontal: spacing.x3,
    paddingVertical: spacing.x1,
  },
  terms: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.x3 },
  termsAll: { borderBottomWidth: 1, borderBottomColor: colors.canvasSoft, marginBottom: spacing.x1 },
  termRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.x2 },
  checkRow: { flex: 1, minHeight: touchTarget, flexDirection: "row", alignItems: "center", gap: spacing.x2_5 },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.textFaint,
    backgroundColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  checkBoxOn: { borderColor: colors.brand, backgroundColor: colors.brand },
  checkStrong: { fontWeight: "800" },
  viewLink: { minHeight: touchTarget, minWidth: touchTarget, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.x2 },
  submit: { marginTop: -spacing.x2 },
  loginRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", flexWrap: "wrap", marginTop: -spacing.x4 },
  doneContent: { paddingHorizontal: spacing.gutter, paddingTop: spacing.x8, paddingBottom: spacing.x4 },
  doneHead: { alignItems: "center", gap: spacing.x1 },
  doneAvatar: {
    width: 80,
    height: 80,
    borderRadius: radii.pill,
    backgroundColor: colors.canvasSoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: spacing.x2,
  },
  features: { marginTop: spacing.x8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  feature: { flexDirection: "row", alignItems: "flex-start", gap: spacing.x3, paddingVertical: spacing.x4 },
  featureDivider: { borderTopWidth: 1, borderTopColor: colors.canvasSoft },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.brandWeak,
    alignItems: "center",
    justifyContent: "center",
  },
  doneFooter: { paddingHorizontal: spacing.gutter, paddingTop: spacing.x2, paddingBottom: spacing.x4 },
})
