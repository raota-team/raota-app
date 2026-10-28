import { t } from "@raota/shared"
import { useLocale } from "@/src/i18n"
import { useRef, useState } from "react"
import { router } from "expo-router"
import { StatusBar } from "expo-status-bar"
import * as Haptics from "expo-haptics"
import * as ImagePicker from "expo-image-picker"
import { Image } from "expo-image"
import { ChevronRight, MapPin, Soup, Sparkles, UserRound, X, type LucideIcon } from "lucide-react-native"
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

import { MONTHLY_REPORT_TARGET, RAMEN_TYPES, type UserProfile } from "@raota/shared"
import { track } from "@/src/analytics"
import { isApiError } from "@/src/api/client"
import { CONSENT_REQUIRED_ERROR, ConsentChecklist, NO_CONSENTS, type ConsentValues } from "@/src/components/ConsentChecklist"
import { AppText, Button, Chip, ConfirmDialog, Header, StickyActionBar } from "@/src/components/ui"
import { useNicknameAvailability } from "@/src/data"
import { OnboardingProfileUpdateError } from "@/src/data/remote"
import { NICKNAME_MAX, NICKNAME_MIN, NICKNAME_REQUIRED_ERROR, validateNickname } from "@/src/domain/nickname"
import { ONBOARDING_PROMPT_DELAY, useRecordReminderPrompt } from "@/src/notifications"
import { useRaota } from "@/src/state/RaotaStore"
import { sizedImageUri } from "@/src/api/imageSize"
import { TASTE_REPORT_ENABLED } from "@/src/features"
import { colors, line, pressFade, radii, spacing, touchTarget, typography } from "@/src/theme"

/*
 * 회원가입: 닉네임 → 선호 스타일 → 약관 → 선택 입력(소개·사진).
 * 약관 목록은 약관 다시 동의 화면과 같은 ConsentChecklist를 쓴다.
 * 서버 회원(auth remote)이면 닉네임 중복을 입력이 멈춘 뒤 확인하고, 가입은 PUT /members/me/onboarding으로 끝낸다.
 * 가입은 됐는데 선택 프로필(소개·스타일·사진)만 못 올렸으면, 다시 누를 때 가입은 건너뛰고 프로필만 저장한다.
 */

const BIO_MAX = 60
const SIGNUP_SAVE_ERROR = "가입하지 못했어요. 잠시 후 다시 시도해 주세요."
const PROFILE_SAVE_ERROR = "가입은 됐지만 소개·사진을 저장하지 못했어요. 다시 누르면 그것만 저장해요."
const NICKNAME_TAKEN_ERROR = "이미 사용 중인 닉네임이에요. 다른 닉네임을 적어 주세요."

/** 설정 화면과 같은 종류를 저장한다. 칩에는 짧은 이름만 쓴다. */
const RAMEN_STYLE_OPTIONS = RAMEN_TYPES

const ONBOARDING_FEATURES: Array<{ Icon: LucideIcon; title: string; desc: string }> = [
  { Icon: MapPin, title: "내 주변 라멘집 찾기", desc: "지도에서 영업 여부와 라스트오더를 확인하고 바로 찾아가요." },
  {
    Icon: Soup,
    title: "한 그릇 라멘로그",
    desc: TASTE_REPORT_ENABLED ? "먹은 라멘을 5가지 축으로 기록하면 취향 리포트가 쌓여요." : "먹은 라멘을 5가지 축으로 기록하고 다시 꺼내 봐요.",
  },
  { Icon: Sparkles, title: "AI 큐레이터", desc: "원하는 국물과 분위기를 고르면 오늘의 한 곳을 골라 드려요." },
]


function success() {
  if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
}

function CharacterCount({ value, max, prefix = "" }: { value: number; max: number; prefix?: string }) {
  return (
    <View style={styles.counterSlot}>
      <AppText accessibilityElementsHidden capScale importantForAccessibility="no-hide-descendants" style={[styles.tabular, styles.hiddenFeedback]} tone="sub" variant="meta">
        {`${prefix}${max}/${max}`}
      </AppText>
      <AppText capScale style={[styles.tabular, styles.counterValue]} tone="sub" variant="meta">
        {`${prefix}${value}/${max}`}
      </AppText>
    </View>
  )
}


