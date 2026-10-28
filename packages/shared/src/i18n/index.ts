import { coreMessages } from "./core"
import { mobileFlowMessages } from "./mobile-flows"
import { mobileSurfaceMessages } from "./mobile-surfaces"
import { webMessages } from "./web"

export const SUPPORTED_LOCALES = ["ko", "en", "zh", "ja"] as const
export type AppLocale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: AppLocale = "ko"

const intlLocales: Record<AppLocale, string> = { ko: "ko-KR", en: "en-US", zh: "zh-CN", ja: "ja-JP" }
export const translationCatalog: Record<string, readonly [string, string, string]> = {
  ...webMessages,
  ...mobileFlowMessages,
  ...mobileSurfaceMessages,
  ...coreMessages,
}

/** Match BCP-47 language tags in preference order. Chinese uses Simplified Chinese copy. */
export function resolveLocale(preferences: readonly (string | null | undefined)[]): AppLocale {
  for (const preference of preferences) {
    const language = preference?.trim().toLowerCase().replace(/_/g, "-").split("-")[0]
    if (SUPPORTED_LOCALES.includes(language as AppLocale)) return language as AppLocale
  }
  return DEFAULT_LOCALE
}

let currentLocale: AppLocale = DEFAULT_LOCALE
const listeners = new Set<() => void>()
export const getLocale = (): AppLocale => currentLocale
export const getIntlLocale = (locale: AppLocale = currentLocale): string => intlLocales[locale]

export function setLocale(locale: AppLocale): void {
  if (!SUPPORTED_LOCALES.includes(locale) || locale === currentLocale) return
  currentLocale = locale
  listeners.forEach((listener) => listener())
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export type TranslationParams = Readonly<Record<string, string | number>>

/** Only app-authored copy is passed here. Persisted enums and user content stay unchanged. */
export function t(source: string, params: TranslationParams = {}, locale: AppLocale = currentLocale): string {
  const index = { en: 0, zh: 1, ja: 2 }[locale as "en" | "zh" | "ja"]
  const message = locale === "ko" ? source : (translationCatalog[source]?.[index] ?? source)
  return message.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : placeholder,
  )
}

function dateValue(value: Date | string | number): Date {
  if (value instanceof Date) return value
  if (typeof value === "string") {
    // Parse stored date-only values locally, avoiding a UTC date shifting to the previous day.
    const parts = value.match(/^(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})\.?$/)
    if (parts) return new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]), 12)
  }
  return new Date(value)
}

export function formatDate(value: Date | string | number, options?: Intl.DateTimeFormatOptions): string {
  const date = dateValue(value)
  if (!Number.isFinite(date.getTime())) return String(value)
  return new Intl.DateTimeFormat(getIntlLocale(), options).format(date)
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(getIntlLocale(), options).format(value)
}
