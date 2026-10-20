import * as Haptics from "expo-haptics"
import { forwardRef, useEffect, useMemo, useRef, useState } from "react"
import { router, useLocalSearchParams, useNavigation } from "expo-router"
import { usePreventRemove, type NavigationAction } from "expo-router/react-navigation"
import { StatusBar } from "expo-status-bar"
import { Image } from "expo-image"
import * as ImagePicker from "expo-image-picker"
import DateTimePicker from "@react-native-community/datetimepicker"
import { CalendarDays, Camera, ChevronDown, ChevronRight, ChevronUp, LogIn, X } from "lucide-react-native"
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
import { useReducedMotion } from "react-native-reanimated"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"

import {
  RAMEN_TYPES,
  REVISIT_OPTIONS,
  REVISIT_SCORE,
  TASTE_AXES,
  TASTE_FIELDS,
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
import { useShop, useShops } from "@/src/data"
import {
  RECORD_NOTE_MAX_LENGTH,
  missingScoreAxes,
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
  SectionHeader,
  StickyActionBar,
} from "@/src/components/ui"
import { EdgeBackZone } from "@/src/components/EdgeBackZone"
import { colors, line, maxFontScale, pressFade, radii, spacing, touchTarget, typography, usePalette } from "@/src/theme"

/*
 * 사진과 필수 입력을 먼저 보여 주고, 상세는 요청할 때 펼친다.
 * 저장 버튼은 항상 누를 수 있고 빠진 항목은 스크롤과 VoiceOver 포커스로 안내한다.
 */

type ScoreAxisKey = Exclude<TasteAxisKey, "revisit">
type FieldKey = "shop" | "menu" | "ramenType" | "visitedAt" | "note" | TasteAxisKey
type MissingField = { key: FieldKey; label: string; kind: "text" | "choice" }
type LeaveIntent =
  | { kind: "action"; action: NavigationAction }
  | { kind: "back" }
  | { kind: "complete"; logId: string }
/** 헤더 높이. 가장자리 뒤로 쓸기 띠를 헤더 아래에서 시작해 뒤로가기 버튼을 덮지 않는다 */
const FLOW_HEADER_HEIGHT = 52
/** Validation reports required fields by domain order; focus follows their position on this screen. */
const FIELD_POSITION: Record<FieldKey, number> = {
  shop: 0,
  menu: 1,
  satisfaction: 2,
  brothDensity: 3,
  noodleFirmness: 4,
  topping: 5,
  revisit: 6,
  ramenType: 7,
  visitedAt: 8,
  note: 9,
}

const SCORE_AXES = TASTE_AXES.filter((axis): axis is (typeof TASTE_AXES)[number] & { key: ScoreAxisKey } => axis.key !== "revisit")
const REVISIT_AXIS = TASTE_AXES.find((axis) => axis.key === "revisit") ?? {
  key: "revisit" as const,
  label: "재방문 의사",
  low: "한 번이면 충분",
  high: "자주 갈래요",
}
/** 점수를 고른 뒤 상태 칸에 보여 줄 짧은 말. 축의 의미는 그대로 두고 키 모양만 통일한다. */
const AXIS_PRESENTATION: Record<ScoreAxisKey, { kind: "quality" | "spectrum"; words: readonly string[] }> = {
  satisfaction: { kind: "quality", words: ["아쉬웠어요", "그저 그랬어요", "괜찮았어요", "맛있었어요", "인생 라멘이에요"] },
  brothDensity: { kind: "spectrum", words: ["아주 맑음", "맑은 편", "중간", "진한 편", "아주 진함"] },
  noodleFirmness: { kind: "spectrum", words: ["아주 부드럽게", "부드러운 편", "중간", "단단한 편", "아주 단단하게"] },
  topping: { kind: "quality", words: ["아쉬움", "조금 아쉬움", "보통", "좋음", "훌륭함"] },
}

/** 낮은 점수부터 높은 점수 순. 양 끝 설명(low · high)과 방향을 맞춘다 */
const REVISIT_CHOICES = [...REVISIT_OPTIONS].reverse()
const REVISIT_CELLS = REVISIT_CHOICES.map((label) => ({
  value: REVISIT_SCORE[label],
  label,
  display: label === "자주 감" ? "자주 갈래요" : label === "가끔 생각남" ? "가끔" : "한 번이면 충분",
}))
const SCORE_CELLS = [1, 2, 3, 4, 5].map((number) => ({ value: number, label: String(number) }))
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
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAYS[date.getDay()]})`
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
    // 포커스를 옮기지 못해도 스크롤과 안내 문구는 남는다.
  }
}

/** 종류와 맛 태그는 선택 색 알약으로 고른 상태를 보여 준다. */
function RecordChoice({
  label,
  selected,
  onPress,
  compact = false,
  accessibilityLabel = label,
  role = "button",
}: {
  label: string
  selected: boolean
  onPress: () => void
  compact?: boolean
  accessibilityLabel?: string
  role?: "button" | "radio"
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={role}
      accessibilityState={role === "radio" ? { checked: selected } : { selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        compact && styles.tasteChoice,
        selected && styles.choiceSelected,
        pressed && !selected && styles.pressed,
      ]}
    >
      <AppText capScale style={[styles.choiceText, selected && styles.onSelectedText]} variant="secondary">
        {label}
      </AppText>
    </Pressable>
  )
}

/** 다섯 점수는 제목 옆에 선택 설명을 두고, 한 줄의 독립된 알약으로 고른다. */
const RecordScore = forwardRef<View, {
  label: string
  low: string
  high: string
  value: number | null
  onChange: (value: number) => void
  words?: readonly string[]
  options?: readonly { value: number; label: string; display?: string }[]
  invalid: boolean
  showEnds?: boolean
}>(function RecordScore({ label, low, high, value, onChange, words, options, invalid, showEnds }, ref) {
  const selectedWord = value === null ? null : options?.find((option) => option.value === value)?.display ?? words?.[value - 1]
  const statusVisible = Boolean(selectedWord || invalid)
  const cells = options ?? SCORE_CELLS
  return (
    <View style={styles.scoreField}>
      <View style={styles.scoreHeading}>
        <AppText capScale numberOfLines={1} style={styles.scoreLabel} variant="secondary">{label}</AppText>
        <AppText
          accessibilityElementsHidden={!statusVisible}
          capScale
          importantForAccessibility={statusVisible ? "auto" : "no-hide-descendants"}
          numberOfLines={1}
          style={[styles.scoreStatus, !statusVisible && styles.hiddenHint]}
          tone={invalid && !selectedWord ? "brand" : "muted"}
          variant="secondary"
        >
          {selectedWord ? `· ${selectedWord}` : "골라주세요"}
        </AppText>
      </View>
      <View accessibilityLabel={label} accessibilityRole="radiogroup" ref={ref} style={styles.scoreCells}>
        {cells.map((cell) => {
          const selected = cell.value === value
          const direction = cell.value <= 2 ? `${low} 쪽` : cell.value >= 4 ? `${high} 쪽` : "보통"
          return (
            <Pressable
              accessibilityLabel={options ? `${label} ${cell.label}, ${cell.value}점` : `${label} ${cell.value}점, ${direction}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={cell.value}
              onPress={() => {
                if (Platform.OS !== "web" && !selected) void Haptics.selectionAsync().catch(() => undefined)
                onChange(cell.value)
              }}
              style={({ pressed }) => [styles.scoreCell, selected && styles.scoreCellSelected, pressed && !selected && styles.pressed]}
            >
              <AppText capScale lineBreakStrategyIOS="hangul-word" style={[styles.scoreCellText, options && styles.scoreRevisitText, selected && styles.onSelectedText]} variant="button">
                {"display" in cell ? cell.display : cell.label}
              </AppText>
            </Pressable>
          )
        })}
      </View>
      {showEnds ? (
        <View style={styles.scoreEnds}>
          <AppText capScale tone="muted" variant="meta">{low}</AppText>
          <AppText capScale tone="muted" variant="meta">{high}</AppText>
        </View>
      ) : null}
    </View>
  )
})

