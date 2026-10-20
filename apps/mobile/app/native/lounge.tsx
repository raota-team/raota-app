import { router, useFocusEffect } from "expo-router"
import { Check, Search, Soup } from "lucide-react-native"
import { useCallback, useMemo, useRef, useState } from "react"
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type ListRenderItem } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { track } from "@/src/analytics"
import { LoungeLogCard } from "@/src/components/LoungeLog"
import { AppText, Chip, EmptyState, Header, IconButton, LoadingState } from "@/src/components/ui"
import { useLoungeLogs } from "@/src/data/hooks"
import { LOUNGE_ALL_TYPES, LOUNGE_PAGE_SIZE, LOUNGE_SORTS, LOUNGE_TYPE_FILTERS, photosOf, type LoungeSort } from "@/src/domain/lounge"
import { colors, radii, shadows, spacing, touchTarget } from "@/src/theme"

/*
 * 공개 라멘로그를 독립된 두 열에 번갈아 쌓아 사진 높이를 살린다.
 * 정렬·종류를 바꿔도 원본 순서와 페이지네이션은 데이터 훅이 담당한다.
 */
const COLUMNS = [0, 1]
const SORT_MENU_WIDTH = 136
const SORT_OPTIONS: ReadonlyArray<{ value: LoungeSort | null; label: string }> = [
  { value: null, label: LOUNGE_ALL_TYPES },
  ...LOUNGE_SORTS,
]

