import { useEffect, useMemo, useRef, useState } from "react"
import { router, useLocalSearchParams, useNavigation } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { Image } from "expo-image"
import * as ImagePicker from "expo-image-picker"
import DateTimePicker from "@react-native-community/datetimepicker"
import { AlertCircle, CalendarDays, ChevronDown, ImagePlus, LogIn, X } from "lucide-react-native"
import {
  AccessibilityInfo,
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
  findNodeHandle,
} from "react-native"
import Animated, { FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated"
import { SafeAreaView } from "react-native-safe-area-context"

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
  Button,
  Chip,
  ConfirmDialog,
  EmptyState,
  Header,
  LoadingState,
  ScoreSegment,
  SectionHeader,
  StickyActionBar,
} from "@/src/components/ui"
import { colors, maxFontScale, radii, spacing, touchTarget, typography } from "@/src/theme"

/*
 * 라멘 기록하기. 웹 RecordScreen과 같은 순서다.
 * 한 그릇 정보 → 5축 평가 → 사진 → 메모 → 맛 태그(접힘) → 공개 여부, 하단 고정 저장 바.
 * 저장 버튼은 항상 누를 수 있고, 빠진 항목이 있으면 첫 항목으로 스크롤하며 VoiceOver 포커스를 옮긴다.
 */

type ScoreAxisKey = Exclude<TasteAxisKey, "revisit">
type FieldKey = "shop" | "menu" | "ramenType" | "visitedAt" | "note" | TasteAxisKey
type MissingField = { key: FieldKey; label: string; kind: "text" | "choice" }

const SCORE_AXES = TASTE_AXES.filter((axis): axis is (typeof TASTE_AXES)[number] & { key: ScoreAxisKey } => axis.key !== "revisit")
const REVISIT_AXIS = TASTE_AXES.find((axis) => axis.key === "revisit") ?? {
  key: "revisit" as const,
  label: "재방문 의사",
  low: "한 번이면 충분",
  high: "자주 갈래요",
}
/** 낮은 점수부터 높은 점수 순. 양 끝 설명(low · high)과 방향을 맞춘다 */
const REVISIT_CHOICES = [...REVISIT_OPTIONS].reverse()
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

/** 받침이 없거나 ㄹ 받침이면 "로", 그 밖에는 "으로" */
function withDirectionParticle(word: string): string {
  const last = word.charCodeAt(word.length - 1)
  if (last < 0xac00 || last > 0xd7a3) return `${word}로`
  const final = (last - 0xac00) % 28
  return final === 0 || final === 8 ? `${word}로` : `${word}으로`
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
    // 포커스를 옮기지 못해도 스크롤과 빨간 안내는 남는다.
  }
}

