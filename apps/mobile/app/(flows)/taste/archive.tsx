import { t, ph } from "@lingui/core/macro";
import { useLocale } from "@/src/i18n"
import { useEffect, useMemo, useState } from "react"
import { router } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { Utensils } from "lucide-react-native"
import { ScrollView, StyleSheet, View } from "react-native"
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"

import {
  CURRENT_MONTH_ID,
  MENU_CATEGORY_NAMES,
  MONTHLY_REPORT_TARGET,
  chronologicalReports,
  isPastReport,
  menuDistribution,
  monthKeyOfDate,
  monthlyReportStatus,
  reportMonthIndex,
  shortReportMonth,
  tasteIdentity,
  type CurrentMonthReport,
  type DistributionSource,
  type PastReportItem,
} from "@raota/shared"
import { track } from "@/src/analytics"
import { EdgeBackZone } from "@/src/components/EdgeBackZone"
import { AppText, Chip, EmptyState, Header, LoadingState, SoupDot } from "@/src/components/ui"
import { useMonthlyReports, useMyBowls } from "@/src/data"
import { colors, line, radii, soupColorOf, spacing, typography } from "@/src/theme"

/* 월별 취향 변화: 달 선택 → 취향 요약 → 지난달과 비교하는 분포 → 변화 표 → 자주 간 곳. */

/** Header 기본 높이(56pt). 가장자리 띠가 헤더 뒤로가기 버튼을 덮지 않게 그 아래에서 시작한다 */
const HEADER_HEIGHT = 56

type MonthItem = PastReportItem | CurrentMonthReport

// ---------------------------------------------------------------------------
// 분포 막대 (웹 MenuDistributionChart)
// ---------------------------------------------------------------------------

