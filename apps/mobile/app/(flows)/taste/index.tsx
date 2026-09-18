import { useEffect, useMemo, useRef, useState } from "react"
import { router, useLocalSearchParams } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { Image } from "expo-image"
import { ArrowRight, Check, PenLine, RotateCw, Share2 } from "lucide-react-native"
import { Pressable, ScrollView, Share, StyleSheet, View, useWindowDimensions } from "react-native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import { SafeAreaView } from "react-native-safe-area-context"
import Svg, { Circle, Line, Polygon, Text as SvgText } from "react-native-svg"

import {
  MENU_CATEGORY_NAMES,
  TASTE_AXES,
  metricsFromProfile,
  seoulToday,
  typeCountsOf,
  type MenuCategoryName,
  type MetricItem,
  type Shop,
  type TasteIdentity,
  type TasteProfile,
} from "@raota/shared"
import { track } from "@/src/analytics"
import { AppText, BottomSheet, Button, Header, LoadingState, Tag, Toast } from "@/src/components/ui"
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
import { colors, radii, spacing } from "@/src/theme"
import { MENU_CATEGORY_COLORS } from "./archive"

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
  const metrics = metricsFromProfile(profile).filter(
    (metric) => metric.key === "brothDensity" || metric.key === "noodleFirmness",
  )
  return (
    <View style={styles.card}>
      <View style={styles.coverHead}>
        <View style={styles.coverHeadLabels}>
          <View style={styles.inkTag}>
            <AppText capScale tone="onDark" variant="meta">
              종합 리포트
            </AppText>
          </View>
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
        <AppText accessibilityRole="header" variant="screenTitle">
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
          {metrics.map((metric) => (
            <View
              accessibilityLabel={`${metric.label} 평균 ${metric.score.toFixed(1)}점, 5점 만점`}
              accessible
              key={metric.key}
              style={styles.flex}
            >
              <View style={styles.rowBetween}>
                <AppText capScale tone="muted" variant="meta">
                  {metric.label}
                </AppText>
                <AppText capScale style={styles.tabular} variant="meta">
                  {metric.score.toFixed(1)}
                  <AppText capScale tone="muted" variant="meta">
                    {" / 5"}
                  </AppText>
                </AppText>
              </View>
              <View style={styles.steps}>
                {[1, 2, 3, 4, 5].map((step) => (
                  <View key={step} style={styles.step}>
                    <View
                      style={[styles.stepFill, { width: `${Math.min(1, Math.max(0, metric.score - step + 1)) * 100}%` }]}
                    />
                  </View>
                ))}
              </View>
            </View>
          ))}
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
    <View accessibilityLabel={`입맛 5축 레이더. ${summary}`} accessibilityRole="image" accessible style={styles.radarWrap}>
      <Svg height={RADAR_SIZE} viewBox={`-12 0 ${RADAR_SIZE + 24} ${RADAR_SIZE}`} width={RADAR_SIZE + 24}>
        {[0.2, 0.4, 0.6, 0.8, 1].map((level) => (
          <Polygon
            fill="none"
            key={level}
            points={pointsOf([level, level, level, level, level])}
            stroke={colors.border}
            strokeDasharray={level === 1 ? undefined : "2 2"}
            strokeWidth={1}
          />
        ))}
        {[0, 1, 2, 3, 4].map((index) => {
          const p = radarPoint(index, 1)
          return <Line key={index} stroke={colors.border} strokeWidth={1} x1={RADAR_CENTER} x2={p.x} y1={RADAR_CENTER} y2={p.y} />
        })}
        <Polygon
          fill={colors.brand}
          fillOpacity={0.12}
          points={pointsOf(metrics.map((metric) => metric.myVal))}
          stroke={colors.brand}
          strokeLinejoin="round"
          strokeWidth={2.5}
        />
        {metrics.map((metric, index) => {
          const p = radarPoint(index, metric.myVal)
          return <Circle cx={p.x} cy={p.y} fill={colors.brand} key={metric.key} r={3.5} stroke={colors.canvas} strokeWidth={1.5} />
        })}
        {metrics.map((metric, index) => (
          <SvgText
            fill={colors.inkSub}
            fontSize={12}
            fontWeight="600"
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

const STATUS_MESSAGES = [
  "라멘 기록을 모으고 있어요",
  "국물과 면 취향을 살펴보고 있어요",
  "나의 누적 취향을 정리하고 있어요",
  "나의 라멘 취향이 정리됐어요",
]
const LOADING_SIZE = 260
const LOADING_CENTER = 130
const LOADING_RADIUS = 76

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
  const [stage, setStage] = useState(0)
  const complete = stage === 3
  const grow = useSharedValue(0.28)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    grow.value = withTiming(1, { duration: LOADING_DURATION, easing: Easing.out(Easing.cubic) })
    const timers = [
      setTimeout(() => setStage(1), LOADING_DURATION / 3),
      setTimeout(() => setStage(2), (LOADING_DURATION * 2) / 3),
      setTimeout(() => setStage(3), LOADING_DURATION),
      setTimeout(() => onCompleteRef.current(), LOADING_DURATION + 500),
    ]
    return () => timers.forEach(clearTimeout)
  }, [grow])

  const shapeStyle = useAnimatedStyle(() => ({ transform: [{ scale: grow.value }] }))
  const activeAxis = complete ? -1 : [0, 1, 3][stage]
  const labelPos = [
    { x: 130, y: 40 },
    { x: 222, y: 90 },
    { x: 184, y: 216 },
    { x: 76, y: 216 },
    { x: 38, y: 90 },
  ]

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
          <Svg height={LOADING_SIZE} style={StyleSheet.absoluteFill} width={LOADING_SIZE}>
            {[0.33, 0.66, 1].map((level) => (
              <Polygon
                fill={level === 0.33 ? colors.brandWeak : "none"}
                key={level}
                points={pointsOf([level, level, level, level, level], LOADING_CENTER, LOADING_RADIUS)}
                stroke={colors.border}
                strokeWidth={1}
              />
            ))}
            {[0, 1, 2, 3, 4].map((index) => {
              const p = radarPoint(index, 1, LOADING_CENTER, LOADING_RADIUS)
              return (
                <Line key={index} stroke={colors.border} strokeWidth={1} x1={LOADING_CENTER} x2={p.x} y1={LOADING_CENTER} y2={p.y} />
              )
            })}
            {metrics.map((metric, index) => (
              <SvgText
                fill={index === activeAxis ? colors.brand : colors.inkSub}
                fontSize={12}
                fontWeight={index === activeAxis ? "600" : "500"}
                key={metric.key}
                textAnchor="middle"
                x={labelPos[index].x}
                y={labelPos[index].y}
              >
                {metric.label}
              </SvgText>
            ))}
          </Svg>
          <Animated.View style={[StyleSheet.absoluteFill, shapeStyle]}>
            <Svg height={LOADING_SIZE} width={LOADING_SIZE}>
              <Polygon
                fill={colors.brand}
                fillOpacity={0.1}
                points={pointsOf(metrics.map((metric) => metric.myVal), LOADING_CENTER, LOADING_RADIUS)}
                stroke={colors.brand}
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </Svg>
          </Animated.View>
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
            <Pressable
              accessibilityLabel="취향 리포트 공유"
              accessibilityRole="button"
              onPress={handleShare}
              style={({ pressed }) => [styles.shareButton, pressed && styles.pressedWash]}
            >
              <Share2 color={colors.ink} size={16} />
              <AppText capScale variant="bodyStrong">
                공유
              </AppText>
            </Pressable>
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
            <AppText capScale style={styles.gapTop2} tone="muted" variant="meta">
              {generatedAt ? `${seoulToday()} ${generatedAt}에 다시 정리함` : `${seoulToday()} 기준`}
            </AppText>
          </View>

          {recordCount === 0 ? (
            <View style={[styles.section, styles.emptySection]}>
              <AppText accessibilityRole="header" style={styles.center} variant="screenTitle">
                아직 보여드릴 취향이 없어요
              </AppText>
              <AppText style={[styles.center, styles.gapTop2]} tone="sub" variant="body">
                {"첫 그릇을 기록하면\n5축 점수와 종류별 분포가 여기에 쌓여요."}
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
                  입맛 5축
                </AppText>
                <AppText style={styles.gapTop1} tone="sub" variant="secondary">
                  기록마다 매긴 5축 점수의 평균이에요. 바깥쪽일수록 5점에 가까워요.
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
                          <View style={[styles.trackFill, { width: `${metric.myVal * 100}%` }]} />
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
                    return (
                      <View accessibilityLabel={`${name} ${count}그릇, ${pct}%`} accessible key={name} style={styles.typeRow}>
                        <AppText style={styles.typeName} variant="bodyStrong">
                          {name}
                        </AppText>
                        <View style={[styles.track, styles.trackThick]}>
                          <View style={[styles.trackFill, { width: `${pct}%`, backgroundColor: MENU_CATEGORY_COLORS[name].fill }]} />
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
                          <View style={styles.thumb}>
                            {visit.photo ? (
                              <Image contentFit="cover" source={{ uri: visit.photo }} style={styles.thumbImage} transition={150} />
                            ) : (
                              <AppText tone="sub" variant="cardTitle">
                                {visit.name.slice(0, 1)}
                              </AppText>
                            )}
                            <View style={styles.rankBadge}>
                              <AppText capScale tone="onDark" variant="meta">
                                {index + 1}
                              </AppText>
                            </View>
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

              <View style={[styles.section, styles.bottom]}>
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
  root: { flex: 1, backgroundColor: colors.canvas },
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
  top: { paddingHorizontal: spacing.gutter, paddingTop: spacing.x4, paddingBottom: spacing.x5 },
  section: {
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.x5,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  emptySection: { paddingVertical: spacing.x10, alignItems: "stretch" },
  bottom: { paddingBottom: spacing.x8 },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.x2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.x3,
    paddingVertical: spacing.x2_5,
    marginBottom: spacing.x4,
  },
  shareButton: {
    minHeight: 44,
    paddingHorizontal: spacing.x3,
    borderRadius: radii.pill,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x1_5,
  },
  card: {
    backgroundColor: colors.canvas,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: 1,
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
  inkTag: { backgroundColor: colors.ink, borderRadius: radii.xs, paddingHorizontal: spacing.x2, paddingVertical: spacing.x1 },
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
  steps: { flexDirection: "row", gap: spacing.x1, marginTop: spacing.x2 },
  step: { flex: 1, height: 4, borderRadius: radii.xs, backgroundColor: colors.canvasSoft, overflow: "hidden" },
  stepFill: { height: "100%", backgroundColor: colors.brand },
  coverActions: { marginTop: spacing.x4, gap: spacing.x1 },
  radarWrap: { alignItems: "center", paddingVertical: spacing.x2 },
  axisList: { borderTopColor: colors.border, borderTopWidth: 1 },
  axisRow: { flexDirection: "row", alignItems: "center", gap: spacing.x3, paddingVertical: spacing.x2_5 },
  rowDivider: { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
  axisLabel: { width: 84 },
  axisScore: { width: 30, textAlign: "right" },
  axisLean: { width: 64, textAlign: "right" },
  track: { flex: 1, height: 6, borderRadius: radii.pill, backgroundColor: colors.canvasSoft, overflow: "hidden" },
  trackThick: { height: 8 },
  trackFill: { height: "100%", borderRadius: radii.pill, backgroundColor: colors.brand },
  typeList: { marginTop: spacing.x4, gap: spacing.x3 },
  typeRow: { flexDirection: "row", alignItems: "center", gap: spacing.x3 },
  typeName: { width: 52 },
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
    borderRadius: radii.sm,
    backgroundColor: colors.canvasSoft,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbImage: { width: "100%", height: "100%" },
  rankBadge: {
    position: "absolute",
    left: 0,
    top: 0,
    minWidth: 20,
    height: 20,
    paddingHorizontal: spacing.x1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink,
  },
  fallbackBox: {
    backgroundColor: colors.canvasSoft,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.sm,
  },
  fallbackContent: { padding: spacing.x3 },
  loadingBody: { flexGrow: 1, justifyContent: "center", paddingHorizontal: spacing.x6, paddingVertical: spacing.x4 },
  loadingRadar: { width: LOADING_SIZE, height: LOADING_SIZE, alignSelf: "center", marginVertical: spacing.x6 },
  loadingStatus: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.x2, minHeight: 24 },
  dot: { width: 4, height: 4, borderRadius: radii.pill, backgroundColor: colors.brand },
  loadingFooter: { alignItems: "center", paddingHorizontal: spacing.x6, paddingBottom: spacing.x4, paddingTop: spacing.x2 },
})
