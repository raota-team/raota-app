import { t, ph } from "@lingui/core/macro";
import { useLocale } from "@/src/i18n"
import { labelOf } from "@raota/shared"
import Svg, { Line, Path } from "react-native-svg"
import { ChevronLeft, X } from "lucide-react-native"
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as NativeText,
  View,
  useWindowDimensions,
  type ColorValue,
  type PressableProps,
  type ScrollViewProps,
  type StyleProp,
  type TextProps,
  type LayoutChangeEvent,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from "react-native"
import { SafeAreaView, useSafeAreaInsets, type Edge } from "react-native-safe-area-context"
import * as Haptics from "expo-haptics"
import { forwardRef, useEffect, useRef, useState, type PropsWithChildren, type ReactNode } from "react"
import Reanimated, { Easing as MotionEasing, interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated"
import {
  colors,
  line,
  maxFontScale,
  pressFade,
  radii,
  shadows,
  soupColorOf,
  spacing,
  touchTarget,
  typography,
  usePalette,
} from "../../theme"

const AnimatedPressable = Reanimated.createAnimatedComponent(Pressable)
const SELECTION_EASE = MotionEasing.bezier(0.22, 1, 0.36, 1)

/** 고른 면·글씨는 색만 바꾸고, 눌림은 레이아웃 대신 시각적 크기로 돌려준다. */
function useSelectableMotion(selected: boolean, disabled = false) {
  const palette = usePalette()
  const reducedMotion = useReducedMotion()
  const selection = useSharedValue(selected ? 1 : 0)
  const pressScale = useSharedValue(1)
  // 동작 줄이기에서는 크기 변화 대신 즉시 바뀌는 투명도로 눌림을 알린다.
  const pressOpacity = useSharedValue(1)

  useEffect(() => {
    selection.value = reducedMotion ? (selected ? 1 : 0) : withTiming(selected ? 1 : 0, { duration: 200, easing: SELECTION_EASE })
    if (reducedMotion) pressScale.value = 1
    else pressOpacity.value = 1
  }, [selected, reducedMotion, selection, pressScale, pressOpacity])

  // 애니메이션 스타일이 정적 투명도를 덮으므로 비활성 투명도도 여기서 함께 곱한다.
  const restOpacity = disabled ? Number(styles.disabled.opacity) : 1
  const containerStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(selection.value, [0, 1], [palette.canvasSoft, palette.selected]),
    opacity: restOpacity * pressOpacity.value,
    transform: [{ scale: pressScale.value }],
  }), [palette, restOpacity])
  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(selection.value, [0, 1], [palette.ink, palette.onSelected]),
  }), [palette])

  const pressIn = () => {
    if (reducedMotion) pressOpacity.value = 0.6
    else pressScale.value = withTiming(0.97, { duration: 120 })
  }
  const pressOut = () => {
    pressOpacity.value = 1
    pressScale.value = reducedMotion ? 1 : withTiming(1, { duration: 180, easing: SELECTION_EASE })
  }

  return { containerStyle, textStyle, pressIn, pressOut }
}

/** 공통 부품은 화면 바탕·의미 색·상호작용 면을 같은 토큰으로 맞춘다. */

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
  | "button"
  | "secondary"
  | "meta"

export type TextTone = "ink" | "onInk" | "sub" | "muted" | "brand" | "onDark" | "onDarkMuted" | "positive" | "critical"

const toneColor: Record<TextTone, ColorValue> = {
  ink: colors.ink,
  onInk: colors.onInk,
  sub: colors.inkSub,
  muted: colors.textMuted,
  // 빨간 글씨는 다크 모드에서 밝힌 brandText. 빨간 면(brand)과 일부러 나눴다
  brand: colors.brandText,
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
  useLocale()
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
  useLocale()
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
  /** 탭 루트처럼 헤더 제목이 곧 화면 제목일 때는 headline을 쓴다. */
  large?: boolean
  style?: StyleProp<ViewStyle>
  titleStyle?: StyleProp<TextStyle>
}

