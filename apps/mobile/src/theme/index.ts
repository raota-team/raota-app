import { Platform, type TextStyle, type ViewStyle } from "react-native"

/**
 * RAOTA의 네이티브 의미 토큰. 값은 apps/mobile/DESIGN.md를 따른다.
 * 겉모습은 "네오 브루탈리즘 라이트"(미색 바탕, 흰 카드, 2pt 먹선, 누를 수 있는 것에만 번지지 않는 그림자)이고 앱이 기준이다.
 * 화면 순서와 문구는 루트 웹 프로토타입과 같다.
 * "이전 이름" 표시가 붙은 키는 옛 화면 호환용이다. 새 화면은 쓰지 않는다.
 */
export const colors = {
  brand: "#E60000",
  brandPressed: "#CC0000",
  brandWeak: "#FFF0F0",
  ink: "#16181A",
  inkSub: "#4A4D52",
  /** 흰 면 위 5.1:1. 보조 글씨와 입력 안내 글씨 */
  textMuted: "#6B6E73",
  /** 구분 점, 비활성 장식 전용. 읽어야 하는 글씨에는 쓰지 않는다 */
  textFaint: "#BEBEBE",
  /** 화면 바탕(미색). 카드와 버튼의 면은 canvas(흰색)를 쓴다 */
  paper: "#FFF8EA",
  canvas: "#FFFFFF",
  canvasSoft: "#F2F2F2",
  surfaceInput: "#F7F7F7",
  surfacePressed: "#EAEAEA",
  /** 목록의 줄 사이, 표 안쪽 같은 정보 구분선(1pt). 부품의 테두리에는 outline을 쓴다 */
  border: "#E2E2E2",
  /** 카드, 버튼, 사진, 입력칸, 칩, 태그의 테두리. ink와 같은 값 */
  outline: "#16181A",
  /** 표시용 노랑. 라멘 종류 태그와 표시 스티커("오늘의 픽", "AI가 요약했어요", 추천 1위 숫자)에만 쓴다 */
  yolk: "#FFC93C",
  onDark: "#FFFFFF",
  /** 차콜 위 보조 글씨. 회색 hex 대신 쓴다 */
  onDarkMuted: "rgba(255, 255, 255, 0.7)",
  /** 어두운 면 안의 줄 구분선(흰색 18%) */
  onDarkLine: "rgba(255, 255, 255, 0.18)",
  /**
   * 화면 안 큰 구획의 어두운 면(마이 프로필, 추천 라멘집, 가게 상세 정보, 기록 완료 밴드).
   * 라멘집 간판의 진녹색이다. 검정 면은 어느 앱이나 쓰지만 이 색은 이 앱의 것이다.
   * 흰 글씨 11.6:1, 노랑 스티커 7.5:1로 안전하다. 다만 빨강은 2.4:1이라 이 면 위에 두지 않는다.
   * 글씨와 2pt 테두리는 계속 ink를 쓴다 — 이 색은 면 전용이다.
   */
  deep: "#00422E",
  /** 따뜻한 빈 면(기록량 히트맵의 빈 칸). 국물 색과 같은 계열이라 표가 한 덩어리로 읽힌다 */
  warmEmpty: "#F5DF97",
  positive: "#2E7D32",
  positiveWeak: "#EBF8F0",
  warning: "#A15C00",
  warningWeak: "#FFF7D6",
  critical: "#D92228",
  criticalWeak: "#FFF0F0",
  informative: "#3860BE",
  informativeWeak: "#EEF3FF",
  overlay: "rgba(0, 0, 0, 0.5)",
  transparent: "transparent",
  white: "#FFFFFF",
  black: "#000000",

  /** 이전 이름: canvas */
  background: "#FFFFFF",
  /** 이전 이름: canvasSoft */
  backgroundBasement: "#F2F2F2",
  /** 이전 이름: canvas */
  surface: "#FFFFFF",
  /** 이전 이름: surfaceInput */
  surfaceMuted: "#F7F7F7",
  /** 이전 이름: canvasSoft */
  brandSubtle: "#F2F2F2",
  /** 이전 이름: ink */
  text: "#16181A",
  /** 이전 이름: inkSub */
  textSubtle: "#4A4D52",
  /** 이전 이름: onDark */
  textInverted: "#FFFFFF",
  /** 이전 이름: textMuted (예전 #8A8A8A는 대비 미달) */
  placeholder: "#6B6E73",
  /** 이전 이름: textFaint */
  borderStrong: "#BEBEBE",
} as const

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
  /** 화면 좌우 여백. 웹의 px-5와 같다 */
  gutter: 20,
  component: 12,
  screenBottom: 56,
} as const

/** 6·8·12·16pt와 알약만 쓴다. 새 컴포넌트에 중간 반경을 만들지 않는다. */
export const radii = {
  none: 0,
  /** 스티커, 라멘 종류 태그, 태그, 유틸리티 버튼 */
  xs: 6,
  /** 카드, 버튼, 사진, 입력칸, 아이콘 버튼, 아바타 */
  sm: 12,
  /** 48pt 이하 썸네일, 지도 핀 */
  md: 8,
  /** 바텀시트 윗모서리, 가운데 확인창 */
  lg: 12,
  /** 작성 버튼(FAB)과 AI 큐레이터 배너 두 곳뿐 */
  xl: 16,
  /** 필터 칩, 공감·댓글 버튼 */
  pill: 999,
} as const

