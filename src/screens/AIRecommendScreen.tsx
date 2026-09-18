import { useState, useEffect, useRef } from 'react'
import type { UserProfile } from '../types'
import { RotateCcw, ChevronLeft, ChevronRight, Check, Minus, Sparkles, PenLine } from 'lucide-react'
import AICurationLoading from './AICurationLoading'
import { SHOP_CATALOG, findShopByName, type ShopCatalogItem } from '../data/shops'

interface Props {
  user?: UserProfile | null
  onBack: () => void
  onShopClick: (shopName: string) => void
  onRecordShop: (shopName: string) => void
  initialResultShopName?: string
}

type Step = 1 | 2 | 3 | 4 | 'loading' | 'result'

interface SoupOption {
  id: string
  label: string
  sub: string
  /** 원장 style/tags에서 찾을 키워드 */
  keys: string[]
}

const SOUP_OPTIONS: SoupOption[] = [
  { id: 'shoyu', label: '쇼유', sub: '간장 타레', keys: ['쇼유'] },
  { id: 'tonkotsu', label: '돈코츠', sub: '돼지뼈 육수', keys: ['돈코츠', '이에케'] },
  { id: 'shio', label: '시오', sub: '소금 타레', keys: ['시오'] },
  { id: 'miso', label: '미소', sub: '된장 타레', keys: ['미소'] },
  { id: 'tsukemen', label: '츠케멘', sub: '찍어 먹는 면', keys: ['츠케멘'] },
  { id: 'tori', label: '토리파이탄', sub: '닭백탕', keys: ['토리파이탄', '닭백탕'] },
]

const MOOD_OPTIONS = ['혼밥하기 좋은 곳', '데이트/아늑한 분위기', '웨이팅 감수 맛집', '빠르고 든든한 한 끼'] as const
type Mood = (typeof MOOD_OPTIONS)[number]

const PRIORITY_OPTIONS: Array<{ label: string; keys: string[] }> = [
  { label: '진하고 묵직한 국물', keys: ['진한', '농후', '백탕', '이에케', '돈코츠', '적된장'] },
  { label: '탱글탱글 자가제면', keys: ['자가제면', '치지레멘'] },
  { label: '두툼하고 부드러운 차슈', keys: ['차슈'] },
  { label: '깔끔하고 깊은 감칠맛', keys: ['깔끔', '맑은', '청탕', '감칠맛', '시오'] },
]

const QUICK_PROMPTS = ['국물이 덜 짠 곳', '차슈가 푸짐한 곳', '주차 가능한 곳', '웨이팅 적은 곳', '매운맛 조절 가능한 곳', '밥 무료 제공']

interface Inputs {
  soupId: string
  mood: Mood
  priority: string
  prompt: string
}

interface Condition {
  label: string
  applied: boolean
  note: string
}

interface Curation {
  shop: ShopCatalogItem
  conditions: Condition[]
}

const shopText = (shop: ShopCatalogItem) => [shop.style, shop.spec, shop.description ?? '', ...shop.tags].join(' ')
const hasAnyKey = (shop: ShopCatalogItem, keys: string[]) => keys.some(key => shopText(shop).includes(key))

/**
 * 선택한 조건을 원장 데이터와 실제로 대조해 한 곳을 고른다.
 * 대조할 정보가 없는 조건은 applied=false로 표시해 결과 화면이 "참고만 한 조건"으로 보여준다.
 */
