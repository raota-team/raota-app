import { t, ph } from "@lingui/core/macro";
import { getLocale, formatDate as formatLocaleDate, labelOf } from "@raota/shared"
import { useLocale } from "@/src/i18n"
import * as Haptics from "expo-haptics"
import { useEffect, useMemo } from "react"
import { router, useLocalSearchParams } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { SearchX } from "lucide-react-native"
import { Image } from "expo-image"
import { Platform, ScrollView, StyleSheet, View } from "react-native"
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated"
import Svg, { Path } from "react-native-svg"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import {
  MONTHLY_REPORT_TARGET,
  REVISIT_OPTIONS,
  TASTE_AXES,
  scoresFromLog,
  type RamenLog,
  type TasteAxisKey,
  type TasteProfile,
  type TasteScores,
} from "@raota/shared"
import { useBowlCount, useLog, useMonthlyReports, useTasteProfile } from "@/src/data"
import { AppText, Button, ConfirmDialog, EmptyState, LoadingState, StickyActionBar } from "@/src/components/ui"
import { useRecordReminderPrompt } from "@/src/notifications"
import { sizedImageUri } from "@/src/api/imageSize"
import { TASTE_REPORT_ENABLED } from "@/src/features"
import { colors, radii, spacing, usePalette } from "@/src/theme"

/*
 * 저장한 기록을 "취향 기록지"로 보여 준다(사용자 결정 2026.10.26, 이치란 주문 용지에서 따온 안).
 * 다섯 평가의 1~5 칸에 고른 점수를 빨간 펜으로 동그라미 친다. 도장·식권 대신 종이 양식 하나만 둔다.
 * 작성 화면은 replace로 이 화면에 오므로 뒤로 스와이프해도 작성 중이던 기록으로 돌아가지 않는다.
 */

/** 화면이 밀려 들어오는 동안 그리면 아무도 못 본다. iOS 스택 전환(약 350ms)이 끝난 뒤에 긋는다 */
const PEN_DELAY = 420
const PEN_DURATION = 380
/** 동그라미 사이 간격. 위 칸부터 한 줄씩 차례로 긋는다 */
const PEN_GAP = 220
/** 아래 PEN_PATH의 길이(viewBox 단위). 점선 길이로 써서 앞에서부터 그어지게 한다 */
const PEN_LENGTH = 240
/** 끝이 시작점을 살짝 지나치는 손그림 타원(100×60 viewBox). 칸에 맞춰 늘어난다 */
const PEN_PATH = "M 78 9 C 60 1, 18 4, 8 24 C 0 42, 30 58, 58 56 C 88 54, 99 34, 88 17 C 82 9, 72 6, 60 7"
const SCALE = [1, 2, 3, 4, 5] as const
const SCALE_AXES = TASTE_AXES.filter((axis) => axis.key !== "revisit")
/** 낮은 쪽부터 왼쪽에 둔다. 1~5 칸과 같은 방향이다 */
const REVISIT_ROW = [...REVISIT_OPTIONS].reverse()
const PHOTO_SIZE = 64

const AnimatedPath = Animated.createAnimatedComponent(Path)

/** 'YYYY-MM-DD' 또는 'YYYY. MM. DD' → '2026.09.18'. 형식이 다르면 그대로 보여준다 */
function formatVisitDate(value: string): string {
  const match = value.match(/^(\d{4})\D+(\d{2})\D+(\d{2})/)
  if (getLocale() !== "ko") return formatLocaleDate(value, { year: "numeric", month: "short", day: "numeric" })
  return match ? `${match[1]}.${match[2]}.${match[3]}` : value
}

