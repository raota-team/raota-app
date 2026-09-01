import { useState } from 'react'
import { TASTE_FIELDS, RAMEN_TYPES, REVISIT_OPTIONS, type TasteNoteKey, type TasteNotes, type RevisitOption, type RamenLog } from '../types'

interface Props {
  recordStatus: 'idle' | 'saving' | 'error' | 'success'
  onBack: () => void
  onSaveLog: (logData: {
    shopName: string
    branch: string
    menuName: string
    ramenType: string
    visitedAt: string
    revisit: RevisitOption
    note: string
    tasteNotes: TasteNotes
    imageUrl: string | null
    isPublic: boolean
  }) => void
  onRetry: () => void
  initialShopName?: string
}

const AVAILABLE_SHOPS = [
  { name: '멘야준', branch: '망원 본점', type: '쇼유', menus: ['특제 쇼유 라멘', '반숙 쇼유 라멘', '시오 라멘'] },
  { name: '후쿠 라멘', branch: '합정점', type: '미소', menus: ['특제 미소 라멘', '매운 미소 라멘', '차슈 미소 라멘'] },
  { name: '오레노라멘', branch: '마포 본점', type: '돈코츠', menus: ['토리파이탄 라멘', '카라파이탄 라멘', '쇼유 라멘'] },
  { name: '묘코', branch: '연남점', type: '시오', menus: ['특제 오리 시오 라멘', '오리 쇼유 라멘'] },
]

