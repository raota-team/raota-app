import { useMemo, useState } from "react"
import { router, useLocalSearchParams } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { Image } from "expo-image"
import { Bookmark, ChevronRight, Crosshair, Search, SearchX, X } from "lucide-react-native"
import { FlatList, Pressable, StyleSheet, TextInput, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { type Shop, type ShopCatalogItem } from "@raota/shared"
import { track } from "@/src/analytics"
import { useBookmarkedShops, useShops } from "@/src/data"
import { useRaota } from "@/src/state/RaotaStore"
import { AppText, Chip, EmptyState, IconButton, LoadingState, RamenTypeTag } from "@/src/components/ui"
import { colors, line, maxFontScale, radii, spacing, touchTarget, typography } from "@/src/theme"

/*
 * 기록할 가게 고르기. 웹 RecordSheet와 같은 구성이다.
 * 제목 · 닫기 → 탭(주변 · 찜한 가게 · 검색) → 목록. iOS modal 시트로 뜨고 아래로 쓸어 닫을 수 있다.
 * 작성 화면에서 "변경"으로 열었으면 고른 가게만 바꿔 작성 중인 내용을 지키고 돌아간다.
 */

type Mode = "nearby" | "saved" | "search"
type NearbyFilter = "all" | "500m" | "open"

interface ShopItem {
  id: number
  name: string
  branch: string
  style: string
  /** 대표 스타일이 라멘 종류 목록과 맞을 때만 채운다. 없으면 빈 문자열 */
  ramenType: string
  spec: string
  distanceM: number
  distance: string
  isOpen: boolean
  photo?: string
  tags: string[]
  region: string
}

const MODES: Array<{ id: Mode; label: string; Icon: typeof Crosshair }> = [
  { id: "nearby", label: "주변", Icon: Crosshair },
  { id: "saved", label: "찜한 가게", Icon: Bookmark },
  { id: "search", label: "검색", Icon: Search },
]

/** 주소의 동 또는 역 이름에서 동네를 뽑는다. 못 찾으면 비워 둔다. */
const REGION_PATTERN = /(망원|합정|연남|서교|상수|동교)(동|역)/
const regionOf = (address: string) => {
  const match = address.match(REGION_PATTERN)
  return match ? `${match[1]}동` : ""
}

const formatDistance = (meters: number) =>
  meters >= 1000 ? `${(meters / 1000).toFixed(1).replace(/\.0$/, "")}km` : `${meters}m`

/** 원장 매장은 대표 스타일과 한 줄 특징을 갖고 있다. 없으면 비워 둔다. */
const catalogField = (shop: Shop, key: "style" | "spec") => {
  const value = (shop as Partial<ShopCatalogItem>)[key]
  return typeof value === "string" ? value : ""
}

const toShopItem = (shop: Shop): ShopItem => ({
  id: shop.id,
  name: shop.name,
  branch: shop.branch ?? "",
  style: catalogField(shop, "style"),
  // 종류 태그에는 원장의 대표 스타일을 그대로 넘긴다("쇼유 라멘" → 태그가 "쇼유"로 보여 준다)
  ramenType: catalogField(shop, "style"),
  spec: catalogField(shop, "spec"),
  distanceM: shop.distanceM,
  distance: formatDistance(shop.distanceM),
  isOpen: shop.isOpen,
  photo: shop.photos[0],
  tags: shop.tags,
  region: regionOf(shop.address),
})

const byDistance = (a: ShopItem, b: ShopItem) => a.distanceM - b.distanceM

const initialModeOf = (mode: string | undefined): Mode =>
  mode === "saved" || mode === "bookmarked" ? "saved" : mode === "search" ? "search" : "nearby"

function ShopRow({ shop, onSelect }: { shop: ShopItem; onSelect: () => void }) {
  const status = shop.isOpen ? "영업 중" : "준비 중"
  const label = [shop.name, shop.branch, shop.spec || shop.style, shop.distance, status, shop.region]
    .filter(Boolean)
    .join(", ")
  return (
    <Pressable
      accessibilityHint="이 가게로 기록을 시작해요"
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onSelect}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowPhoto}>
        {shop.photo ? (
          <Image contentFit="cover" source={{ uri: shop.photo }} style={StyleSheet.absoluteFill} transition={150} />
        ) : null}
      </View>
      <View style={styles.rowCopy}>
        <View style={styles.rowTitle}>
          <AppText numberOfLines={1} style={styles.shrink} variant="cardTitle">
            {shop.name}
          </AppText>
          {shop.branch ? (
            <AppText numberOfLines={1} tone="muted" variant="secondary">
              {shop.branch}
            </AppText>
          ) : null}
        </View>
        <AppText numberOfLines={1} style={styles.rowSpec} tone="muted" variant="secondary">
          {shop.spec || shop.style}
        </AppText>
        <View style={styles.rowMeta}>
          {/* 결과가 줄로 이어지는 목록이라 종류는 굵은 먹색 글씨로 쓴다(줄마다 노랑이면 줄무늬가 된다) */}
          {shop.ramenType ? <RamenTypeTag inList type={shop.ramenType} /> : null}
          <AppText capScale style={styles.bold} variant="meta">
            {shop.distance}
          </AppText>
          <AppText capScale style={styles.bold} tone={shop.isOpen ? "positive" : "muted"} variant="meta">
            {status}
          </AppText>
          {shop.region ? (
            <AppText capScale style={styles.medium} tone="muted" variant="meta">
              {shop.region}
            </AppText>
          ) : null}
        </View>
      </View>
      <ChevronRight color={colors.textMuted} size={20} />
    </Pressable>
  )
}

