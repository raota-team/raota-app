import { useState } from 'react'
import type { RamenLog, TasteNoteKey } from '../types'

interface Props {
  logs?: RamenLog[]
  onLogLike?: (id: number) => void
}

const INITIAL_LOGS: RamenLog[] = [
  {
    id: 1,
    author: { name: '멘마수집가', level: '돈골파 9레벨' },
    shop: { id: 1, name: '멘야준', branch: '망원 본점', location: '서울 마포구' },
    menuName: '특제 쇼유 라멘',
    ramenType: '쇼유',
    visitedAt: '2026. 09. 01',
    imageUrl: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=800&h=600&fit=crop&auto=format&q=80',
    note: '닭과 오리 더블 육수의 첫 모금 감칠맛이 폭발적임. 다음엔 면을 단단하게 주문해볼 것.',
    tasteNotes: {
      broth: ['진해요', '감칠맛 좋아요'],
      noodle: ['단단해요', '국물이 잘 배어요'],
      seasoning: ['딱 좋아요'],
      topping: ['차슈 좋아요', '계란 좋아요'],
    },
    revisit: '자주 감',
    likes: 38,
    isLiked: false,
    isPublic: true,
    createdAt: '2시간 전',
  },
  {
    id: 2,
    author: { name: '토리파이탄러버', level: '파이탄 8레벨' },
    shop: { id: 3, name: '오레노라멘', branch: '마포 본점', location: '서울 마포구' },
    menuName: '토리파이탄 라멘',
    ramenType: '돈코츠',
    visitedAt: '2026. 08. 31',
    imageUrl: 'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=800&h=600&fit=crop&auto=format&q=80',
    note: '거품 낸 닭 육수의 크리미함이 일품. 밥 말아먹기 딱 좋은 염도와 부드러운 수비드 닭가슴살 차슈.',
    tasteNotes: {
      broth: ['진해요', '기름져요'],
      noodle: ['탄력 있어요'],
      seasoning: ['딱 좋아요', '밥 생각나요'],
      topping: ['차슈 좋아요', '구성 알차요'],
    },
    revisit: '자주 감',
    likes: 24,
    isLiked: true,
    isPublic: true,
    createdAt: '어제',
  },
  {
    id: 3,
    author: { name: '미소천사', level: '미소 7레벨' },
    shop: { id: 2, name: '후쿠 라멘', branch: '합정점', location: '서울 마포구' },
    menuName: '특제 삿포로 미소 라멘',
    ramenType: '미소',
    visitedAt: '2026. 08. 29',
    imageUrl: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=800&h=600&fit=crop&auto=format&q=80',
    note: '웍질로 불향을 입힌 숙주와 진한 된장 육수의 조화. 꼬불꼬불한 노란 치지레멘의 씹는 맛이 최고.',
    tasteNotes: {
      broth: ['진해요', '감칠맛 좋아요'],
      noodle: ['탄력 있어요'],
      seasoning: ['짭짤해요'],
      topping: ['차슈 좋아요', '파 향 좋아요'],
    },
    revisit: '가끔 생각남',
    likes: 19,
    isLiked: false,
    isPublic: true,
    createdAt: '3일 전',
  },
]

const SHOP_NEWS = [
  {
    shop: '멘야준', branch: '망원 본점', type: '한정 메뉴',
    title: '여름 한정: 자가제면 냉 시오 라멘 개시',
    body: '제주산 토종닭 맑은 육수를 차갑게 정제하여 감칠맛을 극대화했습니다. 9월 한 달간 하루 30그릇 한정 제공.',
    time: '2시간 전',
    photo: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=600&h=400&fit=crop&auto=format&q=80',
    notifying: true,
    price: '13,000원',
  },
  {
    shop: '오레노라멘', branch: '마포 본점', type: '영업 공지',
    title: '이번 주 토요일 육수 테스트로 인한 단축 운영 안내',
    body: '새로운 닭 육수 배합 테스트로 인해 토요일은 12:00–18:00까지만 운영합니다. 양해 부탁드립니다.',
    time: '어제',
    photo: null,
    notifying: true,
    price: '',
  },
  {
    shop: '후쿠 라멘', branch: '합정점', type: '이벤트',
    title: '개점 1주년 감사제: 특제 미소 라멘 차슈 무료 증정',
    body: '9월 5일~7일 (3일간) 방문 고객 전원에게 수비드 삼겹 차슈 2장 추가 쿠폰을 제공합니다.',
    time: '3일 전',
    photo: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=600&h=400&fit=crop&auto=format&q=80',
    notifying: false,
    price: '차슈 2장 증정',
  },
]

