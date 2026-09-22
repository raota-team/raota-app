---
target: apps/mobile/app/(flows) — main 병합분 9커밋 검수
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 5
timestamp: 2026-09-21T05-25-54Z
slug: apps-mobile-app-flows
---
Method: dual-agent (A 디자인 리뷰 · B 기술 감사, 각각 격리 실행)
범위: main 병합분 9커밋(`7773d1b..316fb81`)이 건드린 4파일. 수정 없음, 제안만.
근거 규칙: 사용자 지시로 `apps/mobile/DESIGN.md`는 **약한 근거**로 취급. 코드 현실이 1차 근거.

## Design Health Score — 26/40 (Acceptable)

| # | 휴리스틱 | 점수 | 핵심 문제 |
|---|---|---|---|
| 1 | 시스템 상태 가시성 | 3 | 진행 막대·"N/4"·체크되는 식권은 훌륭. 그러나 iOS에서 로딩 문구가 스크린리더에 한 번도 안 읽힘 |
| 2 | 현실 세계와의 일치 | 3 | 어휘 최상급. "큐레이팅 중…"만 튀고, 토리파이탄은 고를 수 있으나 기록 불가 |
| 3 | 사용자 통제와 자유 | 2 | AI 로딩 건너뛰기를 이번 배치에서 삭제 → 3,950ms 갇힘 |
| 4 | 일관성과 표준 | 2 | 같은 배치의 두 로딩 화면이 서로 다름: 스킵 유/무, 공용 Header 유/무, 제목 2종 |
| 5 | 오류 예방 | 3 | disabled+힌트, 200자 상한, 비회원 가드는 good. shopsQuery 로딩 중 CTA는 열림 |
| 6 | 회상보다 인식 | 3 | 4단계에서 1~3단계 답이 화면에 없음 |
| 7 | 유연성과 효율 | 1 | 매번 4단계 필수, "다시 추천받기"가 inputs를 유지해 같은 가게를 반환 |
| 8 | 심미성·미니멀 | 3 | 결과 화면 "추천에 쓴 조건" 블록이 가게 카드와 무게가 붙음 |
| 9 | 오류 복구 | 3 | 정직한 빈 상태·재시작·대안 경로. curate의 조용한 catch만 아쉬움 |
| 10 | 도움말 | 3 | 단계별 help·조건별 note로 평균 이상. "AI"가 로컬 키워드 필터라는 사실은 미고지 |
| **합계** | | **26/40** | **Acceptable** |

10개 전부 적용(Operate 마법사·리포트·완료 화면이라 7·10도 해당). 이전 검수(2026-09-20, `apps-mobile` 슬러그)는 27/40였고 범위가 달라 직접 비교 대상은 아니다.

## Audit Health Score — 16/20 (Good)

| # | 차원 | 점수 | 핵심 발견 |
|---|---|---|---|
| 1 | Accessibility | 3 | Android 전용 `accessibilityLiveRegion`을 iOS 앱에 사용 |
| 2 | Performance | 3 | 타이머·워크릿 정리는 완벽. TasteReportScreen이 같은 계산을 훅 단위로 2~3회 중복 |
| 3 | Appearance & Theming | 4 | 4파일 hex 리터럴 0건, 전 값이 `src/theme` 토큰 |
| 4 | Platform Conformance | 3 | complete.tsx StatusBar `light` 고정 + 진녹 배너가 스크롤로 사라짐 |
| 5 | Adaptivity | 3 | portrait 고정·tablet off로 범위 좁음. Dynamic Type 1.3배 상한 + numberOfLines 1 조합이 AX 크기에서 말줄임 |
| **합계** | | **16/20** | **Good** |

Platform Conformance 판정: **PASS(단서 있음)**. 웹 포팅으로 읽히지 않는다 — expo-router 네이티브 push, 모달 presentation, lucide 단일 아이콘 세트, hover 의존 0건. 단서는 ① 전 화면 `headerShown:false`로 시스템 내비게이션 바를 자체 Header로 대체(이번 배치 밖의 구조적 선택), ② complete.tsx가 엣지 스와이프 뒤로가기를 끔, ③ AI 큐레이터가 6개 상태를 한 라우트에 담아 시스템 뒤로가기와 화면 안 "이전"의 의미가 갈림.

