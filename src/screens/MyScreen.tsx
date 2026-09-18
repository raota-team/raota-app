import { useState, useRef, useEffect, useMemo, useId, type ReactNode } from 'react'
import { ActivityCalendar, type Activity } from 'react-activity-calendar'
import 'react-activity-calendar/tooltips.css'
import {
  MapPin,
  FileText,
  MessageSquare,
  Heart,
  Search,
  Mail,
  Award,
  Bookmark,
  Bell,
  ChevronRight,
  X,
} from 'lucide-react'
import RamenIcon from '../components/icons/RamenIcon'
import TasteReportCover from '../components/TasteReportCover'
import MonthlyTastePreview from '../components/MonthlyTastePreview'
import { DEMO_BOWLS, PAST_REPORTS, bowlsFromLogs, longestStreak, shopVisitsOf, type DemoBowl } from '../data/tasteReports'
import { DEMO_TYPE_COUNTS } from '../data/demoProfile'
import { getShopDetail } from '../data/shops'
import { currentMonthReport } from '../utils/tasteHistory'
import { seoulMonthKey, seoulToday } from '../utils/monthlyReport'
import { RAMEN_ACTIVITY_LEVELS, getRamenActivityLevel, typeCountsWithLogs } from '../utils/tasteIdentity'
import { EMPTY_PROFILE } from '../utils/taste'
import { RAMEN_TYPES, type RamenLog, type TasteProfile, type UserProfile } from '../types'

interface Props {
  user: UserProfile | null
  recordCount: number
  /** 5축 누적 평균 */
  profile?: TasteProfile
  ownedLogs: RamenLog[]
  savedShopNames: string[]
  monthlyRecordCount?: number
  onViewMonthlyChanges: () => void
  /** App이 데모 계정에만 true를 넘긴다. 데모 원장(그릇, 글, 댓글)은 이때만 쓴다. */
  hasPastReports: boolean
  unreadNotificationsCount?: number
  onNotificationClick?: () => void
  onShopClick?: (shopName: string) => void
  onToggleSavedShop?: (shopName: string) => void
  onViewTaste: (autoGenerate?: boolean) => void
  onLoginClick?: () => void
  onRegisterClick?: () => void
  onLogout?: () => void
  onUpdateUser?: (updated: Partial<UserProfile>) => void
  onLoungeClick?: () => void
}

type ActivityTab = 'logs' | 'visits' | 'saved' | 'posts' | 'comments'

interface MyPostItem {
  id: number
  category: string
  title: string
  content: string
  createdAt: string
  likes: number
  comments: number
}

/** 데모 계정의 라운지 글. 매장과 날짜는 DEMO_BOWLS 원장과 맞춘다. */
const DEMO_POSTS: MyPostItem[] = [
  {
    id: 1,
    category: '맛집후기',
    title: '망원·합정 일대 쇼유 라멘 3곳 비교해봤어요',
    content: '멘야준, 세상끝의라멘, 라멘베라보를 두 달 동안 번갈아 다녀왔습니다. 자가제면과 간장 타레 밸런스 기준으로 정리했어요.',
    createdAt: '2026. 08. 23',
    likes: 42,
    comments: 3,
  },
  {
    id: 2,
    category: '라멘꿀팁',
    title: '오레노라멘 토리파이탄 카에다마 200% 즐기는 법',
    content: '국물이 1/3 남았을 때 카에다마를 요청하고 후추와 다시마 식초를 두 방울 떨어뜨리면 새로운 감칠맛이 열립니다.',
    createdAt: '2026. 05. 03',
    likes: 28,
    comments: 5,
  },
  {
    id: 3,
    category: '자유게시판',
    title: '하쿠텐 평일 점심 웨이팅 현황 공유',
    content: '11시 20분 도착 기준 대기 4팀 있었습니다. 회전율 빨라서 15분 만에 착석했네요. 이에케 기름 보통 추천!',
    createdAt: '2026. 08. 10',
    likes: 19,
    comments: 2,
  },
]

interface MyCommentItem {
  id: number
  targetTitle: string
  targetAuthor: string
  comment: string
  createdAt: string
  likes: number
}

const DEMO_COMMENTS: MyCommentItem[] = [
  {
    id: 1,
    targetTitle: '세상끝의라멘 처음 가보려는데 첫라멘 끝라멘 추천',
    targetAuthor: '라린이',
    comment: '쇼유 본연의 깊은 풍미를 원하시면 첫 방문엔 끝라멘 추천드려요. 두툼한 차슈가 인상적이에요.',
    createdAt: '2026. 09. 04',
    likes: 5,
  },
  {
    id: 2,
    targetTitle: '망원동 혼밥하기 좋은 라멘집 베스트',
    targetAuthor: '멘덕후',
    comment: '멘야준 카운터석이 넓고 조용해서 혼밥 난이도 최하입니다. 사장님도 친절하세요.',
    createdAt: '2026. 08. 25',
    likes: 3,
  },
  {
    id: 3,
    targetTitle: '이에케 라멘 간 조절 다들 어떻게 드시나요?',
    targetAuthor: '쇼유장인',
    comment: '저는 무조건 맛 보통, 기름 보통, 면 단단하게로 갑니다. 밥 시켜서 김 싸먹으면 극락!',
    createdAt: '2026. 08. 11',
    likes: 7,
  },
]

const CALENDAR_THEME = {
  light: ['#F2F2F2', '#FFD6D6', '#FFA8A8', '#FF5C5C', '#E60000'],
  dark: ['#F2F2F2', '#FFD6D6', '#FFA8A8', '#FF5C5C', '#E60000'],
}

