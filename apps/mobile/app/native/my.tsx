import { useMemo, useRef, useState } from "react"
import { router, useIsFocused } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { Image } from "expo-image"
import * as Haptics from "expo-haptics"
import { Award, Bookmark, ChevronRight, MapPin, Search, Settings } from "lucide-react-native"
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"

import {
  RAMEN_ACTIVITY_LEVELS,
  monthKeyOfDate,
  seoulMonthKey,
  seoulToday,
  type DemoBowl,
  type Shop,
} from "@raota/shared"
import RecordFab from "@/src/components/RecordFab"
import { AppText, BottomSheet, Button, EmptyState, Toast } from "@/src/components/ui"
import {
  useActivityLevel,
  useBookmarkedShops,
  useBowlCount,
  useLongestStreak,
  useMonthlyReports,
  useMyBowls,
  useMyLogs,
  useShops,
  useTasteIdentity,
  useTasteProfile,
  useVisitedShops,
} from "@/src/data"
import { useRaota } from "@/src/state/RaotaStore"
import { colors, maxFontScale, radii, spacing, touchTarget, typography } from "@/src/theme"
import { MonthlyTastePreview } from "../(flows)/taste/archive"
import { TasteReportCover, shopSpecOf, shopStyleOf } from "../(flows)/taste/index"

/*
 * 마이. 웹 MyScreen과 같은 구성이다(MVP라 작성글·댓글 탭은 뺐다).
 * 차콜 프로필(이름 · 회원번호 · 총 그릇 · 방문 매장 · 이번 달 · 등급) → 종합 리포트 카드 → 월별 미리보기
 * → 탭(라멘로그 · 방문매장 · 가고싶어요) → 계정. 모든 숫자는 src/data hook에서 나온다.
 */

type ActivityTab = "logs" | "visits" | "saved"
type VisitSort = "count" | "recent" | "name"

/**
 * 최근 기록은 예전 카드 크기(5줄) 상자 안에서 스크롤한다. 상자 끝에 닿으면 5개씩 더 붙이고,
 * 상자를 바로 넘길 수 있도록 처음에는 두 쪽(10개)을 불러 둔다.
 */
const RECENT_PAGE_SIZE = 5
const RECENT_VISIBLE_ROWS = 5
/** 줄 높이: 썸네일 48 + 위아래 12 */
const RECENT_ROW_HEIGHT = 72

const LEVEL_OPACITY = [0.25, 0.45, 0.7, 1]
const CELL = 12
const CELL_GAP = 3

const shortDate = (iso: string) => iso.slice(5).replace("-", ".")
const haptic = () => void Haptics.selectionAsync().catch(() => undefined)

function openShop(shop: Shop | undefined) {
  if (shop) router.push({ pathname: "/shop/[shopId]", params: { shopId: String(shop.id) } })
}

// ---------------------------------------------------------------------------
// 캘린더 계산 (서울 기준 날짜)
// ---------------------------------------------------------------------------

const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
const weekdayOf = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay()

interface CalendarDay {
  date: string
  count: number
  inRange: boolean
}

/** 일요일로 시작하는 주 단위 열. 끝날(오늘)은 항상 포함한다 */
function buildCalendar(bowls: DemoBowl[], start: string, end: string) {
  const counts = new Map<string, number>()
  for (const bowl of bowls) counts.set(bowl.date, (counts.get(bowl.date) ?? 0) + 1)
  const weeks: CalendarDay[][] = []
  const monthLabels: { week: number; label: string }[] = []
  let total = 0
  for (let day = addDays(start, -weekdayOf(start)); day <= end; day = addDays(day, 1)) {
    if (weekdayOf(day) === 0) weeks.push([])
    const inRange = day >= start
    const count = inRange ? (counts.get(day) ?? 0) : 0
    total += count
    weeks[weeks.length - 1].push({ date: day, count, inRange })
    if (inRange && (day === start || day.endsWith("-01"))) {
      const week = weeks.length - 1
      if (!monthLabels.some((item) => item.week >= week - 2)) monthLabels.push({ week, label: `${Number(day.slice(5, 7))}월` })
    }
  }
  return { weeks, monthLabels, total }
}

/** 약관 전문은 시트가 아니라 별도 화면(스와이프 뒤로가기)으로 연다 */
function openLegal(doc: "terms" | "privacy") {
  router.push({ pathname: "/legal/[doc]", params: { doc } })
}

// ---------------------------------------------------------------------------
// 비회원
// ---------------------------------------------------------------------------

