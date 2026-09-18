import { router } from "expo-router"
import {
  Bell,
  Bookmark,
  ChevronRight,
  Crosshair,
  Flame,
  PenLine,
  Search,
  Sparkles,
  X,
} from "lucide-react-native"
import { useMemo, useState } from "react"
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text as NativeText,
  View,
  type TextProps,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import type { Shop } from "@raota/shared"
import { ResilientUriImage } from "@/src/components"
import { useRaota } from "@/src/state/RaotaStore"
import { colors, fonts } from "@/src/theme"

const RED = colors.brand
const INK = colors.text
const MUTED = colors.textMuted
const LINE = colors.border
const SOFT = colors.backgroundBasement

function Text({ style, ...props }: TextProps) {
  const resolvedStyle = StyleSheet.flatten(style)
  const readableSize =
    typeof resolvedStyle?.fontSize === "number" && resolvedStyle.fontSize < 11
      ? { fontSize: 11 }
      : null
  return (
    <NativeText
      {...props}
      style={[{ fontFamily: fonts.body }, style, readableSize]}
    />
  )
}

function distanceLabel(distanceM: number) {
  return distanceM < 1000
    ? `${distanceM}m`
    : `${(distanceM / 1000).toFixed(1)}km`
}

function openShop(shopId: number) {
  router.push({
    pathname: "/shop/[shopId]",
    params: { shopId: String(shopId) },
  })
}