export default function RecordScreen({
  recordStatus,
  onBack,
  onSaveLog,
  onRetry,
  initialShopName = '멘야준',
}: Props) {
  const [selectedShop, setSelectedShop] = useState(
    AVAILABLE_SHOPS.find(s => s.name === initialShopName) || AVAILABLE_SHOPS[0]
  )
  const [menuName, setMenuName] = useState(selectedShop.menus[0])
  const [isCustomMenu, setIsCustomMenu] = useState(false)
  const [customMenuInput, setCustomMenuInput] = useState('')
  const [ramenType, setRamenType] = useState(selectedShop.type)
  const [visitedAt, setVisitedAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [revisit, setRevisit] = useState<RevisitOption>('자주 감')
  const [note, setNote] = useState('')
  const [tasteNotes, setTasteNotes] = useState<TasteNotes>({
    broth: ['진해요', '감칠맛 좋아요'],
    noodle: ['단단해요'],
    seasoning: ['딱 좋아요'],
    topping: ['차슈 좋아요'],
  })
  const [isTasteDetailsOpen, setIsTasteDetailsOpen] = useState(true)
  const [isPublic, setIsPublic] = useState(true)
  const [imageUrl, setImageUrl] = useState<string | null>(
    'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=800&h=600&fit=crop&auto=format&q=80'
  )
  const [showShopSheet, setShowShopSheet] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)

  const handleShopSelect = (shop: typeof AVAILABLE_SHOPS[0]) => {
    setSelectedShop(shop)
    setMenuName(shop.menus[0])
    setRamenType(shop.type)
    setIsCustomMenu(false)
    setShowShopSheet(false)
  }

  const toggleTasteNote = (key: TasteNoteKey, option: string) => {
    setTasteNotes(prev => {
      const current = prev[key]
      const next = current.includes(option)
        ? current.filter(item => item !== option)
        : [...current, option]
      return { ...prev, [key]: next }
    })
  }

  const effectiveMenuName = isCustomMenu ? customMenuInput.trim() : menuName
  const canSave = Boolean(
    selectedShop &&
    effectiveMenuName.length > 0 &&
    ramenType &&
    visitedAt &&
    revisit &&
    note.trim().length > 0 &&
    recordStatus === 'idle'
  )

  const handleSave = () => {
    if (!canSave) return
    onSaveLog({
      shopName: selectedShop.name,
      branch: selectedShop.branch,
      menuName: effectiveMenuName,
      ramenType,
      visitedAt,
      revisit,
      note: note.trim(),
      tasteNotes,
      imageUrl,
      isPublic,
    })
  }

  const hasEdited = note.length > 0 || isCustomMenu || !isPublic

  const handleBack = () => {
    if (hasEdited) {
      setShowLeaveConfirm(true)
    } else {
      onBack()
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#FFFFFF] text-[#25282B]">
      
      {/* 1. 상단 마스터 헤더 */}
      <header className="flex-shrink-0 bg-white/95 backdrop-blur-md border-b border-[#E2E2E2] px-4 pt-12 pb-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#25282B] hover:bg-[#F2F2F2] active:scale-95 transition-all"
            aria-label="뒤로가기"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
          <div>
            <span className="text-[10px] font-bold text-[#7E7E7E] block">RAOTA 라멘로그</span>
            <h1 className="text-[17px] font-black text-[#25282B] tracking-tight">라멘로그 작성하기</h1>
          </div>
        </div>

        <span className="text-[11px] font-bold text-[#E60000] bg-[#E60000]/10 px-3 py-1 rounded-[32px]">
          {isPublic ? '공개 기록' : '비공개'}
        </span>
      </header>

      {/* 2. 입력 폼 영역 */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
        
        {/* 사진 첨부 섹션 */}
        <section className="bg-white rounded-[6px] border border-[#E2E2E2] p-4">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E2E2E2]">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase text-[#E60000]">필수</span>
              <h2 className="text-[13px] font-black tracking-tight text-[#25282B]">시식 사진 추가</h2>
            </div>
            {imageUrl && (
              <button
                onClick={() => setImageUrl(null)}
                className="text-[11px] font-bold text-[#7E7E7E] hover:text-[#E60000]"
              >
                사진 삭제
              </button>
            )}
          </div>

          {imageUrl ? (
            <div className="relative aspect-[16/10] rounded-[6px] overflow-hidden border border-[#E2E2E2] bg-[#F2F2F2]">
              <img src={imageUrl} alt="라멘 사진" className="w-full h-full object-cover" />
              <div className="absolute bottom-2 right-2 bg-[#25282B]/85 text-white text-[10px] font-bold px-2.5 py-1 rounded-[32px] backdrop-blur-xs">
                촬영 사진 적용됨 ✓
              </div>
            </div>
          ) : (
            <button
              onClick={() => setImageUrl('https://images.unsplash.com/photo-1742633882713-593c13e90231?w=800&h=600&fit=crop&auto=format&q=80')}
              className="w-full py-8 rounded-[6px] border border-dashed border-[#E2E2E2] bg-[#F2F2F2] flex flex-col items-center justify-center gap-1.5 text-[#7E7E7E] hover:border-[#E60000] hover:text-[#E60000] transition-colors"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
              </svg>
              <span className="text-[12px] font-bold">터치하여 라멘 사진 불러오기</span>
            </button>
          )}
        </section>

        {/* 한 그릇 기본 정보 (매장 / 방문일 / 메뉴 / 라멘 계보) */}
        <section className="bg-white rounded-[6px] border border-[#E2E2E2] p-4 space-y-4">
          <div className="flex items-center gap-1.5 pb-2 border-b border-[#E2E2E2]">
            <span className="text-[10px] font-black uppercase text-[#E60000]">필수</span>
            <h2 className="text-[13px] font-black tracking-tight text-[#25282B]">한 그릇 기본 정보</h2>
          </div>

          {/* 가게 선택 */}
          <div>
            <label className="block text-[11px] font-bold text-[#7E7E7E] mb-1.5">방문 가게</label>
            <button
              onClick={() => setShowShopSheet(true)}
              className="w-full h-11 px-3.5 rounded-[6px] bg-[#F2F2F2] border border-[#E2E2E2] flex items-center justify-between text-[13px] font-bold text-[#25282B]"
            >
              <span>{selectedShop.name} · {selectedShop.branch}</span>
              <span className="text-[11px] text-[#E60000]">가게 변경 ▼</span>
            </button>
          </div>

          {/* 방문일 */}
          <div>
            <label className="block text-[11px] font-bold text-[#7E7E7E] mb-1.5">방문일자</label>
            <input
              type="date"
              value={visitedAt}
              onChange={e => setVisitedAt(e.target.value)}
              className="w-full h-11 px-3.5 rounded-[6px] bg-[#F2F2F2] border border-[#E2E2E2] text-[13px] font-bold text-[#25282B] outline-none focus:border-[#25282B]"
            />
          </div>

          {/* 먹은 메뉴명 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-[#7E7E7E]">먹은 메뉴</label>
              <span className="text-[10px] text-[#7E7E7E]">예: 특제 쇼유 라멘</span>
            </div>
            <input
              type="text"
              value={menuName}
              onChange={e => setMenuName(e.target.value)}
              placeholder="먹은 메뉴명을 입력해주세요"
              className="w-full h-11 px-3.5 rounded-[6px] bg-[#F2F2F2] border border-[#E2E2E2] text-[13px] font-bold text-[#25282B] placeholder-[#8A8A8A] outline-none focus:border-[#25282B]"
            />
          </div>

          {/* 라멘 종류/계보 */}
          <div>
            <label className="block text-[11px] font-bold text-[#7E7E7E] mb-1.5">라멘 계보/종류</label>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {RAMEN_TYPES.map(t => {
                const active = ramenType === t
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setRamenType(t)}
                    className={`flex-shrink-0 h-8 px-3 rounded-[32px] text-[11px] font-bold border transition-all ${
                      active
                        ? 'bg-[#E60000] text-white border-[#E60000]'
                        : 'bg-[#F2F2F2] text-[#25282B] border-transparent hover:border-[#25282B]'
                    }`}
                  >
                    {t}
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        {/* 재방문 의사 (3단계) */}
        <section className="bg-white rounded-[6px] border border-[#E2E2E2] p-4">
          <div className="flex items-center gap-1.5 pb-2 mb-3 border-b border-[#E2E2E2]">
            <span className="text-[10px] font-black uppercase text-[#E60000]">필수</span>
            <h2 className="text-[13px] font-black tracking-tight text-[#25282B]">재방문 의사</h2>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {REVISIT_OPTIONS.map(opt => {
              const active = revisit === opt
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setRevisit(opt)}
                  className={`h-11 rounded-[60px] border text-[12px] font-bold transition-all active:scale-98 ${
                    active
                      ? opt === '자주 감'
                        ? 'bg-[#E60000] border-[#E60000] text-white'
                        : 'bg-[#25282B] border-[#25282B] text-white'
                      : 'bg-[#F2F2F2] border-[#E2E2E2] text-[#7E7E7E] hover:border-[#25282B]'
                  }`}
                >
                  {opt}
                </button>
              )
            })}
          </div>
        </section>

        {/* 기억해둘 점 (메모) */}
        <section className="bg-white rounded-[6px] border border-[#E2E2E2] p-4">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E2E2E2]">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase text-[#E60000]">필수</span>
              <h2 className="text-[13px] font-black tracking-tight text-[#25282B]">기억해둘 점</h2>
            </div>
            <span className="text-[11px] font-mono text-[#7E7E7E]">{note.length} / 200</span>
          </div>

          <textarea
            value={note}
            onChange={e => setNote(e.target.value.slice(0, 200))}
            placeholder="예: 카라이 변경이 잘 어울렸고 다음엔 면을 단단하게 부탁하기"
            className="w-full h-24 text-[13px] text-[#25282B] placeholder-[#8A8A8A] bg-[#F2F2F2] border border-[#E2E2E2] rounded-[6px] p-3.5 resize-none outline-none focus:border-[#25282B] transition-all leading-relaxed"
          />
        </section>

        {/* 맛을 더 남길까요? (맛 상세 태그 아코디언) */}
        <section className="bg-white rounded-[6px] border border-[#E2E2E2] overflow-hidden">
          <button
            type="button"
            onClick={() => setIsTasteDetailsOpen(!isTasteDetailsOpen)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-[#F2F2F2]/50 transition-colors"
          >
            <div>
              <h2 className="text-[13px] font-black tracking-tight text-[#25282B]">맛을 더 남길까요?</h2>
              <p className="text-[11px] text-[#7E7E7E] mt-0.5">국물·면·간·토핑 상세 특징을 태그로 기록해보세요.</p>
            </div>
            <span className={`text-[16px] font-bold text-[#7E7E7E] transition-transform ${isTasteDetailsOpen ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>

          {isTasteDetailsOpen && (
            <div className="p-4 pt-0 border-t border-[#E2E2E2] space-y-4 bg-[#F2F2F2]/30">
              {TASTE_FIELDS.map(field => (
                <div key={field.key} className="pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] font-black text-[#25282B]">{field.label}</span>
                    <span className="text-[10px] font-bold text-[#E60000]">{tasteNotes[field.key].length}개 선택</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {field.options.map(opt => {
                      const selected = tasteNotes[field.key].includes(opt)
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleTasteNote(field.key, opt)}
                          className={`h-7 px-3 rounded-[32px] text-[11px] font-bold border transition-all ${
                            selected
                              ? 'bg-[#E60000] text-white border-[#E60000]'
                              : 'bg-white text-[#4A4D52] border-[#E2E2E2] hover:border-[#25282B]'
                          }`}
                        >
                          {opt}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 내 기록 공개하기 스위치 */}
        <section className="bg-white rounded-[6px] border border-[#E2E2E2] p-4 flex items-center justify-between">
          <div>
            <h2 className="text-[13px] font-black text-[#25282B]">내 기록 공개하기</h2>
            <p className="text-[11px] text-[#7E7E7E] mt-0.5">비공개로 설정하면 피드에 노출되지 않고 나만 볼 수 있습니다.</p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={e => setIsPublic(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-[#E2E2E2] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#E60000]"></div>
          </label>
        </section>

        <div className="h-6" />
      </div>

      {/* 3. 하단 고정 발행 버튼 */}
      <footer className="flex-shrink-0 border-t border-[#E2E2E2] bg-white px-4 py-3">
        {recordStatus === 'error' ? (
          <button onClick={onRetry} className="w-full h-13 rounded-[60px] bg-[#E60000] text-white text-[15px] font-bold active:scale-98">
            다시 저장하기
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={`w-full h-13 rounded-[60px] text-[15px] font-bold tracking-wide transition-all flex items-center justify-center gap-2 ${
              canSave
                ? 'bg-[#E60000] text-white active:scale-98 hover:bg-[#CC0000]'
                : 'bg-[#F2F2F2] text-[#8A8A8A] cursor-not-allowed'
            }`}
          >
            {recordStatus === 'saving'
              ? '라멘로그 아카이빙 중...'
              : !canSave
                ? '필수 항목을 모두 작성해주세요'
                : '라멘로그 보관 및 발행하기 →'}
          </button>
        )}
      </footer>

      {/* 매장 선택 바텀 시트 */}
      {showShopSheet && (
        <>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs anim-fade-in z-40" onClick={() => setShowShopSheet(false)}/>
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl anim-slide-up border-t border-[#E2E2E2] p-5 shadow-2xl z-50">
            <h3 className="text-[17px] font-black text-[#25282B] mb-3">방문 가게 선택</h3>
            <div className="divide-y divide-[#E2E2E2]">
              {AVAILABLE_SHOPS.map(shop => (
                <button
                  key={shop.name}
                  onClick={() => handleShopSelect(shop)}
                  className="w-full py-3.5 flex items-center justify-between text-left font-bold text-[14px] text-[#25282B] hover:bg-[#F2F2F2] px-2 rounded-[6px]"
                >
                  <div>
                    <span>{shop.name}</span>
                    <span className="text-[11px] text-[#7E7E7E] ml-2">({shop.branch})</span>
                  </div>
                  {selectedShop.name === shop.name && <span className="text-[#E60000]">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* 이탈 확인 모달 */}
      {showLeaveConfirm && (
        <>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs anim-fade-in z-40"/>
          <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 bg-white rounded-[6px] p-5 anim-fade-in-up border border-[#E2E2E2] shadow-2xl z-50">
            <h3 className="text-[17px] font-black text-[#25282B] mb-1">작성을 취소할까요?</h3>
            <p className="text-[13px] text-[#7E7E7E] mb-4">입력하신 평가 내용이 저장되지 않습니다.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 h-11 rounded-[60px] border border-[#25282B] text-[13px] font-bold text-[#25282B]"
              >
                계속 작성
              </button>
              <button
                onClick={onBack}
                className="flex-1 h-11 rounded-[60px] bg-[#E60000] text-white text-[13px] font-bold"
              >
                나가기
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
