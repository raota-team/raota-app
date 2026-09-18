import type { ReactNode } from "react"
import { Redirect, Stack, router, useSegments } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { ChevronLeft } from "lucide-react-native"
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as NativeText,
  type TextProps,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { useRaota } from "@/src/state/RaotaStore"
import { fonts } from "@/src/theme"

export function Text({ style, ...props }: TextProps) {
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

export const palette = {
  red: "#E60000",
  redPressed: "#C90000",
  ink: "#25282B",
  muted: "#7E7E7E",
  quiet: "#8A8A8A",
  line: "#E2E2E2",
  wash: "#F2F2F2",
  canvas: "#FFFFFF",
  success: "#258246",
  warning: "#A15C00",
  dangerWash: "#FFF0F0",
} as const

export const flowStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.canvas },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32 },
  section: {
    backgroundColor: palette.canvas,
    borderColor: palette.line,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 22,
  },
  body: { color: palette.ink, fontSize: 16, lineHeight: 23, fontFamily: fonts.body },
  secondary: { color: palette.muted, fontSize: 14, lineHeight: 20, fontFamily: fonts.body },
  caption: { color: palette.muted, fontSize: 12, lineHeight: 17, fontFamily: fonts.body },
  label: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
    fontFamily: fonts.body,
  },
  input: {
    minHeight: 48,
    borderColor: palette.line,
    borderRadius: 6,
    borderWidth: 1,
    color: palette.ink,
    fontSize: 16,
    fontFamily: fonts.body,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 13 : 9,
  },
  row: { flexDirection: "row", alignItems: "center" },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.line,
  },
  bottomBar: {
    borderTopColor: palette.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    backgroundColor: palette.canvas,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 4 : 10,
  },
})

export function FlowPage({
  children,
  dark = false,
}: {
  children: ReactNode
  dark?: boolean
}) {
  return (
    <SafeAreaView
      style={[flowStyles.root, dark && { backgroundColor: palette.ink }]}
      edges={["top", "bottom"]}
    >
      <StatusBar style={dark ? "light" : "dark"} />
      {children}
    </SafeAreaView>
  )
}

export function FlowScroll({
  children,
  contentContainerStyle,
  keyboardShouldPersistTaps = "handled",
}: {
  children: ReactNode
  contentContainerStyle?: StyleProp<ViewStyle>
  keyboardShouldPersistTaps?: "always" | "never" | "handled"
}) {
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[flowStyles.scrollContent, contentContainerStyle]}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  )
}

export function FlowHeader({
  title,
  subtitle,
  right,
  onBack,
  dark = false,
}: {
  title: string
  subtitle?: string
  right?: ReactNode
  onBack?: () => void
  dark?: boolean
}) {
  const goBack = () => {
    if (onBack) return onBack()
    if (router.canGoBack()) return router.back()
    router.replace("/native")
  }

  return (
    <View style={[styles.header, dark && styles.headerDark]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="뒤로 가기"
        hitSlop={6}
        onPress={goBack}
        style={({ pressed }) => [
          styles.backButton,
          dark && styles.backButtonDark,
          pressed && styles.pressed,
        ]}
      >
        <ChevronLeft
          color={dark ? palette.canvas : palette.ink}
          size={23}
          strokeWidth={2.25}
        />
      </Pressable>
      <View style={styles.headerCopy}>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={[styles.headerTitle, dark && styles.headerTitleDark]}
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text
            numberOfLines={1}
            style={[styles.headerSubtitle, dark && styles.headerSubtitleDark]}
          >
            {subtitle}
          </Text>
        )}
      </View>
      <View style={styles.headerRight}>{right}</View>
    </View>
  )
}

