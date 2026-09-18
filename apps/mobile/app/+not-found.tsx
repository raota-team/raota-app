import { Link, Stack } from "expo-router"
import { StyleSheet, Text, View } from "react-native"
import { fonts } from "@/src/theme"

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "페이지 없음", headerShown: true }} />
      <Text style={styles.code}>404</Text>
      <Text style={styles.title}>길을 잃은 한 그릇이에요</Text>
      <Text style={styles.description}>요청한 화면을 찾을 수 없습니다.</Text>
      <Link href="/" style={styles.link} accessibilityRole="button">
        홈으로 돌아가기
      </Link>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    backgroundColor: "#FFFFFF",
  },
  code: {
    color: "#E60000",
    fontFamily: fonts.display,
    fontSize: 56,
  },
  title: {
    marginTop: 8,
    color: "#25282B",
    fontFamily: fonts.body,
    fontSize: 22,
    fontWeight: "800",
  },
  description: {
    marginTop: 8,
    color: "#6B6F73",
    fontFamily: fonts.body,
    fontSize: 15,
  },
  link: {
    minHeight: 48,
    marginTop: 28,
    overflow: "hidden",
    borderRadius: 24,
    backgroundColor: "#E60000",
    paddingHorizontal: 24,
    paddingVertical: 14,
    color: "#FFFFFF",
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: "800",
  },
})
