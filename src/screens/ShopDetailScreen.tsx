import { useState } from 'react'
import type { Shop } from '../types'

interface Props {
  savedShop: boolean
  shop?: Shop
  onSaveShop: () => void
  onBack: () => void
  onRecord: () => void
}

const DEFAULT_SHOP: Shop = {
  id: 1,
  name: '멘야준',
  branch: '망원 본점',
  address: '서울 마포구 동교로 128 (망원역 2번 출구 420m)',
  lat: 37.5562,
  lng: 126.9102,
  phone: '070-7798-2512',
  rating: 4.6,
  reviewCount: 482,
  businessStatus: 'OPERATIONAL',
  isOpen: true,
  openingHours: [
    '월요일: 11:30 ~ 21:00',
    '화요일: 11:30 ~ 21:00',
    '수요일: 11:30 ~ 21:00',
    '목요일: 11:30 ~ 21:00',
    '금요일: 11:30 ~ 21:00',
    '토요일: 11:30 ~ 21:00',
    '일요일: 11:30 ~ 21:00',
  ],
  priceRange: '₩10,000 ~ ₩15,000',
  dineIn: true,
  delivery: false,
  reservable: false,
  googleMapsUri: 'https://maps.google.com',
  websiteUri: 'https://instagram.com/menyajun_official',
  instagramUrl: 'https://instagram.com/menyajun_official',
  catchTableUrl: 'https://app.catchtable.co.kr/ct/shop/menyajun',
  photos: [
    'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=800&h=600&fit=crop&auto=format&q=80',
    'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=800&h=600&fit=crop&auto=format&q=80',
  ],
  tags: ['정통 쇼유 계보', '자가제면 1.5mm', '동물계와 해산물 더블', '매장 식사 가능'],
  matchScore: 91,
  distanceM: 420,
  servicePerks: {
    noodleRefill: '1회 무료 리필 가능',
    riceRefill: '요청 시 무료 제공',
  },
  description: '진한 동물계 육수 및 단단한 자가제면 식감을 자랑하며, 맑은 쇼유 타레 특유의 높은 감칠맛을 보유하고 있는 망원동의 대표 라멘야입니다.',
  reviews: [
    {
      author: '하니 (라멘마니아)',
      level: '8레벨',
      rating: 5,
      text: '첫 모금부터 닭과 오리 육수의 깊은 감칠맛이 폭발합니다. 단단한 자가제면 스트레이트 면 식감이 예술이네요.',
      time: '3일 전',
    },
    {
      author: '멘덕후',
      level: '12레벨',
      rating: 5,
      text: '수비드 차슈가 부드럽고 국물 염도가 딱 맞습니다. 망원동 일대 쇼유 라멘 중 가장 완성도가 높습니다.',
      time: '1주 전',
    },
    {
      author: '구글 로컬 가이드',
      level: 'Lv.6 가이드',
      rating: 4,
      text: '깔끔한 매장 분위기와 친절한 접객. 웨이팅이 조금 있지만 회전율이 빨라 금방 입장했습니다.',
      time: '2주 전',
    },
  ],
}

const DAY_NAMES = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']
const DAY_SHORT = ['일', '월', '화', '수', '목', '금', '토']

