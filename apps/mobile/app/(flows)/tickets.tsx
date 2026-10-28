import { t } from "@raota/shared"
import { useLocale } from "@/src/i18n"
import { router } from "expo-router"
import { Ticket } from "lucide-react-native"
import { useMemo, useState } from "react"
import { SectionList, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { TicketCard, ticketDay } from "@/src/components/TodayTicketsSheet"
import { AppText, EmptyState, Header, LoadingState, Screen } from "@/src/components/ui"
import { useTicketHistory } from "@/src/data"
import type { RemoteTicket } from "@/src/data/remote"
import { colors, spacing, typography } from "@/src/theme"

/*
 * 지난 식권: 지금까지 뽑은 AI 식권을 뽑은 날(서울)로 묶어 최신순으로 보여 준다(GET /ai/recommendations).
 * 식권을 누르면 오늘 식권처럼 그 식권의 추천 결과를 연다. 비회원은 (flows)/_layout.tsx가 로그인으로 보낸다.
 * 매장이 그사이 모두 추천에서 빠진 식권도 날짜와 장수가 맞도록 목록에 남는다("지금은 보여줄 가게가 없어요").
 */
export default function TicketHistoryScreen() {
  const locale = useLocale()
  const insets = useSafeAreaInsets()
  const history = useTicketHistory()
  const [refreshing, setRefreshing] = useState(false)
  const sections = useMemo(() => groupByDay(history.data), [history.data, locale])

  const refresh = async () => {
    setRefreshing(true)
    try {
      await history.refresh()
    } finally {
      setRefreshing(false)
    }
  }
  const open = (ticket: RemoteTicket) => router.push({ pathname: "/ai-recommend", params: { ticket: ticket.id } })

  const empty = !history.enabled ? (
    <EmptyState description={t("AI 큐레이터에서 식권을 뽑으면 여기에 날짜별로 쌓여요.")} icon={<Ticket color={colors.textMuted} size={32} />} style={styles.state} title={t("뽑은 식권이 없어요")} />
  ) : history.isLoading ? (
    <LoadingState label={t("식권을 불러오는 중…")} style={styles.state} />
  ) : history.error ? (
    <EmptyState
      actionLabel={t("다시 불러오기")}
      description={t("연결을 확인하고 다시 불러와 주세요.")}
      icon={<Ticket color={colors.textMuted} size={32} />}
      onAction={() => void refresh()}
      style={styles.state}
      title={t("지난 식권을 불러오지 못했어요")}
    />
  ) : (
    <EmptyState
      actionLabel={t("AI 추천받기")}
      description={t("AI 큐레이터에서 식권을 뽑으면 여기에 날짜별로 쌓여요.")}
      icon={<Ticket color={colors.textMuted} size={32} />}
      onAction={() => router.push("/ai-recommend")}
      style={styles.state}
      title={t("아직 뽑은 식권이 없어요")}
    />
  )

  return (
    <Screen>
      <Header
        align="center"
        backLabel={t("뒤로가기")}
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/native/my"))}
        title={t("지난 식권")}
        titleStyle={typography.sectionTitle}
      />
      <SectionList
        ListEmptyComponent={empty}
        ListFooterComponent={history.data.length && history.hasMore && history.isLoading ? <LoadingState label={t("더 불러오는 중…")} /> : null}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.section }]}
        keyExtractor={(ticket) => ticket.id}
        onEndReached={() => {
          if (history.hasMore && !history.isLoading && !history.error) history.loadMore()
        }}
        onEndReachedThreshold={0.6}
        onRefresh={history.enabled ? () => void refresh() : undefined}
        refreshing={refreshing}
        renderItem={({ item }) => <TicketCard onPress={() => open(item)} ticket={item} />}
        renderSectionHeader={({ section }) => (
          <AppText accessibilityRole="header" style={styles.day} tone="sub" variant="secondary">
            {t("{day} · {count}장", { day: section.title, count: section.data.length })}
          </AppText>
        )}
        sections={sections}
        stickySectionHeadersEnabled={false}
        style={styles.list}
        testID="ticket-history"
        ItemSeparatorComponent={() => <View style={styles.gap} />}
      />
    </Screen>
  )
}

/** 최신순 식권을 뽑은 날(서울)로 묶는다. 서버가 최신순으로 주므로 순서를 그대로 둔다 */
function groupByDay(tickets: RemoteTicket[]): { key: string; title: string; data: RemoteTicket[] }[] {
  const sections: { key: string; title: string; data: RemoteTicket[] }[] = []
  for (const ticket of tickets) {
    const day = ticketDay(ticket.createdAt)
    const last = sections.at(-1)
    if (last?.key === day.key) last.data.push(ticket)
    else sections.push({ key: day.key, title: day.label, data: [ticket] })
  }
  return sections
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: spacing.gutter },
  state: { flexGrow: 1 },
  day: { fontWeight: "700", paddingTop: spacing.x6, paddingBottom: spacing.x2 },
  gap: { height: spacing.x2 },
})
