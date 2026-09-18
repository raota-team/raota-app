import { useEffect, useMemo, useState } from "react"
import { router } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { ArrowRight, Check, Utensils } from "lucide-react-native"
import { Pressable, ScrollView, StyleSheet, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

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
  type MenuCategoryName,
  type PastReportItem,
} from "@raota/shared"
import { track } from "@/src/analytics"
import { AppText, Chip, EmptyState, Header, LoadingState } from "@/src/components/ui"
import { useMonthlyReports, useMyBowls } from "@/src/data"
import { colors, radii, spacing } from "@/src/theme"

/*
 * 월별 취향 변화. 웹 MonthlyTasteScreen과 같은 구성이다.
 * 월 선택(이번 달은 "집계 중") → 월 한정 제목 → 종류별 분포 막대 → 지난달 대비 %p 표 → 그 달 자주 간 곳 → 이번 달 집계 현황.
 * /taste/archive는 가장 최근 달, /taste/[reportId]는 그 달을 골라 연다.
 */

/** 웹 MENU_CATEGORIES와 같은 색. 색만으로 구분하지 않도록 늘 이름·수치와 함께 쓴다 */
export const MENU_CATEGORY_COLORS: Record<MenuCategoryName, { fill: string; text: string }> = {
  돈코츠: { fill: colors.brand, text: colors.onDark },
  쇼유: { fill: colors.ink, text: colors.onDark },
  시오: { fill: colors.textFaint, text: colors.ink },
  미소: { fill: colors.textMuted, text: colors.onDark },
  기타: { fill: colors.border, text: colors.ink },
}

type MonthItem = PastReportItem | CurrentMonthReport

// ---------------------------------------------------------------------------
// 분포 막대 (웹 MenuDistributionChart)
// ---------------------------------------------------------------------------

