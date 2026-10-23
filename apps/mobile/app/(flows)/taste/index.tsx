import { memo, useEffect, useMemo, useRef, useState } from "react"
import * as Haptics from "expo-haptics"
import { router, useLocalSearchParams } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { Image } from "expo-image"
import { ArrowRight, RotateCw, Share2 } from "lucide-react-native"
import { AccessibilityInfo, Platform, Pressable, ScrollView, Share, StyleSheet, View, findNodeHandle, useWindowDimensions } from "react-native"
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import Svg, { Ellipse, Path } from "react-native-svg"

import {
  MENU_CATEGORY_NAMES,
  menuCategoryOf,
  metricsFromProfile,
  seoulToday,
  typeCountsOf,
  type DemoBowl,
  type MenuCategoryName,
  type Shop,
  type TasteIdentity,
} from "@raota/shared"
import { track } from "@/src/analytics"
import { EdgeBackZone } from "@/src/components/EdgeBackZone"
import { TasteStory } from "@/src/components/TasteStory"
import { AppText, BottomSheet, Button, Header, IconButton, LoadingState, Toast } from "@/src/components/ui"
import {
  useActivityLevel,
  useBowlCount,
  useMyBowls,
  useLocalShops,
  useTasteIdentity,
  useTasteProfile,
  useVisitedShops,
} from "@/src/data"
import { useRaota } from "@/src/state/RaotaStore"
import { sizedImageUri } from "@/src/api/imageSize"
import { colors, line, radii, soupColorOf, spacing, typography } from "@/src/theme"

/* 취향 종합 리포트: 한 장씩 넘기는 이야기 → 종류별 분포 → 자주 간 라멘집 → 다음 한 그릇. */

/**
 * 그릇 쌓기 연출의 박자(ms). 사용자 결정 2026.10.20 B안(scratch/ramen-objects-prototype/bowl-b.html).
 * 기록한 순서대로 한 그릇씩 떨어져 종류별 탑이 된다. 처음엔 천천히, 갈수록 빠르게(DROP_ACCEL) 떨어지고,
 * 다 쌓이면 가장 높은 탑을 짚은 뒤 결과를 띄우고, 결과는 RESULT_HOLD만큼 보여 주고 넘어간다.
 */
const DROP_START = 300
const DROP_SPAN = 3000
/** 그릇이 몇 개 안 되면 3초 동안 띄엄띄엄 떨어지지 않게 그릇 사이를 이만큼까지만 둔다 */
const DROP_STEP_MAX = 250
const DROP_ACCEL = 1.7
const FALL_DURATION = 420
/** 떨어지기 시작해 받침(또는 아래 그릇)에 닿기까지. 남은 시간은 살짝 눌렸다 돌아온다 */
const FALL_IMPACT = 344
const FALL_HEIGHT = 170
const LANDING_SQUASH = 0.04
const SQUASH_IN = 24
const NUDGE_DURATION = 160
/** 그릇이 아래 그릇 안에 앉을 때 좌우로 살짝 흔들렸다 자리 잡는 각도(도). 방향은 그릇마다 번갈아 바뀐다 */
const SETTLE_TILT = 3
const HIGHLIGHT_DELAY = 200
const WINNER_LIFT = 4
const LIFT_DURATION = 380
const DIM_OPACITY = 0.4
const DIM_DURATION = 450
const COUNT_REVEAL = 300
const STEAM_DURATION = 2200
const STEAM_STAGGER = 350
const RESULT_DELAY = 500
const RESULT_REVEAL = 500
const RESULT_HOLD = 1200
/** 착지마다 숫자를 올리되, 끝의 빠른 구간에서도 한 프레임에 한 번만 다시 그린다 */
const LANDING_FRAME = 16

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
  if (shop) router.push({ pathname: "/shop/[shopId]", params: { shopId: shop.id } })
}

// ---------------------------------------------------------------------------
// 기록이 없을 때의 표지. 기록이 생기면 TasteStory가 이 자리를 대신한다.
// ---------------------------------------------------------------------------

