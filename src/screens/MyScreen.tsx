import { useState, useRef, useEffect, useMemo } from 'react'
import { ActivityCalendar, type Activity } from 'react-activity-calendar'
import 'react-activity-calendar/tooltips.css'

interface Props {
  recordSaved: boolean
  recordCount: number
  onViewTaste: () => void
}

// ----------------------------------------------------
// 🌟 raota-front 공식 라멘 활동 등급 시스템
// ----------------------------------------------------
export interface RamenActivityLevel {
  min: number
  title: string
  nextTarget: number | null
  desc: string
}

export const RAMEN_ACTIVITY_LEVELS: RamenActivityLevel[] = [
  { min: 0, title: '라멘 입문자', nextTarget: 1, desc: '첫 기록 전' },
  { min: 1, title: '라멘을 즐기는 자', nextTarget: 10, desc: '라멘로그 1개 이상' },
  { min: 10, title: '라멘집 탐험가', nextTarget: 30, desc: '라멘로그 10개 이상' },
  { min: 30, title: '라멘집 단골', nextTarget: 50, desc: '라멘로그 30개 이상' },
  { min: 50, title: '라멘 미식가', nextTarget: 100, desc: '라멘로그 50개 이상' },
  { min: 100, title: '라멘 마스터', nextTarget: null, desc: '라멘로그 100개 이상' },
]

export const getRamenActivityLevel = (logCount: number) => {
  const currentLevel = [...RAMEN_ACTIVITY_LEVELS]
    .reverse()
    .find((level) => logCount >= level.min) || RAMEN_ACTIVITY_LEVELS[0]
  const nextLevel = currentLevel.nextTarget
    ? RAMEN_ACTIVITY_LEVELS.find((level) => level.min === currentLevel.nextTarget)
    : null
  const progress = currentLevel.nextTarget
    ? Math.min(100, ((logCount - currentLevel.min) / (currentLevel.nextTarget - currentLevel.min)) * 100)
    : 100

  return { ...currentLevel, nextLevel, progress: Math.max(0, progress) }
}

