---
version: 1
name: RAOTA-app
description: |
  핀터레스트 DESIGN.md(`npx getdesign add pinterest`)를 뼈대로 옮긴 RAOTA iOS 앱 디자인 시스템.
  음식 사진이 화면을 이끌고, 크롬은 따뜻한 회색과 흰색으로 물러난다. 빨강은 화면의 주요 행동 하나와 완식 도장뿐이다.
  그 위에 라오타만의 표시 네 가지(국물 색, 맛 지문, 식권과 완식 도장, 그릇 감정서)를 얹는다.
  원본 사본과 승인된 화면 시안: scratch/ramen-objects-prototype/pinterest-DESIGN.md, pin.html (로컬 전용).

colors:
  primary: "#E60000"          # RAOTA Red. 핀터레스트 #E60023 대신 브랜드 빨강
  primary-pressed: "#CC0000"
  on-primary: "#FFFFFF"
  ink: "#000000"
  on-ink: "#FFFFFF"
  selected: "#000000"          # 고른 칩·탭·평가 칸
  on-selected: "#FFFFFF"
  photo-pill: "#FFFFFF"        # 사진 위 알약
  on-photo-pill: "#000000"
  open: "#1F9D55"              # 영업 중 점
  body: "#33332E"
  mute: "#62625B"
  ash: "#91918C"               # 입력칸 테두리
  stone: "#C8C8C1"
  hairline: "#DADAD3"
  secondary-bg: "#E5E5E0"
  secondary-pressed: "#C8C8C1"
  canvas: "#FFFFFF"
  surface-card: "#F6F6F3"
  surface-dark: "#262622"
  focus: "#435EE5"
  error: "#9E0A0A"
  success-deep: "#103C25"
  success-pale: "#C7F0DA"

colors-dark:
  ink: "#FFFFFF"
  on-ink: "#000000"
  selected: "#5C5C55"          # 다크에서 흰 면은 눈부셔서 밝은 회색
  on-selected: "#FFFFFF"
  photo-pill: "rgba(18,18,17,0.88)"
  on-photo-pill: "#FFFFFF"
  open: "#3DD68C"
  body: "#E5E5E0"
  mute: "#A8A8A0"
  hairline: "#33332F"
  secondary-bg: "#33332F"
  secondary-pressed: "#4A4A44"
  canvas: "#121211"
  surface-card: "#22221F"
  surface-dark: "#3A3A35"
  focus: "#7B93F2"

typography:              # Pin Sans 대신 Pretendard (400·500·600·700)
  heading-xl:   { fontSize: 28, fontWeight: 700, lineHeight: 34, letterSpacing: -1.2 }   # typography.headline
  heading-lg:   { fontSize: 22, fontWeight: 600, lineHeight: 28 }                        # typography.screenTitle
  heading-md:   { fontSize: 18, fontWeight: 600, lineHeight: 24 }                        # typography.sectionTitle
  nav-title:    { fontSize: 17, fontWeight: 600, lineHeight: 22 }                        # typography.navTitle
  body-md:      { fontSize: 16, fontWeight: 400, lineHeight: 22 }                        # typography.body
  body-strong:  { fontSize: 16, fontWeight: 600, lineHeight: 22 }                        # typography.bodyStrong · cardTitle
  body-sm:      { fontSize: 14, fontWeight: 400, lineHeight: 20 }                        # typography.secondary
  button-md:    { fontSize: 14, fontWeight: 700, lineHeight: 18 }                        # typography.button
  caption-md:   { fontSize: 12, fontWeight: 500, lineHeight: 18 }                        # typography.meta
  counter:      { fontSize: 34, fontWeight: 700, lineHeight: 40, letterSpacing: -1.2 }   # 기록 완료 한 곳

rounded:
  md: 16     # radii.sm — 버튼, 입력칸, 카드, 사진, 썸네일
  lg: 32     # radii.lg — 큰 카드, 큰 사진, 바텀시트, 확인창
  full: 9999 # radii.pill — 칩, 검색창, 아이콘 버튼, 아바타, 사진 위 알약

