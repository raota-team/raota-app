import { useLocale } from "@/src/i18n"
import { formatDate, getIntlLocale, getLocale, t } from "@raota/shared"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Redirect, router, useIsFocused } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { Image } from "expo-image"
import * as Haptics from "expo-haptics"
import * as ImagePicker from "expo-image-picker"
import { ArrowRight, Bookmark, ChartColumnStacked, ChevronRight, MapPin, Pencil, Search, Settings, Ticket } from "lucide-react-native"
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import {
  MENU_CATEGORY_NAMES,
  RAMEN_ACTIVITY_LEVELS,
  getRamenActivityLevel,
  seoulToday,
  typeCountsOf,
  type DemoBowl,
  type Shop,
  type ShopVisit,
  type TasteIdentity,
  type RamenLog,
} from "@raota/shared"
import { bowlTypeOf, bowlTypes, needsMoreLogs, toBowlRow } from "@/src/domain/myBowls"
import { ResilientUriImage } from "@/src/components/ResilientUriImage"
import { AppText, BottomSheet, Button, Chip, EmptyState, LoadingState, Tag, Toast } from "@/src/components/ui"
import {
  useBookmarkedShops,
  useLongestStreak,
  useMyBowls,
  useMyLogs,
  useAllShops,
  useTasteIdentity,
  useMonthlyReports,
  useVisitedShops,
} from "@/src/data"
import { useRaota } from "@/src/state/RaotaStore"
import { isRemote } from "@/src/api"
import { sizedImageUri } from "@/src/api/imageSize"
import { TASTE_REPORT_ENABLED } from "@/src/features"
import { colors, line, maxFontScale, radii, ramenHeat, spacing, touchTarget, typography } from "@/src/theme"
import { shopSpecOf, shopStyleOf } from "../(flows)/taste/index"
import Svg, { Path } from "react-native-svg"

/* 마이: 프로필 → 그릇 감정서 → 종류별 사진 보드 → 캘린더 → 최근 기록. */

type ActivityTab = "logs" | "visits" | "saved"
type VisitSort = "count" | "recent" | "name"

/** 방문매장·가고싶어요는 10줄, 최근 기록은 5줄 높이 틀을 보여주고, 안쪽 스크롤 끝에서 5줄씩 이어 붙인다. */
const ACTIVITY_PAGE_SIZE = 5
const VISIBLE_ROWS = 10
const RECENT_VISIBLE_ROWS = 5
/** 썸네일 48pt + 위아래 12pt. */
const ACTIVITY_ROW_HEIGHT = 72
const BIO_MAX = 60
const LEVEL_LABELS = ["1그릇", "2그릇", "3그릇", "4그릇 이상"]
const CELL = 11
const CELL_GAP = 3

const shortDate = (iso: string) => getLocale() === "ko" ? iso.slice(5).replace("-", ".") : formatDate(iso, { month: "short", day: "numeric" })
const haptic = () => void Haptics.selectionAsync().catch(() => undefined)

function openShop(shop: Shop | undefined) {
  if (shop) router.push({ pathname: "/shop/[shopId]", params: { shopId: shop.id } })
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
  const days = new Map<string, number>()
  for (const bowl of bowls) days.set(bowl.date, (days.get(bowl.date) ?? 0) + 1)
  const weeks: CalendarDay[][] = []
  const monthLabels: { week: number; label: string }[] = []
  let total = 0
  const levelDays = LEVEL_LABELS.map(() => 0)
  for (let day = addDays(start, -weekdayOf(start)); day <= end; day = addDays(day, 1)) {
    if (weekdayOf(day) === 0) weeks.push([])
    const inRange = day >= start
    const count = inRange ? days.get(day) ?? 0 : 0
    total += count
    if (count > 0) levelDays[Math.min(4, count) - 1]++
    weeks[weeks.length - 1].push({ date: day, count, inRange })
    if (inRange && (day === start || day.endsWith("-01"))) {
      const week = weeks.length - 1
      if (!monthLabels.some((item) => item.week >= week - 2)) monthLabels.push({ week, label: getLocale() === "ko" ? `${Number(day.slice(5, 7))}월` : formatDate(new Date(`${day}T12:00:00Z`), { month: "short", timeZone: "UTC" }) })
    }
  }
  return { weeks, monthLabels, total, levelDays }
}

// ---------------------------------------------------------------------------
// 화면
// ---------------------------------------------------------------------------

/** 비회원에게는 마이 화면이 없다. 탭을 누르면 로그인을 띄우고(app/native/_layout.tsx), 그래도 이 화면에 오면(로그인에서 뒤로 등) 홈으로 보낸다 */
export default function MyScreen() {
  useLocale()
  const { currentUser } = useRaota()
  return currentUser ? <MemberView /> : <Redirect href="/native" />
}