export default function NewRecordScreen() {
  const { shopId } = useLocalSearchParams<{ shopId?: string }>()
  const navigation = useNavigation()
  const { state, isHydrated, currentUser, actions } = useRaota()
  const reduceMotion = useReducedMotion()
  const parsedShopId = Number(shopId)
  const initialShopId = Number.isInteger(parsedShopId) && parsedShopId > 0 ? parsedShopId : null
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
  const [isTagsOpen, setIsTagsOpen] = useState(false)
  const [isPublic, setIsPublic] = useState(true)
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [leaveVisible, setLeaveVisible] = useState(false)

  const allowLeave = useRef(false)
  const pendingLeave = useRef<Parameters<typeof navigation.dispatch>[0] | null>(null)
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
  const selectedTagCount = Object.values(tasteNotes).reduce((sum, list) => sum + list.length, 0)

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
  )
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
    !isPublic
  const dirtyRef = useRef(isDirty)
  dirtyRef.current = isDirty

  // 뒤로가기 버튼과 가장자리 스와이프 모두 여기서 가로챈다. 저장에 성공한 뒤의 이동은 막지 않는다.
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (allowLeave.current || !dirtyRef.current) {
        actions.clearRecordDraft()
        return
      }
      event.preventDefault()
      pendingLeave.current = event.data.action
      setLeaveVisible(true)
    })
    return unsubscribe
  }, [actions.clearRecordDraft, navigation])

  // 입력을 고치면 지난 저장 실패 안내를 거둔다.
  useEffect(() => {
    setSaveError(null)
  }, [shop?.id, menuName, ramenType, visitedAt, scores, revisit, photos, note, tasteNotes, isPublic])

  // 맛 태그 펼침 화살표. Reduce Motion이면 바로 바뀐다.
  const chevron = useSharedValue(0)
  useEffect(() => {
    const target = isTagsOpen ? 180 : 0
    chevron.value = reduceMotion ? target : withTiming(target, { duration: 200 })
  }, [chevron, isTagsOpen, reduceMotion])
  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${chevron.value}deg` }] }))

  const goBack = () => {
    if (router.canGoBack()) router.back()
    else router.replace("/native")
  }

  const confirmLeave = () => {
    setLeaveVisible(false)
    allowLeave.current = true
    actions.clearRecordDraft()
    const action = pendingLeave.current
    pendingLeave.current = null
    if (action) navigation.dispatch(action)
    else goBack()
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
    if (saving) return
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
    setSaving(true)
    setSaveError(null)
    try {
      const log = await actions.createLog(input)
      track("record_saved", { hasPhoto: photos.length > 0, scoresComplete: true })
      allowLeave.current = true
      actions.clearRecordDraft()
      router.replace({ pathname: "/record/complete", params: { logId: String(log.id) } })
    } catch (error) {
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
        <StatusBar style="dark" />
        <Header backLabel="뒤로가기" onBack={goBack} title="라멘 기록하기" />
        <EmptyState
          actionLabel="로그인하기"
          description="기록은 계정에 저장돼요. 로그인하면 5축 취향 리포트도 함께 쌓여요."
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
      <StatusBar style="dark" />
      <Header
        backLabel="뒤로가기"
        onBack={goBack}
        right={
          <AppText capScale style={styles.bold} tone="muted" variant="meta">
            {isPublic ? "공개 기록" : "나만 보기"}
          </AppText>
        }
        style={styles.headerPad}
        title="라멘 기록하기"
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          style={styles.flex}
        >
          <View collapsable={false} ref={contentRef}>
            {/* 1. 한 그릇 정보 */}
            <View style={styles.section}>
              <SectionHeader meta="필수" style={styles.sectionHead} title="한 그릇 정보" />

              <View style={styles.field}>
                <AppText style={styles.label} variant="bodyStrong">
                  가게
                </AppText>
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
                  <View style={styles.flexShrink}>
                    <AppText numberOfLines={1} tone={shop ? "ink" : "muted"} variant="cardTitle">
                      {shop?.name ?? "가게를 골라주세요"}
                    </AppText>
                    {shop?.branch ? (
                      <AppText numberOfLines={1} tone="muted" variant="secondary">
                        {shop.branch}
                      </AppText>
                    ) : null}
                  </View>
                  <AppText capScale style={styles.bold} tone="brand" variant="secondary">
                    {shop ? "변경" : "선택"}
                  </AppText>
                </Pressable>
              </View>

              <View style={styles.field}>
                <View style={styles.labelRow}>
                  <AppText nativeID="record-menu-label" variant="bodyStrong">
                    먹은 메뉴
                  </AppText>
                  {isMissing("menu") ? (
                    <AppText capScale tone="brand" variant="meta">
                      채워주세요
                    </AppText>
                  ) : null}
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
                  style={inputStyle(isMissing("menu"))}
                  value={menuName}
                />
                {shopStyle && !trimmedMenu ? (
                  <Chip
                    accessibilityHint="먹은 메뉴 칸을 대표 스타일로 채워요"
                    label={`대표 스타일 ${withDirectionParticle(shopStyle)} 채우기`}
                    onPress={() => setMenuName(shopStyle)}
                    style={styles.fillChip}
                  />
                ) : null}
              </View>

              <View style={styles.field}>
                <View
                  accessibilityLabel={isMissing("ramenType") ? "라멘 종류, 골라주세요" : "라멘 종류"}
                  accessible
                  ref={ramenTypeRef}
                  style={styles.labelRow}
                >
                  <AppText variant="bodyStrong">라멘 종류</AppText>
                  {isMissing("ramenType") ? (
                    <AppText capScale tone="brand" variant="meta">
                      골라주세요
                    </AppText>
                  ) : null}
                </View>
                <View accessibilityLabel="라멘 종류" accessibilityRole="radiogroup" style={styles.chips}>
                  {RAMEN_TYPES.map((type) => {
                    const selected = ramenType === type
                    return (
                      <Chip
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected }}
                        key={type}
                        label={type}
                        onPress={() => setRamenType(type)}
                        selected={selected}
                      />
                    )
                  })}
                </View>
              </View>

              <View style={styles.fieldLast}>
                <AppText style={styles.label} variant="bodyStrong">
                  방문일
                </AppText>
                <Pressable
                  accessibilityHint={Platform.OS === "web" ? undefined : "달력을 열어 날짜를 바꿔요"}
                  accessibilityLabel={`방문일, ${formatDateLabel(visitDate)}`}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isDatePickerOpen }}
                  onPress={() => setIsDatePickerOpen((open) => !open)}
                  ref={visitedAtRef}
                  style={({ pressed }) => [
                    styles.dateField,
                    isMissing("visitedAt") && styles.inputInvalid,
                    pressed && styles.pressed,
                  ]}
                >
                  <AppText style={styles.medium} variant="body">
                    {formatDateLabel(visitDate)}
                    {visitedAt === formatDate(today) ? (
                      <AppText tone="muted" variant="body">
                        {"  오늘"}
                      </AppText>
                    ) : null}
                  </AppText>
                  <CalendarDays color={colors.textMuted} size={18} />
                </Pressable>
                {isDatePickerOpen ? (
                  <DateTimePicker
                    accentColor={colors.brand}
                    display={Platform.OS === "ios" ? "inline" : "default"}
                    locale="ko-KR"
                    maximumDate={today}
                    mode="date"
                    onChange={(event, date) => {
                      if (Platform.OS !== "ios") setIsDatePickerOpen(false)
                      if (event.type === "set" && date) setVisitDate(date)
                    }}
                    themeVariant="light"
                    value={visitDate}
                  />
                ) : null}
              </View>
            </View>

            <View style={styles.divider} />

            {/* 2. 5축 평가 */}
            <View style={styles.section}>
              <SectionHeader meta="필수" title="5축 평가" />
              <AppText style={styles.sectionLead} tone="muted" variant="secondary">
                다섯 축이 모여 취향 여권이 갱신됩니다.
              </AppText>
              <View style={styles.axes}>
                {SCORE_AXES.map((axis, index) => (
                  <ScoreSegment
                    high={axis.high}
                    index={index + 1}
                    invalid={attempted && missingAxes.has(axis.key)}
                    key={axis.key}
                    label={axis.label}
                    low={axis.low}
                    onChange={(value) => setScores((current) => ({ ...current, [axis.key]: value }))}
                    ref={(node) => {
                      axisRefs.current[axis.key] = node
                    }}
                    value={scores[axis.key] ?? null}
                  />
                ))}

                <View>
                  <View
                    accessibilityLabel={
                      attempted && missingAxes.has("revisit") ? `${REVISIT_AXIS.label}, 골라주세요` : REVISIT_AXIS.label
                    }
                    accessible
                    ref={revisitRef}
                    style={styles.scoreHead}
                  >
                    <AppText variant="bodyStrong">
                      <AppText tone="muted" variant="bodyStrong">
                        {`${SCORE_AXES.length + 1}  `}
                      </AppText>
                      {REVISIT_AXIS.label}
                    </AppText>
                    <AppText
                      capScale
                      tone={revisit ? "ink" : attempted && missingAxes.has("revisit") ? "critical" : "muted"}
                      variant="meta"
                    >
                      {revisit
                        ? `${REVISIT_SCORE[revisit]}점`
                        : attempted && missingAxes.has("revisit")
                          ? "골라주세요"
                          : "미선택"}
                    </AppText>
                  </View>
                  <View
                    accessibilityLabel={REVISIT_AXIS.label}
                    accessibilityRole="radiogroup"
                    style={[styles.segment, attempted && missingAxes.has("revisit") && styles.segmentInvalid]}
                  >
                    {REVISIT_CHOICES.map((option, index) => {
                      const selected = revisit === option
                      return (
                        <Pressable
                          accessibilityLabel={`${REVISIT_AXIS.label} ${option}, ${REVISIT_SCORE[option]}점`}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: selected }}
                          key={option}
                          onPress={() => setRevisit(option)}
                          style={({ pressed }) => [
                            styles.segmentCell,
                            index > 0 && styles.segmentDivider,
                            selected && styles.segmentSelected,
                            pressed && !selected && styles.pressed,
                          ]}
                        >
                          <AppText
                            capScale
                            numberOfLines={1}
                            style={[styles.bold, styles.textCenter]}
                            tone={selected ? "onDark" : "ink"}
                            variant="secondary"
                          >
                            {option}
                          </AppText>
                        </Pressable>
                      )
                    })}
                  </View>
                  <View style={styles.scoreEnds}>
                    <AppText capScale tone="muted" variant="meta">
                      {REVISIT_AXIS.low}
                    </AppText>
                    <AppText capScale tone="muted" variant="meta">
                      {REVISIT_AXIS.high}
                    </AppText>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.divider} />

            {/* 3. 사진 (선택) */}
            <View style={styles.section}>
              <SectionHeader meta={`선택 · 최대 ${RECORD_PHOTO_MAX}장`} style={styles.sectionHeadTight} title="사진" />
              <ScrollView
                contentContainerStyle={styles.photoRow}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.photoScroller}
              >
                {photos.length < RECORD_PHOTO_MAX ? (
                  <Pressable
                    accessibilityHint="카메라나 사진 보관함에서 가져와요"
                    accessibilityLabel={photos.length === 0 ? "사진 추가" : `사진 추가, ${photos.length}장 중 최대 ${RECORD_PHOTO_MAX}장`}
                    accessibilityRole="button"
                    onPress={choosePhotoSource}
                    style={({ pressed }) => [styles.photoAdd, pressed && styles.pressed]}
                  >
                    <ImagePlus color={colors.textMuted} size={24} />
                    <AppText capScale style={styles.bold} tone="muted" variant="meta">
                      {photos.length === 0 ? "사진 추가" : `${photos.length}/${RECORD_PHOTO_MAX}`}
                    </AppText>
                  </Pressable>
                ) : null}
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
                        <X color={colors.onDark} size={14} />
                      </View>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            </View>

            <View style={styles.divider} />

            {/* 4. 메모 (선택) */}
            <View style={styles.section}>
              <SectionHeader
                meta={`선택 · ${note.length}/${RECORD_NOTE_MAX_LENGTH}`}
                style={styles.sectionHeadTight}
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

            <View style={styles.divider} />

            {/* 5. 맛 태그 더 남기기 (선택, 접힘) */}
            <View>
              <Pressable
                accessibilityHint={isTagsOpen ? "맛 태그를 접어요" : "국물, 면, 간, 토핑 태그를 펼쳐요"}
                accessibilityLabel={`맛 태그 더 남기기, 선택${selectedTagCount > 0 ? `, ${selectedTagCount}개 선택` : ""}`}
                accessibilityRole="button"
                accessibilityState={{ expanded: isTagsOpen }}
                onPress={() => setIsTagsOpen((open) => !open)}
                style={({ pressed }) => [styles.tagsToggle, pressed && styles.pressedSoft]}
              >
                <View style={styles.flexShrink}>
                  <AppText variant="sectionTitle">맛 태그 더 남기기</AppText>
                  <AppText style={styles.tagsSub} tone="muted" variant="secondary">
                    {`선택 · 국물, 면, 간, 토핑${selectedTagCount > 0 ? ` · ${selectedTagCount}개 선택` : ""}`}
                  </AppText>
                </View>
                <Animated.View style={chevronStyle}>
                  <ChevronDown color={colors.textMuted} size={20} />
                </Animated.View>
              </Pressable>
              {isTagsOpen ? (
                <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(200)} style={styles.tagsPanel}>
                  {TASTE_FIELDS.map((field) => (
                    <View key={field.key}>
                      <View style={styles.labelRow}>
                        <AppText variant="bodyStrong">{field.label}</AppText>
                        <AppText capScale style={styles.bold} tone="muted" variant="meta">
                          {`${tasteNotes[field.key].length}개 선택`}
                        </AppText>
                      </View>
                      <View accessibilityLabel={field.label} style={styles.chips}>
                        {field.options.map((option) => (
                          <Chip
                            accessibilityLabel={`${field.label} ${option}`}
                            key={option}
                            label={option}
                            onPress={() => toggleTasteNote(field.key, option)}
                            selected={tasteNotes[field.key].includes(option)}
                          />
                        ))}
                      </View>
                    </View>
                  ))}
                </Animated.View>
              ) : null}
            </View>

            <View style={styles.divider} />

            {/* 6. 공개 여부 */}
            <View style={styles.publicRow}>
              <View style={styles.flexShrink}>
                <AppText variant="cardTitle">내 기록 공개하기</AppText>
                <AppText style={styles.tagsSub} tone="muted" variant="secondary">
                  끄면 피드에 올라가지 않고 나만 볼 수 있어요.
                </AppText>
              </View>
              <Switch
                accessibilityHint="끄면 피드에 올라가지 않고 나만 볼 수 있어요"
                accessibilityLabel="내 기록 공개하기"
                ios_backgroundColor={colors.textFaint}
                onValueChange={setIsPublic}
                thumbColor={colors.onDark}
                trackColor={{ false: colors.textFaint, true: colors.brand }}
                value={isPublic}
              />
            </View>
            <View style={styles.bottomSpace} />
          </View>
        </ScrollView>

        <StickyActionBar
          hint={saveError ? undefined : hint}
          hintTone={!isComplete && attempted ? "brand" : "muted"}
        >
          {saveError ? (
            <View accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.errorRow}>
              <AlertCircle color={colors.critical} size={20} />
              <AppText style={styles.flex} variant="secondary">
                {`저장하지 못했어요. ${saveError}`}
              </AppText>
              <Button loading={saving} onPress={() => void save()} size="small" title="다시 시도" />
            </View>
          ) : (
            // 공용 Button은 disabled를 늘 Pressable에 넘겨 accessibilityState.disabled를 덮으므로,
            // "누를 수 있지만 미완성"을 알리려고 같은 모양의 버튼을 여기서 그린다.
            <Pressable
              accessibilityHint={isComplete ? undefined : "빠진 첫 항목으로 이동해요"}
              accessibilityLabel={isComplete ? "기록 저장하기" : `기록 저장하기, 남은 필수 ${missing.length}개`}
              accessibilityRole="button"
              accessibilityState={{ disabled: !isComplete, busy: saving }}
              onPress={() => void save()}
              style={({ pressed }) => [
                styles.saveButton,
                !isComplete && !saving && styles.saveButtonIncomplete,
                pressed && styles.saveButtonPressed,
              ]}
            >
              {saving ? <ActivityIndicator color={colors.onDark} size="small" /> : null}
              <AppText
                capScale
                numberOfLines={1}
                tone={!isComplete && !saving ? "muted" : "onDark"}
                variant="bodyStrong"
              >
                {saving ? "저장하는 중…" : isComplete ? "기록 저장하기" : `남은 필수 ${missing.length}개 보러 가기`}
              </AppText>
            </Pressable>
          )}
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
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  flexShrink: { flex: 1, minWidth: 0 },
  bold: { fontWeight: "700" },
  medium: { fontWeight: "500" },
  textCenter: { textAlign: "center" },
  headerPad: { paddingRight: spacing.x4 },
  section: { paddingHorizontal: spacing.gutter, paddingTop: spacing.x5, paddingBottom: spacing.x6 },
  sectionHead: { marginBottom: spacing.x4 },
  sectionHeadTight: { marginBottom: spacing.x3 },
  sectionLead: { marginTop: spacing.x1, marginBottom: spacing.x5 },
  divider: { height: spacing.x2, backgroundColor: colors.canvasSoft },
  field: { marginBottom: spacing.x4 },
  fieldLast: {},
  label: { marginBottom: spacing.x1_5 },
  labelRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: spacing.x1_5,
  },
  input: {
    ...typography.body,
    fontWeight: "500",
    minHeight: 48,
    paddingHorizontal: spacing.x3_5,
    paddingVertical: spacing.x3,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceInput,
    color: colors.ink,
  },
  inputInvalid: { borderColor: colors.brand },
  noteInput: { minHeight: 96, paddingTop: spacing.x3_5 },
  fillChip: { alignSelf: "flex-start", marginTop: spacing.x2 },
  shopField: {
    minHeight: 48,
    paddingHorizontal: spacing.x3_5,
    paddingVertical: spacing.x2,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceInput,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x3,
  },
  dateField: {
    minHeight: 48,
    paddingHorizontal: spacing.x3_5,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceInput,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.x3,
  },
  pressed: { backgroundColor: colors.canvasSoft },
  pressedSoft: { backgroundColor: colors.surfaceInput },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x2 },
  axes: { gap: spacing.x6 },
  scoreHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: spacing.x2,
  },
  segment: {
    flexDirection: "row",
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  segmentInvalid: { borderColor: colors.brand },
  segmentCell: {
    flex: 1,
    minHeight: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.x1,
    backgroundColor: colors.canvas,
  },
  segmentDivider: { borderLeftWidth: 1, borderLeftColor: colors.border },
  segmentSelected: { backgroundColor: colors.brand },
  scoreEnds: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.x1_5 },
  photoScroller: { marginHorizontal: -spacing.gutter },
  photoRow: { paddingHorizontal: spacing.gutter, gap: spacing.x2 },
  photoAdd: {
    width: 96,
    height: 96,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.textFaint,
    backgroundColor: colors.surfaceInput,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.x1,
  },
  photoTile: {
    width: 96,
    height: 96,
    borderRadius: radii.sm,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
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
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  tagsToggle: {
    minHeight: 56,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.x3,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x3,
  },
  tagsSub: { marginTop: spacing.x0_5 },
  tagsPanel: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.x6, gap: spacing.x5 },
  publicRow: {
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.x4,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x3,
  },
  bottomSpace: { height: spacing.x4 },
  errorRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.x3 },
  saveButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.x2,
    paddingHorizontal: spacing.x6,
  },
  saveButtonIncomplete: { backgroundColor: colors.canvasSoft },
  saveButtonPressed: { opacity: 0.85 },
})
