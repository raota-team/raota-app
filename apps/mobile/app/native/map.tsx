import * as Haptics from "expo-haptics"
import { useIsFocused, useLocalSearchParams } from "expo-router"
import * as Location from "expo-location"
import { MapPin, Navigation } from "lucide-react-native"
import { useEffect, useMemo, useRef, useState } from "react"
import { Keyboard, Linking, Pressable, StyleSheet, View } from "react-native"
import MapView, { Marker, type Region } from "react-native-maps"
import { useReducedMotion } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { AppText } from "@/src/components/ui"
import { useShop } from "@/src/data/hooks"
import { calculateMapClusters } from "@/src/domain/map"
import { colors, radii, spacing, touchTarget } from "@/src/theme"
import {
  MAP_PIN_HEIGHT,
  MapHeader,
  MapClusterPin,
  MapShopPin,
  QuickView,
  ShopListView,
  mapStyles,
  useMapFilters,
  type Coordinate,
} from "./map.web"

/** 위치 권한이 없을 때 보여주는 기본 지역(망원·합정 일대, 원장 매장이 모인 곳) */
const DEFAULT_REGION: Region = {
  latitude: 37.5537,
  longitude: 126.9156,
  latitudeDelta: 0.032,
  longitudeDelta: 0.032,
}

/**
 * 고른 핀의 zIndex. Apple 지도는 누른 자리에서 가장 가까운 핀을 스스로 "선택"하고,
 * react-native-maps는 그 핀의 zIndex에 999를 더해 올린다. 옆 핀을 누르다 스치면 그 핀이
 * 1 + 999로 떠서 고른 핀의 이름표를 덮으므로, 고른 핀은 그보다 높게 둔다.
 */
const SELECTED_Z_INDEX = 2000

/** 이름표 자리는 모든 핀에 남겨 두고, 지도의 좌표는 언제나 원의 중심에 고정한다. */
const PIN_ANCHOR = { x: 0.5, y: (touchTarget / 2) / MAP_PIN_HEIGHT }
const CLUSTER_ANCHOR = { x: 0.5, y: 0.5 }

type LocationStatus = "loading" | "granted" | "denied"

/**
 * 지도 탭: Apple 지도(react-native-maps) + 웹 MapScreen과 같은 검색·필터·퀵뷰·목록.
 * 위치 권한을 이 화면에서 묻고, 거절하면 기본 지역과 설정 경로를 보여준다.
 */
