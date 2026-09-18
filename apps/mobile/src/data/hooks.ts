import { useMemo } from "react"
import {
  DEMO_BASE_PROFILE,
  DEMO_BOWLS,
  DEMO_TYPE_COUNTS,
  DEMO_USER,
  EMPTY_PROFILE,
  PAST_REPORTS,
  bowlsFromLogs,
  currentMonthReport,
  getRamenActivityLevel,
  longestStreak,
  mergeProfile,
  monthKeyOfDate,
  profileDelta,
  shopVisitsOf,
  tasteIdentity,
  typeCountsWithLogs,
  type CurrentMonthReport,
  type DemoBowl,
  type PastReportItem,
  type RamenLog,
  type Shop,
  type ShopVisit,
  type TasteIdentity,
  type TasteProfile,
  type TasteScores,
} from "@raota/shared"

import { useRaota } from "../state/RaotaStore"

/**
 * 화면이 쓰는 데이터 입구. 지금은 로컬 스토어와 공유 원장에서 읽고,
 * API가 준비되면 이 파일 안쪽만 서버 요청으로 바꾼다. 화면은 원장(SHOP_CATALOG, DEMO_BOWLS)을 직접 import하지 않는다.
 *
 * 모든 hook은 { data, isLoading, error } 모양을 돌려준다. 더미 단계에서도 화면이
 * 로딩·오류 상태를 갖추게 하려는 것이다.
 */
export interface Query<T> {
  data: T
  isLoading: boolean
  error: string | null
}

function useQueryState(): Pick<Query<unknown>, "isLoading" | "error"> {
  const { isHydrated, storageError } = useRaota()
  return { isLoading: !isHydrated, error: storageError }
}

/** 매장 원장 전체 */
export function useShops(): Query<Shop[]> {
  const { shops } = useRaota()
  const status = useQueryState()
  return { data: shops, ...status }
}

/** 매장 하나. 없으면 data가 null이다 */
export function useShop(shopId: number | null | undefined): Query<Shop | null> {
  const { getShop } = useRaota()
  const status = useQueryState()
  return { data: shopId ? (getShop(shopId) ?? null) : null, ...status }
}

/** 찜한 매장 */
export function useBookmarkedShops(): Query<Shop[]> {
  const { bookmarkedShops } = useRaota()
  const status = useQueryState()
  return { data: bookmarkedShops, ...status }
}

/** 로그인한 사용자가 남긴 기록(최신순). 비회원이면 빈 배열 */
export function useMyLogs(): Query<RamenLog[]> {
  const { userLogs } = useRaota()
  const status = useQueryState()
  return { data: userLogs, ...status }
}

/** 기록 하나 */
export function useLog(logId: number | null | undefined): Query<RamenLog | null> {
  const { getLog } = useRaota()
  const status = useQueryState()
  return { data: logId ? (getLog(logId) ?? null) : null, ...status }
}

/** 누적 그릇 수. 비회원은 0 */
export function useBowlCount(): Query<number> {
  const { currentUser } = useRaota()
  const status = useQueryState()
  return { data: currentUser?.visitedCount ?? 0, ...status }
}

/** 앱 설치 전(웹·과거)까지의 5축 평균. 데모 계정만 42그릇 평균이 있다 */
function baseProfileFor(userId: string | undefined): TasteProfile {
  return userId === DEMO_USER.id ? DEMO_BASE_PROFILE : EMPTY_PROFILE
}

export interface TasteProfileData {
  /** 지금까지의 5축 평균(방금 남긴 기록 포함) */
  profile: TasteProfile
  /**
   * 기록 하나를 빼고 계산한 평균과 그 차이. 완료 화면이 "3.90 → 3.93 (+0.03)"을 보여줄 때 쓴다.
   * excludeLogId가 없거나 그 기록에 점수가 없으면 null
   */
  before: TasteProfile | null
  delta: TasteScores | null
}

