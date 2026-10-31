import { t, ph, msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core"
import { labelOf, translate } from "@raota/shared"
import { useLocale } from "@/src/i18n"
import { Redirect, router } from "expo-router"
import appConfig from "../../app.json"
import * as Haptics from "expo-haptics"
import { ChevronRight } from "lucide-react-native"
import { useState } from "react"
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { LEGAL_CONTACT_EMAIL, RAMEN_TYPES } from "@raota/shared"
import { AppText, BottomSheet, Button, ConfirmDialog, Header, Screen, Toast } from "@/src/components/ui"
import { useMonthlyReports } from "@/src/data"
import { TASTE_REPORT_ENABLED } from "@/src/features"
import { useReminderSwitch } from "@/src/notifications"
import { requestPermission, usePermissions, type PermissionKind, type PermissionState } from "@/src/permissions"
import { useRaota } from "@/src/state/RaotaStore"
import { colors, line, radii, spacing, typography } from "@/src/theme"

/*
 * 설정. 마이의 최근 기록이 스크롤로 계속 늘어나서 계정·약관·로그아웃을 여기로 옮겼다(마이 프로필 오른쪽 위 톱니).
 * 로그아웃하면 바로 로그인 화면으로 간다(사용자 결정 2026.10.26, 비회원 마이 화면을 없앴다).
 * 그 밖에 로그인하지 않은 채로 열리면(탈퇴 직후 포함) 홈으로 돌려보낸다.
 */
// 취향 리포트를 숨긴 빌드는 월간 리포트 알림을 예약하지 않는다(src/notifications/reminders.ts)
const REMINDER_DESCRIPTION = TASTE_REPORT_ENABLED
  ? msg`월간 리포트 마감 전과 기록이 일주일 뜸할 때만 알려드려요.`
  : msg`기록이 일주일 뜸할 때만 알려드려요.`
const BLOCKED_REMINDER_DESCRIPTION = msg`iOS 설정에서 알림이 꺼져 있어요. 눌러서 설정을 열 수 있어요.`
const EMAIL_FORMAT_ERROR = msg`이메일 형식이 아니에요. 예: ramen@example.com`
const EMAIL_SAVE_ERROR = msg`저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.`

function haptic() {
  if (Platform.OS === "web") return
  void Haptics.selectionAsync().catch(() => undefined)
}

function openLegal(doc: "terms" | "privacy") {
  router.push({ pathname: "/legal/[doc]", params: { doc } })
}

export default function SettingsScreen() {
  useLocale()
  const { currentUser: user, actions } = useRaota()
  const insets = useSafeAreaInsets()
  const [sheet, setSheet] = useState<"style" | "email" | null>(null)
  const [dialog, setDialog] = useState<"logout" | "withdraw" | null>(null)
  const [newEmail, setNewEmail] = useState("")
  // 오류 문구는 설명자로 두고 그릴 때 번역한다(언어를 바꿔도 따라 바뀐다)
  const [emailError, setEmailError] = useState<MessageDescriptor | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const monthly = useMonthlyReports()
  const reminders = useReminderSwitch(monthly.data.current?.recordCount ?? 0)
  const permissions = usePermissions()

  if (!user) return <Redirect href="/native" />

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/native/my"))

  /*
   * iOS 권한창은 앱 생애에 한 번뿐이라, 시스템에서 이미 막혔으면(blocked) 앱이 다시 띄울 수 없다.
   * 그때는 설정 앱으로 보내고, 그 밖에는 스위치가 직접 켜고 끈다.
   */
  const toggleReminders = async (next: boolean) => {
    haptic()
    if (next && reminders.blocked) {
      await Linking.openSettings().catch(() => setToast(t`설정 앱을 열지 못했어요`))
      return
    }
    await reminders.toggle(next)
    setToast(next ? t`기록할 때가 되면 알려드릴게요` : t`알림을 껐어요. 언제든 다시 켤 수 있어요`)
  }

  // 묻기 전이면 그 자리에서 권한창을 띄우고, 한 번 답한 권한은 앱이 바꿀 수 없어 설정 앱의 RAOTA 화면을 연다
  const openPermission = async (kind: PermissionKind) => {
    haptic()
    if (permissions.snapshot[kind] === "undetermined") {
      // 알림은 리마인더 스위치와 같은 흐름(권한을 묻고 바로 예약)을 탄다
      if (kind === "notifications") await toggleReminders(true)
      else await requestPermission(kind)
      await permissions.refresh()
      return
    }
    await Linking.openSettings().catch(() => setToast(t`설정 앱을 열지 못했어요`))
  }

  const permissionRows: { kind: PermissionKind; label: string; why: string }[] = [
    { kind: "location", label: t`위치`, why: t`가까운 라멘집과 거리를 보여 줄 때 써요` },
    { kind: "camera", label: t`카메라`, why: t`기록에 라멘 사진을 찍어 올릴 때 써요` },
    { kind: "photos", label: t`사진`, why: t`기록과 프로필에 사진을 고를 때 써요` },
    { kind: "notifications", label: t`알림`, why: t`기록 리마인더를 보낼 때 써요` },
  ]

  const saveStyle = async (style: string) => {
    haptic()
    try {
      await actions.updateProfile({ favoriteRamenType: style })
      // ICU에서 ' 바로 뒤의 {는 글자로 읽힌다. 따옴표를 보이려면 ''로 쓴다
      setToast(t`선호 스타일을 ''${ph({ v1: labelOf(style) })}''로 바꿨어요`)
    } catch {
      setToast(t`선호 스타일을 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.`)
    } finally {
      setSheet(null)
    }
  }

  const saveEmail = async () => {
    const trimmed = newEmail.trim()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError(EMAIL_FORMAT_ERROR)
      return
    }
    setBusy(true)
    try {
      await actions.updateProfile({ email: trimmed })
      setSheet(null)
      setToast(t`이메일 주소를 바꿨어요`)
    } catch {
      setEmailError(EMAIL_SAVE_ERROR)
    } finally {
      setBusy(false)
    }
  }

  // 서버 회원이면 서버 탈퇴가 먼저 성공해야 기기 데이터를 지운다. 실패하면 계정은 그대로이고 다시 시도할 수 있다
  const withdraw = async () => {
    setBusy(true)
    try {
      await actions.withdraw()
    } catch {
      setToast(t`탈퇴하지 못했어요. 잠시 후 다시 시도해 주세요.`)
    } finally {
      setBusy(false)
      setDialog(null)
    }
  }

  return (
    <Screen>
      <Header align="center" backLabel={t`뒤로가기`} onBack={goBack} title={t`설정`} titleStyle={typography.sectionTitle} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.section }]} style={styles.scroll}>
        <Group title={t`계정`}>
          <AccountRow
            first
            label={t`이메일`}
            onChange={() => {
              setNewEmail(user.email ?? "")
              setEmailError(null)
              setSheet("email")
            }}
            value={user.email || t`등록된 이메일 없음`}
          />
          <AccountRow label={t`선호 스타일`} onChange={() => setSheet("style")} value={user.favoriteRamenType ? labelOf(user.favoriteRamenType) : t`아직 안 정했어요`} />
          <LinkRow label={t`숨긴 사용자`} onPress={() => router.push("/hidden-authors")} />
        </Group>
        {reminders.supported ? (
          <Group title={t`알림`}>
            <View style={[styles.row, styles.switchRow]}>
              <View style={styles.shrink}>
                <AppText variant="bodyStrong">{t`기록 리마인더`}</AppText>
                <View style={styles.descriptionSlot}>
                  <AppText
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    lineBreakStrategyIOS="hangul-word"
                    style={styles.hiddenText}
                    tone="muted"
                    variant="secondary"
                  >
                    {translate(BLOCKED_REMINDER_DESCRIPTION)}
                  </AppText>
                  <AppText lineBreakStrategyIOS="hangul-word" style={styles.overlaidText} tone="muted" variant="secondary">
                    {translate(reminders.blocked ? BLOCKED_REMINDER_DESCRIPTION : REMINDER_DESCRIPTION)}
                  </AppText>
                </View>
              </View>
              <Switch
                accessibilityHint={reminders.blocked ? t`iOS 설정 앱을 엽니다` : undefined}
                accessibilityLabel={t`기록 리마인더`}
                disabled={reminders.busy}
                // 꺼짐 트랙은 iOS 기본 회색에 맡긴다. 켜짐은 회색 계열(selected)이면 다크 모드에서 꺼짐과 구분되지 않아 영업 중 초록(open)을 쓴다
                onValueChange={(next) => void toggleReminders(next)}
                thumbColor={colors.white}
                trackColor={{ true: colors.open }}
                value={reminders.enabled}
              />
            </View>
          </Group>
        ) : null}

        {Platform.OS === "web" ? null : (
          <Group title={t`권한`}>
            {permissionRows.map(({ kind, label, why }, index) => (
              <PermissionRow
                first={index === 0}
                key={kind}
                label={label}
                onPress={() => void openPermission(kind)}
                state={permissions.snapshot[kind]}
                why={why}
              />
            ))}
          </Group>
        )}

        <Group title={t`약관 및 문의`}>
          <LinkRow first label={t`이용약관`} onPress={() => openLegal("terms")} />
          <LinkRow label={t`개인정보처리방침`} onPress={() => openLegal("privacy")} />
          <LinkRow
            label={t`문의하기`}
            onPress={() => void Linking.openURL(`mailto:${LEGAL_CONTACT_EMAIL}`).catch(() => undefined)}
            value={LEGAL_CONTACT_EMAIL}
          />
        </Group>

        <View style={styles.spacer} />
        <View style={styles.bottom}>
          <Button fullWidth onPress={() => setDialog("logout")} title={t`로그아웃`} variant="secondary" />
          <View style={styles.withdrawRow}>
            <Button
              onPress={() => setDialog("withdraw")}
              style={styles.withdrawAction}
              size="small"
              textStyle={styles.withdrawText}
              title={t`회원 탈퇴`}
              variant="ghost"
            />
          </View>
          <AppText capScale style={styles.version} tone="muted" variant="meta">{t`앱 버전 `}{appConfig.expo.version}</AppText>
        </View>
      </ScrollView>

      <Toast message={toast ?? ""} onDismiss={() => setToast(null)} visible={Boolean(toast)} />

      <BottomSheet
        description={t`가장 즐겨 먹는 종류를 골라 주세요. 프로필에 표시돼요.`}
        onClose={() => setSheet(null)}
        title={t`선호 라멘 스타일`}
        visible={sheet === "style"}
      >
        <View accessibilityLabel={t`라멘 스타일`} accessibilityRole="radiogroup" style={styles.styleGrid}>
          {RAMEN_TYPES.map((style) => {
            const selected = user.favoriteRamenType === style
            return (
              <Pressable
                accessibilityLabel={labelOf(style)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                key={style}
                onPress={() => void saveStyle(style)}
                style={({ pressed }) => [styles.styleOption, selected && styles.styleSelected, pressed && !selected && styles.pressedWash]}
              >
                <AppText style={selected && styles.styleSelectedText} variant="bodyStrong">
                  {labelOf(style)}
                </AppText>
                <AppText
                  accessibilityElementsHidden={!selected}
                  capScale
                  importantForAccessibility={selected ? "auto" : "no-hide-descendants"}
                  style={[styles.styleSelectedText, !selected && styles.hiddenText]}
                  variant="meta"
                >
                  {t`선택됨 `}</AppText>
              </Pressable>
            )
          })}
        </View>
      </BottomSheet>

      <BottomSheet
        description={t`계정 안내를 받을 이메일 주소를 입력해 주세요.`}
        dismissOnBackdropPress={!busy}
        footer={
          <View style={styles.sheetActions}>
            <Button disabled={busy} fullWidth onPress={() => setSheet(null)} title={t`취소`} variant="outline" />
            <Button fullWidth loading={busy} onPress={() => void saveEmail()} title={t`저장`} variant="secondary" />
          </View>
        }
        onClose={() => !busy && setSheet(null)}
        title={t`이메일 변경`}
        visible={sheet === "email"}
      >
        <AppText nativeID="email-label" variant="bodyStrong">
          {t`새 이메일 주소 `}</AppText>
        <TextInput
          accessibilityLabel={t`새 이메일 주소`}
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          editable={!busy}
          keyboardType="email-address"
          onChangeText={(value) => {
            setNewEmail(value)
            setEmailError(null)
          }}
          onSubmitEditing={() => void saveEmail()}
          placeholder="ramen@example.com"
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
          style={[styles.input, emailError ? styles.inputInvalid : null]}
          textContentType="emailAddress"
          value={newEmail}
        />
        <View style={styles.errorSlot}>
          <AppText
            accessibilityElementsHidden
            capScale
            importantForAccessibility="no-hide-descendants"
            lineBreakStrategyIOS="hangul-word"
            style={styles.hiddenText}
            tone="sub"
            variant="secondary"
          >
            {translate(EMAIL_FORMAT_ERROR)}
          </AppText>
          {emailError ? (
            <AppText accessibilityLiveRegion="polite" capScale lineBreakStrategyIOS="hangul-word" style={styles.overlaidText} tone="sub" variant="secondary">
              {translate(emailError)}
            </AppText>
          ) : null}
        </View>
      </BottomSheet>

      <ConfirmDialog
        confirmLabel={t`로그아웃`}
        message={t`기록과 취향 리포트는 계정에 그대로 남아 있어요.`}
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          setDialog(null)
          // 설정 화면을 로그인 화면으로 바꾼다. 설정이 사라지므로 위의 비회원 가드(홈으로)는 걸리지 않는다
          actions.logout()
          router.replace("/auth/login")
        }}
        title={t`로그아웃할까요?`}
        visible={dialog === "logout"}
      />
      <ConfirmDialog
        confirmLabel={t`탈퇴하기`}
        destructive
        loading={busy}
        message={[
          t`탈퇴하면 바로 로그아웃되고, 30일 뒤 같은 계정으로 다시 가입할 수 있어요.`,
          "",
          t`30일 동안 같은 소셜 계정으로 재가입할 수 없어요.`,
          t`30일이 지나면 라멘로그, 취향 리포트, 저장한 매장이 모두 지워져요.`,
        ].join("\n")}
        onCancel={() => !busy && setDialog(null)}
        onConfirm={() => void withdraw()}
        title={t`회원 탈퇴`}
        visible={dialog === "withdraw"}
      />
    </Screen>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <AppText accessibilityRole="header" style={styles.groupTitle} tone="sub" variant="secondary">
        {title}
      </AppText>
      <View>{children}</View>
    </View>
  )
}

