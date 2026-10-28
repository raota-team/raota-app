import { formatDate, t } from "@raota/shared"
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
        <h2 id={titleId} className="text-[17px] font-extrabold text-ink">{t("{month} 집계 중", {month: formatDate(new Date(2026, report.month - 1, 1), {month: "long"})})}</h2>
        <span className="shrink-0 text-[13px] font-bold text-ink">{report.count}{t("그릇")}</span>
      </div>
      <p id={descriptionId} className="mt-1 text-[13px] font-medium leading-5 text-ink-sub">{t("기록을 남기면 이번 달 분포에 바로 더해져요. 이번 달이 {count}일 남았어요.", {count: report.daysLeft})}</p>

      <div className="mt-3 border-t border-line pt-3">
        <div role="progressbar" aria-label={t("지난달과 비교하는 데 필요한 기록")} aria-valuemin={0} aria-valuemax={MONTHLY_REPORT_TARGET} aria-valuenow={Math.min(report.count, MONTHLY_REPORT_TARGET)} aria-valuetext={t("{count}그릇 기록, {status}", {count: report.count, status: ready ? t("지난달과 비교 가능") : t("{count}그릇 더 필요", {count: report.remaining})})} className="h-1 overflow-hidden rounded-full bg-canvas-soft">
          <div className="h-full origin-left rounded-full bg-brand transition-[transform] motion-reduce:transition-none" style={{ transform: 'scaleX(' + report.progress + ')' }} />
        </div>
        <p role="status" className="mt-2 flex items-start gap-1.5 text-[13px] font-medium leading-5 text-ink-sub">
          {ready && <Check size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />}
          {!hasPrevious
            ? t("이번 달 {v0}그릇 이상 모이면 다음 달부터 달라진 비율을 비교할 수 있어요.", { v0: MONTHLY_REPORT_TARGET })
            : ready
              ? t("{v0}그릇이 모여서 지난달과 비율을 비교할 수 있어요.", { v0: MONTHLY_REPORT_TARGET })
              : t("{v0} 더 기록하면 지난달과 비율을 비교할 수 있어요. (한 달 {v1}그릇부터)", { v0: t('{count}그릇', {count: report.remaining}), v1: MONTHLY_REPORT_TARGET })}
        </p>
      </div>
    </section>
  )
}
