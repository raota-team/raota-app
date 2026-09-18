import * as Location from "expo-location"
import { useEffect, useMemo, useState } from "react"
import { router } from "expo-router"
import { Image } from "expo-image"
import {
  ArrowRight,
  ChevronLeft,
  MessageSquare,
  RefreshCcw,
  Sparkles,
  Target,
  Utensils,
} from "lucide-react-native"
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native"

import { rankShopsForAIRecommendation } from "@/src/domain"
import { useRaota } from "@/src/state/RaotaStore"
import {
  ActionButton,
  FlowHeader,
  FlowPage,
  Text,
  palette,
} from "./_layout"

type Step = 1 | 2 | 3 | 4 | "loading" | "result"

const SOUP_OPTIONS = [
  "쇼유 (간장)",
  "돈코츠 (돼지뼈)",
  "시오 (소금)",
  "미소 (된장)",
  "츠케멘",
  "토리파이탄 (닭백탕)",
]
const MOOD_OPTIONS = [
  "혼밥하기 좋은 곳",
  "데이트/아늑한 분위기",
  "웨이팅 감수 맛집",
  "빠르고 든든한 한 끼",
]
const PRIORITY_OPTIONS = [
  "진하고 묵직한 국물",
  "탱글탱글 자가제면",
  "두툼하고 부드러운 차슈",
  "깔끔하고 깊은 감칠맛",
]
const QUICK_PROMPTS = [
  "국물이 덜 짠 곳",
  "차슈가 푸짐한 곳",
  "주차 가능한 곳",
  "웨이팅 적은 곳",
  "매운맛 조절 가능한 곳",
  "밥 무료 제공",
]

interface RecommendationResult {
  shopId: number
  shopName: string
  branch: string
  style: string
  matchScore: number
  photo: string
  reason: string
  tags: string[]
}

const MOCK_RESULTS: Record<string, RecommendationResult> = {
  default: {
    shopId: 1,
    shopName: "멘야준",
    branch: "망원 본점",
    style: "특제 쇼유 라멘",
    matchScore: 96,
    photo:
      "https://images.unsplash.com/photo-1742633882713-593c13e90231?w=800&h=600&fit=crop&auto=format&q=80",
    reason:
      "자가제면의 단단한 스트레이트 면발과 닭·오리 더블 육수의 깊은 감칠맛이 선택하신 깔끔하고 진한 육수 선호도 및 요청사항에 완벽히 부합합니다.",
    tags: ["자가제면", "맑은육수", "혼밥최적"],
  },
  donkotsu: {
    shopId: 2,
    shopName: "오레노라멘",
    branch: "마포 본점",
    style: "토리파이탄 (진한 닭백탕 라멘)",
    matchScore: 98,
    photo:
      "https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=800&h=600&fit=crop&auto=format&q=80",
    reason:
      "거품을낸 농후한 동물계 육수의 크리미함과 부드러운 수비드 차슈 구성이 선택하신 묵직한 취향에 최적의 조합입니다.",
    tags: ["미쉐린 빕구르망", "농후육수", "무료 면추가"],
  },
  miso: {
    shopId: 3,
    shopName: "후쿠 라멘",
    branch: "합정점",
    style: "특제 삿포로 미소 라멘",
    matchScore: 94,
    photo:
      "https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=800&h=600&fit=crop&auto=format&q=80",
    reason:
      "불향 가득 볶아낸 숙주와 진한 홋카이도 된장 타레가 어우러져 깊고 든든한 한 그릇을 완성합니다.",
    tags: ["진한국물", "자가제면", "불향가득"],
  },
}

