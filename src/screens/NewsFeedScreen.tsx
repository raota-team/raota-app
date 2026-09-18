import { useMemo, useState } from 'react'
import { Camera, Zap, ChevronRight, ExternalLink, Bell, BellRing, CalendarX } from 'lucide-react'
import { findShopByName } from '../data/shops'
import type { UserProfile } from '../types'

interface Props {
  onShopClick?: (shopName: string) => void
  /** null이면 비회원. App이 넘기면 알림 받기를 로그인으로 보낸다. */
  user?: UserProfile | null
  onLoginRequest?: () => void
}

const FILTERS = ['전체', '한정 메뉴', '영업 공지', '이벤트']

interface NewsPost {
  id: number
  shop: string
  branch: string
  /** 확인된 인스타그램 계정. 없으면 원문 링크를 숨긴다. */
  handle?: string
  type: '한정 메뉴' | '영업 공지' | '이벤트'
  title: string
  summary: string[]
  time: string
  photo: string | null
  /** 소식이 유효한 기간(서울 기준, YYYY-MM-DD). 지나면 종료로 표시한다. */
  startDate?: string
  endDate?: string
  notifying: boolean
}

const NEWS_POSTS: NewsPost[] = [
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
    startDate: '2026-09-01',
    endDate: '2026-09-30',
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
    startDate: '2026-09-19',
    endDate: '2026-09-19',
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
    time: '2주 전',
    photo: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=600&h=400&fit=crop&auto=format&q=80',
    startDate: '2026-09-05',
    endDate: '2026-09-07',
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
    time: '1주 전',
    photo: null,
    startDate: '2026-09-14',
    endDate: '2026-09-16',
    notifying: false,
  },
]

/** 서울 기준 오늘 날짜(YYYY-MM-DD). ISO 형식 문자열끼리는 사전순 비교가 날짜 비교와 같다. */
const todayInSeoul = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

const isEnded = (post: NewsPost, today: string) => Boolean(post.endDate && post.endDate < today)

/** 원장에 확인된 링크가 있으면 우선, 없으면 소식에 적힌 계정으로만 연결한다. 계정을 지어내지 않는다. */
const instagramUrlFor = (post: NewsPost) => {
  const fromCatalog = findShopByName(post.shop)?.instagramUrl
  if (fromCatalog) return fromCatalog
  const handle = post.handle?.replace(/^@/, '').trim()
  return handle ? `https://www.instagram.com/${handle}/` : undefined
}

const formatPeriod = (post: NewsPost) => {
  if (!post.startDate) return null
  const toLabel = (iso: string) => {
    const [, m, d] = iso.split('-')
    return `${Number(m)}/${Number(d)}`
  }
  if (!post.endDate || post.endDate === post.startDate) return toLabel(post.startDate)
  return `${toLabel(post.startDate)}~${toLabel(post.endDate)}`
}

