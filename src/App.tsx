import { useEffect, useState, type ReactNode } from 'react'
import { recordMonthKey } from './utils/monthlyReport'
import { Home, MapPin, MessageSquare, Flame, User } from 'lucide-react'
import HomeScreen from './screens/HomeScreen'

import MapScreen from './screens/MapScreen'
import ShopDetailScreen from './screens/ShopDetailScreen'
import RecordSheet, { type RecordSheetMode } from './screens/RecordSheet'
import RecordScreen from './screens/RecordScreen'
import RecordCompleteScreen from './screens/RecordCompleteScreen'
import MyScreen from './screens/MyScreen'
import TasteDetailScreen from './screens/TasteDetailScreen'
import MonthlyTasteScreen from './screens/MonthlyTasteScreen'
import { PAST_REPORTS } from './data/tasteReports'
import LoungeScreen from './screens/LoungeScreen'
import NewsFeedScreen from './screens/NewsFeedScreen'
import AIRecommendScreen from './screens/AIRecommendScreen'
import LoginScreen from './screens/LoginScreen'
import RegisterScreen from './screens/RegisterScreen'
import NotificationScreen from './screens/NotificationScreen'
import { findShopById, getShopDetail } from './data/shops'
import { DEMO_BASE_PROFILE, DEMO_MONTHLY_RECORD_COUNTS, DEMO_SAVED_SHOP_NAMES, DEMO_TOTAL_BOWLS, DEMO_USER } from './data/demoProfile'
import { EMPTY_PROFILE, mergeProfile } from './utils/taste'
import type { AppNotification, NotificationSettings, RamenLog, RamenLogComment, RevisitOption, TasteNotes, TasteProfile, TasteScores, UserProfile } from './types'

type Screen = 'home' | 'map' | 'shopDetail' | 'record' | 'recordComplete' | 'my' | 'tasteDetail' | 'monthlyTaste' | 'lounge' | 'newsFeed' | 'aiRecommend' | 'login' | 'register' | 'notifications'
type Tab = 'home' | 'map' | 'lounge' | 'newsFeed' | 'my'



