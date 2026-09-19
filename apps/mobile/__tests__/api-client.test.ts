import {
  ApiClient,
  ApiError,
  buildQuery,
  createIdempotencyKey,
  isApiError,
  parseRetryAfter,
} from "@/src/api/client"
import { createMemoryTokenStore } from "@/src/api/tokens"

/**
 * 클라이언트는 전역 fetch를 호출할 때마다 찾는다. 그래서 테스트는 global.fetch만 바꿔 끼우면 된다.
 */
type FetchCall = { url: string; init: RequestInit }

let fetchMock: jest.Mock

/** 지금까지 나간 요청. mockResolvedValueOnce를 써도 기록이 남도록 mock.calls에서 읽는다 */
function callsMade(): FetchCall[] {
  return fetchMock.mock.calls.map(([url, init]) => ({ url, init }) as FetchCall)
}

function response(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  const status = init.status ?? 200
  const headers = new Map(Object.entries(init.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value]))
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  }
}

function success<T>(data: T, options: { requestId?: string; status?: number; headers?: Record<string, string> } = {}) {
  return response(
    { success: true, data, ...(options.requestId === null ? {} : { meta: { requestId: options.requestId ?? "req-1" } }) },
    { status: options.status ?? 200, headers: options.headers },
  )
}

function failure(
  status: number,
  code: string,
  options: { message?: string; fields?: Array<{ field: string; code: string; message: string }>; headers?: Record<string, string> } = {},
) {
  return response(
    {
      success: false,
      error: { code, message: options.message ?? "실패했어요.", fields: options.fields ?? [] },
      meta: { requestId: "req-err" },
    },
    { status, headers: options.headers },
  )
}

function headerOf(call: FetchCall, name: string): string | undefined {
  return (call.init.headers as Record<string, string>)[name]
}

function createClient(options: Partial<ConstructorParameters<typeof ApiClient>[0]> = {}) {
  return new ApiClient({
    baseUrl: "https://api.test/api/v2",
    tokens: createMemoryTokenStore(),
    // 지터를 끄고 기다리는 시간을 눈으로 확인할 수 있게 한다
    random: () => 0,
    ...options,
  })
}

beforeEach(() => {
  fetchMock = jest.fn(async () => success({ ok: true }))
  ;(globalThis as { fetch: unknown }).fetch = fetchMock
})

describe("buildQuery", () => {
  it("undefined·null은 빼고, 배열은 같은 이름을 여러 번 쓴다", () => {
    expect(
      buildQuery({ sort: "POPULAR", cursor: undefined, region: null, openNow: false, size: 20, ramenType: ["쇼유", "미소"] }),
    ).toBe(`?sort=POPULAR&openNow=false&size=20&ramenType=${encodeURIComponent("쇼유")}&ramenType=${encodeURIComponent("미소")}`)
  })

  it("보낼 값이 없으면 빈 문자열", () => {
    expect(buildQuery({ cursor: null })).toBe("")
    expect(buildQuery()).toBe("")
  })
})