function curate(inputs: Inputs): Curation {
  const conditions: Condition[] = []
  let pool = SHOP_CATALOG.filter(shop => shop.lat && shop.lng)
  let sortByDistance = false

  const narrow = (predicate: (shop: ShopCatalogItem) => boolean) => {
    const next = pool.filter(predicate)
    if (next.length === 0) return false
    pool = next
    return true
  }

  // 1. 국물
  const soup = SOUP_OPTIONS.find(option => option.id === inputs.soupId) ?? SOUP_OPTIONS[0]
  if (narrow(shop => hasAnyKey(shop, soup.keys))) {
    conditions.push({ label: `${soup.label} 계보`, applied: true, note: `${soup.label} 계보 ${pool.length}곳 중에서 골랐어요` })
  } else {
    conditions.push({ label: `${soup.label} 계보`, applied: false, note: `${soup.label} 전문점이 아직 없어 전체 라멘집에서 골랐어요` })
  }

  // 2. 분위기와 상황
  if (inputs.mood === '빠르고 든든한 한 끼') {
    const opened = narrow(shop => shop.isOpen)
    sortByDistance = true
    conditions.push({ label: inputs.mood, applied: true, note: opened ? '지금 영업 중이고 가까운 곳을 우선했어요' : '영업 중인 곳이 없어 가까운 곳을 우선했어요' })
  } else if (inputs.mood === '웨이팅 감수 맛집') {
    if (narrow(shop => shop.reviewCount > 0 || shop.rating > 0)) {
      conditions.push({ label: inputs.mood, applied: true, note: '라멘로그와 평점이 쌓인 곳을 우선했어요' })
    } else {
      conditions.push({ label: inputs.mood, applied: false, note: '라멘로그 수 정보가 아직 없어 참고만 했어요' })
    }
  } else {
    conditions.push({ label: inputs.mood, applied: false, note: '매장 분위기 정보는 아직 없어 참고만 했어요' })
  }

  // 3. 우선순위: 원장의 특징, 태그, 리뷰 요약과 대조
  const priority = PRIORITY_OPTIONS.find(option => option.label === inputs.priority)
  if (priority) {
    if (narrow(shop => hasAnyKey(shop, priority.keys))) {
      conditions.push({ label: priority.label, applied: true, note: '가게 특징과 태그에 이 요소가 있는 곳을 우선했어요' })
    } else {
      conditions.push({ label: priority.label, applied: false, note: '이 요소가 적힌 가게가 없어 참고만 했어요' })
    }
  }

  // 4. 자유 입력: 대조 가능한 키워드만 반영
  const prompt = inputs.prompt.trim()
  if (prompt) {
    const applied: string[] = []
    if (prompt.includes('웨이팅') && narrow(shop => shop.isOpen)) applied.push('지금 영업 중')
    if (prompt.includes('밥') && narrow(shop => Boolean(shop.servicePerks?.riceRefill))) applied.push('공깃밥 제공')
    if (prompt.includes('차슈') && narrow(shop => hasAnyKey(shop, ['차슈']))) applied.push('차슈')
    if (prompt.includes('면') && narrow(shop => hasAnyKey(shop, ['자가제면', '치지레멘', '면']))) applied.push('면')
    if (applied.length > 0) {
      conditions.push({ label: `직접 입력: ${prompt}`, applied: true, note: `${applied.join(', ')} 조건을 매장 정보와 대조했어요` })
    } else {
      conditions.push({ label: `직접 입력: ${prompt}`, applied: false, note: '아직 매장 정보와 대조하지 못해 참고만 했어요' })
    }
  }

  const [shop] = [...pool].sort((a, b) => (sortByDistance ? a.distanceM - b.distanceM || b.matchScore - a.matchScore : b.matchScore - a.matchScore || a.distanceM - b.distanceM))
  return { shop, conditions }
}

const DEFAULT_INPUTS: Inputs = { soupId: 'shoyu', mood: '혼밥하기 좋은 곳', priority: '깔끔하고 깊은 감칠맛', prompt: '' }

/** 상세로 갔다 돌아올 때 같은 결과를 다시 보여주기 위한 마지막 입력값 (페이지가 살아 있는 동안만) */
let lastInputs: Inputs | null = null

function restoreCuration(shopName?: string): Curation | null {
  if (!shopName) return null
  if (lastInputs) {
    const restored = curate(lastInputs)
    if (restored.shop.name === shopName) return restored
  }
  const shop = findShopByName(shopName)
  return shop ? { shop, conditions: [] } : null
}

const STEP_TITLES: Record<1 | 2 | 3 | 4, { title: string; help: string }> = {
  1: { title: '오늘 어떤 국물이 당기나요?', help: '맑은 청탕부터 묵직한 백탕까지 골라보세요.' },
  2: { title: '어떤 상황에서 드시나요?', help: '지금 갈 수 있는 곳과 여유 있는 방문을 구분해 추천해요.' },
  3: { title: '한 그릇에서 가장 포기할 수 없는 것은?', help: '가게 특징과 태그에 이 요소가 있는 곳을 먼저 찾아요.' },
  4: { title: '더 바라는 점이 있나요?', help: '선택 사항이에요. 웨이팅, 밥, 차슈처럼 매장 정보와 대조할 수 있는 조건은 결과에 반영돼요.' },
}

