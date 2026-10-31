import { t, ph, msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core"
import { formatDate, formatList, getLocale, labelOf, translate } from "@raota/shared"
import { useLocale } from "@/src/i18n"
import * as Haptics from "expo-haptics"
import * as Location from "expo-location"
import { router, useLocalSearchParams } from "expo-router"
import { usePreventRemove } from "expo-router/react-navigation"
import { ArrowRight, Check, ChevronRight, Sparkles, Ticket } from "lucide-react-native"
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type ViewProps,
  findNodeHandle,
  useWindowDimensions,
} from "react-native"
import Animated, { Easing, cancelAnimation, interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming, type SharedValue } from "react-native-reanimated"
import Svg, { Line } from "react-native-svg"
import type { Edge } from "react-native-safe-area-context"

import { type Shop, type ShopCatalogItem, type TasteReport } from "@raota/shared"
import { track } from "@/src/analytics"
import { isApiError } from "@/src/api/client"
import { isRemote } from "@/src/api/config"
import type { RecommendationRequest } from "@/src/api/types"
import { ResilientUriImage } from "@/src/components/ResilientUriImage"
import { TodayTicketsSheet } from "@/src/components/TodayTicketsSheet"
import { AppText, Button, ConfirmDialog, EmptyState, Header, LoadingState, Screen, StickyActionBar, Toast } from "@/src/components/ui"
import { useAllShops, useMyBowls, useTasteProfile } from "@/src/data/hooks"
import { knownTicket, remoteReads, remoteWrites, type RemoteTicket, type RemoteTodayTickets } from "@/src/data/remote"
import { matchesSoupChoice, rankShopsForAIRecommendation, shopSoupLabel } from "@/src/domain/ai-recommendation"
import { pickFirstTicket } from "@/src/domain/firstTicket"
import { completeOnboardingTask } from "@/src/onboarding"
import { curatorTasteReport } from "@/src/domain/curatorTaste"
import { useRaota } from "@/src/state/RaotaStore"
import { colors, line, maxFontScale, radii, soupColorOf, spacing, ticketInk, ticketPaperOf, touchTarget, typography, usePalette } from "@/src/theme"
import { useKnownLocation, type Coordinates } from "@/src/location"

/** 식권 자판기 버튼이 눌려 들어가는 깊이 */
const BUTTON_SINK = 2

type CuratorShop = Shop & Partial<Pick<ShopCatalogItem, "style" | "spec">>
type Step = 1 | 2 | 3 | 4 | "where" | "loading" | "result"

const ALL_EDGES: Edge[] = ["top", "left", "right", "bottom"]

// value는 서버·랭킹·매장 종류 대조에 쓰는 저장 값이라 번역하지 않는다. 화면에는 label·sub만 번역해 보여 준다
const SOUP_OPTIONS = [
  { id: "shoyu", value: "쇼유", label: msg`쇼유`, sub: msg`간장 타레`, keys: ["쇼유"] },
  { id: "tonkotsu", value: "돈코츠", label: msg`돈코츠`, sub: msg`돼지뼈 육수`, keys: ["돈코츠"] },
  { id: "ieke", value: "이에케", label: msg`이에케`, sub: msg`돈코츠쇼유`, keys: ["이에케"] },
  { id: "shio", value: "시오", label: msg`시오`, sub: msg`소금 타레`, keys: ["시오"] },
  { id: "miso", value: "미소", label: msg`미소`, sub: msg`된장 타레`, keys: ["미소"] },
  { id: "tori", value: "토리파이탄", label: msg`토리파이탄`, sub: msg`닭백탕`, keys: ["토리파이탄", "토리빠이탄", "닭백탕", "파이탄"] },
  { id: "niboshi", value: "니보시", label: msg`니보시`, sub: msg`멸치 육수`, keys: ["니보시", "멸치"] },
  { id: "jiro", value: "지로", label: msg`지로`, sub: msg`숙주·마늘 산더미`, keys: ["지로", "지로계", "지로케"] },
  { id: "tsukemen", value: "츠케멘", label: msg`츠케멘`, sub: msg`찍어 먹는 면`, keys: ["츠케멘"] },
]

// sub은 고르는 뜻을 풀어 쓴 말이다. 매장 정보로 거르는 조건처럼 들리게 쓰지 않는다(상황은 대조할 정보가 없어 "참고"로만 쓴다)
const MOOD_OPTIONS = [
  { id: "solo", value: "혼밥하기 좋은 곳", label: msg`혼밥하기 좋은 곳`, sub: msg`혼자 편하게` },
  { id: "date", value: "데이트/아늑한 분위기", label: msg`데이트/아늑한 분위기`, sub: msg`둘이 오래 머물기` },
  { id: "waiting", value: "웨이팅 감수 맛집", label: msg`웨이팅 감수 맛집`, sub: msg`줄 서도 가는 곳` },
  { id: "quick", value: "빠르고 든든한 한 끼", label: msg`빠르고 든든한 한 끼`, sub: msg`빨리 먹고 나가기` },
]

const PRIORITY_OPTIONS = [
  { id: "rich", value: "진하고 묵직한 국물", label: msg`진하고 묵직한 국물`, sub: msg`백탕 · 농후`, keys: ["진한", "농후", "백탕", "이에케", "돈코츠", "적된장"] },
  { id: "noodle", value: "탱글탱글 자가제면", label: msg`탱글탱글 자가제면`, sub: msg`직접 뽑은 면`, keys: ["자가제면", "치지레멘"] },
  { id: "chashu", value: "두툼하고 부드러운 차슈", label: msg`두툼하고 부드러운 차슈`, sub: msg`토핑이 주인공`, keys: ["차슈"] },
  { id: "clean", value: "깔끔하고 깊은 감칠맛", label: msg`깔끔하고 깊은 감칠맛`, sub: msg`청탕 · 맑은 국물`, keys: ["깔끔", "맑은", "청탕", "감칠맛", "시오"] },
]

// 큐레이터가 매장 정보와 실제로 대조할 수 있는 조건만 내놓는다(curate의 직접 입력 대조와 짝이 맞아야 한다).
// 입력칸에는 대조 규칙과 맞도록 value(한국어)를 넣고, 버튼에는 label을 번역해 보여 준다
const QUICK_PROMPTS = [
  { value: "차슈가 푸짐한 곳", label: msg`차슈가 푸짐한 곳` },
  { value: "지금 영업 중인 곳", label: msg`지금 영업 중인 곳` },
  { value: "밥 무료 제공", label: msg`밥 무료 제공` },
  { value: "면 리필 가능한 곳", label: msg`면 리필 가능한 곳` },
]

const STEP_TITLES: Record<1 | 2 | 3 | 4, { title: MessageDescriptor; help: MessageDescriptor }> = {
  1: { title: msg`오늘 어떤 국물이 당기나요?`, help: msg`맑은 청탕부터 묵직한 백탕까지 골라보세요.` },
  2: { title: msg`어떤 상황에서 드시나요?`, help: msg`지금 갈 수 있는 곳과 여유 있는 방문을 구분해 추천해요.` },
  3: { title: msg`한 그릇에서 가장 포기할 수 없는 것은?`, help: msg`가게 특징과 태그에 이 요소가 있는 곳을 먼저 찾아요.` },
  4: {
    title: msg`더 바라는 점이 있나요?`,
    help: msg`선택 사항이에요. 영업 중, 밥, 차슈처럼 매장 정보와 대조할 수 있는 조건은 결과에 반영돼요.`,
  },
}

const LOADING_MESSAGES = [msg`선택한 조건을 확인하고 있어요`, msg`어울리는 라멘집을 찾고 있어요`, msg`식권을 뽑고 있어요`, msg`오늘의 추천이 준비됐어요`]
/**
 * 조건 칩을 하나씩 밝히면 식권기 투입구에서 색종이 식권이 아랫단(날짜·매수)부터 내려온다(사용자 결정 2026.10.26, 식권 B안).
 * 결과가 준비되면 가게 이름까지 다 내려오고, 결과 화면으로는 완성된 식권을 RESULT_HOLD만큼 보여 준 뒤 넘어간다.
 */
/** 식권이 나오는 투입구 두께. 식권은 투입구 가운데 줄 아래에서 나타난다 */
const SLOT_HEIGHT = 12
const KEY_START = 300
const KEY_INTERVAL = 500
const STUB_SLIDE = 600
const STUB_HOLD = 900
const TICKET_SETTLE = 900
const RESULT_HOLD = 2000
const PROMPT_MAX_LENGTH = 200
/** 서버 추천을 만들지 못해 인기순으로 대신 보여 줄 때 */
const POPULAR_FALLBACK_NOTE = msg`지금은 AI 추천을 만들 수 없어 인기 라멘집을 보여드려요`
const RATE_LIMITED_MESSAGE = msg`잠시 후 다시 시도해 주세요`
const DAILY_LIMIT_MESSAGE = msg`오늘 식권을 다 뽑았어요. 내일 다시 뽑을 수 있어요`

interface Inputs {
  soupId: string
  moodId: string
  priorityId: string
  prompt: string
}

interface Condition {
  /** 목록 key. 서버 조건은 받은 이름, 로컬 조건은 고정 id */
  key: string
  applied: boolean
  /** 화면에 보이는 이름. 로컬 조건은 언어를 바꿔도 결과가 그대로 남도록 그릴 때 번역한다 */
  label: () => string
  /** 덧붙이는 설명. 서버가 준 조건은 이름만 있어 null */
  note: (() => string) | null
}

/** 서버가 준 조건은 화면에 그대로 보여주는 말이라 덧붙이는 설명 없이 이름만 쓴다 */
const serverCondition = (label: string): Condition => ({ key: label, applied: true, label: () => label, note: null })

interface Candidate {
  shop: CuratorShop
  /** 사진 위·식권의 종류 이름. 고른 국물과 맞은 매장이면 고른 이름 그대로 쓴다 */
  typeLabel: string
  /**
   * 서버 AI가 쓴 이 매장의 추천 이유. 없으면(로컬 추천·이유 생성 실패) 고른 조건 목록을 대신 보여준다.
   * "다시 추천받기"로 후보를 바꿀 때 앞 매장의 이유가 남지 않도록 늘 키를 둔다
   */
  reason: string | null
}

interface Curation extends Candidate {
  conditions: Condition[]
  /** 조건으로 고르지 못해 인기·거리순으로 대신 골랐는지 */
  fallback: boolean
  /** 대신 고른 이유. 없으면 로컬 인기·거리순 안내를 쓴다 */
  fallbackNote?: MessageDescriptor
  /** "다시 추천받기"가 차례로 보여 줄 후보(순위순). 지금 보이는 것은 candidates[index] */
  candidates: Candidate[]
  index: number
  /** 서버 추천의 노출 기록 ID. 매장을 열면 이 ID로 알린다. 로컬·대체(인기순) 추천과 기록 실패는 null */
  recommendationId: string | null
  /** 뽑아 둔 식권을 다시 열 때 그 식권을 뽑은 시각(ISO). 지난 식권이면 머리글과 식권 날짜를 그날로 적는다 */
  issuedAt?: string
}

/**
 * 아무것도 고르지 않은 상태로 시작한다. 미리 골라 두면 "다음"만 눌러도
 * 결과가 고르지 않은 조건을 "반영"이라고 말하게 된다.
 */
const DEFAULT_INPUTS: Inputs = { soupId: "", moodId: "", priorityId: "", prompt: "" }

