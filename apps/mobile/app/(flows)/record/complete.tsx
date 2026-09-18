import { useEffect, useMemo, useRef } from "react"
import { router, useLocalSearchParams } from "expo-router"
import { Image } from "expo-image"
import { ArrowRight, Check, Home, Radar, Sparkles } from "lucide-react-native"
import {
  AccessibilityInfo,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"

import { useRaota } from "@/src/state/RaotaStore"
import { ActionButton, FlowPage, flowStyles, palette } from "../_layout"

export default function RecordCompleteScreen() {
  const { logId } = useLocalSearchParams<{ logId?: string }>()
  const { currentUser, getLog, userLogs } = useRaota()
  const hasRequestedLog = typeof logId === "string" && logId.length > 0
  const log = useMemo(() => {
    const parsed = Number(logId)
    if (hasRequestedLog)
      return Number.isFinite(parsed) ? getLog(parsed) : undefined
    return userLogs[0]
  }, [getLog, hasRequestedLog, logId, userLogs])
  const changes = useMemo(() => {
    if (!log) return []
    const revisitBoost =
      log.revisit === "자주 감"
        ? 0.3
        : log.revisit === "가끔 생각남"
          ? 0.2
          : 0.1
    return [
      {
        label: "국물 취향",
        value: Math.min(0.95, 0.5 + log.tasteNotes.broth.length * 0.12),
        delta: `+${(log.tasteNotes.broth.length * 0.3).toFixed(1)}`,
      },
      {
        label: "면 취향",
        value: Math.min(0.95, 0.5 + log.tasteNotes.noodle.length * 0.12),
        delta: `+${(log.tasteNotes.noodle.length * 0.3).toFixed(1)}`,
      },
      {
        label: "재방문 신호",
        value: 0.5 + revisitBoost,
        delta: `+${revisitBoost.toFixed(1)}`,
      },
    ]
  }, [log])
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(14)).current

  useEffect(() => {
    let animation: Animated.CompositeAnimation | undefined
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (reduceMotion) {
        opacity.setValue(1)
        translateY.setValue(0)
        return
      }
      animation = Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 14,
          stiffness: 130,
          useNativeDriver: true,
        }),
      ])
      animation.start()
    })
    return () => animation?.stop()
  }, [opacity, translateY])

  if (hasRequestedLog && !log) {
    return (
      <FlowPage>
        <View style={styles.missing}>
          <Radar color={palette.quiet} size={38} />
          <Text style={styles.missingTitle}>완료 기록을 찾을 수 없어요</Text>
          <Text style={flowStyles.secondary}>
            삭제되었거나 잘못된 기록 링크일 수 있습니다.
          </Text>
          <View style={styles.missingAction}>
            <ActionButton
              label="홈으로 돌아가기"
              onPress={() => router.replace("/native")}
            />
          </View>
        </View>
      </FlowPage>
    )
  }

  return (
    <FlowPage>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.logoMark}>
            <Check color={palette.red} size={30} strokeWidth={3} />
          </View>
          <Text style={styles.heroTitle}>한 그릇의 기억을{`\n`}저장했어요</Text>
          <Text style={styles.heroCount}>
            {currentUser?.visitedCount ?? userLogs.length}
          </Text>
          <Text style={styles.heroCountLabel}>번째 라멘로그</Text>
        </View>

        <Animated.View
          style={[styles.body, { opacity, transform: [{ translateY }] }]}
        >
          {log ? (
            <View style={styles.ticket}>
              <View style={styles.ticketHeader}>
                <Text style={styles.ticketNumber}>
                  RAOTA LOG · {String(log.id).slice(-6)}
                </Text>
                <Text style={styles.completeLabel}>저장 완료</Text>
              </View>
              <View style={styles.ticketContent}>
                {log.imageUrl ? (
                  <Image
                    source={{ uri: log.imageUrl }}
                    style={styles.photo}
                    contentFit="cover"
                    transition={150}
                  />
                ) : (
                  <View style={[styles.photo, styles.photoFallback]}>
                    <Text style={styles.photoFallbackText}>RAOTA</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={styles.menu}>
                    {log.menuName}
                  </Text>
                  <Text style={styles.shop}>
                    {log.shop.name}
                    {log.shop.branch ? ` · ${log.shop.branch}` : ""}
                  </Text>
                  <View style={styles.tagRow}>
                    <Text style={styles.redTag}>{log.ramenType}</Text>
                    <Text style={styles.grayTag}>{log.revisit}</Text>
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.ticket}>
              <Text style={styles.menu}>새로운 라멘로그</Text>
              <Text style={flowStyles.secondary}>
                기록이 취향 데이터에 반영되었습니다.
              </Text>
            </View>
          )}

          <View style={styles.vectorSection}>
            <View style={styles.sectionHeadingRow}>
              <Radar color={palette.red} size={19} />
              <Text style={styles.sectionTitle}>취향 벡터 갱신</Text>
              <Text style={styles.updated}>분석 완료</Text>
            </View>
            {changes.map((change) => (
              <View key={change.label} style={styles.metricRow}>
                <Text style={styles.metricLabel}>{change.label}</Text>
                <View style={styles.track}>
                  <View
                    style={[styles.fill, { width: `${change.value * 100}%` }]}
                  />
                </View>
                <Text style={styles.delta}>{change.delta}</Text>
              </View>
            ))}
          </View>

          <View style={styles.curator}>
            <Sparkles color={palette.red} fill={palette.red} size={17} />
            <View style={{ flex: 1 }}>
              <Text style={styles.curatorTitle}>다음 탐험 힌트</Text>
              <Text style={styles.curatorText}>
                {log
                  ? `${log.ramenType}와 ${log.tasteNotes.broth[0] ?? "국물"}, ${log.tasteNotes.noodle[0] ?? "면"} 취향이 새 분석에 반영됐어요. 다음 기록과 비교하면 취향의 변화가 더 선명해집니다.`
                  : "새 기록이 취향 분석에 반영됐어요. 다음 한 그릇도 이어서 기록해보세요."}
              </Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      <View style={[flowStyles.bottomBar, styles.actions]}>
        <ActionButton
          label="취향 리포트 확인"
          icon={<ArrowRight color={palette.canvas} size={19} />}
          onPress={() => router.replace("/taste")}
        />
        <ActionButton
          label="홈으로 돌아가기"
          variant="secondary"
          icon={<Home color={palette.ink} size={18} />}
          onPress={() => router.replace("/native")}
        />
      </View>
    </FlowPage>
  )
}

