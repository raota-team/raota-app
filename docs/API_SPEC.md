# RAOTA 모바일 API 명세

> 상태: 모바일 프로토타입 기준 v2 계약 초안
>
> 서버: Spring Boot
>
> 데이터 모델: [`ERD.md`](./ERD.md)

이 문서는 `src/App.tsx`에서 실제 진입 가능한 모바일 화면과 `src/types.ts`의 모델을 서버 계약으로 정리한 것이다. 기존 API와 데이터를 보존하기 위해 모바일 API는 `/api/v2`로 분리한다.

## 1. 확정한 계약

- 운영 로그인: `KAKAO`, `GOOGLE`, `APPLE` OAuth + JWT access/refresh token
- 기록 입력: 국물·면·양념·토핑의 4개 태그 그룹 + 재방문 의향
- 취향 분석: 입력이 아니라 서버가 계산하는 5축 Taste DNA
- 커뮤니티 카테고리: `REVIEW`, `TIP`, `QUESTION`, `FREE`
- 뉴스 카테고리: `LIMITED_MENU`, `BUSINESS_NOTICE`, `EVENT`
- 시간: 서버는 UTC ISO-8601을 반환하고 `10분 전` 같은 문구는 클라이언트가 만든다.
- 날짜: 방문일과 리포트 기준일은 `YYYY-MM-DD`로 주고받는다.
- ID: JSON에서는 정수형 ID를 사용한다. 외부 식별자는 `googlePlaceId`처럼 명시한다.
- 좋아요·북마크·소식 구독은 모바일 재시도에 안전하도록 `PUT`/`DELETE`로 상태를 명시한다.
- 피드성 목록은 `(createdAt, id)` 기반 불투명 cursor pagination을 사용한다.

프로토타입의 이메일/비밀번호, 패스키, 데모 로그인은 제품 결정 전까지 v2 서버 범위에서 제외한다. 회원가입 화면은 OAuth 로그인 직후의 온보딩으로 해석한다.

## 2. 공통 통신 규칙

### 2.1 기본 정보

| 항목 | 값 |
|---|---|
| 운영 Base URL | `https://api.raota.app/api/v2` |
| 개발 Base URL | `http://localhost:8080/api/v2` |
| Content-Type | `application/json; charset=UTF-8` |
| 인증 | `Authorization: Bearer {accessToken}` |
| 요청 추적 | 응답 헤더 `X-Request-Id` |

인증이 선택인 공개 조회는 토큰이 있으면 `viewerState`를 포함하고, 없으면 `viewerState`를 `null`로 반환한다.

### 2.2 성공 응답

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "2ba8a8e2-51f6-4a1e-a77b-e21773ef2555"
  }
}
```

`204 No Content` 응답에는 body를 두지 않는다.

### 2.3 오류 응답

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "요청 값을 확인해 주세요.",
    "fields": [
      { "field": "nickname", "reason": "2자 이상 12자 이하로 입력해 주세요." }
    ]
  },
  "meta": {
    "requestId": "2ba8a8e2-51f6-4a1e-a77b-e21773ef2555"
  }
}
```

| HTTP | 대표 코드 | 의미 |
|---:|---|---|
| 400 | `VALIDATION_ERROR`, `INVALID_CURSOR` | 형식/검증 오류 |
| 401 | `UNAUTHORIZED`, `TOKEN_EXPIRED` | 인증 필요 또는 만료 |
| 403 | `FORBIDDEN`, `WITHDRAW_PENDING` | 권한 없음/탈퇴 처리 중 |
| 404 | `RESOURCE_NOT_FOUND` | 대상 없음 또는 삭제됨 |
| 409 | `DUPLICATE_NICKNAME`, `CONFLICT` | 현재 상태와 충돌 |
| 410 | `UPLOAD_TICKET_EXPIRED` | 업로드 티켓 만료 |
| 429 | `RATE_LIMITED` | 요청 한도 초과 |
| 500 | `INTERNAL_ERROR` | 서버 내부 오류 |

### 2.4 Cursor pagination

요청:

