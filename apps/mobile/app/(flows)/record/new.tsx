import { t, getLocale, getIntlLocale, formatDate as formatLocaleDate } from "@raota/shared"
import { useLocale } from "@/src/i18n"
import * as Haptics from "expo-haptics"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { router, useLocalSearchParams, useNavigation } from "expo-router"
import { usePreventRemove, type NavigationAction } from "expo-router/react-navigation"
import { StatusBar } from "expo-status-bar"
import { Image } from "expo-image"
import * as ImagePicker from "expo-image-picker"
import DateTimePicker from "@react-native-community/datetimepicker"
import { CalendarDays, Camera, ChevronRight, FileX, LogIn, X } from "lucide-react-native"
import {
  AccessibilityInfo,
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  findNodeHandle,
  useColorScheme,
} from "react-native"
import Animated, {
  Easing,
  FadeIn,
  FadeInLeft,
  FadeInRight,
  FadeInUp,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"

import {
  RAMEN_TYPES,
  REVISIT_OPTIONS,
  REVISIT_SCORE,
  TASTE_AXES,
  type CreateRamenLogInput,
  type RevisitOption,
  type Shop,
  type ShopCatalogItem,
  type TasteAxisKey,
  type TasteNoteKey,
  type TasteNotes,
  type TasteScores,
} from "@raota/shared"
import { track } from "@/src/analytics"
import { useLog, useShop, useShops, useTasteNoteFields } from "@/src/data"
import {
  RECORD_NOTE_MAX_LENGTH,
  validateRecordDraft,
  withObjectParticle,
  type RecordDraft,
} from "@/src/domain"
import { useRaota } from "@/src/state/RaotaStore"
import {
  AppText,
  ConfirmDialog,
  EmptyState,
  Header,
  LoadingState,
  StickyActionBar,
  TicketCut,
} from "@/src/components/ui"
import { EdgeBackZone } from "@/src/components/EdgeBackZone"
import { sizedImageUri } from "@/src/api/imageSize"
import { TASTE_REPORT_ENABLED } from "@/src/features"
import { colors, maxFontScale, pressFade, radii, spacing, touchTarget, typography, usePalette } from "@/src/theme"

/*
 * 한 장씩 감정서(사용자 결정, 2026.10.23. 시안: prototype/record-screen 브랜치).
 * 위에는 답할수록 채워지는 감정서 한 장, 아래에는 질문 하나. 스크롤 없이 한 화면에 들어간다.
 * 메뉴·종류 → 점수 넷 → 재방문 → 추가 감정(맛 태그·메모·사진·공개, 선택) 일곱 단계이고,
 * 답을 고른 뒤 "다음"을 눌러 넘어간다(저절로 넘기지 않는다, 사용자 결정 2026.10.23). 감정서 칸을 누르면 그 질문으로 돌아간다.
 * 고른 점수는 저장 뒤 완료 화면의 취향 기록지에 펜 동그라미로 한 번 더 보여 준다.
 */

type ScoreAxisKey = Exclude<TasteAxisKey, "revisit">
type StepKey = "meal" | ScoreAxisKey | "revisit" | "extra"
type FieldKey = "shop" | "menu" | "ramenType" | "visitedAt" | "note" | "tasteNotes" | TasteAxisKey
type MissingField = { key: FieldKey; label: string; kind: "text" | "choice" }
type LeaveIntent =
  | { kind: "action"; action: NavigationAction }
  | { kind: "back" }
  | { kind: "complete"; logId: string }
/** 헤더 높이. 가장자리 뒤로 쓸기 띠를 헤더 아래에서 시작해 뒤로가기 버튼을 덮지 않는다 */
const FLOW_HEADER_HEIGHT = 52

const STEPS: readonly StepKey[] = ["meal", "satisfaction", "brothDensity", "noodleFirmness", "topping", "revisit", "extra"]
const LAST_STEP = STEPS.length - 1
const QUESTIONS: Record<StepKey, string> = {
  meal: "무엇을 먹었나요?",
  satisfaction: "전체 만족도는 어땠나요?",
  brothDensity: "육수 농도는 어땠나요?",
  noodleFirmness: "면 삶기는 어땠나요?",
  topping: "토핑은 어땠나요?",
  revisit: "다시 가고 싶나요?",
  extra: "더 남길 감정이 있나요?",
}
/** 빠진 항목이 어느 질문에서 채워지는지. 방문일은 감정서 머리의 날짜로 고친다 */
const FIELD_STEP: Record<FieldKey, StepKey | null> = {
  shop: "meal",
  menu: "meal",
  ramenType: "meal",
  satisfaction: "satisfaction",
  brothDensity: "brothDensity",
  noodleFirmness: "noodleFirmness",
  topping: "topping",
  revisit: "revisit",
  visitedAt: null,
  note: "extra",
  tasteNotes: "extra",
}
/** 화면 전환 기본 곡선(DESIGN.md Motion) */
const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1)

const SCORE_AXES = TASTE_AXES.filter((axis): axis is (typeof TASTE_AXES)[number] & { key: ScoreAxisKey } => axis.key !== "revisit")
const REVISIT_LABEL = TASTE_AXES.find((axis) => axis.key === "revisit")?.label ?? "재방문 의사"
/** 점수마다 보기 문구. 축의 의미는 그대로 두고 말로 고른다 */
const AXIS_WORDS: Record<ScoreAxisKey, readonly string[]> = {
  satisfaction: ["아쉬웠어요", "그저 그랬어요", "괜찮았어요", "맛있었어요", "인생 라멘이에요"],
  brothDensity: ["아주 맑음", "맑은 편", "중간", "진한 편", "아주 진함"],
  noodleFirmness: ["아주 부드럽게", "부드러운 편", "중간", "단단한 편", "아주 단단하게"],
  topping: ["아쉬움", "조금 아쉬움", "보통", "좋음", "훌륭함"],
}
const CELL_LABELS: Record<Exclude<StepKey, "meal">, string> = {
  satisfaction: "만족",
  brothDensity: "육수",
  noodleFirmness: "면",
  topping: "토핑",
  revisit: "재방문",
  extra: "감정",
}

/** 낮은 점수부터 높은 점수 순 */
const REVISIT_CHOICES = [...REVISIT_OPTIONS].reverse().map((label) => ({
  label,
  value: REVISIT_SCORE[label],
  display: label === "자주 감" ? "자주 갈래요" : label === "가끔 생각남" ? "가끔" : "한 번이면 충분",
}))
/** 감정서 칸의 짧은 재방문 말. 완료 화면 식권과 같다 */
const revisitShort = (option: RevisitOption) => (REVISIT_SCORE[option] === 5 ? "자주" : REVISIT_SCORE[option] === 3 ? "가끔" : "한 번")
const VISIBILITY_CHOICES = [
  { label: "나만 보기", value: false },
  { label: "공개", value: true },
] as const
/** 기록 하나에 붙일 수 있는 사진 수. 서버 sort_order 0~2와 맞춘다 */
const RECORD_PHOTO_MAX = 3
const EMPTY_TASTE_NOTES: TasteNotes = { broth: [], noodle: [], seasoning: [], topping: [] }
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"]

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatDateLabel(date: Date) {
  if (getLocale() !== "ko") return formatLocaleDate(date, { year: "numeric", month: "long", day: "numeric", weekday: "short" })
  return t("{v1}년 {v2}월 {v3}일 ({v4})", { v1: date.getFullYear(), v2: date.getMonth() + 1, v3: date.getDate(), v4: WEEKDAYS[date.getDay()] })
}

/** "YYYY-MM-DD"를 그날의 로컬 날짜로 읽는다. 읽지 못하면 null */
function parseDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

type FormValues = {
  menuName: string
  ramenType: string
  visitedAt: string
  scores: Partial<Record<ScoreAxisKey, number>>
  revisit: RevisitOption | null
  photos: string[]
  note: string
  tasteNotes: TasteNotes
  isPublic: boolean
}

