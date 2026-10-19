import { useEffect, useMemo, useRef, useState } from "react"
import { router, useLocalSearchParams } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { Image } from "expo-image"
import { ArrowRight, RotateCw, Share2 } from "lucide-react-native"
import { AccessibilityInfo, Platform, Pressable, ScrollView, Share, StyleSheet, View, findNodeHandle, useWindowDimensions } from "react-native"
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from "react-native-reanimated"
import { SafeAreaView } from "react-native-safe-area-context"
import Svg, { ClipPath, Defs, Ellipse, Path, Rect } from "react-native-svg"

import {
  MENU_CATEGORY_NAMES,
  menuCategoryOf,
  metricsFromProfile,
  seoulToday,
  typeCountsOf,
  type DemoBowl,
  type MenuCategoryName,
  type MetricItem,
  type Shop,
  type TasteIdentity,
  type TasteProfile,
} from "@raota/shared"
import { track } from "@/src/analytics"
import { AppText, BottomSheet, Button, Header, IconButton, LoadingState, SoupDot, Toast } from "@/src/components/ui"
import {
  useActivityLevel,
  useBowlCount,
  useMyBowls,
  useShops,
  useTasteIdentity,
  useTasteProfile,
  useVisitedShops,
} from "@/src/data"
import { useRaota } from "@/src/state/RaotaStore"
import { colors, line, radii, soupColorOf, spacing, tasteAxis, typography } from "@/src/theme"

/* 취향 종합 리포트: 감정서 → 종류별 분포 → 자주 간 라멘집 → 다음 한 그릇. */

/**
 * 그릇 채우기 연출의 박자(ms). 사용자가 "그릇이 차오른다 → 종류끼리 모인다 → 결과"를
 * 하나씩 따라 읽을 수 있을 만큼 천천히 둔다. 결과는 도장이 찍힌 뒤 RESULT_HOLD만큼 보여 주고 넘어간다.
 */
const FILL_START = 200
const FILL_STEP = 50
const FILL_DURATION = 400
const SORT_AT = 2800
const SORT_DURATION = 900
const LEGEND_AT = 3700
const LOADING_DURATION = 4000
const RESULT_HOLD = 1200

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
// 종합 리포트의 결론. 표시하는 두 축은 TASTE_AXES의 육수 → 면 순서를 따른다.
// ---------------------------------------------------------------------------