/** 메모가 없을 때만, 이번 점수와 이전 평균의 가장 큰 차이를 사실 그대로 말한다 */
function bowlComment(log: RamenLog, scores: TasteScores | null, before: TasteProfile | null): string {
  const note = log.note.trim()
  if (note) return note
  if (!scores || !before) return t`이 그릇도 기록으로 남겼어요.`
  if (before.count === 0) return t`첫 기록이에요.`

  const average = before.exact ?? before.scores
  let largestAxis: TasteAxisKey = "satisfaction"
  let largestDifference = 0
  for (const axis of TASTE_AXES) {
    const difference = Math.abs(scores[axis.key] - average[axis.key])
    if (difference > largestDifference) {
      largestAxis = axis.key
      largestDifference = difference
    }
  }
  if (largestDifference === 0) return t`평소와 비슷한 점수로 남긴 그릇이에요.`

  const higher = scores[largestAxis] > average[largestAxis]
  switch (largestAxis) {
    case "satisfaction":
      return t`평소보다 전체 만족도를 ${ph({ v1: higher ? t`높게` : t`낮게` })} 남긴 그릇이에요.`
    case "brothDensity":
      return t`평소보다 육수를 ${ph({ v1: higher ? t`진하게` : t`맑게` })} 느낀 그릇이에요.`
    case "noodleFirmness":
      return higher ? t`평소보다 면을 단단하게 느낀 그릇이에요.` : t`평소보다 면을 부드럽게 느낀 그릇이에요.`
    case "topping":
      return t`평소보다 토핑 점수를 ${ph({ v1: higher ? t`높게` : t`낮게` })} 남긴 그릇이에요.`
    case "revisit":
      return t`평소보다 재방문 의사를 ${ph({ v1: higher ? t`높게` : t`낮게` })} 남긴 그릇이에요.`
  }
}

/** 고른 칸을 펜으로 두른 동그라미. 칸보다 조금 넘치게 감싸고, 동작 줄이기에서는 그어진 채로 보인다 */
function PenCircle({ order, reduceMotion }: { order: number; reduceMotion: boolean }) {
  const ink = usePalette().brand
  const drawn = useSharedValue(reduceMotion ? 1 : 0)
  useEffect(() => {
    if (reduceMotion) {
      drawn.value = 1
      return
    }
    drawn.value = 0
    drawn.value = withDelay(PEN_DELAY + order * PEN_GAP, withTiming(1, { duration: PEN_DURATION, easing: Easing.out(Easing.quad) }))
  }, [drawn, order, reduceMotion])
  const penProps = useAnimatedProps(() => ({ strokeDashoffset: PEN_LENGTH * (1 - drawn.value) }))
  return (
    <View pointerEvents="none" style={styles.pen}>
      <Svg height="100%" preserveAspectRatio="none" viewBox="0 0 100 60" width="100%">
        <AnimatedPath
          animatedProps={penProps}
          d={PEN_PATH}
          fill="none"
          stroke={ink}
          strokeDasharray={[PEN_LENGTH, PEN_LENGTH]}
          strokeLinecap="round"
          strokeWidth={4.5}
        />
      </Svg>
    </View>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <AppText capScale style={styles.infoLabel} tone="muted" variant="meta">{label}</AppText>
      <AppText lineBreakStrategyIOS="hangul-word" style={styles.infoValue} variant="secondary">{value}</AppText>
    </View>
  )
}