function AccountRow({ label, value, onChange, first = false }: { label: string; value: string; onChange: () => void; first?: boolean }) {
  const { fontScale } = useWindowDimensions()
  // 큰 글씨에서는 라벨과 값을 한 줄에 못 담는다. 값을 자르는 대신 아래로 내린다
  const stacked = fontScale > 1.2
  return (
    <View style={[styles.row, stacked && styles.rowStacked, !first && styles.rowDivider]}>
      <AppText variant="bodyStrong">
        {label}
      </AppText>
      <View style={[styles.rowTrail, stacked && styles.rowTrailStacked]}>
        <AppText lineBreakStrategyIOS="hangul-word" numberOfLines={2} style={styles.shrink} tone="muted" variant="secondary">
          {value}
        </AppText>
        <Button accessibilityLabel={t`${ph({ v1: label })} 변경`} onPress={onChange} size="small" title={t`변경`} variant="secondary" />
      </View>
    </View>
  )
}

function LinkRow({ label, onPress, value, first }: { label: string; onPress: () => void; value?: string; first?: boolean }) {
  return (
    <Pressable
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, !first && styles.rowDivider, pressed && styles.pressedWash]}
    >
      <AppText lineBreakStrategyIOS="hangul-word" numberOfLines={2} style={styles.shrink} variant="bodyStrong">
        {label}
      </AppText>
      <View style={styles.rowTrail}>
        {value ? (
          <AppText lineBreakStrategyIOS="hangul-word" numberOfLines={2} style={styles.shrink} tone="muted" variant="secondary">
            {value}
          </AppText>
        ) : null}
        <ChevronRight color={colors.textMuted} size={16} />
      </View>
    </Pressable>
  )
}

