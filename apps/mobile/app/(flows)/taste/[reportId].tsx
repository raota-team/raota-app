import { router, useLocalSearchParams } from "expo-router"
import { Share2 } from "lucide-react-native"
import {
  Pressable,
  Share,
  StyleSheet,
  Text as NativeText,
  View,
  type TextProps,
} from "react-native"

import { useRaota } from "@/src/state/RaotaStore"
import {
  ActionButton,
  FlowHeader,
  FlowPage,
  FlowScroll,
  flowStyles,
  palette,
} from "../_layout"
import { ReportBody } from "./index"
import { fonts } from "@/src/theme"

function Text({ style, ...props }: TextProps) {
  return <NativeText {...props} style={[{ fontFamily: fonts.body }, style]} />
}

export default function TasteReportDetailScreen() {
  const { reportId } = useLocalSearchParams<{ reportId: string }>()
  const { state } = useRaota()
  const report = state.tasteReports.find((item) => item.id === reportId)

  if (!report) {
    return (
      <FlowPage>
        <FlowHeader title="지난 취향 리포트" />
        <View style={styles.missing}>
          <Text style={styles.missingTitle}>리포트를 찾을 수 없어요</Text>
          <Text style={flowStyles.secondary}>
            삭제되었거나 잘못된 링크일 수 있습니다.
          </Text>
          <View style={{ width: "100%", marginTop: 10 }}>
            <ActionButton
              label="보관함으로 이동"
              onPress={() => router.replace("/taste/archive")}
            />
          </View>
        </View>
      </FlowPage>
    )
  }

  const share = () =>
    Share.share({
      title: `RAOTA ${report.volume}`,
      message: `${report.period}의 RAOTA 취향은 “${report.title}”입니다. ${report.recordCount}그릇으로 분석했어요.`,
    })

  return (
    <FlowPage>
      <FlowHeader
        title={report.volume}
        subtitle={report.period}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="리포트 공유"
            onPress={share}
            style={styles.shareButton}
          >
            <Share2 color={palette.ink} size={20} />
          </Pressable>
        }
      />
      <FlowScroll contentContainerStyle={styles.content}>
        <ReportBody report={report} />
        {!!report.changeSummary && (
          <View style={styles.changeBox}>
            <Text style={styles.changeTitle}>현재 취향과 비교</Text>
            <Text style={styles.changeText}>{report.changeSummary}</Text>
          </View>
        )}
        <ActionButton
          label="이 리포트 공유하기"
          shape="rounded"
          icon={<Share2 color={palette.canvas} size={18} />}
          onPress={share}
        />
      </FlowScroll>
    </FlowPage>
  )
}

const styles = StyleSheet.create({
  shareButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { paddingTop: 16, gap: 14 },
  missing: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 8,
  },
  missingTitle: { color: palette.ink, fontSize: 20, fontWeight: "800" },
  changeBox: { backgroundColor: palette.wash, borderRadius: 12, padding: 16 },
  changeTitle: { color: palette.ink, fontSize: 15, fontWeight: "800" },
  changeText: {
    color: palette.ink,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },
})
