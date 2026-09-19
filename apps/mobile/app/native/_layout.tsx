import { Tabs } from "expo-router"
import { Home, MapPin, MessagesSquare, UserRound, type LucideIcon } from "lucide-react-native"
import { useEffect, useState, type ComponentProps } from "react"
import { Keyboard, Platform, Pressable, StyleSheet, View } from "react-native"

import { AppText } from "@/src/components/ui"
import { colors, spacing } from "@/src/theme"

/*
 * MVP 탭: 홈 · 지도 · 라운지 · 마이 네 개. 라운지는 다른 사람들의 공개 라멘로그(공감 · 댓글 · 신고 · 숨기기)만 두고,
 * 커뮤니티 게시판과 라멘속보는 앱 MVP 범위 밖이다.
 * 탭 바는 TAB_ICONS에 있는 라우트만 그리고, 순서는 아래 Tabs.Screen 순서를 따른다. 이 폴더에 다른 화면 파일이 남아 있어도 탭으로 보이지 않는다.
 * 모양은 웹 App.tsx 탭 바와 같다: 흰 면, 위 1pt 경계, 높이 52 + 하단 inset(홈 인디케이터 쪽 8pt는 겹쳐 쓴다),
 * 아이콘 22pt, 라벨 12pt bold, 활성 탭은 빨강과 위쪽 2pt 막대. 키보드가 열리면 숨긴다.
 */

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0]

const TAB_ICONS: Record<string, LucideIcon> = {
  index: Home,
  map: MapPin,
  lounge: MessagesSquare,
  my: UserRound,
}

const VISIBLE_TABS = Object.keys(TAB_ICONS)

const TAB_BAR_HEIGHT = 52
/**
 * 홈 인디케이터가 있는 기기에서 inset(34pt)을 그대로 더하면 라벨 아래가 휑해 보인다.
 * 인디케이터 위쪽 여유 8pt는 탭 바가 겹쳐 써서 시스템 탭 바(49 + 34)와 비슷한 높이로 맞춘다
 */
const HOME_INDICATOR_OVERLAP = 8

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
  if (keyboardVisible) return null

  const routes = state.routes.filter((route) => VISIBLE_TABS.includes(route.name))

  return (
    <View accessibilityLabel="주요 메뉴" style={[styles.bar, { paddingBottom: Math.max(0, insets.bottom - HOME_INDICATOR_OVERLAP) }]}>
      <View accessibilityRole="tablist" style={styles.row}>
        {routes.map((route) => {
          const { options } = descriptors[route.key]
          const focused = state.routes[state.index]?.key === route.key
          const label = typeof options.title === "string" ? options.title : route.name
          const Icon = TAB_ICONS[route.name]
          const color = focused ? colors.brand : colors.textMuted

          const onPress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true })
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params)
          }
          const onLongPress = () => navigation.emit({ type: "tabLongPress", target: route.key })

          return (
            <Pressable
              accessibilityLabel={`${label} 탭`}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              key={route.key}
              onLongPress={onLongPress}
              onPress={onPress}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
              testID={`tab-${route.name}`}
            >
              {focused ? <View style={styles.activeBar} /> : null}
              <Icon color={color} size={22} strokeWidth={focused ? 2.3 : 1.8} />
              <AppText capScale numberOfLines={1} style={[styles.label, { color }]} variant="meta">
                {label}
              </AppText>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

export default function TabLayout() {
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
  bar: {
    backgroundColor: colors.canvas,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    height: TAB_BAR_HEIGHT,
    paddingHorizontal: spacing.x1,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.x1,
  },
  activeBar: {
    position: "absolute",
    top: 0,
    width: 24,
    height: 2,
    backgroundColor: colors.brand,
  },
  label: { fontWeight: "700", letterSpacing: -0.15 },
  pressed: { opacity: 0.7 },
})
