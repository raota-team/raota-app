import { useEffect, useMemo, useRef, useState } from "react"
import { router, useLocalSearchParams } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { Image } from "expo-image"
import { ArrowRight, Check, PenLine, RotateCw, Share2 } from "lucide-react-native"
import { Pressable, ScrollView, Share, StyleSheet, View, useWindowDimensions } from "react-native"
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated"
import { SafeAreaView } from "react-native-safe-area-context"
import Svg, { Circle, Line, Path, Polygon, Text as SvgText } from "react-native-svg"

import {
  MENU_CATEGORY_NAMES,
  TASTE_AXES,
  metricsFromProfile,
  seoulToday,
  typeCountsOf,
  type MenuCategoryName,
  type MetricItem,
  type Shop,
  type TasteAxisKey,
  type TasteIdentity,
  type TasteProfile,
} from "@raota/shared"
import { track } from "@/src/analytics"
import { AppText, BottomSheet, Button, Header, LoadingState, RamenTypeTag, Sticker, Tag, Toast } from "@/src/components/ui"
import {
  useActivityLevel,
  useBowlCount,
  useMyBowls,
  useMyLogs,
  useShops,
  useTasteIdentity,
  useTasteProfile,
  useVisitedShops,
} from "@/src/data"
import { useRaota } from "@/src/state/RaotaStore"
import { broth, colors, line, radii, spacing } from "@/src/theme"

/*
 * 취향 종합 리포트. 웹 TasteDetailScreen과 같은 구성이다.
 * 정체성 카드 → 5축 레이더(실제 평균) → 축별 막대 → 종류별 분포 → 자주 간 라멘집 → 다음 한 그릇.
 * params.analyze === "1"이면 짧은 정리 연출(웹 TasteReportLoading)을 먼저 보여준다. Reduce Motion이면 생략한다.
 */

const LOADING_DURATION = 2400

/** 매장 원장의 대표 스타일. 공유 Shop 타입에는 없어서 값이 있을 때만 읽는다 */
export function shopStyleOf(shop: Shop): string | undefined {
  const value = (shop as Shop & { style?: unknown }).style
  return typeof value === "string" && value ? value : undefined
}

export function shopSpecOf(shop: Shop): string | undefined {
  const value = (shop as Shop & { spec?: unknown }).spec
  return typeof value === "string" && value ? value : undefined
}

const categoryOfStyle = (style: string | undefined): MenuCategoryName | null =>
  style ? (MENU_CATEGORY_NAMES.find((name) => name !== "기타" && style.startsWith(name)) ?? null) : null

function openShop(shop: Shop | undefined) {
  if (shop) router.push({ pathname: "/shop/[shopId]", params: { shopId: String(shop.id) } })
}

/**
 * 취향의 위치를 말하는 한 마디. 육수 농도와 면 삶기는 좋고 나쁨이 아니라서 차오르지 않고,
 * 기록 화면·라멘로그 상세와 같은 어휘("진한 편", "단단한 편")로 위치만 말한다.
 * 같은 표가 record/new의 AXIS_PRESENTATION과 src/domain/lounge의 wordOf에도 있지만
 * 둘 다 내보내지 않아 여기서 다시 적는다(후속 과제: 공용 함수로 합치기).
 */
const SPECTRUM_WORDS = {
  brothDensity: ["아주 맑음", "맑은 편", "중간", "진한 편", "아주 진함"],
  noodleFirmness: ["아주 부드럽게", "부드러운 편", "중간", "단단한 편", "아주 단단하게"],
} as const

type SpectrumAxisKey = keyof typeof SPECTRUM_WORDS

const isSpectrumMetric = (metric: MetricItem): metric is MetricItem & { key: SpectrumAxisKey } =>
  metric.key === "brothDensity" || metric.key === "noodleFirmness"

/** 평균 점수를 반올림해 다섯 단어 중 하나로 읽는다. 기록 화면의 계산과 같다 */
function spectrumWordOf(key: SpectrumAxisKey, score: number) {
  return SPECTRUM_WORDS[key][Math.min(5, Math.max(1, Math.round(score))) - 1]
}

// ---------------------------------------------------------------------------
// 종합 리포트 표지 (웹 TasteReportCover). 마이에서도 같은 카드를 쓴다
// ---------------------------------------------------------------------------

export interface TasteReportCoverProps {
  recordCount: number
  identity: TasteIdentity
  profile: TasteProfile
  onOpen?: () => void
  onAnalyze?: () => void
  /** 0그릇일 때 첫 기록으로 안내 */
  onStart?: () => void
}

