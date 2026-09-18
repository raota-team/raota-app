import { useMemo, useState } from "react"
import { router, useLocalSearchParams } from "expo-router"
import { Image } from "expo-image"
import { Heart, MapPin, MessageCircle, Reply, Send } from "lucide-react-native"
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native"

import type { CommunityComment } from "@raota/shared"
import { useRaota } from "@/src/state/RaotaStore"
import {
  ActionButton,
  FlowHeader,
  FlowPage,
  Text,
  flowStyles,
  palette,
} from "../_layout"

function readableDate(dateStr: string) {
  if (dateStr === "방금 전" || dateStr.includes("전")) return dateStr
  const match = dateStr.match(/(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/)
  if (match) {
    const [, y, m, d] = match
    return `${y}.${m.padStart(2, "0")}.${d.padStart(2, "0")}`
  }
  return dateStr.split(" ")[0] ?? dateStr
}

function getCategoryBadgeColors(category?: string, label?: string) {
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

export default function CommunityPostScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>()
  const { width } = useWindowDimensions()
  const { currentUser, getPost, actions } = useRaota()
  const parsed = Number(postId)
  const post = Number.isFinite(parsed) ? getPost(parsed) : undefined
  const [comment, setComment] = useState("")
  const [replyingTo, setReplyingTo] = useState<CommunityComment | null>(null)
  const [error, setError] = useState<string | null>(null)

  const comments = useMemo(() => post?.comments ?? [], [post?.comments])

  if (!post) {
    return (
      <FlowPage>
        <FlowHeader title="커뮤니티 글" />
        <View style={styles.missing}>
          <Text style={styles.missingTitle}>글을 찾을 수 없어요</Text>
          <Text style={flowStyles.secondary}>
            삭제되었거나 잘못된 링크일 수 있습니다.
          </Text>
          <View style={{ width: "100%", marginTop: 10 }}>
            <ActionButton
              label="라운지로 이동"
              onPress={() => router.replace("/native/lounge")}
            />
          </View>
        </View>
      </FlowPage>
    )
  }

  const submitComment = () => {
    const content = comment.trim()
    if (!currentUser) {
      router.push("/auth/login")
      return
    }
    if (content.length < 2) {
      setError("댓글을 2자 이상 입력해주세요.")
      return
    }
    const created = actions.addComment(post.id, {
      content,
      parentId: replyingTo?.id,
    })
    if (!created) {
      setError("댓글을 저장하지 못했어요.")
      return
    }
    setComment("")
    setReplyingTo(null)
    setError(null)
  }

  return (
    <FlowPage>
      <FlowHeader
        title={post.categoryLabel}
        subtitle={`조회 ${post.viewCount.toLocaleString()} · 댓글 ${post.commentCount}`}
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FlatList
          data={comments}
          keyExtractor={(item) => String(item.id)}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.postBody}>
              <View style={styles.categoryRow}>
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
                <Text style={styles.date}>{readableDate(post.createdAt)}</Text>
              </View>
              <Text style={styles.title}>{post.title}</Text>
              <View style={styles.authorRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {post.author.name.slice(0, 1)}
                  </Text>
                </View>
                <View>
                  <Text style={styles.author}>{post.author.name}</Text>
                  <Text style={styles.level}>{post.author.level}</Text>
                </View>
              </View>
              {!!post.imageUrls.length && (
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  style={styles.imageScroll}
                >
                  {post.imageUrls.map((uri, index) => (
                    <Image
                      key={`${uri}-${index}`}
                      source={{ uri }}
                      contentFit="cover"
                      style={{
                        width: width - 32,
                        height: Math.min((width - 32) * 0.72, 310),
                      }}
                      transition={160}
                    />
                  ))}
                </ScrollView>
              )}
              <Text style={styles.lead}>{post.content}</Text>
              {post.detailedContent?.map((paragraph) => (
                <Text key={paragraph} style={styles.paragraph}>
                  {paragraph}
                </Text>
              ))}
              {!!post.shopId && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: "/shop/[shopId]",
                      params: { shopId: String(post.shopId) },
                    })
                  }
                  style={styles.shopLink}
                >
                  <MapPin color={palette.red} size={18} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.shopLinkLabel}>글에 언급된 매장</Text>
                    <Text style={styles.shopLinkName}>
                      {post.shopName ?? "매장 상세 보기"}
                    </Text>
                  </View>
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={post.isLiked ? "글 공감 취소" : "글 공감"}
                accessibilityState={{ selected: post.isLiked }}
                onPress={() => actions.togglePostLike(post.id)}
                style={[
                  styles.likeButton,
                  post.isLiked && styles.likeButtonActive,
                ]}
              >
                <Heart
                  color={post.isLiked ? palette.canvas : palette.red}
                  fill={post.isLiked ? palette.canvas : "transparent"}
                  size={20}
                />
                <Text
                  style={[
                    styles.likeText,
                    post.isLiked && { color: palette.canvas },
                  ]}
                >
                  공감 {post.likes}
                </Text>
              </Pressable>
              <View style={styles.commentHeading}>
                <MessageCircle color={palette.ink} size={20} />
                <Text style={styles.commentHeadingText}>
                  댓글 {comments.length}
                </Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <Text style={styles.noComments}>
              첫 댓글을 남겨 대화를 시작해보세요.
            </Text>
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.commentRow,
                Boolean(item.parentId) && styles.replyRow,
              ]}
            >
              <View style={styles.commentAvatar}>
                <Text style={styles.commentAvatarText}>
                  {item.author.name.slice(0, 1)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.commentMeta}>
                  <Text style={styles.commentAuthor}>{item.author.name}</Text>
                  <Text style={styles.commentLevel}>{item.author.level}</Text>
                </View>
                {!!item.parentAuthorName && (
                  <Text style={styles.replyTarget}>
                    @{item.parentAuthorName}
                  </Text>
                )}
                <Text style={styles.commentText}>{item.content}</Text>
                <View style={styles.commentFooter}>
                  <Text style={styles.commentDate}>
                    {readableDate(item.createdAt)} · 공감 {item.likes}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${item.author.name}님에게 답글`}
                    onPress={() => setReplyingTo(item)}
                    style={styles.replyButton}
                  >
                    <Reply color={palette.muted} size={15} />
                    <Text style={styles.replyButtonText}>답글</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        />

        {!!replyingTo && (
          <View style={styles.replyBanner}>
            <Text style={styles.replyBannerText}>
              {replyingTo.author.name}님에게 답글
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="답글 취소"
              onPress={() => setReplyingTo(null)}
              style={styles.cancelReply}
            >
              <Text style={styles.cancelReplyText}>취소</Text>
            </Pressable>
          </View>
        )}
        {!!error && (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {error}
          </Text>
        )}
        <View style={styles.composer}>
          <TextInput
            accessibilityLabel={
              replyingTo
                ? `${replyingTo.author.name}님에게 답글 입력`
                : "댓글 입력"
            }
            maxLength={300}
            multiline
            onChangeText={setComment}
            onFocus={() => setError(null)}
            placeholder={
              currentUser
                ? "댓글을 남겨보세요"
                : "로그인 후 댓글을 쓸 수 있어요"
            }
            placeholderTextColor={palette.quiet}
            style={styles.commentInput}
            value={comment}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="댓글 등록"
            onPress={submitComment}
            style={[styles.sendButton, !comment.trim() && { opacity: 0.45 }]}
          >
            <Send color={palette.canvas} size={19} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </FlowPage>
  )
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 24 },
  postBody: { gap: 14 },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  categoryBadgeText: { fontSize: 11, fontWeight: "800" },
  date: { color: palette.quiet, fontSize: 11 },
  title: {
    color: palette.ink,
    fontSize: 27,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: palette.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: palette.canvas, fontSize: 16, fontWeight: "800" },
  author: { color: palette.ink, fontSize: 14, fontWeight: "800" },
  level: { color: palette.muted, fontSize: 11, marginTop: 2 },
  imageScroll: { marginHorizontal: -16, backgroundColor: palette.wash },
  lead: { color: palette.ink, fontSize: 17, lineHeight: 26, fontWeight: "700" },
  paragraph: { color: palette.ink, fontSize: 16, lineHeight: 25 },
  shopLink: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 10,
    backgroundColor: palette.wash,
    padding: 13,
  },
  shopLinkLabel: { color: palette.muted, fontSize: 11 },
  shopLinkName: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2,
  },
  likeButton: {
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.red,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 20,
  },
  likeButtonActive: { backgroundColor: palette.red },
  likeText: { color: palette.red, fontSize: 14, fontWeight: "800" },
  commentHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 8,
    paddingTop: 18,
    borderTopColor: palette.line,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  commentHeadingText: { color: palette.ink, fontSize: 18, fontWeight: "800" },
  commentRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 15,
    borderBottomColor: palette.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  replyRow: {
    marginLeft: 28,
    backgroundColor: palette.wash,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.wash,
    alignItems: "center",
    justifyContent: "center",
  },
  commentAvatarText: { color: palette.ink, fontSize: 13, fontWeight: "800" },
  commentMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  commentAuthor: { color: palette.ink, fontSize: 13, fontWeight: "800" },
  commentLevel: { color: palette.muted, fontSize: 11 },
  replyTarget: {
    color: palette.red,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 5,
  },
  commentText: {
    color: palette.ink,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 5,
  },
  commentFooter: {
    minHeight: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 3,
  },
  commentDate: { color: palette.quiet, fontSize: 11 },
  replyButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 4,
  },
  replyButtonText: { color: palette.muted, fontSize: 11, fontWeight: "700" },
  noComments: {
    color: palette.muted,
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 35,
  },
  replyBanner: {
    minHeight: 44,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.wash,
  },
  replyBannerText: {
    flex: 1,
    color: palette.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  cancelReply: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  cancelReplyText: { color: palette.red, fontSize: 12, fontWeight: "800" },
  error: {
    color: palette.red,
    fontSize: 12,
    paddingHorizontal: 16,
    paddingTop: 7,
  },
  composer: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    borderTopColor: palette.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: palette.canvas,
  },
  commentInput: {
    flex: 1,
    maxHeight: 100,
    minHeight: 44,
    color: palette.ink,
    fontSize: 15,
    lineHeight: 20,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.red,
    alignItems: "center",
    justifyContent: "center",
  },
  missing: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 28,
  },
  missingTitle: { color: palette.ink, fontSize: 20, fontWeight: "800" },
})
