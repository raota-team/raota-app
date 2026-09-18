import { router } from "expo-router"
import { Archive, ChevronRight } from "lucide-react-native"
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text as NativeText,
  View,
  type TextProps,
} from "react-native"

import { useRaota } from "@/src/state/RaotaStore"
import { fonts } from "@/src/theme"
import { FlowHeader, FlowPage, flowStyles, palette } from "../_layout"

function Text({ style, ...props }: TextProps) {
  return <NativeText {...props} style={[{ fontFamily: fonts.body }, style]} />
}

export default function TasteArchiveScreen() {
  const { state, currentTasteReport } = useRaota()
  const reports = state.tasteReports.filter(
    (report) => report.id !== currentTasteReport?.id,
  )
  return (
    <FlowPage>
      <FlowHeader
        title="지난 취향 리포트"
        subtitle={`${reports.length}개의 감정서 보관 중`}
      />
      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          reports.length === 0 && { flex: 1 },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          reports.length ? (
            <Text style={styles.intro}>
              기록이 쌓일수록 취향이 어떻게 바뀌었는지 비교해보세요.
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Archive color={palette.quiet} size={38} />
            <Text style={styles.emptyTitle}>지난 리포트가 아직 없어요</Text>
            <Text style={flowStyles.secondary}>
              새 기록을 더하고 리포트를 갱신하면 이전 감정서가 이곳에
              보관됩니다.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.period}, ${item.title} 열기`}
            onPress={() =>
              router.push({
                pathname: "/taste/[reportId]",
                params: { reportId: item.id },
              })
            }
            style={({ pressed }) => [
              styles.reportRow,
              pressed && { opacity: 0.65 },
            ]}
          >
            <View style={styles.volumeBox}>
              <Text style={styles.volume}>
                {item.volume.replace("Vol. ", "")}
              </Text>
              <Text style={styles.volumeLabel}>VOL</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.period}>{item.period}</Text>
              <Text numberOfLines={2} style={styles.title}>
                {item.title}
              </Text>
              <Text style={styles.meta}>
                {item.recordCount}그릇 · {item.strongestFeature}
              </Text>
            </View>
            <ChevronRight color={palette.muted} size={20} />
          </Pressable>
        )}
      />
    </FlowPage>
  )
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 34 },
  intro: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 13,
  },
  reportRow: {
    minHeight: 116,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    borderBottomColor: palette.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 15,
  },
  volumeBox: {
    width: 58,
    height: 72,
    borderRadius: 8,
    backgroundColor: palette.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  volume: { color: palette.canvas, fontSize: 22, fontWeight: "900" },
  volumeLabel: {
    color: palette.red,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginTop: 2,
  },
  period: { color: palette.red, fontSize: 11, fontWeight: "800" },
  title: {
    color: palette.ink,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
    marginTop: 4,
  },
  meta: { color: palette.muted, fontSize: 11, marginTop: 5 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 28,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 5,
  },
})
