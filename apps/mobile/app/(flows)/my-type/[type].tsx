import { t, ph } from "@lingui/core/macro";
import { formatDate, getLocale, labelOf } from "@raota/shared"
import { useLocale } from "@/src/i18n"
import { Image } from "expo-image"
import { router, useLocalSearchParams } from "expo-router"
import { useEffect, useMemo } from "react"
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { sizedImageUri } from "@/src/api/imageSize"
import { AppText, EmptyState, Header, LoadingState, Screen } from "@/src/components/ui"
import { useAllShops, useMyBowls, useMyLogs, useMyLogsOfType } from "@/src/data"
import { bowlTypeOf, needsMoreLogs, toBowlRow, type BowlRow } from "@/src/domain/myBowls"
import { colors, radii, spacing, typography } from "@/src/theme"

/*
 * 마이 > 종류별 기록 > 한 종류 모아 보기(사용자 결정 2026.10.26).
 * 그 종류 그릇을 최신순 두 줄 사진 카드로 모으고, 위에 그릇 수·가게 수·처음과 최근 날짜·자주 간 곳을 요약한다.
 * 카드를 누르면 서버 기록은 기록 상세, 기기 기록은 매장을 연다. 비회원은 (flows)/_layout.tsx가 로그인으로 보낸다.
 */
export default function MyTypeScreen() {
  const locale = useLocale()
  const { type: rawType } = useLocalSearchParams<{ type?: string }>()
  const type = rawType ?? ""
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const bowlsQuery = useMyBowls()
  // 사진은 서버에서 이 종류 기록만 읽어 채운다(GET /members/me/ramen-logs?ramenType=). 마이가 이미 받아 둔 내 기록도 같이 쓴다
  const typeLogs = useMyLogsOfType(type)
  const { data: myLogs } = useMyLogs()
  const { data: shops } = useAllShops()
  const knownLogs = useMemo(() => [...typeLogs.data, ...myLogs], [myLogs, typeLogs.data])

  const rows = useMemo(
    () => bowlsQuery.data.filter((bowl) => bowlTypeOf(bowl) === type).map((bowl) => toBowlRow(bowl, knownLogs, shops)),
    [bowlsQuery.data, knownLogs, shops, type],
  )
  // 카드 사진이 아직 안 읽은 쪽에 있으면 이 종류의 다음 쪽을 읽는다
  const missingPhotos = needsMoreLogs(rows, knownLogs)
  const { hasMore, loadMore } = typeLogs
  useEffect(() => {
    if (missingPhotos && hasMore) loadMore()
  }, [hasMore, loadMore, missingPhotos, knownLogs.length])

  const summary = useMemo(() => summarize(rows), [rows, locale])
  const cardWidth = (width - spacing.gutter * 2 - spacing.x3) / 2

  const body = () => {
    if (!summary) {
      if (bowlsQuery.isLoading) return <LoadingState label={t`기록을 불러오는 중…`} style={styles.state} />
      return (
        <EmptyState
          description={t`이 종류로 남긴 기록이 생기면 여기에 모여요.`}
          style={styles.state}
          title={t`${ph({ v1: labelOf(type) })} 기록이 없어요`}
        />
      )
    }
    return (
      <>
        <View style={styles.summary}>
          <AppText variant="headline">{rows.length}{t`그릇`}</AppText>
          <AppText lineBreakStrategyIOS="hangul-word" tone="sub" variant="secondary">
            {summary.line}
          </AppText>
          {summary.favorite ? (
            <AppText lineBreakStrategyIOS="hangul-word" tone="sub" variant="secondary">
              {t`자주 간 곳 `}<AppText variant="bodyStrong">{summary.favorite.name}</AppText> {summary.favorite.count}{t`번 `}</AppText>
          ) : null}
        </View>
        <View style={styles.grid}>
          {rows.map((row, index) => (
            <BowlCard key={row.logId ?? `${row.date}-${row.name}-${row.menu}-${index}`} row={row} width={cardWidth} />
          ))}
        </View>
      </>
    )
  }

  return (
    <Screen>
      <Header
        align="center"
        backLabel={t`뒤로가기`}
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/native/my"))}
        title={t`${ph({ v1: labelOf(type) })} 모아 보기`}
        titleStyle={typography.sectionTitle}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.section }]} style={styles.scroll}>
        {body()}
      </ScrollView>
    </Screen>
  )
}

