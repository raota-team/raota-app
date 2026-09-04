import React from 'react';
import { Tabs } from 'expo-router';
import { Home, MapPin, MessageSquare, Flame, User } from 'lucide-react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
          color: colors.text,
        },
        headerShadowVisible: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ color, size }) => <Home size={size ?? 22} color={color} strokeWidth={2.2} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: '지도',
          tabBarIcon: ({ color, size }) => <MapPin size={size ?? 22} color={color} strokeWidth={2.2} />,
        }}
      />
      <Tabs.Screen
        name="lounge"
        options={{
          title: '라운지',
          tabBarIcon: ({ color, size }) => <MessageSquare size={size ?? 22} color={color} strokeWidth={2.2} />,
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: '소식',
          tabBarIcon: ({ color, size }) => <Flame size={size ?? 22} color={color} strokeWidth={2.2} />,
        }}
      />
      <Tabs.Screen
        name="my"
        options={{
          title: '마이',
          tabBarIcon: ({ color, size }) => <User size={size ?? 22} color={color} strokeWidth={2.2} />,
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          href: null, // 숨김 처리
        }}
      />
    </Tabs>
  );
}
