---
name: RAOTA Mobile
description: 웹 프로토타입과 똑같이 보이고 iOS답게 동작하는 라멘 기록 앱
colors:
  brand: "#E60000"
  brand-pressed: "#CC0000"
  brand-weak: "#FFF0F0"
  ink: "#16181A"
  ink-sub: "#4A4D52"
  text-muted: "#6B6E73"
  text-faint: "#BEBEBE"
  paper: "#FFF8EA"
  canvas: "#FFFFFF"
  canvas-soft: "#F2F2F2"
  surface-input: "#F7F7F7"
  border: "#16181A"
  hairline: "#E2E2E2"
  yolk: "#FFC93C"
  on-dark: "#FFFFFF"
  on-dark-muted: "rgba(255, 255, 255, 0.7)"
  positive: "#2E7D32"
  positive-weak: "#EBF8F0"
  warning: "#A15C00"
  warning-weak: "#FFF7D6"
  critical: "#D92228"
  critical-weak: "#FFF0F0"
  informative: "#3860BE"
  overlay: "rgba(0, 0, 0, 0.5)"
typography:
  counter:
    fontFamily: "System"
    fontSize: "56px"
    fontWeight: 900
    lineHeight: "56px"
    letterSpacing: "-2px"
  headline:
    fontFamily: "System"
    fontSize: "28px"
    fontWeight: 900
    lineHeight: "35px"
  screen-title:
    fontFamily: "System"
    fontSize: "22px"
    fontWeight: 900
    lineHeight: "29px"
  section-title:
    fontFamily: "System"
    fontSize: "20px"
    fontWeight: 900
    lineHeight: "27px"
  card-title:
    fontFamily: "System"
    fontSize: "16px"
    fontWeight: 800
    lineHeight: "22px"
  body:
    fontFamily: "System"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "22px"
  body-strong:
    fontFamily: "System"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: "22px"
  secondary:
    fontFamily: "System"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: "19px"
  meta:
    fontFamily: "System"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: "17px"
rounded:
  none: "0px"
  xs: "2px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  pill: "999px"
line:
  thin: "1.5px"
  base: "2px"
hard-shadow:
  s: "2px 2px 0 {colors.ink}"
  m: "3px 3px 0 {colors.ink}"
spacing:
  x1: "4px"
  x2: "8px"
  x3: "12px"
  x4: "16px"
  x5: "20px"
  x6: "24px"
  x8: "32px"
  touch: "44px"
  gutter: "20px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.on-dark}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.lg}"
    border: "{line.base} solid {colors.ink}"
    shadow: "{hard-shadow.s}"
    height: "52px"
  button-secondary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-dark}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.lg}"
    border: "{line.base} solid {colors.ink}"
    shadow: "{hard-shadow.s}"
    height: "52px"
  button-outline:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.lg}"
    border: "{line.base} solid {colors.ink}"
    shadow: "{hard-shadow.s}"
    height: "50px"
  button-utility:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.secondary}"
    rounded: "{rounded.xs}"
    height: "44px"
  chip:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.secondary}"
    rounded: "{rounded.pill}"
    border: "{line.thin} solid {colors.ink}"
    height: "44px"
  chip-selected:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.on-dark}"
    typography: "{typography.secondary}"
    rounded: "{rounded.pill}"
    border: "{line.thin} solid {colors.ink}"
    height: "44px"
  tag:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.meta}"
    rounded: "{rounded.sm}"
    border: "{line.thin} solid {colors.ink}"
    padding: "5px 9px"
  ramen-type-tag:
    backgroundColor: "{colors.yolk}"
    textColor: "{colors.ink}"
    typography: "{typography.meta}"
    rounded: "{rounded.sm}"
    border: "{line.thin} solid {colors.ink}"
    height: "26px"
  score-segment:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    height: "44px"
  score-segment-selected:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.on-dark}"
  card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    border: "{line.base} solid {colors.ink}"
    padding: "16px"
  input:
    backgroundColor: "{colors.surface-input}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    height: "48px"
  header:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.screen-title}"
    height: "56px"
  tab-bar:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.meta}"
    borderTop: "{line.base} solid {colors.ink}"
    height: "62px"
  bottom-sheet:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.lg}"
  confirm-dialog:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.lg}"
    width: "320px"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-dark}"
    typography: "{typography.secondary}"
    rounded: "{rounded.pill}"
---

# RAOTA Mobile Design System

## Overview

**Creative North Star: "라멘 에디토리얼 패스포트"**

RAOTA Mobile은 라멘 전문지의 선명한 편집 감각과 개인 취향 여권의 수집성을 iOS에 옮긴다. 흰 캔버스와 딥 잉크를 넓게 쓰고, RAOTA Red는 행동·선택·상태처럼 사용자가 바로 알아야 하는 지점에만 놓는다. 장식보다 라멘 사진과 실제 기록이 앞선다.

**원칙: 똑같이 보이고, iOS답게 동작한다.**

- **보이는 것의 기준본은 루트 웹 프로토타입(`src/`)이다.** 색, 글씨 크기, 모서리, 간격, 문구, 화면 순서는 웹과 같은 값을 쓴다. iPhone에서 1pt는 웹의 1px과 같은 크기로 보이므로 숫자를 그대로 옮긴다. **예외: 네오 브루탈리즘 라이트 겉모습(Elevation & Depth)은 앱이 기준이다.** 웹 프로토타입에는 아직 없고 나중에 맞춘다. 화면 순서와 문구는 그대로 웹을 따른다.
- **동작의 기준은 iOS다.** 가장자리 스와이프 뒤로가기, 스택 푸시, 시트, 시스템 알림창, 날짜 선택기, 공유 시트, 권한 요청은 플랫폼 것을 쓴다. 웹의 동작을 흉내 내려고 이것들을 다시 만들지 않는다.
- **숫자의 기준은 단일 원장이다.** 매장 원장, 데모 기록 원장, 5축 계산은 웹과 같은 코드(`packages/shared`)에서 가져온다. 화면마다 숫자를 따로 만들지 않는다.

