import { Platform, type TextStyle, type ViewStyle } from "react-native"

/**
 * RAOTA의 네이티브 의미 토큰. 값은 apps/mobile/DESIGN.md와 루트 웹 프로토타입(src/index.css)을 따른다.
 * iPhone에서 1pt는 웹 1px과 같은 크기로 보이므로 숫자를 웹과 똑같이 둔다.
 * "이전 이름" 표시가 붙은 키는 옛 화면 호환용이다. 새 화면은 쓰지 않는다.
 */
export const colors = {
  brand: "#E60000",
  brandPressed: "#CC0000",
  brandWeak: "#FFF0F0",
  ink: "#25282B",
  inkSub: "#4A4D52",
  /** 흰 면 위 5.1:1. 보조 글씨와 입력 안내 글씨 */
  textMuted: "#6B6E73",
  /** 구분 점, 비활성 장식 전용. 읽어야 하는 글씨에는 쓰지 않는다 */
  textFaint: "#BEBEBE",
  canvas: "#FFFFFF",
  canvasSoft: "#F2F2F2",
  surfaceInput: "#F7F7F7",
  surfacePressed: "#EAEAEA",
  border: "#E2E2E2",
  onDark: "#FFFFFF",
  /** 차콜 위 보조 글씨. 회색 hex 대신 쓴다 */
  onDarkMuted: "rgba(255, 255, 255, 0.7)",
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
  text: "#25282B",
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

/** 2·6·12pt와 알약만 쓴다. 새 컴포넌트에 중간 반경을 만들지 않는다. */
export const radii = {
  none: 0,
  /** 태그, 유틸리티 버튼 */
  xs: 2,
  /** 카드, 사진, 입력칸 */
  sm: 6,
  /** 바텀시트 윗모서리, 가운데 확인창 */
  lg: 12,
  pill: 999,
  /** 이전 이름: sm */
  md: 6,
  /** 이전 이름: lg */
  xl: 12,
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
  counter: { ...text(56, 56, "800", fonts.display), letterSpacing: -2, fontVariant: ["tabular-nums"] },
  /** 플로우 도입 문장, 취향 정체성 제목, 가입 완료 */
  headline: text(24, 31, "800", fonts.display),
  /** 스택 헤더와 탭 루트 제목 */
  screenTitle: text(20, 28, "800"),
  /** 섹션 제목, 시트·확인창 제목 */
  sectionTitle: text(17, 24, "800"),
  /** 가게 이름, 기록 제목, 목록의 첫 줄 */
  cardTitle: text(15, 21, "700"),
  /** 메모, 설명, 폼 입력 */
  body: text(14, 22, "400"),
  /** 버튼 문구, 강조 본문 */
  bodyStrong: text(14, 22, "700"),
  /** 보조 설명, 칩 문구 */
  secondary: text(13, 19, "500"),
  /** 날짜, 거리, 개수, 탭 라벨, 배지 */
  meta: text(12, 17, "600"),

  /** 이전 이름: headline */
  display: text(24, 31, "800", fonts.display),
  /** 이전 이름: screenTitle */
  title: text(20, 28, "800"),
  /** 이전 이름: bodyStrong */
  label: text(14, 22, "700"),
  /** 이전 이름: secondary */
  caption: text(13, 19, "400"),
  /** 이전 이름: secondary 굵게 */
  captionStrong: text(13, 19, "700"),
  /** 이전 이름: meta */
  small: text(12, 17, "400"),
} satisfies Record<string, TextStyle>

/** 콘텐츠 카드는 그림자가 없다. 떠 있는 요소(FAB, 시트, 확인창, 토스트)만 floating을 쓴다. */
export const shadows = {
  none: {} as ViewStyle,
  floating: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  } satisfies ViewStyle,
  /** 이전 이름: 카드 그림자는 없앴다. none과 같다 */
  card: {} as ViewStyle,
} as const

export const touchTarget = 44

/** 탭 라벨, 한 줄 메타처럼 넘치면 안 되는 글씨의 Dynamic Type 상한 */
export const maxFontScale = 1.3

export const theme = {
  colors,
  spacing,
  radii,
  fonts,
  typography,
  shadows,
  touchTarget,
  maxFontScale,
} as const

export type RaotaTheme = typeof theme

export default theme
