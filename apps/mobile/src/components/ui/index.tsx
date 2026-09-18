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
  type TextStyle,
  type ViewProps,
  type ViewStyle,
  type TextProps,
} from "react-native"
import { SafeAreaView, type Edge } from "react-native-safe-area-context"
import { useEffect, type PropsWithChildren, type ReactNode } from "react"

import {
  colors,
  fonts,
  radii,
  shadows,
  spacing,
  touchTarget,
  typography,
} from "../../theme"

function Text({ style, ...props }: TextProps) {
  return <NativeText {...props} style={[{ fontFamily: fonts.body }, style]} />
}

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
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...scrollViewProps}
      contentContainerStyle={[styles.screenContent, contentContainerStyle]}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.screenContent, contentContainerStyle]}>
      {children}
    </View>
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
  style?: StyleProp<ViewStyle>
  titleStyle?: StyleProp<TextStyle>
}

export function Header({
  title,
  subtitle,
  onBack,
  backLabel = "뒤로",
  left,
  right,
  style,
  titleStyle,
}: HeaderProps) {
  return (
    <View style={[styles.header, style]}>
      <View style={styles.headerSide}>
        {left ??
          (onBack ? (
            <Pressable
              accessibilityLabel={backLabel}
              accessibilityRole="button"
              hitSlop={8}
              onPress={onBack}
              style={({ pressed }) => [
                styles.iconButton,
                pressed && styles.transparentPressed,
              ]}
            >
              <ChevronLeft color={colors.text} size={24} strokeWidth={2.2} />
            </Pressable>
          ) : null)}
      </View>
      <View style={styles.headerTitles}>
        <Text
          accessibilityRole="header"
          numberOfLines={2}
          style={[styles.headerTitle, titleStyle]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={styles.headerSubtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={[styles.headerSide, styles.headerRight]}>{right}</View>
    </View>
  )
}

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger"
export type ButtonSize = "small" | "medium" | "large"

export interface ButtonProps
  extends Omit<PressableProps, "children" | "style"> {
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
  primary: { backgroundColor: colors.brand, borderColor: colors.brand },
  secondary: { backgroundColor: colors.text, borderColor: colors.text },
  outline: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
  },
  ghost: {
    backgroundColor: colors.transparent,
    borderColor: colors.transparent,
  },
  danger: { backgroundColor: colors.critical, borderColor: colors.critical },
}

const buttonTextVariants: Record<ButtonVariant, TextStyle> = {
  primary: { color: colors.textInverted },
  secondary: { color: colors.textInverted },
  outline: { color: colors.text },
  ghost: { color: colors.brand },
  danger: { color: colors.textInverted },
}

const buttonSizes: Record<ButtonSize, ViewStyle> = {
  small: { minHeight: touchTarget, paddingHorizontal: spacing.x3 },
  medium: { minHeight: 48, paddingHorizontal: spacing.x4 },
  large: { minHeight: 54, paddingHorizontal: spacing.x5 },
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
        pressed && !unavailable && styles.buttonPressed,
        unavailable && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={buttonTextVariants[variant].color}
          size="small"
        />
      ) : (
        leftIcon
      )}
      <Text style={[styles.buttonText, buttonTextVariants[variant], textStyle]}>
        {title}
      </Text>
      {!loading ? rightIcon : null}
    </Pressable>
  )
}

