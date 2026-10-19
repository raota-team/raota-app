import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { router, useIsFocused } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { Image } from "expo-image"
import * as Haptics from "expo-haptics"
import * as ImagePicker from "expo-image-picker"
import { ArrowRight, Bookmark, ChartColumnStacked, ChevronRight, MapPin, Search, Settings } from "lucide-react-native"
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
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"

import {
  MENU_CATEGORY_NAMES,
  RAMEN_ACTIVITY_LEVELS,
  menuCategoryOf,
  seoulToday,
  typeCountsOf,
  type DemoBowl,
  type Shop,
  type TasteIdentity,
  type RamenLog,
} from "@raota/shared"
import { ResilientUriImage } from "@/src/components/ResilientUriImage"
import { AppText, BottomSheet, Button, Chip, EmptyState, SoupDot, Tag, Toast } from "@/src/components/ui"
import {
  useActivityLevel,
  useBookmarkedShops,
  useBowlCount,
  useLongestStreak,
  useMyBowls,
  useMyLogs,
  useShops,
  useTasteIdentity,
  useMonthlyReports,
  useVisitedShops,
} from "@/src/data"
import { useRaota } from "@/src/state/RaotaStore"
import { colors, line, maxFontScale, radii, soupColorOf, spacing, touchTarget, typography } from "@/src/theme"
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
const REVEAL_EASE = Easing.bezier(0.22, 1, 0.36, 1)
// 탭 화면이 다시 마운트되어도 같은 그릇 수에는 한 번만 재생한다.
const revealedBowlCounts = new Map<string, number>()

const shortDate = (iso: string) => iso.slice(5).replace("-", ".")
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
  type?: string
  inRange: boolean
}

