import * as ImagePicker from "expo-image-picker"
import * as Location from "expo-location"
import * as Notifications from "expo-notifications"
import { useCallback, useEffect, useState } from "react"
import { AppState, Platform } from "react-native"

/*
 * 설정 > 권한(사용자 결정 2026.11.01). 위치·카메라·사진·알림이 지금 어떤 상태인지 읽는다.
 * iOS 권한창은 앱마다 한 번뿐이라, 한 번 답한 권한은 앱이 다시 켜고 끌 수 없다. 그래서 설정 화면은
 * 묻기 전이면 그 자리에서 묻고, 그 밖에는 설정 앱의 RAOTA 화면을 연다.
 */

export type PermissionKind = "location" | "camera" | "photos" | "notifications"
/** limited는 사진에서 "선택한 사진만" 허용한 상태 */
export type PermissionState = "granted" | "limited" | "denied" | "undetermined"
/** 읽지 못한 권한(웹, 모듈 오류)은 null로 두고 상태 없이 보여 준다 */
export type PermissionSnapshot = Record<PermissionKind, PermissionState | null>

export const PERMISSION_KINDS: PermissionKind[] = ["location", "camera", "photos", "notifications"]

const EMPTY: PermissionSnapshot = { location: null, camera: null, photos: null, notifications: null }

function stateOf(status: string, granted: boolean): PermissionState {
  if (granted) return "granted"
  return status === "undetermined" ? "undetermined" : "denied"
}

async function readOne(kind: PermissionKind): Promise<PermissionState | null> {
  try {
    if (kind === "location") {
      const permission = await Location.getForegroundPermissionsAsync()
      return stateOf(permission.status, permission.granted)
    }
    if (kind === "camera") {
      const permission = await ImagePicker.getCameraPermissionsAsync()
      return stateOf(permission.status, permission.granted)
    }
    if (kind === "photos") {
      const permission = await ImagePicker.getMediaLibraryPermissionsAsync()
      if (permission.granted && permission.accessPrivileges === "limited") return "limited"
      return stateOf(permission.status, permission.granted)
    }
    const permission = await Notifications.getPermissionsAsync()
    // 임시 허용(provisional)도 알림이 오므로 허용으로 친다(src/notifications/reminders.ts와 같은 기준)
    const granted = permission.granted || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    return stateOf(permission.status, granted)
  } catch {
    return null
  }
}

export async function readPermissions(): Promise<PermissionSnapshot> {
  if (Platform.OS === "web") return EMPTY
  const [location, camera, photos, notifications] = await Promise.all(PERMISSION_KINDS.map(readOne))
  return { location, camera, photos, notifications }
}

/** 위치·카메라·사진 권한창을 띄운다. 알림은 리마인더 예약과 묶여 있어 설정 화면의 스위치 쪽 흐름을 쓴다 */
export async function requestPermission(kind: Exclude<PermissionKind, "notifications">) {
  try {
    if (kind === "location") await Location.requestForegroundPermissionsAsync()
    else if (kind === "camera") await ImagePicker.requestCameraPermissionsAsync()
    else await ImagePicker.requestMediaLibraryPermissionsAsync()
  } catch {
    // 권한창을 띄우지 못해도 상태를 다시 읽어 그대로 보여 준다
  }
}

/** 화면을 열 때와 설정 앱에서 돌아올 때(앱이 다시 active) 다시 읽는다 */
export function usePermissions() {
  const [snapshot, setSnapshot] = useState<PermissionSnapshot>(EMPTY)
  const refresh = useCallback(async () => {
    setSnapshot(await readPermissions())
  }, [])

  useEffect(() => {
    let active = true
    const load = () => void readPermissions().then((next) => active && setSnapshot(next))
    load()
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") load()
    })
    return () => {
      active = false
      subscription.remove()
    }
  }, [])

  return { snapshot, refresh }
}
