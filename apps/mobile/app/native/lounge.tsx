import { FlashList, type FlashListRef, type ListRenderItem } from "@shopify/flash-list"
import { useFocusEffect } from "expo-router"
import { Check, Soup } from "lucide-react-native"
import { useCallback, useRef, useState } from "react"
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import type { RamenLog } from "@raota/shared"
import { track } from "@/src/analytics"
import { isRemote } from "@/src/api/config"
import { LoungeLogCard } from "@/src/components/LoungeLog"
import { AppText, Chip, EmptyState, Header, LoadingState } from "@/src/components/ui"
import { useLoungeLogs } from "@/src/data/hooks"
import { LOUNGE_ALL_TYPES, LOUNGE_PAGE_SIZE, LOUNGE_SORTS, LOUNGE_TYPE_FILTERS, type LoungeSort } from "@/src/domain/lounge"
import { colors, radii, shadows, spacing, touchTarget } from "@/src/theme"

/*
 * 공개 라멘로그를 두 열 masonry로 쌓아 사진 높이를 살린다.
 * FlashList가 실제 높이를 재서 각 기록을 더 짧은 열에 넣고, 화면 밖 핀은 내려 메모리를 아낀다.
 * 정렬·종류를 바꿔도 원본 순서와 페이지네이션은 데이터 훅이 담당한다.
 */
const SORT_MENU_WIDTH = 136
const DEFAULT_SORT: LoungeSort = "latest"

const keyOfLog = (log: RamenLog) => log.id

interface LoungeBodyProps {
  type: string
  sort: LoungeSort
  setType(next: string): void
  setSort(next: LoungeSort): void
  onRetry(): void
}

export default function LoungeScreen() {
  // 고른 종류·정렬은 다시 불러와도 그대로 두고, 피드 부분만 새 key로 다시 마운트한다.
  const [type, setType] = useState(LOUNGE_ALL_TYPES)
  const [sort, setSort] = useState<LoungeSort>(DEFAULT_SORT)
  // 데이터 훅에 refetch가 없어서, 첫 쪽 읽기가 실패하면 다시 마운트해 처음부터 다시 읽는다(실패한 요청은 캐시에 남지 않는다).
  // 훅에 refetch가 생기면 이 key 대신 그 함수를 부르면 된다.
  const [retryKey, setRetryKey] = useState(0)
  const retry = useCallback(() => setRetryKey((key) => key + 1), [])
  // 다시 불러오기로 피드를 다시 마운트해도 방문은 한 번만 센다
  useFocusEffect(
    useCallback(() => {
      track("lounge_viewed")
    }, []),
  )
  return <LoungeBody key={retryKey} onRetry={retry} setSort={setSort} setType={setType} sort={sort} type={type} />
}