export default function NewsFeedScreen({ onShopClick, user, onLoginRequest }: Props) {
  const [activeFilter, setActiveFilter] = useState('전체')
  const [notifications, setNotifications] = useState<Record<number, boolean>>(
    Object.fromEntries(NEWS_POSTS.map(p => [p.id, p.notifying]))
  )
  const today = todayInSeoul()

  const filtered = useMemo(() => {
    const base = activeFilter === '전체' ? NEWS_POSTS : NEWS_POSTS.filter(p => p.type === activeFilter)
    // 진행 중인 소식을 먼저, 종료된 소식은 아래로 보낸다. 같은 묶음 안에서는 원래 순서를 지킨다.
    return [...base].sort((a, b) => Number(isEnded(a, today)) - Number(isEnded(b, today)))
  }, [activeFilter, today])

  const toggleNotify = (id: number) => {
    // App이 user를 넘겨 비회원임이 확실할 때만 로그인으로 보낸다
    if (user === null && onLoginRequest) {
      onLoginRequest()
      return
    }
    setNotifications(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="no-scrollbar h-full overflow-y-auto bg-white text-[#25282B]">
      <header className="border-b border-[#E2E2E2] bg-white px-5 pb-1 pt-3.5">
        <div className="mb-2 flex items-center gap-2.5">
          <img src="/logo.png" alt="" className="h-8 w-8 object-contain" />
          <div>
            <h1 className="text-[20px] font-black tracking-tight text-[#25282B]">라멘속보</h1>
            <p className="text-[13px] text-[#6B6E73]">라멘집 공식 인스타그램 소식 모아보기</p>
          </div>
        </div>

        <div role="group" aria-label="소식 종류" className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {FILTERS.map(f => {
            const active = activeFilter === f
            return (
              <button key={f} type="button" onClick={() => setActiveFilter(f)} aria-pressed={active} className="flex min-h-11 shrink-0 items-center">
                <span
                  className={`rounded-[32px] px-3.5 py-1.5 text-[13px] font-bold transition-colors ${
                    active ? 'bg-[#25282B] text-white' : 'bg-[#F2F2F2] text-[#25282B]'
                  }`}
                >
                  {f}
                </span>
              </button>
            )
          })}
        </div>
      </header>

      <div className="space-y-4 p-4">
        {filtered.length === 0 && (
          <div className="px-6 py-16 text-center">
            <Bell className="mx-auto mb-3 h-8 w-8 text-[#BEBEBE]" aria-hidden="true" />
            <p className="text-[15px] font-bold text-[#25282B]">해당하는 소식이 없어요</p>
            <p className="mt-1 text-[13px] text-[#6B6E73]">새 소식이 올라오면 이곳에 모아 드릴게요.</p>
          </div>
        )}

        {filtered.map(post => {
          const ended = isEnded(post, today)
          const period = formatPeriod(post)
          const instagramUrl = instagramUrlFor(post)
          const notifying = notifications[post.id]

          return (
            <article
              key={post.id}
              aria-label={`${post.shop} ${post.type}${ended ? ', 종료' : ''}`}
              className={`overflow-hidden rounded-[6px] border border-[#E2E2E2] bg-white ${ended ? 'opacity-70' : ''}`}
            >
              <div className="flex items-center justify-between gap-2 border-b border-[#E2E2E2] py-2 pl-3.5 pr-1.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F2F2F2] text-[#25282B]">
                    <Camera className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onShopClick?.(post.shop)}
                      className="-my-2 flex min-h-11 max-w-full items-center gap-0.5 text-left text-[15px] font-black text-[#25282B]"
                    >
                      <span className="truncate">
                        {post.shop} <span className="font-medium text-[#6B6E73]">{post.branch}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[#6B6E73]" aria-hidden="true" />
                    </button>
                    <p className="truncate text-[12px] text-[#6B6E73]">
                      {post.handle ? `${post.handle} · ` : ''}
                      {post.time}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleNotify(post.id)}
                  aria-pressed={notifying}
                  aria-label={notifying ? `${post.shop} 알림 끄기` : `${post.shop} 알림 받기`}
                  className="flex min-h-11 shrink-0 items-center"
                >
                  <span
                    className={`inline-flex items-center gap-1 rounded-[32px] border px-2.5 py-1.5 text-[12px] font-bold transition-colors ${
                      notifying ? 'border-[#25282B] bg-[#25282B] text-white' : 'border-[#E2E2E2] bg-white text-[#4A4D52]'
                    }`}
                  >
                    {notifying ? <BellRing className="h-3.5 w-3.5" aria-hidden="true" /> : <Bell className="h-3.5 w-3.5" aria-hidden="true" />}
                    {notifying ? '알림 켜짐' : '알림 받기'}
                  </span>
                </button>
              </div>

              {post.photo && (
                <div className="relative h-44 overflow-hidden bg-[#F2F2F2]">
                  <img src={post.photo} alt={post.title} className={`h-full w-full object-cover ${ended ? 'grayscale' : ''}`} />
                </div>
              )}

              <div className="p-4">
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-[4px] px-1.5 py-0.5 text-[12px] font-bold ${ended ? 'bg-[#F2F2F2] text-[#6B6E73]' : 'bg-[#FFF0F0] text-[#E60000]'}`}>
                    {post.type}
                  </span>
                  {period && (
                    <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[#6B6E73]">
                      {ended && <CalendarX className="h-3.5 w-3.5" aria-hidden="true" />}
                      {period}
                      {ended ? ' · 종료' : ''}
                    </span>
                  )}
                </div>
                <h2 className="mb-3 text-[15px] font-black leading-snug text-[#25282B]">{post.title}</h2>

                <div className="border-t border-[#F2F2F2] pt-3">
                  <p className="mb-1.5 flex items-center gap-1 text-[13px] font-black text-[#25282B]">
                    <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>핵심 요약</span>
                  </p>
                  <ul className="space-y-1">
                    {post.summary.map((line, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 text-[13px] leading-relaxed text-[#4A4D52]">
                        <span aria-hidden="true" className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-[#6B6E73]" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-3 flex items-center gap-2 border-t border-[#F2F2F2] pt-3">
                  <button
                    type="button"
                    onClick={() => onShopClick?.(post.shop)}
                    className="flex h-11 flex-1 items-center justify-center gap-1 rounded-[6px] bg-[#F2F2F2] text-[13px] font-bold text-[#25282B] transition-colors hover:bg-[#EAEAEA]"
                  >
                    <span>매장 정보</span>
                    <ChevronRight className="h-4 w-4 text-[#6B6E73]" aria-hidden="true" />
                  </button>
                  {instagramUrl && (
                    <a
                      href={instagramUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-11 flex-1 items-center justify-center gap-1 rounded-[6px] border border-[#E2E2E2] bg-white text-[13px] font-bold text-[#25282B] transition-colors hover:border-[#BEBEBE]"
                    >
                      <span>인스타 원문</span>
                      <ExternalLink className="h-3.5 w-3.5 text-[#6B6E73]" aria-hidden="true" />
                      <span className="sr-only">(새 창)</span>
                    </a>
                  )}
                </div>
              </div>
            </article>
          )
        })}

        {filtered.length > 0 && (
          <p className="px-4 pb-3 pt-6 text-center text-[13px] text-[#6B6E73]">모든 라멘속보를 확인했습니다. 새 소식이 올라오면 알려드릴게요.</p>
        )}
        <div className="h-6" />
      </div>
    </div>
  )
}
