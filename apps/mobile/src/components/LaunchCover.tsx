import { useSegments } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { useEffect, useRef, useState } from "react"
import { Animated, Image, StyleSheet, useColorScheme } from "react-native"
import { useReducedMotion } from "react-native-reanimated"

import { onLaunchReady } from "../launch"
import { useRaota } from "../state/RaotaStore"
import { colors } from "../theme"

/** 앱을 켠 뒤 덮개를 최소한 보여 주는 시간. 홈이 이보다 빨리 준비돼도 로고가 깜빡 지나가지 않게 한다 */
const MIN_VISIBLE_MS = 1_000
/** 저장소·로그인을 다 불러온 뒤 홈 데이터를 기다리는 최대 시간. 네트워크가 느려도 이 뒤에는 홈을 연다 */
const HOME_WAIT_MS = 2_000
const FADE_MS = 250
/** app.json의 expo-splash-screen imageWidth와 같아야 네이티브 스플래시에서 덮개로 넘어갈 때 로고가 움직이지 않는다 */
const SPLASH_IMAGE_SIZE = 200

const launchedAt = Date.now()

/**
 * 앱을 켤 때 네이티브 스플래시와 똑같은 화면(로고 + RAOTA.)을 덮어 두고, 그 아래에서 홈을 먼저 그린다.
 * 홈이 위쪽 내용을 다 받으면(또는 HOME_WAIT_MS가 지나면) 걷어 낸다.
 */
export default function LaunchCover() {
  const { isHydrated } = useRaota()
  const segments = useSegments()
  const dark = useColorScheme() === "dark"
  const reduceMotion = useReducedMotion()
  const opacity = useRef(new Animated.Value(1)).current
  const [minShown, setMinShown] = useState(false)
  const [homeReady, setHomeReady] = useState(false)
  const [gaveUp, setGaveUp] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setMinShown(true), Math.max(0, MIN_VISIBLE_MS - (Date.now() - launchedAt)))
    return () => clearTimeout(timer)
  }, [])
  useEffect(() => onLaunchReady(() => setHomeReady(true)), [])
  useEffect(() => {
    if (!isHydrated) return
    const timer = setTimeout(() => setGaveUp(true), HOME_WAIT_MS)
    return () => clearTimeout(timer)
  }, [isHydrated])

  // 알림·딥링크로 홈이 아닌 화면부터 열리면 홈을 기다리지 않는다
  const openedElsewhere = segments[0] === "(flows)"
  const reveal = isHydrated && minShown && (homeReady || openedElsewhere || gaveUp)

  useEffect(() => {
    if (!reveal) return
    if (reduceMotion) {
      setGone(true)
      return
    }
    Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() => setGone(true))
  }, [opacity, reduceMotion, reveal])

  if (gone) return null
  return (
    <Animated.View
      accessibilityLabel="RAOTA 불러오는 중"
      accessible
      pointerEvents={reveal ? "none" : "auto"}
      style={[styles.cover, { opacity }]}
    >
      <Image
        // 로고가 실제로 그려진 뒤에 네이티브 스플래시를 내려야 빈 화면이 한 번 비치지 않는다
        onLoadEnd={() => void SplashScreen.hideAsync()}
        resizeMode="contain"
        source={dark ? require("../../assets/images/splash-dark.png") : require("../../assets/images/splash.png")}
        style={styles.mark}
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  cover: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.canvas,
    zIndex: 1000,
  },
  mark: { width: SPLASH_IMAGE_SIZE, height: SPLASH_IMAGE_SIZE },
})
