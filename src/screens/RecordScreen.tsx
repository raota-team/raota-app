import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react'
import { ChevronLeft, ChevronDown, Check, ImagePlus, X, AlertCircle } from 'lucide-react'
import {
  TASTE_FIELDS,
  REVISIT_OPTIONS,
  RAMEN_TYPES,
  type TasteAxisKey,
  type TasteNoteKey,
  type TasteNotes,
  type RevisitOption,
  type TasteScores,
} from '../types'
import { TASTE_AXES, REVISIT_SCORE } from '../utils/taste'
import { SHOP_CATALOG, getShopDetail, type ShopCatalogItem } from '../data/shops'
import type { SaveLogData } from '../App'

interface Props {
  recordStatus: 'idle' | 'saving' | 'error' | 'success'
  onBack: () => void
  onSaveLog: (logData: SaveLogData) => void
  onRetry: () => void
  initialShopName?: string
}

type ScoreAxisKey = Exclude<TasteAxisKey, 'revisit'>
type FieldKey = 'menu' | 'ramenType' | 'visitedAt' | TasteAxisKey
type MissingField = { key: FieldKey; label: string; kind: 'text' | 'choice' }

const SCORE_AXES = TASTE_AXES.filter((axis): axis is typeof axis & { key: ScoreAxisKey } => axis.key !== 'revisit')
const REVISIT_AXIS = TASTE_AXES.find(axis => axis.key === 'revisit')!
const SCORE_VALUES = [1, 2, 3, 4, 5]
const MAX_PHOTOS = 3
const EMPTY_TASTE_NOTES: TasteNotes = { broth: [], noodle: [], seasoning: [], topping: [] }

const todayInSeoul = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date())

/** 원장의 대표 스타일이 라멘 종류 목록과 정확히 맞을 때만 미리 고른다. 아니면 직접 고르게 둔다. */
const inferRamenType = (style: string) => RAMEN_TYPES.find(type => style.startsWith(type)) ?? ''

/** 받침 유무에 따라 을/를을 고른다. */
const objectParticle = (word: string) => {
  const code = word.charCodeAt(word.length - 1)
  if (code < 0xac00 || code > 0xd7a3) return '를'
  return (code - 0xac00) % 28 === 0 ? '를' : '을'
}

/** 열려 있는 동안 Escape로 닫고, 첫 포커스를 옮기고, 닫히면 원래 자리로 돌려놓는다. */
function useDialog(open: boolean, onClose: () => void, initialFocus: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const raf = requestAnimationFrame(() => initialFocus.current?.focus())
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
    // onClose는 렌더마다 새로 만들어지므로 open만 본다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
}

const moveRadioFocus = (event: ReactKeyboardEvent<HTMLElement>) => {
  const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
  if (!keys.includes(event.key)) return
  const radios = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'))
  const index = radios.indexOf(document.activeElement as HTMLButtonElement)
  if (index < 0) return
  event.preventDefault()
  const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown'
  const next = radios[(index + (forward ? 1 : radios.length - 1)) % radios.length]
  next.focus()
  next.click()
}

