# RAOTA 다국어 (Lingui)

한국어(`ko`, 원문), 영어(`en`), 중국어 간체(`zh`), 일본어(`ja`), 스페인어(`es`)를 지원합니다. 기기/앱의 선호 언어 목록에서 지원하는 첫 언어를 고르고, 없으면 한국어입니다. 중국어 지역·문자 변형은 모두 간체로, 스페인어 지역 변형은 공통 스페인어(날짜·숫자는 `es-ES`)로 보여 줍니다.

- 번역 라이브러리는 [Lingui](https://lingui.dev) 6입니다. 한국어 원문이 그대로 메시지이고, 다른 언어는 `locales/{locale}/messages.po`에 번역합니다. 앱(`apps/mobile`)과 웹(`src`)이 같은 번역을 씁니다.
- 모바일: `apps/mobile/src/i18n.ts`가 `expo-localization`으로 앱 언어를 읽어 `setLocale`을 부릅니다. 화면은 `useLocale()`로 구독해 언어가 바뀌면 다시 그립니다(재마운트하지 않아 작성 중인 폼이 남습니다).
- 웹: `src/main.tsx`가 `navigator.languages`를 읽고 `languagechange`를 구독합니다.
- 빌드: 모바일은 `apps/mobile/babel.config.js`의 Lingui Babel 플러그인이, 웹은 `vite.config.ts`의 `@lingui/vite-plugin`(`macroTransform`)이 매크로를 바꿉니다. 번역은 컴파일한 `messages.ts`를 import하므로 PO 로더가 필요 없습니다.

## 문구 쓰기

```ts
import { msg, ph, plural, select, t } from "@lingui/core/macro"
import { formatDate, formatList, formatNumber, labelOf, translate } from "@raota/shared"

t`오늘 뭐 먹지?`
t`${count}그릇`                                 // 자리표시자 이름은 변수 이름({count})
t`${ph({ shop: shop.name })}에 가 봤어요`         // 식이면 ph로 이름을 붙인다
plural(count, { one: "# bowl", other: "# bowls" }) // 수에 따라 문장이 달라질 때
const LABEL = msg`가고 싶어요`                     // 나중에 보여 줄 문구(설명자) → translate(LABEL)
labelOf(log.ramenType)                            // 저장·API 값의 표시 이름(라멘 종류, 맛 태그 …)
```

- **변수로 번역을 찾지 않습니다.** `translate()`는 `msg`로 만든 설명자만 받습니다. 문자열을 받으면 추출되지 않아 번역이 빠지기 때문입니다.
- **저장·API 값은 번역하지 않습니다.** 라멘 종류, 맛 태그, 재방문, 정렬·필터 값은 한국어 그대로 저장·전송·비교하고, 보여 줄 때만 `labelOf()`를 씁니다. 새 값을 보여 주려면 `labels.ts`의 `DOMAIN_LABELS`에 `msg`로 더합니다. 표에 없는 값은 사용자·서버 원문으로 보고 그대로 보여 줍니다.
- **문장을 조각내지 않습니다.** 조각을 번역해 이어 붙이지 말고 한 메시지에 자리표시자·`plural`·`select`를 씁니다. 한국어 조사(을/를)처럼 한 언어에만 있는 문법은 `select`로 그 언어 번역 안에서만 고릅니다.
- **번역 결과를 상태나 모듈 상수에 담지 않습니다.** 상태에는 설명자나 원래 값을 두고 그릴 때 번역합니다.
- 날짜·숫자·목록은 `formatDate`, `formatNumber`, `formatList`를 씁니다. 금액은 실제 통화(KRW)를 유지합니다.
- 사용자 글·리뷰·닉네임, 매장 이름·주소·소개, 서버 오류 문구, 약관 본문은 원문 그대로입니다. 약관 본문은 다른 언어에서 원문 제공 안내를 붙입니다.

## 번역 갱신

1. 코드에 문구를 쓰고 `pnpm i18n:extract` — 모든 언어 PO에 새 메시지가 추가됩니다.
2. `locales/{en,zh,ja,es}/messages.po`의 빈 `msgstr`을 번역합니다. `{이름}` 자리표시자와 `plural`/`select` 구조는 그대로 둡니다.
3. `pnpm i18n:compile` — `messages.ts`를 다시 만듭니다. PO와 `messages.ts`를 함께 커밋합니다.

`apps/mobile/__tests__/i18n.test.tsx`가 번역이 빠진 메시지와 자리표시자가 어긋난 번역을 찾아 실패시킵니다.

## API

API 요청에는 현재 언어를 `Accept-Language`로 보냅니다. 서버가 지원할 때만 응답 언어가 달라지며, 앱은 응답을 번역하지 않습니다.
