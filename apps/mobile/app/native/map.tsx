import * as Haptics from "expo-haptics"
import { useIsFocused, useLocalSearchParams } from "expo-router"
import * as Location from "expo-location"
import { MapPin, Navigation } from "lucide-react-native"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
/** 지도 카메라 이동 시간(ms). 핀 고르기·묶음 확대·내 위치로 가기 모두 이 박자로 짧게 옮긴다 */
const CAMERA_MS = 220

/** 내 위치를 보여 줄 때의 확대 수준(동네 몇 블록) */
const USER_SPAN = { latitudeDelta: 0.012, longitudeDelta: 0.01 }
/**
 * 지도를 처음 그리기 전에 내 위치를 기다리는 최대 시간. 마지막으로 알던 위치는 보통 바로 오지만,
 * 기기에 기록이 없으면 GPS를 기다리느라 늦어진다. 그때는 기본 지역으로 그린 뒤 위치가 오면 옮긴다.
 */
const START_LOCATION_WAIT = 1200
/**
 * 이 앱이 켜져 있는 동안 마지막으로 본 내 위치. 탭을 다시 열거나 다시 불러오기로 화면을 새로 올려도
 * 망원·합정에서 출발했다가 옮겨 가지 않고 처음부터 내 위치에서 시작한다.
 */
let rememberedUserRegion: Region | null = null

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
  const [retryKey, setRetryKey] = useState(0)
  return <MapBody key={retryKey} onRetry={() => setRetryKey((key) => key + 1)} />
}

/*
 * 실패한 서버 읽기는 캐시하지 않으므로 본문을 새 key로 다시 올리면 실패한 요청만 다시 보낸다.
 * 데이터 hook에 refetch가 생기면 이 key 대신 그것을 부른다.
 */
