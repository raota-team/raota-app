import { router, useLocalSearchParams } from "expo-router"
import { Check, ChevronDown, ChevronRight, List, Map as MapIcon, MapPin, Search, Soup, X } from "lucide-react-native"
import { useEffect, useMemo, useState, type ReactElement } from "react"
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import type { Shop, ShopCatalogItem } from "@raota/shared"
import { ResilientUriImage } from "@/src/components/ResilientUriImage"
import { AppText, BottomSheet, EmptyState, LoadingState } from "@/src/components/ui"
import { useShops } from "@/src/data/hooks"
import { distanceBetweenCoordinates } from "@/src/domain/shops"
import { colors, maxFontScale, radii, shadows, spacing, touchTarget, typography } from "@/src/theme"

/*
 * 지도 탭의 공용 부품(검색·필터 머리, 목록, 하단 퀵뷰). 웹 MapScreen과 같은 배치·크기·문구를 쓴다.
 * iOS(map.tsx)는 여기에 Apple 지도를 더하고, Expo 웹(이 파일의 기본 내보내기)은 목록만 보여준다.
 * 퀵뷰와 목록에 취향 일치도는 표시하지 않는다(MVP 범위 밖).
 */

export type MapShop = Shop & Partial<Pick<ShopCatalogItem, "style" | "spec" | "lastOrder">>
export type MapSort = "distance" | "popular"
export interface Coordinate {
  latitude: number
  longitude: number
}

/** short는 좁은 화면(iPhone SE)의 필터 버튼에 쓰는 짧은 이름 */
export const REGION_OPTIONS = [
  { value: "ALL", label: "전체 지역", short: "전체 지역", keys: [] as string[] },
  { value: "망원", label: "마포 · 망원동", short: "망원동", keys: ["망원"] },
  { value: "합정", label: "마포 · 합정/상수", short: "합정/상수", keys: ["합정", "상수"] },
  { value: "연남", label: "마포 · 연남/홍대", short: "연남/홍대", keys: ["연남", "홍대", "서교"] },
]

export const MENU_OPTIONS = [
  { value: "ALL", label: "모든 메뉴", short: "모든 메뉴", keys: [] as string[] },
  { value: "쇼유", label: "쇼유 라멘 (간장)", short: "쇼유", keys: ["쇼유"] },
  { value: "돈코츠", label: "돈코츠/이에케 (돼지뼈)", short: "돈코츠", keys: ["돈코츠", "이에케"] },
  { value: "시오", label: "시오 라멘 (소금)", short: "시오", keys: ["시오"] },
  { value: "미소", label: "미소 라멘 (된장)", short: "미소", keys: ["미소"] },
  { value: "토리파이탄", label: "토리파이탄 (닭백탕)", short: "토리파이탄", keys: ["토리파이탄", "닭백탕"] },
]

const SORT_OPTIONS: Array<{ value: MapSort; label: string }> = [
  { value: "distance", label: "거리순" },
  { value: "popular", label: "인기순" },
]

