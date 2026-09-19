import * as Haptics from "expo-haptics"
import { router, useLocalSearchParams } from "expo-router"
import { Bookmark, CalendarCheck, ChevronDown, ChevronLeft, ImageOff, Map as MapIcon, MapPin, PenLine, Phone, Store } from "lucide-react-native"
import { useEffect, useRef, useState } from "react"
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Svg, { Path } from "react-native-svg"

import type { Shop, ShopCatalogItem } from "@raota/shared"
import { track } from "@/src/analytics"
import { ResilientUriImage } from "@/src/components/ResilientUriImage"
import { AppText, Button, EmptyState, Header, IconButton, LoadingState, Screen, StickyActionBar, Toast } from "@/src/components/ui"
import { useBookmarkedShops, useMyLogs, useShop } from "@/src/data/hooks"
import { useRaota } from "@/src/state/RaotaStore"
import { colors, radii, spacing, touchTarget } from "@/src/theme"

const DAY_NAMES = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"]
const DAY_SHORT = ["일", "월", "화", "수", "목", "금", "토"]
/** 하단 고정 바 높이(버튼 48 + 위아래 여백)만큼 토스트를 띄운다 */
const TOAST_OFFSET = 88

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

/** 네이버 지도 앱에 넘기는 호출 앱 이름(번들 ID) */
const NAVER_APP_NAME = "com.raota.app"

/**
 * 네이버 지도 매장 페이지. 사진·메뉴·리뷰는 앱에 저장하지 않고 네이버 지도로 넘긴다.
 * 앱이 있으면 앱(nmap://)으로, 없으면 웹으로 연다. 매장 URL이 아직 연결되지 않은 매장은 이름으로 검색한다.
 */
function naverMapLinks(shop: Shop) {
  const query = encodeURIComponent(`${shop.name}${shop.branch ? ` ${shop.branch}` : ""}`)
  return {
    app: `nmap://search?query=${query}&appname=${NAVER_APP_NAME}`,
    web: shop.naverPlaceUrl ?? `https://map.naver.com/p/search/${query}`,
  }
}

