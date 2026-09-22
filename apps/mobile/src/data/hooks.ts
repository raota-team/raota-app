import { useCallback, useMemo, useState } from "react"
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
  type RamenLogComment,
  type Shop,
  type ShopVisit,
  type TasteIdentity,
  type TasteProfile,
  type TasteScores,
} from "@raota/shared"

import {
  LOUNGE_PAGE_SIZE,
  isLogVisibleTo,
  selectLoungeLogs,
  selectVisibleComments,
  type LoungeSort,
  type LoungeViewer,
} from "../domain/lounge"
import { useRaota } from "../state/RaotaStore"

/**
 * 화면이 쓰는 데이터 입구. 지금은 로컬 스토어와 공유 원장에서 읽고,
 * API가 준비되면 이 파일 안쪽만 서버 요청으로 바꾼다. 화면은 원장(SHOP_CATALOG, DEMO_BOWLS)을 직접 import하지 않는다.
 *
 * 모든 hook은 { data, isLoading, error } 모양을 돌려준다. 더미 단계에서도 화면이
 * 로딩·오류 상태를 갖추게 하려는 것이다.
 *
 * 서버로 옮길 때: src/data/remote.ts에 hook마다 대응하는 함수(remoteReads·remoteWrites)를 만들어 뒀다.
 * .env로 EXPO_PUBLIC_API_MODE=remote와 EXPO_PUBLIC_API_REMOTE_DOMAINS(도메인별 스위치)를 켜고
 * 이 파일 안쪽만 그 함수로 바꾼다. hook 이름과 돌려주는 모양은 그대로 둔다(화면은 건드리지 않는다).
 * 기본값은 mock이라 지금은 아무 화면도 서버를 보지 않는다.
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

/**
 * 파생 계산을 "스토어 값 하나당 한 번"으로 묶는다.
 *
 * 훅마다 useMemo를 따로 두면 캐시도 훅 인스턴스마다 따로라, 한 화면이 useMyBowls와
 * useVisitedShops를 함께 부르면 같은 그릇 목록을 두 번 만든다(리포트 화면은 mergeProfile도 두 번 돌았다).
 * userLogs는 RaotaStore가 state가 바뀔 때마다 새 배열로 만들므로, 그 배열을 키로 쓰면
 * "같은 상태면 같은 결과"가 되고 상태가 바뀌면 자동으로 다시 계산된다.
 */
const derivedCache = new WeakMap<object, Map<string, unknown>>()

function derived<T>(logs: object, key: string, compute: () => T): T {
  let byKey = derivedCache.get(logs)
  if (!byKey) {
    byKey = new Map<string, unknown>()
    derivedCache.set(logs, byKey)
  }
  if (!byKey.has(key)) byKey.set(key, compute())
  return byKey.get(key) as T
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
  const data = useMemo(
    () =>
      derived(userLogs, `profile:${currentUser?.id ?? ""}:${excludeLogId ?? ""}`, () => {
        const base = baseProfileFor(currentUser?.id)
        const profile = mergeProfile(base, userLogs)
        const target = excludeLogId ? userLogs.find((log) => log.id === excludeLogId) : undefined
        if (!target?.scores) return { profile, before: null, delta: null }
        const before = mergeProfile(
          base,
          userLogs.filter((log) => log.id !== excludeLogId),
        )
        return { profile, before, delta: profileDelta(before, profile) }
      }),
    [currentUser?.id, excludeLogId, userLogs],
  )
  return { data, ...status }
}

/**
 * 내가 먹은 모든 그릇(최신순). 데모 계정은 앱 설치 전 42그릇 원장(DEMO_BOWLS)에 앱에서 남긴 기록을 더한다.
 * 캘린더, 연속 기록, 방문 매장, 월별 분포가 모두 이 목록에서 나온다.
 */
