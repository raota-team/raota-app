/**
 * 서버 읽기 응답 캐시(화면 사이에 공유). hooks가 키 하나에 첫 응답을 한 번만 받아 나눠 쓴다.
 *
 * 응답에는 보는 사람 기준 값(내 공감·찜·내 댓글 여부)이 섞여 있으니 계정이 바뀌면 clear()로 통째로 버린다.
 * 쓰기 뒤에는 invalidate()로 바뀐 응답만 버린다. 그 키를 보고 있는 화면은 이전 값을 그대로 보여주며 다시 읽는다.
 */
export type CacheEntry = { value: unknown } | { promise: Promise<unknown> }

/** 종류별 내 기록(useMyLogsOfType) 캐시 키의 앞부분. 기록을 쓰고 고치고 지우면 이 앞부분으로 버린다 */
export const MY_LOGS_OF_TYPE_KEY = "me:logs:type:"
/** 지난 식권 목록(useTicketHistory) 캐시 키. 식권을 새로 뽑으면 버린다 */
export const TICKET_HISTORY_KEY = "recommendations:history"
/** 식권 한 장. 지난 식권에서 고른 식권을 큐레이터 결과 화면이 id로 다시 찾는다 */
export const ticketKey = (id: string) => `recommendations:ticket:${id}`

const entries = new Map<string, CacheEntry>()
/** 키마다 몇 번 버려졌는가. 이어 읽던 커서 페이지를 버릴지 정할 때 쓴다 */
const generations = new Map<string, number>()
const listeners = new Set<() => void>()
let version = 0

function drop(key: string) {
  entries.delete(key)
  generations.set(key, (generations.get(key) ?? 0) + 1)
}

function notify() {
  version += 1
  for (const listener of listeners) listener()
}

export const remoteCache = {
  get(key: string): CacheEntry | undefined {
    return entries.get(key)
  },

  /** 이미 받은 값을 키에 둔다(목록에서 받은 항목을 다른 화면이 id로 찾게) */
  put(key: string, value: unknown) {
    entries.set(key, { value })
  },

  /**
   * 이 키의 응답을 읽는다. 같은 키를 읽는 중이면 그 요청을 함께 기다린다.
   * 성공하면 남기고 실패하면 지운다(다음에 다시 읽게). 그사이 버려진 키(invalidate)에는 남기지 않는다
   */
  load<T>(key: string, read: () => Promise<T>): Promise<T> {
    const entry = entries.get(key)
    if (entry && "promise" in entry) return entry.promise as Promise<T>
    const promise = read()
    entries.set(key, { promise })
    const isCurrent = () => {
      const current = entries.get(key)
      return Boolean(current && "promise" in current && current.promise === promise)
    }
    promise.then(
      (value) => {
        if (isCurrent()) entries.set(key, { value })
      },
      () => {
        if (isCurrent()) entries.delete(key)
      },
    )
    return promise
  },

  /** 이 접두어로 시작하는 응답을 버리고, 그 키를 보고 있는 화면이 다시 읽게 한다 */
  invalidate(...prefixes: string[]) {
    for (const key of [...entries.keys()]) {
      if (prefixes.some((prefix) => key.startsWith(prefix))) drop(key)
    }
    notify()
  },

  /** 로그아웃·계정 전환: 앞 계정 기준으로 받은 응답을 모두 버린다 */
  clear() {
    for (const key of [...entries.keys()]) drop(key)
    notify()
  },

  generationOf(key: string): number {
    return generations.get(key) ?? 0
  },

  version(): number {
    return version
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}