const SAVED_SHOPS = [
  { name: '멘야준', loc: '망원', style: '쇼유', photo: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=200&h=200&fit=crop&auto=format&q=80' },
  { name: '오레노라멘', loc: '마포', style: '돈코츠', photo: 'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=200&h=200&fit=crop&auto=format&q=80' },
  { name: '묘코', loc: '연남', style: '토리파이탄', photo: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=200&h=200&fit=crop&auto=format&q=80' },
]

interface LogEntry {
  shop: string; loc: string; menu: string; date: string; score: number; photo: string; isNew?: boolean; note?: string
}

const OLD_LOGS: LogEntry[] = [
  { shop: '오레노라멘', loc: '마포 본점', menu: '특제 돈코츠 라멘', date: '08.28', score: 5, photo: 'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=200&h=200&fit=crop&auto=format&q=80', note: '진한 거품 육수와 부드러운 차슈' },
  { shop: '묘코', loc: '연남점', menu: '특제 쇼유 라멘', date: '08.22', score: 5, photo: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=200&h=200&fit=crop&auto=format&q=80', note: '오리 육수의 맑고 깊은 감칠맛' },
  { shop: '후쿠 라멘', loc: '합정점', menu: '특제 미소 라멘', date: '08.15', score: 4, photo: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=200&h=200&fit=crop&auto=format&q=80', note: '불향 가득한 볶음 채소와 미소' },
]

type PeriodType = '1y' | '2026' | '2025'

// 기간별 캘린더 데이터 생성
const generateCalendarData = (period: PeriodType, saved: boolean): { data: Activity[]; total: number } => {
  const activities: Activity[] = []
  
  let startDate = new Date('2025-09-01')
  let endDate = new Date('2026-09-01')

  if (period === '2026') {
    startDate = new Date('2026-01-01')
    endDate = new Date('2026-09-01')
  } else if (period === '2025') {
    startDate = new Date('2025-01-01')
    endDate = new Date('2025-12-31')
  }

  // 2026년 데이터베이스
  const active2026: Record<string, { count: number; level: number; shop?: string }> = {
    '2026-09-01': saved ? { count: 1, level: 1, shop: '멘야준' } : { count: 0, level: 0 },
    '2026-08-30': { count: 1, level: 1, shop: '오레노라멘' },
    '2026-08-28': { count: 2, level: 2, shop: '묘코' },
    '2026-08-24': { count: 1, level: 1, shop: '세상끝의라멘' },
    '2026-08-22': { count: 1, level: 1, shop: '멘지' },
    '2026-08-18': { count: 2, level: 2, shop: '후쿠 라멘' },
    '2026-08-15': { count: 1, level: 1, shop: '하쿠텐' },
    '2026-08-10': { count: 3, level: 3, shop: '무타히로' },
    '2026-08-05': { count: 1, level: 1, shop: '담택' },
    '2026-07-31': { count: 1, level: 1, shop: '이리에라멘' },
    '2026-07-27': { count: 2, level: 2, shop: '멘야준' },
    '2026-07-20': { count: 1, level: 1, shop: '오레노라멘' },
    '2026-07-14': { count: 1, level: 1, shop: '토리파이탄' },
    '2026-07-08': { count: 2, level: 2, shop: '후쿠 라멘' },
    '2026-07-02': { count: 1, level: 1, shop: '세상끝의라멘' },
    '2026-06-25': { count: 1, level: 1, shop: '하쿠텐' },
    '2026-06-19': { count: 2, level: 2, shop: '멘야준' },
    '2026-06-12': { count: 1, level: 1, shop: '오레노라멘' },
    '2026-06-05': { count: 1, level: 1, shop: '담택' },
    '2026-05-28': { count: 2, level: 2, shop: '묘코' },
    '2026-05-20': { count: 1, level: 1, shop: '이리에라멘' },
    '2026-05-15': { count: 1, level: 1, shop: '멘지' },
    '2026-05-08': { count: 1, level: 1, shop: '후쿠 라멘' },
    '2026-05-02': { count: 2, level: 2, shop: '멘야준' },
    '2026-04-25': { count: 1, level: 1, shop: '담택' },
    '2026-04-18': { count: 2, level: 2, shop: '오레노라멘' },
    '2026-03-22': { count: 1, level: 1, shop: '세상끝의라멘' },
    '2026-03-14': { count: 1, level: 1, shop: '멘야준' },
    '2026-02-28': { count: 2, level: 2, shop: '후쿠 라멘' },
    '2026-02-14': { count: 1, level: 1, shop: '하쿠텐' },
    '2026-01-20': { count: 1, level: 1, shop: '오레노라멘' },
    '2026-01-05': { count: 2, level: 2, shop: '멘야준' },
  }

  // 2025년 데이터베이스
  const active2025: Record<string, { count: number; level: number; shop?: string }> = {
    '2025-12-28': { count: 2, level: 2, shop: '멘야준' },
    '2025-12-20': { count: 1, level: 1, shop: '오레노라멘' },
    '2025-12-14': { count: 2, level: 2, shop: '후쿠 라멘' },
    '2025-11-25': { count: 1, level: 1, shop: '세상끝의라멘' },
    '2025-11-18': { count: 3, level: 3, shop: '하쿠텐' },
    '2025-11-10': { count: 1, level: 1, shop: '담택' },
    '2025-10-30': { count: 2, level: 2, shop: '멘지' },
    '2025-10-22': { count: 1, level: 1, shop: '이리에라멘' },
    '2025-10-15': { count: 2, level: 2, shop: '멘야준' },
    '2025-09-28': { count: 1, level: 1, shop: '오레노라멘' },
    '2025-09-20': { count: 2, level: 2, shop: '묘코' },
    '2025-09-12': { count: 1, level: 1, shop: '후쿠 라멘' },
    '2025-08-25': { count: 2, level: 2, shop: '세상끝의라멘' },
    '2025-08-14': { count: 1, level: 1, shop: '멘야준' },
    '2025-07-30': { count: 2, level: 2, shop: '담택' },
    '2025-07-15': { count: 1, level: 1, shop: '하쿠텐' },
    '2025-06-20': { count: 2, level: 2, shop: '오레노라멘' },
    '2025-05-18': { count: 1, level: 1, shop: '멘지' },
    '2025-04-22': { count: 2, level: 2, shop: '후쿠 라멘' },
    '2025-03-30': { count: 1, level: 1, shop: '멘야준' },
    '2025-02-14': { count: 2, level: 2, shop: '묘코' },
    '2025-01-20': { count: 1, level: 1, shop: '세상끝의라멘' },
  }

  const allActive = { ...active2025, ...active2026 }
  let totalCount = 0

  const cur = new Date(startDate)
  while (cur <= endDate) {
    const dateStr = cur.toISOString().split('T')[0]
    const active = allActive[dateStr]
    const count = active?.count || 0
    totalCount += count
    activities.push({
      date: dateStr,
      count,
      level: active?.level || 0,
    })
    cur.setDate(cur.getDate() + 1)
  }

  return { data: activities, total: totalCount }
}

const RAOTA_THEME = {
  light: ['#F2F2F2', '#FFD6D6', '#FFA8A8', '#FF5C5C', '#E60000'],
  dark: ['#F2F2F2', '#FFD6D6', '#FFA8A8', '#FF5C5C', '#E60000'],
}

export default function MyScreen({ recordSaved, onViewTaste }: Props) {
  const [period, setPeriod] = useState<PeriodType>('1y')
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false)
  const [isGradeGuideOpen, setIsGradeGuideOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const periodDropdownRef = useRef<HTMLDivElement>(null)

  const { data: calendarData, total: totalBowls } = generateCalendarData(period, recordSaved)
  const totalLogCount = recordSaved ? 43 : 42

  // raota-front 공식 등급 계산
  const ramenActivityLevel = useMemo(() => getRamenActivityLevel(totalLogCount), [totalLogCount])

  // 기간 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (periodDropdownRef.current && !periodDropdownRef.current.contains(event.target as Node)) {
        setIsPeriodDropdownOpen(false)
      }
    }
    if (isPeriodDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isPeriodDropdownOpen])

  // 탭 변경 시 자동으로 가장 최근 일자(오른쪽)로 스크롤
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
  }, [period])

  const logs = recordSaved
    ? [{ shop: '멘야준', loc: '망원 본점', menu: '특제 쇼유 라멘', date: '09.01', score: 5, photo: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=200&h=200&fit=crop&auto=format&q=80', isNew: true, note: '첫 모금부터 감칠맛 폭발' }, ...OLD_LOGS]
    : OLD_LOGS

  return (
    <div className="h-full overflow-y-auto no-scrollbar bg-[#FFFFFF] text-[#25282B] relative">
      
      {/* 1. 상단 라멘 클럽 회원증 카드 (보더폰 딥 잉크 히어로 밴드) */}
      <header className="bg-[#25282B] text-white pt-14 pb-6 px-5 border-b border-[#1A1C1E]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-[6px] bg-white p-1 border border-white/20 flex items-center justify-center overflow-hidden">
              <img src="/logo.png" alt="RAOTA Logo" className="w-10 h-10 object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[20px] font-black tracking-tight">
                  뿡
                </h1>
                <span className="text-[10px] font-black bg-[#E60000] text-white px-2 py-0.5 rounded-[32px] uppercase">
                  {ramenActivityLevel.title}
                </span>
              </div>
              <p className="text-[11px] text-white/70 mt-0.5">RAOTA 라멘클럽 회원</p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[9px] text-white/50 block font-mono">MEMBERSHIP</span>
            <span className="text-[14px] font-black text-[#E60000]">#RT-0842</span>
          </div>
        </div>

        {/* 완식 통계 스펙 바 */}
        <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-white/10 text-center">
          <div className="bg-white/5 py-2 rounded-[4px]">
            <span className="text-[9px] text-white/60 block">총 완식 기록</span>
            <span className="text-[14px] font-black text-white">{totalLogCount}그릇</span>
          </div>
          <div className="bg-white/5 py-2 rounded-[4px]">
            <span className="text-[9px] text-white/60 block">정복 라멘야</span>
            <span className="text-[14px] font-black text-[#E60000]">28곳</span>
          </div>
          <div className="bg-white/5 py-2 rounded-[4px]">
            <span className="text-[9px] text-white/60 block">취향 리포트 완성도</span>
            <span className="text-[14px] font-black text-white">94%</span>
          </div>
        </div>
      </header>

      {/* 2. 본문 컨텐츠 */}
      <main className="p-5 space-y-4">
        
        {/* 🏆 라멘 활동 등급 & 등급 안내 카드 (raota-front 공식) */}
        <div className="bg-white rounded-[6px] border border-stone-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-[#E60000] uppercase tracking-wider">라멘 활동 등급</p>
              <h2 className="text-[16px] font-black text-[#25282B] mt-0.5 flex items-center gap-1.5">
                <span>{ramenActivityLevel.title}</span>
                <span className="text-[10px] font-bold text-stone-400">
                  (Lv.{RAMEN_ACTIVITY_LEVELS.findIndex(l => l.title === ramenActivityLevel.title) + 1})
                </span>
              </h2>
            </div>

            {/* 등급 안내 모달 버튼 */}
            <button
              onClick={() => setIsGradeGuideOpen(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-stone-200 bg-stone-50 hover:bg-white hover:border-[#E60000] px-2.5 text-[11px] font-black text-[#25282B] hover:text-[#E60000] transition-colors active:scale-95"
            >
              <svg className="w-3.5 h-3.5 text-[#E60000]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="6"/>
                <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>
              </svg>
              <span>등급 안내</span>
            </button>
          </div>

          {/* 다음 등급 진행도 바 */}
          {ramenActivityLevel.nextLevel ? (
            <div className="space-y-1.5 pt-2 border-t border-stone-100">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-stone-500 font-medium">
                  다음 등급: <strong className="text-[#25282B] font-bold">{ramenActivityLevel.nextLevel.title}</strong>
                </span>
                <span className="text-[#E60000] font-black">
                  {totalLogCount} / {ramenActivityLevel.nextLevel.min}그릇 ({Math.round(ramenActivityLevel.progress)}%)
                </span>
              </div>
              <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#E60000] rounded-full transition-all duration-500"
                  style={{ width: `${ramenActivityLevel.progress}%` }}
                />
              </div>
              <p className="text-[10px] text-stone-400 text-right">
                {ramenActivityLevel.nextLevel.title}까지 {ramenActivityLevel.nextLevel.min - totalLogCount}그릇 남았습니다.
              </p>
            </div>
          ) : (
            <div className="pt-2 border-t border-stone-100 text-[11px] text-stone-500 font-bold">
              ✨ 최고 등급인 라멘 마스터에 도달하셨습니다!
            </div>
          )}
        </div>

        {/* 취향 리포트 분석서 바로가기 카드 */}
        <div
          onClick={onViewTaste}
          className="bg-white rounded-[6px] border border-[#E2E2E2] p-4 cursor-pointer hover:border-[#25282B] active:scale-99 transition-all group"
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E2E2E2]">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-[#E60000] tracking-wider">
                라멘 취향 리포트
              </span>
              <span className="text-[9px] font-bold bg-[#E60000]/10 text-[#E60000] px-1.5 py-0.2 rounded-sm">
                9월 정기호
              </span>
            </div>
            <span className="text-[11px] font-bold text-[#25282B] group-hover:translate-x-1 transition-transform">
              리포트 열람 →
            </span>
          </div>
          
          <h2 className="text-[20px] font-black text-[#25282B] tracking-tight">
            진한 돈골파
          </h2>
          <p className="text-[12px] text-[#7E7E7E] mt-1 leading-snug">
            12시간 농축 동물계 육수와 꼬들꼬들한 단단한 면을 최우선으로 평가하는 매니아입니다. (다음 무료 갱신 D-28)
          </p>
        </div>

        {/* 🌿 라멘 완식 캘린더 (ActivityCalendar 라이브러리 연동) */}
        <div className="bg-white rounded-[6px] border border-[#E2E2E2] p-4 overflow-hidden">
          
          {/* 헤더 & 기간 선택 드롭다운 & 통계 뱃지 */}
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E2E2E2]">
            <div className="flex items-center gap-1.5">
              <span className="text-[14px]">🍜</span>
              <h2 className="text-[13px] font-black tracking-tight text-[#25282B]">
                라멘 완식 캘린더
              </h2>
            </div>

            <div className="flex items-center gap-1.5">
              {/* 커스텀 기간 선택 드롭다운 (raota-front 스펙) */}
              <div className="relative" ref={periodDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsPeriodDropdownOpen(prev => !prev)}
                  className="flex h-6.5 items-center gap-1.5 rounded-[4px] border border-stone-200 bg-[#F2F2F2] hover:bg-[#EAEAEA] hover:border-[#E60000] px-2.5 text-[11px] font-bold text-[#25282B] transition-colors"
                >
                  <span>{period === '1y' ? '최근 1년' : `${period}년`}</span>
                  <svg
                    className={`w-3 h-3 text-stone-400 shrink-0 transition-transform duration-200 ${
                      isPeriodDropdownOpen ? 'rotate-180 text-[#E60000]' : ''
                    }`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </button>

                {isPeriodDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1.5 z-40 w-28 rounded-sm border border-stone-300 bg-white shadow-lg overflow-hidden anim-fade-in-up">
                    <div className="py-1 divide-y divide-stone-50">
                      {[
                        { label: '최근 1년', val: '1y' },
                        { label: '2026년', val: '2026' },
                        { label: '2025년', val: '2025' },
                      ].map(opt => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => {
                            setPeriod(opt.val as PeriodType)
                            setIsPeriodDropdownOpen(false)
                          }}
                          className={`w-full px-3 py-1.5 text-left text-[11px] hover:bg-stone-50 transition-colors ${
                            period === opt.val ? 'font-bold text-[#E60000] bg-red-50' : 'text-[#25282B]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 완식 그릇 수 뱃지 */}
              <span className="text-[10px] font-bold text-[#E60000] bg-[#E60000]/10 px-2 py-0.5 rounded-[32px]">
                {totalBowls}그릇
              </span>
            </div>
          </div>

          {/* 2. 상단 가로 스크롤 잔디 영역 (캘린더만 스크롤 + 툴팁 노출) */}
          <div ref={scrollRef} className="overflow-x-auto custom-scrollbar pb-2 mb-3">
            <div className="min-w-max">
              <ActivityCalendar
                data={calendarData}
                theme={RAOTA_THEME}
                blockSize={12}
                blockMargin={3}
                blockRadius={2}
                fontSize={10}
                showWeekdayLabels
                showColorLegend={false}
                showTotalCount={false}
                tooltips={{
                  activity: {
                    text: activity =>
                      activity.count > 0
                        ? `${activity.date}: ${activity.count}그릇 완식 ✓`
                        : `${activity.date}: 완식 기록 없음`,
                  },
                }}
                labels={{
                  months: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
                  weekdays: ['일', '월', '화', '수', '목', '금', '토'],
                }}
              />
            </div>
          </div>

          {/* 3. 하단 고정 정보 & 범례 바 (좌: 안내 문구 | 우: 적음/많음 범례) */}
          <div className="pt-2.5 border-t border-[#E2E2E2] flex items-center justify-between text-[10px] text-[#7E7E7E]">
            {/* 좌측 안내 문구 */}
            <div className="flex items-center gap-1 min-w-0 truncate mr-2 text-[#7E7E7E]">
              <span>💡</span>
              <span className="truncate">라멘로그를 작성하면 캘린더가 채워집니다.</span>
            </div>

            {/* 우측 적음 / 많음 범례 */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <span>적음</span>
              <div className="flex gap-0.5">
                {RAOTA_THEME.light.map((color, i) => (
                  <span
                    key={i}
                    className="w-2.5 h-2.5 rounded-[2px]"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <span>많음</span>
            </div>
          </div>

          {/* 스트릭 뱃지 바 */}
          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-dashed border-[#E2E2E2] text-center">
            <div className="bg-[#F2F2F2] p-2 rounded-[4px]">
              <span className="text-[9px] text-[#7E7E7E] block">최장 연속 완식</span>
              <span className="text-[13px] font-black text-[#25282B]">4일 연속</span>
            </div>
            <div className="bg-[#F2F2F2] p-2 rounded-[4px]">
              <span className="text-[9px] text-[#7E7E7E] block">이번 달 완식</span>
              <span className="text-[13px] font-black text-[#E60000]">6그릇</span>
            </div>
          </div>
        </div>

        {/* 최근 테이스팅 일기 */}
        <div className="bg-white rounded-[6px] border border-[#E2E2E2] p-4">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E2E2E2]">
            <span className="text-[12px] font-black tracking-wider text-[#25282B]">
              최근 라멘 감정 다이어리
            </span>
            <span className="text-[11px] font-bold text-[#7E7E7E]">최근 기록</span>
          </div>

          <div className="divide-y divide-[#E2E2E2]">
            {logs.map((log, i) => (
              <div key={i} className="py-3 flex items-center gap-3">
                <div className="w-12 h-12 rounded-[6px] overflow-hidden bg-[#F2F2F2] flex-shrink-0 border border-[#E2E2E2]">
                  <img src={log.photo} alt={log.menu} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[13px] font-black text-[#25282B] truncate">{log.shop} · {log.loc}</p>
                    {log.isNew && <span className="text-[9px] font-bold text-[#E60000] bg-[#E60000]/10 px-1.5 py-0.5 rounded-[32px]">신규</span>}
                  </div>
                  <p className="text-[11px] text-[#7E7E7E] mt-0.5 truncate">{log.menu}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-[11px] font-bold text-[#7E7E7E] block">{log.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 가고 싶어요 매장 */}
        <div className="bg-white rounded-[6px] border border-[#E2E2E2] p-4">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E2E2E2]">
            <span className="text-[12px] font-black tracking-wider text-[#25282B]">
              가고 싶어요 저장 매장 ({SAVED_SHOPS.length})
            </span>
            <span className="text-[11px] font-bold text-[#E60000]">전체 보기 →</span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {SAVED_SHOPS.map((s, i) => (
              <div key={i} className="group cursor-pointer">
                <div className="aspect-square rounded-[6px] overflow-hidden bg-[#F2F2F2] mb-1.5 border border-[#E2E2E2] group-hover:border-[#25282B] transition-colors">
                  <img src={s.photo} alt={s.name} className="w-full h-full object-cover" />
                </div>
                <p className="text-[12px] font-black text-[#25282B] truncate">{s.name}</p>
                <p className="text-[10px] text-[#7E7E7E] truncate">{s.loc} · {s.style}</p>
              </div>
            ))}
          </div>
        </div>

      </main>

      <div className="h-10" />

      {/* ========================================== */}
      {/* 📱 모바일 최적화 라멘 활동 등급 안내 바텀 시트 */}
      {/* ========================================== */}
      {isGradeGuideOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" role="presentation">
          {/* 딤 배경 */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs anim-fade-in"
            onClick={() => setIsGradeGuideOpen(false)}
            aria-label="등급 안내 모달 닫기"
            role="button"
            tabIndex={0}
          />

          {/* 모바일 바텀 시트 컨테이너 */}
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="ramen-grade-guide-title"
            className="relative w-full max-w-[480px] mx-auto bg-white rounded-t-[20px] shadow-2xl border-t border-stone-200 anim-slide-up z-10 flex flex-col max-h-[85vh] text-[#25282B]"
          >
            {/* 상단 터치 핸들 바 */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-stone-300" />
            </div>

            {/* 헤더 */}
            <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3.5">
              <div>
                <p className="text-[10px] font-black text-[#E60000] tracking-wider uppercase">등급 안내</p>
                <h3 id="ramen-grade-guide-title" className="text-[17px] font-black text-[#25282B]">
                  라멘 활동 등급
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsGradeGuideOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 border border-stone-200 text-stone-500 hover:text-[#E60000] transition-colors active:scale-95"
                aria-label="등급 안내 닫기"
              >
                ✕
              </button>
            </div>

            {/* 스크롤 가능한 본문 영역 */}
            <div className="p-5 overflow-y-auto no-scrollbar space-y-4">
              <div className="p-3 bg-stone-50 rounded-[6px] border border-stone-200 text-[11px] text-stone-600 leading-relaxed">
                💡 <strong>공개 라멘로그 개수</strong>를 기준으로 활동 등급이 자동으로 승급됩니다. 매장을 정복하고 기록을 남겨 최고 등급에 도전해보세요!
              </div>

              {/* 등급 리스트 */}
              <div className="rounded-[8px] border border-stone-200 overflow-hidden divide-y divide-stone-100">
                {RAMEN_ACTIVITY_LEVELS.map((level, index) => {
                  const isCurrent = level.title === ramenActivityLevel.title
                  return (
                    <div
                      key={level.title}
                      className={`flex items-center justify-between gap-3 px-4 py-3 transition-colors ${
                        isCurrent ? 'bg-red-50/90' : 'bg-white hover:bg-stone-50'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`text-[13px] font-black ${isCurrent ? 'text-[#E60000]' : 'text-[#25282B]'}`}>
                            {level.title}
                          </p>
                          {isCurrent && (
                            <span className="text-[9px] font-black bg-[#E60000] text-white px-1.5 py-0.2 rounded-sm">
                              내 등급
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] font-medium text-stone-400">
                          {level.desc}
                        </p>
                      </div>

                      <span className={`shrink-0 text-[11px] font-black ${isCurrent ? 'text-[#E60000]' : 'text-stone-300'}`}>
                        {isCurrent ? '현재' : `Lv.${index + 1}`}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 하단 닫기/확인 버튼 (홈바 여백 고려) */}
            <div className="p-4 pt-2 pb-6 border-t border-stone-100 bg-white">
              <button
                type="button"
                onClick={() => setIsGradeGuideOpen(false)}
                className="w-full h-11 rounded-[8px] bg-[#25282B] hover:bg-[#1A1C1E] active:scale-98 text-white font-bold text-[13px] transition-all shadow-sm"
              >
                확인
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