export default function ShopDetailScreen({ savedShop, shop = DEFAULT_SHOP, onSaveShop, onBack, onRecord }: Props) {
  const [photoIdx, setPhotoIdx] = useState(0)
  const [showSavedToast, setShowSavedToast] = useState(false)
  const [showHoursDetail, setShowHoursDetail] = useState(false)

  const dayIndex = new Date().getDay()
  const todayName = DAY_NAMES[dayIndex]
  const todayShort = DAY_SHORT[dayIndex]

  // 현재 요일에 해당하는 영업시간 찾기
  const todayHourEntry = shop.openingHours.find(h => h.startsWith(todayName))
  const todayTimeText = todayHourEntry
    ? todayHourEntry.replace(/^.*?: /, '')
    : (shop.openingHours[0]?.replace(/^.*?: /, '') || '11:30 - 21:00')

  const handleSave = () => {
    onSaveShop()
    if (!savedShop) {
      setShowSavedToast(true)
      setTimeout(() => setShowSavedToast(false), 2200)
    }
  }

  const instagramLink = shop.instagramUrl || shop.websiteUri || 'https://instagram.com'
  const catchTableLink = shop.catchTableUrl || 'https://app.catchtable.co.kr'

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#FFFFFF] text-[#25282B]">
      
      {/* 본문 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        
        {/* 1. 상단 매장 사진 갤러리 */}
        <div className="relative aspect-[4/3] bg-[#25282B]">
          <img src={shop.photos[photoIdx]} alt={shop.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30" />

          {/* 상단 뒤로가기 & 저장 */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-12 pb-3 z-10">
            <button
              onClick={onBack}
              className="w-10 h-10 bg-[#25282B]/60 backdrop-blur-md rounded-full flex items-center justify-center text-white active:scale-95 transition-all"
              aria-label="뒤로가기"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
            </button>

            <button
              onClick={handleSave}
              className="w-10 h-10 bg-[#25282B]/60 backdrop-blur-md rounded-full flex items-center justify-center text-white active:scale-95 transition-all"
              aria-label="가고 싶어요"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill={savedShop ? '#E60000' : 'none'} stroke={savedShop ? '#E60000' : 'currentColor'} strokeWidth="2.3">
                <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
              </svg>
            </button>
          </div>

          {/* 갤러리 썸네일 스트립 */}
          <div className="absolute bottom-3 left-4 right-4 flex gap-1.5 z-10 overflow-x-auto no-scrollbar">
            {shop.photos.map((p, i) => (
              <button
                key={i}
                onClick={() => setPhotoIdx(i)}
                className={`w-12 h-12 rounded-[4px] overflow-hidden border-2 transition-all flex-shrink-0 ${
                  photoIdx === i ? 'border-[#E60000] scale-105' : 'border-white/40 opacity-70'
                }`}
              >
                <img src={p} alt={`사진 ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* 2. 매장 헤드라인 정보 */}
        <section className="px-5 pt-4 space-y-4">
          
          <div className="bg-white rounded-[6px] border border-[#E2E2E2] p-5">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E2E2E2] text-[10px] font-bold text-[#7E7E7E]">
              <span className="text-[#2E7D32] font-bold">● {shop.isOpen ? '영업 중' : '영업 종료'}</span>
              <span>라멘로그 {shop.reviewCount}개</span>
            </div>

            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[11px] text-[#E60000] font-bold tracking-wider block">
                  {shop.tags[0] || '라멘 전문점'}
                </span>
                <h1 className="text-[24px] font-black text-[#25282B] tracking-tight leading-tight mt-0.5">
                  {shop.name} {shop.branch && `· ${shop.branch}`}
                </h1>
                <p className="text-[12px] text-[#7E7E7E] mt-1">{shop.address}</p>
              </div>

              <div className="bg-[#F2F2F2] border border-[#E2E2E2] text-center rounded-[6px] px-3 py-2 flex-shrink-0">
                <span className="text-[9px] block text-[#7E7E7E] font-bold leading-tight">대표 계보</span>
                <span className="text-[12px] font-black text-[#25282B] block mt-0.5">{shop.tags[0] || '쇼유 라멘'}</span>
              </div>
            </div>

            {/* 🍜 라오타 완식 가이드 (면 리필 / 공깃밥 등 매장 혜택) */}
            <div className="mt-4 pt-3 border-t border-[#E2E2E2] space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1 font-black text-[#25282B]">
                  <span className="text-[#E60000]">🍜</span>
                  <span>라오타 완식 가이드</span>
                </div>
                <span className="text-[10px] text-[#7E7E7E] font-medium">
                  2026.09 확인 기준
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div className="bg-[#F2F2F2] py-1.5 px-2.5 rounded-[4px] border border-[#E2E2E2]">
                  <span className="text-[9px] text-[#7E7E7E] block leading-none">면 리필 (카에다마)</span>
                  <span className="text-[11px] font-bold text-[#E60000] block mt-1 leading-tight">
                    {shop.servicePerks?.noodleRefill || '1회 무료 제공 ✓'}
                  </span>
                </div>
                <div className="bg-[#F2F2F2] py-1.5 px-2.5 rounded-[4px] border border-[#E2E2E2]">
                  <span className="text-[9px] text-[#7E7E7E] block leading-none">공깃밥</span>
                  <span className="text-[11px] font-bold text-[#25282B] block mt-1 leading-tight">
                    {shop.servicePerks?.riceRefill || '요청 시 무료 제공 ✓'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. AI 취향 분석 및 리뷰 요약 */}
          {shop.description && (
            <div className="bg-[#F2F2F2] rounded-[6px] p-4">
              <div className="flex items-center gap-1.5 mb-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="#E60000">
                  <path d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4772 12 22C12 16.4772 16.4772 12 22 12C16.4772 12 12 7.52285 12 2Z" />
                  <path d="M19 3C19 5.20914 17.2091 7 15 7C17.2091 7 19 8.79086 19 11C19 8.79086 20.7909 7 23 7C20.7909 7 19 5.20914 19 3Z" opacity="0.8" />
                </svg>
                <span className="text-[10px] text-[#E60000] font-black uppercase tracking-wider">
                  AI 리뷰 분석 요약
                </span>
              </div>
              <p className="text-[12px] text-[#25282B] leading-relaxed">
                “{shop.description}”
              </p>
            </div>
          )}

          {/* 4. 정형화된 가게 상세 정보 카드 (raota-front 다크 에디토리얼 스타일) */}
          <div className="rounded-[6px] bg-[#25282B] p-5 text-white">
            <h2 className="text-[14px] font-black text-white mb-3.5 flex items-center justify-between">
              <span>가게 상세 정보</span>
              <span className="text-[10px] font-normal text-white/60">구글 지도 데이터 기준</span>
            </h2>

            <div className="space-y-3 text-[12px] text-white/80">
              <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                <span className="text-white/50 flex-shrink-0">주소</span>
                <span className="text-right break-keep text-white font-medium">{shop.address}</span>
              </div>

              {/* 현재 요일 기준 영업시간 & 접었다 폈다 토글 */}
              <div className="border-b border-white/10 pb-2">
                <div
                  className="flex justify-between gap-4 cursor-pointer group"
                  onClick={() => setShowHoursDetail(!showHoursDetail)}
                >
                  <span className="text-white/50 flex-shrink-0">영업시간</span>
                  <div className="text-right flex items-center gap-1.5 text-white font-medium">
                    <span className="text-[#E60000] font-bold text-[11px]">오늘({todayShort})</span>
                    <span>{todayTimeText}</span>
                    <span className="text-[10px] text-white/60 group-hover:text-[#E60000] transition-colors">
                      {showHoursDetail ? '▲' : '▼'}
                    </span>
                  </div>
                </div>

                {showHoursDetail && (
                  <div className="mt-2.5 pt-2 border-t border-white/10 space-y-1.5 text-[11px] text-white/70 anim-fade-in">
                    {shop.openingHours.map((h, i) => {
                      const isToday = h.startsWith(todayName)
                      return (
                        <div
                          key={i}
                          className={`flex justify-between px-2 py-1 rounded-[4px] ${
                            isToday ? 'bg-white/10 text-white font-bold' : ''
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{h.split(':')[0]}</span>
                            {isToday && (
                              <span className="text-[9px] bg-[#E60000] text-white px-1.5 py-0.2 rounded-[32px]">
                                오늘
                              </span>
                            )}
                          </div>
                          <span className="font-mono">{h.split(':').slice(1).join(':')}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {shop.phone && (
                <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                  <span className="text-white/50 flex-shrink-0">전화번호</span>
                  <a href={`tel:${shop.phone}`} className="text-right text-white hover:text-[#E60000] font-mono">
                    {shop.phone}
                  </a>
                </div>
              )}
            </div>

            {/* 외부 링크 버튼 그룹 (Instagram & CatchTable) */}
            <div className="mt-4 pt-3 border-t border-white/10 flex gap-2">
              <a
                href={instagramLink}
                target="_blank"
                rel="noreferrer"
                className="flex-1 h-10 rounded-[6px] bg-white/10 hover:bg-[#E60000] text-white text-[12px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-98"
              >
                <span>Instagram</span>
                <span>📸</span>
              </a>
              <a
                href={catchTableLink}
                target="_blank"
                rel="noreferrer"
                className="flex-1 h-10 rounded-[6px] bg-white/10 hover:bg-white hover:text-[#25282B] text-white text-[12px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-98"
              >
                <span>CatchTable</span>
                <span>🍽️</span>
              </a>
            </div>
          </div>

          {/* 5. 구글 인증 방문자 리뷰 (google_reviews) */}
          <div className="bg-white rounded-[6px] border border-[#E2E2E2] p-5">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E2E2E2]">
              <h2 className="text-[13px] font-black tracking-tight text-[#25282B]">
                방문자 라멘로그 ({shop.reviews.length})
              </h2>
              <span className="text-[10px] font-bold text-[#7E7E7E]">구글 리뷰 연동</span>
            </div>

            <div className="space-y-3">
              {shop.reviews.map((r, i) => (
                <div key={i} className="p-3.5 bg-[#F2F2F2] rounded-[6px]">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] font-bold text-[#25282B]">{r.author}</span>
                      {r.level && <span className="text-[9px] text-[#7E7E7E]">({r.level})</span>}
                    </div>
                    <span className="text-[10px] text-[#7E7E7E]">{r.time}</span>
                  </div>
                  <p className="text-[12px] text-[#4A4D52] leading-snug">{r.text}</p>
                </div>
              ))}
            </div>
          </div>

        </section>

        <div className="h-10" />
      </div>

      {/* 하단 고정 액션 바 */}
      <footer className="flex-shrink-0 border-t border-[#E2E2E2] bg-white px-4 py-3">
        <div className="flex gap-2.5">
          <button
            onClick={handleSave}
            className={`flex-1 h-13 rounded-[60px] border flex items-center justify-center gap-2 text-[14px] font-bold active:scale-98 transition-all ${
              savedShop
                ? 'border-[#E60000] bg-[#E60000]/10 text-[#E60000]'
                : 'border-[#25282B] bg-white text-[#25282B]'
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill={savedShop ? '#E60000' : 'none'} stroke={savedShop ? '#E60000' : 'currentColor'} strokeWidth="2.3">
              <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
            </svg>
            {savedShop ? '저장됨 ✓' : '가고 싶어요'}
          </button>
          
          <button
            onClick={onRecord}
            className="flex-1 h-13 rounded-[60px] bg-[#E60000] text-white text-[14px] font-bold tracking-wide active:scale-98 hover:bg-[#CC0000] transition-all flex items-center justify-center"
          >
            먹은 라멘 기록하기
          </button>
        </div>
      </footer>

      {/* 토스트 */}
      {showSavedToast && (
        <div className="absolute bottom-24 left-0 right-0 flex justify-center pointer-events-none anim-fade-in-up z-50">
          <div className="bg-[#25282B] text-white text-[12px] px-5 py-2.5 rounded-[60px] shadow-2xl">
            가고 싶은 라멘야 목록에 저장되었습니다.
          </div>
        </div>
      )}
    </div>
  )
}