/** 일요일로 시작하는 주 단위 열. 끝날(오늘)은 항상 포함한다 */
function buildCalendar(bowls: DemoBowl[], start: string, end: string) {
  const days = new Map<string, { count: number; type: string }>()
  for (const bowl of bowls) {
    const day = days.get(bowl.date)
    if (day) day.count += 1
    else days.set(bowl.date, { count: 1, type: bowl.type })
  }
  const weeks: CalendarDay[][] = []
  const monthLabels: { week: number; label: string }[] = []
  let total = 0
  const levelDays = LEVEL_LABELS.map(() => 0)
  const types = new Set<string>()
  for (let day = addDays(start, -weekdayOf(start)); day <= end; day = addDays(day, 1)) {
    if (weekdayOf(day) === 0) weeks.push([])
    const inRange = day >= start
    const record = inRange ? days.get(day) : undefined
    const count = record?.count ?? 0
    total += count
    if (count > 0) {
      levelDays[Math.min(4, count) - 1]++
      types.add(record!.type)
    }
    weeks[weeks.length - 1].push({ date: day, count, type: record?.type, inRange })
    if (inRange && (day === start || day.endsWith("-01"))) {
      const week = weeks.length - 1
      if (!monthLabels.some((item) => item.week >= week - 2)) monthLabels.push({ week, label: `${Number(day.slice(5, 7))}월` })
    }
  }
  return { weeks, monthLabels, total, levelDays, types: [...types] }
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
        <AppText accessibilityRole="header" lineBreakStrategyIOS="hangul-word" style={[styles.center, styles.gapTop5]} variant="headline">
          내 라멘 취향을 모아보세요
        </AppText>
        <AppText lineBreakStrategyIOS="hangul-word" style={[styles.center, styles.gapTop1]} tone="sub" variant="body">
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
  const { data: recordCount, isLoading: countLoading } = useBowlCount()
  const { data: bowls } = useMyBowls()
  const { data: visits } = useVisitedShops()
  const { data: streak } = useLongestStreak()
  const { data: level } = useActivityLevel()
  const { data: identity } = useTasteIdentity()
  const { data: myLogs } = useMyLogs()
  const { data: saved } = useBookmarkedShops()
  const { data: shops } = useShops()

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
  /** 가로로 넘긴 캘린더에서 왼쪽 끝에 온전히 보이는 첫 주 */
  const [calendarFirstWeek, setCalendarFirstWeek] = useState(0)
  const [compactHeader, setCompactHeader] = useState(false)
  const [profileHeight, setProfileHeight] = useState(0)
  const reducedMotion = useReducedMotion()
  const shouldReveal = !reducedMotion && !!user && revealedBowlCounts.get(String(user.id)) !== recordCount
  const animatedCount = useSharedValue(shouldReveal ? 0 : recordCount)
  const levelReveal = useSharedValue(shouldReveal ? 0 : 1)
  const [dotRun, setDotRun] = useState(0)
  const pendingDots = useRef(false)

  useEffect(() => {
    if (reducedMotion) {
      animatedCount.value = recordCount
      levelReveal.value = 1
      pendingDots.current = false
    }
    if (!focused || countLoading || !user) return
    const id = String(user.id)
    if (revealedBowlCounts.get(id) === recordCount) return
    revealedBowlCounts.set(id, recordCount)
    if (reducedMotion) return
    animatedCount.value = 0
    animatedCount.value = withTiming(recordCount, { duration: 1100, easing: Easing.out(Easing.cubic) })
    levelReveal.value = 0
    levelReveal.value = withDelay(500, withTiming(1, { duration: 900, easing: REVEAL_EASE }))
    if (tab === "logs") setDotRun((run) => run + 1)
    else pendingDots.current = true
  }, [animatedCount, countLoading, focused, levelReveal, recordCount, reducedMotion, tab, user?.id])

  useEffect(() => {
    if (tab !== "logs" || !pendingDots.current || reducedMotion) return
    pendingDots.current = false
    setDotRun((run) => run + 1)
  }, [reducedMotion, tab])

  useEffect(() => () => {
    cancelAnimation(animatedCount)
    cancelAnimation(levelReveal)
  }, [animatedCount, levelReveal])

  const levelFillStyle = useAnimatedStyle(() => ({
    transformOrigin: "left center",
    transform: [{ scaleX: levelReveal.value }],
  }))

  const shopByName = (name: string) => shops.find((shop) => shop.name === name)
  const today = seoulToday()

  const years = useMemo(() => [...new Set(bowls.map((bowl) => bowl.date.slice(0, 4)))].sort().reverse(), [bowls])
  const periodOptions = [{ value: "1y", label: "최근 1년" }, ...years.map((year) => ({ value: year, label: `${year}년` }))]
  const periodLabel = periodOptions.find((option) => option.value === period)?.label ?? "최근 1년"
  const calendar = useMemo(() => {
    if (period === "1y") return buildCalendar(bowls, addDays(today, -364), today)
    const end = `${period}-12-31` < today ? `${period}-12-31` : today
    return buildCalendar(bowls, `${period}-01-01`, end)
  }, [bowls, period, today])
  // 월 라벨이 스크롤 경계에 걸려 반쯤 잘리지 않게, 가려진 라벨은 빼고 왼쪽 끝 주의 달을 대신 붙인다.
  // 바로 뒤(2주 안)에 다음 달 라벨이 오면 겹치므로 붙이지 않는다
  const monthLabels = useMemo(() => {
    const visible = calendar.monthLabels.filter((item) => item.week >= calendarFirstWeek)
    const firstWeek = calendar.weeks[calendarFirstWeek]
    if (!firstWeek || visible.some((item) => item.week <= calendarFirstWeek + 2)) return visible
    const day = firstWeek.find((item) => item.inRange) ?? firstWeek[0]
    return [{ week: calendarFirstWeek, label: `${Number(day.date.slice(5, 7))}월` }, ...visible]
  }, [calendar, calendarFirstWeek])
  // 기록이 있는 단계만 읽어 준다("1그릇 8일, 2그릇 3일")
  const levelSummary = calendar.levelDays
    .map((days, index) => (days > 0 ? `${LEVEL_LABELS[index]} ${days}일` : null))
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

  const unsave = (shop: Shop) => {
    haptic()
    actions.toggleBookmark(shop.id)
    setToast(`'${shop.name}' 저장을 해제했어요`)
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
          "사진 접근 권한이 필요해요",
          "설정에서 사진 접근을 허용하거나, 사진 없이도 프로필을 편집할 수 있어요.",
          [
            { text: "사진 없이 계속", style: "cancel" },
            { text: "설정 열기", onPress: () => void Linking.openSettings() },
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
      setProfileError("사진을 불러오지 못했어요. 다시 시도해 주세요.")
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
      setProfileError("프로필을 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.")
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
            <AppText capScale numberOfLines={1} style={styles.segmentLabel} tone={active ? "ink" : "muted"} variant="bodyStrong">
              {item.label}
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
              accessibilityHint="계정, 약관, 로그아웃"
              accessibilityLabel="설정"
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
              accessibilityLabel="프로필 사진과 상태 메시지 바꾸기"
              accessibilityRole="button"
              onPress={openProfileEditor}
              style={styles.avatarBadgeHit}
            >
              <View style={styles.avatarBadge}>
                <Settings color={colors.ink} size={16} />
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
                accessibilityLabel="상태 메시지를 남겨 보세요"
                accessibilityRole="button"
                onPress={openProfileEditor}
                style={styles.profileEmptyBio}
              >
                <AppText tone="muted" variant="secondary">상태 메시지를 남겨 보세요</AppText>
              </Pressable>
            )}
          </View>
          <View style={styles.stats}>
            {stats.map((stat, index) => (
              <View accessibilityLabel={`${stat.label} ${stat.value}${stat.unit}`} accessible key={stat.label} style={styles.stat}>
                {index === 0 ? <BowlCountNumber count={animatedCount} target={recordCount} /> : <AppText style={styles.statValue} variant="secondary">{stat.value}</AppText>}
                <AppText variant="secondary">{stat.unit}</AppText>
                {index === 0 ? <AppText tone="muted" variant="secondary"> · </AppText> : null}
              </View>
            ))}
            <AppText tone="muted" variant="secondary"> · </AppText>
            <Pressable
              accessibilityHint="라멘로그 수에 따른 활동 등급을 설명해요"
              accessibilityLabel={`등급 안내, Lv.${level.number} ${level.title}`}
              accessibilityRole="button"
              onPress={() => setSheet("grade")}
              style={({ pressed }) => [styles.gradeLevel, pressed && styles.gradePressed]}
            >
              <AppText style={styles.statValue} variant="secondary">Lv.{level.number} {level.title}</AppText>
            </Pressable>
          </View>
          <Pressable
            accessibilityLabel={level.nextTarget ? `다음 등급까지 ${Math.max(0, level.nextTarget - recordCount)}그릇` : "최고 등급이에요"}
            accessibilityRole="button"
            onPress={() => setSheet("grade")}
            style={({ pressed }) => [styles.levelProgress, pressed && styles.gradePressed]}
          >
            <View style={styles.levelTrack}>
              <Animated.View style={[styles.levelFill, { width: `${level.progress}%` as `${number}%` }, levelFillStyle]} />
            </View>
            <View style={styles.levelCaption}>
              <AppText tone="muted" variant="meta">
                {level.nextTarget ? `다음 등급까지 ${Math.max(0, level.nextTarget - recordCount)}그릇` : "최고 등급이에요"}
              </AppText>
              <ChevronRight color={colors.textMuted} size={14} />
            </View>
          </Pressable>
        </View>

        <View
          accessibilityElementsHidden={compactHeader}
          importantForAccessibility={compactHeader ? "no-hide-descendants" : "auto"}
          style={styles.stickyTabs}
          testID="my-sticky-tabs"
        >
          {tabBar}
        </View>

        <View style={[styles.main, { minHeight: Math.max(0, windowHeight - insets.top - touchTarget * 2 - spacing.screenBottom) }]}>
          {tab === "logs" ? (
            <>
              <MyTasteTicket
                bowls={bowls}
                dotRun={dotRun}
                initiallyHidden={shouldReveal || pendingDots.current}
                reducedMotion={reducedMotion}
                identity={identity}
                onOpen={() => router.push("/taste")}
                onStart={() => router.push({ pathname: "/record/select-shop", params: { mode: "nearby" } })}
                recordCount={recordCount}
              />
              <MonthlyTasteEntry onOpen={() => router.push("/taste/archive")} />
              <TasteBoards bowls={bowls} myLogs={myLogs} shops={shops} />
              <View style={styles.infoSection}>
                <View style={styles.rowBetween}>
                  <AppText accessibilityRole="header" style={styles.calendarHeading} variant="sectionTitle">라멘로그 캘린더</AppText>
                  <ScrollView contentContainerStyle={styles.chipRow} horizontal showsHorizontalScrollIndicator={false} style={styles.periodScroll}>
                    {periodOptions.map((option) => (
                      <Chip
                        accessibilityLabel={`캘린더 기간 ${option.label}`}
                        key={option.value}
                        label={option.label}
                        onPress={() => setPeriod(option.value)}
                        selected={option.value === period}
                      />
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.calendarCard}>
                  <View
                    accessibilityLabel={`${periodLabel} ${calendar.total}그릇 기록${streak > 1 ? `, 최장 ${streak}일 연속` : ""}${levelSummary ? `, ${levelSummary}` : ""}`}
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
                      onScroll={(event) => {
                        const week = Math.max(0, Math.ceil(event.nativeEvent.contentOffset.x / (CELL + CELL_GAP) - 0.05))
                        if (week !== calendarFirstWeek) setCalendarFirstWeek(week)
                      }}
                      ref={calendarRef}
                      scrollEventThrottle={16}
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
                                      : day.type
                                        ? { backgroundColor: soupColorOf(day.type), borderColor: colors.soupEdge, borderWidth: line.base }
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
                  <View accessibilityLabel={`범례. ${calendar.types.join(", ") || "기록 없음"}`} accessible style={styles.legend}>
                    {calendar.types.map((type) => (
                      <View key={type} style={styles.rowGap}>
                        <View style={[styles.legendDot, { backgroundColor: soupColorOf(type) }]} />
                        <AppText capScale tone="sub" variant="meta">{type}</AppText>
                      </View>
                    ))}
                  </View>
                </View>
                <AppText lineBreakStrategyIOS="hangul-word" tone="sub" variant="meta">
                  <AppText style={styles.heavy} variant="meta">
                    {periodLabel} {calendar.total}그릇
                  </AppText>
                  {streak > 1 ? ` · 최장 ${streak}일 연속` : ""}
                </AppText>
                <View style={styles.calendarHintSlot}>
                  {calendar.total === 0 ? (
                    <AppText lineBreakStrategyIOS="hangul-word" tone="sub" variant="secondary">
                      이 기간에는 기록이 없어요. 라멘로그를 남기면 캘린더가 채워져요.
                    </AppText>
                  ) : null}
                </View>
              </View>

              <View style={styles.infoSection}>
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
                  <ActivityListFrame
                    label="최근 기록 목록"
                    loadedCount={recentLogs.length}
                    moreLabel="기록 더 보기"
                    moreText="이전 기록 더 보기"
                    onLoadMore={loadMoreRecent}
                    remainingUnit="그릇"
                    testID="my-logs-list"
                    totalCount={bowls.length}
                    visibleRows={RECENT_VISIBLE_ROWS}
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
                          <AppText lineBreakStrategyIOS="hangul-word" numberOfLines={2} variant="cardTitle">
                            {log.name}
                            {log.shop?.branch ? <AppText tone="sub" variant="secondary">{` ${log.shop.branch}`}</AppText> : null}
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
            <View style={styles.infoSection}>
              <AppText accessibilityRole="header" variant="sectionTitle">
                방문한 라멘집 <AppText tone="sub" variant="sectionTitle">{visits.length}곳</AppText>
              </AppText>
              <AppText lineBreakStrategyIOS="hangul-word" tone="sub" variant="secondary">
                라멘로그를 남긴 매장이에요. 방문 수를 더하면 총 {recordCount}그릇이에요.
              </AppText>
              {visits.length > 0 ? (
                <>
                  <View accessibilityLabel="정렬" accessibilityRole="radiogroup" style={styles.segment}>
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
                          <AppText capScale style={styles.bold} tone={active ? "ink" : "muted"} variant="secondary">
                            {option.label}
                          </AppText>
                        </Pressable>
                      )
                    })}
                  </View>
                  <SearchField label="방문한 라멘집 검색" onChange={(query) => { setVisitQuery(query); setVisitLimit(VISIBLE_ROWS) }} placeholder="매장, 지점, 메뉴 검색" value={visitQuery} />
                </>
              ) : null}
              {filteredVisits.length === 0 ? (
                <EmptyState
                  description={visits.length ? "다른 이름이나 메뉴로 찾아보세요." : "라멘로그를 남기면 매장별 방문 수가 쌓여요."}
                  icon={<MapPin color={colors.textMuted} size={24} />}
                  title={visits.length ? "검색 결과가 없어요" : "아직 방문한 라멘집이 없어요"}
                />
              ) : (
                <View>
                  <ActivityListFrame
                    label="방문 매장 목록"
                    loadedCount={visibleVisits.length}
                    moreLabel="방문매장 더 보기"
                    moreText="방문 매장 더 보기"
                    onLoadMore={() => setVisitLimit((limit) => Math.min(limit + ACTIVITY_PAGE_SIZE, filteredVisits.length))}
                    remainingUnit="곳"
                    testID="my-visits-list"
                    totalCount={filteredVisits.length}
                  >
                  {visibleVisits.map((visit, index) => {
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
                        <Thumb letter={visit.name} size={48} uri={visit.photo} />
                        <View style={styles.flex}>
                          <View style={styles.rowGap}>
                            <AppText lineBreakStrategyIOS="hangul-word" numberOfLines={2} style={styles.shrink} variant="cardTitle">
                              {visit.name}
                              {visit.branch ? <AppText tone="sub" variant="secondary">{` ${visit.branch}`}</AppText> : null}
                            </AppText>
                            {visit.visitCount >= 3 ? <Tag label="단골" /> : null}
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
                            {visit.visitCount}그릇
                          </AppText>
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
                가고 싶은 라멘집 <AppText tone="sub" variant="sectionTitle">{saved.length}곳</AppText>
              </AppText>
              <AppText lineBreakStrategyIOS="hangul-word" tone="sub" variant="secondary">
                매장 상세에서 저장한 곳이에요.
              </AppText>
              {saved.length > 0 ? (
                <SearchField label="저장한 라멘집 검색" onChange={(query) => { setSavedQuery(query); setSavedLimit(VISIBLE_ROWS) }} placeholder="매장, 지점, 스타일 검색" value={savedQuery} />
              ) : null}
              {filteredSaved.length === 0 ? (
                <EmptyState
                  description={saved.length ? "다른 이름이나 스타일로 찾아보세요." : "매장 상세에서 저장하면 여기에 모여요."}
                  icon={<Bookmark color={colors.textMuted} size={24} />}
                  title={saved.length ? "검색 결과가 없어요" : "아직 저장한 라멘집이 없어요"}
                />
              ) : (
                <View>
                  <ActivityListFrame
                    label="저장한 매장 목록"
                    loadedCount={visibleSaved.length}
                    moreLabel="저장한 매장 더 보기"
                    moreText="저장한 매장 더 보기"
                    onLoadMore={() => setSavedLimit((limit) => Math.min(limit + ACTIVITY_PAGE_SIZE, filteredSaved.length))}
                    remainingUnit="곳"
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
                          accessibilityLabel={`${shop.name} 저장 해제`}
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
              accessibilityLabel="설정"
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
        footer={<Button fullWidth loading={savingProfile} onPress={() => void saveProfile()} title="저장" />}
        onClose={() => { if (!savingProfile) setSheet(null) }}
        title="프로필 편집"
        visible={sheet === "profile"}
      >
        <View style={styles.profileEditor}>
          <View style={styles.editorPhoto}>
            <ProfileAvatar size={80} uri={draftAvatar} />
            <View style={styles.editorPhotoActions}>
              <Button
                accessibilityLabel="프로필 사진 변경"
                disabled={savingProfile}
                onPress={() => void pickAvatar()}
                size="small"
                title="사진 변경"
                variant="secondary"
              />
              <View accessibilityElementsHidden={!draftAvatar} importantForAccessibility={!draftAvatar ? "no-hide-descendants" : "auto"} style={!draftAvatar && styles.invisible}>
                <Button
                  accessibilityLabel="프로필 사진 삭제"
                  disabled={!draftAvatar || savingProfile}
                  onPress={() => setDraftAvatar(null)}
                  size="small"
                  title="사진 삭제"
                  variant="ghost"
                />
              </View>
            </View>
          </View>
          <View>
            <View style={styles.editorFieldHead}>
              <AppText variant="bodyStrong">상태 메시지</AppText>
              <AppText capScale style={styles.tabular} tone="muted" variant="meta">{draftBio.length}/{BIO_MAX}</AppText>
            </View>
            <TextInput
              accessibilityLabel="상태 메시지"
              editable={!savingProfile}
              maxLength={BIO_MAX}
              onChangeText={setDraftBio}
              placeholder="라멘에 진심인 편입니다."
              placeholderTextColor={colors.textMuted}
              style={styles.editorInput}
              value={draftBio}
            />
            <AppText accessibilityElementsHidden={!profileError} accessibilityLiveRegion="polite" style={[styles.editorError, !profileError && styles.invisible]} tone="critical" variant="secondary">{profileError ?? " "}</AppText>
          </View>
        </View>
      </BottomSheet>

      <BottomSheet
        footer={<Button onPress={() => setSheet(null)} title="확인" variant="secondary" />}
        onClose={() => setSheet(null)}
        title="라멘 활동 등급"
        visible={sheet === "grade"}
      >
        <AppText lineBreakStrategyIOS="hangul-word" tone="sub" variant="body">
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
                  <AppText variant="cardTitle">
                    Lv.{index + 1} {item.title}
                  </AppText>
                  <AppText lineBreakStrategyIOS="hangul-word" tone="sub" variant="secondary">
                    {item.desc}
                  </AppText>
                </View>
                <AppText accessibilityElementsHidden={!current} capScale style={!current && styles.invisible} variant="meta">
                  내 등급
                </AppText>
              </View>
            )
          })}
        </ScrollView>
      </BottomSheet>

    </View>
  )
}

function ProfileAvatar({ uri, size }: { uri: string | null; size: number }) {
  return (
    <ResilientUriImage
      accessibilityLabel="프로필 사진"
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

/** 숫자만 갱신하고 최종 자릿수는 처음부터 비워 둔다. */
function BowlCountNumber({ count, target }: { count: SharedValue<number>; target: number }) {
  const [displayed, setDisplayed] = useState(() => Math.round(count.value))
  useAnimatedReaction(
    () => Math.round(count.value),
    (next, previous) => {
      if (next !== previous) runOnJS(setDisplayed)(next)
    },
    [count],
  )

  return (
    <View style={styles.countSlot}>
      <AppText accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.statValue, styles.tabular, styles.invisible]} variant="secondary">
        {"8".repeat(Math.max(3, String(target).length))}
      </AppText>
      <AppText style={[styles.statValue, styles.tabular, styles.countOverlay]} variant="secondary">{displayed}</AppText>
    </View>
  )
}

function AnimatedBowlDot({
  type,
  index,
  total,
  run,
  initiallyHidden,
  reducedMotion,
}: {
  type: string
  index: number
  total: number
  run: number
  initiallyHidden: boolean
  reducedMotion: boolean
}) {
  const scale = useSharedValue(initiallyHidden ? 0 : 1)
  const previousRun = useRef(run)

  useEffect(() => {
    if (reducedMotion) {
      scale.value = 1
      previousRun.current = run
    } else if (run !== previousRun.current) {
      previousRun.current = run
      scale.value = 0
      // 점이 많아도 마지막 점까지 1초 안에 들어오게 간격만 좁힌다.
      const delay = index * Math.min(18, 560 / Math.max(1, total - 1))
      scale.value = withDelay(delay, withSequence(
        withTiming(1.3, { duration: 120, easing: REVEAL_EASE }),
        withSpring(1, { duration: 220, dampingRatio: 0.68 }),
      ))
    }
  }, [index, reducedMotion, run, scale, total])

  useEffect(() => () => cancelAnimation(scale), [scale])

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  return (
    <Animated.View style={[styles.dotSlot, popStyle]}>
      <SoupDot type={type} size={15} />
    </Animated.View>
  )
}

/** 화면에는 원장의 다섯 종류별 국물 색 점과 해당 개수만 담는다. */
function MyTasteTicket({
  bowls,
  identity,
  recordCount,
  dotRun,
  initiallyHidden,
  reducedMotion,
  onOpen,
  onStart,
}: {
  bowls: DemoBowl[]
  identity: TasteIdentity
  recordCount: number
  dotRun: number
  initiallyHidden: boolean
  reducedMotion: boolean
  onOpen: () => void
  onStart: () => void
}) {
  const groups = typeCountsOf(bowls)
  const populated = MENU_CATEGORY_NAMES.filter((type) => groups[type] > 0)
  return (
    <View style={styles.reportTicket} testID="my-report-ticket">
      <View style={styles.ticketHead}>
        <AppText accessibilityRole="header" style={styles.ticketTitle} variant="sectionTitle">{identity.title}</AppText>
        <AppText capScale style={styles.tabular} tone="muted" variant="meta">종합 감정 · {recordCount}그릇</AppText>
      </View>
      {populated.length ? (
        <>
          <View accessibilityLabel={`그릇 감정서. ${populated.map((type) => `${type} ${groups[type]}그릇`).join(", ")}`} accessible style={styles.bowlDots}>
            {bowls.map((_, index) => {
              const bowl = bowls[bowls.length - 1 - index]
              return (
                <AnimatedBowlDot
                  index={index}
                  initiallyHidden={initiallyHidden}
                  key={`${bowl.date}-${bowl.shop}-${bowl.menu}-${index}`}
                  reducedMotion={reducedMotion}
                  run={dotRun}
                  total={bowls.length}
                  type={menuCategoryOf(bowl.type)}
                />
              )
            })}
          </View>
          <AppText capScale tone="muted" variant="meta">{populated.map((type) => `${type} ${groups[type]}`).join(" · ")}</AppText>
        </>
      ) : (
        <AppText lineBreakStrategyIOS="hangul-word" tone="sub" variant="secondary">{identity.description}</AppText>
      )}
      <Button
        fullWidth
        onPress={recordCount ? onOpen : onStart}
        rightIcon={<ArrowRight color={colors.ink} size={16} />}
        title={recordCount ? "종합 리포트 보기" : "첫 그릇 기록하기"}
        variant="secondary"
      />
    </View>
  )
}

/** 월별 취향 변화를 캘린더 아래 작은 글씨 링크로 두면 찾지 못해서, 감정서 바로 아래 한 줄 카드로 연다. */
function MonthlyTasteEntry({ onOpen }: { onOpen: () => void }) {
  const { data: monthly } = useMonthlyReports()
  const months = monthly.past.length + (monthly.current ? 1 : 0)
  if (!months) return null
  const summary = monthly.current ? `이번 달 ${monthly.current.recordCount}그릇 집계 중 · ${months}개월 비교` : `${months}개월 비교`
  return (
    <Pressable
      accessibilityHint="달마다 어떤 라멘을 먹었는지 비교해요"
      accessibilityLabel={`월별 취향 변화, ${summary}`}
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [styles.monthlyCard, pressed && styles.pressedWash]}
      testID="my-monthly-entry"
    >
      <View style={styles.monthlyIcon}>
        <ChartColumnStacked color={colors.ink} size={20} strokeWidth={2.1} />
      </View>
      <View style={styles.flex}>
        <AppText variant="cardTitle">월별 취향 변화</AppText>
        <AppText capScale lineBreakStrategyIOS="hangul-word" numberOfLines={2} tone="muted" variant="secondary">{summary}</AppText>
      </View>
      <ChevronRight color={colors.textMuted} size={20} />
    </Pressable>
  )
}

/** 실제 기록이 있는 종류만 사진 보드로 묶는다. 사진은 기록 또는 매장 원장의 이미지만 사용한다. */
function TasteBoards({ bowls, myLogs, shops }: {
  bowls: DemoBowl[]
  myLogs: RamenLog[]
  shops: Shop[]
}) {
  const boards = useMemo(() => {
    const counts = typeCountsOf(bowls)
    return MENU_CATEGORY_NAMES.filter((type) => counts[type] > 0).map((type) => {
      const photos = [...new Set(bowls
        .filter((bowl) => menuCategoryOf(bowl.type) === type)
        .map((bowl) => myLogs.find((log) => log.shop.name === bowl.shop && log.menuName === bowl.menu)?.imageUrl
          ?? shops.find((shop) => shop.name === bowl.shop)?.photos[0])
        .filter((photo): photo is string => Boolean(photo)))].slice(0, 3)
      return { type, photos, count: counts[type] }
    })
  }, [bowls, myLogs, shops])
  if (!boards.length) return null
  return (
    <View style={styles.boards}>
      {boards.map((board) => (
        <View key={board.type} style={styles.board}>
          <View style={styles.collage}>
            {board.photos.length ? (
              <>
                <Image contentFit="cover" source={{ uri: board.photos[0] }} style={board.photos.length > 1 ? styles.collageMain : styles.fill} />
                {board.photos.length > 1 ? (
                  <View style={styles.collageSide}>
                    {board.photos.slice(1).map((photo) => (
                      <Image contentFit="cover" key={photo} source={{ uri: photo }} style={styles.collageSmall} />
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
          <View style={styles.boardLabel}>
            <AppText numberOfLines={1} variant="bodyStrong">{board.type} {board.count}</AppText>
          </View>
        </View>
      ))}
    </View>
  )
}

// ---------------------------------------------------------------------------
// 작은 부품
// ---------------------------------------------------------------------------

function Thumb({ uri, letter, size = 48 }: { uri?: string | null; letter: string; size?: number }) {
  return (
    <View style={[styles.thumb, { width: size, height: size, borderRadius: radii.sm }]}>
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
          accessibilityLabel={`${moreLabel}, ${totalCount - loadedCount}${remainingUnit} 남음`}
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
  gapTop1: { marginTop: spacing.x1 },
  gapTop5: { marginTop: spacing.x5 },
  pressedWash: { backgroundColor: colors.surfacePressed },
  invisible: { opacity: 0 },
  linkText: { color: colors.inkSub, ...typography.secondary },
  guest: { flexGrow: 1, paddingHorizontal: spacing.gutter, paddingTop: spacing.x10, paddingBottom: spacing.section },
  guestBody: { flex: 1, justifyContent: "center" },
  guestLogo: { width: 64, height: 64, alignSelf: "center" },
  guestActions: { marginTop: spacing.section, gap: spacing.x4 },
  policyLinks: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: spacing.section },
  scroll: { paddingBottom: spacing.screenBottom },
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
  countSlot: { position: "relative" },
  countOverlay: { position: "absolute", top: 0, right: 0 },
  gradeLevel: { minHeight: touchTarget, paddingHorizontal: spacing.x1, alignItems: "center", justifyContent: "center" },
  gradePressed: { backgroundColor: colors.surfacePressed, borderRadius: radii.sm },
  levelProgress: { minHeight: touchTarget, alignItems: "center", justifyContent: "center", gap: spacing.x2, marginTop: spacing.x1, paddingHorizontal: spacing.x4 },
  levelTrack: { width: 168, maxWidth: "100%", height: 4, borderRadius: radii.pill, backgroundColor: colors.secondary, overflow: "hidden" },
  levelFill: { height: "100%", borderRadius: radii.pill, backgroundColor: colors.ink },
  dotSlot: { width: 15, height: 15 },
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
  ticketHead: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: spacing.x1 },
  ticketTitle: { flexShrink: 1 },
  bowlDots: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.x1, rowGap: spacing.x1_5 },
  boards: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.x2, rowGap: spacing.x4, marginHorizontal: -spacing.x1 },
  board: { width: "48%", flexGrow: 1, maxWidth: "49%" },
  collage: { height: 116, flexDirection: "row", gap: 2, borderRadius: radii.sm, backgroundColor: colors.canvasSoft, overflow: "hidden" },
  collageMain: { flex: 2 },
  collageSide: { flex: 1, gap: 2 },
  collageSmall: { flex: 1, width: "100%" },
  boardLabel: { paddingHorizontal: spacing.x1, marginTop: spacing.x2 },
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
  legend: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: spacing.x3, rowGap: spacing.x1_5, minHeight: (typography.meta.lineHeight ?? 18) * 2 + spacing.x1_5 },
  legendDot: { width: CELL, height: CELL, borderRadius: 3, borderColor: colors.soupEdge, borderWidth: line.base },
  calendarHintSlot: { minHeight: (typography.secondary.lineHeight ?? 20) * 2 },
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