/** 고른 조건은 실제 네 단계와 같은 이름으로 표시한다. 아직 고르지 않은 값은 빈 문자열(칸에는 이름만 남는다) */
function chosenConditions(inputs: Inputs) {
  const soup = SOUP_OPTIONS.find((option) => option.id === inputs.soupId)
  const mood = MOOD_OPTIONS.find((option) => option.id === inputs.moodId)
  const priority = PRIORITY_OPTIONS.find((option) => option.id === inputs.priorityId)
  return [
    { label: t`국물`, value: soup ? translate(soup.label) : "" },
    { label: t`상황`, value: mood ? translate(mood.label) : "" },
    { label: t`중요`, value: priority ? translate(priority.label) : "" },
    { label: t`추가`, value: inputs.prompt.trim() },
  ]
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)
const CHOICE_EASE = Easing.bezier(0.22, 1, 0.36, 1)
const SETTLE_EASE = Easing.bezier(0.34, 1.56, 0.64, 1)

/**
 * 조건의 선택 색과 눌림만 바꿔 격자 크기는 그대로 둔다.
 * sink: 식권 자판기 버튼처럼 누르거나 고르면 2pt 눌려 들어간다(크기 대신 위치). 바탕은 자판기 면 위의 canvas
 */
function useChoiceMotion(selected: boolean, { sink = false }: { sink?: boolean } = {}) {
  const palette = usePalette()
  const reducedMotion = useReducedMotion()
  const selection = useSharedValue(selected ? 1 : 0)
  const scale = useSharedValue(1)
  const press = useSharedValue(0)
  // 동작 줄이기에서는 크기 변화 대신 즉시 바뀌는 투명도로 눌림을 알린다(공용 칩과 같은 규칙)
  const pressOpacity = useSharedValue(1)
  const base = sink ? palette.canvas : palette.canvasSoft

  useEffect(() => {
    selection.value = reducedMotion ? (selected ? 1 : 0) : withTiming(selected ? 1 : 0, { duration: 200, easing: CHOICE_EASE })
    if (reducedMotion) scale.value = 1
  }, [selected, reducedMotion, selection, scale])

  const containerStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(selection.value, [0, 1], [base, palette.selected]),
    transform: sink
      ? [{ translateY: reducedMotion ? 0 : BUTTON_SINK * Math.max(selection.value, press.value) }]
      : [{ scale: scale.value }],
    opacity: pressOpacity.value,
  }), [palette, base, sink, reducedMotion])
  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(selection.value, [0, 1], [palette.ink, palette.onSelected]),
  }), [palette])
  const subStyle = useAnimatedStyle(() => ({
    color: interpolateColor(selection.value, [0, 1], [palette.textMuted, palette.onSelected]),
    opacity: 1 - 0.28 * selection.value,
  }), [palette])

  const pressIn = () => {
    if (reducedMotion) pressOpacity.value = 0.6
    else if (sink) press.value = withTiming(1, { duration: 80 })
    else scale.value = withTiming(0.97, { duration: 120 })
  }
  const pressOut = () => {
    pressOpacity.value = 1
    press.value = reducedMotion ? 0 : withTiming(0, { duration: 160, easing: CHOICE_EASE })
    scale.value = reducedMotion ? 1 : withTiming(1, { duration: 180, easing: CHOICE_EASE })
  }

  return { containerStyle, textStyle, subStyle, pressIn, pressOut }
}

function ChosenConditionCell({ label, value }: { label: string; value: string }) {
  const filled = value !== ""
  const palette = usePalette()
  const reducedMotion = useReducedMotion()
  const wasFilled = useRef(filled)
  const selection = useSharedValue(filled ? 1 : 0)
  const settle = useSharedValue(1)
  const reveal = useSharedValue(1)

  useEffect(() => {
    selection.value = reducedMotion ? (filled ? 1 : 0) : withTiming(filled ? 1 : 0, { duration: 200, easing: CHOICE_EASE })
    if (!reducedMotion && filled && !wasFilled.current) {
      settle.value = 0.94
      settle.value = withTiming(1, { duration: 350, easing: SETTLE_EASE })
      reveal.value = 0
      reveal.value = withTiming(1, { duration: 300, easing: CHOICE_EASE })
    } else if (reducedMotion || !filled) {
      settle.value = 1
      reveal.value = 1
    }
    wasFilled.current = filled
  }, [filled, reducedMotion, selection, settle, reveal])

  const cellStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(selection.value, [0, 1], [palette.canvasSoft, palette.selected]),
    transform: [{ scale: settle.value }],
  }), [palette])
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(selection.value, [0, 1], [palette.textMuted, palette.onSelected]),
  }), [palette])
  const valueStyle = useAnimatedStyle(() => ({
    color: interpolateColor(selection.value, [0, 1], [palette.textMuted, palette.onSelected]),
    opacity: reveal.value,
    transform: [{ translateY: (1 - reveal.value) * 8 }],
  }), [palette])

  return (
    <Animated.View style={[styles.chosenChip, cellStyle]} testID={`ai-condition-${label}`}>
      <Animated.Text maxFontSizeMultiplier={maxFontScale} style={[typography.meta, styles.chosenLabel, labelStyle]}>
        {label}
      </Animated.Text>
      {/* 아직 고르지 않은 칸은 이름만 둔다("—" 같은 빈 값 표시는 쓰지 않는다). 칸 높이는 고정이라 채워져도 밀리지 않는다 */}
      {filled ? (
        <Animated.Text
          lineBreakStrategyIOS="hangul-word"
          maxFontSizeMultiplier={maxFontScale}
          numberOfLines={2}
          style={[typography.meta, styles.chosenValue, valueStyle]}
        >
          {value}
        </Animated.Text>
      ) : null}
    </Animated.View>
  )
}

function QuickPromptTile({ text, added, onPress }: { text: string; added: boolean; onPress: () => void }) {
  const motion = useChoiceMotion(added)
  return (
    <AnimatedPressable
      accessibilityLabel={added ? t`${ph({ v1: text })}, 추가됨` : t`${ph({ v1: text })} 추가`}
      accessibilityRole="button"
      accessibilityState={{ selected: added, disabled: added }}
      disabled={added}
      onPress={() => {
        motion.pressOut()
        onPress()
      }}
      onPressIn={motion.pressIn}
      onPressOut={motion.pressOut}
      style={[styles.quickChip, motion.containerStyle]}
    >
      <Animated.Text maxFontSizeMultiplier={maxFontScale} style={[typography.secondary, styles.quickText, motion.textStyle]}>
        {text}
      </Animated.Text>
    </AnimatedPressable>
  )
}

/**
 * 식권 자판기 버튼(사용자 결정 2026.10.20 · 방안 C, 번호는 빼고 고른 표시는 체크로). 누르면 2pt 눌려 들어가며
 * 고르면 눌린 채 오른쪽 위에 흰 동그라미 체크가 붙는다. 버튼 아래 2pt 턱은 테두리가 아니라 면 한 장(secondary)이다
 */
function TicketButton({
  label,
  sub,
  soupType,
  selected,
  onPress,
  compact = false,
}: {
  label: string
  sub: string
  soupType?: string
  selected: boolean
  onPress: () => void
  /** 국물 아홉 개를 3×3으로 한 화면에 담는다(사용자 결정 2026.11.01) */
  compact?: boolean
}) {
  const motion = useChoiceMotion(selected, { sink: true })
  return (
    <View style={[styles.ticketButtonSlot, compact && styles.ticketButtonSlotCompact]}>
      <View style={styles.ticketButtonLip} />
      <AnimatedPressable
        accessibilityLabel={`${label}, ${sub}`}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        onPress={onPress}
        onPressIn={motion.pressIn}
        onPressOut={motion.pressOut}
        style={[styles.ticketButton, compact && styles.ticketButtonCompact, motion.containerStyle]}
      >
        {selected ? (
          <View style={[styles.checkBadge, compact && styles.checkBadgeCompact]}>
            <Check color={colors.ink} size={compact ? 12 : 14} strokeWidth={3} />
          </View>
        ) : null}
        <Animated.Text
          lineBreakStrategyIOS="hangul-word"
          maxFontSizeMultiplier={compact ? maxFontScale : undefined}
          numberOfLines={compact ? 1 : undefined}
          style={[typography.cardTitle, compact && styles.compactLabel, motion.textStyle]}
        >
          {label}
        </Animated.Text>
        <Animated.Text
          lineBreakStrategyIOS="hangul-word"
          maxFontSizeMultiplier={maxFontScale}
          numberOfLines={compact ? 1 : undefined}
          style={[typography.meta, styles.optionSub, motion.subStyle]}
        >
          {sub}
        </Animated.Text>
        {soupType ? <View style={[styles.soupSwatch, compact && styles.soupSwatchCompact, { backgroundColor: soupColorOf(soupType) }]} /> : null}
      </AnimatedPressable>
    </View>
  )
}

/** 고르는 단계(1~3)의 버튼 묶음을 식권 자판기 면에 담는다. 머리줄과 아래 투입구 줄은 장식이라 읽지 않는다 */
function TicketMachine({ step, picked, hint, children }: { step: 1 | 2 | 3; picked: string; hint: string; children: ReactNode }) {
  return (
    <View style={styles.machine}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.machineHead}>
        <AppText capScale style={styles.machineBrand} variant="meta">{t`RAOTA 식권`}</AppText>
        <AppText capScale tone="muted" variant="meta">{t`${ph({ step })}단계`}</AppText>
      </View>
      {children}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.machineSlot}>
        <View style={styles.machineSlotBar} />
        <AppText capScale numberOfLines={1} tone="muted" variant="meta">{picked ? t`${ph({ v1: picked })} 골랐어요` : hint}</AppText>
      </View>
    </View>
  )
}

const shopText = (shop: CuratorShop) => [shop.style, shop.spec, shop.description, ...shop.tags].filter(Boolean).join(" ")
const hasAnyKey = (shop: CuratorShop, keys: string[]) => keys.some((key) => shopText(shop).includes(key))
const byPopularity = (a: CuratorShop, b: CuratorShop) =>
  b.reviewCount - a.reviewCount || b.rating - a.rating || a.distanceM - b.distanceM

/**
 * 고른 국물과 맞은 매장은 종류도 고른 이름으로 적는다(사진 위 표시·식권·조건 줄이 같은 말을 쓴다).
 * 다시 보는 식권처럼 고른 국물을 모르면 매장 자신의 종류를 쓴다
 */
function candidateFor(shop: CuratorShop, soup: (typeof SOUP_OPTIONS)[number] | undefined, reason: string | null = null): Candidate {
  return { shop, typeLabel: soup && matchesSoupChoice(shop, soup.value, soup.keys) ? soup.value : shopSoupLabel(shop), reason }
}

/**
 * 선택한 조건을 원장과 실제로 대조해 후보를 좁히고(웹 AIRecommendScreen과 같은 규칙),
 * 남은 후보 안에서 src/domain/ai-recommendation 랭킹(내 취향 포함)으로 순서를 매긴다.
 * 대조할 정보가 없는 조건은 applied=false("참고했어요")로 남긴다. 랭킹이 실패하거나 후보가 없으면 인기·거리순으로 대신한다.
 * 서버 추천(#46)을 쓰는 빌드에서는 curateRemote가 대신한다.
 */