export function MenuDistributionChart({
  reports,
  selectedId,
}: {
  reports: DistributionSource[]
  selectedId?: string
}) {
  const includeYear = new Set(reports.map((report) => Math.floor(reportMonthIndex(report) / 12))).size > 1
  return (
    <View>
      <View style={styles.chartRows}>
        {reports.map((report, index) => (
          <DistributionBar
            includeYear={includeYear}
            index={index}
            key={`${selectedId}-${report.id}`}
            report={report}
            selectedId={selectedId}
          />
        ))}
      </View>
      <View accessibilityLabel={t`메뉴 분포 범례`} style={styles.legend}>
        {MENU_CATEGORY_NAMES.map((name) => (
          <View key={name} style={styles.legendItem}>
            <SoupDot type={name} size={10} />
            <AppText capScale tone="sub" variant="meta">
              {name}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  )
}

/**
 * 선택한 달이 바뀔 때 막대를 왼쪽에서 오른쪽으로 다시 펼친다.
 * 칸 너비는 처음부터 제 비율로 두고 바깥 알약의 너비만 늘린다. 칸마다 너비를 키우면 칸끼리 밀려 출렁여 보인다.
 */
function DistributionBar({
  includeYear,
  index,
  report,
  selectedId,
}: {
  includeYear: boolean
  index: number
  report: DistributionSource
  selectedId?: string
}) {
  const reducedMotion = useReducedMotion()
  const fill = useSharedValue(reducedMotion ? 1 : 0)
  const [trackWidth, setTrackWidth] = useState(0)
  const { total, items } = menuDistribution(report)
  const parts = items.filter((item) => item.count > 0)
  const selected = report.id === selectedId
  const inProgress = report.id === CURRENT_MONTH_ID
  const summary = total ? parts.map((item) => `${item.name} ${item.count}그릇, ${item.pct}%`).join(", ") : "기록 없음"

  useEffect(() => {
    if (reducedMotion) {
      fill.value = 1
      return
    }
    fill.value = 0
    fill.value = withDelay(index * 120, withTiming(1, { duration: 800, easing: Easing.bezier(0.22, 1, 0.36, 1) }))
    return () => cancelAnimation(fill)
  }, [fill, index, reducedMotion, selectedId])

  const reveal = useAnimatedStyle(() => ({ width: trackWidth * fill.value }))

  return (
    <View>
      <View style={styles.chartHead}>
        <AppText
          capScale
          numberOfLines={1}
          style={styles.chartMonth}
          tone={selected ? "ink" : "sub"}
          variant="meta"
        >
          {shortReportMonth(report, includeYear)}
          {inProgress ? t` · 집계 중` : selected ? t` · 선택한 달` : t` · 지난달`}
        </AppText>
        <AppText capScale style={[styles.tabular, styles.chartTotal]} tone="sub" variant="meta">
          {total}{t`그릇 `}</AppText>
      </View>
      <View
        accessibilityLabel={t`${ph({ v1: report.period })} 메뉴 분포. ${ph({ v2: summary })}`}
        accessibilityRole="image"
        accessible
        onLayout={({ nativeEvent }) => setTrackWidth(nativeEvent.layout.width)}
        style={[styles.bar, !total && styles.barEmptyTrack]}
      >
        {total ? (
          <Animated.View style={[styles.barReveal, reveal]}>
            <View style={[styles.barRow, { width: trackWidth }]}>
              {parts.map((item) => (
                <View key={item.name} style={[styles.barPart, { flexGrow: item.share, backgroundColor: soupColorOf(item.name) }]}>
                  {item.pct >= 14 ? (
                    <AppText capScale numberOfLines={1} style={[styles.barPercent, { color: lightSoup(item.name) ? colors.black : colors.white }]} variant="meta">
                      {item.pct}%
                    </AppText>
                  ) : null}
                </View>
              ))}
            </View>
          </Animated.View>
        ) : (
          <AppText capScale style={styles.barEmpty} tone="sub" variant="meta">
            {t`기록 없음 `}</AppText>
        )}
      </View>
    </View>
  )
}

/** 밝은 국물 칸 위에는 검정 글씨, 진한 칸 위에는 흰 글씨 */
function lightSoup(name: string) {
  return (
    name === "돈코츠" ||
    name === "시오" ||
    name === "미소" ||
    name === "토리파이탄" ||
    name === "니보시" ||
    name === "지로" ||
    name === "기타"
  )
}


// ---------------------------------------------------------------------------
// 이번 달 집계 현황 (웹 MonthlyReportCard)
// ---------------------------------------------------------------------------

function MonthlyReportCard({ counts, hasPrevious }: { counts: Record<string, number>; hasPrevious: boolean }) {
  const report = monthlyReportStatus(counts)
  const ready = report.remaining === 0
  const message = !hasPrevious ? t`이번 달 ${ph({ v1: MONTHLY_REPORT_TARGET })}그릇 이상 모이면 다음 달부터 달라진 비율을 비교할 수 있어요.` : ready ? t`${ph({ v1: MONTHLY_REPORT_TARGET })}그릇이 모여서 지난달과 비율을 비교할 수 있어요.` : t`${ph({ v1: report.remaining === 1 ? t`한 그릇` : t`${ph({ v1: report.remaining })}그릇` })} 더 기록하면 지난달과 비율을 비교할 수 있어요. (한 달 ${ph({ v2: MONTHLY_REPORT_TARGET })}그릇부터)`
  return (
    <View style={styles.nowCard}>
      <View style={styles.rowBetween}>
        <AppText accessibilityRole="header" variant="sectionTitle">
          {report.month}{t`월 집계 중 `}</AppText>
        <AppText capScale style={styles.tabular} variant="secondary">
          {report.count}{t`그릇 `}</AppText>
      </View>
      <AppText lineBreakStrategyIOS="hangul-word" style={styles.cardIntro} tone="sub" variant="secondary">
        {t`기록을 남기면 이번 달 분포에 바로 더해져요. 이번 달이 `}{report.daysLeft}{t`일 남았어요. `}</AppText>
      <View
        accessibilityLabel={t`지난달과 비교하는 데 필요한 기록`}
        accessibilityRole="progressbar"
        accessibilityValue={{
          min: 0,
          max: MONTHLY_REPORT_TARGET,
          now: Math.min(report.count, MONTHLY_REPORT_TARGET),
          text: t`${ph({ v1: report.count })}그릇 기록, ${ph({ v2: ready ? t`지난달과 비교 가능` : t`${ph({ v1: report.remaining })}그릇 더 필요` })}`,
        }}
        style={styles.progressTrack}
      >
        <View style={[styles.progressFill, { width: `${report.progress * 100}%` }]} />
      </View>
      <AppText capScale lineBreakStrategyIOS="hangul-word" style={styles.progressHint} tone="muted" variant="meta">
        {message}
      </AppText>
    </View>
  )
}

// ---------------------------------------------------------------------------
// 화면
// ---------------------------------------------------------------------------

export function MonthlyTasteView({ initialSelectedId }: { initialSelectedId?: string }) {
  const { data: monthly, isLoading } = useMonthlyReports()
  const { data: bowls } = useMyBowls()
  const newestFirst: MonthItem[] = useMemo(
    () => [...chronologicalReports(monthly.past).reverse(), ...(monthly.current ? [monthly.current] : [])],
    [monthly],
  )
  const [selectedId, setSelectedId] = useState(initialSelectedId)
  const selectedIndex = Math.max(0, newestFirst.findIndex((report) => report.id === selectedId))
  const selected: MonthItem | undefined = newestFirst[selectedIndex]
  const olderReport = newestFirst[selectedIndex + 1]
  const previous: MonthItem | undefined = selected?.id === CURRENT_MONTH_ID
    ? newestFirst.length > 1 ? newestFirst[0] : undefined
    : olderReport && isPastReport(olderReport) ? olderReport : undefined

  const monthCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const bowl of bowls) counts[monthKeyOfDate(bowl.date)] = (counts[monthKeyOfDate(bowl.date)] ?? 0) + 1
    return counts
  }, [bowls])

  useEffect(() => {
    track("report_viewed", { kind: "monthly" })
  }, [])

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/native/my"))
  const insets = useSafeAreaInsets()

  const includeYear = Boolean(
    previous && selected && Math.floor(reportMonthIndex(previous) / 12) !== Math.floor(reportMonthIndex(selected) / 12),
  )
  const shortMonth = (report: DistributionSource) => shortReportMonth(report, includeYear)

  return (
    <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.root}>
      <StatusBar style="auto" />
      <Header align="center" onBack={goBack} title={t`월별 취향 변화`} titleStyle={typography.sectionTitle} />
      {isLoading ? (
        <LoadingState fullScreen label={t`월별 기록을 불러오는 중…`} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {selected ? (
            <MonthDetail
              months={newestFirst}
              onSelect={setSelectedId}
              previous={previous}
              selected={selected}
              shortMonth={shortMonth}
            />
          ) : (
            <EmptyState
              description={t`먹은 라멘을 기록하면 월별로 어떤 종류를 즐겼는지 비교할 수 있어요.`}
              icon={<Utensils color={colors.ink} size={28} />}
              style={styles.section}
              title={t`첫 달의 메뉴부터 모아볼까요?`}
            />
          )}
          <View style={styles.section}>
            <MonthlyReportCard counts={monthCounts} hasPrevious={monthly.past.length > 0} />
          </View>
        </ScrollView>
      )}
      <EdgeBackZone top={insets.top + HEADER_HEIGHT} />
    </SafeAreaView>
  )
}