**Key Characteristics:**

- **네오 브루탈리즘 라이트:** 미색 바탕, 흰 카드, 2pt 먹선, 큰 제목, 빨강 포인트 하나. 브랜딩 · 버튼 · 태그 · 카드 테두리까지만 브루탈하게, 검색 · 지도 · 리뷰 본문 · 정보 표는 깔끔하게
- Apple 시스템 서체(SF Pro, Apple SD Gothic Neo) 하나로 만드는 위계
- 12pt 카드, 식권 발매기 버튼처럼 눌리는 12pt 사각 버튼, 블러와 그라디언트 없음
- 라멘 종류는 스티커처럼 생긴 노랑 태그(쇼유 · 돈코츠 · 시오 · 미소 · 츠케멘 · 이에케)
- iPhone SE부터 Pro Max까지 한 손 조작 가능한 44pt 터치
- 4개 탭(홈 · 지도 · 라운지 · 마이)으로 탐색하고, 집중 작업은 스택과 시트로 분리

## Colors

브랜드 대비는 `brand`, `ink`, `paper` 세 축이 만든다. 화면 바탕은 미색 `paper`, 카드와 버튼의 면은 흰색 `canvas`, 부품의 테두리는 `ink`(`border`와 같은 값)다. 목록의 줄 사이, 표 안쪽 같은 정보 구분선은 옅은 `hairline`을 쓴다.

- **RAOTA Red (`brand`):** 주 CTA, 활성 탭, 선택된 칩과 5축 점수, 알림 점, 취향 일치도에만 쓴다. 누름은 `brand-pressed`, 약한 배경은 `brand-weak`. 회원번호나 통계처럼 행동이 아닌 정보를 빨강으로 강조하지 않는다.
- **Ink (`ink`, `#16181A`):** 글씨, 부품의 테두리, 번지지 않는 그림자, 먹색 면(마이 프로필, 추천 라멘집, 가게 상세 정보)에 쓴다. 순수 검정은 쓰지 않는다.
- **Yolk (`yolk`, `#FFC93C`):** 표시용 색이고 쓰는 곳이 정해져 있다: **라멘 종류 태그**와 표시 스티커("오늘의 픽", "AI가 요약했어요", 추천 1위 숫자). 위에는 `ink` 글씨만 올린다. 버튼, 타일, 선택 상태, 저장됨 상태에는 쓰지 않는다.
- **보조 글씨:** 미색 바탕에서는 `ink-sub`(`#4A4D52`)를 쓴다. `text-muted`는 흰 카드 안에서만 쓴다.
- **보조 글씨 (`text-muted`, `#6B6E73`):** 흰 면 위 5.1:1로 모든 크기에서 WCAG AA를 넘는다. 예전 `#7E7E7E`(4.1:1)와 `#8A8A8A` 입력 안내 글씨는 쓰지 않는다. `text-faint`(`#BEBEBE`)는 구분 점과 비활성 장식에만 쓰고 읽어야 하는 글씨에는 쓰지 않는다.
- **차콜 위 글씨:** 회색 hex를 쓰지 않는다. 흰색 또는 `on-dark-muted`(흰색 70%) 이상만 쓴다.
- **의미 색:** 영업 중은 `positive`, 경고는 `warning`, 저장 오류·삭제는 `critical`. 의미 색은 항상 글자나 아이콘과 함께 쓴다. 영업 상태처럼 데이터에서 오는 색은 데이터에서 계산하고 하드코딩하지 않는다.
- **오버레이:** 시트·확인창·펼친 FAB 뒤에는 `overlay`(검정 50%) 한 가지만 쓰고 블러를 섞지 않는다.

**The One Red Signal Rule.** 빨강은 누르면 일이 일어나는 곳과 지금 선택된 것에만 쓴다. 노랑은 위에 적은 표시에만 쓴다. 이 둘 말고 포인트 색을 추가하지 않고, 장식 그라디언트를 쓰지 않는다.

**라이트 전용 (v1 결정).** 앱은 라이트 모드만 제공한다(`app.json`의 `userInterfaceStyle: "light"`). 웹도 라이트 전용이며, 다크 모드는 두 플랫폼을 함께 설계할 때 추가한다. 그 전까지 하드코딩 hex 대신 `src/theme` 토큰만 써서 나중에 다크 값을 넣을 자리를 남긴다.

## Typography

**서체:** Apple 시스템 서체(`fontFamily: "System"`). iOS에서 SF Pro와 Apple SD Gothic Neo로 그려져 웹과 글자 모양이 같다. 별도 폰트 파일을 번들하지 않는다.

| 역할 | 크기/행간 | 굵기 | 쓰는 곳 |
|---|---|---|---|
| counter | 56/56 | 900 | 기록 완료의 "N번째 그릇" 숫자 한 곳 |
| headline | 28/35 | 900 | 플로우 도입 문장, 취향 정체성 제목, 가입 완료 |
| screen-title | 22/29 | 900 | 스택 헤더와 탭 루트 제목 |
| section-title | 20/27 | 900 | 화면 안 섹션 제목, 시트·확인창 제목 |
| card-title | 16/22 | 800 | 가게 이름, 기록 제목, 목록의 첫 줄 |
| body / body-strong | 14/22 | 400 / 700 | 메모, 설명, 폼 입력, 버튼 문구 |
| secondary | 13/19 | 500 | 보조 설명, 칩 문구 |
| meta | 12/17 | 600 | 날짜, 거리, 개수, 탭 라벨, 배지 |

