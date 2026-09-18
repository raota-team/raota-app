import { useRef, type ReactNode } from "react"
import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native"

import { spacing } from "../theme"
import { AppText, BottomSheet, Button } from "./ui"

export type PolicyType = "terms" | "privacy"

/** 홈 푸터·마이·가입이 함께 쓰는 약관 본문. 웹 src/components/PolicySheet.tsx와 같다. 출시 전 법무 검토 전문으로 바꾼다 */
export const POLICIES: Record<PolicyType, { title: string; sections: Array<{ heading: string; body: string }> }> = {
  terms: {
    title: "서비스 이용약관",
    sections: [
      {
        heading: "제1조 (목적)",
        body: "본 약관은 RAOTA(라오타) 서비스의 이용과 관련하여 회사와 회원 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.",
      },
      {
        heading: "제2조 (회원의 의무)",
        body: "회원은 라멘 방문 기록 및 리뷰 작성 시 타인의 권리를 침해하거나 허위 사실을 유포하지 않아야 합니다.",
      },
      {
        heading: "제3조 (서비스 제공 및 변경)",
        body: "라오타는 회원의 라멘로그 분석, 취향 리포트 생성 및 라멘집 추천 서비스를 상시 제공합니다.",
      },
    ],
  },
  privacy: {
    title: "개인정보처리방침",
    sections: [
      { heading: "1. 수집하는 개인정보 항목", body: "닉네임, 프로필 이미지, 선호 라멘 스타일, 라멘로그 데이터" },
      { heading: "2. 수집 및 이용 목적", body: "회원 식별, 라멘로그 캘린더 동기화, 맞춤형 라멘 큐레이션 및 등급 산정" },
      {
        heading: "3. 보유 및 이용 기간",
        body: "회원 탈퇴 시까지 보관하며, 탈퇴일로부터 30일 후 모든 정보는 영구 파기됩니다.",
      },
      { heading: "4. 문의", body: "개인정보 관련 문의는 contact@raota.net 으로 보내주세요." },
    ],
  },
}

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
          {policy.sections.map((section) => (
            <View key={section.heading} style={styles.section}>
              <AppText accessibilityRole="header" variant="bodyStrong">
                {section.heading}
              </AppText>
              <AppText lineBreakStrategyIOS="hangul-word" tone="sub" variant="body">
                {section.body}
              </AppText>
            </View>
          ))}
        </ScrollView>
      ) : null}
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  body: { gap: spacing.x3, paddingBottom: spacing.x1 },
  section: { gap: spacing.x0_5 },
})
