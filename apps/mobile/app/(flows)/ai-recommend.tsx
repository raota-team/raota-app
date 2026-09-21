import * as Haptics from "expo-haptics"
import { router } from "expo-router"
import { ArrowRight, Check, ChevronLeft, ChevronRight, Minus, PenLine, RotateCcw, Sparkles } from "lucide-react-native"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type ViewStyle,
  findNodeHandle,
  useWindowDimensions,
} from "react-native"
import { Image } from "expo-image"
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated"

import { type Shop, type ShopCatalogItem } from "@raota/shared"
import { track } from "@/src/analytics"
import { ResilientUriImage } from "@/src/components/ResilientUriImage"
import { AppText, Button, Header, IconButton, RamenTypeTag, Screen, Sticker, StickyActionBar, Tag } from "@/src/components/ui"
import { useShops } from "@/src/data/hooks"
import { rankShopsForAIRecommendation } from "@/src/domain/ai-recommendation"
import { useRaota } from "@/src/state/RaotaStore"
import { colors, line, maxFontScale, radii, spacing, touchTarget, typography } from "@/src/theme"

type CuratorShop = Shop & Partial<Pick<ShopCatalogItem, "style" | "spec">>
type Step = 1 | 2 | 3 | 4 | "loading" | "result"

const SOUP_OPTIONS = [
  { id: "shoyu", label: "쇼유", sub: "간장 타레", keys: ["쇼유"] },
  { id: "tonkotsu", label: "돈코츠", sub: "돼지뼈 육수", keys: ["돈코츠", "이에케"] },
  { id: "shio", label: "시오", sub: "소금 타레", keys: ["시오"] },
  { id: "miso", label: "미소", sub: "된장 타레", keys: ["미소"] },
  { id: "tsukemen", label: "츠케멘", sub: "찍어 먹는 면", keys: ["츠케멘"] },
  { id: "tori", label: "토리파이탄", sub: "닭백탕", keys: ["토리파이탄", "닭백탕"] },
]

const MOOD_OPTIONS = [
  { id: "solo", label: "혼밥하기 좋은 곳" },
  { id: "date", label: "데이트/아늑한 분위기" },
  { id: "waiting", label: "웨이팅 감수 맛집" },
  { id: "quick", label: "빠르고 든든한 한 끼" },
]

