import * as Haptics from "expo-haptics"
import { router } from "expo-router"
import { ArrowRight, Check, ChevronRight } from "lucide-react-native"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  findNodeHandle,
  useWindowDimensions,
} from "react-native"
import Animated, { Easing, interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated"
import type { Edge } from "react-native-safe-area-context"

import { type Shop, type ShopCatalogItem } from "@raota/shared"
import { track } from "@/src/analytics"
import { ResilientUriImage } from "@/src/components/ResilientUriImage"
import { AppText, Button, Header, Screen, StickyActionBar, TicketCut } from "@/src/components/ui"
import { useLocalShops } from "@/src/data/hooks"
import { rankShopsForAIRecommendation } from "@/src/domain/ai-recommendation"
import { matchesShopRamenType } from "@/src/domain/shops"
import { useRaota } from "@/src/state/RaotaStore"
import { colors, line, maxFontScale, radii, soupColorOf, spacing, touchTarget, typography, usePalette } from "@/src/theme"

/** 식권 자판기 버튼이 눌려 들어가는 깊이 */
const BUTTON_SINK = 2

type CuratorShop = Shop & Partial<Pick<ShopCatalogItem, "style" | "spec">>
type Step = 1 | 2 | 3 | 4 | "loading" | "result"

const ALL_EDGES: Edge[] = ["top", "left", "right", "bottom"]

const SOUP_OPTIONS = [
  { id: "shoyu", label: "쇼유", sub: "간장 타레", keys: ["쇼유"] },
  { id: "tonkotsu", label: "돈코츠", sub: "돼지뼈 육수", keys: ["돈코츠"] },
  { id: "ieke", label: "이에케", sub: "돈코츠쇼유", keys: ["이에케"] },
  { id: "shio", label: "시오", sub: "소금 타레", keys: ["시오"] },
  { id: "miso", label: "미소", sub: "된장 타레", keys: ["미소"] },
  { id: "tsukemen", label: "츠케멘", sub: "찍어 먹는 면", keys: ["츠케멘"] },
  { id: "tori", label: "토리파이탄", sub: "닭백탕", keys: ["토리파이탄", "닭백탕"] },
]

// sub은 고르는 뜻을 풀어 쓴 말이다. 매장 정보로 거르는 조건처럼 들리게 쓰지 않는다(상황은 대조할 정보가 없어 "참고"로만 쓴다)
const MOOD_OPTIONS = [
  { id: "solo", label: "혼밥하기 좋은 곳", sub: "혼자 편하게" },
  { id: "date", label: "데이트/아늑한 분위기", sub: "둘이 오래 머물기" },
  { id: "waiting", label: "웨이팅 감수 맛집", sub: "줄 서도 가는 곳" },
  { id: "quick", label: "빠르고 든든한 한 끼", sub: "빨리 먹고 나가기" },
]

const PRIORITY_OPTIONS = [
  { id: "rich", label: "진하고 묵직한 국물", sub: "백탕 · 농후", keys: ["진한", "농후", "백탕", "이에케", "돈코츠", "적된장"] },
  { id: "noodle", label: "탱글탱글 자가제면", sub: "직접 뽑은 면", keys: ["자가제면", "치지레멘"] },
  { id: "chashu", label: "두툼하고 부드러운 차슈", sub: "토핑이 주인공", keys: ["차슈"] },
  { id: "clean", label: "깔끔하고 깊은 감칠맛", sub: "청탕 · 맑은 국물", keys: ["깔끔", "맑은", "청탕", "감칠맛", "시오"] },
]

const QUICK_PROMPTS = ["국물이 덜 짠 곳", "차슈가 푸짐한 곳", "주차 가능한 곳", "웨이팅 적은 곳", "매운맛 조절 가능한 곳", "밥 무료 제공"]

const STEP_TITLES: Record<1 | 2 | 3 | 4, { title: string; help: string }> = {
  1: { title: "오늘 어떤 국물이 당기나요?", help: "맑은 청탕부터 묵직한 백탕까지 골라보세요." },
  2: { title: "어떤 상황에서 드시나요?", help: "지금 갈 수 있는 곳과 여유 있는 방문을 구분해 추천해요." },
  3: { title: "한 그릇에서 가장 포기할 수 없는 것은?", help: "가게 특징과 태그에 이 요소가 있는 곳을 먼저 찾아요." },
  4: {
    title: "더 바라는 점이 있나요?",
    help: "선택 사항이에요. 웨이팅, 밥, 차슈처럼 매장 정보와 대조할 수 있는 조건은 결과에 반영돼요.",
  },
}

const LOADING_MESSAGES = ["선택한 조건을 확인하고 있어요", "어울리는 라멘집을 찾고 있어요", "오늘의 추천을 정리하고 있어요", "오늘의 추천이 준비됐어요"]
/**
 * 조건 칩을 하나씩 밝히고 식권 윗부분을 먼저 보인 다음 전체를 올린다.
 * 결과 화면으로는 완성된 식권을 RESULT_HOLD만큼 보여 준 뒤 넘어간다.
 */
const KEY_START = 300
const KEY_INTERVAL = 500
const STUB_SLIDE = 600
const STUB_HOLD = 900
const TICKET_SETTLE = 900
const RESULT_HOLD = 2000
const PROMPT_MAX_LENGTH = 200

interface Inputs {
  soupId: string
  moodId: string
  priorityId: string
  prompt: string
}

interface Condition {
  label: string
  applied: boolean
  note: string
}

interface Curation {
  shop: CuratorShop
  conditions: Condition[]
  /** 조건으로 고르지 못해 인기·거리순으로 대신 골랐는지 */
  fallback: boolean
}

/**
 * 아무것도 고르지 않은 상태로 시작한다. 미리 골라 두면 "다음"만 눌러도
 * 결과가 고르지 않은 조건을 "반영"이라고 말하게 된다.
 */
const DEFAULT_INPUTS: Inputs = { soupId: "", moodId: "", priorityId: "", prompt: "" }

/** 고른 조건은 실제 네 단계와 같은 이름으로 표시한다. 아직 고르지 않은 값은 빈 문자열(칸에는 이름만 남는다) */
function chosenConditions(inputs: Inputs) {
  return [
    { label: "국물", value: SOUP_OPTIONS.find((option) => option.id === inputs.soupId)?.label ?? "" },
    { label: "상황", value: MOOD_OPTIONS.find((option) => option.id === inputs.moodId)?.label ?? "" },
    { label: "중요", value: PRIORITY_OPTIONS.find((option) => option.id === inputs.priorityId)?.label ?? "" },
    { label: "추가", value: inputs.prompt.trim() },
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
      accessibilityLabel={added ? `${text}, 추가됨` : `${text} 추가`}
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
}: {
  label: string
  sub: string
  soupType?: string
  selected: boolean
  onPress: () => void
}) {
  const motion = useChoiceMotion(selected, { sink: true })
  return (
    <View style={styles.ticketButtonSlot}>
      <View style={styles.ticketButtonLip} />
      <AnimatedPressable
        accessibilityLabel={`${label}, ${sub}`}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        onPress={onPress}
        onPressIn={motion.pressIn}
        onPressOut={motion.pressOut}
        style={[styles.ticketButton, motion.containerStyle]}
      >
        {selected ? (
          <View style={styles.checkBadge}>
            <Check color={colors.ink} size={14} strokeWidth={3} />
          </View>
        ) : null}
        <Animated.Text lineBreakStrategyIOS="hangul-word" style={[typography.cardTitle, motion.textStyle]}>
          {label}
        </Animated.Text>
        <Animated.Text
          lineBreakStrategyIOS="hangul-word"
          maxFontSizeMultiplier={maxFontScale}
          style={[typography.meta, styles.optionSub, motion.subStyle]}
        >
          {sub}
        </Animated.Text>
        {soupType ? <View style={[styles.soupSwatch, { backgroundColor: soupColorOf(soupType) }]} /> : null}
      </AnimatedPressable>
    </View>
  )
}

/** 고르는 단계(1~3)의 버튼 묶음을 식권 자판기 면에 담는다. 머리줄과 아래 투입구 줄은 장식이라 읽지 않는다 */
function TicketMachine({ step, picked, hint, children }: { step: 1 | 2 | 3; picked: string; hint: string; children: ReactNode }) {
  return (
    <View style={styles.machine}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.machineHead}>
        <AppText capScale style={styles.machineBrand} variant="meta">RAOTA 식권</AppText>
        <AppText capScale tone="muted" variant="meta">{step}단계</AppText>
      </View>
      {children}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.machineSlot}>
        <View style={styles.machineSlotBar} />
        <AppText capScale numberOfLines={1} tone="muted" variant="meta">{picked ? `${picked} 골랐어요` : hint}</AppText>
      </View>
    </View>
  )
}

