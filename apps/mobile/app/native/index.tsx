import * as Location from "expo-location"
import { router } from "expo-router"
import { ChevronRight, Heart, MessageCircle, Sparkles } from "lucide-react-native"
import { useEffect, useMemo, useState } from "react"
import { Image, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { monthKeyOfDate, seoulMonthKey, seoulToday, type RamenLog, type Shop, type ShopCatalogItem, type TasteIdentity, type TasteProfile } from "@raota/shared"
import RecordFab from "@/src/components/RecordFab"
import { ResilientUriImage } from "@/src/components/ResilientUriImage"
import { AppText, LoadingState, RamenTypeTag, Sticker } from "@/src/components/ui"
import { useLoungeLogs, useMyBowls, useShops, useTasteIdentity, useTasteProfile } from "@/src/data/hooks"
import { rankShopsForAIRecommendation } from "@/src/domain/ai-recommendation"
import { distanceBetweenCoordinates } from "@/src/domain/shops"
import { useRaota } from "@/src/state/RaotaStore"
import { colors, line, maxFontScale, pressFade, pressInto, radii, shadows, spacing, touchTarget } from "@/src/theme"
import { MENU_OPTIONS } from "./map.web"

/** 떠 있는 기록 버튼(56pt)과 여백만큼 목록 끝을 비워 마지막 줄을 가리지 않는다 */
/** 목록 끝이 오른쪽 아래 기록 버튼에 가리지 않을 여백. "더 보기" 줄이 있으면 그 줄이 대신 자리를 채운다 */
const FAB_CLEARANCE = 96

/** 원장의 표시용 필드(스타일, 한 줄 특징). API 응답에 없으면 빈 문자열 */
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

/** 서울 시각으로 지금이 어느 끼니인지. 인사 문구에만 쓴다 */
function mealOfNow(now = new Date()) {
  const hour = (now.getUTCHours() + 9) % 24
  if (hour >= 5 && hour < 11) return "아침"
  if (hour >= 11 && hour < 16) return "점심"
  if (hour >= 16 && hour < 22) return "저녁"
  return "야식"
}

/** "2026-09-16" → 오늘과 며칠 차이인지(서울 날짜 기준) */
function daysSince(isoDate: string, today = seoulToday()) {
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

const STYLE_TILE = 88
const LOUNGE_CARD = 232

/** "2026-09-19" → "9월 19일 (토)" */
function formatPickDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number)
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  return `${month}월 ${day}일 (${weekday})`
}

/** "₩10,000 ~ ₩15,000" → "1만~1.5만원". 모양이 다르면 원문 그대로 */
function compactPriceRange(range: string) {
  const amounts = range.match(/[\d,]+/g)?.map((part) => Number(part.replace(/,/g, "")))
  if (!amounts?.length || amounts.some((amount) => !Number.isFinite(amount) || amount < 1000)) return range
  const man = (amount: number) => `${Number((amount / 10000).toFixed(1))}만`
  return `${amounts.map(man).join("~")}원`
}

/**
 * 오늘의 픽을 고른 이유. 원장에 있는 값만 쓰고 없는 칸은 만들지 않는다.
 * TODO(API): 서버 HomeResponse.curations가 오면 큐레이터 코멘트·선정 이유로 바꾼다
 */
function pickFactsOf(shop: Shop): Array<{ label: string; value: string }> {
  const catalog = shop as Partial<ShopCatalogItem>
  const status = statusOf(shop)
  const facts = [
    { label: "영업", value: status.open && catalog.lastOrder ? `${status.label} · 라스트오더 ${catalog.lastOrder}` : status.label },
    { label: "거리", value: formatDistance(shop.distanceM) },
    { label: "가격대", value: shop.priceRange ? compactPriceRange(shop.priceRange) : undefined },
    { label: "서비스", value: shop.servicePerks?.noodleRefill ? `면 ${shop.servicePerks.noodleRefill}` : undefined },
  ]
  return facts.filter((fact): fact is { label: string; value: string } => Boolean(fact.value))
}

function openShop(shopId: number) {
  router.push({ pathname: "/shop/[shopId]", params: { shopId: String(shopId) } })
}

/** 원장 매장의 표시용 텍스트(스타일·특징·태그·소개). 추천 이유를 판정할 때 쓴다 */
function shopText(shop: Shop) {
  const catalog = catalogOf(shop)
  return [catalog.style, catalog.spec, shop.aiSummary?.text, shop.description, ...shop.tags].filter(Boolean).join(" ")
}

