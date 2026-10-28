import { act, renderHook } from "@testing-library/react-native"
import { getLocales, useLocales } from "expo-localization"
import {
  DEFAULT_LOCALE,
  EMPTY_PROFILE,
  formatDate,
  formatNumber,
  getIntlLocale,
  getLocale,
  getRamenActivityLevel,
  resolveLocale,
  setLocale,
  subscribeLocale,
  t,
  tasteIdentity,
  translationCatalog,
} from "@raota/shared"
import { ApiClient, ApiError } from "@/src/api/client"
import { createMemoryTokenStore } from "@/src/api/tokens"
import { useDeviceLocale, useLocale } from "@/src/i18n"
import { validateNickname } from "@/src/domain/nickname"

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
    expect(t("홈")).not.toBe("홈")
    expect(t("{scope} 0그릇", { scope: "TEST" })).toContain("TEST")
    expect(t("{scope} 0그릇", { scope: "TEST" })).not.toContain("{scope}")
    expect(t(getRamenActivityLevel(10).title)).not.toMatch(/[가-힣]/)
    expect(tasteIdentity({}, EMPTY_PROFILE).description).not.toMatch(/[가-힣]/)
    expect(validateNickname("!").error).not.toMatch(/[가-힣]/)
  })

  it("keeps Korean copy and unknown source content intact", () => {
    expect(t("{count}그릇", { count: 3 })).toBe("3그릇")
    setLocale("en")
    expect(t("손님이 쓴 가게 후기")).toBe("손님이 쓴 가게 후기")
    expect(t("아직 없는 번역 {name}", { name: "$&" })).toBe("아직 없는 번역 $&")
  })

  it("keeps all catalog translations complete and preserves interpolation parameters", () => {
    const placeholders = (value: string) => [...new Set(value.match(/\{\w+\}/g) ?? [])].sort()
    const invalid: string[] = []
    for (const [source, translations] of Object.entries(translationCatalog)) {
      if (translations.length !== 4) invalid.push(`${source}: missing language`)
      translations.forEach((value, index) => {
        if (!value.trim() || JSON.stringify(placeholders(value)) !== JSON.stringify(placeholders(source))) {
          invalid.push(`${source} [${index}]: ${value}`)
        }
      })
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
  await expect(client.get("/shops", { auth: "none" })).rejects.toMatchObject({ message: t("네트워크 연결을 확인해 주세요.") })
})
