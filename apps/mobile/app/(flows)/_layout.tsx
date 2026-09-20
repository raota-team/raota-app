import { Redirect, Stack, useSegments } from "expo-router"

import { useRaota } from "@/src/state/RaotaStore"

/*
 * 스택으로 여는 집중 작업(로그인·가입, 기록, 취향 리포트, 약관)의 틀.
 * 화면이 쓰는 글씨·버튼·칩은 공용 부품(@/src/components/ui)과 src/theme 토큰에 있다.
 */
export default function FlowLayout() {
  const { currentUser } = useRaota()
  const segments = useSegments()
  const section = segments[1]
  const needsAccount = section === "record" || section === "taste"

  if (needsAccount && !currentUser) {
    return <Redirect href="/auth/login" />
  }

  return (
    <Stack
      screenOptions={{ headerShown: false, animation: "slide_from_right" }}
    >
      <Stack.Screen
        name="record/select-shop"
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
          gestureEnabled: true,
        }}
      />
    </Stack>
  )
}