const SOUP_KEYS: Record<string, string[]> = {
  돈코츠: ["돈코츠", "이에케"],
  쇼유: ["쇼유"],
  시오: ["시오"],
  미소: ["미소"],
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
      if (leader && hasAny(text, SOUP_KEYS[leader] ?? [leader])) reasons.push(`${leader}를 가장 자주 드셔서`)
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
      <AppText accessibilityRole="header" style={styles.flex} variant="sectionTitle">
        {title}
      </AppText>
      {right}
    </View>
  )
}

/** 사진은 2pt 먹선. 48pt 이하 썸네일은 8pt, 그보다 크면 12pt 모서리 */
function Thumb({ uri, size }: { uri?: string; size: number }) {
  return (
    <ResilientUriImage
      accessibilityLabel=""
      style={[styles.thumb, { width: size, height: size, borderRadius: size <= 48 ? radii.md : radii.sm }]}
      uri={uri}
    />
  )
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const { currentUser } = useRaota()
  const shopsQuery = useShops()
  const tasteProfile = useTasteProfile()
  const tasteIdentity = useTasteIdentity()
  const origin = useKnownLocation()
  const loggedIn = Boolean(currentUser?.isLoggedIn)

  /** 위치가 있으면 실제 거리로 다시 계산한다 */
  const shops = useMemo(() => {
    if (!origin) return shopsQuery.data
    return shopsQuery.data.map((shop) =>
      shop.lat && shop.lng
        ? { ...shop, distanceM: Math.round(distanceBetweenCoordinates(origin, { latitude: shop.lat, longitude: shop.lng })) }
        : shop,
    )
  }, [origin, shopsQuery.data])

  /** 오늘의 픽: 원장에서 소개글과 사진이 있는 첫 매장 (웹과 같은 에디터 픽) */
  const todayPick = useMemo(
    () => shops.find((shop) => (shop.aiSummary || shop.description) && shop.photos[0]) ?? shops[0] ?? null,
    [shops],
  )
  /** 가까운 순 상위 5곳. 바로 위 오늘의 픽과 겹치지 않게 뺀다 */
  const nearby = useMemo(
    () => shops.filter((shop) => shop.id !== todayPick?.id).sort((a, b) => a.distanceM - b.distanceM).slice(0, 5),
    [shops, todayPick?.id],
  )
  /** 추천: 기록이 있는 로그인 사용자는 취향 기반 랭킹, 그 외에는 라멘로그·거리 기준 */
  const personal = loggedIn && tasteProfile.data.profile.count > 0 && Boolean(tasteIdentity.data.leader)
  /** 가까운 목록에 다 못 보여준 매장 수. 지도 탭에는 전부 있다 */
  const moreNearbyCount = Math.max(0, shops.length - (todayPick ? 1 : 0) - nearby.length)
  /** 오늘의 픽으로 이미 소개한 매장은 아래 목록에서 다시 보여주지 않는다 */
  const recommendations = useMemo(() => {
    const pool = shops.filter((shop) => shop.id !== todayPick?.id)
    return personal ? personalRecommendations(pool, tasteIdentity.data, tasteProfile.data.profile) : fallbackRecommendations(pool)
  }, [personal, shops, tasteIdentity.data, tasteProfile.data.profile, todayPick?.id])
  const [topRecommendation, ...otherRecommendations] = recommendations
  const recommendTitle = personal && currentUser ? `${currentUser.nickname}님이 좋아할 라멘집` : "처음이라면 여기부터"
  const recommendMeta = personal ? `${tasteIdentity.data.total}그릇 취향 기준` : "라멘로그 · 거리 기준"

  const compactHeader = width < 360
  const bowls = useMyBowls()
  const monthKey = seoulMonthKey()
  const monthCount = bowls.data.filter((bowl) => monthKeyOfDate(bowl.date) === monthKey).length
  const lastBowl = bowls.data[0]
  const statusLine = lastBowl
    ? `이번 달 ${monthCount}그릇 · 마지막 기록 ${daysSince(lastBowl.date) === 0 ? "오늘" : `${daysSince(lastBowl.date)}일 전`}`
    : "아직 기록이 없어요 · 첫 그릇을 남겨 보세요"

  /** 스타일로 찾기: 지도 메뉴 필터와 같은 기준으로 매장이 있는 스타일만, 사진은 그 스타일 첫 매장의 대표 사진 */
  const styleTiles = useMemo(
    () =>
      MENU_OPTIONS.filter((option) => option.value !== "ALL").flatMap((option) => {
        const matches = shops.filter((shop) => {
          const catalog = catalogOf(shop)
          return option.keys.some(
            (key) => (catalog.style ?? "").includes(key) || (catalog.spec ?? "").includes(key) || shop.tags.some((tag) => tag.includes(key)),
          )
        })
        const photo = matches.find((shop) => shop.photos[0])?.photos[0]
        return photo ? [{ value: option.value, label: option.short, count: matches.length, photo }] : []
      }),
    [shops],
  )

  /** 라운지 미리보기: 최신 공개 기록 중 사진이 있는 것. 오늘의 픽 매장은 반복하지 않는다 */
  const loungeFeed = useLoungeLogs({ type: "전체", sort: "latest", pageSize: 12 })
  const loungePreview = useMemo(
    () => loungeFeed.data.filter((log) => logPhoto(log) && log.shop.id !== todayPick?.id).slice(0, 5),
    [loungeFeed.data, todayPick?.id],
  )
  const pickCatalog = todayPick ? catalogOf(todayPick) : {}
  const pickFacts = todayPick ? pickFactsOf(todayPick) : []
  const pickDateLabel = formatPickDate(seoulToday())

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: moreNearbyCount > 0 ? spacing.x8 : FAB_CLEARANCE }}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. 헤더: 로고 · 인사 (MVP에는 알림 벨이 없다) */}
        <View style={styles.header}>
          <View style={styles.brand}>
            <Image accessibilityIgnoresInvertColors source={require("@/assets/images/logo.png")} style={styles.logo} />
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

          {loggedIn && currentUser ? null : (
            <View style={styles.authRow}>
              <Pressable
                accessibilityLabel="로그인"
                accessibilityRole="button"
                onPress={() => router.push("/auth/login")}
                style={({ pressed }) => [styles.loginButton, pressed && styles.pressedInto]}
              >
                <AppText capScale style={styles.bold} variant="secondary">
                  로그인
                </AppText>
              </Pressable>
              {compactHeader ? null : (
                <Pressable
                  accessibilityLabel="회원가입"
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: "/auth/login", params: { mode: "signup" } })}
                  style={({ pressed }) => [styles.signupButton, pressed && styles.pressedInto]}
                >
                  <AppText capScale style={styles.bold} tone="onDark" variant="secondary">
                    회원가입
                  </AppText>
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* 1-1. 인사: 지금 끼니에 맞춘 한 줄과 내 기록 현황(회원) */}
        <View style={styles.hero}>
          {loggedIn && currentUser ? (
            <AppText numberOfLines={1} style={styles.bold} tone="sub" variant="secondary">
              {`${currentUser.nickname}님, 반갑습니다`}
            </AppText>
          ) : null}
          <AppText accessibilityRole="header" style={styles.heroTitle} variant="headline">
            {`오늘 ${mealOfNow()}은\n어떤 라멘으로 할까요?`}
          </AppText>
          {loggedIn && currentUser ? (
            <Pressable
              accessibilityHint="마이 탭에서 기록을 봐요"
              accessibilityLabel={statusLine}
              accessibilityRole="button"
              onPress={() => router.navigate("/native/my")}
              style={({ pressed }) => [styles.statusLine, pressed && styles.pressedWash]}
            >
              <AppText capScale numberOfLines={1} style={[styles.bold, styles.flexShrink]} tone="sub" variant="secondary">
                {statusLine}
              </AppText>
              <ChevronRight color={colors.inkSub} size={16} />
            </Pressable>
          ) : null}
        </View>

        {/* 2. AI 라멘 큐레이터 배너 */}
        <View style={styles.bannerWrap}>
          <Pressable
            accessibilityHint="국물과 상황을 골라 오늘의 한 그릇을 추천받아요"
            accessibilityLabel="오늘 뭐 먹지? AI 라멘 큐레이터"
            accessibilityRole="button"
            onPress={() => router.push("/ai-recommend")}
            style={({ pressed }) => [styles.banner, pressed && styles.pressedInto3]}
          >
            <View style={styles.bannerIcon}>
              <Sparkles color={colors.brand} size={20} />
            </View>
            <View style={styles.flex}>
              <AppText lineBreakStrategyIOS="hangul-word" tone="onDark" variant="cardTitle">
                오늘 뭐 먹지? AI 라멘 큐레이터
              </AppText>
              <AppText lineBreakStrategyIOS="hangul-word" style={[styles.bold, styles.bannerBody]} tone="onDark" variant="secondary">
                국물과 상황에 맞는 오늘의 한 그릇 추천
              </AppText>
            </View>
            <ChevronRight color={colors.onDark} size={20} />
          </Pressable>
        </View>

        {shopsQuery.isLoading ? <LoadingState label="라멘집을 불러오는 중…" /> : null}

        {/* 2-1. 스타일로 찾기: 사진 타일을 가로로 넘기고, 누르면 지도 탭이 그 메뉴로 걸러진다 */}
        {styleTiles.length ? (
          <View style={styles.sectionFirst}>
            <SectionHead title="스타일로 찾기" />
            <ScrollView
              contentContainerStyle={styles.tileRow}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.bleed}
            >
              {styleTiles.map((tile) => (
                <Pressable
                  accessibilityHint="지도 탭에서 이 스타일만 보여줘요"
                  accessibilityLabel={`${tile.label} 라멘집 ${tile.count}곳`}
                  accessibilityRole="button"
                  key={tile.value}
                  onPress={() => router.navigate({ pathname: "/native/map", params: { menu: tile.value } })}
                  style={({ pressed }) => [styles.tile, pressed && pressFade]}
                >
                  <View style={styles.tilePhoto}>
                    <ResilientUriImage accessibilityLabel="" style={StyleSheet.absoluteFill} uri={tile.photo} />
                  </View>
                  <RamenTypeTag style={styles.tileTag} type={tile.label} />
                  <AppText capScale style={styles.tileLabel} tone="sub" variant="meta">
                    {`${tile.count}곳`}
                  </AppText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* 3. 오늘의 픽: 목록 카드와 다르게 잡지 한 면처럼 보인다(날짜 · 사진 · 이름 · 소개 인용 · 고른 이유) */}
        {todayPick ? (
          <View style={styleTiles.length ? styles.section : styles.sectionFirst}>
            <SectionHead
              right={
                <AppText capScale style={styles.bold} tone="sub" variant="meta">
                  {pickDateLabel}
                </AppText>
              }
              title="오늘의 큐레이션"
            />
            <Pressable
              accessibilityLabel={`오늘의 픽, ${todayPick.name}${todayPick.branch ? ` ${todayPick.branch}` : ""}, ${pickCatalog.spec ?? ""}, 매장 상세 보기`}
              accessibilityRole="button"
              onPress={() => openShop(todayPick.id)}
              style={({ pressed }) => [styles.pickCard, pressed && pressFade]}
            >
              <View style={styles.pickPhoto}>
                <ResilientUriImage
                  accessibilityLabel={`${todayPick.name} 대표 사진`}
                  style={StyleSheet.absoluteFill}
                  uri={todayPick.photos[0]}
                />
                <Sticker label="오늘의 픽" style={styles.pickBadge} />
              </View>

              <View style={styles.pickBody}>
                <View style={styles.pickTitle}>
                  <AppText numberOfLines={2} variant="headline">
                    {todayPick.name}
                    {todayPick.branch ? (
                      <AppText tone="muted" variant="cardTitle">
                        {`  ${todayPick.branch}`}
                      </AppText>
                    ) : null}
                  </AppText>
                  {pickCatalog.style ? <RamenTypeTag type={pickCatalog.style} /> : null}
                  {pickCatalog.spec ? (
                    <AppText tone="muted" variant="secondary">
                      {pickCatalog.spec}
                    </AppText>
                  ) : null}
                </View>

                {/* 소개 인용: AI 요약이 있으면 그 글과 출처 표시, 없으면 가게가 쓴 소개 */}
                {todayPick.aiSummary || todayPick.description ? (
                  <View style={styles.pickQuote}>
                    <AppText accessible={false} style={styles.quoteMark}>
                      {"\u201C"}
                    </AppText>
                    <View style={styles.quoteBody}>
                      <AppText numberOfLines={3} style={styles.quoteText} variant="body">
                        {todayPick.aiSummary?.text ?? todayPick.description}
                      </AppText>
                      {todayPick.aiSummary ? (
                        <Sticker
                          icon={<Sparkles color={colors.ink} size={12} />}
                          label="AI가 요약했어요"
                          style={styles.quoteSource}
                        />
                      ) : null}
                    </View>
                  </View>
                ) : null}

                {pickFacts.length ? (
                  <View style={styles.facts}>
                    {pickFacts.map((fact) => (
                      <View key={fact.label} style={styles.fact}>
                        <AppText capScale tone="muted" variant="meta">
                          {fact.label}
                        </AppText>
                        <AppText numberOfLines={2} variant="bodyStrong">
                          {fact.value}
                        </AppText>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={styles.pickCta}>
                  <AppText capScale style={styles.bold} tone="brand" variant="secondary">
                    매장 상세 보기
                  </AppText>
                  <ChevronRight color={colors.brand} size={16} />
                </View>
              </View>
            </Pressable>
          </View>
        ) : null}

        {/* 4. 추천 라멘집: 홈의 정점. 차콜 면을 화면 끝까지 깔고 1위는 사진으로 크게, 2~5위는 줄로 보여준다.
            숫자 일치도 대신 추천 이유 한 줄을 쓴다 */}
        {topRecommendation ? (
          <View style={styles.recommendBand}>
            <View style={styles.recommendHead}>
              <AppText accessibilityRole="header" style={styles.flex} tone="onDark" variant="sectionTitle">
                {recommendTitle}
              </AppText>
              <AppText capScale style={styles.bold} tone="onDarkMuted" variant="meta">
                {recommendMeta}
              </AppText>
            </View>

            <Pressable
              accessibilityLabel={`추천 1위, ${topRecommendation.shop.name}${topRecommendation.shop.branch ? ` ${topRecommendation.shop.branch}` : ""}, ${topRecommendation.reason}, 매장 상세 보기`}
              accessibilityRole="button"
              onPress={() => openShop(topRecommendation.shop.id)}
              style={({ pressed }) => [styles.recommendCard, pressed && pressFade]}
            >
              <View style={styles.recommendPhoto}>
                <ResilientUriImage
                  accessibilityLabel=""
                  style={StyleSheet.absoluteFill}
                  uri={topRecommendation.shop.photos[0]}
                />
              </View>
              <View style={styles.recommendTop}>
                <View style={styles.rankBadge}>
                  <AppText capScale style={styles.tabular} variant="sectionTitle">
                    1
                  </AppText>
                </View>
                <View style={styles.rowBody}>
                  <AppText numberOfLines={1} variant="screenTitle">
                    {topRecommendation.shop.name}
                    {topRecommendation.shop.branch ? (
                      <AppText tone="muted" variant="secondary">
                        {`  ${topRecommendation.shop.branch}`}
                      </AppText>
                    ) : null}
                  </AppText>
                  <AppText numberOfLines={2} style={styles.rowSub} tone="muted" variant="secondary">
                    {topRecommendation.reason}
                  </AppText>
                </View>
                <ChevronRight color={colors.textMuted} size={20} />
              </View>
            </Pressable>

            {otherRecommendations.map(({ shop, reason }, index) => (
              <Pressable
                accessibilityLabel={`추천 ${index + 2}위, ${shop.name}${shop.branch ? ` ${shop.branch}` : ""}, ${reason}, 매장 상세 보기`}
                accessibilityRole="button"
                key={shop.id}
                onPress={() => openShop(shop.id)}
                style={({ pressed }) => [styles.recommendRow, pressed && pressFade]}
              >
                <AppText capScale style={styles.recommendRank} tone="onDark" variant="cardTitle">
                  {index + 2}
                </AppText>
                <Thumb size={48} uri={shop.photos[0]} />
                <View style={styles.rowBody}>
                  <View style={styles.nameLine}>
                    <AppText numberOfLines={1} style={styles.flexShrink} tone="onDark" variant="cardTitle">
                      {shop.name}
                    </AppText>
                    {shop.branch ? (
                      <AppText capScale numberOfLines={1} style={styles.branch} tone="onDarkMuted" variant="meta">
                        {shop.branch}
                      </AppText>
                    ) : null}
                  </View>
                  <AppText capScale numberOfLines={1} style={styles.rowSub} tone="onDarkMuted" variant="secondary">
                    {reason}
                  </AppText>
                </View>
              </Pressable>
            ))}

            {personal ? null : (
              <AppText style={styles.recommendHint} tone="onDarkMuted" variant="secondary">
                {loggedIn ? "라멘을 기록하면 내 취향에 맞춰 추천이 바뀌어요." : "로그인하고 기록하면 내 취향에 맞춰 추천이 바뀌어요."}
              </AppText>
            )}
          </View>
        ) : null}

        {/* 4-1. 라운지 미리보기: 다른 사람들이 막 올린 라멘로그를 가로로 넘긴다 */}
        {loungePreview.length ? (
          <View style={styles.section}>
            <SectionHead
              right={
                <Pressable
                  accessibilityLabel="라운지 가기"
                  accessibilityRole="button"
                  hitSlop={{ top: 8, bottom: 8 }}
                  onPress={() => router.navigate("/native/lounge")}
                  style={({ pressed }) => [styles.mapLink, pressed && styles.pressedWash]}
                >
                  <AppText capScale style={styles.bold} tone="sub" variant="secondary">
                    라운지 가기
                  </AppText>
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
              snapToInterval={LOUNGE_CARD + spacing.x3}
              style={styles.bleed}
            >
              {loungePreview.map((log) => {
                const comments = log.comments?.length ?? log.commentCount ?? 0
                return (
                  <Pressable
                    accessibilityLabel={`${log.author.name}의 라멘로그, ${log.shop.name} ${log.menuName}, 공감 ${log.likes}, 댓글 ${comments}`}
                    accessibilityRole="button"
                    key={log.id}
                    onPress={() => router.push({ pathname: "/log/[logId]", params: { logId: String(log.id) } })}
                    style={({ pressed }) => [styles.loungeCard, pressed && pressFade]}
                  >
                    <View style={styles.loungePhoto}>
                      <ResilientUriImage accessibilityLabel="" style={StyleSheet.absoluteFill} uri={logPhoto(log) ?? undefined} />
                    </View>
                    <View style={styles.loungeBody}>
                      <View style={styles.loungeTitle}>
                        <AppText numberOfLines={1} style={styles.flexShrink} variant="cardTitle">
                          {log.menuName}
                        </AppText>
                        <RamenTypeTag type={log.ramenType} />
                      </View>
                      <AppText numberOfLines={1} tone="muted" variant="secondary">
                        {`${log.shop.name} · ${log.author.name}`}
                      </AppText>
                      <View style={styles.loungeMeta}>
                        <Heart color={colors.textMuted} size={12} />
                        <AppText capScale style={styles.tabular} tone="muted" variant="meta">
                          {log.likes}
                        </AppText>
                        <MessageCircle color={colors.textMuted} size={12} />
                        <AppText capScale style={styles.tabular} tone="muted" variant="meta">
                          {comments}
                        </AppText>
                      </View>
                    </View>
                  </Pressable>
                )
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* 5. 가까운 라멘집 (거리 순) */}
        {nearby.length ? (
          <View style={styles.section}>
            <SectionHead
              right={
                <Pressable
                  accessibilityLabel="지도에서 보기"
                  accessibilityRole="button"
                  hitSlop={{ top: 8, bottom: 8 }}
                  onPress={() => router.navigate("/native/map")}
                  style={({ pressed }) => [styles.mapLink, pressed && styles.pressedWash]}
                >
                  <AppText capScale style={styles.bold} tone="sub" variant="secondary">
                    지도에서 보기
                  </AppText>
                  <ChevronRight color={colors.inkSub} size={16} />
                </Pressable>
              }
              title="가까운 라멘집"
            />
            <View style={styles.listCard}>
              {nearby.map((shop, index) => {
                const catalog = catalogOf(shop)
                const status = statusOf(shop)
                return (
                  <Pressable
                    accessibilityLabel={`${shop.name}${shop.branch ? ` ${shop.branch}` : ""}, ${formatDistance(shop.distanceM)}, ${status.label}, 매장 상세 보기`}
                    accessibilityRole="button"
                    key={shop.id}
                    onPress={() => openShop(shop.id)}
                    style={({ pressed }) => [styles.row, index > 0 && styles.rowDivider, pressed && styles.pressedWash]}
                  >
                    <AppText capScale style={styles.index} tone="muted" variant="secondary">
                      {String(index + 1).padStart(2, "0")}
                    </AppText>
                    <Thumb size={56} uri={shop.photos[0]} />
                    <View style={styles.rowBody}>
                      <View style={styles.nameLine}>
                        <AppText numberOfLines={1} style={styles.flexShrink} variant="cardTitle">
                          {shop.name}
                        </AppText>
                        {shop.branch ? (
                          <AppText capScale numberOfLines={1} style={styles.branch} tone="muted" variant="meta">
                            {shop.branch}
                          </AppText>
                        ) : null}
                      </View>
                      {catalog.style || catalog.spec ? (
                        <View style={styles.typeLine}>
                          {/* 줄이 다섯 개 이어지는 목록이라 종류는 굵은 먹색 글씨로 쓴다. 노랑은 오늘의 픽·스타일 타일 쪽에 남겨 둔다 */}
                          {catalog.style ? <RamenTypeTag inList style={styles.typeName} type={catalog.style} /> : null}
                          {catalog.spec ? (
                            <AppText capScale numberOfLines={1} style={styles.flexShrink} tone="muted" variant="secondary">
                              {catalog.spec}
                            </AppText>
                          ) : null}
                        </View>
                      ) : null}
                      <View style={styles.metaLine}>
                        <AppText capScale style={styles.bold} variant="meta">
                          {formatDistance(shop.distanceM)}
                        </AppText>
                        <AppText aria-hidden capScale style={styles.dot} variant="meta">
                          ·
                        </AppText>
                        <AppText capScale style={styles.bold} tone={status.open ? "positive" : "muted"} variant="meta">
                          {`● ${status.label}`}
                        </AppText>
                      </View>
                    </View>
                  </Pressable>
                )
              })}
            </View>
            {moreNearbyCount > 0 ? (
              <Pressable
                accessibilityLabel={`라멘집 ${moreNearbyCount}곳 더 지도에서 보기`}
                accessibilityRole="button"
                onPress={() => router.navigate("/native/map")}
                style={({ pressed }) => [styles.moreNearby, pressed && styles.pressedInto]}
              >
                <AppText capScale style={styles.bold} variant="secondary">
                  {`라멘집 ${moreNearbyCount}곳 더 지도에서 보기`}
                </AppText>
                <ChevronRight color={colors.ink} size={16} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <RecordFab />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, position: "relative", backgroundColor: colors.paper },
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1, minWidth: 0 },
  bold: { fontWeight: "700" },
  // 흰 면의 카드·목록 행은 canvasSoft 배경으로, 사진이 깔린 것과 먹색 면 위의 행은 pressFade로 누른다
  pressedWash: { backgroundColor: colors.canvasSoft },
  // 그림자가 있는 키는 누르면 그림자 속으로 들어간다
  pressedInto: pressInto(2),
  pressedInto3: pressInto(3),

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.x2,
    paddingLeft: spacing.x4,
    paddingRight: spacing.x3,
    paddingVertical: spacing.x2_5,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.paper,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: spacing.x2_5, flexShrink: 1, minWidth: 0 },
  logo: {
    width: 36,
    height: 36,
    resizeMode: "contain",
    borderRadius: radii.sm,
    borderWidth: line.base,
    borderColor: colors.outline,
    backgroundColor: colors.canvas,
  },
  wordmark: { lineHeight: 22, letterSpacing: -0.4 },
  greeting: { minHeight: touchTarget, justifyContent: "center", paddingHorizontal: spacing.x2, flexShrink: 1 },
  // 키 두 개가 2pt 그림자 때문에 붙어 보이지 않게 간격을 8pt로 둔다
  authRow: { flexDirection: "row", alignItems: "center", gap: spacing.x2 },
  loginButton: {
    minHeight: touchTarget,
    justifyContent: "center",
    paddingHorizontal: spacing.x3,
    borderRadius: radii.sm,
    borderWidth: line.base,
    borderColor: colors.outline,
    backgroundColor: colors.canvas,
    ...shadows.hardS,
  },
  signupButton: {
    minHeight: touchTarget,
    justifyContent: "center",
    paddingHorizontal: spacing.x3,
    borderRadius: radii.sm,
    borderWidth: line.base,
    borderColor: colors.outline,
    backgroundColor: colors.brand,
    ...shadows.hardS,
  },

  hero: { paddingHorizontal: spacing.gutter, paddingTop: spacing.x5, gap: spacing.x1 },
  heroTitle: { marginTop: spacing.x0_5 },
  statusLine: { flexDirection: "row", alignItems: "center", gap: spacing.x0_5, minHeight: touchTarget, alignSelf: "flex-start", marginBottom: -spacing.x2 },
  bannerWrap: { paddingHorizontal: spacing.gutter, paddingTop: spacing.x4 },
  // 가로로 넘기는 줄은 좌우 여백 밖까지 흐르고, 첫 칸만 여백에 맞춘다
  bleed: { marginHorizontal: -spacing.gutter },
  tileRow: { paddingHorizontal: spacing.gutter, gap: spacing.x3 },
  tile: { width: STYLE_TILE },
  tilePhoto: {
    width: STYLE_TILE,
    height: STYLE_TILE,
    borderRadius: radii.sm,
    borderWidth: line.base,
    borderColor: colors.outline,
    overflow: "hidden",
    backgroundColor: colors.canvasSoft,
  },
  tileTag: { alignSelf: "center", marginTop: spacing.x2 },
  tileLabel: { marginTop: spacing.x1, textAlign: "center" },
  loungeRow: { paddingHorizontal: spacing.gutter, gap: spacing.x3 },
  loungeCard: {
    width: LOUNGE_CARD,
    borderRadius: radii.sm,
    borderWidth: line.base,
    borderColor: colors.outline,
    overflow: "hidden",
    backgroundColor: colors.canvas,
  },
  // 카드 테두리 안쪽이므로 폭은 100%로 둔다(고정 폭이면 2pt만큼 잘린다)
  loungePhoto: {
    width: "100%",
    height: 156,
    borderBottomWidth: line.base,
    borderBottomColor: colors.outline,
    backgroundColor: colors.canvasSoft,
  },
  loungeBody: { padding: spacing.x3 },
  loungeTitle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.x2 },
  loungeMeta: { flexDirection: "row", alignItems: "center", gap: spacing.x1, marginTop: spacing.x1 },
  tabular: { fontVariant: ["tabular-nums"] },
  // 홈에서 유일하게 3pt 그림자를 쓰는 곳(FAB와 둘뿐)
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x3,
    padding: spacing.x4,
    borderRadius: radii.xl,
    borderWidth: line.base,
    borderColor: colors.outline,
    backgroundColor: colors.brand,
    ...shadows.hardM,
  },
  bannerIcon: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radii.sm,
    borderWidth: line.base,
    borderColor: colors.outline,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvas,
  },
  bannerBody: { marginTop: spacing.x0_5 },

  sectionFirst: { paddingHorizontal: spacing.gutter, paddingTop: spacing.x6 },
  section: { paddingHorizontal: spacing.gutter, paddingTop: spacing.x7 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x2,
    paddingBottom: spacing.x2,
    marginBottom: spacing.x3,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  // 흰 카드 한 장. 사진과 글씨 영역은 2pt 먹선으로 나눈다
  pickCard: {
    borderRadius: radii.sm,
    borderWidth: line.base,
    borderColor: colors.outline,
    overflow: "hidden",
    backgroundColor: colors.canvas,
  },
  pickPhoto: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderBottomWidth: line.base,
    borderBottomColor: colors.outline,
    backgroundColor: colors.canvasSoft,
  },
  pickBadge: { position: "absolute", top: spacing.x3, left: spacing.x3 },
  pickBody: { padding: spacing.x4 },
  pickTitle: { gap: spacing.x2 },
  pickQuote: { flexDirection: "row", gap: spacing.x2, marginTop: spacing.x4 },
  // 여는 따옴표는 글자 크기로만 강조한다(장식 도형 없이)
  quoteMark: { fontSize: 36, lineHeight: 36, fontWeight: "800", marginTop: -spacing.x1 },
  quoteBody: { flex: 1 },
  quoteText: { lineHeight: 23 },
  quoteSource: { marginTop: spacing.x2 },
  facts: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.x4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  fact: {
    width: "50%",
    paddingVertical: spacing.x3,
    paddingRight: spacing.x3,
    gap: spacing.x0_5,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickCta: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: spacing.x0_5, minHeight: touchTarget },

  listCard: { borderWidth: line.base, borderColor: colors.outline, borderRadius: radii.sm, overflow: "hidden", backgroundColor: colors.canvas },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x3,
    paddingHorizontal: spacing.x3_5,
    paddingVertical: spacing.x3,
    minHeight: touchTarget,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  thumb: { borderWidth: line.base, borderColor: colors.outline },
  typeLine: { flexDirection: "row", alignItems: "center", gap: spacing.x1_5, marginTop: spacing.x1 },
  // 좁은 폭에서 줄어들 것은 한 줄 특징 쪽이다. 종류가 "시…"로 잘리면 읽을 수 없다
  typeName: { flexShrink: 0 },
  rowBody: { flex: 1, minWidth: 0 },
  nameLine: { flexDirection: "row", alignItems: "baseline", gap: spacing.x1_5, minWidth: 0 },
  branch: { fontWeight: "700", flexShrink: 0 },
  rowSub: { marginTop: spacing.x0_5 },
  recommendHint: { marginTop: spacing.x4 },
  // 차콜 면은 화면 끝까지. 위아래 여백을 넉넉히 둬 스크롤 중 한 번 쉬어 가는 자리가 된다
  recommendBand: {
    marginTop: spacing.x4,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.x6,
    paddingBottom: spacing.x5,
    backgroundColor: colors.ink,
  },
  recommendHead: { flexDirection: "row", alignItems: "baseline", gap: spacing.x2, marginBottom: spacing.x4 },
  // 먹색 면 안의 카드는 테두리 없는 흰 면
  recommendCard: { borderRadius: radii.sm, overflow: "hidden", backgroundColor: colors.canvas },
  recommendPhoto: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderBottomWidth: line.base,
    borderBottomColor: colors.outline,
    backgroundColor: colors.canvasSoft,
  },
  recommendTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x3,
    paddingHorizontal: spacing.x3_5,
    paddingVertical: spacing.x3,
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: radii.xs,
    borderWidth: line.thin,
    borderColor: colors.outline,
    backgroundColor: colors.yolk,
    alignItems: "center",
    justifyContent: "center",
  },
  // 먹색 면 안의 줄은 흰색 18% 선으로 나눈다
  recommendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x3,
    minHeight: touchTarget,
    paddingVertical: spacing.x3,
    borderTopWidth: 1,
    borderTopColor: colors.onDarkLine,
  },
  recommendRank: { width: 28, fontVariant: ["tabular-nums"] },
  metaLine: { flexDirection: "row", alignItems: "center", gap: spacing.x1_5, marginTop: spacing.x1 },
  dot: { color: colors.textFaint },
  index: { width: 20, textAlign: "center", fontWeight: "700", fontVariant: ["tabular-nums"] },
  // 왼쪽 정렬: 오른쪽 아래 기록 버튼과 겹치지 않는다
  moreNearby: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x0_5,
    minHeight: touchTarget,
    marginTop: spacing.x3,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.x4,
    borderRadius: radii.sm,
    borderWidth: line.base,
    borderColor: colors.outline,
    backgroundColor: colors.canvas,
    ...shadows.hardS,
  },
  mapLink: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", gap: spacing.x0_5, marginVertical: -spacing.x2 },

})