## Design Specificity — 이 앱을 위해 쓰였다 (교체 불가)

로딩이 스피너가 아니라 *내 조건이 적힌 식권 한 장*이고, 완료 티켓 번호는 방문일+누적 그릇 수로 조립된다(`complete.tsx:55-58`). 계보·타레·청탕/백탕·치지레멘 같은 도메인 화자의 어휘. 56pt `counter` 스케일이 앱 전체에서 "N번째 그릇" 한 곳에만 존재한다. 유일한 이탈은 `ai-recommend.tsx:514`의 `Sparkles` 아이콘 — 식권·도장·그릇으로 쌓은 어휘가 여기서만 범용 AI 기본값으로 돌아간다.

## 결정적 스캔 — exit 0이지만 품질의 증거가 아니다

`detect.mjs --json` 4파일 → `[]`, exit 0, 규칙 0건. B가 검증 절차를 추가로 돌렸다: `hover:bg-blue-500` / 인라인 `#3b82f6` / `fontFamily:'Inter'` / `boxShadow` / `<div onClick>` / `fontSize:'10px'`를 일부러 심은 `bad.tsx`도 `[]` / exit 0. 비HTML 파일은 정규식 모드로 도는데 그 규칙들이 웹 마크업(CSS 클래스·hover·HTML 시맨틱) 전제라 RN의 `StyleSheet.create` + `Pressable` 문법에 하나도 걸리지 않는다. `audit.native.md:3`도 네이티브 타깃엔 detect.mjs가 해당 없다고 못박는다. **아래 발견은 전부 수동 소스 리뷰 결과이며 스캔과 독립이다.** 브라우저 오버레이는 네이티브라 해당 없음 — 라이브 서버를 띄우지 않았다.

## 잘 된 것

1. **정직함이 취향이 아니라 시스템으로 구현돼 있다.** `curate()`가 조건마다 원장 대조 여부를 `applied` 플래그로 남기고(`ai-recommend.tsx:111-169`), 결과가 "반영/참고만" 두 단계와 이유 한 줄을 전부 출력한다. `DEFAULT_INPUTS`를 전부 빈 문자열로 바꾼 것(`:91-95`)이 결정적 — 미리 골라 두면 "다음"만 눌러도 고르지 않은 조건을 반영이라 말하게 된다.
2. **Reduce Motion이 네 화면 전부에서 "생략"이 아니라 "동등한 최종 상태"다.** `useReducedMotion()` 6곳. 특히 AI 로딩을 통째로 건너뛰는 처리(`:241`)는 그 로딩이 순수 연출임을 개발자도 안다는 증거다.
3. **타이머 수명 관리가 전부 정확하다.** 모든 `setTimeout`에 cleanup, `setInterval` 0건, 언마운트 후 setState 경로 없음. `onCompleteRef` 패턴도 두 파일에 일관.
4. **도장 대비 수정이 수치까지 검증됐다.** 흰색 on `deep #00422E` = **11.55:1**, 이전 `brand #E60000` on 같은 면 = **2.40:1**. `complete.tsx:351` 주석의 수치와 소수 둘째 자리까지 일치. 커밋 `74b29e1`은 정확한 수정이다.
5. **테마 토큰 준수가 완벽하다.** 4파일 hex/rgba 리터럴 0건. 유일한 투명도 예외(`broth[0]` 35%)는 DESIGN.md에 근거와 경계까지 적어 올렸다.

## Priority Issues

