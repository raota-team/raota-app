import { useId } from 'react'
import { ArrowRight, RotateCw } from 'lucide-react'
import type { TasteProfile } from '../types'
import { metricsFromProfile, tasteIdentity } from '../utils/tasteIdentity'

interface Props {
  recordCount: number
  /** 5축 누적 평균(이번 세션 기록 포함) */
  profile: TasteProfile
  /** 누적 종류 분포(이번 세션 기록 포함) */
  typeCounts: Record<string, number>
  onOpen?: () => void
  onAnalyze?: () => void
}

/** 종합 리포트 표지. 제목, 근거, 두 축 막대를 모두 원장에서 계산한다. */
export default function TasteReportCover({ recordCount, profile, typeCounts, onOpen, onAnalyze }: Props) {
  const titleId = useId()
  const identity = tasteIdentity(typeCounts, profile)
  const metrics = metricsFromProfile(profile).filter(metric => metric.key === 'brothDensity' || metric.key === 'noodleFirmness')
  const empty = recordCount === 0

  return (
    <section aria-labelledby={titleId} className="rounded-md border border-line bg-white p-4">
      <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex flex-wrap items-center gap-2 text-[12px] font-bold">
          <span className="rounded-xs bg-ink px-2 py-1 text-white">종합 리포트</span>
          <span className="text-ink-sub">전체 {recordCount}그릇 기준</span>
        </div>
        <img src="/logo.png" alt="라오타" width={32} height={32} className="h-8 w-8 shrink-0 object-contain" />
      </div>
      <div className="pt-4">
        <h2 id={titleId} className="text-[20px] font-extrabold leading-tight tracking-tight text-ink">{identity.title}</h2>
        <p className="mt-2 text-[14px] leading-6 text-ink-sub">{identity.description}</p>
        {!empty && <p className="mt-1 text-[13px] font-medium leading-5 text-ink-sub">{identity.evidence}</p>}
      </div>
      {identity.tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5 text-[12px] font-bold text-ink-sub" aria-label="취향 특징">
          {identity.tags.map(tag => <li key={tag} className="rounded-xs bg-canvas-soft px-2 py-1">#{tag}</li>)}
        </ul>
      )}
      {!empty && (
        <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-3">
          {metrics.map(metric => (
            <div key={metric.key}>
              <div className="flex items-center justify-between gap-2 text-[12px] font-bold">
                <dt className="text-ink-sub">{metric.label}</dt>
                <dd className="text-ink">{metric.score.toFixed(1)}<span className="ml-0.5 font-medium text-ink-sub">/ 5</span></dd>
              </div>
              <div className="mt-2 flex gap-1" aria-hidden="true">
                {[1, 2, 3, 4, 5].map(step => <span key={step} className="relative h-1 flex-1 overflow-hidden rounded-xs bg-canvas-soft"><span className="absolute inset-y-0 left-0 bg-brand" style={{ width: Math.min(1, Math.max(0, metric.score - step + 1)) * 100 + '%' }} /></span>)}
              </div>
            </div>
          ))}
        </dl>
      )}
      {(onOpen || onAnalyze) && !empty && (
        <div className="mt-4">
          {onOpen && <button type="button" onClick={onOpen} className="report-control flex min-h-12 w-full items-center justify-center gap-2 rounded-[60px] bg-brand px-4 text-[14px] font-bold text-white transition-opacity active:opacity-90">종합 리포트 보기 <ArrowRight size={16} className="shrink-0" aria-hidden="true" /></button>}
          {onAnalyze && <button type="button" onClick={onAnalyze} className="report-control mt-1 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-[60px] px-4 text-[13px] font-bold text-ink transition-colors hover:bg-canvas-soft active:bg-canvas-soft"><RotateCw size={15} className="shrink-0" aria-hidden="true" />최근 기록으로 다시 정리</button>}
        </div>
      )}
    </section>
  )
}