spacing:
  xxs: 4
  xs: 6
  sm: 8      # 사진 격자 칸 사이 (spacing.grid)
  md: 12
  lg: 16     # 화면 좌우 여백 (spacing.gutter)
  xl: 24
  xxl: 32    # 큰 구획 사이 (spacing.section)

components:
  button-primary:     { backgroundColor: primary, textColor: on-primary, typography: button-md, rounded: md, height: 44 }
  button-secondary:   { backgroundColor: secondary-bg, textColor: ink, typography: button-md, rounded: md, height: 44 }
  button-tertiary:    { backgroundColor: transparent, textColor: ink, typography: button-md, rounded: md }
  button-disabled:    { backgroundColor: surface-card, textColor: mute, rounded: md }
  button-icon-circular: { backgroundColor: surface-card, textColor: ink, rounded: full, size: 44 }
  button-pill-on-image: { backgroundColor: canvas, textColor: ink, typography: button-md, rounded: full }
  search-bar:         { backgroundColor: surface-card, textColor: ink, typography: body-md, rounded: full, height: 48 }
  text-input:         { backgroundColor: canvas, border: "1 ash", typography: body-md, rounded: md, height: 48 }
  filter-chip:        { backgroundColor: surface-card, textColor: ink, typography: button-md, rounded: full, height: 40, padding: "0 16" }
  filter-chip-active: { backgroundColor: selected, textColor: on-selected }
  pin-card:           { backgroundColor: surface-card, rounded: md, padding: 0 }
  pin-card-large:     { backgroundColor: surface-card, rounded: lg, padding: 0 }
  pin-overlay-pill:   { backgroundColor: photo-pill, textColor: on-photo-pill, typography: caption-md bold, rounded: full, padding: "6 10" }
  feature-card-soft:  { backgroundColor: surface-card, rounded: lg, padding: 20 }
  modal-card:         { backgroundColor: canvas, rounded: lg, shadow: "0 4 16 rgba(0,0,0,.16)" }
  tab-bar:            { backgroundColor: canvas, border-top: "1 hairline", active: ink, inactive: mute }
---

# RAOTA 앱 디자인 시스템

> **최종 수정일**: 2026.10.17
> **토큰**: `src/theme/index.ts` · **부품**: `src/components/ui/index.tsx` · **의미 색**: `docs/RAOTA_COLORS.md`

## Overview

핀터레스트의 원칙 하나를 그대로 가져온다: **사진을 가리지 않는다.** 크롬은 흰색(`canvas`)과 따뜻한 회색(`surface-card`)으로 물러나고, 라멘 사진이 화면의 무게를 진다. 사진이 곧 카드다. 안쪽 여백 없이 16pt로 자르고, 이름과 정보는 사진 아래에, 종류 같은 표시는 사진 위 알약(`photo-pill`)에 둔다.

모양의 어휘는 세 개뿐이다: **16pt**(거의 모든 것), **32pt**(큰 카드·큰 사진·시트), **알약**(칩·검색창·아이콘 버튼). 날카로운 모서리도, 중간 반경도 없다. 그림자도 없다. 위에 뜨는 층(바텀시트, 확인창, 지도 위 카드)만 16pt 주변광을 쓴다.

이전 디자인(네오 브루탈리즘: 미색 바탕, 2pt 먹선, 번지지 않는 그림자, 간장색 간판)은 같은 설정을 쓰는 다른 서비스가 있어 2026.10.16 바꿨다.

## 라오타만의 표시

핀터레스트에는 없고 라오타에만 있는 것. 이 넷이 "핀터레스트처럼 보이는 앱"과 라오타를 가른다.