const INITIAL_LOGS: RamenLog[] = [
  {
    id: 1,
    author: { name: '멘마수집가', level: '라멘 미식가 (Lv.5)' },
    shop: { id: 1, name: '멘야준', branch: '망원 본점', location: '서울 마포구' },
    menuName: '특제 쇼유 라멘',
    ramenType: '쇼유',
    visitedAt: '2026. 09. 01',
    imageUrl: 'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=800&h=600&fit=crop&auto=format&q=80',
    photos: [
      'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=800&h=600&fit=crop&auto=format&q=80',
      'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=800&h=600&fit=crop&auto=format&q=80',
      'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=800&h=600&fit=crop&auto=format&q=80',
    ],
    note: '닭과 오리 더블 육수의 첫 모금 감칠맛이 폭발적임. 다음엔 면을 단단하게 주문해볼 것.',
    tasteNotes: {
      broth: ['진해요', '감칠맛 좋아요'],
      noodle: ['단단해요', '국물이 잘 배어요'],
      seasoning: ['딱 좋아요'],
      topping: ['차슈 좋아요', '계란 좋아요'],
    },
    revisit: '자주 감',
    likes: 38,
    isLiked: false,
    isPublic: true,
    createdAt: '2시간 전',
    commentCount: 2,
    comments: [
      {
        id: 101,
        logId: 1,
        author: { name: '쇼유러버', level: '라멘집 탐험가 (Lv.3)' },
        createdAt: '1시간 전',
        content: '면을 꼬들하게 주문하면 국물 흡착이 정말 좋아요!',
        likes: 4,
        isLiked: false,
      },
      {
        id: 102,
        logId: 1,
        author: { name: '차슈폭격기', level: '라멘 미식가 (Lv.5)' },
        createdAt: '방금 전',
        content: '닭과 오리 더블 육수라니, 다음 방문 메뉴로 저장해둘게요.',
        likes: 2,
        isLiked: false,
      },
    ],
  },
  {
    id: 2,
    author: { name: '토리파이탄러버', level: '라멘집 단골 (Lv.4)' },
    shop: { id: 3, name: '오레노라멘', branch: '마포 본점', location: '서울 마포구' },
    menuName: '토리파이탄 라멘',
    ramenType: '돈코츠',
    visitedAt: '2026. 08. 31',
    imageUrl: 'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=800&h=600&fit=crop&auto=format&q=80',
    photos: [
      'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=800&h=600&fit=crop&auto=format&q=80',
      'https://images.unsplash.com/photo-1742633882713-593c13e90231?w=800&h=600&fit=crop&auto=format&q=80',
    ],
    note: '거품 낸 닭 육수의 크리미함이 일품. 밥 말아먹기 딱 좋은 염도와 부드러운 수비드 닭가슴살 차슈.',
    tasteNotes: {
      broth: ['진해요', '기름져요'],
      noodle: ['탄력 있어요'],
      seasoning: ['딱 좋아요', '밥 생각나요'],
      topping: ['차슈 좋아요', '구성 알차요'],
    },
    revisit: '자주 감',
    likes: 24,
    isLiked: true,
    isPublic: true,
    createdAt: '어제',
    commentCount: 1,
    comments: [
      {
        id: 103,
        logId: 2,
        author: { name: '돈골파마스터', level: '라멘집 단골 (Lv.4)' },
        createdAt: '어제',
        content: '간 보통, 기름 보통, 면 꼬들하게 조합 추천합니다.',
        likes: 3,
        isLiked: false,
      },
    ],
  },
  {
    id: 3,
    author: { name: '미소천사', level: '라멘집 탐험가 (Lv.3)' },
    shop: { id: 2, name: '후쿠 라멘', branch: '합정점', location: '서울 마포구' },
    menuName: '특제 삿포로 미소 라멘',
    ramenType: '미소',
    visitedAt: '2026. 08. 29',
    imageUrl: 'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=800&h=600&fit=crop&auto=format&q=80',
    photos: [
      'https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=800&h=600&fit=crop&auto=format&q=80',
      'https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=800&h=600&fit=crop&auto=format&q=80',
    ],
    note: '웍질로 불향을 입힌 숙주와 진한 된장 육수의 조화. 꼬불꼬불한 노란 치지레멘의 씹는 맛이 최고.',
    tasteNotes: {
      broth: ['진해요', '감칠맛 좋아요'],
      noodle: ['탄력 있어요'],
      seasoning: ['짭짤해요'],
      topping: ['차슈 좋아요', '파 향 좋아요'],
    },
    revisit: '가끔 생각남',
    likes: 19,
    isLiked: false,
    isPublic: true,
    createdAt: '3일 전',
  },
]

interface State {
  screen: Screen
  activeTab: Tab
  fromScreen: Screen
  user: UserProfile | null
  showRecordSheet: boolean
  recordSheetMode: RecordSheetMode
  monthlyRecordCounts: Record<string, number>
  recordSaved: boolean
  recordShopName: string
  recordStatus: 'idle' | 'saving' | 'error' | 'success'
  mapSelectedPin: number
  mapFilter: string
  logs: RamenLog[]
  lastLog: RamenLog | null
  notifications: AppNotification[]
  notificationSettings: NotificationSettings
  autoGenerateReport?: boolean
  monthlyTasteId?: string
  selectedShopName: string
  detailFromScreen: Screen
  savedShopNames: string[]
  ownedLogs: RamenLog[]
  resumeAiResult: boolean
  /** 이번 세션 이전까지의 5축 누적 평균 */
  profileBase: TasteProfile
  /** 마지막 기록 직전의 누적 평균. 완료 화면의 변화량 계산에 쓴다. */
  profileBeforeLastLog: TasteProfile | null
  /** 세션이 바뀔 때마다 증가해 탭 화면의 지역 상태를 초기화한다. */
  sessionKey: number
}

