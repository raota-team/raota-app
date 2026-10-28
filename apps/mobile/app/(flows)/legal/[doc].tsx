import { t } from "@lingui/core/macro";
import { getLocale } from "@raota/shared"
import { useLocale } from "@/src/i18n"
import { router, useLocalSearchParams } from "expo-router"
import { Linking, ScrollView, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_DOCUMENTS,
  isLegalDocumentKey,
} from "@raota/shared"
import { AppText, Button, EmptyState, Header, Screen } from "@/src/components/ui"
import { LegalBlockView } from "@/src/components/LegalBlocks"
import { colors, line, spacing } from "@/src/theme"

/**
 * 이용약관·개인정보처리방침 전문. 원문은 raota-front와 같은 packages/shared LEGAL_DOCUMENTS.
 * 로그인하지 않아도 볼 수 있다(심사: 개인정보처리방침은 앱 안에서 언제든 열 수 있어야 한다).
 */
export default function LegalDocumentScreen() {
  useLocale()
  const { doc } = useLocalSearchParams<{ doc?: string }>()
  const insets = useSafeAreaInsets()
  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/native"))

  if (!isLegalDocumentKey(doc)) {
    return (
      <Screen style={styles.screen}>
        <Header onBack={goBack} title={t`문서를 찾을 수 없어요`} />
        <EmptyState actionLabel={t`돌아가기`} onAction={goBack} title={t`요청한 문서가 없어요`} />
      </Screen>
    )
  }

  const document = LEGAL_DOCUMENTS[doc]
  const contactSection = document.sections.find(
    (section) => section.heading.includes("문의") && section.blocks.some(
      (block) => block.type === "paragraph" && block.text.includes(LEGAL_CONTACT_EMAIL),
    ),
  )
  return (
    <Screen style={styles.screen}>
      <Header onBack={goBack} title={doc === "terms" ? t`이용약관` : t`개인정보처리방침`} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.x8 }]}>
        <AppText tone="muted" variant="meta">
          {t`시행일 `}{document.effectiveDate}
        </AppText>
        {getLocale() !== "ko" ? (
          <AppText tone="sub" variant="secondary">{t`이 문서는 한국어 원문으로 제공됩니다.`}</AppText>
        ) : null}
        {document.sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <AppText accessibilityRole="header" lineBreakStrategyIOS="hangul-word" variant="cardTitle">
              {section.heading}
            </AppText>
            {section.blocks.map((block, index) => (
              <LegalBlockView block={block} key={index} />
            ))}
            {section === contactSection ? (
              <Button
                onPress={() => void Linking.openURL(`mailto:${LEGAL_CONTACT_EMAIL}`).catch(() => undefined)}
                size="small"
                style={styles.contactButton}
                title={LEGAL_CONTACT_EMAIL}
                variant="utility"
              />
            ) : null}
          </View>
        ))}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper },
  content: { paddingHorizontal: spacing.gutter, paddingTop: spacing.x5, gap: spacing.x5 },
  section: { gap: spacing.x2, borderTopWidth: line.hair, borderTopColor: colors.border, paddingTop: spacing.x5 },
  contactButton: { alignSelf: "flex-start", marginTop: spacing.x2 },
})