| 표시 | 어디에 | 규칙 |
|---|---|---|
| **국물 색** | 종류별 막대와 그 범례, 캘린더 칸, 그릇 감정서·그릇 채우기, AI 국물 고르기 칸 | `soupColorOf(type)` + `colors.soupEdge` 1pt 테두리. 색이 막대·칸·그릇의 뜻을 설명하는 자리에만 쓴다. 종류 이름 옆에 장식으로 점을 붙이지 않는다(칩, 사진 위 알약, 목록 줄은 글씨만, 2026.10.18 사용자 결정) |
| **맛 지문** | 가게 상세, 라멘로그 상세 | `TasteFingerprint`(`src/components/TasteFingerprint.tsx`). 다섯 축 오각형 하나: 회색 바깥 선 + 안으로 갈수록 옅어지는 눈금 세 겹, 데이터는 만족도 축 색(`tasteAxis.satisfaction`) 16% 면 + 2pt 선. 꼭짓점 바깥에 축 이름 · 값을 회색으로, 가장 높은 축 하나만 같은 파랑 굵은 글씨(같은 점수면 `TASTE_AXES` 순서의 첫 축, 모든 축이 같으면 강조 없음). 1점이 판의 1/5이라 도형이 점으로 무너지지 않는다. 슬라이더처럼 보이는 막대 + 손잡이는 쓰지 않는다 |
| **식권과 완식 도장** | AI 발권·결과, 기록 완료 | 앱에서 유일하게 "물건"이 나오는 순간. 회색 면 식권 + 양옆 파임 + 점선, 빨간 테두리 도장 |
| **그릇 감정서** | 마이, 리포트 로딩(그릇 채우기) | 먹은 그릇을 국물 색 그릇·점으로 쌓는다 |

## Colors

- **빨강은 화면당 하나.** 주요 버튼 하나와 기록 완료 도장. 고른 상태(칩, 탭, 평가 칸)는 `selected` 면 + `onSelected` 글씨다. 예외는 탭바 가운데 기록 버튼 하나다: 어느 화면에서나 같은 자리에 있는 앱 전체의 기록 입구라 늘 빨강으로 둔다(사용자 결정, 2026.10.17). 화면 안의 빨강은 여전히 하나다.
- **영업 중**은 `open` 초록 점(+ 글씨)으로 표시한다. 두 모드 모두 초록이다.
- **글씨 색**: 제목 `ink`, 본문 `body`(`inkSub`), 보조 `mute`(`textMuted`). 위계는 색이 아니라 굵기와 크기로 만든다.
- **면**: 바탕 `canvas`, 카드·칩·검색창 `surface-card`(`canvasSoft`), 보조 버튼 `secondary-bg`.
- **선**: 목록 구분선 `hairline`(`border`), 입력칸 `ash`(`outline`). 그 밖에는 선을 긋지 않는다.
- **다크 모드**: 시스템 설정을 따른다. iOS는 `colors`가 `DynamicColorIOS`라 저절로 바뀐다. 고른 상태는 `selected`(다크에서는 흰 면 대신 밝은 회색 `#5C5C55`), 사진 위 알약은 `photoPill`(다크에서는 거의 검정 88%) — 다크 모드에서 흰 면이 튀지 않게 한다. `ink` 면을 고른 상태에 쓰지 않는다. `onDark`는 빨강 위 글씨 전용. 색을 문자열로 다뤄야 하면 `usePalette()`.
- 노랑 스티커와 간장색 간판은 없다.

## Typography

Pretendard 한 가족, 굵기 400·500·600·700. 12pt 하한, 700 상한. 큰 제목(`headline`, `counter`)만 자간 -1.2.

- 탭 화면 제목과 플로우 질문은 `headline`(28/700), 화면 안 가장 큰 이름은 `screenTitle`(22/600), 섹션 제목은 `sectionTitle`(18/600).
- 버튼과 칩 문구는 `button`(14/700). 본문은 16, 보조 설명은 14, 메타는 12.

## Layout

- 화면 좌우 여백 16pt(`spacing.gutter`), 큰 구획 사이 32pt(`spacing.section`), 제목 위 여백이 아래보다 크다.
- **사진 격자(메이슨리)**: 홈 피드·라운지는 두 열, 칸 사이 8pt(`spacing.grid`), 사진 높이를 서로 다르게.
- 하단 고정 행동 바: 흰 바탕 + 위 1pt `hairline`, 빨강 버튼은 하나.

