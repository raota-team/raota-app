---
name: RAOTA Mobile
description: 웹 프로토타입과 똑같이 보이고 iOS답게 동작하는 라멘 기록 앱
colors:
  brand: "#E60000"
  brand-pressed: "#CC0000"
  brand-weak: "#FFF0F0"
  ink: "#25282B"
  ink-sub: "#4A4D52"
  text-muted: "#6B6E73"
  text-faint: "#BEBEBE"
  canvas: "#FFFFFF"
  canvas-soft: "#F2F2F2"
  surface-input: "#F7F7F7"
  border: "#E2E2E2"
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
    fontWeight: 800
    lineHeight: "56px"
    letterSpacing: "-2px"
  headline:
    fontFamily: "System"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: "31px"
  screen-title:
    fontFamily: "System"
    fontSize: "20px"
    fontWeight: 800
    lineHeight: "28px"
  section-title:
    fontFamily: "System"
    fontSize: "17px"
    fontWeight: 800
    lineHeight: "24px"
  card-title:
    fontFamily: "System"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: "21px"
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
  lg: "12px"
  pill: "999px"
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
    rounded: "{rounded.pill}"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-dark}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.pill}"
    height: "48px"
  button-outline:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.pill}"
    height: "48px"
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
    height: "44px"
  chip-selected:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.on-dark}"
    typography: "{typography.secondary}"
    rounded: "{rounded.pill}"
    height: "44px"
  tag:
    backgroundColor: "{colors.canvas-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.meta}"
    rounded: "{rounded.xs}"
    padding: "4px 8px"
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
    rounded: "{rounded.sm}"
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
    textColor: "{colors.text-muted}"
    typography: "{typography.meta}"
    height: "56px"
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

- **보이는 것의 기준본은 루트 웹 프로토타입(`src/`)이다.** 색, 글씨 크기, 모서리, 간격, 문구, 화면 순서는 웹과 같은 값을 쓴다. iPhone에서 1pt는 웹의 1px과 같은 크기로 보이므로 숫자를 그대로 옮긴다.
- **동작의 기준은 iOS다.** 가장자리 스와이프 뒤로가기, 스택 푸시, 시트, 시스템 알림창, 날짜 선택기, 공유 시트, 권한 요청은 플랫폼 것을 쓴다. 웹의 동작을 흉내 내려고 이것들을 다시 만들지 않는다.
- **숫자의 기준은 단일 원장이다.** 매장 원장, 데모 기록 원장, 5축 계산은 웹과 같은 코드(`packages/shared`)에서 가져온다. 화면마다 숫자를 따로 만들지 않는다.

**Key Characteristics:**

- 흰색·딥 잉크 면 분할과 단일 RAOTA Red 포인트
- Apple 시스템 서체(SF Pro, Apple SD Gothic Neo) 하나로 만드는 위계
- 6pt 에디토리얼 카드, 60pt 알약 CTA, 평평한 표면
- iPhone SE부터 Pro Max까지 한 손 조작 가능한 44pt 터치
- 5개 탭으로 탐색하고, 집중 작업은 스택과 시트로 분리

## Colors

브랜드 대비는 `brand`, `ink`, `canvas` 세 축이 만든다. `canvas-soft`는 그룹 배경과 태그, `border`는 그림자 대신 정보를 나눈다.

- **RAOTA Red (`brand`):** 주 CTA, 활성 탭, 선택된 칩과 5축 점수, 알림 점, 취향 일치도에만 쓴다. 누름은 `brand-pressed`, 약한 배경은 `brand-weak`. 회원번호나 통계처럼 행동이 아닌 정보를 빨강으로 강조하지 않는다.
- **Editorial Ink (`ink`):** 제목, 보조 CTA, 차콜 헤더(마이 프로필, 큐레이터 배너)에 쓴다. 순수 검정은 본문에 쓰지 않는다.
- **보조 글씨 (`text-muted`, `#6B6E73`):** 흰 면 위 5.1:1로 모든 크기에서 WCAG AA를 넘는다. 예전 `#7E7E7E`(4.1:1)와 `#8A8A8A` 입력 안내 글씨는 쓰지 않는다. `text-faint`(`#BEBEBE`)는 구분 점과 비활성 장식에만 쓰고 읽어야 하는 글씨에는 쓰지 않는다.
- **차콜 위 글씨:** 회색 hex를 쓰지 않는다. 흰색 또는 `on-dark-muted`(흰색 70%) 이상만 쓴다.
- **의미 색:** 영업 중은 `positive`, 경고는 `warning`, 저장 오류·삭제는 `critical`. 의미 색은 항상 글자나 아이콘과 함께 쓴다. 영업 상태처럼 데이터에서 오는 색은 데이터에서 계산하고 하드코딩하지 않는다.
- **오버레이:** 시트·확인창·펼친 FAB 뒤에는 `overlay`(검정 50%) 한 가지만 쓰고 블러를 섞지 않는다.

