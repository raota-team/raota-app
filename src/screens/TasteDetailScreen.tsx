import { useState, useRef, useEffect, useId, useMemo } from 'react'
import type { RamenLog, TasteProfile, UserProfile } from '../types'
import TasteReportLoading from './TasteReportLoading'
import TasteReportCover from '../components/TasteReportCover'
import { DEMO_BOWLS, MENU_CATEGORY_NAMES, bowlsFromLogs, shopVisitsOf, type MenuCategoryName } from '../data/tasteReports'
import { DEMO_TYPE_COUNTS, DEMO_USER } from '../data/demoProfile'
import { SHOP_CATALOG } from '../data/shops'
import { EMPTY_PROFILE, TASTE_AXES } from '../utils/taste'
import { MENU_CATEGORIES } from '../utils/menuDistribution'
import { getRamenActivityLevel, metricsFromProfile, tasteIdentity, typeCountsWithLogs, type MetricItem } from '../utils/tasteIdentity'
import { seoulToday } from '../utils/monthlyReport'
import { Check, ChevronLeft, Share2, RotateCw, X } from 'lucide-react'

interface Props {
  onBack: () => void
  recordCount: number
  user?: UserProfile | null
  /** 5축 누적 평균(방금 남긴 기록 포함) */
  profile?: TasteProfile
  /** 이번 세션에 남긴 내 기록 */
  logs?: RamenLog[]
  initialGenerating?: boolean
}

// 레이더 라벨 위치. 축 순서는 TASTE_AXES와 같다.
const RADAR_LABELS = [
  { x: 125, y: 14 },
  { x: 220, y: 92 },
  { x: 184, y: 216 },
  { x: 66, y: 216 },
  { x: 30, y: 92 },
]

