import { useState } from 'react'

interface Props {
  recordSaved: boolean
  onShopClick: () => void
  onRecordClick?: () => void
  onAIRecommendClick?: () => void
}

const RAMEN_PHOTOS = [
  'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=800&h=600&fit=crop&auto=format&q=80',
  'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=800&h=600&fit=crop&auto=format&q=80',
  'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=800&h=600&fit=crop&auto=format&q=80',
]

const NEARBY = [
  {
    num: '01',
    name: '멘야준',
    branch: '망원 본점',
    style: '특제 쇼유 라멘',
    broth: '동물계와 해산물 더블 육수',
    dist: '420m',
    score: '91%',
    status: '영업 중',
    photo: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=400&h=400&fit=crop&auto=format&q=80',
    tags: ['자가제면', '수비드 차슈'],
  },
  {
    num: '02',
    name: '후쿠 라멘',
    branch: '합정점',
    style: '진한 삿포로 미소 라멘',
    broth: '돼지뼈 육수와 볶음 채소',
    dist: '680m',
    score: '82%',
    status: '영업 중',
    photo: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=400&h=400&fit=crop&auto=format&q=80',
    tags: ['불향 가득', '꼬불꼬불 면'],
  },
  {
    num: '03',
    name: '오레노라멘',
    branch: '마포 본점',
    style: '토리파이탄 (닭백탕 라멘)',
    broth: '거품 낸 진한 닭 육수',
    dist: '1.4km',
    score: '75%',
    status: '영업 중',
    photo: 'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=400&h=400&fit=crop&auto=format&q=80',
    tags: ['미쉐린 빕구르망', '자가제면'],
  },
]

const POPULAR_SHOP_RANKINGS = [
  {
    rank: 1,
    name: '멘야준',
    branch: '망원 본점',
    style: '자가제면 특제 쇼유 라멘',
    badge: '인기 1위',
    photo: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=200&h=200&fit=crop&auto=format&q=80',
  },
  {
    rank: 2,
    name: '하쿠텐',
    branch: '연남점',
    style: '진한 농후 이에케 라멘',
    badge: '웨이팅 명소',
    photo: 'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=200&h=200&fit=crop&auto=format&q=80',
  },
  {
    rank: 3,
    name: '오레노라멘',
    branch: '마포 본점',
    style: '크리미 토리파이탄 (닭백탕)',
    badge: '미쉐린 빕구르망',
    photo: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=200&h=200&fit=crop&auto=format&q=80',
  },
  {
    rank: 4,
    name: '담택',
    branch: '합정 본점',
    style: '깔끔한 유자 시오 라멘',
    badge: '유자 시오 명소',
    photo: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=200&h=200&fit=crop&auto=format&q=80',
  },
  {
    rank: 5,
    name: '세상끝의라멘',
    branch: '합정점',
    style: '오사카식 블랙 쇼유 & 차슈',
    badge: '재방문율 1위',
    photo: 'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=200&h=200&fit=crop&auto=format&q=80',
  },
]

