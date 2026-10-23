import * as Haptics from "expo-haptics"
import { useEffect, useMemo } from "react"
import { router, useLocalSearchParams } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { SearchX } from "lucide-react-native"
import { Image } from "expo-image"
import { Platform, ScrollView, StyleSheet, View } from "react-native"
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { MONTHLY_REPORT_TARGET, TASTE_AXES, scoresFromLog, type RamenLog, type TasteAxisKey, type TasteProfile, type TasteScores } from "@raota/shared"
import { useBowlCount, useLog, useMonthlyReports, useTasteProfile } from "@/src/data"
import {
  AppText,
  Button,
  ConfirmDialog,
  EmptyState,
  LoadingState,
  StickyActionBar,
  TicketCut,
} from "@/src/components/ui"
import { InkStamp } from "@/src/components/InkStamp"
import { useRecordReminderPrompt } from "@/src/notifications"
import { sizedImageUri } from "@/src/api/imageSize"
import { colors, radii, spacing } from "@/src/theme"

/*
 * 저장한 기록을 사진과 다섯 평가가 있는 식권으로 보여 준다.
 * 작성 화면은 replace로 이 화면에 오므로 뒤로 스와이프해도 작성 중이던 기록으로 돌아가지 않는다.
 */

const STAMP_DURATION = 620
/** 화면이 밀려 들어오는 동안 찍히면 아무도 못 본다. iOS 스택 전환(약 350ms)이 끝난 뒤에 찍는다 */
const STAMP_DELAY = 420
/** 도장이 종이에 닿는 순간(진행률). 이때 잉크가 퍼지고 식권이 눌리고 손에 쿵 하고 전해진다 */
const STAMP_LAND = 0.48
const STAMP_SIZE = 92
const TICKET_PHOTO_HEIGHT = 190
const scoreLabels = {
  satisfaction: "만족도",
  brothDensity: "육수",
  noodleFirmness: "면",
  topping: "토핑",
  revisit: "재방문",
} as const

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

function formatStampDate(value: string): string {
  const parts = dateParts(value)
  return parts ? `${parts.year.slice(-2)}.${parts.month}.${parts.day}` : formatVisitDate(value)
}


/** 메모가 없을 때만, 이번 점수와 이전 평균의 가장 큰 차이를 사실 그대로 말한다 */
function bowlComment(log: RamenLog, scores: TasteScores | null, before: TasteProfile | null): string {
  const note = log.note.trim()
  if (note) return note
  if (!scores || !before) return "이 그릇도 기록으로 남겼어요."
  if (before.count === 0) return "첫 기록이에요."

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
  if (largestDifference === 0) return "평소와 비슷한 점수로 남긴 그릇이에요."

  const higher = scores[largestAxis] > average[largestAxis]
  switch (largestAxis) {
    case "satisfaction":
      return `평소보다 전체 만족도를 ${higher ? "높게" : "낮게"} 남긴 그릇이에요.`
    case "brothDensity":
      return `평소보다 육수를 ${higher ? "진하게" : "맑게"} 느낀 그릇이에요.`
    case "noodleFirmness":
      return `평소보다 면을 ${higher ? "단단하게" : "부드럽게"} 느낀 그릇이에요.`
    case "topping":
      return `평소보다 토핑 점수를 ${higher ? "높게" : "낮게"} 남긴 그릇이에요.`
    case "revisit":
      return `평소보다 재방문 의사를 ${higher ? "높게" : "낮게"} 남긴 그릇이에요.`
  }
}

