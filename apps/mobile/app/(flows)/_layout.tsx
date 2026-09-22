import { Stack, router, usePathname, useSegments } from "expo-router"
import { useEffect } from "react"

import { useRaota } from "@/src/state/RaotaStore"

/*
 * 스택으로 여는 집중 작업(로그인·가입, 기록, 취향 리포트, 약관)의 틀.
 * 화면이 쓰는 글씨·버튼·칩은 공용 부품(@/src/components/ui)과 src/theme 토큰에 있다.
 */
export default function FlowLayout() {
  const { currentUser } = useRaota()
  const segments = useSegments()
  const pathname = usePathname()
  const section = segments[1]
  const needsAccount = section === "record" || section === "taste"
  const blocked = needsAccount && !currentUser

  /*
   * 회원만 쓰는 화면에 비회원이 닿으면 로그인으로 보낸다.
   *
   * 여기서 Stack 대신 <Redirect>를 반환하면 안 된다. 그러면 내비게이터가 통째로
   * 사라졌다가 다시 붙고, 그 과정에서 segments가 다시 바뀌어 렌더가 끝없이 돈다
   * ("Maximum update depth exceeded"). 스택은 늘 붙여 두고 이동만 시킨다.
   */
  useEffect(() => {
    // replace라 열려던 화면이 히스토리에서 지워진다. 로그인 뒤 돌아갈 곳을 next로 들려 보낸다
    if (blocked) router.replace({ pathname: "/auth/login", params: { next: pathname } })
  }, [blocked, pathname])

  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
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
