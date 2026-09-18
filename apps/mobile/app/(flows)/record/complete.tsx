import { useEffect, useMemo, useState } from "react"
import { Stack, router, useLocalSearchParams } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { Image } from "expo-image"
import { Check, ImageOff, SearchX } from "lucide-react-native"
import { ScrollView, StyleSheet, View } from "react-native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { MONTHLY_REPORT_TARGET, TASTE_AXES, scoresFromLog, type RamenLog, type TasteProfile, type TasteScores } from "@raota/shared"
import { useBowlCount, useLog, useMonthlyReports, useTasteProfile } from "@/src/data"
import { AppText, Button, ConfirmDialog, EmptyState, LoadingState, SectionHeader, StickyActionBar } from "@/src/components/ui"
import { useRecordReminderPrompt } from "@/src/notifications"
import { colors, radii, spacing, typography } from "@/src/theme"

/*
 * 기록 완료. 웹 RecordCompleteScreen과 같은 구성이다.
 * 인장 → "N번째 그릇" → 이번 그릇 티켓 → 취향 여권 변화(5축) → 이번 그릇 한 줄 → 하단 고정 CTA.
 * 저장이 끝난 화면이므로 스와이프 뒤로가기로 작성 화면에 돌아가지 않는다.
 */

const STAMP_DURATION = 250
const REVEAL_DURATION = 200

/** 'YYYY-MM-DD' 또는 'YYYY. MM. DD' → 연·월·일. 형식이 다르면 null */
function dateParts(value: string): { year: string; month: string; day: string } | null {
  const match = value.match(/^(\d{4})\D+(\d{2})\D+(\d{2})/)
  return match ? { year: match[1], month: match[2], day: match[3] } : null
}

/** '2026-09-18' → '2026.09.18'. 형식이 다르면 그대로 보여준다 */
function formatVisitDate(value: string): string {
  const parts = dateParts(value)
  return parts ? `${parts.year}.${parts.month}.${parts.day}` : value
}

/** 방문일과 누적 그릇 수로 티켓 번호를 만든다. 예: 2026-0918-43 */
function ticketNumber(visitedAt: string, count: number): string {
  const parts = dateParts(visitedAt)
  return parts ? `${parts.year}-${parts.month}${parts.day}-${count}` : `${count}`
}

const formatDelta = (delta: number) => (delta > 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2))

/** 이번 그릇에서 가장 높은 축(재방문 제외). 동점이면 앞 순서를 고른다 */
function topAxisOf(scores: TasteScores) {
  return TASTE_AXES.filter((axis) => axis.key !== "revisit").reduce((best, axis) =>
    scores[axis.key] > scores[best.key] ? axis : best,
  )
}

/** 기록에서 파생한 정직한 한 문장. 웹 RecordCompleteScreen의 comment와 같다 */
function bowlComment(log: RamenLog, recordCount: number): string {
  const scores = scoresFromLog(log)
  const bowl = `${log.shop.name}의 ${log.ramenType} 한 그릇`
  if (!scores) return `${bowl}이 ${recordCount}번째 기록으로 남았어요.`
  const top = topAxisOf(scores)
  return `${bowl}. 이번 그릇은 ${top.label} ${scores[top.key]}점이 가장 높았고, 재방문 의사는 ‘${log.revisit}’으로 남겼어요.`
}

