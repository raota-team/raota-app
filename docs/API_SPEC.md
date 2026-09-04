# 🍜 RAOTA (라오타) RESTful API 명세서 (API Specification)

본 문서는 **라오타(RAOTA)** 모바일 웹/앱 클라이언트와 **Spring Boot 백엔드** 간의 통신 규격을 정의한 표준 RESTful API 명세서입니다.  
[`docs/ERD.md`](./ERD.md)에 기술된 데이터베이스 엔티티 구조 및 프론트엔드 도메인 인터페이스를 100% 반영하여 설계되었습니다.

---

## 1. 글로벌 통신 규칙 (Global Specifications)

### 1.1 기본 정보 (Base Info)
- **Base URL**: `https://api.raota.app/api/v1` (개발 환경: `http://localhost:8080/api/v1`)
- **데이터 포맷**: `application/json; charset=UTF-8`
- **시간대 표기**: ISO-8601 UTC (`YYYY-MM-DDTHH:mm:ssZ`) 또는 현지 일자 (`YYYY-MM-DD`)
- **문자 인코딩**: UTF-8

### 1.2 인증 방식 (Authentication)
- **방식**: JWT (JSON Web Token) Bearer 인증
- **헤더 규격**: `Authorization: Bearer <access_token>`
- **공통 응답 헤더**:
  - `X-Request-Id`: 트랜잭션 추적용 고유 UUID

### 1.3 공통 표준 응답 포맷 (Standard Response Format)

모든 API 응답은 일관된 래퍼(Wrapper) 객체로 반환됩니다.

#### 성공 응답 (HTTP 200 / 201)
```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "요청이 성공적으로 처리되었습니다.",
  "data": { ... }
}
```

#### 페이징 성공 응답
```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "목록 조회가 완료되었습니다.",
  "data": {
    "content": [ ... ],
    "page": 0,
    "size": 20,
    "totalElements": 142,
    "totalPages": 8,
    "first": true,
    "last": false
  }
}
```

#### 실패/에러 응답 (HTTP 4xx / 5xx)
```json
{
  "success": false,
  "code": "INVALID_INPUT_VALUE",
  "message": "입력값 검증에 실패하였습니다.",
  "errors": [
    {
      "field": "menuName",
      "value": "",
      "reason": "라멘 메뉴명은 필수 입력값입니다."
    }
  ],
  "timestamp": "2026-09-04T14:15:00Z"
}
```

---

## 2. API 엔드포인트 목록 요약 (Endpoint Index)

