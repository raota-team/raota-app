import { useState, useMemo, useRef, useEffect } from 'react'
import {
  HelpCircle,
  Heart,
  MessageCircle,
  Eye,
  CornerDownRight,
  Send,
  Store,
  Soup,
  Lightbulb,
  Sparkles,
  MapPin,
  Search,
  PenSquare,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Plus,
  MessageSquare,
  Flame,
  Image as ImageIcon,
  X,
} from 'lucide-react'
import type { RamenLog } from '../types'


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

export interface CommunityPost {
  postId: number
  category: 'REVIEW' | 'TIP' | 'QUESTION' | 'FREE' | 'POPULAR'
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

// ----------------------------------------------------
// 🌟 raota-front 커뮤니티 Mock 데이터
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
    isLiked: true,
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
        isLiked: true,
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

const RAMEN_TYPE_FILTERS = ['전체', '쇼유', '돈코츠', '시오', '미소', '츠케멘', '기타']
const COMMUNITY_CATEGORIES = [
  { id: 'all', label: '전체' },
  { id: 'POPULAR', label: '인기' },
  { id: 'REVIEW', label: '맛집후기' },
  { id: 'TIP', label: '꿀팁' },
  { id: 'QUESTION', label: 'Q&A' },
  { id: 'FREE', label: '자유' },
]

const WRITE_CATEGORIES = [
  { id: 'REVIEW', name: '맛집후기' },
  { id: 'TIP', name: '꿀팁' },
  { id: 'QUESTION', name: 'Q&A' },
  { id: 'FREE', name: '자유' },
]

const CATEGORY_COLORS: Record<string, string> = {
  REVIEW: 'bg-emerald-50 text-emerald-700',
  TIP: 'bg-blue-50 text-blue-700',
  QUESTION: 'bg-amber-50 text-amber-800',
  FREE: 'bg-stone-100 text-stone-600',
  POPULAR: 'bg-red-50 text-[#E60000]',
}

function getCategoryBadgeClass(category?: string) {
  if (!category) return 'bg-stone-100 text-stone-600'
  return CATEGORY_COLORS[category] || 'bg-stone-100 text-stone-600'
}


const WRITE_SHOP_OPTIONS = [
  { name: '멘야준', location: '망원 본점' },
  { name: '오레노라멘', location: '마포 본점' },
  { name: '후쿠 라멘', location: '합정점' },
  { name: '하쿠텐', location: '연남점' },
  { name: '세상끝의라멘', location: '합정점' },
  { name: '담택', location: '합정 본점' },
  { name: '멘지', location: '망원점' },
  { name: '이리에라멘', location: '합정점' },
  { name: '사루카메', location: '연남 본점' },
  { name: '라멘베라보', location: '망원점' },
]

const SAMPLE_IMAGE_PRESETS = [
  {
    name: '특제 쇼유 라멘',
    url: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=600&fit=crop&auto=format&q=80',
  },
  {
    name: '이에케 라멘',
    url: 'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=600&fit=crop&auto=format&q=80',
  },
  {
    name: '토리파이탄',
    url: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=600&fit=crop&auto=format&q=80',
  },
]

export default function LoungeScreen({ logs, onRecordClick, onShopClick }: Props) {
  const [loungeTab, setLoungeTab] = useState<'logs' | 'community'>('logs')
  const [shopFilter, setShopFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState<'LATEST' | 'LIKES'>('LATEST')
  const [isShopDropdownOpen, setIsShopDropdownOpen] = useState(false)
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false)
  const [shopSearchQuery, setShopSearchQuery] = useState('')
  const shopDropdownRef = useRef<HTMLDivElement>(null)
  const sortDropdownRef = useRef<HTMLDivElement>(null)
  const [communityCategory, setCommunityCategory] = useState('all')
  const [allLogs, setAllLogs] = useState<RamenLog[]>(logs)
  const [posts, setPosts] = useState<CommunityPost[]>(INITIAL_COMMUNITY_POSTS)
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null)
  const [activePhotoIdx, setActivePhotoIdx] = useState<Record<number, number>>({})
  const [newCommentText, setNewCommentText] = useState('')
  const [replyToAuthor, setReplyToAuthor] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // 📝 커뮤니티 새 글 작성 모달 상태
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false)
  const [writeCategory, setWriteCategory] = useState('REVIEW')
  const [writeTitle, setWriteTitle] = useState('')
  const [writeContent, setWriteContent] = useState('')
  const [writeSelectedShop, setWriteSelectedShop] = useState<{ name: string; location: string } | null>(null)
  const [writeImagePreview, setWriteImagePreview] = useState<string | null>(null)
  const [isWriteShopDropdownOpen, setIsWriteShopDropdownOpen] = useState(false)
  const [writeShopSearchQuery, setWriteShopSearchQuery] = useState('')
  const writeShopDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shopDropdownRef.current && !shopDropdownRef.current.contains(event.target as Node)) {
        setIsShopDropdownOpen(false)
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setIsSortDropdownOpen(false)
      }
      if (writeShopDropdownRef.current && !writeShopDropdownRef.current.contains(event.target as Node)) {
        setIsWriteShopDropdownOpen(false)
      }
    }
    if (isShopDropdownOpen || isSortDropdownOpen || isWriteShopDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isShopDropdownOpen, isSortDropdownOpen, isWriteShopDropdownOpen])

  const handleToggleLogLike = (id: number) => {
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

  const handleTogglePostLike = (postId: number) => {
    setPosts(prev =>
      prev.map(p =>
        p.postId === postId
          ? {
              ...p,
              isLiked: !p.isLiked,
              likeCount: p.isLiked ? p.likeCount - 1 : p.likeCount + 1,
            }
          : p
      )
    )
    if (selectedPost && selectedPost.postId === postId) {
      setSelectedPost(prev =>
        prev
          ? {
              ...prev,
              isLiked: !prev.isLiked,
              likeCount: prev.isLiked ? prev.likeCount - 1 : prev.likeCount + 1,
            }
          : null
      )
    }
  }

  const handleAddComment = (postId: number) => {
    if (!newCommentText.trim()) return
    const newComment: PostComment = {
      id: Date.now(),
      authorNickname: '뿡',
      authorLevel: '라멘집 단골',
      createdAt: '방금 전',
      content: newCommentText.trim(),
      isReply: !!replyToAuthor,
      parentAuthorNickname: replyToAuthor ?? undefined,
      likes: 0,
      isLiked: false,
    }

    setPosts(prev =>
      prev.map(p => {
        if (p.postId !== postId) return p
        const updated = {
          ...p,
          commentCount: p.commentCount + 1,
          comments: [...p.comments, newComment],
        }
        if (selectedPost && selectedPost.postId === postId) {
          setSelectedPost(updated)
        }
        return updated
      })
    )
    setNewCommentText('')
    setReplyToAuthor(null)
  }

  // 📝 커뮤니티 새 글 등록 핸들러 (raota-front 스펙)
  const handleCreateCommunityPost = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!writeTitle.trim() || !writeContent.trim()) return

    const categoryObj = WRITE_CATEGORIES.find(c => c.id === writeCategory)
    const newPost: CommunityPost = {
      postId: Date.now(),
      category: writeCategory as any,
      categoryLabel: categoryObj?.name || '자유게시판',
      title: writeTitle.trim(),
      content: writeContent.trim(),
      detailedContent: [writeContent.trim()],
      authorId: 1,
      authorName: '뿡',
      authorLevel: '라멘집 단골',
      createdAt: '방금 전',
      likeCount: 0,
      commentCount: 0,
      viewCount: 1,
      isLiked: false,
      shopName: writeCategory === 'REVIEW' && writeSelectedShop ? writeSelectedShop.name : undefined,
      imageUrl: writeImagePreview || undefined,
      comments: [],
    }

    setPosts(prev => [newPost, ...prev])
    setIsWriteModalOpen(false)
    setWriteTitle('')
    setWriteContent('')
    setWriteCategory('REVIEW')
    setWriteSelectedShop(null)
    setWriteImagePreview(null)
    setCommunityCategory('all')
    setLoungeTab('community')
    setToastMessage('커뮤니티에 새 글이 성공적으로 등록되었습니다.')
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handleScrollPhoto = (logId: number, direction: 'prev' | 'next', total: number) => {
    const container = document.getElementById(`log-photos-${logId}`)
    if (!container) return
    const current = activePhotoIdx[logId] ?? 0
    const nextIdx = direction === 'next' ? Math.min(total - 1, current + 1) : Math.max(0, current - 1)
    container.scrollTo({
      left: nextIdx * container.clientWidth,
      behavior: 'smooth',
    })
    setActivePhotoIdx(prev => ({ ...prev, [logId]: nextIdx }))
  }

  const shopList = useMemo(() => {
    const shopMap = new Map<string, number>()
    allLogs.forEach(l => {
      const sName = l.shop?.name || '기타'
      shopMap.set(sName, (shopMap.get(sName) || 0) + 1)
    })
    return [
      { name: '전체 매장', value: 'ALL', count: allLogs.length },
      ...Array.from(shopMap.entries()).map(([name, count]) => ({
        name,
        value: name,
        count,
      })),
    ]
  }, [allLogs])

  const filteredLogs = useMemo(() => {
    let result = shopFilter === 'ALL'
      ? [...allLogs]
      : allLogs.filter(l => l.shop?.name === shopFilter)

    if (sortBy === 'LIKES') {
      result.sort((a, b) => b.likes - a.likes)
    } else {
      result.sort((a, b) => b.id - a.id)
    }
    return result
  }, [allLogs, shopFilter, sortBy])

  const filteredPosts = useMemo(() => {
    if (communityCategory === 'all') return posts
    if (communityCategory === 'POPULAR') {
      return posts.filter(p => p.likeCount >= 30).slice().sort((a, b) => b.likeCount - a.likeCount)
    }
    return posts.filter(p => p.category === communityCategory)
  }, [posts, communityCategory])

  // ==========================================
  // 🌟 raota-front 기반 커뮤니티 글쓰기 화면 (CommunityWritePage)
  // ==========================================
  if (isWriteModalOpen) {
    return (
      <div className="h-full flex flex-col bg-[#FFFFFF] text-[#25282B] relative">
        {/* 1. 상단 헤더: 취소 + 타이틀 + 등록 버튼 */}
        <header className="flex-shrink-0 bg-white/95 backdrop-blur-md px-4 pt-3.5 pb-3.5 border-b border-[#E2E2E2] flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setIsWriteModalOpen(false)
              setWriteTitle('')
              setWriteContent('')
              setWriteCategory('REVIEW')
              setWriteSelectedShop(null)
              setWriteImagePreview(null)
            }}
            className="flex items-center gap-1 text-xs font-bold text-stone-500 hover:text-[#25282B] transition-colors py-1 px-1.5 -ml-1 rounded-sm"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>취소</span>
          </button>

          <h1 className="text-[16px] font-black text-[#25282B] tracking-tight">새 글 작성</h1>

          <button
            type="button"
            disabled={!writeTitle.trim() || !writeContent.trim()}
            onClick={handleCreateCommunityPost}
            className="text-xs font-black bg-[#E60000] hover:bg-[#CC0000] text-white px-3 py-1.5 rounded-sm disabled:opacity-40 disabled:pointer-events-none transition-all active:scale-95 shadow-xs"
          >
            등록
          </button>
        </header>

        {/* 글쓰기 본문 폼: 경계선 박스를 걷어낸 보더리스 클린 에디터 */}
        <form onSubmit={handleCreateCommunityPost} className="flex-1 overflow-y-auto no-scrollbar px-4 py-3 space-y-4 pb-12 bg-white">
          
          {/* 1. 카테고리 칩 선택 (보더 제거, 톤온톤 태그 스타일) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {WRITE_CATEGORIES.map(t => {
              const isSelected = writeCategory === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setWriteCategory(t.id as any)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${
                    isSelected
                      ? 'bg-[#25282B] text-white shadow-xs'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {t.id === 'REVIEW' && <Soup className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-[#E60000]'}`} />}
                  {t.id === 'TIP' && <Lightbulb className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-amber-500'}`} />}
                  {t.id === 'QUESTION' && <HelpCircle className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-blue-500'}`} />}
                  {t.id === 'FREE' && <Sparkles className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-stone-500'}`} />}
                  <span>{t.name}</span>
                </button>
              )
            })}
          </div>

          {/* 2. 연관 라멘집 선택 (선택 사항) */}
          <div className="relative" ref={writeShopDropdownRef}>
            <button
              type="button"
              onClick={() => setIsWriteShopDropdownOpen(prev => !prev)}
              className={`w-full flex h-9 items-center justify-between rounded-[8px] px-3 text-xs font-bold transition-all ${
                writeSelectedShop
                  ? 'bg-red-50 text-[#E60000]'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200/80'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Store className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{writeSelectedShop ? `${writeSelectedShop.name} (${writeSelectedShop.location})` : '연관 라멘집 태그 (선택)'}</span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                  isWriteShopDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* 매장 검색 팝오버 */}
            {isWriteShopDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-40 rounded-[10px] bg-white shadow-xl overflow-hidden border border-stone-200 anim-fade-in-up">
                <div className="p-2 border-b border-stone-100 bg-stone-50">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                    <input
                      type="text"
                      placeholder="라멘집 검색..."
                      value={writeShopSearchQuery}
                      onChange={e => setWriteShopSearchQuery(e.target.value)}
                      className="w-full h-8 rounded-[6px] border border-stone-200 bg-white pl-8 pr-2.5 text-xs font-medium text-[#25282B] placeholder-stone-400 focus:border-[#E60000] outline-none"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="max-h-48 overflow-y-auto no-scrollbar divide-y divide-stone-100">
                  <button
                    type="button"
                    onClick={() => {
                      setWriteSelectedShop(null)
                      setIsWriteShopDropdownOpen(false)
                    }}
                    className={`w-full px-3.5 py-2 text-left text-xs hover:bg-stone-50 ${
                      !writeSelectedShop ? 'font-bold text-[#E60000] bg-red-50' : 'text-[#25282B]'
                    }`}
                  >
                    선택 안함 (직접 작성)
                  </button>
                  {WRITE_SHOP_OPTIONS
                    .filter(s => !writeShopSearchQuery.trim() || s.name.toLowerCase().includes(writeShopSearchQuery.toLowerCase()))
                    .map(s => {
                      const isSelected = writeSelectedShop?.name === s.name
                      return (
                        <button
                          key={s.name}
                          type="button"
                          onClick={() => {
                            setWriteSelectedShop(s)
                            setIsWriteShopDropdownOpen(false)
                            setWriteShopSearchQuery('')
                          }}
                          className={`w-full px-3.5 py-2.5 text-left text-xs hover:bg-stone-50 transition-colors flex items-center justify-between ${
                            isSelected ? 'font-bold text-[#E60000] bg-red-50' : 'text-[#25282B]'
                          }`}
                        >
                          <div className="font-bold">{s.name}</div>
                          <div className="text-[11px] text-stone-400">{s.location}</div>
                        </button>
                      )
                    })}
                </div>
              </div>
            )}
          </div>

          {/* 3. 제목 & 본문 입력 (박스 없이 매끄러운 캔버스 스타일) */}
          <div className="pt-2 border-b border-stone-100 pb-3">
            <input
              type="text"
              value={writeTitle}
              onChange={e => setWriteTitle(e.target.value)}
              placeholder="제목을 입력하세요"
              maxLength={100}
              className="w-full text-[17px] font-black text-[#25282B] placeholder-stone-400 outline-none bg-transparent"
            />
          </div>

          <div className="min-h-[160px]">
            <textarea
              rows={8}
              value={writeContent}
              onChange={e => setWriteContent(e.target.value)}
              placeholder="라멘에 대한 생생한 이야기를 들려주세요 (육수 농도, 면 삶기, 웨이팅 팁 등)"
              className="w-full text-[14px] text-[#25282B] placeholder-stone-400 outline-none bg-transparent leading-relaxed resize-none"
            />
          </div>

          {/* 4. 대표 사진 첨부 (박스 제거, 인라인 썸네일 & 버튼 형태) */}
          <div className="pt-3 border-t border-stone-100 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-stone-400">사진 첨부 (선택)</span>
              {writeImagePreview && (
                <button
                  type="button"
                  onClick={() => setWriteImagePreview(null)}
                  className="text-[11px] font-bold text-[#E60000] hover:underline"
                >
                  사진 삭제
                </button>
              )}
            </div>

            {writeImagePreview ? (
              <div className="relative rounded-[12px] overflow-hidden bg-stone-100 max-h-52 w-full">
                <img src={writeImagePreview} alt="Preview" className="w-full max-h-52 object-cover" />
                <button
                  type="button"
                  onClick={() => setWriteImagePreview(null)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center text-xs font-bold transition-colors"
                  aria-label="사진 제거"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="flex items-center gap-2 px-3.5 py-2.5 rounded-[8px] bg-stone-50 hover:bg-stone-100 cursor-pointer transition-colors group w-fit">
                  <ImageIcon className="w-4 h-4 text-stone-500 group-hover:text-[#E60000] transition-colors" />
                  <span className="text-xs font-bold text-stone-600 group-hover:text-[#25282B]">기기에서 사진 선택</span>
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
                    className="hidden"
                  />
                </label>

                {/* 빠른 추천 사진 프리셋 칩 */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-stone-400 font-medium shrink-0">샘플:</span>
                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                    {SAMPLE_IMAGE_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setWriteImagePreview(preset.url)}
                        className="py-1 px-2 rounded-full bg-stone-100 hover:bg-red-50 hover:text-[#E60000] text-[10px] font-medium text-stone-600 truncate transition-colors"
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 5. 하단 등록 버튼 */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={!writeTitle.trim() || !writeContent.trim()}
              className="w-full h-12 rounded-[12px] bg-[#E60000] hover:bg-[#CC0000] text-white font-bold text-sm disabled:opacity-30 disabled:pointer-events-none active:scale-98 transition-all shadow-md flex items-center justify-center gap-2"
            >
              <PenSquare className="w-4 h-4" />
              <span>글 작성 완료</span>
            </button>
          </div>

          <div className="h-6" />
        </form>
      </div>
    )
  }

  // ==========================================
  // 🌟 raota-front 레포지토리 기반 커뮤니티 상세 화면 (CommunityDetailClient)
  // ==========================================
  if (selectedPost) {
    return (
      <div className="h-full flex flex-col bg-[#FFFFFF] text-[#25282B] relative">
        
        {/* 1. 상단 헤더: 뒤로가기 + 카테고리 뱃지 */}
        <header className="flex-shrink-0 bg-white/95 backdrop-blur-md px-4 pt-3.5 pb-3.5 border-b border-stone-200 flex items-center justify-between">
          <button
            onClick={() => { setSelectedPost(null); setReplyToAuthor(null) }}
            className="flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-[#25282B] transition-colors active:scale-95 py-1 px-1.5 -ml-1 rounded-sm"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>목록으로</span>
          </button>


          <div className="flex items-center gap-1.5">
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-[4px] ${getCategoryBadgeClass(selectedPost.category)}`}>
              {selectedPost.categoryLabel}
            </span>
            {selectedPost.likeCount >= 30 && (
              <span className="text-[10.5px] font-black px-2 py-0.5 rounded-[4px] bg-red-50 text-[#E60000] flex items-center gap-0.5">
                🔥 인기
              </span>
            )}
          </div>
        </header>

        {/* 2. 게시글 본문 & 댓글 영역 스크롤 (보더리스 스트림) */}
        <div className="flex-1 overflow-y-auto no-scrollbar bg-white">
          
          {/* 게시글 메인 아티클 */}
          <article className="px-5 py-4 space-y-3.5 border-b-8 border-[#F6F6F8]">
            
            {/* 작성자 정보 바 */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center">
                  <Soup className="w-4 h-4 text-[#E60000]" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13.5px] font-bold text-[#25282B]">{selectedPost.authorName}</span>
                    <span className="text-[10px] font-bold text-[#E60000] bg-[#E60000]/10 px-1.5 py-0.2 rounded-sm">
                      {cleanGradeTitle(selectedPost.authorLevel)}
                    </span>
                  </div>
                  <p className="font-mono text-[10px] text-stone-400">{selectedPost.createdAt}</p>
                </div>
              </div>

              {/* 연관 매장 바로가기 태그 */}
              {selectedPost.shopName && (
                <button
                  onClick={() => onShopClick && onShopClick(selectedPost.shopName!)}
                  className="flex items-center gap-1 text-[11px] font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 px-2.5 py-1 rounded-[6px] transition-colors"
                >
                  <Store className="w-3.5 h-3.5 text-[#E60000]" />
                  <span>{selectedPost.shopName}</span>
                </button>
              )}
            </div>

            {/* 글 제목 & 본문 */}
            <div className="space-y-3 pt-1">
              <h1 className="text-[18px] font-black text-[#25282B] leading-snug tracking-tight">
                {selectedPost.title}
              </h1>

              <div className="text-[13.5px] text-[#25282B] leading-relaxed space-y-2.5">
                {selectedPost.detailedContent ? (
                  selectedPost.detailedContent.map((para, i) => (
                    <div
                      key={i}
                      className={
                        para.startsWith('🥇') || para.startsWith('🥈') || para.startsWith('🥉')
                          ? 'p-3 bg-stone-50 rounded-[8px] border border-stone-200 text-[12.5px]'
                          : ''
                      }
                    >
                      <p className="whitespace-pre-line">{para}</p>
                    </div>
                  ))
                ) : (
                  <p>{selectedPost.content}</p>
                )}
              </div>

              {/* 첨부된 대표 사진 */}
              {selectedPost.imageUrl && (
                <div className="rounded-[10px] overflow-hidden border border-stone-200 aspect-[16/10] bg-stone-100 mt-2">
                  <img src={selectedPost.imageUrl} alt={selectedPost.title} className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            {/* 하단 좋아요/댓글/조회수 Engagement 바 */}
            <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
              <button
                onClick={() => handleTogglePostLike(selectedPost.postId)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-bold border transition-all active:scale-95 ${
                  selectedPost.isLiked
                    ? 'bg-[#E60000]/10 border-[#E60000] text-[#E60000]'
                    : 'bg-white border-stone-200 text-stone-600 hover:border-stone-400'
                }`}
              >
                <Heart className={`w-4 h-4 ${selectedPost.isLiked ? 'fill-[#E60000] text-[#E60000]' : ''}`} />
                <span>좋아요 {selectedPost.likeCount}</span>
              </button>

              <div className="flex items-center gap-3 text-xs font-bold text-stone-400">
                <span className="flex items-center gap-1">
                  <MessageCircle className="w-3.5 h-3.5" />
                  {selectedPost.commentCount}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" />
                  {selectedPost.viewCount}
                </span>
              </div>
            </div>
          </article>

          {/* 댓글 목록 섹션 (보더리스 스트림) */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <span className="text-[13.5px] font-black text-[#25282B]">
                댓글 <span className="text-[#E60000]">{selectedPost.comments.length}</span>
              </span>
              <span className="text-[10.5px] text-stone-400 font-mono">등록순</span>
            </div>

            <div className="divide-y divide-stone-100">
              {selectedPost.comments.map((comment) => (
                <div
                  key={comment.id}
                  className={`py-3.5 ${comment.isReply ? 'pl-7 bg-stone-50/50' : ''}`}
                >
                  <div className="flex items-start gap-2.5">
                    {comment.isReply && (
                      <CornerDownRight className="mt-1 w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                    )}

                    <div className="w-7 h-7 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center text-[10px] font-bold text-[#25282B] flex-shrink-0">
                      {comment.authorNickname[0]}
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[12.5px] font-bold text-[#25282B]">{comment.authorNickname}</span>
                          {comment.authorLevel && (
                            <span className="text-[9.5px] font-bold text-[#E60000] bg-[#E60000]/10 px-1.5 py-0.2 rounded-full">
                              {cleanGradeTitle(comment.authorLevel)}
                            </span>
                          )}
                          <span className="font-mono text-[9.5px] text-stone-400">{comment.createdAt}</span>
                        </div>
                        
                        {!comment.isReply && (
                          <button
                            type="button"
                            onClick={() => setReplyToAuthor(comment.authorNickname)}
                            className="text-[10.5px] font-bold text-stone-500 hover:text-[#E60000] transition-colors"
                          >
                            답글
                          </button>
                        )}
                      </div>

                      <p className="text-[12.5px] text-[#25282B] leading-relaxed">
                        {comment.parentAuthorNickname && (
                          <span className="mr-1.5 rounded-sm bg-stone-200 px-1 py-0.2 text-[10px] font-bold text-[#25282B]">
                            @{comment.parentAuthorNickname}
                          </span>
                        )}
                        {comment.content}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="h-16" />
        </div>

        {/* 3. 하단 고정 댓글 작성 인풋 바 */}
        <div className="flex-shrink-0 bg-white/98 backdrop-blur-md p-3 px-4 border-t border-stone-200">
          {replyToAuthor && (
            <div className="flex items-center justify-between mb-2 px-1 text-[11px] text-stone-600 bg-stone-100 py-1 px-2.5 rounded-sm">
              <span><strong>@{replyToAuthor}</strong>님에게 답글 작성 중</span>
              <button onClick={() => setReplyToAuthor(null)} className="text-stone-400 hover:text-stone-700 font-bold">✕</button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newCommentText}
              onChange={e => setNewCommentText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddComment(selectedPost.postId)
              }}
              placeholder={replyToAuthor ? `@${replyToAuthor}님에게 답글 남기기...` : '댓글을 입력하세요...'}
              className="flex-1 h-10 px-3.5 bg-stone-50 border border-stone-200 rounded-sm text-[12px] text-[#25282B] placeholder-stone-400 outline-none focus:border-[#E60000] transition-colors"
            />
            <button
              onClick={() => handleAddComment(selectedPost.postId)}
              disabled={!newCommentText.trim()}
              className="h-10 px-4 rounded-sm bg-[#25282B] text-white font-bold text-[12px] disabled:opacity-40 disabled:pointer-events-none active:scale-95 hover:bg-[#1A1C1E] transition-all flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>등록</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================
  // 🌟 라운지 메인 피드 (라멘로그 & 커뮤니티 탭)
  // ==========================================
  return (
    <div className="h-full relative overflow-hidden bg-[#FFFFFF] text-[#25282B]">
      <div className="h-full overflow-y-auto no-scrollbar">
        
        {/* 1. 상단 라운지 마스터 헤더 */}
        <header className="bg-white px-5 pt-3.5 pb-3.5 border-b border-[#E2E2E2]">
        <div className="flex items-center gap-2.5 mb-3">
          <img src="/logo.png" alt="RAOTA" className="w-8 h-8 object-contain" />
          <div>
            <h1 className="text-[20px] font-black tracking-tight text-[#25282B]">
              라오타 라운지
            </h1>
            <p className="text-[10px] text-[#7E7E7E]">라멘러들의 실시간 기록 & 커뮤니티</p>
          </div>
        </div>

        {/* 서브 세그먼트 탭: [라멘로그 (완식후기)] | [커뮤니티] */}
        <div className="flex bg-[#F2F2F2] p-1 rounded-[6px]">
          <button
            onClick={() => setLoungeTab('logs')}
            className={`flex-1 py-1.5 text-[12px] font-black rounded-[4px] transition-all ${
              loungeTab === 'logs'
                ? 'bg-white text-[#25282B] shadow-xs'
                : 'text-[#7E7E7E] hover:text-[#25282B]'
            }`}
          >
            라멘로그 ({allLogs.length})
          </button>
          <button
            onClick={() => setLoungeTab('community')}
            className={`flex-1 py-1.5 text-[12px] font-black rounded-[4px] transition-all ${
              loungeTab === 'community'
                ? 'bg-white text-[#25282B] shadow-xs'
                : 'text-[#7E7E7E] hover:text-[#25282B]'
            }`}
          >
            커뮤니티 ({posts.length})
          </button>
        </div>
      </header>

      {/* 2. 카테고리 / 매장 & 정렬 필터 바 */}
      {loungeTab === 'logs' ? (
        <div className="flex-shrink-0 bg-white border-b border-[#E2E2E2] px-5 py-2.5 flex items-center justify-between gap-2.5">
          {/* 좌측: 매장 선택 커스텀 검색 드롭다운 (raota-front 스펙) */}
          <div className="relative flex-1 min-w-0" ref={shopDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setIsShopDropdownOpen(prev => !prev)
                setIsSortDropdownOpen(false)
              }}
              aria-expanded={isShopDropdownOpen}
              className="w-full flex h-8 items-center justify-between gap-1.5 rounded-sm border border-stone-200 bg-[#F2F2F2] hover:bg-[#EAEAEA] hover:border-[#E60000] px-2.5 py-1 text-[11px] font-bold text-[#25282B] transition-colors"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Store className="w-3.5 h-3.5 text-[#E60000] shrink-0" />
                <span className="truncate">
                  {shopFilter === 'ALL' ? '전체 매장' : shopFilter}
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-stone-400 shrink-0 transition-transform duration-200 ${
                  isShopDropdownOpen ? 'rotate-180 text-[#E60000]' : ''
                }`}
              />
            </button>


            {/* 드롭다운 팝오버 메뉴 */}
            {isShopDropdownOpen && (
              <div className="absolute left-0 top-full mt-1.5 z-50 w-60 rounded-sm border border-stone-300 bg-white shadow-xl overflow-hidden anim-fade-in-up">
                {/* 검색창 인풋 바 */}
                <div className="p-2 border-b border-stone-100 bg-stone-50">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                    <input
                      type="text"
                      placeholder="라멘집 검색..."
                      value={shopSearchQuery}
                      onChange={e => setShopSearchQuery(e.target.value)}
                      className="w-full h-8 rounded-sm border border-stone-200 bg-white pl-8 pr-2.5 text-xs font-medium text-[#25282B] placeholder-stone-400 focus:border-[#E60000] outline-none"
                      autoFocus
                    />
                  </div>
                </div>


                {/* 매장 목록 리스트 */}
                <div className="max-h-52 overflow-y-auto no-scrollbar divide-y divide-stone-50">
                  {/* 전체 매장 항목 */}
                  <button
                    type="button"
                    onClick={() => {
                      setShopFilter('ALL')
                      setIsShopDropdownOpen(false)
                      setShopSearchQuery('')
                    }}
                    className={`w-full px-3.5 py-2 text-left text-xs hover:bg-stone-50 flex items-center justify-between transition-colors ${
                      shopFilter === 'ALL' ? 'font-black text-[#E60000] bg-red-50' : 'text-[#25282B]'
                    }`}
                  >
                    <span>전체 매장</span>
                    <span className="text-[10px] text-stone-400">({allLogs.length}건)</span>
                  </button>

                  {/* 필터링된 개별 매장 리스트 */}
                  {shopList
                    .filter(s => s.value !== 'ALL')
                    .filter(s => !shopSearchQuery.trim() || s.name.toLowerCase().includes(shopSearchQuery.toLowerCase()))
                    .map(s => {
                      const isSelected = shopFilter === s.value
                      return (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => {
                            setShopFilter(s.value)
                            setIsShopDropdownOpen(false)
                            setShopSearchQuery('')
                          }}
                          className={`w-full px-3.5 py-2 text-left text-xs hover:bg-stone-50 flex items-center justify-between transition-colors ${
                            isSelected ? 'font-black text-[#E60000] bg-red-50' : 'text-[#25282B]'
                          }`}
                        >
                          <span className="truncate font-medium">{s.name}</span>
                          <span className="text-[10px] text-stone-400 shrink-0 ml-2">({s.count}건)</span>
                        </button>
                      )
                    })}
                </div>
              </div>
            )}
          </div>

          {/* 우측: 정렬 커스텀 드롭다운 (최신순 / 좋아요순) */}
          <div className="relative shrink-0" ref={sortDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setIsSortDropdownOpen(prev => !prev)
                setIsShopDropdownOpen(false)
              }}
              aria-expanded={isSortDropdownOpen}
              className="flex h-8 items-center justify-between gap-1.5 rounded-sm border border-stone-200 bg-[#F2F2F2] hover:bg-[#EAEAEA] hover:border-[#E60000] px-2.5 py-1 text-[11px] font-bold text-[#25282B] transition-colors"
            >
              <span>{sortBy === 'LATEST' ? '최신순' : '좋아요순'}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-stone-400 shrink-0 transition-transform duration-200 ${
                  isSortDropdownOpen ? 'rotate-180 text-[#E60000]' : ''
                }`}
              />
            </button>


            {isSortDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-50 w-28 rounded-sm border border-stone-300 bg-white shadow-xl overflow-hidden anim-fade-in-up">
                <div className="py-1 divide-y divide-stone-50">
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('LATEST')
                      setIsSortDropdownOpen(false)
                    }}
                    className={`w-full px-3 py-1.5 text-left text-[11px] hover:bg-stone-50 transition-colors flex items-center justify-between ${
                      sortBy === 'LATEST' ? 'font-black text-[#E60000] bg-red-50' : 'text-[#25282B]'
                    }`}
                  >
                    <span>최신순</span>
                    {sortBy === 'LATEST' && <span className="text-[#E60000] font-bold">✓</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSortBy('LIKES')
                      setIsSortDropdownOpen(false)
                    }}
                    className={`w-full px-3 py-1.5 text-left text-[11px] hover:bg-stone-50 transition-colors flex items-center justify-between ${
                      sortBy === 'LIKES' ? 'font-black text-[#E60000] bg-red-50' : 'text-[#25282B]'
                    }`}
                  >
                    <span>좋아요순</span>
                    {sortBy === 'LIKES' && <span className="text-[#E60000] font-bold">✓</span>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-shrink-0 px-5 py-2.5 bg-white border-b border-[#E2E2E2] overflow-x-auto no-scrollbar flex items-center gap-1.5">
          {COMMUNITY_CATEGORIES.map(cat => {
            const active = communityCategory === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCommunityCategory(cat.id)}
                className={`px-3 py-1 rounded-[32px] text-[11px] font-bold whitespace-nowrap outline-none focus:outline-none focus-visible:outline-none focus:ring-0 select-none transition-colors ${
                  active
                    ? 'bg-[#25282B] text-white'
                    : 'bg-[#F2F2F2] text-[#7E7E7E] hover:bg-[#EAEAEA]'
                }`}
              >
                {cat.label}
              </button>
            )
          })}
        </div>
      )}

      {/* 3. 메인 피드 컨텐츠 영역 */}
      <div className="flex-1">
        
        {/* 탭 1: 라멘로그 (인스타그램 스타일 풀-와이드 포토 피드) */}
        {loungeTab === 'logs' && (
          <div>
            {/* 선택된 매장 정보 배너 */}
            {shopFilter !== 'ALL' && (
              <div className="p-3 mx-4 my-3 bg-stone-50 rounded-[8px] border border-stone-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-[#E60000]" />
                  <span className="text-[13px] font-black text-[#25282B]">
                    {shopFilter} 라멘로그 ({filteredLogs.length}건)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onShopClick && onShopClick(shopFilter)}
                  className="text-[11px] font-bold text-[#E60000] hover:underline"
                >
                  매장 정보 →
                </button>
              </div>
            )}

            <div>
              {filteredLogs.map(log => {
                const allTags = [
                  ...log.tasteNotes.broth,
                  ...log.tasteNotes.noodle,
                  ...log.tasteNotes.seasoning,
                  ...log.tasteNotes.topping,
                ]

                const photos = log.photos && log.photos.length > 0 ? log.photos : log.imageUrl ? [log.imageUrl] : []
                const curIdx = activePhotoIdx[log.id] ?? 0

                return (
                  <article key={log.id} className="bg-white border-b-8 border-[#F6F6F8] last:border-b-0">
                    
                    {/* 상단 작성자 및 매장 정보 */}
                    <div className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#25282B] text-white flex items-center justify-center text-[11px] font-black shrink-0">
                          {log.author.name[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[12.5px] font-black text-[#25282B]">{log.author.name}</span>
                            <span className="text-[9.5px] font-bold text-[#E60000] bg-[#E60000]/10 px-1.5 py-0.2 rounded-full">
                              {cleanGradeTitle(log.author.level)}
                            </span>
                          </div>
                          <p className="text-[10px] text-stone-400 font-mono">{log.visitedAt} 방문</p>
                        </div>
                      </div>

                      <span className="text-[10.5px] font-bold text-[#25282B] bg-stone-100 px-2.5 py-1 rounded-full">
                        {log.revisit}
                      </span>
                    </div>

                    {/* 라멘 다중 사진 스와이프 캐러셀 (풀-와이드 Edge-to-Edge) */}
                    {photos.length > 0 && (
                      <div className="relative aspect-[16/10] bg-stone-100 overflow-hidden group select-none w-full">
                        <div
                          id={`log-photos-${log.id}`}
                          className="flex h-full w-full overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-smooth"
                          onScroll={e => {
                            const el = e.currentTarget
                            const idx = Math.round(el.scrollLeft / (el.clientWidth || 1))
                            if (idx !== (activePhotoIdx[log.id] ?? 0)) {
                              setActivePhotoIdx(prev => ({ ...prev, [log.id]: idx }))
                            }
                          }}
                        >
                          {photos.map((img, i) => (
                            <div key={i} className="w-full h-full flex-shrink-0 snap-start relative">
                              <img src={img} alt={`${log.menuName} 사진 ${i + 1}`} className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>

                        {/* 좌측 상단 라멘 계통 뱃지 */}
                        <div className="absolute top-2.5 left-2.5 bg-black/70 backdrop-blur-xs text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full pointer-events-none">
                          {log.ramenType}
                        </div>

                        {/* 우측 상단 사진 장수 인디케이터 */}
                        {photos.length > 1 && (
                          <div className="absolute top-2.5 right-2.5 bg-black/70 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-full pointer-events-none flex items-center gap-1 font-mono">
                            <span>{curIdx + 1}</span>
                            <span className="text-white/60">/</span>
                            <span>{photos.length}</span>
                          </div>
                        )}

                        {/* 좌우 이동 화살표 버튼 */}
                        {photos.length > 1 && curIdx > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleScrollPhoto(log.id, 'prev', photos.length)
                            }}
                            className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/45 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-xs active:scale-90 transition-all z-10"
                            aria-label="이전 사진"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {photos.length > 1 && curIdx < photos.length - 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleScrollPhoto(log.id, 'next', photos.length)
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/45 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-xs active:scale-90 transition-all z-10"
                            aria-label="다음 사진"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* 하단 점(dot) 인디케이터 */}
                        {photos.length > 1 && (
                          <div className="absolute bottom-2.5 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
                            {photos.map((_, i) => (
                              <span
                                key={i}
                                className={`h-1.5 rounded-full transition-all ${
                                  curIdx === i
                                    ? 'w-4 bg-white'
                                    : 'w-1.5 bg-white/50'
                                }`}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 본문 내용 */}
                    <div className="px-4 pt-3 pb-3.5 space-y-2.5">
                      <div className="flex items-baseline justify-between">
                        <h2 className="text-[16px] font-black text-[#25282B] tracking-tight">
                          {log.menuName}
                        </h2>
                        <span className="text-[11.5px] font-bold text-stone-500">
                          {log.shop.name} {log.shop.branch && `· ${log.shop.branch}`}
                        </span>
                      </div>

                      {/* 한줄 미각 평 */}
                      <div className="px-3.5 py-2.5 bg-[#F7F7F8] rounded-[8px] text-[12.5px] leading-relaxed">
                        <span className="font-bold text-stone-400 text-[10.5px] mr-1.5 font-mono">
                          한줄평
                        </span>
                        <span className="text-[#25282B] font-medium">
                          {log.note}
                        </span>
                      </div>

                      {/* 맛 상세 태그 칩 */}
                      {allTags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {allTags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="bg-stone-100 text-stone-600 text-[10px] font-bold px-2 py-0.5 rounded-[4px]"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* 하단 좋아요 토글 및 시간 */}
                      <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-[11px]">
                        <span className="text-stone-400 font-mono">{log.createdAt}</span>
                        <button
                          onClick={() => handleToggleLogLike(log.id)}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-bold border transition-all active:scale-95 ${
                            log.isLiked
                              ? 'bg-[#E60000]/10 border-[#E60000] text-[#E60000]'
                              : 'bg-white border-stone-200 text-stone-600 hover:border-stone-400'
                          }`}
                        >
                          <Heart className={`w-3.5 h-3.5 ${log.isLiked ? 'fill-[#E60000] text-[#E60000]' : 'text-stone-400'}`} />
                          <span>{log.likes}</span>
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>

            {/* 피드 끝 안내 문구 (라멘 로그) */}
            <div className="pt-8 pb-3 text-center">
              <p className="text-[10.5px] text-[#A0A0A0]">
                오늘 방문한 라멘집이 있다면 우측 하단 버튼으로 라멘로그를 남겨보세요
              </p>
            </div>
          </div>
        )}

        {/* 탭 2: 라멘러 커뮤니티 (Threads/Daangn 플랫 스트림 스타일) */}
        {loungeTab === 'community' && (
          <div>
            <div className="bg-white">
              {filteredPosts.map(post => (
                <article
                  key={post.postId}
                  onClick={() => setSelectedPost(post)}
                  className="px-4 py-3 hover:bg-stone-50/70 active:bg-stone-100/60 transition-colors cursor-pointer group border-b border-[#F0F0F2] last:border-b-0"
                >
                  {/* 상단: 카테고리 뱃지 & 인기 뱃지만 단독 배치 */}
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-[4px] shrink-0 ${getCategoryBadgeClass(post.category)}`}>
                      {post.categoryLabel}
                    </span>
                    {post.likeCount >= 30 && (
                      <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded-[4px] bg-red-50 text-[#E60000] shrink-0 flex items-center gap-0.5">
                        🔥 인기
                      </span>
                    )}
                  </div>

                  {/* 중앙 본문: 제목 (1줄) + 요약 (1줄) + 썸네일 */}
                  <div className="flex items-center justify-between gap-3 my-1">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-[14.5px] font-bold text-[#25282B] leading-snug group-hover:text-[#E60000] transition-colors truncate">
                        {post.title}
                      </h2>
                      <p className="text-[12px] text-stone-500 truncate mt-0.5 leading-normal">
                        {post.content}
                      </p>
                    </div>

                    {post.imageUrl && (
                      <div className="w-13 h-13 rounded-[6px] overflow-hidden bg-stone-100 border border-stone-200/60 shrink-0">
                        <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>

                  {/* 하단: 좌측(작성자 · 날짜) vs 우측(좋아요 & 댓글) */}
                  <div className="flex items-center justify-between pt-1.5 text-[11px] font-medium text-stone-400">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-stone-600 text-[11px] truncate max-w-[140px]">{post.authorName}</span>
                      {post.authorLevel && (
                        <span className="text-[9px] font-bold text-[#E60000] bg-[#E60000]/10 px-1.5 py-0.2 rounded-full shrink-0">
                          {cleanGradeTitle(post.authorLevel)}
                        </span>
                      )}
                      <span className="text-stone-300">·</span>
                      <span className="font-mono text-[10.5px] text-stone-400">
                        {post.createdAt.replace(/^\d{4}\.\s*/, '').split(' ')[0]}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 font-bold text-stone-400 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleTogglePostLike(post.postId) }}
                        className={`flex items-center gap-1 hover:text-[#E60000] transition-colors ${post.isLiked ? 'text-[#E60000]' : ''}`}
                      >
                        <Heart className={`h-3 w-3 ${post.isLiked ? 'fill-[#E60000] text-[#E60000]' : ''}`} />
                        <span>{post.likeCount}</span>
                      </button>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        <span>{post.commentCount}</span>
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {/* 피드 끝 안내 문구 (커뮤니티) */}
            <div className="py-6 text-center">
              <p className="text-[11px] font-medium text-stone-400">
                모든 글을 확인했습니다
              </p>
            </div>
          </div>
        )}

        <div className="h-14" />
      </div>
      </div>

      {/* 상단 알림 토스트 */}
      {toastMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-[#25282B]/95 backdrop-blur-md text-white text-[12px] font-bold px-4 py-2.5 rounded-[32px] shadow-[0_8px_30px_rgba(0,0,0,0.3)] anim-fade-in-up flex items-center gap-2 whitespace-nowrap border border-white/15 pointer-events-none">
          <span className="w-4 h-4 rounded-full bg-[#E60000] text-white flex items-center justify-center text-[10px] font-black shrink-0">
            ✓
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 우측 하단 플로팅 액션 버튼 (FAB) */}
      <button
        onClick={() => {
          if (loungeTab === 'logs') {
            onRecordClick()
          } else {
            setIsWriteModalOpen(true)
          }
        }}
        className="absolute bottom-4 right-4 z-30 h-12 px-4 rounded-[60px] bg-[#E60000] text-white font-bold text-[13px] shadow-lg flex items-center gap-2 active:scale-95 hover:bg-[#CC0000] transition-all"
        aria-label={loungeTab === 'logs' ? '라멘로그 쓰기' : '커뮤니티 글쓰기'}
      >
        {loungeTab === 'logs' ? (
          <>
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>기록하기</span>
          </>
        ) : (
          <>
            <PenSquare className="w-4 h-4" />
            <span>글쓰기</span>
          </>
        )}
      </button>

    </div>
  )
}