## Elevation & Depth

| 단계 | 처리 | 쓰는 곳 |
|---|---|---|
| 0 평평 | 테두리·그림자 없음 | 카드, 사진, 칩, 버튼 — 거의 전부 |
| 1 선 | 1pt `hairline` / `ash` | 목록 줄, 입력칸 |
| 2 뜬 층 | `shadows.modal` + 검정 50% 뒤판 | 바텀시트, 확인창, 지도 위 카드·칩 |

## Components

- **Button**: primary 빨강 / secondary `secondary-bg` / ghost. 16pt, 높이 44(작게)·48(보통)·52(크게), 문구 `button`. 못 누르면 회색 면 + 흐린 글씨, 아이콘 숨김.
- **IconButton**: 44pt 원, `surface-card` 면(사진 위는 `photoPill` 원 + `onPhotoPill` 아이콘).
- **Chip**: 40pt 알약, 고르면 `selected` 면 + `onSelected` 글씨. 종류 칩도 글씨만 쓴다.
- **Sticker**: 사진 위 알약(`onImage` → `photoPill`) 또는 회색 알약. 12pt 굵게.
- **Card**: `surface-card`, 16pt(큰 카드 32pt), 테두리 없음. 카드 안에 카드를 넣지 않는다.
- **입력칸**: `canvas` 면 + `ash` 1pt, 16pt, 48pt. 검색창은 `surface-card` 알약 48pt.
- **ScoreSegment**: 1~5 알약 다섯 개, 고른 칸은 `selected`.
- **BottomSheet / ConfirmDialog**: `canvas`, 32pt, `shadows.modal`, 손잡이 36×4 `stone`.
- **Toast**: `surface-dark` 면 흰 글씨, 16pt.
- **PhotoViewer**: 가게·라멘로그 상세의 사진을 누르면 검정 바탕 전체 화면으로 연다. 옆으로 넘기기, 두 손가락·두 번 톡 확대(최대 4배), 아래로 끌거나 닫기(✕)로 닫기, 위 가운데 "n / 전체".
- **뒤로 쓸기**: 모든 스택 화면은 왼쪽 가장자리에서 오른쪽으로 쓸면 뒤로 간다. 가로 스크롤(사진 넘기기, 칩 줄)이 화면 왼쪽 끝까지 닿는 화면은 맨 바깥에 `EdgeBackZone`(20pt 띠)을 둬서 그 스크롤이 뒤로 쓸기를 가로채지 않게 한다.
- **탭 바**: 홈 · 지도 · 기록(+) · 라운지 · 마이. 가운데 기록은 글자 없이 `primary` 64×40pt, 16pt 사각 안의 흰 +이고, 누르면 기록 방법 시트(화면 탭이 아니다). 음성 안내 이름은 "라멘 기록하기". 고른 탭 `ink`, 나머지 `mute`.

## 화면 구성

- **홈**: 로고 + "RAOTA." + "나의 라멘 취향을 찾는 곳" · 오른쪽 "{닉네임}님 ›" → 시간대 인사("오늘 아침은 어떤 라멘으로 할까요?")와 이번 달 기록 줄 → AI 큐레이터 카드(`feature-card-soft` + 빨강 버튼) → 오늘의 큐레이션 큰 사진 핀 → 추천 라멘집 사진 핀 줄 → 가까운 라멘집 → 라운지 새 기록. 검색창과 종류 칩은 두지 않는다(검색은 지도 탭).
- **라운지**: 제목, 칩 한 줄(정렬 칩은 기본 "전체 ▾", 누르면 전체·최신순·인기순 드롭다운 + 종류 칩), 12pt 띄우고 두 열 사진 격자. 사진 위에는 종류 알약과 사진 장수만 둔다. 사진 없는 기록은 글에 맞춘 인용 칸.
- **가게 상세**: 32pt 큰 사진 → 아이콘 줄(가고 싶어요·공유·더보기) → 이름·정보 → 맛 지문 → 소개 → 바로가기 → 정보 줄 → 하단 고정 "먹은 라멘 기록하기"(빨강 하나).
- **마이**: 가운데 원형 아바타, 이름, 그릇·가게 수, 밑줄 탭, 그릇 감정서, 캘린더(잔디 칸), 최근 기록. 최근 기록·방문매장·가고싶어요는 최대 10줄 높이 틀 안에서 스크롤하고, 틀 바닥에서 더 불러온다.
- **설정**: 줄만 그은 목록. 로그아웃·회원 탈퇴·앱 버전을 화면 아래쪽에 모은다.

