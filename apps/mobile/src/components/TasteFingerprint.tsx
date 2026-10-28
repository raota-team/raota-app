import { t, ph } from "@lingui/core/macro";
import { useLocale } from "@/src/i18n"
import { t as legacyT } from "@raota/shared"
import { useEffect, useRef, useState } from "react"
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated"
import Svg, { Polygon } from "react-native-svg"

import type { TasteAxisKey } from "@raota/shared"

import { colors, maxFontScale, radii, spacing, typography, usePalette, useTasteAxisPalette } from "../theme"
import { AppText } from "./ui"

export interface TasteFingerprintProps {
  title?: string
  meta?: string
  rows: Array<{ key: TasteAxisKey; label: string; value: number; text: string }>
  style?: StyleProp<ViewStyle>
  /** false인 동안은 판만 보이고 기다린다. true가 되는 순간 한 번 펼쳐진다(스크롤해서 화면에 들어왔을 때 등). 기본 true */
  play?: boolean
}

/* 오각형 판. 꼭짓점 바깥에 축 이름과 값을 둔다. 크기는 카드 폭에 맞추되 판 반지름은 글씨 자리를 남기고 정한다. */
const CHART_HEIGHT = 248
const MAX_RADIUS = 84
const LABEL_GAP = 12
const LABEL_WIDTH = 92
/** 안쪽 눈금 세 겹(4·3·2점 자리). 바깥일수록 진하게, 안으로 갈수록 옅게 그린다 */
const RINGS = [4 / 5, 3 / 5, 2 / 5]
const REVEAL_EASE = Easing.bezier(0.22, 1, 0.36, 1)

/**
 * 높을수록 좋은 품질 축. 육수 농도·면 삶기는 진하고 단단할수록 좋은 게 아닌 스타일 축이라
 * 점수가 높아도 "잘한 점"처럼 파랗게 올리지 않는다(사용자 결정, 2026.10.20).
 */
const QUALITY_AXIS: Record<TasteAxisKey, boolean> = {
  satisfaction: true,
  topping: true,
  revisit: true,
  brothDensity: false,
  noodleFirmness: false,
}

function pointAt(index: number, count: number, ratio: number, cx: number, cy: number, radius: number) {
  const angle = ((Math.PI * 2) / count) * index - Math.PI / 2
  return { x: cx + radius * ratio * Math.cos(angle), y: cy + radius * ratio * Math.sin(angle), cos: Math.cos(angle), sin: Math.sin(angle) }
}

const pointsOf = (ratios: number[], cx: number, cy: number, radius: number) =>
  ratios.map((ratio, index) => {
    const p = pointAt(index, ratios.length, ratio, cx, cy, radius)
    return `${p.x},${p.y}`
  }).join(" ")

/** 축 이름 상자를 꼭짓점 바깥쪽에 붙인다. 위·아래 꼭짓점은 가운데 맞춤, 옆 꼭짓점은 바깥으로 연다 */
function labelBox(cos: number, sin: number, x: number, y: number): ViewStyle {
  const side = Math.abs(cos) < 0.3 ? "center" : cos > 0 ? "start" : "end"
  const left = side === "center" ? x - LABEL_WIDTH / 2 : side === "start" ? x : x - LABEL_WIDTH
  const alignItems = side === "center" ? "center" : side === "start" ? "flex-start" : "flex-end"
  if (sin < -0.5) return { left, bottom: CHART_HEIGHT - y, alignItems }
  if (sin > 0.5) return { left, top: y - 6, alignItems }
  return { left, top: y - 18, alignItems }
}

