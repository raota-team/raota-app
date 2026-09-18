import * as Location from "expo-location"
import { router } from "expo-router"
import { ChevronRight, Sparkles } from "lucide-react-native"
import { useEffect, useMemo, useState } from "react"
import { Image, Linking, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg"

import type { Shop, ShopCatalogItem, TasteIdentity, TasteProfile } from "@raota/shared"
import PolicySheet, { type PolicyType } from "@/src/components/PolicySheet"
import RecordFab from "@/src/components/RecordFab"
import { ResilientUriImage } from "@/src/components/ResilientUriImage"
import { AppText, LoadingState } from "@/src/components/ui"
import { useShops, useTasteIdentity, useTasteProfile } from "@/src/data/hooks"
import { rankShopsForAIRecommendation } from "@/src/domain/ai-recommendation"
import { distanceBetweenCoordinates } from "@/src/domain/shops"
import { useRaota } from "@/src/state/RaotaStore"
import { colors, maxFontScale, radii, spacing, touchTarget } from "@/src/theme"

const CONTACT_EMAIL = "contact@raota.net"
/** 떠 있는 기록 버튼(56pt)과 여백만큼 목록 끝을 비워 마지막 줄을 가리지 않는다 */
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

function openShop(shopId: number) {
  router.push({ pathname: "/shop/[shopId]", params: { shopId: String(shopId) } })
}

/** 원장 매장의 표시용 텍스트(스타일·특징·태그·소개). 추천 이유를 판정할 때 쓴다 */
function shopText(shop: Shop) {
  const catalog = catalogOf(shop)
  return [catalog.style, catalog.spec, shop.description, ...shop.tags].filter(Boolean).join(" ")
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

function Thumb({ uri, size }: { uri?: string; size: number }) {
  return (
    <ResilientUriImage
      accessibilityLabel=""
      style={[styles.thumb, { width: size, height: size }]}
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
  const [policy, setPolicy] = useState<PolicyType | null>(null)
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
  const todayPick = useMemo(() => shops.find((shop) => shop.description && shop.photos[0]) ?? shops[0] ?? null, [shops])
  /** 가까운 순 상위 5곳 */
  const nearby = useMemo(() => [...shops].sort((a, b) => a.distanceM - b.distanceM).slice(0, 5), [shops])
  /** 추천: 기록이 있는 로그인 사용자는 취향 기반 랭킹, 그 외에는 라멘로그·거리 기준 */
  const personal = loggedIn && tasteProfile.data.profile.count > 0 && Boolean(tasteIdentity.data.leader)
  const recommendations = useMemo(
    () => (personal ? personalRecommendations(shops, tasteIdentity.data, tasteProfile.data.profile) : fallbackRecommendations(shops)),
    [personal, shops, tasteIdentity.data, tasteProfile.data.profile],
  )
  const recommendTitle = personal && currentUser ? `${currentUser.nickname}님이 좋아할 라멘집` : "처음이라면 여기부터"
  const recommendMeta = personal ? `${tasteIdentity.data.total}그릇 취향 기준` : "라멘로그 · 거리 기준"

  const compactHeader = width < 360
  const pickCatalog = todayPick ? catalogOf(todayPick) : {}

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: FAB_CLEARANCE }}
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
              <AppText capScale numberOfLines={1} style={styles.bold} tone="muted" variant="meta">
                나의 라멘 취향을 찾는 곳
              </AppText>
            </View>
          </View>

          {loggedIn && currentUser ? (
            <Pressable
              accessibilityHint="마이 탭으로 이동해요"
              accessibilityLabel={`${currentUser.nickname}님, 반갑습니다`}
              accessibilityRole="button"
              onPress={() => router.navigate("/native/my")}
              style={({ pressed }) => [styles.greeting, pressed && styles.pressedDim]}
            >
              <AppText capScale numberOfLines={1} style={styles.bold} variant="secondary">
                <AppText style={styles.bold} tone="brand" variant="secondary">
                  {currentUser.nickname}
                </AppText>
                님, 반갑습니다
              </AppText>
            </Pressable>
          ) : (
            <View style={styles.authRow}>
              <Pressable
                accessibilityLabel="로그인"
                accessibilityRole="button"
                onPress={() => router.push("/auth/login")}
                style={({ pressed }) => [styles.loginButton, pressed && styles.pressedDim]}
              >
                <AppText capScale style={styles.bold} variant="secondary">
                  로그인
                </AppText>
              </Pressable>
              {compactHeader ? null : (
                <Pressable
                  accessibilityLabel="회원가입"
                  accessibilityRole="button"
                  onPress={() => router.push("/auth/onboarding")}
                  style={({ pressed }) => [styles.signupButton, pressed && styles.signupPressed]}
                >
                  <AppText capScale style={styles.bold} tone="onDark" variant="secondary">
                    회원가입
                  </AppText>
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* 2. AI 라멘 큐레이터 배너 */}
        <View style={styles.bannerWrap}>
          <Pressable
            accessibilityHint="국물과 상황을 골라 오늘의 한 그릇을 추천받아요"
            accessibilityLabel="오늘 뭐 먹지? AI 라멘 큐레이터"
            accessibilityRole="button"
            onPress={() => router.push("/ai-recommend")}
            style={({ pressed }) => [styles.banner, pressed && styles.pressedDim]}
          >
            <View style={styles.bannerIcon}>
              <Sparkles color={colors.onDark} size={20} />
            </View>
            <View style={styles.flex}>
              <AppText tone="onDark" variant="cardTitle">
                오늘 뭐 먹지? AI 라멘 큐레이터
              </AppText>
              <AppText style={styles.bannerBody} tone="onDarkMuted" variant="secondary">
                국물과 상황에 맞는 오늘의 한 그릇 추천
              </AppText>
            </View>
            <ChevronRight color={colors.onDarkMuted} size={20} />
          </Pressable>
        </View>

        {shopsQuery.isLoading ? <LoadingState label="라멘집을 불러오는 중…" /> : null}

        {/* 3. 오늘의 픽 */}
        {todayPick ? (
          <View style={styles.sectionFirst}>
            <SectionHead
              right={
                <AppText capScale style={styles.bold} tone="muted" variant="meta">
                  {[formatDistance(todayPick.distanceM), pickCatalog.style].filter(Boolean).join(" · ")}
                </AppText>
              }
              title="오늘의 큐레이션 라멘집"
            />
            <Pressable
              accessibilityLabel={`오늘의 픽, ${todayPick.name}${todayPick.branch ? ` ${todayPick.branch}` : ""}, ${pickCatalog.spec ?? ""}, 매장 상세 보기`}
              accessibilityRole="button"
              onPress={() => openShop(todayPick.id)}
              style={({ pressed }) => [styles.pickCard, pressed && styles.pressedWash]}
            >
              <View style={styles.pickPhoto}>
                <ResilientUriImage
                  accessibilityLabel={`${todayPick.name} 대표 사진`}
                  style={StyleSheet.absoluteFill}
                  uri={todayPick.photos[0]}
                />
                {/* 사진 위 글씨를 읽히게 하는 아래쪽 스크림(허용된 유일한 그라디언트) */}
                <Svg height="67%" pointerEvents="none" style={styles.scrim} width="100%">
                  <Defs>
                    <LinearGradient id="pickScrim" x1="0" x2="0" y1="0" y2="1">
                      <Stop offset="0" stopColor={colors.black} stopOpacity="0" />
                      <Stop offset="1" stopColor={colors.black} stopOpacity="0.75" />
                    </LinearGradient>
                  </Defs>
                  <Rect fill="url(#pickScrim)" height="100%" width="100%" x="0" y="0" />
                </Svg>
                <View style={styles.pickBadge}>
                  <AppText capScale style={styles.bold} variant="meta">
                    오늘의 픽
                  </AppText>
                </View>
                <View style={styles.pickCaption}>
                  {pickCatalog.spec ? (
                    <AppText numberOfLines={1} style={styles.bold} tone="onDarkMuted" variant="secondary">
                      {pickCatalog.spec}
                    </AppText>
                  ) : null}
                  <AppText numberOfLines={2} tone="onDark" variant="screenTitle">
                    {todayPick.name}
                    {todayPick.branch ? (
                      <AppText style={styles.pickBranch} tone="onDarkMuted" variant="cardTitle">
                        {` · ${todayPick.branch}`}
                      </AppText>
                    ) : null}
                  </AppText>
                </View>
              </View>
              <View style={styles.pickBody}>
                {todayPick.description ? (
                  <View style={styles.quote}>
                    <AppText variant="body">{todayPick.description}</AppText>
                  </View>
                ) : null}
                <View style={styles.pickFoot}>
                  <View style={styles.pickTags}>
                    {todayPick.tags.slice(0, 2).map((tag) => (
                      <View key={tag} style={styles.tag}>
                        <AppText capScale numberOfLines={1} style={styles.bold} variant="meta">
                          {tag}
                        </AppText>
                      </View>
                    ))}
                  </View>
                  <View style={styles.inline}>
                    <AppText capScale style={styles.bold} tone="brand" variant="secondary">
                      매장 상세 보기
                    </AppText>
                    <ChevronRight color={colors.brand} size={16} />
                  </View>
                </View>
              </View>
            </Pressable>
          </View>
        ) : null}

        {/* 4. 추천 라멘집. 숫자 일치도 대신 추천 이유 한 줄을 보여준다 */}
        {recommendations.length ? (
          <View style={styles.section}>
            <SectionHead
              right={
                <AppText capScale style={styles.bold} tone="muted" variant="meta">
                  {recommendMeta}
                </AppText>
              }
              title={recommendTitle}
            />
            <View style={styles.listCard}>
              {recommendations.map(({ shop, reason }, index) => (
                <Pressable
                  accessibilityLabel={`추천 ${index + 1}위, ${shop.name}${shop.branch ? ` ${shop.branch}` : ""}, ${reason}, 매장 상세 보기`}
                  accessibilityRole="button"
                  key={shop.id}
                  onPress={() => openShop(shop.id)}
                  style={({ pressed }) => [styles.row, index > 0 && styles.rowDivider, pressed && styles.pressedWash]}
                >
                  <View style={[styles.rank, index < 3 ? styles.rankTop : styles.rankRest]}>
                    <AppText capScale style={styles.rankText} tone={index < 3 ? "onDark" : "muted"} variant="meta">
                      {index + 1}
                    </AppText>
                  </View>
                  <Thumb size={48} uri={shop.photos[0]} />
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
                    <AppText capScale numberOfLines={1} style={styles.rowSub} tone="sub" variant="secondary">
                      {reason}
                    </AppText>
                  </View>
                </Pressable>
              ))}
            </View>
            {personal ? null : (
              <AppText style={styles.recommendHint} tone="muted" variant="secondary">
                {loggedIn ? "라멘을 기록하면 내 취향에 맞춰 추천이 바뀌어요." : "로그인하고 기록하면 내 취향에 맞춰 추천이 바뀌어요."}
              </AppText>
            )}
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
                  style={({ pressed }) => [styles.mapLink, pressed && styles.pressedDim]}
                >
                  <AppText capScale style={styles.bold} tone="muted" variant="secondary">
                    지도에서 보기
                  </AppText>
                  <ChevronRight color={colors.textMuted} size={16} />
                </Pressable>
              }
              title="가까운 라멘집"
            />
            <View style={styles.listCard}>
              {nearby.map((shop, index) => {
                const catalog = catalogOf(shop)
                const status = statusOf(shop)
                const line = [catalog.style, catalog.spec].filter(Boolean).join(" · ")
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
                      {line ? (
                        <AppText capScale numberOfLines={1} style={styles.rowSub} tone="muted" variant="secondary">
                          {line}
                        </AppText>
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
          </View>
        ) : null}

        {/* 6. 약관 · 문의 푸터 */}
        <View style={styles.footer}>
          <View accessibilityLabel="약관 및 문의" style={styles.footerLinks}>
            <Pressable
              accessibilityLabel="이용약관 보기"
              accessibilityRole="button"
              onPress={() => setPolicy("terms")}
              style={({ pressed }) => [styles.footerButton, pressed && styles.pressedDim]}
            >
              <AppText capScale style={styles.bold} tone="muted" variant="meta">
                이용약관
              </AppText>
            </Pressable>
            <AppText aria-hidden capScale style={styles.dot} variant="meta">
              ·
            </AppText>
            <Pressable
              accessibilityLabel="개인정보처리방침 보기"
              accessibilityRole="button"
              onPress={() => setPolicy("privacy")}
              style={({ pressed }) => [styles.footerButton, pressed && styles.pressedDim]}
            >
              <AppText capScale style={styles.bold} variant="meta">
                개인정보처리방침
              </AppText>
            </Pressable>
          </View>
          <Pressable
            accessibilityHint="메일 앱을 열어요"
            accessibilityLabel={`문의하기, ${CONTACT_EMAIL}`}
            accessibilityRole="link"
            onPress={() => void Linking.openURL(`mailto:${CONTACT_EMAIL}`).catch(() => undefined)}
            style={({ pressed }) => [styles.footerButton, pressed && styles.pressedDim]}
          >
            <AppText capScale style={styles.bold} tone="muted" variant="meta">
              {`문의하기 · ${CONTACT_EMAIL}`}
            </AppText>
          </Pressable>
          <AppText capScale tone="muted" variant="meta">
            © 2026 RAOTA · 라멘에 진심인 사람들
          </AppText>
        </View>
      </ScrollView>

      <PolicySheet onClose={() => setPolicy(null)} type={policy} />
      <RecordFab />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, position: "relative", backgroundColor: colors.canvas },
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1, minWidth: 0 },
  bold: { fontWeight: "700" },
  inline: { flexDirection: "row", alignItems: "center", gap: spacing.x0_5 },
  pressedDim: { opacity: 0.7 },
  pressedWash: { backgroundColor: colors.canvasSoft },

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
    backgroundColor: colors.canvas,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: spacing.x2_5, flexShrink: 1, minWidth: 0 },
  logo: { width: 36, height: 36, resizeMode: "contain" },
  wordmark: { lineHeight: 22, letterSpacing: -0.4 },
  greeting: { minHeight: touchTarget, justifyContent: "center", paddingHorizontal: spacing.x2, flexShrink: 1 },
  authRow: { flexDirection: "row", alignItems: "center", gap: spacing.x1 },
  loginButton: { minHeight: touchTarget, justifyContent: "center", paddingHorizontal: spacing.x2_5 },
  signupButton: {
    minHeight: touchTarget,
    justifyContent: "center",
    paddingHorizontal: spacing.x3,
    borderRadius: radii.sm,
    backgroundColor: colors.brand,
  },
  signupPressed: { backgroundColor: colors.brandPressed },

  bannerWrap: { paddingHorizontal: spacing.gutter, paddingTop: spacing.x4 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x3,
    padding: spacing.x4,
    borderRadius: radii.sm,
    backgroundColor: colors.ink,
  },
  bannerIcon: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
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

  pickCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, overflow: "hidden", backgroundColor: colors.canvas },
  pickPhoto: { width: "100%", aspectRatio: 4 / 3, backgroundColor: colors.canvasSoft },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0 },
  pickBadge: {
    position: "absolute",
    top: spacing.x3,
    left: spacing.x3,
    paddingHorizontal: spacing.x2_5,
    paddingVertical: spacing.x1,
    borderRadius: radii.xs,
    backgroundColor: colors.canvas,
  },
  pickCaption: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.x4, gap: spacing.x0_5 },
  pickBranch: { fontWeight: "700" },
  pickBody: { padding: spacing.x4 },
  quote: { borderLeftWidth: 1, borderLeftColor: colors.ink, paddingLeft: spacing.x3 },
  pickFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.x3,
    marginTop: spacing.x4,
    paddingTop: spacing.x3,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pickTags: { flexDirection: "row", gap: spacing.x1_5, flexShrink: 1, overflow: "hidden" },
  tag: {
    backgroundColor: colors.canvasSoft,
    borderRadius: radii.xs,
    paddingHorizontal: spacing.x2_5,
    paddingVertical: spacing.x1,
    flexShrink: 1,
  },

  listCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, overflow: "hidden", backgroundColor: colors.canvas },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x3,
    paddingHorizontal: spacing.x3_5,
    paddingVertical: spacing.x3,
    minHeight: touchTarget,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  rank: { width: 24, height: 24, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
  rankTop: { backgroundColor: colors.ink },
  rankRest: { backgroundColor: colors.canvasSoft },
  rankText: { fontWeight: "800", fontVariant: ["tabular-nums"] },
  thumb: { borderRadius: radii.sm },
  rowBody: { flex: 1, minWidth: 0 },
  nameLine: { flexDirection: "row", alignItems: "baseline", gap: spacing.x1_5, minWidth: 0 },
  branch: { fontWeight: "700", flexShrink: 0 },
  rowSub: { marginTop: spacing.x0_5 },
  recommendHint: { marginTop: spacing.x2 },
  metaLine: { flexDirection: "row", alignItems: "center", gap: spacing.x1_5, marginTop: spacing.x1 },
  dot: { color: colors.textFaint },
  index: { width: 20, textAlign: "center", fontWeight: "700", fontVariant: ["tabular-nums"] },
  mapLink: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", gap: spacing.x0_5, marginVertical: -spacing.x2 },

  footer: { alignItems: "center", paddingHorizontal: spacing.gutter, paddingTop: spacing.x8, paddingBottom: spacing.x6 },
  footerLinks: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center" },
  footerButton: { minHeight: touchTarget, justifyContent: "center", paddingHorizontal: spacing.x2 },
})
