import { t } from "@lingui/core/macro";
import { t as legacyT } from "@raota/shared"
import { useLocale } from "@/src/i18n"
import { useState } from "react"
import { router, useLocalSearchParams } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { AccessibilityInfo, ScrollView, StyleSheet, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { isApiError } from "@/src/api/client"
import { ConsentChecklist, NO_CONSENTS, type ConsentValues } from "@/src/components/ConsentChecklist"
import { AppText, Button, Header, StickyActionBar, Toast } from "@/src/components/ui"
import { useRaota } from "@/src/state/RaotaStore"
import { colors, spacing } from "@/src/theme"

/*
 * 약관 다시 동의. 웹에서 옮겨 온 회원이나 약관·처리방침이 바뀐 뒤 로그인한 회원(consentRequired)이 본다.
 * 동의하기 전에는 앱 본 화면으로 가지 못한다(app/_layout.tsx·(flows)/_layout.tsx가 이리로 돌려보낸다). 로그아웃은 할 수 있다.
 */

const CONSENT_ERROR = "필수 약관 두 가지에 동의해야 계속할 수 있어요."
const SAVE_ERROR = "동의를 저장하지 못했어요. 잠시 후 다시 시도해 주세요."

export default function ConsentScreen() {
  useLocale()
  const params = useLocalSearchParams<{ next?: string }>()
  const { actions } = useRaota()
  const [consents, setConsents] = useState<ConsentValues>(NO_CONSENTS)
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const proceed = () => {
    const next = params.next
    if (typeof next === "string" && next.startsWith("/") && !next.startsWith("/auth")) {
      router.replace(next as Parameters<typeof router.replace>[0])
      return
    }
    router.replace("/native")
  }

  const submit = async () => {
    if (saving) return
    setAttempted(true)
    if (!consents.terms || !consents.privacy) {
      AccessibilityInfo.announceForAccessibility?.(CONSENT_ERROR)
      return
    }
    setSaving(true)
    try {
      await actions.agreeToConsents(consents.marketing)
      proceed()
    } catch (error) {
      // 서버 거절인지 네트워크인지 가려야 고칠 수 있다
      if (__DEV__) console.warn("[consent] save failed", isApiError(error) ? `${error.status} ${error.code}` : String(error))
      setToast(legacyT(SAVE_ERROR))
    } finally {
      setSaving(false)
    }
  }

  const logout = () => {
    actions.logout()
    router.replace("/native")
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.root}>
      <StatusBar style="auto" />
      <Header title={t`약관 동의`} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <AppText accessibilityRole="header" lineBreakStrategyIOS="hangul-word" style={styles.introTitle} variant="headline">
            {t`약관에 동의하고`}{"\n"}{t`계속 이용해 주세요 `}</AppText>
          <AppText lineBreakStrategyIOS="hangul-word" tone="sub" variant="body">
            {t`라오타 앱의 이용약관과 개인정보처리방침이 새로 적용돼요. 기록과 저장한 매장은 그대로 남아 있어요. `}</AppText>
        </View>
        <ConsentChecklist errorMessage={CONSENT_ERROR} onChange={setConsents} showError={attempted} value={consents} />
        <View style={styles.logoutRow}>
          <Button onPress={logout} size="small" title={t`로그아웃`} variant="ghost" />
        </View>
      </ScrollView>
      <StickyActionBar>
        <Button fullWidth loading={saving} onPress={() => void submit()} size="large" title={t`동의하고 계속하기`} />
      </StickyActionBar>
      <Toast message={toast ?? ""} onDismiss={() => setToast(null)} variant="critical" visible={Boolean(toast)} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 20, paddingTop: spacing.x4, paddingBottom: spacing.x8 },
  intro: { gap: spacing.x1_5 },
  introTitle: { fontSize: 26, lineHeight: 32 },
  logoutRow: { alignItems: "center", marginTop: spacing.section },
})
