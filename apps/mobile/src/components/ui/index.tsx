import { ChevronLeft, X } from "lucide-react-native"
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as NativeText,
  View,
  type PressableProps,
  type ScrollViewProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native"
import { SafeAreaView, useSafeAreaInsets, type Edge } from "react-native-safe-area-context"
import { forwardRef, useEffect, type PropsWithChildren, type ReactNode } from "react"

import {
  colors,
  maxFontScale,
  radii,
  shadows,
  spacing,
  touchTarget,
  typography,
} from "../../theme"

/*
 * RAOTA 공통 부품. 모양은 apps/mobile/DESIGN.md와 웹 프로토타입(src/)을 따른다.
 * 새 화면은 hex나 임의 크기 대신 여기 부품과 src/theme 토큰만 쓴다.
 */

// ---------------------------------------------------------------------------
// 글씨
// ---------------------------------------------------------------------------

export type TextVariant =
  | "counter"
  | "headline"
  | "screenTitle"
  | "sectionTitle"
  | "cardTitle"
  | "body"
  | "bodyStrong"
  | "secondary"
  | "meta"

export type TextTone = "ink" | "sub" | "muted" | "brand" | "onDark" | "onDarkMuted" | "positive" | "critical"

const toneColor: Record<TextTone, string> = {
  ink: colors.ink,
  sub: colors.inkSub,
  muted: colors.textMuted,
  brand: colors.brand,
  onDark: colors.onDark,
  onDarkMuted: colors.onDarkMuted,
  positive: colors.positive,
  critical: colors.critical,
}

export interface AppTextProps extends TextProps {
  variant?: TextVariant
  tone?: TextTone
  /** 한 줄 메타·탭 라벨처럼 넘치면 안 되는 글씨는 Dynamic Type 확대를 제한한다 */
  capScale?: boolean
}

/** 역할(variant)과 색(tone)으로 쓰는 글씨. 12pt 하한이 들어 있다. */
export function AppText({ variant = "body", tone = "ink", capScale = false, style, ...props }: AppTextProps) {
  return (
    <NativeText
      maxFontSizeMultiplier={capScale ? maxFontScale : undefined}
      {...props}
      style={[typography[variant], { color: toneColor[tone] }, style]}
    />
  )
}

// ---------------------------------------------------------------------------
// 화면 틀
// ---------------------------------------------------------------------------

export interface ScreenProps extends PropsWithChildren {
  style?: StyleProp<ViewStyle>
  contentContainerStyle?: StyleProp<ViewStyle>
  edges?: Edge[]
  scroll?: boolean
  keyboardAvoiding?: boolean
  keyboardVerticalOffset?: number
  scrollViewProps?: Omit<ScrollViewProps, "contentContainerStyle" | "children">
  testID?: string
}

export function Screen({
  children,
  style,
  contentContainerStyle,
  edges = ["top", "left", "right"],
  scroll = false,
  keyboardAvoiding = false,
  keyboardVerticalOffset = 0,
  scrollViewProps,
  testID,
}: ScreenProps) {
  const content = scroll ? (
    <ScrollView
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...scrollViewProps}
      contentContainerStyle={[styles.screenContent, contentContainerStyle]}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screenContent, contentContainerStyle]}>{children}</View>
  )

  return (
    <SafeAreaView edges={edges} style={[styles.screen, style]} testID={testID}>
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={keyboardVerticalOffset}
          style={styles.flex}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  )
}

export interface HeaderProps {
  title: string
  subtitle?: string
  onBack?: () => void
  backLabel?: string
  left?: ReactNode
  right?: ReactNode
  /** 웹과 같은 왼쪽 정렬이 기본. 가운데 정렬은 모달 헤더에만 쓴다 */
  align?: "left" | "center"
  style?: StyleProp<ViewStyle>
  titleStyle?: StyleProp<TextStyle>
}