function MemberView() {
  useLocale()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const focused = useIsFocused()
  const { currentUser: user, actions } = useRaota()
  const bowlsQuery = useMyBowls()
  const bowls = bowlsQuery.data
  // 한 화면의 숫자는 하나의 원천에서 센다. 프로필 카운터(visitedCount)는 캘린더·최근 기록·리포트가 쓰는
  // 그릇 목록과 어긋날 수 있어(42 대 43), 머리글·탭·등급까지 모두 그릇 목록 길이로 맞춘다
  const recordCount = bowls.length
  const { data: visits } = useVisitedShops()
  const { data: streak } = useLongestStreak()
  const level = getRamenActivityLevel(recordCount)
  const { data: identity } = useTasteIdentity()
  const myLogsQuery = useMyLogs()
  const myLogs = myLogsQuery.data
  const bookmarks = useBookmarkedShops()
  const saved = bookmarks.data
  const { data: shops } = useAllShops()

  const [tab, setTab] = useState<ActivityTab>("logs")
  const [recentLimit, setRecentLimit] = useState(RECENT_VISIBLE_ROWS)
  const [visitLimit, setVisitLimit] = useState(VISIBLE_ROWS)
  const [savedLimit, setSavedLimit] = useState(VISIBLE_ROWS)
  const [period, setPeriod] = useState("1y")
  const [visitSort, setVisitSort] = useState<VisitSort>("count")
  const [visitQuery, setVisitQuery] = useState("")
  const [savedQuery, setSavedQuery] = useState("")
  const [sheet, setSheet] = useState<"grade" | "profile" | null>(null)
  const [draftAvatar, setDraftAvatar] = useState<string | null>(null)
  const [draftBio, setDraftBio] = useState("")
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const mainScrollRef = useRef<ScrollView>(null)
  const calendarRef = useRef<ScrollView>(null)
  const [compactHeader, setCompactHeader] = useState(false)
  const [profileHeight, setProfileHeight] = useState(0)
  const shopByName = (name: string) => shops.find((shop) => shop.name === name)
  const today = seoulToday()

  const years = useMemo(() => [...new Set(bowls.map((bowl) => bowl.date.slice(0, 4)))].sort().reverse(), [bowls, getLocale()])
  const periodOptions = [{ value: "1y", label: t("최근 1년") }, ...years.map((year) => ({ value: year, label: t("{year}년", { year }) }))]
  const periodLabel = periodOptions.find((option) => option.value === period)?.label ?? t("최근 1년")
  const calendar = useMemo(() => {
    if (period === "1y") return buildCalendar(bowls, addDays(today, -364), today)
    const end = `${period}-12-31` < today ? `${period}-12-31` : today
    return buildCalendar(bowls, `${period}-01-01`, end)
  }, [bowls, period, today, getLocale()])
  // 월 라벨은 그 달이 시작하는 주에 붙박아 둔다. 스크롤에 따라 라벨을 옮기면 왔다 갔다 할 때 달이 밀려 보인다
  const monthLabels = calendar.monthLabels
  // 기록이 있는 단계만 읽어 준다("1그릇 8일, 2그릇 3일")
  const levelSummary = calendar.levelDays
    .map((days, index) => (days > 0 ? t("{label} {days}일", { label: t(LEVEL_LABELS[index]), days }) : null))
    .filter(Boolean)
    .join(", ")

  const loadMoreRecent = () => {
    if (recentLimit < bowls.length) setRecentLimit((limit) => Math.min(limit + ACTIVITY_PAGE_SIZE, bowls.length))
  }
  const onMyScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Swap the tabs when they reach the overlay's tab slot, not when they reach the top edge.
    const compact = profileHeight > 0 && nativeEvent.contentOffset.y >= Math.max(0, profileHeight - insets.top - touchTarget)
    if (compact !== compactHeader) setCompactHeader(compact)
  }

  const recentLogs = bowls.slice(0, recentLimit).map((bowl) => toBowlRow(bowl, myLogs, shops))
  // 보이는 서버 기록의 사진이 아직 안 읽은 쪽에 있으면 내 기록 다음 쪽을 읽는다
  const recentNeedsLogs = needsMoreLogs(recentLogs, myLogs)
  const { hasMore: myLogsHasMore, loadMore: loadMoreMyLogs } = myLogsQuery
  useEffect(() => {
    if (recentNeedsLogs && myLogsHasMore) loadMoreMyLogs()
  }, [loadMoreMyLogs, myLogs.length, myLogsHasMore, recentNeedsLogs])
  const retryAccount = () => {
    void actions.refreshAccount().catch(() => undefined)
  }

  const filteredVisits = useMemo(() => {
    const query = visitQuery.trim().toLowerCase()
    const list = query
      ? visits.filter((visit) =>
          [visit.name, visit.branch ?? "", visit.style, visit.topMenu].some((text) => text.toLowerCase().includes(query)),
        )
      : [...visits]
    if (visitSort === "recent") list.sort((a, b) => b.lastVisited.localeCompare(a.lastVisited))
    else if (visitSort === "name") list.sort((a, b) => a.name.localeCompare(b.name, getIntlLocale()))
    else list.sort((a, b) => b.visitCount - a.visitCount || b.lastVisited.localeCompare(a.lastVisited))
    return list
  }, [visitQuery, visitSort, visits, getLocale()])

  const filteredSaved = useMemo(() => {
    const query = savedQuery.trim().toLowerCase()
    if (!query) return saved
    return saved.filter((shop) =>
      [shop.name, shop.branch ?? "", shopStyleOf(shop) ?? "", shop.address, ...shop.tags].some((text) =>
        text.toLowerCase().includes(query),
      ),
    )
  }, [saved, savedQuery, getLocale()])
  const visibleVisits = filteredVisits.slice(0, visitLimit)
  const visibleSaved = filteredSaved.slice(0, savedLimit)

  if (!user) return null

  const selectTab = (next: ActivityTab) => {
    if (next === tab) return
    haptic()
    // Reveal the start of the new tab without dropping the compact navigation.
    if (compactHeader) mainScrollRef.current?.scrollTo({ y: Math.max(0, profileHeight - insets.top - touchTarget), animated: false })
    setTab(next)
  }

  const unsave = async (shop: Shop) => {
    haptic()
    try {
      await actions.toggleBookmark(shop)
      setToast(t("'{p0}' 저장을 해제했어요", { p0: shop.name }))
    } catch (error) {
      setToast(error instanceof Error ? error.message : t("찜을 해제하지 못했어요. 다시 시도해 주세요."))
    }
  }
  const openProfileEditor = () => {
    setDraftAvatar(user.avatar)
    setDraftBio(user.bio ?? "")
    setProfileError(null)
    setSheet("profile")
  }

  const pickAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        Alert.alert(
          t("사진 접근 권한이 필요해요"),
          t("설정에서 사진 접근을 허용하거나, 사진 없이도 프로필을 편집할 수 있어요."),
          [
            { text: t("사진 없이 계속"), style: "cancel" },
            { text: t("설정 열기"), onPress: () => void Linking.openSettings() },
          ],
        )
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.82,
      })
      if (!result.canceled && result.assets[0]?.uri) setDraftAvatar(result.assets[0].uri)
    } catch {
      setProfileError(t("사진을 불러오지 못했어요. 다시 시도해 주세요."))
    }
  }

  const saveProfile = async () => {
    if (savingProfile) return
    setSavingProfile(true)
    setProfileError(null)
    try {
      await actions.updateProfile({ avatar: draftAvatar, bio: draftBio.trim() })
      setSheet(null)
    } catch {
      setProfileError(t("프로필을 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요."))
    } finally {
      setSavingProfile(false)
    }
  }


  const stats = [
    { label: "총 라멘로그", value: recordCount, unit: "그릇" },
    { label: "방문 매장", value: visits.length, unit: "곳" },
  ]
  const tabs: { id: ActivityTab; label: string; count: number }[] = [
    { id: "logs", label: "라멘로그", count: recordCount },
    { id: "visits", label: "방문매장", count: visits.length },
    { id: "saved", label: "가고싶어요", count: saved.length },
  ]

  const tabBar = (
    <View accessibilityLabel={t("내 활동")} accessibilityRole="tablist" style={styles.segment}>
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
            <AppText capScale numberOfLines={1} style={styles.segmentLabel} tone={active ? "ink" : "muted"} variant="bodyStrong">
              {t(item.label)}
            </AppText>
          </Pressable>
        )
      })}
    </View>
  )

  return (
    <View style={styles.root}>
      {focused ? <StatusBar style="auto" /> : null}
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        onScroll={onMyScroll}
        ref={mainScrollRef}
        scrollEventThrottle={32}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        testID="my-main-scroll"
      >
        <View
          accessibilityElementsHidden={compactHeader}
          importantForAccessibility={compactHeader ? "no-hide-descendants" : "auto"}
          onLayout={({ nativeEvent }) => setProfileHeight(nativeEvent.layout.height)}
          style={[styles.profile, { paddingTop: insets.top + spacing.x2 }]}
          testID="my-profile"
        >
          <View style={styles.profileTop}>
            <Pressable
              accessibilityHint={t("계정, 약관, 로그아웃")}
              accessibilityLabel={t("설정")}
              accessibilityRole="button"
              onPress={() => router.push("/settings")}
              style={({ pressed }) => [styles.settingsButton, pressed && styles.pressedWash]}
            >
              <Settings color={colors.ink} size={22} />
            </Pressable>
          </View>
          <View style={styles.avatarAnchor}>
            <ProfileAvatar size={96} uri={user.avatar} />
            <Pressable
              accessibilityLabel={t("프로필 사진과 상태 메시지 바꾸기")}
              accessibilityRole="button"
              onPress={openProfileEditor}
              style={styles.avatarBadgeHit}
            >
              {/* 설정 톱니와 헷갈리지 않게 프로필 편집은 연필로 둔다 */}
              <View style={styles.avatarBadge}>
                <Pencil color={colors.ink} size={16} />
              </View>
            </Pressable>
          </View>
          <AppText accessibilityRole="header" lineBreakStrategyIOS="hangul-word" numberOfLines={2} style={styles.profileName} variant="headline">
            {user.nickname}
          </AppText>
          <View style={styles.bioSlot}>
            {user.bio?.trim() ? (
              <AppText numberOfLines={3} style={styles.profileMeta} tone="muted" variant="secondary">
                {user.bio}
              </AppText>
            ) : (
              <Pressable
                accessibilityLabel={t("상태 메시지를 남겨 보세요")}
                accessibilityRole="button"
                onPress={openProfileEditor}
                style={styles.profileEmptyBio}
              >
                <AppText tone="muted" variant="secondary">{t("상태 메시지를 남겨 보세요")}</AppText>
              </Pressable>
            )}
          </View>
          {/* 서버에서 그릇 목록을 못 읽었으면 0그릇으로 보이지 않게 다시 불러오기를 둔다 */}
          {bowlsQuery.error ? (
            <Pressable
              accessibilityLabel={t("기록을 불러오지 못했어요. 다시 불러오기")}
              accessibilityRole="button"
              onPress={retryAccount}
              style={({ pressed }) => [styles.levelProgress, pressed && styles.gradePressed]}
            >
              <View style={styles.levelCaption}>
                <AppText tone="muted" variant="meta">{t("기록을 불러오지 못했어요 · 다시 불러오기")}</AppText>
                <ChevronRight color={colors.textMuted} size={14} />
              </View>
            </Pressable>
          ) : (
          <>
          <View style={styles.stats}>
            {stats.map((stat, index) => (
              <View accessibilityLabel={`${t(stat.label)} ${stat.value}${t(stat.unit)}`} accessible key={stat.label} style={styles.stat}>
                <AppText style={[styles.statValue, index === 0 && styles.tabular]} variant="secondary">{stat.value}</AppText>
                <AppText variant="secondary">{t(stat.unit)}</AppText>
                {index === 0 ? <AppText tone="muted" variant="secondary"> · </AppText> : null}
              </View>
            ))}
            <AppText tone="muted" variant="secondary"> · </AppText>
            <Pressable
              accessibilityHint={t("라멘로그 수에 따른 활동 등급을 설명해요")}
              accessibilityLabel={t("등급 안내, Lv.{p0} {p1}", { p0: level.number, p1: t(level.title) })}
              accessibilityRole="button"
              onPress={() => setSheet("grade")}
              style={({ pressed }) => [styles.gradeLevel, pressed && styles.gradePressed]}
            >
              <AppText style={styles.statValue} variant="secondary">Lv.{level.number} {t(level.title)}</AppText>
            </Pressable>
          </View>
          <Pressable
            accessibilityLabel={level.nextTarget ? t("다음 등급까지 {p0}그릇", { p0: Math.max(0, level.nextTarget - recordCount) }) : t("최고 등급이에요")}
            accessibilityRole="button"
            onPress={() => setSheet("grade")}
            style={({ pressed }) => [styles.levelProgress, pressed && styles.gradePressed]}
          >
            <View style={styles.levelTrack}>
              <View style={[styles.levelFill, { width: `${level.progress}%` as `${number}%` }]} />
            </View>
            <View style={styles.levelCaption}>
              <AppText tone="muted" variant="meta">
                {level.nextTarget ? t("다음 등급까지 {p0}그릇", { p0: Math.max(0, level.nextTarget - recordCount) }) : t("최고 등급이에요")}
              </AppText>
              <ChevronRight color={colors.textMuted} size={14} />
            </View>
          </Pressable>
          </>
          )}
        </View>

        <View
          accessibilityElementsHidden={compactHeader}
          importantForAccessibility={compactHeader ? "no-hide-descendants" : "auto"}
          style={styles.stickyTabs}
          testID="my-sticky-tabs"
        >
          {tabBar}
        </View>

        <View style={[styles.main, { minHeight: Math.max(0, windowHeight - insets.top - touchTarget * 2 - spacing.x8) }]}>
          {tab === "logs" ? (
            <>
              {/* 취향 리포트를 숨긴 빌드에서는 리포트로 들어가는 두 입구를 뺀다. 빈 계정의 첫 기록 안내는 아래 빈 상태가 맡는다 */}
              {TASTE_REPORT_ENABLED ? (
                <>
                  <MyTasteTicket
                    bowls={bowls}
                    identity={identity}
                    onOpen={() => router.push("/taste")}
                    onStart={() => router.push({ pathname: "/record/select-shop", params: { mode: "nearby" } })}
                    recordCount={recordCount}
                    visits={visits}
                  />
                  <MonthlyTasteEntry onOpen={() => router.push("/taste/archive")} />
                </>
              ) : null}
              <TasteBoards bowls={bowls} myLogs={myLogs} shops={shops} />
              {/* AI 식권은 서버 추천을 쓰는 로그인 회원만 있다. 오늘 식권은 홈에서, 다른 날 식권은 여기서 본다 */}
              {isRemote("recommendations") && user?.isLoggedIn ? <PastTicketsEntry onOpen={() => router.push("/tickets")} /> : null}
              <View style={styles.infoSection}>
                <View style={styles.rowBetween}>
                  <AppText accessibilityRole="header" style={styles.calendarHeading} variant="sectionTitle">{t("라멘로그 캘린더")}</AppText>
                  <ScrollView contentContainerStyle={styles.chipRow} horizontal showsHorizontalScrollIndicator={false} style={styles.periodScroll}>
                    {periodOptions.map((option) => (
                      <Chip
                        accessibilityLabel={t("캘린더 기간 {p0}", { p0: option.label })}
                        key={option.value}
                        label={t(option.label)}
                        onPress={() => setPeriod(option.value)}
                        selected={option.value === period}
                      />
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.calendarCard}>
                  {/* 기록 없는 기간 안내는 빈 칸 위에 얹는다. 아래에 자리를 따로 비워 두지 않아 최근 기록이 바로 붙는다 */}
                  {calendar.total === 0 ? (
                    <View pointerEvents="none" style={styles.calendarEmpty}>
                      <AppText lineBreakStrategyIOS="hangul-word" style={styles.center} tone="sub" variant="secondary">
                        {t("이 기간에는 기록이 없어요.")}{"\n"}{t("라멘로그를 남기면 캘린더가 채워져요.")}</AppText>
                    </View>
                  ) : null}
                  <View
                    accessibilityLabel={t("{p0} {p1}그릇 기록{p2}{p3}", { p0: periodLabel, p1: calendar.total, p2: streak > 1 ? t(", 최장 {days}일 연속", { days: streak }) : "", p3: levelSummary ? `, ${levelSummary}` : "" })}
                    accessibilityRole="image"
                    accessible
                    style={styles.calendar}
                  >
                    <View style={styles.weekdays}>
                      {["", t("월"), "", t("수"), "", t("금"), ""].map((label, index) => (
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
                          {monthLabels.map((item) => (
                            <AppText
                              capScale
                              key={`${item.week}-${item.label}`}
                              style={[styles.monthLabel, { left: item.week * (CELL + CELL_GAP) }]}
                              tone="muted"
                              variant="meta"
                            >
                              {t(item.label)}
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
                                        ? { backgroundColor: ramenHeat[Math.min(4, day.count) - 1] }
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
                  {/* 잔디처럼 하루에 먹은 그릇 수만큼 진해진다. 범례는 적음 → 많음 한 줄 */}
                  <View accessibilityLabel={t("범례. 하루 {p0} 순으로 빨강이 진해져요", { p0: LEVEL_LABELS.map((label) => t(label)).join(", ") })} accessible style={styles.legend}>
                    <AppText capScale tone="sub" variant="meta">{t("적음")}</AppText>
                    <View style={[styles.legendDot, styles.legendEmpty]} />
                    {ramenHeat.map((color, index) => (
                      <View key={LEVEL_LABELS[index]} style={[styles.legendDot, { backgroundColor: color }]} />
                    ))}
                    <AppText capScale tone="sub" variant="meta">{t("많음")}</AppText>
                  </View>
                </View>
                <AppText lineBreakStrategyIOS="hangul-word" tone="sub" variant="meta">
                  <AppText style={styles.heavy} variant="meta">
                    {periodLabel} {calendar.total}{t("그릇")}</AppText>
                  {streak > 1 ? t(" · 최장 {p0}일 연속", { p0: streak }) : ""}
                </AppText>
              </View>

              <View style={styles.infoSection}>
                <View style={styles.rowBetween}>
                  <AppText accessibilityRole="header" variant="sectionTitle">
                    {t("최근 기록")}</AppText>
                  {bowls.length > 0 ? (
                    <AppText capScale style={styles.tabular} tone="muted" variant="meta">
                      {t("총")} {bowls.length}{t("그릇")}</AppText>
                  ) : null}
                </View>
                {recentLogs.length ? (
                  <ActivityListFrame
                    label={t("최근 기록 목록")}
                    loadedCount={recentLogs.length}
                    moreLabel={t("기록 더 보기")}
                    moreText={t("이전 기록 더 보기")}
                    onLoadMore={loadMoreRecent}
                    remainingUnit={t("그릇")}
                    testID="my-logs-list"
                    totalCount={bowls.length}
                    visibleRows={RECENT_VISIBLE_ROWS}
                  >
                    {recentLogs.map((log, index) => (
                      <Pressable
                        accessibilityLabel={`${log.name}${log.branch ? ` ${log.branch}` : ""}, ${log.menu}, ${log.type}, ${shortDate(log.date)}`}
                        accessibilityRole={log.logId || log.shop ? "button" : "text"}
                        disabled={!log.logId && !log.shop}
                        key={log.logId ?? `${log.date}-${log.name}-${log.menu}-${index}`}
                        onPress={() => {
                          // 서버 기록은 그 기록 상세로, 기기 기록은 매장으로 연다
                          if (log.logId) router.push({ pathname: "/log/[logId]", params: { logId: log.logId } })
                          else openShop(log.shop)
                        }}
                        style={({ pressed }) => [styles.listRow, index > 0 && styles.rowDivider, pressed && styles.pressedWash]}
                      >
                        <Thumb letter={log.name} uri={log.photo} />
                        <View style={styles.flex}>
                          <AppText lineBreakStrategyIOS="hangul-word" numberOfLines={2} variant="cardTitle">
                            {log.name}
                            {log.branch ? <AppText tone="sub" variant="secondary">{` ${log.branch}`}</AppText> : null}
                          </AppText>
                          <View style={styles.rowGap}>
                            {log.type ? (
                              <AppText capScale tone="muted" variant="secondary">{log.type} ·</AppText>
                            ) : null}
                            <AppText lineBreakStrategyIOS="hangul-word" numberOfLines={2} style={styles.shrink} tone="sub" variant="secondary">
                              {log.menu}
                            </AppText>
                          </View>
                        </View>
                        <AppText capScale style={styles.tabular} tone="sub" variant="meta">
                          {shortDate(log.date)}
                        </AppText>
                      </Pressable>
                    ))}
                  </ActivityListFrame>
                ) : bowlsQuery.isLoading ? (
                  <LoadingState label={t("기록을 불러오는 중…")} />
                ) : bowlsQuery.error ? (
                  <EmptyState
                    actionLabel={t("다시 불러오기")}
                    description={t("잠시 후 다시 시도해 주세요.")}
                    onAction={retryAccount}
                    title={t("기록을 불러오지 못했어요")}
                  />
                ) : (
                  <EmptyState
                    actionLabel={t("첫 그릇 기록하기")}
                    description={t("첫 그릇을 남기면 여기에 쌓여요.")}
                    onAction={() => router.push({ pathname: "/record/select-shop", params: { mode: "nearby" } })}
                    title={t("아직 기록이 없어요")}
                  />
                )}
              </View>
            </>
          ) : null}

          {tab === "visits" ? (
            <View style={styles.infoSection}>
              <AppText accessibilityRole="header" variant="sectionTitle">
                {t("방문한 라멘집")}<AppText tone="sub" variant="sectionTitle">{visits.length}{t("곳")}</AppText>
              </AppText>
              <AppText lineBreakStrategyIOS="hangul-word" tone="sub" variant="secondary">
                {t("라멘로그를 남긴 매장이에요. 방문 수를 더하면 총")} {recordCount}{t("그릇이에요.")}</AppText>
              {visits.length > 0 ? (
                <>
                  <View accessibilityLabel={t("정렬")} accessibilityRole="radiogroup" style={styles.segment}>
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
                          accessibilityLabel={t(option.label)}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: active }}
                          key={option.key}
                          onPress={() => setVisitSort(option.key)}
                          style={[styles.segmentItem, active && styles.segmentActive]}
                        >
                          <AppText capScale style={styles.bold} tone={active ? "ink" : "muted"} variant="secondary">
                            {t(option.label)}
                          </AppText>
                        </Pressable>
                      )
                    })}
                  </View>
                  <SearchField label={t("방문한 라멘집 검색")} onChange={(query) => { setVisitQuery(query); setVisitLimit(VISIBLE_ROWS) }} placeholder={t("매장, 지점, 메뉴 검색")} value={visitQuery} />
                </>
              ) : null}
              {filteredVisits.length === 0 ? (
                <EmptyState
                  description={visits.length ? t("다른 이름이나 메뉴로 찾아보세요.") : t("라멘로그를 남기면 매장별 방문 수가 쌓여요.")}
                  icon={<MapPin color={colors.textMuted} size={24} />}
                  title={visits.length ? t("검색 결과가 없어요") : t("아직 방문한 라멘집이 없어요")}
                />
              ) : (
                <View>
                  <ActivityListFrame
                    label={t("방문 매장 목록")}
                    loadedCount={visibleVisits.length}
                    moreLabel={t("방문매장 더 보기")}
                    moreText={t("방문 매장 더 보기")}
                    onLoadMore={() => setVisitLimit((limit) => Math.min(limit + ACTIVITY_PAGE_SIZE, filteredVisits.length))}
                    remainingUnit={t("곳")}
                    testID="my-visits-list"
                    totalCount={filteredVisits.length}
                  >
                  {visibleVisits.map((visit, index) => {
                    const shop = shopByName(visit.name)
                    return (
                      <Pressable
                        accessibilityLabel={t("{p0}{p1}, {p2}그릇, 마지막 방문 {p3}{p4}", { p0: visit.name, p1: visit.branch ? ` ${visit.branch}` : "", p2: visit.visitCount, p3: shortDate(visit.lastVisited), p4: visit.visitCount >= 3 ? `, ${t("단골")}` : "" })}
                        accessibilityRole={shop ? "button" : "text"}
                        disabled={!shop}
                        key={visit.name}
                        onPress={() => openShop(shop)}
                        style={({ pressed }) => [styles.listRow, index > 0 && styles.rowDivider, pressed && styles.pressedWash]}
                      >
                        {/* 방문 원장의 사진은 로컬 데모 매장에만 있다. 서버 기록은 지금 매장 목록의 같은 매장 사진을 쓴다 */}
                        <Thumb letter={visit.name} size={48} uri={visit.photo ?? shop?.photos[0]} />
                        <View style={styles.flex}>
                          <View style={styles.rowGap}>
                            <AppText lineBreakStrategyIOS="hangul-word" numberOfLines={2} style={styles.shrink} variant="cardTitle">
                              {visit.name}
                              {visit.branch ? <AppText tone="sub" variant="secondary">{` ${visit.branch}`}</AppText> : null}
                            </AppText>
                            {visit.visitCount >= 3 ? <Tag label={t("단골")} /> : null}
                          </View>
                          <View style={styles.rowGap}>
                            <AppText capScale tone="muted" variant="secondary">{visit.style} ·</AppText>
                            <AppText lineBreakStrategyIOS="hangul-word" numberOfLines={2} style={styles.shrink} tone="sub" variant="secondary">
                              {visit.topMenu}
                            </AppText>
                          </View>
                        </View>
                        <View style={styles.alignEnd}>
                          <AppText style={[styles.tabular, styles.heavy]} variant="cardTitle">
                            {visit.visitCount}{t("그릇")}</AppText>
                          <AppText capScale style={styles.tabular} tone="sub" variant="meta">
                            {shortDate(visit.lastVisited)}
                          </AppText>
                        </View>
                      </Pressable>
                    )
                  })}
                  </ActivityListFrame>
                </View>
              )}
            </View>
          ) : null}

          {tab === "saved" ? (
            <View style={styles.infoSection}>
              <AppText accessibilityRole="header" variant="sectionTitle">
                {t("가고 싶은 라멘집")}{bookmarks.isLoading || bookmarks.error ? null : <AppText tone="sub" variant="sectionTitle"> {saved.length}{t("곳")}</AppText>}
              </AppText>
              <AppText lineBreakStrategyIOS="hangul-word" tone="sub" variant="secondary">
                {t("매장 상세에서 저장한 곳이에요.")}</AppText>
              {saved.length > 0 ? (
                <SearchField label={t("저장한 라멘집 검색")} onChange={(query) => { setSavedQuery(query); setSavedLimit(VISIBLE_ROWS) }} placeholder={t("매장, 지점, 스타일 검색")} value={savedQuery} />
              ) : null}
              {saved.length === 0 && bookmarks.isLoading ? (
                <LoadingState label={t("저장한 라멘집을 불러오는 중…")} />
              ) : saved.length === 0 && bookmarks.error ? (
                <EmptyState
                  actionLabel={t("다시 불러오기")}
                  description={t("잠시 후 다시 시도해 주세요.")}
                  icon={<Bookmark color={colors.textMuted} size={24} />}
                  onAction={retryAccount}
                  title={t("저장한 라멘집을 불러오지 못했어요")}
                />
              ) : filteredSaved.length === 0 ? (
                <EmptyState
                  description={saved.length ? t("다른 이름이나 스타일로 찾아보세요.") : t("매장 상세에서 저장하면 여기에 모여요.")}
                  icon={<Bookmark color={colors.textMuted} size={24} />}
                  title={saved.length ? t("검색 결과가 없어요") : t("아직 저장한 라멘집이 없어요")}
                />
              ) : (
                <View>
                  <ActivityListFrame
                    label={t("저장한 매장 목록")}
                    loadedCount={visibleSaved.length}
                    moreLabel={t("저장한 매장 더 보기")}
                    moreText={t("저장한 매장 더 보기")}
                    onLoadMore={() => setSavedLimit((limit) => Math.min(limit + ACTIVITY_PAGE_SIZE, filteredSaved.length))}
                    remainingUnit={t("곳")}
                    testID="my-saved-list"
                    totalCount={filteredSaved.length}
                  >
                  {visibleSaved.map((shop, index) => {
                    const meta = [shopStyleOf(shop), shopSpecOf(shop)].filter(Boolean).join(" · ")
                    return (
                      <View key={shop.id} style={[styles.savedRow, index > 0 && styles.rowDivider]}>
                        <Pressable
                          accessibilityLabel={`${shop.name}${shop.branch ? ` ${shop.branch}` : ""}${meta ? `, ${meta}` : ""}`}
                          accessibilityRole="button"
                          onPress={() => openShop(shop)}
                          style={({ pressed }) => [styles.listRow, styles.flex, pressed && styles.pressedWash]}
                        >
                          <Thumb letter={shop.name} size={48} uri={shop.photos[0]} />
                          <View style={styles.flex}>
                            <AppText lineBreakStrategyIOS="hangul-word" numberOfLines={2} variant="cardTitle">
                              {shop.name}
                              {shop.branch ? <AppText tone="sub" variant="secondary">{` ${shop.branch}`}</AppText> : null}
                            </AppText>
                            {meta ? (
                              <AppText lineBreakStrategyIOS="hangul-word" numberOfLines={2} tone="sub" variant="secondary">
                                {meta}
                              </AppText>
                            ) : null}
                            {shop.tags.length > 0 ? (
                              <AppText capScale lineBreakStrategyIOS="hangul-word" numberOfLines={2} tone="sub" variant="meta">
                                {shop.tags.slice(0, 3).map((tag) => `#${tag}`).join(" ")}
                              </AppText>
                            ) : null}
                          </View>
                        </Pressable>
                        <Pressable
                          accessibilityLabel={t("{p0} 저장 해제", { p0: shop.name })}
                          accessibilityRole="button"
                          onPress={() => unsave(shop)}
                          style={({ pressed }) => [styles.iconButton, pressed && styles.pressedWash]}
                        >
                          <Bookmark color={colors.ink} fill={colors.ink} size={18} />
                        </Pressable>
                      </View>
                    )
                  })}
                  </ActivityListFrame>
                </View>
              )}
            </View>
          ) : null}

        </View>
      </ScrollView>

      {compactHeader ? (
        <View style={[styles.compactOverlay, { paddingTop: insets.top }]} testID="my-compact-overlay">
          <View style={[styles.compactNav, styles.compactNavPadded]}>
            <AppText accessibilityRole="header" variant="sectionTitle">{user.nickname}</AppText>
            <Pressable
              accessibilityLabel={t("설정")}
              accessibilityRole="button"
              onPress={() => router.push("/settings")}
              style={styles.settingsButton}
            >
              <Settings color={colors.ink} size={22} />
            </Pressable>
          </View>
          <View style={styles.stickyTabs}>{tabBar}</View>
        </View>
      ) : null}

      <Toast message={toast ?? ""} onDismiss={() => setToast(null)} style={styles.toast} visible={Boolean(toast)} />

      <BottomSheet
        dismissOnBackdropPress={!savingProfile}
        footer={<Button fullWidth loading={savingProfile} onPress={() => void saveProfile()} title={t("저장")} />}
        onClose={() => { if (!savingProfile) setSheet(null) }}
        title={t("프로필 편집")}
        visible={sheet === "profile"}
      >
        <View style={styles.profileEditor}>
          <View style={styles.editorPhoto}>
            <ProfileAvatar size={80} uri={draftAvatar} />
            <View style={styles.editorPhotoActions}>
              <Button
                accessibilityLabel={t("프로필 사진 변경")}
                disabled={savingProfile}
                onPress={() => void pickAvatar()}
                size="small"
                title={t("사진 변경")}
                variant="secondary"
              />
              <View accessibilityElementsHidden={!draftAvatar} importantForAccessibility={!draftAvatar ? "no-hide-descendants" : "auto"} style={!draftAvatar && styles.invisible}>
                <Button
                  accessibilityLabel={t("프로필 사진 삭제")}
                  disabled={!draftAvatar || savingProfile}
                  onPress={() => setDraftAvatar(null)}
                  size="small"
                  title={t("사진 삭제")}
                  variant="ghost"
                />
              </View>
            </View>
          </View>
          <View>
            <View style={styles.editorFieldHead}>
              <AppText variant="bodyStrong">{t("상태 메시지")}</AppText>
              <AppText capScale style={styles.tabular} tone="muted" variant="meta">{draftBio.length}/{BIO_MAX}</AppText>
            </View>
            <TextInput
              accessibilityLabel={t("상태 메시지")}
              editable={!savingProfile}
              maxLength={BIO_MAX}
              onChangeText={setDraftBio}
              placeholder={t("라멘에 진심인 편입니다.")}
              placeholderTextColor={colors.textMuted}
              style={styles.editorInput}
              value={draftBio}
            />
            <AppText accessibilityElementsHidden={!profileError} accessibilityLiveRegion="polite" style={[styles.editorError, !profileError && styles.invisible]} tone="critical" variant="secondary">{profileError ?? " "}</AppText>
          </View>
        </View>
      </BottomSheet>

      <BottomSheet
        footer={<Button onPress={() => setSheet(null)} title={t("확인")} variant="secondary" />}
        onClose={() => setSheet(null)}
        title={t("라멘 활동 등급")}
        visible={sheet === "grade"}
      >
        <AppText lineBreakStrategyIOS="hangul-word" tone="sub" variant="body">
          {t("라멘로그 수를 기준으로 등급이 올라가요. 지금은 {count}그릇, Lv.{level} {title}예요.", { count: recordCount, level: level.number, title: t(level.title) })}</AppText>
        {/* 시트는 스크롤하지 않으므로 작은 화면(568pt)에서도 확인 버튼이 보이게 목록만 스크롤한다 */}
        <ScrollView style={[styles.levelList, { maxHeight: windowHeight * 0.42 }]}>
          {RAMEN_ACTIVITY_LEVELS.map((item, index) => {
            const current = index + 1 === level.number
            const description = item.min === 0 ? t(item.desc) : t("라멘로그 {count}그릇 이상", { count: item.min })
            return (
              <View
                accessibilityLabel={`Lv.${index + 1} ${t(item.title)}, ${description}${current ? `, ${t("내 등급")}` : ""}`}
                accessible
                key={item.title}
                style={[styles.levelRow, index > 0 && styles.rowDivider, current && styles.levelCurrent]}
              >
                <View style={styles.flex}>
                  <AppText variant="cardTitle">
                    Lv.{index + 1} {t(item.title)}
                  </AppText>
                  <AppText lineBreakStrategyIOS="hangul-word" tone="sub" variant="secondary">
                    {description}
                  </AppText>
                </View>
                <AppText accessibilityElementsHidden={!current} capScale style={!current && styles.invisible} variant="meta">
                  {t("내 등급")}</AppText>
              </View>
            )
          })}
        </ScrollView>
      </BottomSheet>

    </View>
  )
}

function ProfileAvatar({ uri, size }: { uri: string | null; size: number }) {
  useLocale()
  return (
    <ResilientUriImage
      accessibilityLabel={t("프로필 사진")}
      fallback={
        <Svg height={size / 2} viewBox="0 0 24 24" width={size / 2}>
          <Path d="M3 11h18a9 9 0 0 1-18 0zM8 20h8M9 7c0-1.5 1-2 1-3.5M13 7c0-1.5 1-2 1-3.5" fill="none" stroke={colors.ink} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} />
        </Svg>
      }
      style={[styles.avatar, { width: size, height: size }]}
      uri={uri}
    />
  )
}