```http
GET /ramen-logs?cursor=eyJjcmVhdGVkQXQiOiIuLi4ifQ&size=20
```

- `size`: 기본 20, 최대 50
- `cursor`: 서버가 발급한 불투명 문자열. 클라이언트가 해석하거나 생성하지 않는다.

응답:

```json
{
  "success": true,
  "data": {
    "items": [],
    "nextCursor": "eyJjcmVhdGVkQXQiOiIuLi4ifQ",
    "hasNext": true
  },
  "meta": { "requestId": "..." }
}
```

### 2.5 멱등성

라멘 기록, 게시글, 댓글 생성에는 선택 헤더 `Idempotency-Key`를 지원한다. 같은 사용자와 키로 같은 요청이 재전송되면 최초 응답을 돌려주며, 다른 payload면 `409 CONFLICT`를 반환한다.

## 3. Endpoint 목록

`인증` 열의 `선택`은 비로그인도 조회 가능하지만 로그인 사용자의 상태가 추가되는 API다.

### 3.1 홈과 인증

| Method | Path | 인증 | 용도 |
|---|---|---|---|
| GET | `/home` | 선택 | 홈 큐레이션, 인기/주변 매장, 내 요약, 미확인 알림 수 |
| POST | `/auth/oauth/login` | 불필요 | OAuth code 검증 및 로그인/가입 시작 |
| POST | `/auth/token/reissue` | refresh | access/refresh token rotation |
| POST | `/auth/logout` | 필요 | 현재 세션 폐기 |
| POST | `/auth/logout-all` | 필요 | 모든 세션과 기기 토큰 폐기 |

### 3.2 회원과 활동

| Method | Path | 인증 | 용도 |
|---|---|---|---|
| GET | `/members/me` | 필요 | 내 프로필과 활동 요약 |
| PATCH | `/members/me` | 필요 | 이메일, 프로필, 선호 라멘 수정 |
| PUT | `/members/me/onboarding` | 필요 | 닉네임·프로필·약관 동의 완료 |
| GET | `/members/nickname-availability?nickname=` | 필요 | 닉네임 사용 가능 여부 |
| POST | `/members/me/withdrawal` | 필요 | 탈퇴 요청 및 즉시 세션 폐기 |
| GET | `/members/{memberId}` | 선택 | 공개 프로필 |
| GET | `/members/{memberId}/ramen-logs` | 선택 | 공개 로그 목록 |
| GET | `/members/me/calendar?from=&to=` | 필요 | 방문일별 기록 수/매장 요약 |
| GET | `/members/me/visited-shops` | 필요 | 방문한 매장 목록 |
| GET | `/members/me/bookmarked-shops` | 필요 | 저장한 매장 목록 |
| GET | `/members/me/community-posts` | 필요 | 내가 쓴 글 |
| GET | `/members/me/community-comments` | 필요 | 내가 쓴 댓글 |

### 3.3 취향 리포트와 AI 추천

| Method | Path | 인증 | 용도 |
|---|---|---|---|
| GET | `/taste-reports/current` | 필요 | 최신 전체 기간 Taste DNA |
| POST | `/taste-reports/current/refresh` | 필요 | 전체 기간 리포트 재계산 요청 |
| GET | `/taste-reports/monthly` | 필요 | 월간 리포트 아카이브 |
| GET | `/taste-reports/{reportId}` | 필요 | 보존된 리포트 상세 |
| GET | `/taste-note-definitions` | 선택 | 기록 폼의 4개 태그 그룹 정의 |
| POST | `/ai/recommendations` | 필요 | 취향·상황·위치 기반 추천 |

### 3.4 파일

| Method | Path | 인증 | 용도 |
|---|---|---|---|
| POST | `/files/upload-tickets` | 필요 | 프로필/로그/게시글 이미지 업로드 URL 발급 |

### 3.5 매장과 소식