### [P1] iOS에서 로딩 상태가 스크린리더에 한 번도 전달되지 않는다 — 두 평가 일치
`ai-recommend.tsx:704`, `taste/index.tsx:521`이 `accessibilityLiveRegion="polite"`를 쓴다. RN 0.86.3 소스에서 이 prop은 `BaseViewConfig.android.js`에만 있고 `.ios.js`에는 0건, 타입 정의도 `@platform android`로 못박는다. `LOADING_MESSAGES` 4단계와 `STATUS_MESSAGES` 4단계가 VoiceOver에 한 번도 읽히지 않는다. 커밋 `bba15df`("AI 로딩 식권을 스크린리더에 읽어 준다")가 노린 효과가 타깃 플랫폼에서 미달이다. ai-recommend는 `focusOn(titleRef)`(:647)로 "로딩 중"은 전달되지만 **taste 쪽엔 그 완화조차 없다** — 포커스가 이전 화면에 머문 채 2.9초 뒤 리포트로 교체된다. 두 화면 어디에도 `accessibilityState={{busy:true}}`가 없다.
**고치는 법:** 단계 변경 `useEffect`에서 `AccessibilityInfo.announceForAccessibility(message)` 호출. `AccessibilityInfo`는 `ai-recommend.tsx:6`에 이미 import돼 있고, 저장소에 올바른 패턴이 5곳 있다(`record/new.tsx:353,391`, `auth/onboarding.tsx:171,176`, `RecordFab.tsx:319`). taste 로딩엔 `focusOn(titleRef)` 추가.
**명령:** `/impeccable harden`

### [P1] AI 로딩이 3,950ms 강제 대기이고, 탈출구를 이번 배치에서 삭제했다
`ai-recommend.tsx:645`가 `LOADING_DURATION(3300)+650`ms 뒤 결과로 넘긴다. "추천 바로 보기" 버튼은 커밋 `4ab0ff5`에서 삭제됐다. 자매 화면인 취향 리포트 로딩에는 같은 버튼이 **그대로 있다**(`taste/index.tsx:528-542`). `DESIGN.md:377`도 "결과를 바로 보는 버튼"을 명시한다 — **문서가 맞고 코드가 퇴행한 경우다.** 게다가 결과는 `:238`에서 이미 동기로 계산이 끝나 있다. 답을 손에 쥐고 4초를 연기한다. "반영/참고만"으로 정직함을 판 제품이 유일하게 연기하는 지점이다.
**고치는 법:** `taste/index.tsx:528-542`의 `loadingFooter` 블록 이식(`ArrowRight`는 `:3`에 아직 import돼 있어 삭제만 되돌리면 된다) + `LOADING_DURATION` 3300 → 1800.
**명령:** `/impeccable harden`

### [P1] 로그인 우회가 사용자의 의도를 통째로 버린다 — 두 평가 일치
`_layout.tsx:24-26`이 비회원을 `/auth/login`으로 보내고, 로그인 성공은 무조건 `router.replace("/native")`(`auth/login.tsx:174`)다. 어디서 왔는지 전달하는 파라미터가 없다. 비회원이 4단계+4초를 거쳐 추천을 받고 "이 가게 기록하기"를 누르면 → 로그인 → 홈. 가게도 큐레이션도 의도도 소실. `/taste` 딥링크도 동일. 이번 배치의 크래시 수정(`67d2609`)이 건드린 바로 그 경로인데, 크래시는 고쳤지만 목적지는 손대지 않았다.
추가로 `record/new.tsx:476-490`에는 비회원 전용 빈 상태가 잘 쓰여 있다("로그인하면 취향 리포트도 함께 쌓여요" + 버튼). 그런데 레이아웃 이펙트가 사용자가 보기 전에 replace해 **설명하는 쪽이 죽은 UI가 됐다.** 지금 사용자가 얻는 건 말 없는 튕김뿐이다.
**고치는 법:** replace 시 `params:{next: 현재 경로}`를 싣고 `login.tsx:174`를 `router.replace(params.next ?? "/native")`로. AI 결과는 `next`에 `/record/new?shopId=…`를 실어 로그인 직후 기록 작성으로. 가드에서 `record`를 빼 화면이 직접 설명하게 하는 것도 방법.
**명령:** `/impeccable onboard`

