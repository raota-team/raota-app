import { useState, useEffect } from 'react'

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
    reason: '자가제면의 단단한 스트레이트 면발과 닭·오리 더블 육수의 깊은 감칠맛이 선택하신 깔끔하고 진한 육수 선호도 및 요청사항과 96% 일치합니다.',
    tags: ['자가제면', '맑은육수', '혼밥최적'],
  },
  donkotsu: {
    shopName: '오레노라멘',
    branch: '마포 본점',
    style: '토리파이탄 (진한 닭백탕 라멘)',
    matchScore: 98,
    photo: 'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=800&h=600&fit=crop&auto=format&q=80',
    reason: '거품을 낸 농후한 동물계 육수의 크리미함과 부드러운 수비드 차슈 구성이 선택하신 묵직한 취향과 98% 일치합니다.',
    tags: ['미쉐린 빕구르망', '농후육수', '무료 면추가'],
  },
  miso: {
    shopName: '후쿠 라멘',
    branch: '합정점',
    style: '특제 삿포로 미소 라멘',
    matchScore: 94,
    photo: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=800&h=600&fit=crop&auto=format&q=80',
    reason: '센 불에 볶아낸 아삭한 숙주와 깊은 된장 베이스가 꼬불꼬불한 치지레멘과 어우러져 든든한 식사로 최고입니다.',
    tags: ['불향가득', '삿포로정통', '차슈푸짐'],
  },
}

