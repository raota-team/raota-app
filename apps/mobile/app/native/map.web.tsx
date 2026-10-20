import { router, useLocalSearchParams } from "expo-router"
import { Check, ChevronDown, List, Map as MapIcon, MapPin, Search, X } from "lucide-react-native"
import { useEffect, useMemo, useState, type ReactElement } from "react"
import { FlatList, Image, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import type { Shop, ShopCatalogItem } from "@raota/shared"
import { ResilientUriImage } from "@/src/components/ResilientUriImage"
import { AppText, BottomSheet, EmptyState, LoadingState } from "@/src/components/ui"
import { useMapShops } from "@/src/data/hooks"
import { distanceBetweenCoordinates, matchesShopRamenType } from "@/src/domain/shops"
import { colors, line, maxFontScale, radii, shadows, spacing, touchTarget, typography } from "@/src/theme"

/** 검색·필터·퀵뷰는 지도 위에 떠 있고, 목록에서는 사진과 정보 사이에 줄만 둔다. */
export const MAP_PIN_HEIGHT = touchTarget + spacing.x1 + 28

export type MapShop = Shop & Partial<Pick<ShopCatalogItem, "style" | "spec" | "lastOrder">>
export type MapSort = "distance" | "popular"
export interface Coordinate {
  latitude: number
  longitude: number
}

/** 좁은 필터 키에서도 읽히는 짧은 이름. 시트와 접근성에는 전체 이름을 쓴다 */
export const REGION_OPTIONS = [
  { value: "ALL", label: "전체 지역", short: "전체 지역", keys: [] as string[] },
  { value: "망원", label: "마포 · 망원동", short: "망원동", keys: ["망원"] },
  { value: "합정", label: "마포 · 합정/상수", short: "합정/상수", keys: ["합정", "상수"] },
  { value: "연남", label: "마포 · 연남/홍대", short: "연남/홍대", keys: ["연남", "홍대", "서교"] },
]

export const MENU_OPTIONS = [
  { value: "ALL", label: "모든 메뉴", short: "모든 메뉴", keys: [] as string[] },
  { value: "쇼유", label: "쇼유 라멘 (간장)", short: "쇼유", keys: ["쇼유"] },
  { value: "돈코츠", label: "돈코츠 라멘 (돼지뼈)", short: "돈코츠", keys: ["돈코츠"] },
  { value: "이에케", label: "이에케 (돈코츠쇼유)", short: "이에케", keys: ["이에케"] },
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

function distanceLabel(shop: MapShop) {
  return shop.distanceM > 0
    ? formatDistance(shop.distanceM)
    : "unknownFields" in shop && Array.isArray(shop.unknownFields) && shop.unknownFields.includes("distance")
      ? "거리 정보 없음"
      : formatDistance(shop.distanceM)
}

/** 영업 상태는 원장의 businessStatus와 isOpen에서만 계산한다 */
export function statusOf(shop: Shop): { label: string; open: boolean } {
  if (shop.businessStatus !== "OPERATIONAL") return { label: "영업 정보 확인 필요", open: false }
  return shop.isOpen ? { label: "영업 중", open: true } : { label: "준비 중", open: false }
}

export function openShop(shopId: string) {
  router.push({ pathname: "/shop/[shopId]", params: { shopId } })
}

function shopLabel(shop: MapShop) {
  const status = statusOf(shop)
  return `${shop.name}${shop.branch ? ` ${shop.branch}` : ""}, ${distanceLabel(shop)}, ${status.label}`
}

/** 서버 모드에서는 전체 지도 매장을 같은 요청으로 받아 핀과 목록을 만든다. mock은 기존 필터·정렬을 유지한다. */
export function useMapFilters(origin: Coordinate | null) {
  const [search, setSearch] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [region, setRegion] = useState("ALL")
  const [menu, setMenu] = useState("ALL")
  const [onlyOpen, setOnlyOpen] = useState(false)
  const [sort, setSort] = useState<MapSort>("distance")
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])
  const shopsQuery = useMapShops({
    query: searchQuery || undefined,
    ramenType: menu === "ALL" ? undefined : menu,
    openNow: onlyOpen || undefined,
    sort: sort === "popular" || !origin ? "POPULAR" : "DISTANCE",
    latitude: origin?.latitude,
    longitude: origin?.longitude,
  })
  // 홈의 "스타일로 찾기"가 지도 탭으로 넘기는 메뉴 필터(예: ?menu=쇼유). 모르는 값은 무시한다.
  // 같은 값으로 다시 들어오면 탭 파라미터가 바뀌지 않아 효과가 다시 돌지 않는다(사용자가 필터를 직접 풀었을 때).
  const params = useLocalSearchParams<{ menu?: string }>()
  useEffect(() => {
    if (params.menu && MENU_OPTIONS.some((option) => option.value === params.menu)) setMenu(params.menu)
  }, [params.menu])

  const mapShops = useMemo<MapShop[]>(
    () =>
      shopsQuery.data
        .filter((shop) => shopsQuery.remote || (shop.lat && shop.lng))
        .map((shop) =>
          origin && shop.lat && shop.lng
            ? { ...shop, distanceM: Math.round(distanceBetweenCoordinates(origin, { latitude: shop.lat, longitude: shop.lng })) }
            : shop,
        ),
    [origin, shopsQuery.data, shopsQuery.remote],
  )

  const filtered = useMemo(() => {
    const regionKeys = REGION_OPTIONS.find((option) => option.value === region)?.keys ?? []
    const inRegion = regionKeys.length
      ? mapShops.filter((shop) => regionKeys.some((key) => (shop.branch ?? "").includes(key) || shop.address.includes(key)))
      : mapShops
    if (shopsQuery.remote) return inRegion // 나머지 필터와 정렬은 서버의 전체 결과를 따른다.
    const menuOption = MENU_OPTIONS.find((option) => option.value === menu)
    const query = search.trim().toLocaleLowerCase("ko-KR")
    return inRegion
      .filter((shop) => {
        if (onlyOpen && !statusOf(shop).open) return false
        if (menuOption && menuOption.value !== "ALL" && !matchesShopRamenType(shop, menuOption.value, menuOption.keys)) {
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
  }, [mapShops, menu, onlyOpen, region, search, shopsQuery.remote, sort])
  const hasActiveFilter = region !== "ALL" || menu !== "ALL" || onlyOpen
  const pendingSearch = shopsQuery.remote && search.trim() !== searchQuery
  return {
    isLoading: shopsQuery.isLoading || pendingSearch,
    error: shopsQuery.error,
    allShops: mapShops,
    remote: shopsQuery.remote,
    search,
    setSearch,
    region,
    setRegion,
    menu,
    setMenu,
    onlyOpen,
    setOnlyOpen,
    sort: shopsQuery.remote && !origin ? "popular" : sort,
    setSort,
    filtered: pendingSearch ? [] : filtered,
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
  onHeight,
}: {
  filters: MapFilters
  viewMode: "map" | "list"
  /** 웹 미리보기는 목록만 보여 주므로 전환 버튼이 없다. */
  onToggleView?: () => void
  /** 지도 조작키를 검색·필터 아래에 놓을 때 실제 머리 높이를 사용한다. */
  onHeight?: (height: number) => void
}) {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  /** 좁은 화면과 초기화 키가 생긴 상태는 세 필터를 가로 스크롤한다. */
  const scrollFilters = width < 390 || filters.hasActiveFilter
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
    // 목록 ↔ 지도 전환 때 검색창과 전환 버튼이 같은 자리에 있도록 두 모드의 위 여백을 같게 둔다
    <View onLayout={onHeight ? ({ nativeEvent }) => onHeight(nativeEvent.layout.height) : undefined} style={[styles.header, viewMode === "map" && styles.mapHeader, { paddingTop: insets.top + spacing.x2 }]}>
      <View style={styles.searchRow}>
        <View style={[styles.searchBox, viewMode === "map" && styles.mapFloating]}>
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
          ) : <View style={styles.clearButton} />}
        </View>
        {onToggleView ? (
          <Pressable
            accessibilityLabel={viewMode === "map" ? "목록으로 보기" : "지도로 보기"}
            accessibilityRole="button"
            onPress={onToggleView}
            style={({ pressed }) => [styles.toggle, viewMode === "map" && styles.mapFloating, pressed && styles.pressedWash]}
          >
            {viewMode === "map" ? <List color={colors.ink} size={18} /> : <MapIcon color={colors.ink} size={18} />}
            <AppText capScale style={styles.bold} variant="meta">
              {viewMode === "map" ? "목록" : "지도"}
            </AppText>
          </Pressable>
        ) : null}
      </View>

      <FilterRow narrow={scrollFilters}>
        <Pressable
          accessibilityHint="지역을 골라요"
          accessibilityLabel={`지역 필터: ${regionLabel}`}
          accessibilityRole="button"
          accessibilityState={{ expanded: picker === "region" }}
          hitSlop={{ top: 2, bottom: 2 }}
          onPress={() => setPicker("region")}
          style={({ pressed }) => [styles.filterButton, styles.regionFilter, viewMode === "map" && styles.mapFloating, regionActive && styles.filterButtonActive, pressed && !regionActive && styles.pressedWash]}
        >
          <AppText
            capScale
            numberOfLines={1}
            style={[styles.filterText, regionActive && styles.filterTextActive]}
            variant="button"
          >
            {regionOption.short}
          </AppText>
          <ChevronDown color={regionActive ? colors.onSelected : colors.ink} size={16} />
        </Pressable>
        <Pressable
          accessibilityHint="라멘 종류를 골라요"
          accessibilityLabel={`메뉴 필터: ${menuLabel}`}
          accessibilityRole="button"
          accessibilityState={{ expanded: picker === "menu" }}
          hitSlop={{ top: 2, bottom: 2 }}
          onPress={() => setPicker("menu")}
          style={({ pressed }) => [styles.filterButton, styles.menuFilter, viewMode === "map" && styles.mapFloating, menuActive && styles.filterButtonActive, pressed && !menuActive && styles.pressedWash]}
        >
          <AppText
            capScale
            numberOfLines={1}
            style={[styles.filterText, menuActive && styles.filterTextActive]}
            variant="button"
          >
            {menuOption.short}
          </AppText>
          <ChevronDown color={menuActive ? colors.onSelected : colors.ink} size={16} />
        </Pressable>
        <Pressable
          accessibilityLabel="영업 중인 곳만 보기"
          accessibilityRole="switch"
          accessibilityState={{ checked: filters.onlyOpen }}
          hitSlop={{ top: 2, bottom: 2 }}
          onPress={() => filters.setOnlyOpen(!filters.onlyOpen)}
          style={({ pressed }) => [styles.filterButton, viewMode === "map" && styles.mapFloating, filters.onlyOpen && styles.filterButtonActive, pressed && !filters.onlyOpen && styles.pressedWash]}
        >
          <View style={styles.openDot} testID="map-open-lamp" />
          <AppText capScale style={[styles.bold, filters.onlyOpen && styles.filterTextActive]} variant="button">
            영업 중
          </AppText>
        </Pressable>
        {filters.hasActiveFilter ? (
          <Pressable
            accessibilityLabel="필터 초기화"
            accessibilityRole="button"
            hitSlop={{ top: 2, bottom: 2 }}
            onPress={filters.resetFilters}
            style={({ pressed }) => [styles.resetButton, viewMode === "map" && styles.mapFloating, pressed && styles.pressedWash]}
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
                <AppText style={selected && styles.onSelectedText} variant="secondary">
                  {option.label}
                </AppText>
                <View style={styles.optionCheck}>
                  {selected ? <Check color={colors.onSelected} size={16} /> : null}
                </View>
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
      <View accessibilityLiveRegion="polite" style={[styles.quickView, styles.quickEmpty]}>
        <AppText style={styles.center} variant="cardTitle">
          조건에 맞는 라멘집이 없어요
        </AppText>
        <AppText style={[styles.center, styles.gapTop]} tone="muted" variant="secondary">
          검색어나 필터를 바꿔 다시 찾아보세요.
        </AppText>
      </View>
    )
  }
  const status = statusOf(shop)
  return (
    <Pressable
      accessibilityHint="매장 상세로 이동해요"
      accessibilityLabel={`${shopLabel(shop)}${shop.style ? `, ${shop.style}` : ""}${shop.spec ? `, ${shop.spec}` : ""}${shop.lastOrder ? `, 라스트오더 ${shop.lastOrder}` : ""}, 매장 상세 보기`}
      accessibilityRole="button"
      onPress={() => openShop(shop.id)}
      style={({ pressed }) => [styles.quickView, styles.quickRow, pressed && styles.pressedWash]}
    >
      <ResilientUriImage accessibilityLabel="" style={styles.quickPhoto} uri={shop.photos[0]} />
      <View style={styles.flexBody}>
        <AppText lineBreakStrategyIOS="hangul-word" numberOfLines={1} style={styles.shopTitle} variant="cardTitle">
          {shop.name}
          {shop.branch ? <AppText style={styles.shopBranch} tone="muted" variant="cardTitle">{` · ${shop.branch}`}</AppText> : null}
        </AppText>
        {shop.style ? (
          <AppText capScale numberOfLines={1} tone="sub" variant="secondary">{shop.style}</AppText>
        ) : null}
        {shop.spec ? (
          <AppText capScale lineBreakStrategyIOS="hangul-word" numberOfLines={1} style={styles.gapTop} tone="sub" variant="secondary">
            {shop.spec}
          </AppText>
        ) : null}
        <View style={styles.metaRow}>
          <View style={styles.statusRow}>
            <View style={[styles.openDot, !status.open && styles.hiddenDot]} testID={status.open ? "map-open-status-lamp" : undefined} />
            <AppText capScale numberOfLines={1} style={[status.open && styles.bold, status.open && styles.openText]} tone={status.open ? "ink" : "muted"} variant="meta">
              {status.label}
            </AppText>
          </View>
          <AppText capScale numberOfLines={1} style={styles.flexShrinkGrow} tone="muted" variant="meta">
            {` · ${distanceLabel(shop)}${shop.lastOrder ? ` · 라스트오더 ${shop.lastOrder}` : ""}`}
          </AppText>
        </View>
      </View>
    </Pressable>
  )
}

// ---------------------------------------------------------------------------
// 목록
// ---------------------------------------------------------------------------

function ListRow({ shop }: { shop: MapShop }) {
  const status = statusOf(shop)
  const lastOrder = shop.lastOrder ? `라스트오더 ${shop.lastOrder}` : null
  return (
    <Pressable
      accessibilityLabel={`${shopLabel(shop)}${shop.lastOrder ? `, 라스트오더 ${shop.lastOrder}` : ""}, 매장 상세 보기`}
      accessibilityRole="button"
      onPress={() => openShop(shop.id)}
      style={({ pressed }) => [styles.listRow, pressed && styles.pressedWash]}
    >
      <ResilientUriImage accessibilityLabel="" style={styles.listPhoto} uri={shop.photos[0]} />
      <View style={[styles.flexBody, styles.listBody]}>
        <AppText lineBreakStrategyIOS="hangul-word" style={styles.shopTitle} variant="cardTitle">
          {shop.name}
          {shop.branch ? <AppText style={styles.shopBranch} tone="muted" variant="cardTitle">{` · ${shop.branch}`}</AppText> : null}
        </AppText>
        {shop.spec ? (
          <AppText capScale lineBreakStrategyIOS="hangul-word" style={styles.gapTop} tone="sub" variant="secondary">
            {shop.spec}
          </AppText>
        ) : null}
        <View style={styles.listMeta} testID="map-list-meta">
          {shop.style ? (
            <AppText capScale tone="sub" variant="meta">{shop.style}</AppText>
          ) : null}
          <View style={styles.statusRow}>
            <View style={[styles.openDot, !status.open && styles.hiddenDot]} testID={status.open ? "map-open-status-lamp" : undefined} />
            <AppText capScale numberOfLines={1} style={[status.open && styles.bold, status.open && styles.openText]} tone={status.open ? "ink" : "muted"} variant="meta">
              {status.label}
            </AppText>
          </View>
          <AppText capScale tone="muted" variant="meta">
            {` · ${distanceLabel(shop)}${lastOrder ? ` · ${lastOrder}` : ""}`}
          </AppText>
        </View>
      </View>
    </Pressable>
  )
}

export function ShopListView({ filters, notice, onRetry }: { filters: MapFilters; notice?: ReactElement | null; onRetry?: () => void }) {
  return (
    <FlatList
      ListEmptyComponent={
        filters.isLoading && !filters.filtered.length ? (
          <LoadingState label="라멘집을 불러오는 중…" />
        ) : (
          <EmptyState
            // 로컬 원장의 오류(저장소)는 다시 올려도 풀리지 않아 서버에서 읽을 때만 다시 부른다
            actionLabel={filters.error && filters.remote ? "다시 불러오기" : undefined}
            description={filters.error ? "잠시 후 다시 열어 주세요." : "다른 매장명이나 라멘 종류로 찾아보세요."}
            icon={<Search color={colors.inkSub} size={24} />}
            onAction={onRetry}
            title={filters.error ? "라멘집을 불러오지 못했어요" : "검색 결과가 없어요"}
          />
        )
      }
      ListHeaderComponent={
        <View>
          {notice}
          <View style={styles.listHead}>
            <AppText capScale style={styles.bold} variant="cardTitle">
              {`${filters.filtered.length}곳`}
            </AppText>
            <View accessibilityLabel="정렬" accessibilityRole="radiogroup" style={styles.sortGroup}>
              <View style={styles.sortInner}>
                {SORT_OPTIONS.map((option) => {
                  const selected = filters.sort === option.value
                  return (
                    <Pressable
                      accessibilityLabel={option.label}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      key={option.value}
                      onPress={() => filters.setSort(option.value)}
                      hitSlop={{ top: 4, bottom: 4 }}
                      style={({ pressed }) => [styles.sortButton, selected && styles.sortButtonActive, pressed && !selected && styles.sortButtonPressed]}
                    >
                      <AppText capScale style={[styles.bold, selected && styles.onSelectedText]} variant="button">
                        {option.label}
                      </AppText>
                    </Pressable>
                  )
                })}
              </View>
            </View>
          </View>
        </View>
      }
      ItemSeparatorComponent={() => <View style={styles.listDivider} />}
      contentContainerStyle={styles.listContent}
      data={filters.filtered}
      keyExtractor={(shop) => shop.id}
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
        <Pressable accessibilityLabel={actionLabel} accessibilityRole="button" onPress={onAction} style={({ pressed }) => [styles.noticeAction, pressed && styles.pressedWash]}>
          <AppText capScale style={styles.bold} variant="secondary">
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  )
}

/*
 * 핀 로고는 28pt 전용 작은 그림(pin-logo, @2x·@3x)을 쓴다. 1024px 앱 로고를 핀마다 풀면 늦게 뜨고,
 * 지도 마커는 그려진 순간을 사진처럼 굳혀 쓰므로 로고가 늦으면 빈 원으로 굳는다. 그래서 로고가 실리면 onLogoLoad로 알린다
 */
const PIN_LOGO = require("@/assets/images/pin-logo.png")

/** 핀 그림은 지도 조작과 별개인 뷰로 두어 두 플랫폼에서 같은 모양을 쓸 수 있다. */
export function MapShopPin({ name, selected, onLogoLoad }: { name: string; selected: boolean; onLogoLoad?: () => void }) {
  return (
    <View style={mapStyles.pin} testID={selected ? "selected-map-pin" : "unselected-map-pin"}>
      <View style={mapStyles.pinHitArea}>
        <View style={[mapStyles.pinCircle, selected && mapStyles.pinCircleSelected]} testID="map-pin-symbol">
          <Image accessible={false} onLoad={onLogoLoad} source={PIN_LOGO} style={mapStyles.pinLogo} testID="map-pin-logo" />
        </View>
      </View>
      {selected ? (
        <View style={mapStyles.pinLabel} testID="map-pin-label">
          <AppText capScale numberOfLines={1} style={mapStyles.pinLabelText} variant="meta">
            {name}
          </AppText>
        </View>
      ) : null}
    </View>
  )
}

export function MapClusterPin({ count }: { count: number }) {
  return (
    <View style={mapStyles.pinHitArea}>
      <View style={mapStyles.clusterPin} testID="map-cluster">
        <AppText capScale style={mapStyles.clusterCount} tone="onDark" variant="button">
          {count}
        </AppText>
      </View>
    </View>
  )
}

/** Expo 웹 미리보기: Apple 지도는 iOS에만 있으므로 같은 검색·필터와 목록만 보여준다 */
export default function WebMapScreen() {
  const [retryKey, setRetryKey] = useState(0)
  return <WebMapBody key={retryKey} onRetry={() => setRetryKey((key) => key + 1)} />
}

/** 실패한 서버 읽기는 캐시하지 않으므로 새 key로 다시 올리면 실패한 요청만 다시 보낸다. refetch가 생기면 그것으로 바꾼다 */
function WebMapBody({ onRetry }: { onRetry: () => void }) {
  const filters = useMapFilters(null)
  return (
    <View style={styles.root}>
      <MapHeader filters={filters} viewMode="list" />
      <ShopListView
        filters={filters}
        onRetry={onRetry}
        notice={<LocationNotice message="지도와 현재 위치는 iOS 앱에서 Apple 지도로 보여드려요. 여기서는 목록으로 볼 수 있어요." />}
      />
    </View>
  )
}

export const mapStyles = StyleSheet.create({
  /** 지도 위 조작키는 44pt 흰 원으로 띄운다. */
  floatingButton: {
    width: touchTarget,
    height: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    backgroundColor: colors.canvas,
    ...shadows.modal,
  },
  floatingPressed: { backgroundColor: colors.surfacePressed },
  pin: { alignItems: "center", minWidth: touchTarget, height: MAP_PIN_HEIGHT },
  // 고른 핀만 이름표가 보인다. 비선택 핀도 같은 높이를 써서 원의 중심은 선택 전후 제자리에 남는다.
  pinHitArea: { width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center" },
  pinCircle: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.black,
  },
  pinCircleSelected: { backgroundColor: colors.brand },
  pinLogo: { width: 28, height: 28, resizeMode: "contain", tintColor: colors.white },
  pinLabel: {
    height: 28,
    maxWidth: 160,
    marginTop: spacing.x1,
    paddingHorizontal: spacing.x2_5,
    justifyContent: "center",
    borderRadius: radii.pill,
    backgroundColor: colors.selected,
  },
  pinLabelText: { color: colors.onSelected, fontWeight: "700", textAlign: "center" },
  clusterPin: {
    width: touchTarget,
    height: 36,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.black,
  },
  clusterCount: { fontWeight: "700", fontVariant: ["tabular-nums"] },
})

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  bold: { fontWeight: "700" },
  onSelectedText: { color: colors.onSelected },
  openText: { color: colors.open },
  center: { textAlign: "center" },
  gapTop: { marginTop: spacing.x0_5 },
  flexBody: { flex: 1, minWidth: 0, gap: spacing.x0_5 },
  listBody: { gap: spacing.x0_5 },
  flexShrinkGrow: { flex: 1, minWidth: 0 },
  pressedWash: { backgroundColor: colors.surfacePressed },

  header: {
    paddingHorizontal: spacing.x4,
    paddingBottom: 0,
    backgroundColor: colors.paper,
    zIndex: 2,
  },
  mapHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.transparent,
  },
  mapFloating: { backgroundColor: colors.canvas, ...shadows.modal },
  searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.x2 },
  searchBox: {
    flex: 1,
    height: spacing.x12,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x2_5,
    paddingLeft: spacing.x4,
    paddingRight: spacing.x0_5,
    borderRadius: radii.pill,
    backgroundColor: colors.canvasSoft,
  },
  searchInput: { ...typography.body, flex: 1, minWidth: 0, height: "100%", color: colors.ink, paddingVertical: 0 },
  clearButton: { width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center" },
  toggle: {
    width: spacing.x12,
    height: spacing.x12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    backgroundColor: colors.canvasSoft,
  },
  filterRow: { flexDirection: "row", alignItems: "center", gap: spacing.x2, paddingTop: spacing.x3, paddingBottom: spacing.x3 },
  filterButton: {
    height: spacing.x10,
    flexDirection: "row",
    alignItems: "center",
    // 지역·메뉴 칩은 긴 이름에 맞춘 고정 폭이라, 짧은 이름일 때 오른쪽만 비지 않게 글씨와 화살표를 가운데로 모은다
    justifyContent: "center",
    gap: spacing.x1_5,
    paddingHorizontal: spacing.x3_5,
    borderRadius: radii.pill,
    backgroundColor: colors.canvasSoft,
  },
  regionFilter: { width: spacing.x12 * 2 + spacing.x6 },
  menuFilter: { width: spacing.x12 * 2 + spacing.x6 },
  filterButtonActive: { backgroundColor: colors.selected },
  filterText: { fontWeight: "700", color: colors.ink, flexShrink: 1, minWidth: 0 },
  filterTextActive: { color: colors.onSelected },
  filterScroller: { marginHorizontal: -spacing.x4, marginTop: spacing.x3 },
  filterRowScroll: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x2,
    paddingHorizontal: spacing.x4,
    paddingBottom: spacing.x3,
  },
  openDot: { width: 8, height: 8, borderRadius: radii.pill, backgroundColor: colors.open },
  hiddenDot: { opacity: 0 },
  resetButton: {
    width: spacing.x10,
    height: spacing.x10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    backgroundColor: colors.canvasSoft,
  },
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
  optionSelected: { backgroundColor: colors.selected },
  optionCheck: { width: spacing.x4, height: spacing.x4 },

  quickView: {
    // 사진 84pt + 위아래 12pt. 가게가 바뀌어도 카드 크기가 그대로이도록 고정한다
    height: 112,
    paddingVertical: spacing.x3,
    paddingLeft: spacing.x3,
    paddingRight: spacing.x4_5,
    borderRadius: radii.lg,
    backgroundColor: colors.canvas,
    ...shadows.modal,
  },
  quickEmpty: { paddingVertical: spacing.x4, justifyContent: "center" },
  quickRow: { flexDirection: "row", alignItems: "center", gap: spacing.x3_5 },
  quickPhoto: { width: 84, height: 84, borderRadius: radii.sm, backgroundColor: colors.canvasSoft },
  shopTitle: { flexShrink: 1, fontWeight: "700" },
  shopBranch: { fontWeight: "400" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.x1_5 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", marginTop: spacing.x0_5 },

  listContent: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.x8 },
  listHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.x2,
    paddingTop: spacing.x3,
    paddingBottom: spacing.x0_5,
  },
  sortGroup: { flexDirection: "row" },
  sortInner: { flexDirection: "row", alignItems: "center", gap: spacing.x1_5 },
  sortButton: {
    minHeight: touchTarget,
    justifyContent: "center",
    paddingHorizontal: spacing.x3_5,
    borderRadius: radii.pill,
    backgroundColor: colors.canvasSoft,
  },
  sortButtonActive: { backgroundColor: colors.selected },
  sortButtonPressed: { backgroundColor: colors.surfacePressed },
  listDivider: { height: line.hair, backgroundColor: colors.border },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x3,
    paddingVertical: spacing.x3,
  },
  listPhoto: { width: 48, height: 48, borderRadius: radii.sm, backgroundColor: colors.canvasSoft },
  listMeta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.x1_5, marginTop: spacing.x0_5 },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x2,
    paddingHorizontal: spacing.x3,
    paddingVertical: spacing.x3_5,
    marginBottom: spacing.x4,
    borderRadius: radii.sm,
    backgroundColor: colors.canvasSoft,
  },
  noticeAction: { minHeight: touchTarget, justifyContent: "center", paddingHorizontal: spacing.x2, borderRadius: radii.sm },
})