const RAMEN_TYPE_FILTERS = ['전체', '쇼유', '돈코츠', '시오', '미소', '츠케멘']

export default function FeedScreen({ logs = INITIAL_LOGS }: Props) {
  const [activeTab, setActiveTab] = useState<'logs' | 'news'>('logs')
  const [typeFilter, setTypeFilter] = useState('전체')
  const [allLogs, setAllLogs] = useState<RamenLog[]>(logs)

  const handleToggleLike = (id: number) => {
    setAllLogs(prev =>
      prev.map(item =>
        item.id === id
          ? {
              ...item,
              isLiked: !item.isLiked,
              likes: item.isLiked ? item.likes - 1 : item.likes + 1,
            }
          : item
      )
    )
  }

  const filteredLogs = typeFilter === '전체'
    ? allLogs
    : allLogs.filter(l => l.ramenType === typeFilter)

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#FFFFFF] text-[#25282B]">
      
      {/* 1. 상단 바 */}
      <header className="flex-shrink-0 bg-white/95 backdrop-blur-md px-5 pt-3.5 pb-3.5 border-b border-[#E2E2E2]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="RAOTA" className="w-8 h-8 object-contain" />
            <div>
              <h1 className="text-[20px] font-black tracking-tight text-[#25282B]">
                라멘러 피드 & 소식
              </h1>
              <p className="text-[10px] text-[#7E7E7E]">유저들의 생생한 라멘로그와 매장 속보</p>
            </div>
          </div>
          <span className="text-[10px] text-[#E60000] border border-[#E60000] px-2.5 py-0.5 rounded-[32px] font-bold">
            실시간
          </span>
        </div>

        {/* 세그먼트 탭: [라멘러들의 기록] | [라멘집 속보] */}
        <div className="flex bg-[#F2F2F2] p-1 rounded-[6px]">
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex-1 py-1.5 rounded-[4px] text-[12px] font-bold transition-all ${
              activeTab === 'logs'
                ? 'bg-white text-[#25282B] shadow-xs'
                : 'text-[#7E7E7E] hover:text-[#25282B]'
            }`}
          >
            라멘러들의 기록 ({allLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('news')}
            className={`flex-1 py-1.5 rounded-[4px] text-[12px] font-bold transition-all ${
              activeTab === 'news'
                ? 'bg-white text-[#25282B] shadow-xs'
                : 'text-[#7E7E7E] hover:text-[#25282B]'
            }`}
          >
            라멘집 속보 ({SHOP_NEWS.length})
          </button>
        </div>


        {/* 라멘 계보 필터 칩 (logs 탭일 때) */}
        {activeTab === 'logs' && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pt-3">
            {RAMEN_TYPE_FILTERS.map(f => {
              const active = typeFilter === f
              return (
                <button
                  key={f}
                  onClick={() => setTypeFilter(f)}
                  className={`flex-shrink-0 h-7 px-3 rounded-[32px] text-[11px] font-bold border transition-all ${
                    active
                      ? 'bg-[#25282B] text-white border-[#25282B]'
                      : 'bg-[#F2F2F2] text-[#25282B] border-transparent hover:border-[#BEBEBE]'
                  }`}
                >
                  {f}
                </button>
              )
            })}
          </div>
        )}
      </header>

      {/* 2. 피드 목록 영역 */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
        
        {/* 탭 1: 라멘러들의 기록 피드 (RamenLogCard 목록) */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            {/* 라오타 공식 라멘로그 이벤트 배너 (raota-front 스펙) */}
            <div className="rounded-[6px] bg-[#25282B] p-4 text-white">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] bg-[#E60000] text-white text-[14px]">
                  🎁
                </span>
                <div className="min-w-0">
                  <span className="inline-block rounded-[32px] bg-white/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white/80 mb-1">
                    RAMEN LOG EVENT
                  </span>
                  <h2 className="text-[14px] font-black leading-snug">
                    라멘로그 남기고 커피 한 잔 받아가세요 (~8/31)
                  </h2>
                  <p className="mt-1 text-[11px] text-white/70 leading-relaxed">
                    라멘로그를 작성한 분들 중 추첨을 통해 메가커피 기프티콘을 드립니다.
                  </p>
                </div>
              </div>
            </div>
            {filteredLogs.map(log => {
              const allTags = [
                ...log.tasteNotes.broth,
                ...log.tasteNotes.noodle,
                ...log.tasteNotes.seasoning,
                ...log.tasteNotes.topping,
              ]

              return (
                <article key={log.id} className="bg-white rounded-[6px] border border-[#E2E2E2] overflow-hidden">
                  
                  {/* 상단 작성자 및 매장 정보 */}
                  <div className="p-3.5 pb-2.5 flex items-center justify-between border-b border-[#E2E2E2]">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#25282B] text-white flex items-center justify-center text-[10px] font-black">
                        {log.author.name[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] font-black text-[#25282B]">{log.author.name}</span>
                          <span className="text-[9px] font-bold text-[#E60000] bg-[#E60000]/10 px-1.5 py-0.2 rounded-[32px]">
                            {log.author.level}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#7E7E7E]">{log.visitedAt} 방문</p>
                      </div>
                    </div>

                    <span className="text-[11px] font-bold text-[#25282B] bg-[#F2F2F2] px-2.5 py-1 rounded-[32px]">
                      {log.revisit}
                    </span>
                  </div>

                  {/* 라멘 사진 */}
                  {log.imageUrl && (
                    <div className="relative aspect-[16/10] bg-[#F2F2F2] overflow-hidden">
                      <img src={log.imageUrl} alt={log.menuName} className="w-full h-full object-cover" />
                      <div className="absolute top-2.5 left-2.5 bg-[#25282B]/85 backdrop-blur-xs text-white text-[10px] font-bold px-2.5 py-0.5 rounded-[32px]">
                        {log.ramenType}
                      </div>
                    </div>
                  )}

                  {/* 본문 내용 */}
                  <div className="p-4">
                    <div className="flex items-baseline justify-between mb-1.5">
                      <h2 className="text-[16px] font-black text-[#25282B]">
                        {log.menuName}
                      </h2>
                      <span className="text-[11px] font-bold text-[#7E7E7E]">
                        {log.shop.name} · {log.shop.branch}
                      </span>
                    </div>

                    {/* 기억해둘 점 인용 */}
                    <div className="p-3 bg-[#F2F2F2] rounded-[6px] text-[12px] text-[#25282B] leading-relaxed mb-3">
                      “{log.note}”
                    </div>

                    {/* 맛 상세 태그 칩 */}
                    {allTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {allTags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="bg-white border border-[#E2E2E2] text-[#4A4D52] text-[10px] font-bold px-2 py-0.5 rounded-[32px]"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* 하단 좋아요 토글 및 시간 */}
                    <div className="flex items-center justify-between pt-2.5 border-t border-[#E2E2E2] text-[11px]">
                      <span className="text-[#7E7E7E]">{log.createdAt}</span>
                      <button
                        onClick={() => handleToggleLike(log.id)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-[60px] font-bold border transition-all active:scale-95 ${
                          log.isLiked
                            ? 'bg-[#E60000]/10 border-[#E60000] text-[#E60000]'
                            : 'bg-white border-[#E2E2E2] text-[#7E7E7E] hover:border-[#BEBEBE]'
                        }`}
                      >
                        <span>{log.isLiked ? '♥' : '♡'}</span>
                        <span>{log.likes}</span>
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {/* 탭 2: 라멘집 속보 (기존 공지/이벤트) */}
        {activeTab === 'news' && (

          <div className="space-y-4">
            {SHOP_NEWS.map((item, i) => (
              <article key={i} className="bg-white rounded-[6px] overflow-hidden border border-[#E2E2E2]">
                {item.photo && (
                  <div className="h-40 bg-[#F2F2F2] overflow-hidden relative">
                    <img src={item.photo} alt={item.title} className="w-full h-full object-cover" />
                    {item.price && (
                      <div className="absolute top-3 right-3 bg-[#25282B]/85 backdrop-blur-xs text-white text-[10px] font-bold px-2.5 py-0.5 rounded-[32px]">
                        {item.price}
                      </div>
                    )}
                  </div>
                )}

                <div className="p-4">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-dashed border-[#E2E2E2] text-[10px] font-bold text-[#7E7E7E]">
                    <span className="text-[#25282B]">{item.shop} ({item.branch})</span>
                    <span className="text-[#E60000]">[{item.type}]</span>
                  </div>

                  <h2 className="text-[15px] font-black text-[#25282B] leading-snug mb-1.5">{item.title}</h2>
                  <p className="text-[12px] text-[#4A4D52] leading-relaxed">{item.body}</p>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#E2E2E2] text-[11px]">
                    <span className="text-[#7E7E7E]">{item.time}</span>
                    <span className="text-[#E60000] font-bold">확인하기 →</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="h-6" />
      </div>
    </div>
  )
}