### [P1] 기록 완료 화면 상태바가 스크롤 후 미색 위 흰 글씨(1.09:1)로 남는다
`complete.tsx:157`이 `<StatusBar style="light" />`로 고정인데, 진녹 배너(`:166`)는 **ScrollView 내부**(`:158`)라 위로 밀려 사라진다. 그 뒤 상태바 자리는 `styles.root`의 `paper #FFF8EA`이고 글씨는 흰색 그대로 — 계산 대비 **1.09:1**. 시각·배터리·시간이 사실상 사라진다. 568pt 화면에서 티켓+5축 델타+코멘트+하단 바면 충분히 스크롤된다.
**고치는 법:** ScrollView 위에 `position:"absolute", top:0, height:insets.top, backgroundColor:colors.deep`인 View 한 장(스크롤 핸들러 불필요). 대안은 `onScroll`로 style 토글이지만 프레임 비용이 붙는다.
**명령:** `/impeccable harden`

### [P1] 앱의 유일한 피크 순간을 900ms 뒤 권한 모달이 덮는다
`complete.tsx:86`의 `useRecordReminderPrompt`가 `REMINDER_PROMPT_DELAY = 900`ms(`src/notifications/reminders.ts:237`) 뒤 알림 권한 `ConfirmDialog`를 띄운다. 도장(250ms)+본문 등장(450ms)이 끝나고 450ms 만이다. 그리고 `status === "ask"`, 즉 **생애 첫 기록**에서 뜬다. "43번째 그릇"을 읽고 티켓과 취향 변화를 확인할 시간이 없다. 피크엔드 법칙에서 피크를 직접 훼손하고, 동시에 권한 수락률도 깎는다 — iOS 권한은 한 번 거절하면 앱 안에서 되돌릴 수 없다.
**고치는 법:** (a) delay 900 → 3500, 또는 (b) 더 낫게는 완료 화면이 아니라 `/taste` 리포트를 본 **뒤**에 묻는다. `complete.tsx:127`의 `goTaste`가 이미 그 경로를 만들어 둔다.
**명령:** `/impeccable delight`

### [P2] 로딩 식권의 ✓가 결과 화면에서 "참고만"으로 강등된다
`:260`이 `applied` 필터를 없애 반영되지 않은 조건까지 식권에 적고 **전부 체크한다**(커밋 `9d29151`). 사용자는 "아늑한 분위기 ✓"를 보고 넘어가는데 결과에선 같은 줄이 "참고만 · 매장 분위기 정보는 아직 없어 참고만 했어요"가 된다(`:145`). `DESIGN.md:375,404`가 명시한 바로 그 금기다. 더해서 `TicketRow`가 `accessibilityRole="checkbox"`(`:588`)라 VoiceOver가 누를 수 있는 컨트롤로 안내하지만 더블탭해도 무반응이다.
**고치는 법:** 조건 전부를 적는 결정 자체는 옳다(무엇을 고려하는지 보여 주는 게 낫다). 고칠 것은 **표시**다 — `applied=false` 줄은 ✓ 대신 `Minus` + 흐린 글씨(결과 화면 `:483`이 이미 쓰는 기호), 체크는 `applied=true`에만. `:260`의 `.map(label)`을 `{label, applied}` 쌍으로 바꾸면 된다. role은 `"text"`로.
**명령:** `/impeccable audit`

## 두 평가가 엇갈린 지점 — 레이더 눈금