function MonthDetail({
  months,
  selected,
  previous,
  onSelect,
  shortMonth,
}: {
  months: MonthItem[]
  selected: MonthItem
  previous: MonthItem | undefined
  onSelect: (id: string) => void
  shortMonth: (report: DistributionSource) => string
}) {
  const reducedMotion = useReducedMotion()
  const comparisonOpacity = useSharedValue(reducedMotion ? 1 : 0)
  useEffect(() => {
    if (reducedMotion) {
      comparisonOpacity.value = 1
      return
    }
    comparisonOpacity.value = 0
    comparisonOpacity.value = withDelay(180, withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }))
    return () => cancelAnimation(comparisonOpacity)
  }, [comparisonOpacity, reducedMotion, selected.id])
  const comparisonStyle = useAnimatedStyle(() => ({ opacity: comparisonOpacity.value }))
  const distribution = menuDistribution(selected)
  const before = menuDistribution(previous)
  const inProgressMonth = isPastReport(selected) ? null : selected
  const past = isPastReport(selected) ? selected : null
  // 집계 중인 달은 실제 기록 수가 3그릇 이상일 때만 비교한다
  const enoughForCompare = !inProgressMonth || inProgressMonth.recordCount >= MONTHLY_REPORT_TARGET
  const canCompare = Boolean(previous && distribution.total && before.total && enoughForCompare)
  const previousLabel = previous && reportMonthIndex(selected) - reportMonthIndex(previous) === 1 ? t`지난달` : t`이전 기록`
  const differences = distribution.items.map((item, index) => ({ ...item, difference: item.pct - before.items[index].pct }))
  const tableRows = differences
  const biggestChange = [...differences].sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))[0]
  const favoriteCount = Math.max(...distribution.items.map((item) => item.count))
  const favorites = distribution.items.filter((item) => item.count === favoriteCount && item.count > 0)
  const monthIdentity = past
    ? tasteIdentity(
        Object.fromEntries(past.styleRows.map((row) => [row.name, row.count])),
        { count: past.recordCount, scores: past.scores },
        shortMonth(past),
      )
    : null
  const untyped = inProgressMonth ? inProgressMonth.recordCount - inProgressMonth.typedCount : 0
  const remaining = inProgressMonth ? MONTHLY_REPORT_TARGET - inProgressMonth.recordCount : 0

  const compareHint = canCompare ? t`각 달에 먹은 라멘의 종류별 비율을 비교해요.` : inProgressMonth && previous && distribution.total ? t`${ph({ v1: remaining === 1 ? t`한 그릇` : t`${ph({ v1: remaining })}그릇` })} 더 기록하면 ${ph({ v2: shortMonth(previous) })}과 비교할 수 있어요. 한 달 ${ph({ v3: MONTHLY_REPORT_TARGET })}그릇 미만이면 비교하지 않아요.` : previous ? t`비교할 메뉴 기록이 모이면 비율 변화를 보여드려요.` : t`첫 월별 기록이에요. 다음 달부터 변화를 비교해요.`

  return (
    <>
      {/* 월 선택. 이번 달은 "집계 중" */}
      <ScrollView
        accessibilityLabel={t`보는 달`}
        accessibilityRole="tablist"
        contentContainerStyle={styles.monthChips}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {months.map((report) => {
          const active = report.id === selected.id
          const label = isPastReport(report) ? shortReportMonth(report) : t`${ph({ month: shortReportMonth(report) })} · 집계 중`
          return (
            <Chip
              accessibilityLabel={t`${ph({ v1: report.period })}${ph({ v2: isPastReport(report) ? "" : " 집계 중" })}`}
              accessibilityRole="tab"
              key={report.id}
              label={label}
              onPress={() => onSelect(report.id)}
              selected={active}
            />
          )
        })}
      </ScrollView>

      <View style={styles.monthIntro}>
        <View style={styles.monthTitle}>
          <AppText accessibilityRole="header" tone={monthIdentity ? "sub" : "ink"} variant={monthIdentity ? "secondary" : "screenTitle"}>
            {shortMonth(selected)}{t`의 취향 `}</AppText>
          {monthIdentity ? (
            <AppText lineBreakStrategyIOS="hangul-word" style={styles.gapTop1} variant="headline">
              {monthIdentity.title}
            </AppText>
          ) : inProgressMonth ? (
            <AppText style={styles.gapTop1} tone="sub" variant="cardTitle">
              {t`아직 집계 중이에요 `}</AppText>
          ) : null}
        </View>
        <AppText lineBreakStrategyIOS="hangul-word" style={styles.monthSummary} tone="sub" variant="secondary">
          {distribution.total ? (
            <>
              {distribution.total}{t`그릇 중`}{" "}
              <AppText style={styles.bold} variant="secondary">
                {favorites.map((item) => item.name).join("·")}
              </AppText>
              {favorites.length > 1 ? t`가 공동 1위예요.` : t`를 ${ph({ v1: favoriteCount })}그릇으로 가장 많이 먹었어요.`}
            </>
          ) : (
            t`이 달에는 분포를 보여줄 메뉴 기록이 없어요.`
          )}
        </AppText>
        {monthIdentity ? (
          <AppText lineBreakStrategyIOS="hangul-word" style={styles.gapTop1} tone="muted" variant="meta">
            {monthIdentity.evidence}
          </AppText>
        ) : null}
        {inProgressMonth && untyped > 0 ? (
          <AppText lineBreakStrategyIOS="hangul-word" style={styles.gapTop1} tone="sub" variant="secondary">
            {t`이번 달 `}{inProgressMonth.recordCount}{t`그릇 중 종류가 확인된 `}{inProgressMonth.typedCount}{t`그릇 기준이에요. `}</AppText>
        ) : null}
        {past ? (
          <View style={styles.note}>
            <AppText lineBreakStrategyIOS="hangul-word" tone="sub" variant="secondary">{past.note}</AppText>
          </View>
        ) : null}
      </View>
      <View style={styles.chartCard}>
        <MenuDistributionChart reports={previous ? [previous, selected] : [selected]} selectedId={selected.id} />
      </View>

      <View style={styles.section}>
        <AppText accessibilityRole="header" variant="sectionTitle">
          {/* 표는 메뉴가 아니라 국물 종류를 비교한다 */}
          {canCompare ? t`${ph({ v1: previousLabel })}과 달라진 종류` : t`종류별로 먹은 라멘`}
        </AppText>
        <AppText lineBreakStrategyIOS="hangul-word" style={styles.compareHint} tone="sub" variant="secondary">
          {compareHint}
        </AppText>
        {/* 종류가 확인된 그릇이 없는 달은 0그릇 줄만 늘어놓지 않고 표를 감춘다(위 요약이 이유를 말한다) */}
        {distribution.total ? (
          <View accessibilityLabel={t`${ph({ v1: selected.period })} 라멘 종류별 그릇 수와 비율`} style={styles.table}>
            <View style={[styles.tableRow, styles.tableHead]}>
              <AppText capScale style={styles.colName} tone="sub" variant="secondary">
                {t`종류 `}</AppText>
              <AppText capScale style={styles.colNum} tone="sub" variant="secondary">
                {t`그릇 수 `}</AppText>
              <AppText capScale style={styles.colNum} tone="sub" variant="secondary">
                {t`비율 `}</AppText>
              <View style={styles.changeNum}>
                {canCompare ? <AppText capScale tone="sub" variant="secondary">{t`변화`}</AppText> : null}
              </View>
            </View>
            {tableRows.map((item) => {
              // 변화가 없으면 칸을 비운다. "—"를 두지 않고 줄 라벨이 "변화 없음"을 읽어 준다
              const changeText = item.difference ? `${item.difference > 0 ? "+" : "−"}${Math.abs(item.difference)}%p` : ""
              const changeLabel = item.difference ? t`${ph({ v1: Math.abs(item.difference) })}퍼센트포인트 ${ph({ v2: item.difference > 0 ? t`증가` : t`감소` })}` : t`변화 없음`
              return (
                <View
                  accessibilityLabel={t`${ph({ v1: item.name })} ${ph({ v2: item.count })}그릇, ${ph({ v3: item.pct })}%${ph({ v4: canCompare ? `, ${changeLabel}` : "" })}`}
                  accessible
                  key={item.name}
                  style={styles.tableRow}
                >
                  <AppText capScale variant="secondary" style={[styles.colName, styles.bold]}>
                    {item.name}
                  </AppText>
                  <AppText capScale style={[styles.colNum, styles.tabular]} tone="sub" variant="secondary">
                    {item.count}{t`그릇 `}</AppText>
                  <AppText capScale style={[styles.colNum, styles.tabular, styles.bold]} variant="secondary">
                    {item.pct}%
                  </AppText>
                  {canCompare ? (
                    <Animated.View style={[styles.changeNum, comparisonStyle]}>
                      <AppText
                        capScale
                        // 늘고 줌은 수량이라 빨강 대신 굵기로 말한다(+/− 기호와 라벨이 방향을 읽어 준다)
                        style={[styles.tabular, item.difference > 0 && styles.bold]}
                        tone={item.difference > 0 ? "ink" : "sub"}
                        variant="secondary"
                      >
                        {changeText}
                      </AppText>
                    </Animated.View>
                  ) : (
                    <View style={styles.changeNum} />
                  )}
                </View>
              )
            })}
          </View>
        ) : null}
        <View style={styles.compareSummarySlot}>
          {canCompare && previous ? (
            <AppText lineBreakStrategyIOS="hangul-word" style={styles.compareSummary} variant="secondary">
              {biggestChange.difference ? (
                <>
                  <AppText style={styles.bold} variant="secondary">{biggestChange.name}</AppText> {t` 비율이 `}{shortMonth(previous)}{t`보다`}{" "}
                  <AppText style={styles.bold} variant="secondary">
                    {Math.abs(biggestChange.difference)}%p {biggestChange.difference > 0 ? t`늘었어요` : t`줄었어요`}.
                  </AppText>
                </>
              ) : (
                t`이전 기록과 메뉴 비율이 같아요.`
              )}
            </AppText>
          ) : null}
        </View>
      </View>

      {past && past.topShops.length > 0 ? (
        <View style={styles.section}>
          <AppText accessibilityRole="header" variant="sectionTitle">
            {shortMonth(past)}{t`에 자주 간 라멘집 `}</AppText>
          <View style={styles.sectionContent}>
            {past.topShops.map((shop, index) => (
              <View
                accessibilityLabel={t`${ph({ v1: index + 1 })}위 ${ph({ v2: shop.name })}${ph({ v3: shop.branch ? ` ${shop.branch}` : "" })}, ${ph({ v4: shop.topMenu })}, ${ph({ v5: shop.visitCount })}그릇`}
                accessible
                key={shop.name}
                style={[styles.shopRow, index > 0 && styles.shopDivider]}
              >
                <AppText capScale style={[styles.rank, index === 0 && styles.rankSelected, styles.tabular]} variant="meta">
                  {index + 1}
                </AppText>
                <View style={styles.flex}>
                  <AppText lineBreakStrategyIOS="hangul-word" numberOfLines={2} variant="cardTitle">
                    {shop.name}
                    {shop.branch ? <AppText tone="sub" variant="secondary">{` ${shop.branch}`}</AppText> : null}
                  </AppText>
                  <AppText lineBreakStrategyIOS="hangul-word" numberOfLines={2} style={styles.gapTop1} tone="sub" variant="secondary">
                    {shop.topMenu}
                  </AppText>
                </View>
                <AppText style={styles.tabular} variant="bodyStrong">
                  {shop.visitCount}{t`그릇 `}</AppText>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </>
  )
}

export default function MonthlyTasteScreen() {
  useLocale()
  return <MonthlyTasteView />
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  bold: { fontWeight: "700" },
  tabular: { fontVariant: ["tabular-nums"] },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.x2 },
  gapTop1: { marginTop: spacing.x1 },
  gapTop2: { marginTop: spacing.x2 },
  monthSummary: { marginTop: spacing.x1_5 },
  monthTitle: { minHeight: (typography.secondary.lineHeight ?? 20) + spacing.x1 + (typography.headline.lineHeight ?? 34) },
  scroll: { paddingBottom: spacing.x8 },
  // Keep the chart at the same vertical anchor when evidence, an untyped hint or a note changes with the month.
  monthIntro: { paddingHorizontal: spacing.gutter, marginTop: spacing.x1, minHeight: 216 },
  section: { paddingHorizontal: spacing.gutter, marginTop: spacing.x8 },
  sectionContent: { marginTop: spacing.x3 },
  compareHint: { marginTop: spacing.x3, minHeight: (typography.secondary.lineHeight ?? 20) * 3 },
  nowCard: { padding: spacing.x4, borderRadius: radii.sm, backgroundColor: colors.canvasSoft },
  cardIntro: { marginTop: spacing.x3, minHeight: (typography.secondary.lineHeight ?? 20) * 2 },
  chartCard: { marginHorizontal: spacing.gutter, marginTop: spacing.x6, padding: spacing.x4, borderRadius: radii.sm, backgroundColor: colors.canvasSoft },
  progressTrack: { height: 4, marginTop: spacing.x3, borderRadius: radii.pill, backgroundColor: colors.secondary, overflow: "hidden" },
  // 모인 그릇 수는 정보라서 채움은 빨강이 아니라 먹색이다(마이의 등급 막대와 같다)
  progressFill: { height: "100%", borderRadius: radii.pill, backgroundColor: colors.ink },
  progressHint: { marginTop: spacing.x2, minHeight: (typography.meta.lineHeight ?? 18) * 3 },
  chartRows: { gap: spacing.x4, minHeight: ((typography.meta.lineHeight ?? 18) + spacing.x1_5 + spacing.x8) * 2 + spacing.x4 },
  chartHead: { flexDirection: "row", justifyContent: "space-between", gap: spacing.x2, marginBottom: spacing.x1_5 },
  chartMonth: { flex: 1, minWidth: 0, fontWeight: "700" },
  chartTotal: { flexShrink: 0 },
  bar: { height: spacing.x8, borderRadius: radii.pill, overflow: "hidden" },
  barEmptyTrack: { backgroundColor: colors.secondary },
  barReveal: { height: "100%", overflow: "hidden", borderRadius: radii.pill },
  // 칸 사이 2pt 틈으로 경계를 나눈다. 틈은 카드 면이 비쳐 보이게 비워 둔다
  barRow: { height: "100%", flexDirection: "row", gap: 2 },
  barPart: { flexBasis: 0, minWidth: 6, height: "100%", borderRadius: 4, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  barPercent: { fontWeight: "700" },
  barEmpty: { margin: "auto", alignSelf: "center" },
  legend: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.x3, rowGap: spacing.x1_5, marginTop: spacing.x3 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: spacing.x1_5 },
  monthChips: { gap: spacing.x2, paddingHorizontal: spacing.gutter, paddingVertical: spacing.x3 },
  // 메모 인용은 색 세로줄 없이 본문 그대로 둔다
  note: { marginTop: spacing.x3 },
  table: { marginTop: spacing.x3 },
  tableHead: { minHeight: 30 },
  tableRow: { flexDirection: "row", alignItems: "center", minHeight: 44, paddingVertical: spacing.x3, borderBottomColor: colors.border, borderBottomWidth: line.hair },
  shopDivider: { borderTopColor: colors.border, borderTopWidth: line.hair },
  colName: { flex: 1.3 },
  colNum: { flex: 1, textAlign: "right" },
  changeNum: { flex: 1, alignItems: "flex-end" },
  compareSummarySlot: { minHeight: (typography.secondary.lineHeight ?? 20) * 2 + spacing.x3 },
  compareSummary: { marginTop: spacing.x3 },
  shopRow: { flexDirection: "row", alignItems: "center", gap: spacing.x3, paddingVertical: spacing.x3 },
  rank: { width: 28, height: 28, borderRadius: radii.pill, overflow: "hidden", backgroundColor: colors.canvasSoft, color: colors.ink, textAlign: "center", textAlignVertical: "center", lineHeight: 28, fontWeight: "700" },
  rankSelected: { backgroundColor: colors.selected, color: colors.onSelected },
})
