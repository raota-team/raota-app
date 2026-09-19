import { useFocusEffect } from "expo-router"
import { Soup } from "lucide-react-native"
import { useCallback, useRef, useState } from "react"
import { FlatList, Pressable, ScrollView, StyleSheet, View, type ListRenderItem } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import type { RamenLog } from "@raota/shared"
import { track } from "@/src/analytics"
import { LoungeLogCard, useLikeLog, useLoungeModeration } from "@/src/components/LoungeLog"
import RecordFab from "@/src/components/RecordFab"
import { AppText, Chip, EmptyState, Header, LoadingState } from "@/src/components/ui"
import { useLoungeLogs } from "@/src/data/hooks"
import { LOUNGE_ALL_TYPES, LOUNGE_SORTS, LOUNGE_TYPE_FILTERS, type LoungeSort } from "@/src/domain/lounge"
import { useRaota } from "@/src/state/RaotaStore"
import { colors, radii, spacing } from "@/src/theme"

/*
 * 라운지 탭: 다른 라멘러들의 공개 라멘로그(웹 LoungeScreen의 라멘로그 부분). 커뮤니티 게시판은 MVP 범위 밖이다.
 * 라멘 종류 칩 · 최신순/공감순 → 라멘로그 카드(공감 · 댓글 · 신고 · 숨기기). 비회원도 읽을 수 있고,
 * 공감 · 댓글 · 신고는 로그인으로 보낸다. 필터와 스크롤은 탭을 오가도 유지된다(Tabs 기본 동작).
 */

/** 떠 있는 기록 버튼(56pt)과 여백만큼 목록 끝을 비워 마지막 카드의 공감·댓글을 가리지 않는다 */
const FAB_CLEARANCE = 96

function SortControl({ value, onChange }: { value: LoungeSort; onChange: (next: LoungeSort) => void }) {
  return (
    <View accessibilityLabel="정렬" style={styles.segment}>
      {LOUNGE_SORTS.map((option) => {
        const selected = option.value === value
        return (
          <Pressable
            accessibilityLabel={`${option.label} 정렬`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            hitSlop={{ top: 4, bottom: 4 }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [styles.segmentItem, selected && styles.segmentItemSelected, pressed && !selected && styles.pressedDim]}
          >
            <AppText capScale style={styles.bold} tone={selected ? "ink" : "muted"} variant="secondary">
              {option.label}
            </AppText>
          </Pressable>
        )
      })}
    </View>
  )
}

export default function LoungeScreen() {
  const insets = useSafeAreaInsets()
  const { currentUser } = useRaota()
  const [type, setType] = useState(LOUNGE_ALL_TYPES)
  const [sort, setSort] = useState<LoungeSort>("latest")
  const feed = useLoungeLogs({ type, sort })
  const like = useLikeLog()
  // 토스트는 떠 있는 기록 버튼 위로 띄운다
  const { openMenu, element: moderationElement } = useLoungeModeration({ toastStyle: styles.toast })
  const listRef = useRef<FlatList<RamenLog>>(null)
  const viewerId = currentUser?.id ?? null

  useFocusEffect(
    useCallback(() => {
      track("lounge_viewed")
    }, []),
  )

  const changeType = (next: string) => {
    setType(next)
    listRef.current?.scrollToOffset({ offset: 0, animated: false })
  }
  const changeSort = (next: LoungeSort) => {
    setSort(next)
    listRef.current?.scrollToOffset({ offset: 0, animated: false })
  }

  const onMore = useCallback(
    (log: RamenLog) => openMenu({ kind: "log", id: log.id, authorId: log.author.id, authorName: log.author.name }),
    [openMenu],
  )
  const renderItem = useCallback<ListRenderItem<RamenLog>>(
    ({ item }) => <LoungeLogCard log={item} onLike={like} onMore={onMore} own={Boolean(viewerId) && item.author.id === viewerId} />,
    [like, onMore, viewerId],
  )

  const filtered = type !== LOUNGE_ALL_TYPES
  const empty = feed.isLoading ? (
    <LoadingState label="라멘로그를 불러오는 중…" />
  ) : feed.error ? (
    <EmptyState
      description="잠시 후 라운지를 다시 열어 주세요."
      icon={<Soup color={colors.textMuted} size={32} />}
      title="라멘로그를 불러오지 못했어요"
    />
  ) : filtered ? (
    <EmptyState
      actionLabel="전체 보기"
      description="다른 종류를 고르거나 전체 라멘로그를 둘러보세요."
      icon={<Soup color={colors.textMuted} size={32} />}
      onAction={() => changeType(LOUNGE_ALL_TYPES)}
      title={`${type} 라멘로그가 아직 없어요`}
    />
  ) : (
    <EmptyState
      description="오늘 먹은 한 그릇을 공개로 기록하면 여기에 올라가요."
      icon={<Soup color={colors.textMuted} size={32} />}
      title="아직 공개된 라멘로그가 없어요"
    />
  )

  const footer = feed.hasMore ? (
    <LoadingState label="더 불러오는 중…" />
  ) : feed.data.length > 0 ? (
    <AppText style={styles.endNote} tone="muted" variant="secondary">
      {"라멘로그를 모두 봤어요.\n기록 버튼으로 오늘의 한 그릇을 남겨보세요."}
    </AppText>
  ) : null

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Header right={<SortControl onChange={changeSort} value={sort} />} subtitle="라멘러들의 공개 라멘로그" title="라운지" />

      <View style={styles.filterBar}>
        <ScrollView
          accessibilityLabel="라멘 종류"
          contentContainerStyle={styles.filterRow}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {LOUNGE_TYPE_FILTERS.map((option) => (
            <Chip
              accessibilityLabel={option === LOUNGE_ALL_TYPES ? "전체 라멘 종류" : `${option} 라멘만 보기`}
              key={option}
              label={option}
              onPress={() => changeType(option)}
              selected={type === option}
            />
          ))}
        </ScrollView>
      </View>

      <FlatList
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        contentContainerStyle={styles.listContent}
        data={feed.data}
        initialNumToRender={4}
        keyExtractor={(log) => String(log.id)}
        onEndReached={() => {
          if (feed.hasMore) feed.loadMore()
        }}
        onEndReachedThreshold={0.6}
        ref={listRef}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        testID="lounge-feed"
        windowSize={7}
      />

      <RecordFab />
      {moderationElement}
    </View>
  )
}

/** 카드 사이 8pt 회색 띠(웹 border-b-8과 같다) */
function Separator() {
  return <View style={styles.separator} />
}

const styles = StyleSheet.create({
  root: { flex: 1, position: "relative", backgroundColor: colors.canvas },
  bold: { fontWeight: "700" },
  pressedDim: { opacity: 0.7 },

  segment: {
    flexDirection: "row",
    padding: spacing.x0_5,
    borderRadius: radii.pill,
    backgroundColor: colors.canvasSoft,
  },
  segmentItem: {
    minHeight: 36,
    paddingHorizontal: spacing.x3,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
  },
  segmentItemSelected: { backgroundColor: colors.canvas },

  filterBar: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    backgroundColor: colors.canvas,
  },
  filterRow: { gap: spacing.x2, paddingHorizontal: spacing.gutter, paddingVertical: spacing.x2 },

  listContent: { flexGrow: 1, paddingBottom: FAB_CLEARANCE },
  separator: { height: spacing.x2, backgroundColor: colors.canvasSoft },
  toast: { bottom: FAB_CLEARANCE },
  endNote: { textAlign: "center", paddingHorizontal: spacing.gutter, paddingTop: spacing.x8, paddingBottom: spacing.x3 },
})
