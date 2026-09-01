import { useState } from 'react'

interface Props {
  onShopClick?: () => void
}

const FILTERS = ['전체', '한정 메뉴', '영업 공지', '이벤트']

const NEWS_POSTS = [
  {
    id: 1,
    shop: '멘야준',
    branch: '망원 본점',
    handle: '@menyajun_official',
    type: '한정 메뉴',
    title: '여름 한정: 자가제면 냉 시오 라멘 개시',
    summary: [
      '제주산 토종닭 맑은 육수를 차갑게 정제하여 감칠맛 극대화',
      '9월 한 달간 매일 30그릇 한정 판매 (13,000원)',
      '평일 11:30 오픈 20분 전 방문 권장',
    ],
    time: '2시간 전',
    photo: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=600&h=400&fit=crop&auto=format&q=80',
    instagramUrl: 'https://instagram.com',
    notifying: true,
  },
  {
    id: 2,
    shop: '오레노라멘',
    branch: '마포 본점',
    handle: '@orenoramen_kr',
    type: '영업 공지',
    title: '이번 주 토요일 육수 테스트로 인한 단축 운영 안내',
    summary: [
      '새로운 닭 육수 배합 테스트로 인해 12:00–18:00까지만 운영',
      '마지막 주문 시간은 17:30으로 단축됩니다',
      '일요일부터는 정상 영업 (11:00–21:00) 진행',
    ],
    time: '어제',
    photo: null,
    instagramUrl: 'https://instagram.com',
    notifying: true,
  },
  {
    id: 3,
    shop: '후쿠 라멘',
    branch: '합정점',
    handle: '@fuku_ramen_seoul',
    type: '이벤트',
    title: '개점 1주년 감사제: 특제 미소 라멘 차슈 무료 증정',
    summary: [
      '9월 5일~7일 (3일간) 방문 고객 전원 수비드 삼겹 차슈 2장 쿠폰',
      '당일 조기 재료 소진 시 이벤트가 일찍 마감될 수 있습니다',
    ],
    time: '3일 전',
    photo: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=600&h=400&fit=crop&auto=format&q=80',
    instagramUrl: 'https://instagram.com',
    notifying: false,
  },
  {
    id: 4,
    shop: '묘코',
    branch: '연남점',
    handle: '@myoko_ramen',
    type: '영업 공지',
    title: '9월 추석 연휴 및 오리 수급 임시 휴무 공지',
    summary: [
      '오리 산지 직송 일정으로 9월 14일(월)~16일(수) 3일간 임시 휴무',
      '9월 17일(목)부터 정상 영업 재개',
    ],
    time: '4일 전',
    photo: null,
    instagramUrl: 'https://instagram.com',
    notifying: false,
  },
]

export default function NewsFeedScreen({ onShopClick }: Props) {
  const [activeFilter, setActiveFilter] = useState('전체')
  const [notifications, setNotifications] = useState<Record<number, boolean>>(
    Object.fromEntries(NEWS_POSTS.map(p => [p.id, p.notifying]))
  )

  const filtered = activeFilter === '전체'
    ? NEWS_POSTS
    : NEWS_POSTS.filter(p => p.type.startsWith(activeFilter))

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#FFFFFF] text-[#25282B]">
      
      {/* 1. 상단 바 */}
      <header className="flex-shrink-0 bg-white/95 backdrop-blur-md px-5 pt-12 pb-3.5 border-b border-[#E2E2E2]">
        <div className="flex items-center gap-2.5 mb-3">
          <img src="/logo.png" alt="RAOTA" className="w-8 h-8 object-contain" />
          <div>
            <h1 className="text-[20px] font-black tracking-tight text-[#25282B]">
              라멘야 인스타 속보
            </h1>
            <p className="text-[10px] text-[#7E7E7E]">전국 라멘야 공식 인스타그램 실시간 피드</p>
          </div>
        </div>

        {/* 필터 탭 */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {FILTERS.map(f => {
            const active = activeFilter === f
            return (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
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

      {/* 2. 속보 목록 */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
        {filtered.map(post => (
          <article key={post.id} className="bg-white rounded-[6px] overflow-hidden border border-[#E2E2E2]">
            
            {/* 상단 인스타 계정 & 시간 정보 */}
            <div className="p-3.5 pb-2.5 flex items-center justify-between border-b border-[#E2E2E2]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#FF512F] to-[#DD2476] text-white flex items-center justify-center text-[10px] font-black shadow-xs">
                  📸
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-black text-[#25282B]">{post.shop} ({post.branch})</span>
                    <span className="text-[10px] font-bold text-[#E60000]">[{post.type}]</span>
                  </div>
                  <p className="text-[10px] text-[#7E7E7E]">{post.handle} · {post.time}</p>
                </div>
              </div>

              <button
                onClick={() => setNotifications(prev => ({ ...prev, [post.id]: !prev[post.id] }))}
                className={`px-2.5 py-1 rounded-[32px] text-[10px] font-bold border transition-all ${
                  notifications[post.id]
                    ? 'bg-[#25282B] text-white border-[#25282B]'
                    : 'bg-[#F2F2F2] text-[#7E7E7E] border-[#E2E2E2]'
                }`}
              >
                {notifications[post.id] ? '알림 켜짐 ✓' : '알림 받기'}
              </button>
            </div>

            {/* 인스타그램 사진 */}
            {post.photo && (
              <div className="h-44 bg-[#F2F2F2] overflow-hidden relative">
                <img src={post.photo} alt={post.title} className="w-full h-full object-cover" />
              </div>
            )}

            {/* 본문 및 AI 3줄 요약 */}
            <div className="p-4">
              <h2 className="text-[15px] font-black text-[#25282B] leading-snug mb-2.5">
                {post.title}
              </h2>

              {/* AI 3줄 요약 블록 */}
              <div className="p-3 bg-[#F2F2F2] rounded-[6px] space-y-1 mb-3.5">
                <span className="text-[10px] font-black text-[#25282B] flex items-center gap-1 block mb-1">
                  <span className="text-[#E60000]">⚡</span> 핵심 요약
                </span>
                {post.summary.map((line, idx) => (
                  <p key={idx} className="text-[11px] text-[#4A4D52] leading-relaxed flex items-start gap-1">
                    <span className="text-[#7E7E7E]">•</span>
                    <span>{line}</span>
                  </p>
                ))}
              </div>

              {/* 하단 바로가기 버튼 그룹 */}
              <div className="flex items-center gap-2 pt-2 border-t border-[#E2E2E2]">
                <button
                  onClick={onShopClick}
                  className="flex-1 h-9 rounded-[6px] bg-[#F2F2F2] hover:bg-[#E2E2E2] text-[11px] font-bold text-[#25282B] flex items-center justify-center gap-1 transition-colors"
                >
                  <span>매장 정보 보기</span>
                  <span>📍</span>
                </button>
                <a
                  href={post.instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 h-9 rounded-[6px] border border-[#25282B] hover:bg-[#25282B] hover:text-white text-[11px] font-bold text-[#25282B] flex items-center justify-center gap-1 transition-colors"
                >
                  <span>인스타 원문 보기</span>
                  <span>↗</span>
                </a>
              </div>
            </div>
          </article>
        ))}

        <div className="p-4 text-center text-[10px] text-[#7E7E7E] font-medium">
          서울 및 전국 120여 개 라멘야의 공식 인스타그램을 주기적으로 자동 수집합니다.
        </div>
        <div className="h-6" />
      </div>
    </div>
  )
}