function GuestView() {
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.root}>
      <ScrollView contentContainerStyle={styles.guest}>
        <View style={styles.guestBody}>
        <Image
          accessibilityLabel="라오타"
          accessible
          contentFit="contain"
          source={require("@/assets/images/logo.png")}
          style={styles.guestLogo}
        />
        <AppText accessibilityRole="header" style={[styles.center, styles.gapTop5]} variant="headline">
          내 라멘 취향을 모아보세요
        </AppText>
        <AppText style={[styles.center, styles.gapTop2]} tone="sub" variant="body">
          로그인하면 기록, 가고 싶은 매장, 취향 리포트를 한곳에서 이어볼 수 있어요.
        </AppText>
        <View style={styles.guestActions}>
          <Button onPress={() => router.push("/auth/login")} title="로그인" />
          <Button
            onPress={() => router.push({ pathname: "/auth/login", params: { mode: "signup" } })}
            title="회원가입"
            variant="outline"
          />
        </View>
        </View>
        <View style={styles.policyLinks}>
          <Button onPress={() => openLegal("terms")} size="small" textStyle={styles.linkText} title="이용약관" variant="ghost" />
          <AppText tone="muted" variant="meta">
            ·
          </AppText>
          <Button
            onPress={() => openLegal("privacy")}
            size="small"
            textStyle={styles.linkText}
            title="개인정보처리방침"
            variant="ghost"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

// ---------------------------------------------------------------------------
// 화면
// ---------------------------------------------------------------------------

export default function MyScreen() {
  const { currentUser } = useRaota()
  return currentUser ? <MemberView /> : <GuestView />
}