function BowlCard({ row, width }: { row: BowlRow; width: number }) {
  const opens = Boolean(row.logId || row.shop)
  return (
    <Pressable
      accessibilityLabel={`${row.name}${row.branch ? ` ${row.branch}` : ""}, ${row.menu}, ${dotted(row.date)}`}
      accessibilityRole={opens ? "button" : "text"}
      disabled={!opens}
      onPress={() => {
        if (row.logId) router.push({ pathname: "/log/[logId]", params: { logId: row.logId } })
        else if (row.shop) router.push({ pathname: "/shop/[shopId]", params: { shopId: row.shop.id } })
      }}
      style={({ pressed }) => [{ width }, pressed && styles.pressed]}
    >
      <View style={[styles.photo, { width, height: width }]}>
        {row.photo ? (
          <Image contentFit="cover" source={{ uri: sizedImageUri(row.photo, Math.round(width)) }} style={styles.fill} transition={150} />
        ) : (
          <AppText tone="sub" variant="headline">{row.name.slice(0, 1)}</AppText>
        )}
      </View>
      <AppText lineBreakStrategyIOS="hangul-word" numberOfLines={1} style={styles.cardName} variant="bodyStrong">
        {row.name}
        {row.branch ? <AppText tone="sub" variant="secondary">{` ${row.branch}`}</AppText> : null}
      </AppText>
      <AppText numberOfLines={1} tone="sub" variant="secondary">{row.menu}</AppText>
      <AppText capScale style={styles.tabular} tone="muted" variant="meta">{dotted(row.date)}</AppText>
    </Pressable>
  )
}

/** 2026-07-16 → 한국어는 2026.07.16, 다른 언어는 그 언어의 날짜 표기 */
const dotted = (date: string) => getLocale() === "ko" ? date.replaceAll("-", ".") : formatDate(date, { year: "numeric", month: "short", day: "numeric" })

/**
 * "가게 4곳 · 처음 2026.05.06 · 최근 2026.07.16"과, 두 번 넘게 간 곳이 있으면 가장 많이 간 곳.
 * 그릇이 없으면(불러오는 중·빈 종류) null
 */
function summarize(rows: BowlRow[]): { line: string; favorite: { name: string; count: number } | null } | null {
  if (!rows.length) return null
  const visits = new Map<string, { name: string; count: number }>()
  for (const row of rows) {
    const key = row.shopId ?? row.name
    const seen = visits.get(key)
    visits.set(key, { name: row.name, count: (seen?.count ?? 0) + 1 })
  }
  const dates = rows.map((row) => row.date).sort()
  const line = [t`가게 ${ph({ count: visits.size })}곳`, t`처음 ${ph({ date: dotted(dates[0]) })}`, rows.length > 1 ? t`최근 ${ph({ date: dotted(dates[dates.length - 1]) })}` : null]
    .filter(Boolean)
    .join(" · ")
  const top = [...visits.values()].sort((a, b) => b.count - a.count)[0]
  return { line, favorite: top && top.count > 1 ? top : null }
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: spacing.gutter, paddingTop: spacing.x3, gap: spacing.x6 },
  state: { flexGrow: 1 },
  summary: { gap: spacing.x1 },
  grid: { flexDirection: "row", flexWrap: "wrap", columnGap: spacing.x3, rowGap: spacing.x5 },
  photo: { borderRadius: radii.md, backgroundColor: colors.canvasSoft, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  fill: { width: "100%", height: "100%" },
  cardName: { marginTop: spacing.x2 },
  tabular: { fontVariant: ["tabular-nums"] },
  pressed: { opacity: 0.8 },
})
