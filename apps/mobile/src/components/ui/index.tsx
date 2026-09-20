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
  type ViewProps,
  type ViewStyle,
} from "react-native"
import { SafeAreaView, useSafeAreaInsets, type Edge } from "react-native-safe-area-context"
import * as Haptics from "expo-haptics"
import { forwardRef, useEffect, type PropsWithChildren, type ReactNode } from "react"

import {
  colors,
  line,
  maxFontScale,
  pressInto,
  radii,
  shadows,
  spacing,
  touchTarget,
  typography,
} from "../../theme"

/*
 * RAOTA 공통 부품. 모양은 apps/mobile/DESIGN.md(네오 브루탈리즘 라이트)를 따른다.
 * 부품의 테두리는 2pt 먹선, 번지지 않는 그림자는 누를 수 있는 것(버튼, 사진 위 아이콘 버튼)에만 있다.
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
  style?: StyleProp<ViewStyle>
}

/** 섹션 제목(section-title) + 오른쪽 메타. 제목 위 eyebrow 라벨은 쓰지 않는다 */
export function SectionHeader({ title, meta, metaTone = "sub", style }: SectionHeaderProps) {
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
 * primary 빨강 · secondary 먹색 · outline 흰 면: 12pt 사각 + 2pt 먹선 + 번지지 않는 그림자(누르면 그림자 속으로 들어간다).
 * utility 6pt 사각 + 1.5pt 선(그림자 없음) · ghost 글씨만 · danger 되돌릴 수 없는 행동(빨강)
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
  primary: { backgroundColor: colors.brand, borderColor: colors.outline, borderRadius: radii.sm, ...shadows.hardS },
  secondary: { backgroundColor: colors.ink, borderColor: colors.outline, borderRadius: radii.sm, ...shadows.hardS },
  outline: { backgroundColor: colors.canvas, borderColor: colors.outline, borderRadius: radii.sm, ...shadows.hardS },
  utility: { backgroundColor: colors.canvas, borderColor: colors.outline, borderRadius: radii.xs, borderWidth: line.thin },
  ghost: { backgroundColor: colors.transparent, borderColor: colors.transparent, borderRadius: radii.sm },
  danger: { backgroundColor: colors.brand, borderColor: colors.outline, borderRadius: radii.sm, ...shadows.hardS },
}

/** 그림자가 있는 버튼은 누르면 그림자 속으로 들어간다. 없는 버튼은 옅은 면으로 바뀐다 */
const buttonHasShadow: Record<ButtonVariant, boolean> = {
  primary: true,
  secondary: true,
  outline: true,
  utility: false,
  ghost: false,
  danger: true,
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
  medium: { minHeight: 50, paddingHorizontal: spacing.x5 },
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
  // 그림자는 "누를 수 있다"는 표시라서 못 누르는 동안에는 없앤다. 비활성은 옅은 면 + 흐린 선, 처리 중은 면 색을 유지한다
  const flatDisabled = disabled && !loading && buttonHasShadow[variant]
  const color = flatDisabled ? colors.textMuted : buttonTextColor[variant]
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
        pressed && !unavailable && (buttonHasShadow[variant] ? styles.pressedInto : styles.pressedWash),
        unavailable && (buttonHasShadow[variant] ? styles.buttonNoShadow : styles.disabled),
        flatDisabled && styles.buttonDisabled,
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
  /** 사진 위에 띄울 때: 흰 12pt 사각 + 2pt 먹선 + 번지지 않는 그림자. 아이콘은 ink 색으로 넘긴다 */
  onImage?: boolean
  style?: StyleProp<ViewStyle>
}

