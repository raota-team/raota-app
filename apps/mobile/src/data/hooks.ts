import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
  seoulToday,
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

import { isRemote, type ShopListParams, type ShopMapParams } from "../api"
import { remoteReads, type RemoteLoungeLogDetail, type RemotePage } from "./remote"

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
 * 화면이 쓰는 데이터 입구. mock에서는 기존 로컬 스토어를, 공개 도메인의 remote에서는
 * 서버 읽기를 사용한다. 화면은 원장(SHOP_CATALOG, DEMO_BOWLS)을 직접 import하지 않는다.
 * 모든 hook의 { data, isLoading, error } 계약은 두 모드에서 같다.
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

type RemoteResult<T> = Query<T> & { key: string | null }
type CacheEntry = { value: unknown } | { promise: Promise<unknown> }
const remoteCache = new Map<string, CacheEntry>()

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "데이터를 불러오지 못했어요"
}

/** 첫 응답을 공유하며 동일 키의 동시 요청을 합친다. 실패한 요청은 캐시하지 않는다. */
function useRemoteResult<T>(key: string | null, empty: T, read: () => Promise<T>): RemoteResult<T> {
  const readRef = useRef(read)
  readRef.current = read
  const [result, setResult] = useState<RemoteResult<T>>(() => {
    const cached = key ? remoteCache.get(key) : undefined
    return { key, data: cached && "value" in cached ? cached.value as T : empty, isLoading: Boolean(key && !(cached && "value" in cached)), error: null }
  })

  useEffect(() => {
    if (!key) return
    let active = true
    const entry = remoteCache.get(key)
    if (entry && "value" in entry) {
      setResult({ key, data: entry.value as T, isLoading: false, error: null })
    } else {
      setResult({ key, data: empty, isLoading: true, error: null })
      let promise = entry && "promise" in entry ? entry.promise as Promise<T> : null
      if (!promise) {
        promise = readRef.current()
        remoteCache.set(key, { promise })
        void promise.then(
          (value) => remoteCache.set(key, { value }),
          () => remoteCache.delete(key),
        )
      }
      void promise.then(
        (data) => { if (active) setResult({ key, data, isLoading: false, error: null }) },
        (cause) => { if (active) setResult({ key, data: empty, isLoading: false, error: errorMessage(cause) }) },
      )
    }
    return () => { active = false }
    // read/empty can be recreated during rendering; only the key identifies a request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return result.key === key ? result : { key, data: empty, isLoading: Boolean(key), error: null }
}

interface RemotePaging<T> extends Query<T[]> {
  hasMore: boolean
  loadMore(): void
}

/** 커서의 첫 응답은 공유하고, 이어지는 페이지는 이 화면이 필요할 때만 불러온다. */
function useRemoteContinuation<T extends { id: string }>(
  key: string | null,
  first: Query<RemotePage<T>>,
  read: (cursor: string) => Promise<RemotePage<T>>,
): RemotePaging<T> {
  const readRef = useRef(read)
  readRef.current = read
  const [extra, setExtra] = useState<{ key: string | null; pages: RemotePage<T>[]; loading: boolean; error: string | null }>({
    key, pages: [], loading: false, error: null,
  })
  const pending = useRef<string | null>(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  const currentKey = useRef(key)
  const generation = useRef(0)
  if (currentKey.current !== key) {
    currentKey.current = key
    generation.current += 1
    pending.current = null
  }
  const active = extra.key === key ? extra : { key, pages: [], loading: false, error: null }
  const last = active.pages.at(-1) ?? first.data
  const hasMore = !first.isLoading && !first.error && last.hasNext && Boolean(last.nextCursor)
  const loadMore = useCallback(() => {
    if (!key || !hasMore || !last.nextCursor || pending.current === key) return
    const cursor = last.nextCursor
    const requestGeneration = generation.current
    pending.current = key
    setExtra((previous) => ({ key, pages: previous.key === key ? previous.pages : [], loading: true, error: null }))
    void readRef.current(cursor).then(
      (page) => {
        if (mounted.current && currentKey.current === key && generation.current === requestGeneration) setExtra((previous) => ({ key, pages: [...(previous.key === key ? previous.pages : []), page], loading: false, error: null }))
      },
      (cause) => {
        if (mounted.current && currentKey.current === key && generation.current === requestGeneration) setExtra((previous) => ({ ...previous, loading: false, error: errorMessage(cause) }))
      },
    ).finally(() => { if (currentKey.current === key && generation.current === requestGeneration) pending.current = null })
  }, [hasMore, key, last.nextCursor])

  const data = useMemo(() => {
    const seen = new Set<string>()
    return [first.data, ...active.pages].flatMap((page) => page.items.filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    }))
  }, [active.pages, first.data])
  return { data, isLoading: first.isLoading || active.loading, error: first.error ?? active.error, hasMore, loadMore }
}

const EMPTY_PAGE: RemotePage<never> = { items: [], nextCursor: null, hasNext: false }

export interface ShopFeed extends Query<Shop[]> {
  remote: boolean
  hasMore: boolean
  loadMore(): void
}

/** 매장 목록. remote에서는 화면이 필요로 할 때 다음 커서 페이지를 이어 붙인다. */
export function useShops(params: Omit<ShopListParams, "cursor" | "size"> = {}): ShopFeed {
  const { shops } = useRaota()
  const status = useQueryState()
  const remote = isRemote("shops")
  const key = remote ? `shops:${JSON.stringify(params)}` : null
  const first = useRemoteResult(key, EMPTY_PAGE as RemotePage<Shop>, () => remoteReads.shops({ ...params, size: 20 }))
  const pages = useRemoteContinuation(key, first, (cursor) => remoteReads.shops({ ...params, cursor, size: 20 }))
  return remote ? { ...pages, remote: true } : { data: shops, ...status, hasMore: false, loadMore: () => undefined, remote: false }
}

/** 회원 기록·취향 화면은 로컬 그릇과 같은 원장을 계속 참조한다. */
export function useLocalShops(): Query<Shop[]> {
  const { shops } = useRaota()
  const status = useQueryState()
  return { data: shops, ...status }
}

/** 지도와 목록은 같은 전체 매장을 읽는다. 좌표가 없는 매장은 지도에서만 제외한다. */
export function useMapShops(params: ShopMapParams = {}): Query<Shop[]> & { remote: boolean } {
  const { shops } = useRaota()
  const status = useQueryState()
  const enabled = isRemote("shops")
  const remote = useRemoteResult(enabled ? `shops:map:${JSON.stringify(params)}` : null, [] as Shop[], () => remoteReads.mapShops(params))
  return enabled ? { ...remote, remote: true } : { data: shops, ...status, remote: false }
}

/** 없는 오늘의 큐레이션은 null(서버가 픽을 발행하지 않았을 때). */
export function useTodayCuration(): Query<{ shop: Shop; title: string; reason: string } | null> & { remote: boolean } {
  const status = useQueryState()
  const enabled = isRemote("shops")
  const remote = useRemoteResult(
    enabled ? `shops:curation:${seoulToday()}` : null,
    null as { shop: Shop; title: string; reason: string } | null,
    remoteReads.todayCuration,
  )
  return enabled ? { ...remote, remote: true } : { data: null, ...status, remote: false }
}

/** 매장 하나. 없으면 data가 null이다 */
export function useShop(shopId: string | null | undefined): Query<Shop | null> {
  const { getShop } = useRaota()
  const status = useQueryState()
  const remote = isRemote("shops")
  const result = useRemoteResult(remote && shopId ? `shop:${shopId}` : null, null as Shop | null, () => remoteReads.shop(shopId!))
  return remote ? result : { data: shopId ? (getShop(shopId) ?? null) : null, ...status }
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
export function useLog(logId: string | null | undefined): Query<RamenLog | null> {
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
export function useTasteProfile(excludeLogId?: string | null): Query<TasteProfileData> {
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
  /** mock은 전체 수, remote는 현재까지 읽은 수(서버 커서에는 전체 수가 없다) */
  total: number
  hasMore: boolean
  /** 다음 쪽을 이어 붙인다. 필터·정렬이 바뀌면 첫 쪽부터 다시 */
  loadMore(): void
}

/** 공개 라멘로그 피드. remote에서는 필터·정렬마다 독립적으로 커서를 이어 읽는다. */
export function useLoungeLogs({ type, sort, pageSize = LOUNGE_PAGE_SIZE }: LoungeFeedOptions): LoungeFeed {
  const { state } = useRaota()
  const status = useQueryState()
  const viewer = useLoungeViewer()
  const remote = isRemote("lounge")
  const remoteKey = remote ? `lounge:${type}|${sort}|${pageSize}` : null
  const first = useRemoteResult(remoteKey, EMPTY_PAGE as RemotePage<RamenLog>, () => remoteReads.loungeLogs({ type, sort, size: pageSize }))
  const pages = useRemoteContinuation(remoteKey, first, (cursor) => remoteReads.loungeLogs({ type, sort, cursor, size: pageSize }))
  // mock에서는 댓글도 숨긴 사람·신고한 댓글을 제외해 카드와 상세의 수를 맞춘다.
  const all = useMemo(
    () => remote ? [] : selectLoungeLogs(state.logs, { type, sort }, viewer).map((log) => ({
      ...log,
      comments: selectVisibleComments(log, viewer),
    })),
    [remote, sort, state.logs, type, viewer],
  )
  const key = `${type}|${sort}`
  const [paging, setPaging] = useState({ key, count: pageSize })
  const count = paging.key === key ? paging.count : pageSize
  const loadMore = useCallback(() => {
    setPaging((prev) => ({ key, count: (prev.key === key ? prev.count : pageSize) + pageSize }))
  }, [key, pageSize])

  const data = useMemo(() => all.slice(0, count), [all, count])
  return remote
    ? { ...pages, total: pages.data.length }
    : { data, ...status, total: all.length, hasMore: all.length > count, loadMore }
}

export interface LoungeLogDetail {
  log: RamenLog
  /** 등록순. 숨긴 사람·신고한 댓글은 빠져 있다 */
  comments: RamenLogComment[]
  commentCount: number
}

export interface LoungeLogQuery extends Query<LoungeLogDetail | null> {
  hasMoreComments: boolean
  loadMoreComments(): void
}

/** 상세의 댓글 미리보기를 먼저 쓰고 스크롤할 때만 다음 댓글 페이지를 읽는다. */
export function useLoungeLog(logId: string | null | undefined): LoungeLogQuery {
  const { getLog } = useRaota()
  const status = useQueryState()
  const viewer = useLoungeViewer()
  const remote = isRemote("lounge")
  const key = remote && logId ? `lounge:detail:${logId}` : null
  const detail = useRemoteResult(key, null as RemoteLoungeLogDetail | null, () => remoteReads.loungeLog(logId!))
  const firstComments: Query<RemotePage<RamenLogComment>> = {
    data: detail.data
      ? { items: detail.data.comments, nextCursor: detail.data.nextCursor, hasNext: detail.data.hasNext }
      : EMPTY_PAGE,
    isLoading: detail.isLoading,
    error: detail.error,
  }
  const comments = useRemoteContinuation(key, firstComments, (cursor) => remoteReads.loungeLogComments(logId!, cursor))
  const log = logId ? getLog(logId) : undefined
  const local = useMemo(() => {
    if (!log || !isLogVisibleTo(log, viewer)) return null
    const visibleComments = selectVisibleComments(log, viewer)
    return { log, comments: visibleComments, commentCount: visibleComments.length }
  }, [log, viewer])
  return remote
    ? {
        data: detail.data ? { log: detail.data.log, comments: comments.data, commentCount: detail.data.commentCount } : null,
        isLoading: detail.isLoading || comments.isLoading,
        error: detail.error ?? comments.error,
        hasMoreComments: comments.hasMore,
        loadMoreComments: comments.loadMore,
      }
    : { data: local, ...status, hasMoreComments: false, loadMoreComments: () => undefined }
}

// ---------------------------------------------------------------------------
// 계정
// ---------------------------------------------------------------------------

export type NicknameAvailability = "unchecked" | "checking" | "available" | "taken"

/** 입력이 멈춘 뒤 서버에 물어보기까지 기다리는 시간 */
export const NICKNAME_CHECK_DELAY_MS = 400

/**
 * 닉네임 중복 확인(서버 회원일 때만). 형식이 맞는 닉네임만 입력이 멈춘 뒤 한 번 묻는다.
 * mock이거나 형식 오류가 있거나 확인에 실패하면 "unchecked"다. 최종 판단은 가입 요청의 409가 한다.
 * normalized는 서버와 같은 대소문자 무시 값이라, 대소문자만 바꿔 쓰면 다시 묻지 않는다.
 */
export function useNicknameAvailability(normalized: string, valid: boolean): NicknameAvailability {
  const enabled = valid && isRemote("auth") && isRemote("member")
  const [result, setResult] = useState<{ nickname: string; status: NicknameAvailability } | null>(null)

  useEffect(() => {
    if (!enabled) return
    let active = true
    const timer = setTimeout(() => {
      setResult({ nickname: normalized, status: "checking" })
      remoteReads
        .nicknameAvailability(normalized)
        .then((available) => {
          if (active) setResult({ nickname: normalized, status: available ? "available" : "taken" })
        })
        .catch(() => {
          if (active) setResult({ nickname: normalized, status: "unchecked" })
        })
    }, NICKNAME_CHECK_DELAY_MS)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [enabled, normalized])

  if (!enabled || result?.nickname !== normalized) return "unchecked"
  return result.status
}