| Method | Path | 인증 | 용도 |
|---|---|---|---|
| GET | `/shops` | 선택 | 지도/목록 검색, 필터, 정렬 |
| GET | `/shops/{shopId}` | 선택 | 매장 상세 |
| GET | `/shops/{shopId}/menus` | 선택 | 판매 메뉴 목록 |
| PUT | `/shops/{shopId}/bookmark` | 필요 | 북마크 상태를 저장으로 지정 |
| DELETE | `/shops/{shopId}/bookmark` | 필요 | 북마크 해제 |
| GET | `/shop-news` | 선택 | 매장 소식 피드 |
| PUT | `/shops/{shopId}/news-subscription` | 필요 | 매장 소식 알림 구독 |
| DELETE | `/shops/{shopId}/news-subscription` | 필요 | 매장 소식 알림 해제 |

### 3.6 라멘 로그

| Method | Path | 인증 | 용도 |
|---|---|---|---|
| GET | `/ramen-logs` | 선택 | 공개 로그 피드 |
| POST | `/ramen-logs` | 필요 | 기록 생성 |
| GET | `/ramen-logs/{logId}` | 선택 | 기록 상세 |
| PATCH | `/ramen-logs/{logId}` | 필요 | 내 기록 수정 |
| DELETE | `/ramen-logs/{logId}` | 필요 | 내 기록 삭제 |
| PUT | `/ramen-logs/{logId}/like` | 필요 | 공감 상태를 활성화 |
| DELETE | `/ramen-logs/{logId}/like` | 필요 | 공감 해제 |

### 3.7 커뮤니티

| Method | Path | 인증 | 용도 |
|---|---|---|---|
| GET | `/community/posts` | 선택 | 글 목록/카테고리/인기 정렬 |
| POST | `/community/posts` | 필요 | 글 생성 |
| GET | `/community/posts/{postId}` | 선택 | 글과 댓글 상세 |
| PATCH | `/community/posts/{postId}` | 필요 | 내 글 수정 |
| DELETE | `/community/posts/{postId}` | 필요 | 내 글 삭제 |
| PUT | `/community/posts/{postId}/like` | 필요 | 좋아요 활성화 |
| DELETE | `/community/posts/{postId}/like` | 필요 | 좋아요 해제 |
| POST | `/community/posts/{postId}/comments` | 필요 | 댓글 또는 답글 생성 |
| DELETE | `/community/comments/{commentId}` | 필요 | 내 댓글 삭제 |

### 3.8 알림과 기기

| Method | Path | 인증 | 용도 |
|---|---|---|---|
| GET | `/notifications` | 필요 | 알림 목록과 탭 필터 |
| PUT | `/notifications/{notificationId}/read` | 필요 | 한 건 읽음 처리 |
| PUT | `/notifications/read-all` | 필요 | 전체 또는 탭별 읽음 처리 |
| GET | `/notification-settings` | 필요 | 알림 설정 조회 |
| PATCH | `/notification-settings` | 필요 | 알림 설정 변경 |
| PUT | `/devices/{installationId}` | 필요 | 푸시 토큰과 앱 설치 정보 upsert |
| DELETE | `/devices/{installationId}` | 필요 | 로그아웃/토큰 폐기 |
| POST | `/notifications/stream-ticket` | 필요 | 단기 SSE 접속 티켓 발급 |
| GET | `/notifications/subscribe?ticket=` | ticket | 알림 SSE 구독 |

## 4. 핵심 계약 상세

### 4.1 홈

#### `GET /home`

Query:

| 이름 | 필수 | 설명 |
|---|---|---|
| `latitude`, `longitude` | 선택 | 둘을 함께 전달. 주변 매장 거리/정렬에 사용 |
| `timezone` | 선택 | 예: `Asia/Seoul`, 기본은 사용자 설정 |

```json
{
  "success": true,
  "data": {
    "me": {
      "nickname": "라멘헌터",
      "levelNumber": 30,
      "levelName": "라멘집 단골",
      "publicLogCount": 34
    },
    "unreadNotificationCount": 3,
    "todayCuration": {
      "id": 81,
      "title": "오늘은 진한 돈코츠",
      "description": "비 오는 날 어울리는 한 그릇",
      "shop": { "id": 12, "name": "멘야 하루", "thumbnailUrl": "https://..." }
    },
    "mostViewedShops": [],
    "nearbyShops": [],
    "aiRecommendationAvailable": true
  },
  "meta": { "requestId": "..." }
}
```

