import { useState, useRef, useEffect, useMemo } from 'react'
import { ActivityCalendar, type Activity } from 'react-activity-calendar'
import 'react-activity-calendar/tooltips.css'
import {
  MapPin,
  FileText,
  MessageSquare,
  Heart,
  Search,
  Mail,
  AlertTriangle,
  ShieldCheck,
  Award,
  Bookmark,
  Bell,
  Trophy,
  Lightbulb,
  Sparkles,
  ChevronDown,
  Medal,
} from 'lucide-react'
import RamenIcon from '../components/icons/RamenIcon'



import type { UserProfile } from '../types'

interface Props {
  user: UserProfile | null
  recordSaved: boolean
  recordCount: number
  unreadNotificationsCount?: number
  onNotificationClick?: () => void
  onShopClick?: (shopId?: number) => void
  onViewTaste: () => void
  onLoginClick?: () => void
  onRegisterClick?: () => void
  onLogout?: () => void
  onUpdateUser?: (updated: Partial<UserProfile>) => void
  onLoungeClick?: () => void
}

type ActivityTab = 'logs' | 'visits' | 'saved' | 'posts' | 'comments'


export interface VisitedShopItem {
  id: number
  name: string
  branch: string
  location: string
  style: string
  tags: string[]
  photo: string
  visitCount: number
  lastVisited: string
  isRegular?: boolean
  bestMenu: string
}

const MY_VISITED_SHOPS: VisitedShopItem[] = [
  {
    id: 1,
    name: '멘야준',
    branch: '망원 본점',
    location: '서울 마포구 망원로',
    style: '특제 쇼유 라멘',
    tags: ['쇼유', '자가제면', '오리육수'],
    photo: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=300&h=300&fit=crop&auto=format&q=80',
    visitCount: 6,
    lastVisited: '2026. 09. 01',
    isRegular: true,
    bestMenu: '특제 쇼유 라멘',
  },
  {
    id: 3,
    name: '오레노라멘',
    branch: '마포 본점',
    location: '서울 마포구 독막로',
    style: '토리파이탄',
    tags: ['닭백탕', '미쉐린 빕구르망'],
    photo: 'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=300&h=300&fit=crop&auto=format&q=80',
    visitCount: 4,
    lastVisited: '2026. 08. 31',
    isRegular: true,
    bestMenu: '토리파이탄 라멘',
  },
  {
    id: 2,
    name: '세상끝의라멘',
    branch: '합정점',
    location: '서울 마포구 양화로',
    style: '블랙 쇼유 라멘',
    tags: ['오사카 블랙', '두툼한 차슈'],
    photo: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=300&h=300&fit=crop&auto=format&q=80',
    visitCount: 3,
    lastVisited: '2026. 08. 25',
    isRegular: true,
    bestMenu: '끝라멘 (특제)',
  },
  {
    id: 4,
    name: '하쿠텐 라멘',
    branch: '연남점',
    location: '서울 마포구 동교로',
    style: '이에케 라멘',
    tags: ['돈골간장', '시금치', '갓김치'],
    photo: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=300&h=300&fit=crop&auto=format&q=80',
    visitCount: 2,
    lastVisited: '2026. 08. 18',
    bestMenu: '이에케 라멘 (진하게)',
  },
  {
    id: 5,
    name: '라멘 무메이',
    branch: '상수 본점',
    location: '서울 마포구 와우산로',
    style: '시오 라멘',
    tags: ['해산물 육수', '깔끔함'],
    photo: 'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=300&h=300&fit=crop&auto=format&q=80',
    visitCount: 2,
    lastVisited: '2026. 08. 10',
    bestMenu: '특제 파이탄 시오',
  },
  {
    id: 6,
    name: '멘지',
    branch: '망원점',
    location: '서울 마포구 월드컵로',
    style: '토리파이탄',
    tags: ['자가제면', '닭 육수'],
    photo: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=300&h=300&fit=crop&auto=format&q=80',
    visitCount: 1,
    lastVisited: '2026. 07. 29',
    bestMenu: '파이탄 라멘',
  },
]

export interface MyPostItem {
  id: number
  category: string
  title: string
  content: string
  createdAt: string
  likes: number
  comments: number
}

export const MY_POSTS: MyPostItem[] = [
  {
    id: 1,
    category: '맛집후기',
    title: '망원·합정 일대 인생 쇼유 라멘 3곳 추천합니다',
    content: '자가제면과 동물계 육수의 밸런스가 완벽한 곳들만 엄선했습니다. 1위는 역시 멘야준, 2위는 세상끝의라멘, 3위는 묘코입니다.',
    createdAt: '2026. 09. 01',
    likes: 42,
    comments: 3,
  },
  {
    id: 2,
    category: '라멘꿀팁',
    title: '오레노라멘 토리파이탄 면 추가(카에다마) 200% 즐기는 법',
    content: '국물이 1/3 남았을 때 카에다마를 요청하고 후추와 다시마 식초를 두 방울 떨어뜨리면 새로운 감칠맛이 열립니다.',
    createdAt: '2026. 08. 28',
    likes: 28,
    comments: 5,
  },
  {
    id: 3,
    category: '자유게시판',
    title: '오늘 하쿠텐 웨이팅 현황 공유 (평일 점심)',
    content: '11시 20분 도착 기준 대기 4팀 있었습니다. 회전율 빨라서 15분 만에 착석했네요. 이에케 기름 보통 추천!',
    createdAt: '2026. 08. 18',
    likes: 19,
    comments: 2,
  },
]

export interface MyCommentItem {
  id: number
  targetTitle: string
  targetAuthor: string
  comment: string
  createdAt: string
  likes: number
}

export const MY_COMMENTS: MyCommentItem[] = [
  {
    id: 1,
    targetTitle: '세상끝의라멘 처음 가보려는데 첫라멘 끝라멘 추천',
    targetAuthor: '라린이',
    comment: '쇼유 본연의 깊은 풍미를 원하시면 첫 방문엔 무조건 "끝라멘" 추천드립니다! 닭가슴살 차슈가 예술이에요.',
    createdAt: '2026. 09. 01',
    likes: 5,
  },
  {
    id: 2,
    targetTitle: '망원동 혼밥하기 좋은 라멘집 베스트',
    targetAuthor: '멘덕후',
    comment: '멘야준 닷지석이 넓고 조용해서 혼밥 난이도 최하입니다. 사장님도 엄청 친절하세요.',
    createdAt: '2026. 08. 25',
    likes: 3,
  },

  {
    id: 3,
    targetTitle: '이에케 라멘 간 조절 다들 어떻게 드시나요?',
    targetAuthor: '쇼유장인',
    comment: '저는 무조건 [맛 보통 / 기름 보통 / 면 단단하게]로 갑니다. 밥 시켜서 김 싸먹으면 극락!',
    createdAt: '2026. 08. 14',
    likes: 7,
  },
]

export const PRESET_RAMEN_STYLES = [
  '돈코츠 (돼지뼈)',
  '쇼유 (간장)',
  '토리파이탄 (닭백탕)',
  '시오 (소금)',
  '미소 (된장)',
  '츠케멘',
  '마제소바',
  '아부라소바',
]

// ----------------------------------------------------
// 🌟 raota-front 공식 라멘 활동 등급 시스템

// ----------------------------------------------------
export interface RamenActivityLevel {
  min: number
  title: string
  nextTarget: number | null
  desc: string
}

export const RAMEN_ACTIVITY_LEVELS: RamenActivityLevel[] = [
  { min: 0, title: '라멘 입문자', nextTarget: 1, desc: '첫 기록 전' },
  { min: 1, title: '라멘을 즐기는 자', nextTarget: 10, desc: '라멘로그 1개 이상' },
  { min: 10, title: '라멘집 탐험가', nextTarget: 30, desc: '라멘로그 10개 이상' },
  { min: 30, title: '라멘집 단골', nextTarget: 50, desc: '라멘로그 30개 이상' },
  { min: 50, title: '라멘 미식가', nextTarget: 100, desc: '라멘로그 50개 이상' },
  { min: 100, title: '라멘 마스터', nextTarget: null, desc: '라멘로그 100개 이상' },
]

export const getRamenActivityLevel = (logCount: number) => {
  const currentLevel = [...RAMEN_ACTIVITY_LEVELS]
    .reverse()
    .find((level) => logCount >= level.min) || RAMEN_ACTIVITY_LEVELS[0]
  const nextLevel = currentLevel.nextTarget
    ? RAMEN_ACTIVITY_LEVELS.find((level) => level.min === currentLevel.nextTarget)
    : null
  const progress = currentLevel.nextTarget
    ? Math.min(100, ((logCount - currentLevel.min) / (currentLevel.nextTarget - currentLevel.min)) * 100)
    : 100

  return { ...currentLevel, nextLevel, progress: Math.max(0, progress) }
}