export default function NewRecordScreen() {
  const { shopId } = useLocalSearchParams<{ shopId?: string }>()
  const navigation = useNavigation()
  const { state, isHydrated, currentUser, actions } = useRaota()
  const reduceMotion = useReducedMotion()
  const insets = useSafeAreaInsets()
  // 날짜 선택기는 hex 문자열만 받는다
  const palette = usePalette()
  // 어두운 모드의 ink(흰색)를 강조색으로 쓰면 iOS가 오늘 날짜를 흰 원 위 흰 글씨로 그린다
  const pickerAccent = useColorScheme() === "dark" ? palette.brand : palette.ink
  const initialShopId = typeof shopId === "string" && shopId.length > 0 ? shopId : null
  const selectedShopId = state.recordDraft?.shopId ?? initialShopId
  const shop = useShop(selectedShopId).data
  const shops = useShops().data
  const shopStyle = styleOf(shop)

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
  const [isPublic, setIsPublic] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [leaveVisible, setLeaveVisible] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  // 나가기가 허락된 뒤의 이동. 상태여야 usePreventRemove가 네이티브 스와이프 차단까지 풀고 나서 이동한다
  const [leaving, setLeaving] = useState<LeaveIntent | null>(null)

  // 상태는 다음 렌더까지 바뀌지 않아 빠른 두 번 탭이 둘 다 통과한다. 저장은 ref로 한 번만 받는다
  const savingRef = useRef(false)
  const pendingLeave = useRef<NavigationAction | null>(null)
  const previousShopId = useRef(selectedShopId)
  const scrollRef = useRef<ScrollView>(null)
  const contentRef = useRef<View>(null)
  const shopRef = useRef<View>(null)
  const menuRef = useRef<TextInput>(null)
  const ramenTypeRef = useRef<View>(null)
  const visitedAtRef = useRef<View>(null)
  const revisitRef = useRef<View>(null)
  const noteRef = useRef<TextInput>(null)
  const axisRefs = useRef<Partial<Record<ScoreAxisKey, View | null>>>({})

  const visitedAt = formatDate(visitDate)
  const trimmedMenu = menuName.trim()
  const selectedTagCount = TASTE_FIELDS.reduce((sum, field) => sum + tasteNotes[field.key].length, 0)

  // 불러온 상세 값이 있으면 처음부터 보여 준다. 새 기록의 빈 상세는 접어 둔다.
  useEffect(() => {
    if (photos.length > 0 || note.trim().length > 0 || selectedTagCount > 0) setDetailsOpen(true)
  }, [photos, note, selectedTagCount])

  useEffect(() => {
    actions.startRecordDraft(initialShopId)
  }, [actions.startRecordDraft, initialShopId])

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
  const missingAxes = new Set(missingScoreAxes(draft))
  const missing: MissingField[] = validateRecordDraft(draft, { validShopIds, now: new Date() }).flatMap(
    (error): MissingField[] => {
      switch (error.field) {
        case "shopId":
          return [{ key: "shop", label: "가게", kind: "choice" }]
        case "menuName":
          return [{ key: "menu", label: "먹은 메뉴", kind: "text" }]
        case "ramenType":
          return [{ key: "ramenType", label: "라멘 종류", kind: "choice" }]
        case "visitedAt":
          return [{ key: "visitedAt", label: "방문일", kind: "choice" }]
        case "scores": {
          const axis = TASTE_AXES.find(({ key }) => key === error.axis)
          return axis ? [{ key: axis.key, label: axis.label, kind: "choice" }] : []
        }
        case "note":
          return [{ key: "note", label: "메모", kind: "text" }]
        default:
          return []
      }
    },
  ).sort((a, b) => FIELD_POSITION[a.key] - FIELD_POSITION[b.key])
  const isComplete = missing.length === 0
  const isMissing = (key: FieldKey) => attempted && missing.some((item) => item.key === key)

  const hint = (() => {
    if (isComplete) return "필수 항목을 모두 채웠어요"
    const shown = missing.slice(0, 3).map((item) => item.label)
    const rest = missing.length - shown.length
    const subject = rest > 0 ? `${shown.join(", ")} 외 ${rest}개` : shown.join(", ")
    const verb = missing.some((item) => item.kind === "text") ? "채워주세요" : "골라주세요"
    return `${withObjectParticle(subject)} ${verb}`
  })()

  const baselineRamenType = inferRamenType(shopStyle)
  const isDirty =
    selectedShopId !== initialShopId ||
    menuName.length > 0 ||
    ramenType !== baselineRamenType ||
    visitedAt !== formatDate(today) ||
    Object.keys(scores).length > 0 ||
    revisit !== null ||
    photos.length > 0 ||
    note.length > 0 ||
    selectedTagCount > 0 ||
    isPublic
  const preventLeave = isDirty && !leaving
  const preventLeaveRef = useRef(preventLeave)
  preventLeaveRef.current = preventLeave

  // beforeRemove만으로는 iOS 가장자리 스와이프가 막히지 않는다. usePreventRemove는 네이티브 제스처도 막는다.
  usePreventRemove(preventLeave, ({ data }) => {
    pendingLeave.current = data.action
    setLeaveVisible(true)
  })

  // 막지 않고 떠날 때는 초안을 비운다
  useEffect(
    () =>
      navigation.addListener("beforeRemove", () => {
        if (!preventLeaveRef.current) actions.clearRecordDraft()
      }),
    [actions.clearRecordDraft, navigation],
  )

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

  const confirmLeave = () => {
    setLeaveVisible(false)
    actions.clearRecordDraft()
    const action = pendingLeave.current
    pendingLeave.current = null
    setLeaving(action ? { kind: "action", action } : { kind: "back" })
  }

  const fieldTarget = (key: FieldKey): View | TextInput | null => {
    switch (key) {
      case "shop":
        return shopRef.current
      case "menu":
        return menuRef.current
      case "ramenType":
        return ramenTypeRef.current
      case "visitedAt":
        return visitedAtRef.current
      case "revisit":
        return revisitRef.current
      case "note":
        return noteRef.current
      default:
        return axisRefs.current[key] ?? null
    }
  }

  const focusFirstMissing = () => {
    const first = missing[0]
    if (!first) return
    const target = fieldTarget(first.key)
    const content = contentRef.current
    const scrollAndFocus = (y: number) => {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - spacing.x6), animated: !reduceMotion })
      setTimeout(
        () => {
          if (first.key === "menu" || first.key === "note") (target as TextInput | null)?.focus()
          else moveAccessibilityFocus(target as View | null)
        },
        reduceMotion ? 0 : 250,
      )
    }
    if (!target || !content) return
    try {
      ;(target as View).measureLayout(
        content,
        (_x, y) => scrollAndFocus(y),
        () => scrollAndFocus(0),
      )
    } catch {
      scrollAndFocus(0)
    }
  }

  const save = async () => {
    if (savingRef.current || leaving) return
    if (!isComplete || !shop || !revisit) {
      setAttempted(true)
      AccessibilityInfo.announceForAccessibility?.(hint)
      focusFirstMissing()
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
      const log = await actions.createLog(input)
      track("record_saved", { hasPhoto: photos.length > 0, scoresComplete: true })
      actions.clearRecordDraft()
      // 성공 뒤에는 화면이 떠날 때까지 저장을 다시 받지 않는다
      setLeaving({ kind: "complete", logId: log.id })
    } catch (error) {
      savingRef.current = false
      const message =
        error instanceof Error && error.message ? error.message : "연결을 확인한 뒤 다시 시도해주세요."
      setSaveError(message)
      AccessibilityInfo.announceForAccessibility?.(`저장하지 못했어요. ${message}`)
    } finally {
      setSaving(false)
    }
  }

  const showPermissionAlert = (kind: "사진" | "카메라") => {
    Alert.alert(
      `${kind} 접근 권한이 필요해요`,
      `설정에서 ${kind} 접근을 허용하거나, 사진 없이도 계속 기록할 수 있어요.`,
      [
        { text: "사진 없이 계속", style: "cancel" },
        { text: "설정 열기", onPress: () => void Linking.openSettings() },
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
        { title: "라멘 사진 추가", options: ["카메라로 촬영", "사진 보관함에서 선택", "취소"], cancelButtonIndex: 2 },
        (index) => {
          if (index === 0) void addFromCamera()
          if (index === 1) void addFromLibrary()
        },
      )
      return
    }
    Alert.alert("라멘 사진 추가", undefined, [
      { text: "카메라로 촬영", onPress: () => void addFromCamera() },
      { text: "사진 보관함에서 선택", onPress: () => void addFromLibrary() },
      { text: "취소", style: "cancel" },
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
        <LoadingState fullScreen label="기록 화면을 준비하는 중…" />
      </SafeAreaView>
    )
  }

  if (!currentUser) {
    return (
      <SafeAreaView edges={["top", "left", "right", "bottom"]} style={styles.screen}>
        <StatusBar style="auto" />
        <Header backLabel="뒤로가기" onBack={goBack} title="라멘 기록하기" />
        <EmptyState
          actionLabel="로그인하기"
          description="기록은 계정에 저장돼요. 로그인하면 취향 리포트도 함께 쌓여요."
          icon={<LogIn color={colors.textMuted} size={32} />}
          onAction={() => router.replace("/auth/login")}
          style={styles.flex}
          title="로그인하고 한 그릇을 기록해보세요"
        />
      </SafeAreaView>
    )
  }

  const inputStyle = (invalid: boolean) => [styles.input, invalid && styles.inputInvalid]

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
      <StatusBar style="auto" />
      <Header align="center" backLabel="뒤로가기" onBack={goBack} style={styles.flowHeader} title="라멘 기록하기" titleStyle={styles.navTitle} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          style={styles.flex}
        >
          <View collapsable={false} ref={contentRef}>
            <View style={styles.slip}>
              <View style={styles.introFields}>
                <Pressable
                  accessibilityHint={photos.length >= RECORD_PHOTO_MAX ? "상세 추가에서 사진을 삭제하거나 바꿔요" : "카메라나 사진 보관함에서 가져와요"}
                  accessibilityLabel={photos.length >= RECORD_PHOTO_MAX ? "사진 3장 첨부됨" : photos.length === 0 ? "사진 추가" : `사진 추가, ${photos.length}장 중 최대 ${RECORD_PHOTO_MAX}장`}
                  accessibilityRole="button"
                  disabled={photos.length >= RECORD_PHOTO_MAX}
                  onPress={choosePhotoSource}
                  style={({ pressed }) => [styles.photoHero, pressed && (photos[0] ? pressFade : styles.pressed)]}
                >
                  {photos[0] ? (
                    <Image contentFit="cover" source={{ uri: photos[0] }} style={StyleSheet.absoluteFill} />
                  ) : (
                    <View style={styles.photoHeroLabel}>
                      <Camera color={colors.textMuted} size={24} />
                      <AppText capScale tone="muted" variant="meta">사진 추가</AppText>
                    </View>
                  )}
                  {photos.length ? (
                    <View style={styles.photoCount}>
                      <AppText capScale style={styles.photoCountText} variant="meta">{photos.length}/{RECORD_PHOTO_MAX}</AppText>
                    </View>
                  ) : null}
                </Pressable>
                <View style={styles.introInputs}>
                  <View style={[styles.field, styles.introShopField]}>
                    <AppText style={styles.label} variant="bodyStrong">가게</AppText>
                    <Pressable
                      accessibilityHint="기록할 가게를 다시 골라요"
                      accessibilityLabel={
                        shop ? `가게, ${shop.name}${shop.branch ? ` ${shop.branch}` : ""}. 변경` : "가게를 골라주세요"
                      }
                      accessibilityRole="button"
                      onPress={() => router.push({ pathname: "/record/select-shop" })}
                      ref={shopRef}
                      style={({ pressed }) => [styles.shopField, isMissing("shop") && styles.inputInvalid, pressed && styles.pressed]}
                    >
                      <AppText lineBreakStrategyIOS="hangul-word" numberOfLines={1} style={styles.flexShrink} tone={shop ? "ink" : "muted"} variant="body">
                        {shop ? `${shop.name}${shop.branch ? ` · ${shop.branch}` : ""}` : "가게를 골라주세요"}
                      </AppText>
                      <ChevronRight color={colors.textMuted} size={18} />
                    </Pressable>
                  </View>
                  <View style={[styles.field, styles.introMenuField]}>
                    <View style={styles.labelRow}>
                      <AppText nativeID="record-menu-label" style={styles.fieldLabel} variant="bodyStrong">먹은 메뉴</AppText>
                      <AppText
                        accessibilityElementsHidden={!isMissing("menu")}
                        capScale
                        importantForAccessibility={isMissing("menu") ? "auto" : "no-hide-descendants"}
                        style={!isMissing("menu") && styles.hiddenHint}
                        tone="brand"
                        variant="meta"
                      >
                        채워주세요
                      </AppText>
                    </View>
                    <TextInput
                      accessibilityLabel="먹은 메뉴"
                      aria-required
                      maxFontSizeMultiplier={maxFontScale}
                      maxLength={40}
                      onChangeText={setMenuName}
                      placeholder="예: 특제 쇼유 라멘"
                      placeholderTextColor={colors.textMuted}
                      ref={menuRef}
                      returnKeyType="done"
                      style={[...inputStyle(isMissing("menu")), styles.menuInput]}
                      value={menuName}
                    />
                  </View>
                </View>
              </View>

              {/* 필수 다섯 축은 같은 알약 점수 입력으로 이어진다. */}
              <View style={styles.axes}>
                {SCORE_AXES.map((axis) => (
                  <RecordScore
                    high={axis.high}
                    invalid={attempted && missingAxes.has(axis.key)}
                    key={axis.key}
                    label={axis.label}
                    low={axis.low}
                    onChange={(value) => setScores((current) => ({ ...current, [axis.key]: value }))}
                    ref={(node) => {
                      axisRefs.current[axis.key] = node
                    }}
                    showEnds={AXIS_PRESENTATION[axis.key].kind === "spectrum"}
                    value={scores[axis.key] ?? null}
                    words={AXIS_PRESENTATION[axis.key].words}
                  />
                ))}
                <RecordScore
                  high={REVISIT_AXIS.high}
                  invalid={attempted && missingAxes.has("revisit")}
                  label={REVISIT_AXIS.label}
                  low={REVISIT_AXIS.low}
                  onChange={(value) => {
                    const option = REVISIT_CHOICES.find((choice) => REVISIT_SCORE[choice] === value)
                    if (option) setRevisit(option)
                  }}
                  options={REVISIT_CELLS}
                  ref={revisitRef}
                  value={revisit ? REVISIT_SCORE[revisit] : null}
                />
              </View>
              <View style={[styles.field, styles.requiredField]}>
                <View
                  accessibilityLabel={isMissing("ramenType") ? "라멘 종류, 골라주세요" : "라멘 종류"}
                  accessible
                  ref={ramenTypeRef}
                  style={styles.labelRow}
                >
                  <AppText variant="bodyStrong">라멘 종류</AppText>
                  <AppText
                    accessibilityElementsHidden={!isMissing("ramenType")}
                    capScale
                    importantForAccessibility={isMissing("ramenType") ? "auto" : "no-hide-descendants"}
                    style={!isMissing("ramenType") && styles.hiddenHint}
                    tone="brand"
                    variant="meta"
                  >
                    골라주세요
                  </AppText>
                </View>
                <View accessibilityLabel="라멘 종류" accessibilityRole="radiogroup" style={styles.chips}>
                  {RAMEN_TYPES.map((type) => {
                    const selected = ramenType === type
                    return (
                      <RecordChoice
                        key={type}
                        label={type}
                        onPress={() => setRamenType(type)}
                        role="radio"
                        selected={selected}
                      />
                    )
                  })}
                </View>
              </View>

              <View style={styles.dateWrap}>
                <AppText style={styles.label} variant="bodyStrong">
                  방문일
                </AppText>
                <Pressable
                  accessibilityHint={Platform.OS === "web" ? undefined : "달력을 열어 날짜를 바꿔요"}
                  accessibilityLabel={`방문일, ${formatDateLabel(visitDate)}`}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isDatePickerOpen }}
                  onPress={() => {
                    Keyboard.dismiss()
                    setIsDatePickerOpen((open) => !open)
                  }}
                  ref={visitedAtRef}
                  style={({ pressed }) => [styles.dateField, isMissing("visitedAt") && styles.inputInvalid, pressed && styles.pressed]}
                >
                  <AppText numberOfLines={1} style={[styles.medium, styles.dateValue]} variant="body">
                    {formatDateLabel(visitDate)}
                    {visitedAt === formatDate(today) ? (
                      <AppText tone="muted" variant="body">
                        {"  오늘"}
                      </AppText>
                    ) : null}
                  </AppText>
                  <CalendarDays color={colors.textMuted} size={18} />
                </Pressable>
                {/* 안드로이드 대화상자는 accentColor를 받지 않고 앱의 네이티브 테마 색으로 그린다 */}
                {isDatePickerOpen && Platform.OS !== "ios" ? (
                  <DateTimePicker
                    display="default"
                    locale="ko-KR"
                    maximumDate={today}
                    mode="date"
                    onChange={(event, date) => {
                      setIsDatePickerOpen(false)
                      if (event.type === "set" && date) setVisitDate(date)
                    }}
                    value={visitDate}
                  />
                ) : null}
              </View>
            </View>

            <Pressable
              accessibilityHint="맛 태그, 사진, 메모를 펼치거나 접어요"
              accessibilityLabel="상세 추가"
              accessibilityRole="button"
              accessibilityState={{ expanded: detailsOpen }}
              onPress={() => setDetailsOpen((open) => !open)}
              style={({ pressed }) => [styles.addDetail, pressed && styles.pressed]}
            >
              <AppText variant="bodyStrong">상세 추가</AppText>
              <AppText capScale style={styles.addDetailSub} tone="sub" variant="secondary">
                맛 태그 · 사진 · 메모
              </AppText>
              {/* 열린 항목이 화면 밖에 있어도 화살표로 상태를 알린다. */}
              {detailsOpen ? <ChevronUp color={colors.ink} size={18} /> : <ChevronDown color={colors.ink} size={18} />}
            </Pressable>
            {detailsOpen ? (
              <View>
            <View style={styles.section}>
              <SectionHeader
                meta={selectedTagCount > 0 ? `선택 · ${selectedTagCount}개` : "선택"}
                metaStyle={styles.counterMeta}
                metaTone="sub"
                title="맛 태그"
              />
              <View style={styles.tagsPanel}>
                {TASTE_FIELDS.map((field) => (
                  <View key={field.key}>
                    <AppText style={styles.tagLabel} variant="bodyStrong">
                      {field.label}
                    </AppText>
                    <View accessibilityLabel={field.label} style={styles.tasteChips}>
                      {field.options.map((option) => {
                        const selected = tasteNotes[field.key].includes(option)
                        return (
                          <RecordChoice
                            accessibilityLabel={`${field.label} ${option}`}
                            compact
                            key={option}
                            label={option}
                            onPress={() => toggleTasteNote(field.key, option)}
                            selected={selected}
                          />
                        )
                      })}
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* 사진을 추가하면 펼쳐진 상세에서 각각 확인하고 삭제할 수 있다. */}
            {photos.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader
                  meta={`선택 · 최대 ${RECORD_PHOTO_MAX}장`}
                  metaTone="sub"
                  title="사진"
                />
                <ScrollView
                  contentContainerStyle={styles.photoRow}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.photoScroller}
                >
                  {photos.map((uri, index) => (
                    <View key={uri} style={styles.photoTile}>
                      <Image
                        accessibilityLabel={`첨부 사진 ${index + 1}`}
                        contentFit="cover"
                        source={{ uri }}
                        style={StyleSheet.absoluteFill}
                      />
                      <Pressable
                        accessibilityLabel={`사진 ${index + 1} 삭제`}
                        accessibilityRole="button"
                        onPress={() => setPhotos((current) => current.filter((item) => item !== uri))}
                        style={styles.photoRemove}
                      >
                        <View style={styles.photoRemoveDot}>
                          <X color={colors.onPhotoPill} size={14} />
                        </View>
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.divider} />

            {/* 메모는 쓰고 싶을 때만 펼쳐서 적는다. */}
            <View style={styles.section}>
              <SectionHeader
                meta={`선택 · ${note.length}/${RECORD_NOTE_MAX_LENGTH}`}
                metaStyle={styles.counterMeta}
                metaTone="sub"
                title="기억해둘 점"
              />
              <TextInput
                accessibilityHint={`선택, ${RECORD_NOTE_MAX_LENGTH}자까지`}
                accessibilityLabel="기억해둘 점"
                maxLength={RECORD_NOTE_MAX_LENGTH}
                multiline
                onChangeText={setNote}
                placeholder="예: 다음엔 면을 단단하게 부탁하기"
                placeholderTextColor={colors.textMuted}
                ref={noteRef}
                style={[styles.input, styles.noteInput]}
                textAlignVertical="top"
                value={note}
              />
            </View>

              </View>
            ) : null}
            <View style={styles.bottomSpace} />
          </View>
        </ScrollView>

        <StickyActionBar
          hint={saveError ? `저장하지 못했어요. ${saveError}` : hint}
          hintIsError={Boolean(saveError)}
          hintTone={saveError ? "critical" : !isComplete && attempted ? "brand" : "muted"}
          reserveHintLines={2}
        >
          <View style={styles.visibilityPair}>
            {VISIBILITY_CHOICES.map(({ label, value }) => {
              const selected = isPublic === value
              return (
                <Pressable
                  accessibilityLabel={label}
                  accessibilityHint={value ? "기록을 공개해 피드에 올려요" : "피드에 올리지 않고 나만 볼 수 있어요"}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={label}
                  onPress={() => {
                    if (Platform.OS !== "web" && !selected) void Haptics.selectionAsync().catch(() => undefined)
                    setIsPublic(value)
                  }}
                  style={({ pressed }) => [styles.visibilityButton, value ? styles.visibilityPublic : styles.visibilityPrivate, selected && styles.visibilitySelected, pressed && !selected && styles.pressed]}
                >
                  <AppText capScale lineBreakStrategyIOS="hangul-word" style={[styles.visibilityText, selected && styles.onSelectedText]} variant="secondary">
                    {label}
                  </AppText>
                </Pressable>
              )
            })}
          </View>
          {/* 미완성이어도 저장을 누르면 빠진 첫 항목으로 안내한다. */}
          <Pressable
            accessibilityHint={isComplete ? undefined : "누르면 빠진 첫 항목으로 이동해요"}
            accessibilityLabel={saveError ? "다시 시도" : isComplete ? "기록 저장하기" : `기록 저장하기, 남은 필수 ${missing.length}개`}
            accessibilityRole="button"
            accessibilityState={{ busy: saving }}
            onPress={() => void save()}
            style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed]}
          >
            {saving ? <ActivityIndicator color={colors.onDark} size="small" style={styles.saveSpinner} /> : null}
            <AppText capScale lineBreakStrategyIOS="hangul-word" style={styles.saveText} tone="onDark" variant="secondary">
              {saving ? "저장 중…" : saveError ? "다시 시도" : "저장"}
            </AppText>
          </Pressable>
        </StickyActionBar>
      </KeyboardAvoidingView>

      <ConfirmDialog
        cancelLabel="계속 작성"
        confirmLabel="나가기"
        destructive
        message="작성 중인 기록이 있어요. 지금까지 고른 평가와 사진은 저장되지 않아요."
        onCancel={() => {
          pendingLeave.current = null
          setLeaveVisible(false)
        }}
        onConfirm={confirmLeave}
        title="작성을 그만둘까요?"
        visible={leaveVisible}
      />
      {Platform.OS === "ios" ? (
        <Modal animationType="fade" onRequestClose={() => setIsDatePickerOpen(false)} transparent visible={isDatePickerOpen}>
          <View style={styles.dateModalRoot}>
            <Pressable
              accessibilityLabel="달력 닫기"
              accessibilityRole="button"
              onPress={() => setIsDatePickerOpen(false)}
              style={StyleSheet.absoluteFill}
            />
            <View accessibilityViewIsModal style={styles.dateModalCard}>
              <View style={styles.dateModalHeader}>
                <AppText variant="sectionTitle">방문일</AppText>
                <Pressable accessibilityLabel="날짜 선택 완료" accessibilityRole="button" onPress={() => setIsDatePickerOpen(false)} style={styles.dateDone}>
                  <AppText variant="button">완료</AppText>
                </Pressable>
              </View>
              <DateTimePicker
                accentColor={pickerAccent}
                display="inline"
                locale="ko-KR"
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  flexShrink: { flex: 1, minWidth: 0 },
  hiddenHint: { opacity: 0 },
  flowHeader: { minHeight: FLOW_HEADER_HEIGHT },
  navTitle: { fontSize: 18, lineHeight: 24 },
  slip: { paddingHorizontal: spacing.gutter, paddingTop: spacing.x4 },
  // 사진 칸은 오른쪽 두 입력칸(가게 · 먹은 메뉴)의 위아래 끝에 맞춰 늘어난다
  introFields: { flexDirection: "row", alignItems: "stretch", gap: spacing.x3 },
  introInputs: { flex: 1, minWidth: 0 },
  photoHero: {
    width: 104,
    minHeight: 120,
    borderRadius: radii.sm,
    overflow: "hidden",
    backgroundColor: colors.canvasSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  photoHeroLabel: { alignItems: "center", gap: spacing.x1 },
  photoCount: {
    position: "absolute",
    bottom: spacing.x2,
    right: spacing.x2,
    borderRadius: radii.pill,
    backgroundColor: colors.photoPill,
    paddingHorizontal: spacing.x2,
    paddingVertical: spacing.x1,
  },
  photoCountText: { color: colors.onPhotoPill },
  medium: { fontWeight: "500" },
  dateValue: { flex: 1, minWidth: 0 },
  section: { paddingHorizontal: spacing.gutter, paddingTop: spacing.x5, paddingBottom: spacing.x5 },
  divider: { height: line.hair, backgroundColor: colors.border },
  field: { marginBottom: spacing.x4 },
  introShopField: { marginBottom: spacing.x1 },
  introMenuField: { marginBottom: 0 },
  requiredField: { marginTop: spacing.x6 },
  dateWrap: { marginTop: spacing.x6, marginBottom: spacing.x4 },
  label: { marginBottom: spacing.x1, fontSize: 14, lineHeight: 18 },
  labelRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: spacing.x1,
  },
  fieldLabel: { fontSize: 14, lineHeight: 18 },
  input: {
    ...typography.body,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: spacing.x3_5,
    paddingVertical: spacing.x2,
    borderRadius: radii.sm,
    borderWidth: line.base,
    borderColor: colors.outline,
    backgroundColor: colors.paper,
    color: colors.ink,
  },
  menuInput: { minHeight: 44, height: 44 },
  inputInvalid: { borderColor: colors.brand },
  noteInput: { height: 96, paddingTop: spacing.x3_5 },
  shopField: {
    minHeight: 48,
    paddingHorizontal: spacing.x3,
    borderRadius: radii.sm,
    borderWidth: line.base,
    borderColor: colors.outline,
    backgroundColor: colors.paper,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.x1,
  },
  dateField: {
    minHeight: 48,
    paddingHorizontal: spacing.x3_5,
    borderRadius: radii.sm,
    borderWidth: line.base,
    borderColor: colors.outline,
    backgroundColor: colors.paper,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.x3,
  },
  pressed: { backgroundColor: colors.surfacePressed },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x2 },
  tasteChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x2 },
  choice: {
    minHeight: touchTarget,
    borderRadius: radii.pill,
    backgroundColor: colors.canvasSoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.x4,
  },
  choiceSelected: { backgroundColor: colors.selected },
  onSelectedText: { color: colors.onSelected },
  choiceText: { ...typography.button, textAlign: "center" },
  tasteChoice: { paddingHorizontal: spacing.x3 },
  axes: { marginTop: spacing.section },
  scoreField: { marginBottom: spacing.x2 },
  scoreHeading: { flexDirection: "row", alignItems: "baseline", gap: spacing.x1, marginBottom: spacing.x1 },
  scoreLabel: { fontSize: 14, lineHeight: 18, fontWeight: "600" },
  scoreStatus: { flexShrink: 1, fontSize: 14, lineHeight: 18 },
  scoreCells: { flexDirection: "row", gap: spacing.x1_5 },
  scoreCell: { flex: 1, minWidth: 0, minHeight: touchTarget, paddingVertical: spacing.x1, borderRadius: radii.pill, backgroundColor: colors.canvasSoft, alignItems: "center", justifyContent: "center" },
  scoreCellSelected: { backgroundColor: colors.selected },
  scoreCellText: { fontSize: 15, lineHeight: 19, fontWeight: "700", textAlign: "center" },
  scoreRevisitText: { fontSize: 13, lineHeight: 17 },
  scoreEnds: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.x1 },
  addDetail: {
    minHeight: 48,
    marginHorizontal: spacing.gutter,
    marginTop: spacing.x6,
    paddingHorizontal: spacing.x3_5,
    borderRadius: radii.sm,
    backgroundColor: colors.canvasSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.x2,
  },
  addDetailSub: { flex: 1, textAlign: "right" },
  photoScroller: { marginHorizontal: -spacing.gutter },
  photoRow: { paddingHorizontal: spacing.gutter, gap: spacing.x2 },
  photoTile: {
    width: 96,
    height: 96,
    borderRadius: radii.sm,
    overflow: "hidden",
    backgroundColor: colors.canvasSoft,
  },
  photoRemove: {
    position: "absolute",
    top: 0,
    right: 0,
    width: touchTarget,
    height: touchTarget,
    alignItems: "flex-end",
    justifyContent: "flex-start",
    padding: spacing.x1_5,
  },
  photoRemoveDot: {
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    backgroundColor: colors.photoPill,
    alignItems: "center",
    justifyContent: "center",
  },
  tagsPanel: { gap: spacing.x4 },
  tagLabel: { marginBottom: spacing.x2 },
  counterMeta: { minWidth: 132, textAlign: "right", fontVariant: ["tabular-nums"] },
  bottomSpace: { height: spacing.x8 },
  visibilityPair: { flex: 1.25, minWidth: 0, flexDirection: "row", gap: spacing.x2 },
  visibilityButton: {
    minWidth: 0,
    minHeight: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.canvasSoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.x1,
  },
  visibilityPrivate: { flex: 1.6 },
  visibilityPublic: { flex: 1 },
  visibilitySelected: { backgroundColor: colors.selected },
  visibilityText: { fontWeight: "700", flexShrink: 1, textAlign: "center" },
  dateModalRoot: { flex: 1, justifyContent: "center", paddingHorizontal: spacing.gutter, backgroundColor: colors.overlay },
  dateModalCard: { alignSelf: "center", width: "100%", maxWidth: 430, borderRadius: radii.lg, backgroundColor: colors.canvas, padding: spacing.x4 },
  dateModalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dateDone: { minWidth: touchTarget, minHeight: touchTarget, alignItems: "center", justifyContent: "center" },
  saveButton: {
    flex: 1.65,
    minHeight: 52,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.x2,
    paddingHorizontal: spacing.x1,
  },
  saveSpinner: { position: "absolute", left: spacing.x2 },
  saveButtonPressed: { backgroundColor: colors.brandPressed },
  saveText: { flexShrink: 1, textAlign: "center", fontSize: 16, fontWeight: "700" },
})
