import { Image } from "expo-image"
import { X } from "lucide-react-native"
import { useEffect, useRef, useState } from "react"
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native"
import Animated, { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { colors, radii, spacing, touchTarget } from "../theme"
import { AppText } from "./ui"
/** 아래로 이만큼 끌었다 놓으면 닫는다 */
const DISMISS_PULL = 90
const DOUBLE_TAP_MS = 260
const MAX_ZOOM = 4

const PHOTO_EASE = Easing.bezier(0.22, 1, 0.36, 1)
const PHOTO_DURATION = 420
/** 사진 크기를 아직 모를 때 쓰는 비율(앱의 사진 대부분이 4:3) */
const FALLBACK_ASPECT = 4 / 3
/** 사진이 그려졌다는 신호가 늦어도 이 시간 뒤에는 연다 */
const DISPLAY_TIMEOUT = 160

export interface PhotoViewerProps {
  photos: string[]
  /** 열 때 보여 줄 사진. null이면 닫혀 있다 */
  index: number | null
  /** 누른 사진의 화면 좌표. 없으면 페이드로 연다 */
  origin?: { x: number; y: number; width: number; height: number } | null
  originRadius?: number
  label: string
  onClose: () => void
}

/**
 * 사진을 눌렀을 때 화면 가득 보는 창. 옆으로 넘기고, 두 손가락이나 두 번 톡으로 확대하고,
 * 아래로 끌어 내리거나 닫기 버튼으로 닫는다. 사진을 보는 자리라 바탕은 모드와 상관없이 검정이다.
 *
 * 누른 자리에서 커지는 전환은 사진 한 장(cover)의 틀만 원래 자리 → 화면 가득(contain 크기)으로 옮긴다.
 * 끝 틀의 비율이 사진 비율과 같아서 cover가 곧 contain이 되므로, 사진 두 장을 겹쳐 바꾸지 않아도 된다.
 * 끊김을 줄이려고 (1) 사진이 그려진 뒤에 출발하고 (2) 넘겨 보기 목록은 전환이 끝난 뒤에 붙인다.
 */
export function PhotoViewer({ photos, index, label, onClose, origin, originRadius = radii.sm }: PhotoViewerProps) {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const reducedMotion = useReducedMotion()
  const [current, setCurrent] = useState(index ?? 0)
  const [zoomed, setZoomed] = useState(false)
  /** opening: 전환 중 · open: 넘겨 보기 가능 · closing: 닫는 중 */
  const [phase, setPhase] = useState<"opening" | "open" | "closing">("opening")
  const [aspect, setAspect] = useState(FALLBACK_ASPECT)
  const started = useRef(false)
  const progress = useSharedValue(0)
  const fade = useSharedValue(1)
  /** 전환용 사진 층과 넘겨 보기 목록 중 무엇을 보일지. 둘을 잠깐 겹쳐 두어 바뀌는 순간 깜빡이지 않게 한다 */
  const layerOn = useSharedValue(1)
  const pagerOn = useSharedValue(hasOriginInitial(origin, reducedMotion) ? 0 : 1)
  const visible = index !== null
  const hasOrigin = !!origin && origin.width > 0 && origin.height > 0 && !reducedMotion

  // 끝 틀: 화면 폭에 맞춘 contain 크기, 세로 가운데
  const fitWidth = Math.min(width, height * aspect)
  const fitHeight = fitWidth / aspect
  const from = { x: origin?.x ?? 0, y: origin?.y ?? 0, w: origin?.width ?? width, h: origin?.height ?? height }
  const to = { x: (width - fitWidth) / 2, y: (height - fitHeight) / 2, w: fitWidth, h: fitHeight }

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value * fade.value }))
  const layerStyle = useAnimatedStyle(() => {
    const t = progress.value
    return {
      opacity: fade.value * layerOn.value,
      left: from.x + (to.x - from.x) * t,
      top: from.y + (to.y - from.y) * t,
      width: from.w + (to.w - from.w) * t,
      height: from.h + (to.h - from.h) * t,
      borderRadius: originRadius * (1 - t),
    }
  }, [from.x, from.y, from.w, from.h, to.x, to.y, to.w, to.h, originRadius])
  const pagerStyle = useAnimatedStyle(() => ({ opacity: fade.value * pagerOn.value }))
  const controlsStyle = useAnimatedStyle(() => ({ opacity: phase === "open" ? withTiming(1, { duration: 160 }) : withTiming(0, { duration: 100 }) }), [phase])

  const finishOpen = () => {
    // 목록을 먼저 보이게 붙이고, 그 사진이 그려질 틈을 준 뒤 위의 전환 층을 걷는다
    pagerOn.value = 1
    setPhase("open")
    setTimeout(() => {
      layerOn.value = 0
    }, 140)
  }
  const start = () => {
    if (started.current) return
    started.current = true
    if (reducedMotion || !hasOrigin) {
      progress.value = reducedMotion ? 1 : withTiming(1, { duration: 200, easing: PHOTO_EASE })
      setPhase("open")
      return
    }
    progress.value = withTiming(1, { duration: PHOTO_DURATION, easing: PHOTO_EASE }, (finished) => {
      if (finished) runOnJS(finishOpen)()
    })
  }

  // 사진이 그려졌다는 신호(onDisplay)가 안 오더라도 잠깐 뒤에는 연다
  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(start, DISPLAY_TIMEOUT)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const dismiss = () => {
    if (phase === "closing") return
    setPhase("closing")
    if (reducedMotion) {
      onClose()
      return
    }
    if (hasOrigin && current === index && !zoomed) {
      // 보고 있던 사진을 전환 층으로 바꿔 쥐고 원래 자리로 줄인다
      layerOn.value = 1
      pagerOn.value = 0
      progress.value = withTiming(0, { duration: PHOTO_DURATION - 60, easing: PHOTO_EASE }, (finished) => {
        if (finished) runOnJS(onClose)()
      })
    } else {
      fade.value = withTiming(0, { duration: 200, easing: PHOTO_EASE }, (finished) => {
        if (finished) runOnJS(onClose)()
      })
    }
  }
  const onPageEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setCurrent(Math.round(event.nativeEvent.contentOffset.x / Math.max(1, width)))
  }

  // 목록은 전환이 끝난 뒤에 붙인다(전환 중에 큰 사진 여러 장을 같이 그리면 끊긴다)
  const showPager = phase !== "opening" || !hasOrigin

  return (
    <Modal animationType="none" onRequestClose={dismiss} statusBarTranslucent transparent visible={visible}>
      <StatusBar barStyle="light-content" />
      <View accessibilityLabel={`${label} 크게 보기`} accessibilityViewIsModal style={styles.root}>
        <Animated.View pointerEvents="none" style={[styles.backdrop, backdropStyle]} />
        {visible && showPager ? (
          <Animated.View style={[styles.pager, pagerStyle]}>
            <FlatList
              data={photos}
              getItemLayout={(_, itemIndex) => ({ length: width, offset: width * itemIndex, index: itemIndex })}
              horizontal
              initialScrollIndex={Math.min(current, Math.max(0, photos.length - 1))}
              keyExtractor={(uri, itemIndex) => `${uri}-${itemIndex}`}
              onMomentumScrollEnd={onPageEnd}
              pagingEnabled
              renderItem={({ item, index: itemIndex }) => (
                <ZoomablePhoto
                  height={height}
                  label={`${label} ${itemIndex + 1}`}
                  onClose={dismiss}
                  onZoomChange={setZoomed}
                  uri={item}
                  width={width}
                />
              )}
              scrollEnabled={phase === "open" && !zoomed && photos.length > 1}
              showsHorizontalScrollIndicator={false}
            />
          </Animated.View>
        ) : null}
        {hasOrigin ? (
          <Animated.View pointerEvents="none" style={[styles.layer, layerStyle]}>
            <Image
              cachePolicy="memory-disk"
              contentFit="cover"
              onDisplay={start}
              onLoad={({ source }) => {
                if (source.width > 0 && source.height > 0) setAspect(source.width / source.height)
              }}
              priority="high"
              source={{ uri: photos[index ?? 0] }}
              style={StyleSheet.absoluteFill}
              transition={0}
            />
          </Animated.View>
        ) : null}
        <Animated.View pointerEvents={phase === "open" ? "box-none" : "none"} style={[styles.top, { paddingTop: insets.top + spacing.x2 }, controlsStyle]}>
          <Pressable accessibilityLabel="닫기" accessibilityRole="button" hitSlop={8} onPress={dismiss} style={styles.close}>
            <X color={colors.white} size={22} />
          </Pressable>
          {photos.length > 1 ? (
            <AppText capScale style={styles.count} variant="meta">{`${current + 1} / ${photos.length}`}</AppText>
          ) : null}
          <View style={styles.spacer} />
        </Animated.View>
      </View>
    </Modal>
  )
}