function TasteReportCover({ identity, updatedLabel }: {
  identity: TasteIdentity
  updatedLabel: string
}) {
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

/**
 * 화면에 그리는 그릇은 많아야 60개다(그릇마다 움직이는 View 하나라 이 정도까지 부드럽다).
 * 보통 계정은 모든 그릇을 그대로 그리고, 그보다 많으면 종류별 몫을 나눠 뽑고 "그릇 1개 ≈ n그릇"을 함께 보인다
 */
const MAX_LOADING_BOWLS = 60
/** 그릇 한 개(44×34 viewBox): 국물이 담긴 반구와 테두리 선 */
const BOWL_PATH = "M3 10H41C41 21.6 32.5 31 22 31C11.5 31 3 21.6 3 10Z"
const BOWL_RIM_PATH = "M2.5 10H41.5"
const BOWL_VIEW_WIDTH = 44
const BOWL_VIEW_HEIGHT = 34
/** 그릇 그림의 바닥(viewBox y). 이 높이가 받침선에 닿는다 */
const BOWL_VIEW_FOOT = 31
const STEAM_PATHS = ["M15 6c0-2.5 2.5-2.5 2.5-5", "M22 5c0-2.5 2.5-2.5 2.5-5", "M29 6c0-2.5 2.5-2.5 2.5-5"]
const STEAM_STROKE = 1.8
/** 받침선 위로 그릇이 쌓이는 높이. 가장 높은 탑 위에 김이 오를 자리(TOWER_HEADROOM)를 늘 남긴다 */
const TOWER_STAGE_HEIGHT = 252
const TOWER_HEADROOM = 40
const TOWER_MAX_GAP = 12
/**
 * 겹쳐 쌓인 그릇은 아래 그릇의 앞면이 위 그릇의 바닥을 가린다(그릇이 포개지는 모양).
 * 그래서 아래층일수록 앞에 그린다. 새 그릇은 탑 뒤로 내려와 꼭대기 그릇 안에 앉는다
 */
const TOWER_Z_TOP = 200
const LOADING_SHEET_MAX_WIDTH = 358
const LOADING_TITLES = {
  drop: "그릇을 쌓고 있어요",
  highlight: "가장 높이 쌓인 건",
  result: "취향 정리가 끝났어요",
} as const
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse)

type LoadingPhase = keyof typeof LOADING_TITLES
/** order: 떨어지는 순서, level: 탑 안에서 아래부터 몇 번째, source: 오래된 순 원장에서의 자리 */
type LoadingBowl = { type: string; order: number; level: number; source: number }
type BowlTower = { type: string; count: number; icons: number; first: number }
type TowerPlanBowl = LoadingBowl & { dropAt: number; coveredAt: number | null }
/** 탑 하나의 그릇과 박자. 화면 폭과 상관없어 원장이 바뀔 때만 다시 계산한다 */
type TowerPlan = BowlTower & { bowls: TowerPlanBowl[]; lastOrder: number }

/**
 * 화면에는 최대 60개만 그리되, 그 이상일 때는 최대 잔여 방식으로 종류별 몫을 배분한다.
 * 배분된 종류 안에서는 날짜순 원장에서 골고루 뽑아 떨어지는 순서를 그대로 지킨다.
 */
function loadingBowlsOf(bowls: DemoBowl[]) {
  const records = [...bowls].reverse() // useMyBowls는 최신순; 이 연출은 오래 먹은 그릇부터 쌓는다
  const counts = new Map<string, BowlTower>()
  records.forEach((bowl, index) => {
    const type = menuCategoryOf(bowl.type)
    const entry = counts.get(type)
    if (entry) entry.count += 1
    else counts.set(type, { type, count: 1, icons: 0, first: index })
  })
  const towers = [...counts.values()].sort((a, b) => b.count - a.count || a.first - b.first)
  const limit = Math.min(MAX_LOADING_BOWLS, records.length)
  let allocated = 0
  for (const item of towers) {
    item.icons = Math.floor((item.count * limit) / records.length)
    allocated += item.icons
  }
  // 몫이 같은 종류는 실제 그릇 수, 원장 첫 등장 순으로 결정한다
  const byRemainder = [...towers].sort(
    (a, b) =>
      ((b.count * limit) % records.length) - ((a.count * limit) % records.length) ||
      b.count - a.count ||
      a.first - b.first,
  )
  for (let index = 0; index < limit - allocated; index += 1) byRemainder[index].icons += 1

  const seen = new Map<string, number>()
  const placed = new Map<string, number>()
  const icons: LoadingBowl[] = []
  records.forEach((bowl, source) => {
    const type = menuCategoryOf(bowl.type)
    const item = counts.get(type)!
    const nth = seen.get(type) ?? 0
    seen.set(type, nth + 1)
    // 시간순 표본에서 고르게 뽑아, 60개로 줄일 때도 한 종류가 통째로 사라지지 않게 한다
    if (Math.floor(((nth + 1) * item.icons) / item.count) === Math.floor((nth * item.icons) / item.count)) return
    const level = placed.get(type) ?? 0
    placed.set(type, level + 1)
    icons.push({ type, order: icons.length, level, source })
  })
  return { icons, records, towers }
}

