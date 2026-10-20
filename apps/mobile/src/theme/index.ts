import { DynamicColorIOS, Platform, useColorScheme, type ColorValue, type TextStyle, type ViewStyle } from "react-native"
import type { TasteAxisKey } from "@raota/shared"

/**
 * RAOTA의 네이티브 의미 토큰. 값과 역할은 apps/mobile/DESIGN.md(핀터레스트 DESIGN.md를 옮긴 것)를 따른다.
 * 사진이 주인공인 평평한 화면: 흰 바탕, 따뜻한 회색 면, 검정 글씨, 16·32pt 모서리와 알약, 그림자 없음.
 * 빨강은 화면의 주요 행동 하나와 완식 도장에만 쓴다. 뜻을 싣는 색은 국물 색과 맛 지문 축 색뿐이다(docs/RAOTA_COLORS.md).
 *
 * 다크 모드: iOS에서는 DynamicColorIOS라 시스템 설정을 따라 저절로 바뀐다. 웹·안드로이드는 밝은 값만 쓴다.
 * 색을 문자열로 다뤄야 하는 곳(투명도 합성, 그라데이션 끝색)은 usePalette()로 지금 모드의 hex를 받는다.
 */
const light = {
  /** 빨간 면(주요 버튼, 도장 테두리). 글씨에는 brandText를 쓴다 */
  brand: "#E60000",
  brandPressed: "#CC0000",
  brandWeak: "#FFF0F0",
  /** 빨간 글씨(필수 안내, 좋아요 수 등). 밝은 모드는 brand와 같고 다크 모드에서만 밝힌다 */
  brandText: "#E60000",
  /** 제목, 고른 칩·탭의 면 */
  ink: "#000000",
  /** ink 면 위의 글씨 */
  onInk: "#FFFFFF",
  /** 본문 */
  inkSub: "#33332E",
  /** 보조 글씨. 흰 면 6.1:1, canvasSoft 5.7:1 */
  textMuted: "#62625B",
  /** 구분 점, 비활성 장식 전용. 읽어야 하는 글씨에는 쓰지 않는다 */
  textFaint: "#C8C8C1",
  /** 화면 바탕 */
  paper: "#FFFFFF",
  canvas: "#FFFFFF",
  /** 따뜻한 회색 면(surface-card): 카드, 사진 자리, 검색창, 칩, 아이콘 버튼 */
  canvasSoft: "#F6F6F3",
  surfaceInput: "#F6F6F3",
  /** 회색·흰 면이 눌렸을 때 */
  surfacePressed: "#E5E5E0",
  /** 보조 버튼의 면(secondary-bg)과 눌림 */
  secondary: "#E5E5E0",
  secondaryPressed: "#C8C8C1",
  /** 목록 구분선(hairline) */
  border: "#DADAD3",
  /** 입력칸 테두리 전용(ash). 카드와 버튼에는 테두리를 두르지 않는다 */
  outline: "#91918C",
  /** 빨강·사진 위 글씨. 모드와 상관없이 흰색 */
  onDark: "#FFFFFF",
  onDarkMuted: "rgba(255, 255, 255, 0.7)",
  onDarkLine: "rgba(255, 255, 255, 0.18)",
  /** 읽기 전용 태그의 옅은 면 */
  inkWash: "rgba(0, 0, 0, 0.06)",
  /** 토스트처럼 드물게 쓰는 어두운 면 */
  deep: "#262622",
  positive: "#103C25",
  positiveWeak: "#C7F0DA",
  warning: "#A15C00",
  warningWeak: "#FFF7D6",
  critical: "#9E0A0A",
  criticalWeak: "#FFF0F0",
  informative: "#435EE5",
  informativeWeak: "#EEF1FD",
  /** 키보드 초점 고리 */
  focus: "#435EE5",
  overlay: "rgba(0, 0, 0, 0.5)",
  transparent: "transparent",
  white: "#FFFFFF",
  black: "#000000",
  /** 국물 색 점·칸·막대의 1pt 테두리 */
  soupEdge: "rgba(0, 0, 0, 0.12)",
  /** 고른 칩·탭·평가 칸의 면과 그 위 글씨. 밝은 모드는 검정, 다크 모드는 눈부신 흰 면 대신 밝은 회색 */
  selected: "#000000",
  onSelected: "#FFFFFF",
  /** 사진 위에 얹는 알약(종류, 오늘의 픽, 사진 장수 등) */
  photoPill: "#FFFFFF",
  onPhotoPill: "#000000",
  /** 영업 중 표시 점. 상태는 초록으로 모드와 상관없이 알아보게 한다 */
  open: "#1F9D55",
}

