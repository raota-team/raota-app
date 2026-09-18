import { useState } from "react"
import { router } from "expo-router"
import {
  Archive,
  ChevronRight,
  History,
  RefreshCw,
  Share2,
  Sparkles,
} from "lucide-react-native"
import { Pressable, Share, StyleSheet, View } from "react-native"
import { Image } from "expo-image"
import Svg, { Circle, Line, Polygon, Text as SvgText } from "react-native-svg"

import type { TasteMetric, TasteReport } from "@raota/shared"
import { useRaota } from "@/src/state/RaotaStore"
import {
  ActionButton,
  FlowHeader,
  FlowPage,
  FlowScroll,
  InlineNotice,
  Text,
  flowStyles,
  palette,
} from "../_layout"

const SIZE = 260
const CENTER = 130
const RADIUS = 75

const DEFAULT_METRICS: TasteMetric[] = [
  { key: "brothRichness", label: "국물 농도", score: 4.8, average: 2.9 },
  { key: "noodleFirmness", label: "면 경도", score: 4.5, average: 2.6 },
  { key: "saltBalance", label: "염도 밸런스", score: 4.1, average: 2.8 },
  { key: "umami", label: "타레 감칠맛", score: 4.9, average: 3.1 },
  { key: "oilRichness", label: "오일 리치함", score: 4.2, average: 2.5 },
]

const TOP_VISITED_SHOPS = [
  {
    rank: 1,
    name: "멘야준",
    branch: "망원 본점",
    style: "특제 쇼유 라멘",
    photo:
      "https://images.unsplash.com/photo-1742633882713-593c13e90231?w=200&h=200&fit=crop&auto=format&q=80",
    visitCount: 14,
    sharePct: 33,
    reason: "총 43그릇 중 14그릇(33%)을 완식한 회원님의 독보적 1위 최애 단골 매장",
    mustTry: "특제 쇼유 라멘 (면 카타멘 추천)",
  },
  {
    rank: 2,
    name: "하쿠텐",
    branch: "연남점",
    style: "매운 이에케 라멘",
    photo:
      "https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=200&h=200&fit=crop&auto=format&q=80",
    visitCount: 11,
    sharePct: 26,
    reason: "초고농도 돈골 스프가 생각날 때마다 꾸준히 찾은 2위 단골 매장",
    mustTry: "매운 이에케 라멘 (간 보통 / 기름 보통)",
  },
  {
    rank: 3,
    name: "세상끝의라멘",
    branch: "합정점",
    style: "끝라멘 (블랙 쇼유)",
    photo:
      "https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=200&h=200&fit=crop&auto=format&q=80",
    visitCount: 7,
    sharePct: 16,
    reason: "진한 흑간장 타레의 묵직한 감칠맛으로 재방문을 거듭한 3위 매장",
    mustTry: "끝라멘 + 수비드 목살 차슈 추가",
  },
]

const STYLE_ROWS = [
  { name: "돈코츠 (돼지뼈)", pct: 74, count: 18, note: "농후 백탕 · 요코하마 이에케" },
  { name: "쇼유 (간장)", pct: 62, count: 12, note: "동물계와 해산물 더블 블렌딩" },
  { name: "토리파이탄 (닭백탕)", pct: 45, count: 8, note: "크리미 거품 육수" },
  { name: "미소 (된장)", pct: 24, count: 3, note: "삿포로 숙성 적미소 볶음" },
  { name: "시오 (소금)", pct: 15, count: 2, note: "맑고 깊은 닭청탕 육수" },
]

const GENERATION_STEPS = [
  { title: "라멘로그 벡터 추출", desc: "43건의 테이스팅 태그 및 메모 임베딩 분석 중..." },
  { title: "라멘집 마스터 DB 매핑", desc: "방문 매장의 육수 농도·염도·면발 스펙 결합 중..." },
  { title: "라멘 입맛 밸런스 연산", desc: "전체 유저 대비 취향 편차 및 매칭 매장 TOP 3 산출 중..." },
  { title: "AI 정밀 리포트 합성 완료", desc: "RAOTA AI 정밀 검증 스탬프 날인 중..." },
]

function coord(index: number, value: number) {
  const angle = (Math.PI * 2 * index) / 5 - Math.PI / 2
  return {
    x: CENTER + RADIUS * value * Math.cos(angle),
    y: CENTER + RADIUS * value * Math.sin(angle),
  }
}

function points(
  metrics: TasteMetric[],
  key: "score" | "average",
  divisor: number,
) {
  return metrics
    .map((metric, index) => {
      const point = coord(
        index,
        Math.max(0, Math.min(1, metric[key] / divisor)),
      )
      return `${point.x},${point.y}`
    })
    .join(" ")
}