비로그인 응답의 `me`와 개인 알림 수는 `null`이다.

### 4.2 OAuth 로그인과 토큰 회전

#### `POST /auth/oauth/login`

```json
{
  "provider": "KAKAO",
  "authorizationCode": "provider-issued-code",
  "redirectUri": "raota://oauth/callback",
  "codeVerifier": "pkce-code-verifier",
  "installationId": "01J7...",
  "platform": "IOS"
}
```

```json
{
  "success": true,
  "data": {
    "accessToken": "...",
    "accessTokenExpiresAt": "2026-09-04T09:30:00Z",
    "refreshToken": "...",
    "refreshTokenExpiresAt": "2026-10-04T09:00:00Z",
    "onboardingRequired": true,
    "member": { "id": 101, "status": "ONBOARDING" }
  },
  "meta": { "requestId": "..." }
}
```

refresh token은 매 재발급 시 회전한다. 이미 사용된 token family가 다시 제출되면 해당 family 전체를 폐기한다.

### 4.3 온보딩과 내 프로필

#### `PUT /members/me/onboarding`

```json
{
  "nickname": "라멘헌터",
  "avatarObjectKey": "users/101/avatar/01J7.jpg",
  "favoriteRamenType": "돈코츠",
  "bio": "진한 국물을 좋아해요",
  "consents": [
    { "type": "TERMS", "version": "2026-08-01", "granted": true },
    { "type": "PRIVACY", "version": "2026-08-01", "granted": true },
    { "type": "MARKETING", "version": "2026-08-01", "granted": false }
  ]
}
```

- 닉네임은 trim 후 2~12자이며 정규화 값이 유일해야 한다.
- `TERMS`, `PRIVACY`의 현재 버전 동의가 필수다.
- 업로드 이미지에는 서버가 발급한 `objectKey`만 허용한다.

#### `GET /members/me`

```json
{
  "success": true,
  "data": {
    "id": 101,
    "nickname": "라멘헌터",
    "email": "user@example.com",
    "avatarUrl": "https://...",
    "bio": "진한 국물을 좋아해요",
    "favoriteRamenType": "돈코츠",
    "level": { "number": 30, "name": "라멘집 단골", "nextThreshold": 50 },
    "stats": {
      "visitedCount": 34,
      "visitedShopCount": 21,
      "revisitCount": 13,
      "longestStreakDays": 5,
      "publicLogCount": 34
    }
  },
  "meta": { "requestId": "..." }
}
```

#### `POST /members/me/withdrawal`

```json
{
  "reasonCode": "NO_LONGER_NEEDED",
  "confirmation": "WITHDRAW"
}
```

성공 시 모든 세션과 기기를 폐기한 뒤 `204`를 반환한다. 같은 OAuth 계정은 요청 시점부터 30일 동안 재가입할 수 없다.

### 4.4 이미지 업로드

#### `POST /files/upload-tickets`

```json
{
  "purpose": "RAMEN_LOG",
  "files": [
    { "contentType": "image/jpeg", "size": 1839204, "extension": "jpg" }
  ]
}
```

`purpose`: `PROFILE`, `RAMEN_LOG`, `COMMUNITY_POST`

```json
{
  "success": true,
  "data": {
    "uploads": [
      {
        "objectKey": "ramen-logs/101/01J7.jpg",
        "uploadUrl": "https://storage.example/signed-url",
        "method": "PUT",
        "headers": { "Content-Type": "image/jpeg" },
        "expiresAt": "2026-09-04T09:10:00Z"
      }
    ]
  },
  "meta": { "requestId": "..." }
}
```

클라이언트는 스토리지 업로드 성공 후 `objectKey`를 도메인 생성/수정 API에 넘긴다. URL 임의 주입은 허용하지 않는다.

### 4.5 매장 검색과 상세

#### `GET /shops`

