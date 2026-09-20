import * as Haptics from "expo-haptics"
import { Image } from "expo-image"
import { router } from "expo-router"
import { EyeOff, Flag, Heart, Images, MessageCircle, MoreHorizontal, Store } from "lucide-react-native"
import { memo, useCallback, useState, type ReactNode } from "react"
import {
  ActionSheetIOS,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native"

import type { ContentReportReason, RamenLog } from "@raota/shared"
import { track } from "../analytics"
import {
  REPORT_REASONS,
  compactTasteSummary,
  formatRelativeTime,
  formatVisitDate,
  gradeTitleOf,
  photosOf,
  tasteSummaryOf,
  tasteTagsOf,
} from "../domain/lounge"
import { useRaota } from "../state/RaotaStore"
import { colors, line, pressInto, radii, shadows, spacing, touchTarget } from "../theme"
import { ResilientUriImage } from "./ResilientUriImage"
import { AppText, BottomSheet, Button, IconButton, RamenTypeTag, Sticker, Tag, Toast } from "./ui"

/*
 * 라운지 라멘로그의 공용 부품. 피드(app/native/lounge)와 상세(app/(flows)/log/[logId])가 같이 쓴다.
 * 순서는 웹 LoungeScreen과 같고(작성자 → 사진 → 메뉴 · 메모 · 태그 → 공감 · 댓글),
 * 겉모습은 네오 브루탈리즘 라이트다: 흰 카드 + 2pt 먹선, 사진은 카드 폭 가득 + 위아래 2pt 선, 공감·댓글은 알약 키.
 */

export function openShopDetail(shopId: number) {
  router.push({ pathname: "/shop/[shopId]", params: { shopId: String(shopId) } })
}

export function openLogDetail(logId: number) {
  router.push({ pathname: "/log/[logId]", params: { logId: String(logId) } })
}

function shopLabel(shop: RamenLog["shop"]) {
  return shop.branch ? `${shop.name} ${shop.branch}` : shop.name
}

// ---------------------------------------------------------------------------
// 작성자
// ---------------------------------------------------------------------------

/** 사진 또는 이름 첫 글자. 장식이라 VoiceOver는 건너뛴다. 원이 아니라 사각(36pt 이상 12pt, 작은 것은 썸네일과 같은 8pt) */
export function Avatar({ name, uri, size = 36, tone = "dark" }: { name: string; uri?: string | null; size?: number; tone?: "dark" | "soft" }) {
  const frame = { width: size, height: size, borderRadius: size >= 36 ? radii.sm : radii.md }
  if (uri) {
    return <Image accessibilityIgnoresInvertColors accessible={false} contentFit="cover" source={{ uri }} style={[frame, styles.avatarImage]} />
  }
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[frame, styles.avatar, tone === "dark" ? styles.avatarDark : styles.avatarSoft]}
    >
      <AppText capScale style={styles.bold} tone={tone === "dark" ? "onDark" : "ink"} variant={size >= 36 ? "secondary" : "meta"}>
        {name.trim()[0] ?? "?"}
      </AppText>
    </View>
  )
}

interface LogAuthorRowProps {
  log: RamenLog
  own: boolean
  /** 남의 기록일 때만 준다. 내 기록에는 신고·숨기기 메뉴가 없다 */
  onMore?: () => void
}

