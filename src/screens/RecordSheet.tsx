import { useEffect, useMemo, useRef, useState } from 'react'
import { Crosshair, Bookmark, Search, X, ChevronRight } from 'lucide-react'
import { SHOP_CATALOG, type ShopCatalogItem } from '../data/shops'
import { DEMO_SAVED_SHOP_NAMES } from '../data/demoProfile'

export type RecordSheetMode = 'nearby' | 'saved' | 'search'

interface Props {
  initialMode?: RecordSheetMode
  onClose: () => void
  onSelectShop: (shopName: string) => void
  /** 찜한 가게 이름. 넘기지 않으면 데모 원장의 찜 목록을 쓴다. */
  savedShopNames?: string[]
}

interface ShopItem {
  id: number
  name: string
  branch: string
  style: string
  spec: string
  distanceM: number
  distance: string
  isOpen: boolean
  photo?: string
  tags: string[]
  region: string
}

/** 주소의 동 또는 역 이름에서 동네를 뽑는다. 못 찾으면 비워 둔다. */
const REGION_PATTERN = /(망원|합정|연남|서교|상수|동교)(동|역)/
const regionOf = (address: string) => {
  const match = address.match(REGION_PATTERN)
  return match ? `${match[1]}동` : ''
}

const formatDistance = (meters: number) =>
  meters >= 1000 ? `${(meters / 1000).toFixed(1).replace(/\.0$/, '')}km` : `${meters}m`

/** 매장 원장에서 시트가 쓰는 목록을 파생한다. 이름, 지점, 거리는 원장과 항상 같다. */
const toShopItem = (shop: ShopCatalogItem): ShopItem => ({
  id: shop.id,
  name: shop.name,
  branch: shop.branch ?? '',
  style: shop.style,
  spec: shop.spec,
  distanceM: shop.distanceM,
  distance: formatDistance(shop.distanceM),
  isOpen: shop.isOpen,
  photo: shop.photos[0],
  tags: shop.tags,
  region: regionOf(shop.address),
})

const ALL_SHOPS: ShopItem[] = SHOP_CATALOG.map(toShopItem).sort((a, b) => a.distanceM - b.distanceM)

const QUICK_KEYWORDS = Array.from(
  new Set([
    ...ALL_SHOPS.map(shop => shop.style.replace(/ 라멘$/, '')),
    ...ALL_SHOPS.map(shop => shop.region).filter(Boolean),
  ]),
)

const MODES: Array<{ id: RecordSheetMode; label: string; Icon: typeof Crosshair }> = [
  { id: 'nearby', label: '주변', Icon: Crosshair },
  { id: 'saved', label: '찜한 가게', Icon: Bookmark },
  { id: 'search', label: '검색', Icon: Search },
]

