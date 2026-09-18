import { useMemo, useState } from "react"
import { router, useLocalSearchParams } from "expo-router"
import { Image } from "expo-image"
import {
  Bookmark,
  LocateFixed,
  MapPin,
  Search,
  Store,
  X,
} from "lucide-react-native"
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"

import type { Shop } from "@raota/shared"
import { useRaota } from "@/src/state/RaotaStore"
import { FlowPage, SelectChip, flowStyles, palette } from "../_layout"

type Mode = "nearby" | "bookmarked" | "search"

export default function SelectShopScreen() {
  const params = useLocalSearchParams<{ mode?: string }>()
  const { shops, state, actions } = useRaota()
  const initialMode: Mode =
    params.mode === "bookmarked" || params.mode === "saved"
      ? "bookmarked"
      : params.mode === "search"
        ? "search"
        : "nearby"
  const [mode, setMode] = useState<Mode>(initialMode)
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    let list = [...shops]
    if (mode === "bookmarked")
      list = list.filter((shop) => state.bookmarkedShopIds.includes(shop.id))
    if (mode === "nearby") list.sort((a, b) => a.distanceM - b.distanceM)
    const normalized = query.trim().toLocaleLowerCase("ko-KR")
    if (normalized) {
      list = list.filter((shop) =>
        [shop.name, shop.branch, shop.address, ...shop.tags]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("ko-KR")
          .includes(normalized),
      )
    }
    return list
  }, [mode, query, shops, state.bookmarkedShopIds])

  const choose = (shop: Shop) => {
    if (state.recordDraft) {
      actions.selectRecordDraftShop(shop.id)
      router.back()
      return
    }
    router.replace({
      pathname: "/record/new",
      params: { shopId: String(shop.id) },
    })
  }

  return (
    <FlowPage>
      <View style={styles.sheetHandle} />
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>어디에서 드셨나요?</Text>
          <Text style={styles.subtitle}>
            매장을 선택하면 기본 정보를 자동으로 채워드려요.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="매장 선택 닫기"
          onPress={() => router.back()}
          style={styles.closeButton}
        >
          <X color={palette.ink} size={22} />
        </Pressable>
      </View>

      <View style={styles.controls}>
        <View style={styles.searchField}>
          <Search color={palette.muted} size={19} />
          <TextInput
            accessibilityLabel="매장 검색"
            autoCorrect={false}
            clearButtonMode="while-editing"
            onChangeText={(value) => {
              setQuery(value)
              if (value && mode !== "search") setMode("search")
            }}
            placeholder="매장명, 지역, 계보로 검색"
            placeholderTextColor={palette.quiet}
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
        </View>
        <View style={styles.modeRow}>
          <SelectChip
            label="내 주변"
            selected={mode === "nearby"}
            onPress={() => setMode("nearby")}
          />
          <SelectChip
            label="가고 싶어요"
            selected={mode === "bookmarked"}
            onPress={() => setMode("bookmarked")}
          />
          <SelectChip
            label="전체 검색"
            selected={mode === "search"}
            onPress={() => setMode("search")}
          />
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.list,
          filtered.length === 0 && { flex: 1 },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.resultHeader}>
            {mode === "nearby" ? (
              <LocateFixed color={palette.red} size={16} />
            ) : mode === "bookmarked" ? (
              <Bookmark color={palette.red} size={16} />
            ) : (
              <Store color={palette.red} size={16} />
            )}
            <Text style={styles.resultLabel}>
              {mode === "nearby"
                ? "거리순"
                : mode === "bookmarked"
                  ? "저장한 매장"
                  : "전체 매장"}{" "}
              · {filtered.length}곳
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Store color={palette.quiet} size={34} />
            <Text style={styles.emptyTitle}>
              {query ? "검색 결과가 없어요" : "저장한 매장이 없어요"}
            </Text>
            <Text style={flowStyles.secondary}>
              {query
                ? "매장명이나 지역을 다르게 입력해보세요."
                : "지도에서 가고 싶은 매장을 먼저 저장해보세요."}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.name} ${item.branch ?? ""} 선택`}
            onPress={() => choose(item)}
            style={({ pressed }) => [
              styles.shopRow,
              pressed && { opacity: 0.65 },
            ]}
          >
            {item.photos[0] ? (
              <Image
                source={{ uri: item.photos[0] }}
                style={styles.shopImage}
                contentFit="cover"
                transition={120}
              />
            ) : (
              <View style={[styles.shopImage, styles.shopImageFallback]}>
                <Store color={palette.muted} size={22} />
              </View>
            )}
            <View style={styles.shopCopy}>
              <View style={styles.nameRow}>
                <Text numberOfLines={1} style={styles.shopName}>
                  {item.name}
                </Text>
                {!!item.branch && (
                  <Text numberOfLines={1} style={styles.branch}>
                    {item.branch}
                  </Text>
                )}
              </View>
              <Text numberOfLines={1} style={styles.tags}>
                {item.tags.slice(0, 2).join(" · ")}
              </Text>
              <View style={styles.metaRow}>
                <MapPin color={palette.muted} size={13} />
                <Text style={styles.meta}>
                  {item.distanceM < 1000
                    ? `${item.distanceM}m`
                    : `${(item.distanceM / 1000).toFixed(1)}km`}{" "}
                  · {item.isOpen ? "영업 중" : "영업 종료"}
                </Text>
              </View>
            </View>
          </Pressable>
        )}
      />
    </FlowPage>
  )
}

const styles = StyleSheet.create({
  sheetHandle: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#C9C9C9",
    alignSelf: "center",
    marginTop: 6,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 15,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    borderBottomColor: palette.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    color: palette.ink,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  subtitle: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  closeButton: {
    width: 44,
    height: 44,
    marginLeft: "auto",
    marginTop: -7,
    alignItems: "center",
    justifyContent: "center",
  },
  controls: {
    padding: 14,
    gap: 11,
    borderBottomColor: palette.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchField: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: palette.wash,
    borderRadius: 10,
    paddingHorizontal: 13,
  },
  searchInput: { flex: 1, color: palette.ink, fontSize: 16, height: 48 },
  modeRow: { flexDirection: "row", gap: 7 },
  list: { paddingHorizontal: 16, paddingBottom: 30 },
  resultHeader: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  resultLabel: { color: palette.muted, fontSize: 12, fontWeight: "700" },
  shopRow: {
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomColor: palette.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 11,
  },
  shopImage: {
    width: 68,
    height: 68,
    borderRadius: 8,
    backgroundColor: palette.wash,
  },
  shopImageFallback: { alignItems: "center", justifyContent: "center" },
  shopCopy: { flex: 1, gap: 4 },
  nameRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  shopName: {
    flexShrink: 1,
    color: palette.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  branch: { color: palette.muted, fontSize: 12, fontWeight: "600" },
  tags: { color: palette.ink, fontSize: 13, lineHeight: 18 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  meta: { color: palette.muted, fontSize: 12 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 8,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 6,
  },
})
