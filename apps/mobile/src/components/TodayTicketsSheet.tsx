import { ChevronRight } from "lucide-react-native"
import { Pressable, StyleSheet, View } from "react-native"

import { AppText, BottomSheet } from "@/src/components/ui"
import type { RemoteTicket, RemoteTodayTickets } from "@/src/data/remote"
import { colors, line, spacing } from "@/src/theme"

const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000

/** 뽑은 시각을 서울 기준 "2026년 10월 23일 11:05"로 */
export function ticketIssuedAt(iso: string): string {
  const seoul = new Date(new Date(iso).getTime() + SEOUL_OFFSET_MS)
  const time = `${String(seoul.getUTCHours()).padStart(2, "0")}:${String(seoul.getUTCMinutes()).padStart(2, "0")}`
  return `${seoul.getUTCFullYear()}년 ${seoul.getUTCMonth() + 1}월 ${seoul.getUTCDate()}일 ${time}`
}

/** 오늘 뽑은 AI 식권 목록. 홈과 AI 큐레이터가 같이 쓴다. 고르면 그 식권의 추천 결과를 연다 */
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
  return (
    <BottomSheet
      description={today ? `하루 ${today.dailyLimit}장, 자정에 다시 채워져요` : undefined}
      onClose={onClose}
      title="오늘 뽑은 식권"
      visible={visible}
    >
      {today?.tickets.map((ticket, index) => {
        const issuedAt = ticketIssuedAt(ticket.createdAt)
        const first = ticket.shops[0]
        return (
          <Pressable
            accessibilityHint="이 식권의 추천을 다시 봐요"
            accessibilityLabel={`${issuedAt}에 뽑은 식권, ${first ? first.name : "보여줄 가게 없음"}, ${ticket.appliedConditions.join(", ")}`}
            accessibilityRole="button"
            key={ticket.id}
            onPress={() => onSelect(ticket)}
            style={({ pressed }) => [styles.row, index > 0 && styles.divider, pressed && styles.pressed]}
            testID="ai-ticket-row"
          >
            {/* 글 묶음이 남은 폭을 모두 차지해야 오른쪽 화살표가 줄마다 같은 자리에 선다 */}
            <View style={styles.copy}>
              <AppText capScale style={styles.tabular} tone="muted" variant="meta">{`${issuedAt}에 뽑은 식권`}</AppText>
              <AppText lineBreakStrategyIOS="hangul-word" variant="bodyStrong">{first ? first.name : "지금은 보여줄 가게가 없어요"}</AppText>
              {ticket.appliedConditions.length ? (
                <AppText lineBreakStrategyIOS="hangul-word" tone="sub" variant="secondary">{ticket.appliedConditions.join(" · ")}</AppText>
              ) : null}
            </View>
            <ChevronRight color={colors.textMuted} size={16} />
          </Pressable>
        )
      })}
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  row: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: spacing.x3, paddingVertical: spacing.x3 },
  divider: { borderTopWidth: line.hair, borderTopColor: colors.border },
  pressed: { backgroundColor: colors.surfacePressed },
  copy: { flex: 1, minWidth: 0, gap: spacing.x0_5 },
  tabular: { fontVariant: ["tabular-nums"] },
})