function TasteReportCover({ recordCount, identity, profile, updatedLabel }: {
  recordCount: number
  identity: TasteIdentity
  profile: TasteProfile
  updatedLabel: string
}) {
  const metrics = metricsFromProfile(profile).filter(isSpectrumMetric)
  return (
    <View style={styles.card}>
      <View style={styles.coverHead}>
        <AppText capScale style={styles.coverBadge} variant="meta">종합 리포트</AppText>
        <AppText capScale numberOfLines={2} style={[styles.tabular, styles.coverDate]} tone="muted" variant="meta">{updatedLabel}</AppText>
      </View>
      <AppText accessibilityRole="header" style={styles.coverTitle} variant="headline">{identity.title}</AppText>
      <AppText lineBreakStrategyIOS="hangul-word" style={styles.gapTop1} tone="sub" variant="secondary">
        {identity.leader ? `누적 ${identity.total}그릇 중 ${identity.leader.name} ${identity.leader.count}그릇` : identity.description}
      </AppText>
      {identity.tags.length > 0 ? (
        <View accessibilityLabel={`취향 특징: ${identity.tags.join(", ")}`} accessible style={styles.tagRow}>
          {identity.tags.map((tag) => (
            <AppText key={tag} style={styles.coverTag} variant="secondary">#{tag}</AppText>
          ))}
        </View>
      ) : null}
      {recordCount > 0 ? (
        <View
          accessibilityLabel={`맛 지문. ${metrics.map((metric) => `${metric.label} ${spectrumWordOf(metric.key, metric.score)} ${metric.score.toFixed(1)}`).join(", ")}`}
          accessibilityRole="text"
          accessible
          style={styles.coverFingerprint}
        >
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {metrics.map((metric) => (
              <View key={metric.key} style={styles.fingerprintRow}>
                <AppText style={styles.fingerprintLabel} variant="secondary">{metric.label}</AppText>
                <View style={styles.fingerprintTrack}>
                  <View style={[styles.fingerprintKnob, {
                    left: `${(Math.max(1, Math.min(5, metric.score)) - 1) * 25}%`,
                    backgroundColor: tasteAxis[metric.key],
                  }]} />
                </View>
                <AppText capScale lineBreakStrategyIOS="hangul-word" numberOfLines={2} style={styles.fingerprintValue} tone="muted" variant="meta">
                  {spectrumWordOf(metric.key, metric.score)} <AppText style={styles.heavy} variant="meta">{metric.score.toFixed(1)}</AppText>
                </AppText>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  )
}

// ---------------------------------------------------------------------------
// 정리 연출 (웹 TasteReportLoading)
// ---------------------------------------------------------------------------

/** VoiceOver 포커스를 특정 View로 옮긴다. 실패해도 흐름을 막지 않는다 */
function focusOn(ref: React.RefObject<View | null>) {
  if (Platform.OS === "web" || !ref.current) return
  try {
    const node = findNodeHandle(ref.current)
    if (node) AccessibilityInfo.setAccessibilityFocus(node)
  } catch {
    // 포커스 이동 실패가 흐름을 막지 않는다
  }
}

const STATUS_MESSAGES = [
  "라멘 기록을 모으고 있어요",
  "그릇마다 국물을 채우고 있어요",
  "종류별로 모으고 있어요",
  "나의 라멘 취향이 정리됐어요",
]
const MAX_LOADING_BOWLS = 42
const BOWL_COLUMNS = 7
const BOWL_ROW_HEIGHT = 34
const BOWL_PATH = "M3 9H33C33 18.5 26.3 26 18 26C9.7 26 3 18.5 3 9Z"
const AnimatedRect = Animated.createAnimatedComponent(Rect)
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse)

type LoadingBowl = { type: string; order: number; sorted: number }
type BowlLegend = { type: string; count: number; icons: number; first: number }

/**
 * 화면에는 최대 42개만 그리되, 그 이상일 때는 최대 잔여 방식으로 종류별 몫을 배분한다.
 * 배분된 종류 안에서는 날짜순 원장에서 골고루 뽑아 채우는 순서를 그대로 지킨다.
 */
function loadingBowlsOf(bowls: DemoBowl[]) {
  const records = [...bowls].reverse() // useMyBowls는 최신순; 이 연출은 오래 먹은 그릇부터 채운다
  const counts = new Map<string, BowlLegend>()
  records.forEach((bowl, index) => {
    const type = menuCategoryOf(bowl.type)
    const entry = counts.get(type)
    if (entry) entry.count += 1
    else counts.set(type, { type, count: 1, icons: 0, first: index })
  })
  const legend = [...counts.values()].sort((a, b) => b.count - a.count || a.first - b.first)
  const limit = Math.min(MAX_LOADING_BOWLS, records.length)
  let allocated = 0
  for (const item of legend) {
    item.icons = Math.floor((item.count * limit) / records.length)
    allocated += item.icons
  }
  // 몫이 같은 종류는 실제 그릇 수, 원장 첫 등장 순으로 결정한다
  const byRemainder = [...legend].sort(
    (a, b) =>
      ((b.count * limit) % records.length) - ((a.count * limit) % records.length) ||
      b.count - a.count ||
      a.first - b.first,
  )
  for (let index = 0; index < limit - allocated; index += 1) byRemainder[index].icons += 1

  const starts = new Map<string, number>()
  let slot = 0
  for (const item of legend) {
    starts.set(item.type, slot)
    slot += item.icons
  }
  const seen = new Map<string, number>()
  const placed = new Map<string, number>()
  const icons: LoadingBowl[] = []
  for (const bowl of records) {
    const type = menuCategoryOf(bowl.type)
    const item = counts.get(type)!
    const nth = seen.get(type) ?? 0
    seen.set(type, nth + 1)
    // 시간순 표본에서 고르게 뽑아, 42칸일 때도 한 종류가 통째로 사라지지 않게 한다
    if (Math.floor(((nth + 1) * item.icons) / item.count) === Math.floor((nth * item.icons) / item.count)) continue
    const rank = placed.get(type) ?? 0
    placed.set(type, rank + 1)
    icons.push({ type, order: icons.length, sorted: starts.get(type)! + rank })
  }
  return { icons, legend }
}

function LoadingBowlIcon({
  bowl,
  columnWidth,
  reducedMotion,
  sorted,
}: {
  bowl: LoadingBowl
  columnWidth: number
  reducedMotion: boolean
  sorted: SharedValue<number>
}) {
  const fill = useSharedValue(reducedMotion ? 1 : 0)
  useEffect(() => {
    fill.value = reducedMotion
      ? 1
      : withDelay(FILL_START + bowl.order * FILL_STEP, withTiming(1, { duration: FILL_DURATION, easing: Easing.out(Easing.quad) }))
  }, [bowl.order, fill, reducedMotion])
  const soupProps = useAnimatedProps(() => ({ y: 26 - 17 * fill.value, height: 17 * fill.value }))
  const surfaceProps = useAnimatedProps(() => ({ ry: 3.5 * fill.value, opacity: fill.value }))
  const moveStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: ((bowl.sorted % BOWL_COLUMNS) - (bowl.order % BOWL_COLUMNS)) * columnWidth * sorted.value },
      {
        translateY:
          (Math.floor(bowl.sorted / BOWL_COLUMNS) - Math.floor(bowl.order / BOWL_COLUMNS)) *
          BOWL_ROW_HEIGHT *
          sorted.value,
      },
    ],
  }))
  return (
    <Animated.View
      style={[
        styles.bowlSlot,
        { left: (bowl.order % BOWL_COLUMNS) * columnWidth, top: Math.floor(bowl.order / BOWL_COLUMNS) * BOWL_ROW_HEIGHT + 3, width: columnWidth },
        moveStyle,
      ]}
      testID={`report-bowl-${bowl.order}`}
    >
      <Svg height={30} viewBox="0 0 36 29" width={38}>
        <Defs>
          <ClipPath id={`report-bowl-clip-${bowl.order}`}>
            <Path d={BOWL_PATH} />
          </ClipPath>
        </Defs>
        <Path d={BOWL_PATH} fill={colors.canvas} />
        <AnimatedRect
          animatedProps={soupProps}
          clipPath={`url(#report-bowl-clip-${bowl.order})`}
          fill={soupColorOf(bowl.type)}
          height={reducedMotion ? 17 : 0}
          width={36}
          x={0}
          y={reducedMotion ? 9 : 26}
        />
        <AnimatedEllipse
          animatedProps={surfaceProps}
          cx={18}
          cy={9}
          fill={soupColorOf(bowl.type)}
          opacity={reducedMotion ? 1 : 0}
          rx={14}
          ry={reducedMotion ? 3.5 : 0}
          stroke={colors.soupEdge}
          strokeWidth={line.base}
          testID={`report-bowl-soup-${bowl.order}`}
        />
        <Path d={BOWL_PATH} fill="none" stroke={colors.soupEdge} strokeLinejoin="round" strokeWidth={line.base} />
        <Path d="M12 27.5h12" fill="none" stroke={colors.soupEdge} strokeLinecap="round" strokeWidth={line.base} />
      </Svg>
    </Animated.View>
  )
}