/** i번째 그릇이 떨어지기 시작하는 시각. 처음엔 천천히, 갈수록 빠르게: 300 + 3000·(1 − (1 − i/(N−1))^1.7) */
function dropScheduleOf(count: number) {
  const span = Math.min(DROP_SPAN, Math.max(0, count - 1) * DROP_STEP_MAX)
  const dropAt = Array.from({ length: count }, (_, index) =>
    Math.round(DROP_START + (count > 1 ? span * (1 - (1 - index / (count - 1)) ** DROP_ACCEL) : 0)),
  )
  const highlightAt = DROP_START + span + FALL_DURATION + HIGHLIGHT_DELAY
  return { dropAt, highlightAt, resultAt: highlightAt + RESULT_DELAY }
}

/** 떨어져 착지하는 그릇 하나. 탑 꼭대기 그릇만 국물 면을 보인다(위에 다음 그릇이 닿으면 감춘다) */
const TowerBowl = memo(function TowerBowl({
  coveredAt,
  dropAt,
  height,
  left,
  level,
  order,
  reducedMotion,
  top,
  type,
  width,
}: {
  coveredAt: number | null
  dropAt: number
  height: number
  left: number
  level: number
  order: number
  reducedMotion: boolean
  top: number
  type: string
  width: number
}) {
  const fall = useSharedValue(reducedMotion ? 1 : 0)
  const squash = useSharedValue(0)
  const tilt = useSharedValue(0)
  const surface = useSharedValue(reducedMotion && coveredAt !== null ? 0 : 1)
  useEffect(() => {
    if (reducedMotion) {
      fall.value = 1
      squash.value = 0
      tilt.value = 0
      surface.value = coveredAt === null ? 1 : 0
      return
    }
    fall.value = withDelay(dropAt, withTiming(1, { duration: FALL_IMPACT, easing: Easing.in(Easing.quad) }))
    squash.value = withDelay(
      dropAt + FALL_IMPACT,
      withSequence(
        withTiming(1, { duration: SQUASH_IN }),
        withTiming(0, { duration: FALL_DURATION - FALL_IMPACT - SQUASH_IN, easing: Easing.out(Easing.quad) }),
      ),
    )
    const lean = order % 2 === 0 ? SETTLE_TILT : -SETTLE_TILT
    tilt.value = withDelay(
      dropAt + FALL_IMPACT,
      withSequence(
        withTiming(lean, { duration: 70, easing: Easing.out(Easing.quad) }),
        withTiming(-lean / 2, { duration: 110, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 140, easing: Easing.out(Easing.quad) }),
      ),
    )
    if (coveredAt !== null) surface.value = withDelay(coveredAt, withTiming(0, { duration: 0 }))
    return () => {
      cancelAnimation(fall)
      cancelAnimation(squash)
      cancelAnimation(tilt)
      cancelAnimation(surface)
    }
  }, [coveredAt, dropAt, fall, order, reducedMotion, squash, surface, tilt])
  const fallStyle = useAnimatedStyle(() => ({
    // 위에서 나타나 받침에 닿으면 살짝 눌렸다(가로 4% 넓게, 세로 4% 낮게) 돌아온다
    opacity: Math.min(1, fall.value / 0.3),
    transform: [
      { translateY: -FALL_HEIGHT * (1 - fall.value) },
      { rotate: `${tilt.value}deg` },
      { scaleX: 1 + LANDING_SQUASH * squash.value },
      { scaleY: 1 - LANDING_SQUASH * squash.value },
    ],
  }))
  const surfaceProps = useAnimatedProps(() => ({ opacity: surface.value }))
  const soup = soupColorOf(type)
  return (
    <Animated.View style={[styles.towerBowl, { left, top, width, height, zIndex: TOWER_Z_TOP - 1 - level }, fallStyle]} testID={`report-bowl-${order}`}>
      <Svg height={height} viewBox={`0 0 ${BOWL_VIEW_WIDTH} ${BOWL_VIEW_HEIGHT}`} width={width}>
        <Path
          d={BOWL_PATH}
          fill={soup}
          stroke={colors.soupEdge}
          strokeLinejoin="round"
          strokeWidth={line.base}
          testID={`report-bowl-soup-${order}`}
        />
        <Path d={BOWL_RIM_PATH} fill="none" stroke={colors.soupEdge} strokeLinecap="round" strokeWidth={line.base} />
        <AnimatedEllipse
          animatedProps={surfaceProps}
          cx={22}
          cy={10}
          fill={soup}
          opacity={reducedMotion && coveredAt !== null ? 0 : 1}
          rx={19}
          ry={3.6}
          stroke={colors.soupEdge}
          strokeWidth={line.base}
          testID={`report-bowl-surface-${order}`}
        />
      </Svg>
    </Animated.View>
  )
})