**The One Red Signal Rule.** 한 화면에서 빨강은 하나의 목소리로 읽혀야 한다. 경쟁하는 새 포인트 색이나 장식 그라디언트를 추가하지 않는다.

**라이트 전용 (v1 결정).** 앱은 라이트 모드만 제공한다(`app.json`의 `userInterfaceStyle: "light"`). 웹도 라이트 전용이며, 다크 모드는 두 플랫폼을 함께 설계할 때 추가한다. 그 전까지 하드코딩 hex 대신 `src/theme` 토큰만 써서 나중에 다크 값을 넣을 자리를 남긴다.

## Typography

**서체:** Apple 시스템 서체(`fontFamily: "System"`). iOS에서 SF Pro와 Apple SD Gothic Neo로 그려져 웹과 글자 모양이 같다. 별도 폰트 파일을 번들하지 않는다.

| 역할 | 크기/행간 | 굵기 | 쓰는 곳 |
|---|---|---|---|
| counter | 56/56 | 800 | 기록 완료의 "N번째 그릇" 숫자 한 곳 |
| headline | 24/31 | 800 | 플로우 도입 문장, 취향 정체성 제목, 가입 완료 |
| screen-title | 20/28 | 800 | 스택 헤더와 탭 루트 제목 |
| section-title | 17/24 | 800 | 화면 안 섹션 제목, 시트·확인창 제목 |
| card-title | 15/21 | 700 | 가게 이름, 기록 제목, 목록의 첫 줄 |
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
- **5개 탭:** 홈 · 지도 · 라운지 · 라멘속보 · 마이. 탭은 섹션이지 행동이 아니다. 탭을 오가도 스크롤, 입력, 선택 상태가 유지된다(expo-router `Tabs` 기본 동작, 웹에서는 keep-alive로 같은 결과를 냈다).
- **스택 푸시:** 매장 상세, 기록 작성·완료, 알림, 종합 리포트, 월별 취향 변화, AI 큐레이터, 로그인·가입. 라우트 파라미터로는 ID만 넘긴다.
- **시트:** 기록할 가게 고르기, 약관 보기, 이메일·선호 스타일 변경처럼 현재 작업을 돕는 짧은 과제. 아래에서 올라온다.
- **확인창:** 로그아웃, 회원 탈퇴, 작성 중 나가기처럼 되돌리기 어려운 행동의 확인. 화면 가운데에 뜬다. 시스템 `Alert.alert` 또는 공용 `ConfirmDialog`를 쓴다.
- **하단 고정 행동 바:** 기록 저장, AI 다음 단계, 완료 화면 CTA, 매장 상세의 "가고 싶어요 / 먹은 라멘 기록하기"는 하단에 고정하고 하단 inset을 더한다. 320×568급 화면에서도 스크롤 없이 보여야 한다.
- **기록 FAB:** 탭 바 위에 뜬다. 목록 끝에는 FAB 높이만큼 여백을 둬서 마지막 카드의 공감·댓글 버튼을 가리지 않게 한다.
- **긴 목록은 `FlatList`,** 섹션 머리는 `ListHeaderComponent`. 가로 필터와 사진 넘기기만 `ScrollView`.
- **키보드:** iOS에서 `KeyboardAvoidingView`의 padding, 스크롤은 `keyboardDismissMode="interactive"`, `keyboardShouldPersistTaps="handled"`. 저장 버튼이 키보드에 가리지 않아야 한다.

## Elevation & Depth

표면은 평평하다. 카드와 목록은 흰 면, 1pt 또는 hairline 경계, 간격, 사진 크롭으로 나눈다. **콘텐츠 카드에는 그림자를 넣지 않는다.**

다른 콘텐츠 위에 실제로 떠 있는 요소(FAB, 바텀시트, 확인창, 토스트)만 그림자 하나를 쓴다.

```ts
floating: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 6 }
```

차콜 섹션, 흰 카드, `canvas-soft` 사이의 면 전환이 주된 깊이 표현이다. 그라디언트, 유리 효과(블러), 빨강 글로우, 겹친 그림자로 깊이를 꾸미지 않는다. 사진 위 글씨를 읽히게 하는 아래쪽 어둠(스크림)만 예외로 허용한다.

**The Flat-by-Default Rule.** 사용자가 화면의 층을 이해해야 할 때만 그림자를 쓴다. 우선순위는 그림자 세기가 아니라 글씨, 간격, 사진으로 표현한다.

## Shapes