/** 아바타 · 닉네임 · 등급, 아래 줄은 가게 이름(누르면 매장 정보). 인스타그램의 위치 줄처럼 읽힌다 */
export function LogAuthorRow({ log, own, onMore }: LogAuthorRowProps) {
  const grade = gradeTitleOf(log.author.level)
  return (
    <View style={styles.authorRow}>
      <Avatar name={log.author.name} uri={log.author.avatar} />
      <View style={styles.authorText}>
        <View style={styles.nameLine}>
          <AppText numberOfLines={1} style={styles.shrink} variant="bodyStrong">
            {log.author.name}
          </AppText>
          {grade ? (
            <AppText capScale numberOfLines={1} style={styles.shrinkMore} tone="muted" variant="meta">
              {grade}
            </AppText>
          ) : null}
          {own ? <Tag label="내 기록" /> : null}
        </View>
        <Pressable
          accessibilityHint="매장 정보로 이동해요"
          accessibilityLabel={`${shopLabel(log.shop)} 매장 정보`}
          accessibilityRole="button"
          hitSlop={{ top: 6, bottom: 6 }}
          onPress={() => openShopDetail(log.shop.id)}
          style={({ pressed }) => [styles.shopLink, pressed && styles.pressedDim]}
        >
          <Store color={colors.textMuted} size={14} strokeWidth={2} />
          <AppText capScale numberOfLines={1} style={[styles.shrink, styles.bold]} tone="sub" variant="secondary">
            {shopLabel(log.shop)}
          </AppText>
        </Pressable>
      </View>
      {onMore ? (
        <IconButton
          accessibilityLabel={`${log.author.name}님의 라멘로그 메뉴`}
          icon={<MoreHorizontal color={colors.inkSub} size={20} />}
          onPress={onMore}
        />
      ) : null}
    </View>
  )
}

// ---------------------------------------------------------------------------
// 공감 · 댓글
// ---------------------------------------------------------------------------

/** 공감 알약 키(흰 면 + 2pt 먹선 + 번지지 않는 그림자). 공감한 상태는 빨강 하트 */
export function LikeButton({ liked, count, onPress }: { liked: boolean; count: number; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={`공감 ${count}개`}
      accessibilityHint={liked ? "누르면 공감을 취소해요" : "누르면 공감해요"}
      accessibilityRole="button"
      accessibilityState={{ selected: liked }}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
    >
      <Heart color={liked ? colors.brand : colors.ink} fill={liked ? colors.brand : "none"} size={16} strokeWidth={2} />
      <AppText capScale style={[styles.bold, styles.tabular]} tone={liked ? "brand" : "ink"} variant="secondary">
        {count}
      </AppText>
    </Pressable>
  )
}

