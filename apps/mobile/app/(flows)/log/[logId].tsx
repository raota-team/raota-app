import { router, useLocalSearchParams } from "expo-router"
import { LogIn, MoreHorizontal, Soup } from "lucide-react-native"
import { useCallback, useEffect, useRef, useState } from "react"
import { FlatList, Keyboard, Platform, StyleSheet, TextInput, View, type ListRenderItem } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import type { RamenLog, RamenLogComment } from "@raota/shared"
import { track } from "@/src/analytics"
import {
  Avatar,
  LikeButton,
  LogAuthorRow,
  LogNote,
  LogPhotoPager,
  TasteSummaryList,
  TasteTags,
  useLikeLog,
  useLoungeModeration,
  type ModerationTarget,
} from "@/src/components/LoungeLog"
import { AppText, Button, EmptyState, Header, IconButton, LoadingState, Screen } from "@/src/components/ui"
import { useLoungeLog } from "@/src/data/hooks"
import {
  COMMENT_COUNTER_FROM,
  COMMENT_MAX_LENGTH,
  formatRelativeTime,
  formatVisitDate,
  gradeTitleOf,
  photosOf,
  tasteTagsOf,
} from "@/src/domain/lounge"
import { useRaota } from "@/src/state/RaotaStore"
import { colors, radii, spacing, touchTarget, typography } from "@/src/theme"

/*
 * 라멘로그 상세: 기록 전체(사진 모두 · 메모 전문 · 맛 평가 · 태그) → 댓글(등록순) → 하단 댓글 입력.
 * 비회원은 댓글을 읽을 수 있고, 입력 자리에 "로그인하고 댓글 남기기"가 있다.
 * 없는 기록, 남의 비공개 기록, 숨긴 사람의 기록, 신고한 기록은 빈 상태로 보여준다.
 */

/** 하단 댓글 바 위로 토스트를 띄운다(입력 44 + 여백 + 하단 inset) */
const TOAST_ABOVE_COMPOSER = 100

type Outcome = { kind: "hidden"; authorId: string; authorName: string } | { kind: "reported" } | null

function goBack() {
  if (router.canGoBack()) router.back()
  else router.replace("/native/lounge")
}

function useKeyboardVisible() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow"
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide"
    const show = Keyboard.addListener(showEvent, () => setVisible(true))
    const hide = Keyboard.addListener(hideEvent, () => setVisible(false))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])
  return visible
}

function CommentRow({ comment, own, onMore }: { comment: RamenLogComment; own: boolean; onMore: (comment: RamenLogComment) => void }) {
  const grade = gradeTitleOf(comment.author.level)
  return (
    <View style={styles.commentRow} testID={`comment-${comment.id}`}>
      <Avatar name={comment.author.name} size={28} tone="soft" uri={comment.author.avatar} />
      <View style={styles.commentBody}>
        <View style={styles.commentMeta}>
          <AppText numberOfLines={1} style={[styles.bold, styles.shrink]} variant="secondary">
            {comment.author.name}
          </AppText>
          {grade ? (
            <AppText capScale numberOfLines={1} style={styles.shrinkMore} tone="muted" variant="meta">
              {grade}
            </AppText>
          ) : null}
          <AppText capScale tone="muted" variant="meta">
            {formatRelativeTime(comment.createdAt)}
          </AppText>
        </View>
        <AppText variant="body">
          {comment.parentAuthorName ? (
            <AppText style={styles.bold} tone="sub" variant="body">{`@${comment.parentAuthorName} `}</AppText>
          ) : null}
          {comment.content}
        </AppText>
      </View>
      {own ? null : (
        <IconButton
          accessibilityLabel={`${comment.author.name}님의 댓글 메뉴`}
          icon={<MoreHorizontal color={colors.textMuted} size={18} />}
          onPress={() => onMore(comment)}
          style={styles.commentMore}
        />
      )}
    </View>
  )
}

