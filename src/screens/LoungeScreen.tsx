import { useState, useMemo, useRef, useEffect, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  HelpCircle,
  Heart,
  MessageCircle,
  Eye,
  CornerDownRight,
  Send,
  Store,
  Lightbulb,
  Sparkles,
  Search,
  PenSquare,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Plus,
  Flame,
  Image as ImageIcon,
  X,
  Check,
  LogIn,
} from 'lucide-react'
import type { RamenLog, UserProfile } from '../types'
import RamenIcon from '../components/icons/RamenIcon'

export interface PostComment {
  id: number
  authorId?: number
  authorNickname: string
  authorLevel?: string
  createdAt: string
  content: string
  isReply?: boolean
  parentAuthorNickname?: string
  likes: number
  isLiked: boolean
}

type PostCategory = 'REVIEW' | 'TIP' | 'QUESTION' | 'FREE' | 'POPULAR'

export interface CommunityPost {
  postId: number
  category: PostCategory
  categoryLabel: string
  title: string
  content: string
  detailedContent?: string[]
  authorId: number
  authorName: string
  authorLevel: string
  createdAt: string
  likeCount: number
  commentCount: number
  viewCount: number
  isLiked: boolean
  shopName?: string
  imageUrl?: string
  comments: PostComment[]
}

export interface Props {
  logs: RamenLog[]
  user?: UserProfile | null
  onToggleLike?: (logId: number) => void
  onAddComment?: (logId: number, content: string, parentId?: number) => void
  onLoginRequest?: () => void
  onRecordClick: () => void
  onShopClick?: (shopName: string) => void
}

/** 등급 문자열에서 Lv.X, (Lv.X), X레벨 등을 제거하고 순수 등급명만 반환 */
export function cleanGradeTitle(levelStr?: string) {
  if (!levelStr) return '라멘 탐험가'
  return levelStr
    .replace(/\s*\(Lv\.\s*\d+\)/gi, '')
    .replace(/Lv\.\s*\d+\s*/gi, '')
    .replace(/\s*\d+레벨/gi, '')
    .trim()
}

/** 날짜 문자열을 'YYYY.MM.DD' 형식으로 정규화 */
export function formatDateYMD(dateStr?: string) {
  if (!dateStr) return ''
  if (dateStr === '방금 전') {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `${y}.${m}.${d}`
  }
  const match = dateStr.match(/(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/)
  if (match) {
    const [, y, m, d] = match
    return `${y}.${m.padStart(2, '0')}.${d.padStart(2, '0')}`
  }
  return dateStr.split(' ')[0]
}

/**
 * '방금 전', 'N분 전', 'N시간 전', '어제', 'N일 전', 'N주 전' 같은 상대 표현을
 * "몇 분 전"으로 환산한다. 최신순 정렬에 쓴다. 해석할 수 없으면 가장 오래된 것으로 본다.
 */
export function relativeTimeToMinutes(value?: string): number {
  if (!value) return Number.MAX_SAFE_INTEGER
  const text = value.trim()
  if (text.includes('방금') || text.includes('지금')) return 0
  if (text.startsWith('어제')) return 24 * 60
  if (text.startsWith('그제')) return 48 * 60
  const match = text.match(/(\d+)\s*(분|시간|일|주|개월|달|년)/)
  if (match) {
    const n = Number(match[1])
    switch (match[2]) {
      case '분':
        return n
      case '시간':
        return n * 60
      case '일':
        return n * 24 * 60
      case '주':
        return n * 7 * 24 * 60
      case '개월':
      case '달':
        return n * 30 * 24 * 60
      case '년':
        return n * 365 * 24 * 60
    }
  }
  const ymd = text.match(/(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/)
  if (ymd) {
    const [, y, m, d, hh = '0', mm = '0'] = ymd
    const date = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm))
    if (!Number.isNaN(date.getTime())) return Math.max(0, Math.round((Date.now() - date.getTime()) / 60000))
  }
  return Number.MAX_SAFE_INTEGER
}

// ----------------------------------------------------
// 커뮤니티 Mock 데이터 (게시판은 화면 로컬 상태로 유지한다)
// ----------------------------------------------------
const INITIAL_COMMUNITY_POSTS: CommunityPost[] = [
  {
    postId: 1,
    category: 'REVIEW',
    categoryLabel: '맛집후기',
    title: '망원·합정 일대 인생 쇼유 라멘 3곳 추천합니다',
    content: '자가제면과 동물계 육수의 밸런스가 완벽한 곳들만 엄선했습니다. 1위는 역시 멘야준, 2위는 세상끝의라멘, 3위는 묘코입니다.',
    detailedContent: [
      '지난 3년간 마포구 일대 쇼유 라멘집 40여 곳을 투어하며 선별한 베스트 3곳을 공유합니다.',
      '🥇 1위. 멘야준 (망원)\n닭과 오리 육수의 더블 블렌딩 감칠맛이 폭발적입니다. 특히 1.5mm 자가제면의 씹는 맛과 차슈의 부드러움이 일품입니다.',
      '🥈 2위. 세상끝의라멘 (합정)\n진한 오사카 블랙풍의 끝라멘과 맑은 첫라멘 모두 개성이 뚜렷합니다. 닭가슴살 수비드 토핑이 예술입니다.',
      '🥉 3위. 묘코 (연남)\n오리 기름(오리기름 치유)의 향이 은은하게 퍼지며 끝맛이 매우 깔끔합니다.',
    ],
    authorId: 101,
    authorName: '쇼유장인',
    authorLevel: '라멘 미식가 (Lv.5)',
    createdAt: '2026. 09. 01 12:40',
    likeCount: 42,
    commentCount: 3,
    viewCount: 318,
    isLiked: false,
    shopName: '멘야준',
    comments: [
      {
        id: 1,
        authorId: 201,
        authorNickname: '멘마수집가',
        authorLevel: '라멘 미식가',
        createdAt: '2026. 09. 01 12:45',
        content: '멘야준 특제 쇼유는 진짜 반박 불가 1위죠! 닭 육수 첫 모금의 염도 밸런스가 완벽합니다.',
        likes: 5,
        isLiked: false,
      },
      {
        id: 2,
        authorId: 202,
        authorNickname: '라린이',
        authorLevel: '라멘 입문자',
        createdAt: '2026. 09. 01 12:50',
        content: '세상끝의라멘 처음 가보려는데 첫라멘이랑 끝라멘 중에 어떤 걸 먼저 먹어봐야 할까요?',
        likes: 2,
        isLiked: false,
      },
      {
        id: 3,
        authorId: 101,
        authorNickname: '쇼유장인',
        authorLevel: '라멘 미식가',
        createdAt: '2026. 09. 01 12:55',
        content: '쇼유 본연의 깊은 풍미를 원하시면 첫 방문엔 무조건 "끝라멘" 추천드립니다!',
        isReply: true,
        parentAuthorNickname: '라린이',
        likes: 7,
        isLiked: false,
      },
    ],
  },
  {
    postId: 2,
    category: 'QUESTION',
    categoryLabel: 'Q&A',
    title: '돈코츠 농도 높은 곳 처음 가보는데 어디가 입문용으로 좋을까요?',
    content: '하쿠텐이나 부탄츄 가보려고 하는데 극강의 꼬릿함에 적응할 수 있을지 걱정입니다. 추천 부탁드려요!',
    detailedContent: [
      '평소 맑은 국물 위주로 먹다가 진한 돈코츠에 입문해보려 합니다.',
      '후보군으로 하쿠텐(이에케)과 부탄츄(토코톤코츠)를 보고 있는데, 농도 조절이나 덜 부담스러운 주문 팁이 있을까요?',
    ],
    authorId: 102,
    authorName: '라린이',
    authorLevel: '라멘집 탐험가 (Lv.3)',
    createdAt: '2026. 09. 01 11:20',
    likeCount: 15,
    commentCount: 2,
    viewCount: 184,
    isLiked: false,
    shopName: '오레노라멘',
    comments: [
      {
        id: 4,
        authorId: 203,
        authorNickname: '돈골파마스터',
        authorLevel: '돈골파 장인',
        createdAt: '2026. 09. 01 11:35',
        content: '하쿠텐 가셔서 "간 보통, 기름 보통, 면 꼬들하게"로 시작하시면 부담 없이 농후한 맛을 즐기실 수 있습니다.',
        likes: 4,
        isLiked: false,
      },
      {
        id: 5,
        authorId: 204,
        authorNickname: '오레노매니아',
        authorLevel: '라멘집 단골',
        createdAt: '2026. 09. 01 11:50',
        content: '크리미한 파이탄 느낌 좋아하시면 오레노라멘 토리파이탄도 훌륭한 징검다리가 됩니다!',
        likes: 3,
        isLiked: false,
      },
    ],
  },
  {
    postId: 3,
    category: 'TIP',
    categoryLabel: '꿀팁',
    title: '라멘 먹을 때 염도 조절 실패하지 않는 완식 주문 꿀팁',
    content: '초심자분들이 자주 실수하는 간 조절법과 무료 와리스프(육수 추가) 요청 타이밍 총정리입니다.',
    detailedContent: [
      '1. 일본 정통 라멘집은 기본 염도가 한국인 입맛에 다소 짤 수 있으므로 첫 방문 시 "싱겁게" 또는 "보통"으로 주문하세요.',
      '2. 식사 중간에 너무 짜다고 느껴지면 주저하지 말고 "와리스프(연한 육수)"를 요청하시면 염도를 맞춰주십니다.',
      '3. 밥이나 면 리필이 무료인 곳(라오타 완식 가이드 참고)은 국물을 1/3 이상 남겨두시는 것이 좋습니다.',
    ],
    authorId: 103,
    authorName: '스프의신',
    authorLevel: '라멘집 단골 (Lv.4)',
    createdAt: '2026. 09. 01 09:15',
    likeCount: 68,
    commentCount: 4,
    viewCount: 520,
    isLiked: false,
    comments: [
      {
        id: 6,
        authorId: 205,
        authorNickname: '차슈폭격기',
        authorLevel: '라멘 마스터',
        createdAt: '2026. 09. 01 09:30',
        content: '와리스프 팁 진짜 유용하네요! 처음 갔을 때 모르고 다 먹느라 물 3컵 마셨던 기억이 납니다.',
        likes: 8,
        isLiked: false,
      },
    ],
  },
  {
    postId: 4,
    category: 'FREE',
    categoryLabel: '자유',
    title: '올해 100그릇 달성했습니다! 취향 리포트 인증합니다',
    content: '상반기 동안 서울 시내 라멘집 60곳 돌면서 심어둔 잔디가 꽉 찼네요. 다들 이번 주도 즐거운 완식하세요.',
    detailedContent: [
      '드디어 오늘 점심 완식으로 2026년 누적 100그릇 돌파했습니다.',
      '활동 등급도 최고 등급인 Lv.6 라멘 마스터로 승급했네요! 라오타 커뮤니티 덕분에 좋은 라멘집 많이 알아갑니다.',
    ],
    authorId: 104,
    authorName: '차슈폭격기',
    authorLevel: '라멘 마스터 (Lv.6)',
    createdAt: '2026. 09. 01 08:00',
    likeCount: 89,
    commentCount: 2,
    viewCount: 642,
    isLiked: false,
    comments: [
      {
        id: 7,
        authorId: 206,
        authorNickname: '라멘러버',
        authorLevel: '라멘 미식가',
        createdAt: '2026. 09. 01 08:30',
        content: '100그릇 대단하십니다 축하드려요! 👏',
        likes: 6,
        isLiked: false,
      },
    ],
  },
]

