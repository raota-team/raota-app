interface Props {
  onClose: () => void
  onSelectShop: () => void
}

const OPTIONS = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
      </svg>
    ),
    label: '현재 위치 주변 라멘야',
    sub: '가장 가까운 라멘야 자동 탐색',
    action: 'locate',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
      </svg>
    ),
    label: '가고 싶은 곳 (저장 목록 3곳)',
    sub: '내가 찜해둔 라멘야 목록에서 선택',
    action: 'saved',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
    ),
    label: '라멘야 직접 검색',
    sub: '상호명 또는 지역명으로 검색',
    action: 'search',
  },
]

export default function RecordSheet({ onClose, onSelectShop }: Props) {
  return (
    <>
      {/* 백드롭 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-xs anim-fade-in"
        style={{ zIndex: 40 }}
        onClick={onClose}
        aria-label="닫기"
        role="button"
      />

      {/* 시트 모달 */}
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl anim-slide-up border-t border-[#E2E2E2] shadow-2xl z-50 text-[#25282B]">
        {/* 핸들 바 */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-[#E2E2E2]" />
        </div>

        <div className="px-5 pb-2">
          <span className="text-[10px] font-bold text-[#7E7E7E] block">
            라멘야 선택
          </span>
          <h2 className="text-[18px] font-black text-[#25282B] tracking-tight mt-0.5">
            어느 가게의 라멘을 기록할까요?
          </h2>
        </div>

        {/* 바로 선택 카드 (보더폰 6px 카드) */}
        <div className="mx-5 my-3">
          <div
            onClick={onSelectShop}
            className="w-full flex items-center gap-3.5 p-3.5 bg-[#F2F2F2] border border-[#E2E2E2] rounded-[6px] cursor-pointer hover:border-[#25282B] active:scale-99 transition-all group"
            role="button"
          >
            <div className="w-14 h-14 rounded-[6px] overflow-hidden flex-shrink-0 bg-white border border-[#E2E2E2]">
              <img
                src="https://images.unsplash.com/photo-1742633882713-593c13e90231?w=200&h=200&fit=crop&auto=format&q=80"
                alt="멘야준"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[14px] font-black text-[#25282B] truncate">멘야준 · 망원 본점</p>
                <span className="text-[9px] font-bold text-[#E60000] bg-[#E60000]/10 px-1.5 py-0.5 rounded-[32px]">최근 조회</span>
              </div>
              <p className="text-[11px] text-[#7E7E7E] mt-0.5 truncate">대표: 특제 쇼유 라멘</p>
            </div>
            <span className="text-[12px] font-bold text-white bg-[#E60000] px-3.5 py-1.5 rounded-[60px] group-hover:bg-[#CC0000] transition-colors">
              기록 시작 →
            </span>
          </div>
        </div>

        {/* 선택 옵션 목록 */}
        <div className="mx-5 divide-y divide-[#E2E2E2] border-t border-[#E2E2E2] mb-4">
          {OPTIONS.map((opt) => (
            <button
              key={opt.action}
              onClick={onSelectShop}
              className="w-full flex items-center gap-3 py-3 text-left hover:bg-[#F2F2F2] transition-colors group"
            >
              <div className="w-8 h-8 rounded-[6px] bg-[#F2F2F2] border border-[#E2E2E2] text-[#25282B] flex items-center justify-center flex-shrink-0 group-hover:border-[#25282B]">
                {opt.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-[#25282B]">{opt.label}</p>
                <p className="text-[11px] text-[#7E7E7E]">{opt.sub}</p>
              </div>
              <span className="text-[#7E7E7E] group-hover:text-[#25282B] text-[12px]">→</span>
            </button>
          ))}
        </div>

        <div className="px-5 pb-7">
          <button
            onClick={onClose}
            className="w-full h-11 rounded-[60px] border border-[#25282B] text-[13px] font-bold text-[#25282B] bg-white hover:bg-[#F2F2F2] transition-all"
          >
            닫기
          </button>
        </div>
      </div>
    </>
  )
}