function CommentComposer({ logId, onPosted }: { logId: number; onPosted: () => void }) {
  const { currentUser, actions } = useRaota()
  const insets = useSafeAreaInsets()
  const keyboardVisible = useKeyboardVisible()
  const [text, setText] = useState("")
  const [focused, setFocused] = useState(false)
  const [failed, setFailed] = useState(false)
  const trimmed = text.trim()
  const bottom = keyboardVisible ? spacing.x2 : Math.max(insets.bottom, spacing.x3)

  if (!currentUser) {
    return (
      <View style={[styles.composer, { paddingBottom: bottom }]}>
        <Button
          fullWidth
          leftIcon={<LogIn color={colors.ink} size={18} />}
          onPress={() => router.push("/auth/login")}
          title="로그인하고 댓글 남기기"
          variant="outline"
        />
      </View>
    )
  }

  const submit = () => {
    if (!trimmed) return
    // TODO(API): POST /logs/{id}/comments { content } — 실패하면 입력을 지우지 않고 다시 보낼 수 있게 한다
    const comment = actions.addLogComment(logId, { content: trimmed })
    if (!comment) {
      setFailed(true)
      return
    }
    setFailed(false)
    setText("")
    track("log_commented")
    onPosted()
  }

  const nearLimit = text.length >= COMMENT_COUNTER_FROM
  const atLimit = text.length >= COMMENT_MAX_LENGTH
  const hint = failed
    ? "댓글을 등록하지 못했어요. 다시 시도해 주세요."
    : atLimit
      ? `댓글은 ${COMMENT_MAX_LENGTH}자까지 쓸 수 있어요`
      : focused && !trimmed
        ? "내용을 입력하면 등록할 수 있어요"
        : null

  return (
    <View style={[styles.composer, { paddingBottom: bottom }]}>
      {hint || nearLimit ? (
        <View style={styles.composerHint}>
          <AppText accessibilityLiveRegion="polite" capScale style={styles.flex} tone={failed || atLimit ? "critical" : "muted"} variant="meta">
            {hint ?? ""}
          </AppText>
          {nearLimit ? (
            <AppText
              accessibilityLabel={`${COMMENT_MAX_LENGTH}자 중 ${text.length}자`}
              capScale
              style={styles.tabular}
              tone={atLimit ? "critical" : "muted"}
              variant="meta"
            >
              {`${text.length}/${COMMENT_MAX_LENGTH}`}
            </AppText>
          ) : null}
        </View>
      ) : null}
      <View style={styles.composerRow}>
        <TextInput
          accessibilityHint={`${COMMENT_MAX_LENGTH}자까지 쓸 수 있어요`}
          accessibilityLabel="댓글 입력"
          maxLength={COMMENT_MAX_LENGTH}
          multiline
          onBlur={() => setFocused(false)}
          onChangeText={(value) => {
            setText(value)
            if (failed) setFailed(false)
          }}
          onFocus={() => setFocused(true)}
          placeholder="이 기록에 댓글을 남겨보세요"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={text}
        />
        <Button
          accessibilityHint={trimmed ? undefined : "내용을 입력하면 등록할 수 있어요"}
          disabled={!trimmed}
          onPress={submit}
          size="small"
          title="등록"
        />
      </View>
    </View>
  )
}

export default function LogDetailScreen() {
  const { logId } = useLocalSearchParams<{ logId: string }>()
  const id = Number(logId)
  const query = useLoungeLog(Number.isInteger(id) && id > 0 ? id : null)
  const detail = query.data
  const { currentUser, actions } = useRaota()
  const like = useLikeLog()
  const listRef = useRef<FlatList<RamenLogComment>>(null)
  const [outcome, setOutcome] = useState<Outcome>(null)
  const viewerId = currentUser?.id ?? null
  const logAuthorId = detail?.log.author.id

  const onHidden = useCallback(
    (target: ModerationTarget) => {
      // 기록 작성자를 숨기면(댓글에서 숨겨도) 이 기록도 사라진다
      if (target.authorId && target.authorId === logAuthorId) {
        setOutcome({ kind: "hidden", authorId: target.authorId, authorName: target.authorName })
      }
    },
    [logAuthorId],
  )
  const onReported = useCallback((target: ModerationTarget) => {
    if (target.kind === "log") setOutcome({ kind: "reported" })
  }, [])
  const { openMenu, element: moderationElement } = useLoungeModeration({
    onHidden,
    onReported,
    toastStyle: { bottom: TOAST_ABOVE_COMPOSER },
  })

  const onCommentMore = useCallback(
    (comment: RamenLogComment) =>
      openMenu({ kind: "comment", id: comment.id, authorId: comment.author.id, authorName: comment.author.name }),
    [openMenu],
  )
  const renderComment = useCallback<ListRenderItem<RamenLogComment>>(
    ({ item }) => <CommentRow comment={item} onMore={onCommentMore} own={Boolean(viewerId) && item.author.id === viewerId} />,
    [onCommentMore, viewerId],
  )

  if (!detail) {
    let body = <LoadingState fullScreen label="라멘로그를 불러오는 중…" />
    if (!query.isLoading) {
      body =
        outcome?.kind === "hidden" ? (
          <EmptyState
            actionLabel="되돌리기"
            description="이 사람의 라멘로그와 댓글은 라운지에 보이지 않아요."
            icon={<Soup color={colors.textMuted} size={32} />}
            onAction={() => actions.unhideAuthor(outcome.authorId)}
            title={`${outcome.authorName}님의 글을 숨겼어요`}
          />
        ) : outcome?.kind === "reported" ? (
          <EmptyState
            actionLabel="라운지로 돌아가기"
            description="검토 후 조치할게요. 신고한 라멘로그는 더 이상 보이지 않아요."
            icon={<Soup color={colors.textMuted} size={32} />}
            onAction={goBack}
            title="신고를 접수했어요"
          />
        ) : (
          <EmptyState
            actionLabel="라운지로 돌아가기"
            description="삭제됐거나 비공개로 바뀐 기록이에요."
            icon={<Soup color={colors.textMuted} size={32} />}
            onAction={goBack}
            title="라멘로그를 볼 수 없어요"
          />
        )
    }
    return (
      <Screen>
        <Header backLabel="뒤로가기" onBack={goBack} title="라멘로그" />
        <View style={styles.flex}>{body}</View>
        {moderationElement}
      </Screen>
    )
  }

  const { log, comments } = detail
  const own = Boolean(viewerId) && log.author.id === viewerId
  const openLogMenu = () => openMenu({ kind: "log", id: log.id, authorId: log.author.id, authorName: log.author.name })

  return (
    // contentContainerStyle flex: 1 — 목록 높이를 화면 안으로 묶어야 하단 댓글 바가 화면 밖으로 밀리지 않는다
    <Screen contentContainerStyle={styles.flex} keyboardAvoiding>
      <Header backLabel="뒤로가기" onBack={goBack} title="라멘로그" />
      <FlatList
        ListEmptyComponent={
          <AppText style={styles.noComments} tone="muted" variant="secondary">
            첫 댓글을 남겨 대화를 시작해 보세요.
          </AppText>
        }
        ListHeaderComponent={<LogDetailHeader commentCount={comments.length} log={log} onLike={() => like(log)} onMore={own ? undefined : openLogMenu} own={own} />}
        contentContainerStyle={styles.listContent}
        data={comments}
        keyExtractor={(comment) => String(comment.id)}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        ref={listRef}
        renderItem={renderComment}
        style={styles.flex}
        testID="log-detail"
      />
      <CommentComposer logId={log.id} onPosted={() => setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80)} />
      {moderationElement}
    </Screen>
  )
}