export function CommentCountButton({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <Pressable
      accessibilityHint="댓글을 보고 남길 수 있어요"
      accessibilityLabel={`댓글 ${count}개`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
    >
      <MessageCircle color={colors.ink} size={16} strokeWidth={2} />
      <AppText capScale style={[styles.bold, styles.tabular]} tone="ink" variant="secondary">
        {count}
      </AppText>
    </Pressable>
  )
}

/** 공감 누르기: 비회원은 로그인으로, 공감할 때만 가벼운 햅틱 */
export function useLikeLog() {
  const { currentUser, actions } = useRaota()
  return useCallback(
    (log: RamenLog) => {
      if (!currentUser) {
        router.push("/auth/login")
        return
      }
      if (!log.isLiked) {
        if (Platform.OS === "ios") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
        track("log_liked")
      }
      // TODO(API): POST /logs/{id}/like (취소는 DELETE). 실패하면 되돌리고 토스트로 알린다
      actions.toggleLogLike(log.id)
    },
    [actions, currentUser],
  )
}

// ---------------------------------------------------------------------------
// 맛 평가 · 태그 · 메모
// ---------------------------------------------------------------------------

export function TasteTags({ tags, max, style }: { tags: string[]; max?: number; style?: StyleProp<ViewStyle> }) {
  if (tags.length === 0) return null
  const shown = max ? tags.slice(0, max) : tags
  const rest = tags.length - shown.length
  return (
    <View accessibilityLabel={`맛 태그: ${tags.join(", ")}`} accessible style={[styles.tags, style]}>
      {shown.map((tag) => (
        <Tag key={tag} label={`#${tag}`} />
      ))}
      {rest > 0 ? <Tag label={`+${rest}`} /> : null}
    </View>
  )
}

/** 상세의 맛 평가 다섯 줄: 이름 · 한 마디(좋고 나쁨 항목은 점수도). 정보 영역이라 1pt 구분선만 쓴다 */
export function TasteSummaryList({ log }: { log: RamenLog }) {
  const rows = tasteSummaryOf(log)
  if (rows.length === 0) return null
  return (
    <View>
      <AppText accessibilityRole="header" style={styles.summaryTitle} variant="bodyStrong">
        맛 평가
      </AppText>
      {rows.map((row) => (
        <View
          accessibilityLabel={row.score && row.key !== "revisit" ? `${row.label} 5점 중 ${row.score}점, ${row.word}` : `${row.label}, ${row.word}`}
          accessible
          key={row.key}
          style={styles.summaryRow}
        >
          <AppText capScale tone="sub" variant="secondary">
            {row.label}
          </AppText>
          <AppText capScale style={styles.summaryWord} variant="secondary">
            {row.word}
            {row.score && row.key !== "revisit" ? (
              <AppText style={styles.tabular} tone="sub" variant="secondary">{`  ${row.score}/5`}</AppText>
            ) : null}
          </AppText>
        </View>
      ))}
    </View>
  )
}

/** 메모는 꾸미지 않은 본문으로 둔다(굵은 세로줄 인용 장식을 쓰지 않는다) */
export function LogNote({ note, numberOfLines }: { note: string; numberOfLines?: number }) {
  if (!note.trim()) return null
  return (
    <AppText numberOfLines={numberOfLines} variant="body">
      {note}
    </AppText>
  )
}

// ---------------------------------------------------------------------------
// 피드 카드
// ---------------------------------------------------------------------------

export interface LoungeLogCardProps {
  log: RamenLog
  own: boolean
  onLike: (log: RamenLog) => void
  onMore: (log: RamenLog) => void
}

/**
 * 피드의 라멘로그 한 장. 본문(사진 · 메뉴 · 맛 평가 · 메모 · 태그)은 하나의 Pressable로 상세에 간다.
 * 가게 이름, 공감, 댓글, 메뉴(…)는 본문 밖의 따로 누르는 버튼이다(행 안에 행을 넣지 않는다).
 */
export const LoungeLogCard = memo(function LoungeLogCard({ log, own, onLike, onMore }: LoungeLogCardProps) {
  const photos = photosOf(log)
  const summary = compactTasteSummary(log)
  const tags = tasteTagsOf(log)
  const commentCount = log.comments?.length ?? log.commentCount ?? 0
  const visit = formatVisitDate(log.visitedAt)
  const bodyLabel = [
    `${log.author.name}님의 ${log.menuName}`,
    `${log.ramenType}, ${visit} 방문`,
    summary?.label,
    log.note,
  ]
    .filter(Boolean)
    .join(". ")

  return (
    <View style={styles.card} testID={`lounge-log-${log.id}`}>
      <LogAuthorRow log={log} onMore={own ? undefined : () => onMore(log)} own={own} />

      <Pressable
        accessibilityHint="라멘로그와 댓글을 봐요"
        accessibilityLabel={bodyLabel}
        accessibilityRole="button"
        onPress={() => openLogDetail(log.id)}
        style={({ pressed }) => pressed && styles.pressedWash}
      >
        {photos.length > 0 ? (
          <View style={styles.feedPhoto}>
            <ResilientUriImage accessibilityLabel="" style={StyleSheet.absoluteFill} uri={photos[0]} />
            {photos.length > 1 ? (
              <View style={styles.photoCount}>
                <Sticker
                  icon={<Images color={colors.onDark} size={12} strokeWidth={2.2} />}
                  label={String(photos.length)}
                  tone="ink"
                />
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.cardText}>
          <View style={styles.titleBlock}>
            <View style={styles.titleRow}>
              <AppText numberOfLines={2} style={styles.flex} variant="cardTitle">
                {log.menuName}
              </AppText>
              <RamenTypeTag type={log.ramenType} />
            </View>
            <AppText capScale numberOfLines={1} tone="muted" variant="meta">
              {`${visit} 방문`}
            </AppText>
          </View>

          {summary ? (
            <AppText capScale numberOfLines={2} style={styles.summaryLine} tone="sub" variant="secondary">
              {summary.text}
            </AppText>
          ) : null}

          <LogNote note={log.note} numberOfLines={3} />
          <TasteTags max={3} tags={tags} />
        </View>
      </Pressable>

      <View style={styles.footer}>
        <LikeButton count={log.likes} liked={log.isLiked} onPress={() => onLike(log)} />
        <CommentCountButton count={commentCount} onPress={() => openLogDetail(log.id)} />
        <AppText capScale numberOfLines={1} style={styles.time} tone="muted" variant="meta">
          {formatRelativeTime(log.createdAt)}
        </AppText>
      </View>
    </View>
  )
})

// ---------------------------------------------------------------------------
// 상세의 사진 넘기기
// ---------------------------------------------------------------------------

export function LogPhotoPager({ photos, menuName }: { photos: string[]; menuName: string }) {
  const { width } = useWindowDimensions()
  // 사진을 두른 2pt 선 안쪽이 한 장의 폭이다(선을 빼지 않으면 넘기는 위치가 어긋난다)
  const pageWidth = width - spacing.gutter * 2 - line.base * 2
  const [index, setIndex] = useState(0)
  if (photos.length === 0) return null
  const onEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / Math.max(1, pageWidth))
    setIndex(Math.min(photos.length - 1, Math.max(0, next)))
  }
  return (
    <View style={styles.pager}>
      <ScrollView
        accessibilityLabel={`${menuName} 사진 ${photos.length}장`}
        horizontal
        onMomentumScrollEnd={onEnd}
        pagingEnabled
        showsHorizontalScrollIndicator={false}
      >
        {photos.map((uri, photoIndex) => (
          <ResilientUriImage
            accessibilityLabel={`${menuName} 사진 ${photoIndex + 1}`}
            key={`${uri}-${photoIndex}`}
            style={{ width: pageWidth, aspectRatio: 4 / 3 }}
            uri={uri}
          />
        ))}
      </ScrollView>
      {photos.length > 1 ? (
        <View accessibilityLiveRegion="polite" style={styles.photoCount}>
          <Sticker label={`${index + 1} / ${photos.length}`} tone="ink" />
        </View>
      ) : null}
    </View>
  )
}

// ---------------------------------------------------------------------------
// 신고 · 숨기기 (앱 심사 가이드라인 1.2)
// ---------------------------------------------------------------------------

export interface ModerationTarget {
  kind: "log" | "comment"
  id: number
  authorId?: string
  authorName: string
}

interface ToastState {
  message: string
  undoAuthorId?: string
}

export interface LoungeModerationOptions {
  /** 이 사용자를 숨긴 직후(상세 화면이 빈 상태로 바꿀 때 쓴다) */
  onHidden?: (target: ModerationTarget) => void
  onReported?: (target: ModerationTarget) => void
  /** 토스트를 하단 입력 바 위로 올릴 때 */
  toastStyle?: StyleProp<ViewStyle>
}

/**
 * 남의 라멘로그·댓글의 "…" 메뉴: 신고하기 · 이 사용자 숨기기.
 * iOS는 시스템 액션 시트, 그 밖(웹 미리보기)은 바텀시트. 비회원이 고르면 로그인으로 보낸다.
 * element를 화면 트리 안에 한 번 그려야 시트와 토스트가 보인다.
 */
export function useLoungeModeration({ onHidden, onReported, toastStyle }: LoungeModerationOptions = {}) {
  const { currentUser, actions } = useRaota()
  const [menuTarget, setMenuTarget] = useState<ModerationTarget | null>(null)
  const [reportTarget, setReportTarget] = useState<ModerationTarget | null>(null)
  const [reason, setReason] = useState<ContentReportReason | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  const startReport = useCallback(
    (target: ModerationTarget) => {
      if (!currentUser) {
        router.push("/auth/login")
        return
      }
      setReason(null)
      setReportTarget(target)
    },
    [currentUser],
  )

  const hide = useCallback(
    (target: ModerationTarget) => {
      if (!currentUser) {
        router.push("/auth/login")
        return
      }
      if (!target.authorId || !actions.hideAuthor(target.authorId)) {
        setToast({ message: "이 사용자를 숨기지 못했어요. 다시 시도해 주세요." })
        return
      }
      setToast({ message: `${target.authorName}님의 글을 더 이상 보여주지 않아요.`, undoAuthorId: target.authorId })
      onHidden?.(target)
    },
    [actions, currentUser, onHidden],
  )

  const openMenu = useCallback(
    (target: ModerationTarget) => {
      const noun = target.kind === "log" ? "라멘로그" : "댓글"
      if (Platform.OS === "ios") {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            title: `${target.authorName}님의 ${noun}`,
            options: ["신고하기", "이 사용자 숨기기", "취소"],
            destructiveButtonIndex: 0,
            cancelButtonIndex: 2,
          },
          (index) => {
            if (index === 0) startReport(target)
            if (index === 1) hide(target)
          },
        )
        return
      }
      setMenuTarget(target)
    },
    [hide, startReport],
  )

  const submitReport = () => {
    if (!reportTarget || !reason) return
    const report = actions.reportContent({ kind: reportTarget.kind, id: reportTarget.id, reason })
    const target = reportTarget
    setReportTarget(null)
    if (!report) {
      setToast({ message: "신고를 보내지 못했어요. 로그인 상태를 확인해 주세요." })
      return
    }
    setToast({ message: "신고를 접수했어요. 검토 후 조치할게요." })
    onReported?.(target)
  }

  const menuNoun = menuTarget?.kind === "comment" ? "댓글" : "라멘로그"
  const element: ReactNode = (
    <>
      <BottomSheet
        onClose={() => setMenuTarget(null)}
        title={menuTarget ? `${menuTarget.authorName}님의 ${menuNoun}` : undefined}
        visible={Boolean(menuTarget)}
      >
        <MenuRow
          description="운영 정책에 어긋나는 글을 알려주세요"
          icon={<Flag color={colors.critical} size={20} />}
          label="신고하기"
          onPress={() => {
            const target = menuTarget
            setMenuTarget(null)
            if (target) startReport(target)
          }}
        />
        <MenuRow
          description="이 사람의 라멘로그와 댓글이 보이지 않아요"
          icon={<EyeOff color={colors.ink} size={20} />}
          label="이 사용자 숨기기"
          onPress={() => {
            const target = menuTarget
            setMenuTarget(null)
            if (target) hide(target)
          }}
        />
      </BottomSheet>

      <BottomSheet
        description="검토 후 운영 정책에 따라 조치해요. 신고한 글은 더 이상 보이지 않아요."
        footer={
          <View style={styles.reportFooter}>
            {!reason ? (
              <AppText capScale tone="muted" variant="meta">
                신고 사유를 고르면 보낼 수 있어요
              </AppText>
            ) : null}
            <Button disabled={!reason} fullWidth onPress={submitReport} title="신고하기" />
          </View>
        }
        onClose={() => setReportTarget(null)}
        title={reportTarget?.kind === "comment" ? "댓글 신고하기" : "라멘로그 신고하기"}
        visible={Boolean(reportTarget)}
      >
        <View accessibilityLabel="신고 사유" accessibilityRole="radiogroup">
          {REPORT_REASONS.map((item) => {
            const checked = reason === item.value
            return (
              <Pressable
                accessibilityLabel={item.label}
                accessibilityRole="radio"
                accessibilityState={{ checked }}
                key={item.value}
                onPress={() => setReason(item.value)}
                style={({ pressed }) => [styles.reasonRow, pressed && styles.pressedWash]}
              >
                <View style={[styles.radio, checked && styles.radioChecked]}>{checked ? <View style={styles.radioDot} /> : null}</View>
                <AppText style={checked ? styles.bold : undefined} variant="body">
                  {item.label}
                </AppText>
              </Pressable>
            )
          })}
        </View>
      </BottomSheet>

      <Toast
        actionLabel={toast?.undoAuthorId ? "되돌리기" : undefined}
        message={toast?.message ?? ""}
        onAction={() => {
          if (toast?.undoAuthorId) actions.unhideAuthor(toast.undoAuthorId)
          setToast(null)
        }}
        onDismiss={() => setToast(null)}
        style={toastStyle}
        visible={Boolean(toast)}
      />
    </>
  )

  return { openMenu, element }
}

