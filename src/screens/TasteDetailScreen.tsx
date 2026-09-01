import { useState, useRef, useEffect } from 'react'

interface Props {
  onBack: () => void
  recordCount: number
}

// ----------------------------------------------------
// 🌟 5축 AI 취향 정밀 레이더 차트 (내 취향 vs 전체 평균 비교)
// ----------------------------------------------------
function RadarChart() {
  const size = 250
  const center = 125
  const radius = 80

  const metrics = [
    { label: '국물 농도', score: '4.8', myVal: 0.92, avgVal: 0.58, xText: 125, yText: 14 },
    { label: '면 경도', score: '4.5', myVal: 0.88, avgVal: 0.52, xText: 218, yText: 92 },
    { label: '염도 밸런스', score: '4.1', myVal: 0.76, avgVal: 0.55, xText: 182, yText: 216 },
    { label: '타레 감칠맛', score: '4.9', myVal: 0.96, avgVal: 0.62, xText: 68, yText: 216 },
    { label: '오일 리치함', score: '4.2', myVal: 0.82, avgVal: 0.50, xText: 32, yText: 92 },
  ]

  const getCoord = (index: number, value: number) => {
    const angle = (Math.PI * 2 / 5) * index - Math.PI / 2
    const r = radius * value
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    }
  }

  const levels = [0.33, 0.66, 1.0]
  
  // 내 취향 폴리곤
  const myPolygonPoints = metrics
    .map((m, i) => {
      const { x, y } = getCoord(i, m.myVal)
      return `${x},${y}`
    })
    .join(' ')

  // 전체 유저 평균 폴리곤
  const avgPolygonPoints = metrics
    .map((m, i) => {
      const { x, y } = getCoord(i, m.avgVal)
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div className="relative flex flex-col items-center justify-center py-2">
      <svg width={size} height={size} className="overflow-visible select-none">
        <defs>
          <radialGradient id="myRadarGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#E60000" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#E60000" stopOpacity="0.08" />
          </radialGradient>
        </defs>

        {/* 방사형 그리드 다각형 */}
        {levels.map((lvl, idx) => {
          const pts = [0, 1, 2, 3, 4]
            .map(i => {
              const { x, y } = getCoord(i, lvl)
              return `${x},${y}`
            })
            .join(' ')
          return (
            <polygon
              key={idx}
              points={pts}
              fill="none"
              stroke="#E2E2E2"
              strokeWidth="1"
              strokeDasharray={idx === 2 ? 'none' : '2 2'}
            />
          )
        })}

        {/* 축 선 */}
        {[0, 1, 2, 3, 4].map(i => {
          const { x, y } = getCoord(i, 1.0)
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="#E2E2E2"
              strokeWidth="1"
            />
          )
        })}

        {/* 전체 유저 평균 영역 (그레이 점선) */}
        <polygon
          points={avgPolygonPoints}
          fill="rgba(126, 126, 126, 0.08)"
          stroke="#BEBEBE"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />

        {/* 내 취향 데이터 영역 (스칼렛 레드) */}
        <polygon
          points={myPolygonPoints}
          fill="url(#myRadarGlow)"
          stroke="#E60000"
          strokeWidth="2.5"
        />

        {/* 데이터 꼭짓점 점 */}
        {metrics.map((m, i) => {
          const { x, y } = getCoord(i, m.myVal)
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="3.5"
              fill="#E60000"
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />
          )
        })}

        {/* 라벨 & 점수 텍스트 */}
        {metrics.map((m, i) => (
          <g key={i}>
            <text
              x={m.xText}
              y={m.yText - 6}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[10px] font-bold fill-[#7E7E7E]"
            >
              {m.label}
            </text>
            <text
              x={m.xText}
              y={m.yText + 7}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[11px] font-black fill-[#25282B]"
            >
              {m.score}
            </text>
          </g>
        ))}
      </svg>

      {/* 차트 하단 범례 */}
      <div className="flex items-center justify-center gap-4 mt-2 text-[10px] font-bold">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#E60000]" />
          <span className="text-[#25282B]">내 취향 DNA</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-0.5 border-t border-dashed border-[#BEBEBE]" />
          <span className="text-[#7E7E7E]">라오타 전체 평균</span>
        </div>
      </div>
    </div>
  )
}

const STYLE_ROWS = [
  { name: '돈코츠 (돼지뼈)', pct: 74, count: 18, note: '농후 백탕 · 요코하마 이에케' },
  { name: '쇼유 (간장)', pct: 62, count: 12, note: '동물계와 해산물 더블 블렌딩' },
  { name: '토리파이탄 (닭백탕)', pct: 45, count: 8, note: '크리미 거품 육수' },
  { name: '미소 (된장)', pct: 24, count: 3, note: '삿포로 숙성 적미소 볶음' },
  { name: '시오 (소금)', pct: 15, count: 2, note: '맑고 깊은 닭청탕 육수' },
]

const AI_RECOMMENDED_SHOPS = [
  {
    rank: 1,
    name: '멘야준',
    branch: '망원 본점',
    style: '특제 쇼유 라멘',
    photo: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=200&h=200&fit=crop&auto=format&q=80',
    matchPct: 98,
    reason: '닭+오리 더블 육수의 깊은 감칠맛이 사용자 취향 모델과 98% 일치',
    mustTry: '특제 쇼유 라멘 (면 카타멘 추천)',
  },
  {
    rank: 2,
    name: '하쿠텐',
    branch: '연남점',
    style: '매운 이에케 라멘',
    photo: 'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=200&h=200&fit=crop&auto=format&q=80',
    matchPct: 95,
    reason: '초고농도 동물계 육수와 굵은 치지레멘 조합의 완벽한 궁합',
    mustTry: '매운 이에케 라멘 (간 보통 / 기름 보통)',
  },
  {
    rank: 3,
    name: '세상끝의라멘',
    branch: '합정점',
    style: '끝라멘 (블랙 쇼유)',
    photo: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=200&h=200&fit=crop&auto=format&q=80',
    matchPct: 91,
    reason: '오사카식 진한 흑간장 타레의 묵직한 염도 밸런스 부합',
    mustTry: '끝라멘 + 수비드 목살 차슈 추가',
  },
]

const GENERATION_STEPS = [
  { title: '완식 로그 벡터 추출', desc: '43건의 테이스팅 태그 및 메모 임베딩 분석 중...' },
  { title: '라멘야 마스터 DB 매핑', desc: '방문 매장의 육수 농도·염도·면발 스펙 결합 중...' },
  { title: '5축 미각 레이더 연산', desc: '전체 유저 대비 취향 편차 및 매칭 매장 TOP 3 산출 중...' },
  { title: 'AI 정밀 리포트 합성 완료', desc: 'RAOTA AI 정밀 검증 스탬프 날인 중...' },
]

export default function TasteDetailScreen({ onBack, recordCount }: Props) {
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [lastGeneratedTime, setLastGeneratedTime] = useState('2026. 09. 01 15:48')
  const scrollRef = useRef<HTMLDivElement>(null)

  // 🌟 생성 완료 시 최상단으로 자동 스크롤
  useEffect(() => {
    if (!isGenerating && scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [isGenerating])

  const handleShare = () => {
    setToastMessage('AI 리포트 공유 링크가 복사되었습니다.')
    setTimeout(() => setToastMessage(null), 2500)
  }

  // 🌟 AI 정밀 취향 리포트 재발행 플로우 실행
  const handleReGenerate = () => {
    setIsGenerating(true)
    setStepIndex(0)
    setProgress(15)

    const timer1 = setTimeout(() => {
      setStepIndex(1)
      setProgress(45)
    }, 1100)

    const timer2 = setTimeout(() => {
      setStepIndex(2)
      setProgress(75)
    }, 2300)

    const timer3 = setTimeout(() => {
      setStepIndex(3)
      setProgress(100)
    }, 3400)

    const timer4 = setTimeout(() => {
      setIsGenerating(false)
      const now = new Date()
      const timeStr = `방금 갱신 (${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')})`
      setLastGeneratedTime(timeStr)
      setToastMessage('✨ 최신 완식 데이터가 반영된 AI 정밀 리포트가 발행되었습니다!')
      setTimeout(() => setToastMessage(null), 3000)
    }, 4300)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
      clearTimeout(timer4)
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#FFFFFF] text-[#25282B] relative">
      
      {/* 1. 상단 마스터 헤더 */}
      <header className="flex-shrink-0 bg-white/95 backdrop-blur-md px-4 pt-12 pb-3.5 border-b border-[#E2E2E2] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#25282B] hover:bg-[#F2F2F2] active:scale-95 transition-all -ml-1"
            aria-label="뒤로가기"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black text-[#E60000] tracking-wider uppercase">RAOTA AI Engine v2.4</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#E60000] animate-pulse" />
            </div>
            <h1 className="text-[17px] font-black text-[#25282B] tracking-tight">라멘 취향 정밀 분석 리포트</h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleShare}
            className="text-[11px] font-bold text-[#25282B] border border-[#25282B] px-3 py-1.5 rounded-[60px] hover:bg-[#25282B] hover:text-white transition-colors active:scale-95 flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
            <span>공유</span>
          </button>
        </div>
      </header>

      {/* 토스트 메시지 */}
      {toastMessage && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 bg-[#25282B] text-white text-[12px] font-bold px-4 py-2.5 rounded-full shadow-xl anim-fade-in-up flex items-center gap-1.5 whitespace-nowrap border border-white/20">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 🔄 Step 2: AI 리포트 실시간 분석 & 합성 로딩 화면 (Sensory Lab) */}
      {/* ======================================================== */}
      {isGenerating ? (
        <div className="flex-1 flex flex-col justify-between items-center px-6 py-8 text-center anim-fade-in select-none bg-gradient-to-b from-white via-stone-50/60 to-[#F2F2F2]">
          
          {/* 상단 라벨 */}
          <div className="pt-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[32px] bg-[#25282B] text-white text-[10px] font-bold tracking-wider shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E60000] animate-ping" />
              <span>RAOTA TASTE SYNTHESIS LAB</span>
            </div>
          </div>

          {/* 중앙 AI 미각 코어 시각화 */}
          <div className="flex flex-col items-center max-w-xs w-full my-auto">
            {/* 회전 레이더 & 육각 미각 코어 */}
            <div className="relative w-24 h-24 flex items-center justify-center mb-5">
              {/* 바깥 동심원 */}
              <div className="absolute inset-0 rounded-full border border-stone-200 anim-tracer-pulse" />
              {/* 회전 트레이서 */}
              <div className="absolute inset-1 rounded-full border-2 border-transparent border-t-[#E60000] border-r-[#E60000] animate-spin" style={{ animationDuration: '2.4s' }} />
              {/* 내부 코어 */}
              <div className="w-16 h-16 rounded-[14px] bg-[#25282B] text-white flex flex-col items-center justify-center shadow-lg border border-stone-700">
                <span className="text-[10px] font-mono font-bold text-[#E60000] leading-none mb-0.5">DNA</span>
                <span className="text-[16px] font-mono font-black text-white leading-none">{progress}%</span>
              </div>
            </div>

            {/* 단계별 타이틀 */}
            <div className="space-y-1 mb-5">
              <span className="text-[11px] font-mono font-black text-[#E60000] tracking-wider uppercase block">
                STEP 0{stepIndex + 1} / 04
              </span>
              <h2 className="text-[19px] font-black text-[#25282B] tracking-tight">
                {GENERATION_STEPS[stepIndex].title}
              </h2>
              <p className="text-[12px] text-[#7E7E7E] leading-snug">
                {GENERATION_STEPS[stepIndex].desc}
              </p>
            </div>

            {/* 실시간 프로그레스 바 */}
            <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden mb-5">
              <div
                className="h-full bg-gradient-to-r from-[#E60000] to-[#FF4D4D] rounded-full transition-all duration-500 ease-out shadow-xs"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* 4단계 정밀 분석 체크리스트 */}
            <div className="w-full bg-white rounded-[8px] border border-[#E2E2E2] p-3.5 divide-y divide-stone-100 text-left shadow-xs">
              {GENERATION_STEPS.map((s, idx) => {
                const isDone = idx < stepIndex
                const isCurrent = idx === stepIndex
                return (
                  <div key={idx} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                        isDone
                          ? 'bg-[#E60000] text-white'
                          : isCurrent
                          ? 'bg-[#25282B] text-white animate-pulse'
                          : 'bg-stone-100 text-stone-400'
                      }`}>
                        {isDone ? '✓' : idx + 1}
                      </span>
                      <span className={`font-bold ${isCurrent ? 'text-[#E60000]' : isDone ? 'text-[#25282B]' : 'text-stone-300'}`}>
                        {s.title}
                      </span>
                    </div>
                    {isDone ? (
                      <span className="text-[#E60000] font-black text-[10px]">완료 ✓</span>
                    ) : isCurrent ? (
                      <span className="text-[#E60000] font-bold text-[10px] animate-pulse">합성 중...</span>
                    ) : (
                      <span className="text-stone-300 font-medium text-[10px]">대기</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 하단 서브 메시지 */}
          <div className="pb-2">
            <p className="text-[11px] font-medium text-[#7E7E7E]">
              나만의 고유 미각 DNA와 라멘 로그를 6각 레이더로 시각화하고 있습니다.
            </p>
          </div>
        </div>
      ) : (

        /* ======================================================== */
        /* ✨ Step 3: 리포트 결과 화면 (최신 데이터 렌더링) */
        /* ======================================================== */
        <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-4 anim-fade-in-up">
          
          {/* AI 브리핑 히어로 카드 (보더폰 딥 잉크 & 레드 악센트) */}
          <section className="bg-gradient-to-br from-[#25282B] to-[#1A1C1E] text-white rounded-[8px] p-5 relative overflow-hidden shadow-md">
            {/* 상단 메타 스트립 */}
            <div className="flex justify-between items-center pb-3 mb-4 border-b border-white/10 text-[10px] font-mono text-white/60">
              <span className="flex items-center gap-1.5">
                <span className="text-[#E60000] font-black">2026. 09월 정기호</span>
                <span className="text-white/40">|</span>
                <span>#RAOTA-AI-{recordCount}</span>
              </span>
              <span className="text-[#E60000] font-bold">{lastGeneratedTime}</span>
            </div>

            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[24px] font-black text-white leading-tight tracking-tight">
                  진한 돈골파 <br />
                  <span className="text-[13px] text-white/70 font-normal">(Lv.4 라멘집 단골)</span>
                </h2>
                <p className="text-[12px] text-white/80 mt-2.5 leading-relaxed">
                  “12시간 이상 농축된 동물계 육수의 감칠맛과 1.5mm 카타멘의 씹는 맛을 최우선으로 평가하는 상위 2% 매니아입니다.”
                </p>
              </div>

              {/* AI Verified 스탬프 */}
              <div className="border-2 border-[#E60000] text-[#E60000] bg-black/20 backdrop-blur-xs rounded-[4px] px-2.5 py-1.5 text-center flex-shrink-0 rotate-[-4deg]">
                <span className="text-[8px] block tracking-wider font-bold">RAOTA AI</span>
                <span className="text-[13px] font-black tracking-wider block">정밀 검증</span>
                <span className="text-[7px] block text-white/60">VERIFIED</span>
              </div>
            </div>

            {/* AI 태그 칩 & 월간 갱신 안내 */}
            <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-white/10">
              <span className="text-[10px] font-bold bg-white/10 text-white px-2 py-0.5 rounded-[4px]">#초고농도백탕</span>
              <span className="text-[10px] font-bold bg-white/10 text-white px-2 py-0.5 rounded-[4px]">#카타멘(단단한면)</span>
              <span className="text-[10px] font-bold bg-white/10 text-white px-2 py-0.5 rounded-[4px]">#감칠맛도파민</span>
              <span className="text-[10px] font-bold bg-[#E60000]/20 text-[#E60000] border border-[#E60000]/30 px-2 py-0.5 rounded-[4px]">#다음 무료 발행 D-28</span>
              <span className="text-[10px] font-bold bg-white/10 text-white px-2 py-0.5 rounded-[4px]">#총 {recordCount}그릇 학습</span>
            </div>
          </section>

          {/* 5축 취향 정밀 분석 레이더 섹션 */}
          <section className="bg-white rounded-[6px] border border-[#E2E2E2] p-5">
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#E2E2E2]">
              <h2 className="text-[14px] font-black tracking-tight text-[#25282B]">
                5축 미각 밸런스 정밀 측정
              </h2>
              <span className="text-[10px] font-bold text-[#7E7E7E] bg-[#F2F2F2] px-2 py-0.5 rounded-[4px]">AI 벡터 매핑</span>
            </div>

            <RadarChart />

            {/* AI 인사이트 하이라이트 박스 */}
            <div className="mt-3 p-3.5 bg-stone-50 rounded-[6px] border border-stone-200 text-[12px] text-[#25282B] leading-relaxed space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-black text-[#E60000]">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                </svg>
                <span>AI 알고리즘 분석 코멘트</span>
              </div>
              <p className="text-[12px] text-stone-700">
                • <strong>국물 농도(4.8점)</strong>와 <strong>타레 감칠맛(4.9점)</strong>이 일반 유저 평균 대비 <strong>+34%</strong> 높게 측정되었습니다.
              </p>
              <p className="text-[12px] text-stone-700">
                • 면 삶기는 꼬들하고 심지가 살아있는 <strong>카타멘(단단한 삶기)</strong>을 일관되게 선택하는 확고한 취향 패턴을 보입니다.
              </p>
            </div>
          </section>

          {/* AI 추천 취향 일치 라멘야 TOP 3 (사진 썸네일 탑재) */}
          <section className="bg-white rounded-[6px] border border-[#E2E2E2] p-5">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E2E2E2]">
              <h2 className="text-[14px] font-black tracking-tight text-[#25282B]">
                내 취향 90% 이상 일치 매장 TOP 3
              </h2>
              <span className="text-[10px] font-bold text-[#E60000] bg-[#E60000]/10 px-2 py-0.5 rounded-[32px]">초정밀 매칭</span>
            </div>

            <div className="space-y-3">
              {AI_RECOMMENDED_SHOPS.map(shop => (
                <div
                  key={shop.rank}
                  className="p-3.5 bg-stone-50 rounded-[6px] border border-stone-200 space-y-2.5 hover:border-[#25282B] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-[6px] overflow-hidden bg-stone-200 flex-shrink-0 border border-stone-300">
                      <img src={shop.photo} alt={shop.name} className="w-full h-full object-cover" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-[#25282B] text-white text-[10px] font-black flex items-center justify-center">
                            {shop.rank}
                          </span>
                          <span className="text-[14px] font-black text-[#25282B] truncate">{shop.name}</span>
                          <span className="text-[11px] text-stone-500 truncate">· {shop.branch}</span>
                        </div>
                        <span className="text-[11px] font-black text-[#E60000] bg-[#E60000]/10 px-2 py-0.5 rounded-full flex-shrink-0">
                          {shop.matchPct}% 일치
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 truncate mt-0.5">{shop.style}</p>
                    </div>
                  </div>

                  <p className="text-[11px] text-stone-600 leading-snug">
                    {shop.reason}
                  </p>

                  <div className="flex items-center gap-1.5 pt-2 border-t border-stone-200/60 text-[10px] font-bold text-[#25282B]">
                    <span className="text-[#E60000] flex-shrink-0">추천 주문:</span>
                    <span className="bg-white px-2 py-0.5 rounded border border-stone-200 text-stone-700 truncate">{shop.mustTry}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 선호 라멘 계보 점유율 */}
          <section className="bg-white rounded-[6px] border border-[#E2E2E2] p-5">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E2E2E2]">
              <h2 className="text-[14px] font-black tracking-tight text-[#25282B]">
                선호 라멘 계보 점유율
              </h2>
              <span className="text-[11px] font-bold text-[#7E7E7E]">총 {recordCount}회 기록</span>
            </div>

            <div className="divide-y divide-[#E2E2E2]">
              {STYLE_ROWS.map((row, idx) => (
                <div key={idx} className="py-2.5 flex items-center gap-3">
                  <div className="w-28 flex-shrink-0">
                    <span className="text-[12px] font-black text-[#25282B] block">{row.name}</span>
                    <span className="text-[10px] text-[#7E7E7E] block truncate">{row.note}</span>
                  </div>
                  <div className="flex-1 h-2 bg-[#F2F2F2] rounded-[32px] overflow-hidden">
                    <div
                      className="h-full bg-[#E60000] rounded-[32px] transition-all duration-500"
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                  <div className="w-12 text-right text-[11px] text-[#25282B] font-black flex-shrink-0">
                    {row.count}회
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* AI 큐레이터의 대척점 탐험 제안 */}
          <section className="bg-[#25282B] text-white rounded-[6px] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-black text-white tracking-tight">
                다음 탐험 추천: 맑은 육수의 정점, "특제 시오 라멘"
              </h3>
              <span className="text-[9px] text-white/50 font-mono">NEXT STEP</span>
            </div>

            <div className="flex items-center gap-3 bg-white/5 p-2.5 rounded-[6px] border border-white/10">
              <div className="w-12 h-12 rounded-[4px] overflow-hidden flex-shrink-0 bg-stone-700">
                <img
                  src="https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=200&h=200&fit=crop&auto=format&q=80"
                  alt="담택 유자 시오 라멘"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-black text-white">담택 (합정 본점)</p>
                <p className="text-[11px] text-white/70 truncate">유자 시오 라멘 · 맑은 닭청탕 육수</p>
              </div>
            </div>

            <p className="text-[12px] text-white/80 leading-relaxed">
              농후 백탕에 집중된 취향에 맑은 닭청탕 베이스 시오 라멘을 경험해보세요. 5축 레이더의 대척점 데이터를 채워 완벽한 미각 균형을 완성할 수 있습니다.
            </p>
          </section>

          {/* ⚡ 실시간 AI 재분석 버튼 (동적 3단계 플로우 실행) */}
          <section className="bg-stone-50 rounded-[6px] border border-stone-200 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-black text-[#25282B]">실시간 AI 리포트 재분석</span>
                <span className="text-[9px] font-bold text-[#E60000] bg-[#E60000]/10 px-1.5 py-0.2 rounded-sm">1회 무료 제공</span>
              </div>
              <span className="text-[10px] text-stone-400 font-medium">매월 1일 자동 갱신</span>
            </div>

            <p className="text-[11px] text-stone-600 leading-relaxed">
              새로운 라멘을 완식하셨나요? <strong>43건의 완식 데이터와 라오타 매장 마스터 DB</strong>를 다시 합성하여 5축 미각 DNA를 즉시 갱신합니다.
            </p>

            <button
              type="button"
              onClick={handleReGenerate}
              className="w-full h-11 rounded-[6px] bg-[#25282B] hover:bg-[#1A1C1E] active:scale-98 text-white font-bold text-[12px] transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <svg className="w-4 h-4 text-[#E60000]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
              </svg>
              <span>최신 데이터로 AI 리포트 다시 발행하기</span>
            </button>
          </section>

          <div className="h-6" />
        </div>
      )}
    </div>
  )
}
