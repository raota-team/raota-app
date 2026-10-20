import { router } from "expo-router"
import { Bookmark, Crosshair, Plus, Search, X, type LucideIcon } from "lucide-react-native"
import { useCallback, useEffect, useRef, useState } from "react"
import { ActionSheetIOS, Alert, Linking, Modal, Platform, Pressable, StyleSheet, View } from "react-native"
import Animated, { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"

import { track } from "../analytics"
import { scheduleTestReminder, type PlannedReminder } from "../notifications"
import { colors, line, pressFade, radii, shadows, spacing } from "../theme"
import { AppText, IconButton } from "./ui"

type RecordMode = "nearby" | "saved" | "search"

const MENU_ITEMS: Array<{ mode: RecordMode; label: string; Icon: LucideIcon }> = [
  { mode: "nearby", label: "주변 라멘집 기록하기", Icon: Crosshair },
  { mode: "saved", label: "찜한 가게에서 기록하기", Icon: Bookmark },
  { mode: "search", label: "직접 검색해서 기록하기", Icon: Search },
]

const TEST_SECONDS = 5

// 시트 안의 닫기 버튼과 탭 바의 기록 버튼을 같은 화면 좌표에 놓는다.
export const RECORD_TAB_BAR_HEIGHT = 60
export const RECORD_HOME_INDICATOR_OVERLAP = 8
export const RECORD_BUTTON_WIDTH = spacing.x16
export const RECORD_BUTTON_HEIGHT = spacing.x10
const OUT = Easing.bezier(0.22, 1, 0.36, 1)
const SPRING = Easing.bezier(0.34, 1.56, 0.64, 1)

function recordButtonBottom(bottomInset: number) {
  return Math.max(0, bottomInset - RECORD_HOME_INDICATOR_OVERLAP)
    + (RECORD_TAB_BAR_HEIGHT - spacing.x1 - RECORD_BUTTON_HEIGHT) / 2
}

/**
 * 개발 빌드(Expo Go 포함)에서만 기록 버튼 길게 누름으로 예약한다.
 * 리마인더를 눌렀을 때 가게 고르기로 돌아오는 딥링크도 함께 확인한다.
 */
export function openReminderTestMenu(monthCount: number) {
  const run = async (kind: PlannedReminder["kind"]) => {
    const result = await scheduleTestReminder(TEST_SECONDS, kind, monthCount)
    if (result === "scheduled") {
      Alert.alert("테스트 알림을 예약했어요", `${TEST_SECONDS}초 뒤에 와요. 알림을 누르면 기록할 가게 고르기가 열려요.`)
    } else if (result === "denied") {
      Alert.alert("알림 권한이 꺼져 있어요", "설정에서 RAOTA 알림을 허용한 뒤 다시 시도해 주세요.", [
        { text: "닫기", style: "cancel" },
        { text: "설정 열기", onPress: () => void Linking.openSettings() },
      ])
    } else {
      Alert.alert("이 환경에서는 알림을 보낼 수 없어요", "iOS 기기나 시뮬레이터의 Expo Go에서 확인해 주세요.")
    }
  }
  const options = [`${TEST_SECONDS}초 뒤 테스트 알림: 월간 리포트`, `${TEST_SECONDS}초 뒤 테스트 알림: 7일 미기록`, "취소"]
  const pick = (index: number) => {
    if (index === 0) void run("monthly")
    if (index === 1) void run("inactive")
  }
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions({ title: "개발용 리마인더 테스트", options, cancelButtonIndex: 2 }, pick)
    return
  }
  Alert.alert("개발용 리마인더 테스트", undefined, [
    { text: options[0], onPress: () => pick(0) },
    { text: options[1], onPress: () => pick(1) },
    { text: options[2], style: "cancel" },
  ])
}

interface RecordMenuProps {
  visible: boolean
  onClose: () => void
}

/** iOS 모달 onDismiss를 기다리는 최대 시간. 시스템 내림 애니메이션보다 넉넉히 길다 */
const DISMISS_FALLBACK_MS = 600

