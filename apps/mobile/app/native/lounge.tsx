import { router } from "expo-router"
import {
  ChevronRight,
  ChevronDown,
  Eye,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  PenLine,
  Plus,
  Send,
  SlidersHorizontal,
  Utensils,
} from "lucide-react-native"
import { useMemo, useState } from "react"
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text as NativeText,
  useWindowDimensions,
  View,
  TextInput,
  type TextProps,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import type { CommunityPost, RamenLog, RamenLogComment } from "@raota/shared"
import { ResilientUriImage } from "@/src/components"
import { useRaota } from "@/src/state/RaotaStore"
import { colors, fonts } from "@/src/theme"

const RED = colors.brand
const INK = colors.text
const MUTED = colors.textMuted
const LINE = colors.border
const SOFT = colors.backgroundBasement

function Text({ style, ...props }: TextProps) {
  const resolvedStyle = StyleSheet.flatten(style)
  const readableSize =
    typeof resolvedStyle?.fontSize === "number" && resolvedStyle.fontSize < 11
      ? { fontSize: 11 }
      : null
  return (
    <NativeText
      {...props}
      style={[{ fontFamily: fonts.body }, style, readableSize]}
    />
  )
}

const LOG_FILTERS = ["전체", "쇼유", "돈코츠", "시오", "미소", "츠케멘"]
const LOG_SORTS = ["최신순", "공감순"] as const
const COMMUNITY_FILTERS = [
  { label: "전체", value: "ALL" },
  { label: "인기", value: "POPULAR" },
  { label: "후기", value: "REVIEW" },
  { label: "팁", value: "TIP" },
  { label: "질문", value: "QUESTION" },
  { label: "자유", value: "FREE" },
] as const

function popularityScore(post: CommunityPost): number {
  return post.likes * 3 + post.commentCount * 5 + post.viewCount * 0.02
}

function openShop(shopId: number) {
  router.push({
    pathname: "/shop/[shopId]",
    params: { shopId: String(shopId) },
  })
}

type AvatarProps = {
  name: string
  uri?: string | null
}

function Avatar({ name, uri }: AvatarProps) {
  if (uri) {
    return (
      <ResilientUriImage
        accessibilityLabel={`${name} 프로필 사진`}
        fallback={
          <View style={styles.avatarLetterCircle}>
            <Text style={styles.avatarLetterText}>{name.slice(0, 1)}</Text>
          </View>
        }
        style={styles.avatarLetterCircle}
        uri={uri}
      />
    )
  }
  return (
    <View style={styles.avatarLetterCircle}>
      <Text style={styles.avatarLetterText}>{name.slice(0, 1)}</Text>
    </View>
  )
}

function cleanGradeTitle(levelStr?: string) {
  if (!levelStr) return "라멘 탐험가"
  return levelStr
    .replace(/\s*\(Lv\.\s*\d+\)/gi, "")
    .replace(/Lv\.\s*\d+\s*/gi, "")
    .replace(/\s*\d+레벨/gi, "")
    .trim()
}

