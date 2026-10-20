import { Fragment, useEffect, useState, type ReactNode } from "react"
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native"
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated"
import { Image } from "expo-image"
import Svg, { Path } from "react-native-svg"

import {
  MENU_CATEGORY_NAMES,
  menuCategoryOf,
  type DemoBowl,
  type MenuCategoryName,
  type ShopVisit,
  type TasteIdentity,
  type TasteScores,
} from "@raota/shared"
import { colors, radii, soupColorOf, spacing, tasteAxis, usePalette } from "../theme"
import { AppText } from "./ui"

const REVEAL_EASE = Easing.bezier(0.22, 1, 0.36, 1)
/** 첫 장 그릇 점은 최근 15그릇만. 한 줄에 들어가는 수라서 줄바꿈으로 높이가 달라지지 않는다 */
const MAX_BOWL_DOTS = 15
const BOWL_DOT = 12
/**
 * 장마다 글 양이 달라도 카드 높이가 같아야 넘길 때 아래가 출렁이지 않는다. 가로 줄의 카드는 가장 큰 장에 맞춰 늘어나므로
 * 최소 높이는 글과 그림이 들어갈 만큼만 둔다(너무 크면 빈 면이 남는다)
 */
const SLIDE_MIN_HEIGHT = 168
const ART = 64
const BOWL_PATH = "M3 9H33C33 18.5 26.3 26 18 26C9.7 26 3 18.5 3 9Z"

/**
 * 평균 점수를 육수·면 한 마디로 읽는다. 가게 상세 "이 가게의 맛"(src/domain/shopTaste.ts)과 같은 기준:
 * 3.5 이상은 높은 쪽, 2.5 이하는 낮은 쪽, 그 사이는 가운데.
 */
export function tasteLeanWords(scores: Pick<TasteScores, "brothDensity" | "noodleFirmness">) {
  const lean = (score: number) => (score >= 3.5 ? "high" : score <= 2.5 ? "low" : "mid")
  const broth = { high: "진한 육수", mid: "적당한 농도의 육수", low: "맑은 육수" }[lean(scores.brothDensity)]
  const noodle = { high: "단단한 면", mid: "알맞게 삶은 면", low: "부드러운 면" }[lean(scores.noodleFirmness)]
  return { broth, noodle }
}

/** 큰 글씨 조각. accent는 맛 지문 파랑으로 칠한다 */
type BigPart = string | { accent: string }

interface Slide {
  key: string
  kicker: string
  big: BigPart[]
  /** " · "로 이어 보여 주는 보조 줄 조각 */
  sub: string[]
  dark?: boolean
  bowls?: string[]
  /** 국물 종류별 몫(한 줄 막대) */
  shares?: Array<{ name: string; count: number }>
  /** 오른쪽 아래 그림: 그 국물 색 그릇 */
  bowlArt?: string
  /** 오른쪽 아래 그림: 단골집 사진 */
  photo?: string
  onPress?: () => void
}

export interface TasteStoryProps {
  recordCount: number
  /** 최근 순 그릇 원장 */
  bowls: DemoBowl[]
  /** 방문 많은 순 매장 */
  visits: ShopVisit[]
  typeCounts: Record<MenuCategoryName, number>
  scores: TasteScores
  identity: TasteIdentity
  /** 단골집 장을 눌렀을 때. 원장에 매장이 없으면 비워 두어 누를 수 없게 한다 */
  onOpenFavorite?: () => void
}

/**
 * 종합 리포트 맨 위의 "한 장씩 넘기는 이야기"(사용자 결정, 2026.10.20).
 * 몇 그릇 → 무슨 국물 → 어떤 취향 → 단골집 순서로 큰 글씨 한 문장씩 옆으로 넘긴다.
 * 카드는 본문 폭 그대로라 옆 장이 엿보이지 않고, 장 사이는 화면 여백만큼 띄워 넘길 때 화면 끝까지 밀려 나간다.
 */
