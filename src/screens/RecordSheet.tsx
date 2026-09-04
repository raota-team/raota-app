import { useState, useMemo } from 'react'
import { Crosshair, Bookmark, Search, X, MapPin } from 'lucide-react'

export type RecordSheetMode = 'nearby' | 'saved' | 'search'

interface Props {
  initialMode?: RecordSheetMode
  onClose: () => void
  onSelectShop: (shopName: string) => void
}

interface ShopItem {
  id: string | number
  name: string
  branch: string
  style: string
  broth?: string
  dist?: string
  distMeters?: number
  status?: '영업 중' | '준비 중' | '마감'
  photo: string
  tags: string[]
  memo?: string
  savedDate?: string
  region: string
}

const ALL_SHOPS: ShopItem[] = [
  {
    id: 1,
    name: '멘야준',
    branch: '망원 본점',
    style: '특제 쇼유 라멘',
    broth: '닭과 오리 더블 육수',
    dist: '420m',
    distMeters: 420,
    status: '영업 중',
    photo: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=400&h=400&fit=crop&auto=format&q=80',
    tags: ['자가제면', '수비드 차슈'],
    memo: '특제 쇼유 + 차슈 추가 필수!',
    savedDate: '2026.08.28',
    region: '망원동',
  },
  {
    id: 2,
    name: '후쿠 라멘',
    branch: '합정점',
    style: '진한 삿포로 미소 라멘',
    broth: '돼지뼈 육수와 볶음 채소',
    dist: '680m',
    distMeters: 680,
    status: '영업 중',
    photo: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=400&h=400&fit=crop&auto=format&q=80',
    tags: ['불향 가득', '꼬불꼬불 면'],
    region: '합정동',
  },
  {
    id: 3,
    name: '하쿠텐',
    branch: '연남점',
    style: '진한 농후 이에케 라멘',
    broth: '진한 돈골 육수 & 닭기름',
    dist: '950m',
    distMeters: 950,
    status: '영업 중',
    photo: 'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=400&h=400&fit=crop&auto=format&q=80',
    tags: ['이에케', '밥 무한리필', '김 추가'],
    memo: '평일 오픈런 추천, 농후한 국물!',
    savedDate: '2026.08.15',
    region: '연남동',
  },
  {
    id: 4,
    name: '세상끝의라멘',
    branch: '합정점',
    style: '오사카식 블랙 쇼유 & 차슈',
    broth: '진한 간장 타레와 닭 육수',
    dist: '1.1km',
    distMeters: 1100,
    status: '영업 중',
    photo: 'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=400&h=400&fit=crop&auto=format&q=80',
    tags: ['오사카 블랙', '면 리필 1회 무료'],
    region: '합정동',
  },
  {
    id: 5,
    name: '오레노라멘',
    branch: '마포 본점',
    style: '토리파이탄 (닭백탕 라멘)',
    broth: '거품 낸 진한 닭 육수',
    dist: '1.4km',
    distMeters: 1400,
    status: '영업 중',
    photo: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=400&h=400&fit=crop&auto=format&q=80',
    tags: ['미쉐린 빕구르망', '자가제면'],
    region: '마포구',
  },
  {
    id: 6,
    name: '묘코',
    branch: '연남점',
    style: '특제 오리 시오 라멘',
    broth: '깔끔한 청탕 오리 육수',
    dist: '1.5km',
    distMeters: 1500,
    status: '준비 중',
    photo: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=400&h=400&fit=crop&auto=format&q=80',
    tags: ['오리가슴살 차슈', '깔끔담백'],
    region: '연남동',
  },
  {
    id: 7,
    name: '담택',
    branch: '합정 본점',
    style: '깔끔한 유자 시오 라멘',
    broth: '맑은 닭 육수와 상큼한 유자',
    dist: '1.8km',
    distMeters: 1800,
    status: '영업 중',
    photo: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=400&h=400&fit=crop&auto=format&q=80',
    tags: ['유자 시오', '가정식 라멘'],
    memo: '유자 시오 라멘 꼭 먹어보기',
    savedDate: '2026.07.20',
    region: '합정동',
  },
  {
    id: 8,
    name: '이리에라멘',
    branch: '합정점',
    style: '진한 도미 시오 라멘',
    broth: '통도미를 우려낸 해산물 육수',
    dist: '1.9km',
    distMeters: 1900,
    status: '영업 중',
    photo: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=400&h=400&fit=crop&auto=format&q=80',
    tags: ['도미 육수', '아부라소바'],
    region: '합정동',
  },
]