function InstagramIcon({ color, size = 16 }: { color: string; size?: number }) {
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

/** 차콜 면 안의 1pt 구분선. 흰색 15%를 토큰(onDark) + 투명도로 만든다 */
function DarkDivider() {
  return <View style={styles.darkDivider} />
}

export default function ShopDetailScreen() {
  const { shopId } = useLocalSearchParams<{ shopId: string }>()
  const id = Number(shopId)
  const shopQuery = useShop(Number.isFinite(id) ? id : null)
  const shop = shopQuery.data as DetailShop | null

  if (!shop) {
    if (shopQuery.isLoading) {
      return (
        <Screen>
          <LoadingState fullScreen label="매장 정보를 불러오는 중…" />
        </Screen>
      )
    }
    return (
      <Screen>
        <Header backLabel="뒤로가기" onBack={goBack} title="매장 정보" />
        <EmptyState
          actionLabel="지도에서 다시 찾기"
          description="삭제되었거나 잘못된 매장 링크일 수 있어요."
          icon={<MapPin color={colors.textMuted} size={28} />}
          onAction={() => router.replace("/native/map")}
          style={styles.flex}
          title="매장을 찾을 수 없어요"
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
  const { currentUser, actions } = useRaota()
  const bookmarked = useBookmarkedShops()
  const myLogs = useMyLogs()
  const galleryRef = useRef<ScrollView>(null)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [hoursOpen, setHoursOpen] = useState(false)
  /** 방금 띄운 알림이 "저장했어요"인지(빨간 저장 표시를 붙인다) */
  const [toastSaved, setToastSaved] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const loggedIn = Boolean(currentUser?.isLoggedIn)
  const saved = loggedIn && bookmarked.data.some((item) => item.id === shop.id)

  useEffect(() => {
    track("shop_viewed", { shopId: shop.id })
  }, [shop.id])

  const dayIndex = new Date().getDay()
  const todayName = DAY_NAMES[dayIndex]
  const todayShort = DAY_SHORT[dayIndex]
  const hasHours = shop.openingHours.length > 0
  const todayEntry = shop.openingHours.find((entry) => entry.startsWith(todayName))
  const todayTime = (todayEntry ?? shop.openingHours[0])?.replace(/^.*?: /, "")

  const status = businessLabel(shop)
  const photos = shop.photos.filter(Boolean)
  const perks = [
    { label: "면 리필", value: shop.servicePerks?.noodleRefill },
    { label: "공깃밥 리필", value: shop.servicePerks?.riceRefill },
    { label: "육수 추가", value: shop.servicePerks?.soupRefill },
    { label: "양념", value: shop.servicePerks?.condiments },
  ].filter((perk): perk is { label: string; value: string } => Boolean(perk.value))
  const metaParts = [
    shop.distanceM > 0 ? formatDistance(shop.distanceM) : null,
    shop.reviewCount > 0 ? `라멘로그 ${shop.reviewCount.toLocaleString()}개` : null,
    shop.rating > 0 ? `★ ${shop.rating.toFixed(1)}` : null,
  ].filter((part): part is string => Boolean(part))

  /** 공개 피드 API는 MVP 밖이라 이 매장의 내 기록만 보여준다(최신순) */
  const shopLogs = myLogs.data.filter((log) => log.shop.id === shop.id)

  const requireLogin = () => router.push("/auth/login")

  const toggleSave = () => {
    if (!loggedIn) {
      requireLogin()
      return
    }
    const next = !saved
    actions.toggleBookmark(shop.id)
    track("bookmark_toggled", { shopId: shop.id, saved: next })
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
    setToastSaved(next)
    setToast(next ? "가고 싶은 라멘집에 저장했어요" : "가고 싶어요에서 뺐어요")
  }

  const startRecord = () => {
    if (!loggedIn) {
      requireLogin()
      return
    }
    track("record_started", { mode: "shop", source: "shop_detail" })
    router.push({ pathname: "/record/new", params: { shopId: String(shop.id) } })
  }

  const openUrl = (url: string) => {
    void Linking.openURL(url).catch(() => {
      setToastSaved(false)
      setToast("링크를 열 수 없어요")
    })
  }

  /** 네이버 지도(사진·메뉴·길찾기). 매장 URL이 있으면 그 페이지, 없으면 앱 → 웹 순으로 검색을 연다 */
  const openNaverMap = () => {
    const links = naverMapLinks(shop)
    if (shop.naverPlaceUrl) {
      openUrl(links.web)
      return
    }
    void Linking.openURL(links.app).catch(() => openUrl(links.web))
  }

  /** 매장 바로가기: 데이터가 있는 것만 보여준다(전화번호·예약·인스타그램이 없는 매장은 네이버 지도만) */
  const quickActions = [
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
      key: "naver",
      label: "네이버 지도",
      hint: "네이버 지도에서 사진·메뉴·길찾기를 봐요",
      icon: <MapIcon color={colors.ink} size={20} />,
      onPress: openNaverMap,
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
  ].filter((action): action is NonNullable<typeof action> => action !== null)

  const selectPhoto = (index: number) => {
    setPhotoIndex(index)
    galleryRef.current?.scrollTo({ x: index * width, animated: true })
  }

  const onGalleryEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPhotoIndex(Math.round(event.nativeEvent.contentOffset.x / width))
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 1. 대표 사진. 없거나 불러오는 중이면 같은 자리를 비워 둔다 */}
        <View style={[styles.hero, { width }]}>
          {photos.length ? (
            <ScrollView
              accessibilityLabel={`${shop.name} 사진 ${photos.length}장`}
              horizontal
              onMomentumScrollEnd={onGalleryEnd}
              pagingEnabled
              ref={galleryRef}
              scrollEnabled={photos.length > 1}
              showsHorizontalScrollIndicator={false}
            >
              {photos.map((photo, index) => (
                <ResilientUriImage
                  accessibilityLabel={`${shop.name} 사진 ${index + 1}`}
                  fallback={<ImageOff color={colors.textMuted} size={28} />}
                  key={`${photo}-${index}`}
                  style={{ width, height: "100%" }}
                  uri={photo}
                />
              ))}
            </ScrollView>
          ) : (
            <View accessibilityLabel="아직 등록된 사진이 없어요" accessibilityRole="image" style={styles.noPhoto}>
              <ImageOff color={colors.textMuted} size={28} />
              <AppText tone="muted" variant="secondary">
                아직 등록된 사진이 없어요
              </AppText>
            </View>
          )}

          <View pointerEvents="box-none" style={[styles.heroControls, { top: insets.top + spacing.x2 }]}>
            <IconButton
              accessibilityLabel="뒤로가기"
              icon={<ChevronLeft color={colors.onDark} size={22} />}
              onImage
              onPress={goBack}
            />
            <IconButton
              accessibilityHint={loggedIn ? undefined : "로그인 화면으로 이동해요"}
              accessibilityLabel={saved ? "가고 싶어요 저장 취소" : "가고 싶어요에 저장"}
              accessibilityState={{ selected: saved }}
              icon={<Bookmark color={saved ? colors.brand : colors.onDark} fill={saved ? colors.brand : "transparent"} size={20} />}
              onImage
              onPress={toggleSave}
            />
          </View>

          {photos.length > 1 ? (
            <ScrollView
              accessibilityLabel="매장 사진 선택"
              contentContainerStyle={styles.thumbRow}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.thumbStrip}
            >
              {photos.map((photo, index) => {
                const active = index === photoIndex
                return (
                  <Pressable
                    accessibilityLabel={`사진 ${index + 1}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    key={`${photo}-thumb-${index}`}
                    onPress={() => selectPhoto(index)}
                    style={[styles.thumb, active ? styles.thumbActive : styles.thumbIdle]}
                  >
                    <ResilientUriImage accessibilityLabel="" style={StyleSheet.absoluteFill} uri={photo} />
                  </Pressable>
                )
              })}
            </ScrollView>
          ) : null}
        </View>

        {/* 2. 매장 헤드라인 */}
        <View style={styles.headline}>
          <View style={styles.metaLine}>
            <AppText capScale style={styles.bold} tone={status.open ? "positive" : "muted"} variant="meta">
              {`● ${status.label}`}
            </AppText>
            {metaParts.map((part) => (
              <View key={part} style={styles.metaPart}>
                <AppText capScale style={styles.dot} variant="meta">
                  ·
                </AppText>
                <AppText capScale style={styles.bold} tone="muted" variant="meta">
                  {part}
                </AppText>
              </View>
            ))}
          </View>

          {shop.style ? (
            <AppText style={[styles.bold, styles.styleLine]} tone="muted" variant="secondary">
              {shop.style}
            </AppText>
          ) : null}
          <AppText accessibilityRole="header" style={styles.name} variant="screenTitle">
            {shop.name}
            {shop.branch ? (
              <AppText style={styles.bold} tone="muted" variant="screenTitle">
                {` · ${shop.branch}`}
              </AppText>
            ) : null}
          </AppText>
          {shop.spec ? (
            <AppText style={styles.spec} variant="body">
              {shop.spec}
            </AppText>
          ) : null}
          {shop.address ? (
            <AppText style={styles.address} tone="muted" variant="secondary">
              {shop.address}
            </AppText>
          ) : null}

          {shop.tags.length ? (
            <View accessibilityLabel={`특징: ${shop.tags.join(", ")}`} style={styles.tags}>
              {shop.tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <AppText capScale style={styles.bold} variant="meta">
                    {tag}
                  </AppText>
                </View>
              ))}
            </View>
          ) : null}

          {/* 매장 바로가기: 전화 · 네이버 지도 · 캐치테이블 · 인스타그램 */}
          <View style={styles.quickActions}>
            {quickActions.map((action) => (
              <Pressable
                accessibilityHint={action.hint}
                accessibilityLabel={action.label}
                accessibilityRole="link"
                key={action.key}
                onPress={action.onPress}
                style={({ pressed }) => [styles.quickAction, pressed && styles.quickPressed]}
              >
                {action.icon}
                {/* 좁은 화면(SE)에서는 "네이버 / 지도"처럼 두 줄로 접힌다 */}
                <AppText capScale lineBreakStrategyIOS="hangul-word" numberOfLines={2} style={[styles.bold, styles.center]} variant="meta">
                  {action.label}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>

        {/* 3. 가게 소개 */}
        {shop.description ? (
          <View style={styles.intro}>
            <View style={styles.introHead}>
              <Store color={colors.ink} size={16} />
              <AppText accessibilityRole="header" style={styles.bold} variant="secondary">
                가게 소개
              </AppText>
            </View>
            <AppText variant="body">{shop.description}</AppText>
          </View>
        ) : null}

        {/* 4. 매장 혜택 */}
        {perks.length ? (
          <View style={styles.section}>
            <AppText accessibilityRole="header" style={styles.sectionTitle} variant="sectionTitle">
              매장 혜택
            </AppText>
            <View style={styles.perkGrid}>
              {perks.map((perk) => (
                <View accessible accessibilityLabel={`${perk.label}, ${perk.value}`} key={perk.label} style={styles.perk}>
                  <AppText capScale style={styles.bold} tone="muted" variant="meta">
                    {perk.label}
                  </AppText>
                  <AppText style={[styles.bold, styles.perkValue]} variant="secondary">
                    {perk.value}
                  </AppText>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* 5. 가게 상세 정보 (차콜) */}
        <View style={styles.dark}>
          <AppText accessibilityRole="header" style={styles.darkTitle} tone="onDark" variant="sectionTitle">
            가게 상세 정보
          </AppText>

          {shop.address ? (
            <Pressable
              accessibilityHint="네이버 지도에서 위치를 열어요"
              accessibilityLabel={`주소, ${shop.address}`}
              accessibilityRole="link"
              onPress={openNaverMap}
              style={({ pressed }) => [styles.darkRow, pressed && styles.darkPressed]}
            >
              <AppText style={styles.darkKey} tone="onDarkMuted" variant="body">
                주소
              </AppText>
              <AppText style={styles.darkValue} tone="onDark" variant="body">
                {shop.address}
              </AppText>
            </Pressable>
          ) : (
            <View style={styles.darkRow}>
              <AppText style={styles.darkKey} tone="onDarkMuted" variant="body">
                주소
              </AppText>
              <AppText style={styles.darkValue} tone="onDarkMuted" variant="body">
                주소 정보가 아직 없어요
              </AppText>
            </View>
          )}
          <DarkDivider />

          {hasHours ? (
            <>
              <Pressable
                accessibilityHint={hoursOpen ? "요일별 영업시간을 접어요" : "요일별 영업시간을 펼쳐요"}
                accessibilityLabel={`영업시간, 오늘(${todayShort}) ${todayTime ?? ""}`}
                accessibilityRole="button"
                accessibilityState={{ expanded: hoursOpen }}
                onPress={() => setHoursOpen((open) => !open)}
                style={({ pressed }) => [styles.darkRow, styles.darkRowCenter, pressed && styles.darkPressed]}
              >
                <AppText style={styles.darkKey} tone="onDarkMuted" variant="body">
                  영업시간
                </AppText>
                <View style={styles.hoursPreview}>
                  <AppText capScale style={styles.bold} tone="onDarkMuted" variant="meta">
                    {`오늘(${todayShort})`}
                  </AppText>
                  <AppText style={styles.medium} tone="onDark" variant="body">
                    {todayTime}
                  </AppText>
                  <ChevronDown
                    color={colors.onDarkMuted}
                    size={16}
                    style={hoursOpen ? styles.chevronUp : undefined}
                  />
                </View>
              </Pressable>
              {hoursOpen ? (
                <View style={styles.hoursList}>
                  {shop.openingHours.map((line) => {
                    const isToday = line.startsWith(todayName)
                    const [day, ...rest] = line.split(":")
                    return (
                      <View key={line} style={[styles.hourRow, isToday && styles.hourToday]}>
                        <View style={styles.hourDay}>
                          <AppText style={isToday && styles.bold} tone={isToday ? "onDark" : "onDarkMuted"} variant="secondary">
                            {day}
                          </AppText>
                          {isToday ? (
                            <AppText capScale style={styles.bold} tone="onDark" variant="meta">
                              오늘
                            </AppText>
                          ) : null}
                        </View>
                        <AppText style={isToday && styles.bold} tone={isToday ? "onDark" : "onDarkMuted"} variant="secondary">
                          {rest.join(":").trim()}
                        </AppText>
                      </View>
                    )
                  })}
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.darkRow}>
              <AppText style={styles.darkKey} tone="onDarkMuted" variant="body">
                영업시간
              </AppText>
              <AppText style={styles.darkValue} tone="onDarkMuted" variant="body">
                영업시간 정보가 아직 없어요
              </AppText>
            </View>
          )}

          {shop.lastOrder ? (
            <>
              <DarkDivider />
              <View style={styles.darkRow}>
                <AppText style={styles.darkKey} tone="onDarkMuted" variant="body">
                  라스트오더
                </AppText>
                <AppText style={[styles.darkValue, styles.medium]} tone="onDark" variant="body">
                  {shop.lastOrder}
                </AppText>
              </View>
            </>
          ) : null}

          {shop.priceRange ? (
            <>
              <DarkDivider />
              <View style={styles.darkRow}>
                <AppText style={styles.darkKey} tone="onDarkMuted" variant="body">
                  가격대
                </AppText>
                <AppText style={[styles.darkValue, styles.medium]} tone="onDark" variant="body">
                  {shop.priceRange}
                </AppText>
              </View>
            </>
          ) : null}

          {shop.phone ? (
            <>
              <DarkDivider />
              <Pressable
                accessibilityHint="전화를 걸어요"
                accessibilityLabel={`전화번호, ${shop.phone}`}
                accessibilityRole="link"
                onPress={() => openUrl(`tel:${shop.phone!.replace(/[^0-9+]/g, "")}`)}
                style={({ pressed }) => [styles.darkRow, styles.darkRowCenter, pressed && styles.darkPressed]}
              >
                <AppText style={styles.darkKey} tone="onDarkMuted" variant="body">
                  전화번호
                </AppText>
                <View style={styles.phone}>
                  <Phone color={colors.onDarkMuted} size={16} />
                  <AppText style={styles.medium} tone="onDark" variant="body">
                    {shop.phone}
                  </AppText>
                </View>
              </Pressable>
            </>
          ) : null}

        </View>

        {/* 6. 내 라멘로그: 이 매장에서 내가 남긴 기록만 */}
        <View style={styles.reviews}>
          <View style={styles.reviewsHead}>
            <AppText accessibilityRole="header" style={styles.flexShrink} variant="sectionTitle">
              내 라멘로그
              {shopLogs.length ? (
                <AppText style={styles.bold} tone="muted" variant="sectionTitle">
                  {` ${shopLogs.length}`}
                </AppText>
              ) : null}
            </AppText>
          </View>

          {shopLogs.length ? (
            shopLogs.map((log, index) => {
              const photo = log.photos?.[0] ?? log.imageUrl ?? null
              const meta = [
                log.visitedAt.replace(/-/g, "."),
                log.ramenType,
                log.scores ? `만족도 ${log.scores.satisfaction}점` : null,
                log.revisit ? `재방문 ${log.revisit}` : null,
              ].filter(Boolean)
              return (
                <View
                  accessible
                  accessibilityLabel={`${log.menuName}, ${meta.join(", ")}${log.note ? `, ${log.note}` : ""}`}
                  key={log.id}
                  style={[styles.review, styles.logRow, index > 0 && styles.reviewDivider]}
                >
                  {photo ? <ResilientUriImage accessibilityLabel="" style={styles.logPhoto} uri={photo} /> : null}
                  <View style={styles.flexShrink}>
                    <AppText numberOfLines={1} variant="cardTitle">
                      {log.menuName}
                    </AppText>
                    <AppText capScale numberOfLines={1} style={styles.logMeta} tone="muted" variant="meta">
                      {meta.join(" · ")}
                    </AppText>
                    {log.note ? (
                      <AppText numberOfLines={3} style={styles.reviewText} variant="body">
                        {log.note}
                      </AppText>
                    ) : null}
                  </View>
                </View>
              )
            })
          ) : (
            <View style={styles.reviewsEmpty}>
              <AppText style={styles.center} variant="cardTitle">
                아직 이 가게 기록이 없어요
              </AppText>
              <AppText style={[styles.center, styles.emptyBody]} tone="muted" variant="secondary">
                {loggedIn ? "먹어본 라멘의 맛을 기록해보세요." : "로그인하고 이 가게의 첫 기록을 남겨보세요."}
              </AppText>
              <Button
                accessibilityHint={loggedIn ? undefined : "로그인 화면으로 이동해요"}
                leftIcon={<PenLine color={colors.ink} size={16} />}
                onPress={startRecord}
                size="small"
                style={styles.firstRecord}
                title="첫 기록 남기기"
                variant="outline"
              />
            </View>
          )}
        </View>
      </ScrollView>

      {/* 하단 고정: 가고 싶어요 / 먹은 라멘 기록하기. 웹과 같은 좌우 16, SE 폭에서도 문구를 자르지 않는다 */}
      <StickyActionBar style={styles.stickyBar}>
        <Button
          accessibilityHint={loggedIn ? undefined : "로그인 화면으로 이동해요"}
          accessibilityLabel={saved ? "저장됨, 가고 싶어요 취소" : "가고 싶어요"}
          fullWidth
          leftIcon={
            compact ? undefined : <Bookmark color={saved ? colors.brand : colors.ink} fill={saved ? colors.brand : "transparent"} size={18} />
          }
          onPress={toggleSave}
          style={[styles.stickyButton, saved && styles.savedButton]}
          textStyle={saved ? styles.savedText : undefined}
          title={saved ? "저장됨" : "가고 싶어요"}
          variant="outline"
        />
        <Button
          accessibilityHint={loggedIn ? undefined : "로그인 화면으로 이동해요"}
          fullWidth
          onPress={startRecord}
          style={[styles.stickyButton, styles.stickyPrimary]}
          title="먹은 라멘 기록하기"
        />
      </StickyActionBar>

      {/* 아래쪽 차콜 섹션 위에서도 묻히지 않게 흰 알림(경계·그림자)으로 띄운다 */}
      <Toast
        appearance="light"
        icon={toastSaved ? <Bookmark color={colors.brand} fill={colors.brand} size={18} /> : undefined}
        message={toast ?? ""}
        onDismiss={() => setToast(null)}
        style={{ bottom: TOAST_OFFSET + insets.bottom }}
        visible={toast !== null}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1, minWidth: 0 },
  bold: { fontWeight: "700" },
  medium: { fontWeight: "500" },
  center: { textAlign: "center" },
  dot: { color: colors.textFaint },
  scrollContent: { paddingBottom: spacing.x8 },

  hero: { aspectRatio: 4 / 3, backgroundColor: colors.canvasSoft },
  noPhoto: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.x2 },
  heroControls: {
    position: "absolute",
    left: spacing.x3,
    right: spacing.x3,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  thumbStrip: { position: "absolute", left: 0, right: 0, bottom: spacing.x3 },
  thumbRow: { gap: spacing.x2, paddingHorizontal: spacing.x4 },
  thumb: { width: 48, height: 48, borderRadius: radii.sm, borderWidth: 2, overflow: "hidden", backgroundColor: colors.canvasSoft },
  thumbActive: { borderColor: colors.brand },
  thumbIdle: { borderColor: colors.onDarkMuted, opacity: 0.75 },

  headline: { paddingHorizontal: spacing.gutter, paddingTop: spacing.x5 },
  metaLine: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: spacing.x2, rowGap: spacing.x1 },
  metaPart: { flexDirection: "row", alignItems: "center", gap: spacing.x2 },
  styleLine: { marginTop: spacing.x3 },
  name: { marginTop: spacing.x0_5 },
  spec: { marginTop: spacing.x1_5 },
  address: { marginTop: spacing.x1 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x1_5, marginTop: spacing.x3 },
  tag: { backgroundColor: colors.canvasSoft, borderRadius: radii.xs, paddingHorizontal: spacing.x2_5, paddingVertical: spacing.x1 },

  intro: {
    marginHorizontal: spacing.gutter,
    marginTop: spacing.x5,
    padding: spacing.x4,
    borderRadius: radii.sm,
    backgroundColor: colors.canvasSoft,
  },
  introHead: { flexDirection: "row", alignItems: "center", gap: spacing.x1_5, marginBottom: spacing.x1_5 },

  section: { paddingHorizontal: spacing.gutter, marginTop: spacing.x5 },
  sectionTitle: { marginBottom: spacing.x2_5 },
  perkGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x2 },
  perk: {
    flexBasis: "47%",
    flexGrow: 1,
    paddingVertical: spacing.x2_5,
    paddingHorizontal: spacing.x3,
    borderRadius: radii.sm,
    backgroundColor: colors.canvasSoft,
  },
  perkValue: { marginTop: spacing.x0_5 },

  dark: {
    marginHorizontal: spacing.gutter,
    marginTop: spacing.x5,
    padding: spacing.x5,
    borderRadius: radii.sm,
    backgroundColor: colors.ink,
  },
  darkTitle: { marginBottom: spacing.x3 },
  darkRow: {
    minHeight: touchTarget,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.x4,
    paddingVertical: spacing.x3,
  },
  darkRowCenter: { alignItems: "center", paddingVertical: spacing.x2 },
  darkPressed: { opacity: 0.7 },
  darkKey: { flexShrink: 0 },
  darkValue: { flex: 1, textAlign: "right" },
  darkDivider: { height: 1, backgroundColor: colors.onDark, opacity: 0.15 },
  hoursPreview: { flexDirection: "row", alignItems: "center", gap: spacing.x2, flexShrink: 1 },
  chevronUp: { transform: [{ rotate: "180deg" }] },
  hoursList: { paddingTop: spacing.x1, paddingBottom: spacing.x3 },
  hourRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.x2,
    paddingVertical: spacing.x1_5,
    borderRadius: radii.xs,
  },
  hourToday: { borderWidth: 1, borderColor: colors.onDarkMuted },
  hourDay: { flexDirection: "row", alignItems: "center", gap: spacing.x2 },
  phone: { flexDirection: "row", alignItems: "center", gap: spacing.x1_5 },
  // 매장 바로가기: 같은 폭의 칸, 아이콘 위 · 이름 아래(지도·예약 앱의 매장 페이지와 같은 배치)
  quickActions: { flexDirection: "row", gap: spacing.x2, marginTop: spacing.x5 },
  quickAction: {
    flex: 1,
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.x1,
    paddingHorizontal: spacing.x1,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.canvas,
  },
  quickPressed: { backgroundColor: colors.canvasSoft },

  reviews: { paddingHorizontal: spacing.gutter, marginTop: spacing.x6 },
  reviewsHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.x2,
    paddingBottom: spacing.x3,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  review: { paddingVertical: spacing.x4 },
  reviewDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  reviewText: { marginTop: spacing.x1 },
  logRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.x3 },
  logPhoto: { width: 56, height: 56, borderRadius: radii.sm },
  logMeta: { marginTop: spacing.x0_5 },
  reviewsEmpty: { alignItems: "center", paddingVertical: spacing.x8 },
  emptyBody: { marginTop: spacing.x1 },
  firstRecord: { marginTop: spacing.x4, borderColor: colors.ink },

  stickyBar: { paddingHorizontal: spacing.x4 },
  stickyButton: { paddingHorizontal: spacing.x3 },
  stickyPrimary: { flex: 1.3 },
  savedButton: { borderColor: colors.brand, backgroundColor: colors.brandWeak },
  savedText: { color: colors.brand },
})