/** 5축 누적 평균. 같은 계산을 웹과 공유한다(packages/shared mergeProfile) */
export function useTasteProfile(excludeLogId?: number | null): Query<TasteProfileData> {
  const { currentUser, userLogs } = useRaota()
  const status = useQueryState()
  const data = useMemo(() => {
    const base = baseProfileFor(currentUser?.id)
    const profile = mergeProfile(base, userLogs)
    const target = excludeLogId ? userLogs.find((log) => log.id === excludeLogId) : undefined
    if (!target?.scores) return { profile, before: null, delta: null }
    const before = mergeProfile(
      base,
      userLogs.filter((log) => log.id !== excludeLogId),
    )
    return { profile, before, delta: profileDelta(before, profile) }
  }, [currentUser?.id, excludeLogId, userLogs])
  return { data, ...status }
}

/**
 * 내가 먹은 모든 그릇(최신순). 데모 계정은 앱 설치 전 42그릇 원장(DEMO_BOWLS)에 앱에서 남긴 기록을 더한다.
 * 캘린더, 연속 기록, 방문 매장, 월별 분포가 모두 이 목록에서 나온다.
 */
export function useMyBowls(): Query<DemoBowl[]> {
  const { currentUser, userLogs } = useRaota()
  const status = useQueryState()
  const data = useMemo(() => {
    if (!currentUser) return []
    const base = currentUser.id === DEMO_USER.id ? DEMO_BOWLS : []
    return [...base, ...bowlsFromLogs(userLogs)].sort((a, b) => b.date.localeCompare(a.date))
  }, [currentUser, userLogs])
  return { data, ...status }
}

/** 방문 매장(방문 많은 순). visitCount 합계는 누적 그릇 수와 같다 */
export function useVisitedShops(): Query<ShopVisit[]> {
  const bowls = useMyBowls()
  const data = useMemo(() => shopVisitsOf(bowls.data), [bowls.data])
  return { ...bowls, data }
}

/** 하루도 빠지지 않고 이어서 기록한 최장 일수 */
export function useLongestStreak(): Query<number> {
  const bowls = useMyBowls()
  const data = useMemo(() => longestStreak(bowls.data), [bowls.data])
  return { ...bowls, data }
}

/** 취향 정체성("진한 돈골파")과 판정 근거. 누적 종류 분포 + 육수 농도 평균으로 정한다 */
export function useTasteIdentity(): Query<TasteIdentity> {
  const { currentUser, userLogs } = useRaota()
  const profile = useTasteProfile()
  const data = useMemo(() => {
    const base = currentUser?.id === DEMO_USER.id ? DEMO_TYPE_COUNTS : {}
    return tasteIdentity(typeCountsWithLogs(base, userLogs), profile.data.profile)
  }, [currentUser?.id, profile.data.profile, userLogs])
  return { ...profile, data }
}

export interface MonthlyReportsData {
  /** 발행된 지난 달 리포트(오래된 순이 아니라 원장 순서) */
  past: PastReportItem[]
  /** 집계 중인 이번 달. 기록이 없으면 null */
  current: CurrentMonthReport | null
}

/** 월별 취향 변화. 지난 달은 원장 리포트, 이번 달은 실제 기록에서 계산한다 */
export function useMonthlyReports(now = new Date()): Query<MonthlyReportsData> {
  const { currentUser, userLogs } = useRaota()
  const bowls = useMyBowls()
  const data = useMemo(() => {
    const isDemo = currentUser?.id === DEMO_USER.id
    const counts: Record<string, number> = {}
    for (const bowl of bowls.data) counts[monthKeyOfDate(bowl.date)] = (counts[monthKeyOfDate(bowl.date)] ?? 0) + 1
    return {
      past: isDemo ? PAST_REPORTS : [],
      current: currentMonthReport(counts, userLogs, isDemo ? DEMO_BOWLS : [], now),
    }
    // now는 화면을 여는 시점 기준으로 충분하다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bowls.data, currentUser?.id, userLogs])
  return { ...bowls, data }
}

/** 활동 등급(그릇 수 기준). 다음 등급까지 남은 그릇과 진행률 포함 */
export function useActivityLevel(): Query<ReturnType<typeof getRamenActivityLevel>> {
  const count = useBowlCount()
  const data = useMemo(() => getRamenActivityLevel(count.data), [count.data])
  return { ...count, data }
}