/** 기록 고치기에서 입력이 불러온 값과 달라졌는지 비교하는 값. 점수와 태그는 키 순서를 고정한다 */
function formSignature({ scores, tasteNotes, ...rest }: FormValues): string {
  return JSON.stringify({
    ...rest,
    scores: SCORE_AXES.map(({ key }) => scores[key] ?? null),
    tasteNotes: (Object.keys(EMPTY_TASTE_NOTES) as TasteNoteKey[]).map((key) => tasteNotes[key] ?? []),
  })
}

/** 원장 매장의 대표 스타일("미소 라멘"). 없으면 빈 문자열 */
function styleOf(shop: Shop | null | undefined): string {
  const style = (shop as Partial<ShopCatalogItem> | null | undefined)?.style
  return typeof style === "string" ? style : ""
}

/** 대표 스타일이 라멘 종류 목록과 정확히 맞을 때만 미리 고른다. 아니면 직접 고르게 둔다. */
function inferRamenType(style: string): string {
  const base = style.replace(/ 라멘$/, "")
  return RAMEN_TYPES.includes(base) ? base : ""
}

/** VoiceOver 포커스를 옮긴다. 웹 미리보기에서는 DOM focus로 대신한다 */
function moveAccessibilityFocus(target: View | null) {
  if (!target) return
  try {
    if (Platform.OS === "web") {
      ;(target as unknown as { focus?: () => void }).focus?.()
      return
    }
    const tag = findNodeHandle(target)
    if (tag) AccessibilityInfo.setAccessibilityFocus(tag)
  } catch {
    // 포커스를 옮기지 못해도 질문 제목과 안내 문구는 남는다.
  }
}

const selectionHaptic = () => {
  if (Platform.OS !== "web") void Haptics.selectionAsync().catch(() => undefined)
}

/** 라멘 종류와 맛 태그 알약. 고르면 선택 면으로 뒤집힌다 */
function RecordChoice({
  label,
  selected,
  onPress,
  accessibilityLabel = label,
  role = "button",
}: {
  label: string
  selected: boolean
  onPress: () => void
  accessibilityLabel?: string
  role?: "button" | "radio"
}) {
  return (
    <Pressable
      accessibilityLabel={t(accessibilityLabel)}
      accessibilityRole={role}
      accessibilityState={role === "radio" ? { checked: selected } : { selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.choice, selected && styles.choiceSelected, pressed && !selected && styles.pressed, pressed && styles.pressScale]}
    >
      <AppText capScale style={[styles.choiceText, selected && styles.onSelectedText]} variant="button">
        {t(label)}
      </AppText>
    </Pressable>
  )
}

/** 질문의 보기 한 줄. 고르면 선택 색이 왼쪽에서 차오르고 오른쪽 번호가 살짝 커진다 */
function AnswerOption({
  label,
  number,
  index,
  selected,
  onPress,
  accessibilityLabel,
}: {
  label: string
  number: number
  index: number
  selected: boolean
  onPress: () => void
  accessibilityLabel: string
}) {
  const reduceMotion = useReducedMotion()
  const fill = useSharedValue(selected ? 1 : 0)
  useEffect(() => {
    fill.value = reduceMotion ? (selected ? 1 : 0) : withTiming(selected ? 1 : 0, { duration: 280, easing: EASE_OUT })
  }, [fill, reduceMotion, selected])
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }))
  const numberStyle = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(fill.value, [0, 1], [1, 1.12]) }] }))
  return (
    <Animated.View entering={FadeInUp.delay(index * 30).duration(320).easing(EASE_OUT)}>
      <Pressable
        accessibilityLabel={t(accessibilityLabel)}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        onPress={onPress}
        style={({ pressed }) => [styles.option, pressed && !selected && styles.pressed, pressed && styles.pressScale]}
      >
        <Animated.View pointerEvents="none" style={[styles.optionFill, fillStyle]} />
        <AppText capScale lineBreakStrategyIOS="hangul-word" style={[styles.optionText, selected && styles.onSelectedText]} variant="bodyStrong">
          {t(label)}
        </AppText>
        <Animated.View style={[styles.optionNumber, numberStyle]}>
          <AppText capScale style={styles.optionNumberText} variant="button">{number}</AppText>
        </Animated.View>
      </Pressable>
    </Animated.View>
  )
}

/** 감정서 아래 점수 칸. 값이 들어오면 뒤집히며 튀어나온다. 누르면 그 질문으로 간다 */
function TicketCell({
  label,
  value,
  current,
  enabled,
  onPress,
  accessibilityLabel,
}: {
  label: string
  value: string | null
  current: boolean
  enabled: boolean
  onPress: () => void
  accessibilityLabel: string
}) {
  const reduceMotion = useReducedMotion()
  const pop = useSharedValue(1)
  const previous = useRef(value)
  useEffect(() => {
    if (previous.current === value) return
    previous.current = value
    if (value === null || reduceMotion) return
    pop.value = 0
    pop.value = withTiming(1, { duration: 460, easing: Easing.out(Easing.back(2.2)) })
  }, [pop, reduceMotion, value])
  const popStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 400 },
      { rotateX: `${interpolate(pop.value, [0, 1], [-90, 0])}deg` },
      { scale: interpolate(pop.value, [0, 1], [0.8, 1]) },
    ],
  }))
  return (
    <Pressable
      accessibilityLabel={t(accessibilityLabel)}
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled, selected: current }}
      disabled={!enabled}
      hitSlop={{ top: spacing.x1_5, bottom: spacing.x1_5 }}
      onPress={onPress}
      style={styles.cell}
    >
      <Animated.View style={[styles.cellBox, value !== null && styles.cellBoxFilled, current && styles.cellBoxCurrent, popStyle]}>
        {value !== null ? (
          <AppText capScale maxFontSizeMultiplier={1.15} numberOfLines={1} style={[styles.cellValue, styles.onSelectedText]} variant="button">
            {value}
          </AppText>
        ) : null}
      </Animated.View>
      <AppText capScale maxFontSizeMultiplier={1.15} numberOfLines={1} tone="muted" variant="meta">
        {t(label)}
      </AppText>
    </Pressable>
  )
}

/** 선택 면이 미끄러져 다니는 알약 묶음(맛 태그 분류, 공개 범위) */
function SlidingSegments<T extends string | boolean>({
  items,
  value,
  onChange,
  accessibilityLabel,
  stretch = false,
}: {
  items: readonly { key: T; label: string; badge?: string; hint?: string }[]
  value: T
  onChange: (key: T) => void
  accessibilityLabel: string
  stretch?: boolean
}) {
  const reduceMotion = useReducedMotion()
  const [widths, setWidths] = useState<number[]>([])
  const index = Math.max(0, items.findIndex((item) => item.key === value))
  const offsets = widths.map((_, i) => widths.slice(0, i).reduce((sum, width) => sum + width, 0))
  const x = useSharedValue(0)
  const width = useSharedValue(0)
  const measured = widths.length === items.length && widths.every((w) => w > 0)
  useEffect(() => {
    if (!measured) return
    const targetX = offsets[index] ?? 0
    const targetWidth = widths[index] ?? 0
    if (reduceMotion || width.value === 0) {
      x.value = targetX
      width.value = targetWidth
      return
    }
    x.value = withTiming(targetX, { duration: 300, easing: EASE_OUT })
    width.value = withTiming(targetWidth, { duration: 300, easing: EASE_OUT })
    // offsets·widths는 widths에서 나온 값이라 widths만 본다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, measured, reduceMotion, widths])
  const thumbStyle = useAnimatedStyle(() => ({ width: width.value, transform: [{ translateX: x.value }] }))
  return (
    <View accessibilityLabel={t(accessibilityLabel)} style={[styles.segments, stretch && styles.segmentsStretch]}>
      {measured ? <Animated.View pointerEvents="none" style={[styles.segmentThumb, thumbStyle]} /> : null}
      {items.map((item, i) => {
        const selected = item.key === value
        return (
          <Pressable
            accessibilityHint={item.hint}
            accessibilityLabel={item.badge ? t("{v1}, {v2}개 고름", { v1: t(item.label), v2: item.badge }) : t(item.label)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={String(item.key)}
            onLayout={(event) => {
              const next = event.nativeEvent.layout.width
              setWidths((current) => {
                if (current[i] === next) return current
                const copy = [...current]
                copy[i] = next
                return copy
              })
            }}
            onPress={() => {
              if (!selected) selectionHaptic()
              onChange(item.key)
            }}
            style={[styles.segment, stretch && styles.segmentStretch, !measured && selected && styles.choiceSelected]}
          >
            <AppText capScale numberOfLines={1} style={[styles.segmentText, selected && styles.onSelectedText]} variant="button">
              {t(item.label)}
            </AppText>
            {item.badge ? (
              <AppText capScale style={[styles.segmentBadge, selected && styles.onSelectedText]} tone="muted" variant="meta">
                {item.badge}
              </AppText>
            ) : null}
          </Pressable>
        )
      })}
    </View>
  )
}

/** 진행 막대. 단계가 바뀌면 길이가 미끄러지듯 따라간다 */
function StepProgress({ step }: { step: number }) {
  const reduceMotion = useReducedMotion()
  const progress = useSharedValue((step + 1) / STEPS.length)
  useEffect(() => {
    const target = (step + 1) / STEPS.length
    progress.value = reduceMotion ? target : withTiming(target, { duration: 450, easing: EASE_OUT })
  }, [progress, reduceMotion, step])
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }))
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, fillStyle]} />
    </View>
  )
}