/**
 * 리포트 이야기 카드의 첫 장(검은 카드)을 겹친 카드 묶음으로 엿보이게 하고, 누르면 그 이야기로 들어간다
 * (사용자 결정, 2026.10.20 · 방안 B). 국물 색 점은 바로 아래 종류별 사진 보드와 겹쳐서 뺐다.
 */
function MyTasteTicket({
  bowls,
  identity,
  recordCount,
  visits,
  onOpen,
  onStart,
}: {
  bowls: DemoBowl[]
  identity: TasteIdentity
  recordCount: number
  visits: ShopVisit[]
  onOpen: () => void
  onStart: () => void
}) {
  useLocale()
  if (!recordCount) {
    return (
      <View style={styles.reportTicket} testID="my-report-ticket">
        <AppText accessibilityRole="header" style={styles.ticketTitle} variant="sectionTitle">{t(identity.title)}</AppText>
        <AppText lineBreakStrategyIOS="hangul-word" tone="sub" variant="secondary">{t(identity.description)}</AppText>
        <Button fullWidth onPress={onStart} rightIcon={<ArrowRight color={colors.ink} size={16} />} title={t("첫 그릇 기록하기")} variant="secondary" />
      </View>
    )
  }
  const groups = typeCountsOf(bowls)
  // 리포트 이야기 장 수와 맞춘다: 그릇 수 · 취향은 늘 있고, 국물 장과 단골집 장은 데이터가 있을 때만
  const pages = 2 + (MENU_CATEGORY_NAMES.some((type) => groups[type] > 0) ? 1 : 0) + (visits.length ? 1 : 0)
  return (
    <Pressable
      accessibilityLabel={t("종합 리포트 보기. {p0}, {p1}그릇을 기록했어요, {p2}곳을 다녔어요. {p3}장 이야기", { p0: t(identity.title), p1: recordCount, p2: visits.length, p3: pages })}
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [styles.deckWrap, pressed && styles.deckPressed]}
      testID="my-report-ticket"
    >
      <View style={styles.deck}>
        <View style={[styles.deckCard, styles.deckBack2]} />
        <View style={[styles.deckCard, styles.deckBack1]} />
        <View style={[styles.deckCard, styles.deckFront]}>
          <AppText capScale style={styles.deckDim} tone="onDark" variant="secondary">{t(identity.title)} {t("· 지금까지")}</AppText>
          <AppText lineBreakStrategyIOS="hangul-word" style={[styles.deckBig, styles.tabular]} tone="onDark" variant="headline">{recordCount}{t("그릇을 기록했어요")}</AppText>
          <AppText capScale style={styles.deckDim} tone="onDark" variant="secondary">{visits.length}{t("곳을 다녔어요")}</AppText>
        </View>
      </View>
      <View style={styles.deckFoot}>
        <AppText capScale tone="muted" variant="meta">{pages}{t("장 이야기")}</AppText>
        <View style={styles.deckMore}>
          <AppText capScale style={styles.deckMoreText} variant="meta">{t("넘겨 보기")}</AppText>
          <ArrowRight color={colors.ink} size={14} />
        </View>
      </View>
    </Pressable>
  )
}