function curate(shops: CuratorShop[], inputs: Inputs, taste: TasteReport | null): Curation | null {
  const all = shops.filter((shop) => shop.lat && shop.lng)
  if (all.length === 0) return null
  const conditions: Condition[] = []
  let pool = all
  let byDistance = false

  const narrow = (predicate: (shop: CuratorShop) => boolean) => {
    const next = pool.filter(predicate)
    if (next.length === 0) return false
    pool = next
    return true
  }

  // 국물은 지도 필터와 같은 종류 판정으로만 맞춘다. 소개글 낱말로 맞추면 쇼유를 골라도 이에케가 나온다
  const soup = SOUP_OPTIONS.find((option) => option.id === inputs.soupId) ?? SOUP_OPTIONS[0]
  const soupMatches = (shop: CuratorShop) => matchesSoupChoice(shop, soup.value, soup.keys)
  const soupLine = () => t`${ph({ soup: translate(soup.label) })} 계보`
  if (narrow(soupMatches)) {
    const count = pool.length
    conditions.push({ key: "soup", label: soupLine, applied: true, note: () => t`${ph({ soup: translate(soup.label) })} 계보 ${ph({ count })}곳 중에서 골랐어요` })
  } else {
    conditions.push({ key: "soup", label: soupLine, applied: false, note: () => t`전체 라멘집으로 넓혀서 골라 봤어요` })
  }

  const mood = MOOD_OPTIONS.find((option) => option.id === inputs.moodId) ?? MOOD_OPTIONS[0]
  const moodLine = () => translate(mood.label)
  if (mood.id === "quick") {
    const opened = narrow((shop) => shop.businessStatus === "OPERATIONAL" && shop.isOpen)
    byDistance = true
    conditions.push({
      key: "mood",
      label: moodLine,
      applied: true,
      note: opened ? () => t`지금 영업 중이고 가까운 곳을 우선했어요` : () => t`가까운 곳부터 우선했어요`,
    })
  } else if (mood.id === "waiting") {
    if (narrow((shop) => shop.reviewCount > 0 || shop.rating > 0)) {
      conditions.push({ key: "mood", label: moodLine, applied: true, note: () => t`라멘로그와 평점이 쌓인 곳을 우선했어요` })
    } else {
      conditions.push({ key: "mood", label: moodLine, applied: false, note: () => t`라멘로그가 더 쌓이면 이 조건도 꼼꼼히 맞춰 드릴게요` })
    }
  } else {
    conditions.push({ key: "mood", label: moodLine, applied: false, note: () => t`매장 분위기 정보가 채워지면 더 꼭 맞게 골라 드릴게요` })
  }

  const priority = PRIORITY_OPTIONS.find((option) => option.id === inputs.priorityId)
  if (priority) {
    const priorityLine = () => translate(priority.label)
    if (narrow((shop) => hasAnyKey(shop, priority.keys))) {
      conditions.push({ key: "priority", label: priorityLine, applied: true, note: () => t`가게 특징과 태그에 이 요소가 있는 곳을 우선했어요` })
    } else {
      conditions.push({ key: "priority", label: priorityLine, applied: false, note: () => t`이 특징이 적힌 가게가 늘면 더 정확히 골라 드릴게요` })
    }
  }

  // QUICK_PROMPTS는 여기서 대조하는 조건만 내놓는다. 대조하지 못한 말은 "참고"로 남긴다
  const prompt = inputs.prompt.trim()
  if (prompt) {
    const applied: MessageDescriptor[] = []
    if (/영업 ?중|지금 ?여/.test(prompt) && narrow((shop) => shop.isOpen)) applied.push(msg`지금 영업 중`)
    if (prompt.includes("밥") && narrow((shop) => Boolean(shop.servicePerks?.riceRefill?.includes("무료")))) applied.push(msg`공깃밥 무료`)
    if (prompt.includes("차슈") && narrow((shop) => hasAnyKey(shop, ["차슈"]))) applied.push(msg`차슈`)
    if (/면.*(리필|무료)|(리필|무료).*면/.test(prompt)) {
      if (narrow((shop) => Boolean(shop.servicePerks?.noodleRefill?.includes("무료")))) applied.push(msg`면 무료 리필`)
    } else if (prompt.includes("면") && narrow((shop) => hasAnyKey(shop, ["자가제면", "치지레멘", "면"]))) {
      applied.push(msg`면`)
    }
    const promptLine = () => t`직접 입력: ${ph({ prompt })}`
    conditions.push(
      applied.length
        ? { key: "prompt", label: promptLine, applied: true, note: () => t`${ph({ matched: formatList(applied.map(translate)) })} 조건을 매장 정보와 대조했어요` }
        : { key: "prompt", label: promptLine, applied: false, note: () => t`적어 주신 조건은 매장 정보가 채워지는 대로 맞춰 드릴게요` },
    )
  }

  let ranked: CuratorShop[] = []
  if (byDistance) {
    ranked = [...pool].sort((a, b) => a.distanceM - b.distanceM || byPopularity(a, b))
  } else {
    try {
      ranked = rankShopsForAIRecommendation(pool, {
        soup: soup.value,
        mood: mood.value,
        priority: priority?.value ?? "",
        prompt,
        currentTasteReport: taste,
      }).map(({ shop }) => shop as CuratorShop)
    } catch {
      ranked = []
    }
    // 랭킹이 실제로 내 취향 리포트를 받아 순서를 매긴 경우에만 알린다(빠른 한 끼는 거리순이라 쓰지 않는다)
    if (taste && ranked.length) {
      const count = taste.recordCount
      conditions.push({ key: "taste", label: () => t`내 취향`, applied: true, note: () => t`내 기록 ${ph({ count })}그릇의 취향을 반영했어요` })
    }
  }
  if (ranked.length) {
    const candidates = ranked.map((shop) => candidateFor(shop, soup))
    return { ...candidates[0], conditions, fallback: false, candidates, index: 0, recommendationId: null }
  }

  const fallbackCandidates = [...all].sort(byPopularity).map((shop) => candidateFor(shop, soup))
  return fallbackCandidates.length
    ? { ...fallbackCandidates[0], conditions, fallback: true, candidates: fallbackCandidates, index: 0, recommendationId: null }
    : null
}

/**
 * 처음 켠 비회원의 첫 식권(/ai-recommend?welcome=1, src/onboarding.ts). 서버 AI 추천은 회원만 쓸 수 있어
 * 국물·영업 중·거리(위치가 없으면 라멘로그 많은 순)로 앱이 고른다. 그래서 "AI가 썼어요"·"AI 맞춤"이라고 쓰지 않는다
 */
function firstTicketCuration(shops: CuratorShop[], inputs: Inputs, origin: Coordinates | null): Curation | null {
  const soup = SOUP_OPTIONS.find((option) => option.id === inputs.soupId) ?? SOUP_OPTIONS[0]
  const soupMatches = (shop: CuratorShop) => matchesSoupChoice(shop, soup.value, soup.keys)
  const pick = pickFirstTicket(shops, soupMatches, origin)
  if (!pick.ranked.length) return null
  const soupLine = () => t`${ph({ soup: translate(soup.label) })} 계보`
  const count = shops.filter((shop) => shop.lat && shop.lng && soupMatches(shop)).length
  const conditions: Condition[] = [
    pick.soupMatched
      ? { key: "soup", label: soupLine, applied: true, note: () => t`${ph({ soup: translate(soup.label) })} 계보 ${ph({ count })}곳 중에서 골랐어요` }
      : { key: "soup", label: soupLine, applied: false, note: () => t`전체 라멘집으로 넓혀서 골라 봤어요` },
    origin
      ? { key: "place", label: () => t`내 주변`, applied: true, note: pick.openOnly ? () => t`지금 영업 중이고 가까운 곳을 우선했어요` : () => t`가까운 곳부터 우선했어요` }
      : {
          key: "place",
          label: () => t`인기 있는 곳`,
          applied: true,
          note: pick.openOnly ? () => t`지금 영업 중이고 라멘로그가 많이 쌓인 곳을 우선했어요` : () => t`라멘로그와 평점이 쌓인 곳을 우선했어요`,
        },
  ]
  const candidates = pick.ranked.slice(0, 20).map((shop) => candidateFor(shop, soup))
  return { ...candidates[0], conditions, fallback: false, candidates, index: 0, recommendationId: null }
}

/**
 * 서버 추천(#46). 고른 조건을 짧은 이름 그대로 보내고, 위치 권한이 이미 있을 때만 좌표를 함께 보낸다.
 * 서버가 추천을 만들지 못하면(503·연결 실패 등) 서버 인기순으로 대신한다. 로컬 원장은 서버 매장과 id가 달라 쓰지 않는다.
 * 요청이 너무 잦으면(429) 대신 고르지 않고 오류를 그대로 던진다.
 */
async function curateRemote(inputs: Inputs, origin: Coordinates | null): Promise<Curation | null> {
  const soup = SOUP_OPTIONS.find((option) => option.id === inputs.soupId) ?? SOUP_OPTIONS[0]
  const request: RecommendationRequest = {
    soup: soup.value,
    mood: MOOD_OPTIONS.find((option) => option.id === inputs.moodId)?.value,
    priority: PRIORITY_OPTIONS.find((option) => option.id === inputs.priorityId)?.value,
    text: inputs.prompt.trim() || undefined,
    ...(origin ?? {}),
  }
  try {
    const { recommendationId, shops, appliedConditions, reasons } = await remoteReads.recommendations(request)
    if (shops.length) {
      const candidates = shops.map((shop) => candidateFor(shop, soup, reasons[shop.id]?.trim() || null))
      const conditions = appliedConditions.map(serverCondition)
      return { ...candidates[0], conditions, fallback: false, candidates, index: 0, recommendationId }
    }
  } catch (error) {
    // 요청이 너무 잦거나 오늘 식권을 다 쓰면 인기순으로 대신 고르지 않고 화면이 알린다
    if (isApiError(error, "RATE_LIMITED") || isApiError(error, "DAILY_LIMIT_EXCEEDED")) throw error
  }
  try {
    const popular = await remoteReads.shops({ sort: "POPULAR", size: 6 })
    const candidates = popular.items.map((shop) => candidateFor(shop, soup))
    return candidates.length
      ? { ...candidates[0], conditions: [], fallback: true, fallbackNote: POPULAR_FALLBACK_NOTE, candidates, index: 0, recommendationId: null }
      : null
  } catch {
    return null
  }
}

/** 오늘 뽑은 식권을 다시 볼 때. 그때 보여준 매장 순서와 조건, 추천 이유를 그대로 쓴다 */
function curationFromTicket(ticket: RemoteTicket): Curation | null {
  const soup = SOUP_OPTIONS.find((option) => ticket.appliedConditions.includes(option.value))
  const candidates = ticket.shops.map((shop) => candidateFor(shop, soup, ticket.reasons[shop.id]?.trim() || null))
  if (!candidates.length) return null
  const conditions = ticket.appliedConditions.map(serverCondition)
  return { ...candidates[0], conditions, fallback: false, candidates, index: 0, recommendationId: ticket.id, issuedAt: ticket.createdAt }
}

/** 식권을 뽑은 날(서울). foot은 식권 아랫단의 "26.10.27", day는 "10월 27일", today는 오늘 뽑았는지 */
function issuedDay(iso: string): { foot: string; day: string; today: boolean } {
  const seoul = (date: Date) => new Date(date.getTime() + 9 * 60 * 60 * 1000)
  const at = seoul(new Date(iso))
  const now = seoul(new Date())
  const month = at.getUTCMonth() + 1
  const date = at.getUTCDate()
  return {
    foot: `${String(at.getUTCFullYear()).slice(-2)}.${String(month).padStart(2, "0")}.${String(date).padStart(2, "0")}`,
    day: getLocale() === "ko" ? `${month}월 ${date}일` : formatDate(iso, { month: "short", day: "numeric", timeZone: "Asia/Seoul" }),
    today: at.getUTCFullYear() === now.getUTCFullYear() && month === now.getUTCMonth() + 1 && date === now.getUTCDate(),
  }
}

/** 스크린리더 포커스를 새 제목으로 옮긴다 */
function focusOn(ref: React.RefObject<View | null>) {
  // 웹(react-native-web)에는 findNodeHandle이 없다. VoiceOver 포커스 이동은 iOS에서만 한다
  if (Platform.OS === "web" || !ref.current) return
  try {
    const node = findNodeHandle(ref.current)
    if (node) AccessibilityInfo.setAccessibilityFocus(node)
  } catch {
    // 포커스 이동 실패가 흐름을 막지 않는다
  }
}

