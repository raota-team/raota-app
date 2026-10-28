import { t, ph } from "@lingui/core/macro";
import { t as legacyT } from "@raota/shared"
import type { RamenLog, TasteProfile } from '../types'
import { REVISIT_OPTIONS } from '../types'
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

/** 화면 전환이 끝난 뒤 위 칸부터 차례로 동그라미를 긋는다 */
const PEN_DELAY_MS = 350
const PEN_GAP_MS = 260
const SCALE_AXES = TASTE_AXES.filter(axis => axis.key !== 'revisit')
/** 낮은 쪽부터 왼쪽에 둔다. 1~5 칸과 같은 방향이다 */
const REVISIT_ROW = [...REVISIT_OPTIONS].reverse()

const formatDelta = (delta: number) => (delta > 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2))

/** 고른 칸을 펜으로 두른 동그라미. 칸보다 조금 넘치게 감싼다 */
function PenCircle({ order }: { order: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 60"
      preserveAspectRatio="none"
      className="absolute -left-1 -top-1.5 w-[calc(100%+8px)] h-[calc(100%+12px)] pointer-events-none overflow-visible"
    >
      <path
        d="M 78 9 C 60 1, 18 4, 8 24 C 0 42, 30 58, 58 56 C 88 54, 99 34, 88 17 C 82 9, 72 6, 60 7"
        fill="none"
        stroke="#E60000"
        strokeWidth="4.5"
        strokeLinecap="round"
        pathLength={1}
        className="pen-circle"
        style={{ animationDelay: `${PEN_DELAY_MS + order * PEN_GAP_MS}ms` }}
      />
    </svg>
  )
}

/*
 * 저장한 기록을 "취향 기록지"로 보여 준다(사용자 결정 2026.10.26, 이치란 주문 용지에서 따온 안).
 * 다섯 평가의 1~5 칸에 고른 점수를 빨간 펜으로 동그라미 친다. 도장·티켓 대신 종이 양식 하나만 둔다.
 */
