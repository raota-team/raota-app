import { useEffect, useMemo, useRef, useState } from "react"
import { router, useLocalSearchParams } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { Image } from "expo-image"
import { Bookmark, ChevronDown, ChevronRight, Search, SearchX, X } from "lucide-react-native"
import { ActionSheetIOS, Alert, FlatList, Platform, Pressable, StyleSheet, TextInput, View } from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"

import { type Shop, type ShopCatalogItem } from "@raota/shared"
import { track } from "@/src/analytics"
import { useBookmarkedShops, useShops } from "@/src/data"
import { useRaota } from "@/src/state/RaotaStore"
import { AppText, Chip, EmptyState, IconButton, LoadingState } from "@/src/components/ui"
import { colors, maxFontScale, radii, spacing, touchTarget, typography } from "@/src/theme"

/*
 * 기록할 가게 고르기. 주변·찜·검색 중에서 사진과 매장 정보로 고른다.
 * 작성 화면에서 열었으면 고른 가게만 바꿔 작성 중인 내용을 지키고 돌아간다.
 */

type Mode = "nearby" | "saved" | "search"
type NearbyFilter = "all" | "500m" | "open"

interface ShopItem {
  id: string
  name: string
  branch: string
  style: string
  /** 대표 스타일이 라멘 종류 목록과 맞을 때만 채운다. 없으면 빈 문자열 */
  ramenType: string
  spec: string
  distanceM: number
  distance: string
  isOpen: boolean
  status: string
  photo?: string
  tags: string[]
  region: string
}

const MODES: Array<{ id: Mode; label: string }> = [
  { id: "nearby", label: "주변" },
  { id: "saved", label: "찜한 가게" },
  { id: "search", label: "검색" },
]

/** 주소의 동 또는 역 이름에서 동네를 뽑는다. 못 찾으면 비워 둔다. */
const REGION_PATTERN = /(망원|합정|연남|서교|상수|동교)(동|역)/
const regionOf = (address: string) => {
  const match = address.match(REGION_PATTERN)
  return match ? `${match[1]}동` : ""
}

const formatDistance = (meters: number) =>
  meters >= 1000 ? `${(meters / 1000).toFixed(1).replace(/\.0$/, "")}km` : `${meters}m`

/** 원장 매장은 대표 스타일과 한 줄 특징을 갖고 있다. 없으면 비워 둔다. */
const catalogField = (shop: Shop, key: "style" | "spec") => {
  const value = (shop as Partial<ShopCatalogItem>)[key]
  return typeof value === "string" ? value : ""
}

const toShopItem = (shop: Shop): ShopItem => {
  const distanceUnknown = "unknownFields" in shop && Array.isArray(shop.unknownFields) && shop.unknownFields.includes("distance")
  return {
    id: shop.id,
    name: shop.name,
    branch: shop.branch ?? "",
    style: catalogField(shop, "style"),
    // 종류 태그에는 원장의 대표 스타일을 그대로 넘긴다("쇼유 라멘" → 태그가 "쇼유"로 보여 준다)
    ramenType: catalogField(shop, "style"),
    spec: catalogField(shop, "spec"),
    distanceM: distanceUnknown ? Number.POSITIVE_INFINITY : shop.distanceM,
    distance: distanceUnknown ? "거리 정보 없음" : formatDistance(shop.distanceM),
    status: "unknownFields" in shop && Array.isArray(shop.unknownFields) && shop.unknownFields.includes("isOpen")
      ? "영업 정보 확인 필요"
      : shop.isOpen ? "영업 중" : "준비 중",
    isOpen: shop.isOpen,
    photo: shop.photos[0],
    tags: shop.tags,
    region: regionOf(shop.address),
  }
}

const byDistance = (a: ShopItem, b: ShopItem) => a.distanceM - b.distanceM

const initialModeOf = (mode: string | undefined): Mode =>
  mode === "saved" || mode === "bookmarked" ? "saved" : mode === "search" ? "search" : "nearby"