/** 이긴 탑 꼭대기 그릇에서 오르는 김 한 줄기. 화면을 떠나면(언마운트) 반복을 멈춘다 */
function SteamWisp({ d, delay, height, index, left, top, width }: {
  d: string
  delay: number
  height: number
  index: number
  left: number
  top: number
  width: number
}) {
  const rise = useSharedValue(0)
  useEffect(() => {
    rise.value = withDelay(delay, withRepeat(withTiming(1, { duration: STEAM_DURATION, easing: Easing.out(Easing.quad) }), -1, false))
    return () => cancelAnimation(rise)
  }, [delay, rise])
  const style = useAnimatedStyle(() => ({
    opacity: rise.value < 0.25 ? (rise.value / 0.25) * 0.85 : 0.85 * (1 - (rise.value - 0.25) / 0.75),
    transform: [{ translateY: 5 - 21 * rise.value }],
  }))
  return (
    <Animated.View style={[styles.towerBowl, { left, top, width, height, zIndex: TOWER_Z_TOP }, style]} testID={`report-tower-steam-${index}`}>
      <Svg height={height} viewBox={`0 0 ${BOWL_VIEW_WIDTH} ${BOWL_VIEW_HEIGHT}`} width={width}>
        <Path d={d} fill="none" stroke={colors.outline} strokeLinecap="round" strokeWidth={STEAM_STROKE} />
      </Svg>
    </Animated.View>
  )
}

/** 종류 하나의 탑. 착지마다 1pt 눌리고, 다 쌓이면 이긴 탑은 4pt 떴다 내려오고 나머지는 옅어진다 */
function TasteTower({ bowlHeight, bowlWidth, gap, highlightAt, left, plan, reducedMotion, winner }: {
  bowlHeight: number
  bowlWidth: number
  gap: number
  highlightAt: number
  left: number
  plan: TowerPlan
  reducedMotion: boolean
  winner: boolean
}) {
  const nudge = useSharedValue(0)
  const lift = useSharedValue(0)
  const dim = useSharedValue(reducedMotion && !winner ? DIM_OPACITY : 1)
  useEffect(() => {
    if (reducedMotion) {
      nudge.value = 0
      lift.value = 0
      dim.value = winner ? 1 : DIM_OPACITY
      return
    }
    // 위에 그릇이 닿을 때마다 탑이 1pt 눌렸다 돌아온다. 끝의 빠른 구간에서 겹치는 눌림은 하나로 친다
    const steps: number[] = []
    let cursor = 0
    for (const bowl of plan.bowls.slice(1)) {
      const at = bowl.dropAt + FALL_IMPACT
      if (at < cursor) continue
      steps.push(
        withDelay(at - cursor, withTiming(1, { duration: NUDGE_DURATION / 2, easing: Easing.out(Easing.quad) })),
        withTiming(0, { duration: NUDGE_DURATION / 2, easing: Easing.in(Easing.quad) }),
      )
      cursor = at + NUDGE_DURATION
    }
    if (steps.length) nudge.value = withSequence(steps[0], ...steps.slice(1))
    if (winner) {
      lift.value = withDelay(
        highlightAt,
        withSequence(
          withTiming(-WINNER_LIFT, { duration: LIFT_DURATION / 2, easing: Easing.out(Easing.cubic) }),
          withTiming(0, { duration: LIFT_DURATION / 2, easing: Easing.inOut(Easing.quad) }),
        ),
      )
    } else {
      dim.value = withDelay(highlightAt, withTiming(DIM_OPACITY, { duration: DIM_DURATION }))
    }
    return () => {
      cancelAnimation(nudge)
      cancelAnimation(lift)
      cancelAnimation(dim)
    }
  }, [dim, highlightAt, lift, nudge, plan, reducedMotion, winner])
  const towerStyle = useAnimatedStyle(() => ({ opacity: dim.value, transform: [{ translateY: nudge.value + lift.value }] }))
  // level번째 그릇의 위치: 바닥 그릇의 발이 받침선에 닿고, 위로 gap씩 겹쳐 쌓인다
  const topOf = (level: number) => TOWER_STAGE_HEIGHT - line.hair - (bowlHeight * BOWL_VIEW_FOOT) / BOWL_VIEW_HEIGHT - level * gap
  const crown = plan.bowls[plan.bowls.length - 1]
  return (
    <Animated.View style={[styles.tower, towerStyle]} testID={`report-tower-${plan.type}`}>
      {plan.bowls.map((bowl) => (
        <TowerBowl
          coveredAt={bowl.coveredAt}
          dropAt={bowl.dropAt}
          height={bowlHeight}
          key={bowl.order}
          left={left}
          level={bowl.level}
          order={bowl.order}
          reducedMotion={reducedMotion}
          top={topOf(bowl.level)}
          type={bowl.type}
          width={bowlWidth}
        />
      ))}
      {winner && !reducedMotion && crown
        ? STEAM_PATHS.map((d, index) => (
            <SteamWisp
              d={d}
              delay={highlightAt + index * STEAM_STAGGER}
              height={bowlHeight}
              index={index}
              key={d}
              left={left}
              top={topOf(crown.level)}
              width={bowlWidth}
            />
          ))
        : null}
    </Animated.View>
  )
}