function MapBody({ onRetry }: { onRetry: () => void }) {
  const insets = useSafeAreaInsets()
  const mapRef = useRef<MapView>(null)
  const [viewMode, setViewMode] = useState<"map" | "list">("map")
  const [region, setRegion] = useState<Region>(rememberedUserRegion ?? DEFAULT_REGION)
  // 처음 들어올 때는 시작 위치(내 위치)가 정해진 뒤에 지도를 그린다. 기본 지역에서 출발해 미끄러지듯 옮겨 가지 않게
  const [startResolved, setStartResolved] = useState(rememberedUserRegion !== null)
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

  // 지도를 이미 그렸는지. 그린 뒤에는 시작 위치(initialRegion)를 바꿔도 소용없어 대신 카메라를 옮긴다
  const startResolvedRef = useRef(startResolved)
  useEffect(() => {
    let mounted = true
    const resolveStart = () => {
      startResolvedRef.current = true
      setStartResolved(true)
    }
    // 위치가 늦으면 기다리지 않고 지도를 먼저 그린다(위치가 오면 아래 centeredOnUser가 옮긴다)
    const giveUp = setTimeout(() => {
      if (mounted) resolveStart()
    }, START_LOCATION_WAIT)
    const startAt = (coords: Coordinate) => {
      const userRegion = { ...coords, ...USER_SPAN }
      rememberedUserRegion = userRegion
      setOrigin(coords)
      // 지도를 아직 그리기 전이면 시작 위치 자체를 내 위치로 둔다
      if (!startResolvedRef.current) setRegion(userRegion)
      resolveStart()
    }
    ;(async () => {
      let permission: Location.LocationPermissionResponse
      try {
        permission = await Location.requestForegroundPermissionsAsync()
      } catch {
        if (mounted) {
          setLocationStatus("denied")
          resolveStart()
        }
        return
      }
      if (!mounted) return
      if (permission.status !== "granted") {
        setLocationStatus("denied")
        resolveStart()
        return
      }
      setLocationStatus("granted")
      // 마지막으로 알던 위치로 먼저 시작하고, 정확한 위치가 오면 거리와 위치를 다시 맞춘다.
      // 위치를 못 잡은 건(GPS 시간 초과 등) 권한 문제가 아니라서 "설정 열기" 안내를 띄우지 않는다.
      try {
        const last = await Location.getLastKnownPositionAsync()
        if (mounted && last) startAt({ latitude: last.coords.latitude, longitude: last.coords.longitude })
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        if (mounted) startAt({ latitude: current.coords.latitude, longitude: current.coords.longitude })
      } catch {
        if (mounted) resolveStart()
      }
    })()
    return () => {
      mounted = false
      clearTimeout(giveUp)
    }
  }, [])

  const filtered = filters.filtered
  // 좌표 없는 매장도 목록에 남기되, 지도 마커는 좌표가 있는 매장만 사용한다.
  const markerShops = useMemo(() => filtered.filter((shop) => shop.lat && shop.lng), [filtered])
  const selectedInList = filtered.find((shop) => shop.id === selectedId)
  const selectedShop = useShop(selectedInList ? null : selectedId).data
  // 처음에는 아무 가게도 고르지 않는다. 핀을 눌러야 고르고, 카드의 ✕나 지도 빈 곳을 누르면 풀린다(사용자 결정 2026.10.21)
  const selected = selectedInList ?? selectedShop ?? null
  // 검색·필터로 고른 가게가 목록에서 빠지면 고른 것도 푼다(지도에 없는 가게 카드가 남지 않게).
  // 원장에 없어 따로 불러온 가게(가게 상세의 "지도에서 보기")는 목록에 없으니 건드리지 않는다
  useEffect(() => {
    if (!selectedId || selectedInList) return
    if (filters.allShops.some((shop) => shop.id === selectedId)) setSelectedId(null)
  }, [filters.allShops, selectedId, selectedInList])
  const clusters = useMemo(() => calculateMapClusters(markerShops, region), [markerShops, region])

  // 핀이 바뀌면 잠깐 다시 그리게 두고(로고가 실릴 시간) 곧 고정한다.
  // 로고가 늦게 오면(개발 빌드는 그림을 Metro에서 받는다) 실린 순간 한 번 더 그리게 해 빈 원으로 굳지 않게 한다
  const cancelSettle = useRef(() => {})
  const trackPinsBriefly = useCallback(() => {
    setTrackingPins(true)
    cancelSettle.current()
    const settle = setTimeout(() => setTrackingPins(false), 700)
    cancelSettle.current = () => clearTimeout(settle)
  }, [])
  useEffect(() => {
    trackPinsBriefly()
  }, [clusters, selectedId, trackPinsBriefly])
  useEffect(() => () => cancelSettle.current(), [])

  // 카메라 이동은 짧게(빠릿하게). 동작 줄이기에서는 바로 옮긴다
  const animateTo = (target: Region) => mapRef.current?.animateToRegion(target, reducedMotion ? 0 : CAMERA_MS)

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
      <MapNotice actionLabel="설정 열기" icon={<MapPin color={colors.inkSub} size={16} />} message="위치 권한이 없어 망원·합정 일대를 보여드려요." onAction={() => void Linking.openSettings()} />
    ) : null

  return (
    <View style={styles.root}>
      {viewMode === "map" ? (
        <View style={styles.mapArea} testID="map-surface">
            {startResolved ? (
            <MapView
              accessibilityLabel="라멘집 지도"
              // 목록에서 돌아와 다시 그려질 때 보던 자리(내 위치 포함)를 그대로 잇는다
              initialRegion={region}
              mapType="mutedStandard"
              onMapReady={flushFocus}
              onPress={(event) => {
                Keyboard.dismiss()
                // 핀을 누를 때도 지도 onPress가 함께 온다. 그때는 고른 것을 풀지 않는다
                if (event.nativeEvent.action !== "marker-press") setSelectedId(null)
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
                    <MapShopPin name={shop.name} onLogoLoad={trackPinsBriefly} selected={isSelected} />
                  </Marker>
                )
              })}
            </MapView>
            ) : null}
            <MapHeader
              filters={filters}
              onHeight={setHeaderHeight}
              onToggleView={() => setViewMode("list")}
              viewMode="map"
            />
            <View pointerEvents="box-none" style={[styles.mapOverlays, { top: headerHeight + spacing.x2 }]}>
              {deniedNotice ? <View style={styles.noticeWrap}>{deniedNotice}</View> : null}
              {filters.error ? (
                <View style={styles.noticeWrap}>
                  <MapNotice
                    // 로컬 원장의 오류(저장소)는 다시 올려도 풀리지 않아 서버에서 읽을 때만 다시 부른다
                    actionLabel={filters.remote ? "다시 불러오기" : undefined}
                    message={filters.remote ? "라멘집을 불러오지 못했어요." : "라멘집을 불러오지 못했어요. 잠시 후 다시 열어 주세요."}
                    onAction={onRetry}
                  />
                </View>
              ) : null}
              {locationStatus !== "loading" ? (
                <View style={styles.controls}>
                  <ControlButton label={locationStatus === "granted" ? "내 위치로 이동" : "기본 지역으로 이동"} onPress={goToUser}>
                    <Navigation color={colors.ink} size={20} />
                  </ControlButton>
                </View>
              ) : null}
            </View>
            {/*
              카드는 고른 가게가 있을 때만 띄운다. 조건에 맞는 가게가 하나도 없을 때만 "없어요" 카드를 띄우고,
              서버에서 매장을 받는 동안에는 띄우지 않는다(지도 위에 떠 있는 카드라 자리는 밀리지 않는다)
            */}
            {selected ? (
              <View pointerEvents="box-none" style={styles.quickViewWrap}>
                <QuickView onClose={() => setSelectedId(null)} shop={selected} />
              </View>
            ) : !filters.isLoading && markerShops.length === 0 ? (
              <View pointerEvents="box-none" style={styles.quickViewWrap}>
                <QuickView shop={null} />
              </View>
            ) : null}
          </View>
      ) : (
        <View style={styles.flex}>
          <MapHeader filters={filters} onToggleView={() => setViewMode("map")} viewMode="list" />
          <ShopListView filters={filters} notice={deniedNotice} onRetry={onRetry} />
        </View>
      )}
    </View>
  )
}

/** 네이티브 지도에서는 권한·불러오기 안내를 얇은 정보 행으로 두어 지도를 더 보여준다 */
function MapNotice({ icon, message, actionLabel, onAction }: { icon?: React.ReactNode; message: string; actionLabel?: string; onAction: () => void }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.mapNotice}>
      {icon}
      <AppText lineBreakStrategyIOS="hangul-word" style={styles.noticeMessage} tone="sub" variant="secondary">
        {message}
      </AppText>
      {actionLabel ? (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [styles.noticeAction, pressed && styles.noticePressed]}
        >
          <AppText capScale style={styles.noticeActionText} variant="secondary">
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
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