/** 스택 헤더 56pt: 44pt 뒤로가기 · 제목(screen-title) · 44pt 행동 슬롯 · hairline */
export function Header({
  title,
  subtitle,
  onBack,
  backLabel = "뒤로",
  left,
  right,
  align = "left",
  style,
  titleStyle,
}: HeaderProps) {
  const back =
    left ??
    (onBack ? (
      <Pressable
        accessibilityLabel={backLabel}
        accessibilityRole="button"
        onPress={onBack}
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressedWash]}
      >
        <ChevronLeft color={colors.ink} size={24} strokeWidth={2.2} />
      </Pressable>
    ) : null)
  return (
    <View style={[styles.header, style]}>
      {align === "center" || back ? <View style={styles.headerSide}>{back}</View> : null}
      <View style={[styles.headerTitles, align === "center" && styles.headerTitlesCenter]}>
        <NativeText
          accessibilityRole="header"
          numberOfLines={1}
          style={[typography.screenTitle, { color: colors.ink }, align === "center" && styles.textCenter, titleStyle]}
        >
          {title}
        </NativeText>
        {subtitle ? (
          <AppText capScale numberOfLines={1} tone="muted" variant="meta">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <View style={[styles.headerSide, styles.headerRight]}>{right}</View>
    </View>
  )
}

export interface SectionHeaderProps {
  title: string
  /** 오른쪽의 짧은 보조 정보 ("필수", "최근 5그릇") */
  meta?: string
  metaTone?: TextTone
  style?: StyleProp<ViewStyle>
}

/** 섹션 제목(section-title) + 오른쪽 메타. 제목 위 eyebrow 라벨은 쓰지 않는다 */
export function SectionHeader({ title, meta, metaTone = "muted", style }: SectionHeaderProps) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <AppText accessibilityRole="header" style={styles.flex} variant="sectionTitle">
        {title}
      </AppText>
      {meta ? (
        <AppText capScale tone={metaTone} variant="meta">
          {meta}
        </AppText>
      ) : null}
    </View>
  )
}

// ---------------------------------------------------------------------------
// 버튼
// ---------------------------------------------------------------------------

/**
 * primary 빨강 알약 · secondary 잉크 알약 · outline 흰 면 + 경계 알약 ·
 * utility 2pt 사각형 · ghost 글씨만 · danger 되돌릴 수 없는 행동(빨강)
 */
export type ButtonVariant = "primary" | "secondary" | "outline" | "utility" | "ghost" | "danger"
export type ButtonSize = "small" | "medium" | "large"

export interface ButtonProps extends Omit<PressableProps, "children" | "style"> {
  title: string
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  fullWidth?: boolean
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
}

const buttonVariants: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: colors.brand, borderColor: colors.brand, borderRadius: radii.pill },
  secondary: { backgroundColor: colors.ink, borderColor: colors.ink, borderRadius: radii.pill },
  outline: { backgroundColor: colors.canvas, borderColor: colors.border, borderRadius: radii.pill },
  utility: { backgroundColor: colors.canvas, borderColor: colors.ink, borderRadius: radii.xs },
  ghost: { backgroundColor: colors.transparent, borderColor: colors.transparent, borderRadius: radii.pill },
  danger: { backgroundColor: colors.brand, borderColor: colors.brand, borderRadius: radii.pill },
}

const buttonTextColor: Record<ButtonVariant, string> = {
  primary: colors.onDark,
  secondary: colors.onDark,
  outline: colors.ink,
  utility: colors.ink,
  ghost: colors.brand,
  danger: colors.onDark,
}

const buttonSizes: Record<ButtonSize, ViewStyle> = {
  small: { minHeight: touchTarget, paddingHorizontal: spacing.x4 },
  medium: { minHeight: 48, paddingHorizontal: spacing.x5 },
  large: { minHeight: 52, paddingHorizontal: spacing.x6 },
}

export function Button({
  title,
  variant = "primary",
  size = "medium",
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  style,
  textStyle,
  accessibilityLabel = title,
  ...props
}: ButtonProps) {
  const unavailable = disabled || loading
  const color = buttonTextColor[variant]
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: unavailable }}
      disabled={unavailable}
      {...props}
      style={({ pressed }) => [
        styles.button,
        buttonVariants[variant],
        buttonSizes[size],
        fullWidth && styles.fullWidth,
        pressed && !unavailable && (variant === "outline" || variant === "utility" || variant === "ghost" ? styles.pressedWash : styles.pressedDim),
        unavailable && styles.disabled,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={color} size="small" /> : leftIcon}
      <NativeText
        maxFontSizeMultiplier={maxFontScale}
        numberOfLines={1}
        style={[variant === "utility" ? typography.secondary : typography.bodyStrong, styles.buttonText, { color }, variant === "utility" && styles.bold, textStyle]}
      >
        {title}
      </NativeText>
      {!loading ? rightIcon : null}
    </Pressable>
  )
}

