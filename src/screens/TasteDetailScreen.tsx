import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, Share2, RotateCw, History, ChevronRight, Calendar, BookOpen, ArrowRight, CheckCircle2, Sparkles, X } from 'lucide-react'

interface Props {
  onBack: () => void
  recordCount: number
}

interface MetricItem {
  label: string
  score: string
  myVal: number
  avgVal: number
  xText: number
  yText: number
}

interface PastReportItem {
  id: string
  vol: string
  period: string
  publishedDate: string
  title: string
  levelBadge: string
  levelNum: number
  quote: string
  recordCount: number
  tags: string[]
  strongestFeature: string
  metrics: MetricItem[]
  insights: string[]
  topShops: {
    rank: number
    name: string
    branch: string
    style: string
    matchPct: number
    mustTry: string
    reason: string
    image: string
  }[]
  styleRows: {
    name: string
    pct: number
    count: number
    note: string
  }[]
  diffWithCurrent: string
}

const PAST_REPORTS: PastReportItem[] = [
  {
    id: 'vol-03',
    vol: 'Vol. 03',
    period: '2026년 08월 정기호',
    publishedDate: '2026. 08. 01',
    title: '청탕과 담백한 블렌딩파',
    levelBadge: 'Lv.3 라멘 탐험가',
    levelNum: 3,
    quote: '“맑고 깔끔한 닭청탕과 담백한 블렌딩 스프의 깊은 타레 밸런스를 즐겨 찾는 미식가입니다.”',
    recordCount: 36,
    tags: ['#닭청탕시오', '#감칠맛블렌딩', '#스트레이트면', '#36그릇학습'],
    strongestFeature: '타레 감칠맛 (4.7) · 염도 밸런스 (4.4)',
    metrics: [
      { label: '국물 농도', score: '3.6', myVal: 0.68, avgVal: 0.58, xText: 125, yText: 14 },
      { label: '면 경도', score: '3.9', myVal: 0.74, avgVal: 0.52, xText: 218, yText: 92 },
      { label: '염도 밸런스', score: '4.4', myVal: 0.86, avgVal: 0.55, xText: 182, yText: 216 },
      { label: '타레 감칠맛', score: '4.7', myVal: 0.92, avgVal: 0.62, xText: 68, yText: 216 },
      { label: '오일 리치함', score: '3.2', myVal: 0.60, avgVal: 0.50, xText: 32, yText: 92 },
    ],
    insights: [
      '국물 농도보다 타레 본연의 감칠맛과 맑고 개운한 끝맛을 극대화한 메뉴를 집중 소비했습니다.',
      '면은 굵은 치지레면보다 부드럽고 매끄러운 얇은 스트레이트 중화면을 선호했습니다.',
    ],
    topShops: [
      {
        rank: 1,
        name: '담택',
        branch: '합정 본점',
        style: '시오(소금) 라멘 전문',
        visitCount: 5,
        mustTry: '특제 유자 시오 라멘 + 차슈 추가',
        reason: '맑은 닭청탕에 매료되어 8월 한 달간 5회 방문한 당시 1위 단골집',
        image: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=300&h=200&fit=crop&auto=format&q=80',
      },
      {
        rank: 2,
        name: '멘야준',
        branch: '망원 본점',
        style: '특제 시오 라멘',
        visitCount: 4,
        mustTry: '특제 시오 라멘 (얇은 면 추천)',
        reason: '깔끔한 닭+해산물 청탕 스프가 생각날 때마다 찾은 2위 단골 매장',
        image: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=200&h=200&fit=crop&auto=format&q=80',
      },
      {
        rank: 3,
        name: '세상끝의라멘',
        branch: '합정점',
        style: '첫라멘 (담백한 쇼유)',
        visitCount: 2,
        mustTry: '첫라멘 + 닭가슴살 차슈',
        reason: '짜지 않은 부드러운 간장 육수로 입가심하러 꾸준히 들른 3위 매장',
        image: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=200&h=200&fit=crop&auto=format&q=80',
      },
    ],
    styleRows: [
      { name: '시오 (소금)', pct: 48, count: 17, note: '맑고 깊은 닭청탕 육수' },
      { name: '쇼유 (간장)', pct: 32, count: 12, note: '담백한 해산물 블렌딩' },
      { name: '돈코츠 (돼지뼈)', pct: 14, count: 5, note: '하카타식 스탠다드 돈골' },
      { name: '기타 (미소/비빔)', pct: 6, count: 2, note: '아부라소바 및 계절메뉴' },
    ],
    diffWithCurrent: '발행 초기에는 맑고 담백한 닭청탕(시오 48%) 위주였으나, 현재 누적 종합은 초고농도 백탕(돈골 74%)으로 묵직한 스프 선호가 대폭 증가했습니다.',
  },
  {
    id: 'vol-02',
    vol: 'Vol. 02',
    period: '2026년 07월 정기호',
    publishedDate: '2026. 07. 01',
    title: '쇼유 & 진한 타레 매니아',
    levelBadge: 'Lv.2 라멘 애호가',
    levelNum: 2,
    quote: '“진한 간장 특유의 풍미와 차슈 토핑의 풍성한 육즙 밸런스를 즐기는 감각적인 라멘러입니다.”',
    recordCount: 28,
    tags: ['#특제간장쇼유', '#차슈마니아', '#중후한풍미', '#28그릇학습'],
    strongestFeature: '타레 감칠맛 (4.8) · 국물 농도 (4.0)',
    metrics: [
      { label: '국물 농도', score: '4.0', myVal: 0.78, avgVal: 0.58, xText: 125, yText: 14 },
      { label: '면 경도', score: '4.1', myVal: 0.78, avgVal: 0.52, xText: 218, yText: 92 },
      { label: '염도 밸런스', score: '3.8', myVal: 0.70, avgVal: 0.55, xText: 182, yText: 216 },
      { label: '타레 감칠맛', score: '4.8', myVal: 0.94, avgVal: 0.62, xText: 68, yText: 216 },
      { label: '오일 리치함', score: '3.7', myVal: 0.72, avgVal: 0.50, xText: 32, yText: 92 },
    ],
    insights: [
      '발효 숙성된 간장의 그윽한 향과 토핑 차슈의 풍미가 어우러진 정통 쇼유 라멘을 즐겨 찾았습니다.',
      '간장의 염도와 육수의 감칠맛이 조화를 이루는 중농도 스펙트럼에 집중되었습니다.',
    ],
    topShops: [
      {
        rank: 1,
        name: '라멘베라보',
        branch: '망원 본점',
        style: '쇼유(간장) 라멘 전문',
        visitCount: 6,
        mustTry: '베라보 특제 쇼유 + 완숙 계란',
        reason: '숙성 간장 타레에 푹 빠져 7월 한 달간 최다 방문한 1위 단골집',
        image: 'https://images.unsplash.com/photo-1591814468924-caf88d1232e1?w=300&h=200&fit=crop&auto=format&q=80',
      },
      {
        rank: 2,
        name: '세상끝의라멘',
        branch: '합정점',
        style: '끝라멘 (블랙 쇼유)',
        visitCount: 4,
        mustTry: '끝라멘 + 수비드 목살 차슈',
        reason: '오사카식 진한 흑간장 타레의 바디감으로 재방문을 거듭한 2위 매장',
        image: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=200&h=200&fit=crop&auto=format&q=80',
      },
      {
        rank: 3,
        name: '멘야준',
        branch: '망원 본점',
        style: '특제 쇼유 라멘',
        visitCount: 3,
        mustTry: '특제 쇼유 라멘',
        reason: '닭육수 베이스에 정갈한 간장 타레가 생각날 때 찾은 3위 매장',
        image: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=200&h=200&fit=crop&auto=format&q=80',
      },
    ],
    styleRows: [
      { name: '쇼유 (간장)', pct: 54, count: 15, note: '특제 숙성 간장 타레' },
      { name: '돈코츠 (돼지뼈)', pct: 25, count: 7, note: '스탠다드 돈골' },
      { name: '시오 (소금)', pct: 14, count: 4, note: '담백한 조개/닭 육수' },
      { name: '기타 (미소 등)', pct: 7, count: 2, note: '블렌딩 미소' },
    ],
    diffWithCurrent: '7월호 발행 시점에는 쇼유 계통이 54%로 과반을 차지했으나, 점차 돈골 백탕(74%)으로 메인 취향이 이동했습니다.',
  },
  {
    id: 'vol-01',
    vol: 'Vol. 01 (첫 발행)',
    period: '2026년 06월 창간호',
    publishedDate: '2026. 06. 15',
    title: '돈코츠 입문 탐험가',
    levelBadge: 'Lv.1 라멘 비기너',
    levelNum: 1,
    quote: '“정통 하카타식 진한 돈골 육수와 묵직한 오일 리치함을 중심으로 탐색을 시작한 입문자입니다.”',
    recordCount: 15,
    tags: ['#하카타돈코츠', '#오일리치', '#마늘풍미', '#15그릇학습'],
    strongestFeature: '국물 농도 (4.6) · 오일 리치함 (4.4)',
    metrics: [
      { label: '국물 농도', score: '4.6', myVal: 0.88, avgVal: 0.58, xText: 125, yText: 14 },
      { label: '면 경도', score: '4.0', myVal: 0.76, avgVal: 0.52, xText: 218, yText: 92 },
      { label: '염도 밸런스', score: '3.5', myVal: 0.65, avgVal: 0.55, xText: 182, yText: 216 },
      { label: '타레 감칠맛', score: '4.2', myVal: 0.80, avgVal: 0.62, xText: 68, yText: 216 },
      { label: '오일 리치함', score: '4.4', myVal: 0.85, avgVal: 0.50, xText: 32, yText: 92 },
    ],
    insights: [
      '돈사골을 오래 고아낸 백탕 육수의 녹진한 점도와 고소한 지방 풍미를 집중 탐색했습니다.',
      '익숙하고 대중적인 정통 하카타식 돈코츠 라멘집들을 주로 완식했습니다.',
    ],
    topShops: [
      {
        rank: 1,
        name: '멘야준',
        branch: '홍대 본점',
        style: '돈코츠 전문',
        visitCount: 5,
        mustTry: '특제 돈코츠 라멘',
        reason: '라오타 시작과 함께 가장 먼저 단골이 된 입문기 1위 매장',
        image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=300&h=200&fit=crop&auto=format&q=80',
      },
      {
        rank: 2,
        name: '하쿠텐',
        branch: '연남점',
        style: '이에케 라멘',
        visitCount: 3,
        mustTry: '이에케 라멘 (보통)',
        reason: '진한 돼지뼈와 닭뼈 육수의 묵직한 바디감으로 꾸준히 찾은 2위 매장',
        image: 'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=200&h=200&fit=crop&auto=format&q=80',
      },
      {
        rank: 3,
        name: '부탄츄',
        branch: '신촌점',
        style: '토코 돈코츠',
        visitCount: 2,
        mustTry: '토코 톤코츠 라멘',
        reason: '초고농도 걸쭉한 국물과 호소멘 조합으로 입문기 만족도가 높았던 3위 매장',
        image: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=200&h=200&fit=crop&auto=format&q=80',
      },
    ],
    styleRows: [
      { name: '돈코츠 (돼지뼈)', pct: 67, count: 10, note: '하카타식 정통 돈골' },
      { name: '쇼유 (간장)', pct: 20, count: 3, note: '기본 도쿄 쇼유' },
      { name: '기타 (미소/탄탄)', pct: 13, count: 2, note: '매콤한 라멘 탐색' },
    ],
    diffWithCurrent: '창간호에서는 기본 돈코츠 위주의 입문기였으며, 현재는 요코하마 이에케 및 백탕 전반을 아우르는 상위 레벨(Lv.4)로 발전했습니다.',
  },
]

