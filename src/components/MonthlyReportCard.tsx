import { useId } from 'react'
import { Check } from 'lucide-react'
import { MONTHLY_REPORT_TARGET, type monthlyReportStatus } from '../utils/monthlyReport'

interface Props {
  report: ReturnType<typeof monthlyReportStatus>
  /** 비교할 지난 달 기록이 있는지. 없으면 다음 달부터 비교한다고 말한다. */
  hasPrevious?: boolean
}

/** 이번 달 집계 현황. 실제로 일어나는 일(기록이 분포에 더해짐, 3그릇부터 지난달 비교)만 말한다. */
export default function MonthlyReportCard({ report, hasPrevious = true }: Props) {
  const titleId = useId()
  const descriptionId = useId()
  const ready = report.remaining === 0

  return (
    <section className="rounded-md border border-line bg-white p-4" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={titleId} className="text-[17px] font-extrabold text-ink">{report.month}월 집계 중</h2>
        <span className="shrink-0 text-[13px] font-bold text-ink">{report.count}그릇</span>
      </div>
      <p id={descriptionId} className="mt-1 text-[13px] font-medium leading-5 text-ink-sub">기록을 남기면 이번 달 분포에 바로 더해져요. 이번 달이 {report.daysLeft}일 남았어요.</p>

      <div className="mt-3 border-t border-line pt-3">
        <div role="progressbar" aria-label="지난달과 비교하는 데 필요한 기록" aria-valuemin={0} aria-valuemax={MONTHLY_REPORT_TARGET} aria-valuenow={Math.min(report.count, MONTHLY_REPORT_TARGET)} aria-valuetext={report.count + '그릇 기록, ' + (ready ? '지난달과 비교 가능' : report.remaining + '그릇 더 필요')} className="h-1 overflow-hidden rounded-full bg-canvas-soft">
          <div className="h-full origin-left rounded-full bg-brand transition-[transform] motion-reduce:transition-none" style={{ transform: 'scaleX(' + report.progress + ')' }} />
        </div>
        <p role="status" className="mt-2 flex items-start gap-1.5 text-[13px] font-medium leading-5 text-ink-sub">
          {ready && <Check size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />}
          {!hasPrevious
            ? `이번 달 ${MONTHLY_REPORT_TARGET}그릇 이상 모이면 다음 달부터 달라진 비율을 비교할 수 있어요.`
            : ready
              ? `${MONTHLY_REPORT_TARGET}그릇이 모여서 지난달과 비율을 비교할 수 있어요.`
              : `${report.remaining === 1 ? '한 그릇' : report.remaining + '그릇'} 더 기록하면 지난달과 비율을 비교할 수 있어요. (한 달 ${MONTHLY_REPORT_TARGET}그릇부터)`}
        </p>
      </div>
    </section>
  )
}
