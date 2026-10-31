import { t } from "@lingui/core/macro"
import { router } from "expo-router"
import { Check, ChevronRight, X } from "lucide-react-native"
import { useEffect } from "react"
import { Pressable, StyleSheet, View } from "react-native"

import { AppText } from "@/src/components/ui"
import { openAiCurator } from "@/src/curatorEntry"
import { useMyBowls } from "@/src/data/hooks"
import { useLocale } from "@/src/i18n"
import { ONBOARDING_TASKS, completeOnboardingTask, dismissStartCard, useOnboarding, type OnboardingTask } from "@/src/onboarding"
import { useRaota } from "@/src/state/RaotaStore"
import { colors, radii, spacing, touchTarget } from "@/src/theme"

/** 각 칸을 누르면 그 일을 하는 화면으로 간다. 칸은 그 화면에서 실제로 해낸 순간 채워진다(src/onboarding.ts) */
function openTask(task: OnboardingTask, loggedIn: boolean) {
  if (task === "map") router.navigate("/native/map")
  // 홈 큐레이터 카드와 같이 비회원은 로그인부터 한다
  else if (task === "ticket") openAiCurator(loggedIn)
  // 기록은 회원만 쓸 수 있다. 비회원은 (flows) 레이아웃이 로그인으로 보낸 뒤 이리로 돌려보낸다
  else router.push({ pathname: "/record/select-shop", params: { mode: "nearby" } })
}

/**
 * 홈 맨 위 "처음이라면 이것부터"(사용자 결정 2026.11.01, C안). 세 가지를 다 하거나 ✕로 닫으면 다시 안 뜬다.
 * 화면의 빨강은 아래 AI 큐레이터 버튼 하나라, 이 카드는 따뜻한 숯색 면(deep)에 흰 글씨로만 둔다.
 */
export function StartChecklist() {
  useLocale()
  const progress = useOnboarding()
  const { currentUser, isHydrated } = useRaota()
  const bowls = useMyBowls()
  const hasBowls = isHydrated && Boolean(currentUser?.isLoggedIn) && bowls.data.length > 0
  // 이미 기록이 있는 회원 계정(다시 깔고 로그인 등)이면 첫 기록 칸은 해낸 것으로 친다
  useEffect(() => {
    if (hasBowls) completeOnboardingTask("record")
  }, [hasBowls])

  if (!progress || progress.cardDismissed) return null
  const doneCount = ONBOARDING_TASKS.filter((task) => progress.done[task]).length
  if (doneCount === ONBOARDING_TASKS.length) return null

  const rows: Record<OnboardingTask, { title: string; sub: string }> = {
    map: { title: t`내 근처 문 연 라멘집 보기`, sub: t`지도에서 핀을 눌러 보세요` },
    ticket: { title: t`오늘의 식권 한 장 뽑기`, sub: t`국물만 골라도 돼요` },
    record: { title: t`먹은 라멘 한 그릇 기록하기`, sub: t`다섯 가지로 한 장에 남겨요` },
  }

  return (
    <View style={styles.card} testID="home-start-checklist">
      <View style={styles.head}>
        <AppText accessibilityRole="header" style={styles.title} variant="bodyStrong">{t`처음이라면 이것부터`}</AppText>
        <Pressable
          accessibilityHint={t`다시 보이지 않아요`}
          accessibilityLabel={t`처음 안내 닫기`}
          accessibilityRole="button"
          hitSlop={8}
          onPress={dismissStartCard}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <X color={colors.onDark} size={18} />
        </Pressable>
      </View>
      <View accessible accessibilityLabel={t`3가지 중 ${doneCount}가지 했어요`} style={styles.progressRow}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${(doneCount / ONBOARDING_TASKS.length) * 100}%` }]} />
        </View>
        <AppText capScale style={styles.count} variant="meta">{`${doneCount} / ${ONBOARDING_TASKS.length}`}</AppText>
      </View>
      {ONBOARDING_TASKS.map((task, index) => {
        const done = Boolean(progress.done[task])
        const { title, sub } = rows[task]
        return (
          <Pressable
            accessibilityLabel={done ? t`${title}, 했어요` : title}
            accessibilityRole="button"
            key={task}
            onPress={() => openTask(task, Boolean(currentUser?.isLoggedIn))}
            style={({ pressed }) => [styles.row, index > 0 && styles.rowDivider, pressed && styles.pressed]}
            testID={`start-task-${task}`}
          >
            <View style={[styles.check, done && styles.checkDone]}>{done ? <Check color={colors.deep} size={14} strokeWidth={3} /> : null}</View>
            <View style={styles.rowText}>
              <AppText lineBreakStrategyIOS="hangul-word" style={[styles.rowTitle, done && styles.rowTitleDone]} variant="secondary">
                {title}
              </AppText>
              {done ? null : (
                <AppText lineBreakStrategyIOS="hangul-word" style={styles.rowSub} variant="meta">
                  {sub}
                </AppText>
              )}
            </View>
            <ChevronRight color={colors.onDark} size={16} style={styles.chevron} />
          </Pressable>
        )
      })}
    </View>
  )
}

const ON_DARK_SUB = "rgba(255, 255, 255, 0.68)"

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.gutter,
    marginBottom: spacing.x4,
    backgroundColor: colors.deep,
    borderRadius: radii.lg,
    paddingTop: spacing.x4,
    paddingHorizontal: spacing.x5,
    paddingBottom: spacing.x1,
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.x2 },
  title: { color: colors.onDark, flexShrink: 1 },
  close: { width: touchTarget, height: touchTarget, marginRight: -spacing.x3, alignItems: "center", justifyContent: "center", borderRadius: radii.pill },
  pressed: { opacity: 0.7 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: spacing.x3, marginTop: spacing.x1, marginBottom: spacing.x2 },
  track: { flex: 1, height: 4, borderRadius: radii.pill, backgroundColor: "rgba(255, 255, 255, 0.18)", overflow: "hidden" },
  fill: { height: "100%", borderRadius: radii.pill, backgroundColor: colors.onDark },
  count: { color: ON_DARK_SUB, fontVariant: ["tabular-nums"] },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.x3, minHeight: 56, paddingVertical: spacing.x2_5 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255, 255, 255, 0.14)" },
  check: {
    width: 24,
    height: 24,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkDone: { backgroundColor: colors.onDark, borderColor: colors.onDark },
  rowText: { flex: 1 },
  rowTitle: { color: colors.onDark, fontWeight: "600" },
  rowTitleDone: { color: ON_DARK_SUB, textDecorationLine: "line-through" },
  rowSub: { color: ON_DARK_SUB, marginTop: 2 },
  chevron: { opacity: 0.6 },
})
