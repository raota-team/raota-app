import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import L from 'leaflet'
import { ChevronDown, ChevronRight, Check, Search, X, MapPin, List, Navigation, Map, Plus, Minus } from 'lucide-react'
import RamenIcon from '../components/icons/RamenIcon'
import { SHOP_CATALOG, type ShopCatalogItem } from '../data/shops'

interface Props {
  /** 탭이 보이는 상태인지. 숨겨졌다 다시 보일 때 지도 크기를 다시 계산한다. */
  isActive?: boolean
  selectedPin: number
  filter?: string
  onPinSelect: (i: number) => void
  onFilterChange?: (f: string) => void
  onShopClick: (shopName: string) => void
}

/** 지도 화면이 쓰는 매장 뷰 모델. 원장(`SHOP_CATALOG`)에서만 만든다. */
interface Shop {
  id: number
  name: string
  branch: string
  address: string
  style: string
  pinLabel: string
  dist: string
  distanceM: number
  isOpen: boolean
  status: string
  lastOrder?: string
  match: number
  lat: number
  lng: number
  photo?: string
  spec: string
}

const formatDistance = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${m}m`)

function toMapShop(shop: ShopCatalogItem): Shop {
  const operational = shop.businessStatus === 'OPERATIONAL'
  const isOpen = operational && shop.isOpen
  return {
    id: shop.id,
    name: shop.name,
    branch: shop.branch ?? '',
    address: shop.address,
    style: shop.style,
    pinLabel: shop.pinLabel,
    dist: formatDistance(shop.distanceM),
    distanceM: shop.distanceM,
    isOpen,
    status: operational ? (isOpen ? '영업 중' : '준비 중') : '영업 정보 확인 필요',
    lastOrder: shop.lastOrder,
    match: shop.matchScore,
    lat: shop.lat,
    lng: shop.lng,
    photo: shop.photos[0],
    spec: shop.spec,
  }
}

const SHOPS: Shop[] = SHOP_CATALOG.filter(shop => shop.lat && shop.lng).map(toMapShop)

const REGION_OPTIONS = [
  { value: 'ALL', label: '전체 지역', keys: [] as string[] },
  { value: '망원', label: '마포 · 망원동', keys: ['망원'] },
  { value: '합정', label: '마포 · 합정/상수', keys: ['합정', '상수'] },
  { value: '연남', label: '마포 · 연남/홍대', keys: ['연남', '홍대', '서교'] },
]

const MENU_OPTIONS = [
  { value: 'ALL', label: '모든 메뉴', keys: [] as string[] },
  { value: '쇼유', label: '쇼유 라멘 (간장)', keys: ['쇼유'] },
  { value: '돈코츠', label: '돈코츠/이에케 (돼지뼈)', keys: ['돈코츠', '이에케'] },
  { value: '시오', label: '시오 라멘 (소금)', keys: ['시오'] },
  { value: '미소', label: '미소 라멘 (된장)', keys: ['미소'] },
  { value: '토리파이탄', label: '토리파이탄 (닭백탕)', keys: ['토리파이탄', '닭백탕'] },
]

const USER_LOC = { lat: 37.5525, lng: 126.9165 } // 합정/서교 인근

// 📍 개별 라멘집 핀 마커 아이콘

function createCustomIcon(shop: Shop, isSelected: boolean) {
  const html = `
    <div style="position: absolute; left: 0; top: 0; transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; pointer-events: auto;">
      <div style="display: flex; flex-direction: column; align-items: center; gap: 3px;">
        <div style="
          width: ${isSelected ? '40px' : '32px'};
          height: ${isSelected ? '40px' : '32px'};
          background-color: ${isSelected ? '#E60000' : '#FFFFFF'};
          border: ${isSelected ? '2px solid #FFFFFF' : '1.5px solid #E2E2E2'};
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
          border-radius: 9999px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          outline: ${isSelected ? '3px solid rgba(230, 0, 0, 0.45)' : 'none'};
          overflow: hidden;
          padding: ${isSelected ? '6px' : '5px'};
        ">
          <img src="/logo.png" style="width: 100%; height: 100%; object-fit: contain; ${isSelected ? 'filter: brightness(0) invert(1);' : 'opacity: 0.85;'}" alt="RAOTA" />
        </div>
        
        <div style="
          background-color: ${isSelected ? '#E60000' : '#FFFFFF'};
          color: ${isSelected ? '#FFFFFF' : '#4A4D52'};
          border: 1px solid ${isSelected ? '#E60000' : '#E2E2E2'};
          padding: 3px 9px;
          border-radius: 32px;
          font-size: 12px;
          line-height: 1.2;
          font-weight: 800;
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(0,0,0,0.08);
        ">
          ${shop.name}
        </div>

        <div style="
          width: 0;
          height: 0;
          border-left: 4px solid transparent;
          border-right: 4px solid transparent;
          border-top: 5px solid ${isSelected ? '#E60000' : '#E2E2E2'};
          margin-top: -4px;
        "></div>
      </div>
    </div>
  `

  return L.divIcon({
    html,
    className: 'custom-leaflet-marker',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

// 🔢 줌 아웃 시 합쳐지는 클러스터 뱃지 아이콘 (플랫 레드 원형)
function createClusterIcon(count: number, hasSelected: boolean) {
  const size = count >= 10 ? 36 : count >= 5 ? 32 : 28
  const html = `
    <div style="position: absolute; left: 0; top: 0; transform: translate(-50%, -50%); display: flex; align-items: center; justify-content: center; cursor: pointer; pointer-events: auto;">
      <div style="
        width: ${size}px;
        height: ${size}px;
        background-color: #E60000;
        color: #FFFFFF;
        border: 2px solid #FFFFFF;
        border-radius: 9999px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        user-select: none;
        ${hasSelected ? 'outline: 3px solid rgba(230, 0, 0, 0.4);' : ''}
      ">
        <span style="font-size: 12px; font-weight: 900; line-height: 1; letter-spacing: -0.5px;">${count}</span>
      </div>
    </div>
  `

  return L.divIcon({
    html,
    className: 'custom-leaflet-cluster-marker',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

function createUserLocationIcon() {
  const html = `
    <div style="position: absolute; left: 0; top: 0; transform: translate(-50%, -50%); display: flex; align-items: center; justify-content: center; pointer-events: none;">
      <div style="
        width: 24px;
        height: 24px;
        background-color: rgba(230, 0, 0, 0.2);
        border-radius: 9999px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 12px;
          height: 12px;
          background-color: #E60000;
          border: 2.5px solid #FFFFFF;
          border-radius: 9999px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        "></div>
      </div>
    </div>
  `

  return L.divIcon({
    html,
    className: 'user-location-marker',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

interface ClusterGroup {
  lat: number
  lng: number
  shops: Shop[]
  hasSelected: boolean
}

// 줌 레벨에 따른 거리 기반 클러스터링 알고리즘
function clusterShops(shops: Shop[], map: L.Map, selectedPin: number): Array<{ type: 'single'; shop: Shop } | { type: 'cluster'; cluster: ClusterGroup }> {
  const zoom = map.getZoom()
  // 줌 레벨 15 이상이면 개별 매장 모두 상세 표시
  if (zoom >= 15) {
    return shops.map(shop => ({ type: 'single', shop }))
  }

  // 줌 레벨이 낮아질수록(멀어질수록) 합쳐지는 반경(픽셀) 증가
  const pixelThreshold = zoom <= 12 ? 80 : zoom <= 13 ? 65 : 48
  const clusters: ClusterGroup[] = []
  const assigned = new Set<number>()

  shops.forEach(shop => {
    if (assigned.has(shop.id)) return

    const shopPoint = map.latLngToContainerPoint([shop.lat, shop.lng])
    const nearby: Shop[] = [shop]
    assigned.add(shop.id)

    shops.forEach(other => {
      if (assigned.has(other.id)) return
      const otherPoint = map.latLngToContainerPoint([other.lat, other.lng])
      const dist = Math.hypot(shopPoint.x - otherPoint.x, shopPoint.y - otherPoint.y)
      if (dist <= pixelThreshold) {
        nearby.push(other)
        assigned.add(other.id)
      }
    })

    if (nearby.length === 1) {
      clusters.push({
        lat: shop.lat,
        lng: shop.lng,
        shops: nearby,
        hasSelected: selectedPin === shop.id,
      })
    } else {
      // 클러스터 앵커를 인근 매장 중 하나(선택 매장 우선)의 실제 GPS 좌표에 고정하여
      // 줌 인/아웃 시 아이콘이 엉뚱한 중간 허공으로 튀는 현상 방지
      const anchorShop = nearby.find(s => s.id === selectedPin) ?? nearby[0]
      clusters.push({
        lat: anchorShop.lat,
        lng: anchorShop.lng,
        shops: nearby,
        hasSelected: nearby.some(s => s.id === selectedPin),
      })
    }
  })

  return clusters.map(c => {
    if (c.shops.length === 1) {
      return { type: 'single', shop: c.shops[0] }
    }
    return { type: 'cluster', cluster: c }
  })
}

export default function MapScreen({ isActive = true, selectedPin, onPinSelect, onShopClick }: Props) {
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map')
  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const [sortBy, setSortBy] = useState<'dist' | 'match' | 'name'>('dist')
  const [onlyOpen, setOnlyOpen] = useState(false)
  
  // 📍 지역 및 🍜 메뉴 필터 상태 (raota-front 스펙)
  const [regionFilter, setRegionFilter] = useState('ALL')
  const [menuFilter, setMenuFilter] = useState('ALL')
  const [isRegionDropdownOpen, setIsRegionDropdownOpen] = useState(false)
  const [isMenuDropdownOpen, setIsMenuDropdownOpen] = useState(false)
  const regionDropdownRef = useRef<HTMLDivElement>(null)
  const menuDropdownRef = useRef<HTMLDivElement>(null)

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const currentMarkersRef = useRef<L.Marker[]>([])
  const filteredShopsRef = useRef<Shop[]>(SHOPS)
  const selectedPinRef = useRef(selectedPin)
  const onPinSelectRef = useRef(onPinSelect)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (regionDropdownRef.current && !regionDropdownRef.current.contains(event.target as Node)) {
        setIsRegionDropdownOpen(false)
      }
      if (menuDropdownRef.current && !menuDropdownRef.current.contains(event.target as Node)) {
        setIsMenuDropdownOpen(false)
      }
    }
    if (isRegionDropdownOpen || isMenuDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isRegionDropdownOpen, isMenuDropdownOpen])

  // 필터링 적용된 목록 (지역 + 메뉴 + 영업상태 + 검색어)
  const filteredShops = useMemo(() => SHOPS.filter(shop => {
    // 1. 영업 중 필터
    if (onlyOpen && !shop.isOpen) return false

    // 2. 지역 필터 (지점명 또는 주소)
    const regionKeys = REGION_OPTIONS.find(option => option.value === regionFilter)?.keys ?? []
    if (regionKeys.length > 0 && !regionKeys.some(key => shop.branch.includes(key) || shop.address.includes(key))) return false

    // 3. 메뉴(계통) 필터
    const menuKeys = MENU_OPTIONS.find(option => option.value === menuFilter)?.keys ?? []
    if (menuKeys.length > 0 && !menuKeys.some(key => shop.style.includes(key) || shop.spec.includes(key))) return false

    // 4. 키워드 검색
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const matchName = shop.name.toLowerCase().includes(q)
      const matchStyle = shop.style.toLowerCase().includes(q)
      const matchBranch = shop.branch.toLowerCase().includes(q)
      const matchSpec = shop.spec.toLowerCase().includes(q)
      if (!matchName && !matchStyle && !matchBranch && !matchSpec) return false
    }

    return true
  }).sort((a, b) => {
    if (sortBy === 'match') return b.match - a.match
    if (sortBy === 'name') return a.name.localeCompare(b.name)
    return a.distanceM - b.distanceM
  }), [menuFilter, onlyOpen, regionFilter, search, sortBy])

  const selected = filteredShops.find(shop => shop.id === selectedPin) ?? filteredShops[0] ?? null
  filteredShopsRef.current = filteredShops
  selectedPinRef.current = selectedPin
  onPinSelectRef.current = onPinSelect

  // 동적 마커 및 클러스터 렌더링 함수
  const renderMarkers = useCallback(() => {
    const map = mapInstanceRef.current
    if (!map) return

    // 이전 마커 일괄 제거
    currentMarkersRef.current.forEach(m => m.remove())
    currentMarkersRef.current = []

    // 현재 줌과 위치에 맞춘 클러스터링 계산
    const items = clusterShops(filteredShopsRef.current, map, selectedPinRef.current)

    items.forEach(item => {
      if (item.type === 'single') {
        const shop = item.shop
        const isSelected = selectedPinRef.current === shop.id
        const marker = L.marker([shop.lat, shop.lng], {
          icon: createCustomIcon(shop, isSelected),
          zIndexOffset: isSelected ? 1000 : 0,
        })

        marker.on('click', () => {
          onPinSelectRef.current(shop.id)
          map.flyTo([shop.lat, shop.lng], Math.max(map.getZoom(), 15.5), { duration: 0.45 })
        })

        marker.addTo(map)
        currentMarkersRef.current.push(marker)
      } else {
        const cluster = item.cluster
        const marker = L.marker([cluster.lat, cluster.lng], {
          icon: createClusterIcon(cluster.shops.length, cluster.hasSelected),
          zIndexOffset: cluster.hasSelected ? 900 : 100,
        })

        // 클러스터 클릭 시 해당 위치로 부드럽게 확대
        marker.on('click', () => {
          const nextZoom = Math.min(map.getZoom() + 2, 16)
          map.flyTo([cluster.lat, cluster.lng], nextZoom, { duration: 0.45 })
        })

        marker.addTo(map)
        currentMarkersRef.current.push(marker)
      }
    })
  }, [])

  // 지도 인스턴스 초기화 (viewMode === 'map'일 때)
  useEffect(() => {
    if (viewMode !== 'map') return
    if (!mapContainerRef.current) return

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
    }

    // 지도 생성: 서울 마포구 일대 중심
    const initialShop = SHOPS.find(shop => shop.id === selectedPinRef.current) ?? SHOPS[0]
    const map = L.map(mapContainerRef.current, {
      center: [initialShop.lat, initialShop.lng],
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
    })

    // OpenStreetMap 표준 타일 레이어
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    // 사용자 현재 위치 마커 추가
    L.marker([USER_LOC.lat, USER_LOC.lng], {
      icon: createUserLocationIcon(),
      interactive: false,
    }).addTo(map)

    mapInstanceRef.current = map

    // 줌/이동 이벤트 시 동적 클러스터링 갱신
    map.on('zoomend moveend', renderMarkers)

    // 렌더링 후 크기 재계산
    setTimeout(() => {
      map.invalidateSize()
      renderMarkers()
    }, 150)

    return () => {
      map.off('zoomend moveend', renderMarkers)
      map.remove()
      mapInstanceRef.current = null
    }
  }, [viewMode, renderMarkers])

  // 숨겨진 채 마운트됐다가 탭이 보이면 지도 크기를 다시 계산한다.
  useEffect(() => {
    if (!isActive || viewMode !== 'map') return
    const map = mapInstanceRef.current
    if (!map) return
    const frame = requestAnimationFrame(() => {
      map.invalidateSize()
      renderMarkers()
    })
    return () => cancelAnimationFrame(frame)
  }, [isActive, viewMode, renderMarkers])

  // 필터나 선택 핀 변경 시 마커 재렌더링
  useEffect(() => {
    if (viewMode === 'map' && mapInstanceRef.current) {
      renderMarkers()
    }
  }, [filteredShops, selectedPin, viewMode, renderMarkers])

  // 내 위치로 이동
  const handleGoToUserLocation = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([USER_LOC.lat, USER_LOC.lng], 15.5, { duration: 0.45 })
    }
  }

  // 줌 인/아웃
  const handleZoomIn = () => mapInstanceRef.current?.zoomIn()
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut()

  const hasActiveFilter = regionFilter !== 'ALL' || menuFilter !== 'ALL' || onlyOpen
  const regionLabel = REGION_OPTIONS.find(r => r.value === regionFilter)?.label ?? '전체 지역'
  const menuLabel = MENU_OPTIONS.find(m => m.value === menuFilter)?.label ?? '모든 메뉴'

  const filterButtonClass = (active: boolean) =>
    `w-full flex h-11 items-center justify-between gap-1.5 rounded-[6px] border px-3 text-[13px] font-bold transition-colors ${
      active ? 'bg-[#FFF0F0] border-[#E60000] text-[#E60000]' : 'bg-[#F2F2F2] border-[#E2E2E2] text-[#25282B]'
    }`
  const optionClass = (active: boolean) =>
    `w-full min-h-11 px-3.5 text-left text-[13px] flex items-center justify-between gap-2 active:bg-[#F2F2F2] transition-colors ${
      active ? 'font-bold text-[#E60000] bg-[#FFF0F0]' : 'text-[#25282B]'
    }`

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white text-[#25282B] relative">
      {/* 1. 검색창과 필터 */}
      <header className="bg-white px-4 pt-3 pb-3 border-b border-[#E2E2E2] z-20 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-[#F2F2F2] border border-[#E2E2E2] rounded-[6px] pl-3.5 pr-1 h-11">
            <Search className="w-4 h-4 text-[#6B6E73] shrink-0" aria-hidden="true" />
            <input
              className="flex-1 min-w-0 h-full bg-transparent text-[14px] font-medium text-[#25282B] placeholder-[#6B6E73] outline-none"
              placeholder="라멘집 이름, 계보, 지점 검색"
              value={search}
              onChange={e => { setSearch(e.target.value); setSearching(e.target.value.length > 0) }}
              aria-label="라멘집 검색"
            />
            {searching && (
              <button type="button" onClick={() => { setSearch(''); setSearching(false) }} className="w-10 h-10 flex items-center justify-center text-[#6B6E73]" aria-label="검색어 지우기">
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'map' ? 'list' : 'map')}
            className="h-11 px-3.5 rounded-[6px] bg-[#25282B] text-white text-[13px] font-bold flex items-center gap-1.5 active:scale-95 transition-transform flex-shrink-0"
            aria-label={viewMode === 'map' ? '목록으로 보기' : '지도로 보기'}
          >
            {viewMode === 'map' ? <List className="w-4 h-4" aria-hidden="true" /> : <Map className="w-4 h-4" aria-hidden="true" />}
            <span>{viewMode === 'map' ? '목록' : '지도'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2 pt-2.5">
          {/* 지역 필터 */}
          <div className="relative flex-1 min-w-0" ref={regionDropdownRef}>
            <button
              type="button"
              onClick={() => { setIsRegionDropdownOpen(prev => !prev); setIsMenuDropdownOpen(false) }}
              aria-expanded={isRegionDropdownOpen}
              aria-haspopup="listbox"
              aria-controls="map-region-options"
              aria-label={`지역 필터: ${regionLabel}`}
              className={filterButtonClass(regionFilter !== 'ALL')}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{regionLabel}</span>
              </span>
              <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isRegionDropdownOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>

            {isRegionDropdownOpen && (
              <ul id="map-region-options" role="listbox" aria-label="지역 선택" className="absolute left-0 top-full mt-1.5 z-40 w-48 rounded-[6px] border border-[#E2E2E2] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.12)] overflow-hidden anim-fade-in-up py-1">
                {REGION_OPTIONS.map(reg => (
                  <li key={reg.value} role="option" aria-selected={regionFilter === reg.value}>
                    <button type="button" onClick={() => { setRegionFilter(reg.value); setIsRegionDropdownOpen(false) }} className={optionClass(regionFilter === reg.value)}>
                      <span>{reg.label}</span>
                      {regionFilter === reg.value && <Check className="w-4 h-4 shrink-0" aria-hidden="true" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 메뉴(계통) 필터 */}
          <div className="relative flex-1 min-w-0" ref={menuDropdownRef}>
            <button
              type="button"
              onClick={() => { setIsMenuDropdownOpen(prev => !prev); setIsRegionDropdownOpen(false) }}
              aria-expanded={isMenuDropdownOpen}
              aria-haspopup="listbox"
              aria-controls="map-menu-options"
              aria-label={`메뉴 필터: ${menuLabel}`}
              className={filterButtonClass(menuFilter !== 'ALL')}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <RamenIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{menuLabel}</span>
              </span>
              <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isMenuDropdownOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>

            {isMenuDropdownOpen && (
              <ul id="map-menu-options" role="listbox" aria-label="메뉴 선택" className="absolute right-0 top-full mt-1.5 z-40 w-52 rounded-[6px] border border-[#E2E2E2] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.12)] overflow-hidden anim-fade-in-up py-1">
                {MENU_OPTIONS.map(menu => (
                  <li key={menu.value} role="option" aria-selected={menuFilter === menu.value}>
                    <button type="button" onClick={() => { setMenuFilter(menu.value); setIsMenuDropdownOpen(false) }} className={optionClass(menuFilter === menu.value)}>
                      <span>{menu.label}</span>
                      {menuFilter === menu.value && <Check className="w-4 h-4 shrink-0" aria-hidden="true" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 영업 중만 보기 */}
          <button
            type="button"
            onClick={() => setOnlyOpen(prev => !prev)}
            aria-pressed={onlyOpen}
            className={`h-11 px-3 rounded-[6px] border text-[13px] font-bold transition-colors flex items-center gap-1.5 shrink-0 ${
              onlyOpen ? 'bg-[#25282B] text-white border-[#25282B]' : 'bg-[#F2F2F2] border-[#E2E2E2] text-[#25282B]'
            }`}
          >
            <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full ${onlyOpen ? 'bg-white' : 'bg-[#2E7D32]'}`} />
            <span>영업 중</span>
          </button>

          {hasActiveFilter && (
            <button
              type="button"
              onClick={() => { setRegionFilter('ALL'); setMenuFilter('ALL'); setOnlyOpen(false) }}
              className="h-11 w-11 rounded-[6px] bg-[#F2F2F2] text-[#25282B] flex items-center justify-center shrink-0 active:bg-[#E2E2E2] transition-colors"
              aria-label="필터 초기화"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      {/* 2. 지도 뷰 또는 목록 뷰 */}
      {viewMode === 'map' ? (
        <div className="flex-1 min-h-0 relative overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0 relative overflow-hidden">
            <div ref={mapContainerRef} className="w-full h-full" style={{ zIndex: 1 }} />

            {/* 지도 컨트롤 */}
            <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleGoToUserLocation}
                className="w-11 h-11 rounded-[6px] bg-white border border-[#E2E2E2] text-[#25282B] shadow-[0_4px_16px_rgba(0,0,0,0.12)] flex items-center justify-center active:bg-[#F2F2F2] transition-colors"
                aria-label="내 위치로 이동"
              >
                <Navigation className="w-4.5 h-4.5" aria-hidden="true" />
              </button>
              <div className="bg-white border border-[#E2E2E2] rounded-[6px] shadow-[0_4px_16px_rgba(0,0,0,0.12)] overflow-hidden flex flex-col divide-y divide-[#E2E2E2]">
                <button type="button" onClick={handleZoomIn} className="w-11 h-11 flex items-center justify-center text-[#25282B] active:bg-[#F2F2F2] transition-colors" aria-label="확대">
                  <Plus className="w-5 h-5" aria-hidden="true" />
                </button>
                <button type="button" onClick={handleZoomOut} className="w-11 h-11 flex items-center justify-center text-[#25282B] active:bg-[#F2F2F2] transition-colors" aria-label="축소">
                  <Minus className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* 지도 데이터 출처 */}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
              className="absolute bottom-0 right-0 z-10 min-h-11 pl-3 pr-2 pb-2 flex items-end"
            >
              <span className="text-[12px] font-medium text-[#6B6E73] bg-white/90 px-2 py-0.5 rounded-[4px]">© OpenStreetMap contributors</span>
            </a>
          </div>

          {/* 선택 매장 요약 */}
          <footer className="bg-white border-t border-[#E2E2E2] p-4 z-20 flex-shrink-0">
            {selected ? (
              <button
                type="button"
                onClick={() => onShopClick(selected.name)}
                className="w-full text-left flex items-center gap-3.5 active:opacity-80 transition-opacity"
              >
                <div className="w-16 h-16 rounded-[6px] overflow-hidden bg-[#E9E9E9] flex-shrink-0">
                  {selected.photo && <img src={selected.photo} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[15px] font-bold truncate">
                      {selected.name}
                      {selected.branch && <span className="text-[#6B6E73]"> · {selected.branch}</span>}
                    </span>
                    <span className="text-[12px] font-bold text-[#25282B] bg-[#F2F2F2] px-2 py-0.5 rounded-[4px] shrink-0">{selected.style}</span>
                  </div>
                  <p className="text-[13px] text-[#6B6E73] mt-0.5 truncate">{selected.spec}</p>
                  <div className="flex items-center gap-1.5 mt-1 text-[12px] font-bold">
                    <span className={selected.isOpen ? 'text-[#2E7D32]' : 'text-[#6B6E73]'}>● {selected.status}</span>
                    <span className="text-[#BEBEBE]" aria-hidden="true">·</span>
                    <span className="text-[#6B6E73]">{selected.dist}</span>
                    {selected.match > 0 && (
                      <>
                        <span className="text-[#BEBEBE]" aria-hidden="true">·</span>
                        <span className="text-[#E60000]">일치도 {selected.match}%</span>
                      </>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[#6B6E73] shrink-0" aria-hidden="true" />
              </button>
            ) : (
              <div className="py-3 text-center">
                <p className="text-[15px] font-bold">조건에 맞는 라멘집이 없어요</p>
                <p className="mt-1 text-[13px] text-[#6B6E73]">검색어나 필터를 바꿔 다시 찾아보세요.</p>
              </div>
            )}
          </footer>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#E2E2E2]">
            <span className="text-[13px] font-bold text-[#6B6E73]">
              총 <span className="text-[#25282B] font-extrabold">{filteredShops.length}곳</span>
            </span>
            <div className="flex items-center gap-1 text-[13px] font-bold" role="group" aria-label="정렬">
              {([['dist', '거리순'], ['match', '취향순'], ['name', '이름순']] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSortBy(key)}
                  aria-pressed={sortBy === key}
                  className={`min-h-11 px-2.5 rounded-[4px] transition-colors ${sortBy === key ? 'bg-[#25282B] text-white' : 'text-[#6B6E73]'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <ul className="mt-3 space-y-2.5">
            {filteredShops.map(shop => (
              <li key={shop.id}>
                <button
                  type="button"
                  onClick={() => onShopClick(shop.name)}
                  className="w-full text-left bg-white rounded-[6px] border border-[#E2E2E2] p-3.5 active:bg-[#F2F2F2] transition-colors flex items-center gap-3.5"
                >
                  <div className="w-18 h-18 rounded-[6px] overflow-hidden bg-[#E9E9E9] flex-shrink-0">
                    {shop.photo && <img src={shop.photo} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[15px] font-bold truncate">
                        {shop.name}
                        {shop.branch && <span className="text-[#6B6E73]"> · {shop.branch}</span>}
                      </h3>
                      {shop.match > 0 && <span className="text-[13px] font-extrabold text-[#E60000] shrink-0 tabular-nums">{shop.match}%</span>}
                    </div>
                    <p className="text-[13px] text-[#6B6E73] mt-0.5 truncate">{shop.style} · {shop.spec}</p>
                    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-[#F2F2F2] text-[12px] font-bold text-[#6B6E73] whitespace-nowrap overflow-hidden">
                      <span className={shop.isOpen ? 'text-[#2E7D32]' : 'text-[#6B6E73]'}>● {shop.status}</span>
                      <span className="text-[#BEBEBE]" aria-hidden="true">·</span>
                      <span>{shop.dist}</span>
                      {shop.lastOrder && (
                        <>
                          <span className="text-[#BEBEBE]" aria-hidden="true">·</span>
                          <span>라스트오더 {shop.lastOrder}</span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          {filteredShops.length === 0 && (
            <div className="mt-3 rounded-[6px] border border-dashed border-[#BEBEBE] px-5 py-10 text-center">
              <p className="text-[15px] font-bold">검색 결과가 없어요</p>
              <p className="mt-1 text-[13px] text-[#6B6E73]">다른 매장명이나 라멘 종류로 찾아보세요.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
