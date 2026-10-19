import * as Haptics from "expo-haptics"
import { Image } from "expo-image"
import { router } from "expo-router"
import { ChevronLeft, EyeOff, Flag, Heart, Images, MoreHorizontal } from "lucide-react-native"
import { memo, useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react"
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
import Animated, {
  Easing,
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated"

import { TASTE_AXES, scoresFromLog, type ContentReportReason, type RamenLog } from "@raota/shared"
import { track } from "../analytics"
import {
  REPORT_REASONS,
  compactTasteSummary,
  formatVisitDate,
  gradeTitleOf,
  photosOf,
  tasteSummaryOf,
} from "../domain/lounge"
import { useRaota } from "../state/RaotaStore"
import { colors, line, pressFade, radii, spacing, touchTarget } from "../theme"
import { ResilientUriImage } from "./ResilientUriImage"
import { TasteFingerprint } from "./TasteFingerprint"
import { PhotoViewer } from "./PhotoViewer"
import { AppText, BottomSheet, Button, IconButton, Sticker, Tag, Toast } from "./ui"

const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1)

/*
 * 공개 라멘로그는 사진과 짧은 한 줄을 먼저 보여 준다. 상세에서 기록 전체와 신고·숨기기,
 * 공감·댓글을 그대로 이어서 사용할 수 있다.
 */

export function openShopDetail(shopId: string) {
  router.push({ pathname: "/shop/[shopId]", params: { shopId } })
}

export function openLogDetail(logId: string) {
  router.push({ pathname: "/log/[logId]", params: { logId } })
}

function shopLabel(shop: RamenLog["shop"]) {
  return shop.branch ? `${shop.name} ${shop.branch}` : shop.name
}

/** 사진 또는 이름 첫 글자. 장식이라 VoiceOver는 건너뛴다. */
export function Avatar({ name, uri, size = 36, tone = "dark" }: { name: string; uri?: string | null; size?: number; tone?: "dark" | "soft" }) {
  const frame = { width: size, height: size, borderRadius: radii.pill }
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

/** 상세 사진 아래의 작성자와 방문 시점. */
export function LogAuthorRow({ log }: { log: RamenLog }) {
  const grade = gradeTitleOf(log.author.level)
  return (
    <View style={styles.authorRow}>
      <Avatar name={log.author.name} uri={log.author.avatar} tone="soft" />
      <View style={styles.authorText}>
        <AppText lineBreakStrategyIOS="hangul-word" variant="bodyStrong">{log.author.name}</AppText>
        <AppText capScale numberOfLines={1} tone="muted" variant="meta">
          {[grade, formatVisitDate(log.visitedAt)].filter(Boolean).join(" · ")}
        </AppText>
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// 공감 · 댓글
// ---------------------------------------------------------------------------

/** 공감 수는 누를 수 있는 한 줄로 남기고, 좋아요만 빨간 하트로 표시한다. */
export function LikeButton({ liked, count, onPress }: { liked: boolean; count: number; onPress: () => void }) {
  const reducedMotion = useReducedMotion()
  const previous = useRef({ liked, count })
  const [numbers, setNumbers] = useState({ from: count, to: count, direction: 1 })
  const heartScale = useSharedValue(1)
  const roll = useSharedValue(1)

  useLayoutEffect(() => {
    const before = previous.current
    previous.current = { liked, count }
    if (reducedMotion) {
      heartScale.value = 1
      roll.value = 1
    } else if (liked !== before.liked) {
      heartScale.value = 1
      if (liked) {
        heartScale.value = withSequence(
          withTiming(1.3, { duration: 147, easing: EASE_OUT }),
          withTiming(0.92, { duration: 126, easing: EASE_OUT }),
          withTiming(1, { duration: 147, easing: EASE_OUT }),
        )
      }
    }
    if (count === before.count) return
    // 숫자는 고정 칸 안에서만 교체해 옆 요소가 밀리지 않게 한다.
    roll.value = reducedMotion ? 1 : 0
    setNumbers({ from: before.count, to: count, direction: liked !== before.liked ? (liked ? 1 : -1) : count > before.count ? 1 : -1 })
    if (reducedMotion) return
    const frame = requestAnimationFrame(() => {
      roll.value = withTiming(1, { duration: 350, easing: EASE_OUT })
    })
    return () => cancelAnimationFrame(frame)
  }, [count, heartScale, liked, reducedMotion, roll])

  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heartScale.value }] }))
  const outgoingStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -numbers.direction * 26 * roll.value }],
  }))
  const incomingStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: numbers.direction * 26 * (1 - roll.value) }],
  }))

  return (
    <Pressable
      accessibilityLabel={`공감 ${count}개`}
      accessibilityHint={liked ? "누르면 공감을 취소해요" : "누르면 공감해요"}
      accessibilityRole="button"
      accessibilityState={{ selected: liked }}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
    >
      <Animated.View style={heartStyle}>
        <Heart color={liked ? colors.brand : colors.ink} fill={liked ? colors.brand : "none"} size={16} strokeWidth={2} />
      </Animated.View>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.likeCountWindow}>
        <Animated.View style={[styles.likeNumberLine, outgoingStyle]}>
          <AppText adjustsFontSizeToFit capScale minimumFontScale={0.7} numberOfLines={1} style={[styles.bold, styles.tabular, styles.likeCount]} tone={liked ? "brand" : "ink"} variant="secondary">
            {numbers.from}
          </AppText>
        </Animated.View>
        <Animated.View style={[styles.likeNumberLine, incomingStyle]}>
          <AppText adjustsFontSizeToFit capScale minimumFontScale={0.7} numberOfLines={1} style={[styles.bold, styles.tabular, styles.likeCount]} tone={liked ? "brand" : "ink"} variant="secondary">
            {numbers.to}
          </AppText>
        </Animated.View>
      </View>
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