export default function RecordCompleteScreen() {
  const { logId } = useLocalSearchParams<{ logId?: string }>()
  const parsedLogId = typeof logId === "string" && /^\d+$/.test(logId) ? Number(logId) : null
  const { data: log, isLoading } = useLog(parsedLogId)
  const { data: bowlCount } = useBowlCount()
  const { data: taste } = useTasteProfile(parsedLogId)
  const { data: monthly } = useMonthlyReports()
  // 기록을 저장할 때마다 리마인더를 다시 예약하고, 처음이면 알림을 받을지 한 번만 묻는다
  const reminder = useRecordReminderPrompt(Boolean(log), monthly.current?.recordCount ?? 0)
  const insets = useSafeAreaInsets()
  const reduceMotion = useReducedMotion()

  const scores = useMemo(() => (log ? scoresFromLog(log) : null), [log])
  const comment = useMemo(() => (log ? bowlComment(log, bowlCount) : null), [bowlCount, log])

  // 카운트업: 직전 숫자에서 시작해 짧게 올라간다. Reduce Motion이면 바로 최종 숫자
  const [counted, setCounted] = useState(reduceMotion)
  useEffect(() => {
    if (reduceMotion) {
      setCounted(true)
      return
    }
    const timer = setTimeout(() => setCounted(true), STAMP_DURATION)
    return () => clearTimeout(timer)
  }, [reduceMotion])

  // 인장이 찍히는 연출과 본문 등장
  const stamp = useSharedValue(reduceMotion ? 1 : 0)
  const reveal = useSharedValue(reduceMotion ? 1 : 0)
  useEffect(() => {
    if (reduceMotion) {
      stamp.value = 1
      reveal.value = 1
      return
    }
    stamp.value = withTiming(1, { duration: STAMP_DURATION, easing: Easing.out(Easing.cubic) })
    reveal.value = withDelay(STAMP_DURATION, withTiming(1, { duration: REVEAL_DURATION, easing: Easing.out(Easing.quad) }))
  }, [reduceMotion, reveal, stamp])

  const stampStyle = useAnimatedStyle(() => ({
    opacity: stamp.value,
    transform: [{ scale: 1.6 - 0.6 * stamp.value }],
  }))
  const revealStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: 8 * (1 - reveal.value) }],
  }))

  const goHome = () => router.replace("/native")
  const goTaste = () => router.replace("/taste")

  if (!log) {
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ gestureEnabled: false }} />
        <StatusBar style="dark" />
        <View style={[styles.stateArea, { paddingTop: insets.top }]}>
          {isLoading ? (
            <LoadingState label="기록을 불러오는 중…" />
          ) : (
            <EmptyState
              actionLabel="홈으로"
              description="저장된 기록을 다시 찾지 못했어요. 홈에서 라멘로그를 확인해 주세요."
              icon={<SearchX color={colors.textMuted} size={32} />}
              onAction={goHome}
              title="기록을 찾을 수 없어요"
            />
          )}
        </View>
      </View>
    )
  }

  const shownCount = counted ? bowlCount : Math.max(bowlCount - 1, 0)
  const shopLine = [log.shop.name, log.shop.branch].filter(Boolean).join(" · ")

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={styles.flex}
      >
        {/* 위로 당겨도(바운스) 흰 면 대신 차콜이 이어지게 한다 */}
        <View pointerEvents="none" style={styles.overscrollCap} />
        {/* 상단 인장 배너 */}
        <View style={[styles.banner, { paddingTop: insets.top + spacing.x6 }]}>
          <Animated.View accessible={false} style={[styles.stamp, stampStyle]}>
            <Check color={colors.brand} size={28} strokeWidth={3} />
          </Animated.View>
          <AppText style={styles.bold} tone="onDarkMuted" variant="secondary">
            기록이 저장됐어요
          </AppText>
          <View accessibilityLabel={`${bowlCount}번째 그릇`} accessibilityRole="header" accessible style={styles.counterRow}>
            <AppText tone="onDark" variant="counter">
              {shownCount}
            </AppText>
            <AppText style={styles.bold} tone="onDarkMuted" variant="sectionTitle">
              번째 그릇
            </AppText>
          </View>
        </View>

        <Animated.View style={[styles.body, revealStyle]}>
          {/* 이번 그릇 티켓 */}
          <View accessibilityLabel="기록 티켓" accessibilityRole="summary" style={styles.ticket}>
            <View style={styles.ticketHead}>
              <AppText capScale tone="muted" variant="meta">
                티켓 {ticketNumber(log.visitedAt, bowlCount)}
              </AppText>
              <AppText capScale variant="meta">
                {log.isPublic ? "공개 기록" : "나만 보기"}
              </AppText>
            </View>
            <View style={styles.ticketBody}>
              <View style={styles.photo}>
                {log.imageUrl ? (
                  <Image
                    accessibilityLabel={log.menuName}
                    accessible
                    contentFit="cover"
                    source={{ uri: log.imageUrl }}
                    style={styles.photoImage}
                    transition={150}
                  />
                ) : (
                  <ImageOff accessibilityLabel="사진 없음" color={colors.textMuted} size={20} />
                )}
              </View>
              <View style={styles.flex}>
                <View style={styles.tagRow}>
                  <View style={[styles.pill, styles.pillOutline]}>
                    <AppText capScale variant="meta">
                      {log.ramenType}
                    </AppText>
                  </View>
                  <View style={[styles.pill, styles.pillSoft]}>
                    <AppText capScale variant="meta">
                      {log.revisit}
                    </AppText>
                  </View>
                </View>
                <AppText numberOfLines={1} style={styles.menu} variant="cardTitle">
                  {log.menuName}
                </AppText>
                {/* 좁은 폭(320)에서도 방문일이 잘리지 않게 두 줄까지 허용한다 */}
                <AppText lineBreakStrategyIOS="hangul-word" numberOfLines={2} tone="muted" variant="secondary">
                  {shopLine} · {formatVisitDate(log.visitedAt)}
                </AppText>
              </View>
            </View>
          </View>

          {/* 취향 여권 변화 */}
          {scores && taste.before && taste.delta ? (
            <TasteDeltaSection after={taste.profile} before={taste.before} delta={taste.delta} scores={scores} />
          ) : null}

          {/* 이번 그릇 한 줄 */}
          {comment ? (
            <View accessibilityLabel="이번 그릇 정리" accessibilityRole="summary" style={styles.comment}>
              <AppText lineBreakStrategyIOS="hangul-word" variant="body">
                {comment}
              </AppText>
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>

      <ConfirmDialog
        cancelLabel="괜찮아요"
        confirmLabel="알림 받기"
        loading={reminder.busy}
        message={`이번 달 기록이 ${MONTHLY_REPORT_TARGET}그릇이 되면 다음 달 1일에 월간 리포트가 나와요. 마감 전과 기록이 일주일 뜸할 때만 알려드릴게요.`}
        onCancel={reminder.decline}
        onConfirm={() => void reminder.accept()}
        title="다음 달 리포트가 나올 즈음 알려드릴까요?"
        visible={reminder.visible}
      />

      {/* 하단 고정 CTA. 처음부터 보인다 */}
      <StickyActionBar>
        <View style={styles.actions}>
          <Button onPress={goTaste} size="medium" title="취향 리포트 보기" variant="primary" />
          <Button onPress={goHome} size="small" title="홈으로" variant="outline" />
        </View>
      </StickyActionBar>
    </View>
  )
}

