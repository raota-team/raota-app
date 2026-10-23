import { ChevronRight, Ticket } from "lucide-react-native"
import { Pressable, StyleSheet, View } from "react-native"

import { ResilientUriImage } from "@/src/components/ResilientUriImage"
import { AppText, BottomSheet } from "@/src/components/ui"
import type { RemoteTicket, RemoteTodayTickets } from "@/src/data/remote"
import { colors, radii, spacing } from "@/src/theme"

const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"]

function seoulParts(date: Date) {
  const seoul = new Date(date.getTime() + SEOUL_OFFSET_MS)
  return {
    date: `${seoul.getUTCFullYear()}년 ${seoul.getUTCMonth() + 1}월 ${seoul.getUTCDate()}일`,
    weekday: WEEKDAYS[seoul.getUTCDay()],
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
 * 모두 오늘 뽑은 식권이라 날짜는 머리에 한 번만 적고, 칸마다 몇 번째 식권인지와 시각, 매장 사진으로 구별한다.
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
  const now = seoulParts(new Date())
  const count = today?.tickets.length ?? 0
  return (
    <BottomSheet
      description={today ? `${now.date} (${now.weekday}) · 하루 ${today.dailyLimit}장, 자정에 다시 채워져요` : undefined}
      onClose={onClose}
      title="오늘 뽑은 식권"
      visible={visible}
    >
      <View style={styles.list}>
        {today?.tickets.map((ticket, index) => {
          const first = ticket.shops[0]
          const photo = first?.photos.find(Boolean)
          // 최신순 목록이라 처음 뽑은 식권이 No.1이다
          const number = count - index
          return (
            <Pressable
              accessibilityHint="이 식권의 추천을 다시 봐요"
              accessibilityLabel={`${ticketIssuedAt(ticket.createdAt)}에 뽑은 식권, ${first ? first.name : "보여줄 가게 없음"}, ${ticket.appliedConditions.join(", ")}`}
              accessibilityRole="button"
              key={ticket.id}
              onPress={() => onSelect(ticket)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              testID="ai-ticket-row"
            >
              <View style={styles.thumb}>
                {photo ? (
                  <ResilientUriImage accessibilityLabel="" style={StyleSheet.absoluteFill} uri={photo} />
                ) : (
                  <Ticket color={colors.textMuted} size={22} />
                )}
              </View>
              {/* 글 묶음이 남은 폭을 모두 차지해야 오른쪽 화살표가 칸마다 같은 자리에 선다 */}
              <View style={styles.copy}>
                <AppText capScale style={styles.stamp} tone="muted" variant="meta">{`No.${number} · ${seoulParts(new Date(ticket.createdAt)).time}`}</AppText>
                <AppText lineBreakStrategyIOS="hangul-word" numberOfLines={1} variant="bodyStrong">
                  {first ? first.name : "지금은 보여줄 가게가 없어요"}
                </AppText>
                {ticket.appliedConditions.length ? (
                  <AppText lineBreakStrategyIOS="hangul-word" numberOfLines={2} tone="sub" variant="meta">
                    {ticket.appliedConditions.join(" · ")}
                  </AppText>
                ) : null}
              </View>
              <ChevronRight color={colors.textMuted} size={16} />
            </Pressable>
          )
        })}
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  list: { gap: spacing.x2, paddingBottom: spacing.x2 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x3,
    padding: spacing.x3,
    borderRadius: radii.md,
    backgroundColor: colors.canvasSoft,
  },
  pressed: { backgroundColor: colors.surfacePressed },
  thumb: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: radii.md,
    backgroundColor: colors.canvas,
  },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  stamp: { fontWeight: "700", fontVariant: ["tabular-nums"] },
})
