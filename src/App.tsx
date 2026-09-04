import { useState } from 'react'
import { Home, MapPin, MessageSquare, Flame, User } from 'lucide-react'
import HomeScreen from './screens/HomeScreen'

import MapScreen from './screens/MapScreen'
import ShopDetailScreen from './screens/ShopDetailScreen'
import RecordSheet, { type RecordSheetMode } from './screens/RecordSheet'
import RecordScreen from './screens/RecordScreen'
import RecordCompleteScreen from './screens/RecordCompleteScreen'
import MyScreen from './screens/MyScreen'
import TasteDetailScreen from './screens/TasteDetailScreen'
import LoungeScreen from './screens/LoungeScreen'
import NewsFeedScreen from './screens/NewsFeedScreen'
import AIRecommendScreen from './screens/AIRecommendScreen'
import LoginScreen from './screens/LoginScreen'
import RegisterScreen from './screens/RegisterScreen'
import NotificationScreen from './screens/NotificationScreen'
import type { AppNotification, NotificationSettings, RamenLog, RevisitOption, TasteNotes, UserProfile } from './types'

type Screen = 'home' | 'map' | 'shopDetail' | 'record' | 'recordComplete' | 'my' | 'tasteDetail' | 'lounge' | 'newsFeed' | 'aiRecommend' | 'login' | 'register' | 'notifications'
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
  recordCount: number
  recordSaved: boolean
  savedShop: boolean
  recordShopName: string
  recordStatus: 'idle' | 'saving' | 'error' | 'success'
  mapSelectedPin: number
  mapFilter: string
  logs: RamenLog[]
  lastLog: RamenLog | null
  notifications: AppNotification[]
  notificationSettings: NotificationSettings
}

const DEFAULT_USER: UserProfile = {
  id: 'user-demo',
  name: '뿡',
  nickname: '뿡',
  email: 'bbung@raota.net',
  avatar: null,
  level: '라멘 미식가',
  levelNumber: 5,
  membershipNo: '#RT-0842',
  bio: '12시간 농축 동물계 육수와 꼬들한 면을 애호합니다.',
  favoriteRamenType: '돈코츠',
  visitedCount: 42,
  revisitCount: 28,
  isLoggedIn: true,
}

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
    content: '라멘로그 40그릇을 돌파하여 [라멘 미식가 (Lv.5)]로 공식 승급되었습니다 🏆',
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
    targetShopId: 2,
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

const INIT: State = {
  screen: 'home',
  activeTab: 'home',
  fromScreen: 'home',
  user: DEFAULT_USER,
  showRecordSheet: false,
  recordSheetMode: 'nearby',
  recordCount: 22,
  recordSaved: false,
  savedShop: false,
  recordShopName: '멘야준',
  recordStatus: 'idle',
  mapSelectedPin: 0,
  mapFilter: '전체',
  logs: INITIAL_LOGS,
  lastLog: null,
  notifications: INITIAL_NOTIFICATIONS,
  notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
}



function IconHome({ active }: { active: boolean }) {
  return <Home className="w-5 h-5" strokeWidth={active ? 2.3 : 1.8} color={active ? '#E60000' : '#7E7E7E'} />
}

function IconMap({ active }: { active: boolean }) {
  return <MapPin className="w-5 h-5" strokeWidth={active ? 2.3 : 1.8} color={active ? '#E60000' : '#7E7E7E'} />
}

function IconLounge({ active }: { active: boolean }) {
  return <MessageSquare className="w-5 h-5" strokeWidth={active ? 2.3 : 1.8} color={active ? '#E60000' : '#7E7E7E'} />
}

function IconNewsFeed({ active }: { active: boolean }) {
  return <Flame className="w-5 h-5" strokeWidth={active ? 2.3 : 1.8} color={active ? '#E60000' : '#7E7E7E'} />
}

