import { Redirect, router } from "expo-router"
import * as Haptics from "expo-haptics"
import { ChevronRight } from "lucide-react-native"
import { useState } from "react"
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { LEGAL_CONTACT_EMAIL, RAMEN_TYPES } from "@raota/shared"
import { AppText, BottomSheet, Button, ConfirmDialog, Header, Screen, Toast } from "@/src/components/ui"
import { useMonthlyReports } from "@/src/data"
import { useReminderSwitch } from "@/src/notifications"
import { useRaota } from "@/src/state/RaotaStore"
import { colors, line, radii, spacing, typography } from "@/src/theme"

/*
 * 설정. 마이의 최근 기록이 스크롤로 계속 늘어나서 계정·약관·로그아웃을 여기로 옮겼다(마이 프로필 오른쪽 위 톱니).
 * 로그인하지 않았으면(로그아웃 직후 포함) 마이로 돌려보낸다.
 */

function haptic() {
  if (Platform.OS === "web") return
  void Haptics.selectionAsync().catch(() => undefined)
}

function openLegal(doc: "terms" | "privacy") {
  router.push({ pathname: "/legal/[doc]", params: { doc } })
}

export default function SettingsScreen() {
  const { currentUser: user, actions } = useRaota()
  const insets = useSafeAreaInsets()
  const [sheet, setSheet] = useState<"style" | "email" | null>(null)
  const [dialog, setDialog] = useState<"logout" | "withdraw" | null>(null)
  const [newEmail, setNewEmail] = useState("")
  const [emailError, setEmailError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const monthly = useMonthlyReports()
  const reminders = useReminderSwitch(monthly.data.current?.recordCount ?? 0)

  if (!user) return <Redirect href="/native/my" />

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/native/my"))

  /*
   * iOS 권한창은 앱 생애에 한 번뿐이라, 시스템에서 이미 막혔으면(blocked) 앱이 다시 띄울 수 없다.
   * 그때는 설정 앱으로 보내고, 그 밖에는 스위치가 직접 켜고 끈다.
   */
  const toggleReminders = async (next: boolean) => {
    haptic()
    if (next && reminders.blocked) {
      await Linking.openSettings().catch(() => setToast("설정 앱을 열지 못했어요"))
      return
    }
    await reminders.toggle(next)
    setToast(next ? "기록할 때가 되면 알려드릴게요" : "알림을 껐어요. 언제든 다시 켤 수 있어요")
  }

  const saveStyle = async (style: string) => {
    haptic()
    await actions.updateProfile({ favoriteRamenType: style })
    setSheet(null)
    setToast(`선호 스타일을 '${style}'로 바꿨어요`)
  }

  const saveEmail = async () => {
    const trimmed = newEmail.trim()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("이메일 형식이 아니에요. 예: ramen@example.com")
      return
    }
    setBusy(true)
    try {
      await actions.updateProfile({ email: trimmed })
      setSheet(null)
      setToast("이메일 주소를 바꿨어요")
    } catch {
      setEmailError("저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.")
    } finally {
      setBusy(false)
    }
  }

  const withdraw = async () => {
    setBusy(true)
    try {
      await actions.withdraw()
    } finally {
      setBusy(false)
      setDialog(null)
    }
  }

  return (
    <Screen>
      <Header backLabel="뒤로가기" onBack={goBack} title="설정" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.x8 }]}>
        <Group title="계정">
          <AccountRow
            first
            label="이메일"
            onChange={() => {
              setNewEmail(user.email ?? "")
              setEmailError(null)
              setSheet("email")
            }}
            value={user.email || "등록된 이메일 없음"}
          />
          <AccountRow label="선호 스타일" onChange={() => setSheet("style")} value={user.favoriteRamenType || "아직 안 정했어요"} />
        </Group>

        {reminders.supported ? (
          <Group title="알림">
            <View style={[styles.row, styles.switchRow]}>
              <View style={styles.shrink}>
                <AppText variant="body">기록 리마인더</AppText>
                <AppText lineBreakStrategyIOS="hangul-word" tone="muted" variant="secondary">
                  {reminders.blocked
                    ? "iOS 설정에서 알림이 꺼져 있어요. 눌러서 설정을 열 수 있어요."
                    : "월간 리포트 마감 전과 기록이 일주일 뜸할 때만 알려드려요."}
                </AppText>
              </View>
              <Switch
                accessibilityHint={reminders.blocked ? "iOS 설정 앱을 엽니다" : undefined}
                accessibilityLabel="기록 리마인더"
                disabled={reminders.busy}
                ios_backgroundColor={colors.border}
                onValueChange={(next) => void toggleReminders(next)}
                thumbColor={colors.canvas}
                trackColor={{ false: colors.border, true: colors.brand }}
                value={reminders.enabled}
              />
            </View>
          </Group>
        ) : null}

        <Group title="약관 및 문의">
          <LinkRow first label="이용약관" onPress={() => openLegal("terms")} />
          <LinkRow label="개인정보처리방침" onPress={() => openLegal("privacy")} />
          <LinkRow
            label="문의하기"
            onPress={() => void Linking.openURL(`mailto:${LEGAL_CONTACT_EMAIL}`).catch(() => undefined)}
            value={LEGAL_CONTACT_EMAIL}
          />
        </Group>

        <Button onPress={() => setDialog("logout")} title="로그아웃" variant="utility" />
        <View style={styles.withdrawRow}>
          <Button
            onPress={() => setDialog("withdraw")}
            size="small"
            textStyle={styles.withdrawText}
            title="회원 탈퇴"
            variant="ghost"
          />
        </View>
      </ScrollView>

      <Toast message={toast ?? ""} onDismiss={() => setToast(null)} visible={Boolean(toast)} />

      <BottomSheet
        description="가장 즐겨 먹는 종류를 골라 주세요. 프로필에 표시돼요."
        onClose={() => setSheet(null)}
        title="선호 라멘 스타일"
        visible={sheet === "style"}
      >
        <View accessibilityLabel="라멘 스타일" accessibilityRole="radiogroup" style={styles.styleGrid}>
          {RAMEN_TYPES.map((style) => {
            const selected = user.favoriteRamenType === style
            return (
              <Pressable
                accessibilityLabel={style}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                key={style}
                onPress={() => void saveStyle(style)}
                style={({ pressed }) => [styles.styleOption, selected && styles.styleSelected, pressed && !selected && styles.pressedWash]}
              >
                <AppText tone={selected ? "brand" : "ink"} variant="bodyStrong">
                  {style}
                </AppText>
                {selected ? (
                  <AppText capScale tone="brand" variant="meta">
                    선택됨
                  </AppText>
                ) : null}
              </Pressable>
            )
          })}
        </View>
      </BottomSheet>

      <BottomSheet
        description="계정 안내를 받을 이메일 주소를 입력해 주세요."
        dismissOnBackdropPress={!busy}
        footer={
          <View style={styles.sheetActions}>
            <Button disabled={busy} fullWidth onPress={() => setSheet(null)} title="취소" variant="outline" />
            <Button fullWidth loading={busy} onPress={() => void saveEmail()} title="저장" />
          </View>
        }
        onClose={() => !busy && setSheet(null)}
        title="이메일 변경"
        visible={sheet === "email"}
      >
        <AppText nativeID="email-label" variant="bodyStrong">
          새 이메일 주소
        </AppText>
        <TextInput
          accessibilityLabel="새 이메일 주소"
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
        {emailError ? (
          <AppText accessibilityLiveRegion="polite" style={styles.errorText} tone="critical" variant="secondary">
            {emailError}
          </AppText>
        ) : null}
      </BottomSheet>

      <ConfirmDialog
        confirmLabel="로그아웃"
        message="기록과 취향 리포트는 계정에 그대로 남아 있어요."
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          setDialog(null)
          // 로그아웃하면 이 화면은 스스로 마이(비회원 화면)로 돌아간다
          actions.logout()
        }}
        title="로그아웃할까요?"
        visible={dialog === "logout"}
      />
      <ConfirmDialog
        confirmLabel="탈퇴하기"
        destructive
        loading={busy}
        message={[
          "탈퇴하면 바로 로그아웃되고, 30일 뒤 같은 계정으로 다시 가입할 수 있어요.",
          "",
          "30일 동안 같은 소셜 계정으로 재가입할 수 없어요.",
          "30일이 지나면 라멘로그, 취향 리포트, 저장한 매장이 모두 지워져요.",
        ].join("\n")}
        onCancel={() => !busy && setDialog(null)}
        onConfirm={() => void withdraw()}
        title="회원 탈퇴"
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
      <View style={styles.card}>{children}</View>
    </View>
  )
}