function MenuRow({ icon, label, description, onPress }: { icon: ReactNode; label: string; description: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityHint={description}
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, pressed && styles.pressedWash]}
    >
      {icon}
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{label}</AppText>
        <AppText tone="muted" variant="meta">
          {description}
        </AppText>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: "700" },
  tabular: { fontVariant: ["tabular-nums"] },
  shrink: { flexShrink: 1 },
  shrinkMore: { flexShrink: 2 },
  pressedDim: { opacity: 0.7 },
  pressedWash: { backgroundColor: colors.canvasSoft },

  avatar: { alignItems: "center", justifyContent: "center" },
  avatarDark: { backgroundColor: colors.ink },
  // 옅은 면은 미색 바탕에서 묻히므로 1.5pt 선으로 테두리를 잡는다
  avatarSoft: { backgroundColor: colors.canvasSoft, borderWidth: line.thin, borderColor: colors.outline },
  avatarImage: { backgroundColor: colors.canvasSoft },

  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x2_5,
    paddingLeft: spacing.x3_5,
    paddingRight: spacing.x2,
    paddingVertical: spacing.x2_5,
  },
  authorText: { flex: 1, minWidth: 0 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: spacing.x1_5, minWidth: 0 },
  shopLink: { flexDirection: "row", alignItems: "center", gap: spacing.x1, minHeight: 32, alignSelf: "flex-start", maxWidth: "100%" },

  // 흰 카드 + 2pt 먹선. 그림자는 없다
  card: {
    backgroundColor: colors.canvas,
    borderRadius: radii.sm,
    borderColor: colors.outline,
    borderWidth: line.base,
    paddingBottom: spacing.x3,
  },
  // 사진은 카드 폭 가득. 위아래 2pt 먹선이 글씨 영역과 나눈다
  feedPhoto: {
    width: "100%",
    aspectRatio: 16 / 10,
    borderTopWidth: line.base,
    borderBottomWidth: line.base,
    borderColor: colors.outline,
    overflow: "hidden",
    backgroundColor: colors.canvasSoft,
  },
  photoCount: { position: "absolute", top: spacing.x2_5, right: spacing.x2_5 },
  cardText: { paddingHorizontal: spacing.x3_5, paddingTop: spacing.x3, gap: spacing.x2_5 },
  titleBlock: { gap: spacing.x0_5 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.x2 },
  summaryLine: { fontWeight: "600" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x1 },
  footer: { flexDirection: "row", alignItems: "center", gap: spacing.x2_5, paddingHorizontal: spacing.x3_5, paddingTop: spacing.x3 },
  time: { flex: 1, textAlign: "right" },
  // 공감·댓글은 누를 수 있는 키라서 번지지 않는 그림자가 붙는다
  pill: {
    minHeight: touchTarget,
    minWidth: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.x1_5,
    paddingHorizontal: spacing.x3_5,
    borderRadius: radii.pill,
    borderWidth: line.base,
    borderColor: colors.outline,
    backgroundColor: colors.canvas,
    ...shadows.hardS,
  },
  pillPressed: pressInto(2),

  summaryTitle: { marginBottom: spacing.x1 },
  summaryRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.x3,
    paddingVertical: spacing.x2,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  summaryWord: { fontWeight: "700", flexShrink: 1, textAlign: "right" },

  pager: {
    marginHorizontal: spacing.gutter,
    borderRadius: radii.sm,
    borderColor: colors.outline,
    borderWidth: line.base,
    overflow: "hidden",
    backgroundColor: colors.canvasSoft,
  },

  menuRow: { flexDirection: "row", alignItems: "center", gap: spacing.x3, minHeight: 56, paddingVertical: spacing.x2, borderRadius: radii.sm },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: spacing.x3, minHeight: touchTarget + 4, borderRadius: radii.sm },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    borderWidth: line.base,
    borderColor: colors.outline,
    alignItems: "center",
    justifyContent: "center",
  },
  radioChecked: { borderColor: colors.brand },
  radioDot: { width: 10, height: 10, borderRadius: radii.pill, backgroundColor: colors.brand },
  reportFooter: { gap: spacing.x2 },
})
