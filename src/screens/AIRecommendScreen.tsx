import { useState, useEffect, useRef } from 'react'
import { Target, MessageSquare, RotateCcw, Soup, ChevronLeft } from 'lucide-react'

export function AISparkleIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      {/* 메인 4각 별 */}
      <path d="M11 2C11 6.97 6.97 11 2 11C6.97 11 11 15.03 11 20C11 15.03 15.03 11 20 11C15.03 11 11 6.97 11 2Z" />
      {/* 우상단 보조 4각 별 */}
      <path d="M19 2C19 4.21 17.21 6 15 6C17.21 6 19 7.79 19 10C19 7.79 20.79 6 23 6C20.79 6 19 4.21 19 2Z" opacity="0.9" />
    </svg>
  )
}

interface Props {
  onBack: () => void
  onShopClick: () => void
  onRecordShop: (shopName: string) => void
}


const SOUP_OPTIONS = ['쇼유 (간장)', '돈코츠 (돼지뼈)', '시오 (소금)', '미소 (된장)', '츠케멘', '토리파이탄 (닭백탕)']
const MOOD_OPTIONS = ['혼밥하기 좋은 곳', '데이트/아늑한 분위기', '웨이팅 감수 맛집', '빠르고 든든한 한 끼']
const PRIORITY_OPTIONS = ['진하고 묵직한 국물', '탱글탱글 자가제면', '두툼하고 부드러운 차슈', '깔끔하고 깊은 감칠맛']
const QUICK_PROMPTS = ['국물이 덜 짠 곳', '차슈가 푸짐한 곳', '주차 가능한 곳', '웨이팅 적은 곳', '매운맛 조절 가능한 곳', '밥 무료 제공']

interface RecommendationResult {
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
    shopName: '멘야준',
    branch: '망원 본점',
    style: '특제 쇼유 라멘',
    matchScore: 96,
    photo: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=800&h=600&fit=crop&auto=format&q=80',
    reason: '자가제면의 단단한 스트레이트 면발과 닭·오리 더블 육수의 깊은 감칠맛이 선택하신 깔끔하고 진한 육수 선호도 및 요청사항에 완벽히 부합합니다.',
    tags: ['자가제면', '맑은육수', '혼밥최적'],
  },
  donkotsu: {
    shopName: '오레노라멘',
    branch: '마포 본점',
    style: '토리파이탄 (진한 닭백탕 라멘)',
    matchScore: 98,
    photo: 'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=800&h=600&fit=crop&auto=format&q=80',
    reason: '거품을낸 농후한 동물계 육수의 크리미함과 부드러운 수비드 차슈 구성이 선택하신 묵직한 취향에 최적의 조합입니다.',
    tags: ['미쉐린 빕구르망', '농후육수', '무료 면추가'],
  },
  miso: {
    shopName: '후쿠 라멘',
    branch: '합정점',
    style: '특제 삿포로 미소 라멘',
    matchScore: 94,
    photo: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=800&h=600&fit=crop&auto=format&q=80',
    reason: '불향 가득 볶아낸 숙주와 진한 홋카이도 된장 타레가 어우러져 깊고 든든한 한 그릇을 완성합니다.',
    tags: ['진한국물', '자가제면', '불향가득'],
  },
}