/** 44pt 아이콘 버튼. 기본은 테두리 없는 12pt 사각(헤더·시트), onImage는 사진 위에 뜨는 흰 키 */
export function IconButton({ icon, onImage = false, style, ...props }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      {...props}
      style={({ pressed }) => [
        styles.iconButton,
        onImage && styles.iconButtonOnImage,
        pressed && (onImage ? styles.pressedInto : styles.pressedWash),
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

/** 흰 면 + 1.5pt 먹선 알약, 선택은 빨강 면. 그림자는 없다. 선택 상태를 VoiceOver에 알린다 */
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

/** 읽기 전용 태그. 흰 면 + 1.5pt 먹선 + 6pt 모서리 */
export function Tag({ label, style }: { label: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.tag, style]}>
      <AppText capScale variant="meta">
        {label}
      </AppText>
    </View>
  )
}

export interface StickerProps extends Omit<ViewProps, "style" | "children"> {
  label: string
  /** yolk: 표시(기본). ink: 먹색 면 + 흰 글씨("종합 리포트" 같은 묶음 이름) */
  tone?: "yolk" | "ink"
  icon?: ReactNode
  style?: StyleProp<ViewStyle>
}

/**
 * 표시 스티커. 노랑 면 + 1.5pt 먹선 + 6pt 모서리. 기울이지 않는다.
 * "오늘의 픽", "AI가 요약했어요", 추천 1위처럼 읽기만 하는 표시에 쓰고 버튼에는 쓰지 않는다. 한 화면에 세 개까지.
 */
export function Sticker({ label, tone = "yolk", icon, style, ...props }: StickerProps) {
  return (
    <View {...props} style={[styles.sticker, tone === "ink" && styles.stickerInk, style]}>
      {icon}
      <NativeText
        maxFontSizeMultiplier={maxFontScale}
        numberOfLines={1}
        style={[typography.meta, styles.stickerText, { color: tone === "ink" ? colors.onDark : colors.ink }]}
      >
        {label}
      </NativeText>
    </View>
  )
}

/**
 * 라멘 종류 태그(쇼유, 돈코츠, 시오…). 매장·라멘로그·지도 어디서나 같은 노랑 스티커 모양으로 나온다.
 * 기록은 종류(RAMEN_TYPES), 매장은 원장의 대표 스타일(style)을 넘긴다. style은 "쇼유 라멘"처럼 적혀 있어서
 * 뒤의 "라멘"을 떼고 같은 글자로 보여 준다(데이터는 바꾸지 않는다). "토리파이탄"처럼 원장에만 있는 스타일도 그대로 나온다.
 */
export function RamenTypeTag({ type, style }: { type: string; style?: StyleProp<ViewStyle> }) {
  const label = type.replace(/\s*라멘$/, "").trim()
  // 종류가 비었거나 그냥 "라멘"(원장에 없는 가게의 기본값)이면 알려 주는 것이 없으므로 그리지 않는다
  if (!label) return null
  return <Sticker accessibilityLabel={`라멘 종류 ${label}`} label={label} style={style} />
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
  /**
   * quality: 좋고 나쁨. 고른 점수까지 차오른다(별점처럼). hero면 크게 그리고 한 마디 반응을 붙인다.
   * spectrum: 좋고 나쁨이 아닌 취향의 위치(맑음↔진함). 선 위의 한 점을 고른다.
   */
  kind?: "quality" | "spectrum"
  hero?: boolean
  /** 1~5점 각각의 한 마디("맛있었어요", "진한 편"). 없으면 "N점" */
  words?: readonly string[]
  /** 제출을 시도했는데 비어 있으면 빨간 안내를 보여준다 */
  invalid?: boolean
  /** 화면 순서 번호(1~5). 축 이름 앞에 붙는다 */
  index?: number
  style?: StyleProp<ViewStyle>
}

const SCORES = [1, 2, 3, 4, 5] as const

/**
 * 맛 평가 한 줄. 칸마다 44pt 이상, 고르면 가벼운 선택 햅틱.
 * VoiceOver: radiogroup + radio(checked), 라벨은 "육수 농도 4점, 진함 쪽".
 * ref는 첫 번째 칸 묶음에 걸려 빠진 항목으로 스크롤할 때 쓴다.
 */
export const ScoreSegment = forwardRef<View, ScoreSegmentProps>(function ScoreSegment(
  { label, low, high, value, onChange, kind = "quality", hero = false, words, invalid = false, index, style },
  ref,
) {
  const lean = (score: number) => (score <= 2 ? `${low} 쪽` : score >= 4 ? `${high} 쪽` : "보통")
  const word = value ? (words?.[value - 1] ?? `${value}점`) : null
  const choose = (score: number) => {
    if (Platform.OS !== "web" && score !== value) void Haptics.selectionAsync().catch(() => undefined)
    onChange(score)
  }
  const status = invalid && !value ? "골라주세요" : word ?? "미선택"

  return (
    <View style={style}>
      <View style={styles.scoreHead}>
        <AppText variant={hero ? "sectionTitle" : "bodyStrong"}>
          {index ? <AppText tone="sub" variant={hero ? "sectionTitle" : "bodyStrong"}>{`${index}  `}</AppText> : null}
          {label}
        </AppText>
        {hero ? null : (
          <AppText capScale style={styles.scoreWord} tone={invalid && !value ? "critical" : value ? "ink" : "sub"} variant="secondary">
            {status}
          </AppText>
        )}
      </View>

      <View
        accessibilityLabel={label}
        accessibilityRole="radiogroup"
        ref={ref}
        style={kind === "spectrum" ? styles.spectrum : styles.quality}
      >
        {/* 스펙트럼은 다섯 점을 잇는 선 위에서 고른다 */}
        {kind === "spectrum" ? <View pointerEvents="none" style={[styles.spectrumTrack, invalid && !value && styles.trackInvalid]} /> : null}
        {SCORES.map((score) => {
          const selected = value === score
          // 고른 점수는 진한 빨강, 그 아래 점수는 옅은 빨강으로 차오른다(한 화면에 진한 빨강은 하나씩)
          const filled = kind === "quality" && value !== null && score < value
          return (
            <Pressable
              accessibilityLabel={`${label} ${score}점, ${lean(score)}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              hitSlop={kind === "spectrum" ? { top: 6, bottom: 6 } : undefined}
              key={score}
              onPress={() => choose(score)}
              style={({ pressed }) => [styles.scoreCell, pressed && !selected && styles.pressedDimScore]}
            >
              {kind === "spectrum" ? (
                selected ? (
                  <View style={styles.spectrumPick}>
                    <NativeText maxFontSizeMultiplier={maxFontScale} style={[typography.bodyStrong, styles.onDarkText]}>
                      {score}
                    </NativeText>
                  </View>
                ) : (
                  <View style={[styles.spectrumDot, invalid && !value && styles.dotInvalid]} />
                )
              ) : (
                <View
                  style={[
                    styles.qualityDot,
                    hero && styles.qualityDotHero,
                    filled && styles.qualityDotFilled,
                    kind === "quality" && selected && styles.qualityDotSelected,
                    invalid && !value && styles.dotInvalid,
                  ]}
                >
                  <NativeText
                    maxFontSizeMultiplier={maxFontScale}
                    style={[
                      hero ? typography.sectionTitle : typography.bodyStrong,
                      { color: selected ? colors.onDark : filled ? colors.brand : colors.ink },
                    ]}
                  >
                    {score}
                  </NativeText>
                </View>
              )}
            </Pressable>
          )
        })}
      </View>

      {hero ? (
        // 고른 점수에 한 마디로 답한다. 비어 있으면 양 끝 설명
        <AppText
          accessibilityLiveRegion="polite"
          capScale
          style={styles.heroWord}
          tone={invalid && !value ? "critical" : value ? "ink" : "sub"}
          variant={value ? "cardTitle" : "secondary"}
        >
          {value ? word : invalid ? "골라주세요" : `${low} ← → ${high}`}
        </AppText>
      ) : (
        <View style={styles.scoreEnds}>
          <AppText capScale tone="sub" variant="meta">
            {low}
          </AppText>
          <AppText capScale tone="sub" variant="meta">
            {high}
          </AppText>
        </View>
      )}
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

/** 흰 면, 12pt, 2pt 먹선, 그림자 없음. 카드 안에 카드를 넣지 않는다 */
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
  /**
   * dark: 기본(먹색 블록). light: 흰 블록 + 2pt 먹선. 먹색 면 위에서도 묻히지 않아야 하는 화면
   * (매장 상세처럼 아래쪽에 차콜 섹션이 있는 곳)에서 쓴다
   */
  appearance?: "dark" | "light"
  /** 문구 앞 아이콘(예: 저장 표시). 색은 호출하는 쪽이 appearance에 맞춘다 */
  icon?: ReactNode
  style?: StyleProp<ViewStyle>
}

const toastColors: Record<FeedbackVariant, string> = {
  neutral: colors.ink,
  positive: colors.ink,
  critical: colors.critical,
  informative: colors.ink,
}

/** 먹색 12pt 블록 토스트. 성공·실패를 색만으로 구분하지 않도록 문구에 결과를 쓴다 */
export function Toast({
  visible,
  message,
  variant = "neutral",
  duration = 2500,
  onDismiss,
  actionLabel,
  onAction,
  appearance = "dark",
  icon,
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
      style={[
        styles.toast,
        appearance === "light" ? styles.toastLight : { backgroundColor: toastColors[variant] },
        style,
      ]}
    >
      {icon}
      <AppText style={[styles.flex, appearance === "light" && styles.bold]} tone={appearance === "light" ? "ink" : "onDark"} variant="secondary">
        {message}
      </AppText>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={styles.toastAction}>
          <AppText style={styles.underline} tone={appearance === "light" ? "ink" : "onDark"} variant="secondary">
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

/** 입력이 필요한 짧은 과제용. 12pt 윗모서리 + 2pt 먹선, 36×4 손잡이, 검정 50% 뒤판 */
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
  screen: { flex: 1, backgroundColor: colors.paper },
  screenContent: { flexGrow: 1 },
  header: {
    minHeight: 56,
    paddingLeft: spacing.x2,
    paddingRight: spacing.x2,
    flexDirection: "row",
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    backgroundColor: colors.paper,
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
    borderRadius: radii.sm,
  },
  iconButtonOnImage: {
    backgroundColor: colors.canvas,
    borderColor: colors.outline,
    borderWidth: line.base,
    ...shadows.hardS,
  },
  pressedWash: { backgroundColor: colors.canvasSoft },
  pressedWashBg: { backgroundColor: colors.canvasSoft },
  pressedDim: { opacity: 0.85 },
  pressedInto: pressInto(2),
  button: {
    borderWidth: line.base,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.x2,
  },
  buttonText: { textAlign: "center" },
  fullWidth: { alignSelf: "stretch", flex: 1 },
  disabled: { opacity: 0.4 },
  buttonNoShadow: { shadowOpacity: 0 },
  buttonDisabled: { backgroundColor: colors.canvasSoft, borderColor: colors.textFaint },
  chip: {
    minHeight: touchTarget,
    paddingHorizontal: spacing.x4,
    borderRadius: radii.pill,
    backgroundColor: colors.canvas,
    borderColor: colors.outline,
    borderWidth: line.thin,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.x1_5,
  },
  chipSelected: { backgroundColor: colors.brand, borderColor: colors.outline },
  tag: {
    alignSelf: "flex-start",
    backgroundColor: colors.canvas,
    borderColor: colors.outline,
    borderWidth: line.thin,
    borderRadius: radii.xs,
    paddingHorizontal: 9,
    paddingVertical: spacing.x1,
  },
  sticker: {
    alignSelf: "flex-start",
    minHeight: 26,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x1,
    backgroundColor: colors.yolk,
    borderColor: colors.outline,
    borderWidth: line.thin,
    borderRadius: radii.xs,
    paddingHorizontal: 9,
  },
  stickerInk: { backgroundColor: colors.ink },
  stickerText: { fontWeight: "800" },
  scoreHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: spacing.x2,
  },
  scoreWord: { fontWeight: "700" },
  pressedDimScore: { opacity: 0.6 },
  quality: { flexDirection: "row", justifyContent: "space-between" },
  spectrum: { flexDirection: "row", justifyContent: "space-between" },
  scoreCell: { flex: 1, minHeight: touchTarget, alignItems: "center", justifyContent: "center" },
  // 좋고 나쁨: 원이 고른 점수까지 차오른다
  qualityDot: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radii.pill,
    borderWidth: line.thin,
    borderColor: colors.outline,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvas,
  },
  qualityDotHero: { width: 56, height: 56, borderWidth: line.base },
  qualityDotFilled: { backgroundColor: colors.brandWeak },
  qualityDotSelected: { backgroundColor: colors.brand },
  // 취향 위치: 다섯 칸의 가운데를 잇는 선(첫 칸 중앙 10% ~ 마지막 칸 중앙 90%)
  spectrumTrack: { position: "absolute", left: "10%", right: "10%", top: "50%", height: 2, marginTop: -1, backgroundColor: colors.border },
  trackInvalid: { backgroundColor: colors.brand },
  spectrumDot: {
    width: 14,
    height: 14,
    borderRadius: radii.pill,
    borderWidth: line.thin,
    borderColor: colors.outline,
    backgroundColor: colors.canvas,
  },
  spectrumPick: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
    borderWidth: line.thin,
    borderColor: colors.outline,
  },
  onDarkText: { color: colors.onDark },
  dotInvalid: { borderColor: colors.brand },
  heroWord: { marginTop: spacing.x2, textAlign: "center" },
  scoreEnds: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.x1_5 },
  card: {
    backgroundColor: colors.canvas,
    borderRadius: radii.sm,
    borderColor: colors.outline,
    borderWidth: line.base,
    padding: spacing.x4,
  },
  toast: {
    position: "absolute",
    left: spacing.gutter,
    right: spacing.gutter,
    bottom: spacing.x6,
    minHeight: touchTarget,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.x4,
    paddingVertical: spacing.x3,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.x3,
  },
  toastAction: { minHeight: touchTarget, justifyContent: "center", paddingHorizontal: spacing.x1 },
  toastLight: { backgroundColor: colors.canvas, borderWidth: line.base, borderColor: colors.outline },
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
    borderTopColor: colors.outline,
    borderTopWidth: line.base,
  },
  stickyActions: { flexDirection: "row", gap: spacing.x2 },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderColor: colors.outline,
    borderWidth: line.base,
    borderBottomWidth: 0,
    overflow: "hidden",
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
  // 긴 본문이 하단 버튼을 밀어내지 않도록 줄어들 수 있게 둔다
  sheetContent: { flexShrink: 1, paddingHorizontal: spacing.gutter, paddingVertical: spacing.x4 },
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
    borderColor: colors.outline,
    borderWidth: line.base,
  },
  dialogMessage: { marginTop: spacing.x2 },
  dialogActions: { flexDirection: "row", gap: spacing.x2, marginTop: spacing.x5 },
})