function AxisLabel({
  row,
  index,
  count,
  cx,
  cy,
  radius,
  strong,
  mutedColor,
  accentColor,
  play,
}: {
  row: TasteFingerprintProps["rows"][number]
  index: number
  count: number
  cx: number
  cy: number
  radius: number
  strong: boolean
  mutedColor: string
  accentColor: string
  play: boolean
}) {
  useLocale()
  const reducedMotion = useReducedMotion()
  const revealed = useRef(false)
  const progress = useSharedValue(reducedMotion ? 1 : 0)

  useEffect(() => {
    if (reducedMotion) {
      progress.value = 1
      revealed.current = true
    } else if (play && !revealed.current) {
      revealed.current = true
      progress.value = withDelay(550 + index * 60, withTiming(1, { duration: strong ? 500 : 350, easing: REVEAL_EASE }))
    }
  }, [index, play, progress, reducedMotion, strong])
  useEffect(() => () => cancelAnimation(progress), [progress])

  const labelStyle = useAnimatedStyle(() => {
    const visibility = strong ? Math.min(1, progress.value / 0.6) : progress.value
    return { opacity: visibility, transform: [{ translateY: 4 * (1 - visibility) }] }
  })
  const strongColor = useAnimatedStyle(() => ({
    color: interpolateColor(Math.max(0, (progress.value - 0.6) / 0.4), [0, 1], [mutedColor, accentColor]),
  }))
  const p = pointAt(index, count, 1, cx, cy, radius + LABEL_GAP)
  const box = labelBox(p.cos, p.sin, p.x, p.y)
  const align = box.alignItems === "center" ? "center" : box.alignItems === "flex-start" ? "left" : "right"

  return (
    <Animated.View style={[styles.label, box, labelStyle]}>
      {strong ? (
        <>
          <Animated.Text maxFontSizeMultiplier={maxFontScale} numberOfLines={1} style={[typography.secondary, styles.axisName, { textAlign: align }, styles.strong, strongColor]}>
            {legacyT(row.label)}
          </Animated.Text>
          <Animated.Text lineBreakStrategyIOS="hangul-word" maxFontSizeMultiplier={maxFontScale} numberOfLines={2} style={[typography.meta, styles.axisValue, { textAlign: align }, styles.strong, strongColor]}>
            {legacyT(row.text)}
          </Animated.Text>
        </>
      ) : (
        <>
          <AppText capScale numberOfLines={1} style={[styles.axisName, { textAlign: align }]} tone="muted" variant="secondary">{legacyT(row.label)}</AppText>
          <AppText capScale lineBreakStrategyIOS="hangul-word" numberOfLines={2} style={[styles.axisValue, { textAlign: align }]} tone="muted" variant="meta">{legacyT(row.text)}</AppText>
        </>
      )}
    </Animated.View>
  )
}

/**
 * 맛 지문: 다섯 평가를 오각형 하나로 그린다. 가게·기록마다 모양이 달라서 한눈에 견줄 수 있다.
 * 회색 판(바깥 선 + 옅어지는 눈금 세 겹) 위에 만족도 축 색으로 면과 선을 긋고,
 * 품질 축(만족도·토핑·재방문) 중 가장 높은 축 이름만 같은 색 굵은 글씨로 올린다. 스타일 축은 늘 회색이다.
 * 값 1점이 판 지름의 1/5이라 도형이 점으로 무너지지 않는다.
 */
