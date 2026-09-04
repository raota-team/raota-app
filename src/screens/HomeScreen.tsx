import { useState } from 'react'
import { Bell, Flame, PenLine, X, Crosshair, Bookmark, Search } from 'lucide-react'
import type { UserProfile } from '../types'





interface Props {
  user: UserProfile | null
  recordSaved: boolean
  unreadNotificationsCount?: number
  onNotificationClick?: () => void
  onShopClick: () => void
  onRecordClick?: (mode?: 'nearby' | 'saved' | 'search') => void
  onAIRecommendClick?: () => void
  onViewTaste?: () => void
  onLoginClick?: () => void
  onRegisterClick?: () => void
  onUserClick?: () => void
  onMapClick?: () => void
  onNewsFeedClick?: () => void
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
    views: '1,420회',
    photo: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=200&h=200&fit=crop&auto=format&q=80',
  },
  {
    rank: 2,
    name: '하쿠텐',
    branch: '연남점',
    style: '진한 농후 이에케 라멘',
    views: '1,180회',
    photo: 'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=200&h=200&fit=crop&auto=format&q=80',
  },
  {
    rank: 3,
    name: '오레노라멘',
    branch: '마포 본점',
    style: '크리미 토리파이탄 (닭백탕)',
    views: '960회',
    photo: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=200&h=200&fit=crop&auto=format&q=80',
  },
  {
    rank: 4,
    name: '담택',
    branch: '합정 본점',
    style: '깔끔한 유자 시오 라멘',
    views: '840회',
    photo: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=200&h=200&fit=crop&auto=format&q=80',
  },
  {
    rank: 5,
    name: '세상끝의라멘',
    branch: '합정점',
    style: '오사카식 블랙 쇼유 & 차슈',
    views: '720회',
    photo: 'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=200&h=200&fit=crop&auto=format&q=80',
  },
]

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
  onNewsFeedClick,
}: Props) {
  const [fabOpen, setFabOpen] = useState(false)

  return (
    <div className="h-full relative">
    <div className="h-full overflow-y-auto no-scrollbar bg-[#FFFFFF] text-[#25282B]">
      
      {/* 1. 상단 마스터 헤더 (공식 RAOTA 로고 + 슬로건 & 유저 웰컴 인사 + 알림 센터) */}
      <header className="bg-white px-5 pt-3.5 pb-3.5 border-b border-[#E2E2E2]">
        <div className="flex items-center justify-between gap-2">
          {/* 좌측: 로고 + 하단 슬로건 */}
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/logo.png"
              alt="RAOTA Logo"
              className="w-9 h-9 object-contain shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-baseline gap-1 leading-none">
                <span className="text-[20px] font-black tracking-tight text-[#25282B]">
                  RAOTA<span className="text-[#E60000]">.</span>
                </span>
              </div>
              <p className="text-[10px] font-bold text-[#7E7E7E] tracking-tight mt-0.5 truncate">
                나의 라멘 취향을 찾는 곳
              </p>
            </div>
          </div>

          {/* 우측: 유저 인사 문구 + 알림 센터 벨 버튼 (자연스러운 우측 정렬 결합) */}
          <div className="flex items-center gap-2 shrink-0">
            {user && user.isLoggedIn ? (
              <button
                type="button"
                onClick={onUserClick}
                className="text-[12px] font-bold text-[#25282B] hover:text-[#E60000] transition-colors active:scale-95 text-right flex items-center gap-0.5 cursor-pointer"
              >
                <span className="text-[#E60000] font-black">{user.nickname}</span>님, 반갑습니다
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onLoginClick}
                  className="px-2 py-1 text-[11.5px] font-black text-[#25282B] hover:text-[#E60000] transition-all active:scale-95"
                >
                  로그인
                </button>
                <button
                  type="button"
                  onClick={onRegisterClick}
                  className="px-2.5 py-1 text-[11px] font-black text-white bg-[#E60000] hover:bg-[#CC0000] rounded-[4px] transition-all active:scale-95 shadow-xs"
                >
                  회원가입
                </button>
              </div>
            )}

            {/* 🔔 슬림하고 세련된 알림 센터 벨 버튼 */}
            <button
              type="button"
              onClick={onNotificationClick}
              className="relative p-1 text-[#25282B] hover:text-[#E60000] active:scale-90 transition-all flex items-center justify-center cursor-pointer -mr-0.5"
              aria-label="알림센터 열기"
              title="알림센터"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationsCount !== undefined && unreadNotificationsCount > 0 && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-[#E60000] rounded-full ring-2 ring-white" />
              )}
            </button>
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
                {/* 메인 4각 별 */}
                <path d="M11 2C11 6.97 6.97 11 2 11C6.97 11 11 15.03 11 20C11 15.03 15.03 11 20 11C15.03 11 11 6.97 11 2Z" />
                {/* 우상단 보조 4각 별 */}
                <path d="M19 2C19 4.21 17.21 6 15 6C17.21 6 19 7.79 19 10C19 7.79 20.79 6 23 6C20.79 6 19 4.21 19 2Z" opacity="0.9" />
              </svg>
            </div>


            <div>
              <h3 className="text-[14px] font-black tracking-tight text-white">
                오늘 뭐 먹지? AI 라멘 큐레이터
              </h3>
              <p className="text-[11px] text-white/70 mt-0.5">
                육수 농도 · 면 굵기 · 타레 맞춤 라멘 추천
              </p>
            </div>

          </div>

          <span className="text-[12px] font-bold text-white/80 group-hover:translate-x-1 transition-transform">
            →
          </span>
        </div>
      </section>

      {/* 3. 기록 완료 알림 배너 */}
      {recordSaved && (
        <div className="mx-5 mt-3 p-3.5 bg-white border border-[#E2E2E2] hover:border-[#BEBEBE] rounded-[8px] shadow-xs anim-fade-in-up flex items-center justify-between gap-3 transition-all">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-[#E60000]/10 text-[#E60000] flex items-center justify-center font-black text-[12px] shrink-0">
              ✓
            </div>
            <div className="min-w-0">
              <p className="text-[12.5px] font-bold text-[#25282B] truncate">
                새로운 라멘로그가 취향 리포트에 반영되었습니다.
              </p>
              <p className="text-[10.5px] text-[#7E7E7E] truncate mt-0.5">
                최신 라멘로그 데이터를 기반으로 맞춤 추천이 갱신되었습니다.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-[#E60000] shrink-0">
            기록 완료
          </span>
        </div>
      )}

      {/* 4. 오늘의 큐레이션 라멘집 */}
      <section className="px-5 pt-4 pb-6">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E2E2E2]">
          <h2 className="text-[13px] font-black tracking-tight text-[#E60000]">
            오늘의 큐레이션 라멘집
          </h2>
          <span className="text-[11px] font-bold text-[#7E7E7E]">420m · 망원동</span>
        </div>

        {/* 큐레이션 카드 (클린 1px 보더 + 부드러운 호버 전환) */}
        <article
          onClick={onShopClick}
          className="group cursor-pointer bg-white rounded-[8px] border border-[#E2E2E2] overflow-hidden shadow-sm hover:border-[#BEBEBE] active:scale-[0.99] transition-all duration-200"
        >
          {/* 대표 사진 + 뱃지 오버레이 */}
          <div className="relative aspect-[16/10] bg-[#F2F2F2] overflow-hidden">
            <img
              src={RAMEN_PHOTOS[0]}
              alt="멘야준 특제 쇼유 라멘"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            {/* 좌상단 큐레이터 뱃지 */}
            <div className="absolute top-2.5 left-2.5 bg-[#E60000] text-white text-[10.5px] font-black px-2.5 py-1 rounded-[4px] shadow-xs flex items-center gap-1 tracking-wider">
              <span>★ TODAY&apos;S PICK</span>
            </div>
          </div>

          {/* 본문 내용 */}
          <div className="p-4 space-y-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[20px] font-black text-[#25282B] tracking-tight group-hover:text-[#E60000] transition-colors">
                  멘야준
                </h3>
                <span className="text-[11px] font-bold text-[#7E7E7E] bg-[#F2F2F2] px-2 py-0.5 rounded-[4px]">
                  망원 본점
                </span>
              </div>

              <p className="text-[12px] font-bold text-[#7E7E7E] mt-1">
                특제 쇼유 라멘 · 자가제면 스트레이트 면 · 닭과 오리 더블 육수
              </p>
            </div>

            {/* 에디터 인용구 (좌측 레드 악센트 바) */}
            <div className="p-3 bg-[#F8F8F8] border-l-3 border-[#E60000] rounded-r-[6px] text-[12.5px] leading-snug text-[#25282B] font-medium">
              “진한 동물계 감칠맛과 단단한 자가제면 식감이 일품인 망원동의 대표 쇼유 라멘 명소입니다.”
            </div>

            {/* 태그 및 바로가기 CTA 버튼 */}
            <div className="flex items-center justify-between pt-2 border-t border-[#E2E2E2]">
              <div className="flex gap-1.5">
                <span className="bg-[#F2F2F2] px-2.5 py-1 rounded-[4px] font-bold text-[11px] text-[#25282B]">#자가제면</span>
                <span className="bg-[#F2F2F2] px-2.5 py-1 rounded-[4px] font-bold text-[11px] text-[#25282B]">#맑은육수</span>
              </div>
              <span className="inline-flex items-center gap-1 text-[11.5px] font-black text-white bg-[#E60000] group-hover:bg-[#CC0000] px-3 py-1.5 rounded-[4px] transition-colors shadow-xs">
                매장 상세 보기 →
              </span>
            </div>
          </div>
        </article>
      </section>

      {/* 5. 오늘 많이 본 라멘집 (raota-front 기반 실시간 조회순 랭킹) */}
      <section className="mb-7 px-5">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E2E2E2]">
          <div className="flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-[#E60000] fill-[#E60000]" />
            <h2 className="text-[13px] font-black tracking-tight text-[#25282B]">
              오늘 많이 본 라멘집
            </h2>
          </div>
          <span className="text-[10.5px] font-bold text-stone-400">
            실시간 조회수 기준
          </span>
        </div>

        {/* 실시간 인기 랭킹 카드 컨테이너 (블라인드 촤르륵 3D 언폴드 애니메이션) */}
        <div className="bg-white rounded-[6px] border border-[#E2E2E2] overflow-hidden divide-y divide-stone-100 shadow-xs [perspective:800px]">
          {POPULAR_SHOP_RANKINGS.map((item, idx) => (
            <div
              key={item.rank}
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

              {/* 우측 조회수 및 바로가기 화살표 */}
              <div className="flex items-center gap-2 shrink-0 pl-2">
                <span className="text-[11px] font-medium text-[#7E7E7E]">
                  {item.views}
                </span>
                <span className="text-[12px] font-bold text-stone-300 group-hover:text-[#E60000] group-hover:translate-x-0.5 transition-all">
                  →
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. 내 주변 권역 라멘집 목록 */}
      <section className="px-5 pb-8">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E2E2E2]">
          <h2 className="text-[13px] font-black tracking-tight text-[#25282B]">
            거리순 라멘집 목록
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
            </div>
          ))}
        </div>
      </section>

      {/* 7. 초슬림 미니멀 푸터 (구분선 없이 자연스럽게 안착) */}
      <footer className="px-5 pt-2 pb-4 text-center space-y-1">
        <div className="flex items-center justify-center gap-3 text-[10.5px] font-bold text-[#7E7E7E]">

          <span className="hover:text-[#25282B] cursor-pointer transition-colors">이용약관</span>
          <span className="text-[#E2E2E2]">·</span>
          <span className="hover:text-[#25282B] cursor-pointer transition-colors">개인정보처리방침</span>
          <span className="text-[#E2E2E2]">·</span>
          <a href="mailto:contact@raota.net" className="hover:text-[#25282B] transition-colors">문의하기</a>
        </div>
        <p className="text-[9.5px] text-[#A0A0A0] font-medium">
          © 2026 RAOTA · 라멘에 진심인 사람들
        </p>
      </footer>
    </div>

      {/* 플로팅 스피드 다이얼 메뉴 */}
      {fabOpen && (
        <div
          className="absolute inset-0 z-30 bg-black/40 backdrop-blur-[2px] anim-fade-in"
          onClick={() => setFabOpen(false)}
        />
      )}
      <div className="absolute bottom-3 right-3 z-40 flex flex-col items-end gap-2.5 max-w-[calc(100%-24px)]">
        {/* 펼쳐지는 메뉴 아이템들 */}
        {fabOpen && (
          <div className="flex flex-col items-end gap-2 pr-0.5">
            <button
              type="button"
              onClick={() => { setFabOpen(false); onRecordClick?.('nearby') }}
              className="flex items-center gap-2 animate-[fadeSlideUp_0.15s_ease-out_both] cursor-pointer group active:scale-95 transition-transform"
            >
              <span className="text-[11.5px] font-black text-[#25282B] bg-white px-3 py-1.5 rounded-full shadow-md border border-[#E2E2E2] whitespace-nowrap group-hover:text-[#E60000] transition-colors">
                주변 라멘집 기록하기
              </span>
              <div className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center border border-[#E2E2E2] group-hover:border-[#E60000] transition-colors shrink-0">
                <Crosshair className="w-4 h-4 text-[#E60000]" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => { setFabOpen(false); onRecordClick?.('saved') }}
              className="flex items-center gap-2 animate-[fadeSlideUp_0.15s_ease-out_0.05s_both] cursor-pointer group active:scale-95 transition-transform"
            >
              <span className="text-[11.5px] font-black text-[#25282B] bg-white px-3 py-1.5 rounded-full shadow-md border border-[#E2E2E2] whitespace-nowrap group-hover:text-[#E60000] transition-colors">
                저장 목록에서 기록하기
              </span>
              <div className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center border border-[#E2E2E2] group-hover:border-[#E60000] transition-colors shrink-0">
                <Bookmark className="w-4 h-4 text-[#E60000]" />
              </div>
            </button>

            <button
              type="button"
              onClick={() => { setFabOpen(false); onRecordClick?.('search') }}
              className="flex items-center gap-2 animate-[fadeSlideUp_0.15s_ease-out_0.1s_both] cursor-pointer group active:scale-95 transition-transform"
            >
              <span className="text-[11.5px] font-black text-[#25282B] bg-white px-3 py-1.5 rounded-full shadow-md border border-[#E2E2E2] whitespace-nowrap group-hover:text-[#E60000] transition-colors">
                직접 검색해서 기록하기
              </span>
              <div className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center border border-[#E2E2E2] group-hover:border-[#E60000] transition-colors shrink-0">
                <Search className="w-4 h-4 text-[#E60000]" />
              </div>
            </button>
          </div>
        )}

        {/* 메인 토글 버튼 */}
        <button
          type="button"
          onClick={() => setFabOpen(prev => !prev)}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-md ${
            fabOpen ? 'bg-[#25282B] text-white' : 'bg-[#E60000] hover:bg-[#CC0000] text-white'
          }`}
          aria-label="기록하기"
        >
          {fabOpen ? (
            <X className="w-[18px] h-[18px] stroke-[2.5]" />
          ) : (
            <PenLine className="w-[18px] h-[18px] stroke-[2.5]" />
          )}
        </button>
      </div>
    </div>
  )
}


