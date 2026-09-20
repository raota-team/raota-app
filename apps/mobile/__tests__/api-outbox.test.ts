import { ApiError } from "@/src/api/client"
import {
  IdempotencyOutbox,
  OUTBOX_STORAGE_KEY,
  OUTBOX_TTL_MS,
  fingerprintOf,
  isPermanentFailure,
  sendIdempotent,
  type KeyValueStorage,
} from "@/src/api/outbox"

/** AsyncStorage 대신 쓰는 메모리 저장소. 앱을 껐다 켜는 상황은 새 Outbox 인스턴스로 흉내 낸다 */
function createStorage(): KeyValueStorage & { dump(): unknown } {
  const map = new Map<string, string>()
  return {
    async getItem(key) {
      return map.get(key) ?? null
    },
    async setItem(key, value) {
      map.set(key, value)
    },
    async removeItem(key) {
      map.delete(key)
    },
    dump() {
      const raw = map.get(OUTBOX_STORAGE_KEY)
      return raw ? (JSON.parse(raw) as unknown) : null
    },
  }
}

function keyMaker(prefix = "key") {
  let count = 0
  return () => `${prefix}-${++count}`
}

const BODY = { shopId: "7", menuName: "쇼유 라멘" }

describe("fingerprintOf", () => {
  it("키 순서가 달라도 같은 값이 나온다", () => {
    expect(fingerprintOf({ a: 1, b: { c: 2, d: [3, 4] } })).toBe(fingerprintOf({ b: { d: [3, 4], c: 2 }, a: 1 }))
    expect(fingerprintOf({ a: 1 })).not.toBe(fingerprintOf({ a: 2 }))
  })
})

describe("IdempotencyOutbox", () => {
  it("같은 계정·작업·지문이면 앱을 다시 켜도 같은 키를 쓴다", async () => {
    const storage = createStorage()
    const first = new IdempotencyOutbox(storage, () => 1_000, keyMaker())
    const entry = await first.begin({
      accountId: "member-1",
      operation: "CREATE_RAMEN_LOG",
      path: "/ramen-logs",
      fingerprint: fingerprintOf(BODY),
      body: BODY,
    })

    // 앱 재시작
    const second = new IdempotencyOutbox(storage, () => 2_000, keyMaker("new"))
    const again = await second.begin({
      accountId: "member-1",
      operation: "CREATE_RAMEN_LOG",
      path: "/ramen-logs",
      fingerprint: fingerprintOf(BODY),
      body: BODY,
    })

    expect(again.key).toBe(entry.key)
    expect(again.firstSentAt).toBe(entry.firstSentAt)
  })

  it("본문이 달라지면 새 키를 만든다(같은 키로 다른 본문을 보내면 409가 된다)", async () => {
    const outbox = new IdempotencyOutbox(createStorage(), () => 1_000, keyMaker())
    const first = await outbox.begin({
      accountId: "member-1",
      operation: "CREATE_RAMEN_LOG",
      path: "/ramen-logs",
      fingerprint: fingerprintOf(BODY),
      body: BODY,
    })
    const second = await outbox.begin({
      accountId: "member-1",
      operation: "CREATE_RAMEN_LOG",
      path: "/ramen-logs",
      fingerprint: fingerprintOf({ ...BODY, menuName: "미소 라멘" }),
      body: { ...BODY, menuName: "미소 라멘" },
    })

    expect(second.key).not.toBe(first.key)
  })

  it("계정이 다르면 키를 나눠 쓴다", async () => {
    const outbox = new IdempotencyOutbox(createStorage(), () => 1_000, keyMaker())
    const mine = await outbox.begin({
      accountId: "member-1",
      operation: "CREATE_RAMEN_LOG",
      path: "/ramen-logs",
      fingerprint: fingerprintOf(BODY),
      body: BODY,
    })
    const other = await outbox.begin({
      accountId: "member-2",
      operation: "CREATE_RAMEN_LOG",
      path: "/ramen-logs",
      fingerprint: fingerprintOf(BODY),
      body: BODY,
    })

    expect(other.key).not.toBe(mine.key)
    expect(await outbox.pending("member-1")).toHaveLength(1)
    await outbox.clearAccount("member-1")
    expect(await outbox.pending("member-1")).toHaveLength(0)
    expect(await outbox.pending("member-2")).toHaveLength(1)
  })

  it("24시간이 지난 항목은 버린다(서버도 그때는 키를 잊는다)", async () => {
    const storage = createStorage()
    let now = 1_000_000
    const outbox = new IdempotencyOutbox(storage, () => now, keyMaker())
    await outbox.begin({
      accountId: "member-1",
      operation: "CREATE_RAMEN_LOG",
      path: "/ramen-logs",
      fingerprint: fingerprintOf(BODY),
      body: BODY,
    })

    now += OUTBOX_TTL_MS + 1
    expect(await outbox.find("member-1", "CREATE_RAMEN_LOG", fingerprintOf(BODY))).toBeNull()
    expect(storage.dump()).toBeNull()
  })
})