const COMMUNITY_CATEGORIES = [
  { id: 'all', label: '전체' },
  { id: 'POPULAR', label: '인기' },
  { id: 'REVIEW', label: '맛집후기' },
  { id: 'TIP', label: '꿀팁' },
  { id: 'QUESTION', label: 'Q&A' },
  { id: 'FREE', label: '자유' },
]

const WRITE_CATEGORIES: { id: Exclude<PostCategory, 'POPULAR'>; name: string }[] = [
  { id: 'REVIEW', name: '맛집후기' },
  { id: 'TIP', name: '꿀팁' },
  { id: 'QUESTION', name: 'Q&A' },
  { id: 'FREE', name: '자유' },
]

const WRITE_SHOP_OPTIONS = [
  { name: '멘야준', location: '망원 본점' },
  { name: '오레노라멘', location: '마포 본점' },
  { name: '후쿠 라멘', location: '합정점' },
  { name: '하쿠텐', location: '연남점' },
  { name: '세상끝의라멘', location: '합정점' },
  { name: '담택', location: '합정 본점' },
  { name: '멘지', location: '망원점' },
  { name: '이리에라멘', location: '합정점' },
  { name: '묘코', location: '연남점' },
  { name: '무타히로', location: '연남점' },
]

const SAMPLE_IMAGE_PRESETS = [
  { name: '특제 쇼유 라멘', url: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=600&fit=crop&auto=format&q=80' },
  { name: '이에케 라멘', url: 'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=600&fit=crop&auto=format&q=80' },
  { name: '토리파이탄', url: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=600&fit=crop&auto=format&q=80' },
]

const POPULAR_THRESHOLD = 30

/** 카테고리 뱃지: 색은 하나만 쓰고 글자로 구분한다 */
function CategoryBadge({ label }: { label: string }) {
  return <span className="shrink-0 rounded-[4px] bg-[#F2F2F2] px-1.5 py-0.5 text-[12px] font-bold text-[#4A4D52]">{label}</span>
}

function PopularBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-[4px] bg-[#FFF0F0] px-1.5 py-0.5 text-[12px] font-bold text-[#E60000]">
      <Flame className="h-3 w-3" aria-hidden="true" />
      인기
    </span>
  )
}

function LevelTag({ level }: { level?: string }) {
  return <span className="shrink-0 text-[12px] font-medium text-[#6B6E73]">{cleanGradeTitle(level)}</span>
}

/** 이니셜 또는 사진 아바타 */
function Avatar({ name, src, size = 32, dark = false }: { name: string; src?: string | null; size?: number; dark?: boolean }) {
  const style = { width: size, height: size }
  if (src) {
    return <img src={src} alt="" style={style} className="shrink-0 rounded-full object-cover" />
  }
  return (
    <span
      aria-hidden="true"
      style={style}
      className={`flex shrink-0 items-center justify-center rounded-full text-[12px] font-black ${
        dark ? 'bg-[#25282B] text-white' : 'bg-[#F2F2F2] text-[#25282B]'
      }`}
    >
      {name.trim()[0] ?? '?'}
    </span>
  )
}

/** 칩 하나: 눈에 보이는 알약은 작아도 버튼 히트 영역은 44px을 지킨다 */
function Chip({ active, onClick, children, ariaPressed = true }: { active: boolean; onClick: () => void; children: React.ReactNode; ariaPressed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ariaPressed ? active : undefined}
      className="flex min-h-11 shrink-0 items-center"
    >
      <span
        className={`inline-flex items-center gap-1 whitespace-nowrap rounded-[32px] px-3.5 py-1.5 text-[13px] font-bold transition-colors ${
          active ? 'bg-[#25282B] text-white' : 'bg-[#F2F2F2] text-[#4A4D52]'
        }`}
      >
        {children}
      </span>
    </button>
  )
}