| 도메인 | 메서드 | 엔드포인트 | 설명 | 인증 |
| :--- | :--- | :--- | :--- | :--- |
| **인증 (Auth)** | `POST` | `/auth/login/oauth` | 소셜 로그인 & 자동 회원가입 | 불필요 |
| | `POST` | `/auth/reissue` | Access Token 재발급 | RefreshToken |
| | `POST` | `/auth/logout` | 로그아웃 및 토큰 무효화 | 필수 |
| **회원 (Member)** | `GET` | `/members/me` | 내 프로필 및 활동 요약 조회 | 필수 |
| | `PATCH` | `/members/me` | 내 프로필 정보(닉네임, 한줄소개 등) 수정 | 필수 |
| | `GET` | `/members/{memberId}` | 타 회원 공개 프로필 조회 | 선택 |
| | `GET` | `/members/me/badges` | 내 보유 뱃지 및 등급 달성 현황 조회 | 필수 |
| | `GET` | `/members/me/taste-dna` | 내 라멘 5축 미각 DNA 리포트 조회 | 필수 |
| **라멘로그 (Logs)** | `GET` | `/ramen-logs` | 라멘로그 피드 목록 조회 (페이징/정렬) | 선택 |
| | `POST` | `/ramen-logs` | 라멘로그 신규 등록 (완식/미각 기록) | 필수 |
| | `GET` | `/ramen-logs/{logId}` | 라멘로그 단건 상세 조회 | 선택 |
| | `PUT` | `/ramen-logs/{logId}` | 라멘로그 수정 | 필수(작성자) |
| | `DELETE` | `/ramen-logs/{logId}` | 라멘로그 삭제 | 필수(작성자) |
| | `POST` | `/ramen-logs/{logId}/likes` | 라멘로그 공감(좋아요) 토글 | 필수 |
| | `GET` | `/ramen-logs/calendar` | 유저 완식 캘린더 히트맵 데이터 조회 | 필수 |
| | `GET` | `/ramen-logs/conquered-shops`| 라멘로그 정복 라멘집 목록 조회 | 필수 |
| **라멘 매장 (Shops)** | `GET` | `/shops` | 위치 기반 라멘집 검색 및 필터 목록 | 불필요 |
| | `GET` | `/shops/{shopId}` | 라멘집 상세 정보 조회 (영업시간, 혜택 등) | 불필요 |
| | `POST` | `/shops/{shopId}/bookmarks` | 매장 북마크 저장/취소 (토글) | 필수 |
| | `GET` | `/shops/bookmarks` | 내가 저장한 라멘집 목록 조회 | 필수 |
| **커뮤니티 (Lounge)** | `GET` | `/community/posts` | 라운지 게시글 목록 조회 (카테고리 필터) | 선택 |
| | `POST` | `/community/posts` | 라운지 게시글 작성 | 필수 |
| | `GET` | `/community/posts/{postId}` | 게시글 상세 및 댓글 목록 조회 | 선택 |
| | `POST` | `/community/posts/{postId}/likes` | 게시글 좋아요 토글 | 필수 |
| | `POST` | `/community/posts/{postId}/comments` | 댓글/대댓글 작성 | 필수 |
| | `DELETE` | `/community/comments/{commentId}` | 댓글 삭제 | 필수(작성자) |
| **AI 추천 (Recommend)**| `POST` | `/recommendations/ai` | 5축 취향 벡터 기반 맞춤 라멘집 추천 | 선택 |
| **알림 (Notification)**| `GET` | `/notifications` | 알림 센터 내 알림 목록 조회 | 필수 |
| | `PATCH` | `/notifications/{id}/read` | 알림 단건 읽음 처리 | 필수 |
| | `PATCH` | `/notifications/read-all` | 알림 전체 읽음 처리 | 필수 |
| | `GET` | `/notifications/subscribe` | 실시간 SSE 알림 스트림 구독 | 필수 |
| | `GET` | `/notifications/settings` | 알림 환경설정 조회 | 필수 |
| | `PUT` | `/notifications/settings` | 알림 환경설정 수정 | 필수 |

---

## 3. 상세 API 명세 (Detailed Specifications)

### 3.1 인증 & 회원 (Auth & Member)

#### [POST] `/auth/login/oauth` - 소셜 로그인 / 회원가입
- **설명**: 카카오, 애플, 구글 소셜 인가 코드를 받아 검증 후 JWT 토큰을 발급합니다. 미가입 유저일 경우 자동으로 회원가입 처리됩니다.
- **Request Body**:
```json
{
  "provider": "KAKAO",
  "authCode": "oauth_authorization_code_sample_string",
  "redirectUri": "https://raota.app/oauth/callback/kakao"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "로그인되었습니다.",
  "data": {
    "isNewMember": false,
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5...",
    "expiresIn": 7200,
    "member": {
      "id": 1,
      "nickname": "합정라멘마스터",
      "membershipNo": "ROT-2026-0042",
      "levelTitle": "라멘 미식가",
      "levelNumber": 4,
      "avatarUrl": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120"
    }
  }
}
```

---

#### [GET] `/members/me` - 내 프로필 및 활동 통계 조회
- **설명**: 마이페이지에 필요한 회원 기본 정보, 총 완식 그릇수, 정복 매장수, 재방문 횟수를 한 번에 반환합니다.
- **Headers**: `Authorization: Bearer <token>`
- **Response (200 OK)**:
```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "내 프로필 조회가 완료되었습니다.",
  "data": {
    "id": 1,
    "nickname": "합정라멘마스터",
    "membershipNo": "ROT-2026-0042",
    "email": "master@raota.com",
    "avatarUrl": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120",
    "levelTitle": "라멘 미식가",
    "levelNumber": 4,
    "bio": "망원/합정/상수 라멘 격전지 정복 중 🍜",
    "favoriteRamenType": "쇼유",
    "totalLogCount": 43,
    "conqueredShopCount": 28,
    "revisitCount": 15,
    "longestStreakDays": 12,
    "thisMonthLogCount": 8
  }
}
```

---

### 3.2 라멘로그 (RamenLog)