type PaletteKey = keyof typeof light
export type Palette = Record<PaletteKey, string>

/** 다크 모드. 같은 따뜻한 회색 계열을 어둡게 뒤집었다. 보조 글씨 바탕 대비 8.3:1, 회색 면 6.9:1 */
const dark: Palette = {
  brand: "#E60000",
  brandPressed: "#CC0000",
  brandWeak: "#3A1414",
  /** #E60000은 어두운 바탕에서 3.9:1이라 작은 글씨로 읽기 어렵다. 바탕 대비 6.1:1로 밝혔다 */
  brandText: "#FF5A5A",
  ink: "#FFFFFF",
  onInk: "#000000",
  inkSub: "#E5E5E0",
  textMuted: "#A8A8A0",
  textFaint: "#55554F",
  paper: "#121211",
  canvas: "#121211",
  canvasSoft: "#22221F",
  surfaceInput: "#22221F",
  surfacePressed: "#33332F",
  secondary: "#33332F",
  secondaryPressed: "#4A4A44",
  border: "#33332F",
  outline: "#7A7A73",
  onDark: "#FFFFFF",
  onDarkMuted: "rgba(255, 255, 255, 0.7)",
  onDarkLine: "rgba(255, 255, 255, 0.18)",
  inkWash: "rgba(255, 255, 255, 0.08)",
  /** 흰 글씨 8.2:1. 바탕(#121211)과 확실히 떨어져 보이도록 한 단계 밝혔다 */
  deep: "#4F4F48",
  positive: "#7FD39A",
  positiveWeak: "#16301B",
  warning: "#E0A040",
  warningWeak: "#3A2C10",
  critical: "#FF6B6B",
  criticalWeak: "#3A1416",
  informative: "#7B93F2",
  informativeWeak: "#1C2340",
  focus: "#7B93F2",
  overlay: "rgba(0, 0, 0, 0.6)",
  transparent: "transparent",
  white: "#FFFFFF",
  black: "#000000",
  soupEdge: "rgba(255, 255, 255, 0.18)",
  /** 흰 글씨 4.8:1을 지키면서 회색 면(#22221F) 위에서도 고른 상태가 드러나는 밝기 */
  selected: "#73736C",
  onSelected: "#FFFFFF",
  photoPill: "rgba(18, 18, 17, 0.88)",
  onPhotoPill: "#FFFFFF",
  open: "#3DD68C",
}

export const palettes: Readonly<Record<"light" | "dark", Palette>> = { light, dark }

const adaptive = <K extends string>(lightValues: Record<K, string>, darkValues: Record<K, string>) =>
  Object.fromEntries(
    (Object.keys(lightValues) as K[]).map((key) => [
      key,
      Platform.OS === "ios" ? DynamicColorIOS({ light: lightValues[key], dark: darkValues[key] }) : lightValues[key],
    ]),
  ) as Record<K, ColorValue>

export const colors = adaptive(light, dark)

/** 색을 문자열로 다뤄야 할 때 지금 모드의 hex 묶음. 웹·안드로이드는 늘 밝은 값 */
export function usePalette(): Palette {
  const scheme = useColorScheme()
  return Platform.OS === "ios" && scheme === "dark" ? dark : light
}

export const spacing = {
  x0_5: 2,
  x1: 4,
  x1_5: 6,
  x2: 8,
  x2_5: 10,
  x3: 12,
  x3_5: 14,
  x4: 16,
  x4_5: 18,
  x5: 20,
  x6: 24,
  x7: 28,
  x8: 32,
  x9: 36,
  x10: 40,
  x11: 44,
  x12: 48,
  x13: 52,
  x14: 56,
  x16: 64,
  /** 화면 좌우 여백 */
  gutter: 16,
  /** 사진 격자(메이슨리) 칸 사이 */
  grid: 8,
  /** 큰 구획 사이. 40pt는 너무 벌어진다는 피드백으로 32pt로 맞췄다 */
  section: 32,
  component: 12,
} as const