export default function AIRecommendScreen() {
  const locale = useLocale()
  const { currentUser } = useRaota()
  const shopsQuery = useAllShops()
  const bowls = useMyBowls()
  const tasteProfile = useTasteProfile()
  const reducedMotion = useReducedMotion()
  const { width, fontScale } = useWindowDimensions()
  const ctaSize = useMemo(() => ({ minHeight: Math.max(56, 2 * (typography.button.lineHeight ?? 18) * Math.min(fontScale, maxFontScale) + 2 * spacing.x2) }), [fontScale])
  const compact = width < 360
  const [inputs, setInputs] = useState<Inputs>(DEFAULT_INPUTS)
  const selectedConditions = useMemo(() => chosenConditions(inputs), [inputs, locale])
  const [step, setStep] = useState<Step>(1)
  const [curation, setCuration] = useState<Curation | null>(null)
  // 식권 연출이 기다리는 준비 신호. 서버 추천은 응답 전에 발권 화면으로 넘어가 이 약속을 기다린다
  const [resultReady, setResultReady] = useState<Promise<Curation | null>>(() => Promise.resolve(null))
  // 발권 화면을 나가거나 다시 요청하면 앞선 응답은 버린다
  const requestSeq = useRef(0)
  const scrollRef = useRef<ScrollView>(null)
  const headingRef = useRef<View>(null)
  const [issueDate] = useState(() => {
    const now = new Date()
    return `${String(now.getFullYear()).slice(-2)}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`
  })

  const loggedIn = Boolean(currentUser?.isLoggedIn)
  const nickname = loggedIn ? currentUser?.nickname : null
  // 서버 추천은 회원 토큰이 있어야 부를 수 있다(auth가 서버일 때만 켜진다)
  const remoteCurator = isRemote("recommendations")
  const origin = useKnownLocation()
  // 추천 요청은 비용이 들어 한 번 누를 때 한 번만 보낸다. 상태 갱신 전에 다시 눌러도 막도록 ref로 잠근다
  const requestingRef = useRef(false)
  const [requesting, setRequesting] = useState(false)
  const [toast, setToast] = useState<MessageDescriptor | null>(null)
  // 서버 추천은 하루에 뽑을 수 있는 식권 수가 있다. 옛 서버(식권 없음)이거나 읽지 못하면 null이라 아무것도 막지 않고, 막는 일은 서버가 한다
  const ticketsEnabled = remoteCurator && loggedIn
  const [todayTickets, setTodayTickets] = useState<RemoteTodayTickets | null>(null)
  const [ticketsOpen, setTicketsOpen] = useState(false)
  // 식권은 하루 몇 장뿐이라 쓰기 전에 한 번 묻는다
  const [confirmingTicket, setConfirmingTicket] = useState(false)
  // 읽기를 마쳤는지(실패 포함). 홈에서 고른 식권을 열 때 다 읽을 때까지 기다린다
  const [ticketsSettled, setTicketsSettled] = useState(false)
  const loadTickets = useCallback(() => {
    if (!ticketsEnabled) return
    remoteReads.recommendationTickets()
      .then(setTodayTickets, () => setTodayTickets(null))
      .finally(() => setTicketsSettled(true))
  }, [ticketsEnabled])
  useEffect(() => {
    loadTickets()
  }, [loadTickets])
  const ticketsUsedUp = todayTickets?.remaining === 0
  // 홈의 "오늘 뽑은 식권"에서 하나를 고르고 들어오면 단계 화면을 건너뛰고 그 식권의 결과를 바로 연다
  const { ticket: ticketParam, welcome: welcomeParam } = useLocalSearchParams<{ ticket?: string; welcome?: string }>()
  // 처음 켠 비회원의 첫 식권(src/onboarding.ts): 국물 → 고를 곳(내 주변·인기) → 앱이 고른 식권. 회원이면 평소 큐레이터를 쓴다
  const welcome = welcomeParam === "1" && !loggedIn
  const [nearby, setNearby] = useState(true)
  const [ticketPending, setTicketPending] = useState(Boolean(ticketParam))
  useEffect(() => {
    if (!ticketPending || (ticketsEnabled && !ticketsSettled)) return
    setTicketPending(false)
    // 홈의 오늘 식권이 아니면 지난 식권 화면에서 받아 둔 식권이다
    const picked = todayTickets?.tickets.find((ticket) => ticket.id === ticketParam) ?? (ticketParam ? knownTicket(ticketParam) : null)
    const next = picked ? curationFromTicket(picked) : null
    if (!next) {
      setToast(msg`이 식권을 지금은 보여드릴 수 없어요`)
      return
    }
    setCuration(next)
    setStep("result")
  }, [ticketParam, ticketPending, ticketsEnabled, ticketsSettled, todayTickets])
  // 내 그릇 목록(데모 원장 + 앱 기록)으로 취향을 계산한다. 비회원·기록 없음이면 null
  const taste = useMemo(
    () => (loggedIn ? curatorTasteReport(bowls.data, tasteProfile.data.profile, shopsQuery.data) : null),
    [loggedIn, bowls.data, tasteProfile.data.profile, shopsQuery.data],
  )

  // 처음 켠 앱의 첫 화면은 뒤로 가기가 없다(사용자 결정 2026.11.01). 나가는 길은 오른쪽 위 "둘러보기만 할게요" 하나
  const welcomeFirstStep = welcome && step === 1
  // "둘러보기만 할게요"·"홈으로"로 나갈 때는 막지 않는다. 막아 둔 채 router.back()하면 한 단계 올라가기로 바뀐다
  const [leaving, setLeaving] = useState(false)

  // 2~4단계(와 발권 연출)에서 스와이프·하드웨어 뒤로 가기는 플로우를 나가지 않고 한 단계만 올라간다.
  // 나가면 고른 답이 전부 사라진다. 1단계와 결과 화면은 평소처럼 나간다(첫 식권의 1단계는 아무 일도 없다).
  // usePreventRemove는 iOS 네이티브 스와이프와 안드로이드 뒤로 가기까지 막는다
  usePreventRemove(!leaving && ((step !== 1 && step !== "result") || welcomeFirstStep), () => {
    if (step === "loading") requestSeq.current += 1
    setStep((current) =>
      current === "loading" ? (welcome ? "where" : 4) : current === "where" ? 1 : typeof current === "number" && current > 1 ? ((current - 1) as Step) : current,
    )
  })

  useEffect(() => {
    if (!leaving) return
    if (router.canGoBack()) router.back()
    else router.replace("/native")
  }, [leaving])

  // 결과(새로 뽑았거나 뽑아 둔 식권)를 한 번이라도 보면 홈 "처음이라면 이것부터"의 식권 칸을 채운다
  useEffect(() => {
    if (step === "result" && curation) completeOnboardingTask("ticket")
  }, [step, curation])

  /** 첫 식권 안내를 나간다. 홈에서 열었으니 홈으로 돌아간다 */
  const leaveWelcome = (skipped: boolean) => {
    if (skipped) track("onboarding_intro_skipped", { step: String(step) })
    setLeaving(true)
  }

  /** "내 주변에서"면 여기서 처음 위치 권한을 묻는다(묻는 이유가 바로 앞 화면에 있다). 거절하거나 못 읽으면 인기순으로 고른다 */
  const startFirstTicket = async () => {
    if (requestingRef.current) return
    requestingRef.current = true
    setRequesting(true)
    let here: Coordinates | null = null
    if (nearby && Platform.OS !== "web") {
      try {
        const permission = await Location.requestForegroundPermissionsAsync()
        if (permission.status === "granted") {
          const position =
            (await Location.getLastKnownPositionAsync()) ??
            (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }))
          if (position) here = { latitude: position.coords.latitude, longitude: position.coords.longitude }
        }
      } catch {
        // 위치 없이 인기순으로 고른다
      }
    }
    const next = firstTicketCuration(shopsQuery.data as CuratorShop[], inputs, here)
    track("onboarding_first_ticket", { soup: inputs.soupId, nearby: Boolean(here) })
    requestingRef.current = false
    setRequesting(false)
    setCuration(next)
    setResultReady(Promise.resolve(next))
    setStep(next && !reducedMotion ? "loading" : "result")
  }

  // 다음 후보로 바뀔 때도 결과 맨 위(제목)부터 다시 읽게 한다
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false })
    const timer = setTimeout(() => focusOn(headingRef), 250)
    return () => clearTimeout(timer)
  }, [step, curation?.index])

  const setInput = <K extends keyof Inputs>(key: K, value: Inputs[K]) => {
    setInputs((prev) => ({ ...prev, [key]: value }))
    if (key !== "prompt") void Haptics.selectionAsync().catch(() => undefined)
  }

  const startAnalysis = () => {
    if (remoteCurator && !loggedIn) {
      router.push("/auth/login")
      return
    }
    if (requestingRef.current) return
    track("ai_recommend_requested", {
      soup: inputs.soupId,
      mood: inputs.moodId,
      priority: inputs.priorityId,
      hasPrompt: inputs.prompt.trim().length > 0,
    })
    const request = ++requestSeq.current
    if (!remoteCurator) {
      const next = curate(shopsQuery.data as CuratorShop[], inputs, taste)
      setCuration(next)
      setResultReady(Promise.resolve(next))
      // Reduce Motion이면 연출 없이 바로 결과를 보여준다
      setStep(next && !reducedMotion ? "loading" : "result")
      return
    }
    requestingRef.current = true
    setRequesting(true)
    const pending = curateRemote(inputs, origin)
    // 서버 추천은 몇 초에서 25초까지 걸린다. 버튼에서 기다리게 하지 않고 발권 화면으로 바로 넘어가 거기서 기다린다.
    // Reduce Motion이면 연출 없이 버튼에서 기다렸다가 결과를 보여준다
    if (!reducedMotion) {
      setCuration(null)
      setResultReady(pending)
      setStep("loading")
    }
    pending
      .then(
        (next) => {
          if (requestSeq.current !== request) return
          setCuration(next)
          // 추천을 하나도 못 만들었으면 식권 없이 실패 화면으로 간다
          if (!next || reducedMotion) setStep("result")
          loadTickets()
        },
        (error: unknown) => {
          if (requestSeq.current !== request) return
          // curateRemote는 요청이 너무 잦거나(429) 오늘 식권을 다 썼을 때만 던진다. 대신 고르지 않고 4단계로 돌아간다
          setStep(4)
          if (isApiError(error, "DAILY_LIMIT_EXCEEDED")) {
            setToast(DAILY_LIMIT_MESSAGE)
            loadTickets()
          } else {
            setToast(RATE_LIMITED_MESSAGE)
          }
        },
      )
      .finally(() => {
        requestingRef.current = false
        setRequesting(false)
      })
  }

  const restart = () => {
    setCuration(null)
    setStep(1)
  }

  /** 오늘 뽑은 식권을 결과 화면으로 다시 연다. 그사이 매장이 모두 문을 닫았으면 알리기만 한다 */
  const openTicket = (ticket: RemoteTicket) => {
    const next = curationFromTicket(ticket)
    setTicketsOpen(false)
    if (!next) {
      setToast(msg`이 식권의 가게를 지금은 보여드릴 수 없어요`)
      return
    }
    setCuration(next)
    setStep("result")
  }
  const openHistory = () => {
    setTicketsOpen(false)
    router.push("/tickets")
  }

  /** 같은 답으로 다음 순위 후보를 보여 준다. 끝까지 보면 처음 후보로 돌아간다 */
  const showNextCandidate = () => {
    if (!curation) return
    const index = (curation.index + 1) % curation.candidates.length
    const next = curation.candidates[index]
    setCuration({ ...curation, ...next, index })
    AccessibilityInfo.announceForAccessibility(t`다음 추천, ${ph({ v1: next.shop.name })}`)
  }

  const recordShop = (shop: CuratorShop) => {
    if (!loggedIn) {
      router.push("/auth/login")
      return
    }
    router.push({ pathname: "/record/new", params: { shopId: shop.id } })
  }

  /** 매장 상세를 연다. 서버 추천이면 추천 성과 집계용으로 열었다고 알리고, 실패해도 화면은 그대로 넘어간다 */
  const openResultShop = (shown: Curation) => {
    if (shown.recommendationId) {
      remoteWrites.markRecommendationOpened(shown.recommendationId, shown.shop.id).catch(() => undefined)
    }
    router.push({ pathname: "/shop/[shopId]", params: { shopId: shown.shop.id } })
  }

  if (ticketPending) {
    return (
      <Screen>
        <Header backLabel={t`뒤로가기`} onBack={() => (router.canGoBack() ? router.back() : router.replace("/native"))} title={t`AI 라멘 큐레이터`} />
        <LoadingState label={t`식권을 불러오는 중…`} />
      </Screen>
    )
  }

  // 오늘 식권을 다 뽑았으면 단계 화면에 들이지 않는다(사용자 결정, 2026.10.23).
  // 뽑아 둔 식권 다시 보기와 마지막 장을 막 뽑은 결과·발권 연출은 단계가 아니라 그대로 둔다
  if (ticketsUsedUp && typeof step === "number") {
    return (
      <Screen contentContainerStyle={styles.flex} edges={ALL_EDGES}>
        <Header backLabel={t`뒤로가기`} onBack={() => (router.canGoBack() ? router.back() : router.replace("/native"))} title={t`AI 라멘 큐레이터`} />
        <EmptyState
          actionLabel={todayTickets.tickets.length ? t`뽑은 식권 보기` : undefined}
          description={t`식권은 하루 ${ph({ v1: todayTickets.dailyLimit })}장이에요. 내일 다시 뽑을 수 있어요.`}
          icon={<Ticket color={colors.textMuted} size={32} />}
          onAction={() => setTicketsOpen(true)}
          style={styles.flex}
          title={t`오늘 식권을 다 뽑았어요`}
        />
        <TodayTicketsSheet onClose={() => setTicketsOpen(false)} onHistory={openHistory} onSelect={openTicket} today={todayTickets} visible={ticketsOpen} />
      </Screen>
    )
  }

  if (step === "loading") {
    return (
      <CurationLoading
        conditions={
          welcome
            ? [selectedConditions[0], { label: t`고를 곳`, value: nearby ? t`내 주변` : t`인기 있는 곳` }]
            : selectedConditions.filter(({ value }) => value !== "")
        }
        onBack={() => {
          requestSeq.current += 1
          setStep(welcome ? "where" : 4)
        }}
        onComplete={() => setStep("result")}
        resultReady={resultReady}
        shop={curation?.shop ?? null}
        title={welcome ? t`첫 식권` : t`AI 라멘 큐레이터`}
        typeLabel={curation?.typeLabel ?? ""}
      />
    )
  }

  const result = step === "result" ? curation : null
  const resultType = result?.typeLabel ?? ""
  // 지난 날 뽑은 식권을 다시 열었으면 "오늘"이 아니라 그날로 적는다
  const issued = result?.issuedAt ? issuedDay(result.issuedAt) : null
  const pastDay = issued && !issued.today ? issued : null
  const numericStep = typeof step === "number" ? step : null
  // 4단계(직접 입력)는 선택 사항이라 비워 두고 넘어갈 수 있다
  const stepAnswered =
    numericStep === 1
      ? Boolean(inputs.soupId)
      : numericStep === 2
        ? Boolean(inputs.moodId)
        : numericStep === 3
          ? Boolean(inputs.priorityId)
          : true

  return (
    // 아래 고정 버튼이 없는 화면(추천 실패)은 홈 인디케이터 영역을 비워 둔다
    <Screen contentContainerStyle={styles.flex} edges={numericStep || result || step === "where" ? undefined : ALL_EDGES} keyboardAvoiding>
      {/* 처음 켠 앱의 첫 화면에는 뒤로 가기 버튼이 없다(스와이프는 위 usePreventRemove가 막는다) */}
      <Header
        align="center"
        backLabel={(numericStep && numericStep > 1) || step === "where" ? t`이전 단계로` : t`뒤로가기`}
        // 단계 안에서는 헤더 셰브론도 "이전"과 같이 한 단계만 올라간다.
        // 플로우를 통째로 빠져나가면 고른 답이 전부 사라진다
        onBack={
          welcomeFirstStep
            ? undefined
            : () =>
                step === "where"
                  ? setStep(1)
                  : numericStep && numericStep > 1
                    ? setStep((numericStep - 1) as Step)
                    : welcome
                      ? leaveWelcome(step !== "result")
                      : router.canGoBack()
                        ? router.back()
                        : router.replace("/native")
        }
        right={
          welcome ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => leaveWelcome(step !== "result")}
              style={({ pressed }) => [styles.headerAction, pressed && styles.pressedWash]}
            >
              <AppText capScale numberOfLines={1} style={styles.headerActionText} tone="sub" variant="meta">
                {step === "result" ? t`홈으로` : t`둘러보기만 할게요`}
              </AppText>
            </Pressable>
          ) : numericStep ? (
            <AppText accessibilityLabel={t`4단계 중 ${ph({ v1: numericStep })}단계`} capScale style={styles.stepCount} tone="sub" variant="meta">
              {`${numericStep} / 4`}
            </AppText>
          ) : null
        }
        style={styles.flowHeader}
        title={welcome ? t`첫 식권` : t`AI 라멘 큐레이터`}
        titleStyle={styles.navTitle}
      />

      <ScrollView
        // 첫 식권은 고를 것이 적어 위에 몰리면 아래가 휑하다. 화면 가운데에 둔다(사용자 결정 2026.11.01)
        contentContainerStyle={[styles.body, welcome && (numericStep || step === "where") && styles.bodyCentered]}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        style={styles.flex}
      >
        {numericStep ? (
          <View>
            {todayTickets ? (
              <View style={styles.ticketStrip}>
                <View accessible accessibilityLabel={t`오늘 남은 식권 ${ph({ v1: todayTickets.remaining })}장, 하루 ${ph({ v2: todayTickets.dailyLimit })}장`} style={styles.ticketCount}>
                  <Ticket color={colors.ink} size={16} />
                  <AppText capScale style={styles.ticketCountText} variant="meta">
                    {t`오늘 남은 식권 ${ph({ v1: todayTickets.remaining })}장`}
                  </AppText>
                </View>
                {todayTickets.tickets.length ? (
                  <Pressable
                    accessibilityHint={t`오늘 뽑은 식권을 골라 다시 볼 수 있어요`}
                    accessibilityLabel={t`뽑은 식권 ${ph({ v1: todayTickets.tickets.length })}장 보기`}
                    accessibilityRole="button"
                    onPress={() => setTicketsOpen(true)}
                    style={({ pressed }) => [styles.ticketLink, pressed && styles.pressedWash]}
                  >
                    <AppText capScale tone="sub" variant="meta">{t`뽑은 식권 ${ph({ v1: todayTickets.tickets.length })}장 보기`}</AppText>
                    <ChevronRight color={colors.textMuted} size={14} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {welcome ? null : (
              <>
                <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${(numericStep / 4) * 100}%` }]} />
                </View>
                <AppText style={styles.chosenTitle} tone="sub" variant="meta">{t`고른 조건`}</AppText>
                <View
                  accessible
                  accessibilityLabel={
                    selectedConditions.some(({ value }) => value)
                      ? t`고른 조건. ${ph({ v1: selectedConditions.filter(({ value }) => value).map(({ label, value }) => `${label} ${value}`).join(", ") })}`
                      : t`고른 조건 없음`
                  }
                  style={styles.chosenRow}
                >
                  {selectedConditions.map(({ label, value }) => (
                    <ChosenConditionCell key={label} label={label} value={value} />
                  ))}
                </View>
              </>
            )}
            <View accessible accessibilityRole="header" ref={headingRef}>
              <AppText lineBreakStrategyIOS="hangul-word" variant="headline">
                {welcome ? t`오늘 어떤 국물이 당겨요?` : translate(STEP_TITLES[numericStep].title)}
              </AppText>
            </View>
            <AppText lineBreakStrategyIOS="hangul-word" style={styles.help} tone="sub" variant="secondary">
              {welcome ? t`하나만 고르면 첫 식권을 뽑아 드려요.` : translate(STEP_TITLES[numericStep].help)}
            </AppText>

            {numericStep === 1 ? (
              <TicketMachine
                hint={t`국물 버튼을 눌러 주세요`}
                picked={selectedConditions[0].value}
                step={1}
              >
                <View accessibilityLabel={t`국물 베이스`} accessibilityRole="radiogroup" style={styles.soupGrid}>
                  {[0, 3, 6].map((start) => (
                    <View key={start} style={styles.soupRow}>
                      {SOUP_OPTIONS.slice(start, start + 3).map((soup) => (
                        <TicketButton
                          compact
                          key={soup.id}
                          label={translate(soup.label)}
                          soupType={soup.value}
                          onPress={() => setInput("soupId", soup.id)}
                          selected={inputs.soupId === soup.id}
                          sub={translate(soup.sub)}
                        />
                      ))}
                    </View>
                  ))}
                </View>
              </TicketMachine>
            ) : null}

            {numericStep === 2 || numericStep === 3 ? (
              <TicketMachine
                hint={numericStep === 2 ? t`상황 버튼을 눌러 주세요` : t`가장 중요한 것을 눌러 주세요`}
                picked={selectedConditions[numericStep - 1].value}
                step={numericStep}
              >
                <View accessibilityLabel={numericStep === 2 ? t`식사 상황` : t`가장 중요한 요소`} accessibilityRole="radiogroup" style={styles.optionGrid}>
                  {(numericStep === 2 ? MOOD_OPTIONS : PRIORITY_OPTIONS).map((option) => (
                    <TicketButton
                      key={option.id}
                      label={translate(option.label)}
                      onPress={() => setInput(numericStep === 2 ? "moodId" : "priorityId", option.id)}
                      selected={numericStep === 2 ? inputs.moodId === option.id : inputs.priorityId === option.id}
                      sub={translate(option.sub)}
                    />
                  ))}
                </View>
              </TicketMachine>
            ) : null}

            {numericStep === 4 ? (
              <View style={styles.promptWrap}>
                <AppText style={styles.promptLabel} variant="secondary">{t`추가 조건`}</AppText>
                <TextInput
                  accessibilityHint={t`선택 사항이에요`}
                  accessibilityLabel={t`더 바라는 점`}
                  maxFontSizeMultiplier={maxFontScale}
                  maxLength={PROMPT_MAX_LENGTH}
                  multiline
                  scrollEnabled
                  onChangeText={(text) => setInput("prompt", text)}
                  placeholder={t`예: 차슈가 푸짐하고 지금 영업 중인 곳`}
                  placeholderTextColor={colors.textMuted}
                  style={styles.promptInput}
                  textAlignVertical="top"
                  value={inputs.prompt}
                />
                <AppText style={styles.quickTitle} tone="sub" variant="sectionTitle">
                  {t`자주 찾는 조건 `}</AppText>
                <View style={styles.quickRow}>
                  {QUICK_PROMPTS.map(({ value, label }) => (
                    <QuickPromptTile
                      added={inputs.prompt.includes(value)}
                      key={value}
                      onPress={() => setInput("prompt", inputs.prompt ? `${inputs.prompt}, ${value}` : value)}
                      text={translate(label)}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {step === "where" ? (
          <View>
            <View accessible accessibilityRole="header" ref={headingRef}>
              <AppText lineBreakStrategyIOS="hangul-word" variant="headline">{t`가까운 곳에서 고를까요?`}</AppText>
            </View>
            <AppText lineBreakStrategyIOS="hangul-word" style={styles.help} tone="sub" variant="secondary">
              {t`위치를 알려 주시면 걸어서 갈 수 있는 곳부터 봐요. 위치는 가까운 순서와 거리를 재는 데 써요.`}
            </AppText>
            <TicketMachine hint="" picked={nearby ? t`내 주변` : t`인기 있는 곳`} step={2}>
              <View accessibilityLabel={t`고를 곳`} accessibilityRole="radiogroup" style={styles.optionGrid}>
                <TicketButton label={t`내 주변에서`} onPress={() => setNearby(true)} selected={nearby} sub={t`가까운 곳부터`} />
                <TicketButton label={t`인기 있는 곳에서`} onPress={() => setNearby(false)} selected={!nearby} sub={t`위치 없이`} />
              </View>
            </TicketMachine>
          </View>
        ) : null}

        {step === "result" && !result ? (
          <View>
            <View accessible accessibilityRole="header" ref={headingRef}>
              <AppText lineBreakStrategyIOS="hangul-word" variant="screenTitle">{t`추천할 라멘집을 찾지 못했어요`}</AppText>
            </View>
            <AppText lineBreakStrategyIOS="hangul-word" style={styles.help} tone="sub" variant="secondary">
              {t`매장 정보를 불러오지 못했어요. 잠시 뒤 다시 추천받아 주세요. `}</AppText>
            <RestartButton onPress={restart} />
          </View>
        ) : null}

        {result ? (
          <View>
            <View accessible accessibilityRole="header" ref={headingRef}>
              <AppText lineBreakStrategyIOS="hangul-word" style={styles.resultTitle} variant="screenTitle">
                {welcome
                  ? t`첫 식권이 나왔어요`
                  : pastDay
                    ? (nickname ? t`${ph({ day: pastDay.day })} ${nickname}님을 위한 라멘집` : t`${ph({ day: pastDay.day })}의 추천`)
                    : nickname ? t`오늘 ${ph({ v1: nickname })}님을 위한 라멘집` : t`오늘의 추천`}
              </AppText>
            </View>

            {/* 뽑은 식권: 발권 화면에서 내려온 것과 같은 색종이 식권에 매장 사진을 얹는다 */}
            <View style={[styles.resultCard, { backgroundColor: ticketPaperOf(resultType) }]} testID="ai-result-ticket">
              <View style={styles.resultPhotoWrap}>
                <ResilientUriImage accessibilityLabel={t`${ph({ v1: result.shop.name })} 대표 사진`} style={styles.resultPhoto} transition={0} uri={result.shop.photos[0]} />
                {resultType ? (
                  <View accessible accessibilityLabel={t`라멘 종류 ${ph({ v1: labelOf(resultType.replace(/\s*라멘$/, "")) })}`} accessibilityRole="text" style={styles.resultPhotoTag}>
                    <AppText capScale style={styles.resultPhotoTagText} variant="meta">{labelOf(resultType.replace(/\s*라멘$/, ""))}</AppText>
                  </View>
                ) : null}
              </View>
              <View style={styles.ticketMain}>
                <AppText style={styles.ticketMuted} variant="meta">{pastDay ? t`${ph({ day: pastDay.day })}의 한 그릇` : t`오늘의 한 그릇`}</AppText>
                <AppText lineBreakStrategyIOS="hangul-word" style={[styles.resultName, styles.ticketText]} variant="sectionTitle">
                  {result.shop.name}
                  {result.shop.branch ? (
                    <AppText style={styles.ticketMuted} variant="cardTitle">{` · ${result.shop.branch}`}</AppText>
                  ) : null}
                </AppText>
                {result.shop.spec || result.shop.distanceM > 0 ? (
                  <AppText lineBreakStrategyIOS="hangul-word" style={[styles.ticketPlace, styles.ticketText]} variant="secondary">
                    {[result.shop.spec, result.shop.distanceM > 0 ? result.shop.distanceM >= 1000 ? `${(result.shop.distanceM / 1000).toFixed(1)}km` : `${result.shop.distanceM}m` : null].filter(Boolean).join(" · ")}
                  </AppText>
                ) : null}
                {result.shop.description ? (
                  <AppText lineBreakStrategyIOS="hangul-word" style={[styles.resultDescription, styles.ticketText, styles.ticketMuted]} variant="meta">
                    {result.shop.description}
                  </AppText>
                ) : null}
              </View>
              <MealTicketFoot issueDate={issued?.foot ?? issueDate} />
            </View>

            {result.reason ? (
              // AI가 쓴 이유가 있으면 고른 조건을 다시 늘어놓지 않고 이 매장을 고른 이유를 보여준다
              <View style={styles.conditions} testID="ai-recommend-reason">
                <AppText accessibilityRole="header" style={styles.conditionsTitle} variant="sectionTitle">
                  {t`추천 이유 `}</AppText>
                <View accessibilityLabel={t`AI가 썼어요`} accessible style={styles.aiLabel}>
                  <Sparkles color={colors.ink} size={16} />
                  <AppText capScale style={styles.aiLabelText} variant="meta">{t`AI가 썼어요`}</AppText>
                </View>
                <AppText lineBreakStrategyIOS="hangul-word" style={styles.reasonText} variant="secondary">
                  {result.reason}
                </AppText>
              </View>
            ) : result.conditions.length || result.fallbackNote ? (
              <View style={styles.conditions}>
                <AppText accessibilityRole="header" style={styles.conditionsTitle} variant="sectionTitle">
                  {t`추천에 쓴 조건 `}</AppText>
                {result.fallback ? (
                  <AppText lineBreakStrategyIOS="hangul-word" style={styles.fallbackNote} tone="sub" variant="secondary">
                    {result.fallbackNote ? translate(result.fallbackNote) : t`라멘로그가 많이 쌓인 가까운 곳 중에서 골라 봤어요.`}
                  </AppText>
                ) : null}
                {result.conditions.map((condition) => {
                  const label = condition.label()
                  const note = condition.note?.() ?? ""
                  return (
                    <View
                      accessible
                      accessibilityLabel={
                        condition.applied
                          ? note ? t`${ph({ label })}, 반영했어요. ${ph({ note })}` : t`${ph({ label })}, 반영했어요`
                          : note ? t`${ph({ label })}, 참고했어요. ${ph({ note })}` : t`${ph({ label })}, 참고했어요`
                      }
                      key={condition.key}
                      style={styles.condition}
                    >
                      <View style={styles.flexShrink}>
                        <AppText lineBreakStrategyIOS="hangul-word" style={styles.conditionLabel} variant="bodyStrong">
                          {label}
                        </AppText>
                        {/* 서버가 준 조건은 이름만 있다 */}
                        {note ? (
                          <AppText lineBreakStrategyIOS="hangul-word" style={styles.conditionNote} tone="sub" variant="secondary">
                            {note}
                          </AppText>
                        ) : null}
                      </View>
                    </View>
                  )
                })}
              </View>
            ) : null}

            {/* 후보가 하나뿐이면 같은 가게만 다시 나오므로 조건을 바꾸러 처음으로 간다(고른 답은 남는다) */}
            {result.candidates.length > 1 ? (
              <RestartButton onPress={showNextCandidate} />
            ) : (
              <RestartButton label={t`조건 바꿔 다시 고르기`} onPress={restart} />
            )}

            {welcome ? (
              // 첫 식권은 앱이 골랐다. 회원이 되면 같은 식권 기계에서 AI가 골라 준다는 것만 알리고, 빨간 버튼은 아래 하나로 둔다
              <View style={styles.welcomeNote}>
                <AppText lineBreakStrategyIOS="hangul-word" variant="bodyStrong">{t`로그인하면 AI가 골라 드려요`}</AppText>
                <AppText lineBreakStrategyIOS="hangul-word" style={styles.welcomeNoteText} tone="sub" variant="secondary">
                  {t`국물에 상황과 더 바라는 점까지 보고, 매일 새 식권을 뽑을 수 있어요.`}
                </AppText>
                <Button
                  onPress={() => router.push({ pathname: "/auth/login", params: { next: "/ai-recommend" } })}
                  size="small"
                  style={styles.welcomeNoteButton}
                  title={t`로그인하고 AI 식권 받기`}
                  variant="secondary"
                />
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {numericStep && welcome ? (
        <StickyActionBar>
          <Button
            accessibilityHint={stepAnswered ? undefined : t`위에서 하나를 골라야 다음으로 갈 수 있어요`}
            disabled={!stepAnswered}
            fullWidth
            onPress={() => setStep("where")}
            rightIcon={stepAnswered ? <ChevronRight color={colors.onDark} size={16} /> : undefined}
            style={ctaSize}
            title={stepAnswered ? t`다음` : t`국물을 골라주세요`}
          />
        </StickyActionBar>
      ) : step === "where" ? (
        <StickyActionBar>
          <Button fullWidth loading={requesting} onPress={() => void startFirstTicket()} style={ctaSize} title={t`식권 뽑기`} />
        </StickyActionBar>
      ) : numericStep ? (
        <StickyActionBar>
          {numericStep > 1 ? (
            <Button disabled={requesting} fullWidth onPress={() => setStep((numericStep - 1) as Step)} title={t`이전`} variant="secondary" />
          ) : null}
          <Button
            accessibilityHint={stepAnswered ? undefined : t`위에서 하나를 골라야 다음으로 갈 수 있어요`}
            disabled={!stepAnswered}
            loading={numericStep === 4 && requesting}
            onPress={() => {
              if (numericStep !== 4) setStep((numericStep + 1) as Step)
              // 남은 식권을 아는 서버 추천이면 쓰기 전에 묻는다. 모르면(비회원·옛 서버·데모) 그대로 진행한다
              else if (todayTickets && todayTickets.remaining > 0) setConfirmingTicket(true)
              else startAnalysis()
            }}
            rightIcon={numericStep === 4 ? undefined : <ChevronRight color={colors.onDark} size={16} />}
            style={[styles.primaryCta, ctaSize]}
            title={numericStep === 4 ? t`AI 맞춤 추천받기` : stepAnswered ? t`다음` : numericStep === 1 ? t`국물을 골라주세요` : numericStep === 2 ? t`상황을 골라주세요` : t`중요한 요소를 골라주세요`}
          />
        </StickyActionBar>
      ) : result ? (
        <StickyActionBar>
          <Button
            accessibilityHint={loggedIn ? undefined : t`로그인 화면으로 이동해요`}
            fullWidth
            onPress={() => recordShop(result.shop)}
            style={[styles.stickyButton, ctaSize]}
            title={t`이 가게 기록하기`}
            variant="secondary"
          />
          <Button
            fullWidth
            onPress={() => openResultShop(result)}
            rightIcon={compact ? undefined : <ChevronRight color={colors.onDark} size={16} />}
            style={[styles.stickyButton, ctaSize]}
            title={t`매장 상세 보기`}
          />
        </StickyActionBar>
      ) : null}
      <TodayTicketsSheet onClose={() => setTicketsOpen(false)} onHistory={openHistory} onSelect={openTicket} today={todayTickets} visible={ticketsOpen} />
      <ConfirmDialog
        cancelLabel={t`취소`}
        confirmLabel={t`식권 쓰기`}
        message={
          todayTickets?.remaining === 1
            ? t`오늘 남은 마지막 식권이에요. 자정에 다시 ${ph({ v1: todayTickets.dailyLimit })}장이 채워져요.`
            : t`오늘 남은 식권 ${ph({ v1: todayTickets?.remaining ?? 0 })}장 중 1장을 써요. 자정에 다시 ${ph({ v2: todayTickets?.dailyLimit ?? 0 })}장이 채워져요.`
        }
        onCancel={() => setConfirmingTicket(false)}
        onConfirm={() => {
          setConfirmingTicket(false)
          startAnalysis()
        }}
        title={t`식권 1장을 쓸까요?`}
        visible={confirmingTicket}
      />
      <Toast message={toast ? translate(toast) : ""} onDismiss={() => setToast(null)} style={{ bottom: ctaSize.minHeight + spacing.x6 }} visible={Boolean(toast)} />
    </Screen>
  )
}

const DOT_CYCLE = 1200

/** 서버 응답을 기다리는 동안 안내 문구 옆에서 차례로 밝아지는 점 세 개. 장식이라 스크린리더는 읽지 않는다 */
function LoadingDots() {
  const reducedMotion = useReducedMotion()
  const progress = useSharedValue(0)
  useEffect(() => {
    if (reducedMotion) return
    progress.value = withRepeat(withTiming(1, { duration: DOT_CYCLE, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(progress)
  }, [progress, reducedMotion])
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.dots} testID="curation-loading-dots">
      {[0, 1, 2].map((index) => <LoadingDot index={index} key={index} progress={progress} still={reducedMotion} />)}
    </View>
  )
}

function LoadingDot({ index, progress, still }: { index: number; progress: SharedValue<number>; still: boolean }) {
  const style = useAnimatedStyle(() => {
    if (still) return { opacity: 0.6 }
    // 점마다 1/3 주기씩 늦게 밝아졌다가 흐려진다
    const phase = (progress.value - index / 3 + 1) % 1
    return { opacity: 0.25 + 0.75 * Math.max(0, 1 - Math.abs(phase - 0.2) * 3) }
  })
  return <Animated.View style={[styles.dot, style]} />
}

function RestartButton({ label, onPress }: { label?: string; onPress: () => void }) {
  const text = label ?? t`다시 추천받기`
  return (
    <Pressable
      accessibilityLabel={text}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.restart, pressed && styles.pressedWash]}
    >
      <AppText style={styles.restartText} variant="bodyStrong">{text}</AppText>
    </Pressable>
  )
}

/** 실제로 고른 조건만 순서대로 켜지고, 추천 결과는 슬롯에서 나온 식권에 적힌다. */
interface TicketCondition {
  label: string
  value: string
}

/**
 * 준비 신호와 연출은 독립적이다. 식권 아랫단을 보여 준 뒤에도 응답이 늦으면
 * 그대로 기다리고, 준비가 끝났을 때만 식권 전체를 내린다.
 */
function CurationLoading({
  conditions,
  onBack,
  onComplete,
  resultReady,
  shop,
  title,
  typeLabel,
}: {
  conditions: TicketCondition[]
  onBack: () => void
  onComplete: () => void
  resultReady: Promise<Curation | null>
  /** 서버 응답 전에는 null이다. 그동안은 식권 아랫단까지만 내려와서 매장 칸이 비어 있어도 드러나지 않는다 */
  shop: CuratorShop | null
  /** 머리글. 첫 식권 모드에서는 AI라고 하지 않는다 */
  title: string
  typeLabel: string
}) {
  const { width: screenWidth } = useWindowDimensions()
  const reducedMotion = useReducedMotion()
  const [pressed, setPressed] = useState(reducedMotion ? conditions.length : 0)
  const [phase, setPhase] = useState<"printing" | "stub" | "out" | "error">(reducedMotion ? "out" : "printing")
  const failed = phase === "error"
  const [ready, setReady] = useState(false)
  const [stubWaited, setStubWaited] = useState(false)
  const [ticketHeight, setTicketHeight] = useState(0)
  const [stubHeight, setStubHeight] = useState(0)
  const [issueDate] = useState(() => {
    const now = new Date()
    return `${String(now.getFullYear()).slice(-2)}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`
  })
  const titleRef = useRef<View>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const ticketWidth = Math.min(290, screenWidth - spacing.x8)
  const ticketShift = useSharedValue(0)

  useEffect(() => {
    let mounted = true
    void resultReady.then(
      () => { if (mounted) setReady(true) },
      () => { if (mounted) setPhase("error") },
    )
    return () => { mounted = false }
  }, [resultReady])

  useEffect(() => {
    const focus = setTimeout(() => focusOn(titleRef), 250)
    if (reducedMotion || failed) return () => clearTimeout(focus)
    const timers = conditions.map((_, index) => setTimeout(() => setPressed(index + 1), KEY_START + index * KEY_INTERVAL))
    timers.push(setTimeout(() => setPhase((current) => current === "error" ? current : "stub"), KEY_START + conditions.length * KEY_INTERVAL))
    return () => {
      clearTimeout(focus)
      timers.forEach(clearTimeout)
    }
  }, [conditions.length, reducedMotion, failed])

  useEffect(() => {
    if (phase !== "stub") return
    // 응답이 이미 준비됐어도 식권 아랫단을 STUB_HOLD 동안 보여 준다.
    const timer = setTimeout(() => setStubWaited(true), STUB_HOLD)
    return () => clearTimeout(timer)
  }, [phase])

  useEffect(() => {
    if (phase === "stub" && stubWaited && ready) setPhase("out")
  }, [phase, ready, stubWaited])

  // 투입구 위(음수)에 숨어 있다가 아랫단만큼, 그다음 전체가 내려온다
  useEffect(() => {
    if (!ticketHeight || !stubHeight) return
    if (reducedMotion) {
      ticketShift.value = 0
    } else if (phase === "out") {
      ticketShift.value = withTiming(0, { duration: TICKET_SETTLE, easing: Easing.out(Easing.cubic) })
    } else if (phase === "stub") {
      ticketShift.value = withTiming(stubHeight - ticketHeight, { duration: STUB_SLIDE, easing: Easing.out(Easing.cubic) })
    } else {
      ticketShift.value = -(ticketHeight + spacing.x3)
    }
  }, [phase, reducedMotion, stubHeight, ticketHeight, ticketShift])

  const ticketStyle = useAnimatedStyle(() => ({
    opacity: ticketHeight && stubHeight ? 1 : 0,
    transform: [{ translateY: ticketShift.value }],
  }))

  const loadingMessage = phase === "error" ? null : phase === "out" ? LOADING_MESSAGES[3] : phase === "stub" ? LOADING_MESSAGES[2] : pressed >= 2 ? LOADING_MESSAGES[1] : LOADING_MESSAGES[0]
  const message = loadingMessage ? translate(loadingMessage) : t`추천을 가져오지 못했어요. 고른 조건은 그대로예요`

  /** iOS에서는 제목 포커스와 겹치지 않도록 첫 문구를 빼고 직접 읽어 준다. */
  useEffect(() => {
    if (loadingMessage !== LOADING_MESSAGES[0]) AccessibilityInfo.announceForAccessibility(message)
  }, [loadingMessage, message])

  useEffect(() => {
    if (phase !== "out" || !ready) return
    const timer = setTimeout(() => onCompleteRef.current(), reducedMotion ? 0 : RESULT_HOLD)
    return () => clearTimeout(timer)
  }, [phase, ready, reducedMotion])

  const place = !shop
    ? ""
    : shop.distanceM > 0
      ? shop.distanceM >= 1000 ? `${(shop.distanceM / 1000).toFixed(1)}km` : `${shop.distanceM}m`
      : shop.address.trim().split(/\s+/).slice(0, 2).join(" ")

  return (
    <Screen contentContainerStyle={styles.flex} edges={ALL_EDGES}>
      <Header align="center" backLabel={t`추천 조건으로 돌아가기`} onBack={onBack} style={styles.flowHeader} title={title} titleStyle={styles.navTitle} />
      <ScrollView
        contentContainerStyle={[styles.loadingBody, !ticketHeight || !stubHeight ? styles.invisible : undefined]}
        showsVerticalScrollIndicator={false}
        style={styles.flex}
      >
        <View accessible accessibilityLabel={phase === "out" ? t`오늘의 한 그릇을 찾았어요` : t`조건에 맞는 한 그릇을 찾는 중`} accessibilityRole="header" ref={titleRef}>
          <AppText accessibilityElementsHidden importantForAccessibility="no-hide-descendants" lineBreakStrategyIOS="hangul-word" style={[styles.center, styles.invisible]} variant="headline">
            {t`조건에 맞는 한 그릇을
찾는 중`}
          </AppText>
          <AppText lineBreakStrategyIOS="hangul-word" style={styles.loadingTitleVisible} variant="headline">
            {phase === "out" ? t`오늘의 한 그릇을 찾았어요` : t`조건에 맞는 한 그릇을
찾는 중`}
          </AppText>
        </View>
        <AppText style={styles.loadingSub} tone="muted" variant="secondary">
          {phase === "out" ? t`고른 조건으로 오늘의 라멘을 찾았어요.` : t`고른 조건으로 오늘의 라멘을 고르고 있어요.`}
        </AppText>

        <View style={styles.loadingChips}>
          {conditions.map(({ label, value }, index) => {
            const lit = index < pressed
            return (
              <View
                accessible
                accessibilityLabel={t`${ph({ v1: label })}, ${ph({ v2: value })}, ${ph({ v3: lit ? t`확인했어요` : t`확인 중` })}`}
                accessibilityRole="text"
                key={label}
                style={[styles.loadingChip, lit && styles.loadingChipOn]}
              >
                <AppText capScale lineBreakStrategyIOS="hangul-word" style={[typography.button, styles.loadingChipText, lit && styles.onSelectedText]} variant="secondary">{value}</AppText>
              </View>
            )
          })}
        </View>

        {/* 투입구는 잘린 창 맨 위에 두고, 식권은 실제 높이를 재서 아랫단부터 내려보낸다. */}
        <View style={[styles.ticketFeed, { width: ticketWidth, height: ticketHeight ? SLOT_HEIGHT / 2 + ticketHeight + spacing.x1 : 224 }]}>
          <Animated.View
            onLayout={({ nativeEvent }) => {
              const height = Math.ceil(nativeEvent.layout.height)
              if (!ticketHeight) ticketShift.value = reducedMotion || phase === "out" ? 0 : -(height + spacing.x3)
              setTicketHeight(height)
            }}
            accessibilityElementsHidden={phase !== "out"}
            importantForAccessibility={phase === "out" ? "auto" : "no-hide-descendants"}
            style={[styles.ticket, { backgroundColor: ticketPaperOf(typeLabel) }, ticketStyle]}
          >
            <View style={styles.ticketMain}>
              <AppText style={styles.ticketMuted} variant="meta">{t`오늘의 한 그릇`}</AppText>
              <AppText lineBreakStrategyIOS="hangul-word" style={[styles.ticketName, styles.ticketText]} variant="headline">{shop?.name ?? ""}</AppText>
              <AppText lineBreakStrategyIOS="hangul-word" style={[styles.ticketPlace, styles.ticketText]} variant="secondary">
                {[typeLabel ? labelOf(typeLabel) : "", place].filter(Boolean).join(" · ")}
              </AppText>
            </View>
            <MealTicketFoot issueDate={issueDate} onLayout={({ nativeEvent }) => setStubHeight(Math.ceil(nativeEvent.layout.height))} />
          </Animated.View>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={styles.ticketSlot} />
        </View>

        <View style={styles.loadingActions}>
          <View accessibilityLiveRegion="polite" style={styles.statusLine}>
            <AppText accessibilityRole="text" lineBreakStrategyIOS="hangul-word" style={styles.statusText} tone="sub" variant="secondary">
              {message}
            </AppText>
            {/* 서버 추천은 몇 초에서 25초까지 걸려, 기다리는 동안 멈춘 화면처럼 보이지 않게 점을 움직인다 */}
            {!ready && !failed ? <LoadingDots /> : null}
          </View>
          {phase === "error" ? (
            <Button onPress={onBack} size="small" title={t`추천 조건으로 돌아가기`} variant="ghost" />
          ) : ready ? (
            // 결과 준비 전에는 건너뛰기를 내놓지 않는다.
            <Button
              onPress={onComplete}
              rightIcon={<ArrowRight color={colors.ink} size={16} />}
              size="small"
              title={t`추천 바로 보기`}
              variant="ghost"
            />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  )
}

/** 식권 아랫단: 절취선과 "RAOTA 식권 · {날짜} · 1매". 발권 중인 식권(아랫단부터 내려온다)과 뽑은 식권이 같이 쓴다 */
function MealTicketFoot({ issueDate, onLayout }: { issueDate: string; onLayout?: ViewProps["onLayout"] }) {
  return (
    <View onLayout={onLayout} style={styles.ticketFoot}>
      {/* iOS는 한 변짜리 dashed 테두리를 그리지 못해 절취선을 SVG로 긋는다 */}
      <Svg height={line.base} width="100%">
        <Line stroke={ticketInk.rule} strokeDasharray="4 4" strokeWidth={line.base} x1={0} x2="100%" y1={line.base / 2} y2={line.base / 2} />
      </Svg>
      <View style={styles.ticketFootRow}>
        <AppText capScale style={[styles.ticketMuted, styles.ticketBrand]} variant="meta">{t`RAOTA 식권`}</AppText>
        <AppText capScale style={[styles.ticketMuted, styles.tabular]} variant="meta">{issueDate} {t` · 1매`}</AppText>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1, minWidth: 0 },
  onSelectedText: { color: colors.onSelected },
  center: { textAlign: "center" },
  pressedWash: { backgroundColor: colors.surfacePressed },
  invisible: { opacity: 0 },
  stepCount: { fontVariant: ["tabular-nums"], paddingRight: spacing.x3 },
  flowHeader: { minHeight: 52 },
  navTitle: { fontSize: 18, lineHeight: 24 },

  body: { paddingHorizontal: spacing.gutter, paddingTop: spacing.x4, paddingBottom: spacing.x8 },
  bodyCentered: { flexGrow: 1, justifyContent: "center" },
  progressTrack: {
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.secondary,
    overflow: "hidden",
    marginBottom: spacing.x4,
  },
  progressFill: { height: "100%", borderRadius: radii.pill, backgroundColor: colors.ink },
  // 하루 식권: 진행 막대 위 한 줄. 남은 장수는 왼쪽, 뽑은 식권 다시 보기는 오른쪽 링크
  ticketStrip: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.x2, marginTop: -spacing.x2, marginBottom: spacing.x1 },
  ticketCount: { flexDirection: "row", alignItems: "center", gap: spacing.x1_5, flexShrink: 1 },
  ticketCountText: { fontWeight: "700" },
  ticketLink: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", gap: spacing.x0_5, paddingLeft: spacing.x2, borderRadius: radii.sm },
  chosenTitle: { fontWeight: "700", marginBottom: spacing.x3 },
  // 네 칸을 한 줄에 두고 높이를 두 줄 값 기준으로 고정한다. 조건을 고를 때 칸이 커지거나 줄이 늘어 아래 질문이 밀리지 않는다
  chosenRow: { flexDirection: "row", gap: spacing.x1_5, marginBottom: spacing.section },
  chosenChip: {
    flex: 1,
    minWidth: 0,
    height: 68,
    paddingHorizontal: spacing.x2,
    paddingVertical: spacing.x2,
    borderRadius: radii.sm,
    backgroundColor: colors.canvasSoft,
    overflow: "hidden",
  },
  chosenLabel: { fontWeight: "500", lineHeight: 15 },
  chosenValue: { fontWeight: "700", marginTop: spacing.x1, lineHeight: 15 },
  promptLabel: { fontWeight: "700", marginBottom: spacing.x3 },
  help: { marginTop: spacing.x1_5, color: colors.textMuted },

  // 식권 자판기: canvasSoft 면 위에 canvas 버튼. 큰 면이라 32pt, 버튼은 16pt
  machine: { marginTop: spacing.x4, padding: spacing.x3, borderRadius: radii.lg, backgroundColor: colors.canvasSoft },
  machineHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.x2, paddingTop: spacing.x1, paddingBottom: spacing.x3 },
  machineBrand: { fontWeight: "700", letterSpacing: 0.5 },
  machineSlot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.x2,
    minHeight: 36,
    marginTop: spacing.x3,
    paddingHorizontal: spacing.x3,
    borderRadius: radii.sm,
    backgroundColor: colors.canvas,
  },
  machineSlotBar: { width: 40, height: 6, borderRadius: radii.pill, backgroundColor: colors.secondary },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x2 },
  ticketButtonSlot: { flexBasis: "47%", flexGrow: 1, paddingBottom: BUTTON_SINK },
  // 버튼 아래로 2pt 비어져 나온 턱. 버튼이 눌려 내려오면 가려진다
  ticketButtonLip: { position: "absolute", top: BUTTON_SINK, left: 0, right: 0, bottom: 0, borderRadius: radii.sm, backgroundColor: colors.secondary },
  ticketButton: { minHeight: 104, padding: spacing.x3, paddingRight: spacing.x7, borderRadius: radii.sm, justifyContent: "flex-end", gap: spacing.x0_5 },
  checkBadge: { position: "absolute", top: spacing.x2, right: spacing.x2, width: 24, height: 24, borderRadius: radii.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas },
  soupSwatch: { height: 6, marginTop: spacing.x2, marginRight: -spacing.x4, borderRadius: radii.pill, borderWidth: line.hair, borderColor: colors.soupEdge },
  optionSub: { marginTop: spacing.x0_5 },
  // 국물 3×3: 줄마다 셋을 같은 폭으로 나누고, 높이는 이름·설명·국물 색 띠만큼만 둔다(사용자 결정 2026.11.01, 한 화면에 들어오게)
  soupGrid: { gap: spacing.x2 },
  soupRow: { flexDirection: "row", gap: spacing.x2 },
  ticketButtonSlotCompact: { flexBasis: 0, flexGrow: 1 },
  ticketButtonCompact: { minHeight: 76, padding: spacing.x2_5, paddingRight: spacing.x2_5 },
  checkBadgeCompact: { top: spacing.x1_5, right: spacing.x1_5, width: 20, height: 20 },
  compactLabel: { fontSize: 15, lineHeight: 20 },
  soupSwatchCompact: { marginTop: spacing.x1_5, marginRight: 0 },

  promptWrap: { marginTop: spacing.x3 },
  promptInput: {
    ...typography.body,
    fontSize: 16,
    height: 96,
    minHeight: 96,
    padding: spacing.x4,
    borderRadius: radii.sm,
    borderWidth: line.base,
    borderColor: colors.outline,
    backgroundColor: colors.paper,
    color: colors.ink,
  },
  quickTitle: { marginTop: spacing.section, marginBottom: spacing.x3, fontSize: 16, lineHeight: 22 },
  quickRow: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.x2, rowGap: spacing.x3 },
  quickChip: {
    minHeight: touchTarget,
    justifyContent: "center",
    paddingHorizontal: spacing.x3,
    borderRadius: radii.pill,
    backgroundColor: colors.canvasSoft,
  },
  quickText: { ...typography.button, fontSize: 13 },

  primaryCta: { flex: 2 },
  resultTitle: { fontSize: 21, lineHeight: 27 },
  stickyButton: { paddingHorizontal: spacing.x3 },

  resultCard: { marginTop: spacing.x4, borderRadius: radii.xs, overflow: "hidden" },
  resultPhotoWrap: { height: 154, overflow: "hidden" },
  resultPhoto: { width: "100%", height: "100%" },
  resultPhotoTag: {
    position: "absolute",
    bottom: spacing.x3,
    left: spacing.x3,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.x3,
    paddingVertical: spacing.x2,
    backgroundColor: colors.photoPill,
  },
  resultPhotoTagText: { color: colors.onPhotoPill },
  resultName: { marginTop: spacing.x1 },
  resultDescription: { marginTop: spacing.x3, fontSize: 12, lineHeight: 17 },

  conditions: { marginTop: spacing.section },
  conditionsTitle: { marginBottom: spacing.x3, fontSize: 17, lineHeight: 22 },
  fallbackNote: { marginBottom: spacing.x3 },
  condition: { minHeight: 49, justifyContent: "center", paddingVertical: spacing.x3, borderBottomWidth: line.hair, borderBottomColor: colors.border },
  conditionLabel: { fontSize: 13, lineHeight: 17 },
  aiLabel: { flexDirection: "row", alignItems: "center", gap: spacing.x1_5, marginBottom: spacing.x2 },
  aiLabelText: { fontWeight: "700" },
  reasonText: { lineHeight: 20 },
  conditionNote: { marginTop: spacing.x1, fontSize: 12, lineHeight: 17 },
  restart: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x1_5,
    minHeight: touchTarget,
    alignSelf: "flex-start",
    marginTop: spacing.x3,
    paddingHorizontal: 0,
  },
  restartText: { fontSize: 14, textDecorationLine: "underline" },
  // 첫 식권 결과 아래 로그인 안내. 회색 면 하나(카드 안 카드 없음), 빨강은 아래 고정 버튼에만 둔다
  welcomeNote: { marginTop: spacing.section, backgroundColor: colors.canvasSoft, borderRadius: radii.md, padding: spacing.x4 },
  welcomeNoteText: { marginTop: spacing.x1 },
  welcomeNoteButton: { alignSelf: "flex-start", marginTop: spacing.x3 },
  headerAction: { minHeight: touchTarget, justifyContent: "center", paddingHorizontal: spacing.x2, borderRadius: radii.pill },
  headerActionText: { fontWeight: "700" },

  loadingBody: {
    flexGrow: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingHorizontal: spacing.x4,
    paddingTop: spacing.x6,
    paddingBottom: spacing.x8,
  },
  loadingTitleVisible: { position: "absolute", top: 0, left: 0, right: 0, textAlign: "center" },
  loadingSub: { textAlign: "center", marginTop: spacing.x1_5 },
  loadingChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    columnGap: spacing.x2,
    rowGap: spacing.x3,
    marginTop: spacing.section,
    maxWidth: 344,
  },
  loadingChip: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: spacing.x3_5,
    borderRadius: radii.pill,
    backgroundColor: colors.canvasSoft,
  },
  loadingChipOn: { backgroundColor: colors.selected },
  loadingChipText: { flexShrink: 1 },
  ticketFeed: {
    overflow: "hidden",
    alignItems: "center",
    marginTop: spacing.section,
    paddingTop: SLOT_HEIGHT / 2,
  },
  // 식권보다 양옆으로 조금 넓어 종이가 그 틈에서 나오는 것처럼 보인다
  ticketSlot: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: SLOT_HEIGHT,
    borderRadius: radii.pill,
    backgroundColor: colors.ink,
  },
  // 실물 식권처럼 작고 모서리가 거의 서 있다
  ticket: { width: "86%", borderRadius: radii.xs },
  ticketMain: { alignItems: "center", paddingHorizontal: spacing.x4, paddingTop: spacing.x6, paddingBottom: spacing.x4 },
  ticketText: { color: ticketInk.text, textAlign: "center" },
  ticketMuted: { color: ticketInk.muted },
  ticketName: { marginTop: spacing.x1, fontSize: 26, lineHeight: 32 },
  ticketPlace: { marginTop: spacing.x1 },
  ticketFoot: { paddingHorizontal: spacing.x3, paddingBottom: spacing.x3 },
  ticketFootRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.x2, marginTop: spacing.x2_5 },
  ticketBrand: { fontWeight: "700" },
  tabular: { fontVariant: ["tabular-nums"] },
  loadingActions: { alignItems: "center", gap: spacing.x1, marginTop: spacing.section },
  statusLine: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.x1_5 },
  statusText: { textAlign: "center", flexShrink: 1 },
  dots: { flexDirection: "row", alignItems: "center", gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.textMuted },
})
