import { NaverMapMarkerOverlay, NaverMapView, type NaverMapViewRef } from "@mj-studio/react-native-naver-map"
import * as Haptics from "expo-haptics"
import { useIsFocused, useLocalSearchParams } from "expo-router"
import * as Location from "expo-location"
import { MapPin, Navigation } from "lucide-react-native"
import { useEffect, useMemo, useRef, useState } from "react"
import { Keyboard, Linking, Pressable, StyleSheet, View, useWindowDimensions } from "react-native"
import { useReducedMotion } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { AppText } from "@/src/components/ui"
import { useShop } from "@/src/data/hooks"
import { calculateMapClusters, regionToSpread, type MapRegion } from "@/src/domain/map"
import { colors, radii, spacing, touchTarget } from "@/src/theme"
import {
  MAP_PIN_HEIGHT,
  MapHeader,
  MapClusterPin,
  MapPinLabel,
  MapPinLabelPill,
  QuickView,
  ShopListView,
  clusterPinWidth,
  mapStyles,
  useMapFilters,
  type Coordinate,
} from "./map.web"

type Region = MapRegion

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

/** 고른 핀은 다른 핀·묶음 위에 그린다(이름표가 이웃 핀에 덮이지 않게) */
const SELECTED_Z_INDEX = 2000

/** 핀 원 그림(44pt 칸 가운데 32pt 원 + 흰 로고). 좌표는 원의 중심에 맞춘다 */
const SHOP_PIN_IMAGE = require("@/assets/images/map-pin.png")
const SELECTED_PIN_IMAGE = require("@/assets/images/map-pin-selected.png")
const CENTER_ANCHOR = { x: 0.5, y: 0.5 }
/** 이름표 마커는 위쪽 44pt 원 자리를 비워 두고 그 가운데를 좌표에 맞춰, 빨간 원 바로 아래에 붙는다 */
const LABEL_ANCHOR = { x: 0.5, y: touchTarget / 2 / MAP_PIN_HEIGHT }
/**
 * 네이버 스타일 에디터(style-editor.map.naver.com)의 raota-quiet 스타일 My Style ID. 가게·시설 아이콘 32종을 끄고
 * 도로·구역·바탕을 따뜻한 회색으로 낮췄다(지하철 노선·역, 동 이름, 공원은 남김). 에디터에서 고쳐 다시 발행하면 앱에 바로 반영된다.
 * 편집 화면 주소의 ID가 아니라 발행 뒤 "스타일 적용하기"에 나오는 ID다
 */
const RAOTA_STYLE_ID = "1c8032eb-8f49-425e-904c-4fef8749ffc9"
/** 화면 밖으로 이만큼(화면 크기 대비) 더 넓게 핀을 그려 둔다. 조금 옮길 때 빈 곳이 보이지 않게 */
const VIEWPORT_MARGIN = 0.5
/** 고른 가게 카드(112pt)와 아래 여백이 지도를 가리는 높이. 묶음을 펼칠 때 그 위 칸에 맞춘다 */
const QUICK_VIEW_HEIGHT = 112 + spacing.x2_5

function inViewport(shop: { lat: number; lng: number }, region: Region): boolean {
  const latitudeReach = region.latitudeDelta * (0.5 + VIEWPORT_MARGIN)
  const longitudeReach = region.longitudeDelta * (0.5 + VIEWPORT_MARGIN)
  return Math.abs(shop.lat - region.latitude) <= latitudeReach && Math.abs(shop.lng - region.longitude) <= longitudeReach
}

/*
 * 네이버 지도의 Region은 남서쪽 모서리가 기준(latitude/longitude = 남서쪽 끝)이고,
 * 이 화면의 영역(핀 고르기·묶음 계산·펼치기)은 가운데가 기준이다. 지도와 주고받을 때만 바꾼다
 */
function fromNaverRegion(region: Region): Region {
  return { ...region, latitude: region.latitude + region.latitudeDelta / 2, longitude: region.longitude + region.longitudeDelta / 2 }
}