- **2pt (`xs`):** 태그, 유틸리티 버튼, 작은 상태 배지. DESIGN.md의 "날카로운 모서리" 계열.
- **6pt (`sm`):** 콘텐츠 카드, 사진, 입력칸, 5축 세그먼트 묶음.
- **12pt (`lg`):** 바텀시트 윗모서리, 가운데 확인창.
- **알약 (`pill`):** 주·보조 CTA, 필터 칩, 토스트.
- **원형:** 아이콘 버튼, 아바타, FAB.
- 카드 안에 카드를 넣지 않는다. 묶음이 필요하면 구분선과 여백으로 푼다.
- 인용이나 메모 강조의 세로줄은 1pt 잉크 선까지만 쓴다. 굵은 색 세로줄을 쓰지 않는다.
- 모든 Pressable의 터치 영역은 44×44pt 이상. 보이는 크기가 작으면 `hitSlop`이나 컨테이너로 넓힌다.

**The Two Silhouette Rule.** 콘텐츠는 작은 모서리(2·6pt), 행동과 선택은 알약·원형. 새 컴포넌트마다 중간 반경(8·10·14·16·20pt)을 만들지 않는다.

## Components

### 버튼

- **primary:** 빨강 알약, 흰 글씨, 높이 48pt. 한 화면에 하나.
- **secondary:** 잉크 알약. 확인창의 비파괴 확인, 약관 시트의 "닫기"와 "확인하고 동의".
- **outline:** 흰 면 + 1pt 경계 알약. "가고 싶어요", 확인창의 "취소".
- **utility:** 2pt 모서리 사각형, 44pt. 계정 섹션의 "변경", 로그아웃 같은 보조 행동.
- 누름은 opacity 감소 또는 `canvas-soft` 배경만. 크기 변형(scale)은 쓰지 않는다.
- 비활성 버튼은 이유를 말한다. 기록 저장 버튼 위에 "육수 농도, 면 삶기를 골라주세요"처럼 빠진 항목을 적고, 누르면 첫 빠진 항목으로 스크롤한다. `accessibilityState.disabled`와 함께 쓴다.

### 5축 평가 (기록 화면의 핵심)

- 축은 `TASTE_AXES` 순서 그대로: 전체 만족도, 육수 농도, 면 삶기, 토핑, 재방문 의사.
- 앞의 네 축은 1~5 세그먼트. 한 칸 44pt 이상, 양 끝에 low/high 라벨(맑음–진함, 부드럽게–단단하게). 선택은 빨강 면 + 흰 글씨.
- 재방문 의사는 3지선다(자주 감 / 가끔 생각남 / 한번이면 충분)를 같은 블록의 다섯 번째 항목으로 둔다. 점수는 5/3/1로 환산.
- 기본값이 없다. 모두 필수다.
- VoiceOver: 축마다 `accessibilityRole="radiogroup"`, 칸마다 `radio` + `checked` 상태, 라벨은 "육수 농도 4점, 진함 쪽".

### 칩, 세그먼트, 탭

- 필터·선택 칩은 흰 면 + 경계 알약, 선택은 빨강. 선택 상태를 `accessibilityState.selected`로 알린다.
- 라운지의 라멘로그/커뮤니티 전환은 iOS 세그먼트 컨트롤 모양(회색 트랙 위 흰 선택 면).
- 하단 탭: 아이콘 22pt, 라벨 12pt bold. 활성만 빨강 + 위쪽 2pt 빨강 막대. 키보드가 열리면 숨긴다.

### 카드, 사진, 목록

- 카드는 흰 면, 6pt, 1pt 경계, 16pt 안쪽 여백, 그림자 없음.
- 원격 사진은 `expo-image`, 고정 크기 컨테이너, cover 크롭. 로딩 중에는 `canvas-soft` 자리표시, 실패하거나 사진이 없으면 같은 크기에 아이콘과 짧은 문구. 자리를 접어 레이아웃이 튀지 않게 한다.
- 목록 행 전체를 하나의 Pressable로 만든다. 행 안에 또 버튼을 넣지 않는다. VoiceOver 라벨에 이름·거리·영업 상태를 합친다.

### 헤더

- 스택 헤더 56pt: 왼쪽 44pt 뒤로가기, 제목(screen-title), 오른쪽 44pt 행동 슬롯, 아래 hairline. 네이티브 뒤로 제스처를 유지한다.
- 탭 루트 헤더는 왼쪽 정렬 제목 또는 RAOTA 로고. 알림 벨은 44pt, 읽지 않음은 빨강 점과 접근성 라벨로 함께 알린다.
- 차콜 헤더(마이)는 상태 표시줄·글씨·아이콘을 함께 흰색으로 바꾼다.

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
- 토스트: 잉크 알약, 아래쪽, 약 2.5초. 성공·실패를 색만으로 구분하지 않는다.

### 약관과 문의