- **12pt가 하한이다.** 탭 라벨과 배지를 포함해 8~11pt 글씨는 없다. HIG의 11pt 하한보다 한 단계 높게 잡아 웹과 맞춘다.
- **Dynamic Type을 끄지 않는다.** `allowFontScaling`은 기본값(true)을 유지한다. 크게 키웠을 때 제목과 본문은 줄바꿈하고, 탭 라벨과 한 줄 메타만 `maxFontSizeMultiplier`(1.3 안팎)로 제한한다. CTA 문구와 오류 문구는 자르지 않는다.
- **HIG와 다른 점:** iOS 기본 본문은 17pt지만 RAOTA는 웹과 같은 14pt 본문을 쓴다. 정보 밀도가 제품의 성격이기 때문이며, 접근성은 Dynamic Type 확대로 보장한다.
- 숫자가 줄을 맞춰야 하는 곳(통계, 점수, 순위)은 `fontVariant: ['tabular-nums']`를 쓴다.
- 영문 장식 라벨(TASTE SPECTRUM, STEP 01)과 제목 위 eyebrow 라벨을 쓰지 않는다. 제목이 스스로 무게를 가진다.

## Layout

- **기준 기기는 iPhone 세로.** 좌우 여백(gutter)은 20pt로 웹의 `px-5`와 같다. iPhone SE 폭(320pt)에서도 가로 스크롤 필터 외에는 본문이 잘리지 않아야 한다.
- **간격은 4pt 계열.** 묶음 안은 8~12pt, 카드 안쪽은 16pt, 섹션 사이는 24~32pt. 제목 위 간격을 아래보다 넉넉하게 둔다.
- **safe area를 실제로 쓴다.** 웹의 가짜 상태바, 다이내믹 아일랜드, 홈 인디케이터를 그리지 않는다. 상태 표시줄은 흰 화면에서 dark, 차콜 헤더(마이)에서 light로 바꾼다.
- **4개 탭 (MVP):** 홈 · 지도 · 라운지 · 마이. 라운지는 공개 라멘로그 피드만 두고 커뮤니티 게시판·라멘속보는 뺀다. 기록은 끌어서 옮길 수 있는 기록 FAB와 매장 상세에서 시작한다. 탭은 섹션이지 행동이 아니다. 탭을 오가도 스크롤, 입력, 선택 상태가 유지된다(expo-router `Tabs` 기본 동작, 웹에서는 keep-alive로 같은 결과를 냈다).
- **스택 푸시:** 매장 상세, 라멘로그 상세(댓글), 기록 작성·완료, 알림, 종합 리포트, 월별 취향 변화, AI 큐레이터, 로그인·가입. 라우트 파라미터로는 ID만 넘긴다.
- **시트:** 기록할 가게 고르기, 약관 보기, 이메일·선호 스타일 변경처럼 현재 작업을 돕는 짧은 과제. 아래에서 올라온다.
- **확인창:** 로그아웃, 회원 탈퇴, 작성 중 나가기처럼 되돌리기 어려운 행동의 확인. 화면 가운데에 뜬다. 시스템 `Alert.alert` 또는 공용 `ConfirmDialog`를 쓴다.
- **하단 고정 행동 바:** 기록 저장, AI 다음 단계, 완료 화면 CTA, 매장 상세의 "가고 싶어요 / 먹은 라멘 기록하기"는 하단에 고정하고 하단 inset을 더한다. 320×568급 화면에서도 스크롤 없이 보여야 한다.
- **기록 FAB:** 탭 바 위에 뜬다. 목록 끝에는 FAB 높이만큼 여백을 둬서 마지막 카드의 공감·댓글 버튼을 가리지 않게 한다.
- **긴 목록은 `FlatList`,** 섹션 머리는 `ListHeaderComponent`. 가로 필터와 사진 넘기기만 `ScrollView`.
- **키보드:** iOS에서 `KeyboardAvoidingView`의 padding, 스크롤은 `keyboardDismissMode="interactive"`, `keyboardShouldPersistTaps="handled"`. 저장 버튼이 키보드에 가리지 않아야 한다.

## Elevation & Depth

**네오 브루탈리즘 라이트.** 재료는 2pt 먹선, 단색 면, 그리고 누를 수 있는 것에만 붙는 얇은 번지지 않는 그림자다. 블러, 부드러운 그림자, 그라디언트, 투명한 면은 쓰지 않는다.

```ts
line:       { thin: 1.5, base: 2 }                  // 칩 · 태그 · 스티커 · 미터 칸 / 카드 · 버튼 · 사진 · 탭 바
hardShadow: { s: { x: 2, y: 2 }, m: { x: 3, y: 3 } } // blur 0, 색은 ink. 누를 수 있는 것에만
```