/** 16·32pt와 알약 세 가지가 전부다(rounded.md · lg · full). */
export const radii = {
  none: 0,
  /** 드문 작은 면(rounded.sm) */
  xs: 8,
  /** 버튼, 입력칸, 카드, 사진, 썸네일 — 기본 반경(rounded.md) */
  sm: 16,
  md: 16,
  /** 큰 카드, 큰 사진, 바텀시트, 확인창(rounded.lg) */
  lg: 32,
  xl: 32,
  /** 칩, 검색창, 아이콘 버튼, 아바타, 사진 위 알약(rounded.full) */
  pill: 999,
} as const

/** 선은 1pt 하나다. 목록 구분선(border)과 입력칸 테두리(outline)에만 쓴다 */
export const line = {
  hair: 1,
  thin: 1,
  base: 1,
} as const

/**
 * Pin Sans 대신 Pretendard. 글자 폭과 x높이가 비슷하고 한글이 함께 들어 있다.
 * iOS는 app.json의 expo-font 플러그인으로 네 굵기(400·500·600·700)를 앱에 넣어 "Pretendard" 한 이름에서 fontWeight로 고른다.
 */
export const fonts = {
  body: Platform.select({
    ios: "Pretendard",
    android: "sans-serif",
    web: 'Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif',
    default: "Pretendard",
  }),
} as const

const text = (fontSize: number, lineHeight: number, fontWeight: TextStyle["fontWeight"], letterSpacing = 0): TextStyle => ({
  fontFamily: fonts.body,
  fontSize,
  lineHeight,
  fontWeight,
  letterSpacing,
})

/** 글씨 크기 표(DESIGN.md typography). 12pt가 하한이고, 굵기는 700까지다. */
export const typography = {
  /** display-lg를 줄인 값. 기록 완료의 "N번째 그릇" 한 곳 */
  counter: { ...text(34, 40, "700", -1.2), fontVariant: ["tabular-nums"] },
  /** heading-xl: 탭 화면 제목, 플로우 질문, 취향 정체성, 프로필 이름 */
  headline: text(28, 34, "700", -1.2),
  /** heading-lg: 가게 이름 같은 화면 안의 가장 큰 제목, 시트·확인창 제목 */
  screenTitle: text(22, 28, "600"),
  /** 스택 헤더의 화면 이름 */
  navTitle: text(17, 22, "600"),
  /** heading-md: 섹션 제목, 카드 제목 */
  sectionTitle: text(18, 24, "600"),
  /** body-strong: 목록 첫 줄(가게 이름, 기록 제목) */
  cardTitle: text(16, 22, "600"),
  /** body-md: 설명, 메모, 폼 입력 */
  body: text(16, 22, "400"),
  /** body-strong */
  bodyStrong: text(16, 22, "600"),
  /** button-md: 버튼과 칩 문구 */
  button: text(14, 18, "700"),
  /** body-sm: 보조 설명, 핀 아래 메타 */
  secondary: text(14, 20, "400"),
  /** caption-md: 날짜, 거리, 개수, 탭 라벨, 사진 위 알약 */
  meta: text(12, 18, "500"),
} satisfies Record<string, TextStyle>

/**
 * 면은 그림자로 띄우지 않는다. 깊이는 사진이 만든다.
 * 유일한 그림자는 화면 위에 뜨는 층(바텀시트, 확인창, 지도 위 떠 있는 카드)의 16pt 주변광이다.
 */
export const shadows = {
  none: {} as ViewStyle,
  modal: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  } satisfies ViewStyle,
} as const

/**
 * 맛 지문 축 색. 웜톤인 국물 색과 반대인 쿨톤 파랑 한 계열이다.
 * 밝기를 비슷하게 맞춰 진하기(많고 적음)로 읽히지 않게 했다. 다크 모드는 어두운 막대 위에서 보이도록 한 단계 밝다.
 * 순서와 기준은 docs/RAOTA_COLORS.md의 "맛 지문 축 색".
 */