/** 선 굵기. 3pt 이상은 쓰지 않는다. 정보 구분선은 1pt(colors.border) */
export const line = {
  /** 칩, 태그, 스티커, 미터 칸 */
  thin: 1.5,
  /** 카드, 버튼, 사진, 입력칸, 탭 바 */
  base: 2,
} as const

export const fonts = {
  // 플랫폼 시스템 서체. iOS는 SF Pro와 Apple SD Gothic Neo로 그려져 웹과 글자 모양이 같다.
  body: Platform.select({
    ios: "System",
    android: "sans-serif",
    web: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Apple SD Gothic Neo", sans-serif',
    default: "System",
  }),
  display: Platform.select({
    ios: "System",
    android: "sans-serif",
    web: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Apple SD Gothic Neo", sans-serif',
    default: "System",
  }),
} as const

const text = (fontSize: number, lineHeight: number, fontWeight: TextStyle["fontWeight"], family = fonts.body): TextStyle => ({
  fontFamily: family,
  fontSize,
  lineHeight,
  fontWeight,
})

/** DESIGN.md의 글씨 크기 표. 12pt가 하한이다. */
export const typography = {
  /** 기록 완료의 "N번째 그릇" 숫자 한 곳 */
  counter: { ...text(56, 56, "900", fonts.display), letterSpacing: -2, fontVariant: ["tabular-nums"] },
  /** 플로우 도입 문장, 취향 정체성 제목, 가입 완료 */
  headline: { ...text(28, 35, "900", fonts.display), letterSpacing: -0.6 },
  /** 스택 헤더와 탭 루트 제목 */
  screenTitle: text(22, 29, "900"),
  /** 섹션 제목, 시트·확인창 제목 */
  sectionTitle: text(20, 27, "900"),
  /** 가게 이름, 기록 제목, 목록의 첫 줄 */
  cardTitle: text(16, 22, "800"),
  /** 메모, 설명, 폼 입력 */
  body: text(14, 22, "400"),
  /** 버튼 문구, 강조 본문 */
  bodyStrong: text(14, 22, "700"),
  /** 보조 설명, 칩 문구 */
  secondary: text(13, 19, "500"),
  /** 날짜, 거리, 개수, 탭 라벨, 배지 */
  meta: text(12, 17, "600"),

  /** 이전 이름: headline */
  display: text(28, 35, "900", fonts.display),
  /** 이전 이름: screenTitle */
  title: text(22, 29, "900"),
  /** 이전 이름: bodyStrong */
  label: text(14, 22, "700"),
  /** 이전 이름: secondary */
  caption: text(13, 19, "400"),
  /** 이전 이름: secondary 굵게 */
  captionStrong: text(13, 19, "700"),
  /** 이전 이름: meta */
  small: text(12, 17, "400"),
} satisfies Record<string, TextStyle>

const hard = (offset: number): ViewStyle => ({
  shadowColor: colors.ink,
  shadowOffset: { width: offset, height: offset },
  shadowOpacity: 1,
  shadowRadius: 0,
  // Android는 elevation으로 번지지 않는 그림자를 만들 수 없다. 그림자 없이 테두리만 보인다(후속 과제).
  elevation: 0,
})

/**
 * 번지지 않는 그림자는 "누를 수 있다"는 표시다. 카드, 사진, 타일, 검색창, 칩에는 쓰지 않는다.
 * 누르는 동안에는 그림자만큼 오른쪽 아래로 옮기고 pressedInto를 입힌다(ui의 Button·IconButton이 처리한다).
 */
export const shadows = {
  none: {} as ViewStyle,
  /** 버튼, 아이콘 버튼, 활성 탭, 지도의 선택된 핀 */
  hardS: hard(2),
  /** 작성 버튼(FAB), AI 큐레이터 배너 */
  hardM: hard(3),
  /** 눌린 상태: 그림자가 사라진다 */
  pressedInto: { shadowOpacity: 0 } satisfies ViewStyle,
  /** 이전 이름: 떠 있는 요소. 지금은 hardM과 같다 */
  floating: hard(3),
  /** 이전 이름: 카드 그림자는 없다 */
  card: {} as ViewStyle,
} as const

/** 눌렀을 때 그림자 속으로 들어가는 이동 */
/**
 * 사진이나 먹색 면이 깔려 있어 배경을 바꿔도 티가 나지 않는 것의 누름.
 * 화면마다 다른 불투명도를 만들지 않는다. 그림자가 있는 키는 pressInto를 쓴다.
 */
/**
 * 국물이 진해지는 한 계열. "많고 적음"을 말하는 자리에만 쓴다
 * (기록량 히트맵, 종류별·월별 분포). 값이 클수록 진한 쪽.
 *
 * 빨강은 행동과 선택 전용이라 수량에 쓰지 않는다. 라멘 종류마다 다른 색을 주는 방법도
 * 생각했지만, 국물 색은 전부 따뜻한 갈색 계열이라 색약에서 서로 구분되지 않는다
 * (dataviz 검증에서 ΔE 미달). 그래서 한 계열의 농도로 간다.
 * 색만으로 값을 말하지 않도록 옆에 숫자와 이름을 함께 둔다.
 */
export const broth = ["#D6A24A", "#B87C22", "#8E5A15", "#5E340A"] as const

export const pressFade: ViewStyle = { opacity: 0.8 }

export const pressInto = (offset: 2 | 3 = 2): ViewStyle => ({
  transform: [{ translateX: offset }, { translateY: offset }],
  shadowOpacity: 0,
})

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
  touchTarget,
  maxFontScale,
} as const

export type RaotaTheme = typeof theme

export default theme
