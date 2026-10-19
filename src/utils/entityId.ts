// 데모 ID도 문자열로 순차 증가시켜 BIGINT를 Number로 변환하지 않는다.
let lastDemoId = BigInt(Date.now())

export function nextDemoEntityId(): string {
  lastDemoId += 1n
  return lastDemoId.toString()
}

/** BIGINT 문자열은 JS number 뺄셈 대신 정확한 정수 비교로 최신순 정렬한다. */
export function compareEntityIdsDescending(left: string, right: string): number {
  const a = BigInt(left)
  const b = BigInt(right)
  return a > b ? -1 : a < b ? 1 : 0
}