export default function MapScreen() {
  const insets = useSafeAreaInsets()
  const mapRef = useRef<MapView>(null)
  const [viewMode, setViewMode] = useState<"map" | "list">("map")
  const [region, setRegion] = useState<Region>(DEFAULT_REGION)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("loading")
  const [origin, setOrigin] = useState<Coordinate | null>(null)
  const [headerHeight, setHeaderHeight] = useState(insets.top + spacing.x2 + spacing.x12 + spacing.x16)
  const reducedMotion = useReducedMotion()
  /*
   * 마커 스냅샷은 로고와 글씨가 그려질 때까지 잠깐 갱신한 뒤 고정한다.
   * 계속 다시 그리면 지도가 무거워지고 핀 탭을 놓친다.
   */
  const [trackingPins, setTrackingPins] = useState(true)
  const filters = useMapFilters(origin)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      let permission: Location.LocationPermissionResponse
      try {
        permission = await Location.requestForegroundPermissionsAsync()
      } catch {
        if (mounted) setLocationStatus("denied")
        return
      }
      if (!mounted) return
      if (permission.status !== "granted") {
        setLocationStatus("denied")
        return
      }
      setLocationStatus("granted")
      // 마지막으로 알던 위치로 먼저 옮기고, 정확한 위치가 오면 거리만 다시 계산한다.
      // 위치를 못 잡은 건(GPS 시간 초과 등) 권한 문제가 아니라서 "설정 열기" 안내를 띄우지 않는다.
      try {
        const last = await Location.getLastKnownPositionAsync()
        if (mounted && last) setOrigin({ latitude: last.coords.latitude, longitude: last.coords.longitude })
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        if (mounted) setOrigin({ latitude: current.coords.latitude, longitude: current.coords.longitude })
      } catch {
        // 기본 지역을 그대로 보여 준다
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const filtered = filters.filtered
  // 좌표 없는 매장도 목록에 남기되, 지도 마커는 좌표가 있는 매장만 사용한다.
  const markerShops = useMemo(() => filtered.filter((shop) => shop.lat && shop.lng), [filtered])
  const selectedInList = filtered.find((shop) => shop.id === selectedId)
  const selectedShop = useShop(selectedInList ? null : selectedId).data
  const selected = selectedInList ?? selectedShop ?? markerShops[0] ?? null
  const clusters = useMemo(() => calculateMapClusters(markerShops, region), [markerShops, region])

  // 핀이 바뀌면 잠깐 다시 그리게 두고(로고가 실릴 시간) 곧 고정한다
  useEffect(() => {
    setTrackingPins(true)
    const settle = setTimeout(() => setTrackingPins(false), 700)
    return () => clearTimeout(settle)
  }, [clusters, selectedId])

  const animateTo = (target: Region) => mapRef.current?.animateToRegion(target, reducedMotion ? 0 : 350)

  const goToUser = () => {
    if (!origin) {
      animateTo(DEFAULT_REGION)
      return
    }
    animateTo({ ...origin, latitudeDelta: 0.012, longitudeDelta: 0.01 })
  }


  // 핀을 고르면 그 가게로 옮기기만 한다. 확대 수준을 바꾸면 묶음이 풀리며 핀들이 자리를 옮겨 고른 곳을 놓친다
  const selectShop = (shopId: string, latitude: number, longitude: number) => {
    setSelectedId(shopId)
    void Haptics.selectionAsync().catch(() => undefined)
    animateTo({ ...region, latitude, longitude })
  }

  /*
   * 가게 상세의 "지도에서 보기"가 넘기는 매장. 그 가게를 골라 가깝게 보여 준다.
   * 지금 필터나 검색에 걸려 그 가게가 빠져 있으면 필터를 풀어야 핀이 보인다.
   * 지도 이동은 탭이 화면에 올라온 뒤에 한다. 가게 상세 뒤에 가려진 채로 부르면 Apple 지도가 무시한다.
   */
  const params = useLocalSearchParams<{ shopId?: string; focus?: string }>()
  const focusInList = filters.allShops.find((shop) => shop.id === params.shopId)
  const focusShop = useShop(focusInList ? null : params.shopId).data
  const focused = useIsFocused()
  const pendingFocus = useRef<Region | null>(null)
  const handledFocus = useRef<string | null>(null)
  useEffect(() => {
    if (!params.shopId) return
    const target = focusInList ?? focusShop
    if (!target?.lat || !target.lng) return
    const focusKey = `${params.shopId}:${params.focus ?? ""}`
    if (handledFocus.current === focusKey) return
    handledFocus.current = focusKey
    if (!filters.filtered.some((shop) => shop.id === target.id)) {
      filters.resetFilters()
      filters.setSearch("")
    }
    setViewMode("map")
    setSelectedId(target.id)
    pendingFocus.current = { latitude: target.lat, longitude: target.lng, latitudeDelta: 0.012, longitudeDelta: 0.01 }
    // 같은 이동 요청은 한 번만 처리한다. 검색·필터로 목록이 바뀌어도 카메라를 다시 끌어오지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.shopId, params.focus, focusInList, focusShop])

  const flushFocus = () => {
    if (!pendingFocus.current || !mapRef.current) return
    animateTo(pendingFocus.current)
    pendingFocus.current = null
  }
  // 화면 전환(가게 상세가 닫히는 애니메이션)이 끝난 뒤에 옮긴다
  useEffect(() => {
    if (!focused) return
    const timer = setTimeout(flushFocus, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, params.shopId, params.focus, viewMode])

  // 처음 들어오면 내 위치를 보여 준다. 가게 상세에서 "지도에서 보기"로 들어온 경우는 그 가게가 먼저다.
  const centeredOnUser = useRef(false)
  useEffect(() => {
    if (!origin || centeredOnUser.current) return
    centeredOnUser.current = true
    if (params.shopId || params.focus) return
    pendingFocus.current = { ...origin, latitudeDelta: 0.012, longitudeDelta: 0.01 }
    if (focused) flushFocus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin])

  const deniedNotice =
    locationStatus === "denied" ? (
      <MapLocationNotice onAction={() => void Linking.openSettings()} />
    ) : null

  return (
    <View style={styles.root}>
      {viewMode === "map" ? (
        <View style={styles.mapArea} testID="map-surface">
            <MapView
              accessibilityLabel="라멘집 지도"
              // 목록에서 돌아와 다시 그려질 때 보던 자리(내 위치 포함)를 그대로 잇는다
              initialRegion={region}
              mapType="mutedStandard"
              onMapReady={flushFocus}
              onPress={() => Keyboard.dismiss()}
              onRegionChangeComplete={setRegion}
              ref={mapRef}
              rotateEnabled={false}
              showsCompass={false}
              showsMyLocationButton={false}
              showsPointsOfInterests={false}
              showsUserLocation={locationStatus === "granted"}
              style={StyleSheet.absoluteFill}
            >
              {clusters.map((cluster) => {
                if (cluster.shopIds.length > 1) {
                  const hasSelected = selected ? cluster.shopIds.includes(selected.id) : false
                  return (
                    <Marker
                      accessibilityLabel={`라멘집 ${cluster.shopIds.length}곳, 확대해서 보기`}
                      anchor={CLUSTER_ANCHOR}
                      coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
                      // 선택이 바뀌어도 같은 마커를 유지한다. 선택마다 키를 바꿔 다시 올리면 고른 핀이
                      // 옆 핀 아래로 깔리는 일이 있었고, 핀이 사라졌다 나타나며 흔들렸다
                      key={cluster.id}
                      onPress={() =>
                        animateTo({
                          latitude: cluster.latitude,
                          longitude: cluster.longitude,
                          latitudeDelta: region.latitudeDelta / 3,
                          longitudeDelta: region.longitudeDelta / 3,
                        })
                      }
                      tracksViewChanges={trackingPins}
                      zIndex={hasSelected ? SELECTED_Z_INDEX : 1}
                    >
                      <MapClusterPin count={cluster.shopIds.length} />
                    </Marker>
                  )
                }
                const shop = markerShops.find((item) => item.id === cluster.shopIds[0])
                if (!shop) return null
                const isSelected = selected?.id === shop.id
                return (
                  <Marker
                    accessibilityLabel={`${shop.name}${isSelected ? ", 선택됨" : ""}`}
                    anchor={PIN_ANCHOR}
                    coordinate={{ latitude: shop.lat, longitude: shop.lng }}
                    key={cluster.id}
                    onPress={() => selectShop(shop.id, shop.lat, shop.lng)}
                    tracksViewChanges={trackingPins}
                    zIndex={isSelected ? SELECTED_Z_INDEX : 1}
                  >
                    <MapShopPin name={shop.name} selected={isSelected} />
                  </Marker>
                )
              })}
            </MapView>
            <MapHeader
              filters={filters}
              onHeight={setHeaderHeight}
              onToggleView={() => setViewMode("list")}
              viewMode="map"
            />
            <View pointerEvents="box-none" style={[styles.mapOverlays, { top: headerHeight + spacing.x2 }]}>
              {deniedNotice ? <View style={styles.noticeWrap}>{deniedNotice}</View> : null}
              {filters.error ? (
                <View style={styles.noticeWrap}><AppText tone="sub" variant="secondary">라멘집을 불러오지 못했어요. 잠시 후 다시 열어 주세요.</AppText></View>
              ) : null}
              {locationStatus !== "loading" ? (
                <View style={styles.controls}>
                  <ControlButton label={locationStatus === "granted" ? "내 위치로 이동" : "기본 지역으로 이동"} onPress={goToUser}>
                    <Navigation color={colors.ink} size={20} />
                  </ControlButton>
                </View>
              ) : null}
            </View>
            <View pointerEvents="box-none" style={styles.quickViewWrap}>
              <QuickView shop={selected} />
            </View>
          </View>
      ) : (
        <View style={styles.flex}>
          <MapHeader filters={filters} onToggleView={() => setViewMode("map")} viewMode="list" />
          <ShopListView filters={filters} notice={deniedNotice} />
        </View>
      )}
    </View>
  )
}

/** 네이티브 지도에서는 권한 안내를 얇은 정보 행으로 두어 지도를 더 보여준다 */
function MapLocationNotice({ onAction }: { onAction: () => void }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.mapNotice}>
      <MapPin color={colors.inkSub} size={16} />
      <AppText lineBreakStrategyIOS="hangul-word" style={styles.noticeMessage} tone="sub" variant="secondary">
        위치 권한이 없어 망원·합정 일대를 보여드려요.
      </AppText>
      <Pressable
        accessibilityLabel="설정 열기"
        accessibilityRole="button"
        onPress={onAction}
        style={({ pressed }) => [styles.noticeAction, pressed && styles.noticePressed]}
      >
        <AppText capScale style={styles.noticeActionText} variant="secondary">
          설정 열기
        </AppText>
      </Pressable>
    </View>
  )
}

/** 지도의 조작은 서로 떨어진 44pt 흰 원으로 둔다. */
function ControlButton({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [mapStyles.floatingButton, pressed && mapStyles.floatingPressed]}
    >
      {children}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  mapOverlays: { position: "absolute", left: spacing.x4, right: spacing.x4, zIndex: 3, gap: spacing.x2, alignItems: "flex-end" },
  noticeWrap: { width: "100%" },
  mapNotice: {
    minHeight: touchTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x2,
    paddingHorizontal: spacing.x3,
    paddingVertical: spacing.x3,
    borderRadius: radii.sm,
    backgroundColor: colors.canvas,
  },
  noticeMessage: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  noticeAction: { minHeight: touchTarget, justifyContent: "center", paddingHorizontal: spacing.x2, borderRadius: radii.sm },
  noticeActionText: { fontWeight: "700" },
  noticePressed: { backgroundColor: colors.surfacePressed },
  mapArea: { flex: 1, backgroundColor: colors.canvasSoft },
  // 퀵뷰와 조작키는 지도 위에서만 그림자를 가진다.
  quickViewWrap: { position: "absolute", left: spacing.x2_5, right: spacing.x2_5, bottom: spacing.x2_5 },
  controls: { alignSelf: "flex-end" },
})
