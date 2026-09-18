import { useId, useState } from 'react'
import { ChevronDown, ChevronLeft, Utensils } from 'lucide-react'
import MonthlyReportCard from '../components/MonthlyReportCard'
import MenuDistributionChart from '../components/MenuDistributionChart'
import { chronologicalReports, currentMonthReport, isPastReport, reportMonthIndex, shortReportMonth, type CurrentMonthReport } from '../utils/tasteHistory'
import { menuDistribution, type DistributionSource } from '../utils/menuDistribution'
import { DEMO_BOWLS, type PastReportItem } from '../data/tasteReports'
import { MONTHLY_REPORT_TARGET, monthlyReportStatus } from '../utils/monthlyReport'
import { tasteIdentity } from '../utils/tasteIdentity'
import type { RamenLog } from '../types'

interface Props {
  onBack: () => void
  reports: PastReportItem[]
  monthlyRecordCounts: Record<string, number>
  /** 이번 세션에 남긴 내 기록. 있으면 이번 달 분포에 종류까지 더한다. */
  ownedLogs?: RamenLog[]
  initialSelectedId?: string
  onSelectMonth: (id: string) => void
}

type MonthItem = PastReportItem | CurrentMonthReport

export default function MonthlyTasteScreen({ onBack, reports, monthlyRecordCounts, ownedLogs = [], initialSelectedId, onSelectMonth }: Props) {
  const monthSelectId = useId()
  // App은 데모 계정에만 지난 달 리포트를 넘긴다. 그때만 데모 원장의 이번 달 그릇을 합친다.
  const current = currentMonthReport(monthlyRecordCounts, ownedLogs, reports.length ? DEMO_BOWLS : [])
  const newestFirst: MonthItem[] = [...(current ? [current] : []), ...chronologicalReports(reports).reverse()]
  const [selectedId, setSelectedId] = useState(initialSelectedId || newestFirst[0]?.id)
  const selectedIndex = Math.max(0, newestFirst.findIndex(report => report.id === selectedId))
  const selected: MonthItem | undefined = newestFirst[selectedIndex]
  const previous: MonthItem | undefined = newestFirst[selectedIndex + 1]
  const distribution = menuDistribution(selected)
  const before = menuDistribution(previous)
  const inProgressMonth = selected && !isPastReport(selected) ? selected : null
  const inProgress = Boolean(inProgressMonth)
  // 집계 중인 달은 실제 기록 수(App의 monthlyRecordCounts) 기준으로 비교 가능 여부를 정한다.
  const enoughForCompare = !inProgressMonth || inProgressMonth.recordCount >= MONTHLY_REPORT_TARGET
  const canCompare = Boolean(previous && distribution.total && before.total && enoughForCompare)
  const previousLabel = previous && selected && reportMonthIndex(selected) - reportMonthIndex(previous) === 1 ? '지난달' : '이전 기록'
  const differences = distribution.items.map((item, index) => ({ ...item, difference: item.pct - before.items[index].pct }))
  const biggestChange = [...differences].sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))[0]
  const favoriteCount = Math.max(...distribution.items.map(item => item.count))
  const favorites = distribution.items.filter(item => item.count === favoriteCount && item.count > 0)
  const includeYear = Boolean(previous && selected && Math.floor(reportMonthIndex(previous) / 12) !== Math.floor(reportMonthIndex(selected) / 12))
  const shortMonth = (report: DistributionSource) => shortReportMonth(report, includeYear)
  const past = selected && isPastReport(selected) ? selected : null
  const monthIdentity = past ? tasteIdentity(Object.fromEntries(past.styleRows.map(row => [row.name, row.count])), { count: past.recordCount, scores: past.scores }, shortMonth(past)) : null
  const untyped = inProgressMonth ? inProgressMonth.recordCount - inProgressMonth.typedCount : 0

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white text-ink">
      <header className="flex shrink-0 items-center gap-1 border-b border-line bg-white px-2 py-1.5">
        <button type="button" onClick={onBack} aria-label="뒤로가기" className="report-control flex h-11 w-11 items-center justify-center rounded-full hover:bg-canvas-soft"><ChevronLeft size={22} aria-hidden="true" /></button>
        <h1 className="text-[20px] font-extrabold tracking-tight">월별 취향 변화</h1>
      </header>
      <main className="flex-1 overflow-y-auto">
        {selected ? <>
          <div className="flex items-center justify-between gap-4 px-4 py-4">
            <label htmlFor={monthSelectId} className="text-[14px] font-bold text-ink-sub">보는 달</label>
            <div className="relative min-w-0">
              <select id={monthSelectId} value={selected.id} onChange={event => { setSelectedId(event.target.value); onSelectMonth(event.target.value) }} className="report-control min-h-11 w-full appearance-none rounded-md border border-line bg-white py-2 pl-4 pr-11 text-[14px] font-bold text-ink hover:border-ink-sub">
                {newestFirst.map(report => <option key={report.id} value={report.id}>{report.period}{isPastReport(report) ? '' : ' (집계 중)'}</option>)}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-sub" aria-hidden="true" />
            </div>
          </div>

          <section className="border-t border-line px-4 py-5" aria-labelledby="monthly-distribution-title">
            <p className="text-[12px] font-bold text-ink-sub">{shortMonth(selected)}의 취향{inProgress ? ' · 집계 중' : ''}</p>
            <h2 id="monthly-distribution-title" className="mt-1 text-[20px] font-extrabold leading-snug tracking-tight">
              {monthIdentity ? monthIdentity.title : `${shortMonth(selected)}의 메뉴 분포`}
            </h2>
            <p className="mt-2 text-[14px] leading-6 text-ink-sub">
              {distribution.total
                ? <>{distribution.total}그릇 중 <strong className="font-bold text-ink">{favorites.map(item => item.name).join('·')}</strong>{favorites.length > 1 ? '가 공동 1위예요.' : `를 ${favoriteCount}그릇으로 가장 많이 먹었어요.`}</>
                : '이 달에는 분포를 보여줄 메뉴 기록이 없어요.'}
            </p>
            {monthIdentity && <p className="mt-1 text-[13px] font-medium leading-5 text-ink-sub">{monthIdentity.evidence}</p>}
            {inProgressMonth && untyped > 0 && <p className="mt-1 text-[13px] font-medium leading-5 text-ink-sub">이번 달 {inProgressMonth.recordCount}그릇 중 종류가 확인된 {inProgressMonth.typedCount}그릇 기준이에요.</p>}
            {past && <p className="mt-3 border-l border-ink pl-3 text-[14px] leading-6 text-ink">{past.note}</p>}
            <div className="mt-6">
              <MenuDistributionChart reports={previous ? [previous, selected] : [selected]} selectedId={selected.id} />
            </div>
          </section>

          <section className="border-t border-line px-4 py-5" aria-labelledby="monthly-compare-title">
            <h3 id="monthly-compare-title" className="text-[17px] font-extrabold">{canCompare ? previousLabel + '과 달라진 메뉴' : '종류별로 먹은 라멘'}</h3>
            <p className="mt-1.5 text-[13px] leading-5 text-ink-sub">
              {canCompare
                ? '각 달에 먹은 라멘의 종류별 비율을 비교해요.'
                : inProgressMonth && previous && distribution.total
                  ? `${MONTHLY_REPORT_TARGET - inProgressMonth.recordCount === 1 ? '한 그릇' : `${MONTHLY_REPORT_TARGET - inProgressMonth.recordCount}그릇`} 더 기록하면 ${shortMonth(previous)}과 비교할 수 있어요.`
                  : previous ? '비교할 메뉴 기록이 모이면 비율 변화를 보여드려요.' : '첫 월별 기록이에요. 다음 달부터 변화를 비교해요.'}
            </p>
            <table className="mt-4 w-full table-fixed text-[13px]">
              <caption className="sr-only">{selected.period} 라멘 종류별 그릇 수와 비율{canCompare ? ', 이전 기록 대비 비율 변화' : ''}</caption>
              <thead className="border-b border-line text-ink-sub">
                <tr><th scope="col" className="w-[34%] pb-3 text-left font-medium">종류</th><th scope="col" className="pb-3 text-right font-medium">그릇 수</th><th scope="col" className="pb-3 text-right font-medium">비율</th>{canCompare && <th scope="col" className="pb-3 text-right font-medium">변화</th>}</tr>
              </thead>
              <tbody className="divide-y divide-line">
                {differences.map(item => <tr key={item.name}>
                  <th scope="row" className="py-3 text-left font-bold"><span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 shrink-0 rounded-xs ${item.color}`} aria-hidden="true" />{item.name}</span></th>
                  <td className="py-3 text-right text-ink-sub">{item.count}그릇</td>
                  <td className="py-3 text-right font-bold">{distribution.total ? item.pct + '%' : '—'}</td>
                  {canCompare && <td className={`py-3 text-right whitespace-nowrap ${item.difference > 0 ? 'font-bold text-brand' : 'text-ink-sub'}`}><span aria-label={item.difference ? `${Math.abs(item.difference)}퍼센트포인트 ${item.difference > 0 ? '증가' : '감소'}` : '변화 없음'}>{item.difference ? `${item.difference > 0 ? '+' : '−'}${Math.abs(item.difference)}%p` : '—'}</span></td>}
                </tr>)}
              </tbody>
            </table>
            {canCompare && previous && <div className="mt-2 border-t border-line pt-4">
              <p className="text-[14px] leading-6 text-ink">{biggestChange.difference ? <><strong className="font-bold">{biggestChange.name}</strong> 비율이 {shortMonth(previous)}보다 <strong className="font-bold">{Math.abs(biggestChange.difference)}%p {biggestChange.difference > 0 ? '늘었어요' : '줄었어요'}.</strong></> : '이전 기록과 메뉴 비율이 같아요.'}</p>
              <p className="mt-1 text-[12px] leading-5 text-ink-sub">%p는 두 달의 비율 차이예요. 비율은 그릇 수를 기준으로 반올림했어요.</p>
            </div>}
          </section>

          {past && past.topShops.length > 0 && (
            <section className="border-t border-line px-4 py-5" aria-labelledby="monthly-shops-title">
              <h3 id="monthly-shops-title" className="text-[17px] font-extrabold">{shortMonth(past)}에 자주 간 라멘집</h3>
              <ol className="mt-3 divide-y divide-line">
                {past.topShops.map((shop, index) => (
                  <li key={shop.name} className="flex items-center gap-3 py-3">
                    <span className="w-5 shrink-0 text-[14px] font-extrabold text-ink" aria-hidden="true">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold text-ink">{shop.name}{shop.branch ? <span className="ml-1 font-medium text-ink-sub">{shop.branch}</span> : null}</p>
                      <p className="mt-0.5 truncate text-[13px] text-ink-sub">{shop.topMenu}</p>
                    </div>
                    <span className="shrink-0 text-[14px] font-bold text-ink">{shop.visitCount}그릇</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </> : <section className="px-5 py-10 text-center">
          <Utensils size={28} className="mx-auto text-ink" aria-hidden="true" />
          <h2 className="mt-4 text-[20px] font-extrabold">첫 달의 메뉴부터 모아볼까요?</h2>
          <p className="mt-2 text-[14px] leading-6 text-ink-sub">먹은 라멘을 기록하면<br />월별로 어떤 종류를 즐겼는지 비교할 수 있어요.</p>
        </section>}
        <div className="border-t border-line px-4 py-5">
          <MonthlyReportCard report={monthlyReportStatus(monthlyRecordCounts)} hasPrevious={reports.length > 0} />
        </div>
      </main>
    </div>
  )
}