export function TasteStory({ recordCount, bowls, visits, typeCounts, scores, identity, onOpenFavorite }: TasteStoryProps) {
  const { width: windowWidth } = useWindowDimensions()
  const [width, setWidth] = useState(windowWidth)
  const [page, setPage] = useState(0)
  const palette = usePalette()

  const ranked = MENU_CATEGORY_NAMES.filter((name) => typeCounts[name] > 0).sort((a, b) => typeCounts[b] - typeCounts[a])
  const [top, ...rest] = ranked
  const { broth, noodle } = tasteLeanWords(scores)
  const [favorite, runnerUp] = visits

  const slides: Slide[] = [
    {
      key: "count",
      kicker: "지금까지",
      big: [`${recordCount}그릇을\n기록했어요`],
      sub: [`${visits.length}곳을 다녔어요`],
      dark: true,
      bowls: bowls.slice(0, MAX_BOWL_DOTS).map((bowl) => menuCategoryOf(bowl.type)),
    },
  ]
  if (top) {
    slides.push({
      key: "soup",
      kicker: "가장 많이 먹은 국물",
      big: [`${top} `, { accent: `${typeCounts[top]}그릇` }],
      sub: rest.length ? [rest.map((name) => `${name} ${typeCounts[name]}`).join(" · ")] : [],
      shares: ranked.map((name) => ({ name, count: typeCounts[name] })),
    })
  }
  slides.push({
    key: "taste",
    kicker: "나의 취향",
    big: [{ accent: broth }, "에\n", { accent: noodle }],
    sub: [identity.title, ...(identity.tags.length ? [identity.tags.map((tag) => `#${tag}`).join(" ")] : [])],
    bowlArt: top,
  })
  if (favorite) {
    slides.push({
      key: "regular",
      kicker: "단골집",
      big: [`${favorite.name}에\n`, { accent: `${favorite.visitCount}번` }, " 갔어요"],
      sub: runnerUp ? [`그다음은 ${runnerUp.name} ${runnerUp.visitCount}번`] : [],
      photo: favorite.photo || undefined,
      onPress: onOpenFavorite,
    })
  }

  const cardWidth = Math.max(0, width - spacing.gutter * 2)
  // 한 장 + 장 사이 간격만큼 멈춘다. 간격이 화면 여백과 같아 다음 장은 화면 밖에서 기다린다
  const interval = cardWidth + spacing.gutter

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width
    if (next > 0 && next !== width) setWidth(next)
  }

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (interval <= 0) return
    const next = Math.min(slides.length - 1, Math.max(0, Math.round(event.nativeEvent.contentOffset.x / interval)))
    if (next !== page) setPage(next)
  }

  // 국물 점 테두리는 카드 면(ink)과 반대색으로 둘러야 같은 계열 국물 색이 면에 묻히지 않는다.
  // soupEdge는 바탕(canvas) 기준이라 반전된 ink 면 위에서는 사라진다
  const bowlEdge = `${palette.onInk}4D`

  return (
    <View onLayout={onLayout}>
      <ScrollView
        contentContainerStyle={styles.track}
        decelerationRate="fast"
        disableIntervalMomentum
        horizontal
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        snapToAlignment="start"
        snapToInterval={interval}
      >
        {slides.map((slide, index) => (
          <StorySlide bowlEdge={bowlEdge} first={index === 0} key={slide.key} slide={slide} soupEdge={palette.soupEdge} width={cardWidth} />
        ))}
      </ScrollView>
      <View accessibilityLabel={`${page + 1} / ${slides.length}`} accessibilityRole="text" accessible style={styles.dots}>
        {slides.map((slide, index) => (
          <View key={slide.key} style={[styles.dot, index === page && styles.dotActive]} />
        ))}
      </View>
    </View>
  )
}