export function MenuDistributionChart({
  reports,
  selectedId,
  compact = false,
}: {
  reports: DistributionSource[]
  selectedId?: string
  compact?: boolean
}) {
  const includeYear = new Set(reports.map((report) => Math.floor(reportMonthIndex(report) / 12))).size > 1
  return (
    <View>
      <View style={{ gap: compact ? spacing.x3 : spacing.x5 }}>
        {reports.map((report) => {
          const { total, items } = menuDistribution(report)
          const selected = report.id === selectedId
          const inProgress = report.id === CURRENT_MONTH_ID
          const summary = total
            ? items
                .filter((item) => item.count > 0)
                .map((item) => `${item.name} ${item.count}그릇, ${item.pct}%`)
                .join(", ")
            : "기록 없음"
          return (
            <View key={report.id}>
              <View style={styles.chartHead}>
                <AppText
                  capScale
                  style={selected ? styles.bold : undefined}
                  tone={selected ? "ink" : "muted"}
                  variant="meta"
                >
                  {shortReportMonth(report, includeYear)}
                  {inProgress ? " · 집계 중" : selected && !compact ? " · 선택한 달" : ""}
                </AppText>
                <AppText capScale style={styles.tabular} tone="muted" variant="meta">
                  {total}그릇
                </AppText>
              </View>
              <View
                accessibilityLabel={`${report.period} 메뉴 분포. ${summary}`}
                accessibilityRole="image"
                accessible
                style={[styles.bar, compact ? styles.barCompact : styles.barFull]}
              >
                {total ? (
                  items
                    .filter((item) => item.count > 0)
                    .map((item) => (
                      <View
                        key={item.name}
                        style={[styles.barPart, { width: `${item.share}%`, backgroundColor: MENU_CATEGORY_COLORS[item.name].fill }]}
                      >
                        {!compact && item.pct >= 14 ? (
                          <AppText
                            capScale
                            numberOfLines={1}
                            style={[styles.bold, { color: MENU_CATEGORY_COLORS[item.name].text }]}
                            variant="meta"
                          >
                            {item.pct}%
                          </AppText>
                        ) : null}
                      </View>
                    ))
                ) : (
                  <AppText capScale style={styles.barEmpty} tone="muted" variant="meta">
                    기록 없음
                  </AppText>
                )}
              </View>
            </View>
          )
        })}
      </View>
      <View accessibilityLabel="메뉴 분포 범례" style={styles.legend}>
        {MENU_CATEGORY_NAMES.map((name) => (
          <View key={name} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: MENU_CATEGORY_COLORS[name].fill }]} />
            <AppText capScale tone="muted" variant="meta">
              {name}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// 마이의 월별 미리보기 (웹 MonthlyTastePreview)
// ---------------------------------------------------------------------------

export function MonthlyTastePreview({
  past,
  current,
  onOpen,
}: {
  past: PastReportItem[]
  current: CurrentMonthReport | null
  onOpen: () => void
}) {
  const months: DistributionSource[] = [...chronologicalReports(past), ...(current ? [current] : [])].slice(-3)
  const latest = months[months.length - 1]
  const distribution = menuDistribution(latest)
  const topCount = Math.max(0, ...distribution.items.map((item) => item.count))
  const leaders = distribution.items.filter((item) => item.count === topCount && item.count > 0)
  const latestIsCurrent = Boolean(current && latest?.id === current.id)

  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <AppText accessibilityRole="header" variant="sectionTitle">
          월별 취향 변화
        </AppText>
        <AppText capScale tone="muted" variant="meta">
          종류별 분포
        </AppText>
      </View>
      {latest ? (
        <>
          <AppText style={styles.gapTop2} tone="sub" variant="body">
            {distribution.total ? (
              <>
                {shortReportMonth(latest)}
                {latestIsCurrent ? "은 지금까지 " : "에 "}
                <AppText variant="bodyStrong">{leaders.map((item) => item.name).join("·")}</AppText>
                {"를 가장 많이 먹었어요."}
              </>
            ) : (
              "아직 이 달의 메뉴 기록이 없어요."
            )}
          </AppText>
          <View style={styles.gapTop4}>
            <MenuDistributionChart compact reports={months} selectedId={latest.id} />
          </View>
        </>
      ) : (
        <AppText style={styles.gapTop2} tone="sub" variant="body">
          아직 모인 월별 기록이 없어요. 먹은 라멘이 쌓이면 달마다 어떤 종류를 즐겼는지 비교할 수 있어요.
        </AppText>
      )}
      <Pressable
        accessibilityLabel={months.length > 1 ? "월별 분포 비교하기" : "월별 분포 보기"}
        accessibilityRole="button"
        onPress={onOpen}
        style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
      >
        <AppText variant="bodyStrong">{months.length > 1 ? "월별 분포 비교하기" : "월별 분포 보기"}</AppText>
        <ArrowRight color={colors.ink} size={16} />
      </Pressable>
    </View>
  )
}

// ---------------------------------------------------------------------------
// 이번 달 집계 현황 (웹 MonthlyReportCard)
// ---------------------------------------------------------------------------

function MonthlyReportCard({ counts, hasPrevious }: { counts: Record<string, number>; hasPrevious: boolean }) {
  const report = monthlyReportStatus(counts)
  const ready = report.remaining === 0
  const message = !hasPrevious
    ? `이번 달 ${MONTHLY_REPORT_TARGET}그릇 이상 모이면 다음 달부터 달라진 비율을 비교할 수 있어요.`
    : ready
      ? `${MONTHLY_REPORT_TARGET}그릇이 모여서 지난달과 비율을 비교할 수 있어요.`
      : `${report.remaining === 1 ? "한 그릇" : `${report.remaining}그릇`} 더 기록하면 지난달과 비율을 비교할 수 있어요. (한 달 ${MONTHLY_REPORT_TARGET}그릇부터)`
  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <AppText accessibilityRole="header" variant="sectionTitle">
          {report.month}월 집계 중
        </AppText>
        <AppText capScale style={styles.tabular} variant="secondary">
          {report.count}그릇
        </AppText>
      </View>
      <AppText style={styles.gapTop1} tone="sub" variant="secondary">
        기록을 남기면 이번 달 분포에 바로 더해져요. 이번 달이 {report.daysLeft}일 남았어요.
      </AppText>
      <View style={styles.divider} />
      <View
        accessibilityLabel="지난달과 비교하는 데 필요한 기록"
        accessibilityRole="progressbar"
        accessibilityValue={{
          min: 0,
          max: MONTHLY_REPORT_TARGET,
          now: Math.min(report.count, MONTHLY_REPORT_TARGET),
          text: `${report.count}그릇 기록, ${ready ? "지난달과 비교 가능" : `${report.remaining}그릇 더 필요`}`,
        }}
        style={styles.progressTrack}
      >
        <View style={[styles.progressFill, { width: `${report.progress * 100}%` }]} />
      </View>
      <View style={[styles.row, styles.gapTop2]}>
        {ready ? <Check color={colors.brand} size={16} /> : null}
        <AppText style={styles.flex} tone="sub" variant="secondary">
          {message}
        </AppText>
      </View>
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
    () => [...(monthly.current ? [monthly.current] : []), ...chronologicalReports(monthly.past).reverse()],
    [monthly],
  )
  const [selectedId, setSelectedId] = useState(initialSelectedId)
  const selectedIndex = Math.max(0, newestFirst.findIndex((report) => report.id === selectedId))
  const selected: MonthItem | undefined = newestFirst[selectedIndex]
  const previous: MonthItem | undefined = newestFirst[selectedIndex + 1]

  const monthCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const bowl of bowls) counts[monthKeyOfDate(bowl.date)] = (counts[monthKeyOfDate(bowl.date)] ?? 0) + 1
    return counts
  }, [bowls])

  useEffect(() => {
    track("report_viewed", { kind: "monthly" })
  }, [])

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/native/my"))

  const includeYear = Boolean(
    previous && selected && Math.floor(reportMonthIndex(previous) / 12) !== Math.floor(reportMonthIndex(selected) / 12),
  )
  const shortMonth = (report: DistributionSource) => shortReportMonth(report, includeYear)

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.root}>
      <StatusBar style="dark" />
      <Header onBack={goBack} title="월별 취향 변화" />
      {isLoading ? (
        <LoadingState fullScreen label="월별 기록을 불러오는 중…" />
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
              description="먹은 라멘을 기록하면 월별로 어떤 종류를 즐겼는지 비교할 수 있어요."
              icon={<Utensils color={colors.ink} size={28} />}
              style={styles.section}
              title="첫 달의 메뉴부터 모아볼까요?"
            />
          )}
          <View style={styles.section}>
            <MonthlyReportCard counts={monthCounts} hasPrevious={monthly.past.length > 0} />
          </View>
        </ScrollView>
      )}
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
  const distribution = menuDistribution(selected)
  const before = menuDistribution(previous)
  const inProgressMonth = isPastReport(selected) ? null : selected
  const past = isPastReport(selected) ? selected : null
  // 집계 중인 달은 실제 기록 수가 3그릇 이상일 때만 비교한다
  const enoughForCompare = !inProgressMonth || inProgressMonth.recordCount >= MONTHLY_REPORT_TARGET
  const canCompare = Boolean(previous && distribution.total && before.total && enoughForCompare)
  const previousLabel = previous && reportMonthIndex(selected) - reportMonthIndex(previous) === 1 ? "지난달" : "이전 기록"
  const differences = distribution.items.map((item, index) => ({ ...item, difference: item.pct - before.items[index].pct }))
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

  const compareHint = canCompare
    ? "각 달에 먹은 라멘의 종류별 비율을 비교해요."
    : inProgressMonth && previous && distribution.total
      ? `${remaining === 1 ? "한 그릇" : `${remaining}그릇`} 더 기록하면 ${shortMonth(previous)}과 비교할 수 있어요. 한 달 ${MONTHLY_REPORT_TARGET}그릇 미만이면 비교하지 않아요.`
      : previous
        ? "비교할 메뉴 기록이 모이면 비율 변화를 보여드려요."
        : "첫 월별 기록이에요. 다음 달부터 변화를 비교해요."

  return (
    <>
      {/* 월 선택. 이번 달은 "집계 중" */}
      <ScrollView
        accessibilityLabel="보는 달"
        accessibilityRole="tablist"
        contentContainerStyle={styles.monthChips}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {months.map((report) => {
          const active = report.id === selected.id
          const label = `${shortReportMonth(report)}${isPastReport(report) ? "" : " · 집계 중"}`
          return (
            <Chip
              accessibilityLabel={`${report.period}${isPastReport(report) ? "" : " 집계 중"}`}
              accessibilityRole="tab"
              key={report.id}
              label={label}
              onPress={() => onSelect(report.id)}
              selected={active}
            />
          )
        })}
      </ScrollView>

      <View style={[styles.section, styles.sectionDivider]}>
        <AppText accessibilityRole="header" variant="headline">
          {shortMonth(selected)}의 취향
        </AppText>
        {monthIdentity ? (
          <AppText style={styles.gapTop1} variant="cardTitle">
            {monthIdentity.title}
          </AppText>
        ) : inProgressMonth ? (
          <AppText style={styles.gapTop1} tone="sub" variant="cardTitle">
            아직 집계 중이에요
          </AppText>
        ) : null}
        <AppText style={styles.gapTop2} tone="sub" variant="body">
          {distribution.total ? (
            <>
              {distribution.total}그릇 중 <AppText variant="bodyStrong">{favorites.map((item) => item.name).join("·")}</AppText>
              {favorites.length > 1 ? "가 공동 1위예요." : `를 ${favoriteCount}그릇으로 가장 많이 먹었어요.`}
            </>
          ) : (
            "이 달에는 분포를 보여줄 메뉴 기록이 없어요."
          )}
        </AppText>
        {monthIdentity ? (
          <AppText style={styles.gapTop1} tone="sub" variant="secondary">
            {monthIdentity.evidence}
          </AppText>
        ) : null}
        {inProgressMonth && untyped > 0 ? (
          <AppText style={styles.gapTop1} tone="sub" variant="secondary">
            이번 달 {inProgressMonth.recordCount}그릇 중 종류가 확인된 {inProgressMonth.typedCount}그릇 기준이에요.
          </AppText>
        ) : null}
        {past ? (
          <View style={styles.note}>
            <AppText variant="body">{past.note}</AppText>
          </View>
        ) : null}
        <View style={styles.gapTop6}>
          <MenuDistributionChart reports={previous ? [previous, selected] : [selected]} selectedId={selected.id} />
        </View>
      </View>

      <View style={[styles.section, styles.sectionDivider]}>
        <AppText accessibilityRole="header" variant="sectionTitle">
          {canCompare ? `${previousLabel}과 달라진 메뉴` : "종류별로 먹은 라멘"}
        </AppText>
        <AppText style={styles.gapTop1} tone="sub" variant="secondary">
          {compareHint}
        </AppText>
        <View accessibilityLabel={`${selected.period} 라멘 종류별 그릇 수와 비율`} style={styles.table}>
          <View style={[styles.tableRow, styles.tableHead]}>
            <AppText capScale style={styles.colName} tone="muted" variant="secondary">
              종류
            </AppText>
            <AppText capScale style={styles.colNum} tone="muted" variant="secondary">
              그릇 수
            </AppText>
            <AppText capScale style={styles.colNum} tone="muted" variant="secondary">
              비율
            </AppText>
            {canCompare ? (
              <AppText capScale style={styles.colNum} tone="muted" variant="secondary">
                변화
              </AppText>
            ) : null}
          </View>
          {differences.map((item, index) => {
            const changeText = item.difference ? `${item.difference > 0 ? "+" : "−"}${Math.abs(item.difference)}%p` : "—"
            const changeLabel = item.difference
              ? `${Math.abs(item.difference)}퍼센트포인트 ${item.difference > 0 ? "증가" : "감소"}`
              : "변화 없음"
            return (
              <View
                accessibilityLabel={`${item.name} ${item.count}그릇, ${distribution.total ? `${item.pct}%` : "비율 없음"}${canCompare ? `, ${changeLabel}` : ""}`}
                accessible
                key={item.name}
                style={[styles.tableRow, index > 0 && styles.rowDivider]}
              >
                <View style={[styles.colName, styles.row]}>
                  <View style={[styles.swatch, { backgroundColor: MENU_CATEGORY_COLORS[item.name].fill }]} />
                  <AppText capScale variant="secondary" style={styles.bold}>
                    {item.name}
                  </AppText>
                </View>
                <AppText capScale style={[styles.colNum, styles.tabular]} tone="sub" variant="secondary">
                  {item.count}그릇
                </AppText>
                <AppText capScale style={[styles.colNum, styles.tabular, styles.bold]} variant="secondary">
                  {distribution.total ? `${item.pct}%` : "—"}
                </AppText>
                {canCompare ? (
                  <AppText
                    capScale
                    style={[styles.colNum, styles.tabular, item.difference > 0 && styles.bold]}
                    tone={item.difference > 0 ? "brand" : "sub"}
                    variant="secondary"
                  >
                    {changeText}
                  </AppText>
                ) : null}
              </View>
            )
          })}
        </View>
        {canCompare && previous ? (
          <View style={styles.compareSummary}>
            <AppText variant="body">
              {biggestChange.difference ? (
                <>
                  <AppText variant="bodyStrong">{biggestChange.name}</AppText> 비율이 {shortMonth(previous)}보다{" "}
                  <AppText variant="bodyStrong">
                    {Math.abs(biggestChange.difference)}%p {biggestChange.difference > 0 ? "늘었어요" : "줄었어요"}.
                  </AppText>
                </>
              ) : (
                "이전 기록과 메뉴 비율이 같아요."
              )}
            </AppText>
            <AppText style={styles.gapTop1} tone="muted" variant="meta">
              %p는 두 달의 비율 차이예요. 비율은 그릇 수를 기준으로 반올림했어요.
            </AppText>
          </View>
        ) : null}
      </View>

      {past && past.topShops.length > 0 ? (
        <View style={[styles.section, styles.sectionDivider]}>
          <AppText accessibilityRole="header" variant="sectionTitle">
            {shortMonth(past)}에 자주 간 라멘집
          </AppText>
          <View style={styles.gapTop2}>
            {past.topShops.map((shop, index) => (
              <View
                accessibilityLabel={`${index + 1}위 ${shop.name}${shop.branch ? ` ${shop.branch}` : ""}, ${shop.topMenu}, ${shop.visitCount}그릇`}
                accessible
                key={shop.name}
                style={[styles.shopRow, index > 0 && styles.rowDivider]}
              >
                <AppText style={[styles.rank, styles.tabular]} variant="bodyStrong">
                  {index + 1}
                </AppText>
                <View style={styles.flex}>
                  <AppText numberOfLines={1} variant="cardTitle">
                    {shop.name}
                    {shop.branch ? <AppText tone="sub" variant="secondary">{` ${shop.branch}`}</AppText> : null}
                  </AppText>
                  <AppText numberOfLines={1} tone="sub" variant="secondary">
                    {shop.topMenu}
                  </AppText>
                </View>
                <AppText style={styles.tabular} variant="bodyStrong">
                  {shop.visitCount}그릇
                </AppText>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </>
  )
}

export default function MonthlyTasteScreen() {
  return <MonthlyTasteView />
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  bold: { fontWeight: "700" },
  tabular: { fontVariant: ["tabular-nums"] },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.x2 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.x2 },
  gapTop1: { marginTop: spacing.x1 },
  gapTop2: { marginTop: spacing.x2 },
  gapTop4: { marginTop: spacing.x4 },
  gapTop6: { marginTop: spacing.x6 },
  pressed: { opacity: 0.6 },
  scroll: { paddingBottom: spacing.x8 },
  section: { paddingHorizontal: spacing.gutter, paddingVertical: spacing.x5 },
  sectionDivider: { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
  card: {
    backgroundColor: colors.canvas,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: spacing.x4,
  },
  divider: { height: 1, backgroundColor: colors.border, marginTop: spacing.x3, marginBottom: spacing.x3 },
  progressTrack: { height: 4, borderRadius: radii.pill, backgroundColor: colors.canvasSoft, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: radii.pill, backgroundColor: colors.brand },
  linkRow: {
    minHeight: 44,
    marginTop: spacing.x4,
    paddingTop: spacing.x3,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chartHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.x2 },
  bar: { flexDirection: "row", overflow: "hidden", backgroundColor: colors.canvasSoft },
  barCompact: { height: 12, borderRadius: radii.xs },
  barFull: { height: 36, borderRadius: radii.sm },
  barPart: { height: "100%", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  barEmpty: { margin: "auto", alignSelf: "center" },
  legend: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.x4, rowGap: spacing.x2, marginTop: spacing.x4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: spacing.x1_5 },
  swatch: { width: 10, height: 10, borderRadius: radii.xs },
  monthChips: { gap: spacing.x2, paddingHorizontal: spacing.gutter, paddingVertical: spacing.x4 },
  note: { marginTop: spacing.x3, paddingLeft: spacing.x3, borderLeftColor: colors.ink, borderLeftWidth: 1 },
  table: { marginTop: spacing.x4 },
  tableHead: { minHeight: 0, borderBottomColor: colors.border, borderBottomWidth: 1, paddingBottom: spacing.x3 },
  tableRow: { flexDirection: "row", alignItems: "center", minHeight: 44 },
  rowDivider: { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
  colName: { flex: 1.3 },
  colNum: { flex: 1, textAlign: "right" },
  compareSummary: { marginTop: spacing.x2, paddingTop: spacing.x4, borderTopColor: colors.border, borderTopWidth: 1 },
  shopRow: { flexDirection: "row", alignItems: "center", gap: spacing.x3, paddingVertical: spacing.x3 },
  rank: { width: 20 },
})