function ShopRow({ shop, onSelect }: { shop: ShopItem; onSelect: () => void }) {
  const status = shop.status
  const label = [shop.name, shop.branch, shop.spec || shop.style, shop.distance, status, shop.region]
    .filter(Boolean)
    .join(", ")
  return (
    <Pressable
      accessibilityHint="이 가게로 기록을 시작해요"
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onSelect}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowPhoto}>
        {shop.photo ? (
          <Image contentFit="cover" source={{ uri: shop.photo }} style={StyleSheet.absoluteFill} transition={150} />
        ) : null}
      </View>
      <View style={styles.rowCopy}>
        <View style={styles.rowTitle}>
          <AppText lineBreakStrategyIOS="hangul-word" style={[styles.shrink, styles.rowName]} variant="cardTitle">
            {shop.name}
          </AppText>
          {shop.branch ? (
            <AppText lineBreakStrategyIOS="hangul-word" style={styles.branch} tone="muted" variant="secondary">
              {shop.branch}
            </AppText>
          ) : null}
        </View>
        <AppText lineBreakStrategyIOS="hangul-word" style={styles.rowSpec} tone="sub" variant="secondary">
          {shop.spec || shop.style}
        </AppText>
        <View style={styles.rowMeta}>
          {shop.ramenType ? (
            <AppText accessible accessibilityLabel={`라멘 종류 ${shop.ramenType.replace(/\s*라멘$/, "")}`} accessibilityRole="text" capScale tone="muted" variant="meta">{shop.ramenType.replace(/\s*라멘$/, "")}</AppText>
          ) : null}
          <AppText capScale tone="muted" variant="meta">{`${shop.ramenType ? "· " : ""}${shop.distance} · ${status}`}</AppText>
        </View>
      </View>
      <ChevronRight color={colors.textMuted} size={20} />
    </Pressable>
  )
}

