import { useEffect, useState } from 'react'
import type { RamenLog } from '../types'

interface Props {
  recordCount: number
  lastLog?: RamenLog | null
  onViewTaste: () => void
  onHome: () => void
}

const CHANGES = [
  { label: '국물 농도', delta: '+1.2', pct: '85%' },
  { label: '면 익힘 정도', delta: '+0.8', pct: '78%' },
  { label: '타레 감칠맛', delta: '+0.3', pct: '65%' },
]

export default function RecordCompleteScreen({ recordCount, lastLog, onViewTaste, onHome }: Props) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 100),
      setTimeout(() => setStep(2), 450),
      setTimeout(() => setStep(3), 850),
      setTimeout(() => setStep(4), 1250),
      setTimeout(() => setStep(5), 1600),
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  const shopName = lastLog?.shop.name || '멘야준'
  const branchName = lastLog?.shop.branch || '망원 본점'
  const menuName = lastLog?.menuName || '특제 쇼유 라멘'
  const ramenType = lastLog?.ramenType || '쇼유'
  const photo = lastLog?.imageUrl || 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=200&h=200&fit=crop&auto=format&q=80'
  const date = lastLog?.visitedAt || '2026. 09. 01'
  const revisit = lastLog?.revisit || '자주 감'

  return (
    <div className="h-full overflow-y-auto no-scrollbar bg-[#FFFFFF] flex flex-col justify-between text-[#25282B]">
      
      {/* 1. 상단 축하 배너 (보더폰 딥 잉크 히어로) */}
      <header className="flex-shrink-0 bg-[#25282B] text-white pt-5 pb-7 px-5 flex flex-col items-center text-center border-b border-[#1A1C1E]">
        {step >= 1 && (
          <div className="anim-fade-in-up flex flex-col items-center">
            <div className="w-12 h-12 rounded-[6px] bg-white p-1.5 border border-white/20 flex items-center justify-center mb-2.5">
              <img src="/logo.png" alt="RAOTA Logo" className="w-full h-full object-contain" />
            </div>
            
            <span className="text-[10px] font-bold text-[#E60000] tracking-wider block mb-0.5">
              라멘로그 아카이빙 완료
            </span>
            
            <div className="flex items-baseline justify-center gap-3 my-1">
              <span className="text-[20px] text-white/30 line-through">{recordCount - 1}</span>
              <span className="text-[16px] text-[#E60000]">→</span>
              <span className="text-[56px] text-white leading-none font-black tracking-[-2px]">
                {recordCount}
              </span>
              <span className="text-[14px] text-white/60">번째 그릇</span>
            </div>

            <p className="text-[13px] font-bold text-white/90">
              라멘 감정 데이터가 성공적으로 아카이빙되었습니다.
            </p>
          </div>
        )}
      </header>

      {/* 2. 본문 내용 */}
      <div className="flex-1 p-4 space-y-3.5">
        
        {/* 발권 티켓 카드 (보더폰 6px 카드) */}
        {step >= 2 && (
          <div className="anim-fade-in-up bg-white rounded-[6px] border border-[#E2E2E2] p-4">
            <div className="flex justify-between items-center pb-2 mb-2 border-b border-dashed border-[#E2E2E2] text-[10px] font-bold text-[#7E7E7E]">
              <span>기록 티켓 번호 2026-0901-{recordCount}</span>
              <span className="text-[#E60000]">라멘로그 기록 완료 ✓</span>
            </div>

            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-[6px] overflow-hidden bg-[#F2F2F2] flex-shrink-0 border border-[#E2E2E2]">
                <img
                  src={photo}
                  alt={menuName}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-[#E60000] bg-[#E60000]/10 px-2 py-0.5 rounded-[32px]">{ramenType}</span>
                  <span className="text-[10px] font-bold text-[#25282B] bg-[#F2F2F2] px-2 py-0.5 rounded-[32px]">{revisit}</span>
                </div>
                <p className="text-[15px] font-black text-[#25282B] truncate mt-0.5">{menuName}</p>
                <p className="text-[11px] text-[#7E7E7E]">{shopName} · {branchName} ({date})</p>
              </div>
            </div>
          </div>
        )}

        {/* 취향 변화 지표 */}
        {step >= 3 && (
          <div className="anim-fade-in-up bg-white rounded-[6px] border border-[#E2E2E2] p-4">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E2E2E2]">
              <h2 className="text-[13px] font-black tracking-tight text-[#25282B]">
                취향 벡터 정밀 갱신
              </h2>
              <span className="text-[10px] text-[#E60000] font-bold">갱신 완료</span>
            </div>

            <div className="space-y-2.5">
              {CHANGES.map((c, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[12px] font-bold text-[#25282B] w-28 flex-shrink-0">{c.label}</span>
                  <div className="flex-1 h-2 bg-[#F2F2F2] rounded-[32px] overflow-hidden">
                    <div className="h-full bg-[#25282B] rounded-[32px]" style={{ width: c.pct }}/>
                  </div>
                  <span className="text-[11px] font-bold text-[#E60000] w-10 text-right">{c.delta}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 큐레이터 코멘트 */}
        {step >= 4 && (
          <div className="anim-fade-in-up bg-[#F2F2F2] rounded-[6px] p-4">
            <span className="text-[10px] text-[#7E7E7E] font-bold tracking-wider block mb-1">
              큐레이터 분석 코멘트
            </span>
            <p className="text-[13px] text-[#25282B] leading-relaxed">
              "진한 동물계 육수와 단단한 면발에 대한 취향 성향이 더욱 뚜렷해졌습니다. 다음 라멘 탐험으로는 맑은 청탕 계열 시오 라멘을 맛보시는 것을 추천합니다."
            </p>
          </div>
        )}
      </div>

      {/* 3. 하단 액션 버튼 (보더폰 60px 필 버튼) */}
      {step >= 5 && (
        <footer className="anim-fade-in-up p-4 bg-white border-t border-[#E2E2E2] space-y-2">
          <button
            onClick={onViewTaste}
            className="w-full h-13 rounded-[60px] bg-[#E60000] text-white text-[15px] font-bold tracking-wide active:scale-98 hover:bg-[#CC0000] transition-all flex items-center justify-center gap-2"
          >
            라멘 취향 리포트 확인하기 →
          </button>
          <button
            onClick={onHome}
            className="w-full h-11 rounded-[60px] border border-[#E2E2E2] hover:border-[#BEBEBE] text-[13px] font-bold text-[#25282B] bg-white hover:bg-[#F9F9F9] transition-all shadow-2xs"
          >
            홈으로 돌아가기
          </button>
        </footer>
      )}
    </div>
  )
}