const DEFAULT_USER = DEMO_USER

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'noti-1',
    type: 'like',
    title: '멘마수집가님의 공감',
    content: '회원님의 [멘야준] 라멘로그에 공감했습니다: "닭과 오리 더블 육수의 첫 모금 감칠맛..."',
    time: '10분 전',
    isRead: false,
    senderName: '멘마수집가',
  },
  {
    id: 'noti-2',
    type: 'comment',
    title: '새로운 댓글이 달렸습니다',
    content: '쇼유러버: "여기 면 꼬들하게 주문하면 국물 흡착이 진짜 예술이에요!"',
    time: '1시간 전',
    isRead: false,
    senderName: '쇼유러버',
  },
  {
    id: 'noti-3',
    type: 'level',
    title: '활동 등급 승급 축하!',
    content: '라멘로그 30그릇을 돌파하여 [라멘집 단골 (Lv.4)]로 공식 승급되었습니다 🏆',
    time: '어제',
    isRead: false,
  },
  {
    id: 'noti-4',
    type: 'shop',
    title: '관심 라멘집 신메뉴 소식',
    content: '[세상끝의라멘]에서 가을 한정 특제 "바지락 시오 라멘"을 개시했습니다.',
    time: '2일 전',
    isRead: true,
    targetShopId: 4,
  },
  {
    id: 'noti-5',
    type: 'notice',
    title: '라오타 v1.1 업데이트 안내',
    content: '라멘집 상세 페이지에서 면 리필 및 공깃밥 혜택 정보가 추가되었습니다.',
    time: '3일 전',
    isRead: true,
  },

]

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  pushEnabled: true,
  likesEnabled: true,
  commentsEnabled: true,
  levelUpEnabled: true,
  shopNewsEnabled: true,
}

/** 로그인한 사용자에 맞춘 세션 상태. 로그아웃, 로그인, 가입 때 이전 세션 흔적을 모두 지운다. */
const sessionStateFor = (user: UserProfile | null) => {
  const isDemo = user?.id === DEMO_USER.id
  return {
    user,
    monthlyRecordCounts: isDemo ? { ...DEMO_MONTHLY_RECORD_COUNTS } : {},
    savedShopNames: isDemo ? [...DEMO_SAVED_SHOP_NAMES] : [],
    ownedLogs: [] as RamenLog[],
    recordSaved: false,
    lastLog: null,
    profileBase: isDemo ? DEMO_BASE_PROFILE : EMPTY_PROFILE,
    profileBeforeLastLog: null,
    notifications: isDemo ? INITIAL_NOTIFICATIONS : [],
    monthlyTasteId: undefined,
    autoGenerateReport: false,
    showRecordSheet: false,
  } satisfies Partial<State>
}

const INIT: State = {
  screen: 'home',
  activeTab: 'home',
  fromScreen: 'home',
  recordSheetMode: 'nearby',
  recordShopName: '멘야준',
  recordStatus: 'idle',
  mapSelectedPin: 0,
  mapFilter: '전체',
  logs: INITIAL_LOGS,
  notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
  selectedShopName: '멘야준',
  detailFromScreen: 'home',
  resumeAiResult: false,
  sessionKey: 0,
  ...sessionStateFor(DEFAULT_USER),
}


function IconHome({ active }: { active: boolean }) {
  return <Home className="w-5 h-5" strokeWidth={active ? 2.3 : 1.8} color={active ? '#E60000' : '#6B6E73'} />
}

function IconMap({ active }: { active: boolean }) {
  return <MapPin className="w-5 h-5" strokeWidth={active ? 2.3 : 1.8} color={active ? '#E60000' : '#6B6E73'} />
}

