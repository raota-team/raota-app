import { Image, type ImageProps } from "expo-image"
import { ImageIcon } from "lucide-react-native"
import { useEffect, useState, type ReactNode } from "react"
import {
  ActivityIndicator,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native"

import { colors } from "../theme"

type ImageStatus = "empty" | "loading" | "loaded" | "error"

export interface ResilientUriImageProps {
  uri?: string | null
  accessibilityLabel: string
  style?: StyleProp<ViewStyle>
  contentFit?: ImageProps["contentFit"]
  transition?: ImageProps["transition"]
  fallback?: ReactNode
  fallbackBackgroundColor?: string
  fallbackTintColor?: string
}

export function ResilientUriImage({
  uri,
  accessibilityLabel,
  style,
  contentFit = "cover",
  transition = 180,
  fallback,
  fallbackBackgroundColor = colors.canvasSoft,
  fallbackTintColor = colors.textMuted,
}: ResilientUriImageProps) {
  const normalizedUri = uri?.trim() ?? ""
  const [status, setStatus] = useState<ImageStatus>(
    normalizedUri ? "loading" : "empty",
  )

  useEffect(() => {
    setStatus(normalizedUri ? "loading" : "empty")
  }, [normalizedUri])

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
    >
      {normalizedUri && !unavailable ? (
        <Image
          accessibilityIgnoresInvertColors
          accessible={false}
          contentFit={contentFit}
          onError={() => setStatus("error")}
          onLoad={() => setStatus("loaded")}
          onLoadStart={() => setStatus("loading")}
          source={{ uri: normalizedUri }}
          style={StyleSheet.absoluteFill}
          transition={transition}
        />
      ) : null}

      {status === "loading" ? (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <ActivityIndicator color={fallbackTintColor} size="small" />
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
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
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