interface TasteDeltaSectionProps {
  scores: TasteScores
  before: TasteProfile
  after: TasteProfile
  delta: TasteScores
}

function TasteDeltaSection({ scores, before, after, delta }: TasteDeltaSectionProps) {
  const isFirstBowl = before.count === 0
  const beforeExact = before.exact ?? before.scores
  const afterExact = after.exact ?? after.scores
  const nothingMoved = !isFirstBowl && TASTE_AXES.every((axis) => delta[axis.key] === 0)

  return (
    <View accessibilityLabel="취향 여권 변화" style={styles.deltaSection}>
      <SectionHeader
        meta={isFirstBowl ? "첫 그릇" : `${before.count}그릇 → ${after.count}그릇 평균`}
        style={styles.deltaHead}
        title="취향 여권 변화"
      />
      {TASTE_AXES.map((axis, index) => {
        const change = delta[axis.key]
        const beforeValue = beforeExact[axis.key]
        const afterValue = afterExact[axis.key]
        const changeLabel = isFirstBowl ? "첫 기록" : change === 0 ? "변화 없음" : formatDelta(change)
        const averageLabel = isFirstBowl ? afterValue.toFixed(1) : `${beforeValue.toFixed(2)} → ${afterValue.toFixed(2)}`
        return (
          <View
            accessibilityLabel={`${axis.label} 이번 그릇 ${scores[axis.key]}점, 평균 ${averageLabel}, ${changeLabel}`}
            accessible
            key={axis.key}
            style={[styles.deltaRow, index > 0 && styles.deltaRowDivider]}
          >
            <View style={styles.flex}>
              <AppText variant="bodyStrong">{axis.label}</AppText>
              <AppText tone="muted" variant="meta">
                이번 그릇 {scores[axis.key]}점
              </AppText>
            </View>
            <View style={styles.deltaValues}>
              {isFirstBowl ? (
                <AppText style={styles.tabular} variant="bodyStrong">
                  {afterValue.toFixed(1)}
                </AppText>
              ) : (
                <AppText style={styles.tabular} variant="bodyStrong">
                  <AppText style={styles.tabular} tone="muted" variant="body">
                    {beforeValue.toFixed(2)} →{" "}
                  </AppText>
                  {afterValue.toFixed(2)}
                </AppText>
              )}
              <AppText
                capScale
                style={[styles.tabular, styles.bold]}
                tone={isFirstBowl || change === 0 ? "muted" : "brand"}
                variant="meta"
              >
                {changeLabel}
              </AppText>
            </View>
          </View>
        )
      })}
      {nothingMoved ? (
        <AppText style={styles.deltaNote} tone="muted" variant="meta">
          평소 평균과 같은 점수를 줘서 {before.count}그릇 평균이 그대로예요.
        </AppText>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  bold: { fontWeight: "700" },
  tabular: { fontVariant: ["tabular-nums"], textAlign: "right" },
  stateArea: { flex: 1, justifyContent: "center", paddingHorizontal: spacing.gutter },
  scrollContent: { paddingBottom: spacing.x6 },
  overscrollCap: { position: "absolute", top: -1000, left: 0, right: 0, height: 1000, backgroundColor: colors.ink },
  banner: {
    backgroundColor: colors.ink,
    alignItems: "center",
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.x7,
  },
  stamp: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.x3,
  },
  counterRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: spacing.x2,
    marginTop: spacing.x1,
  },
  body: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.x4,
    gap: spacing.x4,
  },
  ticket: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    overflow: "hidden",
    backgroundColor: colors.canvas,
  },
  ticketHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.x4,
    paddingVertical: spacing.x2_5,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderStyle: "dashed",
  },
  ticketBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x3_5,
    padding: spacing.x4,
  },
  photo: {
    width: 64,
    height: 64,
    borderRadius: radii.sm,
    overflow: "hidden",
    backgroundColor: colors.canvasSoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  photoImage: { width: "100%", height: "100%" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x1_5 },
  pill: { borderRadius: radii.pill, paddingHorizontal: spacing.x2, paddingVertical: spacing.x0_5 },
  pillOutline: { backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.border },
  pillSoft: { backgroundColor: colors.canvasSoft },
  menu: { marginTop: spacing.x1 },
  deltaSection: { gap: 0 },
  deltaHead: { paddingBottom: spacing.x2, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: spacing.x1 },
  deltaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.x3,
    paddingVertical: spacing.x2_5,
  },
  deltaRowDivider: { borderTopWidth: 1, borderTopColor: colors.canvasSoft },
  deltaValues: { alignItems: "flex-end", flexShrink: 0 },
  deltaNote: { paddingTop: spacing.x2 },
  comment: {
    backgroundColor: colors.canvasSoft,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.x4,
    paddingVertical: spacing.x3_5,
  },
  actions: { flex: 1, gap: spacing.x2 },
})