const DEFAULT_METRICS: MetricItem[] = [
  { label: '국물 농도', score: '4.8', myVal: 0.92, avgVal: 0.58, xText: 125, yText: 14 },
  { label: '면 경도', score: '4.5', myVal: 0.88, avgVal: 0.52, xText: 218, yText: 92 },
  { label: '염도 밸런스', score: '4.1', myVal: 0.76, avgVal: 0.55, xText: 182, yText: 216 },
  { label: '타레 감칠맛', score: '4.9', myVal: 0.96, avgVal: 0.62, xText: 68, yText: 216 },
  { label: '오일 리치함', score: '4.2', myVal: 0.82, avgVal: 0.50, xText: 32, yText: 92 },
]

// ----------------------------------------------------
// 🌟 5축 AI 취향 정밀 레이더 차트 (내 취향 vs 전체 평균 비교)
// ----------------------------------------------------
function RadarChart({ customMetrics }: { customMetrics?: MetricItem[] }) {
  const size = 250
  const center = 125
  const radius = 80

  const metrics = customMetrics || DEFAULT_METRICS

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

const TOP_VISITED_SHOPS = [
  {
    rank: 1,
    name: '멘야준',
    branch: '망원 본점',
    style: '특제 쇼유 라멘',
    photo: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=200&h=200&fit=crop&auto=format&q=80',
    visitCount: 14,
    sharePct: 33,
    reason: '총 43그릇 중 14그릇(33%)을 완식한 회원님의 독보적 1위 최애 단골 매장',
    mustTry: '특제 쇼유 라멘 (면 카타멘 추천)',
  },
  {
    rank: 2,
    name: '하쿠텐',
    branch: '연남점',
    style: '매운 이에케 라멘',
    photo: 'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=200&h=200&fit=crop&auto=format&q=80',
    visitCount: 11,
    sharePct: 26,
    reason: '초고농도 돈골 스프가 생각날 때마다 꾸준히 찾은 2위 단골 매장',
    mustTry: '매운 이에케 라멘 (간 보통 / 기름 보통)',
  },
  {
    rank: 3,
    name: '세상끝의라멘',
    branch: '합정점',
    style: '끝라멘 (블랙 쇼유)',
    photo: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=200&h=200&fit=crop&auto=format&q=80',
    visitCount: 7,
    sharePct: 16,
    reason: '진한 흑간장 타레의 묵직한 감칠맛으로 재방문을 거듭한 3위 매장',
    mustTry: '끝라멘 + 수비드 목살 차슈 추가',
  },
]

const GENERATION_STEPS = [
  { title: '라멘로그 벡터 추출', desc: '43건의 테이스팅 태그 및 메모 임베딩 분석 중...' },
  { title: '라멘집 마스터 DB 매핑', desc: '방문 매장의 육수 농도·염도·면발 스펙 결합 중...' },
  { title: '라멘 입맛 밸런스 연산', desc: '전체 유저 대비 취향 편차 및 매칭 매장 TOP 3 산출 중...' },
  { title: 'AI 정밀 리포트 합성 완료', desc: 'RAOTA AI 정밀 검증 스탬프 날인 중...' },
]


export default function TasteDetailScreen({ onBack, recordCount }: Props) {
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [lastGeneratedTime, setLastGeneratedTime] = useState('2026. 09. 01 15:48')
  const [viewMode, setViewMode] = useState<'current' | 'past_list' | 'past_detail'>('current')
  const [selectedPastReport, setSelectedPastReport] = useState<PastReportItem | null>(null)
  const [showArchiveGuideModal, setShowArchiveGuideModal] = useState(false)
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
      setToastMessage('최신 라멘로그 데이터가 반영된 AI 정밀 리포트가 발행되었습니다.')
      setTimeout(() => setToastMessage(null), 3000)
    }, 4300)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
      clearTimeout(timer4)
    }
  }

  // ========================================================
  // 📚 1) 이전 취향 리포트 보관함 리스트 페이지
  // ========================================================
  if (viewMode === 'past_list') {
    return (
      <div className="h-full bg-[#FBFBFB] text-[#25282B] flex flex-col overflow-hidden relative">
        {/* 상단 헤더 */}
        <header className="flex-shrink-0 bg-white px-3.5 pt-3.5 pb-3 border-b border-[#EAEAEA]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <button
                onClick={() => setViewMode('current')}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#25282B] hover:bg-[#F2F2F2] active:scale-95 transition-all -ml-1 shrink-0"
                aria-label="뒤로가기"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h1 className="text-[16px] font-black text-[#25282B] tracking-tight whitespace-nowrap truncate">
                월간 정기 리포트 보관함
              </h1>
            </div>
            <span className="text-[11px] font-bold text-[#7E7E7E] shrink-0 whitespace-nowrap">
              총 <span className="text-[#E60000] font-black">{PAST_REPORTS.length}권 보관</span>
            </span>
          </div>
          <p className="text-[11px] text-[#7E7E7E] mt-1 pl-9 leading-snug">
            매월 1일(월 3그릇 이상 완식 시) 자동 발행되어 영구 소장되는 월별 취향 기록입니다.
          </p>
        </header>

        {/* 본문 리스트 영역 */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3">
          {/* 올타임 누적 종합 리포트 - Hero Featured Card */}
          <div
            onClick={() => setViewMode('current')}
            className="bg-[#25282B] text-white rounded-[12px] p-4 cursor-pointer hover:bg-[#1A1C1E] transition-all shadow-sm group"
          >
            <div className="flex items-center justify-between text-[10.5px] font-mono mb-2">
              <span className="text-[#E60000] font-black tracking-wider">올타임 누적</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1 text-[10px]">
                <CheckCircle2 className="w-3 h-3" />
                현재 기본 리포트
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-[17px] font-black text-white truncate">진한 돈골파</h3>
                  <span className="text-[9.5px] font-bold bg-[#E60000] text-white px-1.5 py-0.5 rounded-full shrink-0">Lv.4</span>
                </div>
                <p className="text-[11.5px] text-white/70 mt-1 truncate">누적 43그릇 기준 종합 취향 DNA</p>
              </div>

              <span className="text-[11px] font-black text-white/90 group-hover:text-white group-hover:translate-x-0.5 transition-all flex items-center gap-0.5 shrink-0 whitespace-nowrap">
                누적 리포트
                <ChevronRight className="w-3.5 h-3.5 text-[#E60000]" />
              </span>
            </div>
          </div>

          {/* 지난 리포트 섹션 */}
          <div className="pt-2 space-y-2.5">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] font-bold text-[#7E7E7E]">지난 정기 리포트</span>
              <span className="text-[10px] text-[#7E7E7E]">월별 스냅샷 보관</span>
            </div>

            {PAST_REPORTS.map(report => (
              <div
                key={report.id}
                onClick={() => {
                  setSelectedPastReport(report)
                  setViewMode('past_detail')
                }}
                className="bg-white rounded-[12px] border border-[#EAEAEA] hover:border-[#BEBEBE] p-4 cursor-pointer transition-all shadow-2xs hover:shadow-xs group space-y-2.5"
              >
                {/* 1. 타이틀 & 월호 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-mono font-black text-[#7E7E7E] bg-stone-100 px-1.5 py-0.5 rounded shrink-0">
                      {report.vol.split('(')[0].trim()}
                    </span>
                    <h4 className="text-[15.5px] font-black text-[#25282B] group-hover:text-[#E60000] transition-colors truncate">
                      {report.title}
                    </h4>
                  </div>
                  <span className="text-[11px] font-bold text-[#E60000] group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 shrink-0 whitespace-nowrap">
                    보기
                    <ChevronRight className="w-3 h-3" />
                  </span>
                </div>

                {/* 2. 핵심 지표 한 줄 요약 */}
                <div className="flex items-center justify-between text-[11px] text-[#7E7E7E] pt-2 border-t border-stone-100">
                  <span>{report.period}</span>
                  <div className="flex items-center gap-2 text-[#25282B] font-bold">
                    <span>{report.recordCount}그릇</span>
                    <span className="text-stone-300">·</span>
                    <span className="text-[#E60000]">{report.strongestFeature.split('(')[0].trim()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="h-6" />
        </div>
      </div>
    )
  }

  // ========================================================
  // 📜 2) 과거 특정 리포트 상세 열람 화면 (현재 리포트와 동등한 정보량)
  // ========================================================
  if (viewMode === 'past_detail') {
    const activeReport = selectedPastReport || PAST_REPORTS[0]
    return (
      <div className="h-full bg-[#FBFBFB] text-[#25282B] flex flex-col overflow-hidden relative">
        {/* 상단 헤더 */}
        <header className="flex-shrink-0 bg-white px-3.5 pt-3.5 pb-3.5 border-b border-[#EAEAEA] flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              onClick={() => setViewMode('past_list')}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#25282B] hover:bg-[#F2F2F2] active:scale-95 transition-all -ml-1 shrink-0"
              aria-label="뒤로가기"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-[16px] font-black text-[#25282B] tracking-tight whitespace-nowrap truncate">
              {activeReport.period} 리포트
            </h1>
          </div>
          <button
            onClick={() => {
              setSelectedPastReport(null)
              setViewMode('current')
            }}
            className="text-[11px] font-bold text-[#E60000] bg-[#E60000]/10 px-2.5 py-1.5 rounded-full transition-all shrink-0 whitespace-nowrap"
          >
            누적 리포트 보기
          </button>
        </header>

        {/* 과거 리포트 본문 */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3.5">
          {/* 1. 히어로 카드 */}
          <section className="bg-white rounded-[12px] border border-[#EAEAEA] p-4.5 space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-[5px] bg-[#E60000] text-white font-mono font-black text-[10px] tracking-wider uppercase">
                  {activeReport.vol.split('(')[0].trim()}
                </span>
                <span className="text-[11px] font-mono font-bold text-stone-600">
                  {activeReport.recordCount}그릇 완식 기준
                </span>
              </div>
              <span className="bg-stone-100 text-stone-600 font-bold px-2 py-0.5 rounded text-[10px]">
                {activeReport.levelBadge}
              </span>
            </div>

            <div>
              <h2 className="text-[21px] font-black text-[#25282B] tracking-tight">
                {activeReport.title}
              </h2>
              <p className="text-[12px] text-stone-700 mt-1 leading-snug font-medium">
                {activeReport.quote}
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-stone-100">
              {activeReport.tags.map((t, idx) => (
                <span key={idx} className="text-[9.5px] font-bold bg-stone-100 text-stone-600 px-2 py-0.5 rounded">
                  {t}
                </span>
              ))}
            </div>
          </section>

          {/* 2. 5가지 입맛 밸런스 */}
          <section className="bg-white rounded-[12px] border border-[#EAEAEA] p-4 space-y-2.5 shadow-2xs">
            <div className="border-b border-stone-100 pb-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-black text-[#25282B]">5가지 입맛 밸런스</h3>
                <span className="text-[10.5px] font-bold text-[#E60000]">{activeReport.strongestFeature.split('·')[0].trim()}</span>
              </div>
              <p className="text-[11px] text-[#7E7E7E] mt-0.5 leading-snug">
                해당 월간호 라멘로그 측정치(붉은 영역)와 전체 라멘러 평균(회색 점선)의 비교입니다.
              </p>
            </div>

            <RadarChart customMetrics={activeReport.metrics} />

            {/* 핵심 인사이트 */}
            <div className="bg-stone-50 rounded-[8px] p-3 text-[11px] text-stone-700 space-y-1">
              {activeReport.insights.map((insight, idx) => (
                <p key={idx}>• {insight}</p>
              ))}
            </div>
          </section>

          {/* 3. 최다 방문 라멘집 TOP 3 */}
          <section className="bg-white rounded-[12px] border border-[#EAEAEA] p-4 space-y-2.5 shadow-2xs">
            <div className="border-b border-stone-100 pb-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-black text-[#25282B]">최다 방문 라멘집 TOP 3</h3>
              </div>
              <p className="text-[11px] text-[#7E7E7E] mt-0.5 leading-snug">
                해당 월간호 발행 시점까지 회원님이 가장 자주 찾아 라멘로그를 남긴 최애 단골 매장 순위입니다.
              </p>
            </div>

            <div className="divide-y divide-stone-100">
              {activeReport.topShops.map(shop => (
                <div key={shop.rank} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="relative w-11 h-11 rounded-[6px] overflow-hidden bg-stone-100 shrink-0">
                      <img src={shop.image} alt={shop.name} className="w-full h-full object-cover" />
                      <span className="absolute top-0 left-0 w-3.5 h-3.5 bg-[#25282B] text-white text-[8px] font-black flex items-center justify-center rounded-br">
                        {shop.rank}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[13px] font-black text-[#25282B] truncate">
                          {shop.name} <span className="text-stone-400 font-normal text-[10.5px]">· {shop.branch}</span>
                        </h4>
                        <span className="text-[11px] font-black text-[#E60000] shrink-0 font-mono">
                          {shop.visitCount}회 완식
                        </span>
                      </div>
                      <p className="text-[10.5px] text-stone-500 truncate mt-0.5">최애: {shop.mustTry}</p>
                    </div>
                  </div>
                  <p className="text-[10.5px] text-stone-600 mt-1 pl-14 leading-snug">{shop.reason}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 4. 선호 계보 점유율 */}
          <section className="bg-white rounded-[12px] border border-[#EAEAEA] p-4 space-y-2 shadow-2xs">
            <div className="border-b border-stone-100 pb-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-black text-[#25282B]">선호 계보 점유율</h3>
                <span className="text-[10px] font-mono text-stone-400">{activeReport.recordCount}그릇 완식 기준</span>
              </div>
              <p className="text-[11px] text-[#7E7E7E] mt-0.5 leading-snug">
                발행 시점까지 작성된 라멘로그의 육수 계보별 누적 소비 비중입니다.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              {activeReport.styleRows.map((row, idx) => (
                <div key={idx} className="flex items-center gap-2 text-[11px]">
                  <span className="w-20 font-bold text-[#25282B] truncate">{row.name.split(' ')[0]}</span>
                  <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#E60000] rounded-full" style={{ width: `${row.pct}%` }} />
                  </div>
                  <span className="w-8 text-right font-mono font-bold text-stone-600 text-[10.5px]">{row.pct}%</span>
                </div>
              ))}
            </div>
          </section>

          {/* 5. 📈 현재(누적 종합)와의 미각 변화 비교 */}
          <section className="bg-white rounded-[12px] border border-[#EAEAEA] p-4 space-y-1.5 shadow-2xs">
            <div className="flex items-center gap-1.5 text-[12px] font-black text-[#25282B]">
              <span>📈 현재(누적 종합)와의 미각 변화</span>
            </div>
            <p className="text-[11.5px] text-stone-700 leading-relaxed font-medium">
              {activeReport.diffWithCurrent}
            </p>
          </section>

          {/* 하단 네비게이션 버튼 */}
          <div className="pt-1 pb-4 flex gap-2">
            <button
              onClick={() => setViewMode('past_list')}
              className="flex-1 h-10 rounded-[8px] border border-[#EAEAEA] text-[11.5px] font-bold text-[#25282B] bg-white transition-all hover:bg-stone-50"
            >
              ← 목록으로 돌아가기
            </button>
            <button
              onClick={() => {
                setSelectedPastReport(null)
                setViewMode('current')
              }}
              className="flex-1 h-10 rounded-[8px] bg-[#25282B] hover:bg-black text-[11.5px] font-bold text-white transition-all shadow-xs"
            >
              누적 종합 리포트 보기
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ========================================================
  // 🌟 3) 최신 정밀 리포트 메인 화면 (올타임 누적 종합 취향 DNA)
  // ========================================================
  return (
    <div
      ref={scrollRef}
      className="h-full bg-[#FBFBFB] text-[#25282B] overflow-y-auto no-scrollbar relative"
    >
      {/* 1. 상단 마스터 헤더 (스크롤 연동) */}
      <header className="bg-white px-3.5 pt-3.5 pb-3.5 border-b border-[#EAEAEA] flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#25282B] hover:bg-[#F2F2F2] active:scale-95 transition-all -ml-1 shrink-0"
            aria-label="뒤로가기"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-[16px] font-black text-[#25282B] tracking-tight whitespace-nowrap truncate">
            라멘 취향 종합 리포트
          </h1>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleShare}
            className="w-8 h-8 rounded-full border border-[#EAEAEA] hover:border-[#BEBEBE] bg-white hover:bg-[#F9F9F9] flex items-center justify-center transition-colors active:scale-95 shadow-2xs shrink-0"
            title="리포트 공유"
            aria-label="공유"
          >
            <Share2 className="w-3.5 h-3.5 text-[#25282B]" />
          </button>
        </div>
      </header>

      {/* 토스트 메시지 */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#25282B]/95 backdrop-blur-md text-white text-[11.5px] font-bold px-3.5 py-2 rounded-full shadow-lg anim-fade-in-up flex items-center gap-1.5 whitespace-nowrap pointer-events-none">
          <span className="w-3.5 h-3.5 rounded-full bg-[#E60000] text-white flex items-center justify-center text-[9px] font-black shrink-0">✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 🌟 월간 정기 리포트 보관함 안내 & 예고 모달 */}
      {showArchiveGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs anim-fade-in">
          <div className="bg-white rounded-[14px] max-w-sm w-full p-5 space-y-4 shadow-xl border border-stone-100 anim-scale-up text-left">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#E60000]/10 text-[#E60000] flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <h3 className="text-[15px] font-black text-[#25282B]">월간 정기 리포트 보관함</h3>
              </div>
              <button
                onClick={() => setShowArchiveGuideModal(false)}
                className="w-7 h-7 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-400 hover:text-[#25282B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-[12px] text-[#25282B]">
              <div className="bg-stone-50 rounded-[10px] p-3.5 space-y-2 border border-stone-100">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#7E7E7E]">다음 발행 예정일</span>
                  <span className="font-black text-[#E60000] font-mono">2026. 10. 01 (D-27)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#7E7E7E]">발행 최소 조건</span>
                  <span className="font-black text-[#25282B]">해당 월 라멘로그 3그릇 이상</span>
                </div>
                {/* 진행도 게이지 */}
                <div className="pt-1.5 space-y-1">
                  <div className="flex items-center justify-between text-[10.5px]">
                    <span className="text-stone-500 font-medium">9월 달성 현황</span>
                    <span className="font-bold text-[#E60000]">2 / 3그릇 (1그릇 남음!)</span>
                  </div>
                  <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
                    <div className="h-full bg-[#E60000] rounded-full" style={{ width: '66%' }} />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 text-[11.5px] text-stone-600 leading-relaxed">
                <p>• <strong>월별 미각 진화 기록</strong>: 한 달 동안 작성한 라멘로그를 바탕으로 나의 입맛이 어떻게 진화했는지 매월 1일 자정에 분석 리포트가 발행됩니다.</p>
                <p>• <strong>영구 보관함 소장</strong>: 3그릇 이상 기록 시 해당 월의 정기 리포트가 보관함에 평생 소장되어 언제든 다시 열람할 수 있습니다.</p>
              </div>
            </div>

            {/* 버튼 영역 */}
            <div className="pt-2 space-y-2">
              <button
                onClick={() => {
                  setShowArchiveGuideModal(false)
                  setViewMode('past_list')
                }}
                className="w-full h-10 rounded-[8px] bg-[#25282B] hover:bg-black text-white text-[11.5px] font-bold transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>보관함 둘러보기 (샘플 아카이브)</span>
              </button>
              <button
                onClick={() => setShowArchiveGuideModal(false)}
                className="w-full h-9 rounded-[8px] border border-stone-200 text-stone-600 text-[11.5px] font-medium hover:bg-stone-50 transition-colors"
              >
                확인 완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 로딩 화면 */}
      {isGenerating ? (
        <div className="flex flex-col justify-center items-center px-6 py-12 text-center anim-fade-in select-none min-h-[480px]">
          <div className="w-14 h-14 rounded-full bg-[#25282B] text-white flex flex-col items-center justify-center shadow-md mb-4 animate-pulse">
            <span className="text-[8px] font-mono text-[#E60000] font-bold">DNA</span>
            <span className="text-[14px] font-mono font-black">{progress}%</span>
          </div>
          <h2 className="text-[17px] font-black text-[#25282B] tracking-tight">
            {GENERATION_STEPS[stepIndex].title}
          </h2>
          <p className="text-[11.5px] text-[#7E7E7E] mt-1">
            {GENERATION_STEPS[stepIndex].desc}
          </p>
        </div>
      ) : (

        /* 리포트 결과 메인 (올타임 누적 종합 DNA) */
        <div className="p-4 space-y-3 anim-fade-in-up">
          
          {/* 🌟 월간 정기 리포트 보관함 예고 & 안내 배너 */}
          <div
            onClick={() => setShowArchiveGuideModal(true)}
            className="bg-white border border-[#EAEAEA] hover:border-[#BEBEBE] px-3.5 py-2.5 rounded-[10px] flex items-center justify-between cursor-pointer transition-all shadow-2xs group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-[#E60000]/10 text-[#E60000] flex items-center justify-center font-bold text-xs shrink-0">
                <Calendar className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-bold text-[#25282B]">월간 정기 리포트 보관함</span>
                  <span className="text-[9.5px] font-bold text-[#E60000] bg-[#E60000]/10 px-1.5 py-0.2 rounded-full font-mono">D-27</span>
                </div>
                <p className="text-[10.5px] text-[#7E7E7E] truncate mt-0.5">매월 1일 발행 · 이번 달 3그릇 완식 시 보관</p>
              </div>
            </div>
            <div className="flex items-center gap-0.5 text-[11px] font-black text-[#E60000] group-hover:translate-x-0.5 transition-transform shrink-0">
              <span>안내</span>
              <ChevronRight className="w-3 h-3" />
            </div>
          </div>

          {/* 1. 핵심 취향 요약 (Hero Card - 올타임 누적 DNA) */}
          <section className="bg-gradient-to-br from-[#25282B] to-[#1A1C1E] text-white rounded-[12px] p-4.5 space-y-2.5 shadow-sm">
            <div className="flex justify-between items-center text-[10.5px] font-mono text-white/60">
              <span className="text-[#E60000] font-black">올타임 누적 종합</span>
              <span>총 {recordCount}그릇 기준</span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[22px] font-black text-white tracking-tight">
                  진한 돈골파
                </h2>
                <span className="text-[10px] font-bold bg-[#E60000] text-white px-2 py-0.5 rounded-full shrink-0">
                  Lv.4
                </span>
              </div>
              <p className="text-[12px] text-white/90 mt-1 leading-snug font-medium">
                초고농도 동물계 백탕과 단단한 면발(카타멘)을 고집하는 확고한 입맛
              </p>
              <p className="text-[10.5px] text-white/60 mt-1.5 leading-snug">
                지금까지 완식한 {recordCount}건의 모든 라멘로그를 AI가 정밀 분석하여 도출된 올타임 미각 정체성입니다.
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-white/10">
              <span className="text-[9.5px] font-bold bg-white/10 text-white/90 px-2 py-0.5 rounded">#초고농도백탕</span>
              <span className="text-[9.5px] font-bold bg-white/10 text-white/90 px-2 py-0.5 rounded">#카타멘</span>
              <span className="text-[9.5px] font-bold bg-white/10 text-white/90 px-2 py-0.5 rounded">#감칠맛도파민</span>
              <span className="text-[9.5px] font-bold bg-[#E60000]/25 text-white border border-[#E60000]/40 px-2 py-0.5 rounded">#올타임DNA</span>
            </div>
          </section>

          {/* 2. 입맛 밸런스 레이더 */}
          <section className="bg-white rounded-[12px] border border-[#EAEAEA] p-4 space-y-2.5 shadow-2xs">
            <div className="border-b border-stone-100 pb-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-black text-[#25282B]">
                  5가지 핵심 입맛 밸런스
                </h3>
                <span className="text-[10.5px] font-bold text-[#E60000]">
                  농도·감칠맛 상위 2%
                </span>
              </div>
              <p className="text-[11px] text-[#7E7E7E] mt-0.5 leading-snug">
                내 누적 라멘로그 분석치(붉은 영역)와 전체 라멘러 평균(회색 점선)을 비교한 수치입니다.
              </p>
            </div>

            <RadarChart />

            {/* 핵심 2포인트 요약 */}
            <div className="bg-stone-50 rounded-[8px] p-3 text-[11px] text-stone-700 space-y-1">
              <p>• <strong>국물 농도 & 감칠맛</strong>: 평균 대비 <strong>+34%</strong> 높은 묵직한 스프 선호</p>
              <p>• <strong>면 삶기</strong>: 심지가 살아있는 <strong>카타멘(단단한 삶기)</strong> 일관 선택</p>
            </div>
          </section>

          {/* 3. 최다 방문 라멘집 TOP 3 */}
          <section className="bg-white rounded-[12px] border border-[#EAEAEA] p-4 space-y-2.5 shadow-2xs">
            <div className="border-b border-stone-100 pb-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-black text-[#25282B]">
                  최다 방문 라멘집 TOP 3
                </h3>
              </div>
              <p className="text-[11px] text-[#7E7E7E] mt-0.5 leading-snug">
                회원님이 가장 자주 찾아 라멘로그를 남긴 최애 단골 매장 순위입니다.
              </p>
            </div>

            <div className="divide-y divide-stone-100">
              {TOP_VISITED_SHOPS.map(shop => (
                <div key={shop.rank} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="relative w-11 h-11 rounded-[6px] overflow-hidden bg-stone-100 shrink-0">
                      <img src={shop.photo} alt={shop.name} className="w-full h-full object-cover" />
                      <span className="absolute top-0 left-0 w-3.5 h-3.5 bg-[#25282B] text-white text-[8px] font-black flex items-center justify-center rounded-br">
                        {shop.rank}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[13px] font-black text-[#25282B] truncate">
                          {shop.name} <span className="text-stone-400 font-normal text-[10.5px]">· {shop.branch}</span>
                        </h4>
                        <span className="text-[11px] font-black text-[#E60000] shrink-0 font-mono">
                          {shop.visitCount}회 완식
                        </span>
                      </div>
                      <p className="text-[10.5px] text-stone-500 truncate mt-0.5">최애: {shop.mustTry}</p>
                    </div>
                  </div>
                  <p className="text-[10.5px] text-stone-600 mt-1 pl-14 leading-snug">{shop.reason}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 4. 선호 계보 점유율 */}
          <section className="bg-white rounded-[12px] border border-[#EAEAEA] p-4 space-y-2 shadow-2xs">
            <div className="border-b border-stone-100 pb-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-black text-[#25282B]">선호 계보 점유율</h3>
                <span className="text-[10px] font-mono text-stone-400">총 {recordCount}그릇 누적</span>
              </div>
              <p className="text-[11px] text-[#7E7E7E] mt-0.5 leading-snug">
                완식한 모든 라멘들의 육수 베이스와 계보별 누적 소비 비중입니다.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              {STYLE_ROWS.map((row, idx) => (
                <div key={idx} className="flex items-center gap-2 text-[11px]">
                  <span className="w-20 font-bold text-[#25282B] truncate">{row.name.split(' ')[0]}</span>
                  <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#E60000] rounded-full" style={{ width: `${row.pct}%` }} />
                  </div>
                  <span className="w-8 text-right font-mono font-bold text-stone-600 text-[10.5px]">{row.pct}%</span>
                </div>
              ))}
            </div>
          </section>

          {/* 5. 다음 탐험 제안 */}
          <section className="bg-white rounded-[12px] border border-[#EAEAEA] p-4 shadow-2xs space-y-2">
            <div className="border-b border-stone-100 pb-1.5">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-black text-[#25282B]">💡 다음 탐험 제안</h3>
                <span className="text-[9.5px] font-mono font-bold text-[#E60000]">NEXT STEP</span>
              </div>
              <p className="text-[11px] text-[#7E7E7E] mt-0.5 leading-snug">
                현재 누적 취향(진한 백탕)을 벗어나 새로운 미각 스펙트럼을 넓혀볼 기회입니다.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-0.5">
              <img
                src="https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=200&h=200&fit=crop&auto=format&q=80"
                alt="담택"
                className="w-11 h-11 rounded-[6px] object-cover bg-stone-100 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h4 className="text-[13px] font-black text-[#25282B] truncate">담택 (합정 본점) · 유자 시오</h4>
                <p className="text-[10.5px] text-stone-500 truncate mt-0.5">유자 시오 라멘 · 맑은 닭청탕 육수</p>
              </div>
            </div>
            <p className="text-[10.5px] text-stone-600 leading-snug">
              농후 백탕 중심에서 맑은 닭청탕 시오 라멘으로 입맛 스펙트럼을 넓혀보세요.
            </p>
          </section>

          {/* 6. 리포트 다시 발행 버튼 */}
          <div className="pt-1 pb-4 space-y-1.5">
            <button
              type="button"
              onClick={handleReGenerate}
              className="w-full h-10 rounded-[8px] bg-[#25282B] hover:bg-black active:scale-98 text-white font-bold text-[11.5px] transition-all flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <RotateCw className="w-3.5 h-3.5 text-[#E60000]" />
              <span>최신 데이터로 리포트 갱신</span>
            </button>
            <p className="text-[10.5px] text-center text-[#7E7E7E]">
              새로운 라멘로그를 작성하면 누적 미각 DNA와 추천 매장이 실시간 재계산됩니다.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