| Query | 값/설명 |
|---|---|
| `query` | 이름/주소 검색어 |
| `region` | 지역 코드 |
| `ramenType` | 라멘 유형 |
| `openNow` | `true`면 현재 영업 중만 |
| `latitude`, `longitude` | 거리 계산 기준점 |
| `radiusMeters` | 기본 3000, 최대 20000 |
| `sort` | `DISTANCE`, `POPULAR`, `NAME` |
| `cursor`, `size` | cursor pagination |

```json
{
  "id": 12,
  "name": "멘야 하루",
  "branchName": "성수점",
  "address": "서울 ...",
  "location": { "latitude": 37.544, "longitude": 127.056 },
  "distanceMeters": 480,
  "ramenTypes": ["돈코츠"],
  "thumbnailUrl": "https://...",
  "externalRating": 4.6,
  "externalReviewCount": 211,
  "logCount": 38,
  "isOpenNow": true,
  "viewerState": { "bookmarked": true, "newsSubscribed": false }
}
```

`POPULAR`은 `viewCount`, `bookmarkCount`, `logCount`에 최근성 보정을 적용한 서버 점수다. 지도 클러스터링은 현재 프로토타입처럼 클라이언트에서 수행하며, 데이터 규모가 커지면 viewport/cluster API를 별도 버전으로 추가한다.

#### `GET /shops/{shopId}`

목록 필드에 다음을 추가한다.

```json
{
  "phone": "02-000-0000",
  "priceLevel": 2,
  "businessStatus": "OPERATIONAL",
  "businessHours": [
    { "dayOfWeek": 1, "periods": [{ "opensAt": "11:30", "closesAt": "21:00" }] }
  ],
  "serviceOptions": {
    "dineIn": true,
    "delivery": false,
    "reservable": true,
    "parkingAvailable": false
  },
  "images": [{ "url": "https://...", "width": 1200, "height": 900 }],
  "aiReviewSummary": "진한 국물과 단단한 면이 자주 언급됩니다.",
  "externalLinks": {
    "instagram": "https://...",
    "reservation": "https://..."
  },
  "externalReviews": []
}
```

### 4.6 매장 소식

#### `GET /shop-news`

Query: `category`, `shopId`, `subscribedOnly`, `cursor`, `size`

```json
{
  "id": 501,
  "category": "LIMITED_MENU",
  "shop": { "id": 12, "name": "멘야 하루", "branchName": "성수점" },
  "title": "가을 한정 츠케멘 출시",
  "summary": "9월 한 달 동안 한정 판매합니다.",
  "imageUrl": "https://...",
  "source": { "name": "@menya_haru", "url": "https://instagram.com/..." },
  "publishedAt": "2026-09-04T08:30:00Z",
  "viewerState": { "newsSubscribed": true }
}
```

소식 알림 설정은 개별 소식이 아니라 매장 단위 구독이다.

### 4.7 라멘 로그

#### `GET /taste-note-definitions`

```json
{
  "success": true,
  "data": {
    "groups": [
      {
        "category": "BROTH",
        "label": "국물",
        "options": [
          { "code": "RICH", "label": "진한 국물" },
          { "code": "LIGHT", "label": "깔끔한 국물" }
        ]
      }
    ],
    "version": "2026-09-01"
  },
  "meta": { "requestId": "..." }
}
```

응답은 장기 캐시할 수 있으며 `version`이 바뀌면 기록 폼의 로컬 캐시를 갱신한다. 비활성 태그는 신규 선택지에서 제외하되 과거 로그 조회에서는 label 스냅샷 또는 정의 이력으로 계속 표시해야 한다.

#### `POST /ramen-logs`

```json
{
  "shopId": 12,
  "visitedAt": "2026-09-04",
  "menuName": "특제 돈코츠 라멘",
  "ramenType": "돈코츠",
  "revisitIntention": "OFTEN",
  "note": "국물이 진하지만 느끼하지 않았고 면 식감이 좋았다.",
  "tasteNoteCodes": {
    "broth": ["RICH", "CREAMY"],
    "noodle": ["FIRM"],
    "seasoning": ["UMAMI"],
    "topping": ["TENDER_CHASHU"]
  },
  "visibility": "PUBLIC",
  "imageObjectKeys": ["ramen-logs/101/01J7.jpg"]
}
```

