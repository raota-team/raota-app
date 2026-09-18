import { useEffect, useRef, type CSSProperties } from 'react'
import { ArrowRight, Check, ChevronLeft } from 'lucide-react'
import useLoadingSequence from '../hooks/useLoadingSequence'

const MESSAGES = ['선택한 취향을 확인하고 있어요', '어울리는 라멘집을 찾고 있어요', '오늘의 추천을 정리하고 있어요', '오늘의 한 그릇을 골랐어요']

interface Props {
  /** 실제로 결과에 반영된 조건 라벨. 참고만 한 조건은 넣지 않는다. */
  conditions: string[]
  onBack: () => void
  onComplete: () => void
}

export default function AICurationLoading({ conditions, onBack, onComplete }: Props) {
  const duration = 3300
  const { stage, complete, reducedMotion } = useLoadingSequence(duration, onComplete)
  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => titleRef.current?.focus({ preventScroll: true }), [])

  return (
    <section className="h-full min-h-0 overflow-y-auto bg-white text-ink flex flex-col" aria-label="AI 라멘 추천 준비">
      <header className="flex shrink-0 items-center justify-between px-4 py-2">
        <button type="button" onClick={onBack} aria-label="추천 조건으로 돌아가기" className="taste-loading-action flex h-11 w-11 items-center justify-center rounded-full hover:bg-canvas-soft"><ChevronLeft size={22} aria-hidden="true" /></button>
        <span className="text-[15px] font-bold">AI 라멘 추천</span>
        <span className="w-11" aria-hidden="true" />
      </header>

      <div className="flex flex-1 flex-col justify-center px-6 py-4 text-center">
        <h1 ref={titleRef} tabIndex={-1} className="text-2xl font-bold leading-[1.4] tracking-tight outline-none">오늘의 한 그릇을<br />찾고 있어요</h1>
        <p className="mx-auto mt-3 max-w-[280px] text-sm leading-6 text-ink-sub break-keep">
          {conditions.length > 0 ? conditions.join(' · ') : '전체 라멘집에서 골라요'}
        </p>

        <div className="ai-curation-visual relative mx-auto my-6 flex aspect-square w-full max-w-[280px] items-center justify-center" aria-hidden="true" data-complete={complete} data-reduced-motion={reducedMotion} style={{ '--curation-duration': `${duration}ms` } as CSSProperties}>
          <svg viewBox="0 0 280 280" className="absolute inset-0 h-full w-full">
            <circle cx="140" cy="140" r="87" fill="none" stroke="var(--color-line)" strokeWidth="1" />
            <g className="ai-curation-orbit">
              <circle className="ai-curation-arc" cx="140" cy="140" r="87" fill="none" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" transform="rotate(-90 140 140)" />
              {!complete && <circle cx="140" cy="53" r="3" fill="var(--color-brand)" />}
            </g>
          </svg>
          <div className="ai-curation-core relative flex h-32 w-32 items-center justify-center rounded-full bg-brand-light">
            <img src="/logo.png" alt="" width={112} height={112} className="ai-curation-logo h-28 w-28 object-contain" />
            {complete && <span className="ai-curation-check absolute bottom-1 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-brand text-white"><Check size={18} strokeWidth={2} /></span>}
          </div>
        </div>

        <p role="status" aria-live="polite" aria-atomic="true" className="min-h-6 text-sm font-medium leading-6 text-ink-sub">
          <span key={stage} className="taste-loading-status flex items-center justify-center gap-2">
            <span className="h-1 w-1 shrink-0 rounded-full bg-brand" aria-hidden="true" />
            {MESSAGES[stage]}
          </span>
        </p>
      </div>

      <footer className="shrink-0 px-6 pb-6 pt-2">
        <button type="button" onClick={onComplete} className="taste-loading-action mx-auto flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium text-ink-sub hover:bg-canvas-soft active:bg-canvas-soft">추천 바로 보기 <ArrowRight size={16} aria-hidden="true" /></button>
      </footer>
    </section>
  )
}