#### [POST] `/ramen-logs` - 라멘로그 작성 (한 그릇 완식 & 5축 미각 기록)
- **설명**: 방문한 매장의 주문 메뉴, 5축 미각 노트(국물, 면, 간, 토핑), 국물 완식 여부, 사진 목록을 기록합니다.
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
```json
{
  "shopId": 101,
  "menuName": "특제 쇼유 라멘",
  "ramenType": "쇼유",
  "visitedAt": "2026-09-04",
  "isSoupFinished": true,
  "revisit": "자주 감",
  "note": "닭육수 베이스의 맑고 깊은 감칠맛. 얇은 스트레이트 면의 익힘 정도가 완벽함.",
  "isPublic": true,
  "imageUrls": [
    "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800"
  ],
  "tasteNotes": {
    "broth": ["진해요", "감칠맛 좋아요"],
    "noodle": ["탄력 있어요", "단단해요"],
    "seasoning": ["딱 좋아요"],
    "topping": ["차슈 좋아요", "멘마 좋아요"]
  }
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "code": "LOG_CREATED",
  "message": "라멘로그가 성공적으로 기록되었습니다.",
  "data": {
    "id": 501,
    "logNumber": 44,
    "isLevelUp": false,
    "createdAt": "2026-09-04T14:10:00Z"
  }
}
```

---

#### [GET] `/ramen-logs/calendar` - 완식 캘린더 히트맵 데이터 조회
- **설명**: GitHub 스타일의 활동 캘린더를 렌더링하기 위해 연도별/월별 날짜별 완식 횟수와 상세 로그 요약을 조회합니다.
- **Headers**: `Authorization: Bearer <token>`
- **Query Params**:
  - `year`: 조회 연도 (기본값: 현재 연도, 예: `2026`)
- **Response (200 OK)**:
```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "캘린더 데이터 조회가 완료되었습니다.",
  "data": {
    "totalCount": 43,
    "activities": [
      {
        "date": "2026-09-01",
        "count": 1,
        "level": 1,
        "logs": [
          { "id": 489, "shopName": "멘야준", "menuName": "시오라멘" }
        ]
      },
      {
        "date": "2026-09-03",
        "count": 2,
        "level": 2,
        "logs": [
          { "id": 495, "shopName": "세상끝의라멘", "menuName": "끝라멘" },
          { "id": 496, "shopName": "라무라", "menuName": "녹(닭라멘)" }
        ]
      }
    ]
  }
}
```

---

#### [POST] `/ramen-logs/{logId}/likes` - 라멘로그 공감(좋아요) 토글
- **설명**: 라멘로그에 공감을 누르거나 취소합니다. 공감 시 작성자에게 실시간 알림이 발송됩니다.
- **Headers**: `Authorization: Bearer <token>`
- **Response (200 OK)**:
```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "공감 상태가 변경되었습니다.",
  "data": {
    "logId": 501,
    "isLiked": true,
    "likeCount": 18
  }
}
```

---

### 3.3 라멘 매장 & 지도 (Shop)

#### [GET] `/shops` - 라멘집 검색 및 필터 목록 조회
- **설명**: 사용자 현 위치(위도/경도)를 기준으로 거리순/평점순 정렬 및 라멘 계열(쇼유, 돈코츠 등), 영업 여부 필터를 적용하여 목록을 반환합니다.
- **Query Params**:
  - `lat`: 위도 (예: `37.5563`)
  - `lng`: 경도 (예: `126.9224`)
  - `radius`: 검색 반경 미터 (기본: `5000`)
  - `ramenType`: 계열 필터 (예: `쇼유`, `돈코츠`, `ALL`)
  - `onlyOpen`: 영업 중 매장만 보기 여부 (`true` / `false`)
  - `keyword`: 상호명 또는 지역 검색 키워드 (예: `망원`, `멘야`)
  - `page`: 페이지 번호 (0부터 시작)
  - `size`: 페이지당 건수 (기본: `20`)