function AccountRow({ label, value, onChange, first = false }: { label: string; value: string; onChange: () => void; first?: boolean }) {
  return (
    <View style={[styles.row, !first && styles.rowDivider]}>
      <AppText tone="sub" variant="body">
        {label}
      </AppText>
      <View style={styles.rowTrail}>
        <AppText numberOfLines={1} style={styles.shrink} variant="bodyStrong">
          {value}
        </AppText>
        <Button accessibilityLabel={`${label} 변경`} onPress={onChange} size="small" title="변경" variant="utility" />
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
      <AppText numberOfLines={1} style={styles.shrink} variant="body">
        {label}
      </AppText>
      <View style={styles.rowTrail}>
        {value ? (
          <AppText numberOfLines={1} style={styles.shrink} tone="muted" variant="secondary">
            {value}
          </AppText>
        ) : null}
        <ChevronRight color={colors.textMuted} size={16} />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.gutter, paddingTop: spacing.x5, gap: spacing.x6 },
  shrink: { flexShrink: 1 },
  groupTitle: { fontWeight: "700", marginBottom: spacing.x2, marginLeft: spacing.x1 },
  card: {
    backgroundColor: colors.canvas,
    borderColor: colors.outline,
    borderRadius: radii.sm,
    borderWidth: line.base,
    paddingHorizontal: spacing.x4,
  },
  row: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.x3,
    paddingVertical: spacing.x1,
  },
  rowDivider: { borderTopColor: colors.border, borderTopWidth: 1 },
  rowTrail: { flexDirection: "row", alignItems: "center", gap: spacing.x1_5, flexShrink: 1 },
  pressedWash: { backgroundColor: colors.canvasSoft },
  switchRow: { alignItems: "center", gap: spacing.x3 },
  withdrawRow: { alignItems: "center", marginTop: -spacing.x2 },
  withdrawText: { color: colors.inkSub, fontWeight: "500", textDecorationLine: "underline", ...typography.secondary },
  styleGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x2 },
  styleOption: {
    flexBasis: "48%",
    flexGrow: 1,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.x3,
    borderRadius: radii.sm,
    backgroundColor: colors.canvas,
    borderColor: colors.outline,
    borderWidth: line.base,
  },
  styleSelected: { borderColor: colors.brand, backgroundColor: colors.brandWeak },
  sheetActions: { flexDirection: "row", gap: spacing.x2 },
  input: {
    minHeight: 48,
    marginTop: spacing.x1_5,
    paddingHorizontal: spacing.x3,
    borderRadius: radii.sm,
    backgroundColor: colors.canvas,
    borderColor: colors.outline,
    borderWidth: line.base,
    color: colors.ink,
    ...typography.body,
  },
  inputInvalid: { borderColor: colors.critical },
  errorText: { marginTop: spacing.x1 },
})