export default function OnboardingScreen() {
  useLocale()
  const { state, currentUser, actions } = useRaota()
  const [avatar, setAvatar] = useState<string | null>(currentUser?.avatar ?? null)
  const [nickname, setNickname] = useState("")
  const [showMoreStyles, setShowMoreStyles] = useState(false)
  const [favorite, setFavorite] = useState<string | null>(null)
  const [bio, setBio] = useState("")
  const [consents, setConsents] = useState<ConsentValues>(NO_CONSENTS)
  const [attempted, setAttempted] = useState(false)
  /** 서버가 409로 거절한 닉네임(대소문자 무시 값) */
  const [rejectedNickname, setRejectedNickname] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [registered, setRegistered] = useState<UserProfile | null>(null)
  /** 가입은 끝났고 선택 프로필 저장만 다시 하면 된다 */
  const [profileRetry, setProfileRetry] = useState(false)

  /*
   * 알림은 가입을 마친 뒤 한 번 묻는다. 거절하거나 나중에 끄고 싶으면 설정(마이 > 톱니)에서 관리한다.
   * iOS 시스템 권한창은 앱 생애에 한 번뿐이라, 앱이 먼저 무엇을 알려줄지 말하고 "알림 받기"를 누른 사람에게만 띄운다.
   */
  const reminder = useRecordReminderPrompt(Boolean(registered), 0, ONBOARDING_PROMPT_DELAY)

  const scrollRef = useRef<ScrollView>(null)
  const nicknameRef = useRef<TextInput>(null)
  const nicknameBlockY = useRef(0)

  const nicknameValidation = validateNickname(nickname)
  const availability = useNicknameAvailability(nicknameValidation.normalized, !nicknameValidation.error)
  const nicknameTaken = availability === "taken" || rejectedNickname === nicknameValidation.normalized
  const nicknameError = nicknameValidation.error ?? (nicknameTaken ? NICKNAME_TAKEN_ERROR : null)
  const showNicknameError = Boolean(nicknameError) && (attempted || nickname.length > 0)
  const nicknameNote = availability === "available" ? t("사용할 수 있는 닉네임이에요.") : t("한글, 영문, 숫자, 밑줄 {v1}~{v2}자", { v1: NICKNAME_MIN, v2: NICKNAME_MAX })

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert(
        t("사진 접근 권한이 필요해요"),
        t("설정에서 사진 접근을 허용하거나, 사진 없이도 계속 가입할 수 있어요."),
        [
          { text: t("사진 없이 계속"), style: "cancel" },
          { text: t("설정 열기"), onPress: () => void Linking.openSettings() },
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
    if (!consents.terms || !consents.privacy) {
      AccessibilityInfo.announceForAccessibility?.(CONSENT_REQUIRED_ERROR)
      return
    }
    const displayNickname = nicknameValidation.display
    const extras = {
      avatar,
      bio: bio.trim() || undefined,
      ...(favorite ? { favoriteRamenType: favorite } : {}),
    }
    setSaving(true)
    setSaveError(null)
    try {
      // 앞선 시도에서 가입은 끝났고 선택 프로필만 남았으면 가입을 다시 보내지 않는다
      const profile =
        profileRetry && currentUser
          ? ((await actions.updateProfile(extras)) ?? currentUser)
          : await actions.completeOnboarding(
              { name: displayNickname, nickname: displayNickname, ...extras },
              { marketing: consents.marketing },
            )
      track("sign_up", { hasPhoto: Boolean(avatar), marketing: consents.marketing, hasFavorite: Boolean(favorite) })
      success()
      setRegistered(profile)
    } catch (error) {
      if (error instanceof OnboardingProfileUpdateError) {
        setProfileRetry(true)
        setSaveError(PROFILE_SAVE_ERROR)
      } else if (isApiError(error, "CONFLICT")) {
        // 닉네임 충돌(이미 가입된 경우는 스토어가 회원을 다시 읽어 성공으로 처리한다)
        setRejectedNickname(nicknameValidation.normalized)
        focusNickname()
      } else {
        setSaveError(profileRetry ? PROFILE_SAVE_ERROR : SIGNUP_SAVE_ERROR)
      }
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
      // 완료 뒤에도 바와 홈 인디케이터의 여백은 같은 흰 면으로 이어진다
      <SafeAreaView edges={["top"]} style={styles.root}>
        <StatusBar style="auto" />
        <ScrollView contentContainerStyle={styles.doneContent} showsVerticalScrollIndicator={false}>
          <View style={styles.doneHead}>
            <View style={styles.doneAvatar}>
              {registered.avatar ? (
                <Image accessibilityLabel={t("프로필 사진")} contentFit="cover" source={{ uri: sizedImageUri(registered.avatar, 120) }} style={styles.fill} />
              ) : (
                <UserRound color={colors.textMuted} size={36} />
              )}
            </View>
            <AppText accessibilityRole="header" lineBreakStrategyIOS="hangul-word" style={styles.center} variant="headline">
              {registered.nickname}{t("님, 반가워요 ")}</AppText>
            <AppText lineBreakStrategyIOS="hangul-word" style={styles.center} tone="sub" variant="body">
              {t(registered.level)} Lv.{registered.levelNumber} {t(" · 첫 그릇을 기록하면 취향 분석이 시작돼요 ")}</AppText>
          </View>
          <View style={styles.features}>
            {ONBOARDING_FEATURES.map(({ Icon, title, desc }, index) => (
              <View accessible key={title} style={[styles.feature, index > 0 && styles.featureDivider]}>
                <View style={styles.featureIcon}>
                  <Icon color={colors.ink} size={20} />
                </View>
                <View style={styles.flexShrink}>
                  <AppText variant="cardTitle">{t(title)}</AppText>
                  <AppText lineBreakStrategyIOS="hangul-word" style={styles.featureDescription} tone="sub" variant="secondary">
                    {desc}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
        <ConfirmDialog
          cancelLabel={t("나중에")}
          confirmLabel={t("알림 받기")}
          loading={reminder.busy}
          message={
            TASTE_REPORT_ENABLED
              ? t("이번 달 기록이 {v1}그릇이 되면 다음 달 1일에 월간 리포트가 나와요. 마감 전과 기록이 일주일 뜸할 때만 알려드릴게요. 설정에서 언제든 끌 수 있어요.", { v1: MONTHLY_REPORT_TARGET })
              : t("기록이 일주일 뜸할 때만 알려드릴게요. 설정에서 언제든 끌 수 있어요.")
          }
          onCancel={reminder.decline}
          onConfirm={() => void reminder.accept()}
          title={t("기록할 때가 되면 알려드릴까요?")}
          visible={reminder.visible}
        />

        <StickyActionBar>
          <Button
            fullWidth
            onPress={() => router.replace("/native")}
            rightIcon={<ChevronRight color={colors.onDark} size={20} />}
            size="large"
            title={t("라오타 시작하기")}
          />
        </StickyActionBar>
      </SafeAreaView>
    )
  }

  // ------------------------------------------------------------------
  // 가입 폼
  // ------------------------------------------------------------------
  return (
    <SafeAreaView edges={["top"]} style={styles.root}>
      <StatusBar style="auto" />
      <Header backLabel={t("뒤로가기")} onBack={leave} title={t("회원가입")} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.intro}>
            <AppText accessibilityRole="header" lineBreakStrategyIOS="hangul-word" style={styles.introTitle} variant="headline">
              {t("반가워요!")}{"\n"}{t("기본 정보를 알려주세요 ")}</AppText>
            <AppText lineBreakStrategyIOS="hangul-word" tone="sub" variant="body">
              {t("라오타에서 쓸 닉네임과 취향을 정해요. ")}</AppText>
          </View>

          {/* 닉네임 */}
          <View onLayout={(event) => (nicknameBlockY.current = event.nativeEvent.layout.y)} style={styles.field}>
            <View style={styles.fieldHead}>
              <AppText nativeID="nickname-label" variant="button">{t("닉네임")}</AppText>
              <CharacterCount max={NICKNAME_MAX} prefix="· " value={nicknameValidation.length} />
            </View>
            <TextInput
              accessibilityHint={showNicknameError && nicknameError ? nicknameError : t("한글, 영문, 숫자, 밑줄 {v1}~{v2}자", { v1: NICKNAME_MIN, v2: NICKNAME_MAX })}
              accessibilityLabel={t("닉네임")}
              autoComplete="nickname"
              autoCorrect={false}
              maxLength={NICKNAME_MAX}
              onChangeText={setNickname}
              onSubmitEditing={() => void submit()}
              placeholder={t("예: 라멘러버, 멘마수집가")}
              placeholderTextColor={colors.textMuted}
              ref={nicknameRef}
              returnKeyType="done"
              style={[styles.input, showNicknameError && styles.inputError]}
              textContentType="nickname"
              value={nickname}
            />
            <View style={styles.noteSlot}>
              <AppText
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                lineBreakStrategyIOS="hangul-word"
                style={styles.hiddenFeedback}
                tone="sub"
                variant="secondary"
              >
                {t(NICKNAME_REQUIRED_ERROR)}
              </AppText>
              <AppText
                accessibilityLiveRegion={showNicknameError ? "polite" : undefined}
                lineBreakStrategyIOS="hangul-word"
                style={styles.noteValue}
                tone={showNicknameError ? "critical" : "sub"}
                variant="secondary"
              >
                {showNicknameError ? nicknameError : nicknameNote}
              </AppText>
            </View>
          </View>

          {/* 선호 스타일(선택) */}
          <View accessibilityLabel={t("선호 라멘 스타일")} style={styles.field}>
            <AppText style={styles.styleTitle} variant="sectionTitle">{t("선호 라멘 스타일 ")}<AppText tone="muted" variant="meta">{t("선택")}</AppText></AppText>
            <AppText tone="muted" variant="secondary">{t("가장 끌리는 한 그릇을 골라주세요.")}</AppText>
            <View style={styles.chips}>
              {RAMEN_STYLE_OPTIONS.slice(0, showMoreStyles ? undefined : 6).map((style) => (
                <Chip
                  key={style}
                  label={style}
                  onPress={() => setFavorite((previous) => (previous === style ? null : style))}
                  selected={favorite === style}
                  style={styles.styleChip}
                  hitSlop={{ top: 2, bottom: 2 }}
                />
              ))}
            </View>
            <Pressable
              accessibilityLabel={showMoreStyles ? t("다른 스타일 접기") : t("다른 스타일 보기")}
              accessibilityRole="button"
              onPress={() => setShowMoreStyles((value) => !value)}
              style={styles.moreStyles}
            >
              <AppText tone="sub" variant="meta">{showMoreStyles ? t("접기") : t("다른 스타일 보기")}</AppText>
            </Pressable>
          </View>

          {/* 약관 */}
          <ConsentChecklist onChange={setConsents} showError={attempted} value={consents} />

          {/* 한줄 소개(선택) */}
          <View style={styles.field}>
            <View style={styles.fieldHead}>
              <AppText variant="button">{t("한줄 소개 (선택)")}</AppText>
              <CharacterCount max={BIO_MAX} value={bio.length} />
            </View>
            <TextInput
              accessibilityLabel={t("한줄 소개")}
              maxLength={BIO_MAX}
              onChangeText={setBio}
              placeholder={t("라멘에 진심인 편입니다.")}
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={bio}
            />
          </View>
          {/* 프로필 사진은 유지하되 필수 입력 아래에 둔다. */}
          <View style={styles.avatarBlock}>
            <Pressable
              accessibilityHint={t("사진 보관함에서 골라요")}
              accessibilityLabel={t("프로필 사진 선택")}
              accessibilityRole="button"
              onPress={() => void pickAvatar()}
              style={({ pressed }) => [styles.avatar, pressed && pressFade]}
            >
              {avatar ? (
                <Image accessibilityLabel={t("고른 프로필 사진")} contentFit="cover" source={{ uri: sizedImageUri(avatar, 120) }} style={styles.fill} />
              ) : (
                <UserRound color={colors.textMuted} size={24} />
              )}
            </Pressable>
            <AppText tone="muted" variant="secondary">{t("프로필 사진 (선택)")}</AppText>
            <Pressable
              accessibilityElementsHidden={!avatar}
              accessibilityLabel={t("고른 사진 지우기")}
              accessibilityRole="button"
              disabled={!avatar}
              importantForAccessibility={avatar ? "auto" : "no-hide-descendants"}
              onPress={() => setAvatar(null)}
              style={[styles.avatarClear, !avatar && styles.hiddenFeedback]}
            >
              <X color={colors.ink} size={18} />
            </Pressable>
          </View>


          <AppText
            accessibilityElementsHidden={!saveError}
            accessibilityLiveRegion={saveError ? "polite" : undefined}
            importantForAccessibility={saveError ? "auto" : "no-hide-descendants"}
            style={!saveError && styles.hiddenFeedback}
            tone="critical"
            variant="secondary"
          >
            {saveError ?? PROFILE_SAVE_ERROR}
          </AppText>

        </ScrollView>
        <StickyActionBar>
          <Button
            fullWidth
            loading={saving}
            onPress={() => void submit()}
            size="large"
            title={t("회원가입 완료")}
          />
        </StickyActionBar>
      </KeyboardAvoidingView>

    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1, minWidth: 0 },
  fill: { width: "100%", height: "100%" },
  center: { textAlign: "center" },
  tabular: { fontVariant: ["tabular-nums"] },
  counterSlot: { position: "relative" },
  counterValue: { position: "absolute", top: 0, right: 0 },
  hiddenFeedback: { opacity: 0 },
  noteSlot: { position: "relative" },
  noteValue: { position: "absolute", top: 0, left: 0, right: 0 },
  content: {
    paddingHorizontal: 20,
    paddingTop: spacing.x4,
    paddingBottom: spacing.x8,
  },
  intro: { gap: spacing.x1_5 },
  introTitle: { fontSize: 26, lineHeight: 32 },
  avatarBlock: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: touchTarget, marginTop: spacing.section },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.canvasSoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarClear: { width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center", marginLeft: "auto" },
  field: { gap: spacing.x3, marginTop: spacing.section },
  fieldHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  // 입력 필드는 흰 면, 1pt 테두리와 16pt 본문으로 맞춘다
  input: {
    ...typography.body,
    minHeight: 48,
    borderWidth: line.base,
    borderColor: colors.outline,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.x4,
    paddingVertical: spacing.x3,
    color: colors.ink,
    backgroundColor: colors.canvas,
  },
  inputError: { borderColor: colors.critical },
  styleTitle: { fontSize: 17, lineHeight: 24 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  styleChip: { height: 44 },
  moreStyles: { minHeight: touchTarget, alignSelf: "flex-start", justifyContent: "center" },
  doneContent: { paddingHorizontal: spacing.gutter, paddingTop: spacing.x6, paddingBottom: spacing.x8 },
  doneHead: { alignItems: "center", gap: spacing.x1 },
  doneAvatar: {
    width: 80,
    height: 80,
    borderRadius: radii.pill,
    backgroundColor: colors.canvasSoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: spacing.x3,
  },
  features: { marginTop: spacing.section, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  feature: { flexDirection: "row", alignItems: "flex-start", gap: spacing.x3, paddingVertical: spacing.x4 },
  featureDescription: { marginTop: spacing.x1 },
  featureDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.canvasSoft,
    alignItems: "center",
    justifyContent: "center",
  },
})