export default function AIRecommendScreen() {
  const { shops, currentTasteReport, currentUser } = useRaota()
  const [step, setStep] = useState<Step>(1)
  const [selectedSoup, setSelectedSoup] = useState<string>("쇼유 (간장)")
  const [selectedMood, setSelectedMood] = useState<string>("혼밥하기 좋은 곳")
  const [selectedPriority, setSelectedPriority] = useState<string>("깔끔하고 깊은 감칠맛")
  const [customPrompt, setCustomPrompt] = useState<string>("")
  const [loadingStage, setLoadingStage] = useState<number>(1)
  const [recommendationOrigin, setRecommendationOrigin] = useState<{
    latitude: number
    longitude: number
  } | null>(null)

  useEffect(() => {
    if (Platform.OS === "web") return
    let mounted = true
    const loadAlreadyGrantedLocation = async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync()
        if (!mounted || permission.status !== "granted") return
        const cached = await Location.getLastKnownPositionAsync({
          maxAge: 5 * 60 * 1000,
          requiredAccuracy: 1_000,
        })
        const current =
          cached ??
          (await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }))
        if (!mounted) return
        setRecommendationOrigin({
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        })
      } catch {
        // Fallback gracefully
      }
    }
    void loadAlreadyGrantedLocation()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (step !== "loading") return
    const t1 = setTimeout(() => setLoadingStage(2), 1200)
    const t2 = setTimeout(() => setLoadingStage(3), 2500)
    const t3 = setTimeout(() => setStep("result"), 3800)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [step])

  const domainRank = useMemo(
    () =>
      rankShopsForAIRecommendation(shops, {
        soup: selectedSoup,
        mood: selectedMood,
        priority: selectedPriority,
        prompt: customPrompt,
        currentTasteReport,
        origin: recommendationOrigin,
      })[0],
    [
      currentTasteReport,
      customPrompt,
      recommendationOrigin,
      selectedMood,
      selectedPriority,
      selectedSoup,
      shops,
    ],
  )

  const result: RecommendationResult = useMemo(() => {
    if (selectedSoup.includes("돈코츠") || selectedSoup.includes("토리파이탄")) {
      return MOCK_RESULTS.donkotsu
    }
    if (selectedSoup.includes("미소")) {
      return MOCK_RESULTS.miso
    }
    if (domainRank?.shop) {
      const s = domainRank.shop
      return {
        shopId: s.id,
        shopName: s.name,
        branch: s.branch || "본점",
        style: s.tags[0] || "특제 시그니처 라멘",
        matchScore: domainRank.matchPercent || 96,
        photo: s.photos[0] || MOCK_RESULTS.default.photo,
        reason: `${s.name}의 육수 밸런스와 ${selectedPriority} 요소가 선택하신 조건에 최적입니다.`,
        tags: s.tags.slice(0, 3),
      }
    }
    return MOCK_RESULTS.default
  }, [selectedSoup, domainRank, selectedPriority])

  const reset = () => {
    setStep(1)
    setLoadingStage(1)
    setCustomPrompt("")
  }

  // 1. Loading screen (Full dark Curation Engine)
  if (step === "loading") {
    return (
      <View style={styles.loadingContainer}>
        {/* Header */}
        <View style={styles.loadingHeader}>
          <View style={styles.loadingBrandRow}>
            <View style={styles.loadingRedDot} />
            <Text style={styles.loadingBrandText}>RAOTA CURATION ENGINE</Text>
          </View>
          <Text style={styles.loadingStageBadge}>
            {loadingStage === 1 ? "STAGE 01" : loadingStage === 2 ? "STAGE 02" : "STAGE 03"}
          </Text>
        </View>

        {/* Center core */}
        <View style={styles.loadingCenter}>
          <View style={styles.loadingLogoWrap}>
            <View style={styles.loadingOuterRing} />
            <View style={styles.loadingLogoBox}>
              <Image
                source={require("@/assets/images/logo.png")}
                style={styles.loadingLogoImage}
                contentFit="contain"
              />
            </View>
          </View>

          <Text accessibilityLiveRegion="polite" style={styles.loadingStepTitle}>
            {loadingStage === 1 && "서울 120여 개 라멘집 DB 탐색"}
            {loadingStage === 2 && "육수 농도 · 면 굵기 매칭"}
            {loadingStage === 3 && "오늘의 1순위 라멘집 도출"}
          </Text>
          <Text style={styles.loadingStepDesc}>
            {loadingStage === 1 && "실시간 방문 데이터와 레시피를 대조합니다."}
            {loadingStage === 2 && "선택하신 취향 축의 최적 접점을 계산합니다."}
            {loadingStage === 3 && "미각 프로필과 일치하는 곳을 선정했습니다."}
          </Text>

          {/* Condition chips */}
          <View style={styles.loadingChipsRow}>
            <View style={styles.loadingChip}>
              <Utensils color={palette.red} size={11} />
              <Text style={styles.loadingChipText}>{selectedSoup.split(" ")[0]}</Text>
            </View>
            <View style={styles.loadingChip}>
              <Target color={palette.red} size={11} />
              <Text style={styles.loadingChipText}>{selectedPriority.split(" ")[0]}</Text>
            </View>
            {!!customPrompt && (
              <View style={[styles.loadingChip, styles.loadingChipActive]}>
                <MessageSquare color={palette.red} size={11} />
                <Text numberOfLines={1} style={styles.loadingChipTextHighlight}>
                  “{customPrompt}”
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Bottom progress */}
        <View style={styles.loadingBottom}>
          <View style={styles.loadingProgressHeader}>
            <Text style={styles.loadingProgressLabel}>큐레이션 매칭 분석</Text>
            <Text style={styles.loadingProgressPercent}>
              {loadingStage === 1 ? "38%" : loadingStage === 2 ? "78%" : "100%"}
            </Text>
          </View>

          <View style={styles.loadingTrack}>
            <View
              style={[
                styles.loadingFill,
                { width: `${loadingStage === 1 ? 38 : loadingStage === 2 ? 78 : 100}%` },
              ]}
            />
          </View>

          <View style={styles.loadingStepLabels}>
            <Text style={[styles.stepLabelText, loadingStage >= 1 && styles.stepLabelActive]}>
              01 DB 스캔
            </Text>
            <Text style={styles.stepLabelDot}>·</Text>
            <Text style={[styles.stepLabelText, loadingStage >= 2 && styles.stepLabelActive]}>
              02 미각 분석
            </Text>
            <Text style={styles.stepLabelDot}>·</Text>
            <Text style={[styles.stepLabelText, loadingStage >= 3 && styles.stepLabelActive]}>
              03 매칭 완료
            </Text>
          </View>
        </View>
      </View>
    )
  }

  // 2. Result Screen
  if (step === "result") {
    const userName = currentUser?.nickname || "회원"
    return (
      <FlowPage>
        <FlowHeader
          title="AI 라멘 큐레이터"
          subtitle="취향 기반 3초 핀포인트 매칭"
          right={
            <View style={styles.resultBadge}>
              <Text style={styles.resultBadgeText}>매칭 완료</Text>
            </View>
          }
        />
        <ScrollView contentContainerStyle={styles.resultScroll}>
          <View style={styles.resultHeading}>
            <View style={styles.resultPill}>
              <Sparkles color={palette.red} size={12} />
              <Text style={styles.resultPillText}>AI 취향 매칭 결과</Text>
            </View>
            <Text style={styles.resultHeroTitle}>
              오늘 {userName}님을 위한 1순위 라멘집
            </Text>
          </View>

          {/* Result Card */}
          <View style={styles.resultCard}>
            <View style={styles.resultImageWrap}>
              <Image source={{ uri: result.photo }} style={styles.resultImage} contentFit="cover" />
            </View>

            <View style={styles.resultCardBody}>
              <View style={styles.resultCardHeader}>
                <Text style={styles.resultShopName}>
                  {result.shopName} · {result.branch}
                </Text>
                <View style={styles.recommendFirstBadge}>
                  <Sparkles color={palette.red} size={11} />
                  <Text style={styles.recommendFirstText}>추천 1위</Text>
                </View>
              </View>
              <Text style={styles.resultShopStyle}>대표: {result.style}</Text>

              {/* Reason quote block */}
              <View style={styles.resultReasonBox}>
                <Text style={styles.resultReasonText}>
                  <Text style={styles.quoteRed}>“ </Text>
                  {result.reason}
                  <Text style={styles.quoteRed}> ”</Text>
                </Text>
              </View>

              <View style={styles.resultTagRow}>
                {result.tags.map((t, idx) => (
                  <View key={idx} style={styles.resultTag}>
                    <Text style={styles.resultTagText}>#{t}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Action buttons */}
          <View style={styles.resultActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: "/shop/[shopId]",
                  params: { shopId: String(result.shopId) },
                })
              }
              style={styles.primaryActionButton}
            >
              <Text style={styles.primaryActionText}>매장 상세 및 리뷰 보러가기 →</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={reset}
              style={styles.secondaryActionButton}
            >
              <Text style={styles.secondaryActionText}>다시 추천받기</Text>
              <RefreshCcw color="#25282B" size={13} />
            </Pressable>
          </View>
        </ScrollView>
      </FlowPage>
    )
  }

  // 3. Step 1 ~ 4 Question Flow
  return (
    <FlowPage>
      <FlowHeader
        title="AI 라멘 큐레이터"
        subtitle="취향 기반 3초 핀포인트 매칭"
        right={
          <View style={styles.stepCountBadge}>
            <Text style={styles.stepCountText}>Step {step}/4</Text>
          </View>
        }
      />
      <ScrollView contentContainerStyle={styles.stepScroll}>
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepHeaderTag}>STEP 01</Text>
            <Text style={styles.stepTitle}>오늘 어떤 국물 베이스가 가장 당기시나요?</Text>
            <Text style={styles.stepDescription}>
              맑고 깔끔한 청탕부터 묵직한 백탕까지 선택해보세요.
            </Text>

            <View style={styles.optionList}>
              {SOUP_OPTIONS.map((soup) => {
                const selected = selectedSoup === soup
                return (
                  <Pressable
                    key={soup}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setSelectedSoup(soup)}
                    style={[
                      styles.optionCard,
                      selected ? styles.optionCardSelected : styles.optionCardNormal,
                    ]}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                      {soup}
                    </Text>
                    <Text style={[styles.optionArrow, selected && styles.optionArrowSelected]}>
                      {selected ? "선택됨 ✓" : "→"}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepHeaderTag}>STEP 02</Text>
            <Text style={styles.stepTitle}>오늘의 식사 상황이나 원하는 분위기는 어떤가요?</Text>
            <Text style={styles.stepDescription}>
              방문 목적에 꼭 맞는 매장 환경을 고려해 매칭합니다.
            </Text>

            <View style={styles.optionList}>
              {MOOD_OPTIONS.map((mood) => {
                const selected = selectedMood === mood
                return (
                  <Pressable
                    key={mood}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setSelectedMood(mood)}
                    style={[
                      styles.optionCard,
                      selected ? styles.optionCardSelected : styles.optionCardNormal,
                    ]}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                      {mood}
                    </Text>
                    <Text style={[styles.optionArrow, selected && styles.optionArrowSelected]}>
                      {selected ? "선택됨 ✓" : "→"}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepHeaderTag}>STEP 03</Text>
            <Text style={styles.stepTitle}>라멘 한 그릇에서 가장 포기할 수 없는 것은?</Text>
            <Text style={styles.stepDescription}>
              회원님의 취향 벡터와 결합하여 최적의 매장을 선별합니다.
            </Text>

            <View style={styles.optionList}>
              {PRIORITY_OPTIONS.map((p) => {
                const selected = selectedPriority === p
                return (
                  <Pressable
                    key={p}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setSelectedPriority(p)}
                    style={[
                      styles.optionCard,
                      selected ? styles.optionCardSelected : styles.optionCardNormal,
                    ]}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                      {p}
                    </Text>
                    <Text style={[styles.optionArrow, selected && styles.optionArrowSelected]}>
                      {selected ? "선택됨 ✓" : "→"}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        )}

        {step === 4 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepHeaderTag}>STEP 04 (선택)</Text>
            <Text style={styles.stepTitle}>더 추천받고 싶은 점이 있나요?</Text>
            <Text style={styles.stepDescription}>
              특별히 원하는 맛, 토핑, 주차나 웨이팅 조건을 자유롭게 적어주세요.
            </Text>

            {/* 자유 입력창 */}
            <TextInput
              accessibilityLabel="자유 추천 요청"
              maxLength={120}
              multiline
              numberOfLines={4}
              onChangeText={setCustomPrompt}
              placeholder="예: 차슈가 부드럽고 국물이 덜 짠 곳으로 추천해주세요."
              placeholderTextColor="#8A8A8A"
              style={styles.promptTextArea}
              value={customPrompt}
            />

            {/* 추천 키워드 칩 */}
            <View style={styles.quickPromptSection}>
              <Text style={styles.quickPromptLabel}>추천 키워드</Text>
              <View style={styles.quickPromptWrap}>
                {QUICK_PROMPTS.map((p) => (
                  <Pressable
                    key={p}
                    accessibilityRole="button"
                    onPress={() => {
                      if (!customPrompt.includes(p)) {
                        setCustomPrompt((prev) => (prev ? `${prev}, ${p}` : p))
                      }
                    }}
                    style={styles.quickPromptChip}
                  >
                    <Text style={styles.quickPromptChipText}>+{p}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Step Navigation Bottom Bar */}
      <View style={styles.stepBottomBar}>
        {step > 1 && (
          <Pressable
            accessibilityRole="button"
            onPress={() => setStep((step - 1) as Step)}
            style={styles.prevButton}
          >
            <Text style={styles.prevButtonText}>이전 단계</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (step === 4) {
              setLoadingStage(1)
              setStep("loading")
            } else {
              setStep((step + 1) as Step)
            }
          }}
          style={styles.nextButton}
        >
          <Text style={styles.nextButtonText}>
            {step === 4 ? "AI 맞춤 추천받기 ✨" : "다음 단계 →"}
          </Text>
        </Pressable>
      </View>
    </FlowPage>
  )
}

const styles = StyleSheet.create({
  stepCountBadge: {
    backgroundColor: "rgba(230,0,0,0.1)",
    borderRadius: 32,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  stepCountText: {
    color: palette.red,
    fontSize: 11,
    fontWeight: "800",
  },
  stepScroll: {
    padding: 20,
    paddingBottom: 32,
  },
  stepContent: {
    gap: 6,
  },
  stepHeaderTag: {
    color: palette.red,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  stepTitle: {
    color: "#25282B",
    fontSize: 21,
    fontWeight: "900",
    lineHeight: 28,
    letterSpacing: -0.4,
  },
  stepDescription: {
    color: "#7E7E7E",
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 12,
  },
  optionList: {
    gap: 9,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
  },
  optionCardNormal: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E2E2",
  },
  optionCardSelected: {
    backgroundColor: "#25282B",
    borderColor: "#25282B",
  },
  optionText: {
    color: "#25282B",
    fontSize: 14,
    fontWeight: "700",
  },
  optionTextSelected: {
    color: "#FFFFFF",
  },
  optionArrow: {
    color: "#7E7E7E",
    fontSize: 12.5,
    fontWeight: "700",
  },
  optionArrowSelected: {
    color: palette.red,
    fontWeight: "800",
  },

  promptTextArea: {
    backgroundColor: "#F2F2F2",
    borderColor: "#E2E2E2",
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    fontSize: 13,
    color: "#25282B",
    minHeight: 88,
    textAlignVertical: "top",
    marginTop: 6,
  },
  quickPromptSection: {
    marginTop: 14,
  },
  quickPromptLabel: {
    color: "#7E7E7E",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 8,
  },
  quickPromptWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  quickPromptChip: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E2E2",
    borderWidth: 1,
    borderRadius: 32,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  quickPromptChipText: {
    color: "#25282B",
    fontSize: 11,
    fontWeight: "700",
  },

  stepBottomBar: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopColor: "#EAEAEA",
    borderTopWidth: 1,
    backgroundColor: "#FFFFFF",
  },
  prevButton: {
    flex: 1,
    height: 48,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: "#E2E2E2",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  prevButtonText: {
    color: "#25282B",
    fontSize: 13,
    fontWeight: "700",
  },
  nextButton: {
    flex: 1,
    height: 48,
    borderRadius: 60,
    backgroundColor: palette.red,
    alignItems: "center",
    justifyContent: "center",
  },
  nextButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  // Loading Screen Styles
  loadingContainer: {
    flex: 1,
    backgroundColor: "#141518",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  loadingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  loadingBrandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  loadingRedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.red,
  },
  loadingBrandText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  loadingStageBadge: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontWeight: "800",
  },
  loadingCenter: {
    alignItems: "center",
    marginVertical: "auto",
  },
  loadingLogoWrap: {
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  loadingOuterRing: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1.5,
    borderColor: "rgba(230,0,0,0.65)",
  },
  loadingLogoBox: {
    width: 68,
    height: 68,
    borderRadius: 18,
    backgroundColor: "#1E2024",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingLogoImage: {
    width: 38,
    height: 38,
  },
  loadingStepTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 6,
  },
  loadingStepDesc: {
    color: "#A8A29E",
    fontSize: 12.5,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  loadingChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    maxWidth: 290,
  },
  loadingChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  loadingChipActive: {
    borderColor: "rgba(230,0,0,0.4)",
  },
  loadingChipText: {
    color: "#D6D3D1",
    fontSize: 11,
    fontWeight: "700",
  },
  loadingChipTextHighlight: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  loadingBottom: {
    gap: 8,
    marginBottom: 10,
  },
  loadingProgressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  loadingProgressLabel: {
    color: "#A8A29E",
    fontSize: 11,
  },
  loadingProgressPercent: {
    color: palette.red,
    fontSize: 11,
    fontWeight: "900",
  },
  loadingTrack: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 2,
    overflow: "hidden",
  },
  loadingFill: {
    height: 3,
    backgroundColor: palette.red,
    borderRadius: 2,
  },
  loadingStepLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  stepLabelText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 10,
    fontWeight: "700",
  },
  stepLabelActive: {
    color: "#FFFFFF",
  },
  stepLabelDot: {
    color: "rgba(255,255,255,0.15)",
    fontSize: 10,
  },

  // Result Screen Styles
  resultBadge: {
    backgroundColor: "rgba(230,0,0,0.1)",
    borderRadius: 32,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  resultBadgeText: {
    color: palette.red,
    fontSize: 10.5,
    fontWeight: "800",
  },
  resultScroll: {
    padding: 16,
    paddingBottom: 32,
    gap: 14,
  },
  resultHeading: {
    alignItems: "center",
    paddingVertical: 4,
  },
  resultPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(230,0,0,0.1)",
    borderRadius: 32,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 6,
  },
  resultPillText: {
    color: palette.red,
    fontSize: 10.5,
    fontWeight: "900",
  },
  resultHeroTitle: {
    color: "#25282B",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  resultCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E2E2",
    borderWidth: 1,
    borderRadius: 6,
    overflow: "hidden",
  },
  resultImageWrap: {
    aspectRatio: 16 / 9,
    backgroundColor: "#F2F2F2",
    width: "100%",
  },
  resultImage: {
    width: "100%",
    height: "100%",
  },
  resultCardBody: {
    padding: 14,
  },
  resultCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 3,
  },
  resultShopName: {
    color: "#25282B",
    fontSize: 17.5,
    fontWeight: "900",
    flex: 1,
  },
  recommendFirstBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  recommendFirstText: {
    color: palette.red,
    fontSize: 11,
    fontWeight: "800",
  },
  resultShopStyle: {
    color: "#7E7E7E",
    fontSize: 11,
    marginBottom: 10,
  },
  resultReasonBox: {
    backgroundColor: "#F2F2F2",
    borderRadius: 6,
    padding: 12,
    marginBottom: 10,
  },
  resultReasonText: {
    color: "#25282B",
    fontSize: 11.5,
    lineHeight: 18,
  },
  quoteRed: {
    color: palette.red,
    fontWeight: "900",
  },
  resultTagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  resultTag: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E2E2",
    borderWidth: 1,
    borderRadius: 32,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  resultTagText: {
    color: "#4A4D52",
    fontSize: 10,
    fontWeight: "700",
  },
  resultActions: {
    gap: 8,
    marginTop: 4,
  },
  primaryActionButton: {
    height: 46,
    borderRadius: 60,
    backgroundColor: palette.red,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "800",
  },
  secondaryActionButton: {
    height: 42,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: "#E2E2E2",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  secondaryActionText: {
    color: "#25282B",
    fontSize: 12,
    fontWeight: "700",
  },
})