export function useMyBowls(): Query<DemoBowl[]> {
  const { currentUser, userLogs } = useRaota()
  const status = useQueryState()
  const data = useMemo(
    () =>
      derived(userLogs, `bowls:${currentUser?.id ?? ""}`, () => {
        if (!currentUser) return []
        const base = currentUser.id === DEMO_USER.id ? DEMO_BOWLS : []
        return [...base, ...bowlsFromLogs(userLogs)].sort((a, b) => b.date.localeCompare(a.date))
      }),
    [currentUser, userLogs],
  )
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

// ---------------------------------------------------------------------------
// 라운지(라멘로그 피드)
// ---------------------------------------------------------------------------

/** 지금 보는 사람 기준의 숨김·신고 목록 */
function useLoungeViewer(): LoungeViewer {
  const { currentUser, state } = useRaota()
  const userId = currentUser?.id ?? null
  return useMemo(
    () => ({ userId, hiddenAuthorIds: state.hiddenAuthorIds, reports: state.contentReports }),
    [state.contentReports, state.hiddenAuthorIds, userId],
  )
}

export interface LoungeFeedOptions {
  /** "전체" 또는 RAMEN_TYPES 중 하나 */
  type: string
  sort: LoungeSort
  pageSize?: number
}

export interface LoungeFeed extends Query<RamenLog[]> {
  /** 필터에 맞는 전체 수(아직 안 불러온 것 포함) */
  total: number
  hasMore: boolean
  /** 다음 쪽을 이어 붙인다. 필터·정렬이 바뀌면 첫 쪽부터 다시 */
  loadMore(): void
}

/**
 * 라운지 피드. 공개 라멘로그만, 숨긴 사용자와 내가 신고한 글은 뺀다. 내 공개 기록도 여기 올라온다.
 * 한 번에 pageSize(10)개씩 보여준다.
 */
export function useLoungeLogs({ type, sort, pageSize = LOUNGE_PAGE_SIZE }: LoungeFeedOptions): LoungeFeed {
  const { state } = useRaota()
  const status = useQueryState()
  const viewer = useLoungeViewer()
  // 댓글도 숨긴 사람·신고한 댓글을 뺀 목록으로 바꿔 둔다. 카드의 댓글 수가 상세 화면과 같아야 한다
  const all = useMemo(
    () =>
      selectLoungeLogs(state.logs, { type, sort }, viewer).map((log) => ({
        ...log,
        comments: selectVisibleComments(log, viewer),
      })),
    [sort, state.logs, type, viewer],
  )

  const key = `${type}|${sort}`
  const [paging, setPaging] = useState({ key, count: pageSize })
  const count = paging.key === key ? paging.count : pageSize
  const loadMore = useCallback(() => {
    // TODO(API): remoteReads.loungeLogs({ type, sort, cursor: nextCursor, size: 10 })
    // (GET /ramen-logs?sort=LATEST|LIKES&ramenType=&cursor=&size=10) 응답을 이어 붙인다.
    // 지금은 로컬 목록을 10개씩 더 보여준다
    setPaging((prev) => ({ key, count: (prev.key === key ? prev.count : pageSize) + pageSize }))
  }, [key, pageSize])

  const data = useMemo(() => all.slice(0, count), [all, count])
  return { data, ...status, total: all.length, hasMore: all.length > count, loadMore }
}

export interface LoungeLogDetail {
  log: RamenLog
  /** 등록순. 숨긴 사람·신고한 댓글은 빠져 있다 */
  comments: RamenLogComment[]
}

/**
 * 라멘로그 상세와 댓글. 없는 기록, 남의 비공개 기록, 숨긴 사람의 기록, 내가 신고한 기록이면 data가 null이다.
 * TODO(API): remoteReads.loungeLog(logId) (GET /ramen-logs/{id} + GET /ramen-logs/{id}/comments)로 바꾼다.
 * 서버가 비공개·차단·신고한 글을 이미 빼고 주므로 그때는 이 파일의 거르기가 이중 안전장치가 된다
 */
export function useLoungeLog(logId: number | null | undefined): Query<LoungeLogDetail | null> {
  const { getLog } = useRaota()
  const status = useQueryState()
  const viewer = useLoungeViewer()
  const log = logId ? getLog(logId) : undefined
  const data = useMemo(() => {
    if (!log || !isLogVisibleTo(log, viewer)) return null
    return { log, comments: selectVisibleComments(log, viewer) }
  }, [log, viewer])
  return { data, ...status }
}
