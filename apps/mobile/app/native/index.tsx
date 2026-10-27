import * as Location from "expo-location"
import { router, useFocusEffect } from "expo-router"
import { ChevronRight, Sparkles, Ticket } from "lucide-react-native"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Image, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { monthKeyOfDate, seoulMonthKey, seoulToday, type RamenLog, type Shop, type ShopCatalogItem, type TasteIdentity, type TasteProfile } from "@raota/shared"
import { isRemote } from "@/src/api/config"
import { ResilientUriImage } from "@/src/components/ResilientUriImage"
import { AppText, EmptyState, LoadingState } from "@/src/components/ui"
import { TodayTicketsSheet } from "@/src/components/TodayTicketsSheet"
import { useLoungeLogs, useMyBowls, useShops, useTasteIdentity, useTasteProfile, useTodayCuration } from "@/src/data/hooks"
import { remoteReads, type RemoteTodayTickets } from "@/src/data/remote"
import { rankShopsForAIRecommendation } from "@/src/domain/ai-recommendation"
import { distanceBetweenCoordinates, matchesShopRamenType } from "@/src/domain/shops"
import { markLaunchReady } from "@/src/launch"
import { useRaota } from "@/src/state/RaotaStore"
import { colors, maxFontScale, pressFade, radii, spacing, touchTarget } from "@/src/theme"

/** 원장의 표시용 스타일과 특징. API 응답에 없으면 텍스트를 숨긴다. */
function catalogOf(shop: Shop): Partial<Pick<ShopCatalogItem, "style" | "spec">> {
  return shop as Partial<ShopCatalogItem>
}

