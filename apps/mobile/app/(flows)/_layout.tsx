import { Stack, router, usePathname, useSegments } from "expo-router"
import { useEffect } from "react"

import { TASTE_REPORT_ENABLED } from "@/src/features"
import { useRaota } from "@/src/state/RaotaStore"
import { colors } from "@/src/theme"

/*
 * 스택으로 여는 집중 작업(로그인·가입, 기록, 취향 리포트, 약관)의 틀.
 * 화면이 쓰는 글씨·버튼·칩은 공용 부품(@/src/components/ui)과 src/theme 토큰에 있다.
 */
export default function FlowLayout() {
  const { currentUser, state } = useRaota()
  const segments = useSegments()
  const pathname = usePathname()
  const section = segments[1]
  const needsAccount = section === "record" || section === "taste" || section === "hidden-authors" || section === "my-type"
  // 취향 리포트를 숨긴 빌드에서는 주소(딥링크·알림 포함)로 들어와도 홈으로 보낸다. 로그인보다 먼저 본다
  const hidden = section === "taste" && !TASTE_REPORT_ENABLED
  const blocked = needsAccount && !currentUser
  // 약관 다시 동의가 필요한 회원은 로그인·가입·동의 화면과 약관 전문만 볼 수 있다
  const needsConsent = Boolean(currentUser) && state.consentRequired && section !== "auth" && section !== "legal"

  /*
   * 회원만 쓰는 화면에 비회원이 닿으면 로그인으로 보낸다.
   *
   * 여기서 Stack 대신 <Redirect>를 반환하면 안 된다. 그러면 내비게이터가 통째로
   * 사라졌다가 다시 붙고, 그 과정에서 segments가 다시 바뀌어 렌더가 끝없이 돈다
   * ("Maximum update depth exceeded"). 스택은 늘 붙여 두고 이동만 시킨다.
   */
  useEffect(() => {
    // replace라 열려던 화면이 히스토리에서 지워진다. 로그인 뒤 돌아갈 곳을 next로 들려 보낸다
    if (hidden) router.replace("/native")
    else if (blocked) router.replace({ pathname: "/auth/login", params: { next: pathname } })
    else if (needsConsent) router.replace({ pathname: "/auth/consent", params: { next: pathname } })
  }, [hidden, blocked, needsConsent, pathname])

  return (
    // 화면 어디서나 밀어 뒤로 가기: 루트 스택(app/_layout.tsx)과 같은 설정
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right", fullScreenGestureEnabled: true, contentStyle: { backgroundColor: colors.canvas } }}>
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