- 홈 푸터: "이용약관 · 개인정보처리방침" 두 버튼과 "문의하기 · contact@raota.net". 약관은 바텀시트로 연다(웹 `PolicySheet`와 같은 본문). 문의는 `Linking.openURL('mailto:…')`.
- 설정 성격의 약관·문의는 마이의 계정 섹션에도 둔다. 출시 전 약관 본문은 법무 검토 전문으로 바꾼다.

### 화면별 패턴

- **홈:** 헤더(로고 · 인사 · 알림) → 차콜 AI 큐레이터 배너 → 오늘의 픽(원장 매장, 사진 중심) → 내 취향과 잘 맞는 라멘집(일치도 상위 5) → 가까운 라멘집(거리 상위 5) → 약관 푸터. 비회원은 인사 대신 로그인·가입, 일치도 목록 대신 로그인 안내.
- **지도:** 검색 + 목록 전환, 지역 · 메뉴 · 영업 중 필터를 위에 고정. Apple 지도(`react-native-maps`), 마커는 원장 매장, 선택하면 하단 퀵뷰와 동기화. 정렬은 거리(m 숫자)와 취향 일치도. 필터 결과가 없으면 지도와 목록 모두 빈 상태.
- **매장 상세:** 사진 → 영업 상태 · 거리 → 스타일 · 이름 · 지점 → 특징 · 주소 → 태그 → 일치도 → 가게 소개 → 상세 정보(차콜) → 라멘로그. 하단 고정 "가고 싶어요 / 먹은 라멘 기록하기". 비어 있는 정보는 숨기거나 빈 상태.
- **기록:** 가게 · 메뉴 · 라멘 종류 · 방문일 → **5축 평가** → 사진(선택, `expo-image-picker`) · 메모(선택) → 맛 태그(선택, 접힘) → 공개 여부. 하단 고정 저장 바. 작성 중 나가기는 확인창.
- **기록 완료:** 도장 연출 → "N번째 그릇" 카운터 → 이번 그릇 티켓(방문일+그릇 수로 번호) → 5축 변화(예: 3.90 → 3.93, +0.03, 변화가 없으면 "변화 없음") → 이번 그릇 한 줄 → 하단 고정 CTA. CTA는 처음부터 보인다.
- **종합 리포트:** 정체성 카드(제목 + 판정 근거 한 줄, 예: "누적 42그릇 중 돈코츠 14그릇 · 육수 농도 평균 3.9") → 5축 레이더(`react-native-svg`) → 축별 막대 → 종류별 분포 → 자주 간 라멘집 → 다음 한 그릇. 공유는 iOS 공유 시트(`Share.share`).
- **월별 취향 변화:** 월 선택(이번 달은 "집계 중") → 종류별 분포 막대 → 지난달 대비 %p 표 → 월 한정 제목("8월의 취향").
- **마이:** 차콜 프로필(이름 · 회원번호 · 총 그릇 · 방문 매장 · 이번 달) → 등급 진행 바 → 종합 리포트 카드 → 월별 미리보기 → 탭(라멘로그 · 방문매장 · 가고싶어요 · 작성글 · 댓글) → 계정. 모든 숫자는 원장에서 계산.
- **라운지:** 라멘로그 / 커뮤니티 세그먼트. 최신순은 실제 작성 시각 기준. 공감·댓글은 앱 상태에 저장돼 탭을 오가도 유지. 비회원은 댓글 입력 대신 "로그인하고 댓글 남기기".
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

### Don't

- **Don't** 웹의 430px 프레임, 가짜 상태바, 다이내믹 아일랜드, 홈 인디케이터를 복제하지 않는다.
- **Don't** 12pt 미만 글씨, 44pt 미만 터치 영역, 색으로만 표현한 상태를 만들지 않는다.
- **Don't** 콘텐츠 카드에 그림자, 블러, 빨강 글로우, 장식 그라디언트를 넣지 않는다.
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

**화면 이식 때 맞출 것**

| 위치 | 지금 | 맞출 값 |
|---|---|---|
| `app/**` 화면 21개 파일 | hex 직접 사용(`#7E7E7E` 19곳, stone 계열 `#78716C`·`#57534E` 등) | `src/theme` 토큰 |
| 기록 작성(`record/new`) | 맛 태그 필수, 5축 없음 | 5축 필수 + 태그 선택(웹 `RecordScreen` 기준) |
| 취향 리포트(`taste/*`), `TasteReport` 모델 | 옛 5축(국물 농도·염도·타레·오일) | `TASTE_AXES`, `mergeProfile`, `PAST_REPORTS` |
| 마이(`native/my.tsx`, 약 3,000줄) | 자체 계산 수치 | 원장 파생(`shopVisitsOf`, `tasteIdentity`, `longestStreak`) |
| 매장 상세 | 샘플 전화·리뷰가 있던 가게 기준 레이아웃 | 원장이 비어 있을 때의 빈 상태 |