export default function RecordCompleteScreen() {
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
  const comment = useMemo(() => (log ? bowlComment(log, scores, taste.before) : null), [log, scores, taste.before])
  const stampedLogId = log?.id

  // 저장된 그릇이 나타날 때 도장을 한 번만 누른다. 크게 들렸다 떨어져 눌리며 살짝 튀고 자리를 잡는다.
  // 동작 줄이기에서는 찍힌 상태부터 보여준다
  const stamp = useSharedValue(reduceMotion ? 1 : 0)
  const bloom = useSharedValue(reduceMotion ? 1 : 0)
  const thud = useSharedValue(0)
  useEffect(() => {
    if (stampedLogId == null) return
    if (reduceMotion) {
      stamp.value = 1
      bloom.value = 1
      return
    }
    const landAt = STAMP_DELAY + STAMP_DURATION * STAMP_LAND
    stamp.value = 0
    stamp.value = withDelay(STAMP_DELAY, withTiming(1, { duration: STAMP_DURATION, easing: Easing.out(Easing.quad) }))
    bloom.value = 0
    bloom.value = withDelay(landAt, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }))
    thud.value = withDelay(
      landAt - 40,
      withSequence(withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) })),
    )
    const timer = setTimeout(() => {
      if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined)
    }, landAt)
    return () => clearTimeout(timer)
  }, [stampedLogId, reduceMotion, stamp, bloom, thud])

  const stampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(stamp.value, [0, STAMP_LAND, 1], [0, 0.94, 0.92]),
    transform: [
      { rotate: `${interpolate(stamp.value, [0, STAMP_LAND, 0.62, 0.78, 1], [-26, -12, -15, -13.5, -14])}deg` },
      { scale: interpolate(stamp.value, [0, STAMP_LAND, 0.62, 0.78, 1], [2.6, 0.9, 1.06, 0.985, 1]) },
    ],
  }))
  // 닿는 순간 잉크가 번지듯 옅은 고리가 퍼졌다 사라진다
  const bloomStyle = useAnimatedStyle(() => ({
    opacity: interpolate(bloom.value, [0, 1], [0.35, 0]),
    transform: [{ scale: interpolate(bloom.value, [0, 1], [0.9, 1.2]) }],
  }))
  const ticketStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: thud.value * 3 }, { scale: 1 - thud.value * 0.012 }],
  }))

  const goHome = () => router.replace("/native")
  const goTaste = () => router.replace("/taste")

  if (!log) {
    return (
      <View style={styles.root}>
        <StatusBar style="auto" />
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

  const stampedAt = formatStampDate(log.visitedAt)
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
          <AppText tone="sub" variant="bodyStrong">기록이 저장됐어요</AppText>
          <AppText accessibilityLabel={`${bowlCount}번째 그릇`} accessibilityRole="header" style={styles.counter} variant="counter">
            {bowlCount}번째 그릇
          </AppText>
        </View>

        <View style={styles.body}>
          <Animated.View style={[styles.ticket, ticketStyle]}>
            <View style={styles.ticketHeader}>
              {photo ? (
                <Image accessibilityLabel={`${log.menuName} 사진`} contentFit="cover" source={{ uri: sizedImageUri(photo, 360) }} style={styles.ticketPhoto} />
              ) : (
                <View style={styles.ticketPhotoFallback}>
                  <AppText tone="muted" variant="meta">RAOTA 식권 · 한 그릇</AppText>
                </View>
              )}
            </View>
            <View style={styles.ticketMain}>
              <AppText lineBreakStrategyIOS="hangul-word" style={styles.menu} variant="cardTitle">
                {log.shop.name} · {log.menuName}
              </AppText>
              <View style={styles.shopMeta} testID="record-complete-meta">
                <AppText accessible accessibilityLabel={`라멘 종류 ${log.ramenType}`} accessibilityRole="text" capScale tone="muted" variant="meta">{log.ramenType}</AppText>
                <AppText accessibilityLabel={`${formatVisitDate(log.visitedAt)} 방문, ${bowlCount}번째 그릇`} capScale style={styles.shopMetaText} tone="muted" variant="meta">
                  {`· ${formatVisitDate(log.visitedAt)} · No. ${String(bowlCount).padStart(4, "0")}`}
                </AppText>
              </View>
            </View>
            <TicketCut />
            {scores ? (
              <View style={styles.scoreRow}>
                {TASTE_AXES.map((axis) => {
                  const value = axis.key === "revisit" ? log.revisit : scores[axis.key]
                  return (
                    <View
                      accessibilityLabel={`${axis.key === "revisit" ? "재방문" : axis.label} ${axis.key === "revisit" ? value : `${value}점`}`}
                      accessible
                      key={axis.key}
                      style={styles.scoreColumn}
                    >
                      <AppText capScale lineBreakStrategyIOS="hangul-word" style={styles.scoreValue} variant="cardTitle">
                        {axis.key === "revisit" ? (scores.revisit === 5 ? "자주" : scores.revisit === 3 ? "가끔" : "한 번") : value}
                      </AppText>
                      <AppText capScale lineBreakStrategyIOS="hangul-word" tone="muted" variant="meta">{scoreLabels[axis.key]}</AppText>
                    </View>
                  )
                })}
              </View>
            ) : null}
            {/* 사진이 아니라 식권 종이 위에 찍어야 잉크가 읽힌다. 절취선에 살짝 걸친다 */}
            <Animated.View pointerEvents="none" style={[styles.stamp, styles.stampBloom, bloomStyle]} />
            <Animated.View
              accessibilityLabel={`완식 도장, ${stampedAt}`}
              accessibilityRole="image"
              accessible
              pointerEvents="none"
              style={[styles.stamp, stampStyle]}
            >
              <InkStamp
                caption={`No.${String(bowlCount).padStart(4, "0")}`}
                ringText={`RAOTA ✦ 라멘 완식 인증 ✦ ${formatVisitDate(log.visitedAt)} ✦`}
                size={STAMP_SIZE}
                title="완식"
              />
            </Animated.View>
          </Animated.View>
          <AppText
            accessibilityLabel={`이번 그릇 정리. ${comment}`}
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
      <StickyActionBar style={styles.footer}>
        <View style={styles.actions}>
          <Button onPress={goTaste} size="large" textStyle={styles.actionText} title="취향 리포트 보기" variant="primary" />
          <Button onPress={goHome} size="large" textStyle={styles.actionText} title="홈으로" variant="ghost" />
        </View>
      </StickyActionBar>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  stateArea: { flex: 1, justifyContent: "center", paddingHorizontal: spacing.gutter },
  scrollContent: { paddingBottom: spacing.x8 },
  statusCap: { position: "absolute", top: 0, left: 0, right: 0, backgroundColor: colors.paper },
  intro: { alignItems: "center", paddingHorizontal: spacing.gutter, paddingBottom: spacing.section },
  counter: { marginTop: spacing.x1, textAlign: "center" },
  body: { paddingHorizontal: spacing.x5 },
  ticket: { borderRadius: radii.sm, backgroundColor: colors.canvasSoft },
  ticketHeader: { height: TICKET_PHOTO_HEIGHT },
  ticketPhoto: { width: "100%", height: "100%", borderTopLeftRadius: radii.sm, borderTopRightRadius: radii.sm },
  ticketPhotoFallback: {
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderTopLeftRadius: radii.sm,
    borderTopRightRadius: radii.sm,
    backgroundColor: colors.canvasSoft,
  },
  // 오른쪽은 도장 자리라 메뉴 이름이 그 앞에서 줄을 바꾼다
  ticketMain: { paddingLeft: spacing.x4, paddingRight: STAMP_SIZE, paddingTop: spacing.x4, paddingBottom: spacing.x4 },
  menu: { fontWeight: "700" },
  shopMeta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.x1_5, marginTop: spacing.x1 },
  shopMetaText: { minWidth: 0 },
  stamp: {
    position: "absolute",
    right: spacing.x2,
    top: TICKET_PHOTO_HEIGHT + spacing.x1,
    width: STAMP_SIZE,
    height: STAMP_SIZE,
  },
  stampBloom: { borderRadius: radii.pill, borderWidth: 4, borderColor: colors.brand },
  scoreRow: { flexDirection: "row", paddingHorizontal: spacing.x3, paddingTop: spacing.x4, paddingBottom: spacing.x4 },
  scoreColumn: { flex: 1, minWidth: 0, alignItems: "center", gap: spacing.x0_5 },
  scoreValue: { fontWeight: "700", fontVariant: ["tabular-nums"], fontSize: 20, lineHeight: 24 },
  comment: { marginTop: spacing.x4, textAlign: "center", fontSize: 14, lineHeight: 20 },
  footer: { borderTopWidth: 0 },
  actions: { flex: 1, gap: spacing.x2 },
  actionText: { fontSize: 16, lineHeight: 20 },
})