export default function AIRecommendScreen({ onBack, onShopClick }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 'loading' | 'result'>(1)
  const [selectedSoup, setSelectedSoup] = useState<string>('쇼유 (간장)')
  const [selectedMood, setSelectedMood] = useState<string>('혼밥하기 좋은 곳')
  const [selectedPriority, setSelectedPriority] = useState<string>('깔끔하고 깊은 감칠맛')
  const [customPrompt, setCustomPrompt] = useState<string>('')
  const [loadingStage, setLoadingStage] = useState<number>(1)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const handleStartAnalysis = () => {
    setStep('loading')
    setLoadingStage(1)
  }

  // 스텝 변경 시 최상단으로 스크롤 리셋
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0
    }
  }, [step])

  useEffect(() => {
    if (step === 'loading') {
      const t1 = setTimeout(() => setLoadingStage(2), 1200)
      const t2 = setTimeout(() => setLoadingStage(3), 2600)
      const t3 = setTimeout(() => setStep('result'), 3800)

      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
        clearTimeout(t3)
      }
    }
  }, [step])


  const getResult = (): RecommendationResult => {
    if (selectedSoup.includes('돈코츠') || selectedSoup.includes('토리파이탄')) {
      return MOCK_RESULTS.donkotsu
    }
    if (selectedSoup.includes('미소')) {
      return MOCK_RESULTS.miso
    }
    return MOCK_RESULTS.default
  }

  const result = getResult()

  // 1) 전용 독립 로딩 화면 (RAOTA AI Curation Engine - Impeccable Distilled)
  if (step === 'loading') {
    return (
      <div className="h-full flex flex-col justify-between bg-[#141518] text-white px-6 py-8 relative overflow-hidden select-none">
        {/* 미니멀 앰비언트 배경: 군더더기 없는 은은한 센터 래디얼 */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-[320px] h-[320px] rounded-full bg-radial from-[#E60000]/10 via-transparent to-transparent blur-2xl" />
        </div>

        {/* 상단: 디스틸드 엔진 헤더 */}
        <div className="relative z-10 flex items-center justify-between text-[11px] font-mono text-white/40 tracking-wider uppercase">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E60000]" />
            RAOTA CURATION ENGINE
          </span>
          <span className="text-white/60 font-bold">
            {loadingStage === 1 ? 'STAGE 01' : loadingStage === 2 ? 'STAGE 02' : 'STAGE 03'}
          </span>
        </div>

        {/* 중앙: 정적인 프리미엄 브랜드 코어 & 정밀 텍스트 (안 빤짝거리는 안정된 로고) */}
        <div className="relative z-10 flex flex-col items-center text-center my-auto">
          {/* 중앙 로고 컨테이너 - 빤짝임/펄스 없이 단정하고 깊이 있는 매트 디자인 */}
          <div className="relative w-24 h-24 flex items-center justify-center mb-7">
            {/* 은은한 외곽 정적 링 & 얇은 회전 가이드라인 */}
            <div className="absolute inset-0 rounded-full border border-white/10" />
            <div
              className="absolute inset-[-3px] rounded-full border-t border-r border-[#E60000]/70 animate-spin"
              style={{ animationDuration: '3s', animationTimingFunction: 'linear' }}
            />

            {/* 정적(Static) 라오타 브랜드 심볼 코어 (빤짝임 제거) */}
            <div className="w-18 h-18 rounded-[20px] bg-[#1E2024] border border-white/15 flex items-center justify-center shadow-xl">
              <img
                src="/logo.png"
                alt="RAOTA"
                className="w-10 h-10 object-contain"
              />
            </div>
          </div>

          {/* 디스틸드 단계별 타이틀 & 설명 */}
          <div className="space-y-1.5 min-h-[64px] flex flex-col items-center justify-center max-w-[280px]">
            <h2 className="text-[19px] font-black tracking-tight leading-snug text-white">
              {loadingStage === 1 && '서울 120여 개 라멘집 DB 탐색'}
              {loadingStage === 2 && '육수 농도 · 면 굵기 매칭'}
              {loadingStage === 3 && '오늘의 1순위 라멘집 도출'}
            </h2>
            <p className="text-[12px] text-stone-400 font-medium leading-relaxed">
              {loadingStage === 1 && '실시간 방문 데이터와 레시피를 대조합니다.'}
              {loadingStage === 2 && '선택하신 취향 축의 최적 접점을 계산합니다.'}
              {loadingStage === 3 && '미각 프로필과 일치하는 곳을 선정했습니다.'}
            </p>
          </div>

          {/* 선택 조건 칩 (불필요한 장식 배제, 절제된 디스틸드 뱃지) */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-6 max-w-[300px]">
            <span className="px-2.5 py-1 rounded-[6px] bg-white/5 border border-white/10 text-[11px] font-bold text-stone-300 flex items-center gap-1.5">
              <Soup className="w-3 h-3 text-[#E60000] shrink-0" />
              <span>{selectedSoup.split(' ')[0]}</span>
            </span>

            <span className="px-2.5 py-1 rounded-[6px] bg-white/5 border border-white/10 text-[11px] font-bold text-stone-300 flex items-center gap-1.5">
              <Target className="w-3 h-3 text-[#E60000] shrink-0" />
              <span>{selectedPriority.split(' ')[0]}</span>
            </span>

            {customPrompt && (
              <span className="px-2.5 py-1 rounded-[6px] bg-white/5 border border-[#E60000]/40 text-[11px] font-bold text-white truncate max-w-[240px] flex items-center gap-1.5">
                <MessageSquare className="w-3 h-3 text-[#E60000] shrink-0" />
                <span className="truncate">“{customPrompt}”</span>
              </span>
            )}
          </div>
        </div>

        {/* 하단: 정밀 프로그레스 & 미니멀 스테퍼 */}
        <div className="relative z-10 pb-4 space-y-3">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-stone-400 tracking-tight">큐레이션 매칭 분석</span>
            <span className="text-[#E60000] font-black">
              {loadingStage === 1 ? '38%' : loadingStage === 2 ? '78%' : '100%'}
            </span>
          </div>

          {/* 정밀 헤어라인 프로그레스 바 */}
          <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#E60000] rounded-full transition-all duration-700 ease-out"
              style={{ width: loadingStage === 1 ? '38%' : loadingStage === 2 ? '78%' : '100%' }}
            />
          </div>

          {/* 3단계 스텝 레이블 */}
          <div className="flex items-center justify-between text-[10px] font-mono pt-0.5">
            <span className={loadingStage >= 1 ? 'text-white font-bold' : 'text-white/30'}>
              01 DB 스캔
            </span>
            <span className="text-white/15">·</span>
            <span className={loadingStage >= 2 ? 'text-white font-bold' : 'text-white/30'}>
              02 미각 분석
            </span>
            <span className="text-white/15">·</span>
            <span className={loadingStage >= 3 ? 'text-white font-bold' : 'text-white/30'}>
              03 매칭 완료
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`h-full bg-[#FFFFFF] text-[#25282B] ${step === 'result' ? 'overflow-y-auto no-scrollbar' : 'flex flex-col overflow-hidden'}`}>
      
      {/* 상단 마스터 바 */}
      <header className="flex-shrink-0 bg-white px-5 pt-3.5 pb-3.5 border-b border-[#E2E2E2] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-full bg-[#F2F2F2] flex items-center justify-center text-[#25282B] active:scale-95 transition-all"
            aria-label="뒤로가기"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>

            <h1 className="text-[18px] font-black tracking-tight text-[#25282B]">
              AI 라멘 큐레이터
            </h1>
            <p className="text-[10px] text-[#7E7E7E]">취향 기반 3초 핀포인트 매칭</p>
          </div>
        </div>

        <span className="text-[10px] font-bold text-[#E60000] bg-[#E60000]/10 px-2.5 py-0.5 rounded-[32px]">
          {typeof step === 'number' ? `Step ${step}/4` : '매칭 완료'}
        </span>
      </header>

      {/* 본문 인터랙션 영역 */}
      <div
        ref={scrollContainerRef}
        className={`flex-1 flex flex-col justify-between ${
          step === 'result' ? 'p-4 space-y-3' : 'p-5 overflow-hidden'
        }`}
      >
        
        {/* Step 1: 국물 베이스 선택 */}

        {step === 1 && (
          <div className="space-y-4 anim-fade-in my-auto">
            <div>
              <span className="text-[11px] font-bold text-[#E60000] tracking-wider block mb-1">
                STEP 01
              </span>
              <h2 className="text-[21px] font-black tracking-tight leading-snug text-[#25282B] break-keep">
                오늘 어떤 국물 베이스가 가장 당기시나요?
              </h2>
              <p className="text-[12px] text-[#7E7E7E] mt-1 break-keep">
                맑고 깔끔한 청탕부터 묵직한 백탕까지 선택해보세요.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              {SOUP_OPTIONS.map(soup => (
                <button
                  key={soup}
                  onClick={() => setSelectedSoup(soup)}
                  className={`w-full p-4 rounded-[6px] border text-left flex items-center justify-between transition-all ${
                    selectedSoup === soup
                      ? 'border-[#25282B] bg-[#25282B] text-white shadow-xs'
                      : 'border-[#E2E2E2] bg-white text-[#25282B] hover:border-[#BEBEBE] hover:bg-[#F9F9F9]'
                  }`}
                >
                  <span className="text-[14px] font-bold">{soup}</span>
                  <span className={`text-[12px] ${selectedSoup === soup ? 'text-[#E60000]' : 'text-[#7E7E7E]'}`}>
                    {selectedSoup === soup ? '선택됨 ✓' : '→'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: 식사 상황/분위기 */}
        {step === 2 && (
          <div className="space-y-4 anim-fade-in my-auto">
            <div>
              <span className="text-[11px] font-bold text-[#E60000] tracking-wider block mb-1">
                STEP 02
              </span>
              <h2 className="text-[21px] font-black tracking-tight leading-snug text-[#25282B] break-keep">
                오늘의 식사 상황이나 원하는 분위기는 어떤가요?
              </h2>
              <p className="text-[12px] text-[#7E7E7E] mt-1 break-keep">
                방문 목적에 꼭 맞는 매장 환경을 고려해 매칭합니다.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              {MOOD_OPTIONS.map(mood => (
                <button
                  key={mood}
                  onClick={() => setSelectedMood(mood)}
                  className={`w-full p-4 rounded-[6px] border text-left flex items-center justify-between transition-all ${
                    selectedMood === mood
                      ? 'border-[#25282B] bg-[#25282B] text-white shadow-xs'
                      : 'border-[#E2E2E2] bg-white text-[#25282B] hover:border-[#BEBEBE] hover:bg-[#F9F9F9]'
                  }`}
                >
                  <span className="text-[14px] font-bold">{mood}</span>
                  <span className={`text-[12px] ${selectedMood === mood ? 'text-[#E60000]' : 'text-[#7E7E7E]'}`}>
                    {selectedMood === mood ? '선택됨 ✓' : '→'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: 최우선 요소 */}
        {step === 3 && (
          <div className="space-y-4 anim-fade-in my-auto">
            <div>
              <span className="text-[11px] font-bold text-[#E60000] tracking-wider block mb-1">
                STEP 03
              </span>
              <h2 className="text-[21px] font-black tracking-tight leading-snug text-[#25282B] break-keep">
                라멘 한 그릇에서 가장 포기할 수 없는 것은?
              </h2>
              <p className="text-[12px] text-[#7E7E7E] mt-1 break-keep">
                회원님의 취향 벡터와 결합하여 최적의 매장을 선별합니다.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              {PRIORITY_OPTIONS.map(p => (
                <button
                  key={p}
                  onClick={() => setSelectedPriority(p)}
                  className={`w-full p-4 rounded-[6px] border text-left flex items-center justify-between transition-all ${
                    selectedPriority === p
                      ? 'border-[#25282B] bg-[#25282B] text-white shadow-xs'
                      : 'border-[#E2E2E2] bg-white text-[#25282B] hover:border-[#BEBEBE] hover:bg-[#F9F9F9]'
                  }`}
                >
                  <span className="text-[14px] font-bold">{p}</span>
                  <span className={`text-[12px] ${selectedPriority === p ? 'text-[#E60000]' : 'text-[#7E7E7E]'}`}>
                    {selectedPriority === p ? '선택됨 ✓' : '→'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: 더 추천받고 싶은 점 자유 입력 */}
        {step === 4 && (
          <div className="space-y-4 anim-fade-in my-auto">
            <div>
              <span className="text-[11px] font-bold text-[#E60000] tracking-wider block mb-1">
                STEP 04 (선택)
              </span>
              <h2 className="text-[21px] font-black tracking-tight leading-snug text-[#25282B] break-keep">
                더 추천받고 싶은 점이 있나요?
              </h2>
              <p className="text-[12px] text-[#7E7E7E] mt-1 break-keep">
                특별히 원하는 맛, 토핑, 주차나 웨이팅 조건을 자유롭게 적어주세요.
              </p>
            </div>

            {/* 자유 텍스트 입력창 */}
            <div className="pt-2">
              <textarea
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                placeholder="예: 차슈가 부드럽고 국물이 덜 짠 곳으로 추천해주세요."
                className="w-full h-24 p-3.5 bg-[#F2F2F2] border border-[#E2E2E2] rounded-[6px] text-[13px] text-[#25282B] placeholder-[#8A8A8A] outline-none focus:border-[#25282B] resize-none"
              />
            </div>

            {/* 빠른 추천 키워드 칩 */}
            <div>
              <span className="text-[11px] font-bold text-[#7E7E7E] block mb-2">추천 키워드</span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map(p => (
                  <button
                    key={p}
                    onClick={() => {
                      if (!customPrompt.includes(p)) {
                        setCustomPrompt(prev => (prev ? `${prev}, ${p}` : p))
                      }
                    }}
                    className="h-7 px-3 bg-white border border-[#E2E2E2] hover:border-[#BEBEBE] hover:bg-[#F9F9F9] rounded-[32px] text-[11px] font-bold text-[#25282B] transition-colors"
                  >
                    +{p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step: 매칭 결과 화면 */}
        {step === 'result' && (
          <div className="space-y-3 anim-fade-in">
            <div className="text-center py-1">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#E60000] bg-[#E60000]/10 px-3 py-0.5 rounded-[32px]">
                <AISparkleIcon className="w-3 h-3 text-[#E60000]" />
                <span>AI 취향 매칭 결과</span>
              </span>
              <h2 className="text-[18px] font-black text-[#25282B] tracking-tight mt-1.5 break-keep">
                오늘 뿡님을 위한 1순위 라멘집
              </h2>
            </div>

            {/* 추천 카드 */}
            <article className="bg-white rounded-[6px] border border-[#E2E2E2] overflow-hidden">
              <div className="relative aspect-[16/9] bg-[#F2F2F2] overflow-hidden">
                <img src={result.photo} alt={result.shopName} className="w-full h-full object-cover" />
              </div>

              <div className="p-3.5">
                <div className="flex items-baseline justify-between mb-1">
                  <h3 className="text-[18px] font-black text-[#25282B]">
                    {result.shopName} · {result.branch}
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#E60000]">
                    <AISparkleIcon className="w-3 h-3 text-[#E60000]" />
                    <span>추천 1위</span>
                  </span>
                </div>
                <p className="text-[11px] text-[#7E7E7E] mb-2.5">대표: {result.style}</p>

                {/* AI 추천 근거 요약 블록 */}
                <div className="p-3 bg-[#F2F2F2] rounded-[6px] text-[11.5px] text-[#25282B] leading-relaxed mb-2.5 break-keep">
                  <span className="text-[#E60000] font-black mr-1">“</span>
                  {result.reason}
                  <span className="text-[#E60000] font-black ml-1">”</span>
                </div>

                <div className="flex gap-1.5 flex-wrap">
                  {result.tags.map((t, idx) => (
                    <span key={idx} className="bg-white border border-[#E2E2E2] text-[10px] font-bold px-2 py-0.5 rounded-[32px] text-[#4A4D52]">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            </article>

            {/* 액션 버튼 */}
            <div className="space-y-1.5 pt-1">
              <button
                onClick={onShopClick}
                className="w-full h-11 rounded-[60px] bg-[#E60000] text-white font-bold text-[12px] active:scale-98 hover:bg-[#CC0000] transition-all flex items-center justify-center gap-2 shadow-xs"
              >
                매장 상세 및 리뷰 보러가기 →
              </button>
              <button
                onClick={() => setStep(1)}
                className="w-full h-10 rounded-[60px] border border-[#E2E2E2] hover:border-[#BEBEBE] text-[11.5px] font-bold text-[#25282B] bg-white hover:bg-[#F9F9F9] transition-all flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <span>다시 추천받기</span>
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 네비게이션 버튼 (Step 1~4일 때) */}
        {typeof step === 'number' && (
          <footer className="pt-2 pb-2 flex gap-2.5 shrink-0">
            {step > 1 && (
              <button
                onClick={() => setStep((step - 1) as any)}
                className="flex-1 h-12 rounded-[60px] border border-[#E2E2E2] hover:border-[#BEBEBE] text-[13px] font-bold text-[#25282B] bg-white hover:bg-[#F9F9F9] transition-all shadow-2xs"
              >
                이전 단계
              </button>
            )}
            <button
              onClick={() => {
                if (step === 4) {
                  handleStartAnalysis()
                } else {
                  setStep((step + 1) as any)
                }
              }}
              className="flex-1 h-12 rounded-[60px] bg-[#E60000] text-white font-bold text-[13px] active:scale-98 hover:bg-[#CC0000] transition-all flex items-center justify-center gap-1.5 shadow-xs"
            >
              {step === 4 ? (
                <>
                  <span>AI 맞춤 추천받기</span>
                  <AISparkleIcon className="w-4 h-4 text-white" />
                </>
              ) : (
                <span>다음 단계 →</span>
              )}
            </button>
          </footer>
        )}



      </div>
    </div>
  )
}