function IconLounge({ active }: { active: boolean }) {
  return <MessageSquare className="w-5 h-5" strokeWidth={active ? 2.3 : 1.8} color={active ? '#E60000' : '#6B6E73'} />
}

function IconNewsFeed({ active }: { active: boolean }) {
  return <Flame className="w-5 h-5" strokeWidth={active ? 2.3 : 1.8} color={active ? '#E60000' : '#6B6E73'} />
}

function IconMy({ active }: { active: boolean }) {
  return <User className="w-5 h-5" strokeWidth={active ? 2.3 : 1.8} color={active ? '#E60000' : '#6B6E73'} />
}


const TAB_DEFS: { id: Tab; label: string; Icon: React.FC<{ active: boolean }> }[] = [
  { id: 'home', label: '홈', Icon: IconHome },
  { id: 'map', label: '지도', Icon: IconMap },
  { id: 'lounge', label: '라운지', Icon: IconLounge },
  { id: 'newsFeed', label: '라멘속보', Icon: IconNewsFeed },
  { id: 'my', label: '마이', Icon: IconMy },
]

const TAB_SCREENS: Record<Tab, Screen> = {
  home: 'home',
  map: 'map',
  lounge: 'lounge',
  newsFeed: 'newsFeed',
  my: 'my',
}


const TAB_IDS = TAB_DEFS.map(tab => tab.id)
const isTabScreen = (screen: Screen): screen is Tab => (TAB_IDS as Screen[]).includes(screen)

const currentMonthKey = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
}).format(new Date())

export interface SaveLogData {
  shopName: string
  branch: string
  menuName: string
  ramenType: string
  visitedAt: string
  revisit: RevisitOption
  note: string
  tasteNotes: TasteNotes
  scores?: TasteScores
  imageUrl: string | null
  photos?: string[]
  isPublic: boolean
}

