import { useLocale } from "@/src/i18n"
import { formatDate, getLocale, t } from "@raota/shared"
import { Ticket } from "lucide-react-native"
import { Pressable, StyleSheet, View } from "react-native"
import Svg, { Line } from "react-native-svg"

import { ResilientUriImage } from "@/src/components/ResilientUriImage"
import { AppText, BottomSheet } from "@/src/components/ui"
import type { RemoteTicket, RemoteTodayTickets } from "@/src/data/remote"
import { colors, line, pressFade, radii, soup, spacing, ticketInk, ticketPaperOf } from "@/src/theme"

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

/**
 * 오늘 뽑은 AI 식권 목록. 홈과 AI 큐레이터가 같이 쓴다. 고르면 그 식권의 추천 결과를 연다.
 * 발권 화면과 같은 색종이 식권(국물 색을 흰 종이에 섞은 색)으로 그리고, 오른쪽 꼬리에 몇 번째 식권인지와 시각을 적는다.
 * 모두 오늘 뽑은 식권이라 날짜는 머리에 한 번만 적는다.
 */
export function TodayTicketsSheet({
  visible,
  today,
  onClose,
  onSelect,
}: {
  visible: boolean
  today: RemoteTodayTickets | null
  onClose: () => void
  onSelect: (ticket: RemoteTicket) => void
}) {
  useLocale()
  const now = seoulParts(new Date())
  const count = today?.tickets.length ?? 0
  return (
    <BottomSheet
      description={today ? t("{p0} ({p1}) · 하루 {p2}장, 자정에 다시 채워져요", { p0: now.date, p1: now.weekday, p2: today.dailyLimit }) : undefined}
      onClose={onClose}
      title={t("오늘 뽑은 식권")}
      visible={visible}
    >
      <View style={styles.list}>
        {today?.tickets.map((ticket, index) => {
          const first = ticket.shops[0]
          const photo = first?.photos.find(Boolean)
          // 종이 색은 그 식권에 고른 국물. 조건에 없으면 첫 매장의 종류로 정한다
          const type = ticket.appliedConditions.find((label) => label in soup) ?? first?.ramenTypes?.[0] ?? ""
          // 최신순 목록이라 처음 뽑은 식권이 No.1이다
          const number = count - index
          return (
            <Pressable
              accessibilityHint={t("이 식권의 추천을 다시 봐요")}
              accessibilityLabel={t("{p0}에 뽑은 식권, {p1}, {p2}", { p0: ticketIssuedAt(ticket.createdAt), p1: first ? first.name : t("보여줄 가게 없음"), p2: ticket.appliedConditions.map((condition) => t(condition)).join(", ") })}
              accessibilityRole="button"
              key={ticket.id}
              onPress={() => onSelect(ticket)}
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
                  {first ? first.name : t("지금은 보여줄 가게가 없어요")}
                </AppText>
                {ticket.appliedConditions.length ? (
                  <AppText lineBreakStrategyIOS="hangul-word" numberOfLines={2} style={styles.muted} variant="meta">
                    {ticket.appliedConditions.map((condition) => t(condition)).join(" · ")}
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
                <AppText capScale style={[styles.muted, styles.stamp]} variant="meta">{`No.${number}`}</AppText>
                <AppText capScale style={[styles.muted, styles.tabular]} variant="meta">{seoulParts(new Date(ticket.createdAt)).time}</AppText>
              </View>
            </Pressable>
          )
        })}
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
})