const styles = StyleSheet.create({
  missing: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  missingTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 8,
    marginTop: 14,
  },
  missingAction: { marginTop: 18, width: "100%" },
  scroll: { paddingBottom: 22 },
  hero: {
    backgroundColor: palette.ink,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 38,
    paddingBottom: 30,
  },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: palette.canvas,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  heroTitle: {
    color: palette.canvas,
    fontSize: 27,
    lineHeight: 34,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  heroCount: {
    color: palette.canvas,
    fontSize: 62,
    fontWeight: "900",
    lineHeight: 70,
    letterSpacing: -2,
    marginTop: 11,
  },
  heroCountLabel: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 14,
    fontWeight: "700",
  },
  body: { padding: 16, gap: 14 },
  ticket: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 12,
    padding: 15,
    backgroundColor: palette.canvas,
  },
  ticketHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 11,
    marginBottom: 12,
    borderBottomColor: palette.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderStyle: "dashed",
  },
  ticketNumber: { color: palette.muted, fontSize: 11, fontWeight: "700" },
  completeLabel: { color: palette.red, fontSize: 11, fontWeight: "800" },
  ticketContent: { flexDirection: "row", alignItems: "center", gap: 13 },
  photo: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: palette.wash,
  },
  photoFallback: { alignItems: "center", justifyContent: "center" },
  photoFallbackText: { color: palette.muted, fontSize: 11, fontWeight: "900" },
  menu: { color: palette.ink, fontSize: 17, lineHeight: 22, fontWeight: "800" },
  shop: { color: palette.muted, fontSize: 12, marginTop: 4 },
  tagRow: { flexDirection: "row", gap: 6, marginTop: 8 },
  redTag: {
    color: palette.red,
    backgroundColor: "#FFEAEA",
    fontSize: 11,
    fontWeight: "800",
    borderRadius: 10,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  grayTag: {
    color: palette.ink,
    backgroundColor: palette.wash,
    fontSize: 11,
    fontWeight: "700",
    borderRadius: 10,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  vectorSection: {
    borderRadius: 12,
    borderColor: palette.line,
    borderWidth: 1,
    padding: 15,
    gap: 12,
  },
  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 3,
  },
  sectionTitle: {
    flex: 1,
    color: palette.ink,
    fontSize: 17,
    fontWeight: "800",
  },
  updated: { color: palette.red, fontSize: 11, fontWeight: "800" },
  metricRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  metricLabel: {
    width: 75,
    color: palette.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.wash,
    overflow: "hidden",
  },
  fill: { height: 6, borderRadius: 3, backgroundColor: palette.ink },
  delta: {
    width: 34,
    color: palette.red,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "right",
  },
  curator: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: palette.wash,
    borderRadius: 12,
    padding: 15,
  },
  curatorTitle: { color: palette.ink, fontSize: 13, fontWeight: "800" },
  curatorText: {
    color: palette.ink,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },
  actions: { gap: 8 },
})