function MemberView() {
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const focused = useIsFocused()
  const { currentUser: user, actions } = useRaota()
  const { data: recordCount } = useBowlCount()
  const { data: bowls } = useMyBowls()
  const { data: visits } = useVisitedShops()
  const { data: streak } = useLongestStreak()
  const { data: level } = useActivityLevel()
  const { data: taste } = useTasteProfile()
  const { data: identity } = useTasteIdentity()
  const { data: monthly } = useMonthlyReports()
  const { data: myLogs } = useMyLogs()
  const { data: saved } = useBookmarkedShops()
  const { data: shops } = useShops()

  const [tab, setTab] = useState<ActivityTab>("logs")
  const [recentLimit, setRecentLimit] = useState(RECENT_PAGE_SIZE * 2)
  const [period, setPeriod] = useState("1y")
  const [visitSort, setVisitSort] = useState<VisitSort>("count")
  const [visitQuery, setVisitQuery] = useState("")
  const [savedQuery, setSavedQuery] = useState("")
  const [sheet, setSheet] = useState<"grade" | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const calendarRef = useRef<ScrollView>(null)

  const shopByName = (name: string) => shops.find((shop) => shop.name === name)
  const monthKey = seoulMonthKey()
  const monthCount = bowls.filter((bowl) => monthKeyOfDate(bowl.date) === monthKey).length
  const today = seoulToday()

  const years = useMemo(() => [...new Set(bowls.map((bowl) => bowl.date.slice(0, 4)))].sort().reverse(), [bowls])
  const periodOptions = [{ value: "1y", label: "최근 1년" }, ...years.map((year) => ({ value: year, label: `${year}년` }))]
  const periodLabel = periodOptions.find((option) => option.value === period)?.label ?? "최근 1년"
  const calendar = useMemo(() => {
    if (period === "1y") return buildCalendar(bowls, addDays(today, -364), today)
    const end = `${period}-12-31` < today ? `${period}-12-31` : today
    return buildCalendar(bowls, `${period}-01-01`, end)
  }, [bowls, period, today])

  const hasMoreRecent = recentLimit < bowls.length
  // TODO(API): 서버 목록 조회(커서 페이지)로 바꾸면 여기서 다음 페이지를 요청한다
  const loadMoreRecent = () => {
    if (hasMoreRecent) setRecentLimit((limit) => limit + RECENT_PAGE_SIZE)
  }
  const onRecentScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!hasMoreRecent) return
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent
    // 상자 끝에서 두 줄 거리 안으로 들어오면 다음 5개를 붙인다
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - RECENT_ROW_HEIGHT * 2) loadMoreRecent()
  }

  const recentLogs = bowls.slice(0, recentLimit).map((bowl) => {
    const shop = shopByName(bowl.shop)
    const log = myLogs.find((item) => item.shop.name === bowl.shop && item.menuName === bowl.menu)
    return { ...bowl, shop, name: bowl.shop, photo: log?.imageUrl ?? shop?.photos[0] }
  })

  const filteredVisits = useMemo(() => {
    const query = visitQuery.trim().toLowerCase()
    const list = query
      ? visits.filter((visit) =>
          [visit.name, visit.branch ?? "", visit.style, visit.topMenu].some((text) => text.toLowerCase().includes(query)),
        )
      : [...visits]
    if (visitSort === "recent") list.sort((a, b) => b.lastVisited.localeCompare(a.lastVisited))
    else if (visitSort === "name") list.sort((a, b) => a.name.localeCompare(b.name, "ko"))
    else list.sort((a, b) => b.visitCount - a.visitCount || b.lastVisited.localeCompare(a.lastVisited))
    return list
  }, [visitQuery, visitSort, visits])

  const filteredSaved = useMemo(() => {
    const query = savedQuery.trim().toLowerCase()
    if (!query) return saved
    return saved.filter((shop) =>
      [shop.name, shop.branch ?? "", shopStyleOf(shop) ?? "", shop.address, ...shop.tags].some((text) =>
        text.toLowerCase().includes(query),
      ),
    )
  }, [saved, savedQuery])

  if (!user) return null

  const selectTab = (next: ActivityTab) => {
    if (next !== tab) haptic()
    setTab(next)
  }

  const unsave = (shop: Shop) => {
    haptic()
    actions.toggleBookmark(shop.id)
    setToast(`'${shop.name}' 저장을 해제했어요`)
  }

  const stats = [
    { label: "총 라멘로그", value: recordCount, unit: "그릇" },
    { label: "방문 매장", value: visits.length, unit: "곳" },
    { label: "이번 달", value: monthCount, unit: "그릇" },
  ]
  const tabs: { id: ActivityTab; label: string; count: number }[] = [
    { id: "logs", label: "라멘로그", count: recordCount },
    { id: "visits", label: "방문매장", count: visits.length },
    { id: "saved", label: "가고싶어요", count: saved.length },
  ]

  return (
    <View style={styles.root}>
      {focused ? <StatusBar style="light" /> : null}
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* 위로 당겨도 흰 면 대신 차콜이 이어지게 한다 */}
        <View pointerEvents="none" style={styles.overscrollCap} />

        {/* 차콜 프로필 헤더 */}
        <View style={[styles.profile, { paddingTop: insets.top + spacing.x4 }]}>
          <View style={styles.profileTop}>
            <View style={styles.avatar}>
              {user.avatar ? (
                <Image contentFit="cover" source={{ uri: user.avatar }} style={styles.fill} />
              ) : (
                <Image contentFit="contain" source={require("@/assets/images/logo.png")} style={styles.avatarLogo} />
              )}
            </View>
            <View style={styles.flex}>
              <AppText accessibilityRole="header" numberOfLines={1} tone="onDark" variant="screenTitle">
                {user.nickname}
              </AppText>
              <AppText tone="onDarkMuted" variant="secondary">
                라오타 라멘클럽 회원{user.membershipNo ? ` · ${user.membershipNo}` : ""}
              </AppText>
            </View>
            <Pressable
              accessibilityHint="계정, 약관, 로그아웃"
              accessibilityLabel="설정"
              accessibilityRole="button"
              hitSlop={4}
              onPress={() => router.push("/settings")}
              style={({ pressed }) => [styles.settingsButton, pressed && styles.pressedDim]}
            >
              <Settings color={colors.onDark} size={22} />
            </Pressable>
          </View>

          <View style={styles.stats}>
            <View style={[styles.hairlineOnDark, styles.statsRule]} />
            {stats.map((stat, index) => (
              <View
                accessibilityLabel={`${stat.label} ${stat.value}${stat.unit}`}
                accessible
                key={stat.label}
                style={styles.stat}
              >
                {index > 0 ? <View style={[styles.hairlineOnDark, styles.statDivider]} /> : null}
                <AppText capScale tone="onDarkMuted" variant="meta">
                  {stat.label}
                </AppText>
                <AppText style={styles.tabular} tone="onDark" variant="screenTitle">
                  {stat.value}
                  <AppText style={styles.bold} tone="onDarkMuted" variant="secondary">
                    {stat.unit}
                  </AppText>
                </AppText>
              </View>
            ))}
          </View>

          <Pressable
            accessibilityHint="등급 안내를 열어요"
            accessibilityLabel={`Lv.${level.number} ${level.title}, ${level.nextLevel ? `다음 등급까지 ${level.nextLevel.min - recordCount}그릇` : "최고 등급"}`}
            accessibilityRole="button"
            onPress={() => setSheet("grade")}
            style={({ pressed }) => [styles.gradeRow, pressed && styles.pressedDim]}
          >
            <View style={styles.rowGap}>
              <Award color={colors.onDark} size={16} />
              <AppText capScale tone="onDark" variant="bodyStrong">
                Lv.{level.number} {level.title}
              </AppText>
            </View>
            <View style={styles.rowGap}>
              <AppText capScale tone="onDarkMuted" variant="secondary">
                {level.nextLevel ? `다음 등급까지 ${level.nextLevel.min - recordCount}그릇` : "최고 등급"}
              </AppText>
              <ChevronRight color={colors.onDarkMuted} size={16} />
            </View>
          </Pressable>
          <View style={styles.levelTrack}>
            <View style={[styles.hairlineOnDark, StyleSheet.absoluteFill]} />
            <View style={[styles.levelFill, { width: `${level.progress}%` }]} />
          </View>
        </View>

        <View style={styles.main}>
          <TasteReportCover
            identity={identity}
            onAnalyze={() => router.push({ pathname: "/taste", params: { analyze: "1" } })}
            onOpen={() => router.push("/taste")}
            onStart={() => router.push({ pathname: "/record/select-shop", params: { mode: "nearby" } })}
            profile={taste.profile}
            recordCount={recordCount}
          />
          <MonthlyTastePreview current={monthly.current} onOpen={() => router.push("/taste/archive")} past={monthly.past} />

          {/* 활동 탭: iOS 세그먼트 */}
          <View accessibilityLabel="내 활동" accessibilityRole="tablist" style={styles.segment}>
            {tabs.map((item) => {
              const active = tab === item.id
              return (
                <Pressable
                  accessibilityLabel={`${item.label} ${item.count}`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  key={item.id}
                  onPress={() => selectTab(item.id)}
                  style={[styles.segmentItem, active && styles.segmentActive]}
                >
                  <AppText capScale numberOfLines={1} style={styles.bold} tone={active ? "ink" : "sub"} variant="secondary">
                    {item.label}{" "}
                    <AppText capScale style={styles.tabular} tone="muted" variant="secondary">
                      {item.count}
                    </AppText>
                  </AppText>
                </Pressable>
              )
            })}
          </View>

          {tab === "logs" ? (
            <>
              <View style={styles.card}>
                <AppText accessibilityRole="header" variant="sectionTitle">
                  라멘로그 캘린더
                </AppText>
                <ScrollView contentContainerStyle={styles.chipRow} horizontal showsHorizontalScrollIndicator={false}>
                  {periodOptions.map((option) => {
                    const active = option.value === period
                    return (
                      <Pressable
                        accessibilityLabel={`캘린더 기간 ${option.label}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        key={option.value}
                        onPress={() => setPeriod(option.value)}
                        style={[styles.periodChip, active && styles.periodChipActive]}
                      >
                        <AppText capScale style={styles.bold} tone={active ? "onDark" : "ink"} variant="secondary">
                          {option.label}
                        </AppText>
                      </Pressable>
                    )
                  })}
                </ScrollView>
                <View
                  accessibilityLabel={`${periodLabel} ${calendar.total}그릇 기록${streak > 1 ? `, 최장 ${streak}일 연속` : ""}`}
                  accessibilityRole="image"
                  accessible
                  style={styles.calendar}
                >
                  <View style={styles.weekdays}>
                    {["", "월", "", "수", "", "금", ""].map((label, index) => (
                      <AppText capScale key={index} style={styles.weekdayLabel} tone="muted" variant="meta">
                        {label}
                      </AppText>
                    ))}
                  </View>
                  <ScrollView
                    horizontal
                    onContentSizeChange={() => calendarRef.current?.scrollToEnd({ animated: false })}
                    ref={calendarRef}
                    showsHorizontalScrollIndicator={false}
                    style={styles.flex}
                  >
                    <View>
                      <View style={styles.monthRow}>
                        {calendar.monthLabels.map((item) => (
                          <AppText
                            capScale
                            key={`${item.week}-${item.label}`}
                            style={[styles.monthLabel, { left: item.week * (CELL + CELL_GAP) }]}
                            tone="muted"
                            variant="meta"
                          >
                            {item.label}
                          </AppText>
                        ))}
                      </View>
                      <View style={styles.weeks}>
                        {calendar.weeks.map((week, index) => (
                          <View key={index} style={styles.week}>
                            {week.map((day) => (
                              <View
                                key={day.date}
                                style={[
                                  styles.cell,
                                  !day.inRange
                                    ? styles.cellOut
                                    : day.count > 0
                                      ? { backgroundColor: colors.brand, opacity: LEVEL_OPACITY[Math.min(4, day.count) - 1] }
                                      : null,
                                ]}
                              />
                            ))}
                          </View>
                        ))}
                      </View>
                    </View>
                  </ScrollView>
                </View>
                <View style={styles.calendarFoot}>
                  <AppText tone="sub" variant="secondary">
                    <AppText style={styles.heavy} variant="secondary">
                      {periodLabel} {calendar.total}그릇
                    </AppText>
                    {streak > 1 ? ` · 최장 ${streak}일 연속` : ""}
                  </AppText>
                  <View accessibilityLabel="색이 진할수록 그날 기록이 많아요" accessible style={[styles.rowGap, styles.legend]}>
                    <AppText capScale tone="sub" variant="meta">
                      적음
                    </AppText>
                    <View style={[styles.swatch, styles.cellEmpty]} />
                    {LEVEL_OPACITY.map((opacity) => (
                      <View key={opacity} style={[styles.swatch, { backgroundColor: colors.brand, opacity }]} />
                    ))}
                    <AppText capScale tone="sub" variant="meta">
                      많음
                    </AppText>
                  </View>
                </View>
                {calendar.total === 0 ? (
                  <AppText style={styles.gapTop2} tone="sub" variant="secondary">
                    이 기간에는 기록이 없어요. 라멘로그를 남기면 캘린더가 채워져요.
                  </AppText>
                ) : null}
              </View>

              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <AppText accessibilityRole="header" variant="sectionTitle">
                    최근 기록
                  </AppText>
                  {bowls.length > 0 ? (
                    <AppText capScale style={styles.tabular} tone="muted" variant="meta">
                      총 {bowls.length}그릇
                    </AppText>
                  ) : null}
                </View>
                {recentLogs.length ? (
                  <ScrollView
                    accessibilityLabel="최근 기록 목록"
                    nestedScrollEnabled
                    onScroll={onRecentScroll}
                    scrollEventThrottle={100}
                    showsVerticalScrollIndicator
                    style={styles.recentBox}
                  >
                  {recentLogs.map((log, index) => (
                    <Pressable
                      accessibilityLabel={`${log.name}${log.shop?.branch ? ` ${log.shop.branch}` : ""}, ${log.menu}, ${log.type}, ${shortDate(log.date)}`}
                      accessibilityRole={log.shop ? "button" : "text"}
                      disabled={!log.shop}
                      key={`${log.date}-${log.name}-${log.menu}-${index}`}
                      onPress={() => openShop(log.shop)}
                      style={({ pressed }) => [styles.listRow, index > 0 && styles.rowDivider, pressed && styles.pressedWash]}
                    >
                      <Thumb letter={log.name} uri={log.photo} />
                      <View style={styles.flex}>
                        <AppText numberOfLines={1} variant="cardTitle">
                          {log.name}
                          {log.shop?.branch ? <AppText tone="sub" variant="secondary">{` ${log.shop.branch}`}</AppText> : null}
                        </AppText>
                        <AppText numberOfLines={1} tone="sub" variant="secondary">
                          {log.menu} · {log.type}
                        </AppText>
                      </View>
                      <AppText capScale style={styles.tabular} tone="sub" variant="meta">
                        {shortDate(log.date)}
                      </AppText>
                    </Pressable>
                  ))}
                {hasMoreRecent ? (
                  // 스크롤로 불러오지만, VoiceOver·스위치 제어 사용자를 위해 눌러서도 더 불러온다
                  <Pressable
                    accessibilityLabel={`기록 더 보기, ${bowls.length - recentLogs.length}그릇 남음`}
                    accessibilityRole="button"
                    onPress={loadMoreRecent}
                    style={({ pressed }) => [styles.loadMore, pressed && styles.pressedWash]}
                  >
                    <ActivityIndicator color={colors.textMuted} size="small" />
                    <AppText tone="muted" variant="secondary">
                      이전 기록 불러오는 중
                    </AppText>
                  </Pressable>
                ) : null}
                  </ScrollView>
                ) : (
                  <EmptyState
                    actionLabel="첫 그릇 기록하기"
                    description="첫 그릇을 남기면 여기에 쌓여요."
                    onAction={() => router.push({ pathname: "/record/select-shop", params: { mode: "nearby" } })}
                    title="아직 기록이 없어요"
                  />
                )}
              </View>
            </>
          ) : null}

          {tab === "visits" ? (
            <View style={styles.card}>
              <AppText accessibilityRole="header" variant="sectionTitle">
                방문한 라멘집 <AppText tone="sub" variant="sectionTitle">{visits.length}곳</AppText>
              </AppText>
              <AppText style={styles.gapTop1} tone="sub" variant="secondary">
                라멘로그를 남긴 매장이에요. 방문 수를 더하면 총 {recordCount}그릇이에요.
              </AppText>
              {visits.length > 0 ? (
                <>
                  <View accessibilityLabel="정렬" accessibilityRole="radiogroup" style={[styles.segment, styles.gapTop3]}>
                    {(
                      [
                        { key: "count", label: "방문순" },
                        { key: "recent", label: "최신순" },
                        { key: "name", label: "이름순" },
                      ] as const
                    ).map((option) => {
                      const active = visitSort === option.key
                      return (
                        <Pressable
                          accessibilityLabel={option.label}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: active }}
                          key={option.key}
                          onPress={() => setVisitSort(option.key)}
                          style={[styles.segmentItem, active && styles.segmentActive]}
                        >
                          <AppText capScale style={styles.bold} tone={active ? "ink" : "sub"} variant="secondary">
                            {option.label}
                          </AppText>
                        </Pressable>
                      )
                    })}
                  </View>
                  <SearchField label="방문한 라멘집 검색" onChange={setVisitQuery} placeholder="매장, 지점, 메뉴 검색" value={visitQuery} />
                </>
              ) : null}
              {filteredVisits.length === 0 ? (
                <EmptyState
                  description={visits.length ? "다른 이름이나 메뉴로 찾아보세요." : "라멘로그를 남기면 매장별 방문 수가 쌓여요."}
                  icon={<MapPin color={colors.textMuted} size={24} />}
                  title={visits.length ? "검색 결과가 없어요" : "아직 방문한 라멘집이 없어요"}
                />
              ) : (
                <View style={styles.gapTop2}>
                  {filteredVisits.map((visit, index) => {
                    const shop = shopByName(visit.name)
                    return (
                      <Pressable
                        accessibilityLabel={`${visit.name}${visit.branch ? ` ${visit.branch}` : ""}, ${visit.visitCount}그릇, 마지막 방문 ${shortDate(visit.lastVisited)}${visit.visitCount >= 3 ? ", 단골" : ""}`}
                        accessibilityRole={shop ? "button" : "text"}
                        disabled={!shop}
                        key={visit.name}
                        onPress={() => openShop(shop)}
                        style={({ pressed }) => [styles.listRow, index > 0 && styles.rowDivider, pressed && styles.pressedWash]}
                      >
                        <Thumb letter={visit.name} size={52} uri={visit.photo} />
                        <View style={styles.flex}>
                          <View style={styles.rowGap}>
                            <AppText numberOfLines={1} style={styles.shrink} variant="cardTitle">
                              {visit.name}
                              {visit.branch ? <AppText tone="sub" variant="secondary">{` ${visit.branch}`}</AppText> : null}
                            </AppText>
                            {visit.visitCount >= 3 ? (
                              <View style={styles.softTag}>
                                <AppText capScale variant="meta">
                                  단골
                                </AppText>
                              </View>
                            ) : null}
                          </View>
                          <AppText numberOfLines={1} tone="sub" variant="secondary">
                            {visit.style} · {visit.topMenu}
                          </AppText>
                        </View>
                        <View style={styles.alignEnd}>
                          <AppText style={[styles.tabular, styles.heavy]} variant="cardTitle">
                            {visit.visitCount}그릇
                          </AppText>
                          <AppText capScale style={styles.tabular} tone="sub" variant="meta">
                            {shortDate(visit.lastVisited)}
                          </AppText>
                        </View>
                      </Pressable>
                    )
                  })}
                </View>
              )}
            </View>
          ) : null}

          {tab === "saved" ? (
            <View style={styles.card}>
              <AppText accessibilityRole="header" variant="sectionTitle">
                가고 싶은 라멘집 <AppText tone="sub" variant="sectionTitle">{saved.length}곳</AppText>
              </AppText>
              <AppText style={styles.gapTop1} tone="sub" variant="secondary">
                매장 상세에서 저장한 곳이에요.
              </AppText>
              {saved.length > 0 ? (
                <SearchField label="저장한 라멘집 검색" onChange={setSavedQuery} placeholder="매장, 지점, 스타일 검색" value={savedQuery} />
              ) : null}
              {filteredSaved.length === 0 ? (
                <EmptyState
                  description={saved.length ? "다른 이름이나 스타일로 찾아보세요." : "매장 상세에서 저장하면 여기에 모여요."}
                  icon={<Bookmark color={colors.textMuted} size={24} />}
                  title={saved.length ? "검색 결과가 없어요" : "아직 저장한 라멘집이 없어요"}
                />
              ) : (
                <View style={styles.gapTop2}>
                  {filteredSaved.map((shop, index) => {
                    const meta = [shopStyleOf(shop), shopSpecOf(shop)].filter(Boolean).join(" · ")
                    return (
                      <View key={shop.id} style={[styles.savedRow, index > 0 && styles.rowDivider]}>
                        <Pressable
                          accessibilityLabel={`${shop.name}${shop.branch ? ` ${shop.branch}` : ""}${meta ? `, ${meta}` : ""}`}
                          accessibilityRole="button"
                          onPress={() => openShop(shop)}
                          style={({ pressed }) => [styles.listRow, styles.flex, pressed && styles.pressedWash]}
                        >
                          <Thumb letter={shop.name} size={52} uri={shop.photos[0]} />
                          <View style={styles.flex}>
                            <AppText numberOfLines={1} variant="cardTitle">
                              {shop.name}
                              {shop.branch ? <AppText tone="sub" variant="secondary">{` ${shop.branch}`}</AppText> : null}
                            </AppText>
                            {meta ? (
                              <AppText numberOfLines={1} tone="sub" variant="secondary">
                                {meta}
                              </AppText>
                            ) : null}
                            {shop.tags.length > 0 ? (
                              <AppText capScale numberOfLines={1} tone="sub" variant="meta">
                                {shop.tags.slice(0, 3).map((tag) => `#${tag}`).join(" ")}
                              </AppText>
                            ) : null}
                          </View>
                        </Pressable>
                        <Pressable
                          accessibilityLabel={`${shop.name} 저장 해제`}
                          accessibilityRole="button"
                          onPress={() => unsave(shop)}
                          style={({ pressed }) => [styles.iconButton, pressed && styles.pressedWash]}
                        >
                          <Bookmark color={colors.brand} fill={colors.brand} size={18} />
                        </Pressable>
                      </View>
                    )
                  })}
                </View>
              )}
            </View>
          ) : null}

        </View>
      </ScrollView>

      <RecordFab />
      <Toast message={toast ?? ""} onDismiss={() => setToast(null)} style={styles.toast} visible={Boolean(toast)} />

      <BottomSheet
        footer={<Button onPress={() => setSheet(null)} title="확인" variant="secondary" />}
        onClose={() => setSheet(null)}
        title="라멘 활동 등급"
        visible={sheet === "grade"}
      >
        <AppText tone="sub" variant="body">
          라멘로그 수를 기준으로 등급이 올라가요. 지금은 {recordCount}그릇,{" "}
          <AppText variant="bodyStrong">
            Lv.{level.number} {level.title}
          </AppText>
          예요.
        </AppText>
        {/* 시트는 스크롤하지 않으므로 작은 화면(568pt)에서도 확인 버튼이 보이게 목록만 스크롤한다 */}
        <ScrollView style={[styles.levelList, { maxHeight: windowHeight * 0.42 }]}>
          {RAMEN_ACTIVITY_LEVELS.map((item, index) => {
            const current = item.title === level.title
            return (
              <View
                accessibilityLabel={`Lv.${index + 1} ${item.title}, ${item.desc}${current ? ", 내 등급" : ""}`}
                accessible
                key={item.title}
                style={[styles.levelRow, index > 0 && styles.rowDivider, current && styles.levelCurrent]}
              >
                <View style={styles.flex}>
                  <AppText tone={current ? "brand" : "ink"} variant="cardTitle">
                    Lv.{index + 1} {item.title}
                  </AppText>
                  <AppText tone="sub" variant="secondary">
                    {item.desc}
                  </AppText>
                </View>
                {current ? (
                  <AppText capScale tone="brand" variant="meta">
                    내 등급
                  </AppText>
                ) : null}
              </View>
            )
          })}
        </ScrollView>
      </BottomSheet>

    </View>
  )
}

