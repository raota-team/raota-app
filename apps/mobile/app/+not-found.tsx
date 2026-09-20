import { Link, Stack } from "expo-router"
import { StyleSheet, Text, View } from "react-native"

import { Button } from "@/src/components/ui"
import { colors, spacing, typography } from "@/src/theme"

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "페이지 없음",
          headerShown: true,
          // 스택 헤더는 화면 바탕과 이어지는 미색 면
          headerStyle: { backgroundColor: colors.paper },
          headerTintColor: colors.ink,
        }}
      />
      <Text style={styles.code}>404</Text>
      <Text style={styles.title}>길을 잃은 한 그릇이에요</Text>
      <Text style={styles.description}>요청한 화면을 찾을 수 없습니다.</Text>
      <Link asChild href="/">
        <Button style={styles.link} title="홈으로 돌아가기" />
      </Link>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.x7,
    backgroundColor: colors.paper,
  },
  code: { ...typography.counter, color: colors.brand },
  title: { ...typography.headline, marginTop: spacing.x2, color: colors.ink, textAlign: "center" },
  description: { ...typography.body, marginTop: spacing.x2, color: colors.inkSub },
  link: { marginTop: spacing.x7 },
})
