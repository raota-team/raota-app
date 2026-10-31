import AsyncStorage from "@react-native-async-storage/async-storage"
import { useSyncExternalStore } from "react"

import { track } from "@/src/analytics"
import { RAOTA_STORAGE_KEY } from "@/src/repository/LocalRaotaRepository"

/**
 * 처음 쓰는 사람 안내(사용자 결정 2026.11.01, B+C안).
 * - 첫 식권(B): 처음 켠 비회원에게 한 번만 큐레이터의 "첫 식권" 모드를 연다(/ai-recommend?welcome=1).
 * - 홈 카드(C): "처음이라면 이것부터" 세 가지(지도에서 가게 보기 · 식권 뽑기 · 첫 기록)를 하나씩 체크한다. 다 하거나 ✕로 닫으면 다시 안 뜬다.
 * 진행은 이 기기에만 둔다(서버와 무관, 다시 설치하면 다시 나온다).
 */
export type OnboardingTask = "map" | "ticket" | "record"

export const ONBOARDING_TASKS: readonly OnboardingTask[] = ["map", "ticket", "record"]

export interface OnboardingProgress {
  /** 첫 식권 안내를 띄웠는지. 띄우는 순간 true로 바꿔, 중간에 앱을 꺼도 다시 띄우지 않는다 */
  introShown: boolean
  /** 홈 카드를 ✕로 닫았는지 */
  cardDismissed: boolean
  done: Partial<Record<OnboardingTask, true>>
}

const STORAGE_KEY = "@raota/onboarding-v1"
/** 안내가 생기기 전부터 쓰던 기기. 업데이트로 받은 사람에게는 첫 실행 안내도 홈 카드도 띄우지 않는다 */
const RETURNING: OnboardingProgress = { introShown: true, cardDismissed: true, done: {} }
const FRESH: OnboardingProgress = { introShown: false, cardDismissed: false, done: {} }

let progress: OnboardingProgress | null = null
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function update(next: OnboardingProgress) {
  progress = next
  emit()
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined)
}

function parse(saved: string): OnboardingProgress {
  try {
    const value = JSON.parse(saved) as Partial<OnboardingProgress>
    return { introShown: value.introShown === true, cardDismissed: value.cardDismissed === true, done: { ...value.done } }
  } catch {
    return RETURNING
  }
}

/**
 * 앱이 뜨자마자(앱 저장소가 상태를 처음 쓰기 전에) 한 번 부른다. 첫 설치인지는 "앱 상태가 이미 저장돼 있었는지"로 가린다.
 * 읽지 못하면 안내를 띄우지 않는 쪽(이미 쓰던 기기)으로 본다.
 */
export function loadOnboarding(): Promise<void> {
  loading ??= (async () => {
    let next = RETURNING
    try {
      const [[, saved], [, appState]] = await AsyncStorage.multiGet([STORAGE_KEY, RAOTA_STORAGE_KEY])
      next = saved ? parse(saved) : appState ? RETURNING : FRESH
      if (!saved) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      next = RETURNING
    }
    progress = next
    emit()
  })()
  return loading
}

/** 지금 진행. 불러오기 전에는 null */
export function getOnboardingProgress(): OnboardingProgress | null {
  return progress
}

/** 불러오기 전에는 null. 불러온 뒤 바뀌면 다시 그린다 */
export function useOnboarding(): OnboardingProgress | null {
  return useSyncExternalStore((listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, getOnboardingProgress)
}

/** 첫 식권 안내를 띄웠다고(또는 띄울 필요가 없다고) 남긴다. 띄웠는지는 띄운 쪽이 알린다 */
export function markIntroShown() {
  if (!progress || progress.introShown) return
  update({ ...progress, introShown: true })
}

export function completeOnboardingTask(task: OnboardingTask) {
  if (!progress || progress.done[task]) return
  update({ ...progress, done: { ...progress.done, [task]: true } })
  track("onboarding_task_completed", { task })
}

export function dismissStartCard() {
  if (!progress || progress.cardDismissed) return
  update({ ...progress, cardDismissed: true })
  track("onboarding_card_dismissed", { done: Object.keys(progress.done).length })
}
