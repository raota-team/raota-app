import { useEffect, useRef } from 'react'
import useLoadingSequence from '../hooks/useLoadingSequence'
import { ArrowRight, Check, ChevronLeft } from 'lucide-react'

interface Props {
  recordCount: number
  metrics: { label: string; myVal: number }[]
  duration: number
  onBack: () => void
  onComplete: () => void
}

function point(index: number, value: number) {
  const angle = (Math.PI * 2 * index) / 5 - Math.PI / 2
  return { x: 160 + 92 * value * Math.cos(angle), y: 150 + 92 * value * Math.sin(angle) }
}

const REVEAL_FRAMES = [
  [0.28, 0.28, 0.28, 0.28, 0.28],
  [0.82, 0.48, 0.7, 0.54, 0.76],
  [0.9, 1.02, 0.82, 0.98, 0.88],
  [1, 1, 1, 1, 1],
]

const STATUS_MESSAGES = [
  '라멘 기록을 모으고 있어요',
  '국물과 면 취향을 살펴보고 있어요',
  '나의 누적 취향을 정리하고 있어요',
  '나의 라멘 취향이 정리됐어요',
]

export default function TasteReportLoading({ recordCount, metrics, duration, onBack, onComplete }: Props) {
  const { stage, complete, reducedMotion } = useLoadingSequence(duration, onComplete)
  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => titleRef.current?.focus({ preventScroll: true }), [])

  const frames = REVEAL_FRAMES.map(factors => metrics.map((metric, index) => point(index, metric.myVal * factors[index])))
  const motion = {
    dur: `${duration}ms`,
    keyTimes: '0;0.36;0.72;1',
    calcMode: 'spline' as const,
    keySplines: '0.22 0.61 0.36 1;0.22 0.61 0.36 1;0.16 1 0.3 1',
    fill: 'freeze' as const,
  }
  const polygon = metrics.map((metric, index) => {
    const p = point(index, metric.myVal)
    return `${p.x},${p.y}`
  }).join(' ')
  const labels = [
    { x: 160, y: 28, anchor: 'middle' },
    { x: 264, y: 112, anchor: 'middle' },
    { x: 232, y: 259, anchor: 'middle' },
    { x: 88, y: 259, anchor: 'middle' },
    { x: 56, y: 112, anchor: 'middle' },
  ] as const

  return (
    <section className="taste-report-loading h-full min-h-0 overflow-y-auto bg-white text-ink flex flex-col" aria-label="누적 취향 분석 중">
      <header className="flex shrink-0 items-center justify-between px-4 py-2">
        <button type="button" onClick={onBack} aria-label="뒤로가기" className="taste-loading-action h-11 w-11 flex items-center justify-center rounded-full hover:bg-canvas-soft">
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
        <span className="text-sm font-black">종합 취향 리포트</span>
        <span className="w-11" aria-hidden="true" />
      </header>

      <div className="flex flex-1 flex-col justify-center px-6 py-4 text-center">
        <h1 ref={titleRef} tabIndex={-1} className="text-[24px] leading-[1.4] font-bold tracking-tight outline-none">
          나의 라멘 취향을<br />정리하고 있어요
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink-sub">
          기록한 {recordCount}그릇을 바탕으로 분석해요
        </p>

        <svg viewBox="0 0 320 286" className="taste-loading-radar mx-auto my-6 w-full max-w-[320px] shrink-0" aria-hidden="true">
          {[0.33, 0.66, 1].map(level => (
            <polygon key={level} points={metrics.map((_, index) => { const p = point(index, level); return `${p.x},${p.y}` }).join(' ')} fill={level === 0.33 ? 'var(--color-brand-light)' : 'none'} stroke="var(--color-line)" strokeWidth="1" />
          ))}
          {metrics.map((_, index) => {
            const p = point(index, 1)
            return <line key={index} x1="160" y1="150" x2={p.x} y2={p.y} stroke="var(--color-line)" strokeWidth="1" />
          })}
          <g className="taste-loading-shape" data-complete={complete}>
            <polygon points={polygon} fill="var(--color-brand)" fillOpacity="0.1" stroke="var(--color-brand)" strokeWidth="2" strokeLinejoin="round">
              {!reducedMotion && <animate attributeName="points" values={frames.map(frame => frame.map(p => `${p.x},${p.y}`).join(' ')).join(';')} {...motion} />}
            </polygon>
            {metrics.map((metric, index) => {
              const p = point(index, metric.myVal)
              return (
                <circle key={index} cx={p.x} cy={p.y} r="3" fill="var(--color-brand)">
                  {!reducedMotion && <>
                    <animate attributeName="cx" values={frames.map(frame => frame[index].x).join(';')} {...motion} />
                    <animate attributeName="cy" values={frames.map(frame => frame[index].y).join(';')} {...motion} />
                  </>}
                </circle>
              )
            })}
          </g>
          {metrics.map((metric, index) => {
            const active = !complete && index === [0, 1, 3][stage]
            return <text key={metric.label} x={labels[index].x} y={labels[index].y} textAnchor={labels[index].anchor} className="taste-loading-axis" fill={active ? 'var(--color-brand)' : 'var(--color-ink-sub)'} fontSize="12" fontWeight={active ? '600' : '500'}>{metric.label}</text>
          })}
        </svg>

        <p role="status" aria-live="polite" aria-atomic="true" className="min-h-6 text-sm leading-6 font-medium text-ink-sub">
          <span key={stage} className="taste-loading-status flex items-center justify-center gap-2">
            {complete ? <Check size={16} className="text-brand shrink-0" aria-hidden="true" /> : <span className="h-1 w-1 shrink-0 rounded-full bg-brand" aria-hidden="true" />}
            {STATUS_MESSAGES[stage]}
          </span>
        </p>
      </div>

      <footer className="shrink-0 px-6 pb-6 pt-2">
        <button type="button" onClick={onComplete} className="taste-loading-action mx-auto flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium text-ink-sub hover:bg-canvas-soft active:bg-canvas-soft">
          결과 바로 보기 <ArrowRight size={16} aria-hidden="true" />
        </button>
      </footer>
    </section>
  )
}
