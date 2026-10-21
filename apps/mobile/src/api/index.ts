/**
 * 서버 v2 클라이언트. 공개 매장·라운지 읽기(shops·lounge)와 계정(auth: 로그인·온보딩·약관 동의·로그아웃·탈퇴,
 * member: 내 정보·닉네임 확인)을 도메인 스위치로 연결한다.
 * 기본 빌드(mock)는 로컬 데이터를 유지한다. 기록 쓰기·찜·공감·댓글·신고·AI 추천과 내 기록 화면은 아직 로컬이다.
 */
export * from "./config"
export * from "./client"
export * from "./tokens"
export * from "./outbox"
export * from "./adapters"
export * from "./endpoints"
export type * from "./types"