function ShopRow({ shop, onSelect }: { shop: ShopItem; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-[calc(100%+1rem)] min-h-14 py-3 px-2 -mx-2 flex items-center gap-3 text-left rounded-[6px] active:bg-[#F2F2F2]"
    >
      <div className="w-14 h-14 rounded-[6px] overflow-hidden shrink-0 bg-[#F2F2F2] border border-[#E2E2E2]">
        {shop.photo && <img src={shop.photo} alt="" className="w-full h-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="text-[15px] font-bold text-[#25282B] truncate">{shop.name}</span>
          {shop.branch && <span className="text-[13px] text-[#6B6E73] shrink-0">{shop.branch}</span>}
        </div>
        <p className="text-[13px] text-[#6B6E73] truncate mt-0.5">{shop.spec || shop.style}</p>
        <div className="flex items-center gap-2 mt-1 text-[12px] font-bold">
          <span className="text-[#25282B]">{shop.distance}</span>
          <span className={shop.isOpen ? 'text-[#2E7D32]' : 'text-[#6B6E73]'}>{shop.isOpen ? '영업 중' : '준비 중'}</span>
          {shop.region && <span className="text-[#6B6E73] font-medium">{shop.region}</span>}
        </div>
      </div>
      <ChevronRight className="w-5 h-5 shrink-0 text-[#6B6E73]" aria-hidden="true" />
    </button>
  )
}

export default function RecordSheet({
  initialMode = 'nearby',
  onClose,
  onSelectShop,
  savedShopNames = DEMO_SAVED_SHOP_NAMES,
}: Props) {
  const [mode, setMode] = useState<RecordSheetMode>(initialMode)
  const [nearbyFilter, setNearbyFilter] = useState<'all' | 'open' | '500m'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const titleRef = useRef<HTMLHeadingElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // 첫 포커스: 검색 모드면 검색창, 아니면 제목. Escape는 App도 처리하지만 시트 안에서도 닫는다.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const raf = requestAnimationFrame(() => {
      if (initialMode === 'search') searchInputRef.current?.focus()
      else titleRef.current?.focus()
    })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (mode === 'search') searchInputRef.current?.focus()
  }, [mode])

  const savedShops = useMemo(
    () => ALL_SHOPS.filter(shop => savedShopNames.includes(shop.name)),
    [savedShopNames],
  )

  const nearbyList = useMemo(
    () =>
      ALL_SHOPS.filter(shop => {
        if (nearbyFilter === 'open' && !shop.isOpen) return false
        if (nearbyFilter === '500m' && shop.distanceM > 500) return false
        return true
      }),
    [nearbyFilter],
  )

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return ALL_SHOPS.filter(shop =>
      [shop.name, shop.branch, shop.style, shop.spec, shop.region, ...shop.tags].some(text => text.toLowerCase().includes(q)),
    )
  }, [searchQuery])

  const filterChip = (active: boolean) =>
    `min-h-11 px-4 rounded-[60px] text-[13px] font-bold border transition-colors ${
      active ? 'bg-[#25282B] text-white border-[#25282B]' : 'bg-white text-[#25282B] border-[#E2E2E2] active:bg-[#F2F2F2]'
    }`

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end overflow-hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 anim-fade-in"
        onClick={onClose}
        aria-label="닫기"
        tabIndex={-1}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-sheet-title"
        className="relative z-10 w-full bg-white rounded-t-[12px] anim-slide-up shadow-[0_4px_16px_rgba(0,0,0,0.12)] text-[#25282B] flex flex-col max-h-[88%] overflow-hidden"
      >
        <div className="flex justify-center pt-2.5 shrink-0" aria-hidden="true">
          <div className="w-10 h-1 rounded-full bg-[#E2E2E2]" />
        </div>

        <div className="pl-5 pr-2 pt-2 pb-1 flex items-center justify-between gap-2 shrink-0">
          <h2 id="record-sheet-title" ref={titleRef} tabIndex={-1} className="text-[20px] font-extrabold tracking-tight outline-none">
            어느 가게를 기록할까요?
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 rounded-full shrink-0 flex items-center justify-center text-[#25282B] active:bg-[#F2F2F2]"
            aria-label="닫기"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div role="tablist" aria-label="가게 찾는 방법" className="px-5 pt-2 pb-3 shrink-0 flex gap-2 border-b border-[#E2E2E2]">
          {MODES.map(({ id, label, Icon }) => {
            const active = mode === id
            const count = id === 'saved' ? savedShops.length : id === 'nearby' ? ALL_SHOPS.length : null
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`record-panel-${id}`}
                id={`record-tab-${id}`}
                onClick={() => setMode(id)}
                className={`flex-1 min-h-11 rounded-[6px] text-[13px] font-bold flex items-center justify-center gap-1.5 transition-colors ${
                  active ? 'bg-[#25282B] text-white' : 'bg-[#F2F2F2] text-[#25282B] active:bg-[#E2E2E2]'
                }`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                <span>
                  {label}
                  {count !== null && <span className={active ? 'text-white/70' : 'text-[#6B6E73]'}> {count}</span>}
                </span>
              </button>
            )
          })}
        </div>

        <div
          className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 pt-4 pb-4"
          role="tabpanel"
          id={`record-panel-${mode}`}
          aria-labelledby={`record-tab-${mode}`}
        >
          {mode === 'nearby' && (
            <div className="anim-fade-in">
              <div className="flex items-center gap-2 pb-3 overflow-x-auto no-scrollbar -mx-5 px-5">
                <button type="button" onClick={() => setNearbyFilter('all')} aria-pressed={nearbyFilter === 'all'} className={filterChip(nearbyFilter === 'all')}>
                  전체 {ALL_SHOPS.length}
                </button>
                <button type="button" onClick={() => setNearbyFilter('500m')} aria-pressed={nearbyFilter === '500m'} className={filterChip(nearbyFilter === '500m')}>
                  500m 이내
                </button>
                <button type="button" onClick={() => setNearbyFilter('open')} aria-pressed={nearbyFilter === 'open'} className={filterChip(nearbyFilter === 'open')}>
                  영업 중만
                </button>
              </div>
              <p className="text-[12px] font-medium text-[#6B6E73] pb-1">가까운 순</p>
              <div className="divide-y divide-[#F2F2F2]">
                {nearbyList.map(shop => (
                  <ShopRow key={shop.id} shop={shop} onSelect={() => onSelectShop(shop.name)} />
                ))}
              </div>
              {nearbyList.length === 0 && (
                <p className="py-10 text-center text-[14px] text-[#6B6E73]">조건에 맞는 가게가 없어요.</p>
              )}
            </div>
          )}

          {mode === 'saved' && (
            <div className="anim-fade-in">
              {savedShops.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <Bookmark className="w-8 h-8 mx-auto text-[#BEBEBE]" aria-hidden="true" />
                  <p className="text-[15px] font-bold">찜한 가게가 없어요.</p>
                  <p className="text-[13px] text-[#6B6E73]">가게 상세에서 찜해 두면 여기서 바로 기록할 수 있어요.</p>
                </div>
              ) : (
                <>
                  <p className="text-[12px] font-medium text-[#6B6E73] pb-1">찜한 가게 {savedShops.length}곳</p>
                  <div className="divide-y divide-[#F2F2F2]">
                    {savedShops.map(shop => (
                      <ShopRow key={shop.id} shop={shop} onSelect={() => onSelectShop(shop.name)} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {mode === 'search' && (
            <div className="anim-fade-in space-y-4">
              <div className="relative">
                <label htmlFor="record-shop-search" className="sr-only">가게 검색</label>
                <input
                  id="record-shop-search"
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="가게 이름, 지역, 스타일"
                  className="w-full h-12 pl-10 pr-12 bg-[#F7F7F7] border border-[#E2E2E2] rounded-[6px] text-[14px] font-medium text-[#25282B] placeholder:text-[#6B6E73] outline-none focus:border-[#25282B] focus:bg-white transition-colors"
                />
                <Search className="w-4 h-4 text-[#6B6E73] absolute left-3.5 top-4 pointer-events-none" aria-hidden="true" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="검색어 지우기"
                    className="absolute right-0.5 top-0.5 w-11 h-11 flex items-center justify-center text-[#6B6E73]"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
              </div>

              {!searchQuery && (
                <div>
                  <p className="text-[12px] font-medium text-[#6B6E73] mb-2">빠른 검색어</p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_KEYWORDS.map(keyword => (
                      <button
                        key={keyword}
                        type="button"
                        onClick={() => setSearchQuery(keyword)}
                        className="min-h-11 px-4 rounded-[60px] border border-[#E2E2E2] bg-white text-[13px] font-bold text-[#25282B] active:bg-[#F2F2F2]"
                      >
                        {keyword}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {searchQuery && (
                <div>
                  <p className="text-[12px] font-medium text-[#6B6E73] pb-1" aria-live="polite">
                    검색 결과 {searchResults.length}건
                  </p>
                  {searchResults.length > 0 ? (
                    <div className="divide-y divide-[#F2F2F2]">
                      {searchResults.map(shop => (
                        <ShopRow key={shop.id} shop={shop} onSelect={() => onSelectShop(shop.name)} />
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center space-y-3">
                      <p className="text-[14px] text-[#6B6E73]">
                        ‘{searchQuery.trim()}’ 가게가 아직 목록에 없어요.
                      </p>
                      <button
                        type="button"
                        onClick={() => onSelectShop(searchQuery.trim())}
                        className="w-full min-h-12 rounded-[60px] bg-[#25282B] text-white text-[14px] font-bold active:bg-[#1A1C1E]"
                      >
                        ‘{searchQuery.trim()}’(으)로 바로 기록하기
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