export function TasteReportCover({ recordCount, identity, profile, onOpen, onAnalyze, onStart }: TasteReportCoverProps) {
  const empty = recordCount === 0
  const metrics = metricsFromProfile(profile).filter(isSpectrumMetric)
  return (
    <View style={styles.card}>
      <View style={styles.coverHead}>
        <View style={styles.coverHeadLabels}>
          <Sticker label="종합 리포트" tone="ink" />
          <AppText capScale style={styles.tabular} tone="muted" variant="meta">
            전체 {recordCount}그릇 기준
          </AppText>
        </View>
        <Image
          accessibilityLabel="라오타"
          accessible
          contentFit="contain"
          source={require("@/assets/images/logo.png")}
          style={styles.coverLogo}
        />
      </View>
      <View style={styles.coverBody}>
        <AppText accessibilityRole="header" variant="headline">
          {identity.title}
        </AppText>
        <AppText lineBreakStrategyIOS="hangul-word" style={styles.gapTop1} tone="sub" variant="secondary">
          {empty ? identity.description : identity.evidence}
        </AppText>
      </View>
      {identity.tags.length > 0 ? (
        <View accessibilityLabel={`취향 특징: ${identity.tags.join(", ")}`} accessible style={styles.tagRow}>
          {identity.tags.map((tag) => (
            <Tag key={tag} label={`#${tag}`} />
          ))}
        </View>
      ) : null}
      {!empty ? (
        <View style={styles.coverAxes}>
          {/* 두 항목 모두 취향의 위치라 차오르는 미터를 쓰지 않는다. 위치를 말하는 한 마디가 앞이고 평균 점수는 옆에 작게 둔다 */}
          {metrics.map((metric) => {
            const word = spectrumWordOf(metric.key, metric.score)
            return (
              <View
                accessibilityLabel={`${metric.label} ${word}, 평균 ${metric.score.toFixed(1)}점, 5점 만점`}
                accessible
                key={metric.key}
                style={styles.flex}
              >
                <AppText capScale tone="muted" variant="meta">
                  {metric.label}
                </AppText>
                <View style={styles.coverAxisValue}>
                  <AppText style={styles.flex} variant="bodyStrong">
                    {word}
                  </AppText>
                  <AppText capScale style={styles.tabular} tone="muted" variant="meta">
                    {metric.score.toFixed(1)}
                  </AppText>
                </View>
              </View>
            )
          })}
        </View>
      ) : null}
      {!empty && (onOpen || onAnalyze) ? (
        <View style={styles.coverActions}>
          {onOpen ? (
            <Button
              fullWidth
              onPress={onOpen}
              rightIcon={<ArrowRight color={colors.onDark} size={16} />}
              style={styles.noFlex}
              title="종합 리포트 보기"
            />
          ) : null}
          {onAnalyze ? (
            <Button
              leftIcon={<RotateCw color={colors.ink} size={15} />}
              onPress={onAnalyze}
              size="small"
              textStyle={styles.inkText}
              title="최근 기록으로 다시 정리"
              variant="ghost"
            />
          ) : null}
        </View>
      ) : null}
      {empty && onStart ? (
        <View style={styles.coverActions}>
          <Button
            fullWidth
            leftIcon={<PenLine color={colors.onDark} size={16} />}
            onPress={onStart}
            style={styles.noFlex}
            title="첫 그릇 기록하기"
          />
        </View>
      ) : null}
    </View>
  )
}

// ---------------------------------------------------------------------------
// 5축 레이더
// ---------------------------------------------------------------------------

const RADAR_SIZE = 250
const RADAR_CENTER = 125
const RADAR_RADIUS = 80
/** 데이터 도형의 면 투명도. 안쪽 눈금이 도형 너머로 비칠 만큼만 덮는다 */
const RADAR_FILL_OPACITY = 0.35
const RADAR_LABELS = [
  { x: 125, y: 14 },
  { x: 220, y: 92 },
  { x: 184, y: 216 },
  { x: 66, y: 216 },
  { x: 30, y: 92 },
]

function radarPoint(index: number, value: number, center = RADAR_CENTER, radius = RADAR_RADIUS) {
  const angle = ((Math.PI * 2) / 5) * index - Math.PI / 2
  return { x: center + radius * value * Math.cos(angle), y: center + radius * value * Math.sin(angle) }
}

const pointsOf = (values: number[], center?: number, radius?: number) =>
  values
    .map((value, index) => {
      const p = radarPoint(index, value, center, radius)
      return `${p.x},${p.y}`
    })
    .join(" ")

function RadarChart({ metrics }: { metrics: MetricItem[] }) {
  const summary = metrics.map((metric) => `${metric.label} ${metric.score.toFixed(1)}점`).join(", ")
  return (
    <View accessibilityLabel={`항목별 맛 평가 그래프. ${summary}`} accessibilityRole="image" accessible style={styles.radarWrap}>
      {/* 좁은 화면에서도 잘리지 않게 폭은 카드에 맞추고 모양은 viewBox가 지킨다 */}
      <Svg height={RADAR_SIZE} viewBox={`-12 0 ${RADAR_SIZE + 24} ${RADAR_SIZE}`} width="100%">
        {/* 바로 앞 로딩 레이더와 같은 재료를 쓴다: 바깥 오각형은 2pt 먹선으로 두른 흰 면, 안쪽 눈금과 축은 1.5pt 보조선 */}
        <Polygon
          fill={colors.canvas}
          points={pointsOf([1, 1, 1, 1, 1])}
          stroke={colors.outline}
          strokeLinejoin="round"
          strokeWidth={line.base}
        />
        {[0.2, 0.4, 0.6, 0.8].map((level) => (
          <Polygon
            fill="none"
            key={level}
            points={pointsOf([level, level, level, level, level])}
            stroke={colors.outline}
            strokeLinejoin="round"
            strokeWidth={line.thin}
          />
        ))}
        {[0, 1, 2, 3, 4].map((index) => {
          const p = radarPoint(index, 1)
          return <Line key={index} stroke={colors.outline} strokeWidth={line.thin} x1={RADAR_CENTER} x2={p.x} y1={RADAR_CENTER} y2={p.y} />
        })}
        {/* 데이터 도형은 수량을 말하므로 빨강이 아니라 국물 색이다. 면이 반투명이라 안쪽 눈금과 축이 도형 너머로 비친다 */}
        <Polygon
          fill={broth[0]}
          fillOpacity={RADAR_FILL_OPACITY}
          points={pointsOf(metrics.map((metric) => metric.myVal))}
          stroke={colors.ink}
          strokeLinejoin="round"
          strokeWidth={line.base}
        />
        {metrics.map((metric, index) => {
          const p = radarPoint(index, metric.myVal)
          return <Circle cx={p.x} cy={p.y} fill={colors.ink} key={metric.key} r={3.5} stroke={colors.canvas} strokeWidth={1.5} />
        })}
        {metrics.map((metric, index) => (
          <SvgText
            fill={colors.inkSub}
            fontSize={12}
            fontWeight="800"
            key={`${metric.key}-label`}
            textAnchor="middle"
            x={RADAR_LABELS[index].x}
            y={RADAR_LABELS[index].y - 3}
          >
            {metric.label}
          </SvgText>
        ))}
        {metrics.map((metric, index) => (
          <SvgText
            fill={colors.ink}
            fontSize={13}
            fontWeight="800"
            key={`${metric.key}-score`}
            textAnchor="middle"
            x={RADAR_LABELS[index].x}
            y={RADAR_LABELS[index].y + 13}
          >
            {metric.score.toFixed(1)}
          </SvgText>
        ))}
      </Svg>
    </View>
  )
}