function LoungeBody({ type, sort, setType, setSort, onRetry }: LoungeBodyProps) {
  const insets = useSafeAreaInsets()
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null)
  const feed = useLoungeLogs({ type, sort })
  const listRef = useRef<FlashListRef<RamenLog>>(null)
  const sortChipRef = useRef<View>(null)
  const [refreshing, setRefreshing] = useState(false)
  const refresh = async () => {
    setRefreshing(true)
    try {
      await feed.refresh()
    } finally {
      setRefreshing(false)
    }
  }

  const changeType = (next: string) => {
    setType(next)
    listRef.current?.scrollToOffset({ offset: 0, animated: false })
  }
  const changeSort = (next: LoungeSort) => {
    setSort(next)
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

  // 이 피드에서 이미 떠오른 카드는 스크롤로 다시 마운트돼도 다시 떠오르지 않게 피드를 구분한다
  const feedKey = `${type}:${sort}`
  const renderItem = useCallback<ListRenderItem<RamenLog>>(
    ({ item, index }) => (
      // 각 칸의 좌우 4pt가 모여 열 사이 8pt가 된다. 위아래 간격도 칸 안에서 준다
      <View style={styles.cell} testID={`lounge-cell-${index}`}>
        {/* 재활용 칸에 다른 기록이 오면 새로 마운트해, 카드가 앞 기록의 '처음 봄' 상태를 물려받지 않게 한다 */}
        <LoungeLogCard
          batchIndex={index % LOUNGE_PAGE_SIZE}
          feedKey={feedKey}
          key={item.id}
          log={item}
          // 숫자로 바꾸면 BIGINT ID가 반올림돼 핀 높이가 달라진다.
          tall={BigInt(item.id) % 3n !== 0n}
        />
      </View>
    ),
    [feedKey],
  )

  const filtered = type !== LOUNGE_ALL_TYPES
  const empty = feed.isLoading ? (
    <LoadingState label="라멘로그를 불러오는 중…" />
  ) : feed.error ? (
    // 서버에서 읽을 때만 다시 불러올 수 있다. 기기 저장소 오류는 다시 읽어도 같아서 안내만 한다
    isRemote("lounge") ? (
      <EmptyState
        actionLabel="다시 불러오기"
        description="연결을 확인하고 다시 불러와 주세요."
        icon={<Soup color={colors.textMuted} size={32} />}
        onAction={onRetry}
        title="라멘로그를 불러오지 못했어요"
      />
    ) : (
      <EmptyState
        description="잠시 후 라운지를 다시 열어 주세요."
        icon={<Soup color={colors.textMuted} size={32} />}
        title="라멘로그를 불러오지 못했어요"
      />
    )
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

  const sortLabel = LOUNGE_SORTS.find((option) => option.value === sort)?.label ?? LOUNGE_SORTS[0].label

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Header large title="라운지" />
      <ScrollView
        accessibilityLabel="정렬 및 라멘 종류"
        contentContainerStyle={styles.chips}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipBar}
      >
        <View collapsable={false} ref={sortChipRef}>
          {/* 기본 최신순일 때는 비선택, 사용자가 다른 정렬을 고르면 선택 상태로 구분한다 */}
          <Chip
            accessibilityHint="누르면 정렬 메뉴가 열려요"
            accessibilityLabel={`정렬, ${sortLabel}`}
            label={`${sortLabel} ▾`}
            onPress={openSortMenu}
            selected={sort !== DEFAULT_SORT}
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
      <FlashList
        ListEmptyComponent={empty}
        ListFooterComponent={feed.error && feed.data.length ? (
          <EmptyState actionLabel="다시 불러오기" onAction={feed.loadMore} title="다음 라멘로그를 불러오지 못했어요" />
        ) : feed.hasMore && feed.isLoading ? <LoadingState label="더 불러오는 중…" /> : null}
        contentContainerStyle={styles.listContent}
        data={feed.data}
        keyExtractor={keyOfLog}
        masonry
        numColumns={2}
        onEndReached={() => {
          if (feed.hasMore && !feed.isLoading && !feed.error) feed.loadMore()
        }}
        onEndReachedThreshold={0.6}
        onRefresh={() => void refresh()}
        ref={listRef}
        refreshing={refreshing}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        testID="lounge-feed"
      />
      <Modal animationType="fade" onRequestClose={() => setMenuPosition(null)} presentationStyle="overFullScreen" statusBarTranslucent transparent visible={menuPosition !== null}>
        <View style={styles.menuOverlay}>
          <Pressable accessibilityLabel="정렬 메뉴 닫기" accessibilityRole="button" onPress={() => setMenuPosition(null)} style={StyleSheet.absoluteFill} testID="lounge-sort-dismiss" />
          {menuPosition ? (
            <View accessibilityViewIsModal onAccessibilityEscape={() => setMenuPosition(null)} style={[styles.sortMenu, { left: menuPosition.left, top: menuPosition.top, maxHeight: windowHeight - menuPosition.top - spacing.gutter }]} testID="lounge-sort-menu">
              {LOUNGE_SORTS.map((option) => (
                <Pressable
                  accessibilityLabel={option.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sort === option.value }}
                  key={option.value}
                  onPress={() => changeSort(option.value)}
                  style={({ pressed }) => [styles.sortOption, pressed && styles.sortOptionPressed]}
                >
                  <AppText variant="button">{option.label}</AppText>
                  <View style={styles.sortCheck}>
                    {sort === option.value ? <Check color={colors.ink} size={18} strokeWidth={2.5} /> : null}
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
  // 칸마다 좌우 4pt를 주므로 바깥 여백은 그만큼 줄여 화면 가장자리는 gutter를 지킨다.
  listContent: { flexGrow: 1, paddingHorizontal: spacing.gutter - spacing.grid / 2, paddingTop: spacing.x3, paddingBottom: spacing.x8 - spacing.x3_5 },
  cell: { paddingHorizontal: spacing.grid / 2, paddingBottom: spacing.x3_5 },
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