export default function LoungeScreen({ logs, user, onToggleLike, onAddComment, onLoginRequest, onRecordClick, onShopClick }: Props) {
  const [loungeTab, setLoungeTab] = useState<'logs' | 'community'>('logs')
  const [shopFilter, setShopFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState<'LATEST' | 'LIKES'>('LATEST')
  const [isShopDropdownOpen, setIsShopDropdownOpen] = useState(false)
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false)
  const [shopSearchQuery, setShopSearchQuery] = useState('')
  const shopDropdownRef = useRef<HTMLDivElement>(null)
  const sortDropdownRef = useRef<HTMLDivElement>(null)
  const [communityCategory, setCommunityCategory] = useState('all')
  const [posts, setPosts] = useState<CommunityPost[]>(INITIAL_COMMUNITY_POSTS)
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null)
  const [activePhotoIdx, setActivePhotoIdx] = useState<Record<number, number>>({})
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null)
  const [showAllLogCommentsId, setShowAllLogCommentsId] = useState<number | null>(null)
  const [newCommentText, setNewCommentText] = useState('')
  const [newLogCommentText, setNewLogCommentText] = useState('')
  const [logCommentError, setLogCommentError] = useState<string | null>(null)
  const [replyToAuthor, setReplyToAuthor] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const logCommentInputRef = useRef<HTMLInputElement>(null)

  // 커뮤니티 새 글 작성 상태
  const [isWriteOpen, setIsWriteOpen] = useState(false)
  const [writeCategory, setWriteCategory] = useState<Exclude<PostCategory, 'POPULAR'>>('REVIEW')
  const [writeTitle, setWriteTitle] = useState('')
  const [writeContent, setWriteContent] = useState('')
  const [writeSelectedShop, setWriteSelectedShop] = useState<{ name: string; location: string } | null>(null)
  const [writeImagePreview, setWriteImagePreview] = useState<string | null>(null)
  const [isWriteShopDropdownOpen, setIsWriteShopDropdownOpen] = useState(false)
  const [writeShopSearchQuery, setWriteShopSearchQuery] = useState('')
  const writeShopDropdownRef = useRef<HTMLDivElement>(null)
  const writeTitleRef = useRef<HTMLInputElement>(null)

  const selectedPost = useMemo(() => posts.find(post => post.postId === selectedPostId) ?? null, [posts, selectedPostId])

  // 로그인이 필요한 행동을 비회원이 누르면 로그인으로 보낸다
  const requireUser = (): UserProfile | null => {
    if (user) return user
    onLoginRequest?.()
    return null
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shopDropdownRef.current && !shopDropdownRef.current.contains(event.target as Node)) setIsShopDropdownOpen(false)
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) setIsSortDropdownOpen(false)
      if (writeShopDropdownRef.current && !writeShopDropdownRef.current.contains(event.target as Node)) setIsWriteShopDropdownOpen(false)
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsShopDropdownOpen(false)
        setIsSortDropdownOpen(false)
        setIsWriteShopDropdownOpen(false)
      }
    }
    if (isShopDropdownOpen || isSortDropdownOpen || isWriteShopDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKey)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [isShopDropdownOpen, isSortDropdownOpen, isWriteShopDropdownOpen])

  // 글쓰기 화면: 열리면 제목으로 포커스, Escape로 닫는다 (매장 팝오버가 열려 있으면 팝오버만 닫힌다)
  useEffect(() => {
    if (!isWriteOpen) return
    writeTitleRef.current?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isWriteShopDropdownOpen) closeWrite()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isWriteOpen, isWriteShopDropdownOpen])

  // 게시글 상세: Escape로 목록으로 돌아간다
  useEffect(() => {
    if (selectedPostId === null) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedPostId(null)
        setReplyToAuthor(null)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selectedPostId])

  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => setToastMessage(null), 3000)
    return () => clearTimeout(timer)
  }, [toastMessage])

  useEffect(() => {
    if (expandedLogId !== null) logCommentInputRef.current?.focus()
  }, [expandedLogId])

  const handleToggleLogLike = (id: number) => {
    onToggleLike?.(id)
  }

  const handleToggleLogComments = (logId: number) => {
    setExpandedLogId(current => (current === logId ? null : logId))
    setNewLogCommentText('')
    setLogCommentError(null)
  }

  const handleAddLogComment = (logId: number) => {
    if (!requireUser()) return
    const content = newLogCommentText.trim()
    if (content.length < 2) {
      setLogCommentError('댓글은 2자 이상 적어 주세요.')
      return
    }
    onAddComment?.(logId, content)
    setShowAllLogCommentsId(logId)
    setNewLogCommentText('')
    setLogCommentError(null)
  }

  const handleTogglePostLike = (postId: number) => {
    if (!requireUser()) return
    setPosts(prev =>
      prev.map(p =>
        p.postId === postId
          ? { ...p, isLiked: !p.isLiked, likeCount: Math.max(0, p.isLiked ? p.likeCount - 1 : p.likeCount + 1) }
          : p
      )
    )
  }

  const handleAddComment = (postId: number) => {
    const author = requireUser()
    if (!author) return
    const content = newCommentText.trim()
    if (!content) return
    const newComment: PostComment = {
      id: Date.now(),
      authorNickname: author.nickname,
      authorLevel: cleanGradeTitle(author.level),
      createdAt: '방금 전',
      content,
      isReply: Boolean(replyToAuthor),
      parentAuthorNickname: replyToAuthor ?? undefined,
      likes: 0,
      isLiked: false,
    }
    setPosts(prev =>
      prev.map(p => (p.postId === postId ? { ...p, commentCount: p.commentCount + 1, comments: [...p.comments, newComment] } : p))
    )
    setNewCommentText('')
    setReplyToAuthor(null)
  }

  const closeWrite = () => {
    setIsWriteOpen(false)
    setWriteTitle('')
    setWriteContent('')
    setWriteCategory('REVIEW')
    setWriteSelectedShop(null)
    setWriteImagePreview(null)
    setIsWriteShopDropdownOpen(false)
  }

  const openWrite = () => {
    if (!requireUser()) return
    setIsWriteOpen(true)
  }

  const handleCreateCommunityPost = (e?: FormEvent) => {
    e?.preventDefault()
    const author = requireUser()
    if (!author) return
    if (!writeTitle.trim() || !writeContent.trim()) return
    const categoryObj = WRITE_CATEGORIES.find(c => c.id === writeCategory)
    const newPost: CommunityPost = {
      postId: Date.now(),
      category: writeCategory,
      categoryLabel: categoryObj?.name ?? '자유',
      title: writeTitle.trim(),
      content: writeContent.trim(),
      detailedContent: [writeContent.trim()],
      authorId: 0,
      authorName: author.nickname,
      authorLevel: `${author.level} (Lv.${author.levelNumber})`,
      createdAt: '방금 전',
      likeCount: 0,
      commentCount: 0,
      viewCount: 0,
      isLiked: false,
      shopName: writeCategory === 'REVIEW' && writeSelectedShop ? writeSelectedShop.name : undefined,
      imageUrl: writeImagePreview || undefined,
      comments: [],
    }
    setPosts(prev => [newPost, ...prev])
    closeWrite()
    setCommunityCategory('all')
    setLoungeTab('community')
    setToastMessage('커뮤니티에 글을 올렸습니다.')
  }

  const handleScrollPhoto = (logId: number, direction: 'prev' | 'next', total: number) => {
    const container = document.getElementById(`log-photos-${logId}`)
    if (!container) return
    const current = activePhotoIdx[logId] ?? 0
    const nextIdx = direction === 'next' ? Math.min(total - 1, current + 1) : Math.max(0, current - 1)
    container.scrollTo({ left: nextIdx * container.clientWidth, behavior: 'smooth' })
    setActivePhotoIdx(prev => ({ ...prev, [logId]: nextIdx }))
  }

  const shopList = useMemo(() => {
    const shopMap = new Map<string, number>()
    logs.forEach(l => {
      const sName = l.shop?.name || '기타'
      shopMap.set(sName, (shopMap.get(sName) || 0) + 1)
    })
    return Array.from(shopMap.entries()).map(([name, count]) => ({ name, value: name, count }))
  }, [logs])

  const filteredLogs = useMemo(() => {
    const result = shopFilter === 'ALL' ? [...logs] : logs.filter(l => l.shop?.name === shopFilter)
    if (sortBy === 'LIKES') {
      result.sort((a, b) => b.likes - a.likes || relativeTimeToMinutes(a.createdAt) - relativeTimeToMinutes(b.createdAt))
    } else {
      result.sort((a, b) => relativeTimeToMinutes(a.createdAt) - relativeTimeToMinutes(b.createdAt) || b.id - a.id)
    }
    return result
  }, [logs, shopFilter, sortBy])

  const filteredPosts = useMemo(() => {
    if (communityCategory === 'all') return posts
    if (communityCategory === 'POPULAR') {
      return posts.filter(p => p.likeCount >= POPULAR_THRESHOLD).slice().sort((a, b) => b.likeCount - a.likeCount)
    }
    return posts.filter(p => p.category === communityCategory)
  }, [posts, communityCategory])

  const writeReady = Boolean(writeTitle.trim() && writeContent.trim())

  // ==========================================
  // 커뮤니티 글쓰기 화면
  // ==========================================
  if (isWriteOpen) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lounge-write-title"
        className="relative flex h-full flex-col bg-white text-[#25282B]"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-[#E2E2E2] bg-white px-2 py-1.5">
          <button
            type="button"
            onClick={closeWrite}
            className="flex min-h-11 items-center gap-1 rounded-[6px] px-2 text-[14px] font-bold text-[#4A4D52] transition-colors hover:text-[#25282B]"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            <span>취소</span>
          </button>

          <h1 id="lounge-write-title" className="text-[17px] font-black tracking-tight text-[#25282B]">
            새 글 작성
          </h1>

          <button
            type="button"
            disabled={!writeReady}
            onClick={handleCreateCommunityPost}
            className="min-h-11 rounded-[6px] px-3 text-[14px] font-black text-[#E60000] transition-opacity disabled:opacity-40"
          >
            등록
          </button>
        </header>

        <form onSubmit={handleCreateCommunityPost} className="no-scrollbar flex-1 space-y-4 overflow-y-auto bg-white px-4 pb-12 pt-2">
          {/* 카테고리 */}
          <div role="group" aria-label="글 종류" className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
            {WRITE_CATEGORIES.map(t => {
              const isSelected = writeCategory === t.id
              return (
                <Chip key={t.id} active={isSelected} onClick={() => setWriteCategory(t.id)}>
                  {t.id === 'REVIEW' && <RamenIcon className="h-3.5 w-3.5" aria-hidden="true" />}
                  {t.id === 'TIP' && <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />}
                  {t.id === 'QUESTION' && <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />}
                  {t.id === 'FREE' && <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
                  <span>{t.name}</span>
                </Chip>
              )
            })}
          </div>

          {/* 연관 라멘집 */}
          <div className="relative" ref={writeShopDropdownRef}>
            <button
              type="button"
              onClick={() => setIsWriteShopDropdownOpen(prev => !prev)}
              aria-expanded={isWriteShopDropdownOpen}
              aria-haspopup="listbox"
              className={`flex h-11 w-full items-center justify-between rounded-[6px] px-3 text-[14px] font-bold transition-colors ${
                writeSelectedShop ? 'bg-[#FFF0F0] text-[#E60000]' : 'bg-[#F2F2F2] text-[#4A4D52]'
              }`}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <Store className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {writeSelectedShop ? `${writeSelectedShop.name} (${writeSelectedShop.location})` : '연관 라멘집 태그 (선택)'}
                </span>
              </span>
              <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isWriteShopDropdownOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>

            {isWriteShopDropdownOpen && (
              <div className="anim-fade-in-up absolute left-0 right-0 top-full z-40 mt-1.5 overflow-hidden rounded-[6px] border border-[#E2E2E2] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
                <div className="border-b border-[#F2F2F2] p-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B6E73]" aria-hidden="true" />
                    <input
                      type="text"
                      placeholder="라멘집 검색"
                      aria-label="라멘집 검색"
                      value={writeShopSearchQuery}
                      onChange={e => setWriteShopSearchQuery(e.target.value)}
                      className="h-11 w-full rounded-[6px] border border-[#E2E2E2] bg-white pl-9 pr-3 text-[14px] text-[#25282B] outline-none placeholder:text-[#6B6E73] focus:border-[#E60000]"
                      autoFocus
                    />
                  </div>
                </div>
                <div role="listbox" aria-label="연관 라멘집" className="no-scrollbar max-h-56 divide-y divide-[#F2F2F2] overflow-y-auto">
                  <button
                    type="button"
                    role="option"
                    aria-selected={!writeSelectedShop}
                    onClick={() => {
                      setWriteSelectedShop(null)
                      setIsWriteShopDropdownOpen(false)
                    }}
                    className={`flex min-h-11 w-full items-center px-3.5 text-left text-[14px] ${
                      !writeSelectedShop ? 'bg-[#FFF0F0] font-bold text-[#E60000]' : 'text-[#25282B]'
                    }`}
                  >
                    선택 안 함
                  </button>
                  {WRITE_SHOP_OPTIONS.filter(s => !writeShopSearchQuery.trim() || s.name.toLowerCase().includes(writeShopSearchQuery.toLowerCase())).map(s => {
                    const isSelected = writeSelectedShop?.name === s.name
                    return (
                      <button
                        key={s.name}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          setWriteSelectedShop(s)
                          setIsWriteShopDropdownOpen(false)
                          setWriteShopSearchQuery('')
                        }}
                        className={`flex min-h-11 w-full items-center justify-between px-3.5 text-left text-[14px] ${
                          isSelected ? 'bg-[#FFF0F0] font-bold text-[#E60000]' : 'text-[#25282B]'
                        }`}
                      >
                        <span className="font-bold">{s.name}</span>
                        <span className="text-[13px] text-[#6B6E73]">{s.location}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 제목 & 본문 */}
          <div className="border-b border-[#F2F2F2] pb-3 pt-1">
            <label htmlFor="lounge-write-title-input" className="sr-only">제목</label>
            <input
              id="lounge-write-title-input"
              ref={writeTitleRef}
              type="text"
              value={writeTitle}
              onChange={e => setWriteTitle(e.target.value)}
              placeholder="제목을 입력하세요"
              maxLength={100}
              className="h-11 w-full bg-transparent text-[17px] font-black text-[#25282B] outline-none placeholder:text-[#6B6E73]"
            />
          </div>

          <div className="min-h-[160px]">
            <label htmlFor="lounge-write-content" className="sr-only">본문</label>
            <textarea
              id="lounge-write-content"
              rows={8}
              value={writeContent}
              onChange={e => setWriteContent(e.target.value)}
              placeholder="라멘에 대한 생생한 이야기를 들려주세요 (육수 농도, 면 삶기, 웨이팅 팁 등)"
              className="w-full resize-none bg-transparent text-[14px] leading-relaxed text-[#25282B] outline-none placeholder:text-[#6B6E73]"
            />
          </div>

          {/* 사진 첨부 */}
          <div className="space-y-2 border-t border-[#F2F2F2] pt-3">
            <div className="flex min-h-11 items-center justify-between">
              <span className="text-[13px] font-bold text-[#6B6E73]">사진 첨부 (선택)</span>
              {writeImagePreview && (
                <button
                  type="button"
                  onClick={() => setWriteImagePreview(null)}
                  className="min-h-11 px-2 text-[13px] font-bold text-[#E60000]"
                >
                  사진 삭제
                </button>
              )}
            </div>

            {writeImagePreview ? (
              <div className="relative max-h-52 w-full overflow-hidden rounded-[6px] bg-[#F2F2F2]">
                <img src={writeImagePreview} alt="첨부한 사진 미리보기" className="max-h-52 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setWriteImagePreview(null)}
                  className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center"
                  aria-label="사진 제거"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white">
                    <X className="h-4 w-4" aria-hidden="true" />
                  </span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-[6px] bg-[#F2F2F2] px-3.5 text-[14px] font-bold text-[#25282B] transition-colors hover:bg-[#EAEAEA]">
                  <ImageIcon className="h-4 w-4 text-[#4A4D52]" aria-hidden="true" />
                  <span>기기에서 사진 선택</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const reader = new FileReader()
                        reader.onload = ev => setWriteImagePreview(ev.target?.result as string)
                        reader.readAsDataURL(file)
                      }
                    }}
                    className="sr-only"
                  />
                </label>

                <div className="flex items-center gap-1.5">
                  <span className="shrink-0 text-[13px] font-medium text-[#6B6E73]">샘플</span>
                  <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
                    {SAMPLE_IMAGE_PRESETS.map(preset => (
                      <Chip key={preset.url} active={false} ariaPressed={false} onClick={() => setWriteImagePreview(preset.url)}>
                        {preset.name}
                      </Chip>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={!writeReady}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-[60px] bg-[#E60000] text-[15px] font-bold text-white transition-opacity active:opacity-90 disabled:opacity-40"
            >
              <PenSquare className="h-4 w-4" aria-hidden="true" />
              <span>글 올리기</span>
            </button>
          </div>
        </form>
      </div>
    )
  }

  // ==========================================
  // 커뮤니티 게시글 상세
  // ==========================================
  if (selectedPost) {
    return (
      <div className="relative flex h-full flex-col bg-white text-[#25282B]">
        <header className="flex shrink-0 items-center justify-between border-b border-[#E2E2E2] bg-white px-2 py-1.5">
          <button
            type="button"
            onClick={() => {
              setSelectedPostId(null)
              setReplyToAuthor(null)
            }}
            className="flex min-h-11 items-center gap-1 rounded-[6px] px-2 text-[14px] font-bold text-[#4A4D52] transition-colors hover:text-[#25282B]"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            <span>목록으로</span>
          </button>

          <div className="flex items-center gap-1.5 pr-2">
            <CategoryBadge label={selectedPost.categoryLabel} />
            {selectedPost.likeCount >= POPULAR_THRESHOLD && <PopularBadge />}
          </div>
        </header>

        <div className="no-scrollbar flex-1 overflow-y-auto bg-white">
          <article className="space-y-4 border-b-8 border-[#F2F2F2] px-5 py-4">
            <div className="flex items-center justify-between gap-2 border-b border-[#F2F2F2] pb-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar name={selectedPost.authorName} size={36} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-1.5">
                    <span className="text-[14px] font-bold text-[#25282B]">{selectedPost.authorName}</span>
                    <LevelTag level={selectedPost.authorLevel} />
                  </div>
                  <p className="text-[12px] text-[#6B6E73]">{selectedPost.createdAt}</p>
                </div>
              </div>

              {selectedPost.shopName && (
                <button
                  type="button"
                  onClick={() => onShopClick?.(selectedPost.shopName!)}
                  className="flex min-h-11 shrink-0 items-center"
                >
                  <span className="inline-flex items-center gap-1 rounded-[6px] bg-[#F2F2F2] px-2.5 py-1.5 text-[13px] font-bold text-[#25282B]">
                    <Store className="h-3.5 w-3.5 text-[#E60000]" aria-hidden="true" />
                    <span>{selectedPost.shopName}</span>
                  </span>
                </button>
              )}
            </div>

            <div className="space-y-3">
              <h1 className="text-[20px] font-black leading-snug tracking-tight text-[#25282B]">{selectedPost.title}</h1>

              <div className="space-y-3 text-[14px] leading-relaxed text-[#25282B]">
                {selectedPost.detailedContent ? (
                  selectedPost.detailedContent.map((para, i) => {
                    const ranked = /^[🥇🥈🥉]/.test(para)
                    return (
                      <p key={i} className={`whitespace-pre-line ${ranked ? 'border-l border-[#25282B] pl-3' : ''}`}>
                        {para}
                      </p>
                    )
                  })
                ) : (
                  <p>{selectedPost.content}</p>
                )}
              </div>

              {selectedPost.imageUrl && (
                <div className="mt-2 aspect-[16/10] overflow-hidden rounded-[6px] bg-[#F2F2F2]">
                  <img src={selectedPost.imageUrl} alt={selectedPost.title} className="h-full w-full object-cover" />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-[#F2F2F2] pt-3">
              <button
                type="button"
                onClick={() => handleTogglePostLike(selectedPost.postId)}
                aria-pressed={selectedPost.isLiked}
                className={`flex min-h-11 items-center gap-1.5 rounded-[32px] border px-4 text-[13px] font-bold transition-colors ${
                  selectedPost.isLiked ? 'border-[#E60000] bg-[#FFF0F0] text-[#E60000]' : 'border-[#E2E2E2] bg-white text-[#4A4D52]'
                }`}
              >
                <Heart className={`h-4 w-4 ${selectedPost.isLiked ? 'fill-[#E60000] text-[#E60000]' : ''}`} aria-hidden="true" />
                <span>좋아요 {selectedPost.likeCount}</span>
              </button>

              <div className="flex items-center gap-3 text-[13px] font-bold text-[#6B6E73]">
                <span className="flex items-center gap-1">
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">댓글</span>
                  {selectedPost.commentCount}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">조회</span>
                  {selectedPost.viewCount}
                </span>
              </div>
            </div>
          </article>

          <section aria-label="댓글" className="px-5 py-4">
            <div className="flex items-center justify-between border-b border-[#F2F2F2] pb-3">
              <h2 className="text-[15px] font-black text-[#25282B]">
                댓글 <span className="text-[#E60000]">{selectedPost.comments.length}</span>
              </h2>
              <span className="text-[12px] text-[#6B6E73]">등록순</span>
            </div>

            {selectedPost.comments.length === 0 && (
              <p className="py-8 text-center text-[13px] text-[#6B6E73]">첫 댓글을 남겨 대화를 시작해 보세요.</p>
            )}

            <div className="divide-y divide-[#F2F2F2]">
              {selectedPost.comments.map(comment => (
                <div key={comment.id} className={`py-3.5 ${comment.isReply ? 'pl-7' : ''}`}>
                  <div className="flex items-start gap-2.5">
                    {comment.isReply && <CornerDownRight className="mt-1 h-4 w-4 shrink-0 text-[#6B6E73]" aria-hidden="true" />}
                    <Avatar name={comment.authorNickname} size={28} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5">
                          <span className="text-[13px] font-bold text-[#25282B]">{comment.authorNickname}</span>
                          {comment.authorLevel && <LevelTag level={comment.authorLevel} />}
                          <span className="text-[12px] text-[#6B6E73]">{comment.createdAt}</span>
                        </div>
                        {!comment.isReply && (
                          <button
                            type="button"
                            onClick={() => setReplyToAuthor(comment.authorNickname)}
                            className="-my-2 min-h-11 min-w-11 shrink-0 px-2 text-[13px] font-bold text-[#6B6E73] transition-colors hover:text-[#E60000]"
                          >
                            답글
                          </button>
                        )}
                      </div>
                      <p className="mt-0.5 text-[14px] leading-relaxed text-[#25282B]">
                        {comment.parentAuthorNickname && (
                          <span className="mr-1.5 font-bold text-[#E60000]">@{comment.parentAuthorNickname}</span>
                        )}
                        {comment.content}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="h-16" />
        </div>

        {/* 댓글 입력 바 */}
        <div className="shrink-0 border-t border-[#E2E2E2] bg-white px-4 py-3">
          {user ? (
            <>
              {replyToAuthor && (
                <div className="mb-2 flex items-center justify-between rounded-[6px] bg-[#F2F2F2] py-1 pl-3 pr-1 text-[13px] text-[#4A4D52]">
                  <span>
                    <strong>@{replyToAuthor}</strong>님에게 답글 작성 중
                  </span>
                  <button
                    type="button"
                    onClick={() => setReplyToAuthor(null)}
                    className="flex h-9 w-11 items-center justify-center text-[#6B6E73]"
                    aria-label="답글 취소"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Avatar name={user.nickname} src={user.avatar} size={32} dark />
                <label htmlFor="post-comment-input" className="sr-only">댓글 입력</label>
                <input
                  id="post-comment-input"
                  type="text"
                  value={newCommentText}
                  onChange={e => setNewCommentText(e.target.value)}
                  onKeyDown={(e: ReactKeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter') handleAddComment(selectedPost.postId)
                  }}
                  placeholder={replyToAuthor ? `@${replyToAuthor}님에게 답글 남기기` : '댓글을 입력하세요'}
                  className="h-11 min-w-0 flex-1 rounded-[6px] border border-[#E2E2E2] bg-white px-3.5 text-[14px] text-[#25282B] outline-none transition-colors placeholder:text-[#6B6E73] focus:border-[#E60000]"
                />
                <button
                  type="button"
                  onClick={() => handleAddComment(selectedPost.postId)}
                  disabled={!newCommentText.trim()}
                  className="flex h-11 items-center gap-1.5 rounded-[6px] bg-[#25282B] px-4 text-[14px] font-bold text-white transition-opacity active:opacity-90 disabled:opacity-40"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  <span>등록</span>
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onLoginRequest?.()}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-[6px] bg-[#F2F2F2] text-[14px] font-bold text-[#25282B]"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              로그인하고 댓글 남기기
            </button>
          )}
        </div>
      </div>
    )
  }

  // ==========================================
  // 라운지 메인 피드
  // ==========================================
  return (
    <div className="relative h-full overflow-hidden bg-white text-[#25282B]">
      <div className="no-scrollbar h-full overflow-y-auto">
        <header className="border-b border-[#E2E2E2] bg-white px-5 pb-3 pt-3.5">
          <div className="mb-3 flex items-center gap-2.5">
            <img src="/logo.png" alt="" className="h-8 w-8 object-contain" />
            <div>
              <h1 className="text-[20px] font-black tracking-tight text-[#25282B]">라오타 라운지</h1>
              <p className="text-[13px] text-[#6B6E73]">라멘러들의 기록과 이야기</p>
            </div>
          </div>

          <div role="tablist" aria-label="라운지 구분" className="flex rounded-[6px] bg-[#F2F2F2] p-1">
            <button
              type="button"
              role="tab"
              aria-selected={loungeTab === 'logs'}
              onClick={() => setLoungeTab('logs')}
              className={`min-h-11 flex-1 rounded-[4px] text-[14px] font-black transition-colors ${
                loungeTab === 'logs' ? 'bg-white text-[#25282B]' : 'text-[#6B6E73]'
              }`}
            >
              라멘로그 {logs.length}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={loungeTab === 'community'}
              onClick={() => setLoungeTab('community')}
              className={`min-h-11 flex-1 rounded-[4px] text-[14px] font-black transition-colors ${
                loungeTab === 'community' ? 'bg-white text-[#25282B]' : 'text-[#6B6E73]'
              }`}
            >
              커뮤니티 {posts.length}
            </button>
          </div>
        </header>

        {/* 필터 바 */}
        {loungeTab === 'logs' ? (
          <div className="flex items-center justify-between gap-2 border-b border-[#E2E2E2] bg-white px-5 py-2">
            <div className="relative min-w-0 flex-1" ref={shopDropdownRef}>
              <button
                type="button"
                onClick={() => {
                  setIsShopDropdownOpen(prev => !prev)
                  setIsSortDropdownOpen(false)
                }}
                aria-expanded={isShopDropdownOpen}
                aria-haspopup="listbox"
                className="flex h-11 w-full items-center justify-between gap-1.5 rounded-[6px] bg-[#F2F2F2] px-3 text-[13px] font-bold text-[#25282B] transition-colors"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <Store className="h-4 w-4 shrink-0 text-[#E60000]" aria-hidden="true" />
                  <span className="truncate">{shopFilter === 'ALL' ? '전체 매장' : shopFilter}</span>
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-[#6B6E73] transition-transform ${isShopDropdownOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>

              {isShopDropdownOpen && (
                <div className="anim-fade-in-up absolute left-0 top-full z-50 mt-1.5 w-64 max-w-[calc(100vw-40px)] overflow-hidden rounded-[6px] border border-[#E2E2E2] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
                  <div className="border-b border-[#F2F2F2] p-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B6E73]" aria-hidden="true" />
                      <input
                        type="text"
                        placeholder="라멘집 검색"
                        aria-label="라멘집 검색"
                        value={shopSearchQuery}
                        onChange={e => setShopSearchQuery(e.target.value)}
                        className="h-11 w-full rounded-[6px] border border-[#E2E2E2] bg-white pl-9 pr-3 text-[14px] text-[#25282B] outline-none placeholder:text-[#6B6E73] focus:border-[#E60000]"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div role="listbox" aria-label="매장 선택" className="no-scrollbar max-h-60 divide-y divide-[#F2F2F2] overflow-y-auto">
                    <button
                      type="button"
                      role="option"
                      aria-selected={shopFilter === 'ALL'}
                      onClick={() => {
                        setShopFilter('ALL')
                        setIsShopDropdownOpen(false)
                        setShopSearchQuery('')
                      }}
                      className={`flex min-h-11 w-full items-center justify-between px-3.5 text-left text-[14px] ${
                        shopFilter === 'ALL' ? 'bg-[#FFF0F0] font-black text-[#E60000]' : 'text-[#25282B]'
                      }`}
                    >
                      <span>전체 매장</span>
                      <span className="text-[13px] text-[#6B6E73]">{logs.length}건</span>
                    </button>
                    {shopList
                      .filter(s => !shopSearchQuery.trim() || s.name.toLowerCase().includes(shopSearchQuery.toLowerCase()))
                      .map(s => {
                        const isSelected = shopFilter === s.value
                        return (
                          <button
                            key={s.value}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => {
                              setShopFilter(s.value)
                              setIsShopDropdownOpen(false)
                              setShopSearchQuery('')
                            }}
                            className={`flex min-h-11 w-full items-center justify-between px-3.5 text-left text-[14px] ${
                              isSelected ? 'bg-[#FFF0F0] font-black text-[#E60000]' : 'text-[#25282B]'
                            }`}
                          >
                            <span className="truncate font-medium">{s.name}</span>
                            <span className="ml-2 shrink-0 text-[13px] text-[#6B6E73]">{s.count}건</span>
                          </button>
                        )
                      })}
                  </div>
                </div>
              )}
            </div>

            <div className="relative shrink-0" ref={sortDropdownRef}>
              <button
                type="button"
                onClick={() => {
                  setIsSortDropdownOpen(prev => !prev)
                  setIsShopDropdownOpen(false)
                }}
                aria-expanded={isSortDropdownOpen}
                aria-haspopup="listbox"
                className="flex h-11 items-center gap-1.5 rounded-[6px] bg-[#F2F2F2] px-3 text-[13px] font-bold text-[#25282B]"
              >
                <span>{sortBy === 'LATEST' ? '최신순' : '좋아요순'}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-[#6B6E73] transition-transform ${isSortDropdownOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>

              {isSortDropdownOpen && (
                <div role="listbox" aria-label="정렬" className="anim-fade-in-up absolute right-0 top-full z-50 mt-1.5 w-36 overflow-hidden rounded-[6px] border border-[#E2E2E2] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
                  {(['LATEST', 'LIKES'] as const).map(option => {
                    const active = sortBy === option
                    return (
                      <button
                        key={option}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          setSortBy(option)
                          setIsSortDropdownOpen(false)
                        }}
                        className={`flex min-h-11 w-full items-center justify-between px-3.5 text-left text-[14px] ${
                          active ? 'bg-[#FFF0F0] font-black text-[#E60000]' : 'text-[#25282B]'
                        }`}
                      >
                        <span>{option === 'LATEST' ? '최신순' : '좋아요순'}</span>
                        {active && <Check className="h-4 w-4" aria-hidden="true" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div role="group" aria-label="게시판 분류" className="no-scrollbar flex items-center gap-1.5 overflow-x-auto border-b border-[#E2E2E2] bg-white px-5">
            {COMMUNITY_CATEGORIES.map(cat => (
              <Chip key={cat.id} active={communityCategory === cat.id} onClick={() => setCommunityCategory(cat.id)}>
                {cat.label}
              </Chip>
            ))}
          </div>
        )}

        {/* 피드 */}
        <div className="pb-24">
          {loungeTab === 'logs' && (
            <div>
              {shopFilter !== 'ALL' && (
                <div className="mx-4 my-3 flex items-center justify-between gap-2 rounded-[6px] bg-[#F2F2F2] py-1 pl-3.5 pr-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <Store className="h-4 w-4 shrink-0 text-[#E60000]" aria-hidden="true" />
                    <span className="truncate text-[14px] font-black text-[#25282B]">
                      {shopFilter} 라멘로그 {filteredLogs.length}건
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onShopClick?.(shopFilter)}
                    className="flex min-h-11 shrink-0 items-center gap-0.5 px-2 text-[13px] font-bold text-[#E60000]"
                  >
                    매장 정보
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              )}

              {filteredLogs.length === 0 && (
                <div className="px-6 py-16 text-center">
                  <RamenIcon className="mx-auto mb-3 h-8 w-8 text-[#BEBEBE]" aria-hidden="true" />
                  <p className="text-[15px] font-bold text-[#25282B]">아직 라멘로그가 없어요</p>
                  <p className="mt-1 text-[13px] text-[#6B6E73]">오늘 먹은 한 그릇을 첫 기록으로 남겨보세요.</p>
                </div>
              )}

              {filteredLogs.map(log => {
                const allTags = [...log.tasteNotes.broth, ...log.tasteNotes.noodle, ...log.tasteNotes.seasoning, ...log.tasteNotes.topping]
                const photos = log.photos && log.photos.length > 0 ? log.photos : log.imageUrl ? [log.imageUrl] : []
                const curIdx = activePhotoIdx[log.id] ?? 0
                const comments = log.comments ?? []
                const commentsOpen = expandedLogId === log.id
                const showAllComments = showAllLogCommentsId === log.id
                const visibleComments = showAllComments ? comments : comments.slice(0, 1)

                return (
                  <article key={log.id} aria-label={`${log.author.name}의 ${log.menuName} 기록`} className="border-b-8 border-[#F2F2F2] bg-white last:border-b-0">
                    {/* 작성자 */}
                    <div className="flex items-center justify-between gap-2 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={log.author.name} src={log.author.avatar} size={36} dark />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-1.5">
                            <span className="text-[14px] font-black text-[#25282B]">{log.author.name}</span>
                            <LevelTag level={log.author.level} />
                          </div>
                          <p className="text-[12px] text-[#6B6E73]">{log.visitedAt} 방문</p>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-[32px] bg-[#F2F2F2] px-2.5 py-1 text-[12px] font-bold text-[#25282B]">{log.revisit}</span>
                    </div>

                    {/* 사진 캐러셀 */}
                    {photos.length > 0 && (
                      <div className="relative aspect-[16/10] w-full select-none overflow-hidden bg-[#F2F2F2]">
                        <div
                          id={`log-photos-${log.id}`}
                          className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto scroll-smooth"
                          onScroll={e => {
                            const el = e.currentTarget
                            const idx = Math.round(el.scrollLeft / (el.clientWidth || 1))
                            if (idx !== (activePhotoIdx[log.id] ?? 0)) setActivePhotoIdx(prev => ({ ...prev, [log.id]: idx }))
                          }}
                        >
                          {photos.map((img, i) => (
                            <div key={i} className="relative h-full w-full flex-shrink-0 snap-start">
                              <img src={img} alt={`${log.menuName} 사진 ${i + 1}`} className="h-full w-full object-cover" />
                            </div>
                          ))}
                        </div>

                        <span className="pointer-events-none absolute left-2.5 top-2.5 rounded-[32px] bg-black/70 px-2.5 py-0.5 text-[12px] font-bold text-white">
                          {log.ramenType}
                        </span>

                        {photos.length > 1 && (
                          <span className="pointer-events-none absolute right-2.5 top-2.5 rounded-[32px] bg-black/70 px-2 py-0.5 text-[12px] font-bold text-white">
                            {curIdx + 1} / {photos.length}
                          </span>
                        )}

                        {photos.length > 1 && curIdx > 0 && (
                          <button
                            type="button"
                            onClick={() => handleScrollPhoto(log.id, 'prev', photos.length)}
                            className="absolute left-0 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center"
                            aria-label="이전 사진"
                          >
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white">
                              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                            </span>
                          </button>
                        )}
                        {photos.length > 1 && curIdx < photos.length - 1 && (
                          <button
                            type="button"
                            onClick={() => handleScrollPhoto(log.id, 'next', photos.length)}
                            className="absolute right-0 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center"
                            aria-label="다음 사진"
                          >
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white">
                              <ChevronRight className="h-4 w-4" aria-hidden="true" />
                            </span>
                          </button>
                        )}

                        {photos.length > 1 && (
                          <div aria-hidden="true" className="pointer-events-none absolute bottom-2.5 left-0 right-0 flex justify-center gap-1.5">
                            {photos.map((_, i) => (
                              <span key={i} className={`h-1.5 rounded-full transition-all ${curIdx === i ? 'w-4 bg-white' : 'w-1.5 bg-white/70'}`} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 본문 */}
                    <div className="space-y-2.5 px-4 pb-3 pt-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                        <h2 className="text-[17px] font-black tracking-tight text-[#25282B]">{log.menuName}</h2>
                        <button
                          type="button"
                          onClick={() => onShopClick?.(log.shop.name)}
                          className="-my-2 min-h-11 text-[13px] font-bold text-[#6B6E73] underline-offset-2 hover:text-[#25282B] hover:underline"
                        >
                          {log.shop.name}
                          {log.shop.branch ? ` · ${log.shop.branch}` : ''}
                        </button>
                      </div>

                      <p className="border-l border-[#25282B] pl-3 text-[14px] leading-relaxed text-[#25282B]">{log.note}</p>

                      {allTags.length > 0 && (
                        <ul aria-label="맛 태그" className="flex flex-wrap gap-1">
                          {allTags.map((tag, idx) => (
                            <li key={idx} className="rounded-[4px] bg-[#F2F2F2] px-2 py-0.5 text-[12px] font-bold text-[#4A4D52]">
                              #{tag}
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="flex items-center justify-between border-t border-[#F2F2F2] pt-2">
                        <span className="text-[12px] text-[#6B6E73]">{log.createdAt}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            aria-label={`${commentsOpen ? '댓글 입력 닫기' : '댓글 작성'}${comments.length ? `, 댓글 ${comments.length}개` : ''}`}
                            aria-expanded={commentsOpen}
                            aria-controls={`log-comments-${log.id}`}
                            onClick={() => handleToggleLogComments(log.id)}
                            className={`flex min-h-11 items-center gap-1.5 rounded-[32px] border px-3.5 text-[13px] font-bold transition-colors ${
                              commentsOpen ? 'border-[#25282B] bg-[#25282B] text-white' : 'border-[#E2E2E2] bg-white text-[#4A4D52]'
                            }`}
                          >
                            <MessageCircle className="h-4 w-4" aria-hidden="true" />
                            <span>{comments.length}</span>
                          </button>
                          <button
                            type="button"
                            aria-label={log.isLiked ? `공감 취소, 공감 ${log.likes}개` : `공감하기, 공감 ${log.likes}개`}
                            aria-pressed={log.isLiked}
                            onClick={() => handleToggleLogLike(log.id)}
                            className={`flex min-h-11 items-center gap-1.5 rounded-[32px] border px-3.5 text-[13px] font-bold transition-colors ${
                              log.isLiked ? 'border-[#E60000] bg-[#FFF0F0] text-[#E60000]' : 'border-[#E2E2E2] bg-white text-[#4A4D52]'
                            }`}
                          >
                            <Heart className={`h-4 w-4 ${log.isLiked ? 'fill-[#E60000] text-[#E60000]' : 'text-[#6B6E73]'}`} aria-hidden="true" />
                            <span>{log.likes}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 댓글 */}
                    <section
                      id={`log-comments-${log.id}`}
                      aria-label={`${log.menuName} 댓글`}
                      className={`border-t border-[#F2F2F2] px-4 ${commentsOpen ? 'bg-[#FAFAFA] py-3.5' : 'bg-white py-2.5'}`}
                    >
                      {comments.length > 0 && (
                        <div className="flex items-center justify-between border-b border-[#F2F2F2] pb-2.5">
                          <span className="text-[14px] font-black text-[#25282B]">
                            댓글 <span className="text-[#E60000]">{comments.length}</span>
                          </span>
                          <span className="text-[12px] text-[#6B6E73]">등록순</span>
                        </div>
                      )}

                      {comments.length > 0 ? (
                        <div id={`log-comments-list-${log.id}`} className="divide-y divide-[#F2F2F2]">
                          {visibleComments.map(comment => (
                            <div key={comment.id} className="flex items-start gap-2.5 py-3">
                              <Avatar name={comment.author.name} src={comment.author.avatar} size={28} />
                              <div className="min-w-0 flex-1">
                                <div className="mb-0.5 flex flex-wrap items-center gap-x-1.5">
                                  <span className="text-[13px] font-bold text-[#25282B]">{comment.author.name}</span>
                                  <LevelTag level={comment.author.level} />
                                  <span className="text-[12px] text-[#6B6E73]">{comment.createdAt}</span>
                                </div>
                                <p className="text-[14px] leading-relaxed text-[#25282B]">
                                  {comment.parentAuthorName && <span className="mr-1.5 font-bold text-[#E60000]">@{comment.parentAuthorName}</span>}
                                  {comment.content}
                                </p>
                              </div>
                            </div>
                          ))}
                          {comments.length > 1 && (
                            <button
                              type="button"
                              aria-expanded={showAllComments}
                              aria-controls={`log-comments-list-${log.id}`}
                              onClick={() => setShowAllLogCommentsId(showAllComments ? null : log.id)}
                              className="flex min-h-11 w-full items-center justify-center gap-1 text-[13px] font-bold text-[#4A4D52] transition-colors hover:text-[#25282B]"
                            >
                              <span>{showAllComments ? '댓글 접기' : `댓글 ${comments.length - 1}개 더 보기`}</span>
                              <ChevronDown className={`h-4 w-4 transition-transform ${showAllComments ? 'rotate-180' : ''}`} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      ) : commentsOpen ? (
                        <p className="py-4 text-center text-[13px] text-[#6B6E73]">첫 댓글을 남겨 대화를 시작해 보세요.</p>
                      ) : null}

                      {!user ? (
                        <button
                          type="button"
                          onClick={() => onLoginRequest?.()}
                          className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-[6px] bg-[#F2F2F2] text-[14px] font-bold text-[#25282B]"
                        >
                          <LogIn className="h-4 w-4" aria-hidden="true" />
                          로그인하고 댓글 남기기
                        </button>
                      ) : !commentsOpen ? (
                        <button
                          type="button"
                          aria-label="댓글 입력창 열기"
                          onClick={() => handleToggleLogComments(log.id)}
                          className="mt-2 flex min-h-11 w-full items-center gap-2 rounded-[6px] border border-[#E2E2E2] bg-white px-3 text-left transition-colors hover:border-[#BEBEBE]"
                        >
                          <Avatar name={user.nickname} src={user.avatar} size={24} dark />
                          <span className="min-w-0 flex-1 text-[14px] text-[#6B6E73]">이 기록에 댓글을 남겨보세요</span>
                          <MessageCircle className="h-4 w-4 shrink-0 text-[#6B6E73]" aria-hidden="true" />
                        </button>
                      ) : (
                        <>
                          <div className="mt-2 flex items-center gap-2">
                            <Avatar name={user.nickname} src={user.avatar} size={28} dark />
                            <input
                              ref={logCommentInputRef}
                              type="text"
                              value={newLogCommentText}
                              maxLength={300}
                              onChange={event => {
                                setNewLogCommentText(event.target.value)
                                if (logCommentError) setLogCommentError(null)
                              }}
                              onKeyDown={event => {
                                if (event.key === 'Enter') {
                                  event.preventDefault()
                                  handleAddLogComment(log.id)
                                }
                              }}
                              placeholder="이 기록에 댓글을 남겨보세요"
                              aria-label={`${log.menuName} 댓글 입력`}
                              aria-invalid={Boolean(logCommentError)}
                              aria-describedby={logCommentError ? `log-comment-error-${log.id}` : undefined}
                              className="h-11 min-w-0 flex-1 rounded-[6px] border border-[#E2E2E2] bg-white px-3 text-[14px] text-[#25282B] outline-none placeholder:text-[#6B6E73] focus:border-[#E60000]"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddLogComment(log.id)}
                              disabled={!newLogCommentText.trim()}
                              aria-label="댓글 등록"
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[6px] bg-[#25282B] text-white transition-opacity active:opacity-90 disabled:opacity-40"
                            >
                              <Send className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                          {logCommentError && (
                            <p id={`log-comment-error-${log.id}`} role="alert" className="mt-1.5 text-[13px] font-bold text-[#E60000]">
                              {logCommentError}
                            </p>
                          )}
                        </>
                      )}
                    </section>
                  </article>
                )
              })}

              {filteredLogs.length > 0 && (
                <p className="px-6 pb-3 pt-8 text-center text-[13px] text-[#6B6E73]">오늘 방문한 라멘집이 있다면 아래 버튼으로 라멘로그를 남겨보세요</p>
              )}
            </div>
          )}

          {loungeTab === 'community' && (
            <div>
              {filteredPosts.length === 0 && (
                <div className="px-6 py-16 text-center">
                  <MessageCircle className="mx-auto mb-3 h-8 w-8 text-[#BEBEBE]" aria-hidden="true" />
                  <p className="text-[15px] font-bold text-[#25282B]">아직 글이 없어요</p>
                  <p className="mt-1 text-[13px] text-[#6B6E73]">첫 글을 올려 라멘러들과 이야기를 시작해 보세요.</p>
                </div>
              )}
              <div className="bg-white">
                {filteredPosts.map(post => (
                  <article key={post.postId} className="border-b border-[#F2F2F2] px-4 py-2 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setSelectedPostId(post.postId)}
                      className="block w-full text-left"
                    >
                      <div className="mb-1.5 flex items-center gap-1.5 pt-1">
                        <CategoryBadge label={post.categoryLabel} />
                        {post.likeCount >= POPULAR_THRESHOLD && <PopularBadge />}
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h2 className="truncate text-[15px] font-bold leading-snug text-[#25282B]">{post.title}</h2>
                          <p className="mt-0.5 truncate text-[13px] leading-normal text-[#6B6E73]">{post.content}</p>
                        </div>
                        {post.imageUrl && (
                          <div className="h-13 w-13 shrink-0 overflow-hidden rounded-[6px] bg-[#F2F2F2]">
                            <img src={post.imageUrl} alt="" className="h-full w-full object-cover" />
                          </div>
                        )}
                      </div>
                    </button>

                    <div className="flex items-center justify-between gap-2 text-[12px] font-medium text-[#6B6E73]">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="max-w-[140px] truncate font-bold text-[#4A4D52]">{post.authorName}</span>
                        <LevelTag level={post.authorLevel} />
                        <span aria-hidden="true">·</span>
                        <span>{formatDateYMD(post.createdAt)}</span>
                      </div>

                      <div className="flex shrink-0 items-center gap-1 font-bold">
                        <button
                          type="button"
                          onClick={() => handleTogglePostLike(post.postId)}
                          aria-pressed={post.isLiked}
                          aria-label={post.isLiked ? `좋아요 취소, ${post.likeCount}개` : `좋아요, ${post.likeCount}개`}
                          className={`flex min-h-11 min-w-11 items-center justify-center gap-1 px-1 transition-colors ${post.isLiked ? 'text-[#E60000]' : 'hover:text-[#E60000]'}`}
                        >
                          <Heart className={`h-3.5 w-3.5 ${post.isLiked ? 'fill-[#E60000] text-[#E60000]' : ''}`} aria-hidden="true" />
                          <span>{post.likeCount}</span>
                        </button>
                        <span className="flex items-center gap-1 px-1">
                          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          <span className="sr-only">댓글</span>
                          <span>{post.commentCount}</span>
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {filteredPosts.length > 0 && <p className="py-6 text-center text-[13px] font-medium text-[#6B6E73]">모든 글을 확인했습니다</p>}
            </div>
          )}
        </div>
      </div>

      {toastMessage && (
        <div
          role="status"
          className="anim-fade-in-up pointer-events-none absolute left-1/2 top-20 z-50 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-[32px] bg-[#25282B] px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
        >
          <Check className="h-4 w-4 text-[#E60000]" aria-hidden="true" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 플로팅 버튼 */}
      <button
        type="button"
        onClick={() => (loungeTab === 'logs' ? onRecordClick() : openWrite())}
        className="absolute bottom-4 right-4 z-30 flex h-12 items-center gap-2 rounded-[60px] bg-[#E60000] px-4 text-[14px] font-bold text-white shadow-[0_4px_16px_rgba(0,0,0,0.12)] transition-opacity active:opacity-90"
      >
        {loungeTab === 'logs' ? (
          <>
            <Plus className="h-4 w-4 stroke-[2.5]" aria-hidden="true" />
            <span>기록하기</span>
          </>
        ) : (
          <>
            <PenSquare className="h-4 w-4" aria-hidden="true" />
            <span>글쓰기</span>
          </>
        )}
      </button>
    </div>
  )
}