/** 월별 취향 변화를 캘린더 아래 작은 글씨 링크로 두면 찾지 못해서, 감정서 바로 아래 한 줄 카드로 연다. */
function MonthlyTasteEntry({ onOpen }: { onOpen: () => void }) {
  useLocale()
  const { data: monthly } = useMonthlyReports()
  const months = monthly.past.length + (monthly.current ? 1 : 0)
  if (!months) return null
  const summary = monthly.current ? t("이번 달 {count}그릇 집계 중 · {months}개월 비교", { count: monthly.current.recordCount, months }) : t("{months}개월 비교", { months })
  return (
    <Pressable
      accessibilityHint={t("달마다 어떤 라멘을 먹었는지 비교해요")}
      accessibilityLabel={t("월별 취향 변화, {p0}", { p0: summary })}
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [styles.monthlyCard, pressed && styles.pressedWash]}
      testID="my-monthly-entry"
    >
      <View style={styles.monthlyIcon}>
        <ChartColumnStacked color={colors.ink} size={20} strokeWidth={2.1} />
      </View>
      <View style={styles.flex}>
        <AppText variant="cardTitle">{t("월별 취향 변화")}</AppText>
        <AppText capScale lineBreakStrategyIOS="hangul-word" numberOfLines={2} tone="muted" variant="secondary">{summary}</AppText>
      </View>
      <ChevronRight color={colors.textMuted} size={20} />
    </Pressable>
  )
}

