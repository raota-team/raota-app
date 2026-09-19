import * as Haptics from "expo-haptics"
import { router, useFocusEffect } from "expo-router"
import { Bookmark, Crosshair, PenLine, Search, X, type LucideIcon } from "lucide-react-native"
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type EffectCallback } from "react"
import {
  AccessibilityInfo,
  ActionSheetIOS,
  Alert,
  Animated,
  Easing,
  Linking,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
} from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { track } from "../analytics"
import { useMonthlyReports } from "../data"
import { scheduleTestReminder, type PlannedReminder } from "../notifications"
import { useRaota } from "../state/RaotaStore"
import { colors, radii, shadows, spacing, touchTarget } from "../theme"
import { AppText } from "./ui"

/*
 * 떠 있는 기록 버튼. 화면의 position: relative 부모 안에 <RecordFab />만 두면 스스로 자리를 잡는다.
 * - 끌어서 옮기고, 놓으면 가까운 좌우 가장자리에 붙는다(iOS AssistiveTouch처럼).
 * - 다른 화면에 갔다 돌아오면 기본 자리(오른쪽 아래)로 돌아간다.
 * - 탭하면 기록 방법 세 가지를 펼친다(웹 HomeScreen FAB 메뉴와 같은 문구).
 * 끌기는 RN 기본 PanResponder + Animated로 만든다(react-native-gesture-handler 미설치).
 */

type RecordMode = "nearby" | "saved" | "search"

const MENU_ITEMS: Array<{ mode: RecordMode; label: string; Icon: LucideIcon }> = [
  { mode: "nearby", label: "주변 라멘집 기록하기", Icon: Crosshair },
  { mode: "saved", label: "찜한 가게에서 기록하기", Icon: Bookmark },
  { mode: "search", label: "직접 검색해서 기록하기", Icon: Search },
]

const FAB_SIZE = 56
/** 가장자리와 버튼 사이 */
const EDGE = spacing.x4
/** 이만큼 움직여야 끌기로 본다. 그보다 작으면 탭 */
const DRAG_THRESHOLD = 8
const MENU_GAP = spacing.x2_5
const MENU_ITEM_GAP = spacing.x2
const MENU_HEIGHT = MENU_ITEMS.length * touchTarget + (MENU_ITEMS.length - 1) * MENU_ITEM_GAP
/** 펼침 전체 길이. 항목마다 조금씩 늦게 출발해 버튼에서 차례로 펼쳐진다 */
const MENU_DURATION = 360
/** 한 항목이 움직이는 구간(전체 0~1 중). 나머지는 항목 사이 시차로 쓴다 */
const ITEM_SPAN = 0.6
/** 웹 렌더링에는 네이티브 드라이버가 없다 */
const NATIVE_DRIVER = Platform.OS !== "web"

interface Area {
  width: number
  height: number
  /** 부모가 상태 표시줄 아래까지 올라와 있으면 그만큼 비운다 */
  topInset: number
}

interface Point {
  x: number
  y: number
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

function boundsOf(area: Area) {
  const minX = EDGE
  const minY = area.topInset + EDGE
  return {
    minX,
    maxX: Math.max(minX, area.width - FAB_SIZE - EDGE),
    minY,
    // 부모는 탭 바 위에서 끝난다. 아래 여백만 두면 탭 바를 가리지 않는다
    maxY: Math.max(minY, area.height - FAB_SIZE - EDGE),
  }
}

const homeOf = (area: Area): Point => {
  const bounds = boundsOf(area)
  return { x: bounds.maxX, y: bounds.maxY }
}

function lightHaptic() {
  if (Platform.OS === "web") return
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
}

// 내비게이션 없이 렌더되는 단위 테스트에서 useFocusEffect가 mock에 없으면 마운트 한 번으로 대신한다
const useScreenFocusEffect: (effect: EffectCallback) => void =
  typeof useFocusEffect === "function" ? useFocusEffect : (effect) => useEffect(effect, [effect])

const TEST_SECONDS = 5

/**
 * 개발 빌드(Expo Go 포함)에서만: 길게 누르면 N초 뒤 테스트 리마인더를 예약한다.
 * 알림을 누르면 딥링크로 기록할 가게 고르기가 열리는지까지 확인하는 경로다. 프로덕션에는 없다.
 */
function openReminderTestMenu(monthCount: number) {
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

function useReduceMotion() {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    let active = true
    void AccessibilityInfo.isReduceMotionEnabled?.()
      .then((value) => active && setReduce(value))
      .catch(() => undefined)
    const subscription = AccessibilityInfo.addEventListener?.("reduceMotionChanged", setReduce)
    return () => {
      active = false
      subscription?.remove()
    }
  }, [])
  return reduce
}