function ShopRow({ shop, index, isLast }: { shop: Shop; index: number; isLast?: boolean }) {
  return (
    <Pressable
      accessibilityLabel={`${shop.name} ${shop.branch ?? ""}, ${distanceLabel(shop.distanceM)}, ${
        shop.isOpen ? "영업 중" : "영업 종료"
      }, 상세 보기`}
      accessibilityRole="button"
      onPress={() => openShop(shop.id)}
      style={({ pressed }) => [styles.shopRow, isLast && styles.shopRowLast, pressed && styles.pressed]}
    >
      <Text style={styles.shopIndex}>{String(index + 1).padStart(2, "0")}</Text>
      <ResilientUriImage
        accessibilityLabel={`${shop.name} 대표 사진`}
        uri={shop.photos[0]}
        style={styles.shopThumb}
      />
      <View style={styles.shopRowBody}>
        <View style={styles.inline}>
          <Text numberOfLines={1} style={styles.shopRowName}>
            {shop.name}
          </Text>
        </View>
        <Text numberOfLines={1} style={styles.shopDescription}>
          {shop.description || shop.tags.join(" · ")}
        </Text>
        <View style={styles.inline}>
          <Text style={styles.distance}>{distanceLabel(shop.distanceM)}</Text>
          <Text style={styles.dotSeparator}>·</Text>
          <Text style={[styles.openState, !shop.isOpen && styles.closedState]}>
            {shop.isOpen ? "● 영업 중" : "● 영업 종료"}
          </Text>
        </View>
      </View>
    </Pressable>
  )
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets()
  const { shops, currentUser, unreadNotificationCount, userLogs } = useRaota()
  const [fabOpen, setFabOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const nearby = useMemo(
    () => [...shops].sort((a, b) => a.distanceM - b.distanceM).slice(0, 5),
    [shops],
  )
  const popular = useMemo(() => {
    const preferredOrder = [1, 5, 3, 6, 4]
    const byId = new Map(shops.map((shop) => [shop.id, shop]))
    const ordered = preferredOrder
      .map((id) => byId.get(id))
      .filter((shop): shop is Shop => Boolean(shop))
    return ordered.length ? ordered : [...shops].sort((a, b) => b.reviewCount - a.reviewCount).slice(0, 5)
  }, [shops])
  const heroShop = nearby[0] ?? shops[0]

  const refresh = () => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 650)
  }

  const startRecord = (mode: "nearby" | "saved" | "search") => {
    setFabOpen(false)
    router.push({ pathname: "/record/select-shop", params: { mode } })
  }

  const header = (
    <>
      <View style={styles.header}>
        <View style={styles.brandWrap}>
          <Image
            accessibilityLabel="라오타 로고"
            source={require("@/assets/images/logo.png")}
            style={styles.logo}
          />
          <View>
            <Text style={styles.wordmark}>
              RAOTA<Text style={styles.red}>.</Text>
            </Text>
            <Text style={styles.slogan}>나의 라멘 취향을 찾는 곳</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          {currentUser?.isLoggedIn ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/native/my")}
              style={styles.welcomeButton}
            >
                <Text numberOfLines={1} style={styles.welcomeText}>
                <Text style={styles.red}>{currentUser.nickname}</Text>님, 반갑습니다
              </Text>
            </Pressable>
          ) : (
            <View style={styles.authRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/auth/login")}
                style={styles.textButton}
              >
                <Text style={styles.textButtonLabel}>로그인</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/auth/onboarding")}
                style={styles.joinButton}
              >
                <Text style={styles.joinButtonLabel}>회원가입</Text>
              </Pressable>
            </View>
          )}
          <Pressable
            accessibilityLabel={`알림 ${unreadNotificationCount}개`}
            accessibilityRole="button"
            hitSlop={6}
            onPress={() => router.push("/notifications")}
            style={styles.iconButton}
          >
            <Bell color={INK} size={20} />
            {unreadNotificationCount > 0 ? (
              <View style={styles.notificationDot} />
            ) : null}
          </Pressable>
        </View>
      </View>

      <View style={styles.contentInset}>
        <Pressable
          accessibilityLabel="AI 라멘 큐레이터 시작"
          accessibilityRole="button"
          onPress={() => router.push("/ai-recommend")}
          style={({ pressed }) => [styles.aiBanner, pressed && styles.pressed]}
        >
          <View style={styles.aiIcon}>
            <Sparkles color="#FFFFFF" size={20} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.aiTitle}>오늘 뭐 먹지? AI 라멘 큐레이터</Text>
            <Text style={styles.aiBody}>육수 농도 · 면 굵기 · 타레 맞춤 라멘 추천</Text>
          </View>
          <ChevronRight color="#FFFFFF" size={19} />
        </Pressable>

        {/* 기록 완료 알림 배너 */}
        {userLogs.length > 0 && (
          <View style={styles.recordSavedBanner}>
            <View style={styles.recordSavedLeft}>
              <View style={styles.recordSavedIconWrap}>
                <Text style={styles.recordSavedCheck}>✓</Text>
              </View>
              <View style={styles.recordSavedTextWrap}>
                <Text numberOfLines={1} style={styles.recordSavedTitle}>
                  새로운 라멘로그가 취향 리포트에 반영되었습니다.
                </Text>
                <Text numberOfLines={1} style={styles.recordSavedSubtitle}>
                  최신 라멘로그 데이터를 기반으로 맞춤 추천이 갱신되었습니다.
                </Text>
              </View>
            </View>
            <Text style={styles.recordSavedBadge}>기록 완료</Text>
          </View>
        )}

        <View style={styles.sectionHeadingWithBorder}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>오늘의 큐레이션 라멘집</Text>
          <Text style={styles.sectionMeta}>420m · 망원동</Text>
        </View>

        {heroShop ? (
          <Pressable
            accessibilityLabel={`${heroShop.name} 오늘의 추천, ${distanceLabel(heroShop.distanceM)}, 상세 보기`}
            accessibilityRole="button"
            onPress={() => openShop(heroShop.id)}
            style={({ pressed }) => [
              styles.heroCard,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.heroImageWrap}>
              <ResilientUriImage
                accessibilityLabel={`${heroShop.name} 오늘의 추천 사진`}
                uri={heroShop.photos[0]}
                style={styles.heroImage}
              />
              <View style={styles.pickBadge}>
                <Text style={styles.pickBadgeText}>★ TODAY&apos;S PICK</Text>
              </View>
            </View>
            <View style={styles.heroBody}>
              <View style={styles.inline}>
                <Text style={styles.heroName}>{heroShop.name}</Text>
                {heroShop.branch ? (
                  <View style={styles.heroBranchBadge}>
                    <Text style={styles.heroBranch}>{heroShop.branch}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.heroCopy} numberOfLines={2}>
                특제 쇼유 라멘 · 자가제면 스트레이트 면 · 닭과 오리 더블 육수
              </Text>
              <View style={styles.heroQuote}>
                <Text style={styles.heroQuoteText}>
                  “진한 동물계 감칠맛과 단단한 자가제면 식감이 일품인 망원동의 대표 쇼유 라멘 명소입니다.”
                </Text>
              </View>
              <View style={styles.heroActionRow}>
                <View style={styles.tagRow}>
                  {['자가제면', '맑은육수'].map((tag) => (
                    <View key={tag} style={styles.tag}>
                      <Text style={styles.tagText}>#{tag}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.detailButton}>
                  <Text style={styles.detailText}>매장 상세 보기 →</Text>
                </View>
              </View>
            </View>
          </Pressable>
        ) : null}

        <View style={styles.sectionHeadingWithBorder}>
          <View style={styles.inline}>
            <Flame color={RED} fill={RED} size={16} />
            <Text accessibilityRole="header" style={styles.sectionTitleSmall}>
              오늘 많이 본 라멘집
            </Text>
          </View>
          <Text style={styles.sectionMeta}>실시간 조회수 기준</Text>
        </View>
        <View style={styles.rankingList}>
          {popular.map((shop, index) => (
            <Pressable
              accessibilityLabel={`${index + 1}위 ${shop.name}, 조회 ${shop.reviewCount.toLocaleString()}회, 상세 보기`}
              accessibilityRole="button"
              key={shop.id}
              onPress={() => openShop(shop.id)}
              style={({ pressed }) => [
                styles.rankingRow,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.rankBadge,
                  index === 0 && styles.rankBadgeFirst,
                  index === 1 && styles.rankBadgeSecond,
                  index === 2 && styles.rankBadgeThird,
                  index > 2 && styles.rankBadgeMuted,
                ]}
              >
                <Text style={[styles.rank, index < 3 ? styles.rankInverse : styles.rankMuted]}>
                  {index + 1}
                </Text>
              </View>
              <ResilientUriImage
                accessibilityLabel={`${shop.name} 인기 순위 대표 사진`}
                uri={shop.photos[0]}
                style={styles.rankThumb}
              />
              <View style={styles.flex}>
                <View style={styles.inline}>
                  <Text numberOfLines={1} style={styles.rankName}>
                    {shop.name}
                  </Text>
                  <Text style={styles.branch}>{shop.branch}</Text>
                </View>
                <Text numberOfLines={1} style={styles.rankDescription}>
                  {shop.tags.slice(0, 2).join(" · ")}
                </Text>
              </View>
              <View style={styles.rankViewsWrap}>
                <Text style={styles.rankViews}>
                  {shop.reviewCount.toLocaleString()}회
                </Text>
                <Text style={styles.rankArrow}>→</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHeadingWithBorder}>
          <Text accessibilityRole="header" style={styles.sectionTitleSmall}>거리순 라멘집 목록</Text>
          <Text style={styles.sectionMeta}>가까운 순서</Text>
        </View>
      </View>
    </>
  )

  return (
    <View style={styles.root}>
      <FlatList
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 16 }}
        data={nearby}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={header}
        ListFooterComponent={
          <View style={styles.footer}>
            <View style={styles.footerLinks}>
              <Text style={styles.footerLink}>이용약관</Text>
              <Text style={styles.footerDot}>·</Text>
              <Text style={styles.footerLink}>개인정보처리방침</Text>
              <Text style={styles.footerDot}>·</Text>
              <Text style={styles.footerLink}>문의하기</Text>
            </View>
            <Text style={styles.footerCopy}>
              © 2026 RAOTA · 라멘에 진심인 사람들
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={RED}
          />
        }
        renderItem={({ item, index }) => (
          <View style={styles.nearbyRowWrap}>
            <ShopRow index={index} isLast={index === nearby.length - 1} shop={item} />
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />

      {fabOpen ? (
        <Pressable
          accessibilityLabel="기록 메뉴 닫기"
          accessibilityRole="button"
          onPress={() => setFabOpen(false)}
          style={styles.backdrop}
        />
      ) : null}
      <View
        accessibilityViewIsModal={fabOpen}
        onAccessibilityEscape={() => setFabOpen(false)}
        pointerEvents="box-none"
        style={[styles.fabWrap, { bottom: insets.bottom + 82 }]}
      >
        {fabOpen ? (
          <View accessibilityLabel="기록 방법 선택" style={styles.fabMenu}>
            <Pressable
              accessibilityLabel="주변 라멘집 기록하기"
              accessibilityRole="button"
              onPress={() => startRecord("nearby")}
              style={styles.fabMenuItem}
            >
              <Text style={styles.fabMenuLabel}>주변 라멘집 기록하기</Text>
              <Crosshair color={RED} size={18} />
            </Pressable>
            <Pressable
              accessibilityLabel="저장 목록에서 기록하기"
              accessibilityRole="button"
              onPress={() => startRecord("saved")}
              style={styles.fabMenuItem}
            >
              <Text style={styles.fabMenuLabel}>저장 목록에서 기록하기</Text>
              <Bookmark color={RED} size={18} />
            </Pressable>
            <Pressable
              accessibilityLabel="직접 검색해서 기록하기"
              accessibilityRole="button"
              onPress={() => startRecord("search")}
              style={styles.fabMenuItem}
            >
              <Text style={styles.fabMenuLabel}>직접 검색해서 기록하기</Text>
              <Search color={RED} size={18} />
            </Pressable>
          </View>
        ) : null}
        <Pressable
          accessibilityLabel={fabOpen ? "기록 메뉴 닫기" : "라멘 기록하기"}
          accessibilityRole="button"
          accessibilityState={{ expanded: fabOpen }}
          onPress={() => setFabOpen((open) => !open)}
          style={({ pressed }) => [
            styles.fab,
            fabOpen && styles.fabClose,
            pressed && styles.pressed,
          ]}
        >
          {fabOpen ? (
            <X color="#FFFFFF" size={22} />
          ) : (
            <PenLine color="#FFFFFF" size={22} />
          )}
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  flex: { flex: 1 },
  red: { color: RED },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  contentInset: { paddingHorizontal: 20 },
  header: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderBottomColor: LINE,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 66,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  brandWrap: { alignItems: "center", flexDirection: "row", gap: 10 },
  logo: { width: 36, height: 36 },
  wordmark: {
    color: INK,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  slogan: { color: MUTED, fontSize: 9.5, fontWeight: "700", marginTop: 1 },
  headerActions: { alignItems: "center", flexDirection: "row", gap: 4 },
  welcomeButton: {
    justifyContent: "center",
    minHeight: 44,
    maxWidth: 150,
    paddingHorizontal: 6,
  },
  welcomeText: { color: INK, fontSize: 12, fontWeight: "800" },
  authRow: { alignItems: "center", flexDirection: "row", gap: 2 },
  textButton: { justifyContent: "center", minHeight: 44, paddingHorizontal: 7 },
  textButtonLabel: { color: INK, fontSize: 11.5, fontWeight: "800" },
  joinButton: {
    alignItems: "center",
    backgroundColor: RED,
    borderRadius: 4,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 9,
  },
  joinButtonLabel: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  iconButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    position: "relative",
    width: 44,
  },
  notificationDot: {
    backgroundColor: RED,
    borderColor: "#FFFFFF",
    borderRadius: 5,
    borderWidth: 2,
    height: 10,
    position: "absolute",
    right: 8,
    top: 7,
    width: 10,
  },
  aiBanner: {
    alignItems: "center",
    backgroundColor: INK,
    borderRadius: 6,
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    minHeight: 72,
    padding: 16,
  },
  aiIcon: {
    alignItems: "center",
    backgroundColor: RED,
    borderRadius: 6,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  aiTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  aiBody: { color: "#CBCDCF", fontSize: 11, marginTop: 2 },
  sectionHeading: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    marginTop: 16,
  },
  sectionHeadingWithBorder: {
    alignItems: "flex-end",
    borderBottomColor: LINE,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    marginTop: 18,
    paddingBottom: 8,
  },
  recordSavedBanner: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: LINE,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    padding: 14,
  },
  recordSavedLeft: { alignItems: "center", flexDirection: "row", flex: 1, gap: 10 },
  recordSavedIconWrap: {
    alignItems: "center",
    backgroundColor: "rgba(230,0,0,0.1)",
    borderRadius: 14,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  recordSavedCheck: { color: RED, fontSize: 13, fontWeight: "900" },
  recordSavedTextWrap: { flex: 1 },
  recordSavedTitle: { color: INK, fontSize: 12.5, fontWeight: "800" },
  recordSavedSubtitle: { color: MUTED, fontSize: 10.5, marginTop: 2 },
  recordSavedBadge: { color: RED, fontSize: 11, fontWeight: "800", marginLeft: 8 },
  sectionTitle: {
    color: RED,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: -0.7,
  },
  sectionTitleSmall: {
    color: INK,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  sectionSubtitle: { color: MUTED, fontSize: 11, marginTop: 3 },
  sectionMeta: { color: MUTED, fontSize: 11, fontWeight: "700" },
  heroCard: {
    borderColor: LINE,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  heroImageWrap: { height: 220, position: "relative" },
  heroImage: { backgroundColor: SOFT, height: "100%", width: "100%" },
  pickBadge: {
    alignItems: "center",
    backgroundColor: RED,
    borderRadius: 4,
    flexDirection: "row",
    gap: 4,
    left: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: "absolute",
    top: 12,
  },
  pickBadgeText: {
    color: "#FFFFFF",
    fontSize: 10.5,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  heroBody: { padding: 16 },
  heroName: {
    color: INK,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  heroBranchBadge: {
    backgroundColor: SOFT,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  heroBranch: { color: MUTED, fontSize: 11, fontWeight: "700" },
  heroCopy: { color: MUTED, fontSize: 12, fontWeight: "700", lineHeight: 18, marginTop: 4 },
  heroQuote: {
    backgroundColor: "#F8F8F8",
    borderLeftColor: RED,
    borderLeftWidth: 3,
    borderBottomRightRadius: 6,
    borderTopRightRadius: 6,
    marginTop: 10,
    padding: 12,
  },
  heroQuoteText: { color: INK, fontSize: 12, fontWeight: "500", lineHeight: 18 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: {
    backgroundColor: SOFT,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: { color: INK, fontSize: 11, fontWeight: "700" },
  heroActionRow: {
    alignItems: "center",
    borderTopColor: "#EFEFF0",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
  },
  openInline: { alignItems: "center", flexDirection: "row", gap: 5 },
  statusDot: {
    backgroundColor: "#1B9B55",
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  statusDotClosed: { backgroundColor: MUTED },
  openInlineText: { color: "#4D5358", fontSize: 10.5, fontWeight: "700" },
  detailButton: {
    alignItems: "center",
    backgroundColor: RED,
    borderRadius: 4,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  detailText: {
    alignItems: "center",
    color: "#FFFFFF",
    fontSize: 11.5,
    fontWeight: "900",
  },
  rankingList: {
    borderColor: LINE,
    borderRadius: 6,
    borderWidth: 1,
    overflow: "hidden",
  },
  rankingRow: {
    alignItems: "center",
    borderBottomColor: LINE,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    minHeight: 67,
    paddingHorizontal: 14,
  },
  rankBadge: {
    alignItems: "center",
    backgroundColor: "#F2F2F2",
    borderRadius: 12,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  rankBadgeFirst: { backgroundColor: RED },
  rankBadgeSecond: { backgroundColor: INK },
  rankBadgeThird: { backgroundColor: "#57534E" },
  rankBadgeMuted: { backgroundColor: "#F5F5F4" },
  rankMuted: { color: "#78716C", fontSize: 12, fontWeight: "900" },
  rankViewsWrap: { alignItems: "center", flexDirection: "row", gap: 8 },
  rankArrow: { color: "#D6D3D1", fontSize: 13, fontWeight: "800" },
  dotSeparator: { color: LINE, fontSize: 10, marginHorizontal: 2 },
  rank: {
    color: "#71757A",
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
  },
  rankInverse: { color: "#FFFFFF" },
  rankThumb: { backgroundColor: SOFT, borderRadius: 4, height: 44, width: 44 },
  rankName: { color: INK, fontSize: 12.5, fontWeight: "900", maxWidth: 130 },
  branch: { color: MUTED, fontSize: 9.5, fontWeight: "700" },
  rankDescription: { color: MUTED, fontSize: 10, marginTop: 3 },
  rankViews: { color: "#999DA1", fontSize: 9.5, fontWeight: "700" },
  seeAllButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 4,
  },
  seeAllText: { color: RED, fontSize: 11, fontWeight: "900" },
  nearbyRowWrap: {
    marginHorizontal: 20,
    backgroundColor: "#FFFFFF",
    borderLeftColor: LINE,
    borderRightColor: LINE,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  shopRow: {
    alignItems: "center",
    borderTopColor: LINE,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 10,
    minHeight: 82,
    paddingHorizontal: 12,
  },
  shopRowLast: { borderBottomColor: LINE, borderBottomWidth: 1 },
  shopIndex: { color: "#A3A6A9", fontSize: 11, fontWeight: "900", width: 20 },
  shopThumb: { backgroundColor: SOFT, borderRadius: 4, height: 58, width: 58 },
  shopRowBody: { flex: 1, minWidth: 0 },
  shopRowName: { color: INK, fontSize: 13.5, fontWeight: "900", maxWidth: 150 },
  shopDescription: { color: MUTED, fontSize: 10, marginTop: 4 },
  distance: { color: INK, fontSize: 10, fontWeight: "800", marginTop: 5 },
  openState: {
    color: "#14834A",
    fontSize: 9.5,
    fontWeight: "700",
    marginLeft: 3,
    marginTop: 5,
  },
  closedState: { color: MUTED },
  match: {
    color: RED,
    fontSize: 9.5,
    fontWeight: "800",
    marginLeft: 3,
    marginTop: 5,
  },
  footer: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  footerLinks: { alignItems: "center", flexDirection: "row", gap: 10, marginBottom: 6 },
  footerLink: { color: MUTED, fontSize: 10.5, fontWeight: "700" },
  footerDot: { color: LINE, fontSize: 10.5 },
  footerCopy: { color: "#A0A0A0", fontSize: 9.5 },
  backdrop: {
    backgroundColor: "rgba(16,18,20,0.42)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  fabWrap: { alignItems: "flex-end", position: "absolute", right: 18 },
  fabMenu: { alignItems: "flex-end", gap: 8, marginBottom: 10 },
  fabMenuItem: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    flexDirection: "row",
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 14,
    shadowColor: INK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.13,
    shadowRadius: 12,
  },
  fabMenuLabel: { color: INK, fontSize: 11.5, fontWeight: "800" },
  fab: {
    alignItems: "center",
    backgroundColor: RED,
    borderRadius: 28,
    height: 56,
    justifyContent: "center",
    shadowColor: RED,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.24,
    shadowRadius: 11,
    width: 56,
  },
  fabClose: { backgroundColor: INK, shadowColor: INK },
})