export function TasteTags({ tags, style }: { tags: string[]; style?: StyleProp<ViewStyle> }) {
  if (tags.length === 0) return null
  return (
    <ScrollView accessibilityLabel={`맛 태그: ${tags.join(", ")}`} accessible contentContainerStyle={styles.tags} horizontal showsHorizontalScrollIndicator={false} style={style}>
      {tags.map((tag) => <Tag key={tag} label={`#${tag}`} />)}
    </ScrollView>
  )
}

/** 기록의 다섯 평가를 맛 지문으로 표시한다. 꼭짓점에는 점수 대신 그 점수의 말("진한 편")을 둔다 */
export function LogTasteFingerprint({ log }: { log: RamenLog }) {
  const scores = scoresFromLog(log)
  if (!scores) return null
  const words = tasteSummaryOf(log)
  const rows = TASTE_AXES.map(({ key, label }, index) => ({
    key,
    label: key === "satisfaction" ? "만족도" : key === "revisit" ? "재방문" : label,
    value: scores[key],
    text: words[index].word,
  }))
  return <TasteFingerprint meta={`${log.author.name}의 기록`} rows={rows} style={styles.fingerprint} />
}

/** 메모는 기록 본문으로 이어 놓는다. */
export function LogNote({ note, numberOfLines }: { note: string; numberOfLines?: number }) {
  if (!note.trim()) return null
  return (
    <AppText lineBreakStrategyIOS="hangul-word" numberOfLines={numberOfLines} style={styles.detailNote} variant="body">
      {note}
    </AppText>
  )
}

// ---------------------------------------------------------------------------
// 피드 카드
// ---------------------------------------------------------------------------

export interface LoungeLogCardProps {
  log: RamenLog
  tall: boolean
  batchIndex?: number
}

