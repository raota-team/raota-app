import { useId } from 'react'
import { ArrowRight } from 'lucide-react'
import type { PastReportItem } from '../data/tasteReports'
import MenuDistributionChart from './MenuDistributionChart'
import { chronologicalReports, shortReportMonth, type CurrentMonthReport } from '../utils/tasteHistory'
import { menuDistribution, type DistributionSource } from '../utils/menuDistribution'

interface Props {
  reports: PastReportItem[]
  /** 집계 중인 이번 달. 기록이 없으면 null */
  current: CurrentMonthReport | null
  onOpen: () => void
}

export default function MonthlyTastePreview({ reports, current, onOpen }: Props) {
  const titleId = useId()
  const months: DistributionSource[] = [...chronologicalReports(reports), ...(current ? [current] : [])].slice(-3)
  const latest = months[months.length - 1]
  const distribution = menuDistribution(latest)
  const top = [...distribution.items].sort((a, b) => b.count - a.count)[0]
  const leaders = distribution.items.filter(item => item.count === top.count && item.count > 0)
  const latestIsCurrent = Boolean(current && latest?.id === current.id)

  return (
    <section aria-labelledby={titleId} className="rounded-md border border-line bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id={titleId} className="text-[17px] font-extrabold text-ink">월별 취향 변화</h2>
        <span className="text-[12px] font-medium text-ink-sub">종류별 분포</span>
      </div>
      {latest ? <>
        <p className="mt-2 text-[14px] leading-6 text-ink-sub">
          {distribution.total
            ? <>{shortReportMonth(latest)}{latestIsCurrent ? '은 지금까지' : '에'} <strong className="font-bold text-ink">{leaders.map(item => item.name).join('·')}</strong>를 가장 많이 먹었어요.</>
            : '아직 이 달의 메뉴 기록이 없어요.'}
        </p>
        <div className="mt-4"><MenuDistributionChart reports={months} selectedId={latest.id} compact /></div>
      </> : <p className="mt-2 text-[14px] leading-6 text-ink-sub">아직 모인 월별 기록이 없어요. 먹은 라멘이 쌓이면 달마다 어떤 종류를 즐겼는지 비교할 수 있어요.</p>}
      <button type="button" onClick={onOpen} className="report-control mt-4 flex min-h-11 w-full items-center justify-between gap-3 border-t border-line pt-3 text-left text-[14px] font-bold text-ink transition-colors hover:text-brand active:text-brand">
        {months.length > 1 ? '월별 분포 비교하기' : '월별 분포 보기'}
        <ArrowRight size={16} className="shrink-0" aria-hidden="true" />
      </button>
    </section>
  )
}
