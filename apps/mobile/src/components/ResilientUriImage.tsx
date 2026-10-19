import { Image, type ImageProps } from "expo-image"
import { ImageIcon } from "lucide-react-native"
import { useEffect, useLayoutEffect, useState, type ReactNode } from "react"
import {
  StyleSheet,
  View,
  type ColorValue,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated"

import { colors, usePalette } from "../theme"

type ImageStatus = "empty" | "loading" | "loaded" | "error"
const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1)

export interface ResilientUriImageProps {
  uri?: string | null
  accessibilityLabel: string
  style?: StyleProp<ViewStyle>
  contentFit?: ImageProps["contentFit"]
  transition?: ImageProps["transition"]
  fallback?: ReactNode
  fallbackBackgroundColor?: ColorValue
  fallbackTintColor?: ColorValue
}

export function ResilientUriImage({
  uri,
  accessibilityLabel,
  style,
  contentFit = "cover",
  transition = 0,
  fallback,
  fallbackBackgroundColor = colors.canvasSoft,
  fallbackTintColor = colors.textMuted,
}: ResilientUriImageProps) {
  const normalizedUri = uri?.trim() ?? ""
  const [loadState, setLoadState] = useState<{ uri: string; status: ImageStatus }>({
    uri: normalizedUri,
    status: normalizedUri ? "loading" : "empty",
  })
  const status = loadState.uri === normalizedUri ? loadState.status : normalizedUri ? "loading" : "empty"
  const [frameWidth, setFrameWidth] = useState(0)
  const reducedMotion = useReducedMotion()
  const palette = usePalette()
  const imageOpacity = useSharedValue(reducedMotion ? 1 : 0)
  const sheenProgress = useSharedValue(0)
  const bandWidth = Math.min(180, Math.max(64, frameWidth * 0.55))

  useLayoutEffect(() => {
    imageOpacity.value = 0
  }, [imageOpacity, normalizedUri])

  useEffect(() => {
    if (status === "loading" && frameWidth > 0 && !reducedMotion) {
      sheenProgress.value = 0
      sheenProgress.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.linear }), -1, false)
    } else {
      cancelAnimation(sheenProgress)
    }
    return () => cancelAnimation(sheenProgress)
  }, [frameWidth, reducedMotion, sheenProgress, status])

  const imageStyle = useAnimatedStyle(() => ({ opacity: imageOpacity.value }))
  const sheenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -bandWidth + (frameWidth + bandWidth) * sheenProgress.value }],
  }))

  const unavailable = status === "empty" || status === "error"
  const stateLabel = unavailable
    ? `${accessibilityLabel}. 이미지를 불러올 수 없습니다.`
    : accessibilityLabel

  return (
    <View
      accessibilityLabel={stateLabel}
      accessibilityRole="image"
      accessibilityState={{ busy: status === "loading" }}
      style={[styles.container, style]}
      onLayout={({ nativeEvent }) => {
        const width = nativeEvent.layout.width
        setFrameWidth((previous) => previous === width ? previous : width)
      }}
    >
      {normalizedUri && !unavailable ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, imageStyle]}>
          <Image
            accessibilityIgnoresInvertColors
            accessible={false}
            contentFit={contentFit}
            onError={() => {
              imageOpacity.value = 0
              setLoadState({ uri: normalizedUri, status: "error" })
            }}
            onLoad={() => {
              setLoadState({ uri: normalizedUri, status: "loaded" })
              imageOpacity.value = reducedMotion ? 1 : withTiming(1, { duration: 300, easing: EASE_OUT })
            }}
            onLoadStart={() => {
              imageOpacity.value = 0
              setLoadState({ uri: normalizedUri, status: "loading" })
            }}
            source={{ uri: normalizedUri }}
            style={StyleSheet.absoluteFill}
            transition={reducedMotion ? 0 : transition}
          />
        </Animated.View>
      ) : null}
      {status === "loading" && frameWidth > 0 && !reducedMotion ? (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <Animated.View style={[styles.sheen, { width: bandWidth, opacity: palette.ink === palette.white ? 0.24 : 1 }, sheenStyle]}>
            <View style={[styles.sheenStripe, styles.sheenEdge]} />
            <View style={[styles.sheenStripe, styles.sheenShoulder]} />
            <View style={[styles.sheenStripe, styles.sheenCenter]} />
            <View style={[styles.sheenStripe, styles.sheenShoulder]} />
            <View style={[styles.sheenStripe, styles.sheenEdge]} />
          </Animated.View>
        </View>
      ) : null}

      {unavailable ? (
        <View
          pointerEvents="none"
          style={[
            styles.fallback,
            { backgroundColor: fallbackBackgroundColor },
          ]}
        >
          {fallback ?? <ImageIcon color={fallbackTintColor} size={20} />}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  // 자리표시는 옅은 면만 둔다. 테두리·모서리는 사진을 놓는 화면이 정한다
  container: {
    backgroundColor: colors.canvasSoft,
    overflow: "hidden",
    position: "relative",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
  },
  sheen: {
    height: "100%",
    flexDirection: "row",
  },
  sheenStripe: { flex: 1, backgroundColor: colors.white },
  sheenEdge: { opacity: 0.08 },
  sheenShoulder: { opacity: 0.28 },
  sheenCenter: { opacity: 0.6 },
  fallback: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
})
