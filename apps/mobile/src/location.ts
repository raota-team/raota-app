import * as Location from "expo-location"
import { useEffect, useState } from "react"
import { Platform } from "react-native"

export type Coordinates = { latitude: number; longitude: number }

export interface KnownLocation {
  origin: Coordinates | null
  /** 권한은 있는데 위치를 아직 읽는 중이다. 앱을 막 켜면 몇 초 걸릴 수 있다 */
  pending: boolean
}

/**
 * 위치 권한이 이미 허용돼 있을 때만 지금 위치를 읽는다. 여기서는 권한을 묻지 않는다
 * (권한 요청은 지도 탭에서 맥락과 함께 한다). 권한이 없거나 못 읽으면 origin이 null이다.
 */
export function useKnownLocationState(): KnownLocation {
  const [state, setState] = useState<KnownLocation>({ origin: null, pending: Platform.OS !== "web" })
  useEffect(() => {
    if (Platform.OS === "web") return
    let mounted = true
    ;(async () => {
      let origin: Coordinates | null = null
      try {
        const permission = await Location.getForegroundPermissionsAsync()
        if (permission.status === "granted") {
          const position =
            (await Location.getLastKnownPositionAsync()) ??
            (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }))
          if (position) origin = { latitude: position.coords.latitude, longitude: position.coords.longitude }
        }
      } catch {
        // 위치를 못 읽으면 좌표 없이 보여 준다
      }
      if (mounted) setState({ origin, pending: false })
    })()
    return () => {
      mounted = false
    }
  }, [])
  return state
}

export function useKnownLocation(): Coordinates | null {
  return useKnownLocationState().origin
}
