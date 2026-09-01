import { useState } from 'react'
import type { RamenLog } from '../types'

interface Props {
  logs: RamenLog[]
  onRecordClick: () => void
  onShopClick?: (shopName: string) => void
}

const RAMEN_TYPE_FILTERS = ['전체', '쇼유', '돈코츠', '시오', '미소', '츠케멘', '기타']

export default function LogFeedScreen({ logs, onRecordClick }: Props) {
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
    <div className="h-full flex flex-col overflow-hidden bg-[#FFFFFF] text-[#25282B] relative">
      
      {/* 1. 상단 바 */}
      <header className="flex-shrink-0 bg-white/95 backdrop-blur-md px-5 pt-12 pb-3.5 border-b border-[#E2E2E2]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="RAOTA" className="w-8 h-8 object-contain" />
            <div>
              <h1 className="text-[20px] font-black tracking-tight text-[#25282B]">
                라멘러들의 기록
              </h1>
              <p className="text-[10px] text-[#7E7E7E]">라멘 매니아들의 실시간 테이스팅 로그</p>
            </div>
          </div>
          <span className="text-[10px] text-[#E60000] border border-[#E60000] px-2.5 py-0.5 rounded-[32px] font-bold">
            {allLogs.length}개 로그
          </span>
        </div>

        {/* 라멘 계보 필터 칩 */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {RAMEN_TYPE_FILTERS.map(f => {
            const active = typeFilter === f
            return (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
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

      {/* 2. 피드 목록 영역 */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
        
        {/* 라오타 공식 라멘로그 이벤트 배너 */}
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

        {/* 라멘로그 카드 목록 */}
        <div className="space-y-4">
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
                          : 'bg-white border-[#E2E2E2] text-[#7E7E7E] hover:border-[#25282B]'
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

        <div className="h-14" />
      </div>

      {/* 우측 하단 플로팅 기록 버튼 (FAB) */}
      <button
        onClick={onRecordClick}
        className="absolute bottom-4 right-4 z-30 h-12 px-4 rounded-[60px] bg-[#E60000] text-white font-bold text-[13px] shadow-xl shadow-[#E60000]/30 flex items-center gap-2 active:scale-95 hover:bg-[#CC0000] transition-all"
        aria-label="라멘로그 쓰기"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        <span>기록하기</span>
      </button>
    </div>
  )
}