function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${meters}m`
}

/** 영업 상태는 원장의 businessStatus와 isOpen에서만 계산한다 */
function statusOf(shop: Shop): { label: string; open: boolean } {
  if (shop.businessStatus !== "OPERATIONAL") return { label: "영업 정보 확인 필요", open: false }
  return shop.isOpen ? { label: "영업 중", open: true } : { label: "준비 중", open: false }
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"]

/** 인사 문구는 서울 시각의 끼니를 따른다. */
function mealOfNow(now = new Date()) {
  const hour = (now.getUTCHours() + 9) % 24
  if (hour >= 5 && hour < 11) return "아침"
  if (hour >= 11 && hour < 16) return "점심"
  if (hour >= 16 && hour < 22) return "저녁"
  return "야식"
}

/** 그릇에 기록된 서울 날짜와 오늘 사이의 일수. */
function daysSince(isoDate: string, today: string) {
  const toUtc = (value: string) => {
    const [year, month, day] = value.split("-").map(Number)
    return Date.UTC(year, month - 1, day)
  }
  return Math.max(0, Math.round((toUtc(today) - toUtc(isoDate)) / 86_400_000))
}

/** 라운지 미리보기 카드 한 장의 사진. 사진 없는 기록은 미리보기에 넣지 않는다 */
function logPhoto(log: RamenLog) {
  return log.photos?.[0] ?? log.imageUrl ?? null
}

const LOUNGE_CARD = 174
const RECOMMEND_CARD = 154

/** "2026-09-19" → "9월 19일 (토)" */
function formatPickDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number)
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  return `${month}월 ${day}일 (${weekday})`
}

function openShop(shopId: string) {
  router.push({ pathname: "/shop/[shopId]", params: { shopId } })
}

/** 원장 매장의 표시용 텍스트(스타일·특징·태그·소개). 추천 이유를 판정할 때 쓴다 */
function shopText(shop: Shop) {
  const catalog = catalogOf(shop)
  return [catalog.style, catalog.spec, shop.aiSummary?.text, shop.description, ...shop.tags].filter(Boolean).join(" ")
}

const SOUP_KEYS: Record<string, string[]> = {
  쇼유: ["쇼유"],
  시오: ["시오"],
  미소: ["미소"],
  토리파이탄: ["토리파이탄", "토리빠이탄", "닭백탕", "파이탄"],
  니보시: ["니보시", "멸치"],
  지로: ["지로"],
}
const DENSE_KEYS = ["진한", "농후", "백탕", "이에케", "돈코츠", "적된장"]
const CLEAN_KEYS = ["깔끔", "맑은", "청탕", "감칠맛", "시오"]
const hasAny = (text: string, keys: string[]) => keys.some((key) => text.includes(key))

interface Recommendation {
  shop: Shop
  /** 카드에 보여주는 추천 이유 한 줄. 랭킹 입력에서 실제로 쓴 근거만 쓴다 */
  reason: string
}

/** 기록이 없거나 비회원일 때: 라멘로그·평점이 쌓인 곳 → 가까운 곳 순 */
function fallbackRecommendations(shops: Shop[]): Recommendation[] {
  return [...shops]
    .sort((a, b) => b.reviewCount - a.reviewCount || b.rating - a.rating || a.distanceM - b.distanceM)
    .slice(0, 5)
    .map((shop) => ({ shop, reason: plainReason(shop) }))
}

function plainReason(shop: Shop) {
  if (shop.reviewCount > 0) {
    return [`라멘로그 ${shop.reviewCount.toLocaleString()}개`, shop.rating > 0 ? `★ ${shop.rating.toFixed(1)}` : null].filter(Boolean).join(" · ")
  }
  if (shop.distanceM <= 0 && "unknownFields" in shop) return shop.tags[0] ?? "새로운 라멘집"
  const open = statusOf(shop).open
  return open ? `가까운 영업 중 매장 · ${formatDistance(shop.distanceM)}` : `${formatDistance(shop.distanceM)} 거리`
}

/**
 * 로그인 사용자의 추천. 가장 많이 먹은 종류(취향 정체성)와 육수 농도 평균을 src/domain/ai-recommendation 랭킹의 입력으로 쓴다.
 * 이유 문구는 그 입력과 매장 정보가 실제로 맞은 경우에만 붙인다. 서버 추천(#46)이 오면 이 함수만 바꾼다.
 */
function personalRecommendations(shops: Shop[], identity: TasteIdentity, profile: TasteProfile): Recommendation[] {
  const leader = identity.leader && identity.leader.name !== "기타" ? identity.leader.name : null
  const dense = profile.scores.brothDensity >= 3.5
  try {
    const ranked = rankShopsForAIRecommendation(shops, {
      soup: leader ?? "",
      mood: "",
      priority: dense ? "진하고 묵직한 국물" : "깔끔하고 깊은 감칠맛",
    })
    if (!ranked.length) return fallbackRecommendations(shops)
    return ranked.slice(0, 5).map(({ shop }) => {
      const text = shopText(shop)
      const reasons: string[] = []
      if (leader) {
        const matchesLeader = leader === "돈코츠" || leader === "이에케"
          ? matchesShopRamenType(shop, leader)
          : hasAny(text, SOUP_KEYS[leader] ?? [leader])
        if (matchesLeader) reasons.push(`${leader}를 가장 자주 드셔서`)
      }
      if (dense && hasAny(text, DENSE_KEYS)) reasons.push("진한 육수 취향")
      if (!dense && hasAny(text, CLEAN_KEYS)) reasons.push("맑은 육수 취향")
      return { shop, reason: reasons.length ? reasons.join(" · ") : plainReason(shop) }
    })
  } catch {
    return fallbackRecommendations(shops)
  }
}

/**
 * 위치 권한이 이미 허용돼 있을 때만 현재 위치를 읽는다. 홈에서는 권한을 새로 묻지 않는다
 * (권한 요청은 지도 탭에서 맥락과 함께 한다). 없으면 원장 거리를 그대로 쓴다.
 */
function useKnownLocation() {
  const [origin, setOrigin] = useState<{ latitude: number; longitude: number } | null>(null)
  useEffect(() => {
    if (Platform.OS === "web") return
    let mounted = true
    ;(async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync()
        if (permission.status !== "granted") return
        const position =
          (await Location.getLastKnownPositionAsync()) ??
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }))
        if (mounted && position) setOrigin({ latitude: position.coords.latitude, longitude: position.coords.longitude })
      } catch {
        // 위치를 못 읽으면 원장 거리로 보여준다
      }
    })()
    return () => {
      mounted = false
    }
  }, [])
  return origin
}

function SectionHead({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionHead}>
      <AppText accessibilityLabel={title} accessibilityRole="header" numberOfLines={1} style={styles.sectionTitle} variant="sectionTitle">
        {title}
      </AppText>
      {right}
    </View>
  )
}

/** 목록 사진과 라멘 종류는 사진 바깥의 별도 장식 테두리 없이 보여 준다. */
function Thumb({ uri, size }: { uri?: string; size: number }) {
  return <ResilientUriImage accessibilityLabel="" style={[styles.thumb, { width: size, height: size }]} uri={uri} />
}

function PhotoTypePill({ type }: { type: string }) {
  return (
    <View style={styles.photoTypePill}>
      <AppText capScale style={styles.onPhotoText} variant="meta">
        {type}
      </AppText>
    </View>
  )
}

/*
 * 실패한 서버 읽기는 캐시하지 않으므로 본문을 새 key로 다시 올리면 성공한 읽기는 캐시에서, 실패한 읽기만 다시 보낸다.
 * 데이터 hook에 refetch가 생기면 이 key 대신 그것을 부른다.
 */
export default function HomeScreen() {
  const [retryKey, setRetryKey] = useState(0)
  return <HomeBody key={retryKey} onRetry={() => setRetryKey((key) => key + 1)} />
}

function HomeBody({ onRetry }: { onRetry: () => void }) {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const { currentUser } = useRaota()
  const shopsQuery = useShops()
  const curation = useTodayCuration()
  const bowls = useMyBowls()
  const tasteProfile = useTasteProfile()
  const tasteIdentity = useTasteIdentity()
  const origin = useKnownLocation()
  const loggedIn = Boolean(currentUser?.isLoggedIn)
  // 오늘 뽑은 AI 식권. 큐레이터에서 뽑고 돌아오면 다시 읽어야 해서 화면에 들어올 때마다 읽는다
  const ticketsEnabled = isRemote("recommendations") && loggedIn
  const [todayTickets, setTodayTickets] = useState<RemoteTodayTickets | null>(null)
  /** 식권을 한 번이라도 다 읽었는가(실패도 끝난 것으로 본다). 앱을 켤 때 덮개가 이것까지 기다린다 */
  const [ticketsSettled, setTicketsSettled] = useState(false)
  const [ticketsOpen, setTicketsOpen] = useState(false)
  useFocusEffect(
    useCallback(() => {
      if (!ticketsEnabled) {
        setTodayTickets(null)
        setTicketsSettled(true)
        return
      }
      let active = true
      remoteReads.recommendationTickets().then(
        (tickets) => { if (active) setTodayTickets(tickets) },
        () => { if (active) setTodayTickets(null) },
      ).finally(() => { if (active) setTicketsSettled(true) })
      return () => { active = false }
    }, [ticketsEnabled]),
  )
  const ticketsUsedUp = todayTickets?.remaining === 0

  /** 위치가 있으면 실제 거리로 다시 계산한다 */
  const shops = useMemo(() => {
    if (!origin) return shopsQuery.data
    return shopsQuery.data.map((shop) =>
      shop.lat && shop.lng
        ? { ...shop, distanceM: Math.round(distanceBetweenCoordinates(origin, { latitude: shop.lat, longitude: shop.lng })) }
        : shop,
    )
  }, [origin, shopsQuery.data])

  /** mock에서는 원장 에디터 픽, remote에서는 발행된 오늘의 큐레이션만 보여준다. */
  const todayPick = useMemo(
    () => curation.remote
      ? curation.data?.shop ?? null
      : shops.find((shop) => (shop.aiSummary || shop.description) && shop.photos[0]) ?? shops[0] ?? null,
    [curation.data?.shop, curation.remote, shops],
  )
  /** 추천: 기록이 있는 로그인 사용자는 취향 기반 랭킹, 그 외에는 라멘로그·거리 기준 */
  const personal = !shopsQuery.remote && loggedIn && tasteProfile.data.profile.count > 0 && Boolean(tasteIdentity.data.leader)
  /** 오늘의 픽으로 이미 소개한 매장은 아래 목록에서 다시 보여주지 않는다 */
  const recommendations = useMemo(() => {
    const pool = shops.filter((shop) => shop.id !== todayPick?.id)
    return personal ? personalRecommendations(pool, tasteIdentity.data, tasteProfile.data.profile) : fallbackRecommendations(pool)
  }, [personal, shops, tasteIdentity.data, tasteProfile.data.profile, todayPick?.id])
  /*
   * 가까운 순. 오늘의 픽과 추천에 이미 나온 매장은 뺀다.
   * 비회원은 라멘로그·평점이 모두 0이라 추천 정렬이 거리순으로 무너지는데,
   * 그때 걸러 내지 않으면 같은 다섯 곳이 두 섹션에 같은 순서로 나온다.
   */
  const nearby = useMemo(() => {
    const shown = new Set(recommendations.map((item) => item.shop.id))
    return shops
      .filter((shop) => shop.id !== todayPick?.id && !shown.has(shop.id))
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, 5)
  }, [recommendations, shops, todayPick?.id])
  const [topRecommendation, ...otherRecommendations] = recommendations
  const recommendTitle = personal && currentUser ? `${currentUser.nickname}님이 좋아할 라멘집` : "처음이라면 여기부터"
  const recommendMeta = personal ? `${tasteIdentity.data.total}그릇 취향 기준` : null
  const today = seoulToday()
  const lastBowl = bowls.data[0]
  const monthKey = seoulMonthKey()
  const monthCount = loggedIn ? bowls.data.filter((bowl) => monthKeyOfDate(bowl.date) === monthKey).length : 0
  const lastRecorded = lastBowl ? daysSince(lastBowl.date, today) : null
  const statusLine = lastBowl
    ? `이번 달 ${monthCount}그릇 · 마지막 기록 ${lastRecorded === 0 ? "오늘" : `${lastRecorded}일 전`}`
    : "아직 기록이 없어요 · 첫 그릇을 남겨 보세요"


  /** 라운지 미리보기: 최신 공개 기록 중 사진이 있는 것. 오늘의 픽 매장은 반복하지 않는다 */
  const loungeFeed = useLoungeLogs({ type: "전체", sort: "latest", pageSize: 12 })
  const loungePreview = useMemo(
    () => loungeFeed.data.filter((log) => logPhoto(log) && log.shop.id !== todayPick?.id).slice(0, 5),
    [loungeFeed.data, todayPick?.id],
  )

  // 홈이 부르는 것(매장·오늘의 큐레이션·내 기록·라운지 미리보기·오늘 식권)을 다 받으면 앱을 켤 때 덮어 둔 화면을 걷는다.
  // 늦으면 덮개가 정한 최대 시간 뒤에 그냥 연다
  const homeLoading = shopsQuery.isLoading || curation.isLoading || bowls.isLoading || tasteProfile.isLoading || loungeFeed.isLoading || !ticketsSettled
  useEffect(() => {
    if (!homeLoading) markLaunchReady()
  }, [homeLoading])
  const pickCatalog = todayPick ? catalogOf(todayPick) : {}
  const pickMeta = todayPick
    ? curation.remote
      ? [curation.data?.title, todayPick.distanceM > 0 ? formatDistance(todayPick.distanceM) : null].filter(Boolean).join(" · ")
      : [pickCatalog.spec, formatDistance(todayPick.distanceM)].filter(Boolean).join(" · ")
    : ""
  const pickAiSummary = curation.remote ? "" : todayPick?.aiSummary?.text.trim() || ""
  const pickQuote = curation.remote ? curation.data?.reason?.trim() || "" : pickAiSummary || todayPick?.description?.trim() || ""
  // 서버의 오늘의 큐레이션 이유는 AI가 쓴 요약이라 기본으로 "AI가 요약했어요"를 붙인다.
  // 데모 원장에서는 AI 요약이 있을 때만 붙이고, 매장 설명을 그대로 보일 때는 붙이지 않는다
  const pickByAi = curation.remote ? Boolean(pickQuote) : Boolean(pickAiSummary)
  const pickDateLabel = formatPickDate(today)
  const curatorPhoto = recommendations.find(({ shop }) => shop.photos[0] && shop.photos[0] !== todayPick?.photos[0])?.shop.photos[0]
    ?? todayPick?.photos[1]
    ?? todayPick?.photos[0]

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: spacing.x8 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, width < 380 && styles.compactHeader]} testID="home-header">
          <View style={styles.brand}>
            <Image accessibilityIgnoresInvertColors accessible={false} source={require("@/assets/images/logo.png")} style={styles.logo} />
            <View style={styles.flexShrink}>
              <AppText
                accessibilityLabel="RAOTA"
                accessibilityRole="header"
                maxFontSizeMultiplier={maxFontScale}
                numberOfLines={1}
                style={styles.wordmark}
                variant="screenTitle"
              >
                RAOTA<AppText style={styles.wordmark} tone="brand" variant="screenTitle">.</AppText>
              </AppText>
              <AppText capScale numberOfLines={1} style={styles.bold} tone="sub" variant="meta">
                나의 라멘 취향을 찾는 곳
              </AppText>
            </View>
          </View>
          {loggedIn && currentUser ? (
            <Pressable
              accessibilityHint="마이 탭으로 가요"
              accessibilityLabel={`${currentUser.nickname}님, 내 정보`}
              accessibilityRole="button"
              onPress={() => router.navigate("/native/my")}
              style={({ pressed }) => [styles.account, pressed && styles.pressedWash]}
            >
              <AppText capScale numberOfLines={1} style={[styles.bold, styles.flexShrink]} variant="secondary">
                {currentUser.nickname}<AppText style={styles.accountSuffix} tone="sub" variant="secondary">님</AppText>
              </AppText>
              <ChevronRight color={colors.inkSub} size={16} />
            </Pressable>
          ) : (
            <View style={styles.authRow}>
              <Pressable
                accessibilityLabel="로그인"
                accessibilityRole="button"
                onPress={() => router.push("/auth/login")}
                style={({ pressed }) => [styles.loginButton, pressed && styles.pressedWash]}
              >
                <AppText capScale style={styles.bold} variant="secondary">로그인</AppText>
              </Pressable>
              <Pressable
                accessibilityLabel="회원가입"
                accessibilityRole="button"
                onPress={() => router.push({ pathname: "/auth/login", params: { mode: "signup" } })}
                style={({ pressed }) => [styles.signupButton, pressed && styles.pressedWash]}
              >
                <AppText capScale style={styles.bold} variant="secondary">회원가입</AppText>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.hero} testID="home-hero">
          <AppText accessibilityRole="header" lineBreakStrategyIOS="hangul-word" style={styles.heroTitle} variant="headline">
            {`오늘 ${mealOfNow()}은\n어떤 라멘으로 할까요?`}
          </AppText>
          <View style={styles.statusSlot}>
            {loggedIn && currentUser ? (
              <Pressable
                accessibilityHint="마이 탭에서 기록을 봐요"
                accessibilityLabel={statusLine}
                accessibilityRole="button"
                onPress={() => router.navigate("/native/my")}
                style={({ pressed }) => [styles.statusLine, pressed && styles.pressedWash]}
              >
                <AppText capScale numberOfLines={1} style={[styles.bold, styles.statusText]} tone="sub" variant="secondary">
                  {statusLine}
                </AppText>
                <ChevronRight color={colors.inkSub} size={16} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <Pressable
          accessibilityHint={ticketsUsedUp ? "오늘 뽑은 식권을 다시 볼 수 있어요" : "국물과 상황을 골라 오늘의 한 그릇을 추천받아요"}
          accessibilityLabel={ticketsUsedUp ? "오늘 뭐 먹지? AI 라멘 큐레이터, 오늘 식권을 다 뽑았어요" : "오늘 뭐 먹지? AI 라멘 큐레이터"}
          accessibilityRole="button"
          // 오늘 식권을 다 뽑았으면 큐레이터에 들이지 않고 뽑아 둔 식권을 연다(사용자 결정, 2026.10.23)
          onPress={() => (ticketsUsedUp ? setTicketsOpen(true) : router.push("/ai-recommend"))}
          testID="home-curator"
          style={({ pressed }) => [styles.curator, pressed && styles.pressedWash]}
        >
          {({ pressed }) => (
            <>
              <View style={styles.curatorCopy}>
                <AppText lineBreakStrategyIOS="hangul-word" style={styles.curatorTitle} variant="sectionTitle">
                  오늘 뭐 먹지?
                </AppText>
                <AppText lineBreakStrategyIOS="hangul-word" style={styles.curatorSub} tone="sub" variant="secondary">
                  {ticketsUsedUp ? `오늘 식권 ${todayTickets.dailyLimit}장을 다 뽑았어요. 내일 다시 채워져요` : "국물과 상황에 맞는 오늘의 한 그릇 추천"}
                </AppText>
                <View style={[styles.curatorButton, ticketsUsedUp && styles.curatorButtonDone, pressed && (ticketsUsedUp ? styles.curatorButtonDonePressed : styles.curatorButtonPressed)]}>
                  <AppText capScale style={styles.bold} tone={ticketsUsedUp ? "ink" : "onDark"} variant="secondary">
                    {ticketsUsedUp ? "뽑은 식권 보기" : "AI 추천받기"}
                  </AppText>
                </View>
              </View>
              <View style={styles.curatorPhoto}>
                <ResilientUriImage accessibilityLabel="" style={StyleSheet.absoluteFill} uri={curatorPhoto} />
              </View>
            </>
          )}
        </Pressable>
        {todayTickets?.tickets.length && !ticketsUsedUp ? (
          // 카드 안에 넣으면 버튼 안의 버튼이 되므로 카드 바로 아래 한 줄로 둔다. 다 뽑았으면 카드가 대신 연다
          <Pressable
            accessibilityHint="오늘 뽑은 식권을 골라 다시 볼 수 있어요"
            accessibilityLabel={`오늘 뽑은 식권 ${todayTickets.tickets.length}장, 남은 식권 ${todayTickets.remaining}장`}
            accessibilityRole="button"
            onPress={() => setTicketsOpen(true)}
            style={({ pressed }) => [styles.ticketLine, pressed && styles.pressedWash]}
            testID="home-tickets"
          >
            <Ticket color={colors.ink} size={16} />
            <AppText capScale style={[styles.bold, styles.flexShrink]} variant="secondary">
              {`오늘 뽑은 식권 ${todayTickets.tickets.length}장`}
              <AppText capScale tone="sub" variant="secondary">
                {` · 남은 식권 ${todayTickets.remaining}장`}
              </AppText>
            </AppText>
            <View style={styles.flex} />
            <ChevronRight color={colors.textMuted} size={16} />
          </Pressable>
        ) : null}

        {shopsQuery.isLoading ? <LoadingState label="라멘집을 불러오는 중…" /> : null}
        {shopsQuery.error ? (
          <EmptyState
            // 로컬 원장의 오류(저장소)는 다시 올려도 풀리지 않아 서버에서 읽을 때만 다시 부른다
            actionLabel={shopsQuery.remote ? "다시 불러오기" : undefined}
            description="잠시 후 다시 열어 주세요."
            onAction={onRetry}
            title="라멘집을 불러오지 못했어요"
          />
        ) : null}

        {todayPick ? (
          <View style={styles.sectionFirst} testID="home-curation">
            <SectionHead
              right={<AppText capScale style={styles.bold} tone="sub" variant="meta">{pickDateLabel}</AppText>}
              title="오늘의 큐레이션"
            />
            <Pressable
              accessibilityLabel={`오늘의 큐레이션, ${todayPick.name}${todayPick.branch ? ` ${todayPick.branch}` : ""}${pickCatalog.spec ? `, ${pickCatalog.spec}` : ""}${pickQuote ? `, ${pickByAi ? "AI가 요약했어요, " : ""}${pickQuote}` : ""}, 매장 상세 보기`}
              accessibilityRole="button"
              onPress={() => openShop(todayPick.id)}
              style={({ pressed }) => pressed && pressFade}
            >
              <View style={styles.pickPhoto}>
                <ResilientUriImage accessibilityLabel={`${todayPick.name} 대표 사진`} style={StyleSheet.absoluteFill} uri={todayPick.photos[0]} />
                {pickCatalog.style ? <View style={styles.pickType}><PhotoTypePill type={pickCatalog.style} /></View> : null}
              </View>
              <View style={styles.pickCopy}>
                <AppText lineBreakStrategyIOS="hangul-word" variant="sectionTitle">
                  {todayPick.name}
                  {todayPick.branch ? <AppText tone="muted" variant="secondary">{`  ${todayPick.branch}`}</AppText> : null}
                </AppText>
                {pickMeta ? <AppText capScale numberOfLines={1} style={styles.pickMeta} tone="muted" variant="meta">{pickMeta}</AppText> : null}
                {pickQuote ? (
                  <View style={styles.pickSummary} testID="home-curation-summary">
                    {pickByAi ? (
                      // 섹션 머리의 날짜처럼 진한 잉크 글씨로 둔다(사용자 결정, 2026.10.23)
                      <View style={styles.pickSummaryLabel}>
                        <Sparkles color={colors.ink} size={14} />
                        <AppText capScale style={styles.bold} variant="meta">AI가 요약했어요</AppText>
                      </View>
                    ) : null}
                    <AppText lineBreakStrategyIOS="hangul-word" tone="sub" variant="secondary">
                      {pickQuote}
                    </AppText>
                  </View>
                ) : null}
              </View>
            </Pressable>
          </View>
        ) : curation.remote ? (
          <View style={styles.sectionFirst} testID="home-curation">
            <SectionHead title="오늘의 큐레이션" />
            {curation.isLoading ? (
              <LoadingState label="오늘의 큐레이션을 불러오는 중…" />
            ) : (
              <EmptyState
                actionLabel={curation.error ? "다시 불러오기" : undefined}
                description={curation.error ? "잠시 후 다시 열어 주세요." : "곧 새로운 라멘집을 소개할게요."}
                onAction={onRetry}
                title={curation.error ? "오늘의 큐레이션을 불러오지 못했어요" : "오늘의 큐레이션을 준비 중이에요"}
              />
            )}
          </View>
        ) : null}

        {topRecommendation ? (
          <View style={styles.section} testID="home-recommendations">
            <SectionHead
              right={recommendMeta ? <AppText capScale tone="muted" variant="meta">{recommendMeta}</AppText> : undefined}
              title={recommendTitle}
            />
            <ScrollView
              contentContainerStyle={styles.recommendRow}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.bleed}
            >
              {[topRecommendation, ...otherRecommendations].map(({ shop, reason }, index) => {
                const type = catalogOf(shop).style
                return (
                  <Pressable
                    accessibilityLabel={`추천 ${index + 1}위, ${shop.name}${shop.branch ? ` ${shop.branch}` : ""}, ${reason}, 매장 상세 보기`}
                    accessibilityRole="button"
                    key={shop.id}
                    onPress={() => openShop(shop.id)}
                    style={({ pressed }) => [styles.recommendPin, pressed && pressFade]}
                  >
                    <View style={styles.recommendPhoto}>
                      <ResilientUriImage accessibilityLabel="" style={StyleSheet.absoluteFill} uri={shop.photos[0]} />
                      {type ? <View style={styles.recommendType}><PhotoTypePill type={type} /></View> : null}
                    </View>
                    <AppText numberOfLines={1} style={styles.pinTitle} variant="bodyStrong">
                      {shop.name}{shop.branch ? ` ${shop.branch}` : ""}
                    </AppText>
                    <AppText numberOfLines={2} style={styles.pinMeta} tone="muted" variant="meta">
                      {reason}
                    </AppText>
                  </Pressable>
                )
              })}
            </ScrollView>
          </View>
        ) : null}

        {nearby.length ? (
          <View style={styles.section} testID="home-nearby">
            <SectionHead
              right={
                <Pressable
                  accessibilityLabel="지도에서 보기"
                  accessibilityRole="button"
                  hitSlop={{ top: 8, bottom: 8 }}
                  onPress={() => router.navigate("/native/map")}
                  style={({ pressed }) => [styles.mapLink, pressed && styles.pressedWash]}
                >
                  <AppText capScale style={styles.bold} tone="sub" variant="secondary">지도에서 보기</AppText>
                  <ChevronRight color={colors.inkSub} size={16} />
                </Pressable>
              }
              title={shopsQuery.remote && !origin ? "라멘집 둘러보기" : "가까운 라멘집"}
            />
            {nearby.map((shop, index) => {
              const catalog = catalogOf(shop)
              const status = statusOf(shop)
              return (
                <Pressable
                  accessibilityLabel={`${shop.name}${shop.branch ? ` ${shop.branch}` : ""}, ${shopsQuery.remote && shop.distanceM <= 0 ? "거리 정보 없음" : formatDistance(shop.distanceM)}, ${status.label}, 매장 상세 보기`}
                  accessibilityRole="button"
                  key={shop.id}
                  onPress={() => openShop(shop.id)}
                  style={({ pressed }) => [styles.nearbyRow, index < nearby.length - 1 && styles.rowDivider, pressed && styles.pressedWash]}
                >
                  <Thumb size={48} uri={shop.photos[0]} />
                  <View style={styles.rowBody}>
                    <AppText numberOfLines={1} style={styles.nearName} variant="bodyStrong">
                      {shop.name}{shop.branch ? <AppText tone="muted" variant="secondary">{` ${shop.branch}`}</AppText> : null}
                    </AppText>
                    {catalog.style || catalog.spec ? (
                      <AppText capScale numberOfLines={1} style={styles.flexShrink} tone="muted" variant="meta">
                        {[catalog.style, catalog.spec].filter(Boolean).join(" · ")}
                      </AppText>
                    ) : null}
                    <AppText capScale numberOfLines={1} tone="muted" variant="meta">
                      {`${shopsQuery.remote && shop.distanceM <= 0 ? "거리 정보 없음" : formatDistance(shop.distanceM)} · `}
                      <AppText style={status.open && styles.openStatus} tone="muted" variant="meta">{status.label}</AppText>
                    </AppText>
                  </View>
                </Pressable>
              )
            })}
          </View>
        ) : null}

        {loungePreview.length ? (
          <View style={styles.section} testID="home-lounge">
            <SectionHead
              right={
                <Pressable
                  accessibilityLabel="라운지 가기"
                  accessibilityRole="button"
                  hitSlop={{ top: 8, bottom: 8 }}
                  onPress={() => router.navigate("/native/lounge")}
                  style={({ pressed }) => [styles.mapLink, pressed && styles.pressedWash]}
                >
                  <AppText capScale style={styles.bold} tone="sub" variant="secondary">라운지 가기</AppText>
                  <ChevronRight color={colors.inkSub} size={16} />
                </Pressable>
              }
              title="라운지 새 라멘로그"
            />
            <ScrollView
              contentContainerStyle={styles.loungeRow}
              decelerationRate="fast"
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToAlignment="start"
              snapToInterval={LOUNGE_CARD + spacing.x2}
              style={styles.bleed}
            >
              {loungePreview.map((log) => (
                <Pressable
                  accessibilityLabel={`${log.author.name}의 라멘로그, ${log.shop.name} ${log.menuName}`}
                  accessibilityRole="button"
                  key={log.id}
                  onPress={() => router.push({ pathname: "/log/[logId]", params: { logId: log.id } })}
                  style={({ pressed }) => [styles.loungePin, pressed && pressFade]}
                >
                  <View style={styles.loungePhoto}>
                    <ResilientUriImage accessibilityLabel="" style={StyleSheet.absoluteFill} uri={logPhoto(log) ?? undefined} />
                    <View style={styles.loungeType}><PhotoTypePill type={log.ramenType} /></View>
                  </View>
                  <AppText numberOfLines={1} style={styles.pinTitle} variant="bodyStrong">
                    {log.note.trim() || log.menuName}
                  </AppText>
                  <AppText numberOfLines={1} style={styles.pinMeta} tone="muted" variant="meta">
                    {`${log.author.name} · ${log.shop.name}`}
                  </AppText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>
      {/* 추천 단계로 넘어가지 않고 홈 위에서 고른다. 고른 식권만 그 결과 화면으로 연다 */}
      <TodayTicketsSheet
        onClose={() => setTicketsOpen(false)}
        onSelect={(ticket) => {
          setTicketsOpen(false)
          router.push({ pathname: "/ai-recommend", params: { ticket: ticket.id } })
        }}
        today={todayTickets}
        visible={ticketsOpen}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1, minWidth: 0 },
  flexShrink: { flexShrink: 1, minWidth: 0 },
  bold: { fontWeight: "700" },
  onPhotoText: { fontWeight: "700", color: colors.onPhotoPill },
  pressedWash: { backgroundColor: colors.surfacePressed },
  openStatus: { color: colors.open },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.x2,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.x4,
    paddingBottom: 0,
  },
  compactHeader: { flexDirection: "column", alignItems: "stretch" },
  brand: { flexDirection: "row", alignItems: "center", gap: spacing.x2, flexShrink: 1, minWidth: 0 },
  logo: { width: 36, height: 36, resizeMode: "contain" },
  wordmark: { fontWeight: "700", letterSpacing: -0.4 },
  account: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x1,
    minHeight: touchTarget,
    paddingHorizontal: spacing.x2,
    flexShrink: 1,
    alignSelf: "flex-end",
  },
  accountSuffix: { fontWeight: "600" },
  authRow: { flexDirection: "row", gap: spacing.x2, alignSelf: "flex-end" },
  // 누를 때 깔리는 회색(pressedWash)이 각진 네모로 보이지 않게 옆의 회원가입과 같은 반경을 준다
  loginButton: { minHeight: touchTarget, justifyContent: "center", paddingHorizontal: spacing.x3, borderRadius: radii.sm },
  signupButton: {
    minHeight: touchTarget,
    justifyContent: "center",
    paddingHorizontal: spacing.x3,
    borderRadius: radii.sm,
    backgroundColor: colors.canvasSoft,
  },
  // 로고 줄과 인사말이 붙어 보이지 않게 한 줄쯤 띄운다
  hero: { paddingHorizontal: spacing.gutter, paddingTop: spacing.x5 },
  heroTitle: { alignSelf: "flex-start" },
  statusSlot: { height: touchTarget, marginTop: spacing.x1_5 },
  statusLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x1,
    height: touchTarget,
  },
  statusText: { flex: 1, minWidth: 0 },
  curator: {
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    minHeight: 180,
    marginHorizontal: spacing.gutter,
    marginTop: spacing.x4,
    borderRadius: radii.lg,
    backgroundColor: colors.canvasSoft,
  },
  curatorCopy: { flex: 1, minWidth: 0, paddingLeft: spacing.x5, paddingRight: spacing.x4, paddingVertical: spacing.x5 },
  curatorTitle: { fontSize: 20, lineHeight: 25 },
  curatorSub: { marginTop: spacing.x1_5 },
  curatorButton: {
    minHeight: touchTarget,
    marginTop: spacing.x3,
    paddingHorizontal: 18,
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
  },
  curatorPhoto: { width: 112, height: 132, marginRight: spacing.x4, borderRadius: radii.sm, overflow: "hidden", backgroundColor: colors.canvasSoft },
  curatorButtonPressed: { backgroundColor: colors.brandPressed },
  // 오늘 식권을 다 뽑은 뒤의 버튼은 빨강이 아니다(누르면 뽑아 둔 식권을 볼 뿐이다)
  curatorButtonDone: { backgroundColor: colors.secondary },
  curatorButtonDonePressed: { backgroundColor: colors.secondaryPressed },
  ticketLine: {
    minHeight: touchTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x2,
    marginHorizontal: spacing.gutter,
    marginTop: spacing.x2,
    // 카드 글자(curatorCopy paddingLeft)와 같은 선에서 시작한다
    paddingHorizontal: spacing.x5,
    borderRadius: radii.sm,
  },
  sectionFirst: { paddingHorizontal: spacing.gutter, paddingTop: spacing.section },
  section: { paddingHorizontal: spacing.gutter, paddingTop: spacing.section },
  sectionHead: { flexDirection: "row", alignItems: "baseline", gap: spacing.x2, marginBottom: spacing.x3 },
  sectionTitle: { flex: 1, minWidth: 0, fontSize: 21, lineHeight: 26 },
  bleed: { marginHorizontal: -spacing.gutter },
  photoTypePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.photoPill,
  },
  pickPhoto: { width: "100%", height: 182, borderRadius: radii.lg, overflow: "hidden", backgroundColor: colors.canvasSoft },
  pickType: { position: "absolute", bottom: 10, left: 10 },
  pickCopy: { paddingTop: spacing.x3 },
  pickMeta: { marginTop: spacing.x1_5 },
  pickSummary: { marginTop: spacing.x3, padding: spacing.x4, borderRadius: radii.sm, backgroundColor: colors.canvasSoft },
  pickSummaryLabel: { flexDirection: "row", alignItems: "center", gap: spacing.x1_5, marginBottom: spacing.x2 },
  recommendRow: { paddingHorizontal: spacing.gutter, gap: spacing.grid },
  recommendPin: { width: RECOMMEND_CARD },
  recommendPhoto: { width: RECOMMEND_CARD, height: 103, borderRadius: radii.sm, overflow: "hidden", backgroundColor: colors.canvasSoft },
  recommendType: { position: "absolute", bottom: 7, left: 7 },
  pinTitle: { marginTop: spacing.x2, fontSize: 14, lineHeight: 18, paddingHorizontal: spacing.x1 },
  pinMeta: { marginTop: spacing.x1, paddingHorizontal: spacing.x1 },
  nearbyRow: { flexDirection: "row", alignItems: "center", gap: spacing.x3, paddingVertical: spacing.x2_5 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  thumb: { borderRadius: radii.sm, overflow: "hidden" },
  rowBody: { flex: 1, minWidth: 0, gap: spacing.x1 },
  nearName: { fontSize: 14, lineHeight: 19 },
  mapLink: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", gap: 4, marginVertical: -8 },
  loungeRow: { paddingHorizontal: spacing.gutter, gap: spacing.grid },
  loungePin: { width: LOUNGE_CARD },
  loungePhoto: { width: LOUNGE_CARD, height: 164, borderRadius: radii.sm, overflow: "hidden", backgroundColor: colors.canvasSoft },
  loungeType: { position: "absolute", bottom: 8, left: 8 },
})