describe("sendIdempotent", () => {
  it("성공하면 항목을 지운다", async () => {
    const outbox = new IdempotencyOutbox(createStorage(), () => 1_000, keyMaker())
    const send = jest.fn(async () => ({ id: "1" }))

    await sendIdempotent(
      { operation: "CREATE_RAMEN_LOG", path: "/ramen-logs", buildBody: () => BODY, accountId: "member-1", outbox },
      send,
    )

    expect(send).toHaveBeenCalledWith({ idempotencyKey: "key-1", body: BODY })
    expect(await outbox.pending("member-1")).toHaveLength(0)
  })

  it("연결 문제로 실패하면 항목을 남겨 두고, 다시 보낼 때 같은 키·같은 본문을 쓴다", async () => {
    const outbox = new IdempotencyOutbox(createStorage(), () => 1_000, keyMaker())
    const offline = new ApiError({ status: 0, code: "NETWORK_ERROR", message: "연결 실패" })
    const request = {
      operation: "CREATE_RAMEN_LOG" as const,
      path: "/ramen-logs",
      buildBody: () => BODY,
      accountId: "member-1",
      outbox,
    }

    await expect(
      sendIdempotent(request, async () => {
        throw offline
      }),
    ).rejects.toBe(offline)
    expect(await outbox.pending("member-1")).toHaveLength(1)

    const retry = jest.fn(async () => ({ id: "1" }))
    await sendIdempotent(request, retry)

    expect(retry).toHaveBeenCalledWith({ idempotencyKey: "key-1", body: BODY })
    expect(await outbox.pending("member-1")).toHaveLength(0)
  })

  it("다시 보내도 소용없는 실패(400)면 항목을 지운다", async () => {
    const outbox = new IdempotencyOutbox(createStorage(), () => 1_000, keyMaker())

    await expect(
      sendIdempotent(
        { operation: "CREATE_COMMENT", path: "/ramen-logs/1/comments", buildBody: () => BODY, accountId: "member-1", outbox },
        async () => {
          throw new ApiError({ status: 400, code: "VALIDATION_ERROR", message: "본문이 올바르지 않아요." })
        },
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" })

    expect(await outbox.pending("member-1")).toHaveLength(0)
  })

  it("계정을 모르면 아웃박스를 쓰지 않고 새 키로 보낸다", async () => {
    const send = jest.fn(async (payload: { idempotencyKey: string; body: unknown }) => ({ id: payload.idempotencyKey }))

    await sendIdempotent({ operation: "CREATE_RAMEN_LOG", path: "/ramen-logs", buildBody: () => BODY }, send)

    expect(send.mock.calls[0][0].idempotencyKey).toMatch(/^[0-9a-f-]{36}$/)
  })

  it("다시 보낼 수 있는 실패와 아닌 실패를 가른다", () => {
    expect(isPermanentFailure(new ApiError({ status: 400, code: "VALIDATION_ERROR", message: "" }))).toBe(true)
    expect(isPermanentFailure(new ApiError({ status: 409, code: "IDEMPOTENCY_KEY_REUSED", message: "" }))).toBe(true)
    expect(isPermanentFailure(new ApiError({ status: 409, code: "IDEMPOTENCY_IN_PROGRESS", message: "" }))).toBe(false)
    expect(isPermanentFailure(new ApiError({ status: 429, code: "RATE_LIMITED", message: "" }))).toBe(false)
    expect(isPermanentFailure(new ApiError({ status: 0, code: "NETWORK_ERROR", message: "" }))).toBe(false)
    expect(isPermanentFailure(new ApiError({ status: 500, code: "INTERNAL_ERROR", message: "" }))).toBe(false)
  })
})