/** 다른 날 뽑은 AI 식권을 찾을 곳. 오늘 식권은 홈 카드 아래 줄에서 연다 */
function PastTicketsEntry({ onOpen }: { onOpen: () => void }) {
  useLocale()
  return (
    <Pressable
      accessibilityHint={t("지금까지 뽑은 AI 식권을 날짜별로 다시 봐요")}
      accessibilityLabel={t("지난 식권")}
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [styles.monthlyCard, pressed && styles.pressedWash]}
      testID="my-tickets-entry"
    >
      <View style={styles.monthlyIcon}>
        <Ticket color={colors.ink} size={20} strokeWidth={2.1} />
      </View>
      <View style={styles.flex}>
        <AppText variant="cardTitle">{t("지난 식권")}</AppText>
        <AppText capScale lineBreakStrategyIOS="hangul-word" numberOfLines={2} tone="muted" variant="secondary">{t("AI 큐레이터에서 뽑은 식권을 날짜별로 다시 봐요")}</AppText>
      </View>
      <ChevronRight color={colors.textMuted} size={20} />
    </Pressable>
  )
}

/**
 * 기록에 고른 실제 종류마다 사진 보드 하나. 많이 먹은 순으로 옆으로 넘겨 보고, 누르면 그 종류만 모은 화면을 연다.
 * 종류가 많아도(최대 13가지) 한 줄 높이라 마이가 길어지지 않는다. 사진은 기록 사진, 없으면 매장 사진.
 */