export default function AIRecommendScreen({ onBack, onShopClick }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 'loading' | 'result'>(1)
  const [selectedSoup, setSelectedSoup] = useState<string>('쇼유 (간장)')
  const [selectedMood, setSelectedMood] = useState<string>('혼밥하기 좋은 곳')
  const [selectedPriority, setSelectedPriority] = useState<string>('깔끔하고 깊은 감칠맛')
  const [customPrompt, setCustomPrompt] = useState<string>('')
  const [loadingStage, setLoadingStage] = useState<number>(1)

  const handleStartAnalysis = () => {
    setStep('loading')
    setLoadingStage(1)
  }

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

  // 1) 전용 독립 로딩 화면 (RAOTA Sensory Radar Engine)
  if (step === 'loading') {
    return (
      <div className="h-full flex flex-col justify-between bg-[#1A1C1E] text-white p-6 relative overflow-hidden select-none">
        {/* 배경 레이더 및 동심원 격자 애니메이션 */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[360px] h-[360px] rounded-full border border-white/5 absolute" />
          <div className="w-[260px] h-[260px] rounded-full border border-white/10 absolute anim-tracer-pulse" />
          <div className="w-[180px] h-[180px] rounded-full border border-[#E60000]/20 absolute" />
          <div className="w-[320px] h-[320px] rounded-full border-t border-r border-[#E60000]/30 absolute anim-radar-sweep" />
          <div className="w-96 h-96 bg-[#E60000]/10 rounded-full blur-3xl absolute pointer-events-none" />
        </div>

        {/* 상단 엔진 뱃지 */}
        <div className="relative z-10 pt-10 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[32px] bg-white/10 border border-white/15 backdrop-blur-md text-[10px] font-bold text-white/90 tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E60000] animate-ping" />
            <span>RAOTA SENSORY VECTOR ENGINE</span>
          </div>
        </div>

        {/* 중앙 인터랙티브 센서 코어 */}
        <div className="relative z-10 flex flex-col items-center text-center px-4 -mt-4">
          {/* 발광 코어 아이콘 */}
          <div className="relative w-24 h-24 flex items-center justify-center mb-6">
            {/* 외곽 회전 트레이서 */}
            <div className="absolute inset-0 rounded-full border-2 border-dashed border-[#E60000]/40 animate-spin" style={{ animationDuration: '8s' }} />
            <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-[#E60000] border-r-[#E60000] animate-spin" style={{ animationDuration: '2s' }} />
            
            {/* 중앙 발광 박스 */}
            <div className="w-16 h-16 rounded-[14px] bg-[#E60000] text-white flex items-center justify-center shadow-[0_0_24px_rgba(230,0,0,0.6)] anim-glow-float">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4772 12 22C12 16.4772 16.4772 12 22 12C16.4772 12 12 7.52285 12 2Z" />
                <path d="M19 3C19 5.20914 17.2091 7 15 7C17.2091 7 19 8.79086 19 11C19 8.79086 20.7909 7 23 7C20.7909 7 19 5.20914 19 3Z" opacity="0.8" />
              </svg>
            </div>
          </div>

          {/* 단계별 메인 안내 문구 */}
          <div className="space-y-1.5 min-h-[58px] flex flex-col items-center justify-center">
            <h2 className="text-[20px] font-black tracking-tight leading-tight text-white anim-fade-in key={loadingStage}">
              {loadingStage === 1 && '서울 120여 개 라멘야 DB 스캔 중...'}
              {loadingStage === 2 && '육수 농도 · 면 굵기 · 타레 밸런스 매칭 중...'}
              {loadingStage === 3 && '오늘의 1순위 라멘야 도출 완료!'}
            </h2>
            <p className="text-[12px] text-white/50 font-medium">
              {loadingStage === 1 && '장인의 레시피와 실시간 방문 데이터를 대조합니다.'}
              {loadingStage === 2 && '선택하신 취향 패턴과 최적의 접점을 정밀 계산합니다.'}
              {loadingStage === 3 && '당신의 미각을 깨울 최상의 한 그릇을 준비했습니다.'}
            </p>
          </div>

          {/* 실시간 매칭 조건 태그 칩 */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-5 max-w-[300px]">
            <span className="px-2.5 py-1 rounded-[4px] bg-white/5 border border-white/10 text-[11px] font-bold text-white/80">
              🍜 {selectedSoup.split(' ')[0]}
            </span>
            <span className="px-2.5 py-1 rounded-[4px] bg-white/5 border border-white/10 text-[11px] font-bold text-white/80">
              🎯 {selectedPriority.split(' ')[0]}
            </span>
            {customPrompt && (
              <span className="px-2.5 py-1 rounded-[4px] bg-[#E60000]/15 border border-[#E60000]/40 text-[11px] font-bold text-[#FF6B6B] truncate max-w-[240px]">
                💬 “{customPrompt}”
              </span>
            )}
          </div>
        </div>

        {/* 하단 진행도 게이지 & 3단계 스테퍼 */}
        <div className="relative z-10 pb-8 space-y-3">
          {/* 3단계 스텝 인디케이터 */}
          <div className="flex items-center justify-between text-[11px] font-bold px-1">
            <span className={loadingStage >= 1 ? 'text-[#E60000]' : 'text-white/30'}>
              01 DB 스캔
            </span>
            <span className="text-white/20">──</span>
            <span className={loadingStage >= 2 ? 'text-[#E60000]' : 'text-white/30'}>
              02 미각 분석
            </span>
            <span className="text-white/20">──</span>
            <span className={loadingStage >= 3 ? 'text-[#E60000]' : 'text-white/30'}>
              03 매칭 완료
            </span>
          </div>

          {/* 프로그레스 바 */}
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden p-0.5 border border-white/10">
            <div
              className="h-full bg-gradient-to-r from-[#E60000] to-[#FF4D4D] rounded-full transition-all duration-700 ease-out shadow-[0_0_12px_rgba(230,0,0,0.8)]"
              style={{ width: loadingStage === 1 ? '38%' : loadingStage === 2 ? '78%' : '100%' }}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#FFFFFF] text-[#25282B]">
      
      {/* 상단 마스터 바 */}
      <header className="flex-shrink-0 bg-white/95 backdrop-blur-md px-5 pt-12 pb-3.5 border-b border-[#E2E2E2] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-full bg-[#F2F2F2] flex items-center justify-center text-[#25282B] active:scale-95 transition-all"
            aria-label="뒤로가기"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
              <path d="m15 18-6-6 6-6"/>
            </svg>
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
      <div className="flex-1 overflow-y-auto no-scrollbar p-5 flex flex-col justify-between">
        
        {/* Step 1: 국물 베이스 선택 */}
        {step === 1 && (
          <div className="space-y-4 anim-fade-in">
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
                      : 'border-[#E2E2E2] bg-white text-[#25282B] hover:border-[#25282B]'
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
          <div className="space-y-4 anim-fade-in">
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
                      : 'border-[#E2E2E2] bg-white text-[#25282B] hover:border-[#25282B]'
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
          <div className="space-y-4 anim-fade-in">
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
                      : 'border-[#E2E2E2] bg-white text-[#25282B] hover:border-[#25282B]'
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
          <div className="space-y-4 anim-fade-in">
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
                    className="h-7 px-3 bg-white border border-[#E2E2E2] hover:border-[#25282B] rounded-[32px] text-[11px] font-bold text-[#25282B] transition-colors"
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
          <div className="space-y-4 anim-fade-in-up">
            <div className="text-center py-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#E60000] bg-[#E60000]/10 px-3 py-1 rounded-[32px]">
                AI 취향 매칭 결과
              </span>
              <h2 className="text-[20px] font-black text-[#25282B] tracking-tight mt-2 break-keep">
                오늘 뿡님을 위한 1순위 라멘야
              </h2>
            </div>

            {/* 추천 카드 */}
            <article className="bg-white rounded-[6px] border border-[#E2E2E2] overflow-hidden">
              <div className="relative aspect-[16/10] bg-[#F2F2F2] overflow-hidden">
                <img src={result.photo} alt={result.shopName} className="w-full h-full object-cover" />
                <div className="absolute top-3 left-3 bg-[#E60000] text-white text-[11px] font-black px-3 py-1 rounded-[32px]">
                  취향 일치도 {result.matchScore}%
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-baseline justify-between mb-1">
                  <h3 className="text-[20px] font-black text-[#25282B]">
                    {result.shopName} · {result.branch}
                  </h3>
                  <span className="text-[12px] font-bold text-[#E60000]">추천 1위</span>
                </div>
                <p className="text-[12px] text-[#7E7E7E] mb-3">대표: {result.style}</p>

                {/* AI 추천 근거 요약 블록 */}
                <div className="p-3.5 bg-[#F2F2F2] rounded-[6px] text-[12px] text-[#25282B] leading-relaxed mb-3 break-keep">
                  <span className="text-[#E60000] font-black mr-1">“</span>
                  {result.reason}
                  <span className="text-[#E60000] font-black ml-1">”</span>
                </div>

                <div className="flex gap-1.5 flex-wrap">
                  {result.tags.map((t, idx) => (
                    <span key={idx} className="bg-white border border-[#E2E2E2] text-[10px] font-bold px-2.5 py-0.5 rounded-[32px] text-[#4A4D52]">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            </article>

            {/* 액션 버튼 */}
            <div className="space-y-2 pt-2">
              <button
                onClick={onShopClick}
                className="w-full h-12 rounded-[60px] bg-[#E60000] text-white font-bold text-[13px] active:scale-98 hover:bg-[#CC0000] transition-all flex items-center justify-center gap-2"
              >
                매장 상세 및 리뷰 보러가기 →
              </button>
              <button
                onClick={() => setStep(1)}
                className="w-full h-11 rounded-[60px] border border-[#25282B] text-[12px] font-bold text-[#25282B] bg-white hover:bg-[#F2F2F2] transition-all"
              >
                다시 추천받기 🔄
              </button>
            </div>
          </div>
        )}

        {/* Step 네비게이션 버튼 (Step 1~4일 때) */}
        {typeof step === 'number' && (
          <footer className="pt-4 border-t border-[#E2E2E2] flex gap-2.5">
            {step > 1 && (
              <button
                onClick={() => setStep((step - 1) as any)}
                className="flex-1 h-12 rounded-[60px] border border-[#25282B] text-[13px] font-bold text-[#25282B] bg-white hover:bg-[#F2F2F2] transition-all"
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
              className="flex-1 h-12 rounded-[60px] bg-[#E60000] text-white font-bold text-[13px] active:scale-98 hover:bg-[#CC0000] transition-all"
            >
              {step === 4 ? 'AI 맞춤 추천받기 ✨' : '다음 단계 →'}
            </button>
          </footer>
        )}

      </div>
    </div>
  )
}
