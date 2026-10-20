import { useEffect, useRef, type ReactNode } from "react"
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated"
import Svg, { Circle } from "react-native-svg"

import type { ShopTasteSummary } from "../domain/shopTaste"
import { colors, line, radii, spacing, usePalette, useTasteAxisPalette } from "../theme"
import { AppText } from "./ui"

const REVEAL_EASE = Easing.bezier(0.22, 1, 0.36, 1)
const RING = 96
const STROKE = 10
const RADIUS = (RING - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

/**
 * 가게 상세의 "이 가게의 맛"(사용자 결정, 2026.10.20). 라멘로그 상세의 오각형과 겹치지 않게
 * 여러 사람의 기록을 "또 가고 싶은가"로 먼저 말한다: 재방문 의향 원 + 네 칸(많이 먹은 메뉴 · 육수 · 면 · 토핑).
 * 카드 안에 카드를 넣지 않으려고 네 칸은 면이 아니라 가는 선으로 나눈다.
 * `play`가 처음 true가 될 때 원이 차오르고 칸이 차례로 나온다. 그 전에는 자리만 잡아 둔다.
 */
export function ShopTasteCard({ summary, play = true, style }: { summary: ShopTasteSummary; play?: boolean; style?: StyleProp<ViewStyle> }) {
  const palette = usePalette()
  const axis = useTasteAxisPalette()
  const reducedMotion = useReducedMotion()
  const progress = useSharedValue(reducedMotion ? 1 : 0)
  const played = useRef(false)
  const { count, revisit } = summary
  const share = revisit.often / count
  const percent = Math.round(share * 100)

  useEffect(() => {
    if (reducedMotion) {
      progress.value = 1
      return
    }
    if (!play || played.current) return
    played.current = true
    progress.value = withDelay(80, withTiming(1, { duration: 900, easing: REVEAL_EASE }))
  }, [play, progress, reducedMotion])

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - share * Math.min(1, progress.value / 0.7)),
  }))

  const rest = [
    revisit.sometimes > 0 ? `가끔 생각남 ${revisit.sometimes}명` : null,
    revisit.once > 0 ? `한 번이면 충분 ${revisit.once}명` : null,
  ].filter(Boolean).join(" · ")
  const headline = revisit.often > 0 ? `${count}명 중 ${revisit.often}명이 또 가고 싶대요` : `${count}명 모두 한 번쯤 가 볼 만하대요`
  const cells = [
    { label: "많이 먹은 메뉴", value: summary.topMenuCount > 1 ? `${summary.topMenu} · ${summary.topMenuCount}명` : summary.topMenu },
    { label: "육수", value: summary.broth },
    { label: "면", value: summary.noodle },
    { label: "토핑", value: summary.topping },
  ]
  const label = `이 가게의 맛. 공개 라멘로그 ${count}개. 또 갈래요 ${percent}%, ${headline.replace("\n", " ")}${rest ? `, ${rest}` : ""}. ${cells.map((cell) => `${cell.label} ${cell.value}`).join(", ")}`

  return (
    <View accessibilityLabel={label} accessibilityRole="text" accessible style={[styles.card, style]}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.header}>
          <AppText variant="cardTitle">이 가게의 맛</AppText>
          <AppText capScale tone="muted" variant="meta">{`공개 라멘로그 ${count}개`}</AppText>
        </View>
        <View style={styles.revisit}>
          <View style={styles.ring}>
            <Svg height={RING} width={RING}>
              <Circle cx={RING / 2} cy={RING / 2} fill="none" r={RADIUS} stroke={palette.secondary} strokeWidth={STROKE} />
              <AnimatedCircle
                animatedProps={ringProps}
                cx={RING / 2}
                cy={RING / 2}
                fill="none"
                r={RADIUS}
                rotation={-90}
                origin={`${RING / 2}, ${RING / 2}`}
                stroke={axis.satisfaction}
                strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                strokeLinecap="round"
                strokeWidth={STROKE}
              />
            </Svg>
            <View style={styles.ringCenter}>
              <AppText capScale style={styles.ringValue} variant="sectionTitle">{`${percent}%`}</AppText>
              <AppText capScale tone="muted" variant="meta">또 갈래요</AppText>
            </View>
          </View>
          <Reveal from={0.15} progress={progress} style={styles.revisitText} to={0.6}>
            <AppText lineBreakStrategyIOS="hangul-word" style={styles.center} variant="cardTitle">{headline}</AppText>
            {rest ? <AppText capScale style={[styles.rest, styles.center]} tone="muted" variant="meta">{rest}</AppText> : null}
          </Reveal>
        </View>
        <View style={styles.grid}>
          {cells.map((cell, index) => (
            <Reveal from={0.35 + index * 0.08} key={cell.label} progress={progress} style={[styles.cell, index % 2 === 1 && styles.cellRight, index >= 2 && styles.cellBottom]} to={0.75 + index * 0.06}>
              <AppText capScale tone="muted" variant="meta">{cell.label}</AppText>
              <AppText lineBreakStrategyIOS="hangul-word" numberOfLines={2} style={styles.cellValue} variant="bodyStrong">{cell.value}</AppText>
            </Reveal>
          ))}
        </View>
      </View>
    </View>
  )
}

/** progress의 [from, to] 구간에서 6pt 아래에서 떠오르며 나타난다. 자리는 처음부터 잡혀 있어 아래가 밀리지 않는다 */
function Reveal({ progress, from, to, style, children }: { progress: { value: number }; from: number; to: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const animated = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, (progress.value - from) / (to - from)))
    return { opacity: t, transform: [{ translateY: 6 * (1 - t) }] }
  })
  return <Animated.View style={[styles.flexShrink, style, animated]}>{children}</Animated.View>
}

const styles = StyleSheet.create({
  card: { padding: spacing.x4, backgroundColor: colors.canvasSoft, borderRadius: radii.sm },
  header: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.x2, marginBottom: spacing.x4 },
  // 원과 문장을 카드 가운데에 위아래로 둔다(사용자 결정, 2026.10.20)
  revisit: { alignItems: "center", gap: spacing.x3 },
  revisitText: { alignItems: "center" },
  center: { textAlign: "center" },
  ring: { width: RING, height: RING },
  ringCenter: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  ringValue: { fontWeight: "700" },
  rest: { marginTop: spacing.x1 },
  flexShrink: { flexShrink: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: spacing.x4, borderTopWidth: line.hair, borderTopColor: colors.border },
  cell: { width: "50%", paddingVertical: spacing.x3, paddingRight: spacing.x3, gap: spacing.x1 },
  cellRight: { paddingLeft: spacing.x3, paddingRight: 0, borderLeftWidth: line.hair, borderLeftColor: colors.border },
  cellBottom: { borderTopWidth: line.hair, borderTopColor: colors.border },
  cellValue: { fontWeight: "700" },
})