검증:

- `shopId`, `visitedAt`, `menuName`, `revisitIntention`, `note`, `visibility` 필수
- `note` 최대 1,000자
- `visitedAt`은 사용자의 현지 미래 날짜일 수 없음
- 태그는 선택 입력이며 각 code의 카테고리가 요청 key와 일치해야 함
- 현재 화면은 이미지 1개를 사용한다. API/스키마는 향후 확장을 위해 최대 5개까지 허용한다.

`revisitIntention`: `OFTEN`, `SOMETIMES`, `ONCE_IS_ENOUGH`

생성 성공 시 `201`과 생성된 상세를 반환한다. 공개 로그 수, 등급, 매장 로그 수, 전체 취향 리포트 갱신 이벤트는 같은 요청에서 유실되지 않도록 트랜잭션/outbox로 처리한다.

#### `GET /ramen-logs`

Query: `shopId`, `memberId`, `sort=LATEST|LIKES`, `cursor`, `size`

```json
{
  "id": 9001,
  "author": { "id": 101, "nickname": "라멘헌터", "avatarUrl": "https://..." },
  "shop": { "id": 12, "name": "멘야 하루" },
  "visitedAt": "2026-09-04",
  "menuName": "특제 돈코츠 라멘",
  "ramenType": "돈코츠",
  "revisitIntention": "OFTEN",
  "note": "국물이 진하지만 느끼하지 않았다.",
  "tasteNotes": [
    { "category": "BROTH", "code": "RICH", "label": "진한 국물" }
  ],
  "images": [{ "url": "https://...", "width": 1200, "height": 1200 }],
  "likeCount": 8,
  "createdAt": "2026-09-04T09:00:00Z",
  "viewerState": { "liked": false, "editable": false }
}
```

비공개 로그는 작성자 본인의 `/members/me` 계열 조회에서만 반환한다.

### 4.8 Taste DNA 리포트

#### `GET /taste-reports/current`

```json
{
  "success": true,
  "data": {
    "id": 7001,
    "reportType": "ALL_TIME",
    "title": "진한 국물의 면 식감 탐험가",
    "level": { "number": 30, "name": "라멘집 단골" },
    "quote": "묵직한 국물 속에서도 면의 존재감을 찾는 취향",
    "sourceLogCount": 34,
    "metrics": {
      "brothConcentration": 86,
      "noodleFirmness": 72,
      "salinityBalance": 61,
      "tareUmami": 79,
      "oilRichness": 68
    },
    "tags": ["진한 국물", "단단한 면"],
    "insights": [],
    "topShops": [],
    "styleBreakdown": [],
    "comparison": null,
    "generatedAt": "2026-09-04T09:00:05Z"
  },
  "meta": { "requestId": "..." }
}
```

- 월간 리포트는 해당 월 로그가 3개 이상이면 다음 달 1일 생성한다.
- 월간 리포트는 생성 당시 결과를 영구 보존한다.
- 전체 리포트 refresh는 동시 중복 실행을 합치며 `202 Accepted`와 작업 상태를 반환할 수 있다.
- 공유 링크가 필요하면 별도의 만료형 share-token API로 추가하며 내부 report ID만 공개 링크로 사용하지 않는다.

### 4.9 커뮤니티

#### `GET /community/posts`

Query:

- `category=REVIEW|TIP|QUESTION|FREE`
- `shopId`
- `sort=LATEST|POPULAR`
- `cursor`, `size`

`POPULAR`은 필터/정렬 옵션이며 저장 category가 아니다.

#### `POST /community/posts`

```json
{
  "category": "REVIEW",
  "title": "성수에서 찾은 진한 돈코츠",
  "content": "면과 국물의 밸런스가 좋았습니다.",
  "shopId": 12,
  "imageObjectKey": "community/101/01J8.jpg"
}
```

- `REVIEW`만 `shopId`를 받을 수 있으며 선택 입력이다.
- 게시글 이미지는 현재 프로토타입 기준 최대 1개다.
- 댓글 좋아요는 현재 화면에 동작이 없어 v2에서 제공하지 않는다.