- **브루탈하게 만드는 범위는 정해져 있다.** 브랜딩(로고 · 제목), 버튼, 태그와 스티커, 카드의 테두리까지다. 검색, 지도, 리뷰 본문, 목록의 줄, 정보 표는 보통 굵기 글씨와 1pt `hairline`으로 깔끔하게 둔다.
- **선.** 카드, 버튼, 사진, 입력칸, 아이콘 버튼은 2pt `ink` 선을 두른다. 칩 · 태그 · 스티커는 1.5pt. 3pt 이상은 쓰지 않는다.
- **그림자는 "누를 수 있다"는 표시다.** `s`(2pt): 버튼, 아이콘 버튼, 활성 탭, 지도의 선택된 핀. `m`(3pt): 작성 버튼(FAB)과 AI 큐레이터 배너. **카드, 사진, 통계 타일, 검색창, 세그먼트, 칩에는 그림자를 넣지 않는다.**
- **The Press-Into-Shadow Rule.** 그림자가 있는 것은 누르는 동안 그림자만큼 오른쪽 아래로 움직이고 그림자가 사라진다(식권 발매기 버튼처럼). 이것이 유일한 누름 표현이다. Reduce Motion에서는 이동 애니메이션 없이 즉시 바뀐다.
- **기울이지 않는다.** 스티커와 카드를 회전시키지 않는다.
- **면.** 화면 바탕 `paper`, 카드 · 버튼 `canvas`(흰색), 행동 `brand`, 무거운 섹션 `ink`. 먹색 섹션 안의 카드는 테두리 없는 흰 면, 줄 구분은 흰색 18% 선.
- **사진 위에 글씨를 올리지 않는다.** 글씨는 사진 아래 카드 면에 쓴다. 사진 위에는 스티커 하나와 썸네일만 올릴 수 있다. 사진은 보정 없이 그대로 크게 보여 주고 2pt 선만 두른다.
- **스티커와 라멘 종류 태그.** `yolk` 면 + 1.5pt 선 + 6pt 모서리 + 12pt 800 글씨. 라멘 종류 태그는 매장 · 라멘로그 · 지도 퀵뷰 어디서나 같은 모양으로 나온다. 표시 스티커는 한 화면(한 번에 보이는 범위)에 세 개까지.
- **구현.** 새 의존성이 없다. iOS는 `shadowRadius: 0, shadowOpacity: 1, shadowOffset`으로 되고, Android는 elevation으로 번지지 않는 그림자를 못 만들므로 같은 모양의 `ink` 면을 뒤에 한 장 더 깐다. 두 경로를 `src/components/ui`의 `Button` · `IconButton` 안에 감춘다.

**The No-Blur Rule.** 떠 있는 것도 흐려지지 않는다. 시트 · 확인창 뒤판은 `overlay` 한 가지, 토스트는 먹색 블록, 탭 바와 하단 액션 바는 흰 면에 위쪽 2pt 선이다.

**왜 라이트인가.** 출시된 제품들은 이 스타일을 절제해서 쓴다: Gumroad는 1px 테두리에 쉬는 상태의 그림자가 없고, Nouns 앱은 2px 테두리 카드에 그림자가 없으며, Duolingo는 번지지 않는 그림자를 버튼에만 쓴다. 굵은 테두리와 그림자를 모든 요소에 넣고 원색을 여러 개 쓰고 요소를 기울이면 2022년식 과한 모습이 되고 정보 위계가 무너진다. 레퍼런스 모음: https://www.lazyweb.com/agentic-search/a6cf1213-2ee5-44d0-8a5b-1fb6fb504065

## Shapes

- **6pt (`sm`):** 스티커, 라멘 종류 태그, 태그.
- **8pt (`md`):** 48pt 이하 썸네일, 지도 핀.
- **12pt (`lg`):** 카드, 버튼, 사진, 입력칸, 아이콘 버튼(44pt 사각), 아바타, 세그먼트 컨트롤, 바텀시트 윗모서리, 확인창.
- **16pt (`xl`):** 작성 버튼(FAB)과 AI 큐레이터 배너 두 곳뿐.
- **알약 (`pill`):** 필터 칩, 공감 · 댓글 버튼.
- 카드 안에 카드를 넣지 않는다. 묶음이 필요하면 `hairline`과 여백으로 푼다.
- 굵은 색 세로줄을 쓰지 않는다. 메모 인용은 꾸미지 않은 본문으로 둔다.
- 모든 Pressable의 터치 영역은 44×44pt 이상. 보이는 크기가 작으면 `hitSlop`이나 컨테이너로 넓힌다.

**The Fixed Radius Rule.** 6 · 8 · 12 · 16pt와 알약만 쓴다. 새 부품마다 10 · 14 · 20pt 같은 중간 반경을 만들지 않는다.

## Components

### 버튼

- **primary:** 빨강 12pt 사각, 흰 글씨, 2pt 선, `s` 그림자, 높이 52pt. 한 화면에 하나.
- **secondary:** 먹색 면, 흰 글씨. 확인창의 비파괴 확인, 약관 시트의 "닫기"와 "확인하고 동의".
- **outline(키):** 흰 면, 2pt 선, `s` 그림자, 높이 50pt. 매장 바로가기(전화 · 네이버 지도 · 캐치테이블 · 인스타그램), "가고 싶어요", 확인창의 "취소". 저장된 상태는 같은 흰 키에 빨강으로 채운 책갈피 + "저장됨".
- **utility:** 그림자 없는 흰 면 + 1.5pt 선, 44pt. 계정 섹션의 "변경", 로그아웃 같은 보조 행동.
- 누름은 Press-Into-Shadow 하나뿐이다. 그림자가 없는 utility와 목록 행은 `canvas-soft` 배경으로 바뀐다.
- 비활성 버튼은 이유를 말한다. 기록 저장 버튼 위에 "육수 농도, 면 삶기를 골라주세요"처럼 빠진 항목을 적고, 누르면 첫 빠진 항목으로 스크롤한다. `accessibilityState.disabled`와 함께 쓴다.

### 맛 평가 (기록 화면의 핵심, 내부 이름 5축)