const SAVED_SHOPS = ALL_SHOPS.filter(s => !!s.memo)

const POPULAR_KEYWORDS = [
  '자가제면',
  '이에케',
  '쇼유',
  '토리파이탄',
  '미쉐린',
  '시오',
  '망원동',
  '합정동',
  '연남동',
]

export default function RecordSheet({
  initialMode = 'nearby',
  onClose,
  onSelectShop,
}: Props) {
  const [mode, setMode] = useState<RecordSheetMode>(initialMode)
  const [nearbyFilter, setNearbyFilter] = useState<'all' | 'open' | '500m'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // 주변 라멘집 필터링
  const nearbyList = useMemo(() => {
    return ALL_SHOPS.filter(shop => {
      if (nearbyFilter === 'open' && shop.status !== '영업 중') return false
      if (nearbyFilter === '500m' && (shop.distMeters || 9999) > 500) return false
      return true
    })
  }, [nearbyFilter])

  // 검색 결과 필터링
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return ALL_SHOPS.filter(shop =>
      shop.name.toLowerCase().includes(q) ||
      shop.branch.toLowerCase().includes(q) ||
      shop.style.toLowerCase().includes(q) ||
      shop.region.toLowerCase().includes(q) ||
      shop.tags.some(t => t.toLowerCase().includes(q))
    )
  }, [searchQuery])

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end overflow-hidden" role="dialog" aria-modal="true">
      {/* 백드롭 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-xs anim-fade-in"
        onClick={onClose}
        aria-label="닫기"
        role="button"
      />

      {/* 시트 모달 */}
      <div className="relative z-10 w-full bg-white rounded-t-[20px] anim-slide-up border-t border-[#E2E2E2] shadow-2xl text-[#25282B] flex flex-col max-h-[85%] overflow-hidden">
        {/* 핸들 바 */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-stone-300" />
        </div>

        {/* 헤더 */}
        <div className="px-5 pt-2 pb-3 flex items-center justify-between border-b border-[#E2E2E2] shrink-0">
          <div>
            <span className="text-[10px] font-black text-[#E60000] tracking-wider uppercase block">
              라멘로그 기록하기
            </span>
            <h2 className="text-[17px] font-black text-[#25282B] tracking-tight mt-0.5">
              어느 가게의 라멘을 기록할까요?
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-[#E60000] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="닫기"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* 3가지 모드 탭 스위처 */}
        <div className="px-5 pt-3 pb-2 shrink-0 bg-[#FAFAFA] border-b border-[#E2E2E2]">
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#ECECEC] rounded-[8px]">
            <button
              type="button"
              onClick={() => setMode('nearby')}
              className={`py-2 px-1 rounded-[6px] text-[12px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                mode === 'nearby'
                  ? 'bg-white text-[#25282B] shadow-xs'
                  : 'text-[#7E7E7E] hover:text-[#25282B]'
              }`}
            >
              <Crosshair className={`w-3.5 h-3.5 ${mode === 'nearby' ? 'text-[#E60000]' : ''}`} />
              <span>주변 라멘집</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('saved')}
              className={`py-2 px-1 rounded-[6px] text-[12px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                mode === 'saved'
                  ? 'bg-white text-[#25282B] shadow-xs'
                  : 'text-[#7E7E7E] hover:text-[#25282B]'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${mode === 'saved' ? 'text-[#E60000]' : ''}`} />
              <span>저장 목록 ({SAVED_SHOPS.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('search')}
              className={`py-2 px-1 rounded-[6px] text-[12px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                mode === 'search'
                  ? 'bg-white text-[#25282B] shadow-xs'
                  : 'text-[#7E7E7E] hover:text-[#25282B]'
              }`}
            >
              <Search className={`w-3.5 h-3.5 ${mode === 'search' ? 'text-[#E60000]' : ''}`} />
              <span>직접 검색</span>
            </button>
          </div>
        </div>

        {/* 탭별 본문 컨텐츠 (스크롤 가능) */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-3">
          {/* ======================= 1. 주변 라멘집 탭 ======================= */}
          {mode === 'nearby' && (
            <div className="space-y-3 anim-fade-in">
              {/* 내 위치 안내 & 필터 바 */}
              <div className="space-y-2 pb-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-[#7E7E7E]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <MapPin className="w-3.5 h-3.5 text-[#E60000] shrink-0" />
                    <span className="truncate">마포구 망원동 기준 (반경 2km)</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[10.5px] text-emerald-600 font-bold shrink-0">
                    <span className="relative flex h-2 w-2 items-center justify-center">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                    <span>GPS 수신 중</span>
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setNearbyFilter('all')}
                    className={`px-2.5 py-1 rounded-[4px] text-[11px] font-bold transition-all cursor-pointer ${
                      nearbyFilter === 'all'
                        ? 'bg-[#25282B] text-white shadow-xs'
                        : 'bg-[#F2F2F2] text-[#7E7E7E] hover:bg-[#E2E2E2]'
                    }`}
                  >
                    전체 ({ALL_SHOPS.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setNearbyFilter('500m')}
                    className={`px-2.5 py-1 rounded-[4px] text-[11px] font-bold transition-all cursor-pointer ${
                      nearbyFilter === '500m'
                        ? 'bg-[#25282B] text-white shadow-xs'
                        : 'bg-[#F2F2F2] text-[#7E7E7E] hover:bg-[#E2E2E2]'
                    }`}
                  >
                    500m 이내
                  </button>
                  <button
                    type="button"
                    onClick={() => setNearbyFilter('open')}
                    className={`px-2.5 py-1 rounded-[4px] text-[11px] font-bold transition-all cursor-pointer ${
                      nearbyFilter === 'open'
                        ? 'bg-[#25282B] text-white shadow-xs'
                        : 'bg-[#F2F2F2] text-[#7E7E7E] hover:bg-[#E2E2E2]'
                    }`}
                  >
                    영업 중만
                  </button>
                </div>
              </div>

              {/* 매장 카드 목록 */}
              <div className="space-y-2.5">
                {nearbyList.map((shop) => (
                  <div
                    key={shop.id}
                    onClick={() => onSelectShop(shop.name)}
                    className="p-3 bg-white hover:bg-[#FAFAFA] border border-[#E2E2E2] hover:border-[#BEBEBE] rounded-[8px] cursor-pointer active:scale-99 transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-13 h-13 rounded-[6px] overflow-hidden shrink-0 bg-[#F2F2F2] border border-[#E2E2E2]">
                        <img src={shop.photo} alt={shop.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-[14px] font-black text-[#25282B] truncate group-hover:text-[#E60000] transition-colors">
                            {shop.name}
                          </p>
                          <span className="text-[10px] text-[#7E7E7E] font-bold">{shop.branch}</span>
                          <span className="text-[9.5px] font-bold text-[#E60000] bg-red-50 px-1.5 py-0.2 rounded-xs">
                            {shop.dist}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#7E7E7E] mt-0.5 truncate">
                          {shop.style} {shop.broth && `· ${shop.broth}`}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {shop.tags.map((tag, idx) => (
                            <span key={idx} className="text-[9.5px] font-bold bg-[#F2F2F2] text-[#4A4D52] px-1.5 py-0.2 rounded-[3px]">
                              #{tag}
                            </span>
                          ))}
                          {shop.status && (
                            <span className={`text-[9.5px] font-bold ${shop.status === '영업 중' ? 'text-[#2E7D32]' : 'text-stone-400'}`}>
                              ● {shop.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="shrink-0 text-[11.5px] font-black text-white bg-[#E60000] group-hover:bg-[#CC0000] px-3 py-2 rounded-[4px] transition-all shadow-xs cursor-pointer active:scale-95"
                    >
                      기록 시작 →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ======================= 2. 저장 목록 탭 ======================= */}
          {mode === 'saved' && (
            <div className="space-y-3 anim-fade-in">
              <div className="flex items-center justify-between pb-1">
                <p className="text-[12px] font-bold text-[#7E7E7E]">
                  내가 가고 싶어서 찜해둔 라멘집 ({SAVED_SHOPS.length}곳)
                </p>
                <span className="text-[10.5px] text-[#A0A0A0]">최근 저장순</span>
              </div>

              {SAVED_SHOPS.length === 0 ? (
                <div className="py-12 text-center text-[#7E7E7E] space-y-2">
                  <Bookmark className="w-8 h-8 mx-auto text-stone-300" />
                  <p className="text-[13px] font-bold">저장한 라멘집이 없습니다.</p>
                  <p className="text-[11px] text-[#A0A0A0]">매장 상세 페이지에서 북마크 버튼을 눌러보세요.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {SAVED_SHOPS.map((shop) => (
                    <div
                      key={shop.id}
                      onClick={() => onSelectShop(shop.name)}
                      className="p-3.5 bg-white hover:bg-[#FAFAFA] border border-[#E2E2E2] hover:border-[#BEBEBE] rounded-[8px] cursor-pointer active:scale-99 transition-all space-y-2.5 group"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-12 h-12 rounded-[6px] overflow-hidden shrink-0 bg-[#F2F2F2] border border-[#E2E2E2]">
                            <img src={shop.photo} alt={shop.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="text-[14px] font-black text-[#25282B] truncate group-hover:text-[#E60000] transition-colors">
                                {shop.name}
                              </p>
                              <span className="text-[10px] text-[#7E7E7E] font-bold">{shop.branch}</span>
                            </div>
                            <p className="text-[11px] text-[#7E7E7E] mt-0.5 truncate">{shop.style}</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="shrink-0 text-[11.5px] font-black text-white bg-[#E60000] group-hover:bg-[#CC0000] px-3 py-2 rounded-[4px] transition-all shadow-xs cursor-pointer active:scale-95"
                        >
                          기록 시작 →
                        </button>
                      </div>

                      {/* 저장 메모 & 일자 박스 */}
                      {shop.memo && (
                        <div className="bg-[#F8F8F8] p-2 rounded-[4px] text-[11px] flex items-center justify-between gap-2 border border-[#EFEFEF]">
                          <span className="text-[#4A4D52] font-medium truncate">
                            📝 {shop.memo}
                          </span>
                          <span className="text-[10px] text-[#A0A0A0] shrink-0">{shop.savedDate} 저장</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ======================= 3. 직접 검색 탭 ======================= */}
          {mode === 'search' && (
            <div className="space-y-3.5 anim-fade-in">
              {/* 검색 입력창 */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="라멘집 이름 또는 지역(합정, 망원, 연남 등) 검색"
                  autoFocus
                  className="w-full pl-9 pr-8 py-2.5 bg-[#F2F2F2] border border-[#E2E2E2] rounded-[6px] text-[13px] font-bold text-[#25282B] placeholder:text-[#A0A0A0] focus:outline-hidden focus:border-[#25282B] focus:bg-white transition-all"
                />
                <Search className="w-4 h-4 text-[#7E7E7E] absolute left-3 top-3 pointer-events-none" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 p-0.5 text-stone-400 hover:text-[#25282B] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* 검색어 없을 때: 추천 키워드 & 최근 검색 */}
              {!searchQuery && (
                <div className="space-y-4 pt-1">
                  <div>
                    <span className="text-[11px] font-bold text-[#7E7E7E] block mb-2">
                      인기 검색 키워드
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {POPULAR_KEYWORDS.map((kw) => (
                        <button
                          key={kw}
                          type="button"
                          onClick={() => setSearchQuery(kw)}
                          className="px-2.5 py-1 bg-[#F2F2F2] hover:bg-[#E2E2E2] text-[#25282B] rounded-[4px] text-[11.5px] font-bold transition-colors cursor-pointer"
                        >
                          #{kw}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-bold text-[#7E7E7E] block mb-2">
                      추천 라멘집 바로 선택
                    </span>
                    <div className="divide-y divide-[#F2F2F2] border border-[#E2E2E2] rounded-[6px] overflow-hidden">
                      {ALL_SHOPS.slice(0, 4).map((shop) => (
                        <div
                          key={shop.id}
                          onClick={() => onSelectShop(shop.name)}
                          className="p-2.5 bg-white hover:bg-[#FAFAFA] flex items-center justify-between cursor-pointer transition-colors group"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-black text-[#25282B] group-hover:text-[#E60000]">
                              {shop.name}
                            </span>
                            <span className="text-[10.5px] text-[#7E7E7E] font-medium">{shop.branch}</span>
                            <span className="text-[10px] text-stone-400">· {shop.style}</span>
                          </div>
                          <span className="text-[11px] font-bold text-[#E60000]">선택 →</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 검색 결과 목록 */}
              {searchQuery && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-[#7E7E7E]">
                    <span>검색 결과 ({searchResults.length}건)</span>
                  </div>

                  {searchResults.length > 0 ? (
                    <div className="space-y-2">
                      {searchResults.map((shop) => (
                        <div
                          key={shop.id}
                          onClick={() => onSelectShop(shop.name)}
                          className="p-3 bg-white hover:bg-[#FAFAFA] border border-[#E2E2E2] hover:border-[#BEBEBE] rounded-[6px] cursor-pointer active:scale-99 transition-all flex items-center justify-between gap-3 group"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="text-[14px] font-black text-[#25282B] group-hover:text-[#E60000] transition-colors truncate">
                                {shop.name}
                              </p>
                              <span className="text-[10.5px] text-[#7E7E7E] font-bold shrink-0">{shop.branch}</span>
                              <span className="text-[9.5px] font-bold bg-[#F2F2F2] text-[#7E7E7E] px-1 py-0.2 rounded-xs shrink-0">
                                {shop.region}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#7E7E7E] mt-0.5 truncate">{shop.style}</p>
                          </div>
                          <button
                            type="button"
                            className="shrink-0 text-[11px] font-black text-white bg-[#E60000] group-hover:bg-[#CC0000] px-2.5 py-1.5 rounded-[4px] transition-colors cursor-pointer"
                          >
                            선택 →
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center space-y-3 bg-[#FAFAFA] rounded-[8px] border border-dashed border-[#E2E2E2] p-4">
                      <p className="text-[12.5px] font-bold text-[#7E7E7E]">
                        ‘{searchQuery}’에 해당하는 등록 매장이 없습니다.
                      </p>
                      <button
                        type="button"
                        onClick={() => onSelectShop(searchQuery.trim())}
                        className="w-full py-2.5 bg-[#E60000] text-white rounded-[6px] text-[12px] font-black hover:bg-[#CC0000] active:scale-98 transition-all cursor-pointer shadow-xs"
                      >
                        ‘{searchQuery.trim()}’(으)로 직접 기록 시작하기 →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 하단 닫기 */}
        <div className="px-5 pb-5 pt-2 border-t border-[#E2E2E2] bg-white shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-10 rounded-[6px] border border-stone-200 text-[12px] font-bold text-[#7E7E7E] hover:text-[#25282B] bg-white hover:bg-stone-50 active:scale-98 transition-all cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

