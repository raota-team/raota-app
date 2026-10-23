import * as Haptics from "expo-haptics"
import { Tabs, router, useFocusEffect } from "expo-router"
import { Home, MapPin, MessagesSquare, Plus, UserRound, type LucideIcon } from "lucide-react-native"
import { useCallback, useEffect, useState, type ComponentProps } from "react"
import { Keyboard, Platform, Pressable, StyleSheet, View } from "react-native"

import {
  RecordMenu,
  RECORD_BUTTON_HEIGHT,
  RECORD_BUTTON_WIDTH,
  RECORD_HOME_INDICATOR_OVERLAP,
  RECORD_TAB_BAR_HEIGHT,
  openReminderTestMenu,
} from "@/src/components/RecordMenu"
import { AppText } from "@/src/components/ui"
import { prefetchMapShops, useMonthlyReports } from "@/src/data"
import { useRaota } from "@/src/state/RaotaStore"
import { colors, line, pressFade, radii, spacing } from "@/src/theme"

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0]

const TAB_ICONS: Record<string, LucideIcon> = {
  index: Home,
  map: MapPin,
  lounge: MessagesSquare,
  my: UserRound,
}

function useKeyboardVisible() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    // iOS는 키보드가 올라오기 시작할 때 숨겨야 탭 바가 키보드 위로 튀지 않는다
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow"
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide"
    const show = Keyboard.addListener(showEvent, () => setVisible(true))
    const hide = Keyboard.addListener(hideEvent, () => setVisible(false))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])
  return visible
}

export function RaotaTabBar({ state, descriptors, navigation, insets }: TabBarProps) {
  const keyboardVisible = useKeyboardVisible()
  const { currentUser } = useRaota()
  const { data: monthly } = useMonthlyReports()
  const [menuOpen, setMenuOpen] = useState(false)
  const activeKey = state.routes[state.index]?.key

  useFocusEffect(useCallback(() => () => setMenuOpen(false), []))
  useEffect(() => setMenuOpen(false), [activeKey])

  const onRecordPress = () => {
    if (!currentUser) {
      router.push("/auth/login")
      return
    }
    if (!menuOpen && Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
    setMenuOpen((open) => !open)
  }

  const renderTab = (routeName: keyof typeof TAB_ICONS) => {
    const route = state.routes.find((candidate) => candidate.name === routeName)
    if (!route) return null
    const { options } = descriptors[route.key]
    const focused = activeKey === route.key
    const label = typeof options.title === "string" ? options.title : route.name
    const Icon = TAB_ICONS[routeName]
    const color = focused ? colors.ink : colors.textMuted

    const onPress = () => {
      setMenuOpen(false)
      const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true })
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params)
    }

    return (
      <Pressable
        accessibilityLabel={`${label} 탭`}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        key={route.key}
        onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
        onPress={onPress}
        style={({ pressed }) => [styles.tab, pressed && pressFade]}
        testID={`tab-${route.name}`}
      >
        <View style={styles.iconArea}>
          <Icon color={color} size={23} strokeWidth={focused ? 2.6 : 2} />
        </View>
        <AppText capScale numberOfLines={1} style={[styles.label, { color }]} variant="meta">{label}</AppText>
      </Pressable>
    )
  }

  if (keyboardVisible) return null

  return (
    <View accessibilityLabel="주요 메뉴" style={[styles.bar, { paddingBottom: Math.max(0, insets.bottom - RECORD_HOME_INDICATOR_OVERLAP) }]}>
      <View accessibilityRole="tablist" style={styles.row}>
        {renderTab("index")}
        {renderTab("map")}
        <Pressable
          accessibilityHint={currentUser ? undefined : "로그인하면 기록할 수 있어요"}
          accessibilityLabel="라멘 기록하기"
          accessibilityRole="button"
          accessibilityState={{ expanded: menuOpen }}
          onLongPress={__DEV__ ? () => openReminderTestMenu(monthly.current?.recordCount ?? 0) : undefined}
          onPress={onRecordPress}
          style={styles.tab}
          testID="tab-record"
        >
          {({ pressed }) => (
            <View style={[styles.recordIcon, pressed && pressFade]}>
              <Plus color={colors.white} size={24} strokeWidth={2.5} />
            </View>
          )}
        </Pressable>
        {renderTab("lounge")}
        {renderTab("my")}
      </View>
      <RecordMenu onClose={() => setMenuOpen(false)} visible={menuOpen} />
    </View>
  )
}

export default function TabLayout() {
  const { isHydrated } = useRaota()
  // 지도 탭의 매장 목록은 미리 받아 둔다. 저장된 로그인이 풀린 뒤에 읽어야 내 찜 여부가 맞다
  useEffect(() => {
    if (isHydrated) prefetchMapShops()
  }, [isHydrated])
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <RaotaTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: "홈" }} />
      <Tabs.Screen name="map" options={{ title: "지도" }} />
      <Tabs.Screen name="lounge" options={{ title: "라운지" }} />
      <Tabs.Screen name="my" options={{ title: "마이" }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.paper, borderTopColor: colors.border, borderTopWidth: line.base },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    height: RECORD_TAB_BAR_HEIGHT,
    paddingHorizontal: spacing.x2,
    paddingTop: spacing.x1,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.x0_5 },
  iconArea: { height: 36, alignItems: "center", justifyContent: "center" },
  recordIcon: {
    width: RECORD_BUTTON_WIDTH,
    height: RECORD_BUTTON_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
    borderRadius: radii.sm,
  },
  label: { fontWeight: "600", textAlign: "center" },
})