- 화면 문구는 "맛 평가"다. "5축", "취향 여권" 같은 내부 용어를 화면에 쓰지 않는다.
- 항목은 `TASTE_AXES` 순서 그대로: 전체 만족도, 육수 농도, 면 삶기, 토핑, 재방문 의사.
- **좋고 나쁨(전체 만족도, 토핑):** 원 다섯 개가 고른 점수까지 차오른다. 고른 원만 진한 빨강, 아래 점수는 `brand-weak`. 전체 만족도는 56pt로 크게 세우고 아래에 한 마디("맛있었어요")로 답한다.
- **취향의 위치(육수 농도, 면 삶기):** 좋고 나쁨이 아니므로 차오르지 않는다. 다섯 점을 잇는 선 위에서 한 점을 고르고, 머리에 "진한 편"처럼 위치를 말한다.
- 칸은 44pt 이상, 고르면 선택 햅틱. 양 끝에 low/high 라벨.
- 재방문 의사는 3지선다 알약(한번이면 충분 / 가끔 생각남 / 자주 감). 점수는 1/3/5로 환산.
- 맛 태그는 점수 바로 아래에 항상 펼쳐 둔다(누르기만 하면 되는 가장 쉬운 참여).
- 기본값이 없다. 모두 필수다.
- VoiceOver: 축마다 `accessibilityRole="radiogroup"`, 칸마다 `radio` + `checked` 상태, 라벨은 "육수 농도 4점, 진함 쪽".

### 칩, 세그먼트, 탭

- 필터·선택 칩은 흰 면 + 1.5pt 선 알약, 선택은 빨강 면 + 흰 글씨. 그림자는 없다. 선택 상태를 `accessibilityState.selected`로 알린다.
- 라운지의 정렬(최신순 / 공감순)은 2pt 선으로 두른 12pt 사각 두 칸. 선택된 칸은 먹색 면 + 흰 글씨. 그림자는 없다.
- 하단 탭: 흰 면 + 위쪽 2pt 먹선. 아이콘 22pt, 라벨 12pt 800, 비활성은 `ink`. 활성 탭은 빨강 12pt 블록(2pt 선 + `s` 그림자) 안에 흰 아이콘 · 라벨. 위쪽 빨강 막대는 없앤다. 키보드가 열리면 숨긴다.

### 카드, 사진, 목록

- 카드는 흰 면, 12pt, 2pt 먹선, 16pt 안쪽 여백, 그림자 없음. 카드 안에서 사진과 글씨 영역은 2pt 선으로 나누고, 글씨 영역 안의 줄은 `hairline`으로 나눈다.
- 원격 사진은 `expo-image`, 고정 크기 컨테이너, cover 크롭. 로딩 중에는 `canvas-soft` 자리표시, 실패하거나 사진이 없으면 같은 크기에 아이콘과 짧은 문구. 자리를 접어 레이아웃이 튀지 않게 한다.
- 목록 행 전체를 하나의 Pressable로 만든다. 행 안에 또 버튼을 넣지 않는다. VoiceOver 라벨에 이름·거리·영업 상태를 합친다.

### 헤더

- 스택 헤더 56pt: 왼쪽 44pt 뒤로가기, 제목(screen-title), 오른쪽 44pt 행동 슬롯, 아래 hairline. 네이티브 뒤로 제스처를 유지한다.
- 탭 루트 헤더는 왼쪽 정렬 제목 또는 RAOTA 로고. 알림 벨은 44pt, 읽지 않음은 빨강 점과 접근성 라벨로 함께 알린다.
- 마이 헤더는 먹색 면이고 상태 표시줄 · 글씨를 흰색으로 바꾼다. 통계 세 칸과 등급 바는 테두리 없는 흰 타일, 설정은 흰 44pt 사각 버튼.
- 사진 위에 뜨는 버튼(매장 상세의 뒤로가기 · 저장)은 44pt 흰 사각 + 2pt 선 + `s` 그림자. 저장된 상태는 빨강으로 채운 책갈피.

### 시트와 확인창

- **바텀시트:** `overlay` 뒤판, 36×4pt 손잡이, 12pt 윗모서리, 최대 높이 85%, 하단 inset. 열리면 제목 또는 닫기 버튼으로 포커스, 아래로 쓸어 닫기 가능. 입력이 있으면 키보드를 피한다.
- **확인창:** 가운데, 폭 최대 320pt, 12pt 모서리. 제목(section-title) → 한두 줄 설명 → [취소(outline) · 확인] 두 버튼. 파괴적 행동(탈퇴)은 확인 버튼이 빨강, 그 외(로그아웃)는 잉크. 첫 포커스는 취소.
- 시스템 `Alert.alert`로 대신해도 된다. 문구는 웹과 같게: "로그아웃할까요?" / "기록과 취향 리포트는 계정에 그대로 남아 있어요."

### 피드백, 로딩, 빈 상태, 오류

- **정직한 상태:** 일어나지 않은 성공을 표시하지 않는다. 공유가 실패하면 실패라고 말하고 대안을 준다. 반영되지 않은 조건을 반영됐다고 쓰지 않는다(AI 큐레이터의 "반영 / 참고만" 구분).
- 저장소 로딩: 흰 화면에 RAOTA 워드마크(시스템 서체 800)와 작은 빨강 spinner.
- 긴 계산 연출(취향 리포트, AI 큐레이션): 차분한 로딩, 결과를 바로 보는 버튼, Reduce Motion에서는 즉시 결과. 웹 `TasteReportLoading`, `AICurationLoading`이 기준.
- 빈 상태: 아이콘 → 짧은 제목 → 해결 방법 → 필요할 때만 CTA. 매장 정보가 없으면 "아직 라멘로그가 없어요", "영업시간 정보가 아직 없어요"처럼 말하고, 다른 가게 정보로 채우지 않는다.
- 폼 오류는 필드 바로 아래에 무엇이 문제인지와 해결법을 적는다("비밀번호는 8자 이상이에요. 지금 5자예요.").
- 토스트: 먹색 12pt 블록 + 흰 글씨, 아래쪽, 약 2.5초. 성공·실패를 색만으로 구분하지 않는다.

