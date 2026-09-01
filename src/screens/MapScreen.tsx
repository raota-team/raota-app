import { useEffect, useRef, useState, useCallback } from 'react'
import L from 'leaflet'

interface Props {
  selectedPin: number
  filter: string
  onPinSelect: (i: number) => void
  onFilterChange: (f: string) => void
  onShopClick: () => void
}

interface Shop {
  id: number
  name: string
  branch: string
  style: string
  pinLabel: string
  dist: string
  status: string
  lastOrder: string
  match: number
  lat: number
  lng: number
  photo: string
  spec: string
}

const FILTERS = ['전체', '영업 중', '쇼유(간장)', '돈코츠(돼지뼈)', '미소(된장)', '시오(소금)', '토리파이탄']

const SHOPS: Shop[] = [
  {
    id: 0,
    name: '멘야준',
    branch: '망원 본점',
    style: '쇼유 라멘',
    pinLabel: '준',
    dist: '420m',
    status: '영업 중',
    lastOrder: '20:30',
    match: 91,
    lat: 37.5559,
    lng: 126.9114,
    photo: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=300&h=200&fit=crop&auto=format&q=80',
    spec: '자가제면 · 닭과 오리 더블 육수',
  },
  {
    id: 1,
    name: '후쿠 라멘',
    branch: '합정점',
    style: '미소 라멘',
    pinLabel: '후',
    dist: '680m',
    status: '영업 중',
    lastOrder: '21:00',
    match: 82,
    lat: 37.5492,
    lng: 126.9150,
    photo: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=300&h=200&fit=crop&auto=format&q=80',
    spec: '진한 삿포로 적된장 육수',
  },
  {
    id: 2,
    name: '오레노라멘',
    branch: '마포 본점',
    style: '토리파이탄',
    pinLabel: '오',
    dist: '1.4km',
    status: '영업 중',
    lastOrder: '20:00',
    match: 75,
    lat: 37.5484,
    lng: 126.9208,
    photo: 'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=300&h=200&fit=crop&auto=format&q=80',
    spec: '닭백탕 · 미쉐린 빕구르망',
  },
  {
    id: 3,
    name: '묘코',
    branch: '연남점',
    style: '쇼유 라멘',
    pinLabel: '묘',
    dist: '1.1km',
    status: '준비 중',
    lastOrder: '20:30',
    match: 78,
    lat: 37.5620,
    lng: 126.9240,
    photo: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=300&h=200&fit=crop&auto=format&q=80',
    spec: '깔끔한 청탕 오리 육수',
  },
  {
    id: 4,
    name: '세상끝의라멘',
    branch: '합정점',
    style: '쇼유 라멘',
    pinLabel: '세',
    dist: '850m',
    status: '영업 중',
    lastOrder: '20:30',
    match: 88,
    lat: 37.5502,
    lng: 126.9135,
    photo: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=300&h=200&fit=crop&auto=format&q=80',
    spec: '오사카식 블랙 쇼유와 차슈 덮밥',
  },
  {
    id: 5,
    name: '멘지',
    branch: '망원 본점',
    style: '토리파이탄',
    pinLabel: '멘',
    dist: '550m',
    status: '영업 중',
    lastOrder: '20:00',
    match: 84,
    lat: 37.5562,
    lng: 126.9065,
    photo: 'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=300&h=200&fit=crop&auto=format&q=80',
    spec: '극상의 진한 닭백탕 육수',
  },
  {
    id: 6,
    name: '하쿠텐',
    branch: '연남점',
    style: '돈코츠 라멘',
    pinLabel: '하',
    dist: '1.2km',
    status: '영업 중',
    lastOrder: '20:30',
    match: 93,
    lat: 37.5612,
    lng: 126.9255,
    photo: 'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=300&h=200&fit=crop&auto=format&q=80',
    spec: '진한 요코하마식 이에케 라멘',
  },
  {
    id: 7,
    name: '담택',
    branch: '합정점',
    style: '시오 라멘',
    pinLabel: '담',
    dist: '720m',
    status: '영업 중',
    lastOrder: '20:00',
    match: 89,
    lat: 37.5510,
    lng: 126.9160,
    photo: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=300&h=200&fit=crop&auto=format&q=80',
    spec: '깔끔한 닭육수 유자 시오 라멘',
  },
  {
    id: 8,
    name: '이리에라멘',
    branch: '망원점',
    style: '시오 라멘',
    pinLabel: '이',
    dist: '490m',
    status: '영업 중',
    lastOrder: '20:30',
    match: 87,
    lat: 37.5548,
    lng: 126.9080,
    photo: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=300&h=200&fit=crop&auto=format&q=80',
    spec: '도미 뼈로 우려낸 감칠맛 도미 시오',
  },
  {
    id: 9,
    name: '무타히로',
    branch: '홍대점',
    style: '쇼유 라멘',
    pinLabel: '무',
    dist: '1.5km',
    status: '준비 중',
    lastOrder: '20:30',
    match: 81,
    lat: 37.5570,
    lng: 126.9290,
    photo: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=300&h=200&fit=crop&auto=format&q=80',
    spec: '멸치(니보시) 육수의 깊은 감칠맛',
  },
]