/** 스택 헤더: 56pt 높이 안에 뒤로가기·제목·행동 슬롯을 둔다. */
export function Header({
  title,
  subtitle,
  onBack,
  backLabel = t`뒤로`,
  left,
  right,
  align = "left",
  large = false,
  style,
  titleStyle,
}: HeaderProps) {
  useLocale()
  const back =
    left ??
    (onBack ? (
      <Pressable
        accessibilityLabel={backLabel}
        accessibilityRole="button"
        onPress={onBack}
        style={({ pressed }) => [styles.iconButton, styles.headerBack, pressed && styles.pressedWash]}
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
          // 헤더는 56pt 한 줄이라 두 줄로 늘릴 수 없다. 큰 글씨에서는 자르는 대신
          // 글자를 줄여 제목을 끝까지 읽게 한다("취향 종…"이 되던 자리)
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          numberOfLines={1}
          style={[large ? typography.headline : typography.navTitle, { color: colors.ink }, align === "center" && styles.textCenter, titleStyle]}
        >
          {title}
        </NativeText>
        {subtitle ? (
          <AppText capScale numberOfLines={1} tone="sub" variant="meta">
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
  /** Changing metadata can reserve its widest label without moving the title. */
  metaStyle?: StyleProp<TextStyle>
  style?: StyleProp<ViewStyle>
}

/** 섹션 제목(section-title) + 오른쪽 메타. 제목 위 eyebrow 라벨은 쓰지 않는다 */
export function SectionHeader({ title, meta, metaTone = "sub", metaStyle, style }: SectionHeaderProps) {
  useLocale()
  return (
    <View style={[styles.sectionHeader, style]}>
      <AppText accessibilityRole="header" style={styles.flex} variant="sectionTitle">
        {title}
      </AppText>
      {meta ? (
        <AppText capScale style={metaStyle} tone={metaTone} variant="meta">
          {meta}
        </AppText>
      ) : null}
    </View>
  )
}

// ---------------------------------------------------------------------------
// 버튼
// ---------------------------------------------------------------------------

/** 화면마다 하나의 주요 행동은 빨강, 나머지 행동은 회색 면이나 글씨로 둔다. */
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
  primary: { backgroundColor: colors.brand },
  secondary: { backgroundColor: colors.secondary },
  outline: { backgroundColor: colors.secondary },
  utility: { backgroundColor: colors.secondary },
  ghost: { backgroundColor: colors.transparent },
  danger: { backgroundColor: colors.brand },
}

const buttonTextColor: Record<ButtonVariant, ColorValue> = {
  primary: colors.onDark,
  secondary: colors.ink,
  outline: colors.ink,
  utility: colors.ink,
  ghost: colors.ink,
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
  size = variant === "utility" ? "small" : "medium",
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
  useLocale()
  const unavailable = disabled || loading
  // Keep optional icons in the row when the button becomes unavailable; hiding their paint
  // must not change the label's position or the width of a neighboring button.
  const inactive = disabled && !loading
  const color = inactive ? colors.textMuted : buttonTextColor[variant]
  const pressedBackground = variant === "primary" || variant === "danger"
    ? styles.pressedBrand
    : variant === "ghost" ? styles.pressedWash : styles.pressedSecondary
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
        pressed && !unavailable && pressedBackground,
        inactive && styles.disabledButton,
        loading && styles.disabled,
        style,
      ]}
    >
      {leftIcon ? <View style={unavailable && styles.buttonIconHidden}>{leftIcon}</View> : null}
      <NativeText
        maxFontSizeMultiplier={maxFontScale}
        // 큰 글씨에서 "괜찮아요"가 "괜찮…"이 되던 자리다. 높이는 minHeight라 두 줄이면 버튼이 늘어난다.
        // CTA 문구와 오류 문구는 자르지 않는다
        lineBreakStrategyIOS="hangul-word"
        numberOfLines={2}
        style={[typography.button, styles.buttonText, { color }, loading && styles.buttonIconHidden, textStyle]}
      >
        {title}
      </NativeText>
      {rightIcon ? <View style={unavailable && styles.buttonIconHidden}>{rightIcon}</View> : null}
      {loading ? (
        <View pointerEvents="none" style={styles.buttonSpinner}>
          <ActivityIndicator color={color} size="small" />
        </View>
      ) : null}
    </Pressable>
  )
}

export interface IconButtonProps extends Omit<PressableProps, "children" | "style"> {
  /** VoiceOver가 읽을 이름. 아이콘 전용 버튼에는 필수 */
  accessibilityLabel: string
  icon: ReactNode
  /** 사진 위에서는 photoPill 면으로 띄운다. */
  onImage?: boolean
  style?: StyleProp<ViewStyle>
}