### 약관과 문의

- 본문은 raota-front와 같은 `packages/shared` `LEGAL_DOCUMENTS` 하나만 쓴다.
- 전문은 `/legal/[doc]` 스택 화면으로 연다(비회원도 열 수 있다). 온보딩 동의 단계만 바텀시트(`PolicySheet`)로 보여준다.
- 두는 곳: 로그인 화면 아래 링크, 마이(회원은 계정 아래 목록, 비회원은 화면 아래 링크). 홈에는 두지 않는다.
- 문의는 `Linking.openURL('mailto:contact@raota.net')`. 출시 전 약관 본문은 앱 범위(커뮤니티 없음)에 맞게 법무 검토한다.

### 화면별 패턴

- **홈:** 미색 바탕. 헤더(12pt 사각 로고 · RAOTA) → 인사와 도입 문장(headline) → "이번 달 N그릇" 링크 → 빨강 AI 큐레이터 배너(16pt · 2pt 선 · `m` 그림자) → 스타일로 찾기(2pt 선 사진 + 라멘 종류 태그) → 오늘의 큐레이션(카드: 사진 + "오늘의 픽" 스티커 → 이름 · 종류 태그 · 소개 인용 · "AI가 요약했어요" · 영업 상태 한 줄) → 추천 라멘집(화면 끝까지 먹색 면, 1위는 흰 카드 + 노랑 순위, 2~5위는 흰 선으로 나눈 줄) → 라운지 새 라멘로그 → 가까운 라멘집(`hairline`으로 나눈 깔끔한 줄 + 종류 태그) → "지도에서 더 보기" 키. 같은 매장을 두 섹션에 반복하지 않는다. 비회원은 인사 대신 로그인·가입, 추천은 라멘로그·거리 기준.
- **지도:** 검색창과 하단 퀵뷰는 흰 면 + 2pt 선(그림자 없음), 필터 칩은 1.5pt 선 알약, "목록으로 보기"와 현재 위치만 키(그림자 있음). 핀은 먹색 8pt 사각 + 흰 테두리, 선택된 핀은 빨강 + `s` 그림자. 지도 자체는 Apple 지도 그대로. 지역 · 메뉴 · 영업 중 필터는 위에 고정. Apple 지도(`react-native-maps`), 마커는 원장 매장, 선택하면 하단 퀵뷰와 동기화. 정렬은 거리(m 숫자)와 취향 일치도. 필터 결과가 없으면 지도와 목록 모두 빈 상태.
- **매장 상세:** 사진(아래 2pt 먹선, 썸네일, 뒤로가기 · 저장은 흰 사각 버튼) → 영업 상태 · 거리 · 라멘로그 수 · 평점 한 줄 → 라멘 종류 태그 → 이름 · 지점(headline) → 특징 · 주소 → 태그 → 가게 소개 카드("AI가 요약했어요" 스티커) → 바로가기 키 네 개 → 혜택(흰 카드 두 칸) → 상세 정보(먹색 카드, 줄 사이는 흰색 18% 선) → 내 라멘로그. 하단 고정 바는 흰 면 + 위쪽 2pt 선 안에 [저장됨(흰 키) · 먹은 라멘 기록하기(빨강 키)]. 비어 있는 정보는 숨기거나 빈 상태.
- **기록:** 가게 · 메뉴 · 라멘 종류 · 방문일 → **5축 평가** → 사진(선택, `expo-image-picker`) · 메모(선택) → 맛 태그(선택, 접힘) → 공개 여부. 하단 고정 저장 바. 작성 중 나가기는 확인창.
- **기록 완료:** 도장 연출 → "N번째 그릇" 카운터 → 이번 그릇 티켓(방문일+그릇 수로 번호) → 5축 변화(예: 3.90 → 3.93, +0.03, 변화가 없으면 "변화 없음") → 이번 그릇 한 줄 → 하단 고정 CTA. CTA는 처음부터 보인다.
- **종합 리포트:** 정체성 카드(제목 + 판정 근거 한 줄, 예: "누적 42그릇 중 돈코츠 14그릇 · 육수 농도 평균 3.9") → 5축 레이더(`react-native-svg`) → 축별 막대 → 종류별 분포 → 자주 간 라멘집 → 다음 한 그릇. 공유는 iOS 공유 시트(`Share.share`).
- **월별 취향 변화:** 월 선택(이번 달은 "집계 중") → 종류별 분포 막대 → 지난달 대비 %p 표 → 월 한정 제목("8월의 취향").
- **마이:** 먹색 프로필(이름 · 회원번호 · 흰 타일 세 개: 총 그릇 · 방문 매장 · 이번 달) → 흰 타일 안의 등급 진행 바 → 종합 리포트 카드 → 월별 미리보기 → 탭(라멘로그 · 방문매장 · 가고싶어요 · 작성글 · 댓글) → 계정. 모든 숫자는 원장에서 계산.
- **라운지:** 다른 라멘러들의 공개 라멘로그 피드(커뮤니티 게시판은 MVP 밖). 헤더(제목 · 최신순/공감순) → 라멘 종류 칩 → 카드(작성자 · 가게 링크 → 위아래 2pt 선으로 나눈 사진 → 메뉴 + 라멘 종류 태그 · 맛 평가 한 줄 "만족 4 · 육수 진한 편 · 면 부드러운 편" · 꾸미지 않은 메모 3줄 · 태그 → 공감 · 댓글 알약 키). 카드 사이는 16pt 간격(회색 띠는 없앤다), `FlatList`로 10개씩 이어 불러온다. 최신순은 실제 작성 시각 기준. 카드 본문을 누르면 라멘로그 상세(사진 전부 · 메모 전문 · 맛 평가 다섯 줄 · 댓글 등록순 · 하단 댓글 입력 300자, 250자부터 글자 수 표시). 내 공개 기록도 피드에 올라간다. 공감·댓글은 앱 상태에 저장돼 탭을 오가도 유지. 비회원은 읽기만 한다: 공감·신고를 누르면 로그인으로, 댓글 입력 자리에는 "로그인하고 댓글 남기기".
  - **UGC 신고·숨기기 (App Store 심사 1.2, 필수):** 남의 라멘로그와 댓글에는 항상 "…" 버튼(iOS 액션 시트)을 두고 "신고하기"와 "이 사용자 숨기기"를 준다. 신고는 사유(스팸·홍보 / 욕설·혐오 / 음란물 / 개인정보 노출 / 기타)를 고르는 바텀시트 → "신고를 접수했어요. 검토 후 조치할게요." 신고한 글은 신고한 사람에게 더 보이지 않는다. 숨기면 그 사람의 라멘로그와 댓글이 피드·상세에서 바로 사라지고, 토스트의 "되돌리기"로 취소할 수 있다. 내 글과 댓글에는 이 메뉴를 두지 않는다.