export default function SelectShopScreen() {
  const params = useLocalSearchParams<{ mode?: string; source?: string }>()
  const { state, actions } = useRaota()
  const shopsQuery = useShops()
  const bookmarked = useBookmarkedShops()
  const [mode, setMode] = useState<Mode>(() => initialModeOf(params.mode))
  const [nearbyFilter, setNearbyFilter] = useState<NearbyFilter>("all")
  const [query, setQuery] = useState("")

  const allShops = useMemo(() => shopsQuery.data.map(toShopItem).sort(byDistance), [shopsQuery.data])
  const savedShops = useMemo(() => bookmarked.data.map(toShopItem).sort(byDistance), [bookmarked.data])

  // 빠른 검색어는 원장의 스타일과 동네에서만 만든다. 인기 검색어처럼 꾸미지 않는다.
  const quickKeywords = useMemo(
    () =>
      Array.from(
        new Set([
          ...allShops.map((shop) => shop.style.replace(/ 라멘$/, "")).filter(Boolean),
          ...allShops.map((shop) => shop.region).filter(Boolean),
        ]),
      ),
    [allShops],
  )

  const nearbyList = useMemo(
    () =>
      allShops.filter((shop) => {
        if (nearbyFilter === "open" && !shop.isOpen) return false
        if (nearbyFilter === "500m" && shop.distanceM > 500) return false
        return true
      }),
    [allShops, nearbyFilter],
  )

  const trimmedQuery = query.trim()
  const searchResults = useMemo(() => {
    const q = trimmedQuery.toLocaleLowerCase("ko-KR")
    if (!q) return []
    return allShops.filter((shop) =>
      [shop.name, shop.branch, shop.style, shop.spec, shop.region, ...shop.tags].some((text) =>
        text.toLocaleLowerCase("ko-KR").includes(q),
      ),
    )
  }, [allShops, trimmedQuery])

  const close = () => {
    if (router.canGoBack()) router.back()
    else router.replace("/native")
  }

  const choose = (shop: ShopItem) => {
    // 작성 화면의 "변경"에서 열렸으면 작성 중인 내용을 지키고 가게만 바꿔 돌아간다.
    if (state.recordDraft) {
      actions.selectRecordDraftShop(shop.id)
      router.back()
      return
    }
    // 기록 시작은 떠 있는 기록 버튼이 이미 셌다(source=fab). 알림 등 다른 입구에서 왔을 때만 여기서 센다
    if (params.source !== "fab") {
      track("record_started", { mode, source: params.source === "reminder" ? "reminder" : "select_shop" })
    }
    router.replace({ pathname: "/record/new", params: { shopId: String(shop.id) } })
  }

  const data = mode === "nearby" ? nearbyList : mode === "saved" ? savedShops : searchResults

  const listHeader =
    mode === "nearby" ? (
      <View>
        <View style={styles.filters}>
          <Chip label={`전체 ${allShops.length}`} onPress={() => setNearbyFilter("all")} selected={nearbyFilter === "all"} />
          <Chip label="500m 이내" onPress={() => setNearbyFilter("500m")} selected={nearbyFilter === "500m"} />
          <Chip label="영업 중만" onPress={() => setNearbyFilter("open")} selected={nearbyFilter === "open"} />
        </View>
        <AppText capScale style={styles.listCaption} tone="muted" variant="meta">
          가까운 순
        </AppText>
      </View>
    ) : mode === "saved" && savedShops.length > 0 ? (
      <AppText capScale style={styles.listCaption} tone="muted" variant="meta">
        {`찜한 가게 ${savedShops.length}곳`}
      </AppText>
    ) : mode === "search" && trimmedQuery ? (
      <AppText accessibilityLiveRegion="polite" capScale style={styles.listCaption} tone="muted" variant="meta">
        {`검색 결과 ${searchResults.length}건`}
      </AppText>
    ) : null

  const listEmpty =
    mode === "nearby" ? (
      <EmptyState description="필터를 풀면 더 많은 가게를 볼 수 있어요." title="조건에 맞는 가게가 없어요" />
    ) : mode === "saved" ? (
      <EmptyState
        description="가게 상세에서 찜해 두면 여기서 바로 기록할 수 있어요."
        icon={<Bookmark color={colors.textFaint} size={32} />}
        title="찜한 가게가 없어요"
      />
    ) : trimmedQuery ? (
      <EmptyState
        description={`‘${trimmedQuery}’ 가게가 아직 목록에 없어요. 이름이나 동네를 다르게 입력해보세요.`}
        icon={<SearchX color={colors.textFaint} size={32} />}
        title="검색 결과가 없어요"
      />
    ) : (
      <View>
        <AppText capScale style={styles.quickTitle} tone="muted" variant="meta">
          빠른 검색어
        </AppText>
        <View style={styles.quickKeywords}>
          {quickKeywords.map((keyword) => (
            <Chip accessibilityHint="이 검색어로 찾아요" key={keyword} label={keyword} onPress={() => setQuery(keyword)} />
          ))}
        </View>
      </View>
    )

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.handle} />
      <View style={styles.header}>
        <AppText accessibilityRole="header" style={styles.flex} variant="screenTitle">
          어느 가게를 기록할까요?
        </AppText>
        <IconButton accessibilityLabel="닫기" icon={<X color={colors.ink} size={20} />} onPress={close} />
      </View>

      <View accessibilityLabel="가게 찾는 방법" accessibilityRole="tablist" style={styles.tabs}>
        {MODES.map(({ id, label, Icon }) => {
          const active = mode === id
          const count = id === "saved" ? savedShops.length : id === "nearby" ? allShops.length : null
          return (
            <Pressable
              accessibilityLabel={count === null ? label : `${label} ${count}곳`}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              key={id}
              onPress={() => setMode(id)}
              style={({ pressed }) => [styles.tab, active && styles.tabActive, pressed && !active && styles.tabPressed]}
            >
              <Icon color={active ? colors.onDark : colors.ink} size={16} />
              <AppText capScale numberOfLines={1} style={styles.bold} tone={active ? "onDark" : "ink"} variant="secondary">
                {label}
                {count !== null ? (
                  <AppText capScale tone={active ? "onDarkMuted" : "muted"} variant="secondary">
                    {` ${count}`}
                  </AppText>
                ) : null}
              </AppText>
            </Pressable>
          )
        })}
      </View>

      {mode === "search" ? (
        <View style={styles.searchWrap}>
          <View style={styles.searchField}>
            <Search color={colors.textMuted} size={16} />
            <TextInput
              accessibilityLabel="가게 검색"
              autoCorrect={false}
              autoFocus
              maxFontSizeMultiplier={maxFontScale}
              onChangeText={setQuery}
              placeholder="가게 이름, 동네, 스타일"
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              style={styles.searchInput}
              value={query}
            />
            {query ? (
              <IconButton
                accessibilityLabel="검색어 지우기"
                icon={<X color={colors.textMuted} size={16} />}
                onPress={() => setQuery("")}
              />
            ) : null}
          </View>
        </View>
      ) : null}

      {shopsQuery.isLoading ? (
        <LoadingState label="가게 목록을 불러오는 중…" />
      ) : (
        <FlatList
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={listEmpty}
          ListHeaderComponent={listHeader}
          contentContainerStyle={styles.listContent}
          data={data}
          keyExtractor={(item) => String(item.id)}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => <ShopRow onSelect={() => choose(item)} shop={item} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  bold: { fontWeight: "700" },
  medium: { fontWeight: "500" },
  handle: {
    width: 36,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginTop: spacing.x2_5,
  },
  header: {
    minHeight: 56,
    paddingLeft: spacing.gutter,
    paddingRight: spacing.x2,
    paddingTop: spacing.x2,
    paddingBottom: spacing.x1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x2,
  },
  tabs: {
    flexDirection: "row",
    gap: spacing.x2,
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.x2,
    paddingBottom: spacing.x3,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  // 전환 칸: 12pt 사각 + 2pt 먹선, 고른 칸은 먹색 면 + 흰 글씨. 그림자는 없다
  tab: {
    flex: 1,
    minHeight: touchTarget,
    borderRadius: radii.sm,
    borderWidth: line.base,
    borderColor: colors.outline,
    backgroundColor: colors.canvas,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.x1_5,
    // 2pt 테두리가 안쪽을 좁히므로 SE 폭에서 라벨이 더 잘리지 않게 여백을 줄인다
    paddingHorizontal: spacing.x0_5,
  },
  tabActive: { backgroundColor: colors.ink },
  tabPressed: { backgroundColor: colors.canvasSoft },
  searchWrap: { paddingHorizontal: spacing.gutter, paddingTop: spacing.x4 },
  // 검색창: 흰 면 + 2pt 먹선 + 12pt, 그림자 없음
  searchField: {
    minHeight: 48,
    borderRadius: radii.sm,
    borderWidth: line.base,
    borderColor: colors.outline,
    backgroundColor: colors.canvas,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: spacing.x3_5,
    gap: spacing.x2,
  },
  searchInput: {
    ...typography.body,
    flex: 1,
    minHeight: 46,
    color: colors.ink,
    fontWeight: "500",
    paddingVertical: 0,
    paddingRight: spacing.x3,
  },
  listContent: { paddingHorizontal: spacing.gutter, paddingTop: spacing.x4, paddingBottom: spacing.x8, flexGrow: 1 },
  // 위 전환 칸(먹색 선택)과 필터 칩(빨강 선택)이 붙어 있으면 무엇이 켜졌는지 한 박자 늦게 읽힌다.
  // 색 규칙은 그대로 두고 구분선 아래 여백을 키워 두 묶음을 떼어 놓는다
  filters: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x2, paddingTop: spacing.x4, paddingBottom: spacing.x3 },
  listCaption: { fontWeight: "500", paddingBottom: spacing.x1 },
  quickTitle: { fontWeight: "500", marginBottom: spacing.x2 },
  quickKeywords: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x2 },
  separator: { height: 1, backgroundColor: colors.border },
  row: {
    minHeight: 56 + spacing.x3 * 2,
    paddingVertical: spacing.x3,
    paddingHorizontal: spacing.x2,
    marginHorizontal: -spacing.x2,
    borderRadius: radii.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x3,
  },
  rowPressed: { backgroundColor: colors.canvasSoft },
  rowPhoto: {
    width: 56,
    height: 56,
    borderRadius: radii.sm,
    overflow: "hidden",
    backgroundColor: colors.canvasSoft,
    borderWidth: line.base,
    borderColor: colors.outline,
  },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { flexDirection: "row", alignItems: "baseline", gap: spacing.x1_5 },
  rowSpec: { marginTop: spacing.x0_5 },
  // 종류·거리·영업 상태가 한 줄에 붙어 좁은 폭에서 넘칠 수 있어 줄바꿈을 허용한다
  rowMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.x2, marginTop: spacing.x1 },
})
