import { useEffect, useRef } from "react"
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated"

import type { ShopTasteSummary } from "../domain/shopTaste"
import { colors, radii, spacing, tasteAxis } from "../theme"
import { AppText } from "./ui"

const REVEAL_EASE = Easing.bezier(0.22, 1, 0.36, 1)

/**
 * 가게 상세의 "이 가게의 맛". 라멘로그 상세(한 사람의 기록)는 오각형 맛 지문을 쓰고,
 * 여러 사람의 기록을 모은 가게는 한 문장 + 근거 칩으로 보여 준다(사용자 결정, 2026.10.20).
 * `play`가 처음 true가 될 때 문장이 떠오르고 칩이 차례로 나온다. 그 전에는 자리만 잡아 둔다.
 */
export function ShopTasteCard({ summary, play = true, style }: { summary: ShopTasteSummary; play?: boolean; style?: StyleProp<ViewStyle> }) {
  const reducedMotion = useReducedMotion()
  const progress = useSharedValue(reducedMotion ? 1 : 0)
  const played = useRef(false)

  useEffect(() => {
    if (reducedMotion) {
      progress.value = 1
      return
    }
    if (!play || played.current) return
    played.current = true
    progress.value = withTiming(1, { duration: 900, easing: REVEAL_EASE })
  }, [play, progress, reducedMotion])

  const label = `이 가게의 맛. 공개 라멘로그 ${summary.count}개. ${summary.broth}에 ${summary.noodle}, ${summary.closing}. 만족도 ${summary.satisfaction.toFixed(1)}. ${summary.chips.map((chip) => `${chip.label.slice(1)} ${chip.value}`).join(", ")}`

  return (
    <View accessibilityLabel={label} accessibilityRole="text" accessible style={[styles.card, style]}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.header}>
          <AppText variant="cardTitle">이 가게의 맛</AppText>
          <AppText capScale tone="muted" variant="meta">{`공개 라멘로그 ${summary.count}개`}</AppText>
        </View>
        <Reveal progress={progress} from={0} to={0.5}>
          <AppText lineBreakStrategyIOS="hangul-word" style={styles.persona} variant="sectionTitle">
            <AppText style={[styles.persona, styles.accent]} variant="sectionTitle">{summary.broth}</AppText>
            {"에 "}
            <AppText style={[styles.persona, styles.accent]} variant="sectionTitle">{summary.noodle}</AppText>
            {`,\n${summary.closing}`}
          </AppText>
          <AppText capScale style={styles.sub} tone="muted" variant="secondary">{`만족도 ${summary.satisfaction.toFixed(1)}`}</AppText>
        </Reveal>
        <View style={styles.chips}>
          {summary.chips.map((chip, index) => (
            <Reveal from={0.35 + index * 0.1} key={chip.label} progress={progress} to={0.75 + index * 0.08}>
              <View style={styles.chip}>
                <AppText capScale style={styles.chipLabel} variant="meta">{chip.label}</AppText>
                <AppText capScale style={[styles.chipLabel, styles.accent]} variant="meta">{chip.value}</AppText>
              </View>
            </Reveal>
          ))}
        </View>
      </View>
    </View>
  )
}

/** progress의 [from, to] 구간에서 6pt 아래에서 떠오르며 나타난다. 자리는 처음부터 잡혀 있어 아래가 밀리지 않는다 */
function Reveal({ progress, from, to, children }: { progress: { value: number }; from: number; to: number; children: React.ReactNode }) {
  const style = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, (progress.value - from) / (to - from)))
    return { opacity: t, transform: [{ translateY: 6 * (1 - t) }] }
  })
  return <Animated.View style={style}>{children}</Animated.View>
}

const styles = StyleSheet.create({
  card: { padding: spacing.x4, backgroundColor: colors.canvasSoft, borderRadius: radii.sm },
  header: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.x2, marginBottom: spacing.x3 },
  persona: { fontSize: 22, lineHeight: 30, fontWeight: "700", letterSpacing: -0.4 },
  accent: { color: tasteAxis.satisfaction },
  sub: { marginTop: spacing.x1_5 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x2, marginTop: spacing.x3_5 },
  chip: { flexDirection: "row", alignItems: "center", gap: spacing.x1, height: 32, paddingHorizontal: spacing.x3, borderRadius: radii.pill, backgroundColor: colors.canvas },
  chipLabel: { fontWeight: "700" },
})
