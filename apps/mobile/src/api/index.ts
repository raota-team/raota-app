/**
 * 서버 v2 클라이언트. 도메인 스위치(config.ts의 API_DOMAINS)로 화면을 서버에 연결한다:
 * 계정(auth·member), 매장·찜(shops), 내 기록·기록 쓰기(ramenLogs), 라운지·공감·댓글·신고·차단(lounge), AI 추천(recommendations).
 * 기본 빌드(mock)는 기기 안 데이터를 유지한다. 어떤 화면이 어떤 경로를 쓰는지는 src/data/remote.ts 머리말에 있다.
 */
export * from "./config"
export * from "./client"
export * from "./tokens"
export * from "./outbox"
export * from "./adapters"
export * from "./endpoints"
export type * from "./types"
