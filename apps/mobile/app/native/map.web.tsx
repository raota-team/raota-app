import { router } from "expo-router"
import { MapPin, Search } from "lucide-react-native"
import { useMemo, useState } from "react"
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text as NativeText,
  TextInput,
  View,
  type TextProps,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { filterAndSortShops } from "@/src/domain"
import { useRaota } from "@/src/state/RaotaStore"
import { colors, fonts } from "@/src/theme"

function Text({ style, ...props }: TextProps) {
  return <NativeText {...props} style={[{ fontFamily: fonts.body }, style]} />
}

/** Expo Web is not a release target; this keeps previews usable without loading the native map module. */
export default function WebMapFallbackScreen() {
  const insets = useSafeAreaInsets()
  const { shops } = useRaota()
  const [query, setQuery] = useState("")
  const results = useMemo(
    () => filterAndSortShops(shops, { query, sort: "distance" }),
    [query, shops],
  )

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>라멘 지도</Text>
        <Text style={styles.description}>
          Apple Maps와 현재 위치는 iOS 앱에서 사용할 수 있어요. 웹
          미리보기에서는 매장 목록을 보여드려요.
        </Text>
        <View style={styles.search}>
          <Search color={colors.textMuted} size={18} />
          <TextInput
            accessibilityLabel="라멘집 검색"
            onChangeText={setQuery}
            placeholder="매장명, 계보, 지역 검색"
            placeholderTextColor={colors.placeholder}
            style={styles.input}
            value={query}
          />
        </View>
      </View>
      <FlatList
        contentContainerStyle={styles.list}
        data={results}
        keyExtractor={(shop) => String(shop.id)}
        renderItem={({ item }) => (
          <Pressable
            accessibilityLabel={`${item.name} ${item.branch ?? ""} 상세 보기`}
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: "/shop/[shopId]",
                params: { shopId: String(item.id) },
              })
            }
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Image source={{ uri: item.photos[0] }} style={styles.image} />
            <View style={styles.copy}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.branch} · {item.tags.slice(0, 2).join(" · ")}
              </Text>
              <Text style={styles.distance}>
                {item.distanceM < 1000
                  ? `${item.distanceM}m`
                  : `${(item.distanceM / 1000).toFixed(1)}km`}
              </Text>
            </View>
            <MapPin color={colors.brand} size={19} />
          </Pressable>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    padding: 18,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 24,
    fontWeight: "800",
  },
  description: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  search: {
    alignItems: "center",
    backgroundColor: colors.backgroundBasement,
    borderRadius: 10,
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    minHeight: 48,
    paddingHorizontal: 13,
  },
  input: {
    color: colors.text,
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  list: { padding: 16, paddingBottom: 96 },
  row: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    minHeight: 94,
    paddingVertical: 12,
  },
  pressed: { opacity: 0.65 },
  image: {
    backgroundColor: colors.backgroundBasement,
    borderRadius: 8,
    height: 68,
    width: 68,
  },
  copy: { flex: 1 },
  name: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: "800",
  },
  meta: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 4,
  },
  distance: {
    color: colors.brand,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
  },
})