export interface IconButtonProps extends Omit<PressableProps, "children" | "style"> {
  /** VoiceOver가 읽을 이름. 아이콘 전용 버튼에는 필수 */
  accessibilityLabel: string
  icon: ReactNode
  /** 사진 위처럼 어두운 면에 올릴 때 */
  onImage?: boolean
  style?: StyleProp<ViewStyle>
}

/** 44pt 원형 아이콘 버튼 */
export function IconButton({ icon, onImage = false, style, ...props }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      {...props}
      style={({ pressed }) => [
        styles.iconButton,
        onImage && styles.iconButtonOnImage,
        pressed && (onImage ? styles.pressedDim : styles.pressedWash),
        style,
      ]}
    >
      {icon}
    </Pressable>
  )
}

// ---------------------------------------------------------------------------
// 칩, 태그, 5축 입력
// ---------------------------------------------------------------------------

export interface ChipProps extends Omit<PressableProps, "children" | "style"> {
  label: string
  selected?: boolean
  leading?: ReactNode
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
}

/** 흰 면 + 경계 알약, 선택은 빨강. 선택 상태를 VoiceOver에 알린다 */
export function Chip({
  label,
  selected = false,
  leading,
  disabled,
  style,
  textStyle,
  accessibilityLabel = label,
  ...props
}: ChipProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: Boolean(disabled) }}
      disabled={disabled}
      {...props}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && !selected && styles.pressedWash,
        disabled && styles.disabled,
        style,
      ]}
    >
      {leading}
      <NativeText
        maxFontSizeMultiplier={maxFontScale}
        style={[typography.secondary, styles.bold, { color: selected ? colors.onDark : colors.ink }, textStyle]}
      >
        {label}
      </NativeText>
    </Pressable>
  )
}

/** 읽기 전용 태그. 2pt 모서리, 회색 면 */
export function Tag({ label, style }: { label: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.tag, style]}>
      <AppText capScale variant="meta">
        {label}
      </AppText>
    </View>
  )
}

export interface ScoreSegmentProps {
  /** 축 이름 ("육수 농도") */
  label: string
  /** 1점 쪽 설명 ("맑음") */
  low: string
  /** 5점 쪽 설명 ("진함") */
  high: string
  value: number | null
  onChange: (value: number) => void
  /** 제출을 시도했는데 비어 있으면 빨간 테두리와 안내를 보여준다 */
  invalid?: boolean
  /** 화면 순서 번호(1~5). 축 이름 앞에 붙는다 */
  index?: number
  style?: StyleProp<ViewStyle>
}

/**
 * 5축 평가 한 줄. 1~5 세그먼트, 각 칸 44pt 이상, 선택은 빨강.
 * VoiceOver: radiogroup + radio(checked), 라벨은 "육수 농도 4점, 진함 쪽".
 * ref는 첫 번째 칸에 걸려 빠진 항목으로 포커스를 옮길 때 쓴다.
 */
