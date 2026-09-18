import { StyleSheet, View } from "react-native"

import type { LegalBlock } from "@raota/shared"

import { colors, radii, spacing } from "../theme"
import { AppText } from "./ui"

/** 약관 본문 한 덩어리(문단·목록·표). 약관 화면과 PolicySheet가 함께 쓴다 */
export function LegalBlockView({ block }: { block: LegalBlock }) {
  if (block.type === "paragraph") {
    return (
      <AppText lineBreakStrategyIOS="hangul-word" style={styles.paragraph} tone="sub" variant="body">
        {block.text}
      </AppText>
    )
  }
  if (block.type === "list") {
    return (
      <View style={styles.list}>
        {block.items.map((item) => (
          <View key={item} style={styles.listItem}>
            <AppText style={styles.bullet} tone="muted" variant="body">
              ·
            </AppText>
            <AppText lineBreakStrategyIOS="hangul-word" style={styles.listText} tone="sub" variant="body">
              {item}
            </AppText>
          </View>
        ))}
      </View>
    )
  }
  // 표는 폰 폭에서 읽기 쉽도록 "항목 이름 → 내용" 묶음으로 쌓는다. 첫 행은 머리글이라 건너뛴다.
  const [, ...rows] = block.rows
  return (
    <View style={styles.table}>
      {rows.map((row, index) => (
        <View key={row[0] ?? index} style={[styles.tableRow, index > 0 && styles.tableDivider]}>
          <AppText variant="bodyStrong">{row[0]}</AppText>
          <AppText lineBreakStrategyIOS="hangul-word" tone="sub" variant="secondary">
            {row.slice(1).join(" · ")}
          </AppText>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  paragraph: {},
  list: { gap: spacing.x1_5 },
  listItem: { flexDirection: "row", gap: spacing.x2 },
  bullet: { width: 8 },
  listText: { flex: 1 },
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, overflow: "hidden" },
  tableRow: { paddingHorizontal: spacing.x4, paddingVertical: spacing.x3, gap: spacing.x1 },
  tableDivider: { borderTopWidth: 1, borderTopColor: colors.border },
})
