import { t, msg } from "@lingui/core/macro";
import { useLocale } from "@/src/i18n"
import { translate } from "@raota/shared"
import { useState, type ReactNode } from "react"
import { Check } from "lucide-react-native"
import { Pressable, StyleSheet, View } from "react-native"

import PolicySheet, { type PolicyType } from "./PolicySheet"
import { AppText, Button } from "./ui"
import { colors, line, radii, spacing, touchTarget } from "../theme"

/*
 * 약관 동의 목록. 회원가입(온보딩)과 약관 다시 동의(웹에서 옮긴 회원·문서 개정) 화면이 같이 쓴다.
 * "보기"는 PolicySheet로 전문을 열고, "확인하고 동의"를 누르면 그 항목이 체크된다.
 */

export interface ConsentValues {
  terms: boolean
  privacy: boolean
  marketing: boolean
}

export const NO_CONSENTS: ConsentValues = { terms: false, privacy: false, marketing: false }

export const CONSENT_REQUIRED_ERROR = msg`필수 약관 두 가지에 동의해야 가입할 수 있어요.`

/** 동의 행 전체를 44pt 터치 영역으로 만들고 상태를 원형 체크에 표시한다 */
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
  useLocale()
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [styles.checkRow, pressed && styles.pressedWash]}
    >
      <View style={[styles.checkBox, checked && styles.checkBoxOn]}>
        {checked ? <Check color={colors.onSelected} size={14} strokeWidth={3} /> : null}
      </View>
      <AppText style={[styles.checkLabel, strong && styles.checkStrong]} tone={strong ? "ink" : "sub"} variant={strong ? "cardTitle" : "secondary"}>
        {children}
      </AppText>
    </Pressable>
  )
}

function ViewLink({ label, onPress }: { label: string; onPress: () => void }) {
  useLocale()
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.viewLink, pressed && styles.pressedWash]}
    >
      <AppText capScale tone="muted" variant="meta">
        {t`보기`}</AppText>
    </Pressable>
  )
}

export interface ConsentChecklistProps {
  value: ConsentValues
  onChange: (next: ConsentValues) => void
  /** 필수 동의가 빠졌다는 안내를 보인다(제출을 시도한 뒤) */
  showError: boolean
  /** 안내 문구. 기본은 가입 문구 */
  errorMessage?: string
}

export function ConsentChecklist({ value, onChange, showError, errorMessage = translate(CONSENT_REQUIRED_ERROR) }: ConsentChecklistProps) {
  useLocale()
  const [policy, setPolicy] = useState<PolicyType | null>(null)
  const error = showError && (!value.terms || !value.privacy)
  const allAgreed = value.terms && value.privacy && value.marketing

  return (
    <View style={styles.terms}>
      <View style={styles.termsAll}>
        <CheckRow
          checked={allAgreed}
          label={t`약관 전체 동의`}
          onChange={(next) => onChange({ terms: next, privacy: next, marketing: next })}
          strong
        >
          {t`약관 전체 동의`}</CheckRow>
      </View>
      <View style={styles.termRow}>
        <CheckRow checked={value.terms} label={t`필수, 서비스 이용약관 동의`} onChange={(terms) => onChange({ ...value, terms })}>
          <AppText style={styles.bold} tone="sub" variant="meta">
            {t`[필수]`}</AppText>{" "}
          {t`서비스 이용약관 동의`}</CheckRow>
        <ViewLink label={t`서비스 이용약관 보기`} onPress={() => setPolicy("terms")} />
      </View>
      <View style={styles.termRow}>
        <CheckRow checked={value.privacy} label={t`필수, 개인정보 수집 및 이용 동의`} onChange={(privacy) => onChange({ ...value, privacy })}>
          <AppText style={styles.bold} tone="sub" variant="meta">
            {t`[필수]`}</AppText>{" "}
          {t`개인정보 수집 및 이용 동의`}</CheckRow>
        <ViewLink label={t`개인정보 수집 및 이용 동의 보기`} onPress={() => setPolicy("privacy")} />
      </View>
      <CheckRow checked={value.marketing} label={t`선택, 라멘 추천 및 소식 수신 동의`} onChange={(marketing) => onChange({ ...value, marketing })}>
        <AppText style={styles.bold} tone="sub" variant="meta">
          {t`[선택]`}</AppText>{" "}
        {t`라멘 추천 및 소식 수신 동의`}</CheckRow>
      <AppText
        accessibilityElementsHidden={!error}
        accessibilityLiveRegion={error ? "polite" : undefined}
        importantForAccessibility={error ? "auto" : "no-hide-descendants"}
        style={!error && styles.hiddenFeedback}
        tone="critical"
        variant="secondary"
      >
        {errorMessage}
      </AppText>

      <PolicySheet
        footer={
          <Button
            fullWidth
            onPress={() => {
              if (policy === "terms") onChange({ ...value, terms: true })
              if (policy === "privacy") onChange({ ...value, privacy: true })
              setPolicy(null)
            }}
            title={t`확인하고 동의`}
            variant="secondary"
          />
        }
        onClose={() => setPolicy(null)}
        title={policy === "privacy" ? t`개인정보 수집 및 이용 동의` : policy === "terms" ? t`서비스 이용약관` : undefined}
        type={policy}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  bold: { fontWeight: "700" },
  hiddenFeedback: { opacity: 0 },
  pressedWash: { backgroundColor: colors.surfacePressed },
  terms: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.x4, marginTop: spacing.x4 },
  termsAll: { borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 4 },
  termRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.x2 },
  checkRow: { flex: 1, minHeight: touchTarget, flexDirection: "row", alignItems: "center", gap: spacing.x2_5 },
  // 체크는 선택 면으로 채워 빨간 주요 행동과 경쟁하지 않는다.
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    borderWidth: line.hair,
    borderColor: colors.outline,
    backgroundColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  checkBoxOn: { backgroundColor: colors.selected, borderColor: colors.selected },
  checkLabel: { flexShrink: 1, minWidth: 0, fontSize: 13, lineHeight: 18 },
  checkStrong: { fontSize: 15, lineHeight: 20, fontWeight: "700" },
  viewLink: {
    minHeight: touchTarget,
    minWidth: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.x2,
    borderRadius: radii.sm,
  },
})
