/**
 * 서버 v2 클라이언트. 공개 매장·라운지 읽기만 도메인 스위치로 연결한다.
 * 기본 빌드(mock)는 로컬 데이터를 유지한다. 로그인·쓰기와 회원 데이터는 아직 로컬이다.
 */
export * from "./config"
export * from "./client"
export * from "./tokens"
export * from "./outbox"
export * from "./adapters"
export * from "./endpoints"
export type * from "./types"