export const ScoreSegment = forwardRef<View, ScoreSegmentProps>(function ScoreSegment(
  { label, low, high, value, onChange, invalid = false, index, style },
  ref,
) {
  const lean = (score: number) => (score <= 2 ? `${low} 쪽` : score >= 4 ? `${high} 쪽` : "보통")
  return (
    <View style={style}>
      <View style={styles.scoreHead}>
        <AppText variant="bodyStrong">
          {index ? <AppText tone="muted" variant="bodyStrong">{`${index}  `}</AppText> : null}
          {label}
        </AppText>
        <AppText capScale tone={invalid ? "critical" : value ? "ink" : "muted"} variant="meta">
          {value ? `${value}점` : invalid ? "골라주세요" : "미선택"}
        </AppText>
      </View>
      <View
        accessibilityLabel={label}
        accessibilityRole="radiogroup"
        ref={ref}
        style={[styles.segment, invalid && styles.segmentInvalid]}
      >
        {[1, 2, 3, 4, 5].map((score) => {
          const selected = value === score
          return (
            <Pressable
              accessibilityLabel={`${label} ${score}점, ${lean(score)}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={score}
              onPress={() => onChange(score)}
              style={({ pressed }) => [
                styles.segmentCell,
                score > 1 && styles.segmentDivider,
                selected && styles.segmentSelected,
                pressed && !selected && styles.pressedWashBg,
              ]}
            >
              <NativeText
                maxFontSizeMultiplier={maxFontScale}
                style={[typography.bodyStrong, { color: selected ? colors.onDark : colors.ink }]}
              >
                {score}
              </NativeText>
            </Pressable>
          )
        })}
      </View>
      <View style={styles.scoreEnds}>
        <AppText capScale tone="muted" variant="meta">
          {low}
        </AppText>
        <AppText capScale tone="muted" variant="meta">
          {high}
        </AppText>
      </View>
    </View>
  )
})

// ---------------------------------------------------------------------------
// 카드, 상태
// ---------------------------------------------------------------------------

export interface CardProps extends PropsWithChildren {
  onPress?: () => void
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
  contentStyle?: StyleProp<ViewStyle>
  testID?: string
}

/** 흰 면, 6pt, 1pt 경계, 그림자 없음. 카드 안에 카드를 넣지 않는다 */
export function Card({ children, onPress, accessibilityLabel, style, contentStyle, testID }: CardProps) {
  if (onPress) {
    return (
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.pressedWashBg, style]}
        testID={testID}
      >
        <View style={contentStyle}>{children}</View>
      </Pressable>
    )
  }
  return (
    <View style={[styles.card, style]} testID={testID}>
      <View style={contentStyle}>{children}</View>
    </View>
  )
}

export type FeedbackVariant = "neutral" | "positive" | "critical" | "informative"

export interface ToastProps {
  visible: boolean
  message: string
  variant?: FeedbackVariant
  duration?: number
  onDismiss?: () => void
  actionLabel?: string
  onAction?: () => void
  style?: StyleProp<ViewStyle>
}

const toastColors: Record<FeedbackVariant, string> = {
  neutral: colors.ink,
  positive: colors.ink,
  critical: colors.critical,
  informative: colors.ink,
}

/** 잉크 알약 토스트. 성공·실패를 색만으로 구분하지 않도록 문구에 결과를 쓴다 */
export function Toast({
  visible,
  message,
  variant = "neutral",
  duration = 2500,
  onDismiss,
  actionLabel,
  onAction,
  style,
}: ToastProps) {
  useEffect(() => {
    if (!visible || !onDismiss || duration <= 0) return
    const timer = setTimeout(onDismiss, duration)
    return () => clearTimeout(timer)
  }, [duration, onDismiss, visible])

  if (!visible) return null
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[styles.toast, { backgroundColor: toastColors[variant] }, style]}
    >
      <AppText style={styles.flex} tone="onDark" variant="secondary">
        {message}
      </AppText>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={styles.toastAction}>
          <AppText style={styles.underline} tone="onDark" variant="secondary">
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  )
}

export interface EmptyStateProps {
  title: string
  description?: string
  icon?: ReactNode
  actionLabel?: string
  onAction?: () => void
  style?: StyleProp<ViewStyle>
}

/** 아이콘 → 짧은 제목 → 해결 방법 → 필요할 때만 CTA */
export function EmptyState({ title, description, icon, actionLabel, onAction, style }: EmptyStateProps) {
  return (
    <View style={[styles.stateContainer, style]}>
      {icon ? <View style={styles.stateIcon}>{icon}</View> : null}
      <AppText style={styles.textCenter} variant="cardTitle">
        {title}
      </AppText>
      {description ? (
        <AppText style={[styles.textCenter, styles.stateDescription]} tone="muted" variant="secondary">
          {description}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <Button onPress={onAction} size="small" style={styles.stateAction} title={actionLabel} variant="outline" />
      ) : null}
    </View>
  )
}

/** Short alias for compact call sites. */
export const Empty = EmptyState

export interface LoadingStateProps {
  label?: string
  fullScreen?: boolean
  color?: string
  style?: StyleProp<ViewStyle>
}

export function LoadingState({ label = "불러오는 중…", fullScreen = false, color = colors.brand, style }: LoadingStateProps) {
  return (
    <View
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      style={[styles.loading, fullScreen && styles.flex, style]}
    >
      <ActivityIndicator color={color} size="small" />
      {label ? (
        <AppText tone="muted" variant="secondary">
          {label}
        </AppText>
      ) : null}
    </View>
  )
}

/** Short alias for compact call sites. */
export const Loading = LoadingState

// ---------------------------------------------------------------------------
// 하단 고정 행동 바
// ---------------------------------------------------------------------------

export interface StickyActionBarProps extends PropsWithChildren {
  /** 버튼 위 한 줄 안내. 비활성 이유("육수 농도를 골라주세요")를 여기 쓴다 */
  hint?: string
  hintTone?: TextTone
  style?: StyleProp<ViewStyle>
}

/**
 * 화면 하단에 고정되는 행동 영역. 하단 inset을 더해 홈 인디케이터와 겹치지 않는다.
 * 320×568 화면에서도 스크롤 없이 보여야 하는 CTA(기록 저장, 완료, 다음 단계)에 쓴다.
 */
export function StickyActionBar({ hint, hintTone = "muted", style, children }: StickyActionBarProps) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.stickyBar, { paddingBottom: Math.max(insets.bottom, spacing.x3) }, style]}>
      {hint ? (
        <AppText accessibilityLiveRegion="polite" capScale numberOfLines={2} tone={hintTone} variant="meta">
          {hint}
        </AppText>
      ) : null}
      <View style={styles.stickyActions}>{children}</View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// 시트와 확인창
// ---------------------------------------------------------------------------

export interface BottomSheetProps extends PropsWithChildren {
  visible: boolean
  onClose: () => void
  title?: string
  description?: string
  closeLabel?: string
  maxHeight?: number | `${number}%`
  dismissOnBackdropPress?: boolean
  footer?: ReactNode
}

/** 입력이 필요한 짧은 과제용. 12pt 윗모서리, 36×4 손잡이, 검정 50% 뒤판 */
export function BottomSheet({
  visible,
  onClose,
  title,
  description,
  closeLabel = "닫기",
  maxHeight = "85%",
  dismissOnBackdropPress = true,
  footer,
  children,
}: BottomSheetProps) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalRoot}>
        <Pressable
          accessibilityLabel={`${title ?? "시트"} 닫기`}
          accessibilityRole="button"
          onPress={dismissOnBackdropPress ? onClose : undefined}
          style={styles.backdrop}
        />
        <SafeAreaView accessibilityViewIsModal edges={["bottom"]} style={[styles.sheet, { maxHeight }]}>
          <View style={styles.sheetHandle} />
          {title || description ? (
            <View style={styles.sheetHeader}>
              <View style={styles.flex}>
                {title ? (
                  <AppText accessibilityRole="header" variant="sectionTitle">
                    {title}
                  </AppText>
                ) : null}
                {description ? (
                  <AppText style={styles.sheetDescription} tone="muted" variant="secondary">
                    {description}
                  </AppText>
                ) : null}
              </View>
              <IconButton accessibilityLabel={closeLabel} icon={<X color={colors.ink} size={22} />} onPress={onClose} />
            </View>
          ) : null}
          <View style={styles.sheetContent}>{children}</View>
          {footer ? <View style={styles.sheetFooter}>{footer}</View> : null}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

export interface ConfirmDialogProps {
  visible: boolean
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  /** 탈퇴처럼 되돌릴 수 없는 행동이면 확인 버튼이 빨강 */
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** 되돌리기 어려운 행동의 확인. 가운데, 최대 320pt, [취소 · 확인] */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = "확인",
  cancelLabel = "취소",
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal animationType="fade" onRequestClose={onCancel} presentationStyle="overFullScreen" transparent visible={visible}>
      <View style={styles.dialogRoot}>
        <Pressable accessibilityLabel={`${title} 닫기`} accessibilityRole="button" onPress={onCancel} style={styles.backdrop} />
        <View accessibilityRole="alert" accessibilityViewIsModal style={styles.dialog}>
          <AppText accessibilityRole="header" style={styles.textCenter} variant="sectionTitle">
            {title}
          </AppText>
          {message ? (
            <AppText style={[styles.textCenter, styles.dialogMessage]} tone="sub" variant="body">
              {message}
            </AppText>
          ) : null}
          <View style={styles.dialogActions}>
            <Button disabled={loading} fullWidth onPress={onCancel} title={cancelLabel} variant="outline" />
            <Button
              fullWidth
              loading={loading}
              onPress={onConfirm}
              title={confirmLabel}
              variant={destructive ? "danger" : "secondary"}
            />
          </View>
        </View>
      </View>
    </Modal>
  )
}

/** Generic name requested by the design-system contract. */
export const Dialog = ConfirmDialog

const styles = StyleSheet.create({
  flex: { flex: 1 },
  textCenter: { textAlign: "center" },
  bold: { fontWeight: "700" },
  underline: { textDecorationLine: "underline" },
  screen: { flex: 1, backgroundColor: colors.canvas },
  screenContent: { flexGrow: 1 },
  header: {
    minHeight: 56,
    paddingLeft: spacing.x2,
    paddingRight: spacing.x2,
    flexDirection: "row",
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    backgroundColor: colors.canvas,
  },
  headerSide: { minWidth: touchTarget, minHeight: touchTarget, justifyContent: "center" },
  headerRight: { alignItems: "flex-end" },
  headerTitles: { flex: 1, paddingHorizontal: spacing.x2 },
  headerTitlesCenter: { alignItems: "center" },
  sectionHeader: { flexDirection: "row", alignItems: "baseline", gap: spacing.x2 },
  iconButton: {
    width: touchTarget,
    height: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
  },
  iconButtonOnImage: { backgroundColor: "rgba(0, 0, 0, 0.5)" },
  pressedWash: { backgroundColor: colors.canvasSoft },
  pressedWashBg: { backgroundColor: colors.canvasSoft },
  pressedDim: { opacity: 0.85 },
  button: {
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.x2,
  },
  buttonText: { textAlign: "center" },
  fullWidth: { alignSelf: "stretch", flex: 1 },
  disabled: { opacity: 0.4 },
  chip: {
    minHeight: touchTarget,
    paddingHorizontal: spacing.x4,
    borderRadius: radii.pill,
    backgroundColor: colors.canvas,
    borderColor: colors.border,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.x1_5,
  },
  chipSelected: { backgroundColor: colors.brand, borderColor: colors.brand },
  tag: {
    alignSelf: "flex-start",
    backgroundColor: colors.canvasSoft,
    borderRadius: radii.xs,
    paddingHorizontal: spacing.x2,
    paddingVertical: spacing.x1,
  },
  scoreHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: spacing.x2,
  },
  segment: {
    flexDirection: "row",
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  segmentInvalid: { borderColor: colors.brand },
  segmentCell: {
    flex: 1,
    minHeight: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvas,
  },
  segmentDivider: { borderLeftWidth: 1, borderLeftColor: colors.border },
  segmentSelected: { backgroundColor: colors.brand },
  scoreEnds: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.x1_5 },
  card: {
    backgroundColor: colors.canvas,
    borderRadius: radii.sm,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.x4,
  },
  toast: {
    position: "absolute",
    left: spacing.gutter,
    right: spacing.gutter,
    bottom: spacing.x6,
    minHeight: touchTarget,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.x5,
    paddingVertical: spacing.x3,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x3,
    ...shadows.floating,
  },
  toastAction: { minHeight: touchTarget, justifyContent: "center", paddingHorizontal: spacing.x1 },
  stateContainer: { alignItems: "center", justifyContent: "center", padding: spacing.x8 },
  stateIcon: { marginBottom: spacing.x3 },
  stateDescription: { marginTop: spacing.x1_5 },
  stateAction: { marginTop: spacing.x5 },
  loading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.x2,
    padding: spacing.x5,
  },
  stickyBar: {
    paddingTop: spacing.x3,
    paddingHorizontal: spacing.gutter,
    gap: spacing.x2,
    backgroundColor: colors.canvas,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stickyActions: { flexDirection: "row", gap: spacing.x2 },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    overflow: "hidden",
    ...shadows.floating,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginTop: spacing.x3,
  },
  sheetHeader: {
    minHeight: 56,
    paddingLeft: spacing.gutter,
    paddingRight: spacing.x2,
    flexDirection: "row",
    alignItems: "center",
    borderBottomColor: colors.canvasSoft,
    borderBottomWidth: 1,
  },
  sheetDescription: { marginTop: spacing.x0_5 },
  sheetContent: { paddingHorizontal: spacing.gutter, paddingVertical: spacing.x4 },
  sheetFooter: {
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.x3,
    borderTopColor: colors.canvasSoft,
    borderTopWidth: 1,
  },
  dialogRoot: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.x8 },
  dialog: {
    width: "100%",
    maxWidth: 320,
    borderRadius: radii.lg,
    backgroundColor: colors.canvas,
    paddingHorizontal: spacing.x5,
    paddingTop: spacing.x6,
    paddingBottom: spacing.x5,
    ...shadows.floating,
  },
  dialogMessage: { marginTop: spacing.x2 },
  dialogActions: { flexDirection: "row", gap: spacing.x2, marginTop: spacing.x5 },
})