export function ActionButton({
  label,
  onPress,
  variant = "primary",
  shape = "pill",
  disabled = false,
  loading = false,
  icon,
  accessibilityHint,
  accessibilityLabel,
}: {
  label: string
  onPress: () => void
  variant?: "primary" | "secondary" | "dark" | "destructive"
  shape?: "pill" | "rounded"
  disabled?: boolean
  loading?: boolean
  icon?: ReactNode
  accessibilityHint?: string
  accessibilityLabel?: string
}) {
  const primary = variant === "primary"
  const destructive = variant === "destructive"
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        shape === "pill" ? styles.actionPill : styles.actionRounded,
        primary && styles.actionPrimary,
        variant === "secondary" && styles.actionSecondary,
        variant === "dark" && styles.actionDark,
        destructive && styles.actionDestructive,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={
            primary || variant === "dark"
              ? palette.canvas
              : destructive
                ? palette.red
                : palette.ink
          }
        />
      ) : (
        <View style={styles.actionContents}>
          {icon}
          <Text
            style={[
              styles.actionLabel,
              (primary || variant === "dark") && styles.actionLabelInverse,
              destructive && styles.actionLabelDanger,
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  )
}

export function SelectChip({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  )
}

export function InlineNotice({
  text,
  tone = "neutral",
}: {
  text: string
  tone?: "neutral" | "error" | "success"
}) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.notice,
        tone === "error" && styles.noticeError,
        tone === "success" && styles.noticeSuccess,
      ]}
    >
      <Text
        style={[
          styles.noticeText,
          tone === "error" && { color: palette.red },
          tone === "success" && { color: palette.success },
        ]}
      >
        {text}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    minHeight: 57,
    flexDirection: "row",
    alignItems: "center",
    borderBottomColor: palette.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    backgroundColor: palette.canvas,
  },
  headerDark: {
    backgroundColor: palette.ink,
    borderBottomColor: "rgba(255,255,255,0.14)",
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonDark: { backgroundColor: "rgba(255,255,255,0.08)" },
  headerCopy: { flex: 1, paddingHorizontal: 4 },
  headerTitle: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
    fontFamily: fonts.body,
  },
  headerTitleDark: { color: palette.canvas },
  headerSubtitle: {
    color: palette.muted,
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center",
    marginTop: 1,
    fontFamily: fonts.body,
  },
  headerSubtitleDark: { color: "rgba(255,255,255,0.64)" },
  headerRight: {
    width: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  action: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  actionPill: { minHeight: 52, borderRadius: 26 },
  actionRounded: { minHeight: 48, borderRadius: 8 },
  actionPrimary: { backgroundColor: palette.red },
  actionSecondary: {
    backgroundColor: palette.canvas,
    borderColor: palette.line,
    borderWidth: 1,
  },
  actionDark: { backgroundColor: palette.ink },
  actionDestructive: {
    backgroundColor: palette.dangerWash,
    borderColor: "#FFD0D0",
    borderWidth: 1,
  },
  actionContents: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionLabel: { color: palette.ink, fontSize: 13, fontWeight: "800", fontFamily: fonts.body },
  actionLabelInverse: { color: palette.canvas },
  actionLabelDanger: { color: palette.red },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.985 }] },
  chip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 15,
    borderRadius: 6,
    backgroundColor: palette.wash,
    borderColor: palette.line,
    borderWidth: 1,
  },
  chipSelected: { backgroundColor: palette.ink, borderColor: palette.ink },
  chipText: { color: palette.ink, fontSize: 12, fontWeight: "700", fontFamily: fonts.body },
  chipTextSelected: { color: palette.canvas },
  notice: {
    backgroundColor: palette.wash,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noticeError: { backgroundColor: palette.dangerWash },
  noticeSuccess: { backgroundColor: "#EDF8F1" },
  noticeText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    fontFamily: fonts.body,
  },
})

export default function FlowLayout() {
  const { currentUser } = useRaota()
  const segments = useSegments()
  const section = segments[1]
  const needsAccount = section === "record" || section === "taste"

  if (needsAccount && !currentUser) {
    return <Redirect href="/auth/login" />
  }

  return (
    <Stack
      screenOptions={{ headerShown: false, animation: "slide_from_right" }}
    >
      <Stack.Screen
        name="record/select-shop"
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
          gestureEnabled: true,
        }}
      />
    </Stack>
  )
}
