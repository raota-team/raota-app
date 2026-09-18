import { MENU_CATEGORIES, menuDistribution, type DistributionSource } from '../utils/menuDistribution'
import { CURRENT_MONTH_ID, reportMonthIndex, shortReportMonth } from '../utils/tasteHistory'

interface Props {
  reports: DistributionSource[]
  selectedId?: string
  compact?: boolean
}

export default function MenuDistributionChart({ reports, selectedId, compact = false }: Props) {
  const includeYear = new Set(reports.map(report => Math.floor(reportMonthIndex(report) / 12))).size > 1
  return (
    <div>
      <div className={compact ? 'space-y-3' : 'space-y-5'}>
        {reports.map(report => {
          const { total, items } = menuDistribution(report)
          const selected = report.id === selectedId
          const inProgress = report.id === CURRENT_MONTH_ID
          return (
            <div key={report.id}>
              <div className="mb-2 flex items-center justify-between gap-3 text-[12px]">
                <span className={selected ? 'font-bold text-ink' : 'font-medium text-ink-sub'}>
                  {shortReportMonth(report, includeYear)}{inProgress ? ' · 집계 중' : selected && !compact ? ' · 선택한 달' : ''}
                </span>
                <span className="font-medium text-ink-sub">{total}그릇</span>
              </div>
              <div role="img" aria-label={`${report.period} 메뉴 분포. ${total ? items.filter(item => item.count > 0).map(item => `${item.name} ${item.count}그릇, ${item.pct}%`).join(', ') : '기록 없음'}`} className={compact ? 'flex h-3 overflow-hidden rounded-xs bg-canvas-soft' : 'flex h-9 overflow-hidden rounded-sm bg-canvas-soft'}>
                {total ? items.filter(item => item.count > 0).map(item => <div key={item.name} className={`flex items-center justify-center overflow-hidden ${item.color} ${item.textColor}`} style={{ width: `${item.share}%` }} aria-hidden="true">
                  {!compact && item.pct >= 14 && <span className="text-[12px] font-bold">{item.pct}%</span>}
                </div>) : <span className="m-auto text-[12px] text-ink-sub">기록 없음</span>}
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[12px] font-medium text-ink-sub" aria-label="메뉴 분포 범례">
        {MENU_CATEGORIES.map(category => <span key={category.name} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-xs ${category.color}`} aria-hidden="true" />{category.name}</span>)}
      </div>
    </div>
  )
}
