import * as SecureStore from "expo-secure-store"

/**
 * 로그인 토큰 보관. 키체인(expo-secure-store)에 넣고 메모리에도 들고 있는다.
 * 키체인을 못 쓰는 환경(웹, 잠긴 기기, 시뮬레이터 오류)에서는 메모리에만 두고 앱이 죽지 않게 한다.
 * 이 파일 밖에서는 토큰 문자열을 직접 들고 다니지 않는다(로그·분석에도 남기지 않는다).
 */

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

export interface TokenStore {
  /** 저장된 토큰. 처음 부를 때 한 번 키체인에서 읽는다 */
  get(): Promise<TokenPair | null>
  /** 비동기 없이 지금 메모리에 있는 값만 본다(아직 안 읽었으면 null) */
  peek(): TokenPair | null
  set(pair: TokenPair): Promise<void>
  clear(): Promise<void>
}

/** 키체인 키. 영문·숫자·.·-·_만 쓸 수 있다 */
export const TOKEN_STORAGE_KEY = "raota.auth.tokens"

function isTokenPair(value: unknown): value is TokenPair {
  if (typeof value !== "object" || value === null) return false
  const pair = value as Record<string, unknown>
  return typeof pair.accessToken === "string" && typeof pair.refreshToken === "string"
}

function warn(message: string, error: unknown) {
  // 토큰 저장 실패가 앱을 멈추게 하지는 않는다. 값(토큰)은 절대 로그에 남기지 않는다
  if (__DEV__ && process.env.NODE_ENV !== "test") console.warn(`[api/tokens] ${message}`, error)
}

export class SecureTokenStore implements TokenStore {
  /** undefined는 "아직 키체인을 안 읽음" */
  private cache: TokenPair | null | undefined = undefined
  private loading: Promise<TokenPair | null> | null = null
  /** 키체인을 쓸 수 없는 환경이면 메모리만 쓴다 */
  private persistent = true

  constructor(private readonly key: string = TOKEN_STORAGE_KEY) {}

  peek(): TokenPair | null {
    return this.cache ?? null
  }

  async get(): Promise<TokenPair | null> {
    if (this.cache !== undefined) return this.cache
    if (!this.loading) {
      this.loading = this.load().finally(() => {
        this.loading = null
      })
    }
    return this.loading
  }

  async set(pair: TokenPair): Promise<void> {
    // 메모리를 먼저 바꿔 둔다. 저장이 실패해도 이번 실행 동안은 로그인 상태가 유지된다
    this.cache = pair
    if (!this.persistent) return
    try {
      await SecureStore.setItemAsync(this.key, JSON.stringify(pair), {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      })
    } catch (error) {
      this.persistent = false
      warn("토큰을 키체인에 저장하지 못했습니다. 이번 실행 동안 메모리에만 둡니다.", error)
    }
  }

  async clear(): Promise<void> {
    // 동기적으로 먼저 비운다. 동시에 들어온 요청들이 이미 끝난 세션을 또 끝내지 않게 한다
    this.cache = null
    try {
      await SecureStore.deleteItemAsync(this.key)
    } catch (error) {
      warn("키체인에서 토큰을 지우지 못했습니다.", error)
    }
  }

  /**
   * 키체인을 한 번 읽는다.
   * 읽는 동안 로그인·로그아웃이 끼어들 수 있으므로(set·clear는 메모리를 바로 바꾼다)
   * 메모리가 아직 비어 있을 때(undefined)만 읽은 값을 넣는다. 방금 받은 토큰을 옛 값으로 덮지 않기 위해서다.
   */
  private async load(): Promise<TokenPair | null> {
    try {
      const available = await SecureStore.isAvailableAsync()
      if (!available) {
        this.persistent = false
        if (this.cache === undefined) this.cache = null
        return this.cache ?? null
      }
      const raw = await SecureStore.getItemAsync(this.key)
      if (this.cache === undefined) {
        const parsed: unknown = raw ? JSON.parse(raw) : null
        this.cache = isTokenPair(parsed) ? parsed : null
      }
    } catch (error) {
      this.persistent = false
      if (this.cache === undefined) this.cache = null
      warn("키체인에서 토큰을 읽지 못했습니다. 로그인하지 않은 상태로 시작합니다.", error)
    }
    return this.cache ?? null
  }
}

/** 테스트와 키체인이 없는 환경(웹 미리보기)을 위한 메모리 보관소 */
export function createMemoryTokenStore(initial: TokenPair | null = null): TokenStore {
  let pair = initial
  return {
    async get() {
      return pair
    },
    peek() {
      return pair
    },
    async set(next) {
      pair = next
    },
    async clear() {
      pair = null
    },
  }
}

/** 앱 전체가 쓰는 보관소 */
export const tokenStore: TokenStore = new SecureTokenStore()
