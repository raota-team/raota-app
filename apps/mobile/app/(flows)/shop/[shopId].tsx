import { useMemo, useRef, useState } from "react"
import { router, useLocalSearchParams } from "expo-router"
import {
  Bookmark,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  ExternalLink,
  MapPin,
  Sparkles,
  Star,
} from "lucide-react-native"
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native"

import { ResilientUriImage } from "@/src/components"
import { useRaota } from "@/src/state/RaotaStore"
import { fonts } from "@/src/theme"
import {
  ActionButton,
  FlowHeader,
  FlowPage,
  Text,
  flowStyles,
  palette,
} from "../_layout"

const DAY_NAMES = [
  "일요일",
  "월요일",
  "화요일",
  "수요일",
  "목요일",
  "금요일",
  "토요일",
]
const DAY_SHORT = ["일", "월", "화", "수", "목", "금", "토"]

export default function ShopDetailScreen() {
  const { shopId } = useLocalSearchParams<{ shopId: string }>()
  const { width } = useWindowDimensions()
  const { state, getShop, actions } = useRaota()
  const galleryRef = useRef<ScrollView>(null)
  const id = Number(shopId)
  const shop = Number.isFinite(id) ? getShop(id) : undefined
  const [photoIndex, setPhotoIndex] = useState(0)
  const [hoursOpen, setHoursOpen] = useState(false)
  const isBookmarked = shop ? state.bookmarkedShopIds.includes(shop.id) : false

  const dayIndex = new Date().getDay()
  const todayName = DAY_NAMES[dayIndex]
  const todayShort = DAY_SHORT[dayIndex]

  const todayTimeText = useMemo(() => {
    if (!shop) return ""
    const todayHourEntry = shop.openingHours.find((entry) => entry.startsWith(todayName))
    return todayHourEntry
      ? todayHourEntry.replace(/^.*?: /, "")
      : (shop.openingHours[0]?.replace(/^.*?: /, "") || "11:30 - 21:00")
  }, [shop, todayName])

  const openLink = async (url: string | undefined, label: string) => {
    if (!url) {
      Alert.alert(label, "등록된 연결 정보가 없어요.")
      return
    }
    const supported = await Linking.canOpenURL(url)
    if (supported) await Linking.openURL(url)
    else Alert.alert(label, "이 기기에서 링크를 열 수 없어요.")
  }

  const openDirections = () => {
    if (!shop) return
    const destination = `${shop.lat},${shop.lng}`
    const url = `https://maps.apple.com/?daddr=${destination}&q=${encodeURIComponent(shop.name)}&dirflg=d`
    void openLink(url, "Apple 지도 길찾기")
  }

  if (!shop) {
    return (
      <FlowPage>
        <FlowHeader title="매장 정보" />
        <View style={styles.missing}>
          <MapPin color={palette.quiet} size={38} />
          <Text style={styles.missingTitle}>매장을 찾을 수 없어요</Text>
          <Text style={flowStyles.secondary}>
            삭제되었거나 잘못된 매장 링크일 수 있습니다.
          </Text>
          <View style={{ width: "100%", marginTop: 12 }}>
            <ActionButton
              label="지도에서 다시 찾기"
              onPress={() => router.replace("/native/map")}
            />
          </View>
        </View>
      </FlowPage>
    )
  }

  const photos = shop.photos.length ? shop.photos : [""]
  const heroWidth = width

  return (
    <FlowPage>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 22 }}
      >
        <View
          style={[styles.hero, { height: Math.min(heroWidth * 0.75, 330) }]}
        >
          <ScrollView
            horizontal
            pagingEnabled
            bounces={false}
            onMomentumScrollEnd={(event) =>
              setPhotoIndex(
                Math.round(event.nativeEvent.contentOffset.x / heroWidth),
              )
            }
            ref={galleryRef}
            showsHorizontalScrollIndicator={false}
          >
            {photos.map((photo, index) => (
              <View
                key={`${photo}-${index}`}
                style={{ width: heroWidth, height: "100%" }}
              >
                <ResilientUriImage
                  accessibilityLabel={`${shop.name} 사진 ${index + 1}`}
                  fallback={
                    <Text style={styles.imageFallbackText}>RAOTA</Text>
                  }
                  fallbackBackgroundColor={palette.ink}
                  fallbackTintColor={palette.canvas}
                  uri={photo}
                  style={StyleSheet.absoluteFill}
                />
              </View>
            ))}
          </ScrollView>
          <View pointerEvents="none" style={styles.heroShade} />
          <View style={styles.heroControls}>
            <Pressable
              accessibilityLabel="뒤로 가기"
              accessibilityRole="button"
              onPress={() => {
                if (router.canGoBack()) router.back()
                else router.replace("/native")
              }}
              style={styles.heroIconButton}
            >
              <ChevronLeft color={palette.canvas} size={22} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                isBookmarked ? "가고 싶어요에서 삭제" : "가고 싶어요에 저장"
              }
              accessibilityState={{ selected: isBookmarked }}
              onPress={() => actions.toggleBookmark(shop.id)}
              style={styles.heroIconButton}
            >
              <Bookmark
                color={isBookmarked ? palette.red : palette.canvas}
                fill={isBookmarked ? palette.red : "transparent"}
                size={19}
              />
            </Pressable>
          </View>
          <View style={styles.heroThumbnails}>
            {photos.map((photo, index) => (
              <Pressable
                accessibilityLabel={`사진 ${index + 1} 보기`}
                accessibilityRole="button"
                key={`${photo}-thumb-${index}`}
                onPress={() => {
                  setPhotoIndex(index)
                  galleryRef.current?.scrollTo({ x: index * heroWidth, animated: true })
                }}
                style={[
                  styles.heroThumbnail,
                  photoIndex === index && styles.heroThumbnailActive,
                ]}
              >
                <ResilientUriImage
                  accessibilityLabel={`${shop.name} 사진 ${index + 1}`}
                  fallback={<Text style={styles.imageFallbackText}>R</Text>}
                  fallbackBackgroundColor={palette.ink}
                  fallbackTintColor={palette.canvas}
                  uri={photo}
                  style={StyleSheet.absoluteFill}
                />
              </Pressable>
            ))}
          </View>
          <View style={styles.photoCounter}>
            <Text style={styles.photoCounterText}>
              {photoIndex + 1} / {photos.length}
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.introCard}>
            <View style={styles.introMetaRow}>
              <Text style={styles.openStatus}>
                {shop.isOpen ? "● 영업 중" : "영업 종료"}
              </Text>
              <Text style={styles.reviewCount}>라멘로그 {shop.reviewCount}개</Text>
            </View>
            <View style={styles.shopIntro}>
              <Text style={styles.shopKicker}>{shop.tags[0] ?? "라멘 전문점"}</Text>
              <Text style={styles.shopName}>
                {shop.name}
                {shop.branch ? ` · ${shop.branch}` : ""}
              </Text>
              <Text style={styles.address}>{shop.address}</Text>
            </View>
            <View style={styles.perkGrid}>
              <View style={styles.perk}>
                <Text style={styles.perkLabel}>면 리필 (카에다마)</Text>
                <Text style={styles.perkValue}>
                  {shop.servicePerks?.noodleRefill ?? "1회 무료 제공 ✓"}
                </Text>
              </View>
              <View style={styles.perk}>
                <Text style={styles.perkLabel}>공깃밥 리필</Text>
                <Text style={styles.perkValue}>
                  {shop.servicePerks?.riceRefill ?? "요청 시 무료 제공 ✓"}
                </Text>
              </View>
            </View>
            <View style={styles.ratingRow}>
              <Star color={palette.red} fill={palette.red} size={14} />
              <Text style={styles.rating}>
                {shop.rating.toFixed(1)} · 리뷰 {shop.reviewCount.toLocaleString()}개
              </Text>
            </View>
            <View style={styles.tags}>
              {shop.tags.slice(0, 4).map((tag) => (
                <Text key={tag} style={styles.tag}>
                  #{tag}
                </Text>
              ))}
            </View>
          </View>

          {/* AI 취향 분석 및 리뷰 요약 */}
          {!!shop.description && (
            <View style={styles.aiSummary}>
              <View style={styles.aiTitleRow}>
                <Sparkles color={palette.red} fill={palette.red} size={15} />
                <Text style={styles.aiTitle}>AI 리뷰 분석 요약</Text>
              </View>
              <Text style={styles.aiCopy}>“{shop.description}”</Text>
            </View>
          )}

          {/* 매장 상세 정보 */}
          <View style={styles.darkSection}>
            <View style={styles.darkHeading}>
              <Text style={styles.darkTitle}>가게 상세 정보</Text>
              <Text style={styles.darkCaption}>구글 지도 데이터 기준</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>주소</Text>
              <Text style={styles.detailValue}>{shop.address}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: hoursOpen }}
              onPress={() => setHoursOpen((value) => !value)}
              style={[styles.detailRow, styles.detailPressable]}
            >
              <Text style={styles.detailKey}>영업시간</Text>
              <View style={styles.detailHoursPreview}>
                <Text style={styles.todayAccent}>오늘({todayShort})</Text>
                <Text style={styles.detailValue}>{todayTimeText}</Text>
                {hoursOpen ? (
                  <ChevronUp color="rgba(255,255,255,0.6)" size={14} />
                ) : (
                  <ChevronDown color="rgba(255,255,255,0.6)" size={14} />
                )}
              </View>
            </Pressable>
            {hoursOpen && (
              <View style={styles.hoursList}>
                {shop.openingHours.map((line, idx) => {
                  const isToday = line.startsWith(todayName)
                  const [dayPart, ...rest] = line.split(":")
                  const timePart = rest.join(":").trim()
                  return (
                    <View
                      key={`${line}-${idx}`}
                      style={[styles.hourLineRow, isToday && styles.hourLineToday]}
                    >
                      <View style={styles.hourDayWrap}>
                        <Text style={[styles.hourDayText, isToday && styles.hourTodayText]}>
                          {dayPart}
                        </Text>
                        {isToday && (
                          <View style={styles.todayBadge}>
                            <Text style={styles.todayBadgeText}>오늘</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.hourTimeText, isToday && styles.hourTodayText]}>
                        {timePart}
                      </Text>
                    </View>
                  )
                })}
              </View>
            )}
            {!!shop.phone && (
              <Pressable
                accessibilityRole="link"
                onPress={() => openLink(`tel:${shop.phone}`, "전화하기")}
                style={styles.detailRow}
              >
                <Text style={styles.detailKey}>전화번호</Text>
                <Text style={styles.detailValue}>{shop.phone}</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityLabel={`${shop.name}까지 Apple 지도 길찾기`}
              accessibilityRole="button"
              onPress={openDirections}
              style={styles.detailRow}
            >
              <Text style={styles.detailKey}>길찾기</Text>
              <Text style={styles.detailValue}>Apple 지도에서 열기</Text>
            </Pressable>
            {!!shop.priceRange && (
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>가격대</Text>
                <Text style={styles.detailValue}>{shop.priceRange}</Text>
              </View>
            )}
            <View style={styles.darkLinks}>
              <Pressable
                accessibilityRole="link"
                onPress={() => openLink(shop.instagramUrl ?? shop.websiteUri, "인스타그램")}
                style={styles.darkLinkButton}
              >
                <ExternalLink color={palette.canvas} size={15} />
                <Text style={styles.darkLinkText}>인스타그램</Text>
              </Pressable>
              <Pressable
                accessibilityRole="link"
                onPress={() => openLink(shop.catchTableUrl, "캐치테이블")}
                style={styles.darkLinkButton}
              >
                <CalendarClock color={palette.canvas} size={15} />
                <Text style={styles.darkLinkText}>캐치테이블</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.reviewSection}>
            <View style={styles.reviewHeading}>
              <Text style={styles.sectionTitle}>방문자 라멘로그 ({shop.reviews.length})</Text>
              <Text style={styles.reviewCaption}>구글 리뷰 연동</Text>
            </View>
            {shop.reviews.length ? (
              shop.reviews.map((review, index) => (
                <View key={`${review.author}-${index}`} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewAuthor}>{review.author}</Text>
                    <Text style={styles.reviewMeta}>{review.time}</Text>
                  </View>
                  <Text style={styles.reviewText}>{review.text}</Text>
                </View>
              ))
            ) : (
              <Text style={flowStyles.secondary}>아직 등록된 한줄평이 없어요.</Text>
            )}
          </View>
        </View>
      </ScrollView>

      <View style={[flowStyles.bottomBar, styles.bottomActions]}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: isBookmarked }}
          onPress={() => actions.toggleBookmark(shop.id)}
          style={[styles.bottomSave, isBookmarked && styles.bottomSaveActive]}
        >
          <Bookmark
            color={isBookmarked ? palette.red : palette.ink}
            fill={isBookmarked ? palette.red : "transparent"}
            size={18}
          />
          <Text style={[styles.bottomSaveText, isBookmarked && styles.bottomSaveTextActive]}>
            {isBookmarked ? "저장됨 ✓" : "가고 싶어요"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: "/record/new",
              params: { shopId: String(shop.id) },
            })
          }
          style={styles.bottomRecord}
        >
          <CalendarClock color={palette.canvas} size={18} />
          <Text style={styles.bottomRecordText}>먹은 라멘 기록하기</Text>
        </Pressable>
      </View>
    </FlowPage>
  )
}