function IconMy({ active }: { active: boolean }) {
  return <User className="w-5 h-5" strokeWidth={active ? 2.3 : 1.8} color={active ? '#E60000' : '#7E7E7E'} />
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

export default function App() {
  const [s, setS] = useState<State>(INIT)

  const patch = (partial: Partial<State>) => setS(prev => ({ ...prev, ...partial }))

  const nav = (screen: Screen, extra?: Partial<State>) =>
    setS(prev => ({ ...prev, ...extra, screen }))

  const setTab = (tab: Tab) =>
    setS(prev => ({ ...prev, activeTab: tab, screen: TAB_SCREENS[tab], fromScreen: prev.screen }))

  const startRecord = (shopName = '멘야준') => {
    patch({
      showRecordSheet: false,
      recordShopName: shopName,
      recordStatus: 'idle',
    })
    nav('record', { fromScreen: s.screen as Screen })
  }

  const handleSaveLog = (logData: {
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
  }) => {
    patch({ recordStatus: 'saving' })

    setTimeout(() => {
      const createdLog: RamenLog = {
        id: Date.now(),
        author: { name: '뿡뿡이', level: '돈골파 9레벨' },
        shop: { id: Date.now(), name: logData.shopName, branch: logData.branch, location: '서울 마포구' },
        menuName: logData.menuName,
        ramenType: logData.ramenType,
        visitedAt: logData.visitedAt,
        imageUrl: logData.imageUrl,
        note: logData.note,
        tasteNotes: logData.tasteNotes,
        revisit: logData.revisit,
        likes: 1,
        isLiked: true,
        isPublic: logData.isPublic,
        createdAt: '방금 전',
      }

      setS(prev => ({
        ...prev,
        recordStatus: 'success',
        recordCount: prev.recordCount + 1,
        recordSaved: true,
        lastLog: createdLog,
        logs: createdLog.isPublic ? [createdLog, ...prev.logs] : prev.logs,
        screen: 'recordComplete',
      }))
    }, 1200)
  }

  const renderScreen = () => {
    switch (s.screen) {
      case 'home':
        return (
          <HomeScreen
            user={s.user}
            recordSaved={s.recordSaved}
            unreadNotificationsCount={s.notifications.filter(n => !n.isRead).length}
            onNotificationClick={() => nav('notifications', { fromScreen: 'home' })}
            onShopClick={() => nav('shopDetail', { fromScreen: 'home' })}
            onRecordClick={(mode) => patch({ showRecordSheet: true, recordSheetMode: mode || 'nearby' })}
            onAIRecommendClick={() => nav('aiRecommend', { fromScreen: 'home' })}
            onViewTaste={() => nav('tasteDetail', { fromScreen: 'home' })}
            onLoginClick={() => nav('login', { fromScreen: 'home' })}
            onRegisterClick={() => nav('register', { fromScreen: 'home' })}
            onUserClick={() => nav('my', { activeTab: 'my' })}
            onMapClick={() => nav('map', { activeTab: 'map' })}
            onNewsFeedClick={() => nav('newsFeed', { activeTab: 'newsFeed' })}
          />
        )

      case 'login':
        return (
          <LoginScreen
            onBack={() => nav(s.fromScreen || 'home')}
            onRegisterClick={() => nav('register', { fromScreen: s.fromScreen || 'home' })}
            onLoginSuccess={(user) => {
              patch({ user })
              nav(s.fromScreen || 'home')
            }}
          />
        )
      case 'register':
        return (
          <RegisterScreen
            onBack={() => nav(s.fromScreen || 'home')}
            onLoginClick={() => nav('login', { fromScreen: s.fromScreen || 'home' })}
            onRegisterSuccess={(user) => {
              patch({ user, activeTab: 'home' })
              nav('home', { activeTab: 'home' })
            }}
          />
        )

      case 'map':
        return (
          <MapScreen
            selectedPin={s.mapSelectedPin}
            filter={s.mapFilter}
            onPinSelect={i => patch({ mapSelectedPin: i })}
            onFilterChange={f => patch({ mapFilter: f })}
            onShopClick={() => nav('shopDetail', { fromScreen: 'map' })}
          />
        )
      case 'shopDetail':
        return (
          <ShopDetailScreen
            savedShop={s.savedShop}
            onSaveShop={() => patch({ savedShop: !s.savedShop })}
            onBack={() => nav(s.fromScreen)}
            onRecord={() => startRecord('멘야준')}
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
            recordCount={s.recordCount}
            lastLog={s.lastLog}
            onViewTaste={() => nav('tasteDetail', { fromScreen: 'recordComplete' })}
            onHome={() => nav('home', { activeTab: 'home' })}
          />
        )
      case 'lounge':
        return (
          <LoungeScreen
            logs={s.logs}
            onRecordClick={() => patch({ showRecordSheet: true })}
            onShopClick={() => nav('shopDetail', { fromScreen: 'lounge' })}
          />
        )
      case 'newsFeed':
        return (
          <NewsFeedScreen
            onShopClick={() => nav('shopDetail', { fromScreen: 'newsFeed' })}
          />
        )
      case 'aiRecommend':
        return (
          <AIRecommendScreen
            onBack={() => nav('home', { activeTab: 'home' })}
            onShopClick={() => nav('shopDetail', { fromScreen: 'aiRecommend' })}
            onRecordShop={(shopName) => startRecord(shopName)}
          />
        )
      case 'my':
        return (
          <MyScreen
            user={s.user}
            recordSaved={s.recordSaved}
            recordCount={s.recordCount}
            unreadNotificationsCount={s.notifications.filter(n => !n.isRead).length}
            onNotificationClick={() => nav('notifications', { fromScreen: 'my' })}
            onShopClick={(_shopId) => nav('shopDetail', { fromScreen: 'my' })}
            onViewTaste={() => nav('tasteDetail', { fromScreen: 'my' })}
            onLoginClick={() => nav('login', { fromScreen: 'my' })}
            onRegisterClick={() => nav('register', { fromScreen: 'my' })}
            onLogout={() => {
              patch({ user: null })
              nav('login', { fromScreen: 'home' })
            }}
            onUpdateUser={(updated) => {
              patch({ user: s.user ? { ...s.user, ...updated } : null })
            }}
            onLoungeClick={() => nav('lounge', { activeTab: 'lounge' })}
          />
        )





      case 'tasteDetail':
        return (
          <TasteDetailScreen
            onBack={() => {
              if (s.fromScreen === 'recordComplete') {
                nav('home', { activeTab: 'home' })
              } else {
                nav(s.fromScreen || 'my')
              }
            }}
            recordCount={s.recordCount}
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
            onNavigateToShop={(_shopId) => {
              nav('shopDetail', { fromScreen: 'notifications' })
            }}
            onNavigateToLounge={() => {
              nav('lounge', { activeTab: 'lounge' })
            }}
            onNavigateToMy={() => {
              nav('my', { activeTab: 'my' })
            }}
          />
        )

      default:
        return (
          <HomeScreen
            user={s.user}
            recordSaved={s.recordSaved}
            unreadNotificationsCount={s.notifications.filter(n => !n.isRead).length}
            onNotificationClick={() => nav('notifications', { fromScreen: 'home' })}
            onShopClick={() => nav('shopDetail', { fromScreen: 'home' })}
            onRecordClick={(mode) => patch({ showRecordSheet: true, recordSheetMode: mode || 'nearby' })}
            onAIRecommendClick={() => nav('aiRecommend', { fromScreen: 'home' })}
            onLoginClick={() => nav('login', { fromScreen: 'home' })}
            onRegisterClick={() => nav('register', { fromScreen: 'home' })}
            onUserClick={() => nav('my', { activeTab: 'my' })}
            onMapClick={() => nav('map', { activeTab: 'map' })}
            onNewsFeedClick={() => nav('newsFeed', { activeTab: 'newsFeed' })}
          />
        )


    }
  }

  const showTabBar = ['home', 'map', 'lounge', 'newsFeed', 'my'].includes(s.screen)
  const tabForScreen: Partial<Record<Screen, Tab>> = {
    home: 'home',
    map: 'map',
    lounge: 'lounge',
    newsFeed: 'newsFeed',
    my: 'my',
  }
  const displayTab = tabForScreen[s.screen] ?? s.activeTab
  const isDarkStatusBar = s.screen === 'my'

  return (
    <main className="w-full h-full min-h-screen max-h-screen overflow-hidden bg-[#121316] flex items-center justify-center p-0 sm:p-3 selection:bg-brand selection:text-white">
      {/* iPhone 16 Pro Style Shell Container */}
      <div className="relative w-full max-w-[390px] h-full sm:h-[min(844px,calc(100vh-20px))] bg-white sm:rounded-[48px] sm:shadow-[0_25px_70px_rgba(0,0,0,0.5)] sm:border-[8px] sm:border-[#1C1D21] flex flex-col overflow-hidden">

        {/* iPhone Top Status Bar + Dynamic Island */}
        <div className={`relative z-50 h-11 px-6 flex items-center justify-between select-none pointer-events-none shrink-0 transition-colors duration-200 ${
          isDarkStatusBar ? 'bg-[#25282B]' : 'bg-white border-b border-[#F2F2F2]'
        }`}>
          {/* Status Bar Clock */}
          <span className={`text-[13.5px] font-black tracking-tight ${isDarkStatusBar ? 'text-white' : 'text-[#25282B]'}`}>
            9:41
          </span>

          {/* Dynamic Island Notch */}
          <div className="absolute left-1/2 -translate-x-1/2 top-2 w-[92px] h-[26px] bg-black rounded-full flex items-center justify-end pr-2.5 shadow-xs">
            {/* Front Camera Lens */}
            <div className="w-2.5 h-2.5 rounded-full bg-[#1A1A1C] border border-stone-800 flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-[#0D1B2A]" />
            </div>
          </div>

          {/* Status Bar Icons (Signal + WiFi + Battery) */}
          <div className={`flex items-center gap-1.5 ${isDarkStatusBar ? 'text-white' : 'text-[#25282B]'}`}>
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <rect x="2" y="16" width="3" height="6" rx="1" />
              <rect x="7" y="12" width="3" height="10" rx="1" />
              <rect x="12" y="8" width="3" height="14" rx="1" />
              <rect x="17" y="4" width="3" height="18" rx="1" />
            </svg>
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M12 4C7.31 4 3.07 5.9 0 8.98L12 21 24 8.98C20.93 5.9 16.69 4 12 4z" />
            </svg>
            <div className={`w-5 h-2.5 border rounded-[3px] p-0.5 flex items-center relative ${
              isDarkStatusBar ? 'border-white/70' : 'border-[#25282B]'
            }`}>
              <div className={`w-full h-full rounded-[1px] ${isDarkStatusBar ? 'bg-white' : 'bg-[#25282B]'}`} />
              <div className={`absolute -right-1 w-0.5 h-1 rounded-r-xs ${isDarkStatusBar ? 'bg-white/70' : 'bg-[#25282B]'}`} />
            </div>
          </div>
        </div>

        {/* Screen area */}
        <div className="relative overflow-hidden flex-1 min-h-0 flex flex-col bg-white">
          {renderScreen()}
        </div>

        {/* 5-Tab Navigation Bar */}
        {showTabBar && (
          <nav className="relative z-40 flex-shrink-0 bg-white border-t border-[#E2E2E2] overflow-visible">
            <div className="flex items-center h-13 px-1">
              {TAB_DEFS.map(({ id, label, Icon }) => {
                const active = displayTab === id
                return (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className="flex-1 flex flex-col items-center justify-center gap-0.5 h-full relative transition-all active:scale-95"
                    aria-label={`${label} 탭`}
                    aria-current={active ? 'page' : undefined}
                  >
                    {active && (
                      <span className="absolute top-0 w-6 h-0.5 bg-[#E60000] anim-fade-in" />
                    )}
                    <Icon active={active} />
                    <span className={`text-[10px] font-bold tracking-tight transition-colors ${active ? 'text-[#E60000]' : 'text-[#7E7E7E]'}`}>
                      {label}
                    </span>
                  </button>
                )
              })}
            </div>
          </nav>
        )}

        {/* iPhone Bottom Home Indicator Bar */}
        <div className="shrink-0 bg-white pt-1 pb-2 flex justify-center items-center pointer-events-none">
          <div className="w-32 h-1 bg-black/60 rounded-full" />
        </div>

        {/* Record sheet overlay */}
        {s.showRecordSheet && (
          <RecordSheet
            initialMode={s.recordSheetMode || 'nearby'}
            onClose={() => patch({ showRecordSheet: false })}
            onSelectShop={(shopName) => startRecord(shopName || '멘야준')}
          />
        )}
      </div>
    </main>
  )
}