// ---------------------------------------------------------------------------
// 작은 부품
// ---------------------------------------------------------------------------

function Thumb({ uri, letter, size = 48 }: { uri?: string | null; letter: string; size?: number }) {
  return (
    <View style={[styles.thumb, { width: size, height: size }]}>
      {uri ? (
        <Image contentFit="cover" source={{ uri }} style={styles.fill} transition={150} />
      ) : (
        <AppText tone="sub" variant="cardTitle">
          {letter.slice(0, 1)}
        </AppText>
      )}
    </View>
  )
}

function SearchField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <View style={styles.search}>
      <Search color={colors.textMuted} size={16} />
      <TextInput
        accessibilityLabel={label}
        autoCorrect={false}
        clearButtonMode="while-editing"
        maxFontSizeMultiplier={maxFontScale}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        returnKeyType="search"
        style={styles.searchInput}
        value={value}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  fill: { width: "100%", height: "100%" },
  center: { textAlign: "center" },
  bold: { fontWeight: "700" },
  heavy: { fontWeight: "800", color: colors.ink },
  tabular: { fontVariant: ["tabular-nums"] },
  alignEnd: { alignItems: "flex-end" },
  rowGap: { flexDirection: "row", alignItems: "center", gap: spacing.x1_5 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.x3 },
  gapTop1: { marginTop: spacing.x1 },
  gapTop2: { marginTop: spacing.x2 },
  gapTop3: { marginTop: spacing.x3 },
  gapTop5: { marginTop: spacing.x5 },
  pressedWash: { backgroundColor: colors.canvasSoft },
  pressedDim: { opacity: 0.7 },
  linkText: { color: colors.inkSub, ...typography.secondary },
  // 비회원
  guest: { flexGrow: 1, paddingHorizontal: spacing.gutter, paddingTop: spacing.x10, paddingBottom: spacing.x4 },
  guestBody: { flex: 1, justifyContent: "center" },
  guestLogo: { width: 64, height: 64, alignSelf: "center" },
  guestActions: { marginTop: spacing.x7, gap: spacing.x2_5 },
  policyLinks: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: spacing.x8 },
  // 차콜 프로필
  // 목록 끝이 오른쪽 아래 기록 버튼에 가리지 않을 만큼 비운다(계정·약관은 설정 화면으로 옮겼다)
  scroll: { paddingBottom: 96 },
  overscrollCap: { position: "absolute", top: -1000, left: 0, right: 0, height: 1000, backgroundColor: colors.ink },
  profile: { backgroundColor: colors.ink, paddingHorizontal: spacing.gutter, paddingBottom: spacing.x4 },
  profileTop: { flexDirection: "row", alignItems: "center", gap: spacing.x3 },
  settingsButton: { width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center", marginRight: -spacing.x2 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radii.sm,
    backgroundColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarLogo: { width: 40, height: 40 },
  hairlineOnDark: { backgroundColor: colors.onDark, opacity: 0.15 },
  stats: { flexDirection: "row", marginTop: spacing.x4, paddingTop: spacing.x4 },
  statsRule: { position: "absolute", top: 0, left: 0, right: 0, height: 1 },
  stat: { flex: 1, alignItems: "center" },
  statDivider: { position: "absolute", left: 0, top: 0, bottom: 0, width: 1 },
  gradeRow: {
    minHeight: 44,
    marginTop: spacing.x3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: spacing.x2,
  },
  levelTrack: { height: 4, marginTop: spacing.x1, borderRadius: radii.pill, overflow: "hidden" },
  levelFill: { height: "100%", borderRadius: radii.pill, backgroundColor: colors.onDark },
  // 본문
  main: { paddingHorizontal: spacing.gutter, paddingTop: spacing.x4, gap: spacing.x4 },
  card: {
    backgroundColor: colors.canvas,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: spacing.x4,
  },
  segment: { flexDirection: "row", padding: 2, borderRadius: radii.sm, backgroundColor: colors.canvasSoft },
  segmentItem: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: radii.sm, paddingHorizontal: spacing.x1 },
  segmentActive: { backgroundColor: colors.canvas },
  chipRow: { gap: spacing.x2, paddingTop: spacing.x3 },
  periodChip: {
    minHeight: 44,
    paddingHorizontal: spacing.x4,
    borderRadius: radii.pill,
    borderColor: colors.border,
    borderWidth: 1,
    justifyContent: "center",
  },
  periodChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  calendar: { flexDirection: "row", marginTop: spacing.x3, gap: spacing.x1 },
  weekdays: { paddingTop: 17 + spacing.x1, gap: CELL_GAP },
  weekdayLabel: { height: CELL, lineHeight: CELL, fontSize: 12 },
  monthRow: { height: 17, marginBottom: spacing.x1 },
  monthLabel: { position: "absolute", top: 0 },
  weeks: { flexDirection: "row", gap: CELL_GAP },
  week: { gap: CELL_GAP },
  cell: { width: CELL, height: CELL, borderRadius: radii.xs, backgroundColor: colors.canvasSoft },
  cellOut: { backgroundColor: colors.transparent },
  cellEmpty: { backgroundColor: colors.canvasSoft },
  swatch: { width: 10, height: 10, borderRadius: radii.xs },
  legend: { alignSelf: "flex-end" },
  calendarFoot: {
    gap: spacing.x2,
    marginTop: spacing.x2,
    paddingTop: spacing.x3,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  listRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x3,
    paddingVertical: spacing.x3,
  },
  rowDivider: { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
  thumb: { borderRadius: radii.sm, backgroundColor: colors.canvasSoft, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  softTag: { backgroundColor: colors.canvasSoft, borderRadius: radii.xs, paddingHorizontal: spacing.x1_5, paddingVertical: spacing.x0_5 },
  search: {
    minHeight: 44,
    marginTop: spacing.x2,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x2,
    paddingHorizontal: spacing.x3,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.sm,
  },
  searchInput: { flex: 1, minHeight: 44, color: colors.ink, ...typography.body },
  savedRow: { flexDirection: "row", alignItems: "center", gap: spacing.x1 },
  iconButton: { width: 44, height: 44, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
  // 계정
  // 예전 카드 크기(5줄)만큼만 보이고 그 안에서 스크롤한다
  recentBox: { maxHeight: RECENT_ROW_HEIGHT * RECENT_VISIBLE_ROWS + spacing.x1 },
  loadMore: {
    minHeight: touchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.x2,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  toast: { bottom: 88 },
  // 시트
  levelList: { marginTop: spacing.x4, borderColor: colors.border, borderTopWidth: 1, borderBottomWidth: 1 },
  levelRow: { flexDirection: "row", alignItems: "center", gap: spacing.x3, paddingHorizontal: spacing.x1, paddingVertical: spacing.x3 },
  levelCurrent: { backgroundColor: colors.brandWeak },
})