export default function NewRecordScreen() {
  useLocale()
  const { shopId, logId } = useLocalSearchParams<{ shopId?: string; logId?: string }>()
  const navigation = useNavigation()
  const { state, isHydrated, currentUser, actions } = useRaota()
  const reduceMotion = useReducedMotion()
  const insets = useSafeAreaInsets()
  // 날짜 선택기는 hex 문자열만 받는다
  const palette = usePalette()
  // 어두운 모드의 ink(흰색)를 강조색으로 쓰면 iOS가 오늘 날짜를 흰 원 위 흰 글씨로 그린다
  const pickerAccent = useColorScheme() === "dark" ? palette.brand : palette.ink
  const initialShopId = typeof shopId === "string" && shopId.length > 0 ? shopId : null
  // logId가 오면 내 기록 고치기다. 가게는 바꿀 수 없고 새 기록 초안도 쓰지 않는다
  const editLogId = typeof logId === "string" && logId.length > 0 ? logId : null
  const isEdit = editLogId !== null
  const editQuery = useLog(editLogId)
  const editLog = editQuery.data
  const canEdit = Boolean(editLog && currentUser && editLog.author.id === currentUser.id)
  const selectedShopId = isEdit ? null : (state.recordDraft?.shopId ?? initialShopId)
  const catalogShop = useShop(selectedShopId).data
  const shop: { id: string; name: string; branch?: string } | null = isEdit ? (editLog?.shop ?? null) : catalogShop
  const shops = useShops().data
  const shopStyle = styleOf(catalogShop)
  const tasteFields = useTasteNoteFields()

  const today = useRef(new Date()).current
  const [menuName, setMenuName] = useState("")
  const [ramenType, setRamenType] = useState(() => inferRamenType(shopStyle))
  const [visitDate, setVisitDate] = useState(today)
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const [scores, setScores] = useState<Partial<Record<ScoreAxisKey, number>>>({})
  const [revisit, setRevisit] = useState<RevisitOption | null>(null)
  const [photos, setPhotos] = useState<string[]>([])
  const [note, setNote] = useState("")
  const [tasteNotes, setTasteNotes] = useState<TasteNotes>(EMPTY_TASTE_NOTES)
  // 새 기록은 공개가 기본이다(사용자 결정, 2026.10.23). 고치기는 불러온 값으로 바꾼다
  const [isPublic, setIsPublic] = useState(true)
  const [step, setStep] = useState(0)
  // 감정서 칸으로 돌아갈 수 있는 가장 먼 질문
  const [reached, setReached] = useState(0)
  // 질문이 들어오는 방향. 처음 그릴 때는 움직이지 않는다
  const [direction, setDirection] = useState<"next" | "back" | null>(null)
  const [tagTab, setTagTab] = useState<TasteNoteKey>("broth")
  // 다음·저장을 눌렀는데 비어 있어 막힌 질문. 그 질문에서만 안내를 빨갛게 한다
  const [nudgedStep, setNudgedStep] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [leaveVisible, setLeaveVisible] = useState(false)
  // 나가기가 허락된 뒤의 이동. 상태여야 usePreventRemove가 네이티브 스와이프 차단까지 풀고 나서 이동한다
  const [leaving, setLeaving] = useState<LeaveIntent | null>(null)
  // 고치기에서 처음 불러온 입력. 채우기 전에는 null이고, 이것과 달라졌을 때만 나가기를 막는다
  const [editBaseline, setEditBaseline] = useState<string | null>(null)

  // 상태는 다음 렌더까지 바뀌지 않아 빠른 두 번 탭이 둘 다 통과한다. 저장은 ref로 한 번만 받는다
  const savingRef = useRef(false)
  const pendingLeave = useRef<NavigationAction | null>(null)
  const previousShopId = useRef(selectedShopId)
  const shopRef = useRef<View>(null)
  const menuRef = useRef<TextInput>(null)
  const noteRef = useRef<TextInput>(null)
  const questionRef = useRef<View>(null)
  // 질문에 들어선 뒤 옮길 포커스. 빠진 메뉴·메모로 데려갈 때만 입력칸에 둔다
  const focusOnEnter = useRef<"menu" | "note" | "question">("question")

  const visitedAt = formatDate(visitDate)
  const trimmedMenu = menuName.trim()
  const selectedTagCount = tasteFields.reduce((sum, field) => sum + (tasteNotes[field.key]?.length ?? 0), 0)
  const extraCount = selectedTagCount + photos.length + (note.trim() ? 1 : 0)

  // 고칠 기록은 한 번만 채운다. 5축 도입 전 기록처럼 점수가 없으면 그 질문부터 다시 고르게 한다
  useEffect(() => {
    if (!editLog || !canEdit || editBaseline !== null) return
    const filled: FormValues = {
      menuName: editLog.menuName,
      ramenType: editLog.ramenType,
      visitedAt: formatDate(parseDate(editLog.visitedAt) ?? today),
      scores: editLog.scores
        ? {
            satisfaction: editLog.scores.satisfaction,
            brothDensity: editLog.scores.brothDensity,
            noodleFirmness: editLog.scores.noodleFirmness,
            topping: editLog.scores.topping,
          }
        : {},
      revisit: editLog.revisit ?? null,
      photos: (editLog.photos ?? (editLog.imageUrl ? [editLog.imageUrl] : [])).slice(0, RECORD_PHOTO_MAX),
      note: editLog.note ?? "",
      tasteNotes: { ...EMPTY_TASTE_NOTES, ...editLog.tasteNotes },
      isPublic: editLog.isPublic,
    }
    setMenuName(filled.menuName)
    setRamenType(filled.ramenType)
    setVisitDate(parseDate(editLog.visitedAt) ?? today)
    setScores(filled.scores)
    setRevisit(filled.revisit)
    setPhotos(filled.photos)
    setNote(filled.note)
    setTasteNotes(filled.tasteNotes)
    setIsPublic(filled.isPublic)
    setEditBaseline(formSignature(filled))
    // 고치기는 이미 쓴 감정서라 저장이 있는 마지막 장에서 연다. 칸을 눌러 고칠 질문으로 간다
    const firstEmpty = STEPS.findIndex((key) =>
      key === "revisit" ? !filled.revisit : key !== "meal" && key !== "extra" && filled.scores[key] == null,
    )
    setStep(firstEmpty === -1 ? LAST_STEP : firstEmpty)
    setReached(LAST_STEP)
  }, [canEdit, editBaseline, editLog, today])

  useEffect(() => {
    if (isEdit) return
    actions.startRecordDraft(initialShopId)
  }, [actions.startRecordDraft, initialShopId, isEdit])

  // "변경"으로 가게를 바꾸면 그 가게의 대표 스타일이 목록과 맞을 때만 종류를 다시 고른다.
  useEffect(() => {
    if (previousShopId.current === selectedShopId) return
    previousShopId.current = selectedShopId
    const inferred = inferRamenType(shopStyle)
    if (inferred) setRamenType(inferred)
  }, [selectedShopId, shopStyle])

  const draft: RecordDraft = {
    shopId: shop?.id ?? null,
    menuName,
    ramenType,
    visitedAt,
    scores,
    revisit,
    note,
    tasteNotes,
    photos,
    imageUrl: photos[0] ?? null,
    isPublic,
  }
  const validShopIds = useMemo(() => shops.map((item) => item.id), [shops])
  // 고치기에서는 가게가 기록에 고정이라 매장 목록과 맞춰 보지 않는다
  const missing: MissingField[] = validateRecordDraft(draft, { validShopIds: isEdit ? undefined : validShopIds, now: new Date() }).flatMap(
    (error): MissingField[] => {
      switch (error.field) {
        case "shopId":
          return [{ key: "shop", label: t("가게"), kind: "choice" }]
        case "menuName":
          return [{ key: "menu", label: t("먹은 메뉴"), kind: "text" }]
        case "ramenType":
          return [{ key: "ramenType", label: t("라멘 종류"), kind: "choice" }]
        case "visitedAt":
          return [{ key: "visitedAt", label: t("방문일"), kind: "choice" }]
        case "scores": {
          const axis = TASTE_AXES.find(({ key }) => key === error.axis)
          return axis ? [{ key: axis.key, label: axis.label, kind: "choice" }] : []
        }
        case "note":
          return [{ key: "note", label: t("메모"), kind: "text" }]
        case "tasteNotes":
          return [{ key: "tasteNotes", label: t("맛 태그"), kind: "choice" }]
        default:
          return []
      }
    },
  )
  // 질문 순서대로 안내한다. 방문일은 질문이 없어 맨 뒤다
  const stepIndexOfField = (key: FieldKey) => {
    const owner = FIELD_STEP[key]
    return owner ? STEPS.indexOf(owner) : STEPS.length
  }
  missing.sort((a, b) => stepIndexOfField(a.key) - stepIndexOfField(b.key))
  const isComplete = missing.length === 0
  const mealMissing = missing.filter((item) => FIELD_STEP[item.key] === "meal")

  const missingHint = (items: MissingField[]) => {
    const shown = items.slice(0, 3).map((item) => item.label)
    const rest = items.length - shown.length
    const subject = rest > 0 ? t("{fields} 외 {count}개", { fields: shown.join(", "), count: rest }) : shown.join(", ")
    const verb = items.some((item) => item.kind === "text") ? t("채워주세요") : t("골라주세요")
    return `${withObjectParticle(subject)} ${verb}`
  }

  const isAnswered = (key: StepKey) =>
    key === "meal" ? mealMissing.length === 0 : key === "revisit" ? revisit !== null : key === "extra" ? true : scores[key] != null
  /** 다음에 답할 질문. 뒤에 빈 질문이 없으면 저장이 있는 마지막 장이다 */
  const nextStepAfter = (index: number) => {
    for (let candidate = index + 1; candidate < LAST_STEP; candidate += 1) {
      if (!isAnswered(STEPS[candidate])) return candidate
    }
    return LAST_STEP
  }

  const baselineRamenType = inferRamenType(shopStyle)
  const isDirty = isEdit
    ? editBaseline !== null &&
      formSignature({ menuName, ramenType, visitedAt, scores, revisit, photos, note, tasteNotes, isPublic }) !== editBaseline
    : selectedShopId !== initialShopId ||
      menuName.length > 0 ||
      ramenType !== baselineRamenType ||
      visitedAt !== formatDate(today) ||
      Object.keys(scores).length > 0 ||
      revisit !== null ||
      photos.length > 0 ||
      note.length > 0 ||
      selectedTagCount > 0 ||
      !isPublic
  const preventLeave = isDirty && !leaving
  const preventLeaveRef = useRef(preventLeave)
  preventLeaveRef.current = preventLeave

  // beforeRemove만으로는 iOS 가장자리 스와이프가 막히지 않는다. usePreventRemove는 네이티브 제스처도 막는다.
  usePreventRemove(preventLeave, ({ data }) => {
    pendingLeave.current = data.action
    setLeaveVisible(true)
  })

  // 막지 않고 떠날 때는 초안을 비운다. 고치기는 초안을 쓰지 않는다
  useEffect(() => {
    if (isEdit) return
    return navigation.addListener("beforeRemove", () => {
      if (!preventLeaveRef.current) actions.clearRecordDraft()
    })
  }, [actions.clearRecordDraft, isEdit, navigation])

  const goBack = () => {
    if (router.canGoBack()) router.back()
    else router.replace("/native")
  }

  // 막기가 풀린 렌더 뒤에 이동해야 다시 가로채이지 않는다
  useEffect(() => {
    if (!leaving) return
    if (leaving.kind === "complete") router.replace({ pathname: "/record/complete", params: { logId: leaving.logId } })
    else if (leaving.kind === "action") navigation.dispatch(leaving.action)
    else goBack()
    // 이동은 leaving이 정해질 때 한 번만 한다(goBack·navigation이 새로 와도 다시 이동하지 않는다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving])

  // 입력을 고치면 지난 저장 실패 안내를 거둔다.
  useEffect(() => {
    setSaveError(null)
  }, [shop?.id, menuName, ramenType, visitedAt, scores, revisit, photos, note, tasteNotes, isPublic])

  // 질문이 바뀌면 VoiceOver가 새 질문부터 읽게 한다. 빠진 메뉴·메모로 데려온 경우엔 입력칸을 연다
  const firstStepRender = useRef(true)
  useEffect(() => {
    if (firstStepRender.current) {
      firstStepRender.current = false
      return
    }
    const target = focusOnEnter.current
    focusOnEnter.current = "question"
    const timer = setTimeout(
      () => {
        if (target === "menu") menuRef.current?.focus()
        else if (target === "note") noteRef.current?.focus()
        else moveAccessibilityFocus(questionRef.current)
      },
      reduceMotion ? 50 : 340,
    )
    return () => clearTimeout(timer)
  }, [reduceMotion, step])

  const goToStep = (target: number) => {
    const next = Math.max(0, Math.min(LAST_STEP, target))
    if (next === step) return
    if (STEPS[next] !== "meal") Keyboard.dismiss()
    setDirection(next > step ? "next" : "back")
    setStep(next)
    setReached((current) => Math.max(current, next))
  }

  const confirmLeave = () => {
    setLeaveVisible(false)
    if (!isEdit) actions.clearRecordDraft()
    const action = pendingLeave.current
    pendingLeave.current = null
    setLeaving(action ? { kind: "action", action } : { kind: "back" })
  }

  /** 빠진 첫 항목의 질문으로 데려간다. 방문일은 달력을 연다 */
  const showFirstMissing = (items: MissingField[]) => {
    const first = items[0]
    if (!first) return
    const owner = FIELD_STEP[first.key]
    if (!owner) {
      setIsDatePickerOpen(true)
      return
    }
    const target = STEPS.indexOf(owner)
    if (target === step) {
      if (first.key === "menu") menuRef.current?.focus()
      else if (first.key === "note") noteRef.current?.focus()
      else if (first.key === "shop") moveAccessibilityFocus(shopRef.current)
      return
    }
    focusOnEnter.current = first.key === "menu" ? "menu" : first.key === "note" ? "note" : "question"
    goToStep(target)
  }

  const goNext = () => {
    const key = STEPS[step]
    if (!isAnswered(key)) {
      setNudgedStep(step)
      const message = key === "meal" ? missingHint(mealMissing) : t(t("답을 골라주세요"))
      AccessibilityInfo.announceForAccessibility?.(message)
      if (key === "meal") showFirstMissing(mealMissing)
      return
    }
    goToStep(nextStepAfter(step))
  }

  const save = async () => {
    if (savingRef.current || leaving) return
    if (!isComplete || !shop || !revisit) {
      const first = missing[0]
      const target = first ? stepIndexOfField(first.key) : step
      setNudgedStep(target > LAST_STEP ? step : target)
      AccessibilityInfo.announceForAccessibility?.(missingHint(missing))
      showFirstMissing(missing)
      return
    }
    const fullScores: TasteScores = {
      satisfaction: scores.satisfaction ?? 0,
      brothDensity: scores.brothDensity ?? 0,
      noodleFirmness: scores.noodleFirmness ?? 0,
      topping: scores.topping ?? 0,
      revisit: REVISIT_SCORE[revisit],
    }
    const input: CreateRamenLogInput = {
      shopId: shop.id,
      shopName: shop.name,
      branch: shop.branch,
      menuName: trimmedMenu,
      ramenType,
      visitedAt,
      imageUrl: photos[0] ?? null,
      photos,
      note: note.trim(),
      tasteNotes,
      scores: fullScores,
      revisit,
      isPublic,
    }
    savingRef.current = true
    setSaving(true)
    setSaveError(null)
    try {
      if (editLogId) {
        await actions.updateLog(editLogId, input)
        // 성공 뒤에는 화면이 떠날 때까지 저장을 다시 받지 않는다
        setLeaving({ kind: "back" })
        return
      }
      const log = await actions.createLog(input)
      track("record_saved", { hasPhoto: photos.length > 0, scoresComplete: true })
      actions.clearRecordDraft()
      // 성공 뒤에는 화면이 떠날 때까지 저장을 다시 받지 않는다
      setLeaving({ kind: "complete", logId: log.id })
    } catch (error) {
      savingRef.current = false
      const message =
        error instanceof Error && error.message ? error.message : t("연결을 확인한 뒤 다시 시도해주세요.")
      setSaveError(message)
      AccessibilityInfo.announceForAccessibility?.(t("저장하지 못했어요. {v1}", { v1: message }))
    } finally {
      setSaving(false)
    }
  }

  const showPermissionAlert = (kind: "사진" | "카메라") => {
    Alert.alert(
      t("{v1} 접근 권한이 필요해요", { v1: kind }),
      t("설정에서 {v1} 접근을 허용하거나, 사진 없이도 계속 기록할 수 있어요.", { v1: kind }),
      [
        { text: t("사진 없이 계속"), style: "cancel" },
        { text: t("설정 열기"), onPress: () => void Linking.openSettings() },
      ],
    )
  }

  const addFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      showPermissionAlert("사진")
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, RECORD_PHOTO_MAX - photos.length),
      orderedSelection: true,
      quality: 0.84,
    })
    if (result.canceled) return
    const uris = result.assets.map((asset) => asset.uri).filter(Boolean)
    setPhotos((current) => [...current, ...uris].slice(0, RECORD_PHOTO_MAX))
  }

  const addFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      showPermissionAlert("카메라")
      return
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.84 })
    const uri = result.canceled ? undefined : result.assets[0]?.uri
    if (uri) setPhotos((current) => [...current, uri].slice(0, RECORD_PHOTO_MAX))
  }

  const choosePhotoSource = () => {
    if (Platform.OS === "web") {
      void addFromLibrary()
      return
    }
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: t("라멘 사진 추가"), options: [t("카메라로 촬영"), t("사진 보관함에서 선택"), t("취소")], cancelButtonIndex: 2 },
        (index) => {
          if (index === 0) void addFromCamera()
          if (index === 1) void addFromLibrary()
        },
      )
      return
    }
    Alert.alert(t("라멘 사진 추가"), undefined, [
      { text: t("카메라로 촬영"), onPress: () => void addFromCamera() },
      { text: t("사진 보관함에서 선택"), onPress: () => void addFromLibrary() },
      { text: t("취소"), style: "cancel" },
    ])
  }

  const toggleTasteNote = (key: TasteNoteKey, option: string) => {
    setTasteNotes((current) => ({
      ...current,
      [key]: current[key].includes(option)
        ? current[key].filter((item) => item !== option)
        : [...current[key], option],
    }))
  }

  if (!isHydrated) {
    return (
      <SafeAreaView edges={["top", "left", "right", "bottom"]} style={styles.screen}>
        <LoadingState fullScreen label={t("기록 화면을 준비하는 중…")} />
      </SafeAreaView>
    )
  }

  if (!currentUser) {
    return (
      <SafeAreaView edges={["top", "left", "right", "bottom"]} style={styles.screen}>
        <StatusBar style="auto" />
        <Header backLabel={t("뒤로가기")} onBack={goBack} title={isEdit ? t("기록 고치기") : t("라멘 기록하기")} />
        <EmptyState
          actionLabel={t("로그인하기")}
          description={TASTE_REPORT_ENABLED ? t("기록은 계정에 저장돼요. 로그인하면 취향 리포트도 함께 쌓여요.") : t("기록은 계정에 저장돼요. 로그인하면 남긴 라멘이 계속 쌓여요.")}
          icon={<LogIn color={colors.textMuted} size={32} />}
          onAction={() => router.replace("/auth/login")}
          style={styles.flex}
          title={t("로그인하고 한 그릇을 기록해보세요")}
        />
      </SafeAreaView>
    )
  }

  if (isEdit && !canEdit) {
    if (editQuery.isLoading) {
      return (
        <SafeAreaView edges={["top", "left", "right", "bottom"]} style={styles.screen}>
          <LoadingState fullScreen label={t("기록을 불러오는 중…")} />
        </SafeAreaView>
      )
    }
    return (
      <SafeAreaView edges={["top", "left", "right", "bottom"]} style={styles.screen}>
        <StatusBar style="auto" />
        <Header backLabel={t("뒤로가기")} onBack={goBack} title={t("기록 고치기")} />
        <EmptyState
          actionLabel={t("돌아가기")}
          description={
            editLog
              ? t("내가 남긴 기록만 고칠 수 있어요.")
              : editQuery.error
                ? t("연결을 확인한 뒤 다시 시도해주세요.")
                : t("지워졌거나 볼 수 없는 기록이에요.")
          }
          icon={<FileX color={colors.textMuted} size={32} />}
          onAction={goBack}
          style={styles.flex}
          title={editLog ? t("고칠 수 없는 기록이에요") : editQuery.error ? t("기록을 불러오지 못했어요") : t("기록을 찾을 수 없어요")}
        />
      </SafeAreaView>
    )
  }

  // 불러온 값을 채우기 전에는 빈 입력을 보여 주지 않는다
  if (isEdit && editBaseline === null) {
    return (
      <SafeAreaView edges={["top", "left", "right", "bottom"]} style={styles.screen}>
        <LoadingState fullScreen label={t("기록을 불러오는 중…")} />
      </SafeAreaView>
    )
  }

  const stepKey = STEPS[step]
  const shopLabel = shop ? `${shop.name}${shop.branch ? ` · ${shop.branch}` : ""}` : null
  const mealLine = [ramenType, trimmedMenu].filter(Boolean).join(" · ")
  const thumbnail = photos[0] ?? catalogShop?.photos?.[0] ?? null
  const isToday = visitedAt === formatDate(today)
  const dateShort = getLocale() !== "ko" ? `${formatLocaleDate(visitDate, { month: "short", day: "numeric", weekday: "short" })}${isToday ? ` · ${t("오늘")}` : ""}` : t("{v1}월 {v2}일 ({v3}){v4}", { v1: visitDate.getMonth() + 1, v2: visitDate.getDate(), v3: WEEKDAYS[visitDate.getDay()], v4: isToday ? t(" · 오늘") : "" })

  const cellValue = (key: Exclude<StepKey, "meal">): string | null => {
    if (key === "revisit") return revisit ? revisitShort(revisit) : null
    if (key === "extra") return extraCount > 0 ? `+${extraCount}` : null
    const value = scores[key]
    return value == null ? null : String(value)
  }
  const cellSpoken = (key: Exclude<StepKey, "meal">, value: string | null) => {
    const name = key === "extra" ? t("추가 감정") : key === "revisit" ? REVISIT_LABEL : (SCORE_AXES.find((axis) => axis.key === key)?.label ?? CELL_LABELS[key])
    const said = value === null ? t("아직 비어 있음") : key === "extra" ? t("{count}개", { count: extraCount }) : key === "revisit" ? (revisit ?? value) : t("{score}점", { score: value ?? "" })
    return `${name} ${said}`
  }

  const footerHint = (() => {
    if (saveError) return `저장하지 못했어요. ${saveError}`
    if (stepKey === "meal") return mealMissing.length ? missingHint(mealMissing) : undefined
    if (stepKey === "extra") {
      if (!isComplete) return missingHint(missing)
      return extraCount > 0 ? (TASTE_REPORT_ENABLED ? t("발행하면 취향 리포트에 반영돼요") : t("추가 감정도 함께 발행돼요")) : t("고르지 않아도 바로 발행할 수 있어요")
    }
    return isAnswered(stepKey) ? undefined : t("답을 고른 뒤 다음을 눌러주세요")
  })()
  const nudged = nudgedStep === step
  const footerHintTone = saveError ? "critical" : nudged && footerHint ? "brand" : "muted"

  let question: ReactNode
  if (stepKey === "meal") {
    question = (
      <>
        <TextInput
          accessibilityLabel={t("먹은 메뉴")}
          aria-required
          maxFontSizeMultiplier={maxFontScale}
          maxLength={40}
          onChangeText={setMenuName}
          onSubmitEditing={() => Keyboard.dismiss()}
          placeholder={t("예: 특제 쇼유 라멘")}
          placeholderTextColor={colors.textMuted}
          ref={menuRef}
          returnKeyType="done"
          style={[styles.input, nudged && !trimmedMenu && styles.inputInvalid]}
          value={menuName}
        />
        <AppText capScale style={styles.subLabel} tone="muted" variant="meta">{t("라멘 종류")}</AppText>
        <View accessibilityLabel={t("라멘 종류")} accessibilityRole="radiogroup" style={styles.chips}>
          {RAMEN_TYPES.map((type) => (
            <RecordChoice
              key={type}
              label={type}
              onPress={() => {
                if (ramenType !== type) selectionHaptic()
                setRamenType(type)
              }}
              role="radio"
              selected={ramenType === type}
            />
          ))}
        </View>
      </>
    )
  } else if (stepKey === "revisit") {
    question = (
      <View accessibilityLabel={REVISIT_LABEL} accessibilityRole="radiogroup" style={styles.options}>
        {REVISIT_CHOICES.map((choice, index) => (
          <AnswerOption
            accessibilityLabel={`${REVISIT_LABEL} ${choice.label}`}
            index={index}
            key={choice.label}
            label={t(choice.display)}
            number={index + 1}
            onPress={() => {
              if (revisit !== choice.label) selectionHaptic()
              setRevisit(choice.label)
            }}
            selected={revisit === choice.label}
          />
        ))}
      </View>
    )
  } else if (stepKey === "extra") {
    const field = tasteFields.find((item) => item.key === tagTab) ?? tasteFields[0]
    question = (
      <>
        <SlidingSegments
          accessibilityLabel={t("맛 태그 분류")}
          items={tasteFields.map((item) => ({
            key: item.key,
            label: item.label,
            badge: tasteNotes[item.key].length ? String(tasteNotes[item.key].length) : undefined,
          }))}
          onChange={setTagTab}
          stretch
          value={tagTab}
        />
        {field ? (
          <Animated.View accessibilityLabel={t(field.label)} entering={FadeIn.duration(220)} key={field.key} style={styles.tags}>
            {field.options.map((option) => (
              <RecordChoice
                accessibilityLabel={`${field.label} ${option}`}
                key={option}
                label={option}
                onPress={() => {
                  selectionHaptic()
                  toggleTasteNote(field.key, option)
                }}
                selected={tasteNotes[field.key].includes(option)}
              />
            ))}
          </Animated.View>
        ) : null}
        <TextInput
          accessibilityHint={t("선택, {v1}자까지", { v1: RECORD_NOTE_MAX_LENGTH })}
          accessibilityLabel={t("기억해둘 점")}
          maxFontSizeMultiplier={maxFontScale}
          maxLength={RECORD_NOTE_MAX_LENGTH}
          multiline
          onChangeText={setNote}
          placeholder={t("기억해둘 점 (예: 다음엔 면을 단단하게)")}
          placeholderTextColor={colors.textMuted}
          ref={noteRef}
          style={[styles.input, styles.noteInput]}
          textAlignVertical="top"
          value={note}
        />
        <View style={styles.extraRow}>
          <View style={styles.photos}>
            {photos.map((uri, index) => (
              <Animated.View entering={FadeIn.duration(220)} key={uri}>
                <Pressable
                  accessibilityLabel={t("사진 {v1} 삭제", { v1: index + 1 })}
                  accessibilityRole="button"
                  onPress={() => setPhotos((current) => current.filter((item) => item !== uri))}
                  style={({ pressed }) => [styles.photoTile, pressed && pressFade]}
                >
                  <Image contentFit="cover" source={{ uri: sizedImageUri(uri, touchTarget + 4) }} style={StyleSheet.absoluteFill} />
                  <View style={styles.photoRemoveDot}>
                    <X color={colors.onPhotoPill} size={10} strokeWidth={3} />
                  </View>
                </Pressable>
              </Animated.View>
            ))}
            {photos.length < RECORD_PHOTO_MAX ? (
              <Pressable
                accessibilityHint={t("카메라나 사진 보관함에서 가져와요")}
                accessibilityLabel={photos.length === 0 ? t("사진 추가") : t("사진 추가, {v1}장 중 최대 {v2}장", { v1: photos.length, v2: RECORD_PHOTO_MAX })}
                accessibilityRole="button"
                onPress={choosePhotoSource}
                style={({ pressed }) => [styles.photoTile, styles.photoAdd, pressed && styles.pressed]}
              >
                <Camera color={colors.textMuted} size={20} />
              </Pressable>
            ) : null}
          </View>
          <SlidingSegments
            accessibilityLabel={t("공개 범위")}
            items={VISIBILITY_CHOICES.map((choice) => ({
              key: choice.value,
              label: choice.label,
              hint: choice.value ? t("기록을 공개해 피드에 올려요") : t("피드에 올리지 않고 나만 볼 수 있어요"),
            }))}
            onChange={setIsPublic}
            value={isPublic}
          />
        </View>
      </>
    )
  } else {
    const axisKey = stepKey
    const axisLabel = SCORE_AXES.find((axis) => axis.key === axisKey)?.label ?? axisKey
    question = (
      <View accessibilityLabel={t(axisLabel)} accessibilityRole="radiogroup" style={styles.options}>
        {AXIS_WORDS[axisKey].map((word, index) => (
          <AnswerOption
            accessibilityLabel={t("{v1} {v2}점, {v3}", { v1: t(axisLabel), v2: index + 1, v3: t(word) })}
            index={index}
            key={word}
            label={t(word)}
            number={index + 1}
            onPress={() => {
              if (scores[axisKey] !== index + 1) selectionHaptic()
              setScores((current) => ({ ...current, [axisKey]: index + 1 }))
            }}
            selected={scores[axisKey] === index + 1}
          />
        ))}
      </View>
    )
  }

  const entering =
    direction === "next"
      ? FadeInRight.duration(340).easing(EASE_OUT)
      : direction === "back"
        ? FadeInLeft.duration(340).easing(EASE_OUT)
        : undefined

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
      <StatusBar style="auto" />
      <Header align="center" backLabel={t("뒤로가기")} onBack={goBack} style={styles.flowHeader} title={isEdit ? t("기록 고치기") : t("라멘 기록하기")} titleStyle={styles.navTitle} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        {/* 한 화면에 들어가게 짰다. 큰 글씨나 작은 화면, 키보드가 올라온 때만 스크롤된다 */}
        <ScrollView
          alwaysBounceVertical={false}
          contentContainerStyle={styles.content}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.flex}
        >
          <StepProgress step={step} />

          <View style={styles.ticket}>
            <View style={styles.ticketHead}>
              <AppText capScale style={styles.ticketBrand} variant="meta">{t("RAOTA 감정서")}</AppText>
              <Pressable
                accessibilityHint={Platform.OS === "web" ? undefined : t("달력을 열어 날짜를 바꿔요")}
                accessibilityLabel={t("방문일, {v1}", { v1: formatDateLabel(visitDate) })}
                accessibilityRole="button"
                accessibilityState={{ expanded: isDatePickerOpen }}
                hitSlop={{ top: spacing.x2, bottom: spacing.x2, left: spacing.x2, right: spacing.x2 }}
                onPress={() => {
                  Keyboard.dismiss()
                  setIsDatePickerOpen((open) => !open)
                }}
                style={({ pressed }) => [styles.dateChip, pressed && styles.pressed]}
              >
                <CalendarDays color={colors.textMuted} size={14} />
                <AppText capScale numberOfLines={1} style={styles.tabular} tone="muted" variant="meta">{dateShort}</AppText>
              </Pressable>
            </View>
            <View style={styles.ticketShop}>
              {thumbnail ? <Image accessible={false} contentFit="cover" source={{ uri: sizedImageUri(thumbnail, TICKET_THUMB) }} style={styles.ticketThumb} /> : null}
              <View style={styles.flexShrink}>
                {isEdit ? (
                  // 고치기에서는 가게를 바꿀 수 없다
                  <View accessibilityLabel={t("가게, {v1}", { v1: shopLabel ?? "" })} accessible ref={shopRef}>
                    <AppText numberOfLines={1} style={styles.ticketShopName} variant="cardTitle">{shopLabel ?? ""}</AppText>
                  </View>
                ) : (
                  <Pressable
                    accessibilityHint={t("기록할 가게를 다시 골라요")}
                    accessibilityLabel={shopLabel ? t("가게, {v1}. 변경", { v1: shopLabel.replace(" · ", " ") }) : t("가게를 골라주세요")}
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: "/record/select-shop" })}
                    ref={shopRef}
                    style={({ pressed }) => [styles.shopButton, pressed && pressFade]}
                  >
                    <AppText numberOfLines={1} style={[styles.ticketShopName, styles.flexShrink]} tone={shopLabel ? "ink" : nudgedStep === 0 ? "brand" : "muted"} variant="cardTitle">
                      {shopLabel ?? t("가게를 골라주세요")}
                    </AppText>
                    <ChevronRight color={colors.textMuted} size={16} />
                  </Pressable>
                )}
                <AppText capScale numberOfLines={1} tone={mealLine ? "sub" : "muted"} variant="meta">
                  {mealLine || t("무엇을 먹었는지 적어 주세요")}
                </AppText>
              </View>
            </View>
            <View style={styles.ticketCut}>
              <TicketCut />
            </View>
            <View style={styles.cells}>
              {STEPS.slice(1).map((key, offset) => {
                const cellKey = key as Exclude<StepKey, "meal">
                const index = offset + 1
                const value = cellValue(cellKey)
                return (
                  <TicketCell
                    accessibilityLabel={t("{v1}{v2}", { v1: cellSpoken(cellKey, value), v2: index <= reached && index !== step ? t(", 눌러서 이 질문으로 가요") : "" })}
                    current={index === step}
                    enabled={index <= reached && index !== step}
                    key={key}
                    label={t(CELL_LABELS[cellKey])}
                    onPress={() => goToStep(index)}
                    value={value}
                  />
                )
              })}
            </View>
          </View>

          <Animated.View entering={entering} key={stepKey} style={styles.question}>
            <View accessibilityLabel={t("{v1} / {v2}단계{v3}. {v4}", { v1: step + 1, v2: STEPS.length, v3: stepKey === "extra" ? t(", 선택") : "", v4: t(QUESTIONS[stepKey]) })} accessibilityRole="header" accessible ref={questionRef}>
              <View style={styles.stepRow}>
                <AppText capScale style={styles.tabular} tone="muted" variant="meta">{step + 1} / {STEPS.length}</AppText>
                {stepKey === "extra" ? (
                  <View style={styles.optionalBadge}>
                    <AppText capScale tone="muted" variant="meta">{t("선택")}</AppText>
                  </View>
                ) : null}
              </View>
              <AppText lineBreakStrategyIOS="hangul-word" style={styles.questionTitle} variant="screenTitle">
                {t(QUESTIONS[stepKey])}
              </AppText>
            </View>
            {question}
          </Animated.View>
        </ScrollView>

        <StickyActionBar
          hint={footerHint ? t(footerHint) : undefined}
          hintIsError={Boolean(saveError)}
          hintTone={footerHintTone}
          reserveHintLines={1}
        >
          {step > 0 ? (
            <Pressable
              accessibilityLabel={t("이전 질문")}
              accessibilityRole="button"
              onPress={() => goToStep(step - 1)}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
            >
              <AppText capScale style={styles.actionText} variant="button">{t("이전")}</AppText>
            </Pressable>
          ) : null}
          {stepKey === "extra" ? (
            /* 미완성이어도 누르면 빠진 첫 질문으로 데려간다 */
            <Pressable
              accessibilityHint={isComplete ? undefined : t("누르면 빠진 첫 질문으로 이동해요")}
              accessibilityLabel={(() => {
                const label = isEdit ? t("고친 기록 저장하기") : t("기록 저장하기")
                if (saveError) return "다시 시도"
                return isComplete ? label : t("{label}, 남은 필수 {count}개", { label, count: missing.length })
              })()}
              accessibilityRole="button"
              accessibilityState={{ busy: saving }}
              onPress={() => void save()}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
            >
              {saving ? <ActivityIndicator color={colors.onDark} size="small" style={styles.saveSpinner} /> : null}
              <AppText capScale lineBreakStrategyIOS="hangul-word" style={styles.actionText} tone="onDark" variant="button">
                {saving ? t("저장 중…") : saveError ? t("다시 시도") : isEdit ? t("저장하기") : t("감정서 발행")}
              </AppText>
            </Pressable>
          ) : (
            <Pressable
              accessibilityHint={isAnswered(stepKey) ? undefined : stepKey === "meal" ? t("누르면 빠진 항목으로 이동해요") : t("답을 고르면 넘어가요")}
              accessibilityLabel={t("다음")}
              accessibilityRole="button"
              onPress={goNext}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
            >
              <AppText capScale style={styles.actionText} tone="onDark" variant="button">{t("다음")}</AppText>
            </Pressable>
          )}
        </StickyActionBar>
      </KeyboardAvoidingView>

      <ConfirmDialog
        cancelLabel={isEdit ? t("계속 고치기") : t("계속 작성")}
        confirmLabel={t("나가기")}
        destructive
        message={isEdit ? t("고친 내용이 있어요. 나가면 바뀐 내용은 저장되지 않아요.") : t("작성 중인 기록이 있어요. 지금까지 고른 평가와 사진은 저장되지 않아요.")}
        onCancel={() => {
          pendingLeave.current = null
          setLeaveVisible(false)
        }}
        onConfirm={confirmLeave}
        title={isEdit ? t("고치기를 그만둘까요?") : t("작성을 그만둘까요?")}
        visible={leaveVisible}
      />
      {/* 안드로이드 대화상자는 accentColor를 받지 않고 앱의 네이티브 테마 색으로 그린다 */}
      {isDatePickerOpen && Platform.OS !== "ios" ? (
        <DateTimePicker
          display="default"
          locale={getIntlLocale()}
          maximumDate={today}
          mode="date"
          onChange={(event, date) => {
            setIsDatePickerOpen(false)
            if (event.type === "set" && date) setVisitDate(date)
          }}
          value={visitDate}
        />
      ) : null}
      {Platform.OS === "ios" ? (
        <Modal animationType="fade" onRequestClose={() => setIsDatePickerOpen(false)} transparent visible={isDatePickerOpen}>
          <View style={styles.dateModalRoot}>
            <Pressable
              accessibilityLabel={t("달력 닫기")}
              accessibilityRole="button"
              onPress={() => setIsDatePickerOpen(false)}
              style={StyleSheet.absoluteFill}
            />
            <View accessibilityViewIsModal style={styles.dateModalCard}>
              <View style={styles.dateModalHeader}>
                <AppText variant="sectionTitle">{t("방문일")}</AppText>
                <Pressable accessibilityLabel={t("날짜 선택 완료")} accessibilityRole="button" onPress={() => setIsDatePickerOpen(false)} style={styles.dateDone}>
                  <AppText variant="button">{t("완료")}</AppText>
                </Pressable>
              </View>
              <DateTimePicker
                accentColor={pickerAccent}
                display="inline"
                locale={getIntlLocale()}
                maximumDate={today}
                mode="date"
                onChange={(event, date) => {
                  if (event.type === "set" && date) setVisitDate(date)
                }}
                value={visitDate}
              />
            </View>
          </View>
        </Modal>
      ) : null}
      <EdgeBackZone top={insets.top + FLOW_HEADER_HEIGHT} />
    </SafeAreaView>
  )
}