export default function LoungeScreen() {
  const insets = useSafeAreaInsets()
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const [type, setType] = useState(LOUNGE_ALL_TYPES)
  // '전체'는 최신순을 그대로 쓰되, 사용자가 직접 정렬을 고른 상태와 구분한다.
  const [sortChoice, setSortChoice] = useState<LoungeSort | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null)
  const feed = useLoungeLogs({ type, sort: sortChoice ?? "latest" })
  const listRef = useRef<FlatList<number>>(null)
  const sortChipRef = useRef<View>(null)
  // 핀터레스트처럼 각 기록을 지금 더 짧은 열에 넣는다. 번갈아 넣으면 열이 맞춰지고 글만 있는 칸이 한쪽에 몰린다.
  // 높이는 사진 높이(긴 칸 250 · 짧은 칸 180)와 글 길이로 어림한다.
  const columns = useMemo(() => {
    // batchIndex: 한 번에 받은 묶음 안의 순서. 새로 받은 핀이 피드 순서대로 차례로 떠오르게 한다
    const result: Array<Array<{ log: (typeof feed.data)[number]; tall: boolean; batchIndex: number }>> = [[], []]
    const heights = [0, 0]
    for (const [index, log] of feed.data.entries()) {
      const hasPhoto = photosOf(log).length > 0
      // 숫자로 바꾸면 BIGINT ID가 반올림돼 핀 높이 배치가 달라진다.
      const tall = BigInt(log.id) % 3n !== 0n
      const noteLines = Math.min(5, Math.ceil((log.note.trim() || log.menuName).length / 14))
      const estimate = (hasPhoto ? (tall ? 250 : 180) : 28 + noteLines * 19) + 64
      const target = heights[0] <= heights[1] ? 0 : 1
      result[target].push({ log, tall, batchIndex: index % LOUNGE_PAGE_SIZE })
      heights[target] += estimate
    }
    return result
  }, [feed.data])

  useFocusEffect(
    useCallback(() => {
      track("lounge_viewed")
    }, []),
  )

  const changeType = (next: string) => {
    setType(next)
    listRef.current?.scrollToOffset({ offset: 0, animated: false })
  }
  const changeSort = (next: LoungeSort | null) => {
    setSortChoice(next)
    setMenuPosition(null)
    listRef.current?.scrollToOffset({ offset: 0, animated: false })
  }
  const openSortMenu = () => {
    sortChipRef.current?.measureInWindow((x, y, _width, height) => {
      setMenuPosition({
        left: Math.max(spacing.gutter, Math.min(x, windowWidth - SORT_MENU_WIDTH - spacing.gutter)),
        top: y + height + spacing.x2,
      })
    })
  }

  // 이 피드에서 이미 떠오른 카드는 열을 옮겨도 다시 떠오르지 않게 피드를 구분한다
  const feedKey = `${type}:${sortChoice ?? "latest"}`
  const renderItem = useCallback<ListRenderItem<number>>(
    ({ item }) => (
      <View style={styles.column} testID={`lounge-column-${item}`}>
        {columns[item].map(({ log, tall, batchIndex }) => (
          <LoungeLogCard batchIndex={batchIndex} feedKey={feedKey} key={log.id} log={log} tall={tall} />
        ))}
      </View>
    ),
    [columns, feedKey],
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

  const sortLabel = SORT_OPTIONS.find((option) => option.value === sortChoice)?.label ?? LOUNGE_ALL_TYPES

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Header
        large
        right={
          <IconButton
            accessibilityLabel="라멘집 검색"
            icon={<Search color={colors.ink} size={20} />}
            onPress={() => router.navigate("/native/map")}
          />
        }
        title="라운지"
      />
      <ScrollView
        accessibilityLabel="정렬 및 라멘 종류"
        contentContainerStyle={styles.chips}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipBar}
      >
        <View collapsable={false} ref={sortChipRef}>
          <Chip
            accessibilityHint="누르면 정렬 메뉴가 열려요"
            accessibilityLabel={`정렬, ${sortLabel}`}
            label={`${sortLabel} ▾`}
            onPress={openSortMenu}
            selected={sortChoice !== null}
            style={styles.sortChip}
          />
        </View>
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
      <FlatList
        ListEmptyComponent={empty}
        ListFooterComponent={feed.error && feed.data.length ? (
          <EmptyState actionLabel="다시 불러오기" onAction={feed.loadMore} title="다음 라멘로그를 불러오지 못했어요" />
        ) : feed.hasMore && feed.isLoading ? <LoadingState label="더 불러오는 중…" /> : null}
        columnWrapperStyle={styles.columns}
        contentContainerStyle={styles.listContent}
        data={feed.data.length ? COLUMNS : []}
        extraData={columns}
        initialNumToRender={2}
        keyExtractor={String}
        numColumns={2}
        onEndReached={() => {
          if (feed.hasMore && !feed.isLoading && !feed.error) feed.loadMore()
        }}
        onEndReachedThreshold={0.6}
        ref={listRef}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        testID="lounge-feed"
      />
      <Modal animationType="fade" onRequestClose={() => setMenuPosition(null)} presentationStyle="overFullScreen" statusBarTranslucent transparent visible={menuPosition !== null}>
        <View style={styles.menuOverlay}>
          <Pressable accessibilityLabel="정렬 메뉴 닫기" accessibilityRole="button" onPress={() => setMenuPosition(null)} style={StyleSheet.absoluteFill} testID="lounge-sort-dismiss" />
          {menuPosition ? (
            <View accessibilityViewIsModal onAccessibilityEscape={() => setMenuPosition(null)} style={[styles.sortMenu, { left: menuPosition.left, top: menuPosition.top, maxHeight: windowHeight - menuPosition.top - spacing.gutter }]} testID="lounge-sort-menu">
              {SORT_OPTIONS.map((option) => (
                <Pressable
                  accessibilityLabel={option.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sortChoice === option.value }}
                  key={option.label}
                  onPress={() => changeSort(option.value)}
                  style={({ pressed }) => [styles.sortOption, pressed && styles.sortOptionPressed]}
                >
                  <AppText variant="button">{option.label}</AppText>
                  <View style={styles.sortCheck}>
                    {sortChoice === option.value ? <Check color={colors.ink} size={18} strokeWidth={2.5} /> : null}
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  chipBar: { flexGrow: 0, minHeight: spacing.x14 },
  // 가장 긴 "최신순 ▾"에 맞춘 고정 폭. 정렬을 바꿔도 옆 칩이 밀리지 않는다
  sortChip: { width: 88, paddingHorizontal: spacing.x3 },
  chips: { gap: spacing.grid, alignItems: "center", paddingHorizontal: spacing.gutter, paddingVertical: spacing.x2 },
  // 필터 행 아래 12pt, 마지막 핀 아래에는 탭 바 위 여유를 둔다.
  listContent: { flexGrow: 1, paddingHorizontal: spacing.gutter, paddingTop: spacing.x3, paddingBottom: spacing.x8 },
  columns: { gap: spacing.grid, alignItems: "flex-start" },
  column: { flex: 1, gap: spacing.x3_5, minWidth: 0 },
  menuOverlay: { flex: 1 },
  sortMenu: {
    position: "absolute",
    width: SORT_MENU_WIDTH,
    backgroundColor: colors.canvas,
    borderRadius: radii.sm,
    padding: spacing.x2,
    ...shadows.modal,
  },
  sortOption: {
    minHeight: touchTarget,
    paddingHorizontal: spacing.x2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sortCheck: { width: spacing.x4_5, height: spacing.x4_5 },
  sortOptionPressed: { backgroundColor: colors.surfacePressed, borderRadius: radii.sm },
})
