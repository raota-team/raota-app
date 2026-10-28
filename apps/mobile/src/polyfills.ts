// Hermes(iOS·Android JS 엔진)에는 Intl.PluralRules가 없다. Lingui는 번역의 plural(1 bowl / 2 bowls)을 고를 때 이것을 쓰므로,
// 없으면 복수형 문구를 그리는 순간 화면이 오류로 멈춘다. 엔진에 이미 있으면 polyfill.js는 아무것도 바꾸지 않는다.
// 지원 언어(SUPPORTED_LOCALES)를 더하면 여기에도 locale-data를 더한다.
import "@formatjs/intl-pluralrules/polyfill.js"
import "@formatjs/intl-pluralrules/locale-data/ko.js"
import "@formatjs/intl-pluralrules/locale-data/en.js"
import "@formatjs/intl-pluralrules/locale-data/zh.js"
import "@formatjs/intl-pluralrules/locale-data/ja.js"
import "@formatjs/intl-pluralrules/locale-data/es.js"