export interface SavedShopItem {

  id: number
  name: string
  branch: string
  location: string
  style: string
  photo: string
  tags: string[]
  savedAt: string
}

export const INITIAL_SAVED_SHOPS: SavedShopItem[] = [
  {
    id: 1,
    name: '멘야준',
    branch: '망원 본점',
    location: '서울 마포구 망원동',
    style: '특제 쇼유 라멘',
    photo: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=300&h=300&fit=crop&auto=format&q=80',
    tags: ['쇼유', '자가제면', '오리육수'],
    savedAt: '2026. 09. 01',
  },
  {
    id: 3,
    name: '오레노라멘',
    branch: '마포 본점',
    location: '서울 마포구 상수동',
    style: '토리파이탄 (닭백탕)',
    photo: 'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=300&h=300&fit=crop&auto=format&q=80',
    tags: ['닭백탕', '미쉐린 빕구르망'],
    savedAt: '2026. 08. 29',
  },
  {
    id: 7,
    name: '묘코',
    branch: '연남점',
    location: '서울 마포구 연남동',
    style: '특제 오리 시오 라멘',
    photo: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=300&h=300&fit=crop&auto=format&q=80',
    tags: ['시오', '오리기름', '깔끔함'],
    savedAt: '2026. 08. 20',
  },
  {
    id: 2,
    name: '세상끝의라멘',
    branch: '합정점',
    location: '서울 마포구 합정동',
    style: '블랙 쇼유 라멘',
    photo: 'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=300&h=300&fit=crop&auto=format&q=80',
    tags: ['오사카 블랙', '두툼한 차슈'],
    savedAt: '2026. 08. 15',
  },
]


interface LogEntry {
  shop: string; loc: string; menu: string; date: string; score: number; photo: string; isNew?: boolean; note?: string
}