/** 44pt 원형 아이콘 버튼. onImage 아이콘은 호출부에서 colors.onPhotoPill을 사용한다. */
export function IconButton({ icon, onImage = false, style, ...props }: IconButtonProps) {
  useLocale()
  return (
    <Pressable
      accessibilityRole="button"
      {...props}
      style={({ pressed }) => [
        styles.iconButton,
        onImage && styles.iconButtonOnImage,
        pressed && styles.pressedWash,
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

const CHIP_HIT_SLOP = { top: 2, bottom: 2 } as const

export interface ChipProps extends Omit<PressableProps, "children" | "style"> {
  label: string
  selected?: boolean
  leading?: ReactNode
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
}

/** 기본은 따뜻한 회색 알약, 선택은 selected 면 알약이다. */
export function Chip({
  label,
  selected = false,
  leading,
  disabled,
  style,
  textStyle,
  accessibilityLabel = label,
  onPressIn,
  onPressOut,
  ...props
}: ChipProps) {
  useLocale()
  const motion = useSelectableMotion(selected, Boolean(disabled))
  return (
    <AnimatedPressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: Boolean(disabled) }}
      disabled={disabled}
      hitSlop={CHIP_HIT_SLOP}
      {...props}
      onPressIn={(event) => {
        motion.pressIn()
        onPressIn?.(event)
      }}
      onPressOut={(event) => {
        motion.pressOut()
        onPressOut?.(event)
      }}
      style={[styles.chip, motion.containerStyle, disabled && styles.disabled, style]}
    >
      {leading}
      <Reanimated.Text
        maxFontSizeMultiplier={maxFontScale}
        style={[typography.button, motion.textStyle, textStyle]}
      >
        {label}
      </Reanimated.Text>
    </AnimatedPressable>
  )
}

/** 읽기 전용 보조 정보는 칩과 같은 면에 얹는다. */
export function Tag({ label, style }: { label: string; style?: StyleProp<ViewStyle> }) {
  useLocale()
  return (
    <View style={[styles.tag, style]}>
      <AppText capScale style={styles.tagText} tone="muted" variant="meta">
        {label}
      </AppText>
    </View>
  )
}

export interface StickerProps extends Omit<ViewProps, "style" | "children"> {
  label: string
  /** 사진 위에 얹을 때 photoPill 알약이 된다. */
  onImage?: boolean
  icon?: ReactNode
  style?: StyleProp<ViewStyle>
}

/** 읽기 전용 표시 라벨. 사진 위는 photoPill 알약, 평소에는 따뜻한 회색 알약. onImage 아이콘은 호출부에서 colors.onPhotoPill을 쓴다. */
export function Sticker({ label, onImage = false, icon, style, ...props }: StickerProps) {
  useLocale()
  return (
    <View
      // 라벨을 준 스티커는 하나로 묶어 읽는다. 묶지 않으면 라벨이 무시되고 안쪽 글씨만 읽힌다
      accessible={props.accessibilityLabel ? true : undefined}
      {...props}
      style={[styles.sticker, onImage && styles.onImagePill, style]}
    >
      {icon}
      <NativeText
        maxFontSizeMultiplier={maxFontScale}
        numberOfLines={1}
        style={[typography.meta, styles.stickerText, { color: colors.ink }, onImage && styles.onImageText]}
      >
        {label}
      </NativeText>
    </View>
  )
}

/** 식권 바깥 면이 파인 것처럼 보이도록 절취선 양 끝을 비운다. */
const NOTCH_RADIUS = 9

export interface TicketCutProps {
  /** horizontal: 위아래를 나누는 절취선, vertical: 왼쪽 본문과 오른쪽 꼬리를 나누는 절취선 */
  orientation?: "horizontal" | "vertical"
  /** 파임 뒤에 보이는 바깥 면 색. 기본은 흰 화면 바탕. */
  startFill?: ColorValue
  endFill?: ColorValue
}

/**
 * 테두리 없는 회색 식권 안의 점선과 파임. iOS가 단일 dashed border를
 * 그리지 못하므로 선과 반원을 SVG로 그리고, 양 끝의 바탕색으로 식권 면을 덮는다.
 */
export function TicketCut({ orientation = "horizontal", startFill = colors.paper, endFill = colors.paper }: TicketCutProps) {
  useLocale()
  const r = NOTCH_RADIUS
  const thick = r + line.base
  const span = 2 * r + 2
  const across = line.base / 2 - (r + 1)
  if (orientation === "vertical") {
    return (
      <View pointerEvents="none" style={styles.ticketCutVertical}>
        <View style={[styles.flex, { marginVertical: r }]}>
          <Svg height="100%" width={line.base}>
            <Line stroke={colors.border} strokeDasharray="4 4" strokeWidth={line.base} x1={line.base / 2} x2={line.base / 2} y1={0} y2="100%" />
          </Svg>
        </View>
        <Svg height={thick} style={[styles.notch, { top: 0, left: across }]} width={span}>
          <Path d={`M1 0 A${r} ${r} 0 0 0 ${span - 1} 0 Z`} fill={startFill} />
          <Path d={`M1 0 A${r} ${r} 0 0 0 ${span - 1} 0`} fill="none" stroke={colors.border} strokeWidth={line.base} />
        </Svg>
        <Svg height={thick} style={[styles.notch, { bottom: 0, left: across }]} width={span}>
          <Path d={`M1 ${thick} A${r} ${r} 0 0 1 ${span - 1} ${thick} Z`} fill={endFill} />
          <Path d={`M1 ${thick} A${r} ${r} 0 0 1 ${span - 1} ${thick}`} fill="none" stroke={colors.border} strokeWidth={line.base} />
        </Svg>
      </View>
    )
  }
  return (
    <View pointerEvents="none" style={styles.ticketCutHorizontal}>
      <View style={[styles.flex, { marginHorizontal: r }]}>
        <Svg height={line.base} width="100%">
          <Line stroke={colors.border} strokeDasharray="4 4" strokeWidth={line.base} x1={0} x2="100%" y1={line.base / 2} y2={line.base / 2} />
        </Svg>
      </View>
      <Svg height={span} style={[styles.notch, { left: 0, top: across }]} width={thick}>
        <Path d={`M0 1 A${r} ${r} 0 0 1 0 ${span - 1} Z`} fill={startFill} />
        <Path d={`M0 1 A${r} ${r} 0 0 1 0 ${span - 1}`} fill="none" stroke={colors.border} strokeWidth={line.base} />
      </Svg>
      <Svg height={span} style={[styles.notch, { right: 0, top: across }]} width={thick}>
        <Path d={`M${thick} 1 A${r} ${r} 0 0 0 ${thick} ${span - 1} Z`} fill={endFill} />
        <Path d={`M${thick} 1 A${r} ${r} 0 0 0 ${thick} ${span - 1}`} fill="none" stroke={colors.border} strokeWidth={line.base} />
      </Svg>
    </View>
  )
}

/** 원장 스타일과 기록 종류를 모두 종류 이름으로 보여 준다. */
export function RamenTypeTag({ type, inList = false, onImage = false, style }: RamenTypeTagProps) {
  useLocale()
  const label = labelOf(type.replace(/\s*라멘$/, "").trim())
  // 이름이 "라멘"뿐이면 종류 정보가 없어 표시하지 않는다.
  if (!label) return null
  return (
    <View
      accessibilityLabel={t`라멘 종류 ${ph({ p0: label })}`}
      accessible
      style={[inList ? styles.typeInList : styles.ramenTypeTag, onImage && styles.onImagePill, style]}
    >
      <AppText capScale numberOfLines={1} style={[styles.bold, onImage && styles.onImageText]} variant="meta">{label}</AppText>
    </View>
  )
}

export interface RamenTypeTagProps {
  type: string
  /** 여러 줄이 이어지는 목록에서는 면 없이 이름만 보여 준다. */
  inList?: boolean
  /** 사진 위 알약은 모드에 맞춘 photoPill 면과 onPhotoPill 글씨를 쓴다. */
  onImage?: boolean
  style?: StyleProp<ViewStyle>
}

export interface SoupDotProps {
  type: string
  size?: number
  style?: StyleProp<ViewStyle>
}

/** 이름 없이 색만으로 종류를 알 수 없으므로 점 자체는 읽지 않는다. */
export function SoupDot({ type, size = 12, style }: SoupDotProps) {
  useLocale()
  return (
    <View
      accessibilityElementsHidden
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[style, { width: size, height: size, borderRadius: size / 2, backgroundColor: soupColorOf(type) }, styles.soupDot]}
    />
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
  /** 평가 축의 말투를 유지한다. 선택 방식과 칸 모양은 모든 축에서 같다. */
  kind?: "quality" | "spectrum"
  hero?: boolean
  /** 1~5점 각각의 한 마디("맛있었어요", "진한 편"). 없으면 "N점" */
  words?: readonly string[]
  /** 재방문 의사처럼 점수 대신 말을 적는 세 칸에도 같은 알약 줄을 쓴다. */
  options?: readonly { value: number; label: string }[]
  /** 제출을 시도했는데 비어 있으면 빨간 안내를 보여준다 */
  invalid?: boolean
  /** 화면 순서 번호(1~5). 축 이름 앞에 붙는다 */
  index?: number
  style?: StyleProp<ViewStyle>
}

const SCORE_OPTIONS = [1, 2, 3, 4, 5].map((score) => ({ value: score, label: String(score) }))

function ScorePill({
  accessibilityLabel,
  selected,
  label,
  variant,
  onPress,
}: {
  accessibilityLabel: string
  selected: boolean
  label: string
  variant: "button" | "cardTitle"
  onPress: () => void
}) {
  useLocale()
  const motion = useSelectableMotion(selected)
  return (
    <AnimatedPressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      onPressIn={motion.pressIn}
      onPressOut={motion.pressOut}
      style={[styles.scoreCell, motion.containerStyle]}
    >
      <Reanimated.Text
        lineBreakStrategyIOS="hangul-word"
        maxFontSizeMultiplier={maxFontScale}
        style={[typography[variant], styles.scoreCellText, motion.textStyle]}
      >
        {label}
      </Reanimated.Text>
    </AnimatedPressable>
  )
}

/**
 * 각각 독립된 알약으로 고르되 VoiceOver의 radiogroup + radio 의미와
 * 축별 점수·말 라벨은 그대로 유지한다.
 */
export const ScoreSegment = forwardRef<View, ScoreSegmentProps>(function ScoreSegment(
  { label, low, high, value, onChange, hero = false, words, options, invalid = false, index, style },
  ref,
) {
  useLocale()
  const lean = (score: number) => (score <= 2 ? t`${ph({ side: labelOf(low) })} 쪽` : score >= 4 ? t`${ph({ side: labelOf(high) })} 쪽` : t`보통`)
  const word = value !== null ? (options?.find((option) => option.value === value)?.label ?? words?.[value - 1] ?? null) : null
  const status = invalid && value === null ? t`골라주세요` : word ? labelOf(word) : value !== null ? t`${value}점` : t`미선택`
  const choose = (score: number) => {
    if (Platform.OS !== "web" && score !== value) void Haptics.selectionAsync().catch(() => undefined)
    onChange(score)
  }

  return (
    <View style={style}>
      <View style={styles.scoreHead}>
        <AppText variant={hero ? "cardTitle" : "bodyStrong"}>
          {index ? <AppText tone="sub" variant="bodyStrong">{`${index}  `}</AppText> : null}
          {labelOf(label)}
        </AppText>
        <AppText
          capScale
          numberOfLines={2}
          style={styles.scoreWord}
          tone={invalid && value === null ? "critical" : value !== null ? "ink" : "sub"}
          variant="secondary"
        >
          {status}
        </AppText>
      </View>
      <View
        accessibilityLabel={labelOf(label)}
        accessibilityRole="radiogroup"
        ref={ref}
        style={styles.scoreCells}
      >
        {(options ?? SCORE_OPTIONS).map((option) => {
          const selected = value === option.value
          return (
            <ScorePill
              accessibilityLabel={options
                ? t`${ph({ p0: labelOf(label) })} ${ph({ p1: labelOf(option.label) })}, ${ph({ p2: option.value })}점`
                : t`${ph({ p0: labelOf(label) })} ${ph({ p1: option.value })}점, ${ph({ p2: lean(option.value) })}`}
              key={option.value}
              label={labelOf(option.label)}
              onPress={() => choose(option.value)}
              selected={selected}
              variant={options ? "button" : "cardTitle"}
            />
          )
        })}
      </View>
      {!options ? (
        <View style={styles.scoreEnds}>
          <AppText capScale tone="sub" variant="meta">{labelOf(low)}</AppText>
          <AppText capScale tone="sub" variant="meta">{labelOf(high)}</AppText>
        </View>
      ) : null}
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

/** 따뜻한 회색 면을 사용하며, 누를 때도 테두리 없이 면으로만 반응한다. */
export function Card({ children, onPress, accessibilityLabel, style, contentStyle, testID }: CardProps) {
  useLocale()
  if (onPress) {
    return (
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.pressedWash, style]}
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
  /** 표시 방식과 관계없이 토스트 바탕은 deep으로 일정하게 유지한다. */
  appearance?: "dark" | "light"
  /** 문구 앞 아이콘(예: 저장 표시). 흰색으로 넘긴다. */
  icon?: ReactNode
  style?: StyleProp<ViewStyle>
}

/** 잠깐 뜨는 안내는 한 가지 깊은 면과 흰 글씨로 읽는다. */
export function Toast({
  visible,
  message,
  variant = "neutral",
  duration = 2500,
  onDismiss,
  actionLabel,
  onAction,
  icon,
  style,
}: ToastProps) {
  useLocale()
  const screenReader = useScreenReaderEnabled()
  const hasAction = Boolean(actionLabel && onAction)
  // 2.5초는 화면 읽기로 되돌리기 버튼까지 가기에 짧다. 화면 읽기가 켜져 있고 행동이 있으면 직접 닫을 때까지 두고,
  // 화면 읽기나 행동 중 하나만 있으면 10초는 머문다.
  const holdUntilClosed = screenReader && hasAction
  const effectiveDuration = screenReader || hasAction ? Math.max(duration, TOAST_ACCESSIBLE_MS) : duration

  useEffect(() => {
    if (!visible || !onDismiss || effectiveDuration <= 0 || holdUntilClosed) return
    const timer = setTimeout(onDismiss, effectiveDuration)
    return () => clearTimeout(timer)
  }, [effectiveDuration, holdUntilClosed, onDismiss, visible])

  // iOS는 alert 역할만으로 읽어 주지 않는다. 안드로이드는 live region이 읽으므로 두 번 읽지 않게 iOS·웹에서만 알린다.
  useEffect(() => {
    if (!visible || !message || Platform.OS === "android") return
    AccessibilityInfo.announceForAccessibility(hasAction ? `${message}. ${t`${ph({ action: actionLabel ?? "" })} 버튼이 있어요`}` : message)
  }, [actionLabel, hasAction, message, visible])

  if (!visible) return null
  return (
    <View
      accessibilityLiveRegion={variant === "critical" ? "assertive" : "polite"}
      accessibilityRole="alert"
      // 직접 닫을 때까지 머무는 토스트는 VoiceOver 문지르기(escape)로도 닫힌다
      onAccessibilityEscape={onDismiss}
      style={[styles.toast, style]}
    >
      {icon}
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
      {holdUntilClosed && onDismiss ? (
        <Pressable accessibilityLabel={t`알림 닫기`} accessibilityRole="button" onPress={onDismiss} style={styles.toastAction}>
          <X color={colors.onDark} size={18} />
        </Pressable>
      ) : null}
    </View>
  )
}

/** 화면 읽기가 켜졌거나 되돌리기 같은 행동이 붙은 토스트가 2.5초 대신 머무는 최소 시간 */
const TOAST_ACCESSIBLE_MS = 10_000

/** VoiceOver·TalkBack이 켜져 있는지. 켜고 끄는 대로 따라간다 */
function useScreenReaderEnabled() {
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    let alive = true
    void AccessibilityInfo.isScreenReaderEnabled().then((on) => alive && setEnabled(on))
    const sub = AccessibilityInfo.addEventListener("screenReaderChanged", setEnabled)
    return () => {
      alive = false
      sub.remove()
    }
  }, [])
  return enabled
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
  useLocale()
  return (
    <View style={[styles.stateContainer, style]}>
      {icon ? <View style={styles.stateIcon}>{icon}</View> : null}
      <AppText style={styles.textCenter} variant="cardTitle">
        {title}
      </AppText>
      {description ? (
        <AppText style={[styles.textCenter, styles.stateDescription]} tone="sub" variant="secondary">
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
  color?: ColorValue
  style?: StyleProp<ViewStyle>
}

export function LoadingState({ label = t`불러오는 중…`, fullScreen = false, color = colors.ink, style }: LoadingStateProps) {
  useLocale()
  return (
    <View
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      style={[styles.loading, fullScreen && styles.flex, style]}
    >
      <ActivityIndicator color={color} size="small" />
      {label ? (
        <AppText tone="sub" variant="secondary">
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
  /** 저장 실패처럼 복구가 필요한 안내는 잘리지 않는 경고로 읽는다. */
  hintIsError?: boolean
  /** Reserve space for a changing hint so the buttons and content above stay in place. */
  reserveHintLines?: number
  style?: StyleProp<ViewStyle>
}

/**
 * 화면 하단에 고정되는 행동 영역. 하단 inset을 더해 홈 인디케이터와 겹치지 않는다.
 * 320×568 화면에서도 스크롤 없이 보여야 하는 CTA(기록 저장, 완료, 다음 단계)에 쓴다.
 */
export function StickyActionBar({ hint, hintTone = "muted", hintIsError = false, reserveHintLines = 0, style, children }: StickyActionBarProps) {
  useLocale()
  const insets = useSafeAreaInsets()
  const hintText = hint ? (
    <AppText
      accessibilityLiveRegion={hintIsError ? "assertive" : "polite"}
      accessibilityRole={hintIsError ? "alert" : undefined}
      capScale
      lineBreakStrategyIOS="hangul-word"
      numberOfLines={hintIsError ? undefined : 2}
      tone={hintTone}
      variant="meta"
    >
      {hint}
    </AppText>
  ) : null
  return (
    <View style={[styles.stickyBar, { paddingBottom: Math.max(insets.bottom, spacing.x4) }, style]}>
      {hint || reserveHintLines ? (
        <View style={[styles.stickyHintSlot, reserveHintLines ? { height: reserveHintLines * 18 * maxFontScale + spacing.x1 } : undefined]}>
          {hintIsError && reserveHintLines ? (
            <ScrollView nestedScrollEnabled style={styles.flex}>{hintText}</ScrollView>
          ) : hintText}
        </View>
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

/** 짧은 작업은 흰 시트로 띄우고 뒤판은 검정 반투명 면으로 분리한다. */
export function BottomSheet({
  visible,
  onClose,
  title,
  description,
  closeLabel = t`닫기`,
  maxHeight = "85%",
  dismissOnBackdropPress = true,
  footer,
  children,
}: BottomSheetProps) {
  useLocale()
  const { mounted, progress, sheetHeight, reduceMotion, onSheetLayout } = useSheetTransition(visible)
  const { dragY, dragHandlers } = useSheetDrag({ visible, sheetHeight, reduceMotion, enabled: dismissOnBackdropPress, onDismiss: onClose })
  // Keep the header mounted while the sheet exits. Some callers clear their title
  // together with `visible`, which otherwise shortens the sheet mid-animation.
  const lastHeader = useRef({ title, description })
  if (visible) lastHeader.current = { title, description }
  const shownTitle = visible ? title : lastHeader.current.title
  const shownDescription = visible ? description : lastHeader.current.description
  if (!mounted) return null
  return (
    <Modal
      animationType="none"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible
    >
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalRoot}>
        {/* 뒤판은 제자리에서 흐려진다. 시트와 함께 밀려 올라오면 화면 전체가 딸려 오는 것처럼 보인다 */}
        <Animated.View style={[styles.backdrop, { opacity: progress }]}>
          <Pressable
            accessibilityLabel={t`${ph({ p0: shownTitle ?? t`시트` })} 닫기`}
            accessibilityRole="button"
            onPress={dismissOnBackdropPress ? onClose : undefined}
            style={styles.fill}
          />
        </Animated.View>
        <Animated.View
          onLayout={onSheetLayout}
          style={[
            { maxHeight },
            {
              transform: [
                { translateY: Animated.add(progress.interpolate({ inputRange: [0, 1], outputRange: [sheetHeight, 0] }), dragY) },
              ],
            },
          ]}
        >
        <SafeAreaView accessibilityViewIsModal edges={["bottom"]} style={styles.sheet}>
          {/* 손잡이와 머리를 끌어내리면 닫힌다. 내용 영역은 스크롤과 다투지 않게 빼 두었다 */}
          <View {...dragHandlers}>
            <View style={styles.sheetHandle} />
            {shownTitle || shownDescription ? (
              <View style={styles.sheetHeader}>
                <View style={styles.flex}>
                  {shownTitle ? (
                    <AppText accessibilityRole="header" variant="sectionTitle">
                      {shownTitle}
                    </AppText>
                  ) : null}
                  {shownDescription ? (
                    <AppText style={styles.sheetDescription} tone="muted" variant="secondary">
                      {shownDescription}
                    </AppText>
                  ) : null}
                </View>
                <IconButton accessibilityLabel={closeLabel} icon={<X color={colors.ink} size={22} />} onPress={onClose} />
              </View>
            ) : null}
          </View>
          <View style={styles.sheetContent}>{children}</View>
          {footer ? <View style={styles.sheetFooter}>{footer}</View> : null}
        </SafeAreaView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

/** 이만큼(시트 높이 비율) 끌어내리거나 빠르게 튕기면 닫는다 */
const SHEET_DISMISS_RATIO = 0.25
const SHEET_DISMISS_VELOCITY = 1

/**
 * 시트 손잡이를 끌어내려 닫는다. 손가락을 따라가는 움직임은 사용자가 직접 만드는 것이라 그대로 두고,
 * 놓았을 때 제자리로 돌아가는 움직임만 Reduce Motion에서 즉시 바꾼다.
 * 뒤판으로 닫지 못하게 한 시트(저장 중 등)는 끌어서도 닫히지 않는다.
 */
function useSheetDrag({
  visible,
  sheetHeight,
  reduceMotion,
  enabled,
  onDismiss,
}: {
  visible: boolean
  sheetHeight: number
  reduceMotion: boolean
  enabled: boolean
  onDismiss: () => void
}) {
  const dragY = useRef(new Animated.Value(0)).current
  const latest = useRef({ visible, sheetHeight, reduceMotion, enabled, onDismiss })
  latest.current = { visible, sheetHeight, reduceMotion, enabled, onDismiss }

  // 다시 열 때는 지난번 끌어내린 자리에서 시작하지 않는다
  useEffect(() => {
    if (visible) dragY.setValue(0)
  }, [dragY, visible])

  const responder = useRef(
    PanResponder.create({
      // 탭(닫기 버튼)은 그대로 통과시키고, 아래로 분명히 끌 때만 잡는다
      onMoveShouldSetPanResponder: (_, gesture) => latest.current.enabled && gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_, gesture) => dragY.setValue(Math.max(0, gesture.dy)),
      onPanResponderRelease: (_, gesture) => {
        const settle = () => {
          if (latest.current.reduceMotion) dragY.setValue(0)
          else Animated.timing(dragY, { toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
        }
        if (gesture.dy > latest.current.sheetHeight * SHEET_DISMISS_RATIO || gesture.vy > SHEET_DISMISS_VELOCITY) {
          latest.current.onDismiss()
          // 부르는 쪽이 닫기를 거절하면(저장 중 등) 시트가 끌린 자리에 멈추지 않게 되돌린다
          requestAnimationFrame(() => {
            if (latest.current.visible) settle()
          })
          return
        }
        settle()
      },
      onPanResponderTerminate: () => dragY.setValue(0),
    }),
  ).current

  return { dragY, dragHandlers: responder.panHandlers }
}

/**
 * 시트가 뜨고 지는 동안의 값 하나. 뒤판은 이 값으로 흐려지고 시트는 이 값으로 올라온다.
 * Reduce Motion이면 움직임 없이 즉시 바뀐다.
 */
function useSheetTransition(visible: boolean) {
  const [mounted, setMounted] = useState(visible)
  const [sheetHeight, setSheetHeight] = useState(360)
  const [reduceMotion, setReduceMotion] = useState(false)
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current

  useEffect(() => {
    let alive = true
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => alive && setReduceMotion(on))
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion)
    return () => {
      alive = false
      sub.remove()
    }
  }, [])

  useEffect(() => {
    if (visible) setMounted(true)
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: reduceMotion ? 0 : visible ? 260 : 200,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    })
    animation.start(({ finished }) => {
      if (finished && !visible) setMounted(false)
    })
    return () => animation.stop()
  }, [progress, reduceMotion, visible])

  const onSheetLayout = (event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height
    if (height > 0) setSheetHeight(height)
  }

  return { mounted, progress, sheetHeight, reduceMotion, onSheetLayout }
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
  confirmLabel = t`확인`,
  cancelLabel = t`취소`,
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useLocale()
  const { fontScale } = useWindowDimensions()
  /*
   * 320pt 폭에 두 버튼을 나란히 두면 큰 글씨에서 문구가 단어 가운데서 쪼개진다.
   * 그 지점부터는 세로로 쌓는다. 순서는 그대로 [취소 · 확인]이라 첫 포커스도 바뀌지 않는다.
   */
  const stacked = fontScale > 1.2
  return (
    <Modal animationType="fade" onRequestClose={onCancel} presentationStyle="overFullScreen" transparent visible={visible}>
      <View style={styles.dialogRoot}>
        <Pressable accessibilityLabel={t`${ph({ p0: title })} 닫기`} accessibilityRole="button" onPress={onCancel} style={styles.backdrop} />
        <View accessibilityRole="alert" accessibilityViewIsModal style={styles.dialog}>
          <AppText accessibilityRole="header" lineBreakStrategyIOS="hangul-word" style={styles.textCenter} variant="sectionTitle">
            {title}
          </AppText>
          {message ? (
            <AppText lineBreakStrategyIOS="hangul-word" style={[styles.textCenter, styles.dialogMessage]} tone="sub" variant="body">
              {message}
            </AppText>
          ) : null}
          <View style={[styles.dialogActions, stacked && styles.dialogActionsStacked]}>
            <Button disabled={loading} fullWidth onPress={onCancel} title={cancelLabel} variant="ghost" />
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
  // 파임은 테두리 없는 식권 면을 덮으므로 절취선을 면 가장자리에 붙인다
  ticketCutHorizontal: { height: line.base, flexDirection: "row" },
  ticketCutVertical: { width: line.base, alignSelf: "stretch" },
  notch: { position: "absolute" },
  screen: { flex: 1, backgroundColor: colors.paper },
  screenContent: { flexGrow: 1 },
  header: {
    minHeight: 56,
    paddingLeft: spacing.x2,
    paddingRight: spacing.x2,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.paper,
  },
  headerSide: { minWidth: touchTarget, minHeight: touchTarget, justifyContent: "center" },
  headerRight: { alignItems: "flex-end" },
  headerTitles: { flex: 1, paddingHorizontal: spacing.x2 },
  headerTitlesCenter: { alignItems: "center" },
  sectionHeader: { flexDirection: "row", alignItems: "baseline", gap: spacing.x2, marginBottom: spacing.x3 },
  iconButton: {
    width: touchTarget,
    height: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    backgroundColor: colors.canvasSoft,
  },
  // 스택 헤더의 뒤로가기는 면 없이 아이콘만 두고, 누를 때만 회색 원이 보인다
  headerBack: { backgroundColor: colors.transparent },
  iconButtonOnImage: { backgroundColor: colors.photoPill },
  pressedWash: { backgroundColor: colors.surfacePressed },
  pressedSecondary: { backgroundColor: colors.secondaryPressed },
  pressedBrand: { backgroundColor: colors.brandPressed },
  button: {
    borderRadius: radii.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.x2,
    paddingVertical: spacing.x2,
  },
  buttonText: { textAlign: "center" },
  buttonIconHidden: { opacity: 0 },
  buttonSpinner: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
  fullWidth: { alignSelf: "stretch", flex: 1 },
  disabled: { opacity: 0.4 },
  disabledButton: { backgroundColor: colors.canvasSoft },
  chip: {
    height: 40,
    paddingHorizontal: spacing.x4,
    borderRadius: radii.pill,
    backgroundColor: colors.canvasSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.x1_5,
  },
  tag: {
    alignSelf: "flex-start",
    backgroundColor: colors.canvasSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.x3,
    paddingVertical: spacing.x1_5,
  },
  tagText: { fontWeight: "600" },
  sticker: {
    alignSelf: "flex-start",
    minHeight: 26,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x1,
    backgroundColor: colors.canvasSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.x2_5,
  },
  onImagePill: { backgroundColor: colors.photoPill },
  onImageText: { color: colors.onPhotoPill },
  typeInList: { flexShrink: 0 },
  ramenTypeTag: {
    alignSelf: "flex-start",
    justifyContent: "center",
    minHeight: 28,
    paddingHorizontal: spacing.x2_5,
    borderRadius: radii.pill,
    backgroundColor: colors.canvasSoft,
  },
  soupDot: { borderWidth: line.base, borderColor: colors.soupEdge, flexShrink: 0 },
  stickerText: { fontWeight: "700" },
  scoreHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.x2,
    // Reserve two lines for selected words and validation without moving the score pills.
    minHeight: 2 * (typography.secondary.lineHeight ?? 20) * maxFontScale,
    marginBottom: spacing.x2,
  },
  scoreWord: { fontWeight: "700", flexShrink: 1, textAlign: "right" },
  scoreCells: { flexDirection: "row", gap: spacing.x1_5 },
  scoreCell: {
    flex: 1,
    minWidth: 0,
    minHeight: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.x1,
    backgroundColor: colors.canvasSoft,
  },
  scoreCellText: { fontWeight: "700", fontVariant: ["tabular-nums"], textAlign: "center" },
  scoreEnds: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.x1_5 },
  card: {
    backgroundColor: colors.canvasSoft,
    borderRadius: radii.sm,
    padding: spacing.x4,
  },
  toast: {
    position: "absolute",
    left: spacing.gutter,
    right: spacing.gutter,
    bottom: spacing.x6,
    minHeight: touchTarget,
    borderRadius: radii.sm,
    backgroundColor: colors.deep,
    paddingHorizontal: spacing.x4,
    paddingVertical: spacing.x3,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x3,
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
    borderTopWidth: line.base,
  },
  stickyActions: { flexDirection: "row", gap: spacing.x2 },
  stickyHintSlot: { justifyContent: "flex-end" },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  fill: { flex: 1 },
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    ...shadows.modal,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.secondaryPressed,
    alignSelf: "center",
    marginTop: spacing.x3,
  },
  sheetHeader: {
    minHeight: 56,
    paddingLeft: spacing.gutter,
    paddingRight: spacing.x2,
    flexDirection: "row",
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: line.base,
  },
  sheetDescription: { marginTop: spacing.x0_5 },
  // 긴 본문이 하단 버튼을 밀어내지 않도록 줄어들 수 있게 둔다
  sheetContent: { flexShrink: 1, paddingHorizontal: spacing.x4, paddingVertical: spacing.x4 },
  sheetFooter: {
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.x4,
    borderTopColor: colors.border,
    borderTopWidth: line.base,
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
    ...shadows.modal,
  },
  dialogMessage: { marginTop: spacing.x2 },
  dialogActions: { flexDirection: "row", gap: spacing.x2, marginTop: spacing.x5 },
  dialogActionsStacked: { flexDirection: "column" },
})