- **Response (200 OK)**:
```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "매장 목록 조회가 완료되었습니다.",
  "data": {
    "content": [
      {
        "id": 101,
        "name": "멘야준",
        "branch": "망원 본점",
        "address": "서울 마포구 월드컵로13길 19-23",
        "lat": 37.55628,
        "lng": 126.90731,
        "phone": "070-1234-5678",
        "rating": 4.8,
        "reviewCount": 384,
        "isOpen": true,
        "openingHours": ["11:00 - 20:00 (브레이크타임 15:00 - 17:00)"],
        "priceRange": "1~2만원대",
        "dineIn": true,
        "delivery": false,
        "matchScore": 96,
        "distanceM": 320,
        "tags": ["닭육수", "시오라멘", "자가제면"],
        "photos": [
          "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600"
        ],
        "servicePerks": {
          "noodleRefill": "면 추가 1회 무료",
          "riceRefill": "공깃밥 요청 시 무료",
          "soupRefill": "와리스프 제공"
        },
        "isBookmarked": true
      }
    ],
    "page": 0,
    "size": 20,
    "totalElements": 84,
    "totalPages": 5,
    "last": false
  }
}
```

---

#### [POST] `/shops/{shopId}/bookmarks` - 매장 북마크 토글
- **설명**: 관심 매장 저장 / 해제 토글
- **Headers**: `Authorization: Bearer <token>`
- **Response (200 OK)**:
```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "북마크 상태가 변경되었습니다.",
  "data": {
    "shopId": 101,
    "isBookmarked": true
  }
}
```

---

### 3.4 커뮤니티 라운지 (Community)

#### [GET] `/community/posts` - 라운지 피드 게시글 목록 조회
- **Query Params**:
  - `category`: `ALL` | `REVIEW` | `QUESTION` | `INFO` | `DAILY`
  - `shopId`: 특정 매장 태그 필터링 (선택)
  - `sort`: `LATEST` (최신순) | `POPULAR` (인기순)
  - `page`: 페이지 번호 (기본: 0)
- **Response (200 OK)**:
```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "게시글 목록이 조회되었습니다.",
  "data": {
    "content": [
      {
        "id": 201,
        "category": "REVIEW",
        "title": "망원 멘야준 특제 시오라멘 인생 라멘 등극",
        "content": "맑은 닭육수에 감칠맛 터지는 소금 타래 조합이 예술입니다. 멘마 퀄리티도 미쳤네요.",
        "author": {
          "id": 1,
          "nickname": "합정라멘마스터",
          "levelTitle": "라멘 미식가",
          "avatarUrl": "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120"
        },
        "shop": {
          "id": 101,
          "name": "멘야준",
          "branch": "망원 본점"
        },
        "images": [
          "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800"
        ],
        "likeCount": 38,
        "commentCount": 7,
        "isLiked": false,
        "createdAt": "2026-09-04T12:30:00Z"
      }
    ],
    "page": 0,
    "size": 15,
    "totalElements": 156,
    "totalPages": 11,
    "last": false
  }
}
```

---

#### [POST] `/community/posts/{postId}/comments` - 댓글 / 대댓글 작성
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
```json
{
  "parentId": null,
  "content": "저도 저번 주에 다녀왔는데 차슈 추가는 무조건 필수입니다 ㅎㅎ"
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "code": "COMMENT_CREATED",
  "message": "댓글이 등록되었습니다.",
  "data": {
    "id": 802,
    "postId": 201,
    "parentId": null,
    "content": "저도 저번 주에 다녀왔는데 차슈 추가는 무조건 필수입니다 ㅎㅎ",
    "author": {
      "id": 2,
      "nickname": "홍대라멘러버",
      "levelTitle": "라멘 탐험가",
      "avatarUrl": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120"
    },
    "createdAt": "2026-09-04T14:12:00Z"
  }
}
```

---

### 3.5 AI 맞춤 추천 (AI Recommendation)

#### [POST] `/recommendations/ai` - AI 취향 벡터 기반 맞춤 라멘집 추천
- **설명**: 유저가 선택한 육수 농도, 면 굵기, 간, 선호 분위기 조건 및 과거 완식 데이터를 조합하여 가장 일치율이 높은 매장 3곳을 매칭해 반환합니다.
- **Request Body**:
```json
{
  "preferredSoup": "쇼유 (간장)",
  "preferredDensity": "진한 농도",
  "preferredNoodle": "단단한 카타메(固め)",
  "vibe": "혼밥하기 편한 바 테이블",
  "userLat": 37.5563,
  "userLng": 126.9224
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "AI 취향 분석 추천 결과가 생성되었습니다.",
  "data": {
    "tasteVectorSummary": "진한 감칠맛 쇼유 & 탄력 카타메면 선호형",
    "recommendedShops": [
      {
        "shopId": 101,
        "name": "멘야준",
        "branch": "망원 본점",
        "matchRate": 98,
        "matchReason": "회원님의 84% 쇼유 선호 DNA와 단단한 면 취향에 98% 부합하는 망원 대표 맛집",
        "recommendedMenu": "특제 쇼유라멘 (차슈 추가)",
        "distanceM": 320
      },
      {
        "shopId": 105,
        "name": "세상끝의라멘",
        "branch": "합정점",
        "matchRate": 94,
        "matchReason": "오사카 다카이다풍의 진하고 묵직한 간장 풍미를 자랑하는 혼밥 최적화 매장",
        "recommendedMenu": "끝라멘 (흑간장)",
        "distanceM": 750
      }
    ]
  }
}
```