export function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${meters}m`
}

/** 영업 상태는 원장의 businessStatus와 isOpen에서만 계산한다 */
export function statusOf(shop: Shop): { label: string; open: boolean } {
  if (shop.businessStatus !== "OPERATIONAL") return { label: "영업 정보 확인 필요", open: false }
  return shop.isOpen ? { label: "영업 중", open: true } : { label: "준비 중", open: false }
}

export function openShop(shopId: number) {
  router.push({ pathname: "/shop/[shopId]", params: { shopId: String(shopId) } })
}

function shopLabel(shop: MapShop) {
  const status = statusOf(shop)
  return `${shop.name}${shop.branch ? ` ${shop.branch}` : ""}, ${formatDistance(shop.distanceM)}, ${status.label}`
}

/**
 * 지역 · 메뉴 · 영업 중 · 검색어 필터와 거리/인기 정렬. 위치가 있으면 실제 거리로 다시 계산한다.
 */
export function useMapFilters(origin: Coordinate | null) {
  const shopsQuery = useShops()
  const [search, setSearch] = useState("")
  const [region, setRegion] = useState("ALL")
  const [menu, setMenu] = useState("ALL")
  const [onlyOpen, setOnlyOpen] = useState(false)
  const [sort, setSort] = useState<MapSort>("distance")

  // 홈의 "스타일로 찾기"가 지도 탭으로 넘기는 메뉴 필터(예: ?menu=쇼유). 모르는 값은 무시한다.
  // 같은 값으로 다시 들어오면 탭 파라미터가 바뀌지 않아 효과가 다시 돌지 않는다(사용자가 필터를 직접 풀었을 때).
  const params = useLocalSearchParams<{ menu?: string }>()
  useEffect(() => {
    if (params.menu && MENU_OPTIONS.some((option) => option.value === params.menu)) setMenu(params.menu)
  }, [params.menu])

  const mapShops = useMemo<MapShop[]>(
    () =>
      shopsQuery.data
        .filter((shop) => shop.lat && shop.lng)
        .map((shop) =>
          origin
            ? { ...shop, distanceM: Math.round(distanceBetweenCoordinates(origin, { latitude: shop.lat, longitude: shop.lng })) }
            : shop,
        ),
    [origin, shopsQuery.data],
  )

  const filtered = useMemo(() => {
    const regionKeys = REGION_OPTIONS.find((option) => option.value === region)?.keys ?? []
    const menuKeys = MENU_OPTIONS.find((option) => option.value === menu)?.keys ?? []
    const query = search.trim().toLocaleLowerCase("ko-KR")
    return mapShops
      .filter((shop) => {
        if (onlyOpen && !statusOf(shop).open) return false
        if (regionKeys.length && !regionKeys.some((key) => (shop.branch ?? "").includes(key) || shop.address.includes(key))) return false
        if (menuKeys.length && !menuKeys.some((key) => (shop.style ?? "").includes(key) || (shop.spec ?? "").includes(key) || shop.tags.some((tag) => tag.includes(key)))) {
          return false
        }
        if (query) {
          const haystack = [shop.name, shop.branch, shop.style, shop.spec, ...shop.tags]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase("ko-KR")
          if (!haystack.includes(query)) return false
        }
        return true
      })
      .sort((a, b) =>
        sort === "popular"
          ? b.reviewCount - a.reviewCount || b.rating - a.rating || a.distanceM - b.distanceM
          : a.distanceM - b.distanceM,
      )
  }, [mapShops, menu, onlyOpen, region, search, sort])

  const hasActiveFilter = region !== "ALL" || menu !== "ALL" || onlyOpen
  return {
    isLoading: shopsQuery.isLoading,
    search,
    setSearch,
    region,
    setRegion,
    menu,
    setMenu,
    onlyOpen,
    setOnlyOpen,
    sort,
    setSort,
    filtered,
    hasActiveFilter,
    resetFilters: () => {
      setRegion("ALL")
      setMenu("ALL")
      setOnlyOpen(false)
    },
  }
}

export type MapFilters = ReturnType<typeof useMapFilters>

// ---------------------------------------------------------------------------
// 머리: 검색 + 지도/목록 전환 + 필터
// ---------------------------------------------------------------------------

function FilterRow({ narrow, children }: { narrow: boolean; children: React.ReactNode }) {
  if (!narrow) return <View style={styles.filterRow}>{children}</View>
  return (
    <ScrollView
      contentContainerStyle={styles.filterRowScroll}
      horizontal
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
      style={styles.filterScroller}
    >
      {children}
    </ScrollView>
  )
}

export function MapHeader({
  filters,
  viewMode,
  onToggleView,
}: {
  filters: MapFilters
  viewMode: "map" | "list"
  /** 없으면 전환 버튼을 숨긴다(웹 미리보기) */
  onToggleView?: () => void
}) {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  /** iPhone SE 폭에서는 필터를 내용 크기로 두고 가로로 넘긴다(DESIGN.md: 가로 스크롤 필터 허용) */
  const narrow = width < 375
  const [picker, setPicker] = useState<"region" | "menu" | null>(null)
  const regionOption = REGION_OPTIONS.find((option) => option.value === filters.region) ?? REGION_OPTIONS[0]
  const menuOption = MENU_OPTIONS.find((option) => option.value === filters.menu) ?? MENU_OPTIONS[0]
  const regionLabel = regionOption.label
  const menuLabel = menuOption.label
  const regionActive = filters.region !== "ALL"
  const menuActive = filters.menu !== "ALL"
  const options = picker === "region" ? REGION_OPTIONS : MENU_OPTIONS
  const current = picker === "region" ? filters.region : filters.menu

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.x3 }]}>
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search color={colors.textMuted} size={16} />
          <TextInput
            accessibilityLabel="라멘집 검색"
            clearButtonMode="never"
            maxFontSizeMultiplier={maxFontScale}
            onChangeText={filters.setSearch}
            placeholder="라멘집 이름, 계보, 지점 검색"
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            style={styles.searchInput}
            value={filters.search}
          />
          {filters.search ? (
            <Pressable
              accessibilityLabel="검색어 지우기"
              accessibilityRole="button"
              onPress={() => filters.setSearch("")}
              style={styles.clearButton}
            >
              <X color={colors.textMuted} size={16} />
            </Pressable>
          ) : null}
        </View>
        {onToggleView ? (
          <Pressable
            accessibilityLabel={viewMode === "map" ? "목록으로 보기" : "지도로 보기"}
            accessibilityRole="button"
            onPress={onToggleView}
            style={({ pressed }) => [styles.toggle, pressed && styles.pressedDim]}
          >
            {viewMode === "map" ? <List color={colors.onDark} size={16} /> : <MapIcon color={colors.onDark} size={16} />}
            <AppText capScale style={styles.bold} tone="onDark" variant="secondary">
              {viewMode === "map" ? "목록" : "지도"}
            </AppText>
          </Pressable>
        ) : null}
      </View>

      <FilterRow narrow={narrow}>
        <Pressable
          accessibilityHint="지역을 골라요"
          accessibilityLabel={`지역 필터: ${regionLabel}`}
          accessibilityRole="button"
          accessibilityState={{ expanded: picker === "region" }}
          onPress={() => setPicker("region")}
          style={[styles.filterButton, !narrow && styles.filterButtonWide, regionActive && styles.filterButtonActive]}
        >
          <MapPin color={regionActive ? colors.brand : colors.ink} size={14} />
          <AppText
            capScale
            numberOfLines={1}
            style={[styles.filterText, !narrow && styles.filterTextWide, regionActive && styles.filterTextActive]}
            variant="secondary"
          >
            {narrow ? regionOption.short : regionLabel}
          </AppText>
          <ChevronDown color={regionActive ? colors.brand : colors.ink} size={16} />
        </Pressable>
        <Pressable
          accessibilityHint="라멘 종류를 골라요"
          accessibilityLabel={`메뉴 필터: ${menuLabel}`}
          accessibilityRole="button"
          accessibilityState={{ expanded: picker === "menu" }}
          onPress={() => setPicker("menu")}
          style={[styles.filterButton, !narrow && styles.filterButtonWide, menuActive && styles.filterButtonActive]}
        >
          <Soup color={menuActive ? colors.brand : colors.ink} size={16} />
          <AppText
            capScale
            numberOfLines={1}
            style={[styles.filterText, !narrow && styles.filterTextWide, menuActive && styles.filterTextActive]}
            variant="secondary"
          >
            {narrow ? menuOption.short : menuLabel}
          </AppText>
          <ChevronDown color={menuActive ? colors.brand : colors.ink} size={16} />
        </Pressable>
        <Pressable
          accessibilityLabel="영업 중인 곳만 보기"
          accessibilityRole="switch"
          accessibilityState={{ checked: filters.onlyOpen }}
          onPress={() => filters.setOnlyOpen(!filters.onlyOpen)}
          style={[styles.openToggle, filters.onlyOpen && styles.openToggleActive]}
        >
          <View style={[styles.openDot, filters.onlyOpen && styles.openDotActive]} />
          <AppText capScale style={styles.bold} tone={filters.onlyOpen ? "onDark" : "ink"} variant="secondary">
            영업 중
          </AppText>
        </Pressable>
        {filters.hasActiveFilter ? (
          <Pressable
            accessibilityLabel="필터 초기화"
            accessibilityRole="button"
            onPress={filters.resetFilters}
            style={({ pressed }) => [styles.resetButton, pressed && styles.resetPressed]}
          >
            <X color={colors.ink} size={16} />
          </Pressable>
        ) : null}
      </FilterRow>

      <BottomSheet
        onClose={() => setPicker(null)}
        title={picker === "region" ? "지역 선택" : "메뉴 선택"}
        visible={picker !== null}
      >
        <View accessibilityRole="radiogroup" style={styles.optionList}>
          {options.map((option) => {
            const selected = option.value === current
            return (
              <Pressable
                accessibilityLabel={option.label}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                key={option.value}
                onPress={() => {
                  if (picker === "region") filters.setRegion(option.value)
                  else filters.setMenu(option.value)
                  setPicker(null)
                }}
                style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && !selected && styles.pressedWash]}
              >
                <AppText style={selected && styles.bold} tone={selected ? "brand" : "ink"} variant="secondary">
                  {option.label}
                </AppText>
                {selected ? <Check color={colors.brand} size={16} /> : null}
              </Pressable>
            )
          })}
        </View>
      </BottomSheet>
    </View>
  )
}

// ---------------------------------------------------------------------------
// 하단 퀵뷰(지도에서 고른 매장)
// ---------------------------------------------------------------------------

export function QuickView({ shop }: { shop: MapShop | null }) {
  if (!shop) {
    return (
      <View style={styles.quickView}>
        <View accessibilityLiveRegion="polite" style={styles.quickEmpty}>
          <AppText style={styles.center} variant="cardTitle">
            조건에 맞는 라멘집이 없어요
          </AppText>
          <AppText style={[styles.center, styles.gapTop]} tone="muted" variant="secondary">
            검색어나 필터를 바꿔 다시 찾아보세요.
          </AppText>
        </View>
      </View>
    )
  }
  const status = statusOf(shop)
  return (
    <View style={styles.quickView}>
      <Pressable
        accessibilityHint="매장 상세로 이동해요"
        accessibilityLabel={`${shopLabel(shop)}, 매장 상세 보기`}
        accessibilityRole="button"
        onPress={() => openShop(shop.id)}
        style={({ pressed }) => [styles.quickRow, pressed && styles.pressedDim]}
      >
        <ResilientUriImage accessibilityLabel="" style={styles.quickPhoto} uri={shop.photos[0]} />
        <View style={styles.flexBody}>
          <View style={styles.titleRow}>
            <AppText numberOfLines={1} style={styles.flexShrink} variant="cardTitle">
              {shop.name}
              {shop.branch ? <AppText tone="muted" variant="cardTitle">{` · ${shop.branch}`}</AppText> : null}
            </AppText>
            {shop.style ? (
              <View style={styles.styleTag}>
                <AppText capScale numberOfLines={1} style={styles.bold} variant="meta">
                  {shop.style}
                </AppText>
              </View>
            ) : null}
          </View>
          {shop.spec ? (
            <AppText capScale numberOfLines={1} style={styles.gapTop} tone="muted" variant="secondary">
              {shop.spec}
            </AppText>
          ) : null}
          <View style={styles.metaRow}>
            <AppText capScale style={styles.bold} tone={status.open ? "positive" : "muted"} variant="meta">
              {`● ${status.label}`}
            </AppText>
            <AppText capScale style={styles.dot} variant="meta">
              ·
            </AppText>
            <AppText capScale style={styles.bold} tone="muted" variant="meta">
              {formatDistance(shop.distanceM)}
            </AppText>
          </View>
        </View>
        <ChevronRight color={colors.textMuted} size={20} />
      </Pressable>
    </View>
  )
}

// ---------------------------------------------------------------------------
// 목록
// ---------------------------------------------------------------------------

function ListRow({ shop }: { shop: MapShop }) {
  const status = statusOf(shop)
  const line = [shop.style, shop.spec].filter(Boolean).join(" · ")
  return (
    <Pressable
      accessibilityLabel={`${shopLabel(shop)}${shop.lastOrder ? `, 라스트오더 ${shop.lastOrder}` : ""}, 매장 상세 보기`}
      accessibilityRole="button"
      onPress={() => openShop(shop.id)}
      style={({ pressed }) => [styles.listCard, pressed && styles.pressedWash]}
    >
      <ResilientUriImage accessibilityLabel="" style={styles.listPhoto} uri={shop.photos[0]} />
      <View style={styles.flexBody}>
        <AppText numberOfLines={1} variant="cardTitle">
          {shop.name}
          {shop.branch ? <AppText tone="muted" variant="cardTitle">{` · ${shop.branch}`}</AppText> : null}
        </AppText>
        {line ? (
          <AppText capScale numberOfLines={1} style={styles.gapTop} tone="muted" variant="secondary">
            {line}
          </AppText>
        ) : null}
        <View style={styles.listMeta}>
          <AppText capScale numberOfLines={1} style={[styles.bold, styles.noShrink]} tone={status.open ? "positive" : "muted"} variant="meta">
            {`● ${status.label}`}
          </AppText>
          <AppText capScale style={styles.dot} variant="meta">
            ·
          </AppText>
          <AppText capScale numberOfLines={1} style={[styles.bold, styles.noShrink]} tone="muted" variant="meta">
            {formatDistance(shop.distanceM)}
          </AppText>
          {shop.lastOrder ? (
            <>
              <AppText capScale style={styles.dot} variant="meta">
                ·
              </AppText>
              <AppText capScale numberOfLines={1} style={[styles.bold, styles.flexShrink]} tone="muted" variant="meta">
                {`라스트오더 ${shop.lastOrder}`}
              </AppText>
            </>
          ) : null}
        </View>
      </View>
    </Pressable>
  )
}

export function ShopListView({ filters, notice }: { filters: MapFilters; notice?: ReactElement | null }) {
  return (
    <FlatList
      ListEmptyComponent={
        filters.isLoading ? (
          <LoadingState label="라멘집을 불러오는 중…" />
        ) : (
          <View style={styles.emptyBox}>
            <EmptyState
              description="다른 매장명이나 라멘 종류로 찾아보세요."
              icon={<Search color={colors.textMuted} size={24} />}
              title="검색 결과가 없어요"
            />
          </View>
        )
      }
      ListHeaderComponent={
        <View>
          {notice}
          <View style={styles.listHead}>
            <AppText capScale style={styles.bold} tone="muted" variant="secondary">
              총{" "}
              <AppText style={styles.extraBold} variant="secondary">
                {`${filters.filtered.length}곳`}
              </AppText>
            </AppText>
            <View accessibilityLabel="정렬" accessibilityRole="radiogroup" style={styles.sortGroup}>
              {SORT_OPTIONS.map((option) => {
                const selected = filters.sort === option.value
                return (
                  <Pressable
                    accessibilityLabel={option.label}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    key={option.value}
                    onPress={() => filters.setSort(option.value)}
                    style={[styles.sortButton, selected && styles.sortButtonActive]}
                  >
                    <AppText capScale style={styles.bold} tone={selected ? "onDark" : "muted"} variant="secondary">
                      {option.label}
                    </AppText>
                  </Pressable>
                )
              })}
            </View>
          </View>
        </View>
      }
      ItemSeparatorComponent={() => <View style={styles.listGap} />}
      contentContainerStyle={styles.listContent}
      data={filters.filtered}
      keyExtractor={(shop) => String(shop.id)}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => <ListRow shop={item} />}
      showsVerticalScrollIndicator={false}
    />
  )
}

/** 위치 권한이 없을 때 기본 지역과 설정 경로를 알린다 */
export function LocationNotice({ message, actionLabel, onAction }: { message: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.notice}>
      <MapPin color={colors.ink} size={16} />
      <AppText style={styles.flexShrinkGrow} tone="sub" variant="secondary">
        {message}
      </AppText>
      {actionLabel && onAction ? (
        <Pressable accessibilityLabel={actionLabel} accessibilityRole="button" onPress={onAction} style={({ pressed }) => [styles.noticeAction, pressed && styles.pressedDim]}>
          <AppText capScale style={styles.bold} variant="secondary">
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  )
}

/** Expo 웹 미리보기: Apple 지도는 iOS에만 있으므로 같은 검색·필터와 목록만 보여준다 */
export default function WebMapScreen() {
  const filters = useMapFilters(null)
  return (
    <View style={styles.root}>
      <MapHeader filters={filters} viewMode="list" />
      <ShopListView
        filters={filters}
        notice={<LocationNotice message="지도와 현재 위치는 iOS 앱에서 Apple 지도로 보여드려요. 여기서는 목록으로 볼 수 있어요." />}
      />
    </View>
  )
}

export const mapStyles = StyleSheet.create({
  floatingButton: {
    width: touchTarget,
    height: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.canvas,
    ...shadows.floating,
  },
})

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  bold: { fontWeight: "700" },
  extraBold: { fontWeight: "800" },
  center: { textAlign: "center" },
  gapTop: { marginTop: spacing.x0_5 },
  flexBody: { flex: 1, minWidth: 0 },
  flexShrink: { flexShrink: 1, minWidth: 0 },
  flexShrinkGrow: { flex: 1, minWidth: 0 },
  pressedDim: { opacity: 0.8 },
  pressedWash: { backgroundColor: colors.canvasSoft },
  dot: { color: colors.textFaint },
  noShrink: { flexShrink: 0 },

  header: {
    paddingHorizontal: spacing.x4,
    paddingBottom: spacing.x3,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.canvas,
    zIndex: 2,
  },
  searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.x2 },
  searchBox: {
    flex: 1,
    height: touchTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x2,
    paddingLeft: spacing.x3_5,
    paddingRight: spacing.x0_5,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.canvasSoft,
  },
  searchInput: { ...typography.body, flex: 1, minWidth: 0, height: "100%", color: colors.ink, paddingVertical: 0 },
  clearButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  toggle: {
    height: touchTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x1_5,
    paddingHorizontal: spacing.x3_5,
    borderRadius: radii.sm,
    backgroundColor: colors.ink,
  },
  filterRow: { flexDirection: "row", alignItems: "center", gap: spacing.x2, paddingTop: spacing.x2_5 },
  filterButton: {
    height: touchTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x1_5,
    paddingHorizontal: spacing.x3,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.canvasSoft,
  },
  filterButtonWide: { flex: 1, minWidth: 0 },
  filterButtonActive: { borderColor: colors.brand, backgroundColor: colors.brandWeak },
  filterText: { fontWeight: "700", color: colors.ink },
  filterTextWide: { flex: 1, minWidth: 0 },
  filterTextActive: { color: colors.brand },
  filterScroller: { marginHorizontal: -spacing.x4, marginTop: spacing.x2_5 },
  filterRowScroll: { flexDirection: "row", alignItems: "center", gap: spacing.x2, paddingHorizontal: spacing.x4 },
  openToggle: {
    height: touchTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x1_5,
    paddingHorizontal: spacing.x3,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.canvasSoft,
  },
  openToggleActive: { borderColor: colors.ink, backgroundColor: colors.ink },
  openDot: { width: 6, height: 6, borderRadius: radii.pill, backgroundColor: colors.positive },
  openDotActive: { backgroundColor: colors.onDark },
  resetButton: {
    width: touchTarget,
    height: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
    backgroundColor: colors.canvasSoft,
  },
  resetPressed: { backgroundColor: colors.border },
  optionList: { gap: spacing.x0_5 },
  option: {
    minHeight: touchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.x2,
    paddingHorizontal: spacing.x3_5,
    borderRadius: radii.sm,
  },
  optionSelected: { backgroundColor: colors.brandWeak },

  quickView: {
    padding: spacing.x4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.canvas,
  },
  quickEmpty: { paddingVertical: spacing.x3 },
  quickRow: { flexDirection: "row", alignItems: "center", gap: spacing.x3_5 },
  quickPhoto: { width: 64, height: 64, borderRadius: radii.sm },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.x2 },
  styleTag: {
    flexShrink: 0,
    paddingHorizontal: spacing.x2,
    paddingVertical: spacing.x0_5,
    borderRadius: radii.xs,
    backgroundColor: colors.canvasSoft,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.x1_5, marginTop: spacing.x1 },

  listContent: { padding: spacing.x4, paddingBottom: spacing.x8 },
  listHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.x2,
    paddingBottom: spacing.x2,
    marginBottom: spacing.x3,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sortGroup: { flexDirection: "row", alignItems: "center", gap: spacing.x1 },
  sortButton: { minHeight: touchTarget, justifyContent: "center", paddingHorizontal: spacing.x2_5, borderRadius: radii.xs },
  sortButtonActive: { backgroundColor: colors.ink },
  listGap: { height: spacing.x2_5 },
  listCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x3_5,
    padding: spacing.x3_5,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.canvas,
  },
  listPhoto: { width: 72, height: 72, borderRadius: radii.sm },
  listMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x1_5,
    marginTop: spacing.x2,
    paddingTop: spacing.x2,
    borderTopWidth: 1,
    borderTopColor: colors.canvasSoft,
    overflow: "hidden",
  },
  emptyBox: { borderWidth: 1, borderStyle: "dashed", borderColor: colors.textFaint, borderRadius: radii.sm },

  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x2,
    paddingHorizontal: spacing.x3,
    paddingVertical: spacing.x2,
    marginBottom: spacing.x3,
    borderRadius: radii.sm,
    backgroundColor: colors.canvasSoft,
  },
  noticeAction: { minHeight: touchTarget, justifyContent: "center", paddingHorizontal: spacing.x2 },
})