export default function RecordCompleteScreen({
  recordCount,
  profileBefore,
  profileAfter,
  lastLog,
  onViewTaste,
  onHome,
}: Props) {
  const scores = lastLog ? scoresFromLog(lastLog) : null
  const canShowDelta = Boolean(scores && profileBefore && profileAfter)
  const delta = canShowDelta ? profileDelta(profileBefore!, profileAfter!) : null
  const isFirstBowl = (profileBefore?.count ?? 0) === 0
  const nothingMoved = Boolean(delta && !isFirstBowl && TASTE_AXES.every(axis => delta[axis.key] === 0))

  // 이번 그릇에서 가장 높은 축(재방문 제외). 동점이면 앞 순서를 고른다.
  const topAxis = scores ? SCALE_AXES.reduce((best, axis) => (scores[axis.key] > scores[best.key] ? axis : best)) : null

  const comment = (() => {
    if (!lastLog) return null
    const bowl = t`${ph({ shop: lastLog.shop.name })}의 ${ph({ style: legacyT(lastLog.ramenType) })} 한 그릇`
    if (!scores || !topAxis) return t`${bowl}이 ${ph({ count: recordCount })}번째 기록으로 남았어요.`
    return t`${bowl}. 이번 그릇은 ${ph({ axis: legacyT(topAxis.label) })} ${ph({ score: scores[topAxis.key] })}점이 가장 높았고, 재방문 의사는 ‘${ph({ revisit: legacyT(lastLog.revisit) })}’으로 남겼어요.`
  })()

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white text-[#25282B]">
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        <header className="px-5 pt-7 pb-5">
          <p className="text-[13px] font-bold text-[#6B6E73]">{t`기록이 저장됐어요`}</p>
          <p className="mt-1 flex items-baseline gap-1.5" aria-label={t`${ph({ v0: recordCount })}번째 그릇`}>
            <span className="text-[48px] leading-none font-extrabold tracking-[-2px] tabular-nums">{recordCount}</span>
            <span className="text-[17px] font-bold">{t`번째 그릇`}</span>
          </p>
        </header>

        <div className="px-4 pb-6 space-y-6">
          {lastLog ? (
            <section aria-label={t`취향 기록지`} className="anim-fade-in-up border-[1.5px] border-[#25282B] rounded-[3px] bg-[#FFFDF8]">
              <div className="flex items-center justify-between px-3.5 py-2.5 border-b-[1.5px] border-[#25282B]">
                <span className="text-[15px] font-extrabold tracking-tight">{t`취향 기록지`}</span>
                <span className="text-[12px] font-bold tabular-nums text-[#6B6E73]">No.{String(recordCount).padStart(4, '0')}</span>
              </div>
              <div className="flex items-center gap-3 px-3.5 py-2.5 border-b border-[#25282B]/25">
                <dl className="flex-1 min-w-0 grid grid-cols-[44px_1fr] gap-y-1 text-[13px]">
                  <dt className="text-[#6B6E73] font-bold">{t`가게`}</dt>
                  <dd className="font-bold truncate">{[lastLog.shop.name, lastLog.shop.branch].filter(Boolean).join(' ')}</dd>
                  <dt className="text-[#6B6E73] font-bold">{t`메뉴`}</dt>
                  <dd className="font-bold truncate">{`${lastLog.menuName} (${legacyT(lastLog.ramenType)})`}</dd>
                  <dt className="text-[#6B6E73] font-bold">{t`날짜`}</dt>
                  <dd className="font-bold tabular-nums">{lastLog.visitedAt.replace(/^(\d{4})\D+(\d{2})\D+(\d{2}).*$/, '$1.$2.$3')}</dd>
                </dl>
                {lastLog.imageUrl && (
                  <img src={lastLog.imageUrl} alt={lastLog.menuName} className="w-16 h-16 rounded-[4px] object-cover shrink-0" />
                )}
              </div>

              <ul>
                {scores &&
                  SCALE_AXES.map((axis, index) => (
                    <li key={axis.key} aria-label={t`${ph({ v0: legacyT(axis.label) })} ${ph({ v1: scores[axis.key] })}점`} className="px-3.5 pt-3 pb-2.5 border-b border-[#25282B]/10">
                      <span className="text-[14px] font-bold" aria-hidden="true">{legacyT(axis.label)}</span>
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[#6B6E73]" aria-hidden="true">
                        <span className="w-14 shrink-0">{legacyT(axis.low)}</span>
                        <div className="flex-1 grid grid-cols-5">
                          {[1, 2, 3, 4, 5].map(value => (
                            <span key={value} className="relative h-7 flex items-center justify-center text-[15px] font-bold text-[#25282B] tabular-nums">
                              {value}
                              {scores[axis.key] === value && <PenCircle order={index} />}
                            </span>
                          ))}
                        </div>
                        <span className="w-14 shrink-0 text-right">{legacyT(axis.high)}</span>
                      </div>
                    </li>
                  ))}
                <li aria-label={t`재방문 의사 ${ph({ v0: legacyT(lastLog.revisit) })}`} className="px-3.5 pt-3 pb-3">
                  <span className="text-[14px] font-bold" aria-hidden="true">{t`재방문 의사`}</span>
                  <div className="mt-2 grid grid-cols-3 gap-2" aria-hidden="true">
                    {REVISIT_ROW.map(option => (
                      <span key={option} className="relative h-8 flex items-center justify-center text-[13px] font-bold">
                        {legacyT(option)}
                        {lastLog.revisit === option && <PenCircle order={scores ? SCALE_AXES.length : 0} />}
                      </span>
                    ))}
                  </div>
                </li>
              </ul>
            </section>
          ) : (
            <p className="text-[14px] text-[#6B6E73]">{t`이번 기록 정보를 불러오지 못했어요.`}</p>
          )}

          {/* 취향 여권 변화 */}
          {delta && scores && profileBefore && profileAfter && (
            <section aria-labelledby="delta-title" className="anim-fade-in-up">
              <div className="flex items-baseline justify-between pb-2 mb-1 border-b border-[#E2E2E2]">
                <h2 id="delta-title" className="text-[17px] font-extrabold tracking-tight">{t`취향 여권 변화`}</h2>
                <span className="text-[12px] font-bold text-[#6B6E73]">
                  {isFirstBowl ? t`첫 그릇` : t`${ph({ v0: profileBefore.count })}그릇 → ${ph({ v1: profileAfter.count })}그릇 평균`}
                </span>
              </div>
              <ul className="divide-y divide-[#F2F2F2]">
                {TASTE_AXES.map(axis => {
                  const change = delta[axis.key]
                  const before = (profileBefore.exact ?? profileBefore.scores)[axis.key]
                  const after = (profileAfter.exact ?? profileAfter.scores)[axis.key]
                  return (
                    <li key={axis.key} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="text-[14px] font-bold">{legacyT(axis.label)}</span>
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
                          {isFirstBowl ? t`첫 기록` : change === 0 ? t`변화 없음` : formatDelta(change)}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
              {nothingMoved && (
                <p className="text-[12px] text-[#6B6E73] pt-2">
                  {t`평소 평균과 같은 점수를 줘서`} {profileBefore.count}{t`그릇 평균이 그대로예요.`}</p>
              )}
            </section>
          )}

          {comment && (
            <section aria-label={t`이번 그릇 정리`} className="anim-fade-in-up bg-[#F2F2F2] rounded-[6px] px-4 py-3.5">
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
          {t`내 취향 여권 보기`}</button>
        <button
          type="button"
          onClick={onHome}
          className="w-full min-h-11 rounded-[60px] border border-[#E2E2E2] text-[14px] font-bold text-[#25282B] bg-white active:bg-[#F2F2F2] transition-colors"
        >
          {t`홈으로`}</button>
      </footer>
    </div>
  )
}
