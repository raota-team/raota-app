import { i18n, type MessageDescriptor } from "@lingui/core"
import { messages as enMessages } from "./locales/en/messages"
import { messages as esMessages } from "./locales/es/messages"
import { messages as jaMessages } from "./locales/ja/messages"
import { messages as koMessages } from "./locales/ko/messages"
import { messages as zhMessages } from "./locales/zh/messages"

export const SUPPORTED_LOCALES = ["ko", "en", "zh", "ja", "es"] as const
export type AppLocale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: AppLocale = "ko"

const intlLocales: Record<AppLocale, string> = { ko: "ko-KR", en: "en-US", zh: "zh-CN", ja: "ja-JP", es: "es-ES" }

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

// 다섯 언어 번역을 한 번에 싣는다(작아서 나눠 받을 이유가 없다). 매크로(t``, msg``)가 이 i18n으로 옮긴다
i18n.load({ ko: koMessages, en: enMessages, zh: zhMessages, ja: jaMessages, es: esMessages })
i18n.activate(DEFAULT_LOCALE)

export function setLocale(locale: AppLocale): void {
  if (!SUPPORTED_LOCALES.includes(locale) || locale === currentLocale) return
  currentLocale = locale
  i18n.activate(locale)
  listeners.forEach((listener) => listener())
}

/**
 * 값마다 다른 표시 이름(라멘 종류, 맛 태그, 선택지 …)은 msg``로 만든 설명자를 여기에 넘긴다.
 * 문자열을 받지 않는다: 런타임 문자열로 번역을 찾으면 추출되지 않아 번역이 빠진다
 */
export function translate(descriptor: MessageDescriptor): string {
  return i18n._(descriptor)
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
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

const LIST_SEPARATORS: Record<AppLocale, string> = { ko: ", ", en: ", ", zh: "、", ja: "、", es: ", " }

/**
 * 여러 항목을 그 언어의 목록으로 잇는다. 한국어는 앱이 원래 쓰던 대로 쉼표로만 잇는다("A, B 및 C"로 바꾸지 않는다).
 * 다른 언어는 Intl.ListFormat(없는 엔진이면 언어별 구분자)으로 잇는다
 */
export function formatList(items: readonly string[]): string {
  const ListFormat = (Intl as { ListFormat?: new (locale: string, options: { type: string }) => { format(list: readonly string[]): string } }).ListFormat
  if (currentLocale !== "ko" && ListFormat) return new ListFormat(getIntlLocale(), { type: "conjunction" }).format(items)
  return items.join(LIST_SEPARATORS[currentLocale])
}

export { labelOf } from "./labels"