/** 탑 아래 종류 이름과 개수. 개수는 그 탑이 다 쌓이면 떠오르고, 자리는 처음부터 잡아 둔다 */
function TowerLabel({ count, done, highlightAt, highlighted, reducedMotion, type, winner }: {
  count: number
  done: boolean
  highlightAt: number
  highlighted: boolean
  reducedMotion: boolean
  type: string
  winner: boolean
}) {
  const dim = useSharedValue(reducedMotion && !winner ? DIM_OPACITY : 1)
  const shown = useSharedValue(reducedMotion ? 1 : 0)
  useEffect(() => {
    if (winner) return
    if (reducedMotion) {
      dim.value = DIM_OPACITY
      return
    }
    dim.value = withDelay(highlightAt, withTiming(DIM_OPACITY, { duration: DIM_DURATION }))
    return () => cancelAnimation(dim)
  }, [dim, highlightAt, reducedMotion, winner])
  useEffect(() => {
    if (!done) return
    shown.value = reducedMotion ? 1 : withTiming(1, { duration: COUNT_REVEAL, easing: Easing.out(Easing.cubic) })
  }, [done, reducedMotion, shown])
  const labelStyle = useAnimatedStyle(() => ({ opacity: dim.value }))
  const countStyle = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ translateY: 4 * (1 - shown.value) }] }))
  return (
    <Animated.View style={[styles.towerLabel, labelStyle]}>
      <View style={styles.towerCountSlot}>
        {done ? (
          <Animated.View style={countStyle}>
            <AppText
              capScale
              style={[styles.tabular, highlighted && winner && styles.winnerCount]}
              testID={`report-tower-count-${type}`}
              variant="sectionTitle"
            >
              {count}
            </AppText>
          </Animated.View>
        ) : null}
      </View>
      <AppText capScale numberOfLines={1} tone="muted" variant="meta">{type}</AppText>
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
  const { icons, records, towers } = useMemo(() => loadingBowlsOf(bowls), [bowls])
  const schedule = useMemo(() => dropScheduleOf(icons.length), [icons.length])
  const plans = useMemo<TowerPlan[]>(
    () =>
      towers.map((tower) => {
        const own = icons.filter((icon) => icon.type === tower.type)
        return {
          ...tower,
          bowls: own.map((icon, index) => ({
            ...icon,
            dropAt: schedule.dropAt[icon.order],
            coveredAt: index + 1 < own.length ? schedule.dropAt[own[index + 1].order] + FALL_IMPACT : null,
          })),
          lastOrder: own.length ? own[own.length - 1].order : -1,
        }
      }),
    [icons, schedule, towers],
  )
  const [stageWidth, setStageWidth] = useState(
    Math.max(0, Math.min(LOADING_SHEET_MAX_WIDTH, width - spacing.gutter * 2) - spacing.x4 * 2),
  )
  const [landed, setLanded] = useState(reducedMotion ? icons.length : 0)
  const [phase, setPhase] = useState<LoadingPhase>(reducedMotion ? "result" : "drop")
  const complete = phase === "result"
  const highlighted = phase !== "drop"
  const titleRef = useRef<View>(null)
  const loadingScrollRef = useRef<ScrollView>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const resultReveal = useSharedValue(reducedMotion ? 1 : 0)

  const count = bowls.length
  // 가장 많은 종류가 여럿이면 모두 짚는다(다른 라멘 표시와 같은 규칙)
  const topCount = towers[0].count
  const winners = towers.filter((tower) => tower.count === topCount).map((tower) => tower.type)
  const tied = winners.length > 1
  const topPercent = Math.round((topCount / count) * 100)
  const finalMessage = `${identity.title}, ${winners.join(", ")} ${tied ? "각 " : ""}${topCount}그릇`
  const finalMessageRef = useRef(finalMessage)
  finalMessageRef.current = finalMessage

  useEffect(() => {
    // 포커스를 제목으로 옮기지 않으면 VoiceOver가 이전 화면에 머문 채 리포트로 교체된다.
    // 제목의 접근성 이름("n그릇을 정리하고 있어요")이 시작 안내이고, 끝 안내는 결과가 뜰 때 한 번만 읽는다
    const focus = setTimeout(() => focusOn(titleRef), 250)
    if (reducedMotion) {
      setLanded(icons.length)
      setPhase("result")
      resultReveal.value = 1
      const announce = setTimeout(() => AccessibilityInfo.announceForAccessibility(finalMessageRef.current), 400)
      // 움직임이 없으니 완성된 감정서를 읽을 시간만 준다(연출 길이만큼 기다리게 하지 않는다)
      const timer = setTimeout(() => onCompleteRef.current(), RESULT_HOLD + 1000)
      return () => {
        clearTimeout(focus)
        clearTimeout(announce)
        clearTimeout(timer)
      }
    }
    const frames = new Map<number, number>()
    schedule.dropAt.forEach((at, index) => frames.set(Math.ceil((at + FALL_IMPACT) / LANDING_FRAME) * LANDING_FRAME, index + 1))
    const timers = [...frames].map(([at, landedCount]) => setTimeout(() => setLanded(landedCount), at))
    timers.push(
      setTimeout(() => {
        setPhase("highlight")
        if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
      }, schedule.highlightAt),
      setTimeout(() => {
        setPhase("result")
        resultReveal.value = withTiming(1, { duration: RESULT_REVEAL, easing: Easing.out(Easing.cubic) })
        AccessibilityInfo.announceForAccessibility(finalMessageRef.current)
      }, schedule.resultAt),
      setTimeout(() => onCompleteRef.current(), schedule.resultAt + RESULT_HOLD),
    )
    return () => {
      clearTimeout(focus)
      timers.forEach(clearTimeout)
    }
    // 시간표는 한 번만 시작한다. 원장은 연출 동안 바뀌지 않고, 단계 렌더 때 타이머를 다시 잡지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion])

  // The result owns its space before it appears, so content size does not change at completion.
  useEffect(() => {
    if (!complete) return
    const frame = requestAnimationFrame(() => loadingScrollRef.current?.scrollToEnd({ animated: false }))
    return () => cancelAnimationFrame(frame)
  }, [complete])

  const resultStyle = useAnimatedStyle(() => ({
    opacity: resultReveal.value,
    transform: [{ translateY: 10 * (1 - resultReveal.value) }],
  }))
  const sampleRatio = count > MAX_LOADING_BOWLS
    ? (count / MAX_LOADING_BOWLS).toFixed(2).replace(/0+$/, "").replace(/\.$/, "")
    : null

  // 숫자와 기간은 방금 닿은 그릇의 원장 자리를 따른다. 마지막 그릇이 닿으면 전체를 보인다
  const finished = landed >= icons.length
  const lastLanded = landed > 0 ? icons[landed - 1] : null
  const shownCount = finished ? count : lastLanded ? lastLanded.source + 1 : 0
  const periodEnd = finished ? records[records.length - 1] : lastLanded ? records[lastLanded.source] : null
  const period = periodEnd
    ? `${records[0].date.slice(0, 7).replace("-", ".")} ~ ${periodEnd.date.slice(0, 7).replace("-", ".")}`
    : " "

  // 가장 높은 탑도 받침 위 공간 안에 들게 그릇 간격을 좁힌다(최대 13pt)
  const columnWidth = stageWidth / plans.length
  const bowlWidth = Math.max(0, Math.min(BOWL_VIEW_WIDTH, columnWidth - spacing.x1))
  const bowlHeight = (bowlWidth * BOWL_VIEW_HEIGHT) / BOWL_VIEW_WIDTH
  const tallest = Math.max(1, ...plans.map((plan) => plan.bowls.length))
  const gap = Math.min(TOWER_MAX_GAP, (TOWER_STAGE_HEIGHT - TOWER_HEADROOM) / tallest)

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
        <View accessible accessibilityLabel={`${count}그릇을 정리하고 있어요`} accessibilityRole="header" ref={titleRef}>
          <AppText style={styles.center} variant="headline">{LOADING_TITLES[phase]}</AppText>
        </View>
        <AppText style={[styles.center, styles.loadingCounter]} testID="report-bowl-counter" variant="counter">
          {shownCount}
          <AppText style={styles.tabular} variant="sectionTitle">그릇</AppText>
        </AppText>
        <AppText capScale style={[styles.center, styles.tabular, styles.loadingPeriod]} testID="report-bowl-period" tone="muted" variant="meta">
          {period}
        </AppText>
        <View style={styles.loadingSheet}>
          <View style={styles.loadingSheetHead}>
            <AppText variant="cardTitle">라멘 취향 감정서</AppText>
            <AppText capScale style={styles.tabular} tone="muted" variant="meta">
              No. {membershipNo.replace(/^#/, "")}
            </AppText>
          </View>
          <View
            accessible
            accessibilityLabel={
              highlighted
                ? `${count}그릇을 종류별로 쌓았어요. ${towers.map((tower) => `${tower.type} ${tower.count}그릇`).join(", ")}`
                : `기록 순서대로 ${icons.length}개 그릇을 종류별로 쌓고 있어요`
            }
            accessibilityRole="image"
            testID="report-bowl-stage"
          >
            <View onLayout={(event) => setStageWidth(event.nativeEvent.layout.width)} style={styles.towerStage}>
              {plans.map((plan, column) => (
                <TasteTower
                  bowlHeight={bowlHeight}
                  bowlWidth={bowlWidth}
                  gap={gap}
                  highlightAt={schedule.highlightAt}
                  key={plan.type}
                  left={column * columnWidth + (columnWidth - bowlWidth) / 2}
                  plan={plan}
                  reducedMotion={reducedMotion}
                  winner={winners.includes(plan.type)}
                />
              ))}
            </View>
            <View style={styles.towerLabels}>
              {plans.map((plan) => (
                <TowerLabel
                  count={plan.count}
                  done={plan.bowls.length ? landed > plan.lastOrder : highlighted}
                  highlightAt={schedule.highlightAt}
                  highlighted={highlighted}
                  key={plan.type}
                  reducedMotion={reducedMotion}
                  type={plan.type}
                  winner={winners.includes(plan.type)}
                />
              ))}
            </View>
          </View>
          {sampleRatio ? (
            <AppText capScale style={styles.loadingScaleNote} tone="muted" variant="meta">
              그릇 1개 ≈ {sampleRatio}그릇 · 전체 {count}그릇
            </AppText>
          ) : null}
        </View>
        <View style={styles.loadingResultSlot}>
          {complete ? (
            <Animated.View style={[styles.loadingResult, resultStyle]} testID="report-bowl-result">
              <AppText style={styles.center} variant="headline">{identity.title}</AppText>
              <AppText style={[styles.center, styles.tabular]} tone="muted" variant="secondary">
                {count}그릇 중 {winners.join("·")} {tied ? "각 " : ""}{topCount}그릇 · {topPercent}%
              </AppText>
            </Animated.View>
          ) : null}
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
  const insets = useSafeAreaInsets()
  const { currentUser } = useRaota()
  const { data: recordCount, isLoading } = useBowlCount()
  const { data: taste } = useTasteProfile()
  const { data: identity } = useTasteIdentity()
  const { data: bowls } = useMyBowls()
  const { data: visits } = useVisitedShops()
  const { data: shops } = useLocalShops()
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
  const favoriteShop = topShops[0] ? shopByName(topShops[0].name) : undefined
  const updatedLabel = generatedAt ? `${seoulToday().replace(/-/g, ".")} ${generatedAt}에 다시 정리함` : `${seoulToday().replace(/-/g, ".")} 기준`

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
    setToast(`전체 ${bowls.length}그릇으로 취향을 다시 정리했어요`)
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
          {recordCount === 0 ? (
            <View style={styles.top}>
              <TasteReportCover identity={identity} updatedLabel={updatedLabel} />
            </View>
          ) : (
            <View style={styles.story}>
              <TasteStory
                bowls={bowls}
                identity={identity}
                onOpenFavorite={favoriteShop ? () => openShop(favoriteShop) : undefined}
                // 아래 종류별 막대와 같은 원천(그릇 목록)으로 센다. 프로필 카운터와 어긋나면 한 화면에 숫자가 둘이 된다
                recordCount={bowls.length}
                scores={profile.scores}
                typeCounts={typeCounts}
                visits={visits}
              />
              <AppText capScale style={[styles.center, styles.tabular, styles.gapTop2]} tone="muted" variant="meta">{updatedLabel}</AppText>
            </View>
          )}

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
                              <Image contentFit="cover" source={{ uri: sizedImageUri(visit.photo, 48) }} style={styles.thumbImage} transition={150} />
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
                          <Image contentFit="cover" source={{ uri: sizedImageUri(suggestion.shop.photos[0], 48) }} style={styles.thumbImage} transition={150} />
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
                            <Image contentFit="cover" source={{ uri: sizedImageUri(suggestion.shop.photos[1] ?? suggestion.shop.photos[0], 48) }} style={styles.thumbImage} transition={150} />
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

              {/* 공유는 오른쪽 위 헤더에 있다. 끝에는 그릇을 처음부터 다시 채워 리포트를 새로 뽑는 버튼만 둔다(사용자 결정 2026.10.20) */}
              <View style={[styles.block, styles.bottom]}>
                <Button
                  fullWidth
                  leftIcon={<RotateCw color={colors.ink} size={16} />}
                  onPress={restart}
                  title="리포트 다시 뽑기"
                  variant="secondary"
                />
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
      {/* 이야기 카드가 왼쪽 끝까지 가로로 넘어가서, 헤더 아래 가장자리는 뒤로 쓸기에 양보한다 */}
      {recordCount > 0 ? <EdgeBackZone top={insets.top + 56} /> : null}
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
  pressedWash: { backgroundColor: colors.surfacePressed },
  scroll: { paddingBottom: spacing.x8 },
  top: { paddingHorizontal: spacing.gutter, paddingTop: spacing.x4 },
  // 이야기 카드는 화면 끝까지 넘어가야 해서 좌우 여백을 TasteStory가 직접 둔다
  story: { paddingTop: spacing.x4 },
  section: { marginHorizontal: spacing.gutter, marginTop: spacing.section },
  sectionContent: { marginTop: spacing.x3 },
  block: { paddingHorizontal: spacing.gutter, paddingVertical: spacing.x5 },
  // 화면 끝 여백은 scroll의 paddingBottom 하나로만 둔다. 마지막 구획이 아래 여백을 또 두면 끝이 비어 보인다
  emptySection: { paddingTop: spacing.x10, paddingBottom: 0, alignItems: "stretch" },
  bottom: { marginTop: spacing.x5, paddingBottom: 0 },
  card: { backgroundColor: colors.canvasSoft, borderRadius: radii.lg, padding: spacing.x5 },
  coverHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.x2, minHeight: (typography.meta.lineHeight ?? 18) * 2 },
  coverDate: { flex: 1, minWidth: 0, textAlign: "right" },
  coverBadge: { paddingHorizontal: spacing.x3, paddingVertical: spacing.x1_5, borderRadius: radii.pill, overflow: "hidden", backgroundColor: colors.selected, color: colors.onSelected, fontWeight: "700" },
  coverTitle: { marginTop: spacing.x4 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x1_5, marginTop: spacing.x3 },
  coverTag: { backgroundColor: colors.paper, borderRadius: radii.pill, overflow: "hidden", paddingHorizontal: spacing.x3, paddingVertical: spacing.x1_5, fontWeight: "700", fontSize: 13, lineHeight: 18 },
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
  loadingBody: { flexGrow: 1, alignItems: "center", paddingHorizontal: spacing.gutter, paddingTop: spacing.x6, paddingBottom: spacing.x8 },
  loadingCounter: { marginTop: spacing.x1_5 },
  loadingPeriod: { marginTop: spacing.x1, minHeight: typography.meta.lineHeight },
  loadingSheet: { alignSelf: "center", width: "100%", maxWidth: LOADING_SHEET_MAX_WIDTH, backgroundColor: colors.canvasSoft, borderRadius: radii.lg, padding: spacing.x4, marginTop: spacing.x4_5 },
  loadingSheetHead: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: spacing.x1 },
  // 받침선은 hairline 하나. 그릇은 그 위에 절대 위치로 쌓이고 개수 자리는 아래 줄에 미리 잡아 둔다.
  // 떨어지는 그릇은 이 칸 위쪽 끝에서 나타나게 잘라, 감정서 제목이나 위 숫자 위로 넘어가지 않게 한다
  towerStage: { height: TOWER_STAGE_HEIGHT, marginTop: spacing.x2_5, borderBottomWidth: line.hair, borderBottomColor: colors.border, overflow: "hidden" },
  tower: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, pointerEvents: "none" },
  towerBowl: { position: "absolute", transformOrigin: "bottom" },
  towerLabels: { flexDirection: "row", paddingTop: spacing.x1_5 },
  towerLabel: { flex: 1, minWidth: 0, alignItems: "center" },
  towerCountSlot: { minHeight: typography.sectionTitle.lineHeight, justifyContent: "flex-end" },
  winnerCount: { color: colors.brandText },
  loadingScaleNote: { textAlign: "center", marginTop: spacing.x2 },
  loadingResultSlot: { alignSelf: "stretch", minHeight: spacing.x5 + (typography.headline.lineHeight ?? 34) * 2 + spacing.x1 + (typography.secondary.lineHeight ?? 20) },
  loadingResult: { gap: spacing.x1, marginTop: spacing.x5 },
  loadingFooter: { alignItems: "center", paddingHorizontal: spacing.x6, paddingBottom: spacing.x4, paddingTop: spacing.x2 },
})