const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** 기간 안의 날짜마다 그릇 수를 센다. 캘린더는 최소 하루가 있어야 하므로 끝날은 항상 포함한다. */
function calendarActivities(bowls: DemoBowl[], start: string, end: string): { data: Activity[]; total: number } {
  const counts = new Map<string, number>()
  for (const item of bowls) counts.set(item.date, (counts.get(item.date) ?? 0) + 1)
  const data: Activity[] = []
  let total = 0
  for (let day = start; day <= end; day = addDays(day, 1)) {
    const count = counts.get(day) ?? 0
    total += count
    data.push({ date: day, count, level: Math.min(4, count) })
  }
  return { data, total }
}

const formatDate = (iso: string) => iso.replace(/-/g, '. ')
const shortDate = (iso: string) => iso.slice(5).replace('-', '.')

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  titleId: string
  busy?: boolean
  children: ReactNode
  footer?: ReactNode
  icon?: ReactNode
}

/** 마이 화면 공용 바텀 시트. Escape로 닫히고 열릴 때 닫기 버튼으로 포커스를 옮긴다. */
function BottomSheet({ open, onClose, title, titleId, busy = false, children, footer, icon }: SheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    closeRef.current?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])
  if (!open) return null
  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end overflow-hidden anim-fade-in">
      <button type="button" className="absolute inset-0 bg-black/50" onClick={() => !busy && onClose()} aria-label={`${title} 닫기`} />
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative z-10 flex max-h-[85%] flex-col rounded-t-xl bg-white text-ink shadow-[0_4px_16px_rgba(0,0,0,0.12)] anim-slide-up">
        <div className="flex items-center justify-between border-b border-line py-2 pl-5 pr-2">
          <div className="flex items-center gap-2">
            {icon}
            <h2 id={titleId} className="text-[17px] font-extrabold">{title}</h2>
          </div>
          <button ref={closeRef} type="button" disabled={busy} onClick={onClose} className="report-control flex h-11 w-11 items-center justify-center rounded-full hover:bg-canvas-soft disabled:opacity-50" aria-label="닫기">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar px-5 py-4">{children}</div>
        {footer && <div className="border-t border-line px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">{footer}</div>}
      </section>
    </div>
  )
}

interface ConfirmDialogProps {
  open: boolean
  title: string
  titleId: string
  confirmLabel: string
  busy?: boolean
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
  children?: ReactNode
}

/** 되돌리기 어려운 행동을 확인하는 가운데 창. 입력이 필요한 창은 BottomSheet를 쓴다. */
function ConfirmDialog({ open, title, titleId, confirmLabel, busy = false, destructive = false, onConfirm, onCancel, children }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    cancelRef.current?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus?.({ preventScroll: true })
    }
  }, [open, busy, onCancel])
  if (!open) return null
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center px-8 anim-fade-in">
      <button type="button" tabIndex={-1} className="absolute inset-0 bg-black/50" onClick={() => !busy && onCancel()} aria-label={`${title} 닫기`} />
      <section role="alertdialog" aria-modal="true" aria-labelledby={titleId} className="anim-scale-up relative z-10 w-full max-w-[320px] rounded-[12px] bg-white px-5 pb-5 pt-6 text-center text-ink shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
        <h2 id={titleId} className="text-[17px] font-extrabold">{title}</h2>
        {children && <div className="mt-2 text-[14px] leading-6 text-ink-sub">{children}</div>}
        <div className="mt-5 flex gap-2">
          <button ref={cancelRef} type="button" disabled={busy} onClick={onCancel} className="report-control min-h-12 flex-1 rounded-[60px] border border-line bg-white text-[14px] font-bold text-ink hover:bg-canvas-soft disabled:opacity-60">취소</button>
          <button type="button" disabled={busy} onClick={onConfirm} className={`report-control min-h-12 flex-1 rounded-[60px] text-[14px] font-bold text-white disabled:opacity-60 ${destructive ? 'bg-brand' : 'bg-ink'}`}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  )
}