function StorySlide({ slide, width, first, bowlEdge, soupEdge }: { slide: Slide; width: number; first: boolean; bowlEdge: string; soupEdge: string }) {
  const tone = slide.dark ? "onInk" : "ink"
  const subTone = slide.dark ? "onInk" : "sub"
  const bigText = slide.big.map((part) => (typeof part === "string" ? part : part.accent)).join("")
  const label = [slide.kicker, bigText.replace(/\n/g, " "), slide.sub.join(" · ")].filter(Boolean).join(". ")
  const total = slide.shares?.reduce((sum, share) => sum + share.count, 0) ?? 0
  const content = (
    <>
      <View style={styles.head}>
        <View style={styles.text}>
          <AppText capScale style={[styles.kicker, slide.dark ? styles.dim : null]} tone={slide.dark ? "onInk" : "muted"} variant="secondary">
            {slide.kicker}
          </AppText>
          <BigText animate={first}>
            <AppText lineBreakStrategyIOS="hangul-word" style={styles.big} tone={tone} variant="headline">
              {slide.big.map((part, index) =>
                typeof part === "string" ? part : <AppText key={index} style={[styles.big, styles.accent]} variant="headline">{part.accent}</AppText>,
              )}
            </AppText>
          </BigText>
          {slide.sub.length ? (
            <AppText lineBreakStrategyIOS="hangul-word" style={[styles.sub, slide.dark ? styles.dim : null]} tone={subTone} variant="secondary">
              {slide.sub.map((part, index) => (
                // 조각마다 따로 둔 글씨라 정체성 이름("진한 돈골파")을 그대로 찾을 수 있다
                <Fragment key={index}>
                  {index > 0 ? " · " : null}
                  <AppText tone={subTone} variant="secondary">{part}</AppText>
                </Fragment>
              ))}
            </AppText>
          ) : null}
        </View>
        {slide.bowlArt ? (
          // 가장 많이 먹은 국물 색으로 채운 그릇. 취향 문장 옆에서 "어떤 국물의 사람인지"를 색으로 한 번 더 말한다
          <Svg height={ART * (28 / 36)} viewBox="0 0 36 28" width={ART}>
            <Path d={BOWL_PATH} fill={soupColorOf(slide.bowlArt)} stroke={soupEdge} strokeWidth={1} />
          </Svg>
        ) : null}
        {slide.photo ? <Image contentFit="cover" source={{ uri: slide.photo }} style={styles.photo} transition={150} /> : null}
      </View>
      {slide.shares && total > 0 ? (
        // 국물별 몫을 한 줄로 이어 붙인 막대. 손잡이 없는 비율 띠라 슬라이더로 읽히지 않는다
        <View style={styles.footer}>
          <View style={styles.shares}>
            {slide.shares.map((share) => (
              <View key={share.name} style={[styles.share, { flex: share.count, backgroundColor: soupColorOf(share.name) }]} />
            ))}
          </View>
        </View>
      ) : null}
      {slide.bowls?.length ? (
        <View style={styles.bowls}>
          {slide.bowls.map((type, index) => (
            <View key={index} style={[styles.bowl, { backgroundColor: soupColorOf(type), borderColor: bowlEdge }]} />
          ))}
        </View>
      ) : null}
    </>
  )
  const cardStyle = [styles.slide, { width }, slide.dark ? styles.slideDark : null]

  if (slide.onPress) {
    return (
      <Pressable
        accessibilityHint="매장 화면을 열어요"
        accessibilityLabel={label}
        accessibilityRole="button"
        onPress={slide.onPress}
        style={({ pressed }) => [cardStyle, pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    )
  }
  return (
    <View accessibilityLabel={label} accessibilityRole="text" accessible style={cardStyle}>
      {content}
    </View>
  )
}

/** 첫 장의 큰 글씨만 처음 한 번 6pt 아래에서 떠오른다. 자리는 처음부터 잡혀 있어 카드 높이가 변하지 않는다 */
function BigText({ animate, children }: { animate: boolean; children: ReactNode }) {
  const reducedMotion = useReducedMotion()
  const progress = useSharedValue(animate && !reducedMotion ? 0 : 1)

  useEffect(() => {
    if (!animate || reducedMotion) {
      progress.value = 1
      return
    }
    progress.value = withTiming(1, { duration: 500, easing: REVEAL_EASE })
  }, [animate, progress, reducedMotion])

  const animated = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ translateY: 6 * (1 - progress.value) }] }))
  return <Animated.View style={[styles.bigWrap, animated]}>{children}</Animated.View>
}

const styles = StyleSheet.create({
  track: { paddingHorizontal: spacing.gutter, gap: spacing.gutter },
  // 큰 카드 모양은 32pt(radii.lg) 하나다. 시안의 24pt는 디자인 시스템에 없는 중간 반경이라 맞췄다
  slide: { minHeight: SLIDE_MIN_HEIGHT, padding: spacing.x5, borderRadius: radii.lg, backgroundColor: colors.canvasSoft },
  // ink 면은 다크 모드에서 흰 면으로 뒤집혀, 두 모드 모두 이 장이 가장 대비가 큰 카드가 된다
  slideDark: { backgroundColor: colors.ink },
  pressed: { opacity: 0.8 },
  kicker: { fontWeight: "600" },
  dim: { opacity: 0.7 },
  bigWrap: { marginTop: spacing.x1_5 },
  big: { fontWeight: "700" },
  accent: { color: tasteAxis.satisfaction },
  sub: { marginTop: spacing.x1_5 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: spacing.x3 },
  text: { flex: 1 },
  photo: { width: ART, height: ART, borderRadius: radii.sm, backgroundColor: colors.secondary },
  footer: { marginTop: "auto", paddingTop: spacing.x3 },
  shares: { flexDirection: "row", gap: 2, height: 10 },
  share: { borderRadius: radii.pill, borderWidth: 1, borderColor: colors.soupEdge },
  bowls: { flexDirection: "row", flexWrap: "wrap", gap: spacing.x1, marginTop: "auto", paddingTop: spacing.x3 },
  bowl: { width: BOWL_DOT, height: BOWL_DOT, borderRadius: radii.pill, borderWidth: 1 },
  dots: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: spacing.x1, marginTop: spacing.x3, minHeight: 6 },
  dot: { width: 6, height: 6, borderRadius: radii.pill, backgroundColor: colors.secondary },
  dotActive: { width: 16, backgroundColor: colors.ink },
})
