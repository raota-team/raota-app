import * as Haptics from "expo-haptics"
import { router, useLocalSearchParams } from "expo-router"
import { CalendarCheck, ChevronLeft, ChevronRight, Ellipsis, Heart, ImageOff, Map as MapIcon, MapPin, Phone, Share2, Sparkles, X } from "lucide-react-native"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  Linking,
  Modal,
  Share,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type ColorValue,
} from "react-native"
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Svg, { Path } from "react-native-svg"

import type { Shop, ShopCatalogItem } from "@raota/shared"
import { track } from "@/src/analytics"
import { ResilientUriImage } from "@/src/components/ResilientUriImage"
import { PhotoViewer } from "@/src/components/PhotoViewer"
import { ShopTasteCard } from "@/src/components/ShopTasteCard"
import { EdgeBackZone } from "@/src/components/EdgeBackZone"
import { AppText, BottomSheet, Button, EmptyState, Header, IconButton, LoadingState, Screen, StickyActionBar, Toast } from "@/src/components/ui"
import { isRemote } from "@/src/api/config"
import { useShop, useShops } from "@/src/data/hooks"
import { breaksOf, DAY_SHORT, formatTime, groupWeek, hoursStatusAt, parseOpeningHours, seoulTime, spanText, statusText, type DayHours } from "@/src/domain/hours"
import { naverMapLinks } from "@/src/domain/naverMap"
import { isLogVisibleTo } from "@/src/domain/lounge"
import { shopTasteSummaryOf } from "@/src/domain/shopTaste"
import { useRaota } from "@/src/state/RaotaStore"
import { colors, line, radii, spacing, touchTarget } from "@/src/theme"

/** 하단 고정 바 높이(버튼 48 + 위아래 여백)만큼 토스트를 띄운다 */
const TOAST_OFFSET = 88
/** 이 가게의 맛 카드 윗변에서 이만큼(제목 + 첫 문장) 보이면 떠오르게 한다 */
const FINGERPRINT_REVEAL_DEPTH = 120
const SAVE_EASE = Easing.bezier(0.22, 1, 0.36, 1)

type DetailShop = Shop & Partial<Pick<ShopCatalogItem, "style" | "spec" | "lastOrder">>