const shopText = (shop: CuratorShop) => [shop.style, shop.spec, shop.description, ...shop.tags].filter(Boolean).join(" ")
const hasAnyKey = (shop: CuratorShop, keys: string[]) => keys.some((key) => shopText(shop).includes(key))
const byPopularity = (a: CuratorShop, b: CuratorShop) =>
  b.reviewCount - a.reviewCount || b.rating - a.rating || a.distanceM - b.distanceM

/**
 * 선택한 조건을 원장과 실제로 대조해 후보를 좁히고(웹 AIRecommendScreen과 같은 규칙),
 * 남은 후보 안에서 src/domain/ai-recommendation 랭킹으로 한 곳을 고른다.
 * 대조할 정보가 없는 조건은 applied=false("참고했어요")로 남긴다. 랭킹이 실패하거나 후보가 없으면 인기·거리순으로 대신한다.
 * 서버 추천(#46)이 붙으면 이 함수만 바꾼다.
 */
function curate(shops: CuratorShop[], inputs: Inputs): Curation | null {
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

  const soup = SOUP_OPTIONS.find((option) => option.id === inputs.soupId) ?? SOUP_OPTIONS[0]
  if (narrow((shop) => {
    if (soup.label === "돈코츠" || soup.label === "이에케") {
      return matchesShopRamenType(shop, soup.label, soup.keys)
    }
    return hasAnyKey(shop, soup.keys)
  })) {
    conditions.push({ label: `${soup.label} 계보`, applied: true, note: `${soup.label} 계보 ${pool.length}곳 중에서 골랐어요` })
  } else {
    conditions.push({ label: `${soup.label} 계보`, applied: false, note: "전체 라멘집으로 넓혀서 골라 봤어요" })
  }

  const mood = MOOD_OPTIONS.find((option) => option.id === inputs.moodId) ?? MOOD_OPTIONS[0]
  if (mood.id === "quick") {
    const opened = narrow((shop) => shop.businessStatus === "OPERATIONAL" && shop.isOpen)
    byDistance = true
    conditions.push({
      label: mood.label,
      applied: true,
      note: opened ? "지금 영업 중이고 가까운 곳을 우선했어요" : "가까운 곳부터 우선했어요",
    })
  } else if (mood.id === "waiting") {
    if (narrow((shop) => shop.reviewCount > 0 || shop.rating > 0)) {
      conditions.push({ label: mood.label, applied: true, note: "라멘로그와 평점이 쌓인 곳을 우선했어요" })
    } else {
      conditions.push({ label: mood.label, applied: false, note: "라멘로그가 더 쌓이면 이 조건도 꼼꼼히 맞춰 드릴게요" })
    }
  } else {
    conditions.push({ label: mood.label, applied: false, note: "매장 분위기 정보가 채워지면 더 꼭 맞게 골라 드릴게요" })
  }

  const priority = PRIORITY_OPTIONS.find((option) => option.id === inputs.priorityId)
  if (priority) {
    if (narrow((shop) => hasAnyKey(shop, priority.keys))) {
      conditions.push({ label: priority.label, applied: true, note: "가게 특징과 태그에 이 요소가 있는 곳을 우선했어요" })
    } else {
      conditions.push({ label: priority.label, applied: false, note: "이 특징이 적힌 가게가 늘면 더 정확히 골라 드릴게요" })
    }
  }

  const prompt = inputs.prompt.trim()
  if (prompt) {
    const applied: string[] = []
    if (prompt.includes("웨이팅") && narrow((shop) => shop.isOpen)) applied.push("지금 영업 중")
    if (prompt.includes("밥") && narrow((shop) => Boolean(shop.servicePerks?.riceRefill))) applied.push("공깃밥 제공")
    if (prompt.includes("차슈") && narrow((shop) => hasAnyKey(shop, ["차슈"]))) applied.push("차슈")
    if (prompt.includes("면") && narrow((shop) => hasAnyKey(shop, ["자가제면", "치지레멘", "면"]))) applied.push("면")
    conditions.push(
      applied.length
        ? { label: `직접 입력: ${prompt}`, applied: true, note: `${applied.join(", ")} 조건을 매장 정보와 대조했어요` }
        : { label: `직접 입력: ${prompt}`, applied: false, note: "적어 주신 조건은 매장 정보가 채워지는 대로 맞춰 드릴게요" },
    )
  }

  let picked: CuratorShop | undefined
  if (byDistance) {
    picked = [...pool].sort((a, b) => a.distanceM - b.distanceM || byPopularity(a, b))[0]
  } else {
    try {
      picked = rankShopsForAIRecommendation(pool, {
        soup: soup.label,
        mood: mood.label,
        priority: priority?.label ?? "",
        prompt,
      })[0]?.shop as CuratorShop | undefined
    } catch {
      picked = undefined
    }
  }
  if (picked) return { shop: picked, conditions, fallback: false }

  const fallbackShop = [...all].sort(byPopularity)[0]
  return fallbackShop ? { shop: fallbackShop, conditions, fallback: true } : null
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
  const { currentUser } = useRaota()
  const shopsQuery = useLocalShops()
  const reducedMotion = useReducedMotion()
  const { width, fontScale } = useWindowDimensions()
  const ctaSize = useMemo(() => ({ minHeight: Math.max(56, 2 * (typography.button.lineHeight ?? 18) * Math.min(fontScale, maxFontScale) + 2 * spacing.x2) }), [fontScale])
  const compact = width < 360
  const [inputs, setInputs] = useState<Inputs>(DEFAULT_INPUTS)
  const selectedConditions = useMemo(() => chosenConditions(inputs), [inputs])
  const [step, setStep] = useState<Step>(1)
  const [curation, setCuration] = useState<Curation | null>(null)
  // 로컬 계산이 먼저 끝나도 식권 연출은 준비 완료 신호를 따로 기다린다.
  const resultReady = useMemo(() => Promise.resolve(curation), [curation])
  const scrollRef = useRef<ScrollView>(null)
  const headingRef = useRef<View>(null)
  const [issueDate] = useState(() => {
    const now = new Date()
    return `${String(now.getFullYear()).slice(-2)}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`
  })

  const loggedIn = Boolean(currentUser?.isLoggedIn)
  const nickname = loggedIn ? currentUser?.nickname : null

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false })
    const timer = setTimeout(() => focusOn(headingRef), 250)
    return () => clearTimeout(timer)
  }, [step])

  const setInput = <K extends keyof Inputs>(key: K, value: Inputs[K]) => {
    setInputs((prev) => ({ ...prev, [key]: value }))
    if (key !== "prompt") void Haptics.selectionAsync().catch(() => undefined)
  }

  const startAnalysis = () => {
    track("ai_recommend_requested", {
      soup: inputs.soupId,
      mood: inputs.moodId,
      priority: inputs.priorityId,
      hasPrompt: inputs.prompt.trim().length > 0,
    })
    const next = curate(shopsQuery.data as CuratorShop[], inputs)
    setCuration(next)
    // Reduce Motion이면 연출 없이 바로 결과를 보여준다
    setStep(next && !reducedMotion ? "loading" : "result")
  }

  const restart = () => {
    setCuration(null)
    setStep(1)
  }

  const recordShop = (shop: CuratorShop) => {
    if (!loggedIn) {
      router.push("/auth/login")
      return
    }
    router.push({ pathname: "/record/new", params: { shopId: shop.id } })
  }

  if (step === "loading" && curation) {
    return (
      <CurationLoading
        conditions={selectedConditions.filter(({ value }) => value !== "")}
        onBack={() => setStep(4)}
        onComplete={() => setStep("result")}
        resultReady={resultReady}
        shop={curation.shop}
      />
    )
  }

  const result = step === "result" ? curation : null
  const resultType = result?.shop.style ?? ""
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
    <Screen contentContainerStyle={styles.flex} edges={numericStep || result ? undefined : ALL_EDGES} keyboardAvoiding>
      <Header
        align="center"
        backLabel={numericStep && numericStep > 1 ? "이전 단계로" : "뒤로가기"}
        // 단계 안에서는 헤더 셰브론도 "이전"과 같이 한 단계만 올라간다.
        // 플로우를 통째로 빠져나가면 고른 답이 전부 사라진다
        onBack={() =>
          numericStep && numericStep > 1
            ? setStep((numericStep - 1) as Step)
            : router.canGoBack()
              ? router.back()
              : router.replace("/native")
        }
        right={
          numericStep ? (
            <AppText accessibilityLabel={`4단계 중 ${numericStep}단계`} capScale style={styles.stepCount} tone="sub" variant="meta">
              {`${numericStep} / 4`}
            </AppText>
          ) : null
        }
        style={styles.flowHeader}
        title="AI 라멘 큐레이터"
        titleStyle={styles.navTitle}
      />

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        style={styles.flex}
      >
        {numericStep ? (
          <View>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${(numericStep / 4) * 100}%` }]} />
            </View>
            <AppText style={styles.chosenTitle} tone="sub" variant="meta">고른 조건</AppText>
            <View
              accessible
              accessibilityLabel={
                selectedConditions.some(({ value }) => value)
                  ? `고른 조건. ${selectedConditions.filter(({ value }) => value).map(({ label, value }) => `${label} ${value}`).join(", ")}`
                  : "고른 조건 없음"
              }
              style={styles.chosenRow}
            >
              {selectedConditions.map(({ label, value }) => (
                <ChosenConditionCell key={label} label={label} value={value} />
              ))}
            </View>
            <View accessible accessibilityRole="header" ref={headingRef}>
              <AppText lineBreakStrategyIOS="hangul-word" variant="headline">{STEP_TITLES[numericStep].title}</AppText>
            </View>
            <AppText lineBreakStrategyIOS="hangul-word" style={styles.help} tone="sub" variant="secondary">
              {STEP_TITLES[numericStep].help}
            </AppText>

            {numericStep === 1 ? (
              <TicketMachine
                hint="국물 버튼을 눌러 주세요"
                picked={SOUP_OPTIONS.find((soup) => soup.id === inputs.soupId)?.label ?? ""}
                step={1}
              >
                <View accessibilityLabel="국물 베이스" accessibilityRole="radiogroup" style={styles.optionGrid}>
                  {SOUP_OPTIONS.map((soup) => (
                    <TicketButton
                      key={soup.id}
                      label={soup.label}
                      soupType={soup.label}
                      onPress={() => setInput("soupId", soup.id)}
                      selected={inputs.soupId === soup.id}
                      sub={soup.sub}
                    />
                  ))}
                </View>
              </TicketMachine>
            ) : null}

            {numericStep === 2 || numericStep === 3 ? (
              <TicketMachine
                hint={numericStep === 2 ? "상황 버튼을 눌러 주세요" : "가장 중요한 것을 눌러 주세요"}
                picked={
                  (numericStep === 2
                    ? MOOD_OPTIONS.find((option) => option.id === inputs.moodId)?.label
                    : PRIORITY_OPTIONS.find((option) => option.id === inputs.priorityId)?.label) ?? ""
                }
                step={numericStep}
              >
                <View accessibilityLabel={numericStep === 2 ? "식사 상황" : "가장 중요한 요소"} accessibilityRole="radiogroup" style={styles.optionGrid}>
                  {(numericStep === 2 ? MOOD_OPTIONS : PRIORITY_OPTIONS).map((option) => (
                    <TicketButton
                      key={option.id}
                      label={option.label}
                      onPress={() => setInput(numericStep === 2 ? "moodId" : "priorityId", option.id)}
                      selected={numericStep === 2 ? inputs.moodId === option.id : inputs.priorityId === option.id}
                      sub={option.sub}
                    />
                  ))}
                </View>
              </TicketMachine>
            ) : null}

            {numericStep === 4 ? (
              <View style={styles.promptWrap}>
                <AppText style={styles.promptLabel} variant="secondary">추가 조건</AppText>
                <TextInput
                  accessibilityHint="선택 사항이에요"
                  accessibilityLabel="더 바라는 점"
                  maxFontSizeMultiplier={maxFontScale}
                  maxLength={PROMPT_MAX_LENGTH}
                  multiline
                  scrollEnabled
                  onChangeText={(text) => setInput("prompt", text)}
                  placeholder="예: 차슈가 부드럽고 국물이 덜 짠 곳"
                  placeholderTextColor={colors.textMuted}
                  style={styles.promptInput}
                  textAlignVertical="top"
                  value={inputs.prompt}
                />
                <AppText style={styles.quickTitle} tone="sub" variant="sectionTitle">
                  자주 찾는 조건
                </AppText>
                <View style={styles.quickRow}>
                  {QUICK_PROMPTS.map((text) => (
                    <QuickPromptTile
                      added={inputs.prompt.includes(text)}
                      key={text}
                      onPress={() => setInput("prompt", inputs.prompt ? `${inputs.prompt}, ${text}` : text)}
                      text={text}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {step === "result" && !result ? (
          <View>
            <View accessible accessibilityRole="header" ref={headingRef}>
              <AppText lineBreakStrategyIOS="hangul-word" variant="screenTitle">추천할 라멘집을 찾지 못했어요</AppText>
            </View>
            <AppText lineBreakStrategyIOS="hangul-word" style={styles.help} tone="sub" variant="secondary">
              매장 정보를 불러오지 못했어요. 잠시 뒤 다시 추천받아 주세요.
            </AppText>
            <RestartButton onPress={restart} />
          </View>
        ) : null}

        {result ? (
          <View>
            <View accessible accessibilityRole="header" ref={headingRef}>
              <AppText lineBreakStrategyIOS="hangul-word" style={styles.resultTitle} variant="screenTitle">{nickname ? `오늘 ${nickname}님을 위한 라멘집` : "오늘의 추천"}</AppText>
            </View>

            <View style={styles.resultCard}>
              <View style={styles.resultPhotoWrap}>
                <ResilientUriImage accessibilityLabel={`${result.shop.name} 대표 사진`} style={styles.resultPhoto} transition={0} uri={result.shop.photos[0]} />
                {resultType ? (
                  <View accessible accessibilityLabel={`라멘 종류 ${resultType.replace(/\s*라멘$/, "")}`} accessibilityRole="text" style={styles.resultPhotoTag}>
                    <AppText capScale style={styles.resultPhotoTagText} variant="meta">{resultType.replace(/\s*라멘$/, "")}</AppText>
                  </View>
                ) : null}
              </View>
              <View style={styles.resultBody}>
                <AppText tone="muted" variant="meta">RAOTA 식권 · 오늘의 한 그릇</AppText>
                <AppText lineBreakStrategyIOS="hangul-word" style={styles.resultName} variant="sectionTitle">
                  {result.shop.name}
                  {result.shop.branch ? (
                    <AppText tone="muted" variant="cardTitle">{` · ${result.shop.branch}`}</AppText>
                  ) : null}
                </AppText>
                {result.shop.spec || result.shop.distanceM > 0 ? (
                  <AppText lineBreakStrategyIOS="hangul-word" style={styles.resultSpec} tone="sub" variant="secondary">
                    {[result.shop.spec, result.shop.distanceM > 0 ? result.shop.distanceM >= 1000 ? `${(result.shop.distanceM / 1000).toFixed(1)}km` : `${result.shop.distanceM}m` : null].filter(Boolean).join(" · ")}
                  </AppText>
                ) : null}
              </View>
              <TicketCut />
              <View style={styles.resultFoot}>
                <AppText lineBreakStrategyIOS="hangul-word" style={styles.resultDescription} tone="sub" variant="meta">
                  {result.shop.description}
                </AppText>
                <AppText capScale style={styles.resultDate} tone="muted" variant="meta">{issueDate} · 1매</AppText>
              </View>
            </View>

            {result.conditions.length ? (
              <View style={styles.conditions}>
                <AppText accessibilityRole="header" style={styles.conditionsTitle} variant="sectionTitle">
                  추천에 쓴 조건
                </AppText>
                {result.fallback ? (
                  <AppText lineBreakStrategyIOS="hangul-word" style={styles.fallbackNote} tone="sub" variant="secondary">
                    라멘로그가 많이 쌓인 가까운 곳 중에서 골라 봤어요.
                  </AppText>
                ) : null}
                {result.conditions.map((condition) => (
                  <View
                    accessible
                    accessibilityLabel={`${condition.label}, ${condition.applied ? "반영했어요" : "참고했어요"}. ${condition.note}`}
                    key={condition.label}
                    style={styles.condition}
                  >
                    <View style={styles.flexShrink}>
                      <AppText lineBreakStrategyIOS="hangul-word" style={styles.conditionLabel} variant="bodyStrong">
                        {condition.label}
                      </AppText>
                      <AppText lineBreakStrategyIOS="hangul-word" style={styles.conditionNote} tone="sub" variant="secondary">
                        {condition.note}
                      </AppText>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            <RestartButton onPress={restart} />
          </View>
        ) : null}
      </ScrollView>

      {numericStep ? (
        <StickyActionBar>
          {numericStep > 1 ? (
            <Button fullWidth onPress={() => setStep((numericStep - 1) as Step)} title="이전" variant="secondary" />
          ) : null}
          <Button
            accessibilityHint={stepAnswered ? undefined : "위에서 하나를 골라야 다음으로 갈 수 있어요"}
            disabled={!stepAnswered}
            onPress={() => (numericStep === 4 ? startAnalysis() : setStep((numericStep + 1) as Step))}
            rightIcon={numericStep === 4 ? undefined : <ChevronRight color={colors.onDark} size={16} />}
            style={[styles.primaryCta, ctaSize]}
            title={numericStep === 4 ? "AI 맞춤 추천받기" : stepAnswered ? "다음" : numericStep === 1 ? "국물을 골라주세요" : numericStep === 2 ? "상황을 골라주세요" : "중요한 요소를 골라주세요"}
          />
        </StickyActionBar>
      ) : result ? (
        <StickyActionBar>
          <Button
            accessibilityHint={loggedIn ? undefined : "로그인 화면으로 이동해요"}
            fullWidth
            onPress={() => recordShop(result.shop)}
            style={[styles.stickyButton, ctaSize]}
            title="이 가게 기록하기"
            variant="secondary"
          />
          <Button
            fullWidth
            onPress={() => router.push({ pathname: "/shop/[shopId]", params: { shopId: result.shop.id } })}
            rightIcon={compact ? undefined : <ChevronRight color={colors.onDark} size={16} />}
            style={[styles.stickyButton, ctaSize]}
            title="매장 상세 보기"
          />
        </StickyActionBar>
      ) : null}
    </Screen>
  )
}

function RestartButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="다시 추천받기"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.restart, pressed && styles.pressedWash]}
    >
      <AppText style={styles.restartText} variant="bodyStrong">다시 추천받기</AppText>
    </Pressable>
  )
}

/** 실제로 고른 조건만 순서대로 켜지고, 추천 결과는 슬롯에서 나온 식권에 적힌다. */
interface TicketCondition {
  label: string
  value: string
}

/**
 * 준비 신호와 연출은 독립적이다. 식권 윗부분을 보여 준 뒤에도 응답이 늦으면
 * 그대로 기다리고, 준비가 끝났을 때만 식권 전체를 올린다.
 */
function CurationLoading({
  conditions,
  onBack,
  onComplete,
  resultReady,
  shop,
}: {
  conditions: TicketCondition[]
  onBack: () => void
  onComplete: () => void
  resultReady: Promise<Curation | null>
  shop: CuratorShop
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
    // 응답이 이미 준비됐어도 식권 윗부분을 STUB_HOLD 동안 보여 준다.
    const timer = setTimeout(() => setStubWaited(true), STUB_HOLD)
    return () => clearTimeout(timer)
  }, [phase])

  useEffect(() => {
    if (phase === "stub" && stubWaited && ready) setPhase("out")
  }, [phase, ready, stubWaited])

  useEffect(() => {
    if (!ticketHeight || !stubHeight) return
    if (reducedMotion) {
      ticketShift.value = 0
    } else if (phase === "out") {
      ticketShift.value = withTiming(0, { duration: TICKET_SETTLE, easing: Easing.out(Easing.cubic) })
    } else if (phase === "stub") {
      ticketShift.value = withTiming(ticketHeight - stubHeight, { duration: STUB_SLIDE, easing: Easing.out(Easing.cubic) })
    } else {
      ticketShift.value = ticketHeight + spacing.x3
    }
  }, [phase, reducedMotion, stubHeight, ticketHeight, ticketShift])

  const ticketStyle = useAnimatedStyle(() => ({
    opacity: ticketHeight && stubHeight ? 1 : 0,
    transform: [{ translateY: ticketShift.value }],
  }))

  const message = phase === "error"
    ? "추천을 가져오지 못했어요. 고른 조건은 그대로예요"
    : phase === "out"
      ? LOADING_MESSAGES[3]
      : phase === "stub"
        ? LOADING_MESSAGES[2]
        : pressed >= 2
          ? LOADING_MESSAGES[1]
          : LOADING_MESSAGES[0]

  /** iOS에서는 제목 포커스와 겹치지 않도록 첫 문구를 빼고 직접 읽어 준다. */
  useEffect(() => {
    if (message !== LOADING_MESSAGES[0]) AccessibilityInfo.announceForAccessibility(message)
  }, [message])

  useEffect(() => {
    if (phase !== "out" || !ready) return
    const timer = setTimeout(() => onCompleteRef.current(), reducedMotion ? 0 : RESULT_HOLD)
    return () => clearTimeout(timer)
  }, [phase, ready, reducedMotion])

  const place = shop.distanceM > 0
    ? shop.distanceM >= 1000 ? `${(shop.distanceM / 1000).toFixed(1)}km` : `${shop.distanceM}m`
    : shop.address.trim().split(/\s+/).slice(0, 2).join(" ")

  return (
    <Screen contentContainerStyle={styles.flex} edges={ALL_EDGES}>
      <Header align="center" backLabel="추천 조건으로 돌아가기" onBack={onBack} style={styles.flowHeader} title="AI 라멘 큐레이터" titleStyle={styles.navTitle} />
      <ScrollView
        contentContainerStyle={[styles.loadingBody, !ticketHeight || !stubHeight ? styles.invisible : undefined]}
        showsVerticalScrollIndicator={false}
        style={styles.flex}
      >
        <View accessible accessibilityLabel={phase === "out" ? "오늘의 한 그릇을 찾았어요" : "조건에 맞는 한 그릇을 찾는 중"} accessibilityRole="header" ref={titleRef}>
          <AppText accessibilityElementsHidden importantForAccessibility="no-hide-descendants" lineBreakStrategyIOS="hangul-word" style={[styles.center, styles.invisible]} variant="headline">
            {"조건에 맞는 한 그릇을\n찾는 중"}
          </AppText>
          <AppText lineBreakStrategyIOS="hangul-word" style={styles.loadingTitleVisible} variant="headline">
            {phase === "out" ? "오늘의 한 그릇을 찾았어요" : "조건에 맞는 한 그릇을\n찾는 중"}
          </AppText>
        </View>
        <AppText style={styles.loadingSub} tone="muted" variant="secondary">
          {phase === "out" ? "고른 조건으로 오늘의 라멘을 찾았어요." : "내 취향으로 오늘의 라멘을 고르고 있어요."}
        </AppText>

        <View style={styles.loadingChips}>
          {conditions.map(({ label, value }, index) => {
            const lit = index < pressed
            return (
              <View
                accessible
                accessibilityLabel={`${label}, ${value}, ${lit ? "확인했어요" : "확인 중"}`}
                accessibilityRole="text"
                key={label}
                style={[styles.loadingChip, lit && styles.loadingChipOn]}
              >
                <AppText capScale lineBreakStrategyIOS="hangul-word" style={[typography.button, styles.loadingChipText, lit && styles.onSelectedText]} variant="secondary">{value}</AppText>
              </View>
            )
          })}
        </View>

        {/* 슬롯은 잘린 창 위에 두고, 식권은 실제 높이를 재서 윗부분부터 올린다. */}
        <View style={[styles.ticketFeed, { width: ticketWidth, height: ticketHeight ? ticketHeight + line.base : 224 }]}>
          <Animated.View
            onLayout={({ nativeEvent }) => {
              const height = Math.ceil(nativeEvent.layout.height)
              if (!ticketHeight) ticketShift.value = reducedMotion || phase === "out" ? 0 : height + spacing.x3
              setTicketHeight(height)
            }}
            accessibilityElementsHidden={phase !== "out"}
            importantForAccessibility={phase === "out" ? "auto" : "no-hide-descendants"}
            style={[styles.ticket, ticketStyle]}
          >
            <View onLayout={({ nativeEvent }) => setStubHeight(Math.ceil(nativeEvent.layout.height))} style={styles.ticketHead}>
              <AppText variant="bodyStrong">RAOTA 식권</AppText>
              <AppText capScale tone="muted" variant="meta">{issueDate} · 1매</AppText>
            </View>
            <View style={styles.ticketMain}>
              <AppText tone="muted" variant="meta">오늘의 한 그릇</AppText>
              <AppText lineBreakStrategyIOS="hangul-word" style={styles.ticketName} variant="headline">{shop.name}</AppText>
              <AppText lineBreakStrategyIOS="hangul-word" style={styles.ticketPlace} tone="sub" variant="secondary">
                {[shop.style, place].filter(Boolean).join(" · ")}
              </AppText>
            </View>
            <TicketCut />
            <AppText style={styles.ticketFoot} tone="muted" variant="meta">고른 취향이 한 장의 식권이 되었어요</AppText>
          </Animated.View>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={styles.ticketSlot} />
        </View>

        <View style={styles.loadingActions}>
          <View accessibilityLiveRegion="polite" style={styles.statusLine}>
            <AppText accessibilityRole="text" lineBreakStrategyIOS="hangul-word" style={styles.center} tone="sub" variant="secondary">
              {message}
            </AppText>
          </View>
          {phase === "error" ? (
            <Button onPress={onBack} size="small" title="추천 조건으로 돌아가기" variant="ghost" />
          ) : ready ? (
            // 결과 준비 전에는 건너뛰기를 내놓지 않는다.
            <Button
              onPress={onComplete}
              rightIcon={<ArrowRight color={colors.ink} size={16} />}
              size="small"
              title="추천 바로 보기"
              variant="ghost"
            />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
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
  progressTrack: {
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.secondary,
    overflow: "hidden",
    marginBottom: spacing.x4,
  },
  progressFill: { height: "100%", borderRadius: radii.pill, backgroundColor: colors.ink },
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

  resultCard: { marginTop: spacing.x4, borderRadius: radii.sm, backgroundColor: colors.canvasSoft },
  resultPhotoWrap: {
    height: 154,
    overflow: "hidden",
    borderTopLeftRadius: radii.sm,
    borderTopRightRadius: radii.sm,
  },
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
  resultBody: { paddingHorizontal: spacing.x4, paddingVertical: spacing.x4 },
  resultName: { marginTop: spacing.x1 },
  resultSpec: { marginTop: spacing.x1 },
  resultFoot: { gap: spacing.x2, paddingHorizontal: spacing.x4, paddingVertical: spacing.x4 },
  resultDescription: { fontSize: 12, lineHeight: 17 },
  resultDate: { alignSelf: "flex-end" },

  conditions: { marginTop: spacing.section },
  conditionsTitle: { marginBottom: spacing.x3, fontSize: 17, lineHeight: 22 },
  fallbackNote: { marginBottom: spacing.x3 },
  condition: { minHeight: 49, justifyContent: "center", paddingVertical: spacing.x3, borderBottomWidth: line.hair, borderBottomColor: colors.border },
  conditionLabel: { fontSize: 13, lineHeight: 17 },
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
    marginTop: spacing.section,
    paddingBottom: line.base,
  },
  ticketSlot: {
    position: "absolute",
    bottom: 0,
    left: spacing.x1,
    right: spacing.x1,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.ink,
  },
  ticket: { width: "100%", borderRadius: radii.sm, backgroundColor: colors.canvasSoft },
  ticketHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.x5,
    paddingTop: spacing.x5,
    paddingBottom: spacing.x4,
  },
  ticketMain: { paddingHorizontal: spacing.x5, paddingBottom: spacing.x5 },
  ticketName: { marginTop: spacing.x1, fontSize: 28, lineHeight: 34 },
  ticketPlace: { marginTop: spacing.x1 },
  ticketFoot: { paddingHorizontal: spacing.x5, paddingTop: spacing.x5, paddingBottom: spacing.x5 },
  loadingActions: { alignItems: "center", gap: spacing.x1, marginTop: spacing.section },
  statusLine: { minHeight: touchTarget, justifyContent: "center" },
})