describe("봉투 읽기", () => {
  it("success 봉투에서 data와 requestId를 꺼낸다", async () => {
    const client = createClient()
    fetchMock.mockResolvedValueOnce(success({ items: [1, 2] }, { requestId: "req-42" }))

    const result = await client.send<{ items: number[] }>("/shops", { auth: "none", query: { size: 20 } })

    expect(result.data).toEqual({ items: [1, 2] })
    expect(result.requestId).toBe("req-42")
    expect(callsMade()[0].url).toBe("https://api.test/api/v2/shops?size=20")
  })

  it("204에는 본문이 없고 requestId는 헤더에서 읽는다", async () => {
    const client = createClient()
    fetchMock.mockResolvedValueOnce(response(undefined, { status: 204, headers: { "X-Request-Id": "req-204" } }))

    const result = await client.send<void>("/shops/1/bookmark", { method: "DELETE", auth: "none" })

    expect(result.status).toBe(204)
    expect(result.data).toBeUndefined()
    expect(result.requestId).toBe("req-204")
  })

  it("토큰과 본문 헤더를 붙인다", async () => {
    const client = createClient({ tokens: createMemoryTokenStore({ accessToken: "a1", refreshToken: "r1" }) })

    await client.post("/ramen-logs", { menuName: "쇼유" }, { idempotencyKey: "key-1" })

    expect(headerOf(callsMade()[0], "Authorization")).toBe("Bearer a1")
    expect(headerOf(callsMade()[0], "Content-Type")).toBe("application/json")
    expect(headerOf(callsMade()[0], "Idempotency-Key")).toBe("key-1")
    expect(callsMade()[0].init.body).toBe(JSON.stringify({ menuName: "쇼유" }))
  })

  it("로그인이 필요한 요청은 토큰이 없으면 서버에 가기 전에 막는다", async () => {
    const client = createClient()

    await expect(client.get("/members/me")).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("공개 읽기는 토큰이 없어도 그냥 보낸다", async () => {
    const client = createClient()

    await client.get("/shops", { auth: "optional" })

    expect(headerOf(callsMade()[0], "Authorization")).toBeUndefined()
  })
})

describe("오류 바꾸기", () => {
  it("실패 봉투를 ApiError로 바꾼다", async () => {
    const client = createClient()
    fetchMock.mockResolvedValueOnce(
      failure(400, "VALIDATION_ERROR", {
        message: "닉네임을 확인해 주세요.",
        fields: [{ field: "nickname", code: "DUPLICATED", message: "이미 쓰는 닉네임이에요." }],
      }),
    )

    const error = await client.get("/members/me/onboarding", { auth: "none" }).catch((caught: unknown) => caught)

    expect(isApiError(error, "VALIDATION_ERROR")).toBe(true)
    const apiError = error as ApiError
    expect(apiError).toBeInstanceOf(ApiError)
    expect(apiError.status).toBe(400)
    expect(apiError.requestId).toBe("req-err")
    expect(apiError.fieldError("nickname")?.message).toBe("이미 쓰는 닉네임이에요.")
    expect(apiError.fieldError("email")).toBeUndefined()
  })

  it("봉투가 아닌 HTTP 오류는 HTTP_ERROR로 온다", async () => {
    const client = createClient()
    fetchMock.mockResolvedValueOnce(response("<html>bad gateway</html>", { status: 502 }))

    await expect(client.get("/shops", { auth: "none" })).rejects.toMatchObject({ status: 502, code: "HTTP_ERROR" })
  })

  it("연결 실패는 NETWORK_ERROR가 된다", async () => {
    const client = createClient()
    fetchMock.mockRejectedValueOnce(new TypeError("Network request failed"))

    const error = await client.get("/shops", { auth: "none" }).catch((caught: unknown) => caught)

    expect(isApiError(error, "NETWORK_ERROR")).toBe(true)
    expect((error as ApiError).isOffline).toBe(true)
  })

  it("Retry-After는 초와 날짜 모두 읽는다", () => {
    expect(parseRetryAfter("3")).toBe(3000)
    expect(parseRetryAfter(null)).toBeNull()
    expect(parseRetryAfter("Thu, 01 Jan 1970 00:00:10 GMT", 0)).toBe(10000)
  })
})

describe("토큰 재발급", () => {
  it("동시에 401을 받아도 재발급은 한 번만 돌고 원래 요청을 다시 보낸다", async () => {
    const tokens = createMemoryTokenStore({ accessToken: "a1", refreshToken: "r1" })
    const client = createClient({ tokens })
    let reissueCount = 0
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url.endsWith("/auth/token/reissue")) {
        reissueCount += 1
        return success({ accessToken: "a2", refreshToken: "r2" })
      }
      return (init.headers as Record<string, string>).Authorization === "Bearer a1"
        ? failure(401, "TOKEN_EXPIRED")
        : success({ path: url })
    })

    const [first, second] = await Promise.all([client.get("/members/me"), client.get("/members/me/ramen-logs")])

    expect(reissueCount).toBe(1)
    expect(first).toEqual({ path: "https://api.test/api/v2/members/me" })
    expect(second).toEqual({ path: "https://api.test/api/v2/members/me/ramen-logs" })
    expect(await tokens.get()).toEqual({ accessToken: "a2", refreshToken: "r2" })
  })

  it("이미 새 토큰이 들어와 있으면 재발급 없이 그 토큰으로 다시 보낸다", async () => {
    const tokens = createMemoryTokenStore({ accessToken: "a1", refreshToken: "r1" })
    const client = createClient({ tokens })
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if ((init.headers as Record<string, string>).Authorization === "Bearer a1") {
        // 다른 요청이 그 사이 재발급을 끝낸 상황
        await tokens.set({ accessToken: "a2", refreshToken: "r2" })
        return failure(401, "TOKEN_EXPIRED")
      }
      return success({ ok: true })
    })

    await expect(client.get("/members/me")).resolves.toEqual({ ok: true })
    expect(callsMade().some((call) => call.url.endsWith("/auth/token/reissue"))).toBe(false)
  })

  it("재발급을 서버가 거절하면(401) 토큰을 지우고 한 번만 알린다", async () => {
    const tokens = createMemoryTokenStore({ accessToken: "a1", refreshToken: "r1" })
    const client = createClient({ tokens })
    const ended = jest.fn()
    client.onSessionEnded(ended)
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith("/auth/token/reissue") ? failure(401, "UNAUTHORIZED") : failure(401, "TOKEN_EXPIRED"),
    )

    const results = await Promise.allSettled([client.get("/members/me"), client.get("/members/me/ramen-logs")])

    expect(results.every((result) => result.status === "rejected")).toBe(true)
    expect(await tokens.get()).toBeNull()
    // 요청이 둘이어도 재발급도 알림도 한 번이다
    expect(callsMade().filter((call) => call.url.endsWith("/auth/token/reissue"))).toHaveLength(1)
    expect(ended).toHaveBeenCalledTimes(1)
    expect(ended).toHaveBeenCalledWith({ code: "UNAUTHORIZED", requestId: "req-err" })
  })

  it("재발급이 연결 문제로 실패하면 토큰을 남겨 둔다(다음에 다시 시도한다)", async () => {
    const tokens = createMemoryTokenStore({ accessToken: "a1", refreshToken: "r1" })
    const client = createClient({ tokens })
    const ended = jest.fn()
    client.onSessionEnded(ended)
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url.endsWith("/auth/token/reissue")) throw new TypeError("Network request failed")
      return failure(401, "TOKEN_EXPIRED")
    })

    await expect(client.get("/members/me")).rejects.toMatchObject({ code: "NETWORK_ERROR" })
    expect(await tokens.get()).toEqual({ accessToken: "a1", refreshToken: "r1" })
    expect(ended).not.toHaveBeenCalled()
    // 재발급 요청은 다시 보내지 않는다(멱등 키가 없으므로 재시도 대상이 아니다)
    expect(callsMade().filter((call) => call.url.endsWith("/auth/token/reissue"))).toHaveLength(1)
  })

  it("재발급이 요청 과다(429)로 막히면 로그아웃시키지 않고 토큰을 남겨 둔다", async () => {
    const tokens = createMemoryTokenStore({ accessToken: "a1", refreshToken: "r1" })
    const client = createClient({ tokens })
    const ended = jest.fn()
    client.onSessionEnded(ended)
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith("/auth/token/reissue") ? failure(429, "RATE_LIMITED") : failure(401, "TOKEN_EXPIRED"),
    )

    await expect(client.get("/members/me")).rejects.toMatchObject({ code: "RATE_LIMITED" })
    expect(await tokens.get()).toEqual({ accessToken: "a1", refreshToken: "r1" })
    expect(ended).not.toHaveBeenCalled()
  })

  it("세션이 끝나도 공개 읽기는 비회원으로 한 번 더 시도한다", async () => {
    const tokens = createMemoryTokenStore({ accessToken: "a1", refreshToken: "r1" })
    const client = createClient({ tokens })
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url.endsWith("/auth/token/reissue")) return failure(401, "UNAUTHORIZED")
      return (init.headers as Record<string, string>).Authorization ? failure(401, "TOKEN_EXPIRED") : success({ items: [] })
    })

    await expect(client.get("/ramen-logs", { auth: "optional" })).resolves.toEqual({ items: [] })
    expect(await tokens.get()).toBeNull()
  })
})