/** 공개 기록은 사진(또는 인용문)과 한 줄·작성자만 먼저 보여 준다. 공감·댓글·신고는 상세에 있다. */
export const LoungeLogCard = memo(function LoungeLogCard({ log, tall, batchIndex = 0 }: LoungeLogCardProps) {
  const reducedMotion = useReducedMotion()
  const photos = photosOf(log)
  const summary = compactTasteSummary(log)
  const bodyLabel = [
    `${log.author.name}님의 ${log.menuName}`,
    `${log.ramenType}, ${formatVisitDate(log.visitedAt)} 방문`,
    summary?.label,
    log.note,
  ].filter(Boolean).join(". ")

  return (
    <Animated.View
      entering={reducedMotion
        ? undefined
        : FadeInUp.duration(450)
            .delay(Math.min(Math.max(batchIndex, 0) * 50, 400))
            .easing(EASE_OUT)
            .withInitialValues({ opacity: 0, transform: [{ translateY: 14 }] })}
    >
      <Pressable
        accessibilityHint="라멘로그와 댓글을 봐요"
        accessibilityLabel={bodyLabel}
        accessibilityRole="button"
        onPress={() => openLogDetail(log.id)}
        style={({ pressed }) => [styles.pin, pressed && pressFade]}
        testID={`lounge-log-${log.id}`}
      >
        {photos.length > 0 ? (
          <View style={[styles.feedPhoto, { height: tall ? 250 : 180 }]}>
            <ResilientUriImage accessibilityLabel="" style={StyleSheet.absoluteFill} uri={photos[0]} />
            <View style={styles.typePill}>
              <AppText capScale style={styles.onPhotoText} variant="meta">{log.ramenType}</AppText>
            </View>
            {photos.length > 1 ? (
              <View style={styles.photoCount}>
                <Sticker icon={<Images color={colors.onPhotoPill} size={12} strokeWidth={2.2} />} label={String(photos.length)} onImage />
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.noteTile}>
            <AppText lineBreakStrategyIOS="hangul-word" numberOfLines={5} style={styles.noteTileText} variant="bodyStrong">
              {log.note.trim() || log.menuName}
            </AppText>
          </View>
        )}
        <AppText lineBreakStrategyIOS="hangul-word" numberOfLines={2} style={styles.pinNote} variant="bodyStrong">
          {photos.length > 0 ? log.note.trim() || log.menuName : log.menuName}
        </AppText>
        <View style={styles.pinAuthor}>
          <Avatar name={log.author.name} size={22} tone="soft" uri={log.author.avatar} />
          <AppText numberOfLines={1} style={styles.shrink} tone="muted" variant="meta">
            {`${log.author.name} · ${shopLabel(log.shop)}`}
          </AppText>
        </View>
      </Pressable>
    </Animated.View>
  )
})

// ---------------------------------------------------------------------------
// 상세의 사진 넘기기
// ---------------------------------------------------------------------------

export function LogPhotoPager({ photos, menuName, onBack }: { photos: string[]; menuName: string; onBack: () => void }) {
  const { width } = useWindowDimensions()
  const pageWidth = width - 16
  const [index, setIndex] = useState(0)
  const [viewing, setViewing] = useState<{ index: number; origin: { x: number; y: number; width: number; height: number } | null } | null>(null)
  const photoRefs = useRef<Array<View | null>>([])
  if (photos.length === 0) {
    return (
      <View style={styles.noPhotoHeader}>
        <IconButton accessibilityLabel="뒤로가기" icon={<ChevronLeft color={colors.ink} size={24} />} onPress={onBack} />
      </View>
    )
  }
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
          <Pressable
            accessibilityHint="사진을 크게 봐요"
            accessibilityRole="imagebutton"
            collapsable={false}
            key={`${uri}-${photoIndex}`}
            onPress={() => {
              const photo = photoRefs.current[photoIndex]
              if (!photo) {
                setViewing({ index: photoIndex, origin: null })
                return
              }
              photo.measureInWindow((x, y, width, height) => {
                setViewing({ index: photoIndex, origin: width > 0 && height > 0 ? { x, y, width, height } : null })
              })
            }}
            ref={(node) => { photoRefs.current[photoIndex] = node }}
            // 커지는 사진이 원래 자리에 겹쳐 두 장으로 보이지 않게, 크게 보는 동안 원래 사진은 비운다
            style={viewing?.index === photoIndex && viewing.origin ? styles.hiddenSource : undefined}
          >
            <ResilientUriImage
              accessibilityLabel={`${menuName} 사진 ${photoIndex + 1}`}
              style={{ width: pageWidth, height: 200 }}
              uri={uri}
            />
          </Pressable>
        ))}
      </ScrollView>
      <Pressable accessibilityLabel="뒤로가기" accessibilityRole="button" onPress={onBack} style={styles.pagerBack}>
        <ChevronLeft color={colors.onPhotoPill} size={24} />
      </Pressable>
      {photos.length > 1 ? (
        <View accessibilityLiveRegion="polite" style={styles.pagerCount}>
          <Sticker label={`${index + 1} / ${photos.length}`} onImage />
        </View>
      ) : null}
      {viewing !== null ? (
        <PhotoViewer index={viewing.index} label={`${menuName} 사진`} onClose={() => setViewing(null)} origin={viewing.origin} photos={photos} />
      ) : null}
    </View>
  )
}

