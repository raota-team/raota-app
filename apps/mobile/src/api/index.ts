/**
 * 서버 v2 클라이언트. 아직 어떤 화면도 여기를 거치지 않는다(기본값 mock).
 *
 * 서버로 옮기는 순서
 * 1) .env에 EXPO_PUBLIC_API_MODE=remote, EXPO_PUBLIC_API_BASE_URL=<dev 주소>를 넣는다
 * 2) EXPO_PUBLIC_API_REMOTE_DOMAINS로 도메인을 하나씩 켠다(예: shops → lounge → ramenLogs)
 * 3) src/data/remote.ts의 함수로 src/data/hooks.ts 안쪽을 바꾼다(화면은 그대로)
 */
export * from "./config"
export * from "./client"
export * from "./tokens"
export * from "./outbox"
export * from "./adapters"
export * from "./endpoints"
export type * from "./types"
