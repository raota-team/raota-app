import { NaverMapMarkerOverlay, NaverMapView, type NaverMapViewRef } from "@mj-studio/react-native-naver-map"
import * as Haptics from "expo-haptics"
import { router } from "expo-router"
import { ChevronLeft } from "lucide-react-native"
import { useMemo, useRef, useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { AppText } from "@/src/components/ui"
import { colors, radii, spacing, touchTarget } from "@/src/theme"
import { MAP_PIN_HEIGHT, MapHeader, MapShopPin, QuickView, useMapFilters } from "../native/map.web"

/*
 * PROTOTYPE — 버리는 코드. 지도를 네이버 지도로 옮길지 고르기 위한 시험 화면(prototype/naver-map 브랜치 전용).
 * raota://map-naver 로 연다. 지금 지도 탭(애플 지도, react-native-maps)과 같은 매장·검색·필터·카드를
 * 네이버 지도 SDK 위에 올려 바탕 지도, 핀·묶음, 카메라 이동을 나란히 비교한다.
 * - 묶음: 네이버 SDK 자체 클러스터링(화면 56pt 안이면 묶음, 줌 17 넘으면 안 묶음)
 * - 낱개 핀: 미리 그린 그림(검은 원 + 흰 로고). 고른 가게만 빨간 원 + 빨간 이름표 뷰
 * - 카메라: 220ms ease-out(네이버 SDK가 지속 시간을 그대로 따른다)
 */

const PIN_IMAGE = require("@/assets/images/map-pin.png")
const START = { latitude: 37.5537, longitude: 126.9156, zoom: 14 }
/** 고른 핀 뷰의 폭. 이름표(최대 160pt)가 들어가는 크기 */
const SELECTED_PIN_WIDTH = 168
const CAMERA_MS = 220

export default function NaverMapPrototype() {
  const insets = useSafeAreaInsets()
  const mapRef = useRef<NaverMapViewRef>(null)
  const filters = useMapFilters(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const shops = useMemo(() => filters.filtered.filter((shop) => shop.lat && shop.lng), [filters.filtered])
  const selected = shops.find((shop) => shop.id === selectedId) ?? null
  const markers = useMemo(
    () =>
      shops
        .filter((shop) => shop.id !== selectedId)
        .map((shop) => ({ identifier: shop.id, latitude: shop.lat, longitude: shop.lng, image: PIN_IMAGE, width: 44, height: 44 })),
    [selectedId, shops],
  )

  const select = (shopId: string) => {
    const shop = shops.find((item) => item.id === shopId)
    if (!shop) return
    setSelectedId(shopId)
    void Haptics.selectionAsync().catch(() => undefined)
    mapRef.current?.animateCameraTo({ latitude: shop.lat, longitude: shop.lng, duration: CAMERA_MS, easing: "EaseOut" })
  }

  return (
    <View style={styles.root}>
      <NaverMapView
        clusters={[{ markers, screenDistance: 56, maxZoom: 17, animate: true }]}
        initialCamera={START}
        isShowCompass={false}
        isShowLocationButton={false}
        isShowScaleBar={false}
        isShowZoomControls={false}
        locale="ko"
        onTapClusterLeaf={({ markerIdentifier }) => select(markerIdentifier)}
        onTapMap={() => setSelectedId(null)}
        ref={mapRef}
        style={StyleSheet.absoluteFill}
      >
        {selected ? (
          <NaverMapMarkerOverlay
            anchor={{ x: 0.5, y: touchTarget / 2 / MAP_PIN_HEIGHT }}
            height={MAP_PIN_HEIGHT}
            latitude={selected.lat}
            longitude={selected.lng}
            width={SELECTED_PIN_WIDTH}
            zIndex={1000}
          >
            <View collapsable={false} style={styles.selectedPin}>
              <MapShopPin name={selected.name} selected />
            </View>
          </NaverMapMarkerOverlay>
        ) : null}
      </NaverMapView>

      <MapHeader filters={filters} viewMode="map" />
      <View style={[styles.badge, { bottom: insets.bottom + (selected ? 112 + spacing.x5 : spacing.x3) }]}>
        <Pressable accessibilityLabel="뒤로가기" accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
          <ChevronLeft color={colors.onDark} size={18} />
        </Pressable>
        <AppText capScale style={styles.badgeText} variant="meta">네이버 지도 시험</AppText>
      </View>

      {selected ? (
        <View pointerEvents="box-none" style={styles.quickViewWrap}>
          <QuickView onClose={() => setSelectedId(null)} shop={selected} />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  selectedPin: { width: SELECTED_PIN_WIDTH, height: MAP_PIN_HEIGHT, alignItems: "center" },
  badge: {
    position: "absolute",
    left: spacing.x4,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x1,
    paddingRight: spacing.x3,
    borderRadius: radii.pill,
    backgroundColor: colors.deep,
    zIndex: 10,
  },
  back: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  badgeText: { color: colors.onDark, fontWeight: "700" },
  quickViewWrap: { position: "absolute", left: spacing.x2_5, right: spacing.x2_5, bottom: spacing.x2_5 + 34 },
})