// ---------------------------------------------------------------------------
// 정리 연출 (웹 TasteReportLoading)
// ---------------------------------------------------------------------------

/**
 * 좋고 나쁨이 아니라 "취향의 위치"를 말하는 축. 차오르지 않고 선 위의 한 점으로 보여 준다.
 * DESIGN.md "맛 평가" 절의 구분을 기록 화면·리포트가 같이 따른다.
 */
const POSITION_AXES = new Set<TasteAxisKey>(["brothDensity", "noodleFirmness"])

const STATUS_MESSAGES = [
  "라멘 기록을 모으고 있어요",
  "국물과 면 취향을 살펴보고 있어요",
  "나의 누적 취향을 정리하고 있어요",
  "나의 라멘 취향이 정리됐어요",
]
const LOADING_SIZE = 260
const LOADING_CENTER = 130
const LOADING_RADIUS = 76
/** 오각형이 자라기 시작하는 크기. 0에서 시작하면 첫 순간이 빈 판으로 보인다 */
const LOADING_START_SCALE = 0.3
/** 지금 보고 있는 축을 짚는 노랑 블록의 한 변 */
const AXIS_MARK = 18
/** 단계가 바뀔 때 축 표시가 한 번 커졌다 제자리로 돌아오는 시간 */
const AXIS_PULSE_DURATION = 520
/** 꼭짓점 점의 반지름. 결과 레이더와 같은 값 */
const LOADING_DOT_RADIUS = 3.5
/**
 * 축 이름과 점수를 놓는 자리. 점수는 늘 판 바깥쪽에 붙인다 —
 * 위·옆 세 축은 이름 위, 아래 두 축은 이름 아래. 그래야 꼭짓점의 노랑 표시와 겹치지 않는다.
 */
const LOADING_LABELS = [
  { x: 130, y: 40, scoreY: 26 },
  { x: 222, y: 90, scoreY: 76 },
  { x: 184, y: 216, scoreY: 230 },
  { x: 76, y: 216, scoreY: 230 },
  { x: 38, y: 90, scoreY: 76 },
]
/** 단계마다 짚는 축의 순서. 마지막에는 다섯 축을 한 번에 보여 준다 */
const AXIS_ORDER = [0, 1, 3, 2, 4]

/**
 * react-native-svg의 Polygon은 points를 스스로 d로 바꿔 네이티브에 넘긴다.
 * 그래서 움직이는 도형은 Polygon이 아니라 Path의 d를 직접 갱신한다.
 */
const AnimatedPath = Animated.createAnimatedComponent(Path)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

/**
 * 다섯 꼭짓점을 잇는 오각형 path. UI 스레드에서도 불리므로 worklet이다.
 * View에 scale을 걸면 2pt 먹선까지 같이 얇아지므로 크기는 꼭짓점 값 자체에 곱한다.
 */
function radarPathOf(values: number[], grow: number, center: number, radius: number) {
  "worklet"
  let path = ""
  for (let index = 0; index < values.length; index += 1) {
    const angle = ((Math.PI * 2) / 5) * index - Math.PI / 2
    const r = radius * values[index] * grow
    path += `${index === 0 ? "M" : "L"}${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`
  }
  return `${path}Z`
}

/** 꼭짓점 점. 오각형과 같은 박자로 바깥으로 나간다 */
function RadarDot({ grow, index, value }: { grow: SharedValue<number>; index: number; value: number }) {
  const start = radarPoint(index, value * LOADING_START_SCALE, LOADING_CENTER, LOADING_RADIUS)
  const dotProps = useAnimatedProps(() => {
    const angle = ((Math.PI * 2) / 5) * index - Math.PI / 2
    const r = LOADING_RADIUS * value * grow.value
    return { cx: LOADING_CENTER + r * Math.cos(angle), cy: LOADING_CENTER + r * Math.sin(angle) }
  })
  return (
    <AnimatedCircle
      animatedProps={dotProps}
      cx={start.x}
      cy={start.y}
      fill={colors.ink}
      r={LOADING_DOT_RADIUS}
      stroke={colors.canvas}
      strokeWidth={line.thin}
    />
  )
}

/**
 * 지금 보고 있는 축을 짚는 노랑 블록. 단계가 바뀔 때마다 한 번 커졌다 제자리로 돌아온다.
 * 레이더 판은 260pt이고 SVG 좌표와 1:1이라 같은 자리에 겹쳐 놓을 수 있다.
 */
function AxisMark({ axis, reducedMotion }: { axis: number; reducedMotion: boolean }) {
  const tip = radarPoint(axis, 1, LOADING_CENTER, LOADING_RADIUS)
  const pulse = useSharedValue(reducedMotion ? 1 : 0)

  useEffect(() => {
    // Reduce Motion이면 움직임 없이 제자리에 그대로 선다
    if (reducedMotion) return
    pulse.value = withTiming(1, { duration: AXIS_PULSE_DURATION, easing: Easing.linear })
  }, [pulse, reducedMotion])

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pulse.value * 4),
    transform: [{ scale: 1 + 0.26 * Math.sin(Math.PI * pulse.value) }],
  }))

  return <Animated.View style={[styles.axisMark, { left: tip.x - AXIS_MARK / 2, top: tip.y - AXIS_MARK / 2 }, pulseStyle]} />
}