export default function RecordCompleteScreen() {
  const locale = useLocale()
  const { logId } = useLocalSearchParams<{ logId?: string }>()
  const parsedLogId = typeof logId === "string" && logId.length > 0 ? logId : null
  const { data: log, isLoading } = useLog(parsedLogId)
  const { data: bowlCount } = useBowlCount()
  const { data: taste } = useTasteProfile(parsedLogId)
  const { data: monthly } = useMonthlyReports()
  // 기록을 저장할 때마다 리마인더를 다시 예약하고, 처음이면 알림을 받을지 한 번만 묻는다
  const reminder = useRecordReminderPrompt(Boolean(log), monthly.current?.recordCount ?? 0)
  const insets = useSafeAreaInsets()
  const reduceMotion = useReducedMotion()

  const scores = useMemo(() => (log ? scoresFromLog(log) : null), [log])
  const comment = useMemo(() => (log ? bowlComment(log, scores, taste.before) : null), [log, scores, taste.before, locale])
  // 재방문 동그라미는 늘 마지막이다. 점수가 없는 옛 기록은 재방문 하나만 긋는다
  const revisitOrder = scores ? SCALE_AXES.length : 0
  const shownLogId = log?.id

  // 마지막 동그라미를 다 그었을 때 손에 가볍게 한 번 전한다
  useEffect(() => {
    if (shownLogId == null || reduceMotion || Platform.OS === "web") return
    const timer = setTimeout(
      () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined),
      PEN_DELAY + revisitOrder * PEN_GAP + PEN_DURATION,
    )
    return () => clearTimeout(timer)
  }, [shownLogId, reduceMotion, revisitOrder])

  const goHome = () => router.replace("/native")
  const goTaste = () => router.replace("/taste")

  if (!log) {
    return (
      <View style={styles.root}>
        <StatusBar style="auto" />
        <View style={[styles.stateArea, { paddingTop: insets.top }]}>
          {isLoading ? (
            <LoadingState label={t`기록을 불러오는 중…`} />
          ) : (
            <EmptyState
              actionLabel={t`홈으로`}
              description={t`저장된 기록을 다시 찾지 못했어요. 홈에서 라멘로그를 확인해 주세요.`}
              icon={<SearchX color={colors.textMuted} size={32} />}
              onAction={goHome}
              title={t`기록을 찾을 수 없어요`}
            />
          )}
        </View>
      </View>
    )
  }

  const photo = log.photos?.[0] || log.imageUrl

  return (
    <View style={styles.root}>
      <StatusBar style="auto" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={styles.flex}
      >
        <View style={[styles.intro, { paddingTop: insets.top + spacing.x6 }]}>
          <AppText tone="sub" variant="bodyStrong">{t`기록이 저장됐어요`}</AppText>
          <AppText accessibilityLabel={t`${ph({ v1: bowlCount })}번째 그릇`} accessibilityRole="header" style={styles.counter} variant="counter">
            {t`${ph({ v1: bowlCount })}번째 그릇`}</AppText>
        </View>

        <View style={styles.body}>
          <View style={styles.sheet} testID="record-complete-sheet">
            <View style={[styles.sheetHead, styles.rule]}>
              <AppText variant="bodyStrong">{t`취향 기록지`}</AppText>
              <AppText capScale style={styles.tabular} tone="muted" variant="meta">{`No.${String(bowlCount).padStart(4, "0")}`}</AppText>
            </View>

            <View style={[styles.info, styles.rule]}>
              <View style={styles.infoRows}>
                <InfoRow label={t`가게`} value={[log.shop.name, log.shop.branch].filter(Boolean).join(" ")} />
                <InfoRow label={t`메뉴`} value={`${log.menuName} (${labelOf(log.ramenType)})`} />
                <InfoRow label={t`날짜`} value={formatVisitDate(log.visitedAt)} />
              </View>
              {photo ? (
                <Image accessibilityLabel={t`${ph({ v1: log.menuName })} 사진`} contentFit="cover" source={{ uri: sizedImageUri(photo, PHOTO_SIZE * 3) }} style={styles.photo} />
              ) : null}
            </View>

            {scores
              ? SCALE_AXES.map((axis, index) => (
                  <View accessibilityLabel={t`${ph({ v1: labelOf(axis.label) })} ${ph({ v2: scores[axis.key] })}점`} accessible key={axis.key} style={[styles.axisRow, styles.rule]}>
                    <AppText variant="button">{labelOf(axis.label)}</AppText>
                    <View style={styles.scale}>
                      <AppText capScale style={styles.scaleEnd} tone="muted" variant="meta">{labelOf(axis.low)}</AppText>
                      {SCALE.map((value) => (
                        <View key={value} style={styles.scaleCell}>
                          <AppText style={styles.scaleNumber} variant="bodyStrong">{value}</AppText>
                          {scores[axis.key] === value ? <PenCircle order={index} reduceMotion={reduceMotion} /> : null}
                        </View>
                      ))}
                      <AppText capScale style={[styles.scaleEnd, styles.scaleEndHigh]} tone="muted" variant="meta">{labelOf(axis.high)}</AppText>
                    </View>
                  </View>
                ))
              : null}

            <View accessibilityLabel={t`재방문 ${ph({ v1: labelOf(log.revisit) })}`} accessible style={styles.axisRow}>
              <AppText variant="button">{t`재방문 의사`}</AppText>
              <View style={styles.revisit}>
                {REVISIT_ROW.map((option) => (
                  <View key={option} style={styles.revisitCell}>
                    <AppText capScale style={styles.center} variant="button">{labelOf(option)}</AppText>
                    {log.revisit === option ? <PenCircle order={revisitOrder} reduceMotion={reduceMotion} /> : null}
                  </View>
                ))}
              </View>
            </View>
          </View>

          <AppText
            accessibilityLabel={t`이번 그릇 정리. ${ph({ v1: comment ?? "" })}`}
            accessibilityRole="summary"
            lineBreakStrategyIOS="hangul-word"
            style={styles.comment}
            tone="sub"
            variant="secondary"
          >
            {comment}
          </AppText>
        </View>
      </ScrollView>

      {/* 상태 표시줄 뒤도 화면 바탕과 같은 색으로 잇는다. */}
      <View pointerEvents="none" style={[styles.statusCap, { height: insets.top }]} />

      <ConfirmDialog
        cancelLabel={t`괜찮아요`}
        confirmLabel={t`알림 받기`}
        loading={reminder.busy}
        message={
          TASTE_REPORT_ENABLED
            ? t`이번 달 기록이 ${ph({ v1: MONTHLY_REPORT_TARGET })}그릇이 되면 다음 달 1일에 월간 리포트가 나와요. 마감 전과 기록이 일주일 뜸할 때만 알려드릴게요.`
            : t`기록이 일주일 뜸할 때만 알려드릴게요.`
        }
        onCancel={reminder.decline}
        onConfirm={() => void reminder.accept()}
        title={TASTE_REPORT_ENABLED ? t`다음 달 리포트가 나올 즈음 알려드릴까요?` : t`다음 라멘을 잊지 않게 알려드릴까요?`}
        visible={reminder.visible}
      />

      {/* 하단 고정 CTA. 처음부터 보인다. 알림을 거절했으면 버튼 위에 나중에 켜는 곳을 알려 준다 */}
      <StickyActionBar hint={reminder.declined ? t`알림은 나중에 마이 > 설정에서 켤 수 있어요` : undefined} style={styles.footer}>
        <View style={styles.actions}>
          {/* 취향 리포트를 숨긴 빌드에서는 홈으로가 하나뿐인 주요 행동이다 */}
          {TASTE_REPORT_ENABLED ? (
            <Button onPress={goTaste} size="large" textStyle={styles.actionText} title={t`취향 리포트 보기`} variant="primary" />
          ) : null}
          <Button onPress={goHome} size="large" textStyle={styles.actionText} title={t`홈으로`} variant={TASTE_REPORT_ENABLED ? "ghost" : "primary"} />
        </View>
      </StickyActionBar>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  center: { textAlign: "center" },
  tabular: { fontVariant: ["tabular-nums"] },
  stateArea: { flex: 1, justifyContent: "center", paddingHorizontal: spacing.gutter },
  scrollContent: { paddingBottom: spacing.x8 },
  statusCap: { position: "absolute", top: 0, left: 0, right: 0, backgroundColor: colors.paper },
  intro: { alignItems: "center", paddingHorizontal: spacing.gutter, paddingBottom: spacing.section },
  counter: { marginTop: spacing.x1, textAlign: "center" },
  body: { paddingHorizontal: spacing.x5 },
  sheet: { borderRadius: radii.sm, backgroundColor: colors.canvasSoft, overflow: "hidden" },
  rule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.x4,
    paddingTop: spacing.x4,
    paddingBottom: spacing.x3,
  },
  info: { flexDirection: "row", alignItems: "center", gap: spacing.x3, paddingHorizontal: spacing.x4, paddingVertical: spacing.x3 },
  infoRows: { flex: 1, minWidth: 0, gap: spacing.x1 },
  infoRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.x2 },
  infoLabel: { width: 28 },
  infoValue: { flexShrink: 1, fontWeight: "600" },
  photo: { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: radii.xs, backgroundColor: colors.secondary },
  axisRow: { paddingHorizontal: spacing.x4, paddingTop: spacing.x3, paddingBottom: spacing.x2_5 },
  scale: { flexDirection: "row", alignItems: "center", marginTop: spacing.x1_5 },
  scaleEnd: { width: 52 },
  scaleEndHigh: { textAlign: "right" },
  scaleCell: { flex: 1, height: 32, alignItems: "center", justifyContent: "center" },
  scaleNumber: { fontVariant: ["tabular-nums"] },
  // 칸보다 조금 넘치게 둘러 손으로 친 동그라미처럼 보이게 한다
  pen: { position: "absolute", top: -2, bottom: -2, left: 0, right: 0 },
  revisit: { flexDirection: "row", gap: spacing.x2, marginTop: spacing.x2 },
  revisitCell: { flex: 1, minHeight: 36, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.x1 },
  comment: { marginTop: spacing.x4, textAlign: "center", fontSize: 14, lineHeight: 20 },
  footer: { borderTopWidth: 0 },
  actions: { flex: 1, gap: spacing.x2 },
  actionText: { fontSize: 16, lineHeight: 20 },
})