/** 권한 한 줄: 이름과 쓰는 곳, 오른쪽에 지금 상태. 누르면 묻기 전이면 권한창, 아니면 설정 앱 */
function PermissionRow({ label, why, state, onPress, first }: { label: string; why: string; state: PermissionState | null; onPress: () => void; first?: boolean }) {
  const value =
    state === "granted" ? t`허용` : state === "limited" ? t`일부 사진만` : state === "denied" ? t`꺼짐` : state === "undetermined" ? t`묻기 전` : null
  return (
    <Pressable
      accessibilityHint={state === "undetermined" ? t`허용할지 묻는 창을 띄워요` : t`설정 앱을 열어요`}
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, !first && styles.rowDivider, pressed && styles.pressedWash]}
    >
      <View style={styles.shrink}>
        <AppText variant="bodyStrong">{label}</AppText>
        <AppText lineBreakStrategyIOS="hangul-word" tone="muted" variant="secondary">
          {why}
        </AppText>
      </View>
      <View style={styles.rowTrail}>
        {value ? (
          <AppText capScale tone={state === "denied" ? "sub" : "muted"} variant="secondary">
            {value}
          </AppText>
        ) : null}
        <ChevronRight color={colors.textMuted} size={16} />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: spacing.gutter, paddingTop: spacing.x3, gap: spacing.x8 },
  shrink: { flexShrink: 1 },
  descriptionSlot: { position: "relative" },
  hiddenText: { opacity: 0 },
  overlaidText: { position: "absolute", top: 0, left: 0, right: 0 },
  groupTitle: { fontWeight: "700", marginBottom: spacing.x3 },
  row: { minHeight: 72, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.x3, paddingVertical: spacing.x3 },
  rowDivider: { borderTopColor: colors.border, borderTopWidth: line.hair },
  rowTrail: { flexDirection: "row", alignItems: "center", gap: spacing.x2, flexShrink: 1 },
  rowStacked: { flexDirection: "column", alignItems: "flex-start", gap: spacing.x2, paddingVertical: spacing.x4 },
  rowTrailStacked: { alignSelf: "stretch", justifyContent: "space-between" },
  pressedWash: { backgroundColor: colors.surfacePressed },
  switchRow: { minHeight: 72 },
  spacer: { flexGrow: 1 },
  bottom: { gap: spacing.x3 },
  withdrawRow: { alignItems: "center" },
  withdrawAction: { paddingHorizontal: spacing.x3 },
  withdrawText: { color: colors.textMuted, fontWeight: "600", ...typography.secondary },
  version: { textAlign: "center" },
  styleGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x3 },
  styleOption: { flexBasis: "48%", flexGrow: 1, minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.x4, borderRadius: radii.sm, backgroundColor: colors.canvasSoft },
  styleSelected: { backgroundColor: colors.selected },
  styleSelectedText: { color: colors.onSelected },
  sheetActions: { flexDirection: "row", gap: spacing.x2 },
  input: { minHeight: 48, marginTop: spacing.x3, paddingHorizontal: spacing.x3, borderRadius: radii.sm, backgroundColor: colors.canvas, borderColor: colors.outline, borderWidth: line.base, color: colors.ink, ...typography.body },
  inputInvalid: { borderColor: colors.ink },
  errorSlot: { position: "relative", minHeight: spacing.x13, marginTop: spacing.x2 },
})