export default function App() {
  const [s, setS] = useState<State>(INIT)
  const [visitedTabs, setVisitedTabs] = useState<Tab[]>(['home'])

  const patch = (partial: Partial<State>) => setS(prev => ({ ...prev, ...partial }))

  const nav = (screen: Screen, extra?: Partial<State>) =>
    setS(prev => ({ ...prev, ...extra, screen }))

  const isDemo = s.user?.id === DEMO_USER.id
  // 누적 그릇 수는 세션 시작 시점의 누적 + 이번 세션에 남긴 기록으로만 계산한다.
  const totalBowls = s.user ? (isDemo ? DEMO_TOTAL_BOWLS : s.user.visitedCount) + s.ownedLogs.length : 0
  const profile = mergeProfile(s.profileBase, s.ownedLogs)
  const unreadCount = s.user ? s.notifications.filter(n => !n.isRead).length : 0

  const activeTabScreen: Tab | null = isTabScreen(s.screen) ? s.screen : null

  useEffect(() => {
    if (activeTabScreen && !visitedTabs.includes(activeTabScreen)) setVisitedTabs(prev => [...prev, activeTabScreen])
  }, [activeTabScreen, visitedTabs])

  // 열린 기록 시트는 Escape로 닫는다. 화면 안의 모달은 각 화면이 처리한다.
  useEffect(() => {
    if (!s.showRecordSheet) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') patch({ showRecordSheet: false })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [s.showRecordSheet])

  /** 세션을 바꾸고 이전 세션의 화면 상태를 버린다. */
  const switchSession = (user: UserProfile | null, screen: Screen, extra?: Partial<State>) => {
    setVisitedTabs(isTabScreen(screen) ? [screen] : ['home'])
    setS(prev => ({
      ...prev,
      ...sessionStateFor(user),
      logs: INITIAL_LOGS,
      sessionKey: prev.sessionKey + 1,
      screen,
      activeTab: isTabScreen(screen) ? screen : prev.activeTab,
      ...extra,
    }))
  }

  const requireLogin = (fromScreen: Screen) => nav('login', { fromScreen, showRecordSheet: false })

  const openShop = (shopName = '멘야준', fromScreen?: Screen) => {
    setS(prev => ({
      ...prev,
      selectedShopName: shopName,
      detailFromScreen: fromScreen ?? prev.screen,
      resumeAiResult: (fromScreen ?? prev.screen) === 'aiRecommend',
      screen: 'shopDetail',
    }))
  }

  const setTab = (tab: Tab) =>
    setS(prev => ({ ...prev, activeTab: tab, screen: TAB_SCREENS[tab], fromScreen: prev.screen }))

  const openRecordSheet = (mode: RecordSheetMode = 'nearby') => {
    if (!s.user) return requireLogin(s.screen)
    patch({ showRecordSheet: true, recordSheetMode: mode })
  }

  const startRecord = (shopName = '멘야준') => {
    if (!s.user) return requireLogin(s.screen)
    setS(prev => ({
      ...prev,
      showRecordSheet: false,
      recordShopName: shopName,
      recordStatus: 'idle',
      fromScreen: prev.screen,
      screen: 'record',
    }))
  }

  const toggleSavedShop = (shopName: string) => {
    if (!s.user) return requireLogin(s.screen)
    patch({
      savedShopNames: s.savedShopNames.includes(shopName)
        ? s.savedShopNames.filter(name => name !== shopName)
        : [...s.savedShopNames, shopName],
    })
  }

  const updateLog = (logId: number, update: (log: RamenLog) => RamenLog) => {
    setS(prev => ({
      ...prev,
      logs: prev.logs.map(log => (log.id === logId ? update(log) : log)),
      ownedLogs: prev.ownedLogs.map(log => (log.id === logId ? update(log) : log)),
    }))
  }

  const toggleLogLike = (logId: number) => {
    if (!s.user) return requireLogin(s.screen)
    updateLog(logId, log => ({ ...log, isLiked: !log.isLiked, likes: Math.max(0, log.likes + (log.isLiked ? -1 : 1)) }))
  }

  const addLogComment = (logId: number, content: string, parentId?: number) => {
    const user = s.user
    if (!user) return requireLogin(s.screen)
    updateLog(logId, log => {
      const parent = log.comments?.find(comment => comment.id === parentId)
      const comment: RamenLogComment = {
        id: Date.now(),
        logId,
        author: { name: user.nickname, avatar: user.avatar ?? undefined, level: `${user.level} (Lv.${user.levelNumber})` },
        content,
        createdAt: '방금 전',
        likes: 0,
        isLiked: false,
        parentId: parent?.id,
        parentAuthorName: parent?.author.name,
      }
      const comments = [...(log.comments ?? []), comment]
      return { ...log, comments, commentCount: comments.length }
    })
  }

  const handleSaveLog = (logData: SaveLogData) => {
    const user = s.user
    if (!user) return requireLogin('record')
    patch({ recordStatus: 'saving' })

    setTimeout(() => {
      const createdId = Date.now()
      const shop = getShopDetail(logData.shopName)
      const photos = logData.photos?.length ? logData.photos : logData.imageUrl ? [logData.imageUrl] : []
      const createdLog: RamenLog = {
        id: createdId,
        author: { name: user.nickname, avatar: user.avatar ?? undefined, level: `${user.level} (Lv.${user.levelNumber})` },
        shop: { id: shop.id || createdId, name: shop.name, branch: logData.branch || shop.branch, location: '서울 마포구' },
        menuName: logData.menuName,
        ramenType: logData.ramenType,
        visitedAt: logData.visitedAt,
        imageUrl: photos[0] ?? null,
        photos,
        note: logData.note,
        tasteNotes: logData.tasteNotes,
        scores: logData.scores,
        revisit: logData.revisit,
        likes: 0,
        isLiked: false,
        isPublic: logData.isPublic,
        createdAt: '방금 전',
        commentCount: 0,
        comments: [],
      }

      const monthKey = recordMonthKey(createdLog.visitedAt)
      setS(prev => ({
        ...prev,
        monthlyRecordCounts: monthKey ? { ...prev.monthlyRecordCounts, [monthKey]: (prev.monthlyRecordCounts[monthKey] ?? 0) + 1 } : prev.monthlyRecordCounts,
        recordStatus: 'success',
        recordSaved: true,
        lastLog: createdLog,
        profileBeforeLastLog: mergeProfile(prev.profileBase, prev.ownedLogs),
        ownedLogs: [createdLog, ...prev.ownedLogs],
        logs: createdLog.isPublic ? [createdLog, ...prev.logs] : prev.logs,
        screen: 'recordComplete',
      }))
    }, 1200)
  }

  const renderTab = (tab: Tab): ReactNode => {
    switch (tab) {
      case 'home':
        return (
          <HomeScreen
            user={s.user}
            recordSaved={s.recordSaved}
            unreadNotificationsCount={unreadCount}
            onNotificationClick={() => (s.user ? nav('notifications', { fromScreen: 'home' }) : requireLogin('home'))}
            onShopClick={(shopName) => openShop(shopName, 'home')}
            onRecordClick={(mode) => openRecordSheet(mode || 'nearby')}
            onAIRecommendClick={() => nav('aiRecommend', { fromScreen: 'home', resumeAiResult: false })}
            onViewTaste={() => nav('tasteDetail', { fromScreen: 'home', autoGenerateReport: false })}
            onLoginClick={() => nav('login', { fromScreen: 'home' })}
            onRegisterClick={() => nav('register', { fromScreen: 'home' })}
            onUserClick={() => setTab('my')}
            onMapClick={() => setTab('map')}
            onNewsFeedClick={() => setTab('newsFeed')}
          />
        )
      case 'map':
        return (
          <MapScreen
            isActive={s.screen === 'map'}
            selectedPin={s.mapSelectedPin}
            filter={s.mapFilter}
            onPinSelect={i => patch({ mapSelectedPin: i })}
            onFilterChange={f => patch({ mapFilter: f })}
            onShopClick={(shopName) => openShop(shopName, 'map')}
          />
        )
      case 'lounge':
        return (
          <LoungeScreen
            logs={s.logs}
            user={s.user}
            onRecordClick={() => openRecordSheet('nearby')}
            onShopClick={(shopName) => openShop(shopName, 'lounge')}
            onToggleLike={toggleLogLike}
            onAddComment={addLogComment}
            onLoginRequest={() => requireLogin('lounge')}
          />
        )
      case 'newsFeed':
        return (
          <NewsFeedScreen
            user={s.user}
            onLoginRequest={() => requireLogin('newsFeed')}
            onShopClick={(shopName) => openShop(shopName, 'newsFeed')}
          />
        )
      case 'my':
        return (
          <MyScreen
            user={s.user}
            recordCount={totalBowls}
            profile={profile}
            ownedLogs={s.ownedLogs}
            savedShopNames={s.savedShopNames}
            monthlyRecordCount={s.monthlyRecordCounts[currentMonthKey()] ?? 0}
            hasPastReports={isDemo}
            onViewMonthlyChanges={() => nav('monthlyTaste')}
            unreadNotificationsCount={unreadCount}
            onNotificationClick={() => nav('notifications', { fromScreen: 'my' })}
            onShopClick={(shopName) => openShop(shopName, 'my')}
            onToggleSavedShop={toggleSavedShop}
            onViewTaste={(autoGenerate) => nav('tasteDetail', { fromScreen: 'my', autoGenerateReport: Boolean(autoGenerate) })}
            onLoginClick={() => nav('login', { fromScreen: 'my' })}
            onRegisterClick={() => nav('register', { fromScreen: 'my' })}
            onLogout={() => switchSession(null, 'home')}
            onUpdateUser={(updated) => {
              patch({ user: s.user ? { ...s.user, ...updated } : null })
            }}
            onLoungeClick={() => setTab('lounge')}
          />
        )
    }
  }

  const renderScreen = (): ReactNode => {
    switch (s.screen) {
      case 'login':
        return (
          <LoginScreen
            onBack={() => nav(s.fromScreen || 'home')}
            onRegisterClick={() => nav('register', { fromScreen: s.fromScreen || 'home' })}
            onGuestBrowse={() => switchSession(null, 'home')}
            onLoginSuccess={(user) => {
              const target = s.fromScreen && s.fromScreen !== 'login' && s.fromScreen !== 'register' ? s.fromScreen : 'home'
              switchSession(user, target)
            }}
          />
        )
      case 'register':
        return (
          <RegisterScreen
            onBack={() => nav(s.fromScreen || 'home')}
            onLoginClick={() => nav('login', { fromScreen: s.fromScreen || 'home' })}
            onRegisterSuccess={(user) => switchSession(user, 'home')}
          />
        )
      case 'shopDetail':
        return (
          <ShopDetailScreen
            shop={getShopDetail(s.selectedShopName)}
            savedShop={s.savedShopNames.includes(s.selectedShopName)}
            isLoggedIn={Boolean(s.user)}
            onSaveShop={() => toggleSavedShop(s.selectedShopName)}
            onLoginRequest={() => requireLogin('shopDetail')}
            onBack={() => nav(s.detailFromScreen)}
            onRecord={() => startRecord(s.selectedShopName)}
          />
        )
      case 'record':
        return (
          <RecordScreen
            recordStatus={s.recordStatus}
            initialShopName={s.recordShopName}
            onBack={() => nav(s.fromScreen)}
            onSaveLog={handleSaveLog}
            onRetry={() => patch({ recordStatus: 'idle' })}
          />
        )
      case 'recordComplete':
        return (
          <RecordCompleteScreen
            recordCount={totalBowls}
            lastLog={s.lastLog}
            profileBefore={s.profileBeforeLastLog ?? s.profileBase}
            profileAfter={profile}
            onViewTaste={() => nav('tasteDetail', { fromScreen: 'recordComplete', autoGenerateReport: false })}
            onHome={() => setTab('home')}
          />
        )
      case 'aiRecommend':
        return (
          <AIRecommendScreen
            user={s.user}
            onBack={() => setTab('home')}
            onShopClick={(shopName) => openShop(shopName, 'aiRecommend')}
            onRecordShop={(shopName) => startRecord(shopName)}
            initialResultShopName={s.resumeAiResult ? s.selectedShopName : undefined}
          />
        )
      case 'monthlyTaste':
        return (
          <MonthlyTasteScreen
            onBack={() => setTab('my')}
            reports={isDemo ? PAST_REPORTS : []}
            monthlyRecordCounts={s.monthlyRecordCounts}
            ownedLogs={s.ownedLogs}
            initialSelectedId={s.monthlyTasteId}
            onSelectMonth={(id) => patch({ monthlyTasteId: id })}
          />
        )
      case 'tasteDetail':
        return (
          <TasteDetailScreen
            onBack={() => {
              if (s.fromScreen === 'recordComplete') setTab('home')
              else nav(s.fromScreen || 'my')
            }}
            user={s.user}
            recordCount={totalBowls}
            profile={profile}
            logs={s.ownedLogs}
            initialGenerating={Boolean(s.autoGenerateReport)}
          />
        )
      case 'notifications':
        return (
          <NotificationScreen
            notifications={s.notifications}
            settings={s.notificationSettings}
            onBack={() => nav(s.fromScreen || 'home')}
            onMarkAllAsRead={() => {
              patch({
                notifications: s.notifications.map(n => ({ ...n, isRead: true })),
              })
            }}
            onReadNotification={(id) => {
              patch({
                notifications: s.notifications.map(n => n.id === id ? { ...n, isRead: true } : n),
              })
            }}
            onDeleteNotification={(id) => {
              patch({
                notifications: s.notifications.filter(n => n.id !== id),
              })
            }}
            onUpdateSettings={(newSettings) => {
              patch({ notificationSettings: newSettings })
            }}
            onNavigateToShop={(shopId) => openShop(findShopById(shopId)?.name ?? '멘야준', 'notifications')}
            onNavigateToLounge={() => setTab('lounge')}
            onNavigateToMy={() => setTab('my')}
          />
        )
      default:
        return null
    }
  }

  const displayTab = activeTabScreen ?? s.activeTab
  const isDarkTop = s.screen === 'my' && Boolean(s.user)

  return (
    <main className="w-full h-[100dvh] overflow-hidden bg-[#F2F2F2] flex justify-center selection:bg-brand selection:text-white">
      {/* 모바일에서는 화면 전체, 넓은 화면에서는 430px 앱 열 */}
      <div className="relative w-full max-w-[430px] h-full bg-white flex flex-col overflow-hidden sm:border-x sm:border-[#E2E2E2]">
        {/* 상단 안전 영역: 기기 상태 표시줄과 겹치지 않게 한다 */}
        <div
          aria-hidden="true"
          className={`shrink-0 h-[env(safe-area-inset-top)] ${isDarkTop ? 'bg-[#25282B]' : 'bg-white'}`}
        />

        {/* Screen area */}
        <div className="relative overflow-hidden flex-1 min-h-0 flex flex-col bg-white">
          {/* 탭 화면은 한 번 열면 유지해 탭을 오가도 스크롤, 입력, 선택 상태가 남는다 */}
          <div key={s.sessionKey} className={`absolute inset-0 flex-col ${activeTabScreen ? 'flex' : 'hidden'}`}>
            {visitedTabs.map(tab => (
              <div
                key={tab}
                className={`flex-1 min-h-0 flex-col ${activeTabScreen === tab ? 'flex' : 'hidden'}`}
                aria-hidden={activeTabScreen !== tab}
              >
                {renderTab(tab)}
              </div>
            ))}
          </div>
          {!activeTabScreen && (
            <div className="absolute inset-0 flex flex-col">
              {renderScreen()}
            </div>
          )}
        </div>

        {/* 5-Tab Navigation Bar */}
        {activeTabScreen && (
          <nav aria-label="주요 메뉴" className="relative z-40 flex-shrink-0 bg-white border-t border-[#E2E2E2] pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-stretch h-14 px-1">
              {TAB_DEFS.map(({ id, label, Icon }) => {
                const active = displayTab === id
                return (
                  <button
                    type="button"
                    key={id}
                    onClick={() => setTab(id)}
                    className="flex-1 flex flex-col items-center justify-center gap-1 relative transition-transform active:scale-95"
                    aria-current={active ? 'page' : undefined}
                  >
                    {active && (
                      <span aria-hidden="true" className="absolute top-0 w-6 h-0.5 bg-[#E60000]" />
                    )}
                    <Icon active={active} />
                    <span className={`text-[12px] leading-none font-bold tracking-tight ${active ? 'text-[#E60000]' : 'text-[#6B6E73]'}`}>
                      {label}
                    </span>
                  </button>
                )
              })}
            </div>
          </nav>
        )}
        {!activeTabScreen && (
          <div aria-hidden="true" className="shrink-0 h-[env(safe-area-inset-bottom)] bg-white" />
        )}

        {/* Record sheet overlay */}
        {s.showRecordSheet && (
          <RecordSheet
            initialMode={s.recordSheetMode || 'nearby'}
            savedShopNames={s.savedShopNames}
            onClose={() => patch({ showRecordSheet: false })}
            onSelectShop={(shopName) => startRecord(shopName || '멘야준')}
          />
        )}
      </div>
    </main>
  )
}