export interface ChipProps extends Omit<PressableProps, "children" | "style"> {
  label: string
  selected?: boolean
  leading?: ReactNode
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
}

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
        pressed && styles.transparentPressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {leading}
      <Text
        style={[
          styles.chipText,
          selected && styles.chipTextSelected,
          textStyle,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

export interface CardProps extends PropsWithChildren {
  onPress?: () => void
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
  contentStyle?: StyleProp<ViewStyle>
  testID?: string
}

export function Card({
  children,
  onPress,
  accessibilityLabel,
  style,
  contentStyle,
  testID,
}: CardProps) {
  if (onPress) {
    return (
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          pressed && styles.cardPressed,
          style,
        ]}
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
  neutral: colors.text,
  positive: colors.positive,
  critical: colors.critical,
  informative: colors.informative,
}

export function Toast({
  visible,
  message,
  variant = "neutral",
  duration = 2800,
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
      <Text style={styles.toastMessage}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={onAction}
          style={styles.toastAction}
        >
          <Text style={styles.toastActionText}>{actionLabel}</Text>
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

export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  return (
    <View style={[styles.stateContainer, style]}>
      {icon ? <View style={styles.stateIcon}>{icon}</View> : null}
      <Text style={styles.stateTitle}>{title}</Text>
      {description ? (
        <Text style={styles.stateDescription}>{description}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          onPress={onAction}
          size="small"
          style={styles.stateAction}
          title={actionLabel}
          variant="outline"
        />
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

export function LoadingState({
  label = "불러오는 중…",
  fullScreen = false,
  color = colors.brand,
  style,
}: LoadingStateProps) {
  return (
    <View
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      style={[styles.loading, fullScreen && styles.flex, style]}
    >
      <ActivityIndicator color={color} size="small" />
      {label ? <Text style={styles.loadingText}>{label}</Text> : null}
    </View>
  )
}

/** Short alias for compact call sites. */
export const Loading = LoadingState

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

export function BottomSheet({
  visible,
  onClose,
  title,
  description,
  closeLabel = "닫기",
  maxHeight = "88%",
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
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalRoot}
      >
        <Pressable
          accessibilityLabel="시트 바깥 영역"
          accessibilityRole="button"
          onPress={dismissOnBackdropPress ? onClose : undefined}
          style={styles.backdrop}
        />
        <SafeAreaView edges={["bottom"]} style={[styles.sheet, { maxHeight }]}>
          <View style={styles.sheetHandle} />
          {title || description ? (
            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitles}>
                {title ? <Text style={styles.sheetTitle}>{title}</Text> : null}
                {description ? (
                  <Text style={styles.sheetDescription}>{description}</Text>
                ) : null}
              </View>
              <Pressable
                accessibilityLabel={closeLabel}
                accessibilityRole="button"
                hitSlop={8}
                onPress={onClose}
                style={({ pressed }) => [
                  styles.iconButton,
                  pressed && styles.transparentPressed,
                ]}
              >
                <X color={colors.text} size={22} />
              </Pressable>
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
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

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
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      presentationStyle="overFullScreen"
      transparent
      visible={visible}
    >
      <View style={styles.dialogRoot}>
        <Pressable
          accessibilityLabel="대화상자 닫기"
          accessibilityRole="button"
          onPress={onCancel}
          style={styles.backdrop}
        />
        <View accessibilityRole="alert" style={styles.dialog}>
          <Text style={styles.dialogTitle}>{title}</Text>
          {message ? <Text style={styles.dialogMessage}>{message}</Text> : null}
          <View style={styles.dialogActions}>
            <Button
              fullWidth
              onPress={onCancel}
              title={cancelLabel}
              variant="outline"
            />
            <Button
              fullWidth
              loading={loading}
              onPress={onConfirm}
              title={confirmLabel}
              variant={destructive ? "danger" : "primary"}
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
  screen: { flex: 1, backgroundColor: colors.background },
  screenContent: { flexGrow: 1 },
  header: {
    minHeight: 56,
    paddingHorizontal: spacing.gutter,
    flexDirection: "row",
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    backgroundColor: colors.surface,
  },
  headerSide: {
    width: touchTarget,
    minHeight: touchTarget,
    justifyContent: "center",
  },
  headerRight: { alignItems: "flex-end" },
  headerTitles: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: spacing.x1,
  },
  headerTitle: {
    ...typography.sectionTitle,
    color: colors.text,
    textAlign: "center",
  },
  headerSubtitle: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.x0_5,
  },
  iconButton: {
    width: touchTarget,
    height: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
  },
  transparentPressed: { opacity: 0.58 },
  button: {
    borderWidth: 1,
    borderRadius: radii.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.x2,
  },
  buttonText: { ...typography.label, textAlign: "center" },
  buttonPressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  fullWidth: { alignSelf: "stretch", flex: 1 },
  disabled: { opacity: 0.42 },
  chip: {
    minHeight: touchTarget,
    paddingHorizontal: spacing.x3,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.x1_5,
  },
  chipSelected: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { ...typography.captionStrong, color: colors.textMuted },
  chipTextSelected: { color: colors.textInverted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.x4,
    ...shadows.card,
  },
  cardPressed: {
    backgroundColor: colors.surfacePressed,
    transform: [{ scale: 0.995 }],
  },
  toast: {
    position: "absolute",
    left: spacing.gutter,
    right: spacing.gutter,
    bottom: spacing.x6,
    minHeight: touchTarget,
    borderRadius: radii.md,
    paddingHorizontal: spacing.x4,
    paddingVertical: spacing.x3,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x3,
    ...shadows.floating,
  },
  toastMessage: {
    ...typography.captionStrong,
    color: colors.textInverted,
    flex: 1,
  },
  toastAction: {
    minHeight: touchTarget,
    justifyContent: "center",
    paddingHorizontal: spacing.x1,
  },
  toastActionText: {
    ...typography.captionStrong,
    color: colors.textInverted,
    textDecorationLine: "underline",
  },
  stateContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.x8,
  },
  stateIcon: { marginBottom: spacing.x3 },
  stateTitle: {
    ...typography.sectionTitle,
    color: colors.text,
    textAlign: "center",
  },
  stateDescription: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.x1_5,
  },
  stateAction: { marginTop: spacing.x5 },
  loading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.x2,
    padding: spacing.x5,
  },
  loadingText: { ...typography.caption, color: colors.textMuted },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    overflow: "hidden",
  },
  sheetHandle: {
    width: 36,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.borderStrong,
    alignSelf: "center",
    marginTop: spacing.x2,
  },
  sheetHeader: {
    minHeight: 64,
    paddingHorizontal: spacing.gutter,
    flexDirection: "row",
    alignItems: "center",
  },
  sheetTitles: { flex: 1, paddingRight: spacing.x2 },
  sheetTitle: { ...typography.title, color: colors.text },
  sheetDescription: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.x0_5,
  },
  sheetContent: {
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.x4,
  },
  sheetFooter: {
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.x3,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  dialogRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.x6,
  },
  dialog: {
    width: "100%",
    maxWidth: 380,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    padding: spacing.x5,
    ...shadows.floating,
  },
  dialogTitle: { ...typography.title, color: colors.text },
  dialogMessage: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.x2,
  },
  dialogActions: {
    flexDirection: "row",
    gap: spacing.x2,
    marginTop: spacing.x6,
  },
})