const tasteAxisLight: Record<TasteAxisKey, string> = { satisfaction: "#2A63D4", brothDensity: "#1784B0", noodleFirmness: "#5A55D2", topping: "#167A86", revisit: "#3A4FA8" }
const tasteAxisDark: Record<TasteAxisKey, string> = { satisfaction: "#6E95F0", brothDensity: "#4FB0D6", noodleFirmness: "#8C88EE", topping: "#45A9B5", revisit: "#7A8BE0" }
export const tasteAxis = adaptive<TasteAxisKey>(tasteAxisLight, tasteAxisDark)

/** SVG처럼 색을 문자열로 받아야 하는 곳에서 쓰는 지금 모드의 맛 지문 축 색 */
export function useTasteAxisPalette(): Record<TasteAxisKey, string> {
  const scheme = useColorScheme()
  return Platform.OS === "ios" && scheme === "dark" ? tasteAxisDark : tasteAxisLight
}

/**
 * 국물이 진해지는 한 계열. "많고 적음"을 말하는 자리에만 쓴다. 값이 클수록 진한 쪽.
 * 빨강은 행동과 선택 전용이라 수량에 쓰지 않는다. 종류를 구분하는 색은 아래 soup이다.
 */
export const broth = ["#D6A24A", "#B87C22", "#8E5A15", "#5E340A"] as const

/**
 * 라멘로그 캘린더(잔디)의 하루 그릇 수 단계. 1그릇 · 2그릇 · 3그릇 · 4그릇 이상 순으로 라오타 빨강이 연했다가 진해진다.
 * 대부분의 날이 1그릇이라 첫 단계도 회색 빈 칸과 또렷이 구별되게 둔다. 3그릇이 브랜드 빨강, 4그릇 이상은 더 깊은 빨강.
 * 다크 모드는 빈 칸(#33332F)과 색상만이 아니라 밝기로도 갈리게, 1그릇부터 빈 칸보다 확실히 밝은 붉은색(약 1.65:1)에서 시작해
 * 단계마다 1.25배 이상 밝아지며 가장 밝은 빨강으로 간다.
 */
const ramenHeatTones = adaptive(
  { l1: "#F6AFAF", l2: "#EE6767", l3: "#E60000", l4: "#A30000" },
  { l1: "#943030", l2: "#BE2222", l3: "#E81414", l4: "#FF6060" },
)
export const ramenHeat = [ramenHeatTones.l1, ramenHeatTones.l2, ramenHeatTones.l3, ramenHeatTones.l4] as const

/**
 * 라멘 종류마다의 실제 국물 색. "어떤 종류인가"를 말하는 자리에만 쓰고, broth(많고 적음)와 섞지 않는다.
 * 국물 색은 모드와 상관없이 같다. 규칙과 추가 방법은 docs/RAOTA_COLORS.md의 "국물 색".
 *
 * 바탕에 테두리 없이 놓으면 밝은 국물이 묻히므로 점·칸·막대에는 늘 colors.soupEdge 1pt 테두리를 두른다.
 * 따뜻한 갈색끼리라 색약에서 헷갈릴 수 있어 이름과 숫자를 함께 둔다. 색만으로 종류를 말하지 않는다.
 * 색이 정해지지 않은 종류(탄탄멘, 마제소바, 아부라소바, 기타)는 soupNeutral로 칠한다.
 * 이에케는 돈코츠와 구별되는 간장빛 국물 톤을 쓴다.
 */
export const soup: Readonly<Record<string, string>> = {
  돈코츠: "#E3CFA4",
  이에케: "#70410E",
  쇼유: "#A8662C",
  시오: "#E9C24F",
  미소: "#D4733A",
  츠케멘: "#5A3A22",
}
export const soupNeutral = "#CFCAC0"
export const soupColorOf = (type: string) => soup[type.replace(/\s*라멘$/, "").trim()] ?? soupNeutral

/** 사진이나 색 면처럼 배경을 바꿔도 티가 나지 않는 것의 누름. 회색·흰 면은 surfacePressed로 바꾼다 */
export const pressFade: ViewStyle = { opacity: 0.8 }

export const touchTarget = 44

/** 탭 라벨, 한 줄 메타처럼 넘치면 안 되는 글씨의 Dynamic Type 상한 */
export const maxFontScale = 1.3

export const theme = {
  colors,
  spacing,
  radii,
  line,
  fonts,
  typography,
  shadows,
  tasteAxis,
  touchTarget,
  maxFontScale,
} as const

export type RaotaTheme = typeof theme

export default theme