function hasOriginInitial(origin: PhotoViewerProps["origin"], reducedMotion: boolean) {
  return !!origin && origin.width > 0 && origin.height > 0 && !reducedMotion
}

function ZoomablePhoto({
  uri,
  label,
  width,
  height,
  onClose,
  onZoomChange,
}: {
  uri: string
  label: string
  width: number
  height: number
  onClose: () => void
  onZoomChange: (zoomed: boolean) => void
}) {
  const scrollRef = useRef<ScrollView>(null)
  const lastTap = useRef(0)
  const zoomScale = useRef(1)

  // 두 번 톡: 확대돼 있으면 원래대로, 아니면 누른 자리를 2.5배로
  const onTap = (x: number, y: number) => {
    const now = Date.now()
    if (now - lastTap.current > DOUBLE_TAP_MS) {
      lastTap.current = now
      return
    }
    lastTap.current = 0
    const responder = scrollRef.current?.getScrollResponder() as unknown as
      | { scrollResponderZoomTo?: (rect: { x: number; y: number; width: number; height: number; animated?: boolean }) => void }
      | undefined
    if (zoomScale.current > 1.01) {
      responder?.scrollResponderZoomTo?.({ x: 0, y: 0, width, height, animated: true })
    } else {
      const w = width / 2.5
      const h = height / 2.5
      responder?.scrollResponderZoomTo?.({ x: x - w / 2, y: y - h / 2, width: w, height: h, animated: true })
    }
  }

  return (
    <ScrollView
      alwaysBounceVertical
      bouncesZoom
      centerContent
      maximumZoomScale={MAX_ZOOM}
      minimumZoomScale={1}
      onScroll={({ nativeEvent }) => {
        const scale = nativeEvent.zoomScale ?? 1
        if ((scale > 1.01) !== (zoomScale.current > 1.01)) onZoomChange(scale > 1.01)
        zoomScale.current = scale
      }}
      onScrollEndDrag={({ nativeEvent }) => {
        if (zoomScale.current <= 1.01 && nativeEvent.contentOffset.y < -DISMISS_PULL) onClose()
      }}
      ref={scrollRef}
      scrollEventThrottle={16}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      style={{ width, height }}
    >
      <Pressable accessibilityLabel={label} accessibilityRole="image" onPress={({ nativeEvent }) => onTap(nativeEvent.locationX, nativeEvent.locationY)}>
        <Image contentFit="contain" source={{ uri }} style={{ width, height }} transition={120} />
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.black },
  pager: { ...StyleSheet.absoluteFill },
  // 바탕은 비워 둔다. 사진이 그려지기 전 한 프레임 동안 원래 자리에 검은 칸이 번쩍이지 않게, 그 틈엔 원래 화면이 비친다
  layer: { position: "absolute", overflow: "hidden" },
  top: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.x4,
  },
  close: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.onDarkLine,
  },
  spacer: { width: touchTarget },
  count: { color: colors.white, fontWeight: "700" },
})