function RadarChart({ metrics }: { metrics: MetricItem[] }) {
  const size = 250
  const center = 125
  const radius = 80
  const coord = (index: number, value: number) => {
    const angle = (Math.PI * 2 / 5) * index - Math.PI / 2
    return { x: center + radius * value * Math.cos(angle), y: center + radius * value * Math.sin(angle) }
  }
  const ring = (level: number) => [0, 1, 2, 3, 4].map(index => { const p = coord(index, level); return `${p.x},${p.y}` }).join(' ')
  const polygon = metrics.map((metric, index) => { const p = coord(index, metric.myVal); return `${p.x},${p.y}` }).join(' ')
  const summary = metrics.map(metric => `${metric.label} ${metric.score.toFixed(1)}점`).join(', ')

  return (
    <div className="flex justify-center py-2">
      <svg width={size} height={size} className="overflow-visible select-none" role="img" aria-label={`입맛 5축 레이더. ${summary}`}>
        {[0.2, 0.4, 0.6, 0.8, 1].map(level => (
          <polygon key={level} points={ring(level)} fill="none" stroke="#E2E2E2" strokeWidth="1" strokeDasharray={level === 1 ? undefined : '2 2'} />
        ))}
        {[0, 1, 2, 3, 4].map(index => {
          const p = coord(index, 1)
          return <line key={index} x1={center} y1={center} x2={p.x} y2={p.y} stroke="#E2E2E2" strokeWidth="1" />
        })}
        <polygon points={polygon} fill="#E60000" fillOpacity="0.12" stroke="#E60000" strokeWidth="2.5" strokeLinejoin="round" />
        {metrics.map((metric, index) => {
          const p = coord(index, metric.myVal)
          return <circle key={metric.key} cx={p.x} cy={p.y} r="3.5" fill="#E60000" stroke="#FFFFFF" strokeWidth="1.5" />
        })}
        {metrics.map((metric, index) => (
          <g key={metric.key} aria-hidden="true">
            <text x={RADAR_LABELS[index].x} y={RADAR_LABELS[index].y - 7} textAnchor="middle" dominantBaseline="middle" fontSize="12" fontWeight="600" fill="#4A4D52">{metric.label}</text>
            <text x={RADAR_LABELS[index].x} y={RADAR_LABELS[index].y + 8} textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="800" fill="#25282B">{metric.score.toFixed(1)}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

const CATEGORY_OF_STYLE = (style: string): MenuCategoryName | null => {
  const found = MENU_CATEGORY_NAMES.find(name => name !== '기타' && style.startsWith(name))
  return found ?? null
}

export default function TasteDetailScreen({ onBack, recordCount, user, profile = EMPTY_PROFILE, logs = [], initialGenerating }: Props) {
  const isDemo = user?.id === DEMO_USER.id
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(Boolean(initialGenerating) && recordCount > 0)
  const generationDuration = 3300
  const [showShare, setShowShare] = useState(false)
  const [shareFallback, setShareFallback] = useState(false)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const resultTitleRef = useRef<HTMLHeadingElement>(null)
  const shouldFocusResult = useRef(false)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shareTriggerRef = useRef<HTMLButtonElement>(null)
  const shareCloseRef = useRef<HTMLButtonElement>(null)
  const shareTitleId = useId()
  const shareDescriptionId = useId()

  const metrics = useMemo(() => metricsFromProfile(profile), [profile])
  const typeCounts = useMemo(() => typeCountsWithLogs(isDemo ? DEMO_TYPE_COUNTS : {}, logs), [isDemo, logs])
  const typeTotal = MENU_CATEGORY_NAMES.reduce((sum, name) => sum + typeCounts[name], 0)
  const identity = tasteIdentity(typeCounts, profile)
  const visits = useMemo(() => shopVisitsOf([...(isDemo ? DEMO_BOWLS : []), ...bowlsFromLogs(logs)]), [isDemo, logs])
  const topShops = visits.slice(0, 3)
  const level = getRamenActivityLevel(recordCount)
  const sessionCount = logs.length

  // 다음 한 그릇: 가장 적게 먹은 종류(기타 제외)를 파는 원장 매장. 안 가 본 곳을 먼저 고른다.
  const suggestion = useMemo(() => {
    if (typeTotal === 0) return null
    const ranked = MENU_CATEGORY_NAMES.filter(name => name !== '기타').sort((a, b) => typeCounts[a] - typeCounts[b])
    for (const category of ranked) {
      const candidates = SHOP_CATALOG.filter(shop => CATEGORY_OF_STYLE(shop.style) === category)
      if (!candidates.length) continue
      const unvisited = candidates.find(shop => !visits.some(visit => visit.name === shop.name))
      return { category, count: typeCounts[category], shop: unvisited ?? candidates[0] }
    }
    return null
  }, [typeCounts, typeTotal, visits])

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
  }, [])

  const showToast = (message: string) => {
    setToastMessage(message)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 2500)
  }

  const finishGeneration = () => {
    shouldFocusResult.current = true
    setIsGenerating(false)
    const now = new Date()
    setGeneratedAt(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`)
    showToast(`전체 ${recordCount}그릇으로 취향을 다시 정리했어요`)
  }

  useEffect(() => {
    if (!isGenerating && scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'instant' })
      if (shouldFocusResult.current) {
        resultTitleRef.current?.focus({ preventScroll: true })
        shouldFocusResult.current = false
      }
    }
  }, [isGenerating])

  // 공유 카드: Escape로 닫고, 열릴 때 닫기 버튼으로 포커스를 옮긴다.
  useEffect(() => {
    if (!showShare) return
    // 시트가 올라오는 동안 포커스가 overflow-hidden 루트를 스크롤시키지 않게 한다.
    shareCloseRef.current?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeShare()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showShare])

  const closeShare = () => {
    setShowShare(false)
    setShareFallback(false)
    shareTriggerRef.current?.focus({ preventScroll: true })
  }

  const shareText = [
    `라오타 취향 리포트${user?.nickname ? ` · ${user.nickname}` : ''}`,
    identity.title,
    identity.evidence,
    metrics.map(metric => `${metric.label} ${metric.score.toFixed(1)}`).join(' · '),
    topShops.length ? `자주 간 라멘집: ${topShops.map(shop => `${shop.name} ${shop.visitCount}그릇`).join(', ')}` : '',
  ].filter(Boolean).join('\n')

  const handleShare = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: '라오타 취향 리포트', text: shareText })
        closeShare()
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(shareText)
      closeShare()
      showToast('취향 카드 내용을 복사했어요')
    } catch {
      setShareFallback(true)
      showToast('복사하지 못했어요. 아래 내용을 직접 복사해 주세요')
    }
  }

  if (isGenerating) {
    return <TasteReportLoading recordCount={recordCount} metrics={metrics} duration={generationDuration} onBack={onBack} onComplete={finishGeneration} />
  }

  return (
    <div className="relative h-full overflow-hidden bg-white text-ink">
      <div ref={scrollRef} className="h-full overflow-y-auto no-scrollbar">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-line bg-white px-2 py-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <button type="button" onClick={onBack} className="report-control flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-canvas-soft" aria-label="뒤로가기">
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
            <h1 ref={resultTitleRef} tabIndex={-1} className="truncate text-[20px] font-extrabold tracking-tight outline-none">취향 종합 리포트</h1>
          </div>
          {recordCount > 0 && (
            <button ref={shareTriggerRef} type="button" onClick={() => setShowShare(true)} className="report-control mr-1 flex min-h-11 shrink-0 items-center gap-1.5 rounded-[60px] px-3 text-[14px] font-bold text-ink hover:bg-canvas-soft active:bg-canvas-soft">
              <Share2 size={16} aria-hidden="true" />공유
            </button>
          )}
        </header>

        <div className="p-4">
          {sessionCount > 0 && (
            <p role="status" className="mb-4 flex items-start gap-2 rounded-md border border-line px-3 py-2.5 text-[13px] font-medium leading-5 text-ink">
              <Check size={16} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
              이번에 남긴 기록 {sessionCount}그릇이 아래 수치에 더해졌어요.
            </p>
          )}
          <TasteReportCover recordCount={recordCount} profile={profile} typeCounts={typeCounts} />
          <p className="mt-2 text-[12px] font-medium text-ink-sub">{generatedAt ? `${seoulToday()} ${generatedAt}에 다시 정리함` : `${seoulToday()} 기준`}</p>
        </div>

        {recordCount === 0 ? (
          <section className="border-t border-line px-5 py-10 text-center">
            <h2 className="text-[20px] font-extrabold">아직 보여드릴 취향이 없어요</h2>
            <p className="mt-2 text-[14px] leading-6 text-ink-sub">홈에서 첫 그릇을 기록하면<br />5축 점수와 종류별 분포가 여기에 쌓여요.</p>
          </section>
        ) : <>
          <section className="border-t border-line px-4 py-5" aria-labelledby="taste-axes-title">
            <h2 id="taste-axes-title" className="text-[17px] font-extrabold">입맛 5축</h2>
            <p className="mt-1 text-[13px] leading-5 text-ink-sub">기록마다 매긴 5축 점수의 평균이에요. 바깥쪽일수록 5점에 가까워요.</p>
            <RadarChart metrics={metrics} />
            <dl className="divide-y divide-line border-t border-line">
              {metrics.map((metric, index) => (
                <div key={metric.key} className="flex items-center gap-3 py-2.5">
                  <dt className="w-24 shrink-0 text-[14px] font-bold text-ink">{metric.label}</dt>
                  <dd className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas-soft" aria-hidden="true">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${metric.myVal * 100}%` }} />
                    </div>
                    <span className="w-8 shrink-0 text-right text-[14px] font-extrabold text-ink">{metric.score.toFixed(1)}</span>
                    <span className="w-20 shrink-0 text-right text-[12px] font-medium leading-4 text-ink-sub">{metric.score >= 3 ? TASTE_AXES[index].high : TASTE_AXES[index].low}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="border-t border-line px-4 py-5" aria-labelledby="taste-types-title">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="taste-types-title" className="text-[17px] font-extrabold">종류별로 먹은 라멘</h2>
              <span className="text-[13px] font-medium text-ink-sub">전체 {typeTotal}그릇</span>
            </div>
            <ul className="mt-4 space-y-3">
              {MENU_CATEGORIES.map(category => {
                const count = typeCounts[category.name]
                const pct = typeTotal ? Math.round((count / typeTotal) * 100) : 0
                return (
                  <li key={category.name} className="flex items-center gap-3 text-[14px]">
                    <span className="w-14 shrink-0 font-bold text-ink">{category.name}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-canvas-soft" aria-hidden="true">
                      <div className={`h-full rounded-full ${category.color}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-24 shrink-0 text-right text-[13px] font-medium text-ink-sub"><strong className="font-extrabold text-ink">{count}그릇</strong> · {pct}%</span>
                  </li>
                )
              })}
            </ul>
          </section>

          {topShops.length > 0 && (
            <section className="border-t border-line px-4 py-5" aria-labelledby="taste-shops-title">
              <h2 id="taste-shops-title" className="text-[17px] font-extrabold">자주 간 라멘집</h2>
              <p className="mt-1 text-[13px] leading-5 text-ink-sub">전체 {typeTotal}그릇 중 가장 많이 기록한 세 곳이에요.</p>
              <ol className="mt-2 divide-y divide-line">
                {topShops.map((shop, index) => (
                  <li key={shop.name} className="flex items-center gap-3 py-3">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-canvas-soft">
                      {shop.photo ? <img src={shop.photo} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-[15px] font-extrabold text-ink-sub" aria-hidden="true">{shop.name.slice(0, 1)}</span>}
                      <span className="absolute left-0 top-0 flex h-5 min-w-5 items-center justify-center bg-ink px-1 text-[12px] font-extrabold text-white" aria-hidden="true">{index + 1}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold text-ink"><span className="sr-only">{index + 1}위 </span>{shop.name}{shop.branch ? <span className="ml-1 text-[13px] font-medium text-ink-sub">{shop.branch}</span> : null}</p>
                      <p className="mt-0.5 truncate text-[13px] text-ink-sub">{shop.topMenu} · 마지막 {shop.lastVisited.slice(5).replace('-', '.')}</p>
                    </div>
                    <span className="shrink-0 text-[14px] font-extrabold text-ink">{shop.visitCount}그릇</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {suggestion && (
            <section className="border-t border-line px-4 py-5" aria-labelledby="taste-next-title">
              <h2 id="taste-next-title" className="text-[17px] font-extrabold">다음에 맛볼 한 그릇</h2>
              <p className="mt-1 text-[13px] leading-5 text-ink-sub">
                {suggestion.count === 0 ? `${suggestion.category}는 아직 기록이 없어요.` : `${suggestion.category}는 ${suggestion.count}그릇으로 가장 적었어요.`} 이 종류로 폭을 넓혀보세요.
              </p>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-canvas-soft">
                  {suggestion.shop.photos[0] ? <img src={suggestion.shop.photos[0]} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-ink">{suggestion.shop.name}{suggestion.shop.branch ? <span className="ml-1 text-[13px] font-medium text-ink-sub">{suggestion.shop.branch}</span> : null}</p>
                  <p className="mt-0.5 truncate text-[13px] text-ink-sub">{suggestion.shop.style}{suggestion.shop.spec ? ` · ${suggestion.shop.spec}` : ''}</p>
                </div>
              </div>
            </section>
          )}

          <div className="border-t border-line px-4 pb-8 pt-5">
            <button type="button" onClick={() => { setToastMessage(null); setIsGenerating(true) }} className="report-control flex min-h-12 w-full items-center justify-center gap-2 rounded-[60px] bg-ink px-4 text-[14px] font-bold text-white transition-opacity active:opacity-90">
              <RotateCw size={16} aria-hidden="true" />최근 기록으로 다시 정리
            </button>
            <p className="mt-2 text-center text-[13px] leading-5 text-ink-sub">새 기록을 남기면 이 화면의 수치는 이미 더해져 있어요. 다시 정리하면 처음부터 다시 훑어봐요.</p>
          </div>
        </>}
      </div>

      {toastMessage && (
        <div role="status" className="pointer-events-none absolute left-1/2 top-16 z-40 -translate-x-1/2 whitespace-nowrap rounded-[60px] bg-ink px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_4px_16px_rgba(0,0,0,0.12)] anim-fade-in-up">
          {toastMessage}
        </div>
      )}

      {showShare && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end anim-fade-in">
          <button type="button" className="absolute inset-0 bg-black/50" onClick={closeShare} aria-label="공유 카드 닫기" />
          <section role="dialog" aria-modal="true" aria-labelledby={shareTitleId} aria-describedby={shareDescriptionId} className="relative z-10 flex max-h-[88%] flex-col rounded-t-xl bg-white text-ink shadow-[0_4px_16px_rgba(0,0,0,0.12)] anim-slide-up">
            <div className="flex items-center justify-between border-b border-line py-2 pl-5 pr-2">
              <h2 id={shareTitleId} className="text-[17px] font-extrabold">내 취향 카드</h2>
              <button ref={shareCloseRef} type="button" onClick={closeShare} aria-label="닫기" className="report-control flex h-11 w-11 items-center justify-center rounded-full hover:bg-canvas-soft"><X size={20} aria-hidden="true" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <p id={shareDescriptionId} className="text-[13px] font-medium text-ink-sub">{user?.nickname ?? '라오타 회원'} · {user?.membershipNo ?? ''} · Lv.{level.number} {level.title}</p>
              <p className="mt-2 text-[24px] font-extrabold leading-tight tracking-tight">{identity.title}</p>
              <p className="mt-1 text-[13px] font-medium leading-5 text-ink-sub">{identity.evidence}</p>
              <dl className="mt-4 space-y-2 border-t border-line pt-3">
                {metrics.map(metric => (
                  <div key={metric.key} className="flex items-center gap-3 text-[13px]">
                    <dt className="w-20 shrink-0 font-bold text-ink">{metric.label}</dt>
                    <dd className="flex min-w-0 flex-1 items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas-soft" aria-hidden="true"><div className="h-full bg-brand" style={{ width: `${metric.myVal * 100}%` }} /></div>
                      <span className="w-7 shrink-0 text-right font-extrabold text-ink">{metric.score.toFixed(1)}</span>
                    </dd>
                  </div>
                ))}
              </dl>
              {topShops.length > 0 && (
                <div className="mt-4 border-t border-line pt-3">
                  <p className="text-[13px] font-bold text-ink">자주 간 라멘집</p>
                  <ol className="mt-1 space-y-1 text-[13px]">
                    {topShops.map((shop, index) => (
                      <li key={shop.name} className="flex justify-between gap-3"><span className="truncate font-medium text-ink">{index + 1}. {shop.name}</span><span className="shrink-0 font-bold text-ink">{shop.visitCount}그릇 ({typeTotal ? Math.round((shop.visitCount / typeTotal) * 100) : 0}%)</span></li>
                    ))}
                  </ol>
                </div>
              )}
              {shareFallback && (
                <div className="mt-4 border-t border-line pt-3">
                  <label htmlFor="share-fallback-text" className="text-[13px] font-bold text-ink">복사하지 못했어요. 아래 내용을 길게 눌러 복사해 주세요.</label>
                  <textarea id="share-fallback-text" readOnly value={shareText} rows={6} onFocus={event => event.currentTarget.select()} className="mt-2 w-full rounded-md border border-line bg-canvas-soft p-3 text-[13px] leading-5 text-ink" />
                </div>
              )}
            </div>
            <div className="flex gap-2 border-t border-line px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">
              <button type="button" onClick={handleShare} className="report-control flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[60px] bg-brand text-[14px] font-bold text-white transition-opacity active:opacity-90">
                <Share2 size={16} aria-hidden="true" />{typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? '공유하기' : '내용 복사하기'}
              </button>
              <button type="button" onClick={closeShare} className="report-control min-h-12 rounded-[60px] border border-line px-5 text-[14px] font-bold text-ink hover:bg-canvas-soft">닫기</button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