const OLD_LOGS: LogEntry[] = [
  { shop: '오레노라멘', loc: '마포 본점', menu: '특제 돈코츠 라멘', date: '08.28', score: 5, photo: 'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=200&h=200&fit=crop&auto=format&q=80', note: '진한 거품 육수와 부드러운 차슈' },
  { shop: '묘코', loc: '연남점', menu: '특제 쇼유 라멘', date: '08.22', score: 5, photo: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=200&h=200&fit=crop&auto=format&q=80', note: '오리 육수의 맑고 깊은 감칠맛' },
  { shop: '후쿠 라멘', loc: '합정점', menu: '특제 미소 라멘', date: '08.15', score: 4, photo: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=200&h=200&fit=crop&auto=format&q=80', note: '불향 가득한 볶음 채소와 미소' },
]

type PeriodType = '1y' | '2026' | '2025'

// 기간별 캘린더 데이터 생성
const generateCalendarData = (period: PeriodType, saved: boolean): { data: Activity[]; total: number } => {
  const activities: Activity[] = []
  
  let startDate = new Date('2025-09-01')
  let endDate = new Date('2026-09-01')

  if (period === '2026') {
    startDate = new Date('2026-01-01')
    endDate = new Date('2026-09-01')
  } else if (period === '2025') {
    startDate = new Date('2025-01-01')
    endDate = new Date('2025-12-31')
  }

  // 2026년 데이터베이스
  const active2026: Record<string, { count: number; level: number; shop?: string }> = {
    '2026-09-01': saved ? { count: 1, level: 1, shop: '멘야준' } : { count: 0, level: 0 },
    '2026-08-30': { count: 1, level: 1, shop: '오레노라멘' },
    '2026-08-28': { count: 2, level: 2, shop: '묘코' },
    '2026-08-24': { count: 1, level: 1, shop: '세상끝의라멘' },
    '2026-08-22': { count: 1, level: 1, shop: '멘지' },
    '2026-08-18': { count: 2, level: 2, shop: '후쿠 라멘' },
    '2026-08-15': { count: 1, level: 1, shop: '하쿠텐' },
    '2026-08-10': { count: 3, level: 3, shop: '무타히로' },
    '2026-08-05': { count: 1, level: 1, shop: '담택' },
    '2026-07-31': { count: 1, level: 1, shop: '이리에라멘' },
    '2026-07-27': { count: 2, level: 2, shop: '멘야준' },
    '2026-07-20': { count: 1, level: 1, shop: '오레노라멘' },
    '2026-07-14': { count: 1, level: 1, shop: '토리파이탄' },
    '2026-07-08': { count: 2, level: 2, shop: '후쿠 라멘' },
    '2026-07-02': { count: 1, level: 1, shop: '세상끝의라멘' },
    '2026-06-25': { count: 1, level: 1, shop: '하쿠텐' },
    '2026-06-19': { count: 2, level: 2, shop: '멘야준' },
    '2026-06-12': { count: 1, level: 1, shop: '오레노라멘' },
    '2026-06-05': { count: 1, level: 1, shop: '담택' },
    '2026-05-28': { count: 2, level: 2, shop: '묘코' },
    '2026-05-20': { count: 1, level: 1, shop: '이리에라멘' },
    '2026-05-15': { count: 1, level: 1, shop: '멘지' },
    '2026-05-08': { count: 1, level: 1, shop: '후쿠 라멘' },
    '2026-05-02': { count: 2, level: 2, shop: '멘야준' },
    '2026-04-25': { count: 1, level: 1, shop: '담택' },
    '2026-04-18': { count: 2, level: 2, shop: '오레노라멘' },
    '2026-03-22': { count: 1, level: 1, shop: '세상끝의라멘' },
    '2026-03-14': { count: 1, level: 1, shop: '멘야준' },
    '2026-02-28': { count: 2, level: 2, shop: '후쿠 라멘' },
    '2026-02-14': { count: 1, level: 1, shop: '하쿠텐' },
    '2026-01-20': { count: 1, level: 1, shop: '오레노라멘' },
    '2026-01-05': { count: 2, level: 2, shop: '멘야준' },
  }

  // 2025년 데이터베이스
  const active2025: Record<string, { count: number; level: number; shop?: string }> = {
    '2025-12-28': { count: 2, level: 2, shop: '멘야준' },
    '2025-12-20': { count: 1, level: 1, shop: '오레노라멘' },
    '2025-12-14': { count: 2, level: 2, shop: '후쿠 라멘' },
    '2025-11-25': { count: 1, level: 1, shop: '세상끝의라멘' },
    '2025-11-18': { count: 3, level: 3, shop: '하쿠텐' },
    '2025-11-10': { count: 1, level: 1, shop: '담택' },
    '2025-10-30': { count: 2, level: 2, shop: '멘지' },
    '2025-10-22': { count: 1, level: 1, shop: '이리에라멘' },
    '2025-10-15': { count: 2, level: 2, shop: '멘야준' },
    '2025-09-28': { count: 1, level: 1, shop: '오레노라멘' },
    '2025-09-20': { count: 2, level: 2, shop: '묘코' },
    '2025-09-12': { count: 1, level: 1, shop: '후쿠 라멘' },
    '2025-08-25': { count: 2, level: 2, shop: '세상끝의라멘' },
    '2025-08-14': { count: 1, level: 1, shop: '멘야준' },
    '2025-07-30': { count: 2, level: 2, shop: '담택' },
    '2025-07-15': { count: 1, level: 1, shop: '하쿠텐' },
    '2025-06-20': { count: 2, level: 2, shop: '오레노라멘' },
    '2025-05-18': { count: 1, level: 1, shop: '멘지' },
    '2025-04-22': { count: 2, level: 2, shop: '후쿠 라멘' },
    '2025-03-30': { count: 1, level: 1, shop: '멘야준' },
    '2025-02-14': { count: 2, level: 2, shop: '묘코' },
    '2025-01-20': { count: 1, level: 1, shop: '세상끝의라멘' },
  }

  const allActive = { ...active2025, ...active2026 }
  let totalCount = 0

  const cur = new Date(startDate)
  while (cur <= endDate) {
    const dateStr = cur.toISOString().split('T')[0]
    const active = allActive[dateStr]
    const count = active?.count || 0
    totalCount += count
    activities.push({
      date: dateStr,
      count,
      level: active?.level || 0,
    })
    cur.setDate(cur.getDate() + 1)
  }

  return { data: activities, total: totalCount }
}

const RAOTA_THEME = {
  light: ['#F2F2F2', '#FFD6D6', '#FFA8A8', '#FF5C5C', '#E60000'],
  dark: ['#F2F2F2', '#FFD6D6', '#FFA8A8', '#FF5C5C', '#E60000'],
}

export default function MyScreen({
  user,
  recordSaved,
  unreadNotificationsCount,
  onNotificationClick,
  onShopClick,
  onViewTaste,
  onLoginClick,
  onRegisterClick,
  onLogout,
  onUpdateUser,
  onLoungeClick,
}: Props) {


  const [activityTab, setActivityTab] = useState<ActivityTab>('logs')
  const [visitedShopSort, setVisitedShopSort] = useState<'count' | 'recent' | 'name'>('count')
  const [visitedShopQuery, setVisitedShopQuery] = useState('')
  const [savedShops, setSavedShops] = useState<SavedShopItem[]>(INITIAL_SAVED_SHOPS)
  const [savedShopQuery, setSavedShopQuery] = useState('')
  const [period, setPeriod] = useState<PeriodType>('1y')

  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false)
  const [isGradeGuideOpen, setIsGradeGuideOpen] = useState(false)
  const [isStyleModalOpen, setIsStyleModalOpen] = useState(false)
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
  const [newEmail, setNewEmail] = useState(user?.email || 'bbung@raota.net')
  const [isEmailUpdating, setIsEmailUpdating] = useState(false)
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)

  const [selectedStyle, setSelectedStyle] = useState<string>(user?.favoriteRamenType || '돈코츠')
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [showRightFade, setShowRightFade] = useState(true)
  const [showLeftFade, setShowLeftFade] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const periodDropdownRef = useRef<HTMLDivElement>(null)
  const tabScrollRef = useRef<HTMLDivElement>(null)

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
    return () => window.removeEventListener('resize', updateFadeEdges)
  }, [])

  const handleTabClick = (tab: ActivityTab, e: React.MouseEvent<HTMLButtonElement>) => {
    setActivityTab(tab)
    e.currentTarget.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    })
    setTimeout(updateFadeEdges, 350)
  }

  const getMaskStyle = (): React.CSSProperties | undefined => {
    if (showLeftFade && showRightFade) {
      return {
        maskImage: 'linear-gradient(to right, transparent 0%, black 20px, black calc(100% - 28px), transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 20px, black calc(100% - 28px), transparent 100%)',
      }
    }
    if (showRightFade) {
      return {
        maskImage: 'linear-gradient(to right, black calc(100% - 28px), transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 28px), transparent 100%)',
      }
    }
    if (showLeftFade) {
      return {
        maskImage: 'linear-gradient(to right, transparent 0%, black 20px, black 100%)',
        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 20px, black 100%)',
      }
    }
    return undefined
  }




  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 2500)
  }


  const handleSaveStyle = (style: string) => {
    setSelectedStyle(style)
    const pureStyle = style.split(' ')[0]
    if (onUpdateUser) {
      onUpdateUser({ favoriteRamenType: pureStyle })
    }
    setIsStyleModalOpen(false)
    showToast(`선호 스타일이 '${pureStyle}'(으)로 변경되었습니다.`)
  }

  const handleSaveEmail = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newEmail.trim()
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      showToast('올바른 이메일 주소를 입력해주세요.')
      return
    }

    setIsEmailUpdating(true)
    setTimeout(() => {
      setIsEmailUpdating(false)
      if (onUpdateUser) {
        onUpdateUser({ email: trimmed })
      }
      setIsEmailModalOpen(false)
      showToast('이메일 주소가 성공적으로 변경되었습니다.')
    }, 600)
  }

  const handleWithdraw = () => {
    setIsWithdrawing(true)
    setTimeout(() => {
      setIsWithdrawing(false)
      setIsWithdrawModalOpen(false)
      showToast('회원 탈퇴가 완료되었습니다.')
      if (onLogout) {
        onLogout()
      }
    }, 800)
  }




  const isLoggedIn = user?.isLoggedIn ?? true
  const totalLogCount = user ? (user.visitedCount + (recordSaved ? 1 : 0)) : (recordSaved ? 43 : 42)
  const { data: calendarData, total: totalBowls } = generateCalendarData(period, recordSaved)

  // raota-front 공식 등급 계산
  const ramenActivityLevel = useMemo(() => getRamenActivityLevel(totalLogCount), [totalLogCount])

  // 기간 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (periodDropdownRef.current && !periodDropdownRef.current.contains(event.target as Node)) {
        setIsPeriodDropdownOpen(false)
      }
    }
    if (isPeriodDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isPeriodDropdownOpen])

  // 탭 변경 및 마운트 시 자동으로 가장 최근 일자(맨 오른쪽 끝)로 완벽히 스크롤
  useEffect(() => {
    const scrollToRight = () => {
      if (scrollRef.current) {
        scrollRef.current.scrollLeft = scrollRef.current.scrollWidth + 2000
      }
    }

    scrollToRight()
    const rafId = requestAnimationFrame(scrollToRight)
    const t1 = setTimeout(scrollToRight, 50)
    const t2 = setTimeout(scrollToRight, 150)

    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [period, calendarData])


  const filteredVisitedShops = useMemo(() => {
    let list = [...MY_VISITED_SHOPS]
    if (visitedShopQuery.trim()) {
      const q = visitedShopQuery.trim().toLowerCase()
      list = list.filter(
        s =>
          s.name.toLowerCase().includes(q) ||
          s.branch.toLowerCase().includes(q) ||
          s.location.toLowerCase().includes(q) ||
          s.style.toLowerCase().includes(q) ||
          s.tags.some(t => t.toLowerCase().includes(q))
      )
    }
    if (visitedShopSort === 'count') {
      list.sort((a, b) => b.visitCount - a.visitCount)
    } else if (visitedShopSort === 'recent') {
      list.sort((a, b) => b.lastVisited.localeCompare(a.lastVisited))
    } else if (visitedShopSort === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    }
    return list
  }, [visitedShopQuery, visitedShopSort])

  const filteredSavedShops = useMemo(() => {
    let list = [...savedShops]
    if (savedShopQuery.trim()) {
      const q = savedShopQuery.trim().toLowerCase()
      list = list.filter(
        s =>
          s.name.toLowerCase().includes(q) ||
          s.branch.toLowerCase().includes(q) ||
          s.location.toLowerCase().includes(q) ||
          s.style.toLowerCase().includes(q) ||
          s.tags.some(t => t.toLowerCase().includes(q))
      )
    }
    return list
  }, [savedShops, savedShopQuery])

  const logs = recordSaved
    ? [{ shop: '멘야준', loc: '망원 본점', menu: '특제 쇼유 라멘', date: '09.01', score: 5, photo: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=200&h=200&fit=crop&auto=format&q=80', isNew: true, note: '첫 모금부터 감칠맛 폭발' }, ...OLD_LOGS]
    : OLD_LOGS



  return (
    <div className="relative w-full h-full overflow-hidden bg-[#FFFFFF] text-[#25282B]">
      {/* 📄 페이지 본문 스크롤 영역 */}
      <div className="w-full h-full overflow-y-auto no-scrollbar">
        {/* 1. 상단 라멘 클럽 회원증 카드 (보더폰 딥 잉크 히어로 밴드) */}
        <header className="bg-[#25282B] text-white pt-5 pb-6 px-5 border-b border-[#1A1C1E]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-[6px] bg-white p-1 border border-white/20 flex items-center justify-center overflow-hidden">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.nickname} className="w-full h-full object-cover" />
              ) : (
                <img src="/logo.png" alt="RAOTA Logo" className="w-10 h-10 object-contain" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[20px] font-black tracking-tight">
                  {user?.nickname || '뿡'}
                </h1>
                <span className="text-[10px] font-black bg-[#E60000] text-white px-2 py-0.5 rounded-[32px] uppercase">
                  {user?.level || ramenActivityLevel.title}
                </span>
              </div>
              <p className="text-[11px] text-white/70 mt-0.5">
                {isLoggedIn ? 'RAOTA 라멘클럽 회원' : '게스트 모드 (비로그인)'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {onNotificationClick && (
              <button
                type="button"
                onClick={onNotificationClick}
                className="relative p-1 text-white/80 hover:text-white transition-all active:scale-90 flex items-center justify-center cursor-pointer"
                aria-label="알림센터 열기"
                title="알림센터"
              >
                <Bell className="w-4.5 h-4.5" />
                {unreadNotificationsCount !== undefined && unreadNotificationsCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-[#E60000] rounded-full ring-2 ring-[#25282B]" />
                )}
              </button>
            )}
            <div className="text-right">

              <span className="text-[9px] text-white/50 block font-mono">MEMBERSHIP</span>
              <span className="text-[14px] font-black text-[#E60000]">
                {user?.membershipNo || '#RT-0842'}
              </span>
            </div>
          </div>
        </div>


        {/* 완식 통계 스펙 바 */}
        <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-white/10 text-center">
          <div className="bg-white/5 py-2 rounded-[4px]">
            <span className="text-[9px] text-white/60 block">총 라멘로그</span>
            <span className="text-[14px] font-black text-white">{totalLogCount}그릇</span>
          </div>
          <div className="bg-white/5 py-2 rounded-[4px]">
            <span className="text-[9px] text-white/60 block">정복 라멘집</span>
            <span className="text-[14px] font-black text-[#E60000]">
              {user ? Math.max(1, Math.floor(totalLogCount * 0.7)) : 28}곳
            </span>
          </div>

          <div
            onClick={onViewTaste}
            className="bg-white/5 py-2 rounded-[4px] cursor-pointer hover:bg-white/10 active:scale-95 transition-all group"
            title="취향 리포트 열람"
          >
            <span className="text-[9px] text-white/60 block group-hover:text-white/80">취향 리포트 완성도</span>
            <span className="text-[14px] font-black text-white group-hover:text-[#E60000] transition-colors">
              {user ? Math.min(100, totalLogCount * 5 + 30) : 94}%
            </span>
          </div>
        </div>
      </header>


      {/* 2. 본문 컨텐츠 */}
      <main className="p-5 space-y-4">
        
        {/* 🏆 라멘 활동 등급 & 등급 안내 카드 (raota-front 공식) */}
        <div className="bg-white rounded-[6px] border border-stone-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-[#E60000] uppercase tracking-wider">라멘 활동 등급</p>
              <h2 className="text-[16px] font-black text-[#25282B] mt-0.5 flex items-center gap-1.5">
                <span>{ramenActivityLevel.title}</span>
                <span className="text-[10px] font-bold text-stone-400">
                  (Lv.{RAMEN_ACTIVITY_LEVELS.findIndex(l => l.title === ramenActivityLevel.title) + 1})
                </span>
              </h2>
            </div>

            {/* 등급 안내 모달 버튼 */}
            <button
              onClick={() => setIsGradeGuideOpen(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-stone-200 bg-stone-50 hover:bg-white hover:border-[#E60000] px-2.5 text-[11px] font-black text-[#25282B] hover:text-[#E60000] transition-colors active:scale-95"
            >
              <Award className="w-3.5 h-3.5 text-[#E60000]" />
              <span>등급 안내</span>
            </button>

          </div>

          {/* 다음 등급 진행도 바 */}
          {ramenActivityLevel.nextLevel ? (
            <div className="space-y-1.5 pt-2 border-t border-stone-100">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-stone-500 font-medium">
                  다음 등급: <strong className="text-[#25282B] font-bold">{ramenActivityLevel.nextLevel.title}</strong>
                </span>
                <span className="text-[#E60000] font-black">
                  {totalLogCount} / {ramenActivityLevel.nextLevel.min}그릇 ({Math.round(ramenActivityLevel.progress)}%)
                </span>
              </div>
              <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#E60000] rounded-full transition-all duration-500"
                  style={{ width: `${ramenActivityLevel.progress}%` }}
                />
              </div>
              <p className="text-[10px] text-stone-400 text-right">
                {ramenActivityLevel.nextLevel.title}까지 {ramenActivityLevel.nextLevel.min - totalLogCount}그릇 남았습니다.
              </p>
            </div>
          ) : (
            <div className="pt-2 border-t border-stone-100 text-[11px] text-stone-500 font-bold">
              ✨ 최고 등급인 라멘 마스터에 도달하셨습니다!
            </div>
          )}
        </div>

        {/* 취향 리포트 분석서 바로가기 카드 (총 누적 취향 종합 리포트) */}
        <div
          onClick={onViewTaste}
          className="bg-white rounded-[6px] border border-[#E2E2E2] p-4 cursor-pointer hover:border-[#BEBEBE] active:scale-99 transition-all group shadow-2xs"
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E2E2E2]">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-[#E60000] tracking-wider">
                라멘 취향 리포트
              </span>
              <span className="text-[9px] font-bold bg-[#E60000]/10 text-[#E60000] px-1.5 py-0.2 rounded-sm">
                누적 종합
              </span>
            </div>
            <span className="text-[11px] font-bold text-[#25282B] group-hover:text-[#E60000] group-hover:translate-x-1 transition-all">
              취향 분석 열람 →
            </span>
          </div>
          
          <h2 className="text-[20px] font-black text-[#25282B] tracking-tight">
            진한 돈골파
          </h2>
          <p className="text-[12px] text-[#7E7E7E] mt-1 leading-snug">
            완식한 모든 라멘로그를 분석한 올타임 미각 DNA입니다. (매월 1일 월간호 자동 보관)
          </p>
        </div>

        {/* 🌟 마이 아카이브 5단 서브 탭 (라멘로그 / 방문매장 / 가고싶어요 / 작성글 / 댓글) */}
        <div
          ref={tabScrollRef}
          onScroll={updateFadeEdges}
          style={getMaskStyle()}
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 px-0.5 scroll-smooth transition-all duration-200"
        >
          <button
            type="button"
            onClick={e => handleTabClick('logs', e)}
            className={`whitespace-nowrap flex items-center gap-1.5 px-3.5 py-2 rounded-[32px] text-[11.5px] font-bold shrink-0 transition-all cursor-pointer active:scale-95 ${
              activityTab === 'logs'
                ? 'bg-[#25282B] text-white shadow-xs'
                : 'bg-white border border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50'
            }`}
          >
            <RamenIcon className="w-3.5 h-3.5 shrink-0" />
            <span>라멘로그</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activityTab === 'logs' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-500'
            }`}>
              {totalLogCount}
            </span>
          </button>



          <button
            type="button"
            onClick={e => handleTabClick('visits', e)}
            className={`whitespace-nowrap flex items-center gap-1.5 px-3.5 py-2 rounded-[32px] text-[11.5px] font-bold shrink-0 transition-all cursor-pointer active:scale-95 ${
              activityTab === 'visits'
                ? 'bg-[#25282B] text-white shadow-xs'
                : 'bg-white border border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span>방문매장</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activityTab === 'visits' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-500'
            }`}>
              {MY_VISITED_SHOPS.length}
            </span>
          </button>

          <button
            type="button"
            onClick={e => handleTabClick('saved', e)}
            className={`whitespace-nowrap flex items-center gap-1.5 px-3.5 py-2 rounded-[32px] text-[11.5px] font-bold shrink-0 transition-all cursor-pointer active:scale-95 ${
              activityTab === 'saved'
                ? 'bg-[#25282B] text-white shadow-xs'
                : 'bg-white border border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5 shrink-0" />
            <span>가고싶어요</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activityTab === 'saved' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-500'
            }`}>
              {savedShops.length}
            </span>
          </button>

          <button
            type="button"
            onClick={e => handleTabClick('posts', e)}
            className={`whitespace-nowrap flex items-center gap-1.5 px-3.5 py-2 rounded-[32px] text-[11.5px] font-bold shrink-0 transition-all cursor-pointer active:scale-95 ${
              activityTab === 'posts'
                ? 'bg-[#25282B] text-white shadow-xs'
                : 'bg-white border border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50'
            }`}
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span>작성글</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activityTab === 'posts' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-500'
            }`}>
              {MY_POSTS.length}
            </span>
          </button>

          <button
            type="button"
            onClick={e => handleTabClick('comments', e)}
            className={`whitespace-nowrap flex items-center gap-1.5 px-3.5 py-2 rounded-[32px] text-[11.5px] font-bold shrink-0 transition-all cursor-pointer active:scale-95 ${
              activityTab === 'comments'
                ? 'bg-[#25282B] text-white shadow-xs'
                : 'bg-white border border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            <span>댓글</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activityTab === 'comments' ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-500'
            }`}>
              {MY_COMMENTS.length}
            </span>
          </button>
        </div>








        {/* 탭 1. 🍜 라멘로그 탭 (캘린더 + 최근 마이 라멘로그 + 가고 싶어요 매장) */}
        {activityTab === 'logs' && (
          <div className="space-y-4 anim-fade-in">
            {/* 🌿 라멘 완식 캘린더 (ActivityCalendar 라이브러리 연동) */}
            <div className="bg-white rounded-[6px] border border-[#E2E2E2] p-4 overflow-hidden">
              {/* 헤더 & 기간 선택 드롭다운 & 통계 뱃지 */}
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E2E2E2]">
                <div className="flex items-center gap-1.5">
                  <RamenIcon className="w-4 h-4 text-[#E60000]" />
                  <h2 className="text-[13px] font-black tracking-tight text-[#25282B]">
                    라멘로그 캘린더
                  </h2>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* 커스텀 기간 선택 드롭다운 */}
                  <div className="relative" ref={periodDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsPeriodDropdownOpen(prev => !prev)}
                      className="flex h-6.5 items-center gap-1.5 rounded-[4px] border border-stone-200 bg-[#F2F2F2] hover:bg-[#EAEAEA] hover:border-[#E60000] px-2.5 text-[11px] font-bold text-[#25282B] transition-colors"
                    >
                      <span>{period === '1y' ? '최근 1년' : `${period}년`}</span>
                      <ChevronDown
                        className={`w-3 h-3 text-stone-400 shrink-0 transition-transform duration-200 ${
                          isPeriodDropdownOpen ? 'rotate-180 text-[#E60000]' : ''
                        }`}
                      />
                    </button>


                    {isPeriodDropdownOpen && (
                      <div className="absolute right-0 top-full mt-1.5 z-40 w-28 rounded-sm border border-stone-300 bg-white shadow-lg overflow-hidden anim-fade-in-up">
                        <div className="py-1 divide-y divide-stone-50">
                          {[
                            { label: '최근 1년', val: '1y' },
                            { label: '2026년', val: '2026' },
                            { label: '2025년', val: '2025' },
                          ].map(opt => (
                            <button
                              key={opt.val}
                              type="button"
                              onClick={() => {
                                setPeriod(opt.val as PeriodType)
                                setIsPeriodDropdownOpen(false)
                              }}
                              className={`w-full px-3 py-1.5 text-left text-[11px] hover:bg-stone-50 transition-colors ${
                                period === opt.val ? 'font-bold text-[#E60000] bg-red-50' : 'text-[#25282B]'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 완식 그릇 수 뱃지 */}
                  <span className="text-[10px] font-bold text-[#E60000] bg-[#E60000]/10 px-2 py-0.5 rounded-[32px]">
                    {totalBowls}그릇
                  </span>
                </div>
              </div>

              {/* 가로 스크롤 잔디 영역 */}
              <div ref={scrollRef} className="overflow-x-auto custom-scrollbar pb-2 mb-3">
                <div className="min-w-max">
                  <ActivityCalendar
                    data={calendarData}
                    theme={RAOTA_THEME}
                    blockSize={12}
                    blockMargin={3}
                    blockRadius={2}
                    fontSize={10}
                    showWeekdayLabels
                    showColorLegend={false}
                    showTotalCount={false}
                    tooltips={{
                      activity: {
                        text: activity =>
                          activity.count > 0
                            ? `${activity.date}: ${activity.count}그릇 기록 ✓`
                            : `${activity.date}: 라멘로그 없음`,
                      },
                    }}
                    labels={{
                      months: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
                      weekdays: ['일', '월', '화', '수', '목', '금', '토'],
                    }}
                  />
                </div>
              </div>

              {/* 하단 범례 바 */}
              <div className="pt-2.5 border-t border-[#E2E2E2] flex items-center justify-between text-[10px] text-[#7E7E7E]">
                <div className="flex items-center gap-1 min-w-0 truncate mr-2 text-[#7E7E7E]">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="truncate">라멘로그를 작성하면 캘린더가 채워집니다.</span>
                </div>



                <div className="flex items-center gap-1 flex-shrink-0">
                  <span>적음</span>
                  <div className="flex gap-0.5">
                    {RAOTA_THEME.light.map((color, i) => (
                      <span
                        key={i}
                        className="w-2.5 h-2.5 rounded-[2px]"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <span>많음</span>
                </div>
              </div>

              {/* 스트릭 뱃지 바 */}
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-dashed border-[#E2E2E2] text-center">
                <div className="bg-[#F2F2F2] p-2 rounded-[4px]">
                  <span className="text-[9px] text-[#7E7E7E] block">최장 연속 기록</span>
                  <span className="text-[13px] font-black text-[#25282B]">4일 연속</span>
                </div>
                <div className="bg-[#F2F2F2] p-2 rounded-[4px]">
                  <span className="text-[9px] text-[#7E7E7E] block">이번 달 기록</span>
                  <span className="text-[13px] font-black text-[#E60000]">6그릇</span>
                </div>
              </div>
            </div>

            {/* 최근 마이 라멘로그 */}
            <div className="bg-white rounded-[6px] border border-[#E2E2E2] p-4">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E2E2E2]">
                <span className="text-[12px] font-black tracking-wider text-[#25282B]">
                  최근 마이 라멘로그
                </span>
                <span className="text-[11px] font-bold text-[#7E7E7E]">최근 기록</span>
              </div>

              <div className="divide-y divide-[#E2E2E2]">
                {logs.map((log, i) => (
                  <div key={i} className="py-3 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-[6px] overflow-hidden bg-[#F2F2F2] flex-shrink-0 border border-[#E2E2E2]">
                      <img src={log.photo} alt={log.menu} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[13px] font-black text-[#25282B] truncate">{log.shop} · {log.loc}</p>
                        {log.isNew && <span className="text-[9px] font-bold text-[#E60000] bg-[#E60000]/10 px-1.5 py-0.5 rounded-[32px]">신규</span>}
                      </div>
                      <p className="text-[11px] text-[#7E7E7E] mt-0.5 truncate">{log.menu}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-[11px] font-bold text-[#7E7E7E] block">{log.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}



        {/* 탭 2. 📍 방문매장 탭 (raota-front 스펙 매장 리스트 & 방문 횟수) */}
        {activityTab === 'visits' && (
          <div className="space-y-3 anim-fade-in">
            <div className="bg-white rounded-[6px] border border-[#E2E2E2] p-4">
              {/* 상단 헤더 & 검색/정렬 */}
              <div className="flex flex-col gap-2.5 pb-3 border-b border-[#E2E2E2]">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[12px] font-black tracking-wider text-[#25282B] block">
                      라멘로그 정복 라멘집 ({filteredVisitedShops.length}곳)
                    </span>
                    <span className="text-[10px] text-[#7E7E7E]">라멘로그를 남긴 매장 아카이브</span>
                  </div>

                  {/* 정렬 드롭다운/버튼 */}
                  <div className="flex items-center gap-1 bg-[#F2F2F2] p-0.5 rounded-[4px] border border-[#E2E2E2] text-[10px]">
                    {[
                      { key: 'count', label: '방문순' },
                      { key: 'recent', label: '최신순' },
                      { key: 'name', label: '이름순' },
                    ].map(s => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setVisitedShopSort(s.key as any)}
                        className={`px-2 py-1 rounded-[3px] font-bold transition-all ${
                          visitedShopSort === s.key ? 'bg-[#25282B] text-white' : 'text-stone-500 hover:text-[#25282B]'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 매장 검색 인풋 */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 w-3.5 h-3.5" />
                  <input
                    type="text"
                    value={visitedShopQuery}
                    onChange={e => setVisitedShopQuery(e.target.value)}
                    placeholder="방문한 라멘집 검색 (이름, 지점, 지역...)"
                    className="w-full h-8 pl-8 pr-3 bg-stone-50 border border-stone-200 rounded-[4px] text-[11.5px] text-[#25282B] placeholder:text-stone-400 focus:outline-none focus:border-[#E60000] transition-colors"
                  />
                  {visitedShopQuery && (
                    <button
                      type="button"
                      onClick={() => setVisitedShopQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-[#25282B] text-xs p-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* 방문 매장 카드 목록 */}
              <div className="divide-y divide-stone-100 pt-1">
                {filteredVisitedShops.length === 0 ? (
                  <div className="py-12 text-center text-stone-400 space-y-1">
                    <p className="text-[13px] font-bold">검색된 방문 라멘집이 없습니다.</p>
                    <p className="text-[11px]">새로운 라멘집에서 라멘로그를 남겨보세요!</p>
                  </div>
                ) : (
                  filteredVisitedShops.map(shop => (
                    <div
                      key={shop.id}
                      onClick={() => onShopClick && onShopClick(shop.id)}
                      className="py-3 flex items-center justify-between gap-3 group cursor-pointer hover:bg-stone-50/70 -mx-2 px-2 rounded-[4px] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-13 h-13 rounded-[6px] overflow-hidden bg-[#F2F2F2] shrink-0 border border-[#E2E2E2] group-hover:border-[#E60000] transition-colors">
                          <img src={shop.photo} alt={shop.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-[13px] font-black text-[#25282B] group-hover:text-[#E60000] transition-colors truncate">
                              {shop.name} {shop.branch && `· ${shop.branch}`}
                            </h4>
                            {shop.isRegular && (
                              <span className="text-[9px] font-black text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.2 rounded-sm shrink-0 flex items-center gap-0.5">
                                단골 <Trophy className="w-2.5 h-2.5 text-amber-600" />
                              </span>
                            )}

                          </div>
                          <p className="text-[11px] text-stone-400 mt-0.5 truncate flex items-center gap-1">
                            <MapPin className="w-3 h-3 shrink-0" /> {shop.location}
                          </p>
                          <p className="text-[10.5px] text-[#E60000] font-bold mt-0.5 truncate">
                            대표: {shop.bestMenu}
                          </p>
                        </div>
                      </div>

                      {/* 우측: 방문 횟수 & 최근 방문일 */}
                      <div className="text-right shrink-0">
                        <span className="text-[12px] font-black text-[#E60000] block">
                          {shop.visitCount}회 기록 ✓
                        </span>
                        <span className="text-[10px] font-mono text-stone-400 block mt-0.5">
                          {shop.lastVisited}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* 탭 3. 🔖 가고싶어요 저장 매장 탭 */}
        {activityTab === 'saved' && (
          <div className="space-y-3 anim-fade-in">
            <div className="bg-white rounded-[6px] border border-[#E2E2E2] p-4">
              {/* 상단 헤더 & 검색 바 */}
              <div className="flex flex-col gap-2.5 pb-3 border-b border-[#E2E2E2]">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[12px] font-black tracking-wider text-[#25282B] block">
                      가고 싶어요 저장 매장 ({filteredSavedShops.length}곳)
                    </span>
                    <span className="text-[10px] text-[#7E7E7E]">관심 있는 라멘집을 저장해두고 언제든 찾아보세요</span>
                  </div>
                </div>

                {/* 검색창 */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={savedShopQuery}
                    onChange={e => setSavedShopQuery(e.target.value)}
                    placeholder="저장한 매장명, 지역, 스타일 검색..."
                    className="w-full h-8.5 pl-8.5 pr-3 bg-stone-50 border border-stone-200 rounded-[4px] text-[11.5px] font-medium text-[#25282B] placeholder:text-stone-400 focus:outline-none focus:border-[#E60000] focus:bg-white transition-all"
                  />
                  {savedShopQuery && (
                    <button
                      type="button"
                      onClick={() => setSavedShopQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-stone-400 hover:text-stone-600 bg-stone-200 rounded-full w-4 h-4 flex items-center justify-center"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* 매장 목록 리스트 */}
              <div className="divide-y divide-stone-100">
                {filteredSavedShops.length === 0 ? (
                  <div className="py-12 text-center text-stone-400 space-y-2">
                    <Bookmark className="w-8 h-8 text-stone-300 mx-auto stroke-1" />
                    <p className="text-[12px] font-bold text-stone-500">
                      {savedShopQuery ? '검색된 저장 매장이 없습니다.' : '아직 저장된 라멘집이 없습니다.'}
                    </p>
                    <p className="text-[10.5px] text-stone-400">
                      지도나 홈에서 가고 싶은 라멘집을 저장해보세요.
                    </p>
                  </div>

                ) : (
                  filteredSavedShops.map(shop => (
                    <div
                      key={shop.id}
                      className="py-3.5 first:pt-2 last:pb-1 flex items-center justify-between gap-3 group"
                    >
                      {/* 좌측: 썸네일 + 매장 정보 */}
                      <div
                        onClick={() => onShopClick && onShopClick(shop.id)}
                        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                      >
                        <div className="w-13 h-13 rounded-[6px] overflow-hidden bg-stone-100 border border-stone-200 shrink-0">
                          <img
                            src={shop.photo}
                            alt={shop.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-[13.5px] font-black text-[#25282B] group-hover:text-[#E60000] transition-colors truncate">
                              {shop.name}
                            </h3>
                            <span className="text-[10.5px] text-stone-400 font-bold shrink-0">
                              {shop.branch}
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-500 truncate mt-0.5">
                            {shop.location} · {shop.style}
                          </p>
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            {shop.tags.map((tag, idx) => (
                              <span
                                key={idx}
                                className="text-[9px] font-bold text-stone-600 bg-stone-100 px-1.5 py-0.2 rounded-[2px]"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* 우측: 북마크 삭제 / 상세 이동 액션 */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setSavedShops(prev => prev.filter(s => s.id !== shop.id))
                            showToast(`'${shop.name}' 저장이 해제되었습니다.`)
                          }}
                          className="p-1.5 rounded-full text-[#E60000] hover:bg-red-50 transition-colors cursor-pointer"
                          title="저장 해제"
                          aria-label="저장 해제"
                        >
                          <Bookmark className="w-4 h-4 fill-[#E60000]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onShopClick && onShopClick(shop.id)}
                          className="text-[10.5px] font-bold text-stone-600 hover:text-[#E60000] px-2 py-0.5 rounded-[4px] bg-stone-100 hover:bg-stone-200 transition-colors cursor-pointer"
                        >
                          상세보기 →
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* 탭 4. ✍️ 작성글 탭 */}
        {activityTab === 'posts' && (
          <div className="space-y-3 anim-fade-in">
            <div className="bg-white rounded-[6px] border border-[#E2E2E2] p-4">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E2E2E2]">
                <span className="text-[12px] font-black tracking-wider text-[#25282B]">
                  내가 작성한 커뮤니티 글 ({MY_POSTS.length})
                </span>
                <span className="text-[10px] font-bold text-[#7E7E7E]">최신순</span>
              </div>


              <div className="divide-y divide-stone-100">
                {MY_POSTS.map(post => (
                  <div
                    key={post.id}
                    onClick={() => onLoungeClick && onLoungeClick()}
                    className="py-3.5 first:pt-1 last:pb-1 group cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[9px] font-bold bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded-[3px]">
                        {post.category}
                      </span>
                      <span className="text-[10px] text-stone-400">{post.createdAt}</span>
                    </div>
                    <h3 className="text-[13px] font-black text-[#25282B] group-hover:text-[#E60000] transition-colors leading-snug">
                      {post.title}
                    </h3>
                    <p className="text-[11.5px] text-stone-500 line-clamp-2 mt-1 leading-relaxed">
                      {post.content}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-[10.5px] text-stone-400 font-bold">
                      <span className="flex items-center gap-1 text-[#E60000]">
                        <Heart className="w-3 h-3 fill-[#E60000] text-[#E60000]" /> {post.likes}
                      </span>
                      <span className="flex items-center gap-1 text-stone-500">
                        <MessageSquare className="w-3 h-3 text-stone-400" /> {post.comments}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 탭 4. 💬 댓글 탭 */}
        {activityTab === 'comments' && (
          <div className="space-y-3 anim-fade-in">
            <div className="bg-white rounded-[6px] border border-[#E2E2E2] p-4">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E2E2E2]">
                <span className="text-[12px] font-black tracking-wider text-[#25282B]">
                  내가 남긴 댓글 ({MY_COMMENTS.length})
                </span>
                <span className="text-[10px] font-bold text-[#7E7E7E]">최신순</span>
              </div>

              <div className="divide-y divide-stone-100">
                {MY_COMMENTS.map(c => (
                  <div
                    key={c.id}
                    onClick={() => onLoungeClick && onLoungeClick()}
                    className="py-3.5 first:pt-1 last:pb-1 group cursor-pointer"
                  >
                    <div className="p-2.5 rounded-[4px] bg-stone-50 border border-stone-100 mb-1.5">
                      <p className="text-[10px] text-stone-400 font-bold truncate">
                        원문: <span className="text-[#25282B]">{c.targetTitle}</span> ({c.targetAuthor})
                      </p>
                    </div>
                    <p className="text-[12px] font-medium text-[#25282B] leading-snug">
                      "{c.comment}"
                    </p>
                    <div className="flex items-center justify-between mt-2 text-[10.5px] text-stone-400">
                      <span className="font-bold">{c.createdAt}</span>
                      <span className="flex items-center gap-1 font-bold text-[#E60000]">
                        <Heart className="w-3 h-3 fill-[#E60000] text-[#E60000]" /> {c.likes}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>
        )}



        {/* ⚙️ 계정 및 회원 관리 카드 */}
        <div className="bg-white rounded-[6px] border border-[#E2E2E2] p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#E2E2E2]">
            <span className="text-[12px] font-black tracking-wider text-[#25282B]">
              계정 설정 & 멤버십
            </span>
            <span className="text-[10px] font-mono text-stone-400">
              v1.0.0
            </span>
          </div>

          {isLoggedIn ? (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-[12px] py-1.5">
                <span className="text-stone-500 font-medium">연동 계정</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#25282B] truncate max-w-[150px]">{user?.email || 'bbung@raota.net'}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setNewEmail(user?.email || 'bbung@raota.net')
                      setIsEmailModalOpen(true)
                    }}
                    className="px-2 py-0.5 rounded-[4px] border border-stone-200 bg-stone-50 hover:bg-white hover:border-[#E60000] text-[10.5px] font-bold text-stone-700 hover:text-[#E60000] transition-colors active:scale-95 shrink-0"
                  >
                    변경
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[12px] py-1.5">
                <span className="text-stone-500 font-medium">선호 스타일</span>
                <div className="flex items-center gap-2">
                  <span className="font-black text-[#E60000]">{user?.favoriteRamenType || selectedStyle || '돈코츠'}</span>
                  <button
                    type="button"
                    onClick={() => setIsStyleModalOpen(true)}
                    className="px-2 py-0.5 rounded-[4px] border border-stone-200 bg-stone-50 hover:bg-white hover:border-[#E60000] text-[10.5px] font-bold text-stone-700 hover:text-[#E60000] transition-colors active:scale-95"
                  >
                    변경
                  </button>
                </div>
              </div>


              <div className="pt-3 border-t border-stone-100">
                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="w-full py-2.5 rounded-[4px] border border-stone-200 bg-stone-50 hover:bg-stone-100 hover:border-red-200 text-[11.5px] font-bold text-stone-700 hover:text-[#E60000] transition-all active:scale-[0.99]"
                  >
                    로그아웃
                  </button>
                )}
              </div>
            </div>

          ) : (
            <div className="py-2 space-y-3">
              <p className="text-[11.5px] text-stone-600 leading-relaxed">
                로그인하면 나의 라멘로그 캘린더와 취향 리포트를 언제 어디서나 안전하게 보관할 수 있습니다.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onLoginClick}
                  className="flex-1 py-2.5 rounded-[4px] bg-[#25282B] hover:bg-black text-white text-[12px] font-black transition-all"
                >
                  로그인하기
                </button>
                <button
                  type="button"
                  onClick={onRegisterClick}
                  className="flex-1 py-2.5 rounded-[4px] bg-[#E60000] hover:bg-[#CC0000] text-white text-[12px] font-black transition-all shadow-xs"
                >
                  회원가입하기
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 계정 설정 박스 밑에 연하게 위치한 회원 탈퇴 */}
        {isLoggedIn && (
          <div className="pt-1 pb-2 flex justify-center">
            <button
              type="button"
              onClick={() => setIsWithdrawModalOpen(true)}
              className="text-[11.5px] font-medium text-stone-400 hover:text-stone-600 active:text-[#E60000] underline underline-offset-4 transition-colors cursor-pointer py-1 px-3"
            >
              회원 탈퇴
            </button>
          </div>
        )}

      </main>

      <div className="h-10" />
      </div>

      {/* ========================================== */}
      {/* 📱 모바일 최적화 라멘 활동 등급 안내 바텀 시트 */}
      {/* ========================================== */}
      {isGradeGuideOpen && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end overflow-hidden" role="presentation">
          {/* 딤 배경 */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs anim-fade-in"
            onClick={() => setIsGradeGuideOpen(false)}
            aria-label="등급 안내 모달 닫기"
            role="button"
            tabIndex={0}
          />

          {/* 모바일 바텀 시트 컨테이너 */}
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="ramen-grade-guide-title"
            className="relative w-full mx-auto bg-white rounded-t-[20px] shadow-2xl border-t border-stone-200 anim-slide-up z-10 flex flex-col max-h-[85%] text-[#25282B]"
          >
            {/* 상단 터치 핸들 바 */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-stone-300" />
            </div>

            {/* 헤더 */}
            <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3.5">
              <div>
                <p className="text-[10px] font-black text-[#E60000] tracking-wider uppercase">등급 안내</p>
                <h3 id="ramen-grade-guide-title" className="text-[17px] font-black text-[#25282B]">
                  라멘 활동 등급
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsGradeGuideOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 border border-stone-200 text-stone-500 hover:text-[#E60000] transition-colors active:scale-95"
                aria-label="등급 안내 닫기"
              >
                ✕
              </button>
            </div>

            {/* 스크롤 가능한 본문 영역 */}
            <div className="p-5 overflow-y-auto no-scrollbar space-y-4">
              <div className="p-3 bg-stone-50 rounded-[6px] border border-stone-200 text-[11px] text-stone-600 leading-relaxed flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span><strong>공개 라멘로그 개수</strong>를 기준으로 활동 등급이 자동으로 승급됩니다. 매장을 정복하고 기록을 남겨 최고 등급에 도전해보세요!</span>
              </div>



              {/* 등급 리스트 */}
              <div className="rounded-[8px] border border-stone-200 overflow-hidden divide-y divide-stone-100">
                {RAMEN_ACTIVITY_LEVELS.map((level, index) => {
                  const isCurrent = level.title === ramenActivityLevel.title
                  return (
                    <div
                      key={level.title}
                      className={`flex items-center justify-between gap-3 px-4 py-3 transition-colors ${
                        isCurrent ? 'bg-red-50/90' : 'bg-white hover:bg-stone-50'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`text-[13px] font-black ${isCurrent ? 'text-[#E60000]' : 'text-[#25282B]'}`}>
                            {level.title}
                          </p>
                          {isCurrent && (
                            <span className="text-[9px] font-black bg-[#E60000] text-white px-1.5 py-0.2 rounded-sm">
                              내 등급
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] font-medium text-stone-400">
                          {level.desc}
                        </p>
                      </div>

                      <span className={`shrink-0 text-[11px] font-black ${isCurrent ? 'text-[#E60000]' : 'text-stone-300'}`}>
                        {isCurrent ? '현재' : `Lv.${index + 1}`}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 하단 닫기/확인 버튼 (홈바 여백 고려) */}
            <div className="p-4 pt-2 pb-6 border-t border-stone-100 bg-white">
              <button
                type="button"
                onClick={() => setIsGradeGuideOpen(false)}
                className="w-full h-11 rounded-[8px] bg-[#25282B] hover:bg-[#1A1C1E] active:scale-98 text-white font-bold text-[13px] transition-all shadow-sm"
              >
                확인
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ========================================== */}
      {/* 🍜 선호 라멘 스타일 변경 바텀 시트 */}
      {/* ========================================== */}
      {isStyleModalOpen && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end overflow-hidden" role="presentation">
          {/* 딤 배경 */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs anim-fade-in"
            onClick={() => setIsStyleModalOpen(false)}
            aria-label="선호 스타일 변경 닫기"
            role="button"
            tabIndex={0}
          />

          {/* 바텀 시트 컨테이너 */}
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="favorite-style-title"
            className="relative w-full mx-auto bg-white rounded-t-[20px] shadow-2xl border-t border-stone-200 anim-slide-up z-10 flex flex-col max-h-[85%] text-[#25282B]"
          >
            {/* 상단 터치 핸들 바 */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-stone-300" />
            </div>

            {/* 헤더 */}
            <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3.5">
              <div>
                <p className="text-[10px] font-black text-[#E60000] tracking-wider uppercase">MY TASTE</p>
                <h3 id="favorite-style-title" className="text-[17px] font-black text-[#25282B]">
                  선호 라멘 스타일 변경
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsStyleModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 border border-stone-200 text-stone-500 hover:text-[#E60000] transition-colors active:scale-95"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            {/* 본문 스타일 선택 영역 */}
            <div className="p-5 overflow-y-auto no-scrollbar space-y-4">
              <p className="text-[11.5px] text-stone-500 leading-relaxed">
                가장 즐겨 드시거나 취향 리포트에 우선 반영하고 싶은 라멘 스타일을 선택해주세요.
              </p>

              <div className="grid grid-cols-2 gap-2">
                {PRESET_RAMEN_STYLES.map(style => {
                  const pureName = style.split(' ')[0]
                  const isCurrentSelected = (user?.favoriteRamenType || selectedStyle) === pureName
                  return (
                    <button
                      key={style}
                      type="button"
                      onClick={() => handleSaveStyle(style)}
                      className={`p-3 rounded-[6px] border text-left transition-all flex flex-col justify-between gap-1 active:scale-98 ${
                        isCurrentSelected
                          ? 'border-[#E60000] bg-red-50/80 shadow-xs'
                          : 'border-stone-200 bg-white hover:bg-stone-50 hover:border-stone-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[13px] font-black ${isCurrentSelected ? 'text-[#E60000]' : 'text-[#25282B]'}`}>
                          {pureName}
                        </span>
                        {isCurrentSelected && (
                          <span className="w-4 h-4 rounded-full bg-[#E60000] text-white flex items-center justify-center text-[10px] font-bold">
                            ✓
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-stone-400 font-medium">
                        {style.includes('(') ? style.slice(style.indexOf('(')) : ''}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 하단 확인 버튼 */}
            <div className="p-4 pt-2 pb-6 border-t border-stone-100 bg-white">
              <button
                type="button"
                onClick={() => setIsStyleModalOpen(false)}
                className="w-full h-11 rounded-[8px] bg-[#25282B] hover:bg-[#1A1C1E] active:scale-98 text-white font-bold text-[13px] transition-all shadow-sm"
              >
                닫기
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ========================================== */}
      {/* ✉️ 연동 이메일 변경 바텀 시트 */}
      {/* ========================================== */}
      {isEmailModalOpen && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end overflow-hidden" role="presentation">
          {/* 딤 배경 */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs anim-fade-in"
            onClick={() => !isEmailUpdating && setIsEmailModalOpen(false)}
            aria-label="이메일 변경 닫기"
            role="button"
            tabIndex={0}
          />

          {/* 바텀 시트 컨테이너 */}
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="email-modal-title"
            className="relative w-full mx-auto bg-white rounded-t-[20px] shadow-2xl border-t border-stone-200 anim-slide-up z-10 flex flex-col max-h-[85%] text-[#25282B]"
          >
            {/* 상단 터치 핸들 바 */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-stone-300" />
            </div>

            {/* 헤더 */}
            <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-stone-100 text-[#25282B] flex items-center justify-center">
                  <Mail className="w-4 h-4 text-[#25282B]" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-[#E60000] tracking-wider uppercase">ACCOUNT</p>
                  <h3 id="email-modal-title" className="text-[16px] font-black text-[#25282B]">
                    연동 이메일 변경
                  </h3>
                </div>
              </div>
              <button
                type="button"
                disabled={isEmailUpdating}
                onClick={() => setIsEmailModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 border border-stone-200 text-stone-500 hover:text-[#E60000] transition-colors active:scale-95 disabled:opacity-50"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>


            {/* 폼 본문 */}
            <form onSubmit={handleSaveEmail} className="p-5 space-y-4">
              <p className="text-[11.5px] text-stone-500 leading-relaxed">
                라멘로그 캘린더 동기화와 라오타 멤버십 알림을 수신할 새로운 이메일 주소를 입력해주세요.
              </p>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-stone-500 mb-1.5">
                  새 이메일 주소
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="ramen@example.com"
                  className="w-full rounded-[4px] border border-stone-200 bg-white px-3.5 py-3 text-[13px] font-bold text-[#25282B] transition-colors focus:border-[#E60000] focus:outline-none"
                />
              </div>

              {/* 하단 액션 버튼 바 */}
              <div className="pt-3 flex items-center gap-2">
                <button
                  type="button"
                  disabled={isEmailUpdating}
                  onClick={() => setIsEmailModalOpen(false)}
                  className="flex-1 h-11 rounded-[6px] border border-stone-200 bg-white hover:bg-stone-50 text-[12px] font-bold text-stone-700 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isEmailUpdating}
                  className="flex-1 h-11 rounded-[6px] bg-[#E60000] hover:bg-[#CC0000] active:scale-98 text-white font-black text-[12px] transition-all shadow-xs disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  {isEmailUpdating ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>저장 중...</span>
                    </>
                  ) : (
                    <span>변경 저장하기</span>
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ========================================== */}
      {/* ⚠️ 회원 탈퇴 확인 바텀 시트 */}
      {/* ========================================== */}
      {isWithdrawModalOpen && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end overflow-hidden" role="presentation">
          {/* 딤 배경 */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs anim-fade-in"
            onClick={() => !isWithdrawing && setIsWithdrawModalOpen(false)}
            aria-label="회원 탈퇴 모달 닫기"
            role="button"
            tabIndex={0}
          />

          {/* 바텀 시트 컨테이너 */}
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="withdraw-modal-title"
            className="relative w-full mx-auto bg-white rounded-t-[20px] shadow-2xl border-t border-stone-200 anim-slide-up z-10 flex flex-col max-h-[88%] text-[#25282B]"
          >
            {/* 상단 터치 핸들 바 */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-stone-300" />
            </div>

            {/* 헤더 */}
            <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-red-100 text-[#E60000] flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-[#E60000]" />
                </div>
                <div>
                  <h3 id="withdraw-modal-title" className="text-[16px] font-black text-[#25282B]">
                    회원 탈퇴
                  </h3>
                </div>
              </div>
              <button
                type="button"
                disabled={isWithdrawing}
                onClick={() => setIsWithdrawModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 border border-stone-200 text-stone-500 hover:text-[#E60000] transition-colors active:scale-95 disabled:opacity-50"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            {/* 본문 탈퇴 주의사항 */}
            <div className="p-5 overflow-y-auto no-scrollbar space-y-3.5">
              <p className="text-[12px] text-stone-600 leading-relaxed font-medium">
                탈퇴가 완료되면 즉시 계정 접근이 중단되며, 탈퇴일로부터 30일 후 같은 계정으로 다시 가입할 수 있습니다.
              </p>

              <div className="rounded-[6px] border border-stone-200 bg-stone-50 p-4 space-y-2">
                <h4 className="text-[12px] font-black text-[#25282B] flex items-center gap-1.5">
                  <span className="text-[#E60000]">●</span> 탈퇴 전 확인해주세요
                </h4>
                <ul className="space-y-1.5 pl-3 text-[11px] text-stone-600 font-medium list-disc">
                  <li>탈퇴 후 30일 동안 같은 소셜 계정으로 재가입할 수 없습니다.</li>
                  <li>30일이 지나면 라멘로그 캘린더, 취향 리포트, 북마크 정보가 모두 정리됩니다.</li>
                  <li>커뮤니티 글과 댓글은 서비스 흐름 유지를 위해 남을 수 있습니다.</li>
                  <li>남아 있는 글과 댓글의 프로필은 탈퇴 사용자로 익명화 처리됩니다.</li>
                </ul>
              </div>

              <p className="text-[11.5px] font-bold text-[#E60000] text-center pt-1">
                정말로 라오타를 탈퇴하시겠습니까?
              </p>
            </div>


            {/* 하단 액션 버튼 바 */}
            <div className="p-4 pt-2 pb-6 border-t border-stone-100 bg-white flex items-center gap-2">
              <button
                type="button"
                disabled={isWithdrawing}
                onClick={() => setIsWithdrawModalOpen(false)}
                className="flex-1 h-11 rounded-[6px] border border-stone-200 bg-white hover:bg-stone-50 text-[12px] font-bold text-stone-700 transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                disabled={isWithdrawing}
                onClick={handleWithdraw}
                className="flex-1 h-11 rounded-[6px] bg-[#E60000] hover:bg-[#CC0000] active:scale-98 text-white font-black text-[12px] transition-all shadow-xs disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {isWithdrawing ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>탈퇴 처리 중...</span>
                  </>
                ) : (
                  <span>회원 탈퇴하기</span>
                )}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* 토스트 알림 (하단 탭바 바로 위 편안한 플로팅) */}
      {toastMsg && (
        <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 z-50 pointer-events-none anim-fade-in-up">
          <div className="bg-[#25282B]/95 backdrop-blur-md text-white text-[12px] font-bold px-4 py-2.5 rounded-[32px] shadow-[0_8px_24px_rgba(0,0,0,0.25)] flex items-center gap-2 whitespace-nowrap border border-white/15">
            <RamenIcon className="w-4 h-4 text-[#E60000] shrink-0" />
            <span>{toastMsg}</span>
          </div>
        </div>
      )}

    </div>



  )
}