function toNaverRegion(region: Region): Region {
  return { ...region, latitude: region.latitude - region.latitudeDelta / 2, longitude: region.longitude - region.longitudeDelta / 2 }
}

type LocationStatus = "loading" | "granted" | "denied"

/**
 * 지도 탭: 네이버 지도(@mj-studio/react-native-naver-map, RAOTA 전용 스타일) + 웹 MapScreen과 같은 검색·필터·퀵뷰·목록.
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
  const mapRef = useRef<NaverMapViewRef>(null)
  const [mapReady, setMapReady] = useState(false)
  const [viewMode, setViewMode] = useState<"map" | "list">("map")
  const [region, setRegion] = useState<Region>(rememberedUserRegion ?? DEFAULT_REGION)
  // 처음 들어올 때는 시작 위치(내 위치)가 정해진 뒤에 지도를 그린다. 기본 지역에서 출발해 미끄러지듯 옮겨 가지 않게
  const [startResolved, setStartResolved] = useState(rememberedUserRegion !== null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("loading")
  const [origin, setOrigin] = useState<Coordinate | null>(null)
  const [headerHeight, setHeaderHeight] = useState(insets.top + spacing.x2 + spacing.x12 + spacing.x16)
  const reducedMotion = useReducedMotion()
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
  // 고른 가게 이름표의 잰 폭. 다른 가게를 고르면 그 이름으로 다시 잴 때까지 이름표 마커를 그리지 않는다
  const [labelSize, setLabelSize] = useState<{ name: string; width: number } | null>(null)
  const labelWidth = selected && labelSize?.name === selected.name ? Math.max(touchTarget, labelSize.width) : null
  // 검색·필터로 고른 가게가 목록에서 빠지면 고른 것도 푼다(지도에 없는 가게 카드가 남지 않게).
  // 원장에 없어 따로 불러온 가게(가게 상세의 "지도에서 보기")는 목록에 없으니 건드리지 않는다
  useEffect(() => {
    if (!selectedId || selectedInList) return
    if (filters.allShops.some((shop) => shop.id === selectedId)) setSelectedId(null)
  }, [filters.allShops, selectedId, selectedInList])
  // 좌표 차이를 화면 거리로 바꿀 지도 칸 크기. 재기 전에는 화면 크기로 어림한다(탭 막대만큼 크게 잡힌다)
  const windowSize = useWindowDimensions()
  const [mapFrame, setMapFrame] = useState<{ width: number; height: number } | null>(null)
  const frame = mapFrame ?? windowSize
  /*
   * 묶음은 보이는 곳만이 아니라 모든 매장으로 계산한다. 보이는 곳만 묶으면 지도를 옮길 때마다 가장자리로 드나드는
   * 가게 때문에 묶음이 바뀌어, 멈출 때마다 핀이 거의 다 지워졌다 다시 그려져 끊겨 보였다(2026.10.24).
   * 그래서 묶음은 확대 수준(영역 폭)이 바뀔 때만 다시 계산하고, 옮기기만 하면 같은 묶음이 그대로 남는다.
   * 고른 가게는 묶음에 넣지 않는다. 묶이면 카드는 떠 있는데 빨간 핀이 숫자 알약 속에 숨는다
   */
  const clusters = useMemo(
    () =>
      calculateMapClusters(
        selectedId ? markerShops.filter((shop) => shop.id !== selectedId) : markerShops,
        { latitudeDelta: region.latitudeDelta, longitudeDelta: region.longitudeDelta },
        { width: frame.width, height: frame.height },
      ),
    [markerShops, selectedId, region.latitudeDelta, region.longitudeDelta, frame.width, frame.height],
  )
  // 보이는 곳(과 둘레 반 화면씩)의 묶음·핀만 마커로 그린다. 묶음 숫자는 뷰 마커라 전부 그리면 무거워진다.
  // 지도를 옮기고 멈추면(onCameraIdle) 새로 보이는 곳의 마커가 붙는다
  const visibleClusters = useMemo(
    () => clusters.filter((cluster) => inViewport({ lat: cluster.latitude, lng: cluster.longitude }, region)),
    [clusters, region],
  )
  const shopById = useMemo(() => new Map(markerShops.map((shop) => [shop.id, shop])), [markerShops])
  // 카메라 이동은 짧게(빠릿하게). 동작 줄이기에서는 바로 옮긴다
  const cameraMs = reducedMotion ? 0 : CAMERA_MS
  const animateTo = (target: Region) =>
    mapRef.current?.animateRegionTo({ ...toNaverRegion(target), duration: cameraMs, easing: "EaseOut" })

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
    mapRef.current?.animateCameraTo({ latitude, longitude, duration: cameraMs, easing: "EaseOut" })
  }

  // 내 위치 점은 네이버 지도가 직접 따라 그린다(NoFollow: 점만 움직이고 카메라는 그대로)
  useEffect(() => {
    if (mapReady && locationStatus === "granted") mapRef.current?.setLocationTrackingMode("NoFollow")
  }, [mapReady, locationStatus])

  /*
   * 가게 상세의 "지도에서 보기"가 넘기는 매장. 그 가게를 골라 가깝게 보여 준다.
   * 지금 필터나 검색에 걸려 그 가게가 빠져 있으면 필터를 풀어야 핀이 보인다.
   * 지도 이동은 탭이 화면에 올라온 뒤에 한다. 가게 상세 뒤에 가려진 채로 부르면 지도가 무시한다.
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

  // 고른 가게 카드(또는 "없어요" 카드)가 떠 있는지. 네이버 로고는 가리면 안 되므로 카드 위로 올린다
  const cardShown = Boolean(selected) || (!filters.isLoading && markerShops.length === 0)

  return (
    <View style={styles.root}>
      {viewMode === "map" ? (
        <View
          onLayout={({ nativeEvent }) => {
            const { width, height } = nativeEvent.layout
            setMapFrame((previous) => (previous?.width === width && previous.height === height ? previous : { width, height }))
          }}
          style={styles.mapArea}
          testID="map-surface"
        >
            {startResolved ? (
            <NaverMapView
              accessibilityLabel="라멘집 지도"
              customStyleId={RAOTA_STYLE_ID}
              // 목록에서 돌아와 다시 그려질 때 보던 자리(내 위치 포함)를 그대로 잇는다
              initialRegion={toNaverRegion(region)}
              isRotateGesturesEnabled={false}
              isShowCompass={false}
              isShowLocationButton={false}
              isShowScaleBar={false}
              isShowZoomControls={false}
              isTiltGesturesEnabled={false}
              locale="ko"
              logoMargin={{ left: spacing.x3, bottom: cardShown ? QUICK_VIEW_HEIGHT + spacing.x2 : spacing.x2 }}
              onCameraIdle={({ region: visible }) => setRegion(fromNaverRegion(visible))}
              onInitialized={() => {
                setMapReady(true)
                flushFocus()
              }}
              // 핀·묶음을 누르면 그 마커가 탭을 가져가 여기로 오지 않는다. 빈 곳을 누를 때만 고른 것을 푼다
              onTapMap={() => {
                Keyboard.dismiss()
                setSelectedId(null)
              }}
              ref={mapRef}
              style={StyleSheet.absoluteFill}
            >
              {visibleClusters.map((cluster) => {
                if (cluster.shopIds.length > 1) {
                  return (
                    <NaverMapMarkerOverlay
                      anchor={CENTER_ANCHOR}
                      height={touchTarget}
                      key={cluster.id}
                      latitude={cluster.latitude}
                      longitude={cluster.longitude}
                      onTap={() => {
                        const members = cluster.shopIds.flatMap((id) => shopById.get(id) ?? [])
                        if (members.length === 0) return
                        // 이 묶음이 풀릴 만큼만 확대한다. 머리와 고른 가게 카드에 가리지 않는 칸에 맞춘다
                        animateTo(regionToSpread(members, region, frame, { top: headerHeight, bottom: selected ? QUICK_VIEW_HEIGHT : 0 }))
                      }}
                      width={clusterPinWidth(cluster.shopIds.length)}
                      zIndex={1}
                    >
                      {/* 마커는 처음 그린 모습을 사진처럼 찍어 쓴다. 숫자가 바뀌면 key로 다시 찍게 해 마커는 그대로 두고 숫자만 바꾼다 */}
                      <MapClusterPin count={cluster.shopIds.length} key={cluster.shopIds.length} />
                    </NaverMapMarkerOverlay>
                  )
                }
                const shop = shopById.get(cluster.shopIds[0])
                if (!shop) return null
                return (
                  <NaverMapMarkerOverlay
                    anchor={CENTER_ANCHOR}
                    height={touchTarget}
                    image={SHOP_PIN_IMAGE}
                    key={cluster.id}
                    latitude={shop.lat}
                    longitude={shop.lng}
                    onTap={() => selectShop(shop.id, shop.lat, shop.lng)}
                    width={touchTarget}
                    zIndex={1}
                  />
                )
              })}
              {selected?.lat && selected.lng ? (
                // 고른 핀은 묶음과 따로, 늘 다른 핀 위에 그린다. 원은 그림, 이름표는 뷰라 마커 둘로 겹쳐 올린다.
                // 둘 다 밑에 깔린 지도 글씨(길·동 이름)를 가려 이름표가 읽히게 한다
                <>
                  <NaverMapMarkerOverlay
                    anchor={CENTER_ANCHOR}
                    height={touchTarget}
                    image={SELECTED_PIN_IMAGE}
                    isHideCollidedSymbols
                    key={`selected-pin-${selected.id}`}
                    latitude={selected.lat}
                    longitude={selected.lng}
                    onTap={() => selectShop(selected.id, selected.lat, selected.lng)}
                    width={touchTarget}
                    zIndex={SELECTED_Z_INDEX + 1}
                  />
                  {labelWidth !== null ? (
                    <NaverMapMarkerOverlay
                      anchor={LABEL_ANCHOR}
                      height={MAP_PIN_HEIGHT}
                      isHideCollidedSymbols
                      key={`selected-label-${selected.id}`}
                      latitude={selected.lat}
                      longitude={selected.lng}
                      onTap={() => selectShop(selected.id, selected.lat, selected.lng)}
                      width={labelWidth}
                      zIndex={SELECTED_Z_INDEX}
                    >
                      <MapPinLabel name={selected.name} width={labelWidth} />
                    </NaverMapMarkerOverlay>
                  ) : null}
                </>
              ) : null}
            </NaverMapView>
            ) : null}
            {selected ? (
              // 이름표 폭을 재는 투명한 사본. 잰 폭으로 이름표 마커를 만든다(마커는 처음 그린 모습을 사진처럼 찍어 쓴다)
              <View
                onLayout={({ nativeEvent }) => setLabelSize({ name: selected.name, width: Math.ceil(nativeEvent.layout.width) })}
                pointerEvents="none"
                style={styles.labelMeasure}
                testID="map-pin-label-measure"
              >
                <MapPinLabelPill name={selected.name} />
              </View>
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
  // 이름표 폭을 재는 사본은 보이지 않게, 다른 것의 자리를 밀지 않게 띄운다
  labelMeasure: { position: "absolute", left: 0, top: 0, opacity: 0 },
  // 퀵뷰와 조작키는 지도 위에서만 그림자를 가진다.
  quickViewWrap: { position: "absolute", left: spacing.x2_5, right: spacing.x2_5, bottom: spacing.x2_5 },
  controls: { alignSelf: "flex-end" },
})