/** 기록 방법은 탭이 아니라 시트로 고르고, 탭 자리의 닫기 버튼만 시트 위에 남긴다. */
export function RecordMenu({ visible, onClose }: RecordMenuProps) {
  const insets = useSafeAreaInsets()
  const reducedMotion = useReducedMotion()
  const [mounted, setMounted] = useState(visible)
  const [sheetMeasured, setSheetMeasured] = useState(false)
  const visibleRef = useRef(visible)
  visibleRef.current = visible
  // 고른 기록 방법은 메뉴 모달이 다 내려간 뒤에 연다. RN 모달이 떠 있는 채로 네이티브 모달을 올리면
  // react-native-screens가 이 모달을 시스템 애니메이션으로 먼저 끌어내린다
  const chosenMode = useRef<RecordMode | null>(null)
  const openChosen = useCallback(() => {
    const mode = chosenMode.current
    chosenMode.current = null
    if (mode) router.push({ pathname: "/record/select-shop", params: { mode, source: "tab" } })
  }, [])
  const finishClose = useCallback(() => {
    if (visibleRef.current) return
    setMounted(false)
    // iOS는 모달이 실제로 내려간 뒤 onDismiss에서 연다. 안드로이드에는 onDismiss가 없다.
    // onDismiss가 오지 않는 경우(모달이 이미 내려가 있던 경우 등)에도 멈추지 않게 잠시 뒤 한 번 더 시도한다. openChosen은 한 번만 연다
    if (Platform.OS !== "ios") openChosen()
    else setTimeout(openChosen, DISMISS_FALLBACK_MS)
  }, [openChosen])
  const progress = useSharedValue(0)
  const rotation = useSharedValue(0)
  const sheetHeight = useSharedValue(0)
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion ? (visible ? 1 : 0) : progress.value,
  }), [reducedMotion, visible])
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: sheetMeasured ? 1 : 0,
    transform: [{ translateY: (1 - (reducedMotion ? (visible ? 1 : 0) : progress.value)) * sheetHeight.value }],
  }), [reducedMotion, sheetMeasured, visible])
  const plusStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${reducedMotion ? (visible ? 45 : 0) : rotation.value}deg` }],
  }), [reducedMotion, visible])

  useEffect(() => {
    if (visible) {
      setMounted(true)
      // 닫히다 다시 열리면 닫기 콜백이 오지 않으므로 지난 선택을 버린다
      chosenMode.current = null
    }
    if (reducedMotion) {
      rotation.value = visible ? 45 : 0
      if (!visible) finishClose()
      return
    }
    rotation.value = withTiming(visible ? 45 : 0, { duration: 300, easing: SPRING }, (finished) => {
      if (finished && !visible) runOnJS(finishClose)()
    })
  }, [finishClose, reducedMotion, rotation, visible])

  useEffect(() => {
    if (reducedMotion) {
      progress.value = visible ? 1 : 0
      return
    }
    progress.value = visible && !sheetMeasured ? 0 : withTiming(visible ? 1 : 0, {
      duration: visible ? 380 : 200,
      easing: visible ? OUT : Easing.in(Easing.cubic),
    })
  }, [progress, reducedMotion, sheetMeasured, visible])

  const choose = (mode: RecordMode) => {
    // 닫히는 중에 한 번 더 누르면 가게 고르기가 두 번 쌓인다
    if (!visibleRef.current || chosenMode.current) return
    chosenMode.current = mode
    track("record_started", { mode, source: "tab" })
    onClose()
  }

  return (
    <Modal
      animationType="none"
      onDismiss={openChosen}
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={mounted}
    >
      <View accessibilityViewIsModal style={styles.modalRoot}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable accessibilityLabel="기록 방법 선택 닫기" accessibilityRole="button" onPress={onClose} style={styles.fill} />
        </Animated.View>
        <Animated.View
          onLayout={(event) => {
            const height = event.nativeEvent.layout.height
            if (height > 0) {
              sheetHeight.value = height
              if (!sheetMeasured) setSheetMeasured(true)
            }
          }}
          style={[styles.sheetWrap, sheetStyle]}
        >
          <SafeAreaView edges={["bottom"]} style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <AppText accessibilityRole="header" style={styles.headerTitle} variant="sectionTitle">기록 방법 선택</AppText>
              <IconButton accessibilityLabel="닫기" icon={<X color={colors.ink} size={22} />} onPress={onClose} />
            </View>
            <View style={styles.sheetContent}>
              <View style={styles.choices}>
                {MENU_ITEMS.map((item, index) => (
                  <RecordChoice key={item.mode} {...item} index={index} onChoose={choose} reducedMotion={reducedMotion} visible={visible} />
                ))}
              </View>
            </View>
          </SafeAreaView>
        </Animated.View>
        <Pressable
          accessibilityLabel="기록 메뉴 닫기"
          accessibilityRole="button"
          hitSlop={4}
          onPress={onClose}
          style={({ pressed }) => [styles.recordButton, { bottom: recordButtonBottom(insets.bottom) }, pressed && pressFade]}
        >
          <Animated.View style={plusStyle}>
            <Plus color={colors.white} size={24} strokeWidth={2.5} />
          </Animated.View>
        </Pressable>
      </View>
    </Modal>
  )
}

function RecordChoice({
  mode, label, Icon, index, onChoose, reducedMotion, visible,
}: (typeof MENU_ITEMS)[number] & {
  index: number
  onChoose: (mode: RecordMode) => void
  reducedMotion: boolean
  visible: boolean
}) {
  const reveal = useSharedValue(reducedMotion || !visible ? 1 : 0)
  const rowStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion ? 1 : reveal.value,
    transform: [{ translateY: reducedMotion ? 0 : (1 - reveal.value) * 10 }],
  }), [reducedMotion])

  useEffect(() => {
    if (!visible || reducedMotion) {
      reveal.value = 1
      return
    }
    reveal.value = 0
    reveal.value = withDelay(180 + index * 50, withTiming(1, { duration: 350, easing: OUT }))
  }, [index, reducedMotion, reveal, visible])

  return (
    <Animated.View style={rowStyle}>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        onPress={() => onChoose(mode)}
        style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}
      >
        <View style={styles.choiceIcon}>
          <Icon color={colors.ink} size={20} strokeWidth={2.1} />
        </View>
        <AppText style={styles.choiceLabel} variant="bodyStrong">{label}</AppText>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  fill: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  sheetWrap: { maxHeight: "85%" },
  sheet: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    ...shadows.modal,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    alignSelf: "center",
    marginTop: spacing.x3,
    borderRadius: radii.pill,
    backgroundColor: colors.secondaryPressed,
  },
  sheetHeader: {
    minHeight: 56,
    paddingLeft: spacing.gutter,
    paddingRight: spacing.x2,
    flexDirection: "row",
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: line.base,
  },
  headerTitle: { flex: 1 },
  // 닫기 버튼이 탭의 기록 버튼을 가리지 않도록 줄 아래 공간을 미리 둔다.
  sheetContent: { flexShrink: 1, paddingHorizontal: spacing.x4, paddingTop: spacing.x4, paddingBottom: spacing.x4 + RECORD_TAB_BAR_HEIGHT },
  choices: { marginTop: -spacing.x1 },
  recordButton: {
    position: "absolute",
    left: "50%",
    marginLeft: -RECORD_BUTTON_WIDTH / 2,
    width: RECORD_BUTTON_WIDTH,
    height: RECORD_BUTTON_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
    borderRadius: radii.sm,
    zIndex: 2,
  },
  // 회색 상자를 쌓지 않고, 둥근 아이콘 + 글씨만 둔 줄. 누를 때만 면이 깔린다
  choice: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x3,
    marginHorizontal: -spacing.x2,
    paddingHorizontal: spacing.x2,
    borderRadius: radii.sm,
  },
  choicePressed: { backgroundColor: colors.surfacePressed },
  choiceIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    backgroundColor: colors.canvasSoft,
  },
  choiceLabel: { flex: 1 },
})
