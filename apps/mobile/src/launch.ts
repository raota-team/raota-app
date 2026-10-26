/**
 * 앱을 켤 때 덮은 화면(LaunchCover)을 걷는 신호.
 * 첫 화면인 홈이 위쪽 내용(매장 목록·오늘의 큐레이션)을 다 받으면 알린다. 앱 프로세스마다 한 번만 쓰인다.
 */
let ready = false
const listeners = new Set<() => void>()

export function markLaunchReady(): void {
  if (ready) return
  ready = true
  for (const listener of listeners) listener()
  listeners.clear()
}

/** 이미 준비됐으면 바로 부른다. 돌려준 함수로 구독을 끊는다 */
export function onLaunchReady(listener: () => void): () => void {
  if (ready) {
    listener()
    return () => undefined
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