const USER_LOC = { lat: 37.5525, lng: 126.9165 } // 합정/서교 인근

// 📍 개별 라멘야 핀 마커 아이콘
function createCustomIcon(shop: Shop, isSelected: boolean) {
  const html = `
    <div style="position: absolute; left: 0; top: 0; transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; pointer-events: auto;">
      <div style="display: flex; flex-direction: column; align-items: center; gap: 3px;">
        <div style="
          width: ${isSelected ? '40px' : '32px'};
          height: ${isSelected ? '40px' : '32px'};
          background-color: ${isSelected ? '#E60000' : '#FFFFFF'};
          border: ${isSelected ? '2px solid #FFFFFF' : '1.5px solid #E2E2E2'};
          box-shadow: ${isSelected ? '0 4px 14px rgba(230,0,0,0.35)' : '0 2px 8px rgba(0,0,0,0.08)'};
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
          padding: 2px 8px;
          border-radius: 32px;
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
          box-shadow: ${isSelected ? '0 2px 8px rgba(230,0,0,0.25)' : '0 2px 6px rgba(0,0,0,0.06)'};
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
        <span style="font-size: ${size >= 36 ? '12px' : '11px'}; font-weight: 900; line-height: 1; letter-spacing: -0.5px;">${count}</span>
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

export default function MapScreen({ selectedPin, filter, onPinSelect, onFilterChange, onShopClick }: Props) {
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map')
  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const [sortBy, setSortBy] = useState<'dist' | 'popular' | 'name'>('dist')
  const [onlyOpen, setOnlyOpen] = useState(false)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const currentMarkersRef = useRef<L.Marker[]>([])

  const selected = SHOPS.find(s => s.id === selectedPin) ?? SHOPS[0]

  // 필터링 적용된 목록
  const filteredShops = SHOPS.filter(shop => {
    if (onlyOpen && shop.status !== '영업 중') return false

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const matchName = shop.name.toLowerCase().includes(q)
      const matchStyle = shop.style.toLowerCase().includes(q)
      const matchBranch = shop.branch.toLowerCase().includes(q)
      const matchSpec = shop.spec.toLowerCase().includes(q)
      if (!matchName && !matchStyle && !matchBranch && !matchSpec) return false
    }

    if (filter === '전체' || filter === '') return true
    if (filter === '영업 중') return shop.status === '영업 중'
    if (filter.includes('쇼유')) return shop.style.includes('쇼유')
    if (filter.includes('돈코츠')) return shop.style.includes('돈코츠')
    if (filter.includes('미소')) return shop.style.includes('미소')
    if (filter.includes('시오')) return shop.style.includes('시오')
    if (filter.includes('토리파이탄')) return shop.style.includes('토리파이탄')
    return true
  }).sort((a, b) => {
    if (sortBy === 'popular') return b.match - a.match
    if (sortBy === 'name') return a.name.localeCompare(b.name)
    return parseFloat(a.dist) - parseFloat(b.dist)
  })

  // 동적 마커 및 클러스터 렌더링 함수
  const renderMarkers = useCallback(() => {
    const map = mapInstanceRef.current
    if (!map) return

    // 이전 마커 일괄 제거
    currentMarkersRef.current.forEach(m => m.remove())
    currentMarkersRef.current = []

    // 현재 줌과 위치에 맞춘 클러스터링 계산
    const items = clusterShops(filteredShops, map, selectedPin)

    items.forEach(item => {
      if (item.type === 'single') {
        const shop = item.shop
        const isSelected = selectedPin === shop.id
        const marker = L.marker([shop.lat, shop.lng], {
          icon: createCustomIcon(shop, isSelected),
          zIndexOffset: isSelected ? 1000 : 0,
        })

        marker.on('click', () => {
          onPinSelect(shop.id)
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
  }, [filteredShops, selectedPin, onPinSelect])

  // 지도 인스턴스 초기화 (viewMode === 'map'일 때)
  useEffect(() => {
    if (viewMode !== 'map') return
    if (!mapContainerRef.current) return

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
    }

    // 지도 생성: 서울 마포구 일대 중심
    const map = L.map(mapContainerRef.current, {
      center: [selected.lat, selected.lng],
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
    })

    // 오픈소스 CartoDB Voyager 타일 레이어
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
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

  // 필터나 선택 핀 변경 시 마커 재렌더링
  useEffect(() => {
    if (viewMode === 'map' && mapInstanceRef.current) {
      renderMarkers()
    }
  }, [viewMode, renderMarkers])

  // 내 위치로 이동
  const handleGoToUserLocation = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([USER_LOC.lat, USER_LOC.lng], 15.5, { duration: 0.45 })
    }
  }

  // 줌 인/아웃
  const handleZoomIn = () => mapInstanceRef.current?.zoomIn()
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut()

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#FFFFFF] text-[#25282B] relative">
      
      {/* 1. 상단 검색창 및 필터 탭 바 */}
      <header className="bg-white/95 backdrop-blur-md px-4 pt-12 pb-3.5 border-b border-[#E2E2E2] z-20 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-[#F2F2F2] border border-[#E2E2E2] rounded-[6px] px-3.5 h-11">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7E7E7E" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              className="flex-1 bg-transparent text-[13px] font-bold text-[#25282B] placeholder-[#8A8A8A] outline-none"
              placeholder="라멘야 상호, 지하철역, 계보 검색"
              value={search}
              onChange={e => { setSearch(e.target.value); setSearching(e.target.value.length > 0) }}
              aria-label="라멘야 검색"
            />
            {searching && (
              <button onClick={() => { setSearch(''); setSearching(false) }} className="text-[#7E7E7E]" aria-label="지우기">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>

          {/* 🗺️ 지도 ⇄ ☰ 목록 뷰 모드 토글 버튼 */}
          <button
            onClick={() => setViewMode(viewMode === 'map' ? 'list' : 'map')}
            className="h-11 px-3.5 rounded-[6px] bg-[#25282B] text-white text-[12px] font-bold flex items-center gap-1.5 active:scale-95 transition-all shadow-sm flex-shrink-0"
            aria-label={viewMode === 'map' ? '목록으로 보기' : '지도로 보기'}
          >
            {viewMode === 'map' ? (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                  <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
                </svg>
                <span>목록</span>
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                  <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
                  <line x1="9" y1="3" x2="9" y2="18"/>
                  <line x1="15" y1="6" x2="15" y2="21"/>
                </svg>
                <span>지도</span>
              </>
            )}
          </button>
        </div>

        {/* 필터 칩 목록 (보더폰 32px 칩) */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pt-2.5">
          {FILTERS.map(f => {
            const raw = f.split('(')[0]
            const active = filter === raw || (filter === '전체' && raw === '전체')
            return (
              <button
                key={f}
                onClick={() => onFilterChange(raw)}
                className={`flex-shrink-0 h-7 px-3 rounded-[32px] text-[11px] font-bold border transition-all ${
                  active
                    ? 'bg-[#25282B] text-white border-[#25282B]'
                    : 'bg-[#F2F2F2] text-[#25282B] border-transparent hover:border-[#25282B]'
                }`}
              >
                {f}
              </button>
            )
          })}
        </div>
      </header>

      {/* 2. 본문 영역: [지도 뷰] vs [목록 뷰] */}
      {viewMode === 'map' ? (
        <div className="flex-1 relative overflow-hidden flex flex-col justify-between">
          <div className="flex-1 relative overflow-hidden">
            <div ref={mapContainerRef} className="w-full h-full" style={{ zIndex: 1 }} />

            {/* 지도 우측 상단 플로팅 컨트롤 (줌 및 GPS) */}
            <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
              {/* 내 위치 버튼 */}
              <button
                onClick={handleGoToUserLocation}
                className="w-10 h-10 rounded-[6px] bg-white border border-[#E2E2E2] text-[#25282B] shadow-md flex items-center justify-center hover:bg-[#F2F2F2] active:scale-95 transition-all"
                aria-label="내 위치로 이동"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="7"/>
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                </svg>
              </button>

              {/* 줌 인/아웃 */}
              <div className="bg-white border border-[#E2E2E2] rounded-[6px] shadow-md overflow-hidden flex flex-col divide-y divide-[#E2E2E2]">
                <button
                  onClick={handleZoomIn}
                  className="w-10 h-9 flex items-center justify-center text-[18px] font-bold text-[#25282B] hover:bg-[#F2F2F2] active:scale-95"
                  aria-label="확대"
                >
                  +
                </button>
                <button
                  onClick={handleZoomOut}
                  className="w-10 h-9 flex items-center justify-center text-[18px] font-bold text-[#25282B] hover:bg-[#F2F2F2] active:scale-95"
                  aria-label="축소"
                >
                  −
                </button>
              </div>
            </div>

            {/* 지도 데이터 출처 표기 */}
            <div className="absolute bottom-2 right-3 z-10 text-[9px] font-bold text-[#7E7E7E] bg-white/90 backdrop-blur-xs px-2.5 py-0.5 rounded-[6px] border border-[#E2E2E2] pointer-events-none">
              © OpenStreetMap · CARTO
            </div>
          </div>

          {/* 하단 선택 매장 퀵 뷰 드로어 */}
          <footer className="bg-white border-t border-[#E2E2E2] p-4 z-20 flex-shrink-0">
            <div
              onClick={onShopClick}
              className="flex items-center gap-3.5 p-3.5 bg-[#F2F2F2] rounded-[6px] cursor-pointer hover:bg-[#EAEAEA] active:scale-99 transition-all group"
            >
              <div className="w-16 h-16 rounded-[6px] overflow-hidden bg-white flex-shrink-0 border border-[#E2E2E2]">
                <img src={selected.photo} alt={selected.name} className="w-full h-full object-cover" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-black text-[#25282B] truncate">{selected.name} · {selected.branch}</span>
                  <span className="text-[10px] font-bold text-[#25282B] bg-[#EAEAEA] px-2 py-0.5 rounded-[32px]">
                    {selected.style}
                  </span>
                </div>
                <p className="text-[11px] text-[#7E7E7E] mt-0.5">{selected.spec}</p>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-[#7E7E7E]">
                  <span className="text-[#2E7D32] font-bold">● {selected.status}</span>
                  <span>·</span>
                  <span>거리 {selected.dist}</span>
                </div>
              </div>

              <span className="text-[12px] font-bold text-[#E60000] group-hover:translate-x-1 transition-transform">
                →
              </span>
            </div>
          </footer>
        </div>
      ) : (
        /* 📜 전체 라멘야 목록 뷰 */
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3">
          
          {/* 목록 상단 헤더 & 정렬 바 */}
          <div className="flex items-center justify-between pb-2 border-b border-[#E2E2E2]">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold text-[#7E7E7E]">
                총 <span className="text-[#25282B] font-black">{filteredShops.length}곳</span>
              </span>
              <button
                onClick={() => setOnlyOpen(!onlyOpen)}
                className={`h-6 px-2 rounded-[32px] text-[10px] font-bold border transition-all flex items-center gap-1 ${
                  onlyOpen
                    ? 'bg-[#2E7D32] text-white border-[#2E7D32]'
                    : 'bg-[#F2F2F2] text-[#4A4D52] border-transparent hover:border-[#25282B]'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${onlyOpen ? 'bg-white' : 'bg-[#2E7D32]'}`} />
                영업 중만
              </button>
            </div>

            <div className="flex items-center gap-1 text-[11px] font-bold">
              <button
                onClick={() => setSortBy('dist')}
                className={`px-2 py-0.5 rounded-[4px] ${sortBy === 'dist' ? 'bg-[#25282B] text-white' : 'text-[#7E7E7E]'}`}
              >
                거리순
              </button>
              <button
                onClick={() => setSortBy('popular')}
                className={`px-2 py-0.5 rounded-[4px] ${sortBy === 'popular' ? 'bg-[#25282B] text-white' : 'text-[#7E7E7E]'}`}
              >
                인기순
              </button>
              <button
                onClick={() => setSortBy('name')}
                className={`px-2 py-0.5 rounded-[4px] ${sortBy === 'name' ? 'bg-[#25282B] text-white' : 'text-[#7E7E7E]'}`}
              >
                이름순
              </button>
            </div>
          </div>

          {/* 라멘야 카드 리스트 */}
          <div className="space-y-2.5">
            {filteredShops.map(shop => (
              <article
                key={shop.id}
                onClick={onShopClick}
                className="bg-white rounded-[6px] border border-[#E2E2E2] p-3.5 hover:border-[#25282B] active:scale-99 transition-all cursor-pointer flex items-center gap-3.5 group"
              >
                <div className="w-18 h-18 rounded-[6px] overflow-hidden bg-[#F2F2F2] flex-shrink-0 border border-[#E2E2E2]">
                  <img src={shop.photo} alt={shop.name} className="w-full h-full object-cover" />
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-[15px] font-black text-[#25282B] truncate group-hover:text-[#E60000] transition-colors">
                    {shop.name} · {shop.branch}
                  </h3>

                  <p className="text-[11px] text-[#7E7E7E] mt-0.5 truncate">{shop.spec}</p>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#F2F2F2] text-[11px]">
                    <div className="flex items-center gap-1.5 text-[#7E7E7E] whitespace-nowrap min-w-0">
                      <span className={shop.status === '영업 중' ? 'text-[#2E7D32] font-bold' : 'text-[#7E7E7E] font-bold'}>
                        ● {shop.status}
                      </span>
                      <span>·</span>
                      <span>{shop.dist}</span>
                      <span>·</span>
                      <span>LO {shop.lastOrder}</span>
                    </div>

                    <span className="text-[10px] font-bold text-[#25282B] bg-[#F2F2F2] px-2 py-0.5 rounded-[32px] flex-shrink-0">
                      {shop.style}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