커밋 `00dd1a5`가 결과·로딩 레이더에서 안쪽 눈금 오각형 4개와 축선 5개를 모두 제거했다(`taste/index.tsx:246-262, 464-483`).
- **A(디자인):** 과교정이다. 눈금이 없으면 오각형은 "크다/작다"만 말하고 "얼마나"를 말하지 못한다. 3.2와 3.8의 도형이 구별되지 않고 두 리포트를 비교할 기준도 없다. 0.6 위치에 1pt `border` 눈금 하나만 되살리자(축선은 복원 안 함).
- **B(기술):** 옳은 판단이다. 잉크 총량이 줄어 데이터 도형이 이긴다. 값은 축 이름 옆 숫자와 바로 아래 `axisList`(`:712-742`)가 말하고, `RadarChart`의 `accessibilityLabel`(`:240-242`)이 전 수치의 텍스트 등가물을 준다.
- **판정 보류 — 사용자 결정 사항.** 다만 **논쟁 여지 없이 틀린 것 두 가지**가 남는다: ① `taste/index.tsx:216-217, 256`의 주석이 **같은 커밋이 지운 것**("안쪽 눈금과 축이 도형 너머로 비친다")을 여전히 가리킨다. ② `DESIGN.md:396`이 옛 규칙("안쪽 1.5pt · 데이터는 canvas-soft 면")을 담고 있어 같은 문서 `:236`/`:290`의 새 서술과 충돌한다. 눈금을 되살리든 말든 이 둘은 고쳐야 한다.

## 페르소나 레드 플래그

**Alex (성급한 파워 유저)** — 건너뛰기 없는 3,950ms. `restart()`(`:244-247`)가 `curation`만 비우고 `inputs`는 유지하는데 `curate()`는 결정론적이라 **"다시 추천받기" → 다음×4 → 4초 = 똑같은 가게.** 다른 답을 얻는 법을 화면이 말해 주지 않아 "추천이 고장 났다"로 읽는다. 지난번 조건 재사용·2순위 보기 모두 없다.

**Sam (VoiceOver 사용자)** — 위 P1 무음 문제. 더해서 `taste/index.tsx:462`의 로딩 레이더가 `accessible={false} importantForAccessibility="no-hide-descendants"`만 있고 `accessibilityElementsHidden`이 없다 — `importantForAccessibility`도 Android 전용이라 **iOS에서 축 이름·점수 SvgText가 낱개 요소로 남아** 자라나는 도형 위에서 떠도는 숫자 뭉치가 된다. 같은 배치의 `ai-recommend.tsx:305`는 둘 다 정확히 붙였다 — 지식은 팀에 있고 규칙만 강제되지 않는다. 또 `accessibilityLabel`만 있고 `accessible`이 빠진 View 4곳(`complete.tsx:185,232,277`, `ai-recommend.tsx:456`)은 iOS에서 라벨이 아예 무시된다 — 코드베이스 자신의 주석(`ui/index.tsx:449`)이 경고하는 바로 그 실수다.

**라오타 (프로젝트 페르소나)** — `ai-recommend.tsx:38`에서 **토리파이탄을 고를 수 있지만 기록할 수 없다**(`RAMEN_TYPES`에 없음). 가장 반길 선택지가 막다른 길이다. `PRIORITY_OPTIONS` 4개는 전부 국물·면·차슈 일반론이고, 실제로 따지는 축(가수율, 저온조리, 면량)은 자유 입력으로 밀리는데 자유 입력은 `:160-163`에서 "웨이팅/밥/차슈/면" 네 단어만 대조한다. 반대로 `complete.tsx:284-327`의 5축 델타 표(3.90 → 3.93, 소수 둘째 자리)는 정확히 이 사람을 위한 밀도다.

**비회원** — 위 P1. 더해서 `_layout.tsx:28-39`가 `blocked`여도 `<Stack>` 자식을 렌더해, `/taste` 딥링크 시 리다이렉트 전 한 프레임 동안 "아직 보여드릴 취향이 없어요"가 보인다. 비회원은 "내 리포트가 비었다"로 오해한다. 로그인으로 보내는 **이유**를 말하는 문구가 화면에 없다(`accessibilityHint`에만 있어 VoiceOver 전용).

## 인지 부하 — 8항목 중 3실패

Chunking 실패(1단계 국물 6개가 그룹 없이 한 그리드, 4단계 조건 6개+텍스트 입력=한 화면 7타깃), Minimal choices 실패(>4 지점 2곳), Working memory 실패(4단계에서 1~3단계 답이 화면에 없음 — 그 답을 한 장에 모은 식권은 *로딩 화면에서야* 나타나고 그때는 못 고친다). Grouping·One-thing-at-a-time·Progressive disclosure는 통과.
1단계 6개는 청탕(시오·쇼유)/백탕(돈코츠·토리파이탄)/기타(미소·츠케멘)로 묶으면 도메인 어휘와도 맞고 상한도 지킨다.