// ---------------------------------------------------------------------------
// 신고 · 숨기기 (앱 심사 가이드라인 1.2)
// ---------------------------------------------------------------------------

export interface ModerationTarget {
  kind: "log" | "comment"
  id: string
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
            <AppText
              accessibilityElementsHidden={Boolean(reason)}
              capScale
              importantForAccessibility={reason ? "no-hide-descendants" : "auto"}
              style={reason ? styles.invisible : undefined}
              tone="muted"
              variant="meta"
            >
              신고 사유를 고르면 보낼 수 있어요
            </AppText>
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
                <AppText style={styles.bold} variant="body">
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
  onPhotoText: { fontWeight: "700", color: colors.onPhotoPill },
  tabular: { fontVariant: ["tabular-nums"] },
  invisible: { opacity: 0 },
  shrink: { flexShrink: 1 },
  pressedWash: { backgroundColor: colors.surfacePressed },

  avatar: { alignItems: "center", justifyContent: "center" },
  avatarDark: { backgroundColor: colors.ink },
  avatarSoft: { backgroundColor: colors.canvasSoft },
  avatarImage: { backgroundColor: colors.canvasSoft },

  authorRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 9 },
  authorText: { flex: 1, minWidth: 0, gap: spacing.x1 },

  pin: { gap: 6 },
  feedPhoto: {
    width: "100%",
    borderRadius: radii.sm,
    overflow: "hidden",
    backgroundColor: colors.canvasSoft,
  },
  typePill: {
    position: "absolute",
    left: 8,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.photoPill,
    borderRadius: radii.pill,
  },
  photoCount: { position: "absolute", right: spacing.x2, bottom: spacing.x2 },
  noteTile: { backgroundColor: colors.canvasSoft, borderRadius: radii.sm, padding: 14 },
  // 격자에서 글이 빽빽해 보이지 않게 핀 글씨는 한 단계 작게, 줄 수는 짧게 둔다
  noteTileText: { fontWeight: "600", fontSize: 13, lineHeight: 19 },
  pinNote: { fontSize: 13, lineHeight: 18, fontWeight: "600", paddingHorizontal: 4 },
  pinAuthor: { flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0, paddingHorizontal: 4 },
  tags: { flexDirection: "row", gap: spacing.x2, paddingHorizontal: spacing.gutter },
  fingerprint: { marginHorizontal: spacing.gutter, marginTop: spacing.x4 },
  detailNote: { marginHorizontal: spacing.gutter, marginTop: spacing.x4, color: colors.inkSub },
  pill: {
    minHeight: touchTarget,
    width: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 4,
    borderRadius: radii.pill,
  },
  pillPressed: { backgroundColor: colors.surfacePressed },
  likeCount: { width: spacing.x8, textAlign: "center" },
  likeCountWindow: { width: spacing.x8, height: 26, overflow: "hidden" },
  likeNumberLine: { position: "absolute", left: 0, right: 0, top: 0, height: 26, justifyContent: "center" },

  noPhotoHeader: { marginHorizontal: 8, minHeight: touchTarget },
  hiddenSource: { opacity: 0 },
  pager: {
    marginHorizontal: 8,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: colors.canvasSoft,
  },
  pagerBack: { position: "absolute", top: 12, left: 12, width: touchTarget, height: touchTarget, borderRadius: radii.pill, backgroundColor: colors.photoPill, alignItems: "center", justifyContent: "center" },
  pagerCount: { position: "absolute", right: 12, bottom: 12 },


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
  radioChecked: { borderColor: colors.ink },
  radioDot: { width: 10, height: 10, borderRadius: radii.pill, backgroundColor: colors.ink },
  reportFooter: { gap: spacing.x2 },
})