export default function RecordScreen({
  recordStatus,
  onBack,
  onSaveLog,
  onRetry,
  initialShopName = '멘야준',
}: Props) {
  const [shop, setShop] = useState<ShopCatalogItem>(() => getShopDetail(initialShopName))
  const [initialRamenType] = useState(() => inferRamenType(shop.style))
  const [today] = useState(todayInSeoul)
  const [menuName, setMenuName] = useState('')
  const [ramenType, setRamenType] = useState(initialRamenType)
  const [visitedAt, setVisitedAt] = useState(today)
  const [scores, setScores] = useState<Partial<Record<ScoreAxisKey, number>>>({})
  const [revisit, setRevisit] = useState<RevisitOption | null>(null)
  const [photos, setPhotos] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [tasteNotes, setTasteNotes] = useState<TasteNotes>(EMPTY_TASTE_NOTES)
  const [isTagsOpen, setIsTagsOpen] = useState(false)
  const [isPublic, setIsPublic] = useState(true)
  const [showShopSheet, setShowShopSheet] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [attempted, setAttempted] = useState(false)

  const fieldRefs = useRef<Partial<Record<FieldKey, HTMLElement | null>>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const shopSheetTitleRef = useRef<HTMLHeadingElement>(null)
  const leaveStayRef = useRef<HTMLButtonElement>(null)

  useDialog(showShopSheet, () => setShowShopSheet(false), shopSheetTitleRef)
  useDialog(showLeaveConfirm, () => setShowLeaveConfirm(false), leaveStayRef)

  const shopOptions: ShopCatalogItem[] = SHOP_CATALOG.some(item => item.name === shop.name)
    ? SHOP_CATALOG
    : [shop, ...SHOP_CATALOG]

  const handleShopSelect = (next: ShopCatalogItem) => {
    setShop(next)
    const inferred = inferRamenType(next.style)
    if (inferred) setRamenType(inferred)
    setShowShopSheet(false)
  }

  const toggleTasteNote = (key: TasteNoteKey, option: string) => {
    setTasteNotes(prev => {
      const current = prev[key]
      const next = current.includes(option) ? current.filter(item => item !== option) : [...current, option]
      return { ...prev, [key]: next }
    })
  }

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length > 0) {
      const urls = files.map(file => URL.createObjectURL(file))
      setPhotos(prev => [...prev, ...urls].slice(0, MAX_PHOTOS))
    }
    event.target.value = ''
  }

  const removePhoto = (url: string) => {
    URL.revokeObjectURL(url)
    setPhotos(prev => prev.filter(item => item !== url))
  }

  const trimmedMenu = menuName.trim()
  const missing: MissingField[] = []
  if (!trimmedMenu) missing.push({ key: 'menu', label: '먹은 메뉴', kind: 'text' })
  if (!ramenType) missing.push({ key: 'ramenType', label: '라멘 종류', kind: 'choice' })
  if (!visitedAt) missing.push({ key: 'visitedAt', label: '방문일', kind: 'text' })
  for (const axis of SCORE_AXES) {
    if (scores[axis.key] == null) missing.push({ key: axis.key, label: axis.label, kind: 'choice' })
  }
  if (!revisit) missing.push({ key: 'revisit', label: REVISIT_AXIS.label, kind: 'choice' })

  const isComplete = missing.length === 0
  const isSaving = recordStatus === 'saving'
  const selectedTagCount = Object.values(tasteNotes).reduce((sum, list) => sum + list.length, 0)

  const missingMessage = (() => {
    if (isComplete) return null
    const shown = missing.slice(0, 3).map(item => item.label)
    const rest = missing.length - shown.length
    const subject = rest > 0 ? `${shown.join(', ')} 외 ${rest}개` : shown.join(', ')
    const verb = missing.some(item => item.kind === 'text') ? '채워주세요' : '골라주세요'
    return `${subject}${objectParticle(subject)} ${verb}`
  })()

  const focusFirstMissing = () => {
    const first = missing[0]
    if (!first) return
    const el = fieldRefs.current[first.key]
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const target = el.matches('input, textarea, button')
      ? el
      : el.querySelector<HTMLElement>('[role="radio"][tabindex="0"], [role="radio"], input, textarea, button')
    target?.focus({ preventScroll: true })
  }

  const buildPayload = (): SaveLogData | null => {
    if (!isComplete || !revisit) return null
    const fullScores: TasteScores = {
      satisfaction: scores.satisfaction!,
      brothDensity: scores.brothDensity!,
      noodleFirmness: scores.noodleFirmness!,
      topping: scores.topping!,
      revisit: REVISIT_SCORE[revisit],
    }
    return {
      shopName: shop.name,
      branch: shop.branch ?? '',
      menuName: trimmedMenu,
      ramenType,
      visitedAt,
      revisit,
      note: note.trim(),
      tasteNotes,
      scores: fullScores,
      imageUrl: photos[0] ?? null,
      photos,
      isPublic,
    }
  }

  const handleSave = () => {
    if (isSaving) return
    const payload = buildPayload()
    if (!payload) {
      setAttempted(true)
      focusFirstMissing()
      return
    }
    onSaveLog(payload)
  }

  const handleRetry = () => {
    onRetry()
    const payload = buildPayload()
    if (payload) onSaveLog(payload)
  }

  const hasEdited =
    shop.name !== initialShopName ||
    menuName.length > 0 ||
    ramenType !== initialRamenType ||
    visitedAt !== today ||
    Object.keys(scores).length > 0 ||
    revisit !== null ||
    photos.length > 0 ||
    note.length > 0 ||
    selectedTagCount > 0 ||
    !isPublic

  const handleBack = () => {
    if (hasEdited) setShowLeaveConfirm(true)
    else onBack()
  }

  const registerField = (key: FieldKey) => (el: HTMLElement | null) => {
    fieldRefs.current[key] = el
  }
  const isMissing = (key: FieldKey) => attempted && missing.some(item => item.key === key)

  const inputClass = (invalid: boolean) =>
    `w-full h-12 px-3.5 rounded-[6px] bg-[#F7F7F7] border text-[14px] font-medium text-[#25282B] placeholder:text-[#6B6E73] outline-none focus:border-[#25282B] focus:bg-white transition-colors ${
      invalid ? 'border-[#E60000]' : 'border-[#E2E2E2]'
    }`

  const segmentClass = (selected: boolean) =>
    `flex-1 min-h-11 text-[14px] font-bold transition-colors border-l first:border-l-0 border-[#E2E2E2] ${
      selected ? 'bg-[#E60000] text-white' : 'bg-white text-[#25282B] active:bg-[#F2F2F2]'
    }`

  const chipClass = (selected: boolean) =>
    `min-h-11 px-4 rounded-[60px] text-[13px] font-bold border transition-colors ${
      selected ? 'bg-[#E60000] text-white border-[#E60000]' : 'bg-white text-[#25282B] border-[#E2E2E2] active:bg-[#F2F2F2]'
    }`

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white text-[#25282B]">
      <header className="shrink-0 bg-white border-b border-[#E2E2E2] pl-1 pr-4 h-14 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 min-w-0">
          <button
            type="button"
            onClick={handleBack}
            className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-[#25282B] active:bg-[#F2F2F2]"
            aria-label="뒤로가기"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-[20px] font-extrabold tracking-tight truncate">라멘 기록하기</h1>
        </div>
        <span className="shrink-0 text-[12px] font-bold text-[#6B6E73]">{isPublic ? '공개 기록' : '나만 보기'}</span>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        {/* 1. 한 그릇 정보 */}
        <section className="px-4 pt-5 pb-6" aria-labelledby="sec-basic">
          <div className="flex items-baseline justify-between mb-4">
            <h2 id="sec-basic" className="text-[17px] font-extrabold tracking-tight">한 그릇 정보</h2>
            <span className="text-[12px] font-bold text-[#6B6E73]">필수</span>
          </div>

          <div className="space-y-4">
            <div>
              <span id="label-shop" className="block text-[14px] font-bold mb-1.5">가게</span>
              <button
                type="button"
                aria-labelledby="label-shop shop-value"
                aria-haspopup="dialog"
                onClick={() => setShowShopSheet(true)}
                className="w-full min-h-12 px-3.5 py-2 rounded-[6px] bg-[#F7F7F7] border border-[#E2E2E2] flex items-center justify-between gap-3 text-left active:bg-[#F2F2F2]"
              >
                <span id="shop-value" className="min-w-0">
                  <span className="block text-[15px] font-bold truncate">{shop.name}</span>
                  {shop.branch && <span className="block text-[13px] text-[#6B6E73] truncate">{shop.branch}</span>}
                </span>
                <span className="shrink-0 text-[13px] font-bold text-[#E60000]">변경</span>
              </button>
            </div>

            <div>
              <label htmlFor="menu-name" className="block text-[14px] font-bold mb-1.5">먹은 메뉴</label>
              <input
                id="menu-name"
                ref={registerField('menu')}
                type="text"
                value={menuName}
                onChange={e => setMenuName(e.target.value)}
                placeholder="예: 특제 쇼유 라멘"
                aria-required="true"
                aria-invalid={isMissing('menu') || undefined}
                className={inputClass(isMissing('menu'))}
              />
              {shop.style && !trimmedMenu && (
                <button
                  type="button"
                  onClick={() => setMenuName(shop.style)}
                  className="mt-2 min-h-11 px-4 rounded-[60px] border border-[#E2E2E2] text-[13px] font-bold text-[#25282B] active:bg-[#F2F2F2]"
                >
                  대표 스타일 {shop.style}(으)로 채우기
                </button>
              )}
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <span id="label-ramen-type" className="text-[14px] font-bold">라멘 종류</span>
                {isMissing('ramenType') && <span className="text-[12px] font-bold text-[#E60000]">골라주세요</span>}
              </div>
              <div
                ref={registerField('ramenType')}
                role="radiogroup"
                aria-labelledby="label-ramen-type"
                aria-required="true"
                onKeyDown={moveRadioFocus}
                className="flex flex-wrap gap-2"
              >
                {RAMEN_TYPES.map((type, index) => {
                  const selected = ramenType === type
                  const focusable = selected || (!ramenType && index === 0)
                  return (
                    <button
                      key={type}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      tabIndex={focusable ? 0 : -1}
                      onClick={() => setRamenType(type)}
                      className={chipClass(selected)}
                    >
                      {type}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label htmlFor="visited-at" className="block text-[14px] font-bold mb-1.5">방문일</label>
              <input
                id="visited-at"
                ref={registerField('visitedAt')}
                type="date"
                value={visitedAt}
                max={today}
                onChange={e => setVisitedAt(e.target.value)}
                aria-required="true"
                aria-invalid={isMissing('visitedAt') || undefined}
                className={inputClass(isMissing('visitedAt'))}
              />
            </div>
          </div>
        </section>

        <div className="h-2 bg-[#F2F2F2]" aria-hidden="true" />

        {/* 2. 5축 평가 */}
        <section className="px-4 pt-5 pb-6" aria-labelledby="sec-axes">
          <div className="flex items-baseline justify-between mb-1">
            <h2 id="sec-axes" className="text-[17px] font-extrabold tracking-tight">5축 평가</h2>
            <span className="text-[12px] font-bold text-[#6B6E73]">필수</span>
          </div>
          <p className="text-[13px] text-[#6B6E73] mb-5">다섯 축이 모여 취향 여권이 갱신됩니다.</p>

          <div className="space-y-6">
            {SCORE_AXES.map((axis, index) => {
              const value = scores[axis.key]
              const invalid = isMissing(axis.key)
              return (
                <div key={axis.key}>
                  <div className="flex items-baseline justify-between mb-2">
                    <span id={`axis-${axis.key}`} className="text-[14px] font-bold">
                      <span className="text-[#6B6E73] mr-1.5">{index + 1}</span>
                      {axis.label}
                    </span>
                    <span className={`text-[12px] font-bold ${value ? 'text-[#E60000]' : invalid ? 'text-[#E60000]' : 'text-[#6B6E73]'}`}>
                      {value ? `${value}점` : invalid ? '골라주세요' : '미선택'}
                    </span>
                  </div>
                  <div
                    ref={registerField(axis.key)}
                    role="radiogroup"
                    aria-labelledby={`axis-${axis.key}`}
                    aria-required="true"
                    onKeyDown={moveRadioFocus}
                    className={`flex rounded-[6px] border overflow-hidden ${invalid ? 'border-[#E60000]' : 'border-[#E2E2E2]'}`}
                  >
                    {SCORE_VALUES.map(n => {
                      const selected = value === n
                      const focusable = selected || (value == null && n === 1)
                      return (
                        <button
                          key={n}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          aria-label={`${axis.label} ${n}점`}
                          tabIndex={focusable ? 0 : -1}
                          onClick={() => setScores(prev => ({ ...prev, [axis.key]: n }))}
                          className={segmentClass(selected)}
                        >
                          {n}
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex justify-between mt-1.5 text-[12px] font-medium text-[#6B6E73]">
                    <span>{axis.low}</span>
                    <span>{axis.high}</span>
                  </div>
                </div>
              )
            })}

            <div>
              <div className="flex items-baseline justify-between mb-2">
                <span id="axis-revisit" className="text-[14px] font-bold">
                  <span className="text-[#6B6E73] mr-1.5">5</span>
                  {REVISIT_AXIS.label}
                </span>
                <span className={`text-[12px] font-bold ${revisit ? 'text-[#E60000]' : isMissing('revisit') ? 'text-[#E60000]' : 'text-[#6B6E73]'}`}>
                  {revisit ? `${REVISIT_SCORE[revisit]}점` : isMissing('revisit') ? '골라주세요' : '미선택'}
                </span>
              </div>
              <div
                ref={registerField('revisit')}
                role="radiogroup"
                aria-labelledby="axis-revisit"
                aria-required="true"
                onKeyDown={moveRadioFocus}
                className={`flex rounded-[6px] border overflow-hidden ${isMissing('revisit') ? 'border-[#E60000]' : 'border-[#E2E2E2]'}`}
              >
                {[...REVISIT_OPTIONS].reverse().map((option, index) => {
                  const selected = revisit === option
                  const focusable = selected || (!revisit && index === 0)
                  return (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      tabIndex={focusable ? 0 : -1}
                      onClick={() => setRevisit(option)}
                      className={`${segmentClass(selected)} text-[13px] px-1`}
                    >
                      {option}
                    </button>
                  )
                })}
              </div>
              <div className="flex justify-between mt-1.5 text-[12px] font-medium text-[#6B6E73]">
                <span>{REVISIT_AXIS.low}</span>
                <span>{REVISIT_AXIS.high}</span>
              </div>
            </div>
          </div>
        </section>

        <div className="h-2 bg-[#F2F2F2]" aria-hidden="true" />

        {/* 3. 사진 (선택) */}
        <section className="px-4 pt-5 pb-6" aria-labelledby="sec-photos">
          <div className="flex items-baseline justify-between mb-3">
            <h2 id="sec-photos" className="text-[17px] font-extrabold tracking-tight">사진</h2>
            <span className="text-[12px] font-bold text-[#6B6E73]">선택 · 최대 {MAX_PHOTOS}장</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFiles}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
            {photos.length < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 w-24 h-24 rounded-[6px] border border-dashed border-[#BEBEBE] bg-[#F7F7F7] flex flex-col items-center justify-center gap-1 text-[#6B6E73] active:bg-[#F2F2F2]"
              >
                <ImagePlus className="w-6 h-6" aria-hidden="true" />
                <span className="text-[12px] font-bold">{photos.length === 0 ? '사진 추가' : `${photos.length}/${MAX_PHOTOS}`}</span>
              </button>
            )}
            {photos.map((url, index) => (
              <div key={url} className="relative shrink-0 w-24 h-24 rounded-[6px] overflow-hidden border border-[#E2E2E2] bg-[#F2F2F2]">
                <img src={url} alt={`첨부 사진 ${index + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(url)}
                  aria-label={`사진 ${index + 1} 삭제`}
                  className="absolute top-0 right-0 w-11 h-11 flex items-start justify-end p-1.5"
                >
                  <span className="w-6 h-6 rounded-full bg-[#25282B] text-white flex items-center justify-center">
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </span>
                </button>
              </div>
            ))}
          </div>
        </section>

        <div className="h-2 bg-[#F2F2F2]" aria-hidden="true" />

        {/* 4. 메모 (선택) */}
        <section className="px-4 pt-5 pb-6" aria-labelledby="sec-note">
          <div className="flex items-baseline justify-between mb-3">
            <label id="sec-note" htmlFor="note" className="text-[17px] font-extrabold tracking-tight">기억해둘 점</label>
            <span className="text-[12px] font-bold text-[#6B6E73]">선택 · {note.length}/1000</span>
          </div>
          <textarea
            id="note"
            value={note}
            onChange={e => setNote(e.target.value.slice(0, 1000))}
            placeholder="예: 다음엔 면을 단단하게 부탁하기"
            rows={3}
            className="w-full text-[14px] text-[#25282B] placeholder:text-[#6B6E73] bg-[#F7F7F7] border border-[#E2E2E2] rounded-[6px] p-3.5 resize-none outline-none focus:border-[#25282B] focus:bg-white transition-colors leading-relaxed"
          />
        </section>

        <div className="h-2 bg-[#F2F2F2]" aria-hidden="true" />

        {/* 5. 맛 태그 더 남기기 (선택, 접힘) */}
        <section aria-labelledby="sec-tags">
          <button
            type="button"
            onClick={() => setIsTagsOpen(open => !open)}
            aria-expanded={isTagsOpen}
            aria-controls="taste-tags"
            className="w-full px-4 min-h-14 py-3 flex items-center justify-between gap-3 text-left active:bg-[#F7F7F7]"
          >
            <span>
              <span id="sec-tags" className="block text-[17px] font-extrabold tracking-tight">맛 태그 더 남기기</span>
              <span className="block text-[13px] text-[#6B6E73] mt-0.5">
                선택 · 국물, 면, 간, 토핑{selectedTagCount > 0 ? ` · ${selectedTagCount}개 선택` : ''}
              </span>
            </span>
            <ChevronDown
              className={`w-5 h-5 shrink-0 text-[#6B6E73] transition-transform duration-200 ${isTagsOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>

          {isTagsOpen && (
            <div id="taste-tags" className="px-4 pb-6 space-y-5">
              {TASTE_FIELDS.map(field => (
                <div key={field.key}>
                  <div className="flex items-baseline justify-between mb-2">
                    <span id={`tag-${field.key}`} className="text-[14px] font-bold">{field.label}</span>
                    <span className="text-[12px] font-bold text-[#6B6E73]">{tasteNotes[field.key].length}개 선택</span>
                  </div>
                  <div role="group" aria-labelledby={`tag-${field.key}`} className="flex flex-wrap gap-2">
                    {field.options.map(option => {
                      const selected = tasteNotes[field.key].includes(option)
                      return (
                        <button
                          key={option}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleTasteNote(field.key, option)}
                          className={chipClass(selected)}
                        >
                          {option}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="h-2 bg-[#F2F2F2]" aria-hidden="true" />

        {/* 6. 공개 설정 */}
        <section className="px-4 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span id="label-public" className="block text-[15px] font-bold">내 기록 공개하기</span>
            <span className="block text-[13px] text-[#6B6E73] mt-0.5">끄면 피드에 올라가지 않고 나만 볼 수 있어요.</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isPublic}
            aria-labelledby="label-public"
            onClick={() => setIsPublic(value => !value)}
            className="shrink-0 min-w-11 min-h-11 flex items-center justify-center"
          >
            <span className={`relative inline-block w-12 h-7 rounded-full transition-colors duration-200 ${isPublic ? 'bg-[#E60000]' : 'bg-[#BEBEBE]'}`}>
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white transition-transform duration-200 ${isPublic ? 'translate-x-5' : ''}`}
              />
            </span>
          </button>
        </section>
        <div className="h-4" aria-hidden="true" />
      </div>

      {/* 하단 고정 저장 바 */}
      <footer className="shrink-0 border-t border-[#E2E2E2] bg-white px-4 pt-2.5 pb-3">
        {recordStatus === 'error' ? (
          <div role="alert" className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-[#E60000]" aria-hidden="true" />
            <p className="flex-1 min-w-0 text-[13px] font-medium text-[#25282B] leading-snug">
              저장하지 못했어요. 연결을 확인한 뒤 다시 시도해주세요.
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="shrink-0 min-h-11 px-5 rounded-[60px] bg-[#E60000] text-white text-[14px] font-bold"
            >
              다시 시도
            </button>
          </div>
        ) : (
          <>
            <p
              aria-live="polite"
              className={`text-[12px] font-bold mb-2 leading-snug ${isComplete ? 'text-[#6B6E73]' : attempted ? 'text-[#E60000]' : 'text-[#6B6E73]'}`}
            >
              {isComplete ? '필수 항목을 모두 채웠어요' : missingMessage}
            </p>
            <button
              type="button"
              onClick={handleSave}
              aria-disabled={!isComplete || isSaving}
              aria-busy={isSaving || undefined}
              className={`w-full h-13 rounded-[60px] text-[15px] font-bold transition-colors ${
                isComplete && !isSaving ? 'bg-[#E60000] text-white active:bg-[#CC0000]' : 'bg-[#F2F2F2] text-[#6B6E73]'
              }`}
            >
              {isSaving ? '저장하는 중…' : isComplete ? '기록 저장하기' : `남은 필수 ${missing.length}개 보러 가기`}
            </button>
          </>
        )}
      </footer>

      {/* 가게 선택 시트 */}
      {showShopSheet && (
        <div className="absolute inset-0 z-40 flex flex-col justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 anim-fade-in"
            onClick={() => setShowShopSheet(false)}
            aria-label="닫기"
            tabIndex={-1}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="shop-sheet-title"
            className="relative bg-white rounded-t-[12px] anim-slide-up shadow-[0_4px_16px_rgba(0,0,0,0.12)] flex flex-col max-h-[80%]"
          >
            <div className="flex items-center justify-between pl-5 pr-2 pt-3 pb-2 shrink-0">
              <h3 id="shop-sheet-title" ref={shopSheetTitleRef} tabIndex={-1} className="text-[17px] font-extrabold tracking-tight outline-none">
                가게 고르기
              </h3>
              <button
                type="button"
                onClick={() => setShowShopSheet(false)}
                aria-label="닫기"
                className="w-11 h-11 rounded-full flex items-center justify-center text-[#25282B] active:bg-[#F2F2F2]"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-2 pb-3">
              {shopOptions.map(option => {
                const selected = option.name === shop.name
                return (
                  <button
                    key={`${option.id}-${option.name}`}
                    type="button"
                    onClick={() => handleShopSelect(option)}
                    aria-pressed={selected}
                    className="w-full min-h-14 px-3 flex items-center justify-between gap-3 text-left rounded-[6px] active:bg-[#F2F2F2]"
                  >
                    <span className="min-w-0">
                      <span className={`block text-[15px] font-bold truncate ${selected ? 'text-[#E60000]' : 'text-[#25282B]'}`}>{option.name}</span>
                      <span className="block text-[13px] text-[#6B6E73] truncate">
                        {[option.branch, option.style].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    {selected && <Check className="w-5 h-5 shrink-0 text-[#E60000]" aria-hidden="true" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* 이탈 확인 */}
      {showLeaveConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/50 anim-fade-in" aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-title"
            aria-describedby="leave-desc"
            className="relative w-full bg-white rounded-[12px] p-5 anim-fade-in-up"
          >
            <h3 id="leave-title" className="text-[17px] font-extrabold tracking-tight mb-1">작성을 그만둘까요?</h3>
            <p id="leave-desc" className="text-[14px] text-[#6B6E73] mb-5">지금까지 고른 평가와 사진은 저장되지 않아요.</p>
            <div className="flex gap-2">
              <button
                ref={leaveStayRef}
                type="button"
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 min-h-11 rounded-[60px] border border-[#E2E2E2] text-[14px] font-bold text-[#25282B] bg-white active:bg-[#F2F2F2]"
              >
                계속 작성
              </button>
              <button
                type="button"
                onClick={onBack}
                className="flex-1 min-h-11 rounded-[60px] bg-[#E60000] text-white text-[14px] font-bold active:bg-[#CC0000]"
              >
                나가기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
