import { useRef, type ReactNode } from "react"
import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native"

import { LEGAL_DOCUMENTS } from "@raota/shared"

import { LegalBlockView } from "./LegalBlocks"
import { spacing } from "../theme"
import { AppText, BottomSheet, Button } from "./ui"

export type PolicyType = "terms" | "privacy"

/** 약관 원문은 raota-front와 같은 packages/shared LEGAL_DOCUMENTS 하나만 쓴다(문구를 따로 두지 않는다) */
export const POLICIES = LEGAL_DOCUMENTS

export interface PolicySheetProps {
  /** null이면 닫힌 상태 */
  type: PolicyType | null
  onClose: () => void
  /** 시트 제목. 기본은 문서 이름 */
  title?: string
  /** 하단 행동 영역. 없으면 "닫기" 버튼 */
  footer?: ReactNode
}

/** 이용약관·개인정보처리방침 바텀시트(공용 BottomSheet). 뒤판, 닫기 버튼, 안드로이드 뒤로가기로 닫는다 */
export default function PolicySheet({ type, onClose, title, footer }: PolicySheetProps) {
  const { height } = useWindowDimensions()
  // 닫히며 내려가는 동안에도 본문이 비지 않도록 마지막 문서를 기억한다
  const lastType = useRef(type)
  if (type) lastType.current = type
  const shownType = type ?? lastType.current
  const policy = shownType ? POLICIES[shownType] : null
  const sheetTitle = title ?? policy?.title ?? ""

  return (
    <BottomSheet
      closeLabel={`${sheetTitle} 닫기`}
      footer={footer ?? <Button fullWidth onPress={onClose} title="닫기" variant="secondary" />}
      onClose={onClose}
      title={sheetTitle}
      visible={type !== null}
    >
      {policy ? (
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          // 시트 최대 높이(85%) 안에서 머리·버튼을 뺀 만큼만 본문이 스크롤된다
          style={{ maxHeight: Math.round(height * 0.5) }}
        >
          <AppText tone="muted" variant="meta">
            시행일 {policy.effectiveDate}
          </AppText>
          {policy.sections.map((section) => (
            <View key={section.heading} style={styles.section}>
              <AppText accessibilityRole="header" variant="bodyStrong">
                {section.heading}
              </AppText>
              {section.blocks.map((block, index) => (
                <LegalBlockView block={block} key={index} />
              ))}
            </View>
          ))}
        </ScrollView>
      ) : null}
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  body: { gap: spacing.x5, paddingBottom: spacing.x1 },
  section: { gap: spacing.x1_5 },
})
