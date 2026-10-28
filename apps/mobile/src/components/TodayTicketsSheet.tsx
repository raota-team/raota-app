import { t, ph } from "@lingui/core/macro";
import { useLocale } from "@/src/i18n"
import { formatDate, getLocale } from "@raota/shared"
import { ChevronRight, Ticket } from "lucide-react-native"
import { Pressable, StyleSheet, View } from "react-native"
import Svg, { Line } from "react-native-svg"

import { ResilientUriImage } from "@/src/components/ResilientUriImage"
import { AppText, BottomSheet } from "@/src/components/ui"
import type { RemoteTicket, RemoteTodayTickets } from "@/src/data/remote"
import { colors, line, pressFade, radii, soup, spacing, ticketInk, ticketPaperOf, touchTarget } from "@/src/theme"

const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"]

function seoulParts(date: Date) {
  const seoul = new Date(date.getTime() + SEOUL_OFFSET_MS)
  return {
    date: getLocale() === "ko" ? `${seoul.getUTCFullYear()}년 ${seoul.getUTCMonth() + 1}월 ${seoul.getUTCDate()}일` : formatDate(date, { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Seoul" }),
    weekday: getLocale() === "ko" ? WEEKDAYS[seoul.getUTCDay()] : formatDate(date, { weekday: "short", timeZone: "Asia/Seoul" }),
    time: `${String(seoul.getUTCHours()).padStart(2, "0")}:${String(seoul.getUTCMinutes()).padStart(2, "0")}`,
  }
}

/** 뽑은 시각을 서울 기준 "2026년 10월 23일 11:05"로 */
export function ticketIssuedAt(iso: string): string {
  const { date, time } = seoulParts(new Date(iso))
  return `${date} ${time}`
}

/** 뽑은 날(서울)로 묶을 때의 키와 머리 글 "2026년 10월 23일 (목)" */
export function ticketDay(iso: string): { key: string; label: string } {
  const { date, weekday } = seoulParts(new Date(iso))
  const seoul = new Date(new Date(iso).getTime() + SEOUL_OFFSET_MS)
  return { key: seoul.toISOString().slice(0, 10), label: `${date} (${weekday})` }
}

/**
 * 식권 한 장. 발권 화면과 같은 색종이 식권(국물 색을 흰 종이에 섞은 색)에, 오른쪽 꼬리에 시각을 적는다.
 * 그날 몇 번째인지 알 때만(오늘 식권) No.를 함께 적는다.
 */
export function TicketCard({ ticket, number, onPress }: { ticket: RemoteTicket; number?: number; onPress: () => void }) {
  useLocale()
  const first = ticket.shops[0]
  const photo = first?.photos.find(Boolean)
  // 종이 색은 그 식권에 고른 국물. 조건에 없으면 첫 매장의 종류로 정한다
  const type = ticket.appliedConditions.find((label) => label in soup) ?? first?.ramenTypes?.[0] ?? ""
  return (
    <Pressable
      accessibilityHint={t`이 식권의 추천을 다시 봐요`}
      accessibilityLabel={t`${ph({ p0: ticketIssuedAt(ticket.createdAt) })}에 뽑은 식권, ${ph({ p1: first ? first.name : t`보여줄 가게 없음` })}, ${ph({ p2: ticket.appliedConditions.join(", ") })}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, { backgroundColor: ticketPaperOf(type) }, pressed && pressFade]}
      testID="ai-ticket-row"
    >
      <View style={styles.thumb}>
        {photo ? (
          <ResilientUriImage accessibilityLabel="" style={StyleSheet.absoluteFill} uri={photo} />
        ) : (
          <Ticket color={ticketInk.muted} size={22} />
        )}
      </View>
      {/* 글 묶음이 남은 폭을 모두 차지해야 오른쪽 꼬리가 칸마다 같은 자리에 선다 */}
      <View style={styles.copy}>
        <AppText lineBreakStrategyIOS="hangul-word" numberOfLines={1} style={styles.ink} variant="bodyStrong">
          {first ? first.name : t`지금은 보여줄 가게가 없어요`}
        </AppText>
        {ticket.appliedConditions.length ? (
          <AppText lineBreakStrategyIOS="hangul-word" numberOfLines={2} style={styles.muted} variant="meta">
            {ticket.appliedConditions.join(" · ")}
          </AppText>
        ) : null}
      </View>
      <View style={styles.rule}>
        {/* iOS는 한 변짜리 dashed 테두리를 못 그려 SVG로 긋는다. 칸 높이를 정하지 않게 겹쳐 그린다 */}
        <Svg height="100%" style={StyleSheet.absoluteFill} width={line.base}>
          <Line stroke={ticketInk.rule} strokeDasharray="4 4" strokeWidth={line.base} x1={line.base / 2} x2={line.base / 2} y1={0} y2="100%" />
        </Svg>
      </View>
      <View style={styles.stub}>
        {number !== undefined ? <AppText capScale style={[styles.muted, styles.stamp]} variant="meta">{`No.${number}`}</AppText> : null}
        <AppText capScale style={[styles.muted, styles.tabular]} variant="meta">{seoulParts(new Date(ticket.createdAt)).time}</AppText>
      </View>
    </Pressable>
  )
}

/**
 * 오늘 뽑은 AI 식권 목록. 홈과 AI 큐레이터가 같이 쓴다. 고르면 그 식권의 추천 결과를 연다.
 * 모두 오늘 뽑은 식권이라 날짜는 머리에 한 번만 적고, 다른 날 식권은 아래 "지난 식권 보기"로 연다.
 */
export function TodayTicketsSheet({
  visible,
  today,
  onClose,
  onSelect,
  onHistory,
}: {
  visible: boolean
  today: RemoteTodayTickets | null
  onClose: () => void
  onSelect: (ticket: RemoteTicket) => void
  /** 지난 식권 화면을 연다. 없으면 링크를 두지 않는다 */
  onHistory?: () => void
}) {
  useLocale()
  const now = seoulParts(new Date())
  const count = today?.tickets.length ?? 0
  return (
    <BottomSheet
      description={today ? t`${ph({ p0: now.date })} (${ph({ p1: now.weekday })}) · 하루 ${ph({ p2: today.dailyLimit })}장, 자정에 다시 채워져요` : undefined}
      onClose={onClose}
      title={t`오늘 뽑은 식권`}
      visible={visible}
    >
      <View style={styles.list}>
        {/* 최신순 목록이라 처음 뽑은 식권이 No.1이다 */}
        {today?.tickets.map((ticket, index) => (
          <TicketCard key={ticket.id} number={count - index} onPress={() => onSelect(ticket)} ticket={ticket} />
        ))}
        {onHistory ? (
          <Pressable
            accessibilityHint={t`다른 날 뽑은 식권까지 날짜별로 봐요`}
            accessibilityRole="button"
            onPress={onHistory}
            style={({ pressed }) => [styles.historyLink, pressed && styles.historyLinkPressed]}
            testID="ai-ticket-history"
          >
            <AppText capScale tone="sub" variant="secondary">{t`지난 식권 보기`}</AppText>
            <ChevronRight color={colors.textMuted} size={16} />
          </Pressable>
        ) : null}
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  list: { gap: spacing.x2, paddingBottom: spacing.x2 },
  // 실물 식권처럼 모서리가 거의 서 있다(발권 화면의 식권과 같다)
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x3,
    padding: spacing.x3,
    borderRadius: radii.xs,
  },
  thumb: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: radii.xs,
    backgroundColor: colors.white,
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  ink: { color: ticketInk.text },
  muted: { color: ticketInk.muted },
  rule: { alignSelf: "stretch", width: line.base },
  stub: { width: 48, alignItems: "center", gap: 2 },
  stamp: { fontWeight: "700", fontVariant: ["tabular-nums"] },
  tabular: { fontVariant: ["tabular-nums"] },
  historyLink: { minHeight: touchTarget, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.x0_5, borderRadius: radii.sm },
  historyLinkPressed: { backgroundColor: colors.surfacePressed },
})