function TasteReportLoading({
  recordCount,
  metrics,
  onBack,
  onComplete,
}: {
  recordCount: number
  metrics: MetricItem[]
  onBack: () => void
  onComplete: () => void
}) {
  const reducedMotion = useReducedMotion()
  const [stage, setStage] = useState(0)
  const complete = stage === 3
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    const timers = [
      setTimeout(() => setStage(1), LOADING_DURATION / 3),
      setTimeout(() => setStage(2), (LOADING_DURATION * 2) / 3),
      setTimeout(() => setStage(3), LOADING_DURATION),
      setTimeout(() => onCompleteRef.current(), LOADING_DURATION + 500),
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  // 판을 확대하면 2pt 먹선까지 같이 얇아진다. 그래서 크기는 꼭짓점 값에 곱하고, 그 값을 끊지 않고 이어서 키운다
  const values = useMemo(() => metrics.map((metric) => metric.myVal), [metrics])
  const grow = useSharedValue(reducedMotion ? 1 : LOADING_START_SCALE)

  useEffect(() => {
    // Reduce Motion이면 움직임 없이 즉시 최종 크기
    if (reducedMotion) {
      grow.value = 1
      return
    }
    grow.value = withTiming(1, { duration: LOADING_DURATION, easing: Easing.out(Easing.quad) })
  }, [grow, reducedMotion])

  const shapeProps = useAnimatedProps(() => ({ d: radarPathOf(values, grow.value, LOADING_CENTER, LOADING_RADIUS) }))
  const startPath = radarPathOf(values, reducedMotion ? 1 : LOADING_START_SCALE, LOADING_CENTER, LOADING_RADIUS)

  // 단계가 바뀔 때마다 한 축을 짚고, 짚은 축의 점수를 하나씩 드러낸다. 다 차면 다섯 축이 한 번에 보인다
  const activeAxis = complete ? -1 : AXIS_ORDER[stage]
  const shownAxes = AXIS_ORDER.slice(0, complete ? AXIS_ORDER.length : stage + 1)

  return (
    <SafeAreaView edges={["top", "left", "right", "bottom"]} style={styles.root}>
      <StatusBar style="dark" />
      <Header onBack={onBack} title="종합 취향 리포트" />
      <ScrollView contentContainerStyle={styles.loadingBody}>
        <AppText accessibilityRole="header" style={styles.center} variant="headline">
          {"나의 라멘 취향을\n정리하고 있어요"}
        </AppText>
        <AppText style={[styles.center, styles.gapTop3]} tone="sub" variant="body">
          기록한 {recordCount}그릇을 바탕으로 분석해요
        </AppText>
        <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.loadingRadar}>
          <Svg height={LOADING_SIZE} width={LOADING_SIZE}>
            {/* 바깥 오각형은 2pt 먹선으로 두른 흰 면, 안쪽 눈금과 축은 1.5pt 보조선 */}
            <Polygon
              fill={colors.canvas}
              points={pointsOf([1, 1, 1, 1, 1], LOADING_CENTER, LOADING_RADIUS)}
              stroke={colors.outline}
              strokeLinejoin="round"
              strokeWidth={line.base}
            />
            {[0.33, 0.66].map((level) => (
              <Polygon
                fill="none"
                key={level}
                points={pointsOf([level, level, level, level, level], LOADING_CENTER, LOADING_RADIUS)}
                stroke={colors.outline}
                strokeLinejoin="round"
                strokeWidth={line.thin}
              />
            ))}
            {[0, 1, 2, 3, 4].map((index) => {
              const p = radarPoint(index, 1, LOADING_CENTER, LOADING_RADIUS)
              return (
                <Line key={index} stroke={colors.outline} strokeWidth={line.thin} x1={LOADING_CENTER} x2={p.x} y1={LOADING_CENTER} y2={p.y} />
              )
            })}
            {/* 결과 레이더와 같은 재료(반투명 국물 색 면 + 2pt 먹선). 꼭짓점 값만 자라고 먹선 굵기는 그대로다 */}
            <AnimatedPath
              animatedProps={shapeProps}
              d={startPath}
              fill={broth[0]}
              fillOpacity={RADAR_FILL_OPACITY}
              stroke={colors.outline}
              strokeLinejoin="round"
              strokeWidth={line.base}
            />
            {metrics.map((metric, index) => (
              <RadarDot grow={grow} index={index} key={`${metric.key}-dot`} value={metric.myVal} />
            ))}
            {metrics.map((metric, index) => (
              <SvgText
                fill={index === activeAxis ? colors.ink : colors.inkSub}
                fontSize={12}
                fontWeight="800"
                key={metric.key}
                textAnchor="middle"
                x={LOADING_LABELS[index].x}
                y={LOADING_LABELS[index].y}
              >
                {metric.label}
              </SvgText>
            ))}
            {/* 지금까지 살펴본 축의 점수. 결과 레이더와 같은 13pt 800 먹색 숫자다 */}
            {shownAxes.map((index) => (
              <SvgText
                fill={colors.ink}
                fontSize={13}
                fontWeight="800"
                key={`${metrics[index]?.key ?? index}-score`}
                textAnchor="middle"
                x={LOADING_LABELS[index].x}
                y={LOADING_LABELS[index].scoreY}
              >
                {(metrics[index]?.score ?? 0).toFixed(1)}
              </SvgText>
            ))}
          </Svg>
          {/* 지금 보고 있는 축은 노랑 블록으로 짚는다. 단계가 바뀔 때마다 새로 붙으면서 한 번 커졌다 돌아온다 */}
          {activeAxis >= 0 ? <AxisMark axis={activeAxis} key={activeAxis} reducedMotion={reducedMotion} /> : null}
          {complete ? (
            <View style={styles.loadingSticker}>
              <Sticker icon={<Check color={colors.ink} size={12} />} label="정리 끝" style={styles.centerSelf} />
            </View>
          ) : null}
        </View>
        <View accessibilityLiveRegion="polite" accessibilityRole="text" style={styles.loadingStatus}>
          {complete ? <Check color={colors.brand} size={16} /> : <View style={styles.dot} />}
          <AppText tone="sub" variant="body">
            {STATUS_MESSAGES[stage]}
          </AppText>
        </View>
      </ScrollView>
      <View style={styles.loadingFooter}>
        <Button
          onPress={onComplete}
          rightIcon={<ArrowRight color={colors.inkSub} size={16} />}
          size="small"
          textStyle={styles.subText}
          title="결과 바로 보기"
          variant="ghost"
        />
      </View>
    </SafeAreaView>
  )
}