export default function SelectShopScreen() {
  const params = useLocalSearchParams<{ mode?: string; source?: string }>()
  const insets = useSafeAreaInsets()
  const { state, actions } = useRaota()
  const shopsQuery = useShops()
  const bookmarked = useBookmarkedShops()
  const [mode, setMode] = useState<Mode>(() => initialModeOf(params.mode))
  const [nearbyFilter, setNearbyFilter] = useState<NearbyFilter>("all")
  const [query, setQuery] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(query.trim()), 300)
    return () => clearTimeout(timer)
  }, [query])
  const remoteSearch = useShops({ query: searchQuery || undefined })
  const searchRef = useRef<TextInput>(null)

  const allShops = useMemo(() => shopsQuery.data.map(toShopItem).sort(byDistance), [shopsQuery.data])
  const savedShops = useMemo(
    () => (shopsQuery.remote
      ? shopsQuery.data.filter((shop) => state.bookmarkedShopIds.includes(shop.id))
      : bookmarked.data).map(toShopItem).sort(byDistance),
    [bookmarked.data, shopsQuery.data, shopsQuery.remote, state.bookmarkedShopIds],
  )

  // 빠른 검색어는 원장의 스타일과 동네에서만 만든다. 인기 검색어처럼 꾸미지 않는다.
  const quickKeywords = useMemo(
    () =>
      Array.from(
        new Set([
          ...allShops.map((shop) => shop.style.replace(/ 라멘$/, "")).filter(Boolean),
          ...allShops.map((shop) => shop.region).filter(Boolean),
        ]),
      ),
    [allShops],
  )

  const nearbyList = useMemo(
    () =>
      allShops.filter((shop) => {
        if (nearbyFilter === "open" && !shop.isOpen) return false
        if (nearbyFilter === "500m" && shop.distanceM > 500) return false
        return true
      }),
    [allShops, nearbyFilter],
  )

  const trimmedQuery = query.trim()
  const searchResults = useMemo(() => {
    const q = trimmedQuery.toLocaleLowerCase("ko-KR")
    if (!q) return []
    if (shopsQuery.remote) return searchQuery === trimmedQuery ? remoteSearch.data.map(toShopItem).sort(byDistance) : []
    return allShops.filter((shop) =>
      [shop.name, shop.branch, shop.style, shop.spec, shop.region, ...shop.tags].some((text) =>
        text.toLocaleLowerCase("ko-KR").includes(q),
      ),
    )
  }, [allShops, remoteSearch.data, searchQuery, shopsQuery.remote, trimmedQuery])

  const chooseNearbyFilter = () => {
    const options = ["전체", "500m 이내", "영업 중만", "취소"]
    const select = (index: number) => {
      if (index < 3) setNearbyFilter((["all", "500m", "open"] as const)[index])
    }
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions({ title: "주변 가게", options, cancelButtonIndex: 3 }, select)
    } else {
      Alert.alert("주변 가게", undefined, options.map((text, index) => ({
        text,
        onPress: () => select(index),
        style: index === 3 ? "cancel" as const : "default" as const,
      })))
    }
  }
  const close = () => {
    if (router.canGoBack()) router.back()
    else router.replace("/native")
  }

  const choose = (shop: ShopItem) => {
    // 작성 화면의 "변경"에서 열렸으면 작성 중인 내용을 지키고 가게만 바꿔 돌아간다.
    if (state.recordDraft) {
      actions.selectRecordDraftShop(shop.id)
      router.back()
      return
    }
    // 기록 시작은 탭의 기록 버튼이 이미 셌다(source=tab). 다른 입구에서 왔을 때만 여기서 센다.
    if (params.source !== "tab") {
      track("record_started", { mode, source: params.source === "reminder" ? "reminder" : "select_shop" })
    }
    router.replace({ pathname: "/record/new", params: { shopId: shop.id } })
  }

  const data = mode === "nearby" ? nearbyList : mode === "saved" ? savedShops : searchResults
  const activeQuery = mode === "search" && trimmedQuery && shopsQuery.remote ? remoteSearch : shopsQuery
  const isLoading = mode === "search" && trimmedQuery && shopsQuery.remote
    ? searchQuery !== trimmedQuery || (remoteSearch.isLoading && searchResults.length === 0)
    : shopsQuery.isLoading && allShops.length === 0

  const listHeader = (
    <View style={styles.listHeader}>
      {mode === "nearby" ? (
        <Pressable
          accessibilityHint="주변 가게의 거리와 영업 상태 조건을 고를 수 있어요"
          accessibilityLabel={`가까운 순${allShops[0]?.region ? ` · ${allShops[0].region} 주변` : ""}, ${nearbyFilter === "all" ? "전체" : nearbyFilter === "500m" ? "500m 이내" : "영업 중만"}`}
          accessibilityRole="button"
          onPress={chooseNearbyFilter}
          style={styles.listCaptionButton}
        >
          <AppText capScale numberOfLines={1} style={styles.listCaption} tone="muted" variant="meta">
            {`${nearbyFilter === "all" ? "가까운 순" : nearbyFilter === "500m" ? "500m 이내" : "영업 중만"}${allShops[0]?.region ? ` · ${allShops[0].region} 주변` : ""}`}
          </AppText>
          <ChevronDown color={colors.textMuted} size={14} />
        </Pressable>
      ) : mode === "saved" && savedShops.length > 0 ? (
        <AppText capScale style={styles.listCaption} tone="muted" variant="meta">
          {`찜한 가게 ${savedShops.length}곳`}
        </AppText>
      ) : mode === "search" ? (
        <AppText accessibilityLiveRegion="polite" capScale style={styles.listCaption} tone="muted" variant="meta">
          {trimmedQuery ? `검색 결과 ${searchResults.length}건` : "빠른 검색어"}
        </AppText>
      ) : null}
    </View>
  )

  const listEmpty =
    activeQuery.error && mode !== "saved" ? (
      <EmptyState description="잠시 후 다시 열어 주세요." title="가게 목록을 불러오지 못했어요" />
    ) : mode === "nearby" ? (
      <EmptyState description="필터를 풀면 더 많은 가게를 볼 수 있어요." title="조건에 맞는 가게가 없어요" />
    ) : mode === "saved" ? (
      <EmptyState
        description="가게 상세에서 찜해 두면 여기서 바로 기록할 수 있어요."
        icon={<Bookmark color={colors.textFaint} size={32} />}
        title="찜한 가게가 없어요"
      />
    ) : trimmedQuery ? (
      <EmptyState
        description={`‘${trimmedQuery}’ 가게가 아직 목록에 없어요. 이름이나 동네를 다르게 입력해보세요.`}
        icon={<SearchX color={colors.textFaint} size={32} />}
        title="검색 결과가 없어요"
      />
    ) : (
      <View style={styles.quickKeywords}>
        {quickKeywords.map((keyword) => (
          <Chip accessibilityHint="이 검색어로 찾아요" key={keyword} label={keyword} onPress={() => setQuery(keyword)} />
        ))}
      </View>
    )

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
      <StatusBar style="auto" />
      <View style={styles.handle} />
      <View style={styles.header}>
        <AppText accessibilityRole="header" lineBreakStrategyIOS="hangul-word" style={styles.flex} variant="headline">
          {"어느 가게를\n기록할까요?"}
        </AppText>
        <IconButton accessibilityLabel="닫기" icon={<ChevronRight color={colors.ink} size={24} />} onPress={close} />
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchField}>
          <Search color={colors.textMuted} size={18} />
          <TextInput
            accessibilityLabel="가게 검색"
            autoCorrect={false}
            autoFocus={mode === "search"}
            maxFontSizeMultiplier={maxFontScale}
            onChangeText={(text) => {
              setQuery(text)
              if (text.trim()) setMode("search")
            }}
            placeholder="가게·동네·스타일 검색"
            placeholderTextColor={colors.textMuted}
            ref={searchRef}
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
          <View style={styles.clearSlot}>
            {query ? (
              <IconButton
                accessibilityLabel="검색어 지우기"
                icon={<X color={colors.textMuted} size={16} />}
                onPress={() => setQuery("")}
              />
            ) : null}
          </View>
        </View>
      </View>

      <View accessibilityLabel="가게 찾는 방법" accessibilityRole="tablist" style={styles.tabs}>
        {MODES.map(({ id, label }) => {
          const active = mode === id
          const count = id === "saved" ? savedShops.length : id === "nearby" ? allShops.length : null
          return (
            <Pressable
              accessibilityLabel={count === null ? label : `${label} ${count}곳`}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              key={id}
              onPress={() => {
                setMode(id)
                if (id === "search") searchRef.current?.focus()
                else searchRef.current?.blur()
              }}
              style={({ pressed }) => [styles.tab, id === "saved" && styles.savedTab, id === "search" && styles.searchTab, active && styles.tabActive, pressed && !active && styles.tabPressed]}
            >
              <AppText capScale numberOfLines={1} style={[typography.button, active && styles.onSelectedText]} variant="secondary">
                {label}
                {count !== null ? (
                  <AppText capScale style={active ? styles.selectedCount : undefined} tone={active ? "ink" : "muted"} variant="secondary">
                    {` ${count}곳`}
                  </AppText>
                ) : null}
              </AppText>
            </Pressable>
          )
        })}
      </View>

      {isLoading ? (
        <LoadingState label="가게 목록을 불러오는 중…" />
      ) : (
        <FlatList
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={listEmpty}
          ListHeaderComponent={listHeader}
          // 모달 시트도 화면 아래 끝까지 내려오므로 홈 인디케이터 영역 위에 끝 여백을 둔다
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + spacing.x8 }]}
          data={data}
          ListFooterComponent={mode !== "saved" && activeQuery.error && data.length ? (
            <EmptyState actionLabel="다시 불러오기" onAction={activeQuery.loadMore} title="다음 가게를 불러오지 못했어요" />
          ) : mode !== "saved" && activeQuery.isLoading && data.length ? <LoadingState label="더 불러오는 중…" /> : null}
          keyExtractor={(item) => item.id}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          onEndReached={() => {
            if (mode !== "saved" && activeQuery.hasMore && !activeQuery.isLoading && !activeQuery.error) activeQuery.loadMore()
          }}
          onEndReachedThreshold={0.6}
          renderItem={({ item }) => <ShopRow onSelect={() => choose(item)} shop={item} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  selectedCount: { opacity: 0.72, color: colors.onSelected },
  onSelectedText: { color: colors.onSelected },
  handle: {
    width: 36,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginTop: spacing.x2_5,
  },
  header: {
    minHeight: 92,
    paddingLeft: spacing.gutter,
    paddingRight: spacing.x2,
    paddingTop: spacing.x2,
    paddingBottom: spacing.x4,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.x2,
  },
  searchWrap: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.x2 },
  searchField: {
    minHeight: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.canvasSoft,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: spacing.x4,
    gap: spacing.x2,
  },
  searchInput: {
    ...typography.body,
    flex: 1,
    minHeight: 48,
    color: colors.ink,
    paddingVertical: 0,
    paddingRight: spacing.x3,
  },
  clearSlot: { width: touchTarget, height: touchTarget },
  tabs: {
    flexDirection: "row",
    gap: spacing.x2,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.x2,
    paddingBottom: spacing.x2,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: touchTarget,
    borderRadius: radii.pill,
    backgroundColor: colors.canvasSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.x1,
  },
  savedTab: { flex: 1.45 },
  searchTab: { flex: 0.85 },
  tabActive: { backgroundColor: colors.selected },
  tabPressed: { backgroundColor: colors.surfacePressed },
  listHeader: { minHeight: touchTarget, justifyContent: "center" },
  listContent: { paddingHorizontal: spacing.gutter, paddingTop: 0, flexGrow: 1 },
  listCaptionButton: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.x1 },
  listCaption: { color: colors.textMuted },
  quickKeywords: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x2 },
  separator: { height: 1, backgroundColor: colors.border },
  row: {
    minHeight: 72,
    paddingVertical: spacing.x3,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x3,
  },
  rowPressed: { backgroundColor: colors.surfacePressed },
  rowPhoto: {
    width: 48,
    height: 48,
    borderRadius: radii.sm,
    overflow: "hidden",
    backgroundColor: colors.canvasSoft,
  },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: spacing.x1_5 },
  rowName: { fontSize: 15, lineHeight: 20 },
  branch: { flexShrink: 1, fontSize: 13, lineHeight: 18 },
  rowSpec: { marginTop: spacing.x0_5, fontSize: 13, lineHeight: 18 },
  rowMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.x1_5, marginTop: spacing.x0_5 },
})