## 움직임

시스템 전환을 기본으로 하고, 직접 만든 연출은 아래 규칙을 지킨다. 시안: `scratch/ramen-objects-prototype/motion.html`(로컬 전용).

- **공통**: 모양·자리는 그대로 두고 투명도·이동·크기 변환·색만 움직인다(화면이 밀리면 안 된다). 기본 곡선은 ease-out `bezier(0.22, 1, 0.36, 1)`. 동작 줄이기 설정에서는 전부 마지막 상태로 바로 보여준다.
- **누른 자리의 반응(0.2~0.45초)**: 가고 싶어요 하트가 튀며 옅은 원이 퍼짐 · 공감 하트가 튀고 숫자가 한 칸 굴러 바뀜 · 칩·평가 칸·AI 선택지는 0.2초 색 전환 + 누르는 동안 97% · AI 고른 조건 칸은 채워질 때 자리 잡으며 값이 아래서 올라옴 · 사진 불러오는 동안 빛이 지나가고, 오면 서서히 나타남.
- **처음 볼 때 한 번**: 맛 지문 파란 면이 가운데서 커지고 축 이름이 차례로(가장 높은 축이 마지막에 파래짐) · 라운지 핀은 새로 받은 것만 14pt 아래에서 차례로 · 마이 그릇 감정서 점이 먹은 순서대로, 그릇 수가 0부터 올라가고 레벨 바가 참.
- **전환**: 사진 크게 보기는 누른 사진 한 장의 틀이 제자리에서 화면 가득(사진 비율) 커지고 닫으면 돌아감. 사진이 그려진 뒤 출발하고, 넘겨 보기 목록은 전환이 끝난 뒤 붙인다 · 탭바 + 가 45° 돌아 ✕, 기록 방법 줄이 차례로. 지도 핀·카드는 움직이지 않는다(2026.10.19 사용자 결정).
- **원래 있던 연출**: AI 발권(조건 칩이 차례로 켜지고 식권이 올라온다), 그릇 채우기(국물이 차고 종류별로 모인다), 완식 도장(한 번 찍힌다), 월별 막대(왼쪽에서 펼쳐짐).

## Do's and Don'ts

### Do
- 빨강은 화면당 하나(탭바 기록 버튼은 예외). 나머지 행동은 secondary나 ghost.
- 사진은 안쪽 여백 없이 16pt(크면 32pt)로 자르고 표시는 사진 위 알약(`photoPill`)으로 얹는다.
- 고른 상태는 `selected`로 뒤집는다.
- 의미 색(국물, 맛 지문)에는 늘 글자를 붙인다.
- 새 부품을 만들기 전에 사진 핀 + 16pt + 회색 면으로 표현할 수 있는지 먼저 본다.

### Don't
- 카드·버튼 테두리, 번지지 않는 그림자, 중간 반경(6·8·12pt).
- 노랑 스티커, 간장색 큰 구획, 빨간 선택 상태.
- 700보다 굵은 글씨, 12pt보다 작은 글씨.
- 화면에서 hex를 직접 쓰는 것(다크 모드가 깨진다). 공급자 브랜드 색(카카오 노랑 등)만 예외.
- 고르지 않은 값을 "—" 같은 빈 칸으로 보여주는 것. 없으면 숨긴다.