export default function MyScreen({
  user,
  recordCount,
  profile = EMPTY_PROFILE,
  ownedLogs,
  savedShopNames,
  monthlyRecordCount = 0,
  onViewMonthlyChanges,
  hasPastReports,
  unreadNotificationsCount,
  onNotificationClick,
  onShopClick,
  onToggleSavedShop,
  onViewTaste,
  onLoginClick,
  onRegisterClick,
  onLogout,
  onUpdateUser,
  onLoungeClick,
}: Props) {
  const isDemo = hasPastReports
  const [activityTab, setActivityTab] = useState<ActivityTab>('logs')
  const [visitedShopSort, setVisitedShopSort] = useState<'count' | 'recent' | 'name'>('count')
  const [visitedShopQuery, setVisitedShopQuery] = useState('')
  const [savedShopQuery, setSavedShopQuery] = useState('')
  const [period, setPeriod] = useState('1y')
  const [isGradeGuideOpen, setIsGradeGuideOpen] = useState(false)
  const [isStyleModalOpen, setIsStyleModalOpen] = useState(false)
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
  const [newEmail, setNewEmail] = useState(user?.email ?? '')
  const [isEmailUpdating, setIsEmailUpdating] = useState(false)
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [showRightFade, setShowRightFade] = useState(true)
  const [showLeftFade, setShowLeftFade] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const tabScrollRef = useRef<HTMLDivElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ids = {
    period: useId(),
    visitSearch: useId(),
    savedSearch: useId(),
    grade: useId(),
    style: useId(),
    email: useId(),
    emailInput: useId(),
    withdraw: useId(),
    logout: useId(),
    sortLabel: useId(),
  }

  const updateFadeEdges = () => {
    const el = tabScrollRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    setShowLeftFade(scrollLeft > 6)
    setShowRightFade(scrollLeft < scrollWidth - clientWidth - 6)
  }

  useEffect(() => {
    updateFadeEdges()
    window.addEventListener('resize', updateFadeEdges)
    return () => {
      window.removeEventListener('resize', updateFadeEdges)
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  const handleTabClick = (tab: ActivityTab, event: React.MouseEvent<HTMLButtonElement>) => {
    setActivityTab(tab)
    event.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    setTimeout(updateFadeEdges, 350)
  }

  const maskStyle = (): React.CSSProperties | undefined => {
    const left = showLeftFade ? 'transparent 0%, black 20px, ' : ''
    const right = showRightFade ? ', black calc(100% - 28px), transparent 100%' : ''
    if (!left && !right) return undefined
    const mask = `linear-gradient(to right, ${left}black${right})`
    return { maskImage: mask, WebkitMaskImage: mask }
  }

  const showToast = (msg: string) => {
    setToastMsg(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(null), 2500)
  }

  const handleSaveStyle = (style: string) => {
    onUpdateUser?.({ favoriteRamenType: style })
    setIsStyleModalOpen(false)
    showToast(`선호 스타일을 '${style}'로 바꿨어요`)
  }

  const handleSaveEmail = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = newEmail.trim()
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      showToast('올바른 이메일 주소를 입력해 주세요')
      return
    }
    setIsEmailUpdating(true)
    setTimeout(() => {
      setIsEmailUpdating(false)
      onUpdateUser?.({ email: trimmed })
      setIsEmailModalOpen(false)
      showToast('이메일 주소를 바꿨어요')
    }, 600)
  }

  const handleWithdraw = () => {
    setIsWithdrawing(true)
    setTimeout(() => {
      setIsWithdrawing(false)
      setIsWithdrawModalOpen(false)
      onLogout?.()
    }, 800)
  }

  const isLoggedIn = Boolean(user?.isLoggedIn)

  // ---- 원장에서 파생하는 값들 ----
  const bowls = useMemo(() => [...(isDemo ? DEMO_BOWLS : []), ...bowlsFromLogs(ownedLogs)], [isDemo, ownedLogs])
  const visits = useMemo(() => shopVisitsOf(bowls), [bowls])
  const typeCounts = useMemo(() => typeCountsWithLogs(isDemo ? DEMO_TYPE_COUNTS : {}, ownedLogs), [isDemo, ownedLogs])
  const currentMonth = useMemo(
    () => currentMonthReport({ [seoulMonthKey()]: monthlyRecordCount }, ownedLogs, isDemo ? DEMO_BOWLS : []),
    [isDemo, monthlyRecordCount, ownedLogs],
  )
  const level = useMemo(() => getRamenActivityLevel(recordCount), [recordCount])
  const streak = useMemo(() => longestStreak(bowls), [bowls])
  const today = seoulToday()
  const years = useMemo(() => [...new Set(bowls.map(item => item.date.slice(0, 4)))].sort().reverse(), [bowls])
  const periodOptions = [{ value: '1y', label: '최근 1년' }, ...years.map(year => ({ value: year, label: `${year}년` }))]
  const calendar = useMemo(() => {
    if (period === '1y') return calendarActivities(bowls, addDays(today, -364), today)
    const end = `${period}-12-31` < today ? `${period}-12-31` : today
    return calendarActivities(bowls, `${period}-01-01`, end)
  }, [bowls, period, today])
  const periodLabel = periodOptions.find(option => option.value === period)?.label ?? '최근 1년'

  // 캘린더는 항상 최근 날짜(오른쪽 끝)부터 보여준다.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const toRight = () => { el.scrollLeft = el.scrollWidth }
    toRight()
    const raf = requestAnimationFrame(toRight)
    const timer = setTimeout(toRight, 120)
    return () => { cancelAnimationFrame(raf); clearTimeout(timer) }
  }, [calendar, activityTab])

  const filteredVisits = useMemo(() => {
    const q = visitedShopQuery.trim().toLowerCase()
    const list = q
      ? visits.filter(shop => [shop.name, shop.branch ?? '', shop.style, shop.topMenu].some(text => text.toLowerCase().includes(q)))
      : [...visits]
    if (visitedShopSort === 'recent') list.sort((a, b) => b.lastVisited.localeCompare(a.lastVisited))
    else if (visitedShopSort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    else list.sort((a, b) => b.visitCount - a.visitCount || b.lastVisited.localeCompare(a.lastVisited))
    return list
  }, [visits, visitedShopQuery, visitedShopSort])

  const savedShops = useMemo(() => savedShopNames.map(getShopDetail), [savedShopNames])
  const filteredSavedShops = useMemo(() => {
    const q = savedShopQuery.trim().toLowerCase()
    if (!q) return savedShops
    return savedShops.filter(shop => [shop.name, shop.branch ?? '', shop.style, shop.address, ...shop.tags].some(text => text.toLowerCase().includes(q)))
  }, [savedShops, savedShopQuery])

  const recentLogs = useMemo(() => {
    const sessionIds = new Set(bowlsFromLogs(ownedLogs).map(item => `${item.date}${item.shop}${item.menu}`))
    return [...bowls]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
      .map(item => ({ ...item, isNew: sessionIds.has(`${item.date}${item.shop}${item.menu}`), photo: ownedLogs.find(log => log.shop.name === item.shop && log.menuName === item.menu)?.imageUrl ?? getShopDetail(item.shop).photos[0] }))
  }, [bowls, ownedLogs])

  const posts = isDemo ? DEMO_POSTS : []
  const comments = isDemo ? DEMO_COMMENTS : []

  if (!isLoggedIn) {
    return (
      <div className="h-full overflow-y-auto bg-white px-5 py-10 text-center text-ink">
        <img src="/logo.png" alt="라오타" className="mx-auto h-16 w-16 object-contain" />
        <h1 className="mt-5 text-[24px] font-extrabold tracking-tight">내 라멘 취향을 모아보세요</h1>
        <p className="mx-auto mt-2 max-w-72 text-[14px] leading-6 text-ink-sub">로그인하면 기록, 가고 싶은 매장, 취향 리포트를 한곳에서 이어볼 수 있어요.</p>
        <div className="mt-7 space-y-2.5">
          <button type="button" onClick={onLoginClick} className="h-12 w-full rounded-[60px] bg-brand text-[14px] font-bold text-white transition-opacity active:opacity-90">로그인</button>
          <button type="button" onClick={onRegisterClick} className="h-12 w-full rounded-[60px] border border-line bg-white text-[14px] font-bold text-ink hover:bg-canvas-soft">회원가입</button>
        </div>
      </div>
    )
  }

  const tabs: { id: ActivityTab; label: string; count: number; Icon: typeof MapPin }[] = [
    { id: 'logs', label: '라멘로그', count: recordCount, Icon: RamenIcon as unknown as typeof MapPin },
    { id: 'visits', label: '방문매장', count: visits.length, Icon: MapPin },
    { id: 'saved', label: '가고싶어요', count: savedShops.length, Icon: Bookmark },
    { id: 'posts', label: '작성글', count: posts.length, Icon: FileText },
    { id: 'comments', label: '댓글', count: comments.length, Icon: MessageSquare },
  ]

  const panelId = (tab: ActivityTab) => `my-panel-${tab}`
  const tabId = (tab: ActivityTab) => `my-tab-${tab}`

  const emptyState = (title: string, description: string) => (
    <div className="py-10 text-center">
      <p className="text-[15px] font-bold text-ink">{title}</p>
      <p className="mt-1 text-[13px] leading-5 text-ink-sub">{description}</p>
    </div>
  )

  return (
    <div className="relative h-full w-full overflow-hidden bg-white text-ink">
      <div className="h-full w-full overflow-y-auto no-scrollbar">
        {/* 라멘클럽 회원증: 차콜 헤더 */}
        <header className="bg-ink px-5 pb-4 pt-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white">
                {user?.avatar ? <img src={user.avatar} alt="" className="h-full w-full object-cover" /> : <img src="/logo.png" alt="" className="h-10 w-10 object-contain" />}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-[20px] font-extrabold tracking-tight">{user?.nickname}</h1>
                <p className="mt-0.5 flex flex-wrap gap-x-1.5 text-[13px] font-medium leading-5 text-white/70"><span>라오타 라멘클럽 회원</span>{user?.membershipNo && <span>{user.membershipNo}</span>}</p>
              </div>
            </div>
            {onNotificationClick && (
              <button type="button" onClick={onNotificationClick} className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white hover:bg-white/10" aria-label={unreadNotificationsCount ? `알림 ${unreadNotificationsCount}개 안 읽음` : '알림'}>
                <Bell size={20} aria-hidden="true" />
                {Boolean(unreadNotificationsCount) && <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-brand ring-2 ring-ink" aria-hidden="true" />}
              </button>
            )}
          </div>

          <dl className="mt-4 grid grid-cols-3 divide-x divide-white/15 border-t border-white/15 pt-4 text-center">
            <div><dt className="text-[12px] font-medium text-white/70">총 라멘로그</dt><dd className="mt-0.5 text-[20px] font-extrabold">{recordCount}<span className="ml-0.5 text-[13px] font-bold text-white/80">그릇</span></dd></div>
            <div><dt className="text-[12px] font-medium text-white/70">방문 매장</dt><dd className="mt-0.5 text-[20px] font-extrabold">{visits.length}<span className="ml-0.5 text-[13px] font-bold text-white/80">곳</span></dd></div>
            <div><dt className="text-[12px] font-medium text-white/70">이번 달</dt><dd className="mt-0.5 text-[20px] font-extrabold">{monthlyRecordCount}<span className="ml-0.5 text-[13px] font-bold text-white/80">그릇</span></dd></div>
          </dl>

          <button type="button" onClick={() => setIsGradeGuideOpen(true)} className="report-control mt-3 flex min-h-11 w-full items-center justify-between gap-3 rounded-md text-[13px] font-medium text-white/85 hover:text-white">
            <span className="flex items-center gap-1.5 font-bold text-white"><Award size={16} aria-hidden="true" />Lv.{level.number} {level.title}</span>
            <span className="flex items-center gap-1">{level.nextLevel ? `다음 등급까지 ${level.nextLevel.min - recordCount}그릇` : '최고 등급'}<ChevronRight size={16} aria-hidden="true" /></span>
          </button>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/15" aria-hidden="true"><div className="h-full rounded-full bg-brand" style={{ width: `${level.progress}%` }} /></div>
        </header>

        <main className="space-y-4 p-4">
          <TasteReportCover recordCount={recordCount} profile={profile} typeCounts={typeCounts} onOpen={() => onViewTaste(false)} onAnalyze={() => onViewTaste(true)} />
          <MonthlyTastePreview reports={isDemo ? PAST_REPORTS : []} current={currentMonth} onOpen={onViewMonthlyChanges} />

          <div ref={tabScrollRef} onScroll={updateFadeEdges} style={maskStyle()} role="tablist" aria-label="내 활동" className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 scroll-smooth">
            {tabs.map(({ id, label, count, Icon }) => {
              const active = activityTab === id
              return (
                <button key={id} id={tabId(id)} type="button" role="tab" aria-selected={active} aria-controls={panelId(id)} onClick={event => handleTabClick(id, event)} className={`flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[60px] px-3.5 text-[13px] font-bold transition-colors ${active ? 'bg-ink text-white' : 'border border-line bg-white text-ink hover:bg-canvas-soft'}`}>
                  <Icon size={15} aria-hidden="true" />
                  <span>{label}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[12px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-canvas-soft text-ink-sub'}`}>{count}</span>
                </button>
              )
            })}
          </div>

          {activityTab === 'logs' && (
            <div id={panelId('logs')} role="tabpanel" aria-labelledby={tabId('logs')} className="space-y-4 anim-fade-in">
              <section className="rounded-md border border-line bg-white p-4" aria-labelledby="my-calendar-title">
                <div className="flex items-center justify-between gap-3">
                  <h2 id="my-calendar-title" className="flex items-center gap-1.5 text-[17px] font-extrabold"><RamenIcon className="h-4.5 w-4.5" aria-hidden="true" />라멘로그 캘린더</h2>
                  <div>
                    <label htmlFor={ids.period} className="sr-only">캘린더 기간</label>
                    <select id={ids.period} value={period} onChange={event => setPeriod(event.target.value)} className="report-control min-h-11 rounded-md border border-line bg-white px-3 text-[13px] font-bold text-ink">
                      {periodOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                </div>
                <div ref={scrollRef} className="custom-scrollbar mt-3 overflow-x-auto pb-2">
                  <div className="min-w-max">
                    <ActivityCalendar
                      data={calendar.data}
                      theme={CALENDAR_THEME}
                      blockSize={12}
                      blockMargin={3}
                      blockRadius={2}
                      fontSize={12}
                      showWeekdayLabels
                      showColorLegend={false}
                      showTotalCount={false}
                      tooltips={{ activity: { text: activity => activity.count > 0 ? `${formatDate(activity.date)}: ${activity.count}그릇` : `${formatDate(activity.date)}: 기록 없음` } }}
                      labels={{
                        months: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
                        weekdays: ['일', '월', '화', '수', '목', '금', '토'],
                      }}
                    />
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 border-t border-line pt-3 text-[13px]">
                  <p className="font-medium text-ink-sub"><strong className="font-extrabold text-ink">{periodLabel} {calendar.total}그릇</strong>{streak > 1 ? ` · 최장 ${streak}일 연속` : ''}</p>
                  <div className="flex shrink-0 items-center gap-1 text-[12px] text-ink-sub" aria-label="색이 진할수록 그날 기록이 많아요">
                    <span>적음</span>
                    <div className="flex gap-0.5" aria-hidden="true">{CALENDAR_THEME.light.map(color => <span key={color} className="h-2.5 w-2.5 rounded-xs" style={{ backgroundColor: color }} />)}</div>
                    <span>많음</span>
                  </div>
                </div>
                {calendar.total === 0 && <p className="mt-2 text-[13px] leading-5 text-ink-sub">이 기간에는 기록이 없어요. 라멘로그를 남기면 캘린더가 채워져요.</p>}
              </section>

              <section className="rounded-md border border-line bg-white p-4" aria-labelledby="my-recent-title">
                <div className="flex items-center justify-between gap-3">
                  <h2 id="my-recent-title" className="text-[17px] font-extrabold">최근 기록</h2>
                  {recentLogs.length > 0 && <span className="text-[12px] font-medium text-ink-sub">최근 {recentLogs.length}그릇</span>}
                </div>
                {recentLogs.length ? (
                  <ul className="mt-1 divide-y divide-line">
                    {recentLogs.map(log => {
                      const detail = getShopDetail(log.shop)
                      return (
                        <li key={`${log.date}-${log.shop}-${log.menu}`}>
                          <button type="button" onClick={() => onShopClick?.(log.shop)} className="report-control -mx-2 flex w-[calc(100%+16px)] items-center gap-3 rounded-md px-2 py-3 text-left hover:bg-canvas-soft">
                            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-canvas-soft">
                              {log.photo ? <img src={log.photo} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-[15px] font-extrabold text-ink-sub" aria-hidden="true">{log.shop.slice(0, 1)}</span>}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="flex items-center gap-1.5 text-[15px] font-bold text-ink"><span className="truncate">{log.shop}{detail.branch ? <span className="ml-1 text-[13px] font-medium text-ink-sub">{detail.branch}</span> : null}</span>{log.isNew && <span className="shrink-0 rounded-xs bg-brand px-1.5 py-0.5 text-[12px] font-bold text-white">신규</span>}</p>
                              <p className="mt-0.5 truncate text-[13px] text-ink-sub">{log.menu} · {log.type}</p>
                            </div>
                            <span className="shrink-0 text-[12px] font-bold text-ink-sub">{shortDate(log.date)}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                ) : emptyState('아직 기록이 없어요', '홈에서 첫 그릇을 남기면 여기에 쌓여요.')}
              </section>
            </div>
          )}

          {activityTab === 'visits' && (
            <section id={panelId('visits')} role="tabpanel" aria-labelledby={tabId('visits')} className="rounded-md border border-line bg-white p-4 anim-fade-in">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[17px] font-extrabold">방문한 라멘집 <span className="text-ink-sub">{visits.length}곳</span></h2>
              </div>
              <p className="mt-1 text-[13px] text-ink-sub">라멘로그를 남긴 매장이에요. 방문 수를 더하면 총 {recordCount}그릇이에요.</p>
              {visits.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="flex gap-1 rounded-md bg-canvas-soft p-0.5" role="group" aria-labelledby={ids.sortLabel}>
                    <span id={ids.sortLabel} className="sr-only">정렬</span>
                    {[
                      { key: 'count', label: '방문순' },
                      { key: 'recent', label: '최신순' },
                      { key: 'name', label: '이름순' },
                    ].map(option => (
                      <button key={option.key} type="button" aria-pressed={visitedShopSort === option.key} onClick={() => setVisitedShopSort(option.key as typeof visitedShopSort)} className={`report-control min-h-11 flex-1 rounded-sm text-[13px] font-bold transition-colors ${visitedShopSort === option.key ? 'bg-white text-ink' : 'text-ink-sub hover:text-ink'}`}>{option.label}</button>
                    ))}
                  </div>
                  <div className="relative">
                    <label htmlFor={ids.visitSearch} className="sr-only">방문한 라멘집 검색</label>
                    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-sub" aria-hidden="true" />
                    <input id={ids.visitSearch} type="search" value={visitedShopQuery} onChange={event => setVisitedShopQuery(event.target.value)} placeholder="매장, 지점, 메뉴 검색" className="h-11 w-full rounded-md border border-line bg-white pl-9 pr-3 text-[14px] text-ink placeholder:text-ink-sub focus:border-brand focus:outline-none" />
                  </div>
                </div>
              )}
              {filteredVisits.length === 0
                ? emptyState(visits.length ? '검색 결과가 없어요' : '아직 방문한 라멘집이 없어요', visits.length ? '다른 이름이나 메뉴로 찾아보세요.' : '라멘로그를 남기면 매장별 방문 수가 쌓여요.')
                : (
                  <ul className="mt-2 divide-y divide-line">
                    {filteredVisits.map(shop => (
                      <li key={shop.name}>
                        <button type="button" onClick={() => onShopClick?.(shop.name)} className="report-control -mx-2 flex w-[calc(100%+16px)] items-center gap-3 rounded-md px-2 py-3 text-left hover:bg-canvas-soft">
                          <div className="h-13 w-13 shrink-0 overflow-hidden rounded-md bg-canvas-soft">
                            {shop.photo ? <img src={shop.photo} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-[17px] font-extrabold text-ink-sub" aria-hidden="true">{shop.name.slice(0, 1)}</span>}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5">
                              <span className="truncate text-[15px] font-bold text-ink">{shop.name}{shop.branch ? <span className="ml-1 text-[13px] font-medium text-ink-sub">{shop.branch}</span> : null}</span>
                              {shop.visitCount >= 3 && <span className="shrink-0 rounded-xs bg-canvas-soft px-1.5 py-0.5 text-[12px] font-bold text-ink">단골</span>}
                            </p>
                            <p className="mt-0.5 truncate text-[13px] text-ink-sub">{shop.style} · {shop.topMenu}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <span className="block text-[15px] font-extrabold text-ink">{shop.visitCount}그릇</span>
                            <span className="block text-[12px] font-medium text-ink-sub">{shortDate(shop.lastVisited)}</span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
            </section>
          )}

          {activityTab === 'saved' && (
            <section id={panelId('saved')} role="tabpanel" aria-labelledby={tabId('saved')} className="rounded-md border border-line bg-white p-4 anim-fade-in">
              <h2 className="text-[17px] font-extrabold">가고 싶은 라멘집 <span className="text-ink-sub">{savedShops.length}곳</span></h2>
              <p className="mt-1 text-[13px] text-ink-sub">매장 상세에서 저장한 곳이에요.</p>
              {savedShops.length > 0 && (
                <div className="relative mt-3">
                  <label htmlFor={ids.savedSearch} className="sr-only">저장한 라멘집 검색</label>
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-sub" aria-hidden="true" />
                  <input id={ids.savedSearch} type="search" value={savedShopQuery} onChange={event => setSavedShopQuery(event.target.value)} placeholder="매장, 지점, 스타일 검색" className="h-11 w-full rounded-md border border-line bg-white pl-9 pr-3 text-[14px] text-ink placeholder:text-ink-sub focus:border-brand focus:outline-none" />
                </div>
              )}
              {filteredSavedShops.length === 0
                ? emptyState(savedShops.length ? '검색 결과가 없어요' : '아직 저장한 라멘집이 없어요', savedShops.length ? '다른 이름이나 스타일로 찾아보세요.' : '매장 상세에서 저장하면 여기에 모여요.')
                : (
                  <ul className="mt-2 divide-y divide-line">
                    {filteredSavedShops.map(shop => (
                      <li key={shop.name} className="flex items-center gap-1 py-1">
                        <button type="button" onClick={() => onShopClick?.(shop.name)} className="report-control -ml-2 flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-canvas-soft">
                          <div className="h-13 w-13 shrink-0 overflow-hidden rounded-md bg-canvas-soft">
                            {shop.photos[0] ? <img src={shop.photos[0]} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-[17px] font-extrabold text-ink-sub" aria-hidden="true">{shop.name.slice(0, 1)}</span>}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] font-bold text-ink">{shop.name}{shop.branch ? <span className="ml-1 text-[13px] font-medium text-ink-sub">{shop.branch}</span> : null}</p>
                            <p className="mt-0.5 truncate text-[13px] text-ink-sub">{shop.style}{shop.spec ? ` · ${shop.spec}` : ''}</p>
                            {shop.tags.length > 0 && <p className="mt-1 truncate text-[12px] font-medium text-ink-sub">{shop.tags.slice(0, 3).map(tag => `#${tag}`).join(' ')}</p>}
                          </div>
                        </button>
                        <button type="button" onClick={() => { onToggleSavedShop?.(shop.name); showToast(`'${shop.name}' 저장을 해제했어요`) }} className="report-control flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-brand hover:bg-brand-light" aria-label={`${shop.name} 저장 해제`}>
                          <Bookmark size={18} className="fill-brand" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
            </section>
          )}

          {activityTab === 'posts' && (
            <section id={panelId('posts')} role="tabpanel" aria-labelledby={tabId('posts')} className="rounded-md border border-line bg-white p-4 anim-fade-in">
              <h2 className="text-[17px] font-extrabold">작성한 글 <span className="text-ink-sub">{posts.length}</span></h2>
              {posts.length === 0 ? emptyState('아직 작성한 글이 없어요', '라운지에서 라멘 이야기를 나눠보세요.') : (
                <ul className="mt-1 divide-y divide-line">
                  {posts.map(post => (
                    <li key={post.id}>
                      <button type="button" onClick={onLoungeClick} className="report-control -mx-2 w-[calc(100%+16px)] rounded-md px-2 py-3 text-left hover:bg-canvas-soft">
                        <p className="flex items-center gap-2 text-[12px] font-medium text-ink-sub"><span className="rounded-xs bg-canvas-soft px-1.5 py-0.5 font-bold text-ink">{post.category}</span>{post.createdAt}</p>
                        <p className="mt-1.5 text-[15px] font-bold leading-snug text-ink">{post.title}</p>
                        <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-ink-sub">{post.content}</p>
                        <p className="mt-2 flex items-center gap-3 text-[12px] font-bold text-ink-sub">
                          <span className="flex items-center gap-1"><Heart size={13} aria-hidden="true" /><span className="sr-only">공감 </span>{post.likes}</span>
                          <span className="flex items-center gap-1"><MessageSquare size={13} aria-hidden="true" /><span className="sr-only">댓글 </span>{post.comments}</span>
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {activityTab === 'comments' && (
            <section id={panelId('comments')} role="tabpanel" aria-labelledby={tabId('comments')} className="rounded-md border border-line bg-white p-4 anim-fade-in">
              <h2 className="text-[17px] font-extrabold">남긴 댓글 <span className="text-ink-sub">{comments.length}</span></h2>
              {comments.length === 0 ? emptyState('아직 남긴 댓글이 없어요', '라운지 글에 첫 댓글을 남겨보세요.') : (
                <ul className="mt-1 divide-y divide-line">
                  {comments.map(item => (
                    <li key={item.id}>
                      <button type="button" onClick={onLoungeClick} className="report-control -mx-2 w-[calc(100%+16px)] rounded-md px-2 py-3 text-left hover:bg-canvas-soft">
                        <p className="truncate text-[12px] font-medium text-ink-sub">원문: <span className="font-bold text-ink">{item.targetTitle}</span> · {item.targetAuthor}</p>
                        <p className="mt-1.5 text-[14px] leading-6 text-ink">{item.comment}</p>
                        <p className="mt-2 flex items-center justify-between text-[12px] font-bold text-ink-sub"><span>{item.createdAt}</span><span className="flex items-center gap-1"><Heart size={13} aria-hidden="true" /><span className="sr-only">공감 </span>{item.likes}</span></p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section className="rounded-md border border-line bg-white p-4" aria-labelledby="my-account-title">
            <h2 id="my-account-title" className="text-[17px] font-extrabold">계정</h2>
            <dl className="mt-1 divide-y divide-line">
              <div className="flex min-h-12 items-center justify-between gap-3 py-1">
                <dt className="shrink-0 text-[14px] font-medium text-ink-sub">이메일</dt>
                <dd className="flex min-w-0 items-center gap-1">
                  <span className="truncate text-[14px] font-bold text-ink">{user?.email || '등록된 이메일 없음'}</span>
                  <button type="button" onClick={() => { setNewEmail(user?.email ?? ''); setIsEmailModalOpen(true) }} className="report-control min-h-11 min-w-11 shrink-0 rounded-md px-2 text-[13px] font-bold text-ink hover:bg-canvas-soft">변경</button>
                </dd>
              </div>
              <div className="flex min-h-12 items-center justify-between gap-3 py-1">
                <dt className="shrink-0 text-[14px] font-medium text-ink-sub">선호 스타일</dt>
                <dd className="flex min-w-0 items-center gap-1">
                  <span className="truncate text-[14px] font-bold text-ink">{user?.favoriteRamenType || '아직 안 정했어요'}</span>
                  <button type="button" onClick={() => setIsStyleModalOpen(true)} className="report-control min-h-11 min-w-11 shrink-0 rounded-md px-2 text-[13px] font-bold text-ink hover:bg-canvas-soft">변경</button>
                </dd>
              </div>
            </dl>
            {onLogout && (
              <button type="button" onClick={() => setIsLogoutConfirmOpen(true)} className="report-control mt-3 min-h-11 w-full rounded-xs border border-ink bg-white text-[14px] font-bold text-ink hover:bg-canvas-soft">로그아웃</button>
            )}
          </section>

          <div className="flex justify-center pb-6">
            <button type="button" onClick={() => setIsWithdrawModalOpen(true)} className="report-control min-h-11 px-4 text-[13px] font-medium text-ink-sub underline underline-offset-4 hover:text-ink">회원 탈퇴</button>
          </div>
        </main>
      </div>

      <BottomSheet open={isGradeGuideOpen} onClose={() => setIsGradeGuideOpen(false)} title="라멘 활동 등급" titleId={ids.grade}
        footer={<button type="button" onClick={() => setIsGradeGuideOpen(false)} className="report-control min-h-12 w-full rounded-[60px] bg-ink text-[14px] font-bold text-white">확인</button>}>
        <p className="text-[14px] leading-6 text-ink-sub">공개 라멘로그 수를 기준으로 등급이 올라가요. 지금은 {recordCount}그릇, <strong className="font-bold text-ink">Lv.{level.number} {level.title}</strong>예요.</p>
        <ol className="mt-4 divide-y divide-line border-y border-line">
          {RAMEN_ACTIVITY_LEVELS.map((item, index) => {
            const isCurrent = item.title === level.title
            return (
              <li key={item.title} className={`flex items-center justify-between gap-3 px-1 py-3 ${isCurrent ? 'bg-brand-light' : ''}`} aria-current={isCurrent ? 'true' : undefined}>
                <div className="min-w-0">
                  <p className={`text-[15px] font-bold ${isCurrent ? 'text-brand' : 'text-ink'}`}>Lv.{index + 1} {item.title}</p>
                  <p className="mt-0.5 text-[13px] text-ink-sub">{item.desc}</p>
                </div>
                {isCurrent && <span className="shrink-0 text-[12px] font-bold text-brand">내 등급</span>}
              </li>
            )
          })}
        </ol>
      </BottomSheet>

      <BottomSheet open={isStyleModalOpen} onClose={() => setIsStyleModalOpen(false)} title="선호 라멘 스타일" titleId={ids.style}>
        <p className="text-[14px] leading-6 text-ink-sub">가장 즐겨 먹는 종류를 골라 주세요. 프로필에 표시돼요.</p>
        <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="라멘 스타일">
          {RAMEN_TYPES.map(style => {
            const selected = user?.favoriteRamenType === style
            return (
              <button key={style} type="button" aria-pressed={selected} onClick={() => handleSaveStyle(style)} className={`report-control flex min-h-12 items-center justify-between rounded-md border px-3 text-left text-[14px] font-bold transition-colors ${selected ? 'border-brand bg-brand-light text-brand' : 'border-line bg-white text-ink hover:bg-canvas-soft'}`}>
                {style}
                {selected && <span className="text-[12px]">선택됨</span>}
              </button>
            )
          })}
        </div>
      </BottomSheet>

      <BottomSheet open={isEmailModalOpen} onClose={() => setIsEmailModalOpen(false)} title="이메일 변경" titleId={ids.email} busy={isEmailUpdating} icon={<Mail size={18} aria-hidden="true" />}>
        <form onSubmit={handleSaveEmail} className="space-y-4">
          <p className="text-[14px] leading-6 text-ink-sub">라오타 알림을 받을 이메일 주소를 입력해 주세요.</p>
          <div>
            <label htmlFor={ids.emailInput} className="block text-[13px] font-bold text-ink">새 이메일 주소</label>
            <input id={ids.emailInput} type="email" required value={newEmail} onChange={event => setNewEmail(event.target.value)} placeholder="ramen@example.com" className="mt-1.5 h-12 w-full rounded-xs border border-ink-sub bg-white px-3 text-[16px] text-ink focus:border-brand focus:outline-none" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" disabled={isEmailUpdating} onClick={() => setIsEmailModalOpen(false)} className="report-control min-h-12 flex-1 rounded-[60px] border border-line bg-white text-[14px] font-bold text-ink hover:bg-canvas-soft">취소</button>
            <button type="submit" disabled={isEmailUpdating} className="report-control min-h-12 flex-1 rounded-[60px] bg-brand text-[14px] font-bold text-white disabled:opacity-60">{isEmailUpdating ? '저장 중…' : '저장'}</button>
          </div>
        </form>
      </BottomSheet>

      <ConfirmDialog
        open={isLogoutConfirmOpen}
        title="로그아웃할까요?"
        titleId={ids.logout}
        confirmLabel="로그아웃"
        onCancel={() => setIsLogoutConfirmOpen(false)}
        onConfirm={() => { setIsLogoutConfirmOpen(false); onLogout?.() }}
      >
        기록과 취향 리포트는 계정에 그대로 남아 있어요.
      </ConfirmDialog>

      <ConfirmDialog
        open={isWithdrawModalOpen}
        title="회원 탈퇴"
        titleId={ids.withdraw}
        confirmLabel={isWithdrawing ? '처리 중…' : '탈퇴하기'}
        busy={isWithdrawing}
        destructive
        onCancel={() => setIsWithdrawModalOpen(false)}
        onConfirm={handleWithdraw}
      >
        <p>탈퇴하면 바로 로그아웃되고, 30일 뒤 같은 계정으로 다시 가입할 수 있어요.</p>
        <ul className="mt-3 space-y-1.5 border-t border-line pt-3 text-left text-[13px] leading-5">
          <li>30일 동안 같은 소셜 계정으로 재가입할 수 없어요.</li>
          <li>30일이 지나면 라멘로그, 취향 리포트, 저장한 매장이 모두 지워져요.</li>
          <li>라운지 글과 댓글은 남을 수 있고, 작성자는 탈퇴한 사용자로 표시돼요.</li>
        </ul>
      </ConfirmDialog>

      {toastMsg && (
        <div role="status" className="pointer-events-none absolute bottom-4 left-1/2 z-50 -translate-x-1/2 anim-fade-in-up">
          <div className="flex items-center gap-2 whitespace-nowrap rounded-[60px] bg-ink px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
            <RamenIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{toastMsg}</span>
          </div>
        </div>
      )}
    </div>
  )
}
