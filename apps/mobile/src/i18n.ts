import { getLocales, useLocales } from "expo-localization"
import { useEffect, useSyncExternalStore } from "react"
import { AppState, Platform } from "react-native"
import { DEFAULT_LOCALE, getIntlLocale, getLocale, resolveLocale, setLocale, subscribeLocale } from "@raota/shared"

/** Initialize before the router renders, including a cold launch from a notification. */
function syncDeviceLocale() {
  setLocale(resolveLocale(getLocales().map((locale) => locale.languageTag)))
  if (Platform.OS === "web" && typeof document !== "undefined") document.documentElement.lang = getIntlLocale()
}
syncDeviceLocale()

/** Screens subscribe without remounting, preserving navigation and unsaved forms. */
export function useLocale() {
  return useSyncExternalStore(subscribeLocale, getLocale, () => DEFAULT_LOCALE)
}

export function useDeviceLocale() {
  const locales = useLocales()
  useEffect(syncDeviceLocale, [locales])
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") syncDeviceLocale()
    })
    return () => subscription.remove()
  }, [])
}
