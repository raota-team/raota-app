import { router } from "expo-router"

import { isRemote } from "@/src/api/config"

/**
 * AI 큐레이터로 들어간다. 서버 AI 추천은 회원만 쓸 수 있어, 비회원은 네 단계를 다 고른 뒤가 아니라
 * 들어가기 전에 로그인부터 한다(사용자 결정 2026.11.01). 로그인하면 큐레이터로 이어서 간다.
 * 처음 켠 비회원의 첫 식권(/ai-recommend?welcome=1)은 로그인 없이 쓰므로 여기를 거치지 않는다.
 */
export function openAiCurator(loggedIn: boolean) {
  if (!loggedIn && isRemote("recommendations")) router.push({ pathname: "/auth/login", params: { next: "/ai-recommend" } })
  else router.push("/ai-recommend")
}