export default function RecordFab() {
  const { currentUser } = useRaota()
  const { data: monthly } = useMonthlyReports()
  const insets = useContext(SafeAreaInsetsContext)
  const reduceMotion = useReduceMotion()

  const containerRef = useRef<View>(null)
  const [area, setArea] = useState<Area | null>(null)
  const [open, setOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [spot, setSpot] = useState<Point | null>(null)

  const position = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current
  const menuProgress = useRef(new Animated.Value(0)).current
  const current = useRef<Point>({ x: 0, y: 0 })
  const dragStart = useRef<Point>({ x: 0, y: 0 })
  const areaRef = useRef<Area | null>(null)
  const openRef = useRef(false)
  const reduceMotionRef = useRef(reduceMotion)
  areaRef.current = area
  openRef.current = open
  reduceMotionRef.current = reduceMotion

  const moveTo = useCallback(
    (target: Point, animated: boolean) => {
      current.current = target
      setSpot(target)
      position.stopAnimation()
      if (!animated || reduceMotionRef.current) {
        position.setValue(target)
        return
      }
      Animated.spring(position, {
        toValue: target,
        useNativeDriver: NATIVE_DRIVER,
        friction: 7,
        tension: 70,
      }).start()
    },
    [position],
  )

  const resetToHome = useCallback(
    (animated: boolean) => {
      const measured = areaRef.current
      if (!measured) return
      moveTo(homeOf(measured), animated)
    },
    [moveTo],
  )

  // 다른 화면에 갔다가 돌아오면 기본 자리로. 떠날 때도 되돌려 돌아오는 전환 중에 옛 자리가 비치지 않게 한다
  useScreenFocusEffect(
    useCallback(() => {
      resetToHome(false)
      return () => {
        setOpen(false)
        resetToHome(false)
      }
    }, [resetToHome]),
  )

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout
      const apply = (windowY: number) => {
        const next: Area = { width, height, topInset: Math.max(0, (insets?.top ?? 0) - windowY) }
        const previous = areaRef.current
        areaRef.current = next
        setArea(next)
        if (!previous) {
          moveTo(homeOf(next), false)
          return
        }
        // 크기가 바뀌면(회전, 키보드) 지금 쪽 가장자리를 유지한 채 안으로 들인다
        const bounds = boundsOf(next)
        const onLeft = current.current.x + FAB_SIZE / 2 < previous.width / 2
        moveTo({ x: onLeft ? bounds.minX : bounds.maxX, y: clamp(current.current.y, bounds.minY, bounds.maxY) }, false)
      }
      const node = containerRef.current as (View & { measureInWindow?: View["measureInWindow"] }) | null
      if (node && typeof node.measureInWindow === "function") node.measureInWindow((_x, y) => apply(y))
      else apply(0)
    },
    [insets?.top, moveTo],
  )

  const settle = useCallback(() => {
    const measured = areaRef.current
    setDragging(false)
    if (!measured) return
    const bounds = boundsOf(measured)
    const onLeft = current.current.x + FAB_SIZE / 2 < measured.width / 2
    moveTo({ x: onLeft ? bounds.minX : bounds.maxX, y: clamp(current.current.y, bounds.minY, bounds.maxY) }, true)
    lightHaptic()
  }, [moveTo])

  const settleRef = useRef(settle)
  settleRef.current = settle

  const panResponder = useMemo(() => {
    const shouldDrag = (_: unknown, gesture: { dx: number; dy: number }) =>
      !openRef.current &&
      areaRef.current !== null &&
      (Math.abs(gesture.dx) > DRAG_THRESHOLD || Math.abs(gesture.dy) > DRAG_THRESHOLD)
    return PanResponder.create({
      // 탭은 안쪽 Pressable이 받고, 문턱을 넘게 움직이면 끌기가 가져온다
      onMoveShouldSetPanResponderCapture: shouldDrag,
      onMoveShouldSetPanResponder: shouldDrag,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        position.stopAnimation()
        dragStart.current = { ...current.current }
        setDragging(true)
      },
      onPanResponderMove: (_, gesture) => {
        const measured = areaRef.current
        if (!measured) return
        const bounds = boundsOf(measured)
        const next = {
          x: clamp(dragStart.current.x + gesture.dx, bounds.minX, bounds.maxX),
          y: clamp(dragStart.current.y + gesture.dy, bounds.minY, bounds.maxY),
        }
        current.current = next
        position.setValue(next)
      },
      onPanResponderRelease: () => settleRef.current(),
      onPanResponderTerminate: () => settleRef.current(),
    })
  }, [position])

  // 메뉴 등장: 150ms 페이드와 짧은 상승. Reduce Motion이면 바로 보인다
  useEffect(() => {
    if (!open) {
      menuProgress.setValue(0)
      return
    }
    if (reduceMotion) {
      menuProgress.setValue(1)
      return
    }
    Animated.timing(menuProgress, {
      toValue: 1,
      duration: MENU_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE_DRIVER,
    }).start()
  }, [menuProgress, open, reduceMotion])

  const handlePress = useCallback(() => {
    if (!currentUser) {
      router.push("/auth/login")
      return
    }
    if (!open) lightHaptic()
    setOpen(!open)
  }, [currentUser, open])

  const choose = (mode: RecordMode) => {
    setOpen(false)
    track("record_started", { mode, source: "fab" })
    router.push({ pathname: "/record/select-shop", params: { mode, source: "fab" } })
  }

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === "activate") handlePress()
    if (event.nativeEvent.actionName === "moveToDefault") {
      resetToHome(true)
      AccessibilityInfo.announceForAccessibility?.("기록 버튼을 오른쪽 아래로 옮겼어요")
    }
  }

  // 메뉴는 버튼이 붙은 쪽으로 펼친다. 위에 자리가 모자라면 아래로 펼친다
  const onLeftEdge = Boolean(area && spot && spot.x + FAB_SIZE / 2 < area.width / 2)
  const menuBelow = Boolean(area && spot && spot.y - area.topInset - EDGE < MENU_HEIGHT + MENU_GAP)
  const menuPlacement = area && spot
    ? {
        ...(onLeftEdge ? { left: spot.x } : { right: area.width - spot.x - FAB_SIZE }),
        ...(menuBelow ? { top: spot.y + FAB_SIZE + MENU_GAP } : { bottom: area.height - spot.y + MENU_GAP }),
      }
    : { right: EDGE, bottom: EDGE + FAB_SIZE + MENU_GAP }

  const fabPlacement = area
    ? { left: 0, top: 0, transform: position.getTranslateTransform() }
    : { right: EDGE, bottom: EDGE }

  return (
    <View
      accessibilityViewIsModal={open}
      onLayout={onLayout}
      pointerEvents="box-none"
      ref={containerRef}
      style={StyleSheet.absoluteFill}
    >
      {open ? (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.backdropWrap, { opacity: menuProgress.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1], extrapolate: "clamp" }) }]}
        >
          <Pressable
            accessible={false}
            importantForAccessibility="no"
            onPress={() => setOpen(false)}
            style={styles.backdrop}
            testID="record-fab-backdrop"
          />
        </Animated.View>
      ) : null}

      {open ? (
        <Animated.View
          accessibilityLabel="기록 방법 선택"
          style={[
            styles.menu,
            menuPlacement,
            { alignItems: onLeftEdge ? "flex-start" : "flex-end" },
          ]}
        >
          {MENU_ITEMS.map(({ mode, label, Icon }, index) => {
            // 버튼에 가까운 항목부터 차례로 나온다. 멀리 있는 항목일수록 버튼 쪽에서 더 길게 미끄러져 나온다
            const order = menuBelow ? index : MENU_ITEMS.length - 1 - index
            const start = (order * (1 - ITEM_SPAN)) / Math.max(1, MENU_ITEMS.length - 1)
            const itemProgress = menuProgress.interpolate({
              inputRange: [start, start + ITEM_SPAN],
              outputRange: [0, 1],
              extrapolate: "clamp",
            })
            const travel = (order + 1) * (touchTarget + MENU_ITEM_GAP) * 0.5
            return (
            <Animated.View
              key={mode}
              style={{
                opacity: itemProgress,
                transform: [
                  { translateY: itemProgress.interpolate({ inputRange: [0, 1], outputRange: [menuBelow ? -travel : travel, 0] }) },
                  { scale: itemProgress.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
                ],
              }}
            >
            <Pressable
              accessibilityLabel={label}
              accessibilityRole="button"
              key={mode}
              onPress={() => choose(mode)}
              style={({ pressed }) => [
                styles.menuItem,
                onLeftEdge && styles.menuItemLeft,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.menuLabel}>
                <AppText numberOfLines={1} style={styles.bold} variant="secondary">
                  {label}
                </AppText>
              </View>
              <View style={styles.menuIcon}>
                <Icon color={colors.brand} size={18} strokeWidth={2.2} />
              </View>
            </Pressable>
            </Animated.View>
            )
          })}
        </Animated.View>
      ) : null}

      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.fabWrap, fabPlacement]}
        testID="record-fab"
      >
        <Pressable
          accessibilityActions={[
            { name: "activate" },
            { name: "moveToDefault", label: "기본 위치로 옮기기" },
          ]}
          accessibilityHint={currentUser ? undefined : "로그인하면 기록할 수 있어요"}
          accessibilityLabel={open ? "기록 메뉴 닫기" : "라멘 기록하기"}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          disabled={dragging}
          onAccessibilityAction={onAccessibilityAction}
          // 개발 빌드에서만 길게 눌러 테스트 리마인더를 보낸다
          onLongPress={__DEV__ ? () => openReminderTestMenu(monthly.current?.recordCount ?? 0) : undefined}
          onPress={handlePress}
          style={({ pressed }) => [
            styles.fab,
            open && styles.fabOpen,
            (pressed || dragging) && styles.pressed,
          ]}
        >
          {open ? (
            // 펜이 X로 바뀌며 반 바퀴 돈다
            <Animated.View
              style={{ transform: [{ rotate: menuProgress.interpolate({ inputRange: [0, 1], outputRange: ["-90deg", "0deg"] }) }] }}
            >
              <X color={colors.onDark} size={22} strokeWidth={2.5} />
            </Animated.View>
          ) : (
            <PenLine color={colors.onDark} size={22} strokeWidth={2.5} />
          )}
        </Pressable>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  bold: { fontWeight: "700" },
  backdropWrap: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.overlay },
  fabWrap: { position: "absolute", width: FAB_SIZE, height: FAB_SIZE },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
    ...shadows.floating,
  },
  fabOpen: { backgroundColor: colors.ink },
  pressed: { opacity: 0.85 },
  menu: { position: "absolute", gap: MENU_ITEM_GAP },
  menuItem: { flexDirection: "row", alignItems: "center", gap: spacing.x2, minHeight: touchTarget },
  menuItemLeft: { flexDirection: "row-reverse" },
  menuLabel: {
    backgroundColor: colors.canvas,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.x3_5,
    paddingVertical: spacing.x2_5,
    ...shadows.floating,
  },
  menuIcon: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvas,
    ...shadows.floating,
  },
})