const TICKET_THUMB = 44
const CELL_HEIGHT = 32

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  flexShrink: { flex: 1, minWidth: 0 },
  tabular: { fontVariant: ["tabular-nums"] },
  flowHeader: { minHeight: FLOW_HEADER_HEIGHT },
  navTitle: { fontSize: 18, lineHeight: 24 },
  content: { flexGrow: 1, paddingHorizontal: spacing.gutter, paddingTop: spacing.x1, paddingBottom: spacing.x4 },
  pressed: { backgroundColor: colors.surfacePressed },
  // 칩·칸은 눌리는 동안 97%로 줄어든다(DESIGN.md Motion)
  pressScale: { transform: [{ scale: 0.97 }] },
  onSelectedText: { color: colors.onSelected },

  progressTrack: { height: 4, borderRadius: radii.pill, backgroundColor: colors.secondary, overflow: "hidden" },
  progressFill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.ink, borderRadius: radii.pill, transformOrigin: "left" },

  ticket: { marginTop: spacing.x3, borderRadius: radii.lg, backgroundColor: colors.canvasSoft, paddingTop: spacing.x3_5, paddingBottom: spacing.x3 },
  ticketHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.x2, paddingHorizontal: spacing.x5 },
  ticketBrand: { fontWeight: "700", letterSpacing: 0.4, color: colors.ink },
  dateChip: { flexDirection: "row", alignItems: "center", gap: spacing.x1, flexShrink: 1, borderRadius: radii.pill, paddingHorizontal: spacing.x2, paddingVertical: spacing.x0_5, marginRight: -spacing.x2 },
  ticketShop: { flexDirection: "row", alignItems: "center", gap: spacing.x2_5, marginTop: spacing.x2_5, paddingHorizontal: spacing.x5 },
  ticketThumb: { width: TICKET_THUMB, height: TICKET_THUMB, borderRadius: radii.sm, backgroundColor: colors.secondary },
  shopButton: { flexDirection: "row", alignItems: "center", gap: spacing.x1, minHeight: 24 },
  ticketShopName: { fontSize: 17, lineHeight: 22, fontWeight: "700" },
  ticketCut: { marginTop: spacing.x3_5, marginBottom: spacing.x2_5 },
  cells: { flexDirection: "row", gap: spacing.x1_5, paddingHorizontal: spacing.x4 },
  cell: { flex: 1, minWidth: 0, alignItems: "center", gap: spacing.x1 },
  cellBox: { alignSelf: "stretch", height: CELL_HEIGHT, borderRadius: radii.pill, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center" },
  cellBoxFilled: { backgroundColor: colors.selected },
  // 지금 답하는 질문의 칸. 테두리가 아니라 선택 표시라 2pt 잉크 고리를 쓴다
  cellBoxCurrent: { borderWidth: 2, borderColor: colors.ink },
  cellValue: { fontSize: 14, lineHeight: 18, fontVariant: ["tabular-nums"] },

  question: { marginTop: spacing.x5 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: spacing.x1_5 },
  optionalBadge: { borderRadius: radii.pill, backgroundColor: colors.canvasSoft, paddingHorizontal: spacing.x2 },
  questionTitle: { marginTop: spacing.x1, fontWeight: "700", letterSpacing: -0.6 },

  options: { marginTop: spacing.x3_5, gap: spacing.x2 },
  option: {
    minHeight: 48,
    borderRadius: radii.sm,
    backgroundColor: colors.canvasSoft,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.x2,
    paddingLeft: spacing.x4_5,
    paddingRight: spacing.x3_5,
    paddingVertical: spacing.x2,
  },
  optionFill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.selected, transformOrigin: "left" },
  optionText: { flexShrink: 1 },
  optionNumber: { width: 26, height: 26, borderRadius: radii.pill, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center" },
  optionNumberText: { fontVariant: ["tabular-nums"], color: colors.ink },

  input: {
    ...typography.body,
    marginTop: spacing.x3_5,
    minHeight: 48,
    paddingHorizontal: spacing.x3_5,
    paddingVertical: spacing.x2,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.paper,
    color: colors.ink,
  },
  inputInvalid: { borderColor: colors.brand },
  noteInput: { maxHeight: 96, paddingTop: spacing.x3 },
  subLabel: { marginTop: spacing.x4, marginBottom: spacing.x2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x1_5 },
  choice: {
    minHeight: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.canvasSoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.x3_5,
  },
  choiceSelected: { backgroundColor: colors.selected },
  choiceText: { textAlign: "center" },

  segments: { flexDirection: "row", borderRadius: radii.pill, backgroundColor: colors.canvasSoft, padding: spacing.x1 },
  segmentsStretch: { marginTop: spacing.x3_5 },
  segmentThumb: { position: "absolute", top: spacing.x1, bottom: spacing.x1, left: spacing.x1, borderRadius: radii.pill, backgroundColor: colors.selected },
  segment: { minHeight: 36, borderRadius: radii.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.x1, paddingHorizontal: spacing.x3 },
  segmentStretch: { flex: 1, paddingHorizontal: spacing.x1 },
  segmentText: { color: colors.textMuted },
  segmentBadge: { fontVariant: ["tabular-nums"] },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x1_5, marginTop: spacing.x3 },
  extraRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.x2, marginTop: spacing.x3 },
  photos: { flexDirection: "row", gap: spacing.x1_5 },
  photoTile: { width: touchTarget + 4, height: touchTarget + 4, borderRadius: radii.sm, overflow: "hidden", backgroundColor: colors.canvasSoft },
  photoAdd: { alignItems: "center", justifyContent: "center" },
  photoRemoveDot: {
    position: "absolute",
    top: spacing.x1,
    right: spacing.x1,
    width: 16,
    height: 16,
    borderRadius: radii.pill,
    backgroundColor: colors.photoPill,
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryButton: { flex: 1, minHeight: 52, borderRadius: radii.sm, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center" },
  secondaryButtonPressed: { backgroundColor: colors.secondaryPressed },
  primaryButton: {
    flex: 2.4,
    minHeight: 52,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.x2,
    paddingHorizontal: spacing.x2,
  },
  primaryButtonPressed: { backgroundColor: colors.brandPressed },
  saveSpinner: { position: "absolute", left: spacing.x3 },
  actionText: { fontSize: 16, lineHeight: 20, textAlign: "center" },

  dateModalRoot: { flex: 1, justifyContent: "center", paddingHorizontal: spacing.gutter, backgroundColor: colors.overlay },
  dateModalCard: { alignSelf: "center", width: "100%", maxWidth: 430, borderRadius: radii.lg, backgroundColor: colors.canvas, padding: spacing.x4 },
  dateModalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dateDone: { minWidth: touchTarget, minHeight: touchTarget, alignItems: "center", justifyContent: "center" },
})
