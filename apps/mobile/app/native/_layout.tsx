import { Tabs } from "expo-router"
import {
  Flame,
  Home,
  MapPin,
  MessageSquare,
  UserRound,
} from "lucide-react-native"
import { StyleSheet } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { colors, fonts } from "@/src/theme"

const BRAND_RED = colors.brand
const CHARCOAL = colors.text
const MUTED = colors.textSubtle

export default function TabLayout() {
  const insets = useSafeAreaInsets()
  const bottomInset = Math.max(insets.bottom, 8)

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: BRAND_RED,
        tabBarInactiveTintColor: MUTED,
        tabBarHideOnKeyboard: true,
        tabBarItemStyle: { minHeight: 48 },
        tabBarLabelStyle: {
          fontFamily: fonts.body,
          fontSize: 12,
          fontWeight: "700",
          letterSpacing: -0.15,
          marginTop: 1,
        },
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#ECEDEF",
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,
          height: 54 + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 7,
          shadowColor: CHARCOAL,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.04,
          shadowRadius: 12,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "홈",
          tabBarAccessibilityLabel: "홈 탭",
          tabBarIcon: ({ color, focused }) => (
            <Home color={color} size={20} strokeWidth={focused ? 2.3 : 1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "지도",
          tabBarAccessibilityLabel: "지도 탭",
          tabBarIcon: ({ color, focused }) => (
            <MapPin color={color} size={20} strokeWidth={focused ? 2.3 : 1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="lounge"
        options={{
          title: "라운지",
          tabBarAccessibilityLabel: "라운지 탭",
          tabBarIcon: ({ color, focused }) => (
            <MessageSquare
              color={color}
              size={20}
              strokeWidth={focused ? 2.3 : 1.8}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: "라멘속보",
          tabBarAccessibilityLabel: "라멘속보 탭",
          tabBarIcon: ({ color, focused }) => (
            <Flame color={color} size={20} strokeWidth={focused ? 2.3 : 1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="my"
        options={{
          title: "마이",
          tabBarAccessibilityLabel: "마이 탭",
          tabBarIcon: ({ color, focused }) => (
            <UserRound
              color={color}
              size={20}
              strokeWidth={focused ? 2.3 : 1.8}
            />
          ),
        }}
      />
    </Tabs>
  )
}