## 그 외 발견 (P2/P3)

- **[P2] AI 큐레이터의 뒤로가기가 두 갈래다.** 헤더 셰브론(`:284` `router.back()`)은 플로우를 통째로 나가고 고른 답이 전부 사라지는데, 스티키 바 "이전"(`:509`)은 한 단계 위로 간다. 6개 상태를 한 라우트에 담은 결과. 싼 수선: `numericStep>1`이면 헤더 onBack을 "이전"과 같게. → `/impeccable shape`
- **[P2] `complete.tsx:132,156`이 엣지 스와이프를 끈다.** 그런데 `record/new.tsx:386`이 `router.replace`로 오므로 완료 화면 뒤에 남는 건 홈이다. 주석이 밝힌 목적은 `replace`가 이미 달성했고, 지금 막히는 건 정상적인 홈 복귀 제스처다. → `/impeccable shape`
- **[P2] SVG 차트 글씨가 Dynamic Type을 전혀 안 따른다.** `react-native-svg@15.15.4` 소스에 `allowFontScaling` 참조 0건. 큰 글씨를 쓰는 저시력 사용자에게 레이더는 영원히 12/13pt. `axisList`가 같은 숫자를 스케일되는 `AppText`로 반복해서 P1이 아니라 P2다. → `/impeccable adapt`
- **[P2] `TasteReportScreen`이 같은 계산을 2~3회 중복한다.** `useTasteProfile()`을 직접 부르고 `useTasteIdentity()`가 내부에서 또 부른다 → `mergeProfile` 2회. `useMyBowls()`/`useVisitedShops()`, `useBowlCount()`/`useActivityLevel()`도 동일. 훅 인스턴스마다 `useMemo` 캐시가 따로라 메모가 못 막는다. 기록이 쌓일수록 렌더 비용이 선형 3배. → `/impeccable optimize`
- **[P3] 하이드레이션 실패가 비회원으로 취급된다.** `RaotaStore.tsx:1264`의 `isHydrated: hydrationStatus !== "loading"`. 저장소 읽기 실패 시 실제 회원도 로그인으로 튕긴다.
- **[P3] 온보딩 가드 구멍.** `app/_layout.tsx:126`이 `isNativeRoute`일 때만 건다. 로그인했지만 온보딩 미완인 사용자가 `/taste`로 딥링크하면 (flows) 가드는 통과하고 온보딩 가드는 안 걸려 온보딩을 건너뛴다.
- **[P3] 삭제 잔여물:** `ai-recommend.tsx:3` `ArrowRight`, `:13` `type ViewStyle`, `:838` `styles.loadingConditions`.
- **[P3] 제목 3종:** "AI 라멘 큐레이터"(`:292`) / "AI 라멘 추천"(`:671`) / DESIGN.md "AI 큐레이터". 같은 흐름 안에서 헤더가 바뀐다.
- **[P3] 로딩 헤더가 손으로 조립돼 있다**(`:669-673`). 취향 리포트 로딩은 공용 `Header`를 쓴다(`taste/index.tsx:454`).
- **[P3] 매직 넘버** `ticketSticker: { bottom: -13 }`(`:865`). 자매 파일은 `bottom: -spacing.x2`. hex 0건인 파일의 유일한 생 숫자.
- **[P3] 토큰 의도 불일치:** 결과 레이더는 `stroke={colors.ink}`(`:258`), 로딩 레이더는 `colors.outline`(`:478`). 값은 같지만 의미가 다른 토큰이다.
- **[P3] `SvgText`가 typography 토큰 우회**(`:270,283,488,501`에서 `fontWeight="800"`, `typography.meta`는 600).
- **[P3] `TicketRow` key 충돌 가능**(`:698` `key={text}`), **긴 자유 입력 잘림**(`:594` `numberOfLines={1}`인데 200자까지 받음), **칩 "추가됨" 판정이 부분 문자열 매칭**(`:386`).
- **[P3] `curate()`의 조용한 catch**(`:175-184`)가 랭킹 실패를 인기·거리순 fallback으로 삼켜, 사용자는 "조건에 맞는 곳을 못 찾았다"로 듣는다. 두 상황이 구분되지 않는다.
- **[P3] `shopsQuery` 로딩 중에도 최종 CTA가 눌린다**(`:238`) → 빈 배열 → "찾지 못했어요". 4단계를 다 채운 사용자에게 가혹하다.
- **[P3] 기록 완료에 공유가 없다.** 가장 공유하고 싶은 화면인데 공유는 취향 리포트에만 있다.
- **[P3] `DESIGN.md:404`의 "일치도"는 구현된 적이 없다.** 문서가 백로그를 현재형으로 적고 있다. 코드 감점 사유 아님.