function LogDetailHeader({
  log,
  own,
  commentCount,
  onLike,
  onMore,
}: {
  log: RamenLog
  own: boolean
  commentCount: number
  onLike: () => void
  onMore?: () => void
}) {
  return (
    <View>
      <LogAuthorRow log={log} onMore={onMore} own={own} />
      <View style={styles.photos}>
        <LogPhotoPager menuName={log.menuName} photos={photosOf(log)} />
      </View>
      <View style={styles.detailBody}>
        <View style={styles.titleBlock}>
          <AppText accessibilityRole="header" variant="sectionTitle">
            {log.menuName}
          </AppText>
          <AppText capScale tone="muted" variant="meta">
            {`${log.ramenType} · ${formatVisitDate(log.visitedAt)} 방문`}
          </AppText>
        </View>
        <TasteSummaryList log={log} />
        <LogNote note={log.note} />
        <TasteTags tags={tasteTagsOf(log)} />
        <View style={styles.actions}>
          <LikeButton count={log.likes} liked={log.isLiked} onPress={onLike} />
          <AppText capScale numberOfLines={1} style={styles.time} tone="muted" variant="meta">
            {`${formatRelativeTime(log.createdAt)} 작성`}
          </AppText>
        </View>
      </View>
      <View style={styles.band} />
      <View style={styles.commentsHead}>
        <AppText accessibilityRole="header" variant="bodyStrong">
          {`댓글 ${commentCount}`}
        </AppText>
        <AppText capScale tone="muted" variant="meta">
          등록순
        </AppText>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: "700" },
  tabular: { fontVariant: ["tabular-nums"] },
  shrink: { flexShrink: 1 },
  shrinkMore: { flexShrink: 2 },

  listContent: { paddingBottom: spacing.x6 },
  photos: { marginTop: spacing.x2 },
  detailBody: { paddingHorizontal: spacing.gutter, paddingTop: spacing.x4, gap: spacing.x4 },
  titleBlock: { gap: spacing.x1 },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.x2, paddingBottom: spacing.x4 },
  time: { flex: 1, textAlign: "right" },
  band: { height: spacing.x2, backgroundColor: colors.canvasSoft },
  commentsHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.x4,
    paddingBottom: spacing.x2,
    borderBottomColor: colors.canvasSoft,
    borderBottomWidth: 1,
  },
  noComments: { textAlign: "center", paddingVertical: spacing.x8, paddingHorizontal: spacing.gutter },

  commentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.x2_5,
    paddingLeft: spacing.gutter,
    paddingRight: spacing.x2,
    paddingVertical: spacing.x3,
    borderBottomColor: colors.canvasSoft,
    borderBottomWidth: 1,
  },
  commentBody: { flex: 1, minWidth: 0, gap: spacing.x0_5, paddingTop: spacing.x0_5 },
  commentMeta: { flexDirection: "row", alignItems: "center", gap: spacing.x1_5, minWidth: 0 },
  commentMore: { marginTop: -spacing.x2 },

  composer: {
    paddingTop: spacing.x2_5,
    paddingHorizontal: spacing.gutter,
    gap: spacing.x1_5,
    backgroundColor: colors.canvas,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composerHint: { flexDirection: "row", alignItems: "center", gap: spacing.x2 },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.x2 },
  input: {
    ...typography.body,
    flex: 1,
    minHeight: touchTarget,
    maxHeight: 112,
    paddingHorizontal: spacing.x3,
    paddingTop: spacing.x2_5,
    paddingBottom: spacing.x2_5,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceInput,
    color: colors.ink,
  },
})