export default function AIRecommendScreen({ user, onBack, onShopClick, onRecordShop, initialResultShopName }: Props) {
  const [inputs, setInputs] = useState<Inputs>(() => (initialResultShopName && lastInputs) || DEFAULT_INPUTS)
  const [curation, setCuration] = useState<Curation | null>(() => restoreCuration(initialResultShopName))
  const [step, setStep] = useState<Step>(() => (restoreCuration(initialResultShopName) ? 'result' : 1))
  const resultHeadingRef = useRef<HTMLHeadingElement>(null)
  const stepHeadingRef = useRef<HTMLHeadingElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const setInput = <K extends keyof Inputs>(key: K, value: Inputs[K]) => setInputs(prev => ({ ...prev, [key]: value }))

  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0 })
    if (step === 'result') resultHeadingRef.current?.focus({ preventScroll: true })
    else if (typeof step === 'number') stepHeadingRef.current?.focus({ preventScroll: true })
  }, [step])

  const startAnalysis = () => {
    lastInputs = inputs
    setCuration(curate(inputs))
    setStep('loading')
  }

  const restart = () => {
    setCuration(null)
    setStep(1)
  }

  if (step === 'loading' && curation) {
    return (
      <AICurationLoading
        conditions={curation.conditions.filter(condition => condition.applied).map(condition => condition.label.replace(/^직접 입력: /, ''))}
        onBack={() => setStep(4)}
        onComplete={() => setStep('result')}
      />
    )
  }

  const result = step === 'result' ? curation : null
  const nickname = user?.isLoggedIn ? user.nickname : null
  const optionClass = (active: boolean) =>
    `rounded-[6px] border text-left transition-colors ${active ? 'border-[#25282B] bg-[#25282B] text-white' : 'border-[#E2E2E2] bg-white text-[#25282B] active:bg-[#F2F2F2]'}`

  return (
    <div className="h-full bg-white text-[#25282B] flex flex-col overflow-hidden">
      {/* 상단 바 */}
      <header className="flex-shrink-0 bg-white px-3 py-2 border-b border-[#E2E2E2] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 min-w-0">
          <button type="button" onClick={onBack} className="w-11 h-11 rounded-full flex items-center justify-center active:bg-[#F2F2F2] transition-colors" aria-label="뒤로가기">
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
          </button>
          <h1 className="text-[17px] font-extrabold tracking-tight truncate">AI 라멘 큐레이터</h1>
        </div>
        {typeof step === 'number' && (
          <span className="text-[12px] font-bold text-[#6B6E73] shrink-0 tabular-nums" aria-label={`4단계 중 ${step}단계`}>
            {step} / 4
          </span>
        )}
      </header>

      {/* 본문 (스크롤) */}
      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        {typeof step === 'number' && (
          <div className="px-5 pt-5 pb-6 anim-fade-in" key={step}>
            <div className="h-1 w-full bg-[#F2F2F2] rounded-full overflow-hidden mb-5" aria-hidden="true">
              <div className="h-full bg-[#E60000] rounded-full transition-[width] duration-200" style={{ width: `${(step / 4) * 100}%` }} />
            </div>
            <h2 ref={stepHeadingRef} tabIndex={-1} className="text-[20px] font-extrabold tracking-tight leading-snug break-keep outline-none">
              {STEP_TITLES[step].title}
            </h2>
            <p className="text-[13px] text-[#6B6E73] mt-1.5 break-keep">{STEP_TITLES[step].help}</p>

            {step === 1 && (
              <div role="radiogroup" aria-label="국물 베이스" className="grid grid-cols-2 gap-2 mt-5">
                {SOUP_OPTIONS.map(soup => {
                  const active = inputs.soupId === soup.id
                  return (
                    <button key={soup.id} type="button" role="radio" aria-checked={active} onClick={() => setInput('soupId', soup.id)} className={`${optionClass(active)} min-h-16 px-3.5 py-3 flex items-center justify-between gap-2`}>
                      <span className="min-w-0">
                        <span className="block text-[15px] font-bold break-keep">{soup.label}</span>
                        <span className={`block text-[12px] mt-0.5 ${active ? 'text-white/70' : 'text-[#6B6E73]'}`}>{soup.sub}</span>
                      </span>
                      {active && <Check className="w-4 h-4 shrink-0" aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>
            )}

            {step === 2 && (
              <div role="radiogroup" aria-label="식사 상황" className="space-y-2 mt-5">
                {MOOD_OPTIONS.map(mood => {
                  const active = inputs.mood === mood
                  return (
                    <button key={mood} type="button" role="radio" aria-checked={active} onClick={() => setInput('mood', mood)} className={`${optionClass(active)} w-full min-h-14 px-4 py-3 flex items-center justify-between gap-3`}>
                      <span className="text-[15px] font-bold break-keep">{mood}</span>
                      {active ? <Check className="w-4 h-4 shrink-0" aria-hidden="true" /> : <ChevronRight className="w-4 h-4 shrink-0 text-[#6B6E73]" aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>
            )}

            {step === 3 && (
              <div role="radiogroup" aria-label="가장 중요한 요소" className="space-y-2 mt-5">
                {PRIORITY_OPTIONS.map(option => {
                  const active = inputs.priority === option.label
                  return (
                    <button key={option.label} type="button" role="radio" aria-checked={active} onClick={() => setInput('priority', option.label)} className={`${optionClass(active)} w-full min-h-14 px-4 py-3 flex items-center justify-between gap-3`}>
                      <span className="text-[15px] font-bold break-keep">{option.label}</span>
                      {active ? <Check className="w-4 h-4 shrink-0" aria-hidden="true" /> : <ChevronRight className="w-4 h-4 shrink-0 text-[#6B6E73]" aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>
            )}

            {step === 4 && (
              <div className="mt-5">
                <label htmlFor="ai-custom-prompt" className="sr-only">더 바라는 점</label>
                <textarea
                  id="ai-custom-prompt"
                  value={inputs.prompt}
                  onChange={e => setInput('prompt', e.target.value)}
                  placeholder="예: 차슈가 부드럽고 국물이 덜 짠 곳"
                  className="w-full h-24 p-3.5 bg-[#F2F2F2] border border-[#E2E2E2] rounded-[6px] text-[14px] text-[#25282B] placeholder-[#6B6E73] outline-none focus:border-[#25282B] resize-none"
                />
                <p className="text-[13px] font-bold text-[#6B6E73] mt-4 mb-2">자주 찾는 조건</p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_PROMPTS.map(promptText => {
                    const added = inputs.prompt.includes(promptText)
                    return (
                      <button
                        key={promptText}
                        type="button"
                        aria-pressed={added}
                        onClick={() => {
                          if (added) return
                          setInput('prompt', inputs.prompt ? `${inputs.prompt}, ${promptText}` : promptText)
                        }}
                        className={`min-h-11 px-3.5 rounded-[60px] border text-[13px] font-bold transition-colors ${added ? 'border-[#25282B] bg-[#25282B] text-white' : 'border-[#E2E2E2] bg-white text-[#25282B] active:bg-[#F2F2F2]'}`}
                      >
                        {added ? '' : '+ '}
                        {promptText}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="px-5 pt-5 pb-6 anim-fade-in">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#E60000] bg-[#FFF0F0] px-3 py-1 rounded-[60px]">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              AI 취향 매칭 결과
            </span>
            <h2 ref={resultHeadingRef} tabIndex={-1} className="text-[20px] font-extrabold tracking-tight mt-2 break-keep outline-none">
              {nickname ? `오늘 ${nickname}님을 위한 라멘집` : '오늘의 추천'}
            </h2>

            <article className="mt-4 bg-white rounded-[6px] border border-[#E2E2E2] overflow-hidden">
              <div className="relative aspect-[16/10] bg-[#E9E9E9]">
                {result.shop.photos[0] && <img src={result.shop.photos[0]} alt={`${result.shop.name} 대표 사진`} className="w-full h-full object-cover" />}
                {result.shop.matchScore > 0 && (
                  <span className="absolute top-3 right-3 bg-[#E60000] text-white text-[13px] font-extrabold px-2.5 py-1 rounded-[4px] tabular-nums">
                    취향 일치도 {result.shop.matchScore}%
                  </span>
                )}
              </div>
              <div className="p-4">
                <p className="text-[13px] font-bold text-[#6B6E73]">{result.shop.style}</p>
                <h3 className="text-[20px] font-extrabold tracking-tight leading-tight mt-0.5 break-keep">
                  {result.shop.name}
                  {result.shop.branch && <span className="text-[15px] font-bold text-[#6B6E73]"> · {result.shop.branch}</span>}
                </h3>
                {result.shop.spec && <p className="text-[14px] mt-1.5 break-keep">{result.shop.spec}</p>}
                {result.shop.description && (
                  <p className="text-[14px] leading-relaxed text-[#25282B] mt-3 pl-3 border-l border-[#25282B] break-keep">{result.shop.description}</p>
                )}
                {result.shop.tags.length > 0 && (
                  <ul className="flex gap-1.5 flex-wrap mt-3" aria-label="특징">
                    {result.shop.tags.map(tag => (
                      <li key={tag} className="bg-[#F2F2F2] text-[12px] font-bold px-2.5 py-1 rounded-[4px]">{tag}</li>
                    ))}
                  </ul>
                )}
              </div>
            </article>

            {result.conditions.length > 0 && (
              <section className="mt-5" aria-labelledby="ai-conditions-heading">
                <h3 id="ai-conditions-heading" className="text-[15px] font-bold pb-2 border-b border-[#E2E2E2]">추천에 쓴 조건</h3>
                <ul className="divide-y divide-[#E2E2E2]">
                  {result.conditions.map(condition => (
                    <li key={condition.label} className="py-3 flex items-start gap-3">
                      <span
                        className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${condition.applied ? 'bg-[#25282B] text-white' : 'bg-[#F2F2F2] text-[#6B6E73]'}`}
                        aria-hidden="true"
                      >
                        {condition.applied ? <Check className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[14px] font-bold break-keep">
                          {condition.label}
                          <span className={`ml-1.5 text-[12px] ${condition.applied ? 'text-[#25282B]' : 'text-[#6B6E73]'}`}>{condition.applied ? '반영' : '참고만'}</span>
                        </p>
                        <p className="text-[13px] text-[#6B6E73] mt-0.5 break-keep">{condition.note}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {result.conditions.length === 0 && (
              <p className="mt-4 text-[13px] text-[#6B6E73] break-keep">이전에 받은 추천이에요. 조건을 바꾸려면 다시 추천받기를 눌러주세요.</p>
            )}

            <button type="button" onClick={restart} className="mt-3 min-h-11 inline-flex items-center gap-1.5 text-[14px] font-bold text-[#25282B]">
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              다시 추천받기
            </button>
          </div>
        )}
      </div>

      {/* 하단 고정 CTA */}
      <footer className="flex-shrink-0 border-t border-[#E2E2E2] bg-white px-4 py-3">
        {typeof step === 'number' ? (
          <div className="flex gap-2.5">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((step - 1) as Step)}
                className="flex-1 h-13 rounded-[60px] border border-[#E2E2E2] text-[14px] font-bold text-[#25282B] bg-white active:bg-[#F2F2F2] transition-colors"
              >
                이전
              </button>
            )}
            <button
              type="button"
              onClick={() => (step === 4 ? startAnalysis() : setStep((step + 1) as Step))}
              className="flex-[2] h-13 rounded-[60px] bg-[#E60000] text-white font-bold text-[14px] active:bg-[#CC0000] transition-colors flex items-center justify-center gap-1.5"
            >
              {step === 4 ? (
                <>
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                  <span>AI 맞춤 추천받기</span>
                </>
              ) : (
                <>
                  <span>다음</span>
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        ) : result ? (
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => onRecordShop(result.shop.name)}
              className="flex-1 h-13 rounded-[60px] border border-[#E2E2E2] text-[14px] font-bold text-[#25282B] bg-white active:bg-[#F2F2F2] transition-colors flex items-center justify-center gap-1.5"
            >
              <PenLine className="w-4 h-4" aria-hidden="true" />
              이 가게 기록하기
            </button>
            <button
              type="button"
              onClick={() => onShopClick(result.shop.name)}
              className="flex-1 h-13 rounded-[60px] bg-[#E60000] text-white font-bold text-[14px] active:bg-[#CC0000] transition-colors flex items-center justify-center gap-1"
            >
              매장 상세 보기
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </footer>
    </div>
  )
}