- **라멘속보:** 가게별 카드, 원문 링크는 그 가게 인스타그램 계정(없으면 숨김), 기간이 지난 이벤트는 "종료" 표시 후 아래로.
- **알림:** 목록 + 설정 시트. 설정 스위치는 iOS `Switch`, 각각 이름이 연결된다. 알림이 없으면 빈 상태.
- **로그인 / 가입:** "로그인 없이 둘러보기"는 진짜 비회원으로 들어간다. 데모 계정 체험은 별도 버튼. 새 가입자는 0그릇에서 시작하고 데모 숫자를 보지 않는다.
- **AI 큐레이터:** 4단계 선택(국물 → 분위기 → 우선순위 → 자유 입력) → 로딩(실제로 쓴 조건만 표시) → 결과(원장 매장, 일치도, 반영/참고만 조건, "이 가게 기록하기"). 모든 단계에서 하단 고정 CTA.

### 웹 → iOS 구현 대응

| 웹 프로토타입 | iOS 구현 |
|---|---|
| Tailwind 클래스 | `src/theme` 토큰 + `StyleSheet` |
| 가짜 상태바 · 홈 인디케이터 | `react-native-safe-area-context`, `expo-status-bar` |
| keep-alive 탭 | expo-router `Tabs` (기본 유지) |
| CSS 애니메이션(도장, 로딩, 등장) | `react-native-reanimated`, Reduce Motion이면 생략 |
| `<input type="file">` 사진 첨부 | `expo-image-picker` (누를 때 권한 요청, 거절하면 설정 안내 + 사진 없이 계속) |
| `navigator.share` / 클립보드 | `Share.share` (iOS 공유 시트) |
| `<input type="date">` | `@react-native-community/datetimepicker` |
| Leaflet + OpenStreetMap | `react-native-maps` (Apple 지도) + `expo-location` |
| lucide-react | `lucide-react-native` (같은 아이콘 세트로 웹과 일치) |
| `mailto:` 링크 | `Linking.openURL` |
| 가운데 확인창(`ConfirmDialog`) | 공용 `ConfirmDialog` 또는 `Alert.alert` |
| `role`, `aria-*` | `accessibilityRole`, `accessibilityState`, `accessibilityLabel` |
| `src/data/shops.ts`, `demoProfile.ts`, `utils/taste.ts` | `packages/shared`로 옮겨 웹·앱이 같은 코드 사용 |

**아이콘에 대한 결정:** HIG는 SF Symbols를 권하지만, 웹과 모양을 맞추기 위해 Lucide를 유지한다. 한 화면 안에서 SF Symbols와 섞지 않는다.

## Do's and Don'ts

### Do

- **Do** 새 화면을 만들기 전에 같은 웹 화면을 열어 보고, 값은 이 문서의 토큰으로 옮긴다.
- **Do** 모든 숫자(그릇 수, 방문 매장, 월별 분포, 5축 평균, 일치도)를 원장과 세션 기록에서 계산한다.
- **Do** 각 Pressable에 label과 role을 주고 selected · checked · expanded · disabled · busy 상태를 실제 상태와 연결한다.
- **Do** iPhone SE와 Pro Max, 큰 Dynamic Type에서 제목, 하단 CTA, 키보드 입력, 긴 한글 문구를 확인한다.
- **Do** 이미지·위치·저장이 실패해도 사용자가 다른 방법으로 작업을 끝낼 수 있게 한다.
- **Do** 로그아웃하면 이전 계정의 상태(기록 완료 배너, 찜, 알림, 공감)를 모두 지운다.
- **Do** 선은 1.5 · 2pt, 그림자는 2 · 3pt(누를 수 있는 것만), 모서리는 6 · 8 · 12 · 16pt · 알약 안에서 고른다. 라멘 종류는 어디서나 같은 노랑 태그로 보여 준다.

### Don't

