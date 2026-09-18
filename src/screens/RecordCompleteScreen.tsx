import { useEffect, useState } from 'react'
import { Check, ImageOff } from 'lucide-react'
import type { RamenLog, TasteProfile } from '../types'
import { TASTE_AXES, profileDelta, scoresFromLog } from '../utils/taste'

interface Props {
  recordCount: number
  /** 이번 기록 직전의 5축 누적 평균 */
  profileBefore?: TasteProfile
  /** 이번 기록을 반영한 5축 누적 평균 */
  profileAfter?: TasteProfile
  lastLog?: RamenLog | null
  onViewTaste: () => void
  onHome: () => void
}

/** 'YYYY-MM-DD' → '2026.09.18'. 형식이 다르면 그대로 보여준다. */
const formatDate = (iso: string) => {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[1]}.${match[2]}.${match[3]}` : iso
}

/** 방문일과 누적 그릇 수로 티켓 번호를 만든다. 예: 2026-0918-43 */
const ticketNumber = (iso: string, count: number) => {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[1]}-${match[2]}${match[3]}-${count}` : `${count}`
}

const formatDelta = (delta: number) => (delta > 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2))

export default function RecordCompleteScreen({
  recordCount,
  profileBefore,
  profileAfter,
  lastLog,
  onViewTaste,
  onHome,
}: Props) {
  const [counted, setCounted] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setCounted(true), 250)
    return () => clearTimeout(timer)
  }, [])

  const scores = lastLog ? scoresFromLog(lastLog) : null
  const canShowDelta = Boolean(scores && profileBefore && profileAfter)
  const delta = canShowDelta ? profileDelta(profileBefore!, profileAfter!) : null
  const isFirstBowl = (profileBefore?.count ?? 0) === 0
  const nothingMoved = Boolean(delta && !isFirstBowl && TASTE_AXES.every(axis => delta[axis.key] === 0))

  // 이번 그릇에서 가장 높은 축(재방문 제외). 동점이면 앞 순서를 고른다.
  const topAxis = scores
    ? TASTE_AXES.filter(axis => axis.key !== 'revisit').reduce((best, axis) => (scores[axis.key] > scores[best.key] ? axis : best))
    : null

  const comment = (() => {
    if (!lastLog) return null
    const bowl = `${lastLog.shop.name}의 ${lastLog.ramenType} 한 그릇`
    if (!scores || !topAxis) return `${bowl}이 ${recordCount}번째 기록으로 남았어요.`
    return `${bowl}. 이번 그릇은 ${topAxis.label} ${scores[topAxis.key]}점이 가장 높았고, 재방문 의사는 ‘${lastLog.revisit}’으로 남겼어요.`
  })()

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white text-[#25282B]">
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        {/* 상단 인장 배너 */}
        <header className="bg-[#25282B] text-white px-5 pt-6 pb-7 flex flex-col items-center text-center">
          <div className="anim-stamp w-14 h-14 rounded-full border-2 border-[#E60000] flex items-center justify-center mb-3">
            <Check className="w-7 h-7 text-[#E60000]" strokeWidth={3} aria-hidden="true" />
          </div>
          <p className="text-[13px] font-bold text-white/70">기록이 저장됐어요</p>
          <div className="flex items-baseline justify-center gap-2 mt-1" aria-label={`${recordCount}번째 그릇`}>
            <span className="text-[56px] leading-none font-extrabold tracking-[-2px] tabular-nums">
              {counted ? recordCount : Math.max(recordCount - 1, 0)}
            </span>
            <span className="text-[17px] font-bold text-white/70">번째 그릇</span>
          </div>
        </header>

        <div className="px-4 pt-4 pb-6 space-y-4">
          {/* 티켓 */}
          {lastLog ? (
            <section aria-label="기록 티켓" className="anim-fade-in-up rounded-[6px] border border-[#E2E2E2] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-dashed border-[#E2E2E2] text-[12px] font-bold">
                <span className="text-[#6B6E73]">티켓 {ticketNumber(lastLog.visitedAt, recordCount)}</span>
                <span className="text-[#E60000]">{lastLog.isPublic ? '공개 기록' : '나만 보기'}</span>
              </div>
              <div className="flex items-center gap-3.5 p-4">
                <div className="w-16 h-16 rounded-[6px] overflow-hidden bg-[#F2F2F2] shrink-0 border border-[#E2E2E2] flex items-center justify-center text-[#6B6E73]">
                  {lastLog.imageUrl ? (
                    <img src={lastLog.imageUrl} alt={lastLog.menuName} className="w-full h-full object-cover" />
                  ) : (
                    <ImageOff className="w-5 h-5" aria-label="사진 없음" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[12px] font-bold text-[#E60000] bg-[#E60000]/10 px-2 py-0.5 rounded-[32px]">{lastLog.ramenType}</span>
                    <span className="text-[12px] font-bold text-[#25282B] bg-[#F2F2F2] px-2 py-0.5 rounded-[32px]">{lastLog.revisit}</span>
                  </div>
                  <p className="text-[15px] font-bold truncate mt-1">{lastLog.menuName}</p>
                  <p className="text-[13px] text-[#6B6E73] truncate">
                    {[lastLog.shop.name, lastLog.shop.branch].filter(Boolean).join(' · ')} · {formatDate(lastLog.visitedAt)}
                  </p>
                </div>
              </div>
            </section>
          ) : (
            <p className="text-[14px] text-[#6B6E73]">이번 기록 정보를 불러오지 못했어요.</p>
          )}

          {/* 취향 여권 변화 */}
          {delta && scores && profileBefore && profileAfter && (
            <section aria-labelledby="delta-title" className="anim-fade-in-up">
              <div className="flex items-baseline justify-between pb-2 mb-1 border-b border-[#E2E2E2]">
                <h2 id="delta-title" className="text-[17px] font-extrabold tracking-tight">취향 여권 변화</h2>
                <span className="text-[12px] font-bold text-[#6B6E73]">
                  {isFirstBowl ? '첫 그릇' : `${profileBefore.count}그릇 → ${profileAfter.count}그릇 평균`}
                </span>
              </div>
              <ul className="divide-y divide-[#F2F2F2]">
                {TASTE_AXES.map(axis => {
                  const change = delta[axis.key]
                  const before = (profileBefore.exact ?? profileBefore.scores)[axis.key]
                  const after = (profileAfter.exact ?? profileAfter.scores)[axis.key]
                  return (
                    <li key={axis.key} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <span className="block text-[14px] font-bold">{axis.label}</span>
                        <span className="block text-[12px] text-[#6B6E73]">이번 그릇 {scores[axis.key]}점</span>
                      </div>
                      <div className="text-right shrink-0 tabular-nums">
                        {isFirstBowl ? (
                          <span className="text-[14px] font-bold">{after.toFixed(1)}</span>
                        ) : (
                          <span className="text-[14px] font-bold">
                            <span className="text-[#6B6E73] font-medium">{before.toFixed(2)}</span>
                            <span className="text-[#6B6E73] font-medium mx-1">→</span>
                            {after.toFixed(2)}
                          </span>
                        )}
                        <span className={`block text-[12px] font-bold ${change === 0 ? 'text-[#6B6E73]' : 'text-[#E60000]'}`}>
                          {isFirstBowl ? '첫 기록' : change === 0 ? '변화 없음' : formatDelta(change)}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
              {nothingMoved && (
                <p className="text-[12px] text-[#6B6E73] pt-2">
                  평소 평균과 같은 점수를 줘서 {profileBefore.count}그릇 평균이 그대로예요.
                </p>
              )}
            </section>
          )}

          {/* 이번 그릇 한 줄 */}
          {comment && (
            <section aria-label="이번 그릇 정리" className="anim-fade-in-up bg-[#F2F2F2] rounded-[6px] px-4 py-3.5">
              <p className="text-[14px] leading-relaxed">{comment}</p>
            </section>
          )}
        </div>
      </div>

      {/* 하단 고정 CTA */}
      <footer className="shrink-0 px-4 pt-3 pb-3 bg-white border-t border-[#E2E2E2] space-y-2">
        <button
          type="button"
          onClick={onViewTaste}
          className="w-full h-13 rounded-[60px] bg-[#E60000] text-white text-[15px] font-bold active:bg-[#CC0000] transition-colors"
        >
          내 취향 여권 보기
        </button>
        <button
          type="button"
          onClick={onHome}
          className="w-full min-h-11 rounded-[60px] border border-[#E2E2E2] text-[14px] font-bold text-[#25282B] bg-white active:bg-[#F2F2F2] transition-colors"
        >
          홈으로
        </button>
      </footer>
    </div>
  )
}
