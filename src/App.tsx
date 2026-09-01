import { useState } from 'react'
import HomeScreen from './screens/HomeScreen'
import MapScreen from './screens/MapScreen'
import ShopDetailScreen from './screens/ShopDetailScreen'
import RecordSheet from './screens/RecordSheet'
import RecordScreen from './screens/RecordScreen'
import RecordCompleteScreen from './screens/RecordCompleteScreen'
import MyScreen from './screens/MyScreen'
import TasteDetailScreen from './screens/TasteDetailScreen'
import LoungeScreen from './screens/LoungeScreen'
import NewsFeedScreen from './screens/NewsFeedScreen'
import AIRecommendScreen from './screens/AIRecommendScreen'
import type { RamenLog, RevisitOption, TasteNotes } from './types'

type Screen = 'home' | 'map' | 'shopDetail' | 'record' | 'recordComplete' | 'my' | 'tasteDetail' | 'lounge' | 'newsFeed' | 'aiRecommend'
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
  showRecordSheet: boolean
  recordCount: number
  recordSaved: boolean
  savedShop: boolean
  recordShopName: string
  recordStatus: 'idle' | 'saving' | 'error' | 'success'
  mapSelectedPin: number
  mapFilter: string
  logs: RamenLog[]
  lastLog: RamenLog | null
}

const INIT: State = {
  screen: 'home',
  activeTab: 'home',
  fromScreen: 'home',
  showRecordSheet: false,
  recordCount: 22,
  recordSaved: false,
  savedShop: false,
  recordShopName: '멘야준',
  recordStatus: 'idle',
  mapSelectedPin: 0,
  mapFilter: '전체',
  logs: INITIAL_LOGS,
  lastLog: null,
}

function IconHome({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#E60000' : '#7E7E7E'} strokeWidth={active ? '2.3' : '1.8'} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
      <path d="M9 21V12h6v9"/>
    </svg>
  )
}

function IconMap({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#E60000' : '#7E7E7E'} strokeWidth={active ? '2.3' : '1.8'} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
      <circle cx="12" cy="9" r="2.5"/>
    </svg>
  )
}

function IconLounge({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#E60000' : '#7E7E7E'} strokeWidth={active ? '2.3' : '1.8'} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      <path d="M8 9h8M8 13h5"/>
    </svg>
  )
}

function IconNewsFeed({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#E60000' : '#7E7E7E'} strokeWidth={active ? '2.3' : '1.8'} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )
}

function IconMy({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? '#E60000' : '#7E7E7E'} strokeWidth={active ? '2.3' : '1.8'} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  )
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
            recordSaved={s.recordSaved}
            onShopClick={() => nav('shopDetail', { fromScreen: 'home' })}
            onRecordClick={() => patch({ showRecordSheet: true })}
            onAIRecommendClick={() => nav('aiRecommend', { fromScreen: 'home' })}
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
            recordSaved={s.recordSaved}
            recordCount={s.recordCount}
            onViewTaste={() => nav('tasteDetail', { fromScreen: 'my' })}
          />
        )
      case 'tasteDetail':
        return (
          <TasteDetailScreen
            onBack={() => {
              if (s.fromScreen === 'recordComplete') {
                nav('home', { activeTab: 'home' })
              } else {
                nav(s.fromScreen)
              }
            }}
            recordCount={s.recordCount}
          />
        )
      default:
        return (
          <HomeScreen
            recordSaved={s.recordSaved}
            onShopClick={() => nav('shopDetail', { fromScreen: 'home' })}
            onRecordClick={() => patch({ showRecordSheet: true })}
            onAIRecommendClick={() => nav('aiRecommend', { fromScreen: 'home' })}
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

  return (
    <main className="w-full h-full min-h-screen max-h-screen overflow-hidden bg-[#121316] flex items-center justify-center p-0 sm:p-3 selection:bg-brand selection:text-white">
      <div className="relative w-full max-w-[380px] h-full sm:h-[min(812px,calc(100vh-28px))] bg-white sm:rounded-[32px] sm:shadow-2xl sm:border-[6px] sm:border-[#22242A] flex flex-col overflow-hidden">

        {/* Screen area */}
        <div className={`relative overflow-hidden ${showTabBar ? 'flex-1' : 'h-full'} bg-white`}>
          {renderScreen()}
        </div>

        {/* 5-Tab Navigation Bar */}
        {showTabBar && (
          <nav className="relative z-40 flex-shrink-0 bg-white border-t border-[#E2E2E2] overflow-visible" style={{ paddingBottom: 'env(safe-area-inset-bottom, 6px)' }}>
            <div className="flex items-center h-14 px-1">
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

        {/* Record sheet overlay */}
        {s.showRecordSheet && (
          <RecordSheet
            onClose={() => patch({ showRecordSheet: false })}
            onSelectShop={() => startRecord('멘야준')}
          />
        )}
      </div>
    </main>
  )
}