export function TasteFingerprint({ title = t`맛 지문`, meta, rows, style, play = true }: TasteFingerprintProps) {
  useLocale()
  const [width, setWidth] = useState(0)
  const palette = usePalette()
  const axis = useTasteAxisPalette()
  const radius = Math.max(40, Math.min(MAX_RADIUS, width / 2 - LABEL_WIDTH - LABEL_GAP + 8))
  const cx = width / 2
  const cy = 134
  const ratios = rows.map((row) => Math.max(1, Math.min(5, row.value)) / 5)
  // 품질 축 중 가장 높은 점수의 축을 파랗게 강조한다. 같은 점수는 같은 색이어야 해서 최고점이 여럿이면 모두 강조한다
  const qualityValues = rows.filter((row) => QUALITY_AXIS[row.key]).map((row) => row.value)
  const top = qualityValues.length > 0 ? Math.max(...qualityValues) : null
  const strongLabels = rows.filter((row) => QUALITY_AXIS[row.key] && row.value === top).map((row) => row.label)
  const ringColors = [palette.secondaryPressed, palette.border, palette.secondary]
  const reducedMotion = useReducedMotion()
  const revealed = useRef(false)
  const polygonScale = useSharedValue(reducedMotion ? 1 : 0)
  const ready = width > 0 && rows.length >= 3 && play

  useEffect(() => {
    if (!ready) return
    if (reducedMotion) {
      polygonScale.value = 1
      revealed.current = true
    } else if (!revealed.current) {
      revealed.current = true
      polygonScale.value = withDelay(100, withTiming(1, { duration: 700, easing: REVEAL_EASE }))
    }
  }, [polygonScale, ready, reducedMotion])
  useEffect(() => () => cancelAnimation(polygonScale), [polygonScale])

  // 판은 그대로 두고 파란 면만 중심에서 펼친다.
  const polygonStyle = useAnimatedStyle(() => ({
    transformOrigin: [cx, cy, 0],
    transform: [{ scale: polygonScale.value }],
  }))

  return (
    <View
      // 화면에서 파랗게 올린 축을 읽기 화면에서도 같은 무게로 알린다
      accessibilityLabel={`${title}. ${meta ? `${meta}. ` : ""}${rows.map((row) => `${row.label} ${legacyT(row.text)}`).join(", ")}${strongLabels.length > 0 ? `. ${t`가장 높은 평가 ${ph({ labels: strongLabels.map((label) => legacyT(label)).join(", ") })}`}` : ""}`}
      accessibilityRole="text"
      accessible
      style={[styles.card, style]}
    >
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.header}>
          <AppText variant="cardTitle">{title}</AppText>
          {meta ? <AppText capScale numberOfLines={1} style={styles.meta} tone="muted" variant="meta">{meta}</AppText> : null}
        </View>
        <View onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)} style={styles.chart} testID="taste-fingerprint-chart">
          {width > 0 && rows.length >= 3 ? (
            <>
              <Svg height={CHART_HEIGHT} pointerEvents="none" width={width}>
                <Polygon fill="none" points={pointsOf(rows.map(() => 1), cx, cy, radius)} stroke={palette.outline} strokeLinejoin="round" strokeWidth={1.5} />
                {RINGS.map((ring, ringIndex) => (
                  <Polygon fill="none" key={ring} points={pointsOf(rows.map(() => ring), cx, cy, radius)} stroke={ringColors[ringIndex]} strokeLinejoin="round" strokeWidth={1.5} />
                ))}
              </Svg>
              <Animated.View pointerEvents="none" style={[styles.polygonLayer, { width }, polygonStyle]}>
                <Svg height={CHART_HEIGHT} pointerEvents="none" width={width}>
                  <Polygon
                    fill={axis.satisfaction}
                    fillOpacity={0.16}
                    points={pointsOf(ratios, cx, cy, radius)}
                    stroke={axis.satisfaction}
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </Svg>
              </Animated.View>
              {rows.map((row, index) => (
                <AxisLabel
                  accentColor={axis.satisfaction}
                  count={rows.length}
                  cx={cx}
                  cy={cy}
                  index={index}
                  key={row.key}
                  play={play}
                  mutedColor={palette.textMuted}
                  radius={radius}
                  row={row}
                  strong={QUALITY_AXIS[row.key] && row.value === top}
                />
              ))}
            </>
          ) : null}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { padding: spacing.x4, backgroundColor: colors.canvasSoft, borderRadius: radii.sm },
  header: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.x2 },
  meta: { flexShrink: 1, textAlign: "right" },
  chart: { height: CHART_HEIGHT, marginTop: spacing.x1 },
  label: { position: "absolute", width: LABEL_WIDTH },
  polygonLayer: { position: "absolute", top: 0, left: 0, height: CHART_HEIGHT },
  axisName: { fontSize: 14, lineHeight: 18, fontWeight: "600" },
  axisValue: { fontSize: 12, lineHeight: 16, fontWeight: "600" },
  strong: { fontWeight: "700" },
})