## 체계적 패턴

1. **RN의 플랫폼별 접근성 prop 계약이 지켜지지 않는다.** Android 전용 prop이 iOS 우선 앱 신규 코드에 3곳. 한 곳은 정확히 짝을 맞췄으므로 지식은 있고 규칙이 강제되지 않을 뿐이다 — `eslint-plugin-react-native-a11y` 또는 자체 lint 규칙으로 고정할 가치가 있다.
2. **두 로딩 연출이 같은 배치에서 태어났는데 계약이 다르다.** 스킵(유/무), 포커스 이동(유/무), 레이더 숨김(정확/누락), 헤더(공용/자체). 공용 `<FlowLoading>`으로 뽑을 지점.
3. **`accessibilityLabel` + `accessible` 짝짓기가 7곳 중 3곳 누락.**
4. **화면이 라우트가 아니라 상태로 단계를 관리한다.** 시스템 뒤로 제스처가 화면 안 진행을 모르는 근본 원인.
5. **파생 데이터 훅이 합성 대신 재계산으로 쌓인다.**

## 던져볼 질문

1. 답을 이미 알고 있는데 4초를 연기하는 이유가 "AI처럼 보이려고"라면, 정직함을 팔아 온 이 제품이 왜 거기서만 연기하나? 0.8초에 결과를 내놓고 "이렇게 골랐어요"를 보여 주는 쪽이 더 유능해 보이지 않나?
2. AI 큐레이터의 끝이 "못 한 일 목록"인 게 맞나? 취향 리포트는 "다음에 맛볼 한 그릇"으로 끝난다. 같은 사람이 만든 두 흐름의 마지막 화면이 왜 이렇게 다른 기분으로 끝나나?
3. 눈금을 다 지운 오각형은 지금 무슨 일을 하나? 숫자 다섯 개로 값이 전달된다면 오각형은 장식이고, 장식이 아니라면 비교 기준이 필요하다.
4. 도장이 찍히는 순간에 권한을 묻는 것과 리포트를 다 본 뒤에 묻는 것 — 어느 쪽 수락률이 높을까?
5. 라오타가 주 3회 쓴다면 매번 1단계부터 밟게 하는 게 맞나? "지난번 조건 그대로" 버튼 하나가 재사용률을 바꾸지 않을까?
6. 비회원에게 4단계를 다 시키고 결과까지 보여 준 다음 로그인에서 전부 버리는 구조는, 가입을 유도하는가 처벌하는가?

## 이번 배치에서 실기 확인하지 않은 것

시뮬레이터 빌드·스크린샷 미수행(READ ONLY 코드 감사). `ios.md`가 요구하는 큰 Dynamic Type 실기 확인은 **미수행**이며, Dynamic Type 관련 판정(P2 SVG, P3 말줄임)은 소스 분석 근거다. `app.json`이 `orientation:"portrait"`, `supportsTablet:false`, `userInterfaceStyle:"light"`이므로 가로·iPad·Split View·다크 모드는 제품 차원 범위 밖으로 두고 감점하지 않았다.