// ---------------------------------------------------------------------------
// 화면
// ---------------------------------------------------------------------------

function seoulTime(now = new Date()) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now)
}

export default function TasteReportScreen() {
  const { analyze } = useLocalSearchParams<{ analyze?: string }>()
  const reduceMotion = useReducedMotion()
  const { height: windowHeight } = useWindowDimensions()
  const { currentUser } = useRaota()
  const { data: recordCount, isLoading } = useBowlCount()
  const { data: taste } = useTasteProfile()
  const { data: identity } = useTasteIdentity()
  const { data: bowls } = useMyBowls()
  const { data: visits } = useVisitedShops()
  const { data: myLogs } = useMyLogs()
  const { data: shops } = useShops()
  const { data: level } = useActivityLevel()

  const profile = taste.profile
  const metrics = useMemo(() => metricsFromProfile(profile), [profile])
  const typeCounts = useMemo(() => typeCountsOf(bowls), [bowls])
  const typeTotal = MENU_CATEGORY_NAMES.reduce((sum, name) => sum + typeCounts[name], 0)
  /** 서로 다른 그릇 수를 많은 쪽부터. 종류 다섯에 국물은 네 단계라 같은 수는 같은 단계로 묶인다 */
  const typeRanks = useMemo(
    () => [...new Set(MENU_CATEGORY_NAMES.map((name) => typeCounts[name]))].sort((a, b) => b - a),
    [typeCounts],
  )
  const topShops = visits.slice(0, 3)
  // 앱 설치 전 원장이 있는 계정만 "앱에서 남긴 기록이 더해졌다"고 알린다
  const appCount = myLogs.length
  const hasBaseLedger = recordCount > appCount

  const [generating, setGenerating] = useState(analyze === "1" && recordCount > 0 && !reduceMotion)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [shareFallback, setShareFallback] = useState(false)
  const tracked = useRef(false)
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    if (generating || isLoading || tracked.current) return
    tracked.current = true
    track("report_viewed", { kind: "overall", bowls: recordCount })
  }, [generating, isLoading, recordCount])

  const shopByName = (name: string) => shops.find((shop) => shop.name === name)

  // 다음 한 그릇: 가장 적게 먹은 종류(기타 제외)를 파는 원장 매장. 안 가 본 곳을 먼저 고른다
  const suggestion = useMemo(() => {
    if (typeTotal === 0) return null
    const ranked = MENU_CATEGORY_NAMES.filter((name) => name !== "기타").sort((a, b) => typeCounts[a] - typeCounts[b])
    for (const category of ranked) {
      const candidates = shops.filter((shop) => categoryOfStyle(shopStyleOf(shop)) === category)
      if (!candidates.length) continue
      const unvisited = candidates.find((shop) => !visits.some((visit) => visit.name === shop.name))
      return { category, count: typeCounts[category], shop: unvisited ?? candidates[0] }
    }
    return null
  }, [shops, typeCounts, typeTotal, visits])

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/native/my"))

  const finishGeneration = () => {
    setGenerating(false)
    setGeneratedAt(seoulTime())
    setToast(`전체 ${recordCount}그릇으로 취향을 다시 정리했어요`)
    scrollRef.current?.scrollTo({ y: 0, animated: false })
  }

  const restart = () => {
    setToast(null)
    if (reduceMotion) finishGeneration()
    else setGenerating(true)
  }

  const shareText = [
    `라오타 취향 리포트${currentUser?.nickname ? ` · ${currentUser.nickname}` : ""}`,
    identity.title,
    identity.evidence,
    metrics.map((metric) => `${metric.label} ${metric.score.toFixed(1)}`).join(" · "),
    topShops.length ? `자주 간 라멘집: ${topShops.map((shop) => `${shop.name} ${shop.visitCount}그릇`).join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n")

  const handleShare = async () => {
    try {
      // iOS 공유 시트. 취소(dismissedAction)면 조용히 닫고, 공유 여부는 앱이 확인할 수 없으니 성공 표시도 하지 않는다
      await Share.share({ title: "라오타 취향 리포트", message: shareText })
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return
      setShareFallback(true)
    }
  }

  if (generating) {
    return <TasteReportLoading metrics={metrics} onBack={goBack} onComplete={finishGeneration} recordCount={recordCount} />
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.root}>
      <StatusBar style="dark" />
      <Header
        onBack={goBack}
        right={
          recordCount > 0 ? (
            <Button
              accessibilityLabel="취향 리포트 공유"
              leftIcon={<Share2 color={colors.ink} size={16} />}
              onPress={handleShare}
              size="small"
              title="공유"
              variant="outline"
            />
          ) : undefined
        }
        title="취향 종합 리포트"
      />
      {isLoading ? (
        <LoadingState fullScreen label="취향을 불러오는 중…" />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} ref={scrollRef} showsVerticalScrollIndicator={false}>
          <View style={styles.top}>
            {hasBaseLedger && appCount > 0 ? (
              <View accessibilityRole="text" style={styles.notice}>
                <Check color={colors.brand} size={16} />
                <AppText style={styles.flex} variant="secondary">
                  앱에서 남긴 기록 {appCount}그릇이 아래 수치에 더해졌어요.
                </AppText>
              </View>
            ) : null}
            <TasteReportCover identity={identity} profile={profile} recordCount={recordCount} />
            <AppText capScale style={styles.gapTop2} tone="sub" variant="meta">
              {generatedAt ? `${seoulToday()} ${generatedAt}에 다시 정리함` : `${seoulToday()} 기준`}
            </AppText>
          </View>

          {recordCount === 0 ? (
            <View style={[styles.block, styles.emptySection]}>
              <AppText accessibilityRole="header" style={styles.center} variant="screenTitle">
                아직 보여드릴 취향이 없어요
              </AppText>
              <AppText style={[styles.center, styles.gapTop2]} tone="sub" variant="body">
                {"첫 그릇을 기록하면\n맛 평가와 종류별 분포가 여기에 쌓여요."}
              </AppText>
              <Button
                onPress={() => router.push({ pathname: "/record/select-shop", params: { mode: "nearby" } })}
                style={styles.gapTop5}
                title="첫 그릇 기록하기"
              />
            </View>
          ) : (
            <>
              <View style={styles.section}>
                <AppText accessibilityRole="header" variant="sectionTitle">
                  항목별 맛 평가
                </AppText>
                <AppText style={styles.gapTop1} tone="sub" variant="secondary">
                  기록마다 매긴 맛 평가의 평균이에요. 바깥쪽일수록 5점에 가까워요.
                </AppText>
                <RadarChart metrics={metrics} />
                <View style={styles.axisList}>
                  {metrics.map((metric, index) => {
                    const lean = metric.score >= 3 ? TASTE_AXES[index].high : TASTE_AXES[index].low
                    return (
                      <View
                        accessibilityLabel={`${metric.label} 평균 ${metric.score.toFixed(1)}점, ${lean}`}
                        accessible
                        key={metric.key}
                        style={[styles.axisRow, index > 0 && styles.rowDivider]}
                      >
                        <AppText style={styles.axisLabel} variant="bodyStrong">
                          {metric.label}
                        </AppText>
                        <View style={styles.track}>
                          {POSITION_AXES.has(metric.key) ? (
                            // 취향의 위치는 좋고 나쁨이 아니라서 차오르지 않는다. 선 위의 한 점으로 어디쯤인지만 말한다
                            <View style={[styles.trackMark, { left: `${metric.myVal * 100}%` }]} />
                          ) : (
                            <View style={[styles.trackFill, { width: `${metric.myVal * 100}%` }]} />
                          )}
                        </View>
                        <AppText style={[styles.axisScore, styles.tabular]} variant="bodyStrong">
                          {metric.score.toFixed(1)}
                        </AppText>
                        <AppText capScale style={styles.axisLean} tone="muted" variant="meta">
                          {lean}
                        </AppText>
                      </View>
                    )
                  })}
                </View>
              </View>

              <View style={styles.section}>
                <View style={styles.rowBetween}>
                  <AppText accessibilityRole="header" variant="sectionTitle">
                    종류별로 먹은 라멘
                  </AppText>
                  <AppText capScale style={styles.tabular} tone="muted" variant="secondary">
                    전체 {typeTotal}그릇
                  </AppText>
                </View>
                <View style={styles.typeList}>
                  {MENU_CATEGORY_NAMES.map((name) => {
                    const count = typeCounts[name]
                    const pct = typeTotal ? Math.round((count / typeTotal) * 100) : 0
                    // 많이 먹은 종류일수록 국물이 진하다. 같은 그릇 수는 같은 색이어야 해서 순위는 촘촘히 센다
                    // (그냥 정렬하면 4그릇 둘이 다른 진하기가 되어 색이 수량을 거짓으로 말한다).
                    // 트랙이 흰 면이라 5위도 broth[0]까지만 옅어진다(border는 흰 면 위 1.3:1이라 빈 칸으로 읽힌다).
                    const rank = typeRanks.indexOf(count)
                    const fill = broth[broth.length - 1 - Math.min(rank < 0 ? broth.length - 1 : rank, broth.length - 1)]
                    return (
                      <View accessibilityLabel={`${name} ${count}그릇, ${pct}%`} accessible key={name} style={styles.typeRow}>
                        <View style={styles.typeName}>
                          {/* 다섯 줄이 이어지는 목록이라 종류는 굵은 먹색 글씨로 쓴다(노랑 스티커는 줄무늬가 된다) */}
                          <RamenTypeTag inList type={name} />
                        </View>
                        <View style={[styles.track, styles.trackThick]}>
                          <View style={[styles.trackFill, { width: `${pct}%`, backgroundColor: fill }]} />
                        </View>
                        <AppText capScale style={[styles.typeValue, styles.tabular]} tone="sub" variant="secondary">
                          <AppText capScale variant="secondary" style={styles.heavy}>
                            {count}그릇
                          </AppText>
                          {` · ${pct}%`}
                        </AppText>
                      </View>
                    )
                  })}
                </View>
              </View>

              {topShops.length > 0 ? (
                <View style={styles.section}>
                  <AppText accessibilityRole="header" variant="sectionTitle">
                    자주 간 라멘집
                  </AppText>
                  <AppText style={styles.gapTop1} tone="sub" variant="secondary">
                    전체 {typeTotal}그릇 중 가장 많이 기록한 세 곳이에요.
                  </AppText>
                  <View style={styles.gapTop2}>
                    {topShops.map((visit, index) => {
                      const shop = shopByName(visit.name)
                      return (
                        <Pressable
                          accessibilityLabel={`${index + 1}위 ${visit.name}${visit.branch ? ` ${visit.branch}` : ""}, ${visit.topMenu}, ${visit.visitCount}그릇`}
                          accessibilityRole={shop ? "button" : "text"}
                          disabled={!shop}
                          key={visit.name}
                          onPress={() => openShop(shop)}
                          style={({ pressed }) => [styles.listRow, index > 0 && styles.rowDivider, pressed && styles.pressedWash]}
                        >
                          {/* 순위는 사진 위에 얹지 않고 줄 맨 앞에 둔다. 노랑은 1위 하나뿐이고 2·3위는 굵은 먹색 숫자다(홈 추천 순위와 같은 규칙) */}
                          {index === 0 ? (
                            <Sticker label="1" style={styles.rankBadge} />
                          ) : (
                            <AppText capScale style={styles.rankNumber} variant="cardTitle">
                              {index + 1}
                            </AppText>
                          )}
                          <View style={styles.thumb}>
                            {visit.photo ? (
                              <Image contentFit="cover" source={{ uri: visit.photo }} style={styles.thumbImage} transition={150} />
                            ) : (
                              <AppText tone="sub" variant="cardTitle">
                                {visit.name.slice(0, 1)}
                              </AppText>
                            )}
                          </View>
                          <View style={styles.flex}>
                            <AppText numberOfLines={1} variant="cardTitle">
                              {visit.name}
                              {visit.branch ? <AppText tone="sub" variant="secondary">{` ${visit.branch}`}</AppText> : null}
                            </AppText>
                            <AppText numberOfLines={1} tone="sub" variant="secondary">
                              {visit.topMenu} · 마지막 {visit.lastVisited.slice(5).replace("-", ".")}
                            </AppText>
                          </View>
                          <AppText style={styles.tabular} variant="bodyStrong">
                            {visit.visitCount}그릇
                          </AppText>
                        </Pressable>
                      )
                    })}
                  </View>
                </View>
              ) : null}

              {suggestion ? (
                <View style={styles.section}>
                  <AppText accessibilityRole="header" variant="sectionTitle">
                    다음에 맛볼 한 그릇
                  </AppText>
                  <AppText style={styles.gapTop1} tone="sub" variant="secondary">
                    {suggestion.count === 0
                      ? `${suggestion.category}는 아직 기록이 없어요.`
                      : `${suggestion.category}는 ${suggestion.count}그릇으로 가장 적었어요.`}{" "}
                    이 종류로 폭을 넓혀보세요.
                  </AppText>
                  <Pressable
                    accessibilityLabel={`${suggestion.shop.name}${suggestion.shop.branch ? ` ${suggestion.shop.branch}` : ""} 매장 보기`}
                    accessibilityRole="button"
                    onPress={() => openShop(suggestion.shop)}
                    style={({ pressed }) => [styles.listRow, styles.gapTop1, pressed && styles.pressedWash]}
                  >
                    <View style={styles.thumb}>
                      {suggestion.shop.photos[0] ? (
                        <Image contentFit="cover" source={{ uri: suggestion.shop.photos[0] }} style={styles.thumbImage} transition={150} />
                      ) : null}
                    </View>
                    <View style={styles.flex}>
                      <AppText numberOfLines={1} variant="cardTitle">
                        {suggestion.shop.name}
                        {suggestion.shop.branch ? (
                          <AppText tone="sub" variant="secondary">{` ${suggestion.shop.branch}`}</AppText>
                        ) : null}
                      </AppText>
                      <AppText numberOfLines={1} tone="sub" variant="secondary">
                        {[shopStyleOf(suggestion.shop), shopSpecOf(suggestion.shop)].filter(Boolean).join(" · ")}
                      </AppText>
                    </View>
                  </Pressable>
                </View>
              ) : null}

              <View style={[styles.block, styles.bottom]}>
                <Button
                  leftIcon={<RotateCw color={colors.onDark} size={16} />}
                  onPress={restart}
                  title="최근 기록으로 다시 정리"
                  variant="secondary"
                />
                <AppText style={[styles.center, styles.gapTop2]} tone="sub" variant="secondary">
                  새 기록을 남기면 이 화면의 수치는 이미 더해져 있어요. 다시 정리하면 처음부터 다시 훑어봐요.
                </AppText>
              </View>
            </>
          )}
        </ScrollView>
      )}

      <Toast message={toast ?? ""} onDismiss={() => setToast(null)} visible={Boolean(toast)} />

      <BottomSheet
        description="아래 내용을 길게 눌러 복사해 주세요."
        footer={<Button onPress={() => setShareFallback(false)} title="닫기" variant="secondary" />}
        onClose={() => setShareFallback(false)}
        title="공유하지 못했어요"
        visible={shareFallback}
      >
        <ScrollView contentContainerStyle={styles.fallbackContent} style={[styles.fallbackBox, { maxHeight: windowHeight * 0.34 }]}>
          <AppText selectable variant="secondary">
            {shareText}
          </AppText>
        </ScrollView>
        <AppText capScale style={styles.gapTop2} tone="muted" variant="meta">
          {currentUser?.nickname ?? "라오타 회원"} · Lv.{level.number} {level.title}
        </AppText>
      </BottomSheet>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  noFlex: { flex: 0 },
  center: { textAlign: "center" },
  heavy: { fontWeight: "800", color: colors.ink },
  inkText: { color: colors.ink },
  subText: { color: colors.inkSub, fontWeight: "500" },
  tabular: { fontVariant: ["tabular-nums"] },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.x2 },
  gapTop1: { marginTop: spacing.x1 },
  gapTop2: { marginTop: spacing.x2 },
  gapTop3: { marginTop: spacing.x3 },
  gapTop5: { marginTop: spacing.x5 },
  pressedWash: { backgroundColor: colors.canvasSoft },
  scroll: { paddingBottom: spacing.x8 },
  top: { paddingHorizontal: spacing.gutter, paddingTop: spacing.x4, paddingBottom: spacing.x1 },
  // 정보 묶음은 미색 바탕 위의 흰 카드다. 카드 안쪽 줄만 1pt border으로 나눈다
  section: {
    marginHorizontal: spacing.gutter,
    marginTop: spacing.x4,
    padding: spacing.x4,
    backgroundColor: colors.canvas,
    borderColor: colors.outline,
    borderRadius: radii.sm,
    borderWidth: line.base,
  },
  /** 카드로 묶지 않는 영역(빈 상태, 하단 보조 행동) */
  block: { paddingHorizontal: spacing.gutter, paddingVertical: spacing.x5 },
  emptySection: { paddingVertical: spacing.x10, alignItems: "stretch" },
  bottom: { paddingBottom: spacing.x8 },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.x2,
    backgroundColor: colors.canvas,
    borderColor: colors.outline,
    borderWidth: line.base,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.x3,
    paddingVertical: spacing.x2_5,
    marginBottom: spacing.x4,
  },
  card: {
    backgroundColor: colors.canvas,
    borderColor: colors.outline,
    borderRadius: radii.sm,
    borderWidth: line.base,
    padding: spacing.x4,
  },
  coverHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.x3,
    paddingBottom: spacing.x3,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  coverHeadLabels: { flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.x2 },
  coverLogo: { width: 32, height: 32 },
  coverBody: { paddingTop: spacing.x4 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x1_5, marginTop: spacing.x3 },
  coverAxes: {
    flexDirection: "row",
    gap: spacing.x4,
    marginTop: spacing.x4,
    paddingTop: spacing.x3,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  // 위치를 말하는 한 마디와 평균 점수가 한 줄에 선다
  coverAxisValue: { flexDirection: "row", alignItems: "baseline", gap: spacing.x1, marginTop: spacing.x1 },
  coverActions: { marginTop: spacing.x4, gap: spacing.x1 },
  radarWrap: { alignItems: "center", paddingVertical: spacing.x2 },
  axisList: { borderTopColor: colors.border, borderTopWidth: 1 },
  // 카드 안에서도 막대가 충분히 보이도록 고정 칸과 사이 간격을 조금 줄였다
  axisRow: { flexDirection: "row", alignItems: "center", gap: spacing.x2_5, paddingVertical: spacing.x2_5 },
  rowDivider: { borderTopColor: colors.border, borderTopWidth: 1 },
  axisLabel: { width: 80 },
  axisScore: { width: 30, textAlign: "right" },
  axisLean: { width: 64, textAlign: "right" },
  track: { flex: 1, height: 6, borderRadius: radii.pill, backgroundColor: colors.canvasSoft, overflow: "hidden" },
  // 차오르지 않는 축의 표시. 선 위에서 위치만 짚는다
  trackMark: { position: "absolute", top: 0, bottom: 0, width: 14, marginLeft: -7, borderRadius: radii.pill, backgroundColor: colors.ink },
  // 흰 면 + 1.5pt 먹선으로 두른 칸. 월별 취향 변화(아카이브)의 막대와 같은 모양이다
  trackThick: { height: 12, backgroundColor: colors.canvas, borderWidth: line.thin, borderColor: colors.outline },
  // 막대는 수량을 말하므로 빨강이 아니라 먹색이다. 빨강은 누르는 곳과 선택된 것에만 남긴다
  trackFill: { height: "100%", borderRadius: radii.pill, backgroundColor: colors.ink },
  typeList: { marginTop: spacing.x4, gap: spacing.x3 },
  typeRow: { flexDirection: "row", alignItems: "center", gap: spacing.x3 },
  typeName: { width: 60 },
  typeValue: { width: 92, textAlign: "right" },
  listRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x3,
    paddingVertical: spacing.x3,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.canvasSoft,
    borderColor: colors.outline,
    borderWidth: line.base,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbImage: { width: "100%", height: "100%" },
  // 1·2·3의 글자 폭이 달라도 썸네일 줄이 맞도록 최소 폭을 준다
  rankBadge: { alignSelf: "center", minWidth: 28, justifyContent: "center" },
  // 2·3위 숫자. 1위 스티커와 같은 28pt 칸이라 썸네일이 한 줄로 선다
  rankNumber: { width: 28, textAlign: "center", fontVariant: ["tabular-nums"] },
  fallbackBox: {
    backgroundColor: colors.canvas,
    borderColor: colors.outline,
    borderWidth: line.base,
    borderRadius: radii.sm,
  },
  fallbackContent: { padding: spacing.x3 },
  loadingBody: { flexGrow: 1, justifyContent: "center", paddingHorizontal: spacing.x6, paddingVertical: spacing.x4 },
  loadingRadar: { width: LOADING_SIZE, height: LOADING_SIZE, alignSelf: "center", marginVertical: spacing.x6 },
  // 다 정리한 순간에만 붙는 노랑 스티커. 오각형 아래 빈자리에 놓는다
  // 아래 두 축의 점수 아래에 걸쳐 놓는다. 점수 줄이 생기면서 판 안쪽으로는 자리가 없다
  loadingSticker: { position: "absolute", left: 0, right: 0, bottom: -spacing.x2, alignItems: "center" },
  // 지금 보고 있는 축을 짚는 노랑 블록. 스티커와 같은 1.5pt 먹선 + 6pt 모서리
  axisMark: {
    position: "absolute",
    width: AXIS_MARK,
    height: AXIS_MARK,
    borderRadius: radii.xs,
    borderWidth: line.thin,
    borderColor: colors.outline,
    backgroundColor: colors.yolk,
  },
  // Sticker는 기본이 flex-start라 가운데로 놓으려면 직접 덮어써야 한다
  centerSelf: { alignSelf: "center" },
  loadingStatus: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.x2, minHeight: 24 },
  dot: { width: 4, height: 4, borderRadius: radii.pill, backgroundColor: colors.brand },
  loadingFooter: { alignItems: "center", paddingHorizontal: spacing.x6, paddingBottom: spacing.x4, paddingTop: spacing.x2 },
})