#### `POST /community/posts/{postId}/comments`

```json
{
  "content": "저도 다음에 가봐야겠어요.",
  "parentCommentId": null
}
```

답글은 한 단계까지만 허용한다. 답글에 답글을 요청하면 원댓글을 parent로 정규화하거나 `VALIDATION_ERROR`를 반환하는 정책 중 하나로 구현 전에 고정한다. v2 기본 계약은 `VALIDATION_ERROR`다.

### 4.10 AI 추천

#### `POST /ai/recommendations`

```json
{
  "selectedSoup": "진한 국물",
  "selectedMood": "혼밥",
  "selectedPriority": "가까운 거리",
  "customPrompt": "웨이팅이 너무 길지 않았으면 좋겠어",
  "location": { "latitude": 37.544, "longitude": 127.056 }
}
```

```json
{
  "success": true,
  "data": {
    "summary": "현재 위치에서 가까우며 진한 국물 평가가 많은 매장을 골랐어요.",
    "recommendations": [
      {
        "shop": { "id": 12, "name": "멘야 하루", "distanceMeters": 480 },
        "matchScore": 92,
        "reasons": ["진한 국물 취향 일치", "혼밥 좌석 언급이 많음"]
      }
    ]
  },
  "meta": { "requestId": "..." }
}
```

추천 결과는 저장된 취향과 요청 조건을 함께 사용한다. 위치 미동의 시 `location`을 생략할 수 있고 거리 우선 조건은 비활성화한다.

### 4.11 알림, 설정, 실시간 구독

#### `GET /notifications`

Query: `tab=ALL|ACTIVITY|SHOP|SYSTEM`, `unreadOnly`, `cursor`, `size`

탭 매핑:

| tab | notification type |
|---|---|
| `ACTIVITY` | `LIKE`, `COMMENT`, `LEVEL` |
| `SHOP` | `SHOP_NEWS` |
| `SYSTEM` | `NOTICE` |

```json
{
  "id": 301,
  "type": "COMMENT",
  "title": "새 댓글이 달렸어요",
  "body": "라멘고수님이 회원님의 글에 댓글을 남겼습니다.",
  "actor": { "id": 55, "nickname": "라멘고수", "avatarUrl": "https://..." },
  "target": {
    "type": "COMMUNITY_POST",
    "id": 701,
    "deepLink": "raota://community/posts/701"
  },
  "readAt": null,
  "createdAt": "2026-09-04T08:50:00Z"
}
```

알림 삭제는 현재 화면에 없으므로 v2에서 제공하지 않는다.

#### `PATCH /notification-settings`

```json
{
  "pushEnabled": true,
  "likeEnabled": true,
  "commentEnabled": true,
  "levelEnabled": false,
  "shopNewsEnabled": true
}
```

#### `PUT /devices/{installationId}`

```json
{
  "platform": "IOS",
  "pushToken": "fcm-or-apns-token",
  "appVersion": "1.0.0",
  "locale": "ko-KR",
  "timezone": "Asia/Seoul",
  "pushPermission": "GRANTED"
}
```

#### SSE 연결

브라우저 `EventSource`는 임의 Authorization 헤더 사용이 제한적이므로 access token을 query string에 넣지 않는다.

1. `POST /notifications/stream-ticket`에 Bearer token을 보내 60초 이내 만료되는 일회용 ticket을 받는다.
2. `GET /notifications/subscribe?ticket={ticket}`로 연결한다.
3. 연결 후 ticket은 즉시 소비한다.

이벤트 예:

```text
event: notification.created
id: 301
data: {"notificationId":301,"unreadCount":4}
```

푸시 알림은 앱이 background/offline일 때의 전달 수단이고 SSE는 foreground 갱신 수단이다. 둘은 같은 `notificationId`로 중복 제거한다.

## 5. 화면별 API 매핑