function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${meters}m`
}

/** 영업 상태는 원장의 businessStatus와 isOpen에서만 파생한다 */
function businessLabel(shop: Shop): { label: string; open: boolean } {
  switch (shop.businessStatus) {
    case "OPERATIONAL":
      return shop.isOpen ? { label: "영업 중", open: true } : { label: "준비 중", open: false }
    case "CLOSED_TEMPORARILY":
      return { label: "임시 휴업", open: false }
    case "CLOSED_PERMANENTLY":
      return { label: "폐업", open: false }
    default:
      return { label: "영업 정보 확인 필요", open: false }
  }
}

interface LiveStatus {
  label: string
  detail: string | null
  open: boolean
}

/** 초록 점(영업 중일 때만) + "쉬는 시간 · 17:00에 다시 열어요" */
function HoursStatusLine({ status, large = false }: { status: LiveStatus; large?: boolean }) {
  return (
    <View style={styles.statusLine}>
      <View style={[styles.statusDot, { backgroundColor: status.open ? colors.open : colors.textMuted }]} testID="shop-hours-status-dot" />
      <AppText style={[styles.flexShrink, styles.tabular]} variant={large ? "body" : "secondary"}>
        <AppText style={styles.bold} variant={large ? "body" : "secondary"}>{status.label}</AppText>
        {status.detail ? <AppText tone="sub" variant={large ? "body" : "secondary"}>{` · ${status.detail}`}</AppText> : null}
      </AppText>
    </View>
  )
}

/**
 * 오늘 하루를 첫 여는 시각부터 마지막 닫는 시각까지 한 줄 막대로 보여 준다.
 * 영업 구간은 검정, 쉬는 시간은 빈 트랙, 지금 시각은 동그란 표시다. 읽는 내용은 위 상태 줄과 아래 요일 목록이 같으므로 스크린리더는 건너뛴다.
 */
function TodayTimeline({ hours, nowMinute }: { hours: DayHours; nowMinute: number }) {
  const start = hours.ranges[0].start
  const end = hours.ranges[hours.ranges.length - 1].end
  const span = end - start
  const at = (minute: number): `${number}%` => `${((minute - start) / span) * 100}%`
  const pauses = breaksOf(hours.ranges)
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.timeline} testID="shop-hours-timeline">
      <View style={styles.timelineTrack}>
        {hours.ranges.map((range) => (
          <View key={range.start} style={[styles.timelineOpen, { left: at(range.start), width: `${((range.end - range.start) / span) * 100}%` }]} />
        ))}
        {nowMinute >= start && nowMinute <= end ? <View style={[styles.timelineNow, { left: at(nowMinute) }]} testID="shop-hours-now" /> : null}
      </View>
      <View style={styles.timelineLabels}>
        <AppText capScale style={styles.tabular} tone="sub" variant="meta">{formatTime(start)}</AppText>
        {pauses.length === 1 ? (
          <AppText capScale style={styles.tabular} tone="muted" variant="meta">{`쉬는 시간 ${formatTime(pauses[0].start)} – ${formatTime(pauses[0].end)}`}</AppText>
        ) : null}
        <AppText capScale style={styles.tabular} tone="sub" variant="meta">{formatTime(end)}</AppText>
      </View>
    </View>
  )
}

function InstagramIcon({ color, size = 16 }: { color: ColorValue; size?: number }) {
  return (
    <Svg fill={color} height={size} viewBox="0 0 24 24" width={size}>
      <Path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </Svg>
  )
}

function goBack() {
  if (router.canGoBack()) router.back()
  else router.replace("/native")
}


/*
 * 실패한 서버 읽기는 캐시하지 않으므로 본문을 새 key로 다시 올리면 실패한 요청만 다시 보낸다.
 * 데이터 hook에 refetch가 생기면 이 key 대신 그것을 부른다.
 */
export default function ShopDetailScreen() {
  const [retryKey, setRetryKey] = useState(0)
  return <ShopDetailLoader key={retryKey} onRetry={() => setRetryKey((key) => key + 1)} />
}

function ShopDetailLoader({ onRetry }: { onRetry: () => void }) {
  const { shopId } = useLocalSearchParams<{ shopId?: string }>()
  const shopQuery = useShop(typeof shopId === "string" && shopId.length > 0 ? shopId : null)
  const shop = shopQuery.data as DetailShop | null

  if (!shop) {
    if (shopQuery.isLoading) {
      return (
        <Screen>
          <LoadingState fullScreen label="매장 정보를 불러오는 중…" />
        </Screen>
      )
    }
    // 서버에서 못 읽었으면 다시 불러오기, 없는 매장이면 지도에서 다시 찾기. 로컬 원장의 오류(저장소)는 다시 올려도 풀리지 않는다
    const retryable = Boolean(shopQuery.error) && isRemote("shops")
    return (
      <Screen>
        <Header backLabel="뒤로가기" onBack={goBack} title="매장 정보" />
        <EmptyState
          actionLabel={retryable ? "다시 불러오기" : "지도에서 다시 찾기"}
          description={shopQuery.error ? "잠시 후 다시 열어 주세요." : "삭제되었거나 잘못된 매장 링크일 수 있어요."}
          icon={<MapPin color={colors.textMuted} size={28} />}
          onAction={retryable ? onRetry : () => router.replace("/native/map")}
          style={styles.flex}
          title={shopQuery.error ? "매장 정보를 불러오지 못했어요" : "매장을 찾을 수 없어요"}
        />
      </Screen>
    )
  }

  return <ShopDetail key={shop.id} shop={shop} />
}

function ShopDetail({ shop }: { shop: DetailShop }) {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const compact = width < 360
  /*
   * 맛 지문은 처음부터 펼쳐 두지 않고, 카드의 오각형 부분이 화면 아래쪽에 들어오면 한 번 펼친다.
   * 하단 고정 바는 스크롤 영역 밖(형제)이라 스크롤 높이가 이미 바를 뺀 값이다. 따로 빼면 두 번 빠진다.
   */
  const [fingerprintPlay, setFingerprintPlay] = useState(false)
  const fingerprintTop = useRef<number | null>(null)
  const viewportHeight = useRef(0)
  const scrollY = useRef(0)
  const revealFingerprint = () => {
    if (fingerprintPlay || fingerprintTop.current === null || viewportHeight.current === 0) return
    if (scrollY.current + viewportHeight.current >= fingerprintTop.current + FINGERPRINT_REVEAL_DEPTH) setFingerprintPlay(true)
  }
  const { currentUser, actions, state, isShopBookmarked } = useRaota()
  const shopsQuery = useShops()
  const nearbyShops = shopsQuery.data as DetailShop[]
  const [hoursOpen, setHoursOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  /** 크게 보고 있는 사진과 그 자리를 닫을 때까지 보관한다. released: 흐려지며 닫는 중이라 원래 사진을 다시 보인다 */
  const [viewingPhoto, setViewingPhoto] = useState<{
    index: number
    origin: { x: number; y: number; width: number; height: number } | null
    released?: boolean
  } | null>(null)
  const [photoIndex, setPhotoIndex] = useState(0)
  const galleryRef = useRef<ScrollView>(null)
  const photoRefs = useRef<(View | null)[]>([])
  const reducedMotion = useReducedMotion()
  const heartScale = useSharedValue(1)
  const ringScale = useSharedValue(0.4)
  const ringOpacity = useSharedValue(0)
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heartScale.value }] }))
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }))
  /** 방금 띄운 알림이 저장 완료인지 구분한다. */
  const [toastSaved, setToastSaved] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const loggedIn = Boolean(currentUser?.isLoggedIn)
  const saved = loggedIn ? isShopBookmarked(shop) : false
  /** 찜 요청이 끝나기 전에 다시 누르면 무시한다. 스토어가 먼저 바꿔 두므로 화면은 바로 바뀐다 */
  const savePending = useRef(false)

  useEffect(() => {
    track("shop_viewed", { shopId: shop.id })
  }, [shop.id])

  // 영업시간은 서버·데모 모두 "요일: 시간" 문자열이라 한 곳(domain/hours)에서 읽고, 상태는 서울 시각으로 정한다
  const week = useMemo(() => parseOpeningHours(shop.openingHours), [shop.openingHours])
  const now = seoulTime()
  const todayShort = DAY_SHORT[now.day]
  const todayHours = week.find((entry) => entry.day === now.day)
  const todayBreaks = todayHours ? breaksOf(todayHours.ranges) : []
  const hasHours = week.length > 0
  const status = businessLabel(shop)
  // 영업 중인 매장은 영업시간으로 쉬는 시간·다음 여는 시각까지 알려 준다. 휴업·폐업이거나 오늘 시간을 모르면 원장 상태를 쓴다
  const hoursStatus = shop.businessStatus === "OPERATIONAL" ? hoursStatusAt(week, now) : null
  const liveStatus: LiveStatus = hoursStatus
    ? { ...statusText(hoursStatus), open: hoursStatus.kind === "open" }
    : { label: status.label, detail: null, open: status.open }
  const todayLine = !todayHours
    ? `오늘(${todayShort}) 영업시간 정보 없음`
    : todayHours.closed
      ? `오늘(${todayShort}) 휴무`
      : `오늘(${todayShort}) ${spanText(todayHours.ranges)}${todayBreaks.map((pause) => ` · 쉬는 시간 ${formatTime(pause.start)} – ${formatTime(pause.end)}`).join("")}`
  const photos = shop.photos.filter(Boolean)
  const perks = [
    { label: "면 리필", value: shop.servicePerks?.noodleRefill },
    { label: "공깃밥 리필", value: shop.servicePerks?.riceRefill },
    { label: "육수 추가", value: shop.servicePerks?.soupRefill },
    { label: "양념", value: shop.servicePerks?.condiments },
  ].filter((perk): perk is { label: string; value: string } => Boolean(perk.value))
  /** 가게별 맛 모음은 원장에 없으므로 이 화면에서 볼 수 있는 공개 라멘로그의 실제 평가만 모은다. */
  const shopTaste = useMemo(() => {
    const viewer = { userId: currentUser?.id ?? null, hiddenAuthorIds: state.hiddenAuthorIds, reports: state.contentReports }
    const publicLogs = shopsQuery.remote ? [] : state.logs.filter((log) => log.shop.id === shop.id && log.isPublic && isLogVisibleTo(log, viewer))
    return shopTasteSummaryOf(publicLogs)
  }, [currentUser?.id, shop.id, shopsQuery.remote, state.contentReports, state.hiddenAuthorIds, state.logs])
  /** 같은 종류의 실제 매장 두 곳. 도보 시간 데이터는 없으므로 시간은 추정하지 않는다. */
  const similarShops = useMemo(
    () => nearbyShops
      .filter((other) => Boolean(shop.style) && other.id !== shop.id && other.style === shop.style && other.photos[0])
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, 2),
    [nearbyShops, shop.id, shop.style],
  )

  const requireLogin = () => router.push("/auth/login")

  const toggleSave = async () => {
    if (!loggedIn) {
      requireLogin()
      return
    }
    if (savePending.current) return
    savePending.current = true
    const next = !saved
    const request = actions.toggleBookmark(shop)
    if (next && !reducedMotion) {
      // 같은 44pt 자리 안에서만 하트와 파문이 커져 옆 버튼을 밀지 않는다.
      heartScale.value = 1
      heartScale.value = withSequence(
        withTiming(1.3, { duration: 147, easing: SAVE_EASE }),
        withTiming(0.92, { duration: 126, easing: SAVE_EASE }),
        withTiming(1, { duration: 147, easing: SAVE_EASE }),
      )
      ringScale.value = 0.4
      ringOpacity.value = 0.5
      ringScale.value = withTiming(1.25, { duration: 450, easing: SAVE_EASE })
      ringOpacity.value = withTiming(0, { duration: 450, easing: SAVE_EASE })
    } else {
      // 저장 취소와 동작 줄이기는 남은 파문까지 즉시 끝낸다.
      cancelAnimation(heartScale)
      cancelAnimation(ringScale)
      cancelAnimation(ringOpacity)
      heartScale.value = 1
      ringOpacity.value = 0
    }
    if (next) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
    try {
      await request
      track("bookmark_toggled", { shopId: shop.id, saved: next })
      setToastSaved(next)
      setToast(next ? "가고 싶은 라멘집에 저장했어요" : "가고 싶어요에서 뺐어요")
    } catch (error) {
      // 스토어가 되돌려 두었으므로 하트 애니메이션만 정리하고 이유를 알린다
      cancelAnimation(heartScale)
      cancelAnimation(ringScale)
      cancelAnimation(ringOpacity)
      heartScale.value = 1
      ringOpacity.value = 0
      setToastSaved(false)
      setToast(error instanceof Error ? error.message : "찜을 바꾸지 못했어요. 다시 시도해 주세요.")
    } finally {
      savePending.current = false
    }
  }

  const startRecord = () => {
    if (!loggedIn) {
      requireLogin()
      return
    }
    track("record_started", { mode: "shop", source: "shop_detail" })
    router.push({ pathname: "/record/new", params: { shopId: shop.id } })
  }

  const openUrl = (url: string) => {
    void Linking.openURL(url).catch(() => {
      setToastSaved(false)
      setToast("링크를 열 수 없어요")
    })
  }

  /** 네이버 지도: 네이버 매장 ID가 있으면 매장 페이지를 바로, 없으면 앱 → 웹 순으로 이름 검색 */
  const openNaverMap = () => {
    const links = naverMapLinks(shop)
    if (!links.fallback) {
      openUrl(links.primary)
      return
    }
    const fallback = links.fallback
    void Linking.openURL(links.primary).catch(() => openUrl(fallback))
  }

  const shareShop = () => {
    const links = naverMapLinks(shop)
    void Share.share({ message: `${shop.name}${shop.branch ? ` ${shop.branch}` : ""}\n${links.fallback ?? links.primary}` }).catch(() => {
      setToastSaved(false)
      setToast("링크를 열 수 없어요")
    })
  }

  /**
   * 데이터가 있는 바로가기만 보여 준다. 지도에서 보기는 앱 탭으로, 주소 줄은 네이버 길찾기로 간다.
   * focus 값은 같은 가게를 다시 열어도 지도가 이동하게 한다.
   */
  const shortcuts = [
    shop.phone
      ? {
          key: "phone",
          label: "전화",
          hint: `${shop.phone}로 전화를 걸어요`,
          icon: <Phone color={colors.ink} size={20} />,
          onPress: () => openUrl(`tel:${shop.phone!.replace(/[^0-9+]/g, "")}`),
        }
      : null,
    {
      key: "map",
      label: "지도에서 보기",
      hint: "라오타 지도에서 이 가게 위치를 봐요",
      icon: <MapIcon color={colors.ink} size={20} />,
      // focus는 같은 가게로 다시 와도 지도가 다시 옮겨 가게 하려는 값이다(탭 파라미터가 같으면 효과가 돌지 않는다)
      onPress: () => router.navigate({ pathname: "/native/map", params: { shopId: shop.id, focus: String(Date.now()) } }),
    },
    shop.catchTableUrl
      ? {
          key: "catchtable",
          label: "캐치테이블",
          hint: "캐치테이블에서 예약·웨이팅을 해요",
          icon: <CalendarCheck color={colors.ink} size={20} />,
          onPress: () => openUrl(shop.catchTableUrl!),
        }
      : null,
    shop.instagramUrl
      ? {
          key: "instagram",
          label: "인스타그램",
          hint: "매장 인스타그램을 열어요",
          icon: <InstagramIcon color={colors.ink} size={20} />,
          onPress: () => openUrl(shop.instagramUrl!),
        }
      : null,
  ].filter((shortcut): shortcut is NonNullable<typeof shortcut> => shortcut !== null)


  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        onLayout={({ nativeEvent }) => {
          viewportHeight.current = nativeEvent.layout.height
          revealFingerprint()
        }}
        onScroll={({ nativeEvent }) => {
          scrollY.current = nativeEvent.contentOffset.y
          revealFingerprint()
        }}
        scrollEventThrottle={32}
        showsVerticalScrollIndicator={false}
      >
        {/* 사진은 큰 한 장씩 넘겨 볼 수 있고, 정보는 그 바로 아래에서 시작한다. */}
        <View style={[styles.hero, { width: width - 16, height: Math.min(360, width - 16), marginTop: insets.top + spacing.x4 }]}>
          {photos.length ? (
            <ScrollView
              accessibilityLabel={`${shop.name} 사진 ${photos.length}장`}
              horizontal
              onMomentumScrollEnd={({ nativeEvent }) => setPhotoIndex(Math.round(nativeEvent.contentOffset.x / Math.max(1, width - 16)))}
              pagingEnabled
              ref={galleryRef}
              scrollEnabled={photos.length > 1}
              showsHorizontalScrollIndicator={false}
            >
              {photos.map((photo, index) => (
                <Pressable
                  accessibilityHint="사진을 크게 봐요"
                  accessibilityRole="imagebutton"
                  collapsable={false}
                  key={`${photo}-${index}`}
                  onPress={() => {
                    const photoView = photoRefs.current[index]
                    if (!photoView) {
                      setViewingPhoto({ index, origin: null })
                      return
                    }
                    photoView.measureInWindow((x, y, measuredWidth, measuredHeight) => {
                      setViewingPhoto({
                        index,
                        origin: measuredWidth > 0 && measuredHeight > 0
                          ? { x, y, width: measuredWidth, height: measuredHeight }
                          : null,
                      })
                    })
                  }}
                  ref={(node) => { photoRefs.current[index] = node }}
                  // 커지는 사진이 원래 자리에 겹쳐 두 장으로 보이지 않게, 크게 보는 동안 원래 사진은 비운다.
                  // 동작 줄이기에선 줄어드는 전환이 없고, 흐려지며 닫힐 땐 그 뒤로 사진이 비쳐야 해서 비우지 않는다
                  style={viewingPhoto?.index === index && viewingPhoto.origin && !viewingPhoto.released && !reducedMotion ? styles.hiddenSource : undefined}
                >
                  <ResilientUriImage
                    accessibilityLabel={`${shop.name} 사진 ${index + 1}`}
                    fallback={<ImageOff color={colors.textMuted} size={28} />}
                    style={{ width: width - 16, height: "100%" }}
                    uri={photo}
                  />
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View accessibilityLabel="아직 등록된 사진이 없어요" accessibilityRole="image" style={styles.noPhoto}>
              <ImageOff color={colors.textMuted} size={28} />
              <AppText tone="muted" variant="secondary">아직 등록된 사진이 없어요</AppText>
            </View>
          )}
          <View pointerEvents="box-none" style={styles.heroControls}>
            <IconButton accessibilityLabel="뒤로가기" icon={<ChevronLeft color={colors.onPhotoPill} size={22} />} onImage onPress={goBack} />
          </View>
          {/* 여러 장이면 왼쪽 아래 썸네일로 바로 고른다. 사진 위라 고른 칸은 모드와 상관없이 흰 테두리 */}
          {photos.length > 1 ? (
            <View accessibilityLabel="매장 사진 선택" style={styles.thumbRow}>
              {photos.map((photo, index) => {
                const active = index === photoIndex
                return (
                  <Pressable
                    accessibilityLabel={`사진 ${index + 1}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    key={`${photo}-thumb-${index}`}
                    onPress={() => {
                      setPhotoIndex(index)
                      galleryRef.current?.scrollTo({ x: index * (width - 16), animated: true })
                    }}
                    style={[styles.thumb, active ? styles.thumbActive : styles.thumbIdle]}
                  >
                    <ResilientUriImage accessibilityLabel="" style={StyleSheet.absoluteFill} uri={photo} />
                  </Pressable>
                )
              })}
            </View>
          ) : null}
        </View>
        {viewingPhoto !== null ? (
          <PhotoViewer
            index={viewingPhoto.index}
            label={`${shop.name} 사진`}
            onClose={() => setViewingPhoto(null)}
            onFadeClose={() => setViewingPhoto((viewing) => viewing && { ...viewing, released: true })}
            // 크게 보며 넘긴 사진으로 원래 갤러리도 옮겨 두어, 닫을 때 같은 사진 자리로 줄어들게 한다
            onIndexChange={(next) => {
              galleryRef.current?.scrollTo({ x: next * (width - 16), animated: false })
              setPhotoIndex(next)
              setViewingPhoto((viewing) => viewing && { ...viewing, index: next })
            }}
            origin={viewingPhoto.origin}
            originRadius={radii.lg}
            photos={photos}
          />
        ) : null}

        <View style={styles.actions}>
          <IconButton
            accessibilityHint={loggedIn ? undefined : "로그인 화면으로 이동해요"}
            accessibilityLabel={saved ? "가고 싶어요 저장 취소" : "가고 싶어요에 저장"}
            accessibilityState={{ selected: saved }}
            icon={
              <View pointerEvents="none" style={styles.saveGlyph}>
                <Animated.View style={[styles.saveRing, ringStyle]} />
                <Animated.View style={heartStyle}>
                  <Heart color={colors.ink} fill={saved ? colors.ink : colors.transparent} size={22} />
                </Animated.View>
              </View>
            }
            onPress={toggleSave}
            style={styles.actionIcon}
          />
          <IconButton accessibilityLabel="공유" icon={<Share2 color={colors.ink} size={22} />} onPress={shareShop} style={styles.actionIcon} />
          <IconButton accessibilityLabel="더보기" icon={<Ellipsis color={colors.ink} size={22} />} onPress={() => setMoreOpen(true)} style={styles.actionIcon} />
        </View>

        <View style={styles.headline}>
          <AppText accessibilityRole="header" lineBreakStrategyIOS="hangul-word" variant="screenTitle">
            {shop.name}
            {shop.branch ? <AppText style={styles.branch} tone="muted" variant="screenTitle">{` ${shop.branch}`}</AppText> : null}
          </AppText>
          {shop.spec ? <AppText lineBreakStrategyIOS="hangul-word" style={styles.spec} tone="sub" variant="secondary">{shop.spec}</AppText> : null}
          <View style={styles.metaLine}>
            {shop.style ? (
              <AppText capScale tone="sub" variant="meta">{shop.style}</AppText>
            ) : null}
            <AppText capScale style={styles.metaText} tone="muted" variant="meta">
              {`${shop.style ? " · " : ""}${liveStatus.label}${shop.lastOrder ? ` · 라스트오더 ${shop.lastOrder}` : ""}${shop.distanceM > 0 ? ` · ${formatDistance(shop.distanceM)}` : ""}`}
            </AppText>
          </View>
        </View>

        {/* 소개 글은 원장의 AI 요약 또는 매장 설명을 그대로 쓴다.
            서버 매장 설명은 리뷰를 AI로 요약한 글이라(aiReviewSummary는 비어 온다) 늘 "AI가 요약했어요"를 붙인다.
            데모 원장의 설명은 사람이 쓴 글이라 AI 요약이 있을 때만 붙인다 */}
        {shop.aiSummary || shop.description ? (
          <View style={styles.intro}>
            <AppText accessibilityRole="header" style={styles.sectionTitle} variant="sectionTitle">가게 소개</AppText>
            <View style={styles.introCard} testID="shop-intro-card">
              {shop.aiSummary || isRemote("shops") ? (
                <View accessibilityLabel="AI가 요약했어요" accessible style={styles.aiLabel}>
                  <Sparkles color={colors.ink} size={16} />
                  <AppText capScale style={styles.aiLabelText} variant="meta">AI가 요약했어요</AppText>
                </View>
              ) : null}
              <AppText lineBreakStrategyIOS="hangul-word" style={styles.introText} variant="secondary">
                {shop.aiSummary?.text ?? shop.description}
              </AppText>
              {shop.aiSummary?.keywords?.length ? (
                <View style={styles.summaryKeywords}>
                  {shop.aiSummary.keywords.map((keyword) => (
                    <View key={keyword} style={styles.summaryKeyword}>
                      <AppText capScale style={styles.keywordText} variant="secondary">{`#${keyword}`}</AppText>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
        {shop.tags.length ? (
          <View accessibilityLabel={`특징: ${shop.tags.join(", ")}`} style={[styles.tags, !shop.aiSummary && !shop.description && styles.tagsStandalone]}>
            {shop.tags.map((tag) => <View key={tag} style={styles.keyword}><AppText capScale style={styles.keywordText} tone="muted" variant="secondary">{tag}</AppText></View>)}
          </View>
        ) : null}

        {/* 이 가게의 맛은 소개 아래에 둔다. 스크롤해서 화면에 들어오는 순간 떠오르게 위치를 잰다 */}
        {shopTaste ? (
          <View
            onLayout={({ nativeEvent }) => {
              fingerprintTop.current = nativeEvent.layout.y
              revealFingerprint()
            }}
            style={styles.fingerprint}
          >
            <ShopTasteCard play={fingerprintPlay} summary={shopTaste} />
          </View>
        ) : null}

        {/* 바로가기는 실제 링크가 있는 항목만 나타낸다. */}
        <View style={styles.shortcuts}>
          {shortcuts.map((shortcut) => (
            <Pressable
              accessibilityHint={shortcut.hint}
              accessibilityLabel={shortcut.label}
              accessibilityRole="link"
              key={shortcut.key}
              onPress={shortcut.onPress}
              style={({ pressed }) => [styles.shortcut, pressed && styles.shortcutPressed]}
            >
              <View style={styles.shortcutIcon}>{shortcut.icon}</View>
              <AppText capScale numberOfLines={1} style={styles.bold} variant="meta">
                {shortcut.label}
              </AppText>
            </Pressable>
          ))}
        </View>

        {/* 매장 혜택은 라벨과 내용이 한 줄씩 이어지는 목록이다. */}
        {perks.length ? (
          <View style={styles.section}>
            <AppText accessibilityRole="header" variant="sectionTitle">
              매장 혜택
            </AppText>
            {perks.map((perk) => (
              <View
                accessible
                accessibilityLabel={`${perk.label}, ${perk.value}`}
                key={perk.label}
                style={styles.perkRow}
              >
                <AppText capScale style={styles.perkLabel} tone="sub" variant="secondary">
                  {perk.label}
                </AppText>
                <AppText lineBreakStrategyIOS="hangul-word" style={styles.perkValue} tone="sub" variant="secondary">
                  {perk.value}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}

        {/* 주소와 영업시간은 흰 화면의 정보 줄로 두고, 영업시간만 눌러 펼친다. */}
        <View style={styles.info}>
          <AppText accessibilityRole="header" variant="sectionTitle">
            가게 상세 정보
          </AppText>
          {shop.address ? (
            <Pressable
              accessibilityHint="네이버 지도에서 위치와 길찾기를 열어요"
              accessibilityLabel={`주소, ${shop.address}`}
              accessibilityRole="link"
              onPress={openNaverMap}
              style={({ pressed }) => [styles.infoRow, pressed && styles.infoPressed]}
            >
              <AppText style={styles.infoKey} tone="muted" variant="secondary">주소</AppText>
              <View style={styles.infoValue}>
                <AppText lineBreakStrategyIOS="hangul-word" style={styles.infoText} variant="secondary">{shop.address}</AppText>
                <View style={styles.naverHint}>
                  <MapIcon color={colors.ink} size={14} />
                  <AppText capScale style={styles.naverText} variant="secondary">네이버 지도에서 길찾기</AppText>
                </View>
              </View>
            </Pressable>
          ) : (
            <View style={styles.infoRow}>
              <AppText style={styles.infoKey} tone="muted" variant="secondary">주소</AppText>
              <AppText style={styles.infoValue} tone="muted" variant="body">주소 정보가 아직 없어요</AppText>
            </View>
          )}
          {hasHours ? (
            <Pressable
              accessibilityHint="요일별 영업시간을 시트로 열어요"
              accessibilityLabel={`영업시간, ${liveStatus.label}${liveStatus.detail ? `, ${liveStatus.detail}` : ""}. ${todayLine}`}
              accessibilityRole="button"
              accessibilityState={{ expanded: hoursOpen }}
              onPress={() => setHoursOpen(true)}
              style={({ pressed }) => [styles.infoRow, pressed && styles.infoPressed]}
            >
              <AppText style={styles.infoKey} tone="muted" variant="secondary">영업시간</AppText>
              <View style={styles.infoValue}>
                <HoursStatusLine status={liveStatus} />
                <AppText capScale lineBreakStrategyIOS="hangul-word" style={[styles.hoursToday, styles.tabular]} tone="muted" variant="meta">{todayLine}</AppText>
              </View>
              <View style={styles.hoursChevron}>
                <ChevronRight color={colors.textMuted} size={16} />
              </View>
            </Pressable>
          ) : (
            <View style={styles.infoRow}>
              <AppText style={styles.infoKey} tone="muted" variant="secondary">영업시간</AppText>
              <AppText style={styles.infoValue} tone="muted" variant="body">영업시간 정보가 아직 없어요</AppText>
            </View>
          )}
          {shop.lastOrder ? (
            <View style={styles.infoRow}>
              <AppText style={styles.infoKey} tone="muted" variant="secondary">라스트오더</AppText>
              <AppText style={[styles.infoValue, styles.infoText]} variant="secondary">{shop.lastOrder}</AppText>
            </View>
          ) : null}
          {shop.priceRange ? (
            <View style={styles.infoRow}>
              <AppText style={styles.infoKey} tone="muted" variant="secondary">가격대</AppText>
              <AppText style={[styles.infoValue, styles.infoText]} variant="secondary">{shop.priceRange}</AppText>
            </View>
          ) : null}
          {shop.phone ? (
            <Pressable
              accessibilityHint="전화를 걸어요"
              accessibilityLabel={`전화번호, ${shop.phone}`}
              accessibilityRole="link"
              onPress={() => openUrl(`tel:${shop.phone!.replace(/[^0-9+]/g, "")}`)}
              style={({ pressed }) => [styles.infoRow, pressed && styles.infoPressed]}
            >
              <AppText style={styles.infoKey} tone="muted" variant="secondary">전화번호</AppText>
              <View style={[styles.infoValue, styles.phone]}>
                <AppText style={styles.infoText} variant="secondary">{shop.phone}</AppText>
              </View>
            </Pressable>
          ) : null}
        </View>
        {similarShops.length ? (
          <View style={styles.similar}>
            <View style={styles.similarHead}>
              <AppText accessibilityRole="header" variant="sectionTitle">비슷한 한 그릇</AppText>
              <AppText capScale tone="muted" variant="meta">{`${shop.style} · 가까운 가게`}</AppText>
            </View>
            <View style={styles.similarCards}>
              {similarShops.map((other) => (
                <Pressable
                  accessibilityLabel={`${other.name}${other.branch ? ` ${other.branch}` : ""}, 매장 상세 보기`}
                  accessibilityRole="button"
                  key={other.id}
                  onPress={() => router.push({ pathname: "/shop/[shopId]", params: { shopId: other.id } })}
                  style={styles.similarCard}
                >
                  <View style={[styles.similarPhoto, { height: 220 }]}>
                    <ResilientUriImage accessibilityLabel="" style={StyleSheet.absoluteFill} uri={other.photos[0]} />
                    {other.style ? (
                      <View style={styles.similarPill}>
                        <AppText capScale style={styles.similarPillText} variant="meta">{other.style}</AppText>
                      </View>
                    ) : null}
                  </View>
                  <AppText numberOfLines={2} style={styles.similarTitle} variant="secondary">
                    {other.name}{other.branch ? ` ${other.branch}` : ""}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

      </ScrollView>
      <View pointerEvents="none" style={[styles.statusCap, { height: insets.top }]} testID="shop-status-cap" />


      {/* 하단 고정: 가고 싶어요 / 먹은 라멘 기록하기. 웹과 같은 좌우 16, SE 폭에서도 문구를 자르지 않는다 */}
      <StickyActionBar style={styles.stickyBar}>
        <Button
          accessibilityHint={loggedIn ? undefined : "로그인 화면으로 이동해요"}
          accessibilityLabel={saved ? "저장됨, 가고 싶어요 취소" : "가고 싶어요"}
          fullWidth
          leftIcon={
            compact ? undefined : (
              <Heart color={colors.ink} fill={saved ? colors.ink : colors.transparent} size={18} />
            )
          }
          onPress={toggleSave}
          style={styles.stickyButton}
          title={saved ? "저장됨" : "가고 싶어요"}
          variant="secondary"
        />
        <Button
          accessibilityHint={loggedIn ? undefined : "로그인 화면으로 이동해요"}
          fullWidth
          onPress={startRecord}
          style={[styles.stickyButton, styles.stickyPrimary]}
          title="먹은 라멘 기록하기"
        />
      </StickyActionBar>
      <BottomSheet onClose={() => setMoreOpen(false)} title="더보기" visible={moreOpen}>
        <View style={styles.moreOptions}>
          {shop.address ? (
            <Button onPress={() => { setMoreOpen(false); openNaverMap() }} title="네이버 지도에서 길찾기" variant="ghost" />
          ) : null}
          {shop.phone ? (
            <Button onPress={() => { setMoreOpen(false); openUrl(`tel:${shop.phone!.replace(/[^0-9+]/g, "")}`) }} title="전화" variant="ghost" />
          ) : null}
          <Button onPress={() => { setMoreOpen(false); shareShop() }} title="공유" variant="ghost" />
        </View>
      </BottomSheet>
      {hoursOpen ? (
        <Modal animationType="slide" onRequestClose={() => setHoursOpen(false)} statusBarTranslucent transparent visible>
          <View style={styles.hoursOverlay}>
            <Pressable accessibilityLabel="영업시간 닫기" accessibilityRole="button" onPress={() => setHoursOpen(false)} style={StyleSheet.absoluteFill} />
            <View accessibilityViewIsModal style={[styles.hoursSheet, { paddingBottom: Math.max(insets.bottom, spacing.x8) }]}>
              <View style={styles.hoursHandle} />
              <View style={styles.hoursHead}>
                <View style={styles.flex}>
                  <AppText accessibilityRole="header" variant="screenTitle">영업시간</AppText>
                  <AppText capScale style={[styles.hoursStatus, styles.flexShrink]} tone="muted" variant="meta">
                    {`${shop.name}${shop.branch ? ` ${shop.branch}` : ""}`}
                  </AppText>
                </View>
                <IconButton accessibilityLabel="닫기" icon={<X color={colors.ink} size={20} />} onPress={() => setHoursOpen(false)} />
              </View>
              <ScrollView contentContainerStyle={styles.hoursBody} showsVerticalScrollIndicator={false}>
                <View style={styles.sheetNow}>
                  <HoursStatusLine large status={liveStatus} />
                  {todayHours && !todayHours.closed ? <TodayTimeline hours={todayHours} nowMinute={now.minute} /> : null}
                </View>
                <View style={styles.hoursWeek}>
                  {groupWeek(week).map((group, index) => {
                    const isToday = group.days.includes(now.day)
                    const pauses = breaksOf(group.ranges)
                    const timeText = group.closed ? "휴무" : spanText(group.ranges)
                    return (
                      <View
                        accessibilityLabel={`${group.label}${isToday ? ", 오늘" : ""}, ${timeText}${pauses.map((pause) => `, 쉬는 시간 ${formatTime(pause.start)}부터 ${formatTime(pause.end)}까지`).join("")}`}
                        accessible
                        key={group.label}
                        style={[styles.hourRow, index > 0 && styles.hourDivider]}
                        testID="shop-hours-row"
                      >
                        <View style={styles.hourDay}>
                          <AppText style={[styles.hourText, isToday && styles.bold]} tone={isToday ? "ink" : "sub"} variant="secondary">{group.label}</AppText>
                          {isToday ? <AppText capScale style={styles.todayChip} variant="meta">오늘</AppText> : null}
                        </View>
                        <View style={styles.hourTimes}>
                          <AppText style={[styles.hourText, styles.tabular, isToday && styles.bold]} tone={group.closed ? "muted" : isToday ? "ink" : "sub"} variant="secondary">
                            {timeText}
                          </AppText>
                          {pauses.map((pause) => (
                            <AppText capScale key={pause.start} style={styles.tabular} tone="muted" variant="meta">
                              {`쉬는 시간 ${formatTime(pause.start)} – ${formatTime(pause.end)}`}
                            </AppText>
                          ))}
                        </View>
                      </View>
                    )
                  })}
                </View>
                {shop.lastOrder ? (
                  <AppText capScale style={styles.hoursNote} tone="muted" variant="meta">{`오늘 라스트오더 ${shop.lastOrder}`}</AppText>
                ) : null}
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
      <Toast
        icon={toastSaved ? <Heart color={colors.onDark} fill={colors.onDark} size={18} /> : undefined}
        message={toast ?? ""}
        onDismiss={() => setToast(null)}
        style={{ bottom: TOAST_OFFSET + insets.bottom }}
        visible={toast !== null}
      />
      <EdgeBackZone />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  statusCap: { position: "absolute", top: 0, left: 0, right: 0, backgroundColor: colors.paper },
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1, minWidth: 0 },
  bold: { fontWeight: "700" },
  scrollContent: { paddingBottom: spacing.section },
  hero: {
    marginHorizontal: spacing.x2,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: colors.canvasSoft,
  },
  noPhoto: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.x2 },
  heroControls: { position: "absolute", left: spacing.x3_5, top: spacing.x3_5 },
  thumbRow: { position: "absolute", left: spacing.x3_5, bottom: spacing.x3_5, flexDirection: "row", gap: spacing.x2 },
  // 48pt 썸네일, 12pt 모서리 + 2pt 선. 고른 사진만 흰 선, 나머지는 살짝 흐리게
  thumb: { width: 48, height: 48, borderRadius: 12, borderWidth: 2, overflow: "hidden", backgroundColor: colors.canvasSoft },
  thumbActive: { borderColor: colors.white },
  thumbIdle: { borderColor: colors.transparent, opacity: 0.75 },
  hiddenSource: { opacity: 0 },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.x1, paddingHorizontal: spacing.x4, paddingTop: spacing.x3 },
  actionIcon: { backgroundColor: colors.transparent },
  saveGlyph: { width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center" },
  saveRing: { position: "absolute", width: touchTarget, height: touchTarget, borderRadius: radii.pill, borderWidth: 2, borderColor: colors.ink },
  headline: { paddingHorizontal: spacing.gutter, paddingTop: spacing.x1_5 },
  branch: { fontSize: 18, fontWeight: "400" },
  spec: { marginTop: spacing.x1 },
  metaLine: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", marginTop: spacing.x1 },
  metaText: { flexShrink: 1 },
  fingerprint: { marginHorizontal: spacing.gutter, marginTop: spacing.section },

  intro: { marginHorizontal: spacing.gutter, marginTop: spacing.section },
  introCard: { padding: spacing.x4, borderRadius: radii.sm, backgroundColor: colors.canvasSoft },
  aiLabel: { flexDirection: "row", alignItems: "center", gap: spacing.x1_5, marginBottom: spacing.x3 },
  aiLabelText: { fontWeight: "700" },
  introText: { lineHeight: 20 },
  summaryKeywords: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x1_5, marginTop: spacing.x3 },
  summaryKeyword: { minHeight: 28, justifyContent: "center", paddingHorizontal: spacing.x3, borderRadius: radii.pill, backgroundColor: colors.canvas },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x1_5, marginHorizontal: spacing.gutter, marginTop: spacing.x3 },
  tagsStandalone: { marginTop: spacing.section },
  keyword: { minHeight: 28, justifyContent: "center", paddingHorizontal: spacing.x3, borderRadius: radii.pill, backgroundColor: colors.canvasSoft },
  keywordText: { fontSize: 13, lineHeight: 18, fontWeight: "600" },

  shortcuts: { flexDirection: "row", paddingHorizontal: spacing.x2, marginTop: spacing.section },
  shortcut: { width: "25%", minHeight: 64, alignItems: "center", justifyContent: "center", gap: spacing.x1 },
  shortcutIcon: {
    width: touchTarget,
    height: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    backgroundColor: colors.canvasSoft,
  },
  shortcutPressed: { backgroundColor: colors.surfacePressed, borderRadius: radii.sm },
  section: { paddingHorizontal: spacing.gutter, marginTop: spacing.section },
  sectionTitle: { marginBottom: spacing.x3 },
  perkRow: { flexDirection: "row", gap: spacing.x2, paddingVertical: spacing.x3 },
  perkLabel: { width: 88, flexShrink: 0, fontWeight: "700" },
  perkValue: { flex: 1 },
  info: { marginHorizontal: spacing.gutter, marginTop: spacing.section },
  infoRow: {
    minHeight: touchTarget,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.x2,
    paddingVertical: spacing.x3,
    borderTopWidth: line.hair,
    borderTopColor: colors.border,
  },
  infoPressed: { backgroundColor: colors.surfacePressed },
  infoKey: { width: 64, flexShrink: 0, fontSize: 13, lineHeight: 20 },
  infoText: { fontWeight: "500", lineHeight: 20 },
  infoValue: { flex: 1, minWidth: 0 },
  naverHint: { flexDirection: "row", alignItems: "center", gap: spacing.x1, marginTop: spacing.x3 },
  naverText: { fontSize: 13, lineHeight: 18, fontWeight: "700" },
  hoursToday: { marginTop: spacing.x1 },
  hoursChevron: { paddingTop: 2 },
  statusLine: { flexDirection: "row", alignItems: "center", gap: spacing.x1_5 },
  statusDot: { width: 8, height: 8, borderRadius: radii.pill },
  tabular: { fontVariant: ["tabular-nums"] },
  phone: { flexDirection: "row", alignItems: "center" },

  similar: { marginTop: spacing.section },
  similarHead: { paddingHorizontal: spacing.gutter, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.x2 },
  similarCards: { flexDirection: "row", gap: spacing.x2, paddingHorizontal: spacing.gutter, marginTop: spacing.x3 },
  similarCard: { flex: 1, minWidth: 0, gap: spacing.x1_5 },
  similarPhoto: { position: "relative", borderRadius: radii.sm, overflow: "hidden", backgroundColor: colors.canvasSoft },
  similarPill: { position: "absolute", top: spacing.x2, left: spacing.x2, paddingVertical: spacing.x1_5, paddingHorizontal: spacing.x2_5, borderRadius: radii.pill, backgroundColor: colors.photoPill },
  similarPillText: { fontWeight: "700", color: colors.onPhotoPill },
  similarTitle: { fontWeight: "600", paddingHorizontal: spacing.x1 },

  hoursOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: colors.overlay },
  hoursSheet: { maxHeight: "90%", paddingTop: spacing.x2_5, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, backgroundColor: colors.canvas },
  hoursHandle: { alignSelf: "center", width: 36, height: 5, borderRadius: radii.pill, backgroundColor: colors.secondaryPressed },
  hoursHead: { flexDirection: "row", alignItems: "center", gap: spacing.x3, paddingLeft: spacing.x5, paddingRight: spacing.x4, paddingTop: spacing.x3, paddingBottom: spacing.x2 },
  hoursStatus: { marginTop: spacing.x1 },
  hoursBody: { paddingHorizontal: spacing.x5 },
  sheetNow: { paddingTop: spacing.x2, paddingBottom: spacing.x5 },
  timeline: { marginTop: spacing.x4 },
  timelineTrack: { height: 8, borderRadius: radii.pill, backgroundColor: colors.border },
  timelineOpen: { position: "absolute", top: 0, bottom: 0, borderRadius: radii.pill, backgroundColor: colors.ink },
  timelineNow: { position: "absolute", top: -3, width: 14, height: 14, marginLeft: -7, borderRadius: radii.pill, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.canvas },
  timelineLabels: { flexDirection: "row", justifyContent: "space-between", gap: spacing.x2, marginTop: spacing.x2 },
  hoursWeek: { borderTopWidth: line.hair, borderTopColor: colors.border },
  hourRow: { minHeight: 48, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.x3, paddingVertical: spacing.x3 },
  hourDivider: { borderTopWidth: line.hair, borderTopColor: colors.border },
  hourDay: { flexDirection: "row", alignItems: "center", gap: spacing.x2 },
  hourText: { fontSize: 15, lineHeight: 20, fontWeight: "500" },
  hourTimes: { flexShrink: 1, alignItems: "flex-end", gap: spacing.x0_5 },
  todayChip: { paddingHorizontal: spacing.x2, paddingVertical: spacing.x0_5, borderRadius: radii.pill, backgroundColor: colors.selected, color: colors.onSelected, fontWeight: "700" },
  hoursNote: { paddingTop: spacing.x3 },

  moreOptions: { gap: spacing.x1, paddingBottom: spacing.x3 },
  stickyBar: { paddingHorizontal: spacing.x4 },
  stickyButton: { paddingHorizontal: spacing.x3 },
  stickyPrimary: { flex: 1.5 },
})
