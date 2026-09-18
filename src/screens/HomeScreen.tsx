import { useCallback, useEffect, useState } from 'react'
import { Bell, PenLine, X, Crosshair, Bookmark, Search, ChevronRight, Sparkles, Check } from 'lucide-react'
import type { UserProfile } from '../types'
import { SHOP_CATALOG, findShopByName, type ShopCatalogItem } from '../data/shops'
import PolicySheet, { type PolicyType } from '../components/PolicySheet'

interface Props {
  user: UserProfile | null
  recordSaved: boolean
  unreadNotificationsCount?: number
  onNotificationClick?: () => void
  onShopClick: (shopName: string) => void
  onRecordClick?: (mode?: 'nearby' | 'saved' | 'search') => void
  onAIRecommendClick?: () => void
  onViewTaste?: () => void
  onLoginClick?: () => void
  onRegisterClick?: () => void
  onUserClick?: () => void
  onMapClick?: () => void
  onNewsFeedClick?: () => void
}

const formatDistance = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${m}m`)
const statusOf = (shop: ShopCatalogItem) =>
  shop.businessStatus === 'OPERATIONAL' ? (shop.isOpen ? '영업 중' : '준비 중') : '영업 정보 확인 필요'

/** 에디터 픽. 원장에서 리뷰 요약이 있는 매장을 오늘의 큐레이션으로 쓴다. */
const TODAY_PICK = findShopByName('멘야준') ?? SHOP_CATALOG[0]
/** 내 취향 일치도 순 상위 5곳 (원장 matchScore 기준) */
const TOP_MATCH = [...SHOP_CATALOG].sort((a, b) => b.matchScore - a.matchScore).slice(0, 5)
/** 가까운 순 상위 5곳 (원장 distanceM 기준) */
const NEARBY = [...SHOP_CATALOG].sort((a, b) => a.distanceM - b.distanceM).slice(0, 5)

export default function HomeScreen({
  user,
  recordSaved,
  unreadNotificationsCount,
  onNotificationClick,
  onShopClick,
  onRecordClick,
  onAIRecommendClick,
  onViewTaste,
  onLoginClick,
  onRegisterClick,
  onUserClick,
  onMapClick,
}: Props) {
  const [fabOpen, setFabOpen] = useState(false)
  const [policy, setPolicy] = useState<PolicyType | null>(null)
  const closePolicy = useCallback(() => setPolicy(null), [])
  const loggedIn = Boolean(user?.isLoggedIn)

  useEffect(() => {
    if (!fabOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFabOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fabOpen])

  const fabItems: Array<{ mode: 'nearby' | 'saved' | 'search'; label: string; Icon: typeof Crosshair; delay: string }> = [
    { mode: 'nearby', label: '주변 라멘집 기록하기', Icon: Crosshair, delay: '0s' },
    { mode: 'saved', label: '저장 목록에서 기록하기', Icon: Bookmark, delay: '0.05s' },
    { mode: 'search', label: '직접 검색해서 기록하기', Icon: Search, delay: '0.1s' },
  ]

  return (
    <div className="h-full relative">
      <div className="h-full overflow-y-auto no-scrollbar bg-white text-[#25282B]">
        {/* 1. 상단 헤더 */}
        <header className="bg-white pl-4 pr-3 py-2.5 border-b border-[#E2E2E2]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <img src="/logo.png" alt="" className="w-9 h-9 object-contain shrink-0" />
              <div className="min-w-0">
                <span className="block text-[20px] font-extrabold tracking-tight leading-none whitespace-nowrap">
                  RAOTA<span className="text-[#E60000]">.</span>
                </span>
                <p className="text-[12px] font-bold text-[#6B6E73] mt-1 truncate">나의 라멘 취향을 찾는 곳</p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {loggedIn && user ? (
                <button
                  type="button"
                  onClick={onUserClick}
                  className="min-h-11 px-2 text-[13px] font-bold text-[#25282B] flex items-center active:opacity-70 transition-opacity"
                >
                  <span className="text-[#E60000]">{user.nickname}</span>님, 반갑습니다
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <button type="button" onClick={onLoginClick} className="min-h-11 px-2.5 text-[13px] font-bold text-[#25282B] active:opacity-70 transition-opacity">
                    로그인
                  </button>
                  <button
                    type="button"
                    onClick={onRegisterClick}
                    className="hidden min-[360px]:inline-flex items-center h-11 px-3 text-[13px] font-bold text-white bg-[#E60000] rounded-[6px] active:bg-[#CC0000] transition-colors"
                  >
                    회원가입
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={onNotificationClick}
                className="relative w-11 h-11 text-[#25282B] flex items-center justify-center active:opacity-70 transition-opacity"
                aria-label={loggedIn ? `알림센터 열기${unreadNotificationsCount ? `, 읽지 않은 알림 ${unreadNotificationsCount}개` : ''}` : '알림센터 (로그인 필요)'}
              >
                <Bell className="w-5 h-5" aria-hidden="true" />
                {loggedIn && unreadNotificationsCount !== undefined && unreadNotificationsCount > 0 && (
                  <span aria-hidden="true" className="absolute top-2.5 right-2.5 w-2 h-2 bg-[#E60000] rounded-full ring-2 ring-white" />
                )}
              </button>
            </div>
          </div>
        </header>

        {/* 2. AI 라멘 큐레이터 배너 */}
        <section className="px-5 pt-4">
          <button
            type="button"
            onClick={onAIRecommendClick}
            className="w-full bg-[#25282B] text-white p-4 rounded-[6px] active:scale-99 transition-transform flex items-center justify-between gap-3 text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-[6px] bg-[#E60000] flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="text-[15px] font-bold tracking-tight">오늘 뭐 먹지? AI 라멘 큐레이터</h2>
                <p className="text-[13px] text-white/70 mt-0.5 break-keep">국물과 상황에 맞는 오늘의 한 그릇 추천</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-white/70 shrink-0" aria-hidden="true" />
          </button>
        </section>

        {/* 3. 기록 완료 안내 */}
        {recordSaved && (
          <section className="px-5 pt-3">
            <button
              type="button"
              onClick={onViewTaste}
              className="w-full p-3.5 bg-white border border-[#E2E2E2] rounded-[6px] anim-fade-in-up flex items-center justify-between gap-3 text-left active:bg-[#F2F2F2] transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-8 h-8 rounded-full bg-[#FFF0F0] text-[#E60000] flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] font-bold truncate">새 라멘로그를 남겼어요</p>
                  <p className="text-[13px] text-[#6B6E73] truncate mt-0.5">내 취향 리포트에서 달라진 점을 확인해보세요</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#6B6E73] shrink-0" aria-hidden="true" />
            </button>
          </section>
        )}

        {/* 4. 오늘의 큐레이션 라멘집 */}
        <section className="px-5 pt-6">
          <div className="flex items-baseline justify-between pb-2 mb-3 border-b border-[#E2E2E2]">
            <h2 className="text-[17px] font-extrabold tracking-tight">오늘의 큐레이션 라멘집</h2>
            <span className="text-[12px] font-bold text-[#6B6E73]">{formatDistance(TODAY_PICK.distanceM)} · {TODAY_PICK.style}</span>
          </div>

          <button
            type="button"
            onClick={() => onShopClick(TODAY_PICK.name)}
            className="w-full text-left bg-white rounded-[6px] border border-[#E2E2E2] overflow-hidden active:scale-[0.99] transition-transform"
          >
            <div className="relative aspect-[4/3] bg-[#E9E9E9]">
              {TODAY_PICK.photos[0] && <img src={TODAY_PICK.photos[0]} alt={`${TODAY_PICK.name} 대표 사진`} className="w-full h-full object-cover" />}
              <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 to-transparent" />
              <span className="absolute top-3 left-3 bg-white text-[#25282B] text-[12px] font-bold px-2.5 py-1 rounded-[4px]">오늘의 픽</span>
              <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                <p className="text-[13px] font-bold text-white/80">{TODAY_PICK.spec}</p>
                <h3 className="text-[20px] font-extrabold tracking-tight leading-tight mt-0.5">
                  {TODAY_PICK.name}
                  {TODAY_PICK.branch && <span className="text-[15px] font-bold text-white/80"> · {TODAY_PICK.branch}</span>}
                </h3>
              </div>
            </div>

            <div className="p-4">
              {TODAY_PICK.description && (
                <p className="text-[14px] leading-relaxed break-keep border-l border-[#25282B] pl-3">{TODAY_PICK.description}</p>
              )}
              <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-[#E2E2E2]">
                <div className="flex gap-1.5 min-w-0 overflow-hidden">
                  {TODAY_PICK.tags.slice(0, 2).map(tag => (
                    <span key={tag} className="bg-[#F2F2F2] px-2.5 py-1 rounded-[4px] font-bold text-[12px] whitespace-nowrap">
                      {tag}
                    </span>
                  ))}
                </div>
                <span className="inline-flex items-center gap-0.5 text-[13px] font-bold text-[#E60000] shrink-0">
                  매장 상세 보기
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </span>
              </div>
            </div>
          </button>
        </section>

        {/* 5. 내 취향과 잘 맞는 라멘집 (원장 matchScore 순) */}
        <section className="px-5 pt-7">
          <div className="flex items-baseline justify-between pb-2 mb-3 border-b border-[#E2E2E2]">
            <h2 className="text-[17px] font-extrabold tracking-tight">내 취향과 잘 맞는 라멘집</h2>
            {loggedIn && <span className="text-[12px] font-bold text-[#6B6E73]">취향 일치도 순</span>}
          </div>

          {loggedIn ? (
            <ol className="bg-white rounded-[6px] border border-[#E2E2E2] overflow-hidden divide-y divide-[#E2E2E2]">
              {TOP_MATCH.map((shop, idx) => (
                <li key={shop.id}>
                  <button
                    type="button"
                    onClick={() => onShopClick(shop.name)}
                    style={{ animationDelay: `${idx * 80}ms` }}
                    className="anim-blind w-full text-left flex items-center justify-between gap-3 px-3.5 py-3 active:bg-[#F2F2F2] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-extrabold shrink-0 ${
                          idx < 3 ? 'bg-[#25282B] text-white' : 'bg-[#F2F2F2] text-[#6B6E73]'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <div className="w-12 h-12 rounded-[4px] overflow-hidden bg-[#E9E9E9] shrink-0">
                        {shop.photos[0] && <img src={shop.photos[0]} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5 min-w-0">
                          <span className="text-[15px] font-bold truncate">{shop.name}</span>
                          {shop.branch && <span className="text-[12px] text-[#6B6E73] font-bold shrink-0">{shop.branch}</span>}
                        </div>
                        <p className="text-[13px] text-[#6B6E73] truncate mt-0.5">{shop.spec}</p>
                      </div>
                    </div>
                    <span className="text-[14px] font-extrabold text-[#E60000] shrink-0 tabular-nums">{shop.matchScore}%</span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <div className="rounded-[6px] border border-dashed border-[#BEBEBE] px-5 py-6 text-center">
              <p className="text-[15px] font-bold">로그인하면 취향 일치도를 볼 수 있어요</p>
              <p className="text-[13px] text-[#6B6E73] mt-1 break-keep">라멘로그를 남길수록 내 취향에 맞는 가게를 순위로 알려드려요.</p>
              <button
                type="button"
                onClick={onLoginClick}
                className="mt-4 inline-flex items-center min-h-11 px-5 rounded-[60px] bg-[#E60000] text-white text-[14px] font-bold active:bg-[#CC0000] transition-colors"
              >
                로그인하기
              </button>
            </div>
          )}
        </section>

        {/* 6. 가까운 라멘집 (원장 distanceM 순) */}
        <section className="px-5 pt-7 pb-8">
          <div className="flex items-baseline justify-between pb-2 mb-3 border-b border-[#E2E2E2]">
            <h2 className="text-[17px] font-extrabold tracking-tight">가까운 라멘집</h2>
            <button type="button" onClick={onMapClick} className="min-h-11 -my-2 text-[13px] font-bold text-[#6B6E73] inline-flex items-center gap-0.5">
              지도에서 보기
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <ol className="bg-white rounded-[6px] border border-[#E2E2E2] divide-y divide-[#E2E2E2] overflow-hidden">
            {NEARBY.map((shop, idx) => {
              const open = shop.businessStatus === 'OPERATIONAL' && shop.isOpen
              return (
                <li key={shop.id}>
                  <button
                    type="button"
                    onClick={() => onShopClick(shop.name)}
                    className="w-full text-left px-3.5 py-3 flex items-center gap-3 active:bg-[#F2F2F2] transition-colors"
                  >
                    <span className="text-[13px] font-bold text-[#6B6E73] w-5 text-center shrink-0 tabular-nums">{String(idx + 1).padStart(2, '0')}</span>
                    <div className="w-14 h-14 rounded-[6px] overflow-hidden bg-[#E9E9E9] shrink-0">
                      {shop.photos[0] && <img src={shop.photos[0]} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5 min-w-0">
                        <p className="text-[15px] font-bold truncate">{shop.name}</p>
                        {shop.branch && <span className="text-[12px] text-[#6B6E73] font-bold shrink-0">{shop.branch}</span>}
                      </div>
                      <p className="text-[13px] text-[#6B6E73] mt-0.5 truncate">{shop.style} · {shop.spec}</p>
                      <div className="flex items-center gap-1.5 mt-1 text-[12px] font-bold whitespace-nowrap">
                        <span className="text-[#25282B]">{formatDistance(shop.distanceM)}</span>
                        <span className="text-[#BEBEBE]" aria-hidden="true">·</span>
                        <span className={open ? 'text-[#2E7D32]' : 'text-[#6B6E73]'}>● {statusOf(shop)}</span>
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ol>
        </section>

        {/* 7. 푸터 */}
        <footer className="px-5 pb-6 text-center">
          <nav aria-label="약관 및 문의" className="flex flex-wrap items-center justify-center text-[12px] font-bold text-[#6B6E73]">
            <button type="button" onClick={() => setPolicy('terms')} className="inline-flex items-center min-h-11 px-2 hover:text-[#25282B]">
              이용약관
            </button>
            <span aria-hidden="true" className="text-[#BEBEBE]">·</span>
            <button type="button" onClick={() => setPolicy('privacy')} className="inline-flex items-center min-h-11 px-2 text-[#25282B]">
              개인정보처리방침
            </button>
          </nav>
          <a href="mailto:contact@raota.net" className="inline-flex items-center min-h-11 px-3 text-[12px] font-bold text-[#6B6E73]">
            문의하기 · contact@raota.net
          </a>
          <p className="text-[12px] text-[#6B6E73]">© 2026 RAOTA · 라멘에 진심인 사람들</p>
        </footer>
      </div>

      {policy && <PolicySheet type={policy} onClose={closePolicy} />}

      {/* 기록하기 플로팅 메뉴 */}
      {fabOpen && <button type="button" aria-label="기록 메뉴 닫기" className="absolute inset-0 z-30 bg-black/50 anim-fade-in" onClick={() => setFabOpen(false)} />}
      <div className="absolute bottom-3 right-3 z-40 flex flex-col items-end gap-2.5 max-w-[calc(100%-24px)]">
        {fabOpen && (
          <div className="flex flex-col items-end gap-2" role="group" aria-label="기록 방법 선택">
            {fabItems.map(({ mode, label, Icon, delay }) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setFabOpen(false)
                  onRecordClick?.(mode)
                }}
                style={{ animationDelay: delay }}
                className="flex items-center gap-2 animate-[fadeSlideUp_0.15s_ease-out_both] active:scale-95 transition-transform"
              >
                <span className="text-[13px] font-bold text-[#25282B] bg-white px-3.5 py-2.5 rounded-[6px] shadow-[0_4px_16px_rgba(0,0,0,0.12)] whitespace-nowrap">{label}</span>
                <span className="w-11 h-11 rounded-full bg-white shadow-[0_4px_16px_rgba(0,0,0,0.12)] flex items-center justify-center shrink-0">
                  <Icon className="w-4.5 h-4.5 text-[#E60000]" aria-hidden="true" />
                </span>
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setFabOpen(prev => !prev)}
          aria-expanded={fabOpen}
          aria-label={fabOpen ? '기록 메뉴 닫기' : '라멘 기록하기'}
          className={`w-13 h-13 rounded-full flex items-center justify-center transition-colors active:scale-95 shadow-[0_4px_16px_rgba(0,0,0,0.12)] ${
            fabOpen ? 'bg-[#25282B] text-white' : 'bg-[#E60000] text-white'
          }`}
        >
          {fabOpen ? <X className="w-5 h-5 stroke-[2.5]" aria-hidden="true" /> : <PenLine className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />}
        </button>
      </div>
    </div>
  )
}
