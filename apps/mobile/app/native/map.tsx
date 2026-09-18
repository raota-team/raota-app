import * as Haptics from "expo-haptics"
import * as Location from "expo-location"
import { Minus, Navigation, Plus } from "lucide-react-native"
import { useEffect, useMemo, useRef, useState } from "react"
import { Image, Keyboard, Linking, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import MapView, { Marker, type Region } from "react-native-maps"

import { AppText } from "@/src/components/ui"
import { calculateMapClusters } from "@/src/domain/map"
import { colors, radii, shadows, spacing, touchTarget } from "@/src/theme"
import {
  LocationNotice,
  MapHeader,
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
  latitudeDelta: 0.03,
  longitudeDelta: 0.025,
}

type LocationStatus = "loading" | "granted" | "denied"

/**
 * 지도 탭: Apple 지도(react-native-maps) + 웹 MapScreen과 같은 검색·필터·퀵뷰·목록.
 * 위치 권한을 이 화면에서 묻고, 거절하면 기본 지역과 설정 경로를 보여준다.
 */
export default function MapScreen() {
  const mapRef = useRef<MapView>(null)
  const [viewMode, setViewMode] = useState<"map" | "list">("map")
  const [region, setRegion] = useState<Region>(DEFAULT_REGION)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("loading")
  const [origin, setOrigin] = useState<Coordinate | null>(null)
  const filters = useMapFilters(origin)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync()
        if (!mounted) return
        if (permission.status !== "granted") {
          setLocationStatus("denied")
          return
        }
        setLocationStatus("granted")
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        if (mounted) setOrigin({ latitude: current.coords.latitude, longitude: current.coords.longitude })
      } catch {
        if (mounted) setLocationStatus("denied")
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const filtered = filters.filtered
  const selected = filtered.find((shop) => shop.id === selectedId) ?? filtered[0] ?? null
  const clusters = useMemo(() => calculateMapClusters(filtered, region), [filtered, region])

  const animateTo = (target: Region) => mapRef.current?.animateToRegion(target, 350)

  const goToUser = () => {
    if (!origin) {
      animateTo(DEFAULT_REGION)
      return
    }
    animateTo({ ...origin, latitudeDelta: 0.012, longitudeDelta: 0.01 })
  }

  const zoom = (factor: number) =>
    animateTo({
      ...region,
      latitudeDelta: Math.min(Math.max(region.latitudeDelta * factor, 0.002), 0.5),
      longitudeDelta: Math.min(Math.max(region.longitudeDelta * factor, 0.002), 0.5),
    })

  const selectShop = (shopId: number, latitude: number, longitude: number) => {
    setSelectedId(shopId)
    void Haptics.selectionAsync().catch(() => undefined)
    animateTo({
      latitude,
      longitude,
      latitudeDelta: Math.min(region.latitudeDelta, 0.02),
      longitudeDelta: Math.min(region.longitudeDelta, 0.016),
    })
  }

  const deniedNotice =
    locationStatus === "denied" ? (
      <LocationNotice
        actionLabel="설정 열기"
        message="위치 권한이 없어 망원·합정 일대를 보여드려요."
        onAction={() => void Linking.openSettings()}
      />
    ) : null

  return (
    <View style={styles.root}>
      <MapHeader filters={filters} onToggleView={() => setViewMode((mode) => (mode === "map" ? "list" : "map"))} viewMode={viewMode} />

      {viewMode === "map" ? (
        <View style={styles.flex}>
          {deniedNotice ? <View style={styles.noticeWrap}>{deniedNotice}</View> : null}
          <View style={styles.mapArea}>
            <MapView
              accessibilityLabel="라멘집 지도"
              initialRegion={DEFAULT_REGION}
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
                      coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
                      key={cluster.id}
                      onPress={() =>
                        animateTo({
                          latitude: cluster.latitude,
                          longitude: cluster.longitude,
                          latitudeDelta: region.latitudeDelta / 3,
                          longitudeDelta: region.longitudeDelta / 3,
                        })
                      }
                      tracksViewChanges={false}
                    >
                      <View style={[styles.cluster, hasSelected && styles.clusterSelected]}>
                        <AppText capScale style={styles.clusterText} tone="onDark" variant="meta">
                          {cluster.shopIds.length}
                        </AppText>
                      </View>
                    </Marker>
                  )
                }
                const shop = filtered.find((item) => item.id === cluster.shopIds[0])
                if (!shop) return null
                const isSelected = selected?.id === shop.id
                return (
                  <Marker
                    accessibilityLabel={`${shop.name}${isSelected ? ", 선택됨" : ""}`}
                    anchor={{ x: 0.5, y: 1 }}
                    coordinate={{ latitude: shop.lat, longitude: shop.lng }}
                    key={`${cluster.id}-${isSelected ? "on" : "off"}`}
                    onPress={() => selectShop(shop.id, shop.lat, shop.lng)}
                    zIndex={isSelected ? 10 : 1}
                  >
                    <View style={styles.pin}>
                      <View style={[styles.pinCircle, isSelected && styles.pinCircleSelected]}>
                        <Image
                          source={require("@/assets/images/logo.png")}
                          style={[styles.pinLogo, isSelected && styles.pinLogoSelected]}
                        />
                      </View>
                      <View style={[styles.pinLabel, isSelected && styles.pinLabelSelected]}>
                        <AppText capScale numberOfLines={1} style={styles.pinLabelText} tone={isSelected ? "onDark" : "sub"} variant="meta">
                          {shop.name}
                        </AppText>
                      </View>
                      <View style={[styles.pinTail, isSelected && styles.pinTailSelected]} />
                    </View>
                  </Marker>
                )
              })}
            </MapView>

            <View style={styles.controls}>
              <ControlButton
                label={locationStatus === "granted" ? "내 위치로 이동" : "기본 지역으로 이동"}
                onPress={goToUser}
                style={mapStyles.floatingButton}
              >
                <Navigation color={locationStatus === "granted" ? colors.brand : colors.ink} size={18} />
              </ControlButton>
              <View style={styles.zoomGroup}>
                <ControlButton label="확대" onPress={() => zoom(0.5)}>
                  <Plus color={colors.ink} size={20} />
                </ControlButton>
                <View style={styles.zoomDivider} />
                <ControlButton label="축소" onPress={() => zoom(2)}>
                  <Minus color={colors.ink} size={20} />
                </ControlButton>
              </View>
            </View>
          </View>
          <QuickView shop={selected} />
        </View>
      ) : (
        <ShopListView filters={filters} notice={deniedNotice} />
      )}
    </View>
  )
}