---

### 3.6 실시간 알림 (Notification)

#### [GET] `/notifications` - 내 알림 목록 조회
- **Headers**: `Authorization: Bearer <token>`
- **Response (200 OK)**:
```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "알림 목록이 조회되었습니다.",
  "data": {
    "unreadCount": 3,
    "notifications": [
      {
        "id": "notif-101",
        "type": "like",
        "title": "라멘로그 공감",
        "content": "홍대라멘러버님이 회원님의 [멘야준] 라멘로그에 공감했습니다 🍜",
        "time": "10분 전",
        "isRead": false,
        "targetScreen": "MY",
        "senderName": "홍대라멘러버",
        "avatar": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120"
      },
      {
        "id": "notif-102",
        "type": "shop",
        "title": "단골 라멘집 소식",
        "content": "[세상끝의라멘] 가을 한정 바지락 시오라멘 출시!",
        "time": "1시간 전",
        "isRead": false,
        "targetScreen": "MAP",
        "targetShopId": 105,
        "shopName": "세상끝의라멘"
      }
    ]
  }
}
```

---

#### [GET] `/notifications/subscribe` - SSE(Server-Sent Events) 실시간 알림 구독
- **설명**: 클라이언트 접속 시 백엔드와 연결을 유지하여 신규 공감, 댓글, 레벨업 알림을 실시간 Push로 수신합니다.
- **Headers**:
  - `Authorization: Bearer <token>`
  - `Accept: text/event-stream`
- **Stream Event Example**:
```
event: notification
id: notif-103
data: {"id":"notif-103","type":"like","title":"라멘로그 공감","content":"새로운 공감이 도착했습니다!","time":"방금 전","isRead":false}

: ping
```

---

#### [PUT] `/notifications/settings` - 알림 수신 설정 변경
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
```json
{
  "pushEnabled": true,
  "likesEnabled": true,
  "commentsEnabled": true,
  "levelUpEnabled": true,
  "shopNewsEnabled": false
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "알림 설정이 성공적으로 저장되었습니다.",
  "data": {
    "pushEnabled": true,
    "likesEnabled": true,
    "commentsEnabled": true,
    "levelUpEnabled": true,
    "shopNewsEnabled": false
  }
}
```

---

## 4. 에러 코드 정의표 (Error Codes)

| HTTP Status | 에러 코드 | 메시지 설명 |
| :--- | :--- | :--- |
| `400 Bad Request` | `INVALID_INPUT_VALUE` | 입력 필드 유효성 검증(Validation) 실패 |
| `401 Unauthorized` | `INVALID_AUTH_TOKEN` | 인증 토큰이 유효하지 않거나 만료됨 |
| `401 Unauthorized` | `EXPIRED_ACCESS_TOKEN` | Access Token 만료 (Reissue 필요) |
| `403 Forbidden` | `ACCESS_DENIED` | 본인이 작성하지 않은 글/로그 수정/삭제 시도 |
| `404 Not Found` | `MEMBER_NOT_FOUND` | 존재하지 않는 회원 ID |
| `404 Not Found` | `SHOP_NOT_FOUND` | 존재하지 않는 라멘 매장 ID |
| `404 Not Found` | `LOG_NOT_FOUND` | 존재하지 않는 라멘로그 ID |
| `404 Not Found` | `POST_NOT_FOUND` | 존재하지 않는 라운지 게시글 ID |
| `409 Conflict` | `DUPLICATE_NICKNAME` | 이미 사용 중인 닉네임 |
| `500 Internal Error` | `INTERNAL_SERVER_ERROR` | 서버 내부 로직 처리 오류 |