- **Don't** 웹의 430px 프레임, 가짜 상태바, 다이내믹 아일랜드, 홈 인디케이터를 복제하지 않는다.
- **Don't** 12pt 미만 글씨, 44pt 미만 터치 영역, 색으로만 표현한 상태를 만들지 않는다.
- **Don't** 블러, 부드러운 그림자, 투명한 면, 장식 그라디언트, 빨강 글로우를 쓰지 않는다.
- **Don't** 과한 브루탈리즘으로 가지 않는다: 원색 여러 개, 3pt 넘는 테두리, 모든 카드의 그림자, 기울인 요소, 장식용 서체, 점선 상자.
- **Don't** `yolk`을 버튼 · 타일 · 선택 상태에 쓰지 않는다. 사진 위에 글씨를 올리지 않는다.
- **Don't** 없는 정보를 다른 가게 데이터로 채우거나, 사용자 이름(예: '뿡')·수치·날짜를 하드코딩하지 않는다.
- **Don't** 실제로 일어나지 않은 성공("복사되었습니다", "갱신 완료")을 표시하거나, 눌러도 반응 없는 버튼을 두지 않는다.
- **Don't** 영문 장식 라벨, 제목 위 eyebrow, 아이콘 대신 쓴 이모지를 넣지 않는다(사용자가 쓴 글 속 이모지는 괜찮다).
- **Don't** 네이티브 뒤로 제스처, 시트 쓸어내리기, 시스템 컨트롤을 막거나 다시 만들지 않는다.

### 새 UI 추가 체크리스트

- [ ] 같은 웹 화면과 나란히 놓았을 때 색 · 글씨 크기 · 모서리 · 간격이 같은가?
- [ ] `src/theme` 토큰과 공통 컴포넌트로 구현했고 hex를 직접 쓰지 않았는가?
- [ ] 12pt 하한, 44pt 터치, VoiceOver label/role/state를 지켰는가?
- [ ] iPhone SE와 Pro Max, safe area, 상태 표시줄 색을 확인했는가?
- [ ] 큰 Dynamic Type에서 핵심 문구와 CTA가 잘리지 않는가?
- [ ] 숫자가 원장에서 나오고 다른 화면의 같은 숫자와 일치하는가?
- [ ] 로딩 · 빈 상태 · 오류 · 비회원 상태가 있는가?
- [ ] 그림자가 누를 수 있는 것에만 있고, 눌렀을 때 그림자 속으로 들어가는가? 정보 영역(목록 · 표 · 본문)은 깔끔한가?
- [ ] 입력이 필요한 창은 시트, 되돌리기 어려운 확인은 가운데 창인가?
- [ ] 폼이 키보드를 피하고, 비활성 버튼이 이유를 말하는가?
- [ ] 권한 거절 시 설정 안내와 다른 경로가 있는가?

## 이식 준비 상태

2026-09-18 기준. 화면 이식의 바탕은 끝났고, 남은 차이는 화면 코드에 있다.

**끝난 것**

- `src/theme` 토큰을 이 문서 값으로 맞췄다(보조 글씨 `#6B6E73`, 글씨 크기 56·24·20·17·15·14·13·12, 모서리 2·6·12·알약, 카드 그림자 제거, floating 그림자 y4·blur16·0.12). 옛 키 이름(`text`, `title`, `radii.md` 등)은 옛 화면 호환용 별칭으로만 남겼다.
- 매장 원장, 데모 원장(42그릇), 5축 계산, 취향 정체성, 월별 분포가 `packages/shared`에 있고 웹과 앱이 같은 코드를 쓴다. 모바일 `SHOPS`도 `SHOP_CATALOG`를 쓴다(하쿠텐 7, 담택 8로 id 통일).
- 저장소가 기록의 5축 점수를 보존하고, 망가진 점수는 기록을 살린 채 점수만 뺀다.
- 탭 라벨 12pt, 쓰지 않던 Pretendard·Do Hyeon 폰트 파일 제거.

**네오 브루탈리즘 라이트(2026-09-20 채택, 앱 코드 적용 전)**

규칙과 시안(홈 · 매장 상세 · 라운지 · 마이 · 지도)만 있고 앱 코드에는 아직 적용하지 않았다. 화면 순서와 배치는 지금 앱과 거의 같아서, 적용은 `src/theme` 토큰(색 · 제목 굵기 · 모서리 · 선)과 공통 부품(`Button` · `IconButton` · `Card` · `Chip` · 라멘 종류 태그 · 탭 바 · FAB)을 바꾸는 일이 대부분이다. 새 의존성은 없다. 적용 순서는 토큰과 공통 부품 → 탭 바 · FAB → 홈 → 매장 상세 → 라운지 → 마이 → 지도 → 기록 · 기록 완료.

**화면 이식 때 맞출 것**

| 위치 | 지금 | 맞출 값 |
|---|---|---|
| `app/**` 화면 21개 파일 | hex 직접 사용(`#7E7E7E` 19곳, stone 계열 `#78716C`·`#57534E` 등) | `src/theme` 토큰 |
| 기록 작성(`record/new`) | 맛 태그 필수, 5축 없음 | 5축 필수 + 태그 선택(웹 `RecordScreen` 기준) |
| 취향 리포트(`taste/*`), `TasteReport` 모델 | 옛 5축(국물 농도·염도·타레·오일) | `TASTE_AXES`, `mergeProfile`, `PAST_REPORTS` |
| 마이(`native/my.tsx`, 약 3,000줄) | 자체 계산 수치 | 원장 파생(`shopVisitsOf`, `tasteIdentity`, `longestStreak`) |
| 매장 상세 | 샘플 전화·리뷰가 있던 가게 기준 레이아웃 | 원장이 비어 있을 때의 빈 상태 |