function formatDateYMD(dateStr?: string) {
  if (!dateStr) return ""
  if (dateStr === "방금 전" || dateStr.includes("전")) return dateStr
  const match = dateStr.match(/(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/)
  if (match) {
    const [, y, m, d] = match
    return `${y}.${m.padStart(2, "0")}.${d.padStart(2, "0")}`
  }
  return dateStr.split(" ")[0] ?? dateStr
}

export function getCategoryBadgeColors(category?: string, label?: string) {
  const cat = (category || label || "").toUpperCase()
  if (cat.includes("REVIEW") || cat.includes("후기") || cat.includes("맛집")) {
    return { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0" }
  }
  if (cat.includes("TIP") || cat.includes("팁")) {
    return { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" }
  }
  if (cat.includes("QUESTION") || cat.includes("Q&A") || cat.includes("질문")) {
    return { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" }
  }
  if (cat.includes("POPULAR") || cat.includes("인기")) {
    return { bg: "#FEF2F2", text: "#E60000", border: "#FECACA" }
  }
  return { bg: "#F5F5F4", text: "#57534E", border: "#E7E5E4" }
}

function LogCard({
  log,
  width,
  onLike,
  comments,
  showAllComments,
  commentsExpanded,
  commentText,
  onToggleComments,
  onToggleAllComments,
  onChangeComment,
  onAddComment,
  commentError,
}: {
  log: RamenLog
  width: number
  onLike: () => void
  comments: RamenLogComment[]
  showAllComments: boolean
  commentsExpanded: boolean
  commentText: string
  onToggleComments: () => void
  onToggleAllComments: () => void
  onChangeComment: (value: string) => void
  onAddComment: () => void
  commentError: string | null
}) {
  const photos = log.photos?.length
    ? log.photos
    : log.imageUrl
      ? [log.imageUrl]
      : []
  const [photoIndex, setPhotoIndex] = useState(0)
  const photoWidth = Math.max(250, width)
  const allTags = Object.values(log.tasteNotes).flat().slice(0, 6)
  const visibleComments = showAllComments ? comments : comments.slice(0, 1)

  return (
    <View style={styles.feedCard}>
      {/* 상단 작성자 및 매장 정보 */}
      <View style={styles.cardHeader}>
        <View style={styles.authorGroup}>
          <View style={styles.avatarLetterCircle}>
            <Text style={styles.avatarLetterText}>{log.author.name[0] ?? "라"}</Text>
          </View>
          <View>
            <View style={styles.authorNameRow}>
              <Text style={styles.authorName}>{log.author.name}</Text>
              <View style={styles.authorLevelPill}>
                <Text style={styles.authorLevelText}>{cleanGradeTitle(log.author.level)}</Text>
              </View>
            </View>
            <Text style={styles.visitedMeta}>{log.visitedAt} 방문</Text>
          </View>
        </View>
        <View style={styles.revisitPill}>
          <Text style={styles.revisitPillText}>{log.revisit}</Text>
        </View>
      </View>

      {/* 라멘 다중 사진 스와이프 캐러셀 (16:10) */}
      {photos.length ? (
        <View style={styles.photoWrap}>
          <ScrollView
            decelerationRate="fast"
            horizontal
            onMomentumScrollEnd={(event) => {
              setPhotoIndex(
                Math.round(event.nativeEvent.contentOffset.x / photoWidth),
              )
            }}
            pagingEnabled
            showsHorizontalScrollIndicator={false}
          >
            {photos.map((photo, index) => (
              <ResilientUriImage
                accessibilityLabel={`${log.shop.name} 라멘 사진 ${index + 1}`}
                key={`${photo}-${index}`}
                style={[styles.feedPhoto, { width: photoWidth, height: Math.round(photoWidth * 0.625) }]}
                uri={photo}
              />
            ))}
          </ScrollView>
          <View style={styles.photoTypeBadge}>
            <Text style={styles.photoTypeText}>{log.ramenType}</Text>
          </View>
          {photos.length > 1 ? (
            <View style={styles.photoCounter}>
              <Text style={styles.photoCounterText}>
                {photoIndex + 1}/{photos.length}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* 본문 내용 */}
      <View style={styles.cardBody}>
        <View style={styles.menuHeaderRow}>
          <Text style={styles.menuNameTitle}>{log.menuName}</Text>
          <Pressable onPress={() => openShop(log.shop.id)}>
            <Text style={styles.shopNameLink}>
              {log.shop.name} {log.shop.branch ? `· ${log.shop.branch}` : ""}
            </Text>
          </Pressable>
        </View>

        {/* 한줄 미각 평 */}
        <View style={styles.noteBox}>
          <Text style={styles.noteLabel}>한줄평</Text>
          <Text style={styles.noteText}>{log.note}</Text>
        </View>

        {/* 맛 태그 칩 */}
        {allTags.length > 0 && (
          <View style={styles.tagsRow}>
            {allTags.map((tag) => (
              <View key={tag} style={styles.tagChip}>
                <Text style={styles.tagChipText}>#{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 하단 좋아요·댓글 & 시간 */}
        <View style={styles.cardFooterRow}>
          <Text style={styles.createdAtText}>{log.createdAt}</Text>
          <View style={styles.reactionGroup}>
            <Pressable
              accessibilityLabel={`${commentsExpanded ? "댓글 입력 닫기" : "댓글 작성"} ${comments.length}개`}
              accessibilityRole="button"
              accessibilityState={{ expanded: commentsExpanded }}
              onPress={onToggleComments}
              style={[styles.reactionButton, commentsExpanded && styles.commentButtonActive]}
            >
              <MessageCircle color={commentsExpanded ? "#FFFFFF" : MUTED} size={14} />
              <Text style={[styles.reactionText, commentsExpanded && styles.commentButtonTextActive]}>
                {comments.length}
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel={log.isLiked ? "공감 취소" : "공감하기"}
              accessibilityRole="button"
              accessibilityState={{ selected: log.isLiked }}
              onPress={onLike}
              style={[
                styles.reactionButton,
                log.isLiked && styles.reactionButtonActive,
              ]}
            >
              <Heart
                color={log.isLiked ? RED : MUTED}
                fill={log.isLiked ? RED : "transparent"}
                size={14}
              />
              <Text
                style={[
                  styles.reactionText,
                  log.isLiked && styles.reactionTextActive,
                ]}
              >
                {log.likes}
              </Text>
            </Pressable>
          </View>
        </View>

        <View
          style={[
            styles.logCommentsPanel,
            !commentsExpanded && styles.logCommentsPreviewPanel,
          ]}
        >
          {comments.length > 0 ? (
            <View style={styles.logCommentsHeader}>
              <Text style={styles.logCommentsTitle}>
                댓글 <Text style={styles.logCommentsCount}>{comments.length}</Text>
              </Text>
              <Text style={styles.logCommentsOrder}>등록순</Text>
            </View>
          ) : null}
          {comments.length ? (
              <View style={styles.logCommentsList}>
                {visibleComments.map((comment) => (
                  <View key={comment.id} style={styles.logCommentRow}>
                    <View style={styles.logCommentAvatar}>
                      <Text style={styles.logCommentAvatarText}>{comment.author.name.slice(0, 1)}</Text>
                    </View>
                    <View style={styles.flex}>
                      <View style={styles.logCommentMeta}>
                        <Text style={styles.logCommentAuthor}>{comment.author.name}</Text>
                        <Text style={styles.logCommentLevel}>{cleanGradeTitle(comment.author.level)}</Text>
                        <Text style={styles.logCommentDate}>{formatDateYMD(comment.createdAt)}</Text>
                      </View>
                      <Text style={styles.logCommentText}>{comment.content}</Text>
                    </View>
                  </View>
                ))}
                {comments.length > 1 ? (
                  <Pressable
                    accessibilityLabel={showAllComments ? "댓글 접기" : `댓글 ${comments.length - 1}개 더 보기`}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: showAllComments }}
                    onPress={onToggleAllComments}
                    style={styles.moreCommentsButton}
                  >
                    <Text style={styles.moreCommentsText}>
                      {showAllComments ? "댓글 접기" : `댓글 ${comments.length - 1}개 더 보기`}
                    </Text>
                    <ChevronDown
                      color="#5A5D62"
                      size={14}
                      style={showAllComments ? styles.moreCommentsIconExpanded : undefined}
                    />
                  </Pressable>
                ) : null}
              </View>
          ) : commentsExpanded ? (
              <Text style={styles.logCommentsEmpty}>첫 댓글을 남겨 대화를 시작해보세요.</Text>
          ) : null}
          {!commentsExpanded ? (
            <Pressable
              accessibilityLabel="댓글 입력창 열기"
              accessibilityRole="button"
              onPress={onToggleComments}
              style={styles.commentTrigger}
            >
              <View style={styles.commentTriggerAvatar}>
                <Text style={styles.commentTriggerAvatarText}>뿡</Text>
              </View>
              <Text style={styles.commentTriggerText}>이 기록에 댓글을 남겨보세요</Text>
              <MessageCircle color={MUTED} size={15} />
            </Pressable>
          ) : null}
            {commentsExpanded ? (
              <>
                <View style={styles.logComposer}>
                  <TextInput
                    accessibilityLabel={`${log.menuName} 댓글 입력`}
                    maxLength={300}
                    onChangeText={onChangeComment}
                    onSubmitEditing={onAddComment}
                    placeholder="이 기록에 댓글을 남겨보세요"
                    placeholderTextColor="#A8ACAF"
                    returnKeyType="send"
                    style={styles.logCommentInput}
                    value={commentText}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="댓글 등록"
                    disabled={!commentText.trim()}
                    onPress={onAddComment}
                    style={[styles.logSendButton, !commentText.trim() && styles.logSendButtonDisabled]}
                  >
                    <Send color="#FFFFFF" size={16} />
                  </Pressable>
                </View>
                {commentError ? <Text style={styles.logCommentError}>{commentError}</Text> : null}
              </>
            ) : null}
        </View>
      </View>
    </View>
  )
}

function PostCard({
  post,
  onLike,
}: {
  post: CommunityPost
  onLike: () => void
}) {
  return (
    <Pressable
      accessibilityLabel={`${post.categoryLabel}, ${post.title}, ${post.author.name} 작성, 게시글 열기`}
      accessibilityRole="button"
      onPress={() =>
        router.push({
          pathname: "/community/[postId]",
          params: { postId: String(post.id) },
        })
      }
      style={({ pressed }) => [styles.postItemCard, pressed && styles.pressed]}
    >
      {/* 상단 카테고리 뱃지 & 인기 뱃지 */}
      <View style={styles.postBadgeRow}>
        {(() => {
          const catColors = getCategoryBadgeColors(post.category, post.categoryLabel)
          return (
            <View style={[styles.categoryBadge, { backgroundColor: catColors.bg }]}>
              <Text style={[styles.categoryBadgeText, { color: catColors.text }]}>
                {post.categoryLabel}
              </Text>
            </View>
          )
        })()}
        {post.likes >= 20 ? (
          <View style={styles.popularBadge}>
            <Text style={styles.popularBadgeText}>🔥 인기</Text>
          </View>
        ) : null}
      </View>

      {/* 중앙 본문: 제목 (1줄) + 요약 (1줄) + 썸네일 */}
      <View style={styles.postContentRow}>
        <View style={styles.flex}>
          <Text numberOfLines={1} style={styles.postTitle}>
            {post.title}
          </Text>
          <Text numberOfLines={1} style={styles.postContent}>
            {post.content}
          </Text>
        </View>
        {post.imageUrls[0] ? (
          <ResilientUriImage
            accessibilityLabel={`${post.title} 대표 사진`}
            style={styles.postThumbSquare}
            uri={post.imageUrls[0]}
          />
        ) : null}
      </View>

      {/* 하단: 작성자 · 날짜 on left, 좋아요 & 댓글 on right */}
      <View style={styles.postFooterRow}>
        <View style={styles.postAuthorMeta}>
          <Text numberOfLines={1} style={styles.postAuthorName}>
            {post.author.name}
          </Text>
          <View style={styles.postAuthorLevelPill}>
            <Text style={styles.postAuthorLevelText}>{cleanGradeTitle(post.author.level)}</Text>
          </View>
          <Text style={styles.dotSeparator}>·</Text>
          <Text style={styles.postDateText}>{formatDateYMD(post.createdAt)}</Text>
        </View>

        <View style={styles.postStats}>
          <Pressable
            accessibilityLabel={post.isLiked ? "게시글 공감 취소" : "게시글 공감"}
            accessibilityRole="button"
            hitSlop={8}
            onPress={onLike}
            style={styles.statInline}
          >
            <Heart
              color={post.isLiked ? RED : MUTED}
              fill={post.isLiked ? RED : "transparent"}
              size={13}
            />
            <Text style={[styles.statText, post.isLiked && styles.statTextActive]}>
              {post.likes}
            </Text>
          </Pressable>
          <View style={styles.statInline}>
            <MessageCircle color={MUTED} size={13} />
            <Text style={styles.statText}>{post.commentCount}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  )
}

export default function LoungeScreen() {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const { state, currentUser, actions } = useRaota()
  const [section, setSection] = useState<"logs" | "community">("logs")
  const [logFilter, setLogFilter] = useState("전체")
  const [logSort, setLogSort] =
    useState<(typeof LOG_SORTS)[number]>("최신순")
  const [communityFilter, setCommunityFilter] =
    useState<typeof COMMUNITY_FILTERS[number]["value"]>("ALL")
  const [refreshing, setRefreshing] = useState(false)
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null)
  const [showAllLogCommentsId, setShowAllLogCommentsId] = useState<number | null>(null)
  const [logCommentDraft, setLogCommentDraft] = useState("")
  const [logCommentError, setLogCommentError] = useState<string | null>(null)

  const logs = useMemo(() => {
    const filtered = state.logs.filter(
      (log) =>
        log.isPublic &&
        (logFilter === "전체" || log.ramenType === logFilter),
    )
    return [...filtered].sort((left, right) => {
      if (logSort === "공감순") {
        return right.likes - left.likes || right.id - left.id
      }
      const byDate = Date.parse(right.createdAt) - Date.parse(left.createdAt)
      return Number.isFinite(byDate) && byDate !== 0
        ? byDate
        : right.id - left.id
    })
  }, [logFilter, logSort, state.logs])
  const posts = useMemo(() => {
    const items =
      communityFilter === "ALL" || communityFilter === "POPULAR"
        ? state.communityPosts
        : state.communityPosts.filter(
            (post) => post.category === communityFilter,
          )
    return [...items].sort((a, b) => {
      if (communityFilter === "POPULAR") {
        const scoreDifference = popularityScore(b) - popularityScore(a)
        return scoreDifference || b.id - a.id
      }
      return b.id - a.id
    })
  }, [communityFilter, state.communityPosts])

  const refresh = () => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 650)
  }

  const toggleLogComments = (logId: number) => {
    setExpandedLogId((current) => (current === logId ? null : logId))
    setLogCommentDraft("")
    setLogCommentError(null)
  }

  const submitLogComment = (logId: number) => {
    if (!currentUser) {
      router.push("/auth/login")
      return
    }
    const content = logCommentDraft.trim()
    if (content.length < 2) {
      setLogCommentError("댓글을 2자 이상 입력해주세요.")
      return
    }
    const created = actions.addLogComment(logId, { content })
    if (!created) {
      setLogCommentError("댓글을 저장하지 못했어요.")
      return
    }
    setLogCommentDraft("")
    setShowAllLogCommentsId(logId)
    setLogCommentError(null)
  }

  const filters =
    section === "logs"
      ? LOG_FILTERS
      : COMMUNITY_FILTERS.map((item) => item.label)
  const selectedLabel =
    section === "logs"
      ? logFilter
      : (COMMUNITY_FILTERS.find((item) => item.value === communityFilter)
          ?.label ?? "전체")

  const listHeader = section === "logs" ? (
    <View style={styles.filterToolbar}>
      <Pressable
        accessibilityLabel={`라멘로그 매장 필터 ${selectedLabel}`}
        accessibilityRole="button"
        onPress={() => {
          const index = LOG_FILTERS.indexOf(logFilter)
          setLogFilter(LOG_FILTERS[(index + 1) % LOG_FILTERS.length])
        }}
        style={styles.storeFilterButton}
      >
        <Utensils color={RED} size={14} />
        <Text style={styles.storeFilterText}>{logFilter === "전체" ? "전체 매장" : logFilter}</Text>
        <ChevronDown color={MUTED} size={14} />
      </Pressable>
      <Pressable
        accessibilityLabel={`라멘로그 정렬 ${logSort}`}
        accessibilityRole="button"
        onPress={() => setLogSort((current) => current === LOG_SORTS[0] ? LOG_SORTS[1] : LOG_SORTS[0])}
        style={styles.sortButton}
      >
        <SlidersHorizontal color={INK} size={14} />
        <Text style={styles.sortText}>{logSort}</Text>
      </Pressable>
    </View>
  ) : (
    <ScrollView
      contentContainerStyle={styles.communityFilterRow}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {filters.map((filter) => {
        const selected = filter === selectedLabel
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={filter}
            onPress={() => setCommunityFilter(COMMUNITY_FILTERS.find((item) => item.label === filter)?.value ?? "ALL")}
            style={[styles.filterChip, selected && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, selected && styles.filterTextActive]}>{filter}</Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTop}>
          <View style={styles.brand}>
            <Image source={require("@/assets/images/logo.png")} style={styles.headerLogo} />
            <View>
            <Text accessibilityRole="header" style={styles.headerTitle}>
              라오타 라운지
            </Text>
            <Text style={styles.headerBody}>
              라멘러들의 실시간 기록 & 커뮤니티
            </Text>
            </View>
          </View>
        </View>
        <View style={styles.segmented}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: section === "logs" }}
            onPress={() => setSection("logs")}
            style={[styles.segment, section === "logs" && styles.segmentActive]}
          >
            <Text
              style={[
                styles.segmentText,
                section === "logs" && styles.segmentTextActive,
              ]}
            >
              라멘로그 ({state.logs.length})
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: section === "community" }}
            onPress={() => setSection("community")}
            style={[
              styles.segment,
              section === "community" && styles.segmentActive,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                section === "community" && styles.segmentTextActive,
              ]}
            >
              커뮤니티 ({state.communityPosts.length})
            </Text>
          </Pressable>
        </View>
      </View>

      {section === "logs" ? (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={logs}
          key="logs"
          keyExtractor={(item) => `log-${item.id}`}
          ListEmptyComponent={
            <EmptyState message="아직 공개된 라멘로그가 없어요" />
          }
          ListHeaderComponent={listHeader}
          refreshControl={
            <RefreshControl
              onRefresh={refresh}
              refreshing={refreshing}
              tintColor={RED}
            />
          }
          renderItem={({ item }) => (
            <LogCard
              log={item}
              onLike={() => actions.toggleLogLike(item.id)}
              comments={item.comments ?? []}
              showAllComments={showAllLogCommentsId === item.id}
              commentsExpanded={expandedLogId === item.id}
              commentText={expandedLogId === item.id ? logCommentDraft : ""}
              onToggleComments={() => toggleLogComments(item.id)}
              onToggleAllComments={() =>
                setShowAllLogCommentsId((current) =>
                  current === item.id ? null : item.id,
                )
              }
              onChangeComment={(value) => {
                setLogCommentDraft(value)
                if (logCommentError) setLogCommentError(null)
              }}
              onAddComment={() => submitLogComment(item.id)}
              commentError={expandedLogId === item.id ? logCommentError : null}
              width={width}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={posts}
          key="community"
          keyExtractor={(item) => `post-${item.id}`}
          ListEmptyComponent={
            <EmptyState message="이 주제의 첫 글을 작성해보세요" />
          }
          ListHeaderComponent={listHeader}
          refreshControl={
            <RefreshControl
              onRefresh={refresh}
              refreshing={refreshing}
              tintColor={RED}
            />
          }
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onLike={() => actions.togglePostLike(item.id)}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={section === "logs" ? "라멘로그 쓰기" : "커뮤니티 글쓰기"}
        onPress={() => router.push(section === "logs" ? "/record/select-shop" : "/community/new")}
        style={({ pressed }) => [styles.fab, { bottom: insets.bottom + 18 }, pressed && styles.pressed]}
      >
        {section === "logs" ? <Plus color="#FFFFFF" size={18} /> : <PenLine color="#FFFFFF" size={17} />}
        <Text style={styles.fabText}>{section === "logs" ? "기록하기" : "글쓰기"}</Text>
      </Pressable>
    </View>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <SlidersHorizontal color={MUTED} size={23} />
      </View>
      <Text style={styles.emptyTitle}>{message}</Text>
      <Text style={styles.emptyBody}>
        필터를 바꾸거나 새로운 이야기를 남겨보세요.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  flex: { flex: 1, minWidth: 0 },
  redText: { color: RED },
  pressed: { opacity: 0.74, transform: [{ scale: 0.99 }] },
  header: {
    backgroundColor: "#FFFFFF",
    borderBottomColor: LINE,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 10,
    paddingHorizontal: 20,
  },
  headerTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 10,
  },
  brand: { alignItems: "center", flexDirection: "row", gap: 10 },
  headerLogo: { height: 32, width: 32 },
  headerTitle: {
    color: INK,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  headerBody: { color: MUTED, fontSize: 10, marginTop: 1 },
  segmented: {
    backgroundColor: SOFT,
    borderRadius: 6,
    flexDirection: "row",
    padding: 3,
  },
  segment: {
    alignItems: "center",
    borderRadius: 4,
    flex: 1,
    justifyContent: "center",
    minHeight: 32,
    paddingVertical: 6,
  },
  segmentActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: INK,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: { color: MUTED, fontSize: 12, fontWeight: "900" },
  segmentTextActive: { color: INK },
  listContent: { paddingBottom: 100 },
  filterToolbar: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderBottomColor: LINE,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  storeFilterButton: {
    alignItems: "center",
    backgroundColor: SOFT,
    borderColor: LINE,
    borderRadius: 4,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 32,
    paddingHorizontal: 10,
  },
  storeFilterText: { color: INK, flex: 1, fontSize: 11, fontWeight: "700" },
  communityFilterRow: { gap: 6, paddingHorizontal: 20, paddingVertical: 10 },
  filterChip: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: LINE,
    borderRadius: 32,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 30,
    minWidth: 44,
    paddingHorizontal: 13,
  },
  filterChipActive: { backgroundColor: INK, borderColor: INK },
  filterText: { color: MUTED, fontSize: 11, fontWeight: "700" },
  filterTextActive: { color: "#FFFFFF", fontWeight: "900" },
  sortButton: {
    alignItems: "center",
    borderColor: LINE,
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 32,
    paddingHorizontal: 10,
  },
  sortText: { color: INK, fontSize: 11, fontWeight: "800" },
  feedCard: {
    backgroundColor: "#FFFFFF",
    borderBottomColor: "#F6F6F8",
    borderBottomWidth: 8,
    paddingTop: 12,
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  authorGroup: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  avatarLetterCircle: {
    alignItems: "center",
    backgroundColor: INK,
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  avatarLetterText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  authorNameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  authorName: { color: INK, fontSize: 12.5, fontWeight: "900" },
  authorLevelPill: {
    backgroundColor: "rgba(230,0,0,0.1)",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  authorLevelText: { color: RED, fontSize: 9.5, fontWeight: "800" },
  visitedMeta: { color: "#A8ACAF", fontSize: 10, marginTop: 1 },
  revisitPill: {
    backgroundColor: "#F0F0F2",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  revisitPillText: { color: INK, fontSize: 10.5, fontWeight: "800" },
  photoWrap: { backgroundColor: SOFT, position: "relative" },
  feedPhoto: { backgroundColor: SOFT },
  photoTypeBadge: {
    backgroundColor: "rgba(0,0,0,0.68)",
    borderRadius: 14,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    position: "absolute",
    top: 10,
  },
  photoTypeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  photoCounter: {
    alignItems: "center",
    backgroundColor: "rgba(37,40,43,0.78)",
    borderRadius: 14,
    bottom: 10,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    position: "absolute",
    right: 10,
  },
  photoCounterText: { color: "#FFFFFF", fontSize: 9.5, fontWeight: "800" },
  cardBody: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14 },
  menuHeaderRow: {
    alignItems: "baseline",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  menuNameTitle: {
    color: INK,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  shopNameLink: { color: "#78716C", fontSize: 11.5, fontWeight: "700" },
  noteBox: {
    backgroundColor: "#F7F7F8",
    borderRadius: 8,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  noteLabel: { color: "#A8ACAF", fontSize: 10.5, fontWeight: "800", marginBottom: 2 },
  noteText: { color: INK, fontSize: 12.5, fontWeight: "500", lineHeight: 18 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  tagChip: {
    backgroundColor: "#F5F5F4",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagChipText: { color: "#57534E", fontSize: 10, fontWeight: "700" },
  cardFooterRow: {
    alignItems: "center",
    borderTopColor: "#F5F5F4",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 10,
  },
  reactionGroup: { alignItems: "center", flexDirection: "row", gap: 6 },
  createdAtText: { color: "#A8ACAF", fontSize: 11 },
  reactionButton: {
    alignItems: "center",
    borderColor: LINE,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    minHeight: 32,
    justifyContent: "center",
    minWidth: 52,
    paddingHorizontal: 10,
  },
  reactionButtonActive: { backgroundColor: "#FFF2F2", borderColor: "#FFCACA" },
  reactionText: { color: MUTED, fontSize: 11, fontWeight: "800" },
  reactionTextActive: { color: RED },
  commentButtonActive: { backgroundColor: INK, borderColor: INK },
  commentButtonTextActive: { color: "#FFFFFF" },
  logCommentsPanel: {
    backgroundColor: "#FCFCFC",
    borderTopColor: "#F0F0F2",
    borderTopWidth: StyleSheet.hairlineWidth,
    marginHorizontal: -16,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  logCommentsPreviewPanel: {
    backgroundColor: "#FFFFFF",
    marginTop: 8,
    paddingBottom: 0,
    paddingTop: 8,
  },
  commentTrigger: {
    alignItems: "center",
    backgroundColor: "#F7F7F8",
    borderColor: LINE,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 10,
  },
  commentTriggerAvatar: {
    alignItems: "center",
    backgroundColor: INK,
    borderRadius: 12,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  commentTriggerAvatarText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },
  commentTriggerText: { color: "#A8ACAF", flex: 1, fontSize: 11.5 },
  logCommentsHeader: {
    alignItems: "center",
    borderBottomColor: "#F0F0F2",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 9,
  },
  logCommentsTitle: { color: INK, fontSize: 13, fontWeight: "900" },
  logCommentsCount: { color: RED },
  logCommentsOrder: { color: "#A8ACAF", fontSize: 10 },
  logCommentsList: { gap: 0 },
  logCommentRow: {
    borderBottomColor: "#F0F0F2",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 9,
    paddingVertical: 11,
  },
  logCommentAvatar: {
    alignItems: "center",
    backgroundColor: "#E7E5E4",
    borderRadius: 14,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  logCommentAvatarText: { color: INK, fontSize: 10, fontWeight: "900" },
  logCommentMeta: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginBottom: 3,
  },
  logCommentAuthor: { color: INK, fontSize: 11.5, fontWeight: "800" },
  logCommentLevel: { color: RED, fontSize: 9, fontWeight: "800" },
  logCommentDate: { color: "#A8ACAF", fontSize: 9 },
  logCommentText: { color: "#4A4D52", fontSize: 12, lineHeight: 18 },
  moreCommentsButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    minHeight: 38,
  },
  moreCommentsText: { color: "#5A5D62", fontSize: 11, fontWeight: "800" },
  moreCommentsIconExpanded: { transform: [{ rotate: "180deg" }] },
  logCommentsEmpty: {
    color: "#A8ACAF",
    fontSize: 11,
    paddingVertical: 16,
    textAlign: "center",
  },
  logComposer: { alignItems: "center", flexDirection: "row", gap: 8, paddingTop: 10 },
  logCommentInput: {
    backgroundColor: "#FFFFFF",
    borderColor: LINE,
    borderRadius: 6,
    borderWidth: 1,
    color: INK,
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 12,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  logSendButton: {
    alignItems: "center",
    backgroundColor: INK,
    borderRadius: 6,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  logSendButtonDisabled: { opacity: 0.35 },
  logCommentError: { color: RED, fontSize: 10, fontWeight: "800", paddingTop: 5 },
  postItemCard: {
    backgroundColor: "#FFFFFF",
    borderBottomColor: "#F0F0F2",
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  postBadgeRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginBottom: 4,
  },
  categoryBadge: {
    backgroundColor: "#F2F2F2",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  categoryBadgeText: { color: "#57534E", fontSize: 10, fontWeight: "800" },
  popularBadge: {
    backgroundColor: "#FFF0F0",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  popularBadgeText: { color: RED, fontSize: 9.5, fontWeight: "900" },
  postContentRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    marginVertical: 4,
  },
  postTitle: { color: INK, fontSize: 14.5, fontWeight: "800", lineHeight: 20 },
  postContent: { color: "#78716C", fontSize: 12, lineHeight: 17, marginTop: 2 },
  postThumbSquare: {
    backgroundColor: SOFT,
    borderColor: "rgba(0,0,0,0.06)",
    borderRadius: 6,
    borderWidth: 1,
    height: 52,
    width: 52,
  },
  postFooterRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
  },
  postAuthorMeta: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 6,
    minWidth: 0,
  },
  postAuthorName: { color: "#57534E", fontSize: 11, fontWeight: "800", maxWidth: 120 },
  postAuthorLevelPill: {
    backgroundColor: "rgba(230,0,0,0.1)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  postAuthorLevelText: { color: RED, fontSize: 9, fontWeight: "800" },
  postDateText: { color: "#A8ACAF", fontSize: 10.5 },
  dotSeparator: { color: LINE, fontSize: 10 },
  postStats: { flexDirection: "row", gap: 12 },
  statInline: { alignItems: "center", flexDirection: "row", gap: 4 },
  statText: { color: MUTED, fontSize: 11, fontWeight: "700" },
  statTextActive: { color: RED },
  empty: { alignItems: "center", paddingHorizontal: 24, paddingTop: 70 },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: SOFT,
    borderRadius: 28,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  emptyTitle: { color: INK, fontSize: 15, fontWeight: "900", marginTop: 14 },
  emptyBody: { color: MUTED, fontSize: 11, marginTop: 5, textAlign: "center" },
  fab: {
    alignItems: "center",
    backgroundColor: RED,
    borderRadius: 30,
    flexDirection: "row",
    gap: 7,
    minHeight: 48,
    paddingHorizontal: 17,
    position: "absolute",
    right: 16,
    shadowColor: INK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
  },
  fabText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
})
