import * as Location from "expo-location"
import { router } from "expo-router"
import {
  Bookmark,
  ChevronDown,
  ChevronRight,
  Crosshair,
  List,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  Search,
  SlidersHorizontal,
  Star,
} from "lucide-react-native"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  FlatList,
  Image,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text as NativeText,
  TextInput,
  View,
  type TextProps,
} from "react-native"
import MapView, { Marker, type Region } from "react-native-maps"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import type { Shop } from "@raota/shared"
import { ResilientUriImage } from "@/src/components"
import {
  calculateMapClusters,
  filterAndSortShops,
  type ShopSort,
} from "@/src/domain"
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

const DEFAULT_REGION: Region = {
  latitude: 37.5537,
  longitude: 126.9156,
  latitudeDelta: 0.045,
  longitudeDelta: 0.035,
}

const RAMEN_TYPES = ["전체", "쇼유", "돈코츠", "시오", "미소", "토리파이탄"]
const AREA_OPTIONS = [
  { value: "전체 지역", label: "전체 지역" },
  { value: "망원", label: "마포 · 망원동" },
  { value: "합정", label: "마포 · 합정/상수" },
  { value: "연남", label: "마포 · 연남/홍대" },
]
const MENU_OPTIONS = [
  { value: "전체", label: "모든 메뉴" },
  { value: "쇼유", label: "쇼유 라멘 (간장)" },
  { value: "돈코츠", label: "돈코츠/이에케 (돼지뼈)" },
  { value: "시오", label: "시오 라멘 (소금)" },
  { value: "미소", label: "미소 라멘 (된장)" },
  { value: "토리파이탄", label: "토리파이탄 (닭백탕)" },
]
const SORTS = ["가까운 순", "취향 일치순", "평점 높은 순"] as const
const SORT_KEYS: Record<typeof SORTS[number], ShopSort> = {
  "가까운 순": "distance",
  "취향 일치순": "match",
  "평점 높은 순": "rating",
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

function ShopListItem({ shop }: { shop: Shop }) {
  return (
    <Pressable
      accessibilityLabel={`${shop.name} ${shop.branch ?? ""}, ${distanceLabel(shop.distanceM)}`}
      accessibilityRole="button"
      onPress={() => openShop(shop.id)}
      style={({ pressed }) => [styles.listCard, pressed && styles.pressed]}
    >
      <ResilientUriImage
        accessibilityLabel={`${shop.name} 대표 사진`}
        uri={shop.photos[0]}
        style={styles.listImage}
      />
      <View style={styles.listBody}>
        <Text numberOfLines={1} style={styles.listName}>
          {shop.name} {shop.branch ? `· ${shop.branch}` : ""}
        </Text>
        <Text numberOfLines={1} style={styles.listDescription}>
          {shop.description || shop.tags.join(" · ")}
        </Text>
        <View style={styles.listFooterRow}>
          <View style={styles.listMeta}>
            <Text style={[styles.openText, !shop.isOpen && styles.closedText]}>
              {shop.isOpen ? "● 영업 중" : "● 영업 종료"}
            </Text>
            <Text style={styles.dotSeparator}>·</Text>
            <Text style={styles.distance}>{distanceLabel(shop.distanceM)}</Text>
          </View>
          <View style={styles.stylePill}>
            <Text style={styles.stylePillText}>{shop.tags[0] ?? "라멘"}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  )
}

export default function MapScreen() {
  const insets = useSafeAreaInsets()
  const mapRef = useRef<MapView>(null)
  const { shops, state, actions } = useRaota()
  const [query, setQuery] = useState("")
  const [ramenType, setRamenType] = useState("전체")
  const [area, setArea] = useState("전체 지역")
  const [openOnly, setOpenOnly] = useState(false)
  const [sort, setSort] = useState<typeof SORTS[number]>("가까운 순")
  const [dropdown, setDropdown] = useState<"area" | "menu" | null>(null)
  const [viewMode, setViewMode] = useState<"map" | "list">("map")
  const [selectedId, setSelectedId] = useState<number | null>(
    shops[0]?.id ?? null,
  )
  const [region, setRegion] = useState(DEFAULT_REGION)
  const [locationStatus, setLocationStatus] =
    useState<"loading" | "granted" | "denied" | "web">(
      Platform.OS === "web" ? "web" : "loading",
    )
  const [userRegion, setUserRegion] = useState<Region | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    let mounted = true
    const loadLocation = async () => {
      if (Platform.OS === "web") return
      try {
        const permission = await Location.requestForegroundPermissionsAsync()
        if (!mounted) return
        if (permission.status !== "granted") {
          setLocationStatus("denied")
          return
        }
        setLocationStatus("granted")
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })
        if (!mounted) return
        const nextRegion = {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
          latitudeDelta: 0.025,
          longitudeDelta: 0.02,
        }
        setUserRegion(nextRegion)
      } catch {
        if (mounted) setLocationStatus("denied")
      }
    }
    loadLocation()
    return () => {
      mounted = false
    }
  }, [])

  const filteredShops = useMemo(() => {
    return filterAndSortShops(shops, {
      area,
      openOnly,
      query,
      ramenType,
      sort: SORT_KEYS[sort],
      origin: userRegion,
    })
  }, [area, openOnly, query, ramenType, shops, sort, userRegion])

  useEffect(() => {
    if (
      selectedId !== null &&
      filteredShops.some((shop) => shop.id === selectedId)
    )
      return
    setSelectedId(filteredShops[0]?.id ?? null)
  }, [filteredShops, selectedId])

  const selectedShop =
    filteredShops.find((shop) => shop.id === selectedId) ?? null
  const mapClusters = useMemo(
    () => calculateMapClusters(filteredShops, region),
    [filteredShops, region],
  )

  const focusUser = () => {
    const target = userRegion ?? DEFAULT_REGION
    mapRef.current?.animateToRegion(target, 420)
  }

  const cycleSort = () => {
    const index = SORTS.indexOf(sort)
    setSort(SORTS[(index + 1) % SORTS.length])
  }

  const refresh = () => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 650)
  }

  const showCluster = (cluster: typeof mapClusters[number]) => {
    mapRef.current?.animateToRegion(
      {
        latitude: cluster.latitude,
        longitude: cluster.longitude,
        latitudeDelta: 0.035,
        longitudeDelta: 0.028,
      },
      420,
    )
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Search color={MUTED} size={17} />
            <TextInput
              accessibilityLabel="라멘집 검색"
              onChangeText={setQuery}
              placeholder="라멘집 상호, 지하철역, 계보 검색"
              placeholderTextColor="#8A8A8A"
              returnKeyType="search"
              style={styles.searchInput}
              value={query}
            />
            {query ? (
              <Pressable accessibilityLabel="검색어 지우기" onPress={() => setQuery("")} hitSlop={8}>
                <Text style={styles.clearText}>×</Text>
              </Pressable>
            ) : null}
          </View>
          <Pressable
            accessibilityLabel={viewMode === "map" ? "목록으로 보기" : "지도로 보기"}
            accessibilityRole="button"
            onPress={() => setViewMode(viewMode === "map" ? "list" : "map")}
            style={styles.modeButton}
          >
            {viewMode === "map" ? <List color="#FFFFFF" size={16} /> : <MapIcon color="#FFFFFF" size={16} />}
            <Text style={styles.modeButtonText}>{viewMode === "map" ? "목록" : "지도"}</Text>
          </Pressable>
        </View>

        <View style={styles.secondaryFilters}>
          <View style={styles.filterRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: dropdown === "area" }}
              onPress={() => setDropdown((value) => (value === "area" ? null : "area"))}
              style={[styles.filterSelect, area !== "전체 지역" && styles.filterSelectActive]}
            >
              <MapPin color={area !== "전체 지역" ? RED : MUTED} size={13} />
              <Text numberOfLines={1} style={[styles.filterSelectText, area !== "전체 지역" && styles.filterSelectTextActive]}>
                {AREA_OPTIONS.find((item) => item.value === area)?.label ?? "전체 지역"}
              </Text>
              <ChevronDown color={area !== "전체 지역" ? RED : MUTED} size={12} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: dropdown === "menu" }}
              onPress={() => setDropdown((value) => (value === "menu" ? null : "menu"))}
              style={[styles.filterSelect, ramenType !== "전체" && styles.filterSelectActive]}
            >
              <Text style={[styles.ramenGlyph, ramenType !== "전체" && styles.filterSelectTextActive]}>🍜</Text>
              <Text numberOfLines={1} style={[styles.filterSelectText, ramenType !== "전체" && styles.filterSelectTextActive]}>
                {MENU_OPTIONS.find((item) => item.value === ramenType)?.label ?? "모든 메뉴"}
              </Text>
              <ChevronDown color={ramenType !== "전체" ? RED : MUTED} size={12} />
            </Pressable>
            <Pressable
              accessibilityLabel="영업 중인 매장만 보기"
              accessibilityRole="switch"
              accessibilityState={{ checked: openOnly }}
              onPress={() => setOpenOnly((value) => !value)}
              style={[styles.openFilter, openOnly && styles.openFilterActive]}
            >
              <View style={[styles.tinyDot, openOnly && styles.tinyDotActive]} />
              <Text style={[styles.openFilterText, openOnly && styles.openFilterTextActive]}>영업중</Text>
            </Pressable>
            {area !== "전체 지역" || ramenType !== "전체" || openOnly ? (
              <Pressable
                accessibilityLabel="필터 초기화"
                accessibilityRole="button"
                onPress={() => {
                  setArea("전체 지역")
                  setRamenType("전체")
                  setOpenOnly(false)
                  setDropdown(null)
                }}
                style={styles.resetFilter}
              >
                <Text style={styles.resetFilterText}>×</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.sortRow}>
            <Pressable
              accessibilityLabel={`정렬: ${sort}`}
              accessibilityRole="button"
              onPress={cycleSort}
              style={styles.sortButton}
            >
              <SlidersHorizontal color={MUTED} size={12} />
              <Text style={styles.sortText}>{sort}</Text>
              <ChevronDown color={MUTED} size={12} />
            </Pressable>
          </View>
          {dropdown ? (
            <View style={[styles.dropdownMenu, dropdown === "menu" && styles.dropdownMenuRight]}>
              {(dropdown === "area" ? AREA_OPTIONS : MENU_OPTIONS).map((item) => {
                const selected = (dropdown === "area" ? area : ramenType) === item.value
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={item.value}
                    onPress={() => {
                      if (dropdown === "area") setArea(item.value)
                      else setRamenType(item.value)
                      setDropdown(null)
                    }}
                    style={[styles.dropdownItem, selected && styles.dropdownItemSelected]}
                  >
                    <Text style={[styles.dropdownItemText, selected && styles.dropdownItemTextSelected]}>{item.label}</Text>
                    {selected ? <Text style={styles.dropdownCheck}>✓</Text> : null}
                  </Pressable>
                )
              })}
            </View>
          ) : null}
        </View>
      </View>

      {locationStatus === "denied" ? (
        <View style={styles.permissionBanner}>
          <MapPin color={RED} size={16} />
          <Text style={styles.permissionText}>
            위치 권한 없이 망원동을 표시 중이에요.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => Linking.openSettings()}
            style={styles.settingsButton}
          >
            <Text style={styles.settingsText}>설정</Text>
          </Pressable>
        </View>
      ) : null}

      {viewMode === "map" ? (
        <View style={styles.mapWrap}>
          {Platform.OS === "web" ? (
            <View style={styles.webMapFallback}>
              <MapIcon color={RED} size={34} />
              <Text style={styles.webMapTitle}>
                Apple Maps는 iOS 앱에서 열려요
              </Text>
              <Text style={styles.webMapBody}>
                웹 미리보기에서는 목록 보기로 매장을 확인할 수 있어요.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setViewMode("list")}
                style={styles.webMapButton}
              >
                <List color="#FFFFFF" size={16} />
                <Text style={styles.webMapButtonText}>목록으로 보기</Text>
              </Pressable>
            </View>
          ) : (
            <MapView
              accessibilityLabel="라멘집 지도"
              initialRegion={DEFAULT_REGION}
              mapPadding={{
                top: 20,
                right: 14,
                bottom: selectedShop ? 190 : 72,
                left: 14,
              }}
              onRegionChangeComplete={setRegion}
              ref={mapRef}
              rotateEnabled={false}
              showsCompass={false}
              showsMyLocationButton={false}
              showsPointsOfInterests={false}
              showsUserLocation={locationStatus === "granted"}
              style={StyleSheet.absoluteFill}
            >
              {mapClusters.map((cluster) => {
                if (cluster.shopIds.length > 1) {
                  return (
                    <Marker
                      coordinate={{
                        latitude: cluster.latitude,
                        longitude: cluster.longitude,
                      }}
                      key={cluster.id}
                      onPress={() => showCluster(cluster)}
                    >
                      <View style={styles.clusterMarker}>
                        <Text style={styles.clusterText}>
                          {cluster.shopIds.length}
                        </Text>
                      </View>
                    </Marker>
                  )
                }

                const shop = filteredShops.find(
                  (item) => item.id === cluster.shopIds[0],
                )
                if (!shop) return null
                const selected = shop.id === selectedId
                return (
                  <Marker
                    accessibilityLabel={`${shop.name} 지도 마커`}
                    coordinate={{
                      latitude: cluster.latitude,
                      longitude: cluster.longitude,
                    }}
                    key={`${cluster.id}-${selected ? "selected" : "idle"}`}
                    onPress={() => setSelectedId(shop.id)}
                  >
                    <View
                      style={styles.markerStack}
                    >
                      <View style={[styles.marker, selected && styles.markerSelected]}>
                        <Image
                          source={require("@/assets/images/logo.png")}
                          style={[styles.markerLogo, selected && styles.markerLogoSelected]}
                        />
                      </View>
                      <View style={[styles.markerLabel, selected && styles.markerLabelSelected]}>
                        <Text style={[styles.markerLabelText, selected && styles.markerLabelTextSelected]}>
                          {shop.name}
                        </Text>
                      </View>
                      <View style={[styles.markerTail, selected && styles.markerTailSelected]} />
                    </View>
                  </Marker>
                )
              })}
            </MapView>
          )}

          {Platform.OS !== "web" ? (
            <Pressable
              accessibilityLabel="현재 위치로 이동"
              accessibilityRole="button"
              onPress={focusUser}
              style={styles.locationButton}
            >
              <LocateFixed
                color={locationStatus === "granted" ? RED : INK}
                size={21}
              />
            </Pressable>
          ) : null}

          {selectedShop ? (
            <View style={styles.bottomDrawer}>
              <Pressable
                accessibilityLabel={`${selectedShop.name} ${selectedShop.branch ?? ""}, ${distanceLabel(selectedShop.distanceM)}, 매장 상세 보기`}
                accessibilityRole="button"
                onPress={() => openShop(selectedShop.id)}
                style={({ pressed }) => [
                  styles.bottomDrawerCard,
                  pressed && styles.pressed,
                ]}
              >
                <ResilientUriImage
                  accessibilityLabel={`${selectedShop.name} 대표 사진`}
                  uri={selectedShop.photos[0]}
                  style={styles.drawerPhoto}
                />
                <View style={styles.flex}>
                  <View style={styles.drawerTitleRow}>
                    <Text numberOfLines={1} style={styles.drawerName}>
                      {selectedShop.name} {selectedShop.branch ? `· ${selectedShop.branch}` : ""}
                    </Text>
                    <View style={styles.drawerStyleBadge}>
                      <Text style={styles.drawerStyleText}>
                        {selectedShop.tags[0] ?? "라멘"}
                      </Text>
                    </View>
                  </View>
                  <Text numberOfLines={1} style={styles.drawerDesc}>
                    {selectedShop.description || selectedShop.tags.join(" · ")}
                  </Text>
                  <View style={styles.drawerMetaRow}>
                    <Text style={[styles.openText, !selectedShop.isOpen && styles.closedText]}>
                      {selectedShop.isOpen ? "● 영업 중" : "● 영업 종료"}
                    </Text>
                    <Text style={styles.dotSeparator}>·</Text>
                    <Text style={styles.drawerDistance}>거리 {distanceLabel(selectedShop.distanceM)}</Text>
                  </View>
                </View>
                <Text style={styles.drawerArrow}>→</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyMap}>
              <Search color={MUTED} size={20} />
              <Text style={styles.emptyText}>조건에 맞는 라멘집이 없어요</Text>
            </View>
          )}
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={filteredShops}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl
              onRefresh={refresh}
              refreshing={refreshing}
              tintColor={RED}
            />
          }
          ListHeaderComponent={
            <View style={styles.listHeaderRow}>
              <Text style={styles.listHeaderCount}>
                총 <Text style={styles.listHeaderCountBold}>{filteredShops.length}곳</Text>의 라멘집
              </Text>
              <View style={styles.listSortButtonGroup}>
                {(["가까운 순", "취향 일치순", "평점 높은 순"] as const).map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => setSort(s)}
                    style={[
                      styles.listSortChip,
                      sort === s && styles.listSortChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.listSortChipText,
                        sort === s && styles.listSortChipTextActive,
                      ]}
                    >
                      {s === "가까운 순" ? "거리순" : s === "취향 일치순" ? "인기순" : "평점순"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyList}>
              <Search color={MUTED} size={28} />
              <Text style={styles.emptyTitle}>검색 결과가 없어요</Text>
              <Text style={styles.emptyText}>
                지역이나 라멘 계통을 바꿔보세요.
              </Text>
            </View>
          }
          renderItem={({ item }) => <ShopListItem shop={item} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  header: {
    backgroundColor: "#FFFFFF",
    borderBottomColor: LINE,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 10,
    paddingHorizontal: 16,
    position: "relative",
    zIndex: 20,
    elevation: 5,
  },
  searchRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 11,
  },
  title: { color: INK, fontSize: 21, fontWeight: "900", letterSpacing: -0.6 },
  subtitle: { color: MUTED, fontSize: 10.5, marginTop: 2 },
  viewSwitch: {
    backgroundColor: SOFT,
    borderRadius: 6,
    flexDirection: "row",
    padding: 3,
  },
  viewButton: {
    alignItems: "center",
    borderRadius: 4,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  viewButtonActive: { backgroundColor: INK },
  searchBar: {
    alignItems: "center",
    backgroundColor: SOFT,
    borderColor: "#EBEBEA",
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    flex: 1,
    height: 44,
    paddingHorizontal: 12,
  },
  searchInput: {
    color: INK,
    flex: 1,
    fontSize: 13,
    height: 42,
    paddingVertical: 0,
  },
  clearText: { color: MUTED, fontSize: 18, lineHeight: 20 },
  modeButton: {
    alignItems: "center",
    backgroundColor: INK,
    borderRadius: 6,
    flexDirection: "row",
    gap: 5,
    height: 44,
    justifyContent: "center",
    paddingHorizontal: 13,
  },
  modeButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  chip: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: LINE,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 13,
  },
  chipActive: { backgroundColor: INK, borderColor: INK },
  chipText: { color: MUTED, fontSize: 11, fontWeight: "700" },
  chipTextActive: { color: "#FFFFFF", fontWeight: "900" },
  secondaryFilters: {
    marginTop: 8,
    position: "relative",
  },
  filterRow: { alignItems: "center", flexDirection: "row", gap: 6 },
  filterSelect: {
    alignItems: "center",
    backgroundColor: SOFT,
    borderColor: "#E2E2E2",
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: "row",
    flex: 1,
    gap: 4,
    justifyContent: "center",
    minHeight: 32,
    minWidth: 0,
    paddingHorizontal: 8,
  },
  filterSelectActive: { backgroundColor: "#FFF0F0", borderColor: RED },
  filterSelectText: { color: INK, flex: 1, fontSize: 10, fontWeight: "700", textAlign: "center" },
  filterSelectTextActive: { color: RED, fontWeight: "900" },
  ramenGlyph: { fontSize: 11 },
  openFilter: {
    alignItems: "center",
    backgroundColor: SOFT,
    borderColor: "#E2E2E2",
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    minHeight: 32,
    paddingHorizontal: 8,
  },
  openFilterActive: { backgroundColor: "#2E7D32", borderColor: "#2E7D32" },
  openFilterText: { color: INK, fontSize: 10, fontWeight: "700" },
  openFilterTextActive: { color: "#FFFFFF", fontWeight: "900" },
  resetFilter: { alignItems: "center", backgroundColor: SOFT, borderRadius: 4, height: 32, justifyContent: "center", width: 32 },
  resetFilterText: { color: MUTED, fontSize: 17, lineHeight: 20 },
  sortRow: { alignItems: "flex-end", marginTop: 5 },
  dropdownMenu: {
    backgroundColor: "#FFFFFF",
    borderColor: "#C9C9C9",
    borderRadius: 4,
    borderWidth: 1,
    elevation: 8,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    top: 38,
    width: 190,
    zIndex: 50,
  },
  dropdownMenuRight: { left: undefined, right: 38, width: 214 },
  dropdownItem: { alignItems: "center", borderBottomColor: "#F2F2F2", borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", justifyContent: "space-between", minHeight: 38, paddingHorizontal: 12 },
  dropdownItemSelected: { backgroundColor: "#FFF0F0" },
  dropdownItemText: { color: INK, flex: 1, fontSize: 10.5, fontWeight: "600" },
  dropdownItemTextSelected: { color: RED, fontWeight: "900" },
  dropdownCheck: { color: RED, fontSize: 12, fontWeight: "900" },
  areaChip: {
  },
  areaChipActive: { backgroundColor: "#FFECEC" },
  areaText: { color: MUTED, fontSize: 10, fontWeight: "700" },
  areaTextActive: { color: RED, fontWeight: "900" },
  openChipActive: { backgroundColor: "#EBF8F0" },
  openChipText: { color: "#147A45" },
  tinyDot: { backgroundColor: "#A5A8AC", borderRadius: 3, height: 6, width: 6 },
  tinyDotActive: { backgroundColor: "#149653" },
  sortButton: {
    alignItems: "center",
    backgroundColor: SOFT,
    borderRadius: 4,
    flexDirection: "row",
    gap: 3,
    justifyContent: "center",
    minHeight: 28,
    paddingHorizontal: 9,
  },
  sortText: { color: MUTED, fontSize: 9.5, fontWeight: "800" },
  permissionBanner: {
    alignItems: "center",
    backgroundColor: "#FFF4F2",
    flexDirection: "row",
    gap: 7,
    minHeight: 42,
    paddingHorizontal: 16,
  },
  permissionText: { color: "#5D5351", flex: 1, fontSize: 10.5 },
  settingsButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 7,
  },
  settingsText: { color: RED, fontSize: 10.5, fontWeight: "900" },
  mapWrap: { flex: 1, overflow: "hidden" },
  webMapFallback: {
    alignItems: "center",
    backgroundColor: "#F0F1EF",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    paddingBottom: 150,
    paddingHorizontal: 28,
    position: "absolute",
    right: 0,
    top: 0,
  },
  webMapTitle: { color: INK, fontSize: 16, fontWeight: "900", marginTop: 13 },
  webMapBody: {
    color: MUTED,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
    textAlign: "center",
  },
  webMapButton: {
    alignItems: "center",
    backgroundColor: INK,
    borderRadius: 22,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginTop: 17,
    minHeight: 44,
    paddingHorizontal: 16,
  },
  webMapButtonText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  markerStack: { alignItems: "center", justifyContent: "center" },
  marker: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: RED,
    borderRadius: 18,
    borderWidth: 2,
    height: 36,
    justifyContent: "center",
    shadowColor: INK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    width: 36,
  },
  markerSelected: { backgroundColor: RED, borderColor: "#FFFFFF", height: 42, transform: [{ scale: 1.12 }], width: 42 },
  markerLogo: { height: 27, width: 27 },
  markerLogoSelected: { tintColor: "#FFFFFF", height: 30, width: 30 },
  markerLabel: { backgroundColor: "#FFFFFF", borderColor: LINE, borderRadius: 14, borderWidth: 1, marginTop: 3, paddingHorizontal: 7, paddingVertical: 2, shadowColor: INK, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 5 },
  markerLabelSelected: { backgroundColor: RED, borderColor: RED },
  markerLabelText: { color: "#4A4D52", fontSize: 9.5, fontWeight: "800" },
  markerLabelTextSelected: { color: "#FFFFFF" },
  markerTail: {
    alignSelf: "center",
    borderLeftColor: "transparent",
    borderLeftWidth: 6,
    borderRightColor: "transparent",
    borderRightWidth: 6,
    borderTopColor: RED,
    borderTopWidth: 8,
    marginTop: -1,
  },
  markerTailSelected: { borderTopColor: RED },
  clusterMarker: {
    alignItems: "center",
    backgroundColor: INK,
    borderColor: "#FFFFFF",
    borderRadius: 28,
    borderWidth: 3,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  clusterText: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
  locationButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    position: "absolute",
    right: 16,
    shadowColor: INK,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    top: 16,
    width: 48,
  },
  bottomDrawer: {
    backgroundColor: "#FFFFFF",
    borderTopColor: LINE,
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    padding: 16,
    position: "absolute",
    right: 0,
    zIndex: 20,
    shadowColor: INK,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  bottomDrawerCard: {
    alignItems: "center",
    backgroundColor: SOFT,
    borderRadius: 6,
    flexDirection: "row",
    gap: 14,
    padding: 14,
  },
  drawerPhoto: {
    backgroundColor: "#FFFFFF",
    borderColor: LINE,
    borderRadius: 6,
    borderWidth: 1,
    height: 64,
    width: 64,
  },
  drawerTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  drawerName: { color: INK, fontSize: 15, fontWeight: "900", maxWidth: 160 },
  drawerStyleBadge: {
    backgroundColor: "#EAEAEA",
    borderRadius: 32,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  drawerStyleText: { color: INK, fontSize: 10, fontWeight: "700" },
  drawerDesc: { color: MUTED, fontSize: 11, marginTop: 4 },
  drawerMetaRow: { alignItems: "center", flexDirection: "row", gap: 6, marginTop: 6 },
  drawerDistance: { color: MUTED, fontSize: 10 },
  drawerArrow: { color: RED, fontSize: 13, fontWeight: "800", marginLeft: 4 },
  previewCard: {
    backgroundColor: "#FFFFFF",
    bottom: 16,
    left: 14,
    minHeight: 132,
    overflow: "hidden",
    position: "absolute",
    right: 14,
    shadowColor: INK,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },
  previewMain: { flex: 1, flexDirection: "row" },
  previewImage: { backgroundColor: SOFT, width: 118 },
  previewBody: { flex: 1, padding: 12 },
  previewTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    paddingRight: 32,
  },
  previewName: { color: INK, fontSize: 16, fontWeight: "900", maxWidth: 124 },
  nameRow: { alignItems: "center", flexDirection: "row", gap: 5 },
  branch: { color: MUTED, fontSize: 9.5, fontWeight: "700" },
  previewDesc: { color: MUTED, fontSize: 10.5, marginTop: 5 },
  bookmarkButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    position: "absolute",
    right: 4,
    top: 4,
    width: 44,
    zIndex: 2,
  },
  previewFooter: {
    alignItems: "center",
    borderTopColor: LINE,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 10,
  },
  previewMeta: { alignItems: "center", flexDirection: "row", gap: 7 },
  previewScore: { color: RED, fontSize: 10, fontWeight: "900" },
  distance: { color: MUTED, fontSize: 10.5, fontWeight: "600" },
  openText: { color: "#2E7D32", fontSize: 10, fontWeight: "800" },
  closedText: { color: MUTED },
  listHeaderRow: {
    alignItems: "center",
    borderBottomColor: LINE,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingBottom: 8,
  },
  listHeaderCount: { color: MUTED, fontSize: 12, fontWeight: "700" },
  listHeaderCountBold: { color: INK, fontWeight: "900" },
  listSortButtonGroup: { alignItems: "center", flexDirection: "row", gap: 4 },
  listSortChip: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  listSortChipActive: { backgroundColor: INK },
  listSortChipText: { color: MUTED, fontSize: 11, fontWeight: "700" },
  listSortChipTextActive: { color: "#FFFFFF" },
  listContent: { padding: 16, paddingBottom: 100 },
  listCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: LINE,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    marginBottom: 10,
    minHeight: 90,
    padding: 14,
  },
  listImage: { backgroundColor: SOFT, borderColor: LINE, borderRadius: 6, borderWidth: 1, height: 72, width: 72 },
  listBody: { flex: 1, minWidth: 0 },
  listName: { color: INK, fontSize: 15, fontWeight: "900" },
  listDescription: { color: MUTED, fontSize: 11, marginTop: 4 },
  listFooterRow: {
    alignItems: "center",
    borderTopColor: "#F2F2F2",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
  },
  listMeta: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  stylePill: {
    backgroundColor: SOFT,
    borderRadius: 32,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  stylePillText: { color: INK, fontSize: 10, fontWeight: "700" },
  dotSeparator: { color: LINE, fontSize: 10 },
  scoreBadge: {
    alignItems: "center",
    borderColor: "#FFCECE",
    borderRadius: 4,
    borderWidth: 1,
    minWidth: 48,
    paddingHorizontal: 6,
    paddingVertical: 7,
  },
  scoreValue: { color: RED, fontSize: 12, fontWeight: "900" },
  scoreLabel: { color: MUTED, fontSize: 8.5, marginTop: 2 },
  emptyMap: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    bottom: 18,
    flexDirection: "row",
    gap: 8,
    left: 24,
    minHeight: 54,
    paddingHorizontal: 16,
    position: "absolute",
    right: 24,
  },
  emptyList: { alignItems: "center", paddingTop: 70 },
  emptyTitle: { color: INK, fontSize: 16, fontWeight: "900", marginTop: 12 },
  emptyText: { color: MUTED, fontSize: 11, marginTop: 4 },
})