function TasteReportLoading({
  bowls,
  identity,
  membershipNo,
  onBack,
  onComplete,
}: {
  bowls: DemoBowl[]
  identity: TasteIdentity
  membershipNo: string
  onBack: () => void
  onComplete: () => void
}) {
  const reducedMotion = useReducedMotion()
  const { width } = useWindowDimensions()
  const { icons, legend } = useMemo(() => loadingBowlsOf(bowls), [bowls])
  const [columnWidth, setColumnWidth] = useState(Math.min(302, Math.max(0, width - spacing.x4 * 4 - line.base * 2)) / BOWL_COLUMNS)
  const [stage, setStage] = useState(reducedMotion ? 3 : 0)
  const [showLegend, setShowLegend] = useState(reducedMotion)
  const complete = stage === 3
  const titleRef = useRef<View>(null)
  const loadingScrollRef = useRef<ScrollView>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const sorted = useSharedValue(reducedMotion ? 1 : 0)
  const reveal = useSharedValue(reducedMotion ? 1 : 0)
  const resultReveal = useSharedValue(reducedMotion ? 1 : 0)

  useEffect(() => {
    if (reducedMotion) {
      sorted.value = 1
      reveal.value = 1
      resultReveal.value = 1
      setStage(3)
      setShowLegend(true)
      const focus = setTimeout(() => focusOn(titleRef), 250)
      // 움직임이 없으니 완성된 감정서를 읽을 시간만 준다(연출 길이만큼 기다리게 하지 않는다)
      const timer = setTimeout(() => onCompleteRef.current(), RESULT_HOLD + 1000)
      return () => {
        clearTimeout(focus)
        clearTimeout(timer)
      }
    }
    sorted.value = withDelay(SORT_AT, withTiming(1, { duration: SORT_DURATION, easing: Easing.inOut(Easing.cubic) }))
    reveal.value = withDelay(LEGEND_AT, withTiming(1, { duration: 240, easing: Easing.out(Easing.quad) }))
    resultReveal.value = withDelay(LOADING_DURATION, withTiming(1, { duration: 260, easing: Easing.out(Easing.quad) }))
    const timers = [
      setTimeout(() => setStage(1), 900),
      setTimeout(() => setStage(2), SORT_AT),
      setTimeout(() => setShowLegend(true), LEGEND_AT),
      setTimeout(() => setStage(3), LOADING_DURATION),
      setTimeout(() => onCompleteRef.current(), LOADING_DURATION + RESULT_HOLD),
    ]
    // 포커스를 제목으로 옮기지 않으면 VoiceOver가 이전 화면에 머문 채 리포트로 교체된다
    const focus = setTimeout(() => focusOn(titleRef), 250)
    return () => {
      timers.forEach(clearTimeout)
      clearTimeout(focus)
    }
    // 시간표는 한 번만 시작한다. 실제 shared value는 안정적이며 단계 렌더 때 타이머를 다시 잡지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion])

  /**
   * iOS에는 accessibilityLiveRegion이 없다(안드로이드 전용 prop이라 무시된다).
   * 단계가 바뀔 때마다 직접 읽어 준다. 첫 문구는 제목 포커스와 겹치므로 건너뛴다.
   */
  useEffect(() => {
    if (stage === 0) return
    // 움직임을 줄일 때는 이미 완성된 감정서를 읽는다. 제목 포커스가 먼저 간 뒤 최종 상태를 알린다
    if (reducedMotion && stage === 3) {
      const timer = setTimeout(() => AccessibilityInfo.announceForAccessibility(STATUS_MESSAGES[stage]), 400)
      return () => clearTimeout(timer)
    }
    AccessibilityInfo.announceForAccessibility(STATUS_MESSAGES[stage])
  }, [reducedMotion, stage])
  // The result now owns its space before it appears, so content size does not change at completion.
  useEffect(() => {
    if (!complete) return
    const frame = requestAnimationFrame(() => loadingScrollRef.current?.scrollToEnd({ animated: false }))
    return () => cancelAnimationFrame(frame)
  }, [complete])


  const legendStyle = useAnimatedStyle(() => ({ opacity: reveal.value, transform: [{ translateY: 4 * (1 - reveal.value) }] }))
  const resultStyle = useAnimatedStyle(() => ({ opacity: resultReveal.value }))
  const count = bowls.length
  const sampleRatio = count > MAX_LOADING_BOWLS
    ? (count / MAX_LOADING_BOWLS).toFixed(2).replace(/0+$/, "").replace(/\.$/, "")
    : null

  return (
    <SafeAreaView edges={["top", "left", "right", "bottom"]} style={styles.root}>
      <StatusBar style="auto" />
      <Header align="center" onBack={onBack} title="종합 취향 리포트" titleStyle={typography.sectionTitle} />
      <ScrollView
        contentContainerStyle={styles.loadingBody}
        onContentSizeChange={() => {
          // 낮은 화면에서도 마지막 감정 결과가 다음 화면으로 넘어가기 전에 보이게 한다
          if (complete) loadingScrollRef.current?.scrollToEnd({ animated: false })
        }}
        ref={loadingScrollRef}
        showsVerticalScrollIndicator={false}
      >
        <View accessible accessibilityRole="header" ref={titleRef}>
          <AppText style={styles.center} variant="headline">
            {"나의 라멘 취향을\n정리하고 있어요"}
          </AppText>
        </View>
        <AppText style={[styles.center, styles.gapTop2]} tone="sub" variant="secondary">
          기록한 {count}그릇을 바탕으로 분석해요
        </AppText>
        <View style={styles.loadingSheet}>
          <View style={styles.loadingSheetHead}>
            <AppText variant="cardTitle">라멘 취향 감정서</AppText>
            <AppText capScale style={styles.loadingSheetNumber} tone="muted" variant="meta">
              No. {membershipNo.replace(/^#/, "")}
            </AppText>
          </View>
          <View
            accessible
            accessibilityLabel={
              complete
                ? `${count}그릇을 종류별로 모았어요. ${legend.map((item) => `${item.type} ${item.count}그릇`).join(", ")}`
                : `기록 순서대로 ${icons.length}개 그릇의 국물을 채우고 있어요`
            }
            accessibilityRole="image"
            onLayout={(event) => setColumnWidth(event.nativeEvent.layout.width / BOWL_COLUMNS)}
            style={[styles.bowlGrid, { height: Math.max(1, Math.ceil(icons.length / BOWL_COLUMNS)) * BOWL_ROW_HEIGHT + spacing.x2 }]}
            testID="report-bowl-grid"
          >
            {icons.map((bowl) => (
              <LoadingBowlIcon bowl={bowl} columnWidth={columnWidth} key={bowl.order} reducedMotion={reducedMotion} sorted={sorted} />
            ))}
          </View>
          <View style={styles.loadingLegendSlot}>
            {showLegend ? (
              <Animated.View style={[styles.loadingLegend, legendStyle]} testID="report-bowl-legend">
                {legend.map((item) => (
                  <View accessibilityLabel={`${item.type} ${item.count}그릇`} accessible key={item.type} style={styles.loadingLegendItem}>
                    <View style={styles.loadingLegendName}>
                      <SoupDot type={item.type} size={10} />
                      <AppText capScale variant="meta">{item.type}</AppText>
                    </View>
                    <AppText capScale style={styles.loadingLegendCount} variant="sectionTitle">{item.count}</AppText>
                  </View>
                ))}
              </Animated.View>
            ) : null}
          </View>
          {sampleRatio ? (
            <AppText accessibilityElementsHidden={!showLegend} capScale style={[styles.loadingScaleNote, !showLegend && styles.invisible]} tone="muted" variant="meta">
              그릇 1개 ≈ {sampleRatio}그릇 · 전체 {count}그릇
            </AppText>
          ) : null}
          <View style={styles.loadingResultSlot}>
            {complete ? (
              <Animated.View style={[styles.loadingResult, resultStyle]} testID="report-bowl-result">
                <AppText variant="screenTitle">{identity.title}</AppText>
                <AppText tone="sub" variant="secondary">
                  {count}그릇 중 {legend[0].type} {legend[0].count}그릇
                </AppText>
              </Animated.View>
            ) : null}
          </View>
        </View>
        <View accessibilityLiveRegion="polite" accessibilityRole="text" style={styles.loadingStatus}>
          <View style={[styles.dot, complete && styles.dotComplete]} />
          <AppText style={styles.loadingStatusText} tone="sub" variant="secondary">
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
          title="리포트 바로 보기"
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
  const { height: windowHeight } = useWindowDimensions()
  const { currentUser } = useRaota()
  const { data: recordCount, isLoading } = useBowlCount()
  const { data: taste } = useTasteProfile()
  const { data: identity } = useTasteIdentity()
  const { data: bowls } = useMyBowls()
  const { data: visits } = useVisitedShops()
  const { data: shops } = useShops()
  const { data: level } = useActivityLevel()

  const profile = taste.profile
  const metrics = useMemo(() => metricsFromProfile(profile), [profile])
  const typeCounts = useMemo(() => typeCountsOf(bowls), [bowls])
  const typeTotal = MENU_CATEGORY_NAMES.reduce((sum, name) => sum + typeCounts[name], 0)
  const topShops = visits.slice(0, 3)

  const [generating, setGenerating] = useState(analyze === "1" && recordCount > 0)
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

  // 저장소를 읽기 전 기본 데모 원장 대신 실제 사용자 그릇을 확인하고 연출을 시작한다
  useEffect(() => {
    if (!isLoading && generating && bowls.length === 0) setGenerating(false)
  }, [bowls.length, generating, isLoading])

  const shopByName = (name: string) => shops.find((shop) => shop.name === name)

  // 다음 한 그릇: 가장 적게 먹은 종류(기타 제외)를 파는 원장 매장. 안 가 본 곳을 먼저 고른다
  const suggestion = useMemo(() => {
    if (typeTotal === 0) return null
    const ranked = MENU_CATEGORY_NAMES.filter((name) => name !== "기타").sort((a, b) => typeCounts[a] - typeCounts[b])
    for (const category of ranked) {
      const candidates = shops.filter((shop) => categoryOfStyle(shopStyleOf(shop)) === category)
      if (!candidates.length) continue
      const unvisited = candidates.find((shop) => !visits.some((visit) => visit.name === shop.name))
      const primary = unvisited ?? candidates[0]
      return { category, count: typeCounts[category], shop: primary }
    }
    return null
  }, [shops, typeCounts, typeTotal, visits])
  const suggestedReview = suggestion?.shop.reviews.find((review) => review.text.trim().length > 0)

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/native/my"))

  const finishGeneration = () => {
    setGenerating(false)
    setGeneratedAt(seoulTime())
    setToast(`전체 ${recordCount}그릇으로 취향을 다시 정리했어요`)
    scrollRef.current?.scrollTo({ y: 0, animated: false })
  }

  const restart = () => {
    setToast(null)
    setGenerating(true)
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

  if (generating && !isLoading && bowls.length > 0) {
    return <TasteReportLoading bowls={bowls} identity={identity} membershipNo={currentUser?.membershipNo ?? "RT"} onBack={goBack} onComplete={finishGeneration} />
  }

  return (
    <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.root}>
      <StatusBar style="auto" />
      <Header
        align="center"
        onBack={goBack}
        right={
          recordCount > 0 ? (
            <IconButton
              accessibilityLabel="취향 리포트 공유"
              icon={<Share2 color={colors.ink} size={20} />}
              onPress={handleShare}
            />
          ) : undefined
        }
        title="취향 종합 리포트"
        titleStyle={typography.sectionTitle}
      />
      {isLoading ? (
        <LoadingState fullScreen label="취향을 불러오는 중…" />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} ref={scrollRef} showsVerticalScrollIndicator={false}>
          <View style={styles.top}>
            <TasteReportCover
              identity={identity}
              profile={profile}
              recordCount={recordCount}
              updatedLabel={generatedAt ? `${seoulToday().replace(/-/g, ".")} ${generatedAt}에 다시 정리함` : `${seoulToday().replace(/-/g, ".")} 기준`}
            />
          </View>

          {recordCount === 0 ? (
            <View style={[styles.block, styles.emptySection]}>
              <AppText accessibilityRole="header" style={styles.center} variant="screenTitle">
                아직 보여드릴 취향이 없어요
              </AppText>
              <AppText lineBreakStrategyIOS="hangul-word" style={[styles.center, styles.sectionContent]} tone="sub" variant="body">
                {"첫 그릇을 기록하면\n취향과 종류별 분포가 여기에 쌓여요."}
              </AppText>
              <Button
                onPress={() => router.push({ pathname: "/record/select-shop", params: { mode: "nearby" } })}
                style={styles.gapTop3}
                title="첫 그릇 기록하기"
              />
            </View>
          ) : (
            <>
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
                    return (
                      <View accessibilityLabel={`${name} ${count}그릇, ${pct}%`} accessible key={name} style={styles.typeRow}>
                        <View style={styles.typeName}>
                          <AppText capScale variant="bodyStrong">{name}</AppText>
                        </View>
                        <View style={styles.track}>
                          <View style={[styles.trackFill, { width: `${pct}%`, backgroundColor: soupColorOf(name) }]} />
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
                  <View style={styles.rowBetween}>
                    <AppText accessibilityRole="header" variant="sectionTitle">자주 간 라멘집</AppText>
                    <AppText capScale tone="muted" variant="meta">가장 많이 기록한 세 곳</AppText>
                  </View>
                  <View style={styles.sectionContent}>
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
                          <AppText capScale style={[styles.rankNumber, index === 0 && styles.rankSelected]} variant="meta">
                            {index + 1}
                          </AppText>
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
                            <AppText lineBreakStrategyIOS="hangul-word" numberOfLines={2} variant="cardTitle">
                              {visit.name}
                              {visit.branch ? <AppText tone="sub" variant="secondary">{` ${visit.branch}`}</AppText> : null}
                            </AppText>
                            <AppText lineBreakStrategyIOS="hangul-word" numberOfLines={2} style={styles.gapTop1} tone="sub" variant="secondary">
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
                  <AppText lineBreakStrategyIOS="hangul-word" style={styles.gapTop1} tone="sub" variant="secondary">
                    {suggestion.count === 0
                      ? `${suggestion.category}는 아직 기록이 없어요.`
                      : `${suggestion.category}는 ${suggestion.count}그릇으로 가장 적었어요.`}{" "}
                    이 종류로 폭을 넓혀보세요.
                  </AppText>
                  <View style={styles.pinRow}>
                    <Pressable
                      accessibilityLabel={`${suggestion.shop.name}${suggestion.shop.branch ? ` ${suggestion.shop.branch}` : ""} 매장 보기`}
                      accessibilityRole="button"
                      onPress={() => openShop(suggestion.shop)}
                      style={({ pressed }) => [styles.pin, pressed && styles.pinPressed]}
                    >
                      <View style={[styles.pinImage, styles.pinTall]}>
                        {suggestion.shop.photos[0] ? (
                          <Image contentFit="cover" source={{ uri: suggestion.shop.photos[0] }} style={styles.thumbImage} transition={150} />
                        ) : (
                          <AppText style={styles.pinFallback} variant="cardTitle">{suggestion.shop.name.slice(0, 1)}</AppText>
                        )}
                        <View style={styles.pinType}>
                          <AppText capScale style={styles.pinOnImageText} variant="meta">{suggestion.category}</AppText>
                        </View>
                      </View>
                      <AppText numberOfLines={2} style={styles.pinTitle} variant="cardTitle">
                        {suggestion.shop.name}{suggestion.shop.branch ? ` ${suggestion.shop.branch}` : ""}
                      </AppText>
                      <AppText numberOfLines={2} style={styles.pinMeta} tone="muted" variant="secondary">
                        {[shopStyleOf(suggestion.shop), shopSpecOf(suggestion.shop)].filter(Boolean).join(" · ")}
                      </AppText>
                    </Pressable>
                    {suggestedReview ? (
                      <Pressable
                        accessibilityLabel={`${suggestedReview.author}의 ${suggestion.shop.name} 후기, 매장 보기`}
                        accessibilityRole="button"
                        onPress={() => openShop(suggestion.shop)}
                        style={({ pressed }) => [styles.pin, pressed && styles.pinPressed]}
                      >
                        <View style={[styles.pinImage, styles.pinShort]}>
                          {suggestion.shop.photos[0] ? (
                            <Image contentFit="cover" source={{ uri: suggestion.shop.photos[1] ?? suggestion.shop.photos[0] }} style={styles.thumbImage} transition={150} />
                          ) : (
                            <AppText style={styles.pinFallback} variant="cardTitle">{suggestion.shop.name.slice(0, 1)}</AppText>
                          )}
                          <View style={styles.pinRating}>
                            <AppText capScale style={styles.pinOnImageText} variant="meta">별점 {suggestedReview.rating}</AppText>
                          </View>
                        </View>
                        <AppText numberOfLines={2} style={styles.pinTitle} variant="cardTitle">{suggestedReview.text}</AppText>
                        <View style={styles.pinAuthor}>
                          {suggestedReview.author ? (
                            <View style={styles.pinAuthorAvatar}>
                              <AppText capScale style={styles.pinAuthorInitial} variant="meta">{suggestedReview.author.slice(0, 1)}</AppText>
                            </View>
                          ) : null}
                          <AppText capScale numberOfLines={1} style={styles.pinAuthorName} variant="meta">
                            {suggestedReview.author ? `${suggestedReview.author} · ` : ""}{suggestion.shop.name}
                          </AppText>
                        </View>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ) : null}

              <View style={[styles.block, styles.bottom]}>
                <Button
                  fullWidth
                  leftIcon={<RotateCw color={colors.ink} size={16} />}
                  onPress={restart}
                  title="최근 기록으로 다시 정리"
                  variant="secondary"
                />
                <AppText lineBreakStrategyIOS="hangul-word" style={[styles.center, styles.gapTop3]} tone="sub" variant="meta">
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
          <AppText lineBreakStrategyIOS="hangul-word" selectable variant="secondary">
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
  center: { textAlign: "center" },
  heavy: { fontWeight: "700", color: colors.ink },
  subText: { color: colors.inkSub, fontWeight: "600" },
  tabular: { fontVariant: ["tabular-nums"] },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.x2 },
  gapTop1: { marginTop: spacing.x1 },
  gapTop2: { marginTop: spacing.x2 },
  gapTop3: { marginTop: spacing.x3 },
  gapTop5: { marginTop: spacing.x5 },
  invisible: { opacity: 0 },
  pressedWash: { backgroundColor: colors.surfacePressed },
  scroll: { paddingBottom: spacing.x8 },
  top: { paddingHorizontal: spacing.gutter, paddingTop: spacing.x4 },
  section: { marginHorizontal: spacing.gutter, marginTop: spacing.section },
  sectionContent: { marginTop: spacing.x3 },
  block: { paddingHorizontal: spacing.gutter, paddingVertical: spacing.x5 },
  emptySection: { paddingVertical: spacing.x10, alignItems: "stretch" },
  bottom: { marginTop: spacing.x5, paddingBottom: spacing.x8 },
  card: { backgroundColor: colors.canvasSoft, borderRadius: radii.lg, padding: spacing.x5 },
  coverHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.x2, minHeight: (typography.meta.lineHeight ?? 18) * 2 },
  coverDate: { flex: 1, minWidth: 0, textAlign: "right" },
  coverBadge: { paddingHorizontal: spacing.x3, paddingVertical: spacing.x1_5, borderRadius: radii.pill, overflow: "hidden", backgroundColor: colors.selected, color: colors.onSelected, fontWeight: "700" },
  coverTitle: { marginTop: spacing.x4 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x1_5, marginTop: spacing.x3 },
  coverTag: { backgroundColor: colors.paper, borderRadius: radii.pill, overflow: "hidden", paddingHorizontal: spacing.x3, paddingVertical: spacing.x1_5, fontWeight: "700", fontSize: 13, lineHeight: 18 },
  coverFingerprint: { marginTop: spacing.x3 },
  fingerprintRow: { flexDirection: "row", alignItems: "center", gap: spacing.x2_5, minHeight: 28 },
  fingerprintLabel: { width: 60, flexShrink: 1, fontWeight: "700", color: colors.ink, fontSize: 13, lineHeight: 18 },
  fingerprintTrack: { flex: 1, minWidth: 48, height: 8, borderRadius: radii.pill, backgroundColor: colors.secondary, justifyContent: "center" },
  fingerprintKnob: { position: "absolute", width: 18, height: 18, marginLeft: -9, borderRadius: radii.pill },
  fingerprintValue: { minWidth: 92, maxWidth: "42%", flexShrink: 0, textAlign: "right", fontSize: 12, lineHeight: 18 },
  rowDivider: { borderTopColor: colors.border, borderTopWidth: line.hair },
  track: { flex: 1, height: 12, borderRadius: radii.pill, backgroundColor: colors.secondary, overflow: "hidden" },
  trackFill: { height: "100%", borderRadius: radii.pill, borderWidth: line.base, borderColor: colors.soupEdge },
  typeList: { marginTop: spacing.x3, gap: spacing.x3 },
  typeRow: { flexDirection: "row", alignItems: "center", gap: spacing.x2_5 },
  typeName: { width: 50 },
  typeValue: { width: 96, textAlign: "right", fontSize: 13 },
  listRow: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.x3, paddingVertical: spacing.x3 },
  thumb: { width: 48, height: 48, borderRadius: radii.sm, backgroundColor: colors.canvasSoft, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  thumbImage: { width: "100%", height: "100%" },
  rankNumber: { width: 28, height: 28, overflow: "hidden", textAlign: "center", textAlignVertical: "center", lineHeight: 28, borderRadius: radii.pill, backgroundColor: colors.canvasSoft, fontWeight: "700", fontVariant: ["tabular-nums"] },
  rankSelected: { backgroundColor: colors.selected, color: colors.onSelected },
  pinRow: { marginTop: spacing.x3, flexDirection: "row", gap: spacing.x2 },
  pin: { flex: 1, minWidth: 0 },
  pinPressed: { opacity: 0.8 },
  pinImage: { position: "relative", overflow: "hidden", backgroundColor: colors.canvasSoft, borderRadius: radii.sm },
  pinTall: { height: 230 },
  pinShort: { height: 180 },
  pinFallback: { alignSelf: "center", marginTop: spacing.x10 },
  pinType: { position: "absolute", left: spacing.x2, bottom: spacing.x2, backgroundColor: colors.photoPill, borderRadius: radii.pill, paddingHorizontal: spacing.x2, paddingVertical: spacing.x1 },
  pinRating: { position: "absolute", left: spacing.x2, top: spacing.x2, backgroundColor: colors.photoPill, borderRadius: radii.pill, paddingHorizontal: spacing.x2, paddingVertical: spacing.x1 },
  pinOnImageText: { color: colors.onPhotoPill, fontWeight: "700" },
  pinTitle: { marginTop: spacing.x2 },
  pinMeta: { marginTop: spacing.x1, fontSize: 12, lineHeight: 18 },
  pinAuthor: { flexDirection: "row", alignItems: "center", gap: spacing.x1_5, paddingHorizontal: spacing.x1, marginTop: spacing.x1 },
  pinAuthorAvatar: { width: 22, height: 22, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, backgroundColor: colors.secondary },
  pinAuthorInitial: { color: colors.ink, fontWeight: "700" },
  pinAuthorName: { flex: 1, color: colors.inkSub, fontWeight: "600" },
  fallbackBox: { backgroundColor: colors.canvasSoft, borderRadius: radii.sm },
  fallbackContent: { padding: spacing.x3 },
  loadingBody: { flexGrow: 1, alignItems: "center", paddingHorizontal: spacing.gutter, paddingTop: spacing.x6, paddingBottom: spacing.x10 },
  loadingSheet: { alignSelf: "center", width: "100%", maxWidth: 358, backgroundColor: colors.canvasSoft, borderRadius: radii.lg, padding: spacing.x5, marginTop: spacing.section },
  loadingSheetHead: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: spacing.x1 },
  loadingSheetNumber: { fontVariant: ["tabular-nums"] },
  bowlGrid: { alignSelf: "center", width: "100%", maxWidth: 302, position: "relative", marginTop: spacing.x4 },
  bowlSlot: { position: "absolute", height: 29, alignItems: "center" },
  loadingLegendSlot: { minHeight: spacing.x4_5 + (typography.meta.lineHeight ?? 18) + spacing.x1_5 + (typography.sectionTitle.lineHeight ?? 24) },
  loadingLegend: { flexDirection: "row", justifyContent: "space-between", gap: spacing.x1, marginTop: spacing.x4_5 },
  loadingLegendItem: { flex: 1, gap: spacing.x1_5 },
  loadingLegendName: { flexDirection: "row", alignItems: "center", gap: spacing.x1 },
  loadingLegendCount: { paddingLeft: spacing.x3_5, fontVariant: ["tabular-nums"] },
  loadingScaleNote: { textAlign: "center", marginTop: spacing.x2 },
  loadingResultSlot: { minHeight: spacing.section + (typography.screenTitle.lineHeight ?? 28) * 2 + spacing.x1 + (typography.secondary.lineHeight ?? 20) },
  loadingResult: { gap: spacing.x1, marginTop: spacing.section },
  loadingStatus: { width: "100%", maxWidth: 300, flexDirection: "row", alignSelf: "center", alignItems: "center", gap: spacing.x2, minHeight: 24, marginTop: spacing.section },
  loadingStatusText: { fontWeight: "600" },
  dot: { width: 8, height: 8, borderRadius: radii.pill, backgroundColor: colors.textMuted },
  dotComplete: { backgroundColor: colors.ink },
  loadingFooter: { alignItems: "center", paddingHorizontal: spacing.x6, paddingBottom: spacing.x4, paddingTop: spacing.x2 },
})