describe("멱등 생성 재시도", () => {
  it("연결·서버 문제면 같은 키로 1s·2s·4s 간격까지 다시 보낸다", async () => {
    const delays: number[] = []
    const client = createClient({
      sleep: async (ms: number) => {
        delays.push(ms)
      },
    })
    fetchMock
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockResolvedValueOnce(failure(503, "INTERNAL_ERROR"))
      .mockResolvedValueOnce(success({ id: "10" }))

    await expect(
      client.request("/ramen-logs", { method: "POST", body: { menuName: "쇼유" }, auth: "none", idempotencyKey: "key-7" }),
    ).resolves.toEqual({ id: "10" })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(delays).toEqual([1000, 2000])
    // 새 키를 만들어 다시 보내면 기록이 두 번 생긴다. 같은 키여야 한다
    expect(callsMade().map((call) => headerOf(call, "Idempotency-Key"))).toEqual(["key-7", "key-7", "key-7"])
  })

  it("세 번 더 보내고도 실패하면 오류를 올린다", async () => {
    const delays: number[] = []
    const client = createClient({
      sleep: async (ms: number) => {
        delays.push(ms)
      },
    })
    fetchMock.mockRejectedValue(new TypeError("Network request failed"))

    await expect(
      client.request("/ramen-logs", { method: "POST", body: {}, auth: "none", idempotencyKey: "key-8" }),
    ).rejects.toMatchObject({ code: "NETWORK_ERROR" })

    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(delays).toEqual([1000, 2000, 4000])
  })

  it("멱등 키가 없는 요청은 다시 보내지 않는다", async () => {
    const client = createClient({ sleep: async () => undefined })
    fetchMock.mockResolvedValue(failure(503, "INTERNAL_ERROR"))

    await expect(client.get("/shops", { auth: "none" })).rejects.toMatchObject({ status: 503 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("400 같은 오류는 다시 보내지 않는다", async () => {
    const client = createClient({ sleep: async () => undefined })
    fetchMock.mockResolvedValue(failure(400, "VALIDATION_ERROR"))

    await expect(
      client.request("/ramen-logs", { method: "POST", body: {}, auth: "none", idempotencyKey: "key-9" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("5xx는 1초를 기다렸다 같은 키로 다시 보낸다", async () => {
    jest.useFakeTimers()
    try {
      const client = createClient()
      fetchMock.mockResolvedValueOnce(failure(500, "INTERNAL_ERROR")).mockResolvedValueOnce(success({ id: "11" }))

      const pending = client.request("/ramen-logs", {
        method: "POST",
        body: {},
        auth: "none",
        idempotencyKey: "key-10",
      })

      await jest.advanceTimersByTimeAsync(0)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      await jest.advanceTimersByTimeAsync(900)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      await jest.advanceTimersByTimeAsync(200)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      await expect(pending).resolves.toEqual({ id: "11" })
      expect(callsMade().map((call) => headerOf(call, "Idempotency-Key"))).toEqual(["key-10", "key-10"])
    } finally {
      jest.useRealTimers()
    }
  })

  it("서버가 Retry-After를 보내면 그만큼 기다린다(계약에서 빠졌지만 오면 지킨다)", async () => {
    const delays: number[] = []
    const client = createClient({
      sleep: async (ms: number) => {
        delays.push(ms)
      },
    })
    fetchMock
      .mockResolvedValueOnce(failure(503, "INTERNAL_ERROR", { headers: { "Retry-After": "3" } }))
      .mockResolvedValueOnce(success({ id: "12" }))

    await client.request("/ramen-logs", { method: "POST", body: {}, auth: "none", idempotencyKey: "key-11" })

    expect(delays).toEqual([3000])
  })
})

describe("createIdempotencyKey", () => {
  it("uuid v4 모양이고 매번 다르다", () => {
    const first = createIdempotencyKey()
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(first).not.toBe(createIdempotencyKey())
  })
})