export function RadarChart({ metrics }: { metrics?: TasteMetric[] }) {
  const list = metrics && metrics.length === 5 ? metrics : DEFAULT_METRICS
  return (
    <View
      accessible
      accessibilityLabel={`내 취향 레이더 차트. ${list.map((item) => `${item.label} ${item.score.toFixed(1)}점`).join(", ")}`}
      style={styles.radarWrap}
    >
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {[0.33, 0.66, 1].map((level, idx) => (
          <Polygon
            key={level}
            points={[0, 1, 2, 3, 4]
              .map((index) => {
                const point = coord(index, level)
                return `${point.x},${point.y}`
              })
              .join(" ")}
            fill="none"
            stroke="#E2E2E2"
            strokeWidth={1}
            strokeDasharray={idx === 2 ? undefined : "3 3"}
          />
        ))}
        {[0, 1, 2, 3, 4].map((index) => {
          const point = coord(index, 1)
          return (
            <Line
              key={index}
              x1={CENTER}
              y1={CENTER}
              x2={point.x}
              y2={point.y}
              stroke="#E2E2E2"
              strokeWidth={1}
            />
          )
        })}
        {/* 전체 유저 평균 영역 (그레이 점선) */}
        <Polygon
          points={points(list, "average", 5)}
          fill="rgba(126,126,126,0.08)"
          stroke="#BEBEBE"
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
        {/* 내 취향 데이터 영역 (스칼렛 레드) */}
        <Polygon
          points={points(list, "score", 5)}
          fill="rgba(230,0,0,0.14)"
          stroke={palette.red}
          strokeWidth={2.5}
        />
        {list.map((metric, index) => {
          const point = coord(index, metric.score / 5)
          return (
            <Circle
              key={`dot-${metric.key}`}
              cx={point.x}
              cy={point.y}
              r={3.5}
              fill={palette.red}
              stroke="#FFFFFF"
              strokeWidth={1.5}
            />
          )
        })}
        {list.map((metric, index) => {
          const point = coord(index, 1.28)
          return (
            <SvgText
              key={metric.key}
              x={point.x}
              y={point.y}
              fill="#25282B"
              fontSize={10}
              fontWeight="800"
              textAnchor="middle"
            >
              {metric.label} {metric.score.toFixed(1)}
            </SvgText>
          )
        })}
      </Svg>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: palette.red }]} />
          <Text style={styles.legendTextBold}>내 취향 DNA</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.legendDashedLine} />
          <Text style={styles.legendText}>라오타 전체 평균</Text>
        </View>
      </View>
    </View>
  )
}