| 프로토타입 화면 | 주요 API |
|---|---|
| Home | `/home`, `/ai/recommendations` |
| Map | `/shops` |
| Shop detail | `/shops/{id}`, `/shops/{id}/menus`, bookmark |
| Record / Complete | upload ticket, `/taste-note-definitions`, `/ramen-logs`, `/taste-reports/current` |
| Lounge - Logs | `/ramen-logs`, log like |
| Lounge - Community | `/community/posts`, comments, post like |
| News feed | `/shop-news`, news subscription |
| My | `/members/me`, calendar, logs/visited/bookmarked/posts/comments |
| Taste detail | current/monthly taste reports |
| Notifications | notifications, settings, device, SSE |
| Login / Register | OAuth login, onboarding |

## 6. 구현 규칙

### 6.1 권한

- 기록/글/댓글 수정·삭제는 작성자 또는 관리자만 가능하다.
- 다른 사용자는 `PRIVATE` 로그를 ID로 직접 요청해도 `404`를 받는다.
- 정지/탈퇴 처리 중 회원은 공개 읽기 외 쓰기 API를 사용할 수 없다.
- `viewerState.editable`은 편의를 위한 값일 뿐 서버 권한 검사를 대체하지 않는다.

### 6.2 카운터와 이벤트

좋아요 수, 댓글 수, 매장 로그 수, 공개 로그 수는 원본 관계가 기준이고 화면용 컬럼은 캐시다. 관계 변경과 카운터 갱신은 같은 트랜잭션으로 처리하며, 취향 재계산·알림·푸시는 transactional outbox 이벤트로 연결한다.

### 6.3 개인정보와 로그

- OAuth token, JWT, refresh token, upload signed URL, push token을 애플리케이션 로그에 남기지 않는다.
- refresh token은 원문 저장하지 않고 해시만 저장한다.
- 위치는 추천/검색 요청 처리에만 사용하며 저장하려면 별도 동의와 보존 정책이 필요하다.
- 탈퇴 purge와 익명화 작업은 처리 건수와 결과만 감사 로그에 남긴다.

### 6.4 캐시

- 공개 매장 상세/홈 큐레이션은 짧은 TTL 캐시를 사용할 수 있다.
- `viewerState`, 미확인 알림 수, 내 프로필은 공유 캐시에 섞지 않는다.
- 좋아요/북마크 응답은 멱등 상태 변경 후 확정된 `active`와 최신 count를 반환한다.

## 7. 기존 초안에서 제외하거나 변경한 항목

| 항목 | v2 결정 |
|---|---|
| `/api/v1`에 모바일 기능 추가 | 기존 호환을 위해 `/api/v2`로 분리 |
| 사용자가 5축 점수를 직접 입력 | 4개 태그 그룹을 입력하고 5축은 파생 분석 |
| `isSoupFinished` | 실제 기록 화면에 없어 제외 |
| `INFO`, `DAILY` 게시판 | 실제 화면의 `TIP`, `FREE`로 교체 |
| `POPULAR` 게시판 카테고리 | 저장값이 아닌 정렬 옵션 |
| badge API/테이블 | 실제 화면에 배지 컬렉션이 없어 제외 |
| POST 방식 toggle API | 재시도 안전한 `PUT`/`DELETE`로 분리 |
| 서버의 `10분 전` 문자열 | ISO UTC 시각 반환 후 클라이언트 포맷 |
| Authorization 헤더 기반 `EventSource` | 단기 일회용 stream ticket 방식 |
| 댓글 좋아요 | 실제 동작이 없어 제외 |
| 이메일/패스키/데모 로그인 | 제품 결정 전 프로토타입 전용으로 분류 |

## 8. 버전 전환

1. v2 DB migration과 백필을 먼저 배포한다.
2. v1/v2 데이터 비교 지표와 카운터 재계산 검증을 통과시킨다.
3. 모바일 앱은 `/api/v2`만 사용하고 구버전 클라이언트는 `/api/v1`을 유지한다.
4. 안정화 기간 동안 v1 테이블과 API는 삭제하지 않는다.
5. 제거 시점은 구버전 활성 사용자, 데이터 보존 기간, 롤백 가능성을 확인한 뒤 별도 ADR로 승인한다.

구체적인 테이블, FK 삭제 정책, 데이터 이관 조건은 [`ERD.md`](./ERD.md)를 기준으로 한다.