function ControlButton({
  label,
  onPress,
  style,
  children,
}: {
  label: string
  onPress: () => void
  style?: StyleProp<ViewStyle>
  children: React.ReactNode
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.controlButton, style, pressed && styles.controlPressed]}
    >
      {children}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  noticeWrap: { paddingHorizontal: spacing.x4, paddingTop: spacing.x3, backgroundColor: colors.canvas },
  mapArea: { flex: 1, overflow: "hidden", backgroundColor: colors.canvasSoft },
  controls: { position: "absolute", top: spacing.x4, right: spacing.x4, gap: spacing.x2 },
  zoomGroup: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.canvas,
    overflow: Platform.OS === "ios" ? "visible" : "hidden",
    ...shadows.floating,
  },
  zoomDivider: { height: 1, backgroundColor: colors.border },
  controlButton: { width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center", borderRadius: radii.sm },
  controlPressed: { backgroundColor: colors.canvasSoft },

  cluster: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: spacing.x1_5,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.onDark,
    backgroundColor: colors.brand,
  },
  clusterSelected: { borderColor: colors.ink },
  clusterText: { fontWeight: "800", fontVariant: ["tabular-nums"] },

  pin: { alignItems: "center" },
  pinCircle: {
    width: 32,
    height: 32,
    padding: 5,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.canvas,
  },
  pinCircleSelected: { width: 40, height: 40, padding: 6, borderWidth: 2, borderColor: colors.onDark, backgroundColor: colors.brand },
  pinLogo: { width: "100%", height: "100%", resizeMode: "contain", opacity: 0.85 },
  pinLogoSelected: { opacity: 1, tintColor: colors.onDark },
  pinLabel: {
    marginTop: 3,
    maxWidth: 140,
    paddingHorizontal: 9,
    paddingVertical: 2,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.canvas,
  },
  pinLabelSelected: { borderColor: colors.brand, backgroundColor: colors.brand },
  pinLabelText: { fontWeight: "800" },
  pinTail: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 5,
    borderLeftColor: colors.transparent,
    borderRightColor: colors.transparent,
    borderTopColor: colors.border,
  },
  pinTailSelected: { borderTopColor: colors.brand },
})