export default function HomeScreen({ recordSaved, onShopClick, onRecordClick, onAIRecommendClick }: Props) {
  const [refreshKey, setRefreshKey] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = () => {
    setIsRefreshing(true)
    setRefreshKey(k => k + 1)
    setTimeout(() => setIsRefreshing(false), 450)
  }

  return (
    <div className="h-full overflow-y-auto no-scrollbar bg-[#FFFFFF] text-[#25282B]">
      
      {/* 1. 상단 마스터 헤더 (공식 RAOTA 로고 및 스칼렛 레드 포인트) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-5 pt-12 pb-3.5 border-b border-[#E2E2E2]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="RAOTA Logo"
              className="w-8 h-8 object-contain"
            />
            <div className="flex items-baseline gap-1.5">
              <span className="text-[20px] font-black tracking-tight text-[#25282B]">
                RAOTA<span className="text-[#E60000]">.</span>
              </span>
              <span className="text-[11px] font-bold text-[#7E7E7E]">라오타</span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[11px] font-bold text-stone-500 tracking-tight bg-[#F2F2F2] px-2.5 py-1 rounded-[32px] border border-stone-200/60">
              나의 라멘 취향을 찾는 곳
            </span>
          </div>
        </div>
      </header>

      {/* 2. AI 3초 라멘 큐레이터 배너 (raota-front 취향 분석 추천기 연동) */}
      <section className="mx-5 mt-4">
        <div
          onClick={onAIRecommendClick}
          className="bg-[#25282B] text-white p-4 rounded-[6px] cursor-pointer active:scale-99 transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[6px] bg-[#E60000] flex items-center justify-center text-white flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4772 12 22C12 16.4772 16.4772 12 22 12C16.4772 12 12 7.52285 12 2Z" />
                <path d="M19 3C19 5.20914 17.2091 7 15 7C17.2091 7 19 8.79086 19 11C19 8.79086 20.7909 7 23 7C20.7909 7 19 5.20914 19 3Z" opacity="0.8" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] font-black tracking-tight text-white">
                  오늘 뭐 먹지? AI 라멘 큐레이터
                </span>
                <span className="text-[9px] font-bold text-[#E60000] bg-white px-1.5 py-0.2 rounded-[32px]">
                  3초 매칭
                </span>
              </div>
              <p className="text-[11px] text-white/70 mt-0.5">
                국물·상황·선호 3가지만 고르면 딱 맞는 1곳을 추천해요
              </p>
            </div>
          </div>

          <span className="text-[14px] text-white/80 group-hover:translate-x-1 group-hover:text-[#E60000] transition-all ml-2">
            →
          </span>
        </div>
      </section>

      {/* 3. 기록 완료 알림 배너 */}
      {recordSaved && (
        <div className="mx-5 mt-3 p-3.5 bg-[#F2F2F2] rounded-[6px] anim-fade-in-up flex items-start gap-3">
          <div className="w-2 h-2 rounded-full bg-[#E60000] mt-1.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-[#25282B]">새로운 라멘 시식 데이터가 취향 리포트에 기록되었습니다.</p>
            <p className="text-[11px] text-[#7E7E7E] mt-0.5">최근 감정 데이터를 기반으로 망원·마포 일대 추천 지수가 갱신되었습니다.</p>
          </div>
        </div>
      )}

      {/* 4. 오늘의 큐레이션 라멘야 */}
      <section className="px-5 pt-4 pb-6">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E2E2E2]">
          <h2 className="text-[13px] font-black tracking-tight text-[#E60000]">
            오늘의 큐레이션 라멘야
          </h2>
          <span className="text-[11px] font-bold text-[#7E7E7E]">망원동 권역</span>
        </div>

        {/* 큐레이션 카드 (보더폰 6px 라운드 + 클린 헤어라인) */}
        <article
          onClick={onShopClick}
          className="group cursor-pointer bg-white rounded-[6px] border border-[#E2E2E2] overflow-hidden hover:border-[#25282B] active:scale-99 transition-all duration-200"
        >
          {/* 대표 사진 */}
          <div className="relative aspect-[16/10] bg-[#F2F2F2] overflow-hidden">
            <img
              src={RAMEN_PHOTOS[0]}
              alt="멘야준 특제 쇼유 라멘"
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 left-3 bg-[#E60000] text-white text-[10px] font-bold px-3 py-1 rounded-[32px]">
              오늘의 추천
            </div>
            <div className="absolute top-3 right-3 bg-[#25282B]/90 backdrop-blur-xs text-white text-[10px] font-bold px-2.5 py-1 rounded-[32px]">
              420m · 망원동
            </div>
          </div>

          {/* 본문 내용 */}
          <div className="p-4">
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="text-[20px] font-black text-[#25282B] tracking-tight group-hover:text-[#E60000] transition-colors">
                멘야준
              </h3>
              <span className="text-[14px] font-bold text-[#25282B]">13,000원</span>
            </div>

            <p className="text-[12px] text-[#7E7E7E] mb-3">
              특제 쇼유 라멘 · 자가제면 스트레이트 면 · 닭과 오리 더블 육수
            </p>

            {/* 인용구 */}
            <div className="p-3 bg-[#F2F2F2] rounded-[6px] text-[13px] leading-snug text-[#25282B]">
              <span className="text-[#E60000] font-black mr-1 text-sm">“</span>
              진한 동물계 감칠맛과 단단한 자가제면 식감이 일품인 망원동의 대표 쇼유 라멘 명소입니다.
              <span className="text-[#E60000] font-black ml-1 text-sm">”</span>
            </div>

            {/* 태그 및 바로가기 */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#E2E2E2] text-[11px] text-[#7E7E7E]">
              <div className="flex gap-1.5">
                <span className="bg-[#F2F2F2] px-2 py-0.5 rounded-[32px] font-bold text-[#25282B]">#자가제면</span>
                <span className="bg-[#F2F2F2] px-2 py-0.5 rounded-[32px] font-bold text-[#25282B]">#맑은육수</span>
              </div>
              <span className="font-bold text-[#E60000] group-hover:translate-x-0.5 transition-transform">
                매장 상세 보기 →
              </span>
            </div>
          </div>
        </article>
      </section>

      {/* 5. 실시간 인기 라멘야 순위 (raota-front TrendingTagsRanking 기반) */}
      <section className="mb-7 px-5">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E2E2E2]">
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-[#E60000] fill-[#E60000]" viewBox="0 0 24 24">
              <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
            </svg>
            <h2 className="text-[13px] font-black tracking-tight text-[#25282B]">
              실시간 인기 라멘야 순위
            </h2>
          </div>
          
          <button
            type="button"
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-[32px] bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-[#25282B] active:scale-95 transition-all cursor-pointer"
            title="실시간 랭킹 새로고침"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#E60000] animate-pulse" />
            <span className="text-[10px] font-black text-[#E60000]">LIVE</span>
            <svg
              className={`w-3 h-3 text-stone-400 transition-transform duration-500 ${isRefreshing ? 'rotate-180 text-[#E60000]' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
          </button>
        </div>

        {/* 실시간 인기 랭킹 카드 컨테이너 (블라인드 촤르륵 3D 언폴드 애니메이션) */}
        <div key={`rankings-${refreshKey}`} className="bg-white rounded-[6px] border border-[#E2E2E2] overflow-hidden divide-y divide-stone-100 shadow-xs [perspective:800px]">
          {POPULAR_SHOP_RANKINGS.map((item, idx) => (
            <div
              key={`${refreshKey}-${item.rank}`}
              onClick={onShopClick}
              style={{ animationDelay: `${idx * 80}ms` }}
              className="anim-blind flex items-center justify-between p-3.5 hover:bg-stone-50 active:bg-stone-100 cursor-pointer transition-colors group origin-top"
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* 랭킹 번호 */}
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-black shrink-0 transition-transform group-hover:scale-110 ${
                    item.rank === 1
                      ? 'bg-[#E60000] text-white shadow-xs'
                      : item.rank === 2
                      ? 'bg-[#25282B] text-white'
                      : item.rank === 3
                      ? 'bg-stone-600 text-white'
                      : 'bg-stone-100 text-stone-500'
                  }`}
                >
                  {item.rank}
                </div>

                {/* 매장 썸네일 */}
                <div className="w-11 h-11 rounded-[4px] overflow-hidden bg-stone-100 border border-stone-200 shrink-0">
                  <img src={item.photo} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                </div>

                {/* 매장 정보 */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[14px] font-black text-[#25282B] truncate group-hover:text-[#E60000] transition-colors">
                      {item.name}
                    </span>
                    <span className="text-[10px] text-stone-400 font-bold shrink-0">{item.branch}</span>
                  </div>
                  <p className="text-[11px] text-stone-500 truncate mt-0.5">{item.style}</p>
                </div>
              </div>

              {/* 우측 뱃지 및 바로가기 화살표 */}
              <div className="flex items-center gap-2 shrink-0 pl-2">
                <span className="text-[10px] font-bold text-[#E60000] bg-red-50 px-2 py-0.5 rounded-[32px] block">
                  {item.badge}
                </span>
                <span className="text-[12px] font-bold text-stone-300 group-hover:text-[#E60000] group-hover:translate-x-0.5 transition-all">
                  →
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. 내 주변 권역 라멘야 목록 */}
      <section className="px-5 pb-8">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E2E2E2]">
          <h2 className="text-[13px] font-black tracking-tight text-[#25282B]">
            거리순 라멘야 목록
          </h2>
          <span className="text-[11px] font-bold text-[#7E7E7E]">가까운 순서</span>
        </div>

        <div className="bg-white rounded-[6px] border border-[#E2E2E2] divide-y divide-[#E2E2E2] overflow-hidden">
          {NEARBY.map((item, idx) => (
            <div
              key={idx}
              onClick={onShopClick}
              className="p-3.5 flex items-center gap-3.5 hover:bg-[#F2F2F2] cursor-pointer transition-colors group"
            >
              <span className="text-[13px] font-bold text-[#7E7E7E] w-5 text-center flex-shrink-0">
                {item.num}
              </span>
              <div className="w-13 h-13 rounded-[6px] overflow-hidden bg-[#F2F2F2] flex-shrink-0 border border-[#E2E2E2]">
                <img src={item.photo} alt={item.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[14px] font-black text-[#25282B] truncate group-hover:text-[#E60000] transition-colors">
                    {item.name}
                  </p>
                </div>
                <p className="text-[11px] text-[#7E7E7E] mt-0.5 truncate">
                  {item.style} · {item.broth}
                </p>
                <div className="flex items-center gap-1.5 mt-1 text-[10px] text-[#7E7E7E] font-medium whitespace-nowrap overflow-hidden">
                  <span>{item.dist}</span>
                  <span>·</span>
                  <span className="text-[#2E7D32] font-bold">● {item.status}</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <span className="inline-block text-[11px] font-bold text-[#25282B] bg-[#F2F2F2] px-2.5 py-0.5 rounded-[32px]">
                  {item.style.split(' ')[0]}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="h-14" />

      {/* 우측 하단 플로팅 기록 버튼 (FAB) */}
      {onRecordClick && (
        <button
          onClick={onRecordClick}
          className="absolute bottom-4 right-4 z-30 h-12 px-4 rounded-[60px] bg-[#E60000] text-white font-bold text-[13px] shadow-lg flex items-center gap-2 active:scale-95 hover:bg-[#CC0000] transition-all"
          aria-label="라멘로그 쓰기"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          <span>기록하기</span>
        </button>
      )}
    </div>
  )
}
