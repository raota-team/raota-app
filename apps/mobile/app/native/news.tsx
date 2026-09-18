import { router } from "expo-router"
import {
  Camera,
  ChevronRight,
  ExternalLink,
  Flame,
  MapPin,
  Zap,
} from "lucide-react-native"
import { useMemo, useState } from "react"
import {
  FlatList,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text as NativeText,
  View,
  type TextProps,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import type { NewsItem } from "@raota/shared"
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
const FILTERS = ["전체", "한정 메뉴", "영업 공지", "이벤트"]

function openShop(shopId: number) {
  router.push({
    pathname: "/shop/[shopId]",
    params: { shopId: String(shopId) },
  })
}

function NewsCard({
  item,
  subscribed,
  onToggle,
}: {
  item: NewsItem
  subscribed: boolean
  onToggle: () => void
}) {
  const openInstagram = async () => {
    if (await Linking.canOpenURL(item.instagramUrl))
      await Linking.openURL(item.instagramUrl)
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Pressable
          accessibilityLabel={`${item.shopName} 매장 상세 보기`}
          accessibilityRole="button"
          onPress={() => openShop(item.shopId)}
          style={styles.shopButton}
        >
            <View style={styles.shopLogo}>
            <Camera color="#FFFFFF" size={16} />
          </View>
          <View style={styles.flex}>
            <View style={styles.nameRow}>
              <Text style={styles.shopName}>{item.shopName}</Text>
              <Text style={styles.branch}>{item.branch}</Text>
              <Text style={styles.typeTop}>[{item.category}]</Text>
            </View>
              <Text style={styles.handle}>{item.handle} · {item.publishedAt}</Text>
          </View>
          <ChevronRight color="#A8ACAF" size={16} />
        </Pressable>
        <Pressable
          accessibilityLabel={
            subscribed
              ? `${item.shopName} 소식 알림 끄기`
              : `${item.shopName} 소식 알림 받기`
          }
          accessibilityRole="switch"
          accessibilityState={{ checked: subscribed }}
          onPress={onToggle}
          style={[
            styles.subscribeButton,
            subscribed && styles.subscribeButtonActive,
          ]}
        >
          <Text
            style={[
              styles.subscribeText,
              subscribed && styles.subscribeTextActive,
            ]}
          >
            {subscribed ? "알림 켜짐 ✓" : "알림 받기"}
          </Text>
        </Pressable>
      </View>

      {item.imageUrl ? (
        <ResilientUriImage
          accessibilityLabel={`${item.title} 대표 사진`}
          uri={item.imageUrl}
          style={styles.image}
        />
      ) : null}

      <View style={styles.cardBody}>
        <Text style={styles.title}>{item.title}</Text>
        <View style={styles.summary}>
          <View style={styles.summaryTitleRow}>
            <Zap color={RED} fill={RED} size={13} />
            <Text style={styles.summaryTitle}>핵심 요약</Text>
          </View>
          {item.summary.map((line, index) => (
            <View key={`${item.id}-${index}`} style={styles.summaryRow}>
              <View style={styles.bullet} />
              <Text style={styles.summaryText}>{line}</Text>
            </View>
          ))}
        </View>
        <View style={styles.cardFooter}>
          <Pressable
            accessibilityLabel={`${item.shopName} 매장 상세 보기`}
            accessibilityRole="button"
            onPress={() => openShop(item.shopId)}
            style={[styles.footerButton, styles.footerButtonFilled]}
          >
            <Text style={styles.detailText}>매장 정보 보기</Text>
            <MapPin color={MUTED} size={13} />
          </Pressable>
          <Pressable
            accessibilityLabel="인스타그램 원문 열기"
            accessibilityRole="link"
            onPress={openInstagram}
            style={[styles.footerButton, styles.footerButtonOutlined]}
          >
            <Text style={styles.instagramText}>인스타 원문 보기</Text>
            <Text style={styles.externalArrow}>↗</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

export default function NewsScreen() {
  const insets = useSafeAreaInsets()
  const { newsItems, state, actions } = useRaota()
  const [filter, setFilter] = useState("전체")
  const [refreshing, setRefreshing] = useState(false)

  const filtered = useMemo(
    () =>
      filter === "전체"
        ? newsItems
        : newsItems.filter((item) => item.category === filter),
    [filter, newsItems],
  )

  const refresh = () => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 650)
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTop}>
          <View style={styles.brand}>
            <Image
              source={require("@/assets/images/logo.png")}
              style={styles.logo}
            />
            <View>
              <Text style={styles.headerTitle}>라멘집 인스타 속보</Text>
              <Text style={styles.headerSubtitle}>
                전국 라멘집 공식 인스타그램 실시간 피드
              </Text>
            </View>
          </View>
        </View>
        <ScrollView
          contentContainerStyle={styles.filters}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {FILTERS.map((item) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: item === filter }}
              key={item}
              onPress={() => setFilter(item)}
              style={[
                styles.filterChip,
                item === filter && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  item === filter && styles.filterTextActive,
                ]}
              >
                {item}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <FlatList
        contentContainerStyle={styles.list}
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Flame color={MUTED} size={28} />
            <Text style={styles.emptyTitle}>아직 새 소식이 없어요</Text>
            <Text style={styles.emptyBody}>다른 카테고리를 확인해보세요.</Text>
          </View>
        }
        ListFooterComponent={
          filtered.length ? (
            <View style={styles.endState}>
              <Text style={styles.endBody}>
                모든 라멘속보를 확인했습니다. 새로운 소식이 올라오면 바로 알려드릴게요
              </Text>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            onRefresh={refresh}
            refreshing={refreshing}
            tintColor={RED}
          />
        }
        renderItem={({ item }) => (
          <NewsCard
            item={item}
            onToggle={() => actions.toggleShopSubscription(item.shopId)}
            subscribed={state.subscribedShopIds.includes(item.shopId)}
          />
        )}
        showsVerticalScrollIndicator={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { backgroundColor: "#FFFFFF", flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  header: {
    backgroundColor: "#FFFFFF",
    borderBottomColor: LINE,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 10,
  },
  headerTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 54,
    paddingHorizontal: 20,
  },
  brand: { alignItems: "center", flexDirection: "row", gap: 10 },
  logo: { height: 32, width: 32 },
  headerTitle: {
    color: INK,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  headerSubtitle: { color: MUTED, fontSize: 10, marginTop: 2 },
  filters: { gap: 6, paddingHorizontal: 20, paddingBottom: 8 },
  filterChip: {
    alignItems: "center",
    backgroundColor: SOFT,
    borderColor: "transparent",
    borderRadius: 32,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 28,
    minWidth: 44,
    paddingHorizontal: 12,
  },
  filterChipActive: { backgroundColor: INK, borderColor: INK },
  filterText: { color: MUTED, fontSize: 11, fontWeight: "700" },
  filterTextActive: { color: "#FFFFFF", fontWeight: "900" },
  list: { padding: 16, paddingBottom: 100 },
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: LINE,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 16,
    overflow: "hidden",
  },
  cardTop: {
    alignItems: "center",
    borderBottomColor: LINE,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    minHeight: 64,
    paddingHorizontal: 14,
  },
  shopButton: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 56,
  },
  shopLogo: {
    alignItems: "center",
    backgroundColor: "#DD2476",
    borderRadius: 14,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  nameRow: { alignItems: "center", flexDirection: "row", gap: 5 },
  shopName: { color: INK, fontSize: 13.5, fontWeight: "900" },
  branch: { color: MUTED, fontSize: 9.5, fontWeight: "700" },
  handle: { color: "#7E7E7E", fontSize: 9.5, marginTop: 2 },
  typeTop: { color: RED, fontSize: 9.5, fontWeight: "800" },
  subscribeButton: {
    alignItems: "center",
    borderColor: LINE,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    height: 44,
    justifyContent: "center",
    minWidth: 78,
    paddingHorizontal: 8,
  },
  subscribeButtonActive: { backgroundColor: INK, borderColor: INK },
  subscribeText: { color: MUTED, fontSize: 9.5, fontWeight: "800" },
  subscribeTextActive: { color: "#FFFFFF" },
  image: { backgroundColor: SOFT, height: 176, width: "100%" },
  noImage: {
    alignItems: "center",
    backgroundColor: INK,
    height: 118,
    justifyContent: "center",
  },
  noImageMark: {
    alignItems: "center",
    backgroundColor: RED,
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  noImageText: {
    color: "#FFFFFF",
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 1,
    marginTop: 10,
  },
  cardBody: { padding: 16 },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  categoryBadge: { borderRadius: 3, paddingHorizontal: 8, paddingVertical: 5 },
  categoryText: { fontSize: 9.5, fontWeight: "900" },
  time: { color: MUTED, fontSize: 9.5 },
  title: {
    color: INK,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.25,
    lineHeight: 22,
    marginTop: 10,
  },
  summary: {
    backgroundColor: SOFT,
    borderRadius: 4,
    gap: 7,
    marginTop: 11,
    padding: 11,
  },
  summaryTitleRow: { alignItems: "center", flexDirection: "row", gap: 5 },
  summaryTitle: { color: INK, fontSize: 10, fontWeight: "900" },
  summaryRow: { alignItems: "flex-start", flexDirection: "row", gap: 7 },
  bullet: {
    backgroundColor: RED,
    borderRadius: 2,
    height: 4,
    marginTop: 6,
    width: 4,
  },
  summaryText: { color: "#565B60", flex: 1, fontSize: 11, lineHeight: 16 },
  cardFooter: {
    alignItems: "center",
    borderTopColor: LINE,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    marginTop: 13,
    paddingTop: 7,
  },
  footerButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 3,
    flex: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 8,
  },
  footerButtonFilled: { backgroundColor: SOFT, borderRadius: 6 },
  footerButtonOutlined: {
    backgroundColor: "#FFFFFF",
    borderColor: LINE,
    borderRadius: 6,
    borderWidth: 1,
  },
  detailText: { color: INK, fontSize: 10.5, fontWeight: "900" },
  instagramText: { color: INK, fontSize: 10.5, fontWeight: "700" },
  externalArrow: { color: INK, fontSize: 11, fontWeight: "800" },
  endState: { alignItems: "center", paddingBottom: 24, paddingTop: 20 },
  endBody: { color: "#A0A0A0", fontSize: 10.5, textAlign: "center" },
  empty: { alignItems: "center", paddingTop: 80 },
  emptyTitle: { color: INK, fontSize: 15, fontWeight: "900", marginTop: 13 },
  emptyBody: { color: MUTED, fontSize: 11, marginTop: 5 },
})