const styles = StyleSheet.create({
  missing: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 28,
    gap: 8,
  },
  missingTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 8,
  },
  hero: { width: "100%", backgroundColor: palette.ink, position: "relative" },
  heroShade: {
    backgroundColor: "rgba(0,0,0,0.30)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  heroControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    left: 16,
    position: "absolute",
    right: 16,
    top: 14,
  },
  heroIconButton: {
    alignItems: "center",
    backgroundColor: "rgba(37,40,43,0.64)",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  heroThumbnails: {
    bottom: 12,
    flexDirection: "row",
    gap: 6,
    left: 16,
    position: "absolute",
    right: 100,
  },
  heroThumbnail: {
    borderColor: "rgba(255,255,255,0.45)",
    borderRadius: 4,
    borderWidth: 2,
    height: 48,
    overflow: "hidden",
    width: 48,
  },
  heroThumbnailActive: { borderColor: palette.red, opacity: 1 },
  imageFallbackText: {
    color: palette.canvas,
    fontWeight: "900",
    fontSize: 24,
    letterSpacing: 2,
  },
  photoCounter: {
    position: "absolute",
    right: 14,
    bottom: 16,
    backgroundColor: "rgba(37,40,43,0.82)",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  photoCounterText: { color: palette.canvas, fontSize: 11, fontWeight: "700" },
  content: { padding: 20, gap: 14 },
  introCard: {
    backgroundColor: palette.canvas,
    borderColor: palette.line,
    borderRadius: 6,
    borderWidth: 1,
    padding: 20,
  },
  introMetaRow: {
    alignItems: "center",
    borderBottomColor: palette.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 10,
  },
  openStatus: { color: palette.success, fontSize: 11, fontWeight: "800" },
  reviewCount: { color: palette.muted, fontSize: 10, fontWeight: "700" },
  shopIntro: { gap: 5, marginTop: 13 },
  shopKicker: {
    color: palette.red,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  shopName: {
    color: palette.ink,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  address: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  perkGrid: {
    borderTopColor: palette.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
  },
  perk: {
    backgroundColor: palette.wash,
    borderColor: palette.line,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    minHeight: 58,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  perkLabel: { color: palette.muted, fontSize: 10, fontWeight: "700" },
  perkValue: {
    color: palette.red,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "900",
    marginTop: 4,
  },
  ratingRow: { alignItems: "center", flexDirection: "row", gap: 4, marginTop: 12 },
  rating: { color: palette.muted, fontSize: 11, fontWeight: "700" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 9 },
  tag: { color: palette.red, fontSize: 11, fontWeight: "700" },
  aiSummary: {
    backgroundColor: palette.wash,
    borderRadius: 6,
    gap: 8,
    padding: 16,
  },
  aiTitleRow: { alignItems: "center", flexDirection: "row", gap: 6 },
  aiTitle: { color: palette.red, fontSize: 10, fontWeight: "900", letterSpacing: 0.3 },
  aiCopy: { color: palette.ink, fontSize: 12, lineHeight: 18 },
  darkSection: { backgroundColor: palette.ink, borderRadius: 6, padding: 20 },
  darkHeading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  darkTitle: { color: palette.canvas, fontSize: 14, fontWeight: "900" },
  darkCaption: { color: "rgba(255,255,255,0.58)", fontSize: 9 },
  detailRow: {
    alignItems: "center",
    borderBottomColor: "rgba(255,255,255,0.16)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 46,
    paddingVertical: 10,
  },
  detailPressable: { minHeight: 50 },
  detailHoursPreview: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  todayAccent: {
    color: palette.red,
    fontSize: 11,
    fontWeight: "700",
  },
  detailKey: { color: "rgba(255,255,255,0.54)", fontSize: 10, flexShrink: 0 },
  detailValue: {
    color: palette.canvas,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "600",
    textAlign: "right",
  },
  hoursList: {
    borderTopColor: "rgba(255,255,255,0.1)",
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
    marginTop: 6,
    paddingTop: 8,
  },
  hourLineRow: {
    alignItems: "center",
    borderRadius: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  hourLineToday: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  hourDayWrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  hourDayText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontWeight: "500",
  },
  hourTodayText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  todayBadge: {
    backgroundColor: palette.red,
    borderRadius: 32,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  todayBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
  },
  hourTimeText: {
    color: "rgba(255,255,255,0.7)",
    fontFamily: fonts.body,
    fontSize: 11,
  },
  darkLinks: {
    borderTopColor: "rgba(255,255,255,0.16)",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
    paddingTop: 12,
  },
  darkLinkButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 6,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 40,
  },
  darkLinkText: { color: palette.canvas, fontSize: 11, fontWeight: "700" },
  sectionTitle: { color: palette.ink, fontSize: 13, fontWeight: "900" },
  reviewSection: {
    backgroundColor: palette.canvas,
    borderColor: palette.line,
    borderRadius: 6,
    borderWidth: 1,
    gap: 10,
    padding: 20,
  },
  reviewHeading: {
    alignItems: "center",
    borderBottomColor: palette.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 12,
  },
  reviewCaption: { color: palette.muted, fontSize: 9.5, fontWeight: "700" },
  reviewCard: { backgroundColor: palette.wash, borderRadius: 6, padding: 14 },
  reviewHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 8 },
  reviewAuthor: { color: palette.ink, flex: 1, fontSize: 11.5, fontWeight: "800" },
  reviewMeta: { color: palette.muted, fontSize: 9.5 },
  reviewText: { color: "#4A4D52", fontSize: 11.5, lineHeight: 17, marginTop: 7 },
  bottomActions: { flexDirection: "row", gap: 10 },
  bottomSave: {
    alignItems: "center",
    backgroundColor: palette.canvas,
    borderColor: palette.line,
    borderRadius: 60,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 52,
  },
  bottomSaveActive: {
    backgroundColor: "rgba(230,0,0,0.08)",
    borderColor: palette.red,
  },
  bottomSaveText: { color: palette.ink, fontSize: 13, fontWeight: "800" },
  bottomSaveTextActive: { color: palette.red },
  bottomRecord: {
    alignItems: "center",
    backgroundColor: palette.red,
    borderRadius: 60,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 8,
  },
  bottomRecordText: { color: palette.canvas, fontSize: 13, fontWeight: "900" },
})