export function ReportBody({ report }: { report: TasteReport }) {
  const metrics = report.metrics?.length === 5 ? report.metrics : DEFAULT_METRICS
  return (
    <>
      {/* 1. 이전 리포트 아카이브 바로가기 배너 */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="이전 리포트 아카이브 열기"
        onPress={() => router.push("/taste/archive")}
        style={styles.archiveBanner}
      >
        <View style={styles.archiveBannerLeft}>
          <History color={palette.red} size={15} />
          <Text style={styles.archiveBannerText}>이전 리포트 아카이브 (총 3호 보관 중)</Text>
        </View>
        <View style={styles.archiveBannerRight}>
          <Text style={styles.archiveBannerAction}>보관함</Text>
          <ChevronRight color={palette.red} size={14} />
        </View>
      </Pressable>

      {/* 2. 올타임 종합 취향 히어로 카드 (Passport Hero Card) */}
      <View style={styles.passportHero}>
        <View style={styles.passportHeroTop}>
          <Text style={styles.volume}>
            {report.volume || "VOL. 04"} · {report.period || "2026년 09월 정기호"}
          </Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>{report.levelLabel || "Lv.4 라멘 마스터"}</Text>
          </View>
        </View>

        <Text style={styles.reportTitle}>{report.title || "진한 돈골파"}</Text>
        <Text style={styles.quote}>
          {report.quote ||
            "“농후한 돈골 육수와 묵직한 오일, 단단한 카타멘의 조화를 가장 사랑하는 진정한 라멘 매니아입니다.”"}
        </Text>

        {/* 태그 모음 */}
        <View style={styles.heroTagRow}>
          {["#이에케마스터", "#농후돈코츠", "#카타멘선호", `#${report.recordCount || 43}그릇학습`].map((t) => (
            <View key={t} style={styles.heroTag}>
              <Text style={styles.heroTagText}>{t}</Text>
            </View>
          ))}
        </View>

        <View style={styles.passportMeta}>
          <Text style={styles.recordCount}>{report.recordCount || 43}그릇 정밀 분석</Text>
          <Text style={styles.confidenceText}>AI 신뢰도 98.4%</Text>
        </View>
      </View>

      {/* 3. 5축 미각 프로필 레이더 차트 */}
      <View style={flowStyles.section}>
        <View style={styles.sectionHeading}>
          <Text style={flowStyles.sectionTitle}>5축 AI 취향 정밀 레이더</Text>
          <Text style={styles.strongest}>
            {report.strongestFeature || "타레 감칠맛 (4.9) · 국물 농도 (4.8)"}
          </Text>
        </View>
        <RadarChart metrics={metrics} />
        <View style={styles.metricList}>
          {metrics.map((metric) => (
            <View key={metric.key} style={styles.metricRow}>
              <Text style={styles.metricLabel}>{metric.label}</Text>
              <View style={styles.metricTrack}>
                <View
                  style={[
                    styles.metricFill,
                    { width: `${Math.min(100, (metric.score / 5) * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.metricValue}>{metric.score.toFixed(1)}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 4. 큐레이터 탐험 가이드 (AI Insights) */}
      <View style={styles.insightSection}>
        <View style={styles.insightTitleRow}>
          <Sparkles color={palette.red} fill={palette.red} size={17} />
          <Text style={styles.insightTitle}>큐레이터 탐험 가이드</Text>
        </View>
        {(report.insights && report.insights.length > 0
          ? report.insights
          : [
              "국물 농도보다 타레 본연의 감칠맛과 묵직한 바디감을 극대화한 메뉴에 매우 높은 만족도를 보였습니다.",
              "면은 부드러운 다가수면보다 씹는 질감이 단단한 카타멘(저가수면) 계열을 집중 소비했습니다.",
            ]
        ).map((insight, index) => (
          <Text key={index} style={styles.insightText}>
            {index + 1}. {insight}
          </Text>
        ))}
      </View>

      {/* 5. 최다 방문 단골 매장 TOP 3 */}
      <View style={flowStyles.section}>
        <View style={styles.sectionHeading}>
          <Text style={flowStyles.sectionTitle}>최다 방문 단골 매장 TOP 3</Text>
          <Text style={styles.subHeadingNote}>누적 완식 그릇 수 기준</Text>
        </View>
        <View style={styles.topShopList}>
          {TOP_VISITED_SHOPS.map((item) => (
            <Pressable
              key={item.rank}
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: "/shop/[shopId]",
                  params: { shopId: String(item.rank) },
                })
              }
              style={({ pressed }) => [
                styles.topShopCard,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Image source={{ uri: item.photo }} style={styles.topShopThumb} contentFit="cover" />
              <View style={styles.topShopBody}>
                <View style={styles.topShopHeaderRow}>
                  <View style={styles.topShopRankBadge}>
                    <Text style={styles.topShopRankText}>{item.rank}위</Text>
                  </View>
                  <Text style={styles.topShopName}>
                    {item.name} <Text style={styles.topShopBranch}>· {item.branch}</Text>
                  </Text>
                  <View style={styles.topShopSharePill}>
                    <Text style={styles.topShopShareText}>{item.visitCount}회 ({item.sharePct}%)</Text>
                  </View>
                </View>
                <Text style={styles.topShopMustTry}>추천: {item.mustTry}</Text>
                <Text numberOfLines={2} style={styles.topShopReason}>{item.reason}</Text>
              </View>
              <ChevronRight color={palette.muted} size={16} />
            </Pressable>
          ))}
        </View>
      </View>

      {/* 6. 계보별 완식 비율 */}
      <View style={flowStyles.section}>
        <View style={styles.sectionHeading}>
          <Text style={flowStyles.sectionTitle}>계보별 완식 비율</Text>
          <Text style={styles.subHeadingNote}>전체 소비 라멘 스타일 스펙트럼</Text>
        </View>
        <View style={styles.styleRows}>
          {STYLE_ROWS.map((item) => (
            <View key={item.name} style={styles.styleRow}>
              <View style={styles.styleHeader}>
                <Text style={styles.styleName}>{item.name}</Text>
                <Text style={styles.stylePercent}>
                  {item.pct}% · {item.count}그릇
                </Text>
              </View>
              <View style={styles.styleTrack}>
                <View
                  style={[styles.styleFill, { width: `${item.pct}%` }]}
                />
              </View>
              <Text style={styles.styleNote}>{item.note}</Text>
            </View>
          ))}
        </View>
      </View>
    </>
  )
}

export default function TasteScreen() {
  const { currentTasteReport, actions } = useRaota()
  const [generating, setGenerating] = useState(false)
  const [stage, setStage] = useState(0)
  const [progress, setProgress] = useState(15)
  const [message, setMessage] = useState<string | null>(null)

  const share = async () => {
    if (!currentTasteReport) return
    await Share.share({
      title: `RAOTA ${currentTasteReport.volume || "취향 리포트"}`,
      message: `나의 RAOTA 라멘 취향은 “${currentTasteReport.title || "진한 돈골파"}”입니다. ${currentTasteReport.recordCount || 43}그릇의 기록으로 AI가 분석했어요.`,
    })
  }

  const regenerate = async () => {
    setGenerating(true)
    setMessage(null)
    setStage(0)
    setProgress(15)

    const t1 = setTimeout(() => {
      setStage(1)
      setProgress(45)
    }, 1100)

    const t2 = setTimeout(() => {
      setStage(2)
      setProgress(75)
    }, 2300)

    const t3 = setTimeout(() => {
      setStage(3)
      setProgress(100)
    }, 3400)

    const t4 = setTimeout(async () => {
      setGenerating(false)
      await Promise.resolve(actions.refreshTasteReport())
      setMessage("최신 라멘로그 데이터가 반영된 AI 정밀 리포트가 발행되었습니다.")
    }, 4300)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
    }
  }

  if (generating) {
    const currentStep = GENERATION_STEPS[stage] || GENERATION_STEPS[0]
    return (
      <FlowPage dark>
        <FlowHeader title="취향 리포트 재발행" dark />
        <View style={styles.generatePage}>
          <View style={styles.generateCoreBox}>
            <RefreshCw color={palette.red} size={42} />
          </View>
          <Text accessibilityLiveRegion="polite" style={styles.generateTitle}>
            {currentStep.title}
          </Text>
          <Text style={styles.generateCopy}>
            {currentStep.desc}
          </Text>

          <View style={styles.generateTrack}>
            <View
              style={[
                styles.generateFill,
                { width: `${progress}%` },
              ]}
            />
          </View>

          <View style={styles.generateStepIndicator}>
            <Text style={styles.generateStepText}>
              단계 {stage + 1} / 4 ({progress}%)
            </Text>
          </View>
        </View>
      </FlowPage>
    )
  }

  return (
    <FlowPage>
      <FlowHeader
        title="라멘 취향 리포트"
        subtitle="AI 엔진 정밀 분석"
        right={
          <View style={styles.headerActionRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="리포트 공유"
              onPress={share}
              style={styles.headerButton}
            >
              <Share2 color={palette.ink} size={19} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="지난 리포트 보관함 보기"
              onPress={() => router.push("/taste/archive")}
              style={styles.headerButton}
            >
              <Archive color={palette.ink} size={19} />
            </Pressable>
          </View>
        }
      />
      {currentTasteReport ? (
        <FlowScroll contentContainerStyle={styles.content}>
          {!!message && (
            <InlineNotice
              text={message}
              tone={message.includes("못했") ? "error" : "success"}
            />
          )}
          <ReportBody report={currentTasteReport} />
          <View style={styles.actions}>
            <ActionButton
              label="친구에게 리포트 공유"
              shape="rounded"
              icon={<Share2 color={palette.canvas} size={18} />}
              onPress={share}
            />
            <ActionButton
              label="최신 기록으로 다시 분석"
              variant="secondary"
              shape="rounded"
              icon={<RefreshCw color={palette.ink} size={18} />}
              onPress={regenerate}
            />
          </View>
        </FlowScroll>
      ) : (
        <View style={styles.empty}>
          <Sparkles color={palette.red} size={38} />
          <Text style={styles.emptyTitle}>
            아직 발행된 취향 리포트가 없어요
          </Text>
          <Text style={flowStyles.secondary}>
            라멘로그를 남기면 국물·면·타레 취향을 분석해 첫 감정서를
            만들어드려요.
          </Text>
          <View style={{ width: "100%", marginTop: 10 }}>
            <ActionButton
              label="첫 기록 시작하기"
              onPress={() => router.push("/record/select-shop")}
            />
          </View>
        </View>
      )}
    </FlowPage>
  )
}

const styles = StyleSheet.create({
  headerActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  headerButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { paddingTop: 14, paddingBottom: 28, gap: 14 },
  
  // Archive banner
  archiveBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderColor: "#EAEAEA",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  archiveBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  archiveBannerText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#25282B",
  },
  archiveBannerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  archiveBannerAction: {
    fontSize: 11,
    fontWeight: "800",
    color: palette.red,
  },

  // Hero Card
  passportHero: {
    backgroundColor: "#25282B",
    borderRadius: 12,
    padding: 20,
  },
  passportHeroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  volume: {
    color: palette.red,
    fontSize: 11.5,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  levelBadge: {
    backgroundColor: palette.red,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  levelBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  reportTitle: {
    color: palette.canvas,
    fontSize: 27,
    lineHeight: 33,
    fontWeight: "900",
    letterSpacing: -0.6,
    marginTop: 8,
  },
  quote: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 10,
  },
  heroTagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 14,
  },
  heroTag: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  heroTagText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 10.5,
    fontWeight: "600",
  },
  passportMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 12,
    borderTopColor: "rgba(255,255,255,0.15)",
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  recordCount: { color: "rgba(255,255,255,0.75)", fontSize: 11.5, fontWeight: "700" },
  confidenceText: { color: palette.red, fontSize: 11, fontWeight: "800" },

  sectionHeading: { gap: 3 },
  subHeadingNote: { color: palette.muted, fontSize: 11 },
  strongest: { color: palette.red, fontSize: 11, fontWeight: "700" },
  
  radarWrap: { alignItems: "center", marginTop: 4 },
  legend: { flexDirection: "row", gap: 16, marginTop: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendDashedLine: { width: 16, height: 2, backgroundColor: "#BEBEBE" },
  legendTextBold: { color: "#25282B", fontSize: 10.5, fontWeight: "800" },
  legendText: { color: "#7E7E7E", fontSize: 10.5, fontWeight: "600" },

  metricList: { gap: 9, marginTop: 14 },
  metricRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  metricLabel: {
    width: 75,
    color: palette.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  metricTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.wash,
    overflow: "hidden",
  },
  metricFill: { height: 6, borderRadius: 3, backgroundColor: palette.red },
  metricValue: {
    width: 28,
    color: palette.ink,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
  },

  insightSection: {
    backgroundColor: palette.wash,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  insightTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  insightTitle: { color: palette.ink, fontSize: 16, fontWeight: "800" },
  insightText: { color: palette.ink, fontSize: 13, lineHeight: 19 },

  // Top visited shops
  topShopList: { gap: 10, marginTop: 10 },
  topShopCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderColor: "#EAEAEA",
    borderWidth: 1,
    padding: 10,
  },
  topShopThumb: {
    width: 60,
    height: 60,
    borderRadius: 6,
    backgroundColor: palette.wash,
  },
  topShopBody: { flex: 1, minWidth: 0 },
  topShopHeaderRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  topShopRankBadge: {
    backgroundColor: "rgba(230,0,0,0.1)",
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  topShopRankText: { color: palette.red, fontSize: 10, fontWeight: "900" },
  topShopName: { color: palette.ink, fontSize: 13.5, fontWeight: "800", flexShrink: 1 },
  topShopBranch: { color: palette.muted, fontSize: 11, fontWeight: "500" },
  topShopSharePill: {
    backgroundColor: palette.wash,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    marginLeft: "auto",
  },
  topShopShareText: { color: palette.muted, fontSize: 9.5, fontWeight: "700" },
  topShopMustTry: { color: palette.red, fontSize: 11, fontWeight: "700", marginTop: 2 },
  topShopReason: { color: palette.muted, fontSize: 11, lineHeight: 15, marginTop: 2 },

  // Style rows
  styleRows: { gap: 12, marginTop: 12 },
  styleRow: { gap: 4 },
  styleHeader: { flexDirection: "row", justifyContent: "space-between" },
  styleName: { color: palette.ink, fontSize: 12.5, fontWeight: "800" },
  stylePercent: { color: palette.red, fontSize: 11.5, fontWeight: "800" },
  styleTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: palette.wash,
    overflow: "hidden",
  },
  styleFill: { height: 7, borderRadius: 4, backgroundColor: palette.ink },
  styleNote: { color: palette.muted, fontSize: 10.5 },

  actions: { gap: 8, marginTop: 6 },
  generatePage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  generateCoreBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  generateTitle: {
    color: palette.canvas,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 22,
  },
  generateCopy: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 6,
  },
  generateTrack: {
    width: "100%",
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.13)",
    marginTop: 28,
    overflow: "hidden",
  },
  generateFill: { height: 4, backgroundColor: palette.red },
  generateStepIndicator: { marginTop: 10 },
  generateStepText: { color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: "700" },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 10,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
})
