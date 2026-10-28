/// <reference types="node" />
import { act, renderHook } from "@testing-library/react-native"
import { ph, t } from "@lingui/core/macro"
import { getLocales, useLocales } from "expo-localization"
import { readFileSync } from "node:fs"
import path from "node:path"
import {
  DEFAULT_LOCALE,
  EMPTY_PROFILE,
  formatDate,
  formatNumber,
  getIntlLocale,
  getLocale,
  getRamenActivityLevel,
  labelOf,
  resolveLocale,
  setLocale,
  subscribeLocale,
  tasteIdentity,
} from "@raota/shared"
import { ApiClient, ApiError } from "@/src/api/client"
import { createMemoryTokenStore } from "@/src/api/tokens"
import { useDeviceLocale, useLocale } from "@/src/i18n"
import { validateNickname } from "@/src/domain/nickname"

/** PO 파일을 msgid → msgstr로 읽는다(여러 줄로 이어진 문자열 포함) */
function readCatalog(locale: string): Map<string, string> {
  const file = path.resolve(__dirname, `../../../packages/shared/src/i18n/locales/${locale}/messages.po`)
  const entries = new Map<string, string>()
  let field: "msgid" | "msgstr" | null = null
  let id = ""
  let str = ""
  const flush = () => {
    if (id) entries.set(id, str)
    id = ""
    str = ""
  }
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const start = line.match(/^(msgid|msgstr) (".*")$/)
    if (start) {
      if (start[1] === "msgid") flush()
      field = start[1] as "msgid" | "msgstr"
      const value = JSON.parse(start[2]) as string
      if (field === "msgid") id = value
      else str = value
    } else if (line.startsWith("\"") && field) {
      const value = JSON.parse(line) as string
      if (field === "msgid") id += value
      else str += value
    } else if (!line.trim()) {
      field = null
    }
  }
  flush()
  return entries
}

afterEach(() => {
  setLocale(DEFAULT_LOCALE)
  const korean = [{ languageTag: "ko-KR", languageCode: "ko" }]
  jest.mocked(getLocales).mockReturnValue(korean as ReturnType<typeof getLocales>)
  jest.mocked(useLocales).mockReturnValue(korean as ReturnType<typeof useLocales>)
})

describe("language preferences", () => {
  test.each([
    [["es-ES"], "es"], [["es_MX"], "es"], [["es-AR"], "es"],
    [["fr-FR", "es-419", "en-US"], "es"],
    [["en-US"], "en"], [["en-GB"], "en"], [["ja-JP"], "ja"],
    [["zh-Hans-CN"], "zh"], [["zh-TW"], "zh"], [["KO_kr"], "ko"],
    [["fr-FR", "ja-JP", "en"], "ja"], [["de-DE"], "ko"], [[], "ko"],
  ])("negotiates %j as %s", (preferences, expected) => {
    expect(resolveLocale(preferences as string[])).toBe(expected)
  })

  it("notifies only when the effective locale changes, and unsubscribes", () => {
    const listener = jest.fn()
    const unsubscribe = subscribeLocale(listener)
    setLocale("ja")
    setLocale("ja")
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    setLocale("en")
    expect(listener).toHaveBeenCalledTimes(1)
  })

  test.each(["ja", "es"] as const)("updates mounted screens when the OS app language changes to %s", async (language) => {
    const { result, rerender } = await renderHook(() => {
      useDeviceLocale()
      return useLocale()
    })
    expect(result.current).toBe("ko")
    const deviceLocale = [{ languageTag: getIntlLocale(language), languageCode: language }]
    jest.mocked(getLocales).mockReturnValue(deviceLocale as ReturnType<typeof getLocales>)
    jest.mocked(useLocales).mockReturnValue(deviceLocale as ReturnType<typeof useLocales>)
    await act(async () => { await rerender({}) })
    expect(result.current).toBe(language)
  })
})

