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
import { colors, spacing } from "@/src/theme"

/**
 * 이용약관·개인정보처리방침 전문. 원문은 raota-front와 같은 packages/shared LEGAL_DOCUMENTS.
 * 로그인하지 않아도 볼 수 있다(심사: 개인정보처리방침은 앱 안에서 언제든 열 수 있어야 한다).
 */
export default function LegalDocumentScreen() {
  const { doc } = useLocalSearchParams<{ doc?: string }>()
  const insets = useSafeAreaInsets()
  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/native"))

  if (!isLegalDocumentKey(doc)) {
    return (
      <Screen>
        <Header onBack={goBack} title="문서를 찾을 수 없어요" />
        <EmptyState actionLabel="돌아가기" onAction={goBack} title="요청한 문서가 없어요" />
      </Screen>
    )
  }

  const document = LEGAL_DOCUMENTS[doc]
  return (
    <Screen>
      <Header onBack={goBack} title={document.title} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.x8 }]}>
        <AppText style={styles.effective} tone="muted" variant="meta">
          시행일 {document.effectiveDate}
        </AppText>
        {document.sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <AppText accessibilityRole="header" variant="cardTitle">
              {section.heading}
            </AppText>
            {section.blocks.map((block, index) => (
              <LegalBlockView block={block} key={index} />
            ))}
          </View>
        ))}
        <View style={styles.contact}>
          <AppText tone="sub" variant="secondary">
            문의는 이메일로 받아요.
          </AppText>
          <Button
            onPress={() => void Linking.openURL(`mailto:${LEGAL_CONTACT_EMAIL}`).catch(() => undefined)}
            size="small"
            title={LEGAL_CONTACT_EMAIL}
            variant="outline"
          />
        </View>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.gutter, paddingTop: spacing.x5, gap: spacing.x6 },
  effective: { marginBottom: -spacing.x2 },
  section: { gap: spacing.x2 },
  contact: {
    marginTop: spacing.x2,
    paddingTop: spacing.x5,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: "flex-start",
    gap: spacing.x3,
  },
})
