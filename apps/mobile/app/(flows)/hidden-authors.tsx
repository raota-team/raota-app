import { t } from "@raota/shared"
import { useLocale } from "@/src/i18n"
import { router } from "expo-router"
import { useState } from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Avatar } from "@/src/components/LoungeLog"
import { AppText, Button, EmptyState, Header, LoadingState, Screen, Toast } from "@/src/components/ui"
import { useHiddenAuthors } from "@/src/data"
import type { HiddenAuthor } from "@/src/domain/lounge"
import { useRaota } from "@/src/state/RaotaStore"
import { colors, line, spacing, typography } from "@/src/theme"

/*
 * 설정 > 숨긴 사용자. 라운지에서 숨긴 사람을 모아 보고 숨김을 풀 수 있다.
 * 비회원은 (flows)/_layout.tsx가 로그인으로 보낸다.
 */
export default function HiddenAuthorsScreen() {
  useLocale()
  const { currentUser, actions } = useRaota()
  const insets = useSafeAreaInsets()
  const hidden = useHiddenAuthors()
  const [pendingIds, setPendingIds] = useState<string[]>([])
  const [toast, setToast] = useState<string | null>(null)

  const unhide = async (author: HiddenAuthor) => {
    if (pendingIds.includes(author.id)) return
    setPendingIds((ids) => [...ids, author.id])
    try {
      await actions.unhideAuthor(author.id)
      setToast(t("{v1} 님의 숨김을 풀었어요.", { v1: author.name }))
    } catch (error) {
      setToast(error instanceof Error ? error.message : t("숨김을 풀지 못했어요. 다시 시도해 주세요."))
    } finally {
      setPendingIds((ids) => ids.filter((id) => id !== author.id))
    }
  }

  const renderBody = () => {
    if (hidden.data.length === 0) {
      if (hidden.isLoading) return <LoadingState style={styles.state} />
      if (hidden.error) {
        return (
          <EmptyState
            actionLabel={t("다시 시도")}
            description={hidden.error}
            onAction={() => void actions.refreshAccount()}
            style={styles.state}
            title={t("숨긴 사용자를 불러오지 못했어요")}
          />
        )
      }
      return <EmptyState description={t("라운지에서 숨긴 사람이 여기에 모여요.")} style={styles.state} title={t("숨긴 사용자가 없어요")} />
    }
    return (
      <View>
        {hidden.data.map((author, index) => {
          const pending = pendingIds.includes(author.id)
          return (
            <View key={author.id} style={[styles.row, index > 0 && styles.rowDivider]}>
              <Avatar name={author.name} tone="soft" uri={author.avatar} />
              <AppText lineBreakStrategyIOS="hangul-word" numberOfLines={2} style={styles.name} variant="bodyStrong">
                {author.name}
              </AppText>
              <Button
                accessibilityLabel={t("{v1} 숨김 해제", { v1: author.name })}
                loading={pending}
                onPress={() => void unhide(author)}
                size="small"
                title={t("숨김 해제")}
                variant="secondary"
              />
            </View>
          )
        })}
      </View>
    )
  }
  return (
    <Screen>
      <Header
        align="center"
        backLabel={t("뒤로가기")}
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/settings"))}
        title={t("숨긴 사용자")}
        titleStyle={typography.sectionTitle}
      />
      {currentUser ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.section }]} style={styles.scroll}>
          <AppText lineBreakStrategyIOS="hangul-word" tone="muted" variant="secondary">
            {t("숨긴 사람의 라멘로그와 댓글은 라운지에 보이지 않아요. 숨김을 풀면 다시 보여요. ")}</AppText>
          {renderBody()}
        </ScrollView>
      ) : null}
      <Toast message={toast ?? ""} onDismiss={() => setToast(null)} visible={Boolean(toast)} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: spacing.gutter, paddingTop: spacing.x3, gap: spacing.x6 },
  state: { flexGrow: 1 },
  row: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.x3, paddingVertical: spacing.x3 },
  rowDivider: { borderTopColor: colors.border, borderTopWidth: line.hair },
  name: { flex: 1, minWidth: 0 },
})