describe("app copy", () => {
  test.each(["en", "zh", "ja", "es"] as const)("translates navigation and interpolated copy in %s", (locale) => {
    setLocale(locale)
    expect(t`홈`).not.toBe("홈")
    expect(t`${ph({ scope: "TEST" })} 0그릇`).toContain("TEST")
    expect(t`${ph({ scope: "TEST" })} 0그릇`).not.toContain("{scope}")
    expect(labelOf(getRamenActivityLevel(10).title)).not.toMatch(/[가-힣]/)
    expect(labelOf("탄탄멘")).not.toMatch(/[가-힣]/)
    expect(tasteIdentity({}, EMPTY_PROFILE).description).not.toMatch(/[가-힣]/)
    expect(validateNickname("!").error).not.toMatch(/[가-힣]/)
  })

  it("keeps Korean copy and leaves unknown stored values as written", () => {
    const count = 3
    expect(t`${count}그릇`).toBe("3그릇")
    setLocale("en")
    expect(labelOf("손님이 쓴 가게 후기")).toBe("손님이 쓴 가게 후기")
  })

  it("has a translation for every extracted message, keeping the same placeholders", () => {
    // {이름} 또는 {이름, plural|select …}의 이름만 센다(갈래 안의 글자는 세지 않는다)
    const placeholders = (value: string) => [...new Set([...value.matchAll(/\{\s*(\w+)\s*[,}]/g)].map((match) => match[1]))].sort()
    // ICU에서 ' 바로 뒤의 {는 글자로 읽혀 값이 들어가지 않는다. 따옴표를 보이려면 ''로 써야 한다
    const quotedPlaceholder = /(^|[^'])'\{/
    const source = readCatalog("ko")
    const invalid: string[] = []
    for (const message of source.keys()) if (quotedPlaceholder.test(message)) invalid.push(`ko: ${message}`)
    for (const locale of ["en", "zh", "ja", "es"]) {
      const catalog = readCatalog(locale)
      for (const message of source.keys()) {
        const translation = catalog.get(message)
        if (!translation?.trim()) invalid.push(`${locale}: missing ${message}`)
        // 한국어에만 있는 조사 선택(select)은 다른 언어에서 뺄 수 있다. 그 밖의 자리표시자는 같아야 한다
        else if (placeholders(translation).some((name) => !placeholders(message).includes(name))) invalid.push(`${locale}: ${message} → ${translation}`)
        else if (quotedPlaceholder.test(translation)) invalid.push(`${locale}: ${translation}`)
      }
    }
    expect(invalid).toEqual([])
  })

  it("formats stored dates and numbers with the active locale without changing currencies", () => {
    setLocale("en")
    expect(formatDate("2026-10-28", { month: "long", day: "numeric", year: "numeric" })).toBe("October 28, 2026")
    expect(formatDate("2026. 10. 28")).toBe(formatDate("2026-10-28"))
    expect(formatDate("not a date")).toBe("not a date")
    expect(formatNumber(12000, { style: "currency", currency: "KRW", maximumFractionDigits: 0 })).toBe("₩12,000")
    setLocale("ja")
    expect(getIntlLocale()).toBe("ja-JP")
    expect(formatDate("2026-10-28", { month: "long" })).toBe("10月")
    setLocale("es")
    expect(getIntlLocale()).toBe("es-ES")
    expect(formatDate("2026-10-28", { month: "long", day: "numeric", year: "numeric" })).toBe("28 de octubre de 2026")
    expect(formatNumber(12345.6)).toBe("12.345,6")
  })
})

it("sends the current app language on each API request, leaving the response content intact", async () => {
  const fetchMock = jest.fn(async () => ({
    ok: true, status: 200,
    headers: { get: () => null },
    text: async () => JSON.stringify({ success: true, data: { description: "가게 소개 원문" } }),
  }))
  const client = new ApiClient({ baseUrl: "https://api.test/api/v2", tokens: createMemoryTokenStore(), fetch: fetchMock as never })
  setLocale("ja")
  const result = await client.get<{ description: string }>("/shops", { auth: "none" })
  expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].headers).toEqual(expect.objectContaining({ "Accept-Language": "ja-JP" }))
  expect(result.description).toBe("가게 소개 원문")
  setLocale("en")
  await client.get("/shops", { auth: "none" })
  expect((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].headers).toEqual(expect.objectContaining({ "Accept-Language": "en-US" }))
  setLocale("es")
  await client.get("/shops", { auth: "none" })
  expect((fetchMock.mock.calls[2] as unknown as [string, RequestInit])[1].headers).toEqual(expect.objectContaining({ "Accept-Language": "es-ES" }))
})

it("preserves a server error even when its text matches an app translation key", async () => {
  setLocale("en")
  const fetchMock = jest.fn(async () => ({
    ok: false, status: 400,
    headers: { get: () => null },
    text: async () => JSON.stringify({ success: false, error: { code: "VALIDATION_ERROR", message: "좋아요", fields: [] } }),
  }))
  const client = new ApiClient({ baseUrl: "https://api.test/api/v2", tokens: createMemoryTokenStore(), fetch: fetchMock as never })
  await expect(client.get("/shops", { auth: "none" })).rejects.toMatchObject({ message: "좋아요" })
  expect(new ApiError({ status: 400, code: "VALIDATION_ERROR", message: "좋아요" }).message).toBe("좋아요")
})

it("translates an app-authored offline error without changing server messages", async () => {
  setLocale("ja")
  const client = new ApiClient({
    baseUrl: "https://api.test/api/v2", tokens: createMemoryTokenStore(),
    fetch: jest.fn(async () => { throw new TypeError("Network request failed") }) as never,
  })
  await expect(client.get("/shops", { auth: "none" })).rejects.toMatchObject({ message: t`네트워크 연결을 확인해 주세요.` })
})