function TasteBoards({ bowls, myLogs, shops }: {
  bowls: DemoBowl[]
  myLogs: RamenLog[]
  shops: Shop[]
}) {
  useLocale()
  const boards = useMemo(() => bowlTypes(bowls).map(({ type, count }) => {
    const photos = [...new Set(bowls
      .filter((bowl) => bowlTypeOf(bowl) === type)
      .map((bowl) => toBowlRow(bowl, myLogs, shops).photo)
      .filter((photo): photo is string => Boolean(photo)))].slice(0, 3)
    return { type, photos, count }
  }), [bowls, myLogs, shops, getLocale()])
  if (!boards.length) return null
  return (
    <View style={styles.infoSection}>
      <View style={styles.rowBetween}>
        <AppText accessibilityRole="header" variant="sectionTitle">{t("종류별 기록")}</AppText>
        <AppText capScale style={styles.tabular} tone="muted" variant="meta">{boards.length}{t("종류")}</AppText>
      </View>
      <ScrollView contentContainerStyle={styles.boardRow} horizontal showsHorizontalScrollIndicator={false} style={styles.boardScroll}>
        {boards.map((board) => (
          <Pressable
            accessibilityHint={t("이 종류 기록만 모아 봐요")}
            accessibilityLabel={t("{p0} {p1}그릇", { p0: t(board.type), p1: board.count })}
            accessibilityRole="button"
            key={t(board.type)}
            onPress={() => router.push({ pathname: "/my-type/[type]", params: { type: board.type } })}
            style={({ pressed }) => [styles.board, pressed && styles.deckPressed]}
          >
            <View style={styles.collage}>
              {board.photos.length ? (
                <>
                  <Image contentFit="cover" source={{ uri: sizedImageUri(board.photos[0], board.photos.length > 1 ? 104 : 160) }} style={board.photos.length > 1 ? styles.collageMain : styles.fill} />
                  {board.photos.length > 1 ? (
                    <View style={styles.collageSide}>
                      {board.photos.slice(1).map((photo) => (
                        <Image contentFit="cover" key={photo} source={{ uri: sizedImageUri(photo, 52) }} style={styles.collageSmall} />
                      ))}
                    </View>
                  ) : null}
                </>
              ) : null}
            </View>
            <View style={[styles.boardLabel, styles.rowGap]}>
              <AppText numberOfLines={1} style={styles.shrink} variant="bodyStrong">{t(board.type)} {board.count}</AppText>
              <ChevronRight color={colors.textMuted} size={14} />
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
}

// ---------------------------------------------------------------------------
// 작은 부품
// ---------------------------------------------------------------------------

function Thumb({ uri, letter, size = 48 }: { uri?: string | null; letter: string; size?: number }) {
  useLocale()
  return (
    <View style={[styles.thumb, { width: size, height: size, borderRadius: radii.sm }]}>
      {uri ? (
        <Image contentFit="cover" source={{ uri: sizedImageUri(uri, size) }} style={styles.fill} transition={150} />
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
  useLocale()
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

/** 줄 수가 적으면 내용만큼만 높이고, visibleRows줄부터는 이 프레임 안에서만 더 스크롤한다. */
function ActivityListFrame({
  children,
  label,
  loadedCount,
  moreLabel,
  moreText,
  onLoadMore,
  remainingUnit,
  testID,
  totalCount,
  visibleRows = VISIBLE_ROWS,
}: {
  children: ReactNode
  label: string
  loadedCount: number
  moreLabel: string
  moreText: string
  onLoadMore: () => void
  remainingUnit: string
  testID: string
  totalCount: number
  visibleRows?: number
}) {
  useLocale()
  const hasMore = loadedCount < totalCount
  // 바닥에서 튕기는 동안 스크롤 이벤트가 여러 번 와도, 목록이 실제로 늘어나기 전에는 한 번만 더 불러온다
  const requestedAt = useRef(-1)
  const onScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = nativeEvent
    if (hasMore && requestedAt.current !== loadedCount && contentOffset.y > 0 && layoutMeasurement.height + contentOffset.y >= contentSize.height - spacing.x2) {
      requestedAt.current = loadedCount
      onLoadMore()
    }
  }

  return (
    <ScrollView
      accessibilityLabel={label}
      nestedScrollEnabled
      onScroll={onScroll}
      scrollEventThrottle={32}
      showsVerticalScrollIndicator={totalCount > visibleRows}
      style={[styles.listFrame, { maxHeight: ACTIVITY_ROW_HEIGHT * visibleRows }]}
      testID={testID}
    >
      {children}
      {hasMore ? (
        // 스크롤 외에도 VoiceOver·스위치 제어로 다음 줄을 요청할 수 있다
        <Pressable
          accessibilityLabel={t("{p0}, {p1}{p2} 남음", { p0: moreLabel, p1: totalCount - loadedCount, p2: remainingUnit })}
          accessibilityRole="button"
          onPress={onLoadMore}
          style={({ pressed }) => [styles.loadMore, pressed && styles.pressedWash]}
        >
          <AppText tone="muted" variant="secondary">{moreText}</AppText>
        </Pressable>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  fill: { width: "100%", height: "100%" },
  center: { textAlign: "center" },
  bold: { fontWeight: "700" },
  heavy: { fontWeight: "700", color: colors.ink },
  tabular: { fontVariant: ["tabular-nums"] },
  alignEnd: { alignItems: "flex-end" },
  rowGap: { flexDirection: "row", alignItems: "center", gap: spacing.x1_5 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.x3 },
  pressedWash: { backgroundColor: colors.surfacePressed },
  invisible: { opacity: 0 },
  scroll: { paddingBottom: spacing.x8 },
  profile: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.x3, alignItems: "center" },
  profileTop: { width: "100%", height: touchTarget, alignItems: "flex-end", justifyContent: "center" },
  settingsButton: { width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center", borderRadius: radii.pill },
  avatarAnchor: { marginTop: spacing.x3 },
  avatar: { borderRadius: radii.pill, backgroundColor: colors.canvasSoft, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarBadgeHit: { position: "absolute", top: -spacing.x2, right: -spacing.x2, width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center", borderRadius: radii.pill },
  avatarBadge: { width: 30, height: 30, borderRadius: radii.pill, backgroundColor: colors.canvas, borderWidth: line.base, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  profileName: { textAlign: "center", marginTop: spacing.x3 },
  bioSlot: { width: "100%", minHeight: (typography.secondary.lineHeight ?? 20) * 3, marginTop: spacing.x1, justifyContent: "center", alignItems: "center" },
  profileMeta: { textAlign: "center" },
  profileEmptyBio: { minHeight: touchTarget, justifyContent: "center" },
  stats: { flexDirection: "row", alignItems: "center", justifyContent: "center", flexWrap: "wrap", marginTop: spacing.x3 },
  stat: { flexDirection: "row", alignItems: "center" },
  statValue: { fontWeight: "700", color: colors.ink },
  gradeLevel: { minHeight: touchTarget, paddingHorizontal: spacing.x1, alignItems: "center", justifyContent: "center" },
  gradePressed: { backgroundColor: colors.surfacePressed, borderRadius: radii.sm },
  levelProgress: { minHeight: touchTarget, alignItems: "center", justifyContent: "center", gap: spacing.x2, marginTop: spacing.x1, paddingHorizontal: spacing.x4 },
  levelTrack: { width: 168, maxWidth: "100%", height: 4, borderRadius: radii.pill, backgroundColor: colors.secondary, overflow: "hidden" },
  levelFill: { height: "100%", borderRadius: radii.pill, backgroundColor: colors.ink },
  levelCaption: { flexDirection: "row", alignItems: "center", gap: spacing.x0_5 },
  stickyTabs: { backgroundColor: colors.paper, zIndex: 1, paddingHorizontal: spacing.gutter },
  compactNav: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  compactOverlay: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 2, backgroundColor: colors.paper },
  compactNavPadded: { paddingHorizontal: spacing.gutter },
  main: { paddingHorizontal: spacing.gutter, paddingTop: spacing.x4, gap: spacing.x8 },
  segment: { flexDirection: "row", justifyContent: "center", gap: spacing.x6 },
  segmentItem: { minHeight: touchTarget, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.x0_5, borderBottomWidth: 3, borderBottomColor: colors.transparent },
  segmentLabel: { fontSize: 16, lineHeight: 22 },
  segmentActive: { borderBottomColor: colors.ink },
  reportTicket: { padding: spacing.x4, borderRadius: radii.sm, backgroundColor: colors.canvasSoft, gap: spacing.x3 },
  ticketTitle: { flexShrink: 1 },
  deckWrap: { gap: spacing.x2 },
  deckPressed: { opacity: 0.8 },
  // 뒤의 두 장은 앞장 오른쪽으로 비어져 나와 "넘겨 볼 카드가 더 있다"만 말한다. 앞장이 높이를 정한다
  deck: { paddingRight: spacing.x7 },
  deckCard: { borderRadius: radii.lg },
  // 뒤로 갈수록 옅어지는 두 장. 카드에는 테두리를 두르지 않아 면 색만으로 층을 나눈다
  deckBack2: { position: "absolute", top: spacing.x4, bottom: spacing.x4, right: 0, left: "40%", backgroundColor: colors.secondary },
  deckBack1: { position: "absolute", top: spacing.x2, bottom: spacing.x2, right: spacing.x3_5, left: "30%", backgroundColor: colors.secondaryPressed },
  // 리포트 첫 장과 같은 따뜻한 숯색(deep). 순검정은 화면에서 너무 무거웠다
  deckFront: { padding: spacing.x5, gap: spacing.x1, backgroundColor: colors.deep },
  deckDim: { opacity: 0.7 },
  deckBig: { fontWeight: "700" },
  deckFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingRight: spacing.x7 },
  deckMore: { flexDirection: "row", alignItems: "center", gap: spacing.x0_5 },
  deckMoreText: { fontWeight: "700", color: colors.ink },
  // 종류 보드 줄은 화면 끝까지 흘려 옆으로 더 있다는 걸 보여 준다
  boardScroll: { marginHorizontal: -spacing.gutter },
  boardRow: { paddingHorizontal: spacing.gutter, gap: spacing.x3 },
  board: { width: 156 },
  collage: { height: 104, flexDirection: "row", gap: 2, borderRadius: radii.sm, backgroundColor: colors.canvasSoft, overflow: "hidden" },
  collageMain: { flex: 2 },
  collageSide: { flex: 1, gap: 2 },
  collageSmall: { flex: 1, width: "100%" },
  boardLabel: { paddingHorizontal: spacing.x0_5, marginTop: spacing.x2 },
  infoSection: { gap: spacing.x3 },
  calendarHeading: { flexShrink: 0 },
  periodScroll: { flexShrink: 1 },
  chipRow: { gap: spacing.x1_5 },
  calendarCard: { padding: spacing.x4, borderRadius: radii.sm, backgroundColor: colors.canvasSoft, gap: spacing.x3 },
  calendar: { flexDirection: "row", gap: spacing.x1_5 },
  weekdays: { paddingTop: 17 + spacing.x1, gap: CELL_GAP },
  weekdayLabel: { height: CELL, lineHeight: CELL, fontSize: 12 },
  monthRow: { height: 17, marginBottom: spacing.x1 },
  monthLabel: { position: "absolute", top: 0 },
  weeks: { flexDirection: "row", gap: CELL_GAP },
  week: { gap: CELL_GAP },
  cell: { width: CELL, height: CELL, borderRadius: 3, backgroundColor: colors.secondary },
  cellOut: { backgroundColor: colors.transparent },
  legend: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: CELL_GAP + 1 },
  legendDot: { width: CELL, height: CELL, borderRadius: 3 },
  legendEmpty: { backgroundColor: colors.secondary },
  // 카드 안쪽(위 월 라벨 줄부터 칸 영역까지)에 겹쳐 안내를 보인다
  calendarEmpty: { position: "absolute", left: spacing.x4, right: spacing.x4, top: spacing.x4, height: 17 + spacing.x1 + CELL * 7 + CELL_GAP * 6, alignItems: "center", justifyContent: "center", zIndex: 1 },
  monthlyCard: { flexDirection: "row", alignItems: "center", gap: spacing.x3, minHeight: spacing.x4 * 2 + (typography.cardTitle.lineHeight ?? 22) + (typography.secondary.lineHeight ?? 20) * 2, paddingHorizontal: spacing.x4, paddingVertical: spacing.x4, borderRadius: radii.sm, backgroundColor: colors.canvasSoft },
  monthlyIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radii.pill, backgroundColor: colors.canvas },
  listFrame: { flexGrow: 0, overflow: "hidden", backgroundColor: colors.canvasSoft, borderRadius: radii.sm },
  listRow: { minHeight: ACTIVITY_ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: spacing.x3, paddingHorizontal: spacing.x3, paddingVertical: spacing.x3 },
  rowDivider: { borderTopColor: colors.border, borderTopWidth: line.hair },
  thumb: { backgroundColor: colors.canvasSoft, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  search: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.x2, paddingHorizontal: spacing.x4, backgroundColor: colors.canvasSoft, borderRadius: radii.pill },
  searchInput: { flex: 1, minHeight: 48, color: colors.ink, ...typography.body },
  savedRow: { flexDirection: "row", alignItems: "center", gap: spacing.x1, paddingRight: spacing.x2 },
  iconButton: { width: touchTarget, height: touchTarget, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
  loadMore: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.x2, borderTopColor: colors.border, borderTopWidth: line.hair },
  toast: { bottom: spacing.x4 },
  levelList: { marginTop: spacing.x5, borderColor: colors.border, borderTopWidth: line.hair, borderBottomWidth: line.hair },
  levelRow: { flexDirection: "row", alignItems: "center", gap: spacing.x3, paddingHorizontal: spacing.x1, paddingVertical: spacing.x3_5 },
  levelCurrent: { backgroundColor: colors.canvasSoft },
  profileEditor: { gap: spacing.section },
  editorPhoto: { alignItems: "center", gap: spacing.x4 },
  editorPhotoActions: { flexDirection: "row", alignItems: "center", gap: spacing.x2 },
  editorFieldHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  editorInput: { minHeight: 48, marginTop: spacing.x3_5, paddingHorizontal: spacing.x4, borderRadius: radii.sm, backgroundColor: colors.canvas, borderColor: colors.outline, borderWidth: line.base, color: colors.ink, ...typography.body },
  editorError: { marginTop: spacing.x3, minHeight: (typography.secondary.lineHeight ?? 20) * 2 },
})