const PRIORITY_OPTIONS = [
  { id: "rich", label: "진하고 묵직한 국물", keys: ["진한", "농후", "백탕", "이에케", "돈코츠", "적된장"] },
  { id: "noodle", label: "탱글탱글 자가제면", keys: ["자가제면", "치지레멘"] },
  { id: "chashu", label: "두툼하고 부드러운 차슈", keys: ["차슈"] },
  { id: "clean", label: "깔끔하고 깊은 감칠맛", keys: ["깔끔", "맑은", "청탕", "감칠맛", "시오"] },
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

const LOADING_MESSAGES = ["선택한 취향을 확인하고 있어요", "어울리는 라멘집을 찾고 있어요", "오늘의 추천을 정리하고 있어요", "오늘의 한 그릇을 골랐어요"]
const LOADING_DURATION = 3300
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

const DEFAULT_INPUTS: Inputs = { soupId: "shoyu", moodId: "solo", priorityId: "clean", prompt: "" }

const shopText = (shop: CuratorShop) => [shop.style, shop.spec, shop.description, ...shop.tags].filter(Boolean).join(" ")
const hasAnyKey = (shop: CuratorShop, keys: string[]) => keys.some((key) => shopText(shop).includes(key))
const byPopularity = (a: CuratorShop, b: CuratorShop) =>
  b.reviewCount - a.reviewCount || b.rating - a.rating || a.distanceM - b.distanceM

/**
 * 선택한 조건을 원장과 실제로 대조해 후보를 좁히고(웹 AIRecommendScreen과 같은 규칙),
 * 남은 후보 안에서 src/domain/ai-recommendation 랭킹으로 한 곳을 고른다.
 * 대조할 정보가 없는 조건은 applied=false("참고만")로 남긴다. 랭킹이 실패하거나 후보가 없으면 인기·거리순으로 대신한다.
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
  if (narrow((shop) => hasAnyKey(shop, soup.keys))) {
    conditions.push({ label: `${soup.label} 계보`, applied: true, note: `${soup.label} 계보 ${pool.length}곳 중에서 골랐어요` })
  } else {
    conditions.push({ label: `${soup.label} 계보`, applied: false, note: `${soup.label} 전문점이 아직 없어 전체 라멘집에서 골랐어요` })
  }

  const mood = MOOD_OPTIONS.find((option) => option.id === inputs.moodId) ?? MOOD_OPTIONS[0]
  if (mood.id === "quick") {
    const opened = narrow((shop) => shop.businessStatus === "OPERATIONAL" && shop.isOpen)
    byDistance = true
    conditions.push({
      label: mood.label,
      applied: true,
      note: opened ? "지금 영업 중이고 가까운 곳을 우선했어요" : "영업 중인 곳이 없어 가까운 곳을 우선했어요",
    })
  } else if (mood.id === "waiting") {
    if (narrow((shop) => shop.reviewCount > 0 || shop.rating > 0)) {
      conditions.push({ label: mood.label, applied: true, note: "라멘로그와 평점이 쌓인 곳을 우선했어요" })
    } else {
      conditions.push({ label: mood.label, applied: false, note: "라멘로그 수 정보가 아직 없어 참고만 했어요" })
    }
  } else {
    conditions.push({ label: mood.label, applied: false, note: "매장 분위기 정보는 아직 없어 참고만 했어요" })
  }

  const priority = PRIORITY_OPTIONS.find((option) => option.id === inputs.priorityId)
  if (priority) {
    if (narrow((shop) => hasAnyKey(shop, priority.keys))) {
      conditions.push({ label: priority.label, applied: true, note: "가게 특징과 태그에 이 요소가 있는 곳을 우선했어요" })
    } else {
      conditions.push({ label: priority.label, applied: false, note: "이 요소가 적힌 가게가 없어 참고만 했어요" })
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
        : { label: `직접 입력: ${prompt}`, applied: false, note: "아직 매장 정보와 대조하지 못해 참고만 했어요" },
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
  const shopsQuery = useShops()
  const reducedMotion = useReducedMotion()
  const { width } = useWindowDimensions()
  /** SE 폭에서는 하단 버튼의 장식 아이콘을 빼 문구를 자르지 않는다 */
  const compact = width < 360
  const [inputs, setInputs] = useState<Inputs>(DEFAULT_INPUTS)
  const [step, setStep] = useState<Step>(1)
  const [curation, setCuration] = useState<Curation | null>(null)
  const scrollRef = useRef<ScrollView>(null)
  const headingRef = useRef<View>(null)

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
    router.push({ pathname: "/record/new", params: { shopId: String(shop.id) } })
  }

  if (step === "loading" && curation) {
    return (
      <CurationLoading
        conditions={curation.conditions.map((condition) => condition.label.replace(/^직접 입력: /, ""))}
        onBack={() => setStep(4)}
        onComplete={() => setStep("result")}
      />
    )
  }

  const result = step === "result" ? curation : null
  const resultType = result?.shop.style ?? ""
  const numericStep = typeof step === "number" ? step : null

  return (
    <Screen contentContainerStyle={styles.flex} keyboardAvoiding>
      <Header
        backLabel="뒤로가기"
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/native"))}
        right={
          numericStep ? (
            <AppText accessibilityLabel={`4단계 중 ${numericStep}단계`} capScale style={styles.stepCount} tone="sub" variant="meta">
              {`${numericStep} / 4`}
            </AppText>
          ) : null
        }
        title="AI 라멘 큐레이터"
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
            <View accessible accessibilityRole="header" ref={headingRef}>
              <AppText variant="screenTitle">{STEP_TITLES[numericStep].title}</AppText>
            </View>
            <AppText style={styles.help} tone="sub" variant="secondary">
              {STEP_TITLES[numericStep].help}
            </AppText>

            {numericStep === 1 ? (
              <View accessibilityLabel="국물 베이스" accessibilityRole="radiogroup" style={styles.grid}>
                {SOUP_OPTIONS.map((soup) => {
                  const active = inputs.soupId === soup.id
                  return (
                    <Pressable
                      accessibilityLabel={`${soup.label}, ${soup.sub}`}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      key={soup.id}
                      onPress={() => setInput("soupId", soup.id)}
                      style={({ pressed }) => [styles.option, styles.gridOption, active && styles.optionActive, pressed && !active && styles.pressedWash]}
                    >
                      <View style={styles.flexShrink}>
                        <AppText tone={active ? "onDark" : "ink"} variant="cardTitle">
                          {soup.label}
                        </AppText>
                        <AppText capScale style={styles.optionSub} tone={active ? "onDark" : "muted"} variant="meta">
                          {soup.sub}
                        </AppText>
                      </View>
                      {active ? <Check color={colors.onDark} size={16} /> : null}
                    </Pressable>
                  )
                })}
              </View>
            ) : null}

            {numericStep === 2 || numericStep === 3 ? (
              <View accessibilityLabel={numericStep === 2 ? "식사 상황" : "가장 중요한 요소"} accessibilityRole="radiogroup" style={styles.stack}>
                {(numericStep === 2 ? MOOD_OPTIONS : PRIORITY_OPTIONS).map((option) => {
                  const active = numericStep === 2 ? inputs.moodId === option.id : inputs.priorityId === option.id
                  return (
                    <Pressable
                      accessibilityLabel={option.label}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      key={option.id}
                      onPress={() => setInput(numericStep === 2 ? "moodId" : "priorityId", option.id)}
                      style={({ pressed }) => [styles.option, styles.rowOption, active && styles.optionActive, pressed && !active && styles.pressedWash]}
                    >
                      <AppText style={styles.flexShrink} tone={active ? "onDark" : "ink"} variant="cardTitle">
                        {option.label}
                      </AppText>
                      {active ? <Check color={colors.onDark} size={16} /> : <ChevronRight color={colors.textMuted} size={16} />}
                    </Pressable>
                  )
                })}
              </View>
            ) : null}

            {numericStep === 4 ? (
              <View style={styles.promptWrap}>
                <TextInput
                  accessibilityHint="선택 사항이에요"
                  accessibilityLabel="더 바라는 점"
                  maxFontSizeMultiplier={maxFontScale}
                  maxLength={PROMPT_MAX_LENGTH}
                  multiline
                  onChangeText={(text) => setInput("prompt", text)}
                  placeholder="예: 차슈가 부드럽고 국물이 덜 짠 곳"
                  placeholderTextColor={colors.textMuted}
                  style={styles.promptInput}
                  textAlignVertical="top"
                  value={inputs.prompt}
                />
                <AppText style={styles.quickTitle} tone="sub" variant="secondary">
                  자주 찾는 조건
                </AppText>
                <View style={styles.quickRow}>
                  {QUICK_PROMPTS.map((text) => {
                    const added = inputs.prompt.includes(text)
                    return (
                      <Pressable
                        accessibilityLabel={added ? `${text}, 추가됨` : `${text} 추가`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: added, disabled: added }}
                        disabled={added}
                        key={text}
                        onPress={() => setInput("prompt", inputs.prompt ? `${inputs.prompt}, ${text}` : text)}
                        style={({ pressed }) => [styles.quickChip, added && styles.quickChipAdded, pressed && !added && styles.pressedWash]}
                      >
                        <AppText capScale style={styles.bold} tone={added ? "onDark" : "ink"} variant="secondary">
                          {added ? text : `+ ${text}`}
                        </AppText>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {step === "result" && !result ? (
          <View>
            <View accessible accessibilityRole="header" ref={headingRef}>
              <AppText variant="screenTitle">추천할 라멘집을 찾지 못했어요</AppText>
            </View>
            <AppText style={styles.help} tone="sub" variant="secondary">
              매장 정보를 불러오지 못했어요. 잠시 뒤 다시 추천받아 주세요.
            </AppText>
            <RestartButton onPress={restart} />
          </View>
        ) : null}

        {result ? (
          <View>
            <View accessible accessibilityRole="header" ref={headingRef}>
              <AppText variant="screenTitle">{nickname ? `오늘 ${nickname}님을 위한 라멘집` : "오늘의 추천"}</AppText>
            </View>

            <View style={styles.resultCard}>
              <ResilientUriImage accessibilityLabel={`${result.shop.name} 대표 사진`} style={styles.resultPhoto} uri={result.shop.photos[0]} />
              <View style={styles.resultBody}>
                {resultType ? (
                  <RamenTypeTag type={resultType} />
                ) : result.shop.style ? (
                  <AppText style={styles.bold} tone="muted" variant="secondary">
                    {result.shop.style}
                  </AppText>
                ) : null}
                <AppText style={styles.resultName} variant="screenTitle">
                  {result.shop.name}
                  {result.shop.branch ? (
                    <AppText style={styles.bold} tone="muted" variant="cardTitle">
                      {` · ${result.shop.branch}`}
                    </AppText>
                  ) : null}
                </AppText>
                {result.shop.spec ? (
                  <AppText style={styles.resultSpec} variant="body">
                    {result.shop.spec}
                  </AppText>
                ) : null}
                {result.shop.description ? (
                  <View style={styles.quote}>
                    <AppText variant="body">{result.shop.description}</AppText>
                  </View>
                ) : null}
                {result.shop.tags.length ? (
                  <View accessibilityLabel={`특징: ${result.shop.tags.join(", ")}`} style={styles.tags}>
                    {result.shop.tags.map((tag) => (
                      <Tag key={tag} label={tag} />
                    ))}
                  </View>
                ) : null}
              </View>
            </View>

            {result.conditions.length ? (
              <View style={styles.conditions}>
                <AppText accessibilityRole="header" style={styles.conditionsTitle} variant="cardTitle">
                  추천에 쓴 조건
                </AppText>
                {result.fallback ? (
                  <AppText style={styles.fallbackNote} tone="sub" variant="secondary">
                    조건에 맞는 곳을 찾지 못해 라멘로그가 많고 가까운 곳으로 골랐어요.
                  </AppText>
                ) : null}
                {result.conditions.map((condition, index) => (
                  <View
                    accessible
                    accessibilityLabel={`${condition.label}, ${condition.applied ? "반영" : "참고만"}. ${condition.note}`}
                    key={condition.label}
                    style={[styles.condition, index > 0 && styles.conditionDivider]}
                  >
                    <View style={[styles.conditionIcon, condition.applied ? styles.conditionIconApplied : styles.conditionIconRef]}>
                      {condition.applied ? <Check color={colors.onDark} size={12} /> : <Minus color={colors.textMuted} size={12} />}
                    </View>
                    <View style={styles.flexShrink}>
                      <View style={styles.conditionHead}>
                        <AppText style={styles.flexShrink} variant="bodyStrong">
                          {condition.label}
                        </AppText>
                        <Tag label={condition.applied ? "반영" : "참고만"} />
                      </View>
                      <AppText style={styles.conditionNote} tone="sub" variant="secondary">
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
        <StickyActionBar style={styles.stickyBar}>
          {numericStep > 1 ? (
            <Button fullWidth onPress={() => setStep((numericStep - 1) as Step)} title="이전" variant="outline" />
          ) : null}
          <Button
            leftIcon={numericStep === 4 ? <Sparkles color={colors.onDark} size={16} /> : undefined}
            onPress={() => (numericStep === 4 ? startAnalysis() : setStep((numericStep + 1) as Step))}
            rightIcon={numericStep === 4 ? undefined : <ChevronRight color={colors.onDark} size={16} />}
            style={styles.primaryCta}
            title={numericStep === 4 ? "AI 맞춤 추천받기" : "다음"}
          />
        </StickyActionBar>
      ) : result ? (
        <StickyActionBar style={styles.stickyBar}>
          <Button
            accessibilityHint={loggedIn ? undefined : "로그인 화면으로 이동해요"}
            fullWidth
            leftIcon={compact ? undefined : <PenLine color={colors.ink} size={16} />}
            onPress={() => recordShop(result.shop)}
            style={styles.stickyButton}
            title="이 가게 기록하기"
            variant="outline"
          />
          <Button
            fullWidth
            onPress={() => router.push({ pathname: "/shop/[shopId]", params: { shopId: String(result.shop.id) } })}
            rightIcon={compact ? undefined : <ChevronRight color={colors.onDark} size={16} />}
            style={styles.stickyButton}
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
      <RotateCcw color={colors.ink} size={16} />
      <AppText variant="bodyStrong">다시 추천받기</AppText>
    </Pressable>
  )
}

/** 한 줄이 체크되는 시간 */
const CHECK_DURATION = 240
/** 다 체크된 뒤 붙는 스티커가 톡 튀어나오는 시간 */
const STICKER_POP_DURATION = 260
/** 첫 줄이 체크되기까지 */
const CHECK_START = 400

/**
 * 식권의 한 줄. 네모 칸이 먹색으로 차고 흰 체크가 톡 들어온다.
 * 아직 안 된 줄은 빈 칸에 흐린 글씨라, 무엇이 끝났고 무엇이 남았는지 한눈에 보인다.
 */
function TicketRow({ done, reducedMotion, text }: { done: boolean; reducedMotion: boolean; text: string }) {
  const mark = useSharedValue(done ? 1 : 0)

  useEffect(() => {
    if (reducedMotion) {
      mark.value = done ? 1 : 0
      return
    }
    mark.value = withTiming(done ? 1 : 0, { duration: CHECK_DURATION, easing: Easing.out(Easing.cubic) })
  }, [done, mark, reducedMotion])

  const boxStyle = useAnimatedStyle(() => ({ backgroundColor: mark.value > 0.5 ? colors.ink : colors.canvas }))
  const markStyle = useAnimatedStyle(() => ({
    opacity: mark.value,
    transform: [{ scale: 0.7 + mark.value * 0.3 }],
  }))

  return (
    <View accessible accessibilityRole="checkbox" accessibilityState={{ checked: done }} style={styles.ticketRow}>
      <Animated.View style={[styles.checkBox, boxStyle]}>
        <Animated.View style={markStyle}>
          <Check color={colors.onDark} size={12} strokeWidth={3} />
        </Animated.View>
      </Animated.View>
      <AppText numberOfLines={1} style={styles.flexShrink} tone={done ? "ink" : "muted"} variant="secondary">
        {text}
      </AppText>
    </View>
  )
}

/** 다 체크된 순간 식권에 붙는 "찾았어요" 스티커 */
function TicketSticker({ reducedMotion }: { reducedMotion: boolean }) {
  const pop = useSharedValue(reducedMotion ? 1 : 0)

  useEffect(() => {
    if (reducedMotion) return
    pop.value = withTiming(1, { duration: STICKER_POP_DURATION, easing: Easing.out(Easing.back(2)) })
  }, [pop, reducedMotion])

  const popStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.value * 2),
    transform: [{ scale: 0.9 + pop.value * 0.1 }],
  }))

  return (
    <Animated.View pointerEvents="none" style={[styles.ticketSticker, popStyle]}>
      <Sticker icon={<Check color={colors.ink} size={12} />} label="찾았어요" style={styles.stickerRight} />
    </Animated.View>
  )
}

/**
 * 라멘집 식권 한 장. 고른 조건이 한 줄씩 적혀 있고 하나씩 체크된다.
 * 무엇이 끝났는지 화면에 남기 때문에 "지금 무엇을 해주고 있나"가 사라지지 않는다.
 * 조건이 실제로 반영됐는지 참고만 했는지는 결과 화면이 말한다 — 로딩은 체크만 한다.
 */
function CurationLoading({ conditions, onBack, onComplete }: { conditions: string[]; onBack: () => void; onComplete: () => void }) {
  const { width: screenWidth } = useWindowDimensions()
  const reducedMotion = useReducedMotion()
  const [stage, setStage] = useState(0)
  const [checked, setChecked] = useState(0)
  const titleRef = useRef<View>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const complete = stage === 3
  const ticketWidth = Math.min(280, screenWidth - spacing.gutter * 2 - spacing.x6)

  const rows = useMemo(() => (conditions.length ? conditions : ["전체 라멘집에서 고르기"]), [conditions])

  useEffect(() => {
    const timers = [
      setTimeout(() => setStage(1), LOADING_DURATION / 3),
      setTimeout(() => setStage(2), (LOADING_DURATION * 2) / 3),
      setTimeout(() => setStage(3), LOADING_DURATION),
      setTimeout(() => onCompleteRef.current(), LOADING_DURATION + 650),
    ]
    const focus = setTimeout(() => focusOn(titleRef), 250)
    return () => {
      timers.forEach(clearTimeout)
      clearTimeout(focus)
    }
  }, [])

  // 줄은 로딩이 끝나기 전에 전부 체크된다. Reduce Motion이면 처음부터 다 체크된 상태
  useEffect(() => {
    if (reducedMotion) {
      setChecked(rows.length)
      return
    }
    const step = (LOADING_DURATION - CHECK_START - 500) / rows.length
    const timers = rows.map((_, index) => setTimeout(() => setChecked(index + 1), CHECK_START + index * step))
    return () => timers.forEach(clearTimeout)
  }, [reducedMotion, rows])

  const message = useMemo(() => LOADING_MESSAGES[stage], [stage])

  return (
    <Screen contentContainerStyle={styles.flex}>
      <View style={styles.loadingHeader}>
        <IconButton accessibilityLabel="추천 조건으로 돌아가기" icon={<ChevronLeft color={colors.ink} size={22} />} onPress={onBack} />
        <AppText variant="cardTitle">AI 라멘 추천</AppText>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.loadingBody}>
        <View accessible accessibilityRole="header" ref={titleRef}>
          <AppText style={styles.center} variant="headline">
            {"오늘의 한 그릇을\n찾고 있어요"}
          </AppText>
        </View>

        {/* 고른 조건이 적힌 식권 한 장. 반영되는 대로 한 줄씩 체크된다 */}
        <View style={styles.visual}>
          <View style={[styles.ticket, { width: ticketWidth }]}>
            <View style={styles.ticketHead}>
              <Image
                accessibilityIgnoresInvertColors
                contentFit="contain"
                source={require("@/assets/images/logo.png")}
                style={styles.ticketLogo}
              />
              <AppText style={styles.ticketLabel} tone="sub" variant="meta">
                식권
              </AppText>
            </View>
            <View style={styles.ticketRule} />
            {rows.map((text, index) => (
              <TicketRow done={index < checked} key={text} reducedMotion={reducedMotion} text={text} />
            ))}
          </View>
          {complete ? <TicketSticker reducedMotion={reducedMotion} /> : null}
        </View>

        <View accessibilityLiveRegion="polite" style={styles.statusLine}>
          <View style={styles.statusDot} />
          <AppText accessibilityRole="text" tone="sub" variant="secondary">
            {message}
          </AppText>
        </View>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1, minWidth: 0 },
  bold: { fontWeight: "700" },
  center: { textAlign: "center" },
  pressedWash: { backgroundColor: colors.canvasSoft },
  stepCount: { fontVariant: ["tabular-nums"], paddingRight: spacing.x3 },

  body: { paddingHorizontal: spacing.gutter, paddingTop: spacing.x5, paddingBottom: spacing.x6 },
  // 진행 막대: 1.5pt 먹선으로 두른 흰 알약 안을 빨강으로 채운다. 선이 보이도록 4pt보다 두껍게 잡았다
  progressTrack: {
    height: 10,
    borderRadius: radii.pill,
    borderWidth: line.thin,
    borderColor: colors.outline,
    backgroundColor: colors.canvas,
    overflow: "hidden",
    marginBottom: spacing.x5,
  },
  progressFill: { height: "100%", borderRadius: radii.pill, backgroundColor: colors.brand },
  help: { marginTop: spacing.x1_5 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x2, marginTop: spacing.x5 },
  stack: { gap: spacing.x2, marginTop: spacing.x5 },
  // 선택 칸: 흰 면 + 2pt 먹선 + 12pt, 고른 칸은 빨강 면 + 흰 글씨. 그림자는 없다
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.x2,
    borderRadius: radii.sm,
    borderWidth: line.base,
    borderColor: colors.outline,
    backgroundColor: colors.canvas,
  },
  gridOption: { flexBasis: "47%", flexGrow: 1, minHeight: 64, paddingHorizontal: spacing.x3_5, paddingVertical: spacing.x3 },
  rowOption: { minHeight: 56, paddingHorizontal: spacing.x4, paddingVertical: spacing.x3 },
  optionActive: { borderColor: colors.outline, backgroundColor: colors.brand },
  optionSub: { marginTop: spacing.x0_5 },

  promptWrap: { marginTop: spacing.x5 },
  promptInput: {
    ...typography.body,
    minHeight: 96,
    padding: spacing.x3_5,
    paddingTop: spacing.x3_5,
    borderRadius: radii.sm,
    borderWidth: line.base,
    borderColor: colors.outline,
    backgroundColor: colors.canvas,
    color: colors.ink,
  },
  quickTitle: { fontWeight: "700", marginTop: spacing.x4, marginBottom: spacing.x2 },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x2 },
  quickChip: {
    minHeight: touchTarget,
    justifyContent: "center",
    paddingHorizontal: spacing.x3_5,
    borderRadius: radii.pill,
    borderWidth: line.thin,
    borderColor: colors.outline,
    backgroundColor: colors.canvas,
  },
  quickChipAdded: { borderColor: colors.outline, backgroundColor: colors.brand },

  primaryCta: { flex: 2 },
  stickyBar: { paddingHorizontal: spacing.x4 },
  stickyButton: { paddingHorizontal: spacing.x3 },

  // 결과 카드: 흰 면 + 2pt 먹선. 사진과 글씨 영역은 2pt 먹선으로 나눈다
  resultCard: {
    marginTop: spacing.x4,
    borderWidth: line.base,
    borderColor: colors.outline,
    borderRadius: radii.sm,
    backgroundColor: colors.canvas,
    overflow: "hidden",
  },
  resultPhoto: { width: "100%", aspectRatio: 16 / 10 },
  resultBody: { padding: spacing.x4, borderTopWidth: line.base, borderTopColor: colors.outline },
  resultName: { marginTop: spacing.x2 },
  resultSpec: { marginTop: spacing.x1_5 },
  // 가게 소개는 꾸미지 않은 본문으로 둔다(세로줄 장식 없음)
  quote: { marginTop: spacing.x3 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x1_5, marginTop: spacing.x3 },

  conditions: { marginTop: spacing.x5 },
  conditionsTitle: { paddingBottom: spacing.x2, borderBottomWidth: 1, borderBottomColor: colors.border },
  fallbackNote: { marginTop: spacing.x3 },
  condition: { flexDirection: "row", alignItems: "flex-start", gap: spacing.x3, paddingVertical: spacing.x3 },
  conditionDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  // 조건 이름과 "반영 / 참고만" 태그. 좁은 폭에서는 줄바꿈한다
  conditionHead: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.x2 },
  // 작은 표시 칸은 1.5pt 먹선. 옅은 면만으로는 미색 바탕에서 보이지 않는다
  conditionIcon: {
    width: 20,
    height: 20,
    marginTop: spacing.x0_5,
    borderRadius: radii.pill,
    borderWidth: line.thin,
    borderColor: colors.outline,
    alignItems: "center",
    justifyContent: "center",
  },
  conditionIconApplied: { backgroundColor: colors.ink },
  conditionIconRef: { backgroundColor: colors.canvas },
  conditionNote: { marginTop: spacing.x0_5 },
  // 그림자 없는 키라 누름은 canvasSoft 배경. 글씨 위치는 그대로 두고 음수 여백으로 누름 면만 넓힌다
  restart: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x1_5,
    minHeight: touchTarget,
    alignSelf: "flex-start",
    marginTop: spacing.x3,
    marginHorizontal: -spacing.x2,
    paddingHorizontal: spacing.x2,
    borderRadius: radii.sm,
  },

  loadingHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.x4, paddingVertical: spacing.x2 },
  headerSpacer: { width: touchTarget },
  loadingBody: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.x6, paddingVertical: spacing.x4 },
  loadingConditions: { marginTop: spacing.x3, maxWidth: 280 },
  visual: { alignSelf: "center", marginVertical: spacing.x6 },
  // 식권 한 장: 흰 면 + 2pt 먹선. 누를 수 없으니 그림자는 없다
  ticket: {
    paddingHorizontal: spacing.x4,
    paddingVertical: spacing.x4,
    borderRadius: radii.xs,
    borderWidth: line.base,
    borderColor: colors.outline,
    backgroundColor: colors.canvas,
  },
  ticketHead: { flexDirection: "row", alignItems: "center", gap: spacing.x2 },
  ticketLogo: { width: 20, height: 20 },
  ticketLabel: { letterSpacing: 2 },
  ticketRule: { height: 1, backgroundColor: colors.border, marginTop: spacing.x3, marginBottom: spacing.x1 },
  ticketRow: { flexDirection: "row", alignItems: "center", gap: spacing.x3, paddingVertical: spacing.x2 },
  // 체크 칸: 1.5pt 먹선 + 6pt. 테두리는 가만히 있고 면과 체크만 들어온다
  checkBox: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.xs,
    borderWidth: line.thin,
    borderColor: colors.outline,
  },
  // 다 체크된 순간에만 붙는 노랑 스티커. 식권 오른쪽 아래 모서리에 걸친다
  ticketSticker: { position: "absolute", right: 0, bottom: -13 },
  // Sticker는 기본이 alignSelf: flex-start라 오른쪽으로 보내려면 직접 덮어써야 한다
  stickerRight: { alignSelf: "flex-end" },
  statusLine: { flexDirection: "row", alignItems: "center", gap: spacing.x2, minHeight: 24 },
  statusDot: { width: 4, height: 4, borderRadius: radii.pill, backgroundColor: colors.brand },
})
