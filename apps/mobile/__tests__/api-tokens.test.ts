import { SecureTokenStore, TOKEN_STORAGE_KEY, createMemoryTokenStore } from "@/src/api/tokens"

/** jest.setup.ts가 expo-secure-store를 메모리 대체본(__mocks__)으로 바꿔 둔다 */
const SecureStore = jest.requireMock("expo-secure-store") as typeof import("@/__mocks__/expo-secure-store")

beforeEach(() => {
  SecureStore.__resetSecureStore()
  SecureStore.isAvailableAsync.mockImplementation(async () => true)
  SecureStore.getItemAsync.mockImplementation(async (key: string) => null)
  SecureStore.setItemAsync.mockImplementation(async () => undefined)
  SecureStore.deleteItemAsync.mockImplementation(async () => undefined)
})

describe("SecureTokenStore", () => {
  const pair = { accessToken: "a1", refreshToken: "r1" }

  it("저장한 토큰을 키체인과 메모리 양쪽에서 읽는다", async () => {
    const store = new SecureTokenStore()
    await store.set(pair)

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(TOKEN_STORAGE_KEY, JSON.stringify(pair), expect.any(Object))
    expect(store.peek()).toEqual(pair)
    expect(await store.get()).toEqual(pair)
  })

  it("앱을 다시 켜면 키체인에서 한 번만 읽는다", async () => {
    SecureStore.getItemAsync.mockImplementation(async () => JSON.stringify(pair))
    const store = new SecureTokenStore()

    // 아직 읽기 전에는 메모리에 아무것도 없다
    expect(store.peek()).toBeNull()
    const [first, second] = await Promise.all([store.get(), store.get()])

    expect(first).toEqual(pair)
    expect(second).toEqual(pair)
    expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(1)
  })

  it("지우면 메모리를 바로 비운다(동시에 들어온 요청이 세션을 두 번 끝내지 않게)", async () => {
    const store = new SecureTokenStore()
    await store.set(pair)

    const clearing = store.clear()
    expect(store.peek()).toBeNull()
    await clearing
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(TOKEN_STORAGE_KEY)
    expect(await store.get()).toBeNull()
  })

  it("키체인을 읽는 중에 로그인하면 방금 받은 토큰을 옛 값으로 덮지 않는다", async () => {
    let finishRead: (value: string | null) => void = () => undefined
    SecureStore.getItemAsync.mockImplementation(
      () =>
        new Promise<string | null>((resolve) => {
          finishRead = resolve
        }),
    )
    const store = new SecureTokenStore()

    const reading = store.get()
    await store.set(pair)
    finishRead(null)

    expect(await reading).toEqual(pair)
    expect(await store.get()).toEqual(pair)
  })

  it("깨진 값이 저장돼 있으면 로그인하지 않은 상태로 시작한다", async () => {
    SecureStore.getItemAsync.mockImplementation(async () => "{not json")
    expect(await new SecureTokenStore().get()).toBeNull()
  })

  it("키체인을 못 쓰는 환경(웹 등)에서는 메모리만 쓰고 앱은 계속 돈다", async () => {
    SecureStore.isAvailableAsync.mockImplementation(async () => false)
    const store = new SecureTokenStore()

    expect(await store.get()).toBeNull()
    await store.set(pair)

    expect(SecureStore.getItemAsync).not.toHaveBeenCalled()
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled()
    expect(await store.get()).toEqual(pair)
  })

  it("키체인이 오류를 내도 이번 실행 동안은 로그인 상태를 지킨다", async () => {
    SecureStore.getItemAsync.mockImplementation(async () => {
      throw new Error("User interaction is not allowed")
    })
    SecureStore.setItemAsync.mockImplementation(async () => {
      throw new Error("keychain locked")
    })
    const store = new SecureTokenStore()

    expect(await store.get()).toBeNull()
    await expect(store.set(pair)).resolves.toBeUndefined()
    expect(await store.get()).toEqual(pair)
  })
})

describe("createMemoryTokenStore", () => {
  it("테스트·웹용 보관소도 같은 규칙으로 움직인다", async () => {
    const store = createMemoryTokenStore({ accessToken: "a", refreshToken: "r" })

    expect(store.peek()).toEqual({ accessToken: "a", refreshToken: "r" })
    await store.clear()
    expect(await store.get()).toBeNull()
  })
})
