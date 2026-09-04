import { useState } from 'react'
import {
  Bell,
  Heart,
  MessageSquare,
  Megaphone,
  Soup,
  Trophy,
  Settings,
  ChevronLeft,
  Check,
  CheckCheck,
  X,
  Sparkles,
} from 'lucide-react'
import type { AppNotification, NotificationSettings } from '../types'

interface Props {
  notifications: AppNotification[]
  settings: NotificationSettings
  onBack: () => void
  onMarkAllAsRead: () => void
  onReadNotification: (id: string) => void
  onDeleteNotification?: (id: string) => void
  onUpdateSettings: (newSettings: NotificationSettings) => void
  onNavigateToShop?: (shopId: number) => void
  onNavigateToLounge?: () => void
  onNavigateToMy?: () => void
}

type TabFilter = 'all' | 'activity' | 'shop' | 'system'

// 📱 iOS 스타일 토글 스위치 컴포넌트
function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean
  onChange: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
        disabled
          ? 'opacity-40 cursor-not-allowed bg-stone-200'
          : checked
          ? 'bg-[#E60000]'
          : 'bg-stone-300'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out mt-0.5 ml-0.5 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

// 📄 알림 아이템 컴포넌트 (삭제 기능 없이 탭하여 읽음/이동)
interface NotificationItemProps {
  item: AppNotification
  onClick: () => void
  icon: React.ReactNode
  typeBadge: React.ReactNode
}

function NotificationItem({
  item,
  onClick,
  icon,
  typeBadge,
}: NotificationItemProps) {
  return (
    <div
      onClick={onClick}
      className={`p-3.5 select-none transition-colors cursor-pointer flex items-start justify-between gap-3 border-b border-[#F0F0F2] last:border-b-0 active:scale-[0.99] ${
        item.isRead
          ? 'bg-white hover:bg-[#F7F7F8]'
          : 'bg-[#FFEFEF] hover:bg-[#FFE5E5]'
      }`}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {icon}
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-center gap-1.5 mb-0.5">
            {typeBadge}
            <p
              className={`text-[12.5px] truncate ${
                item.isRead
                  ? 'font-semibold text-stone-700'
                  : 'font-black text-[#1C1D21]'
              }`}
            >
              {item.title}
            </p>
          </div>

          <p
            className={`text-[11.5px] leading-snug break-keep line-clamp-2 ${
              item.isRead ? 'text-stone-500' : 'text-stone-700'
            }`}
          >
            {item.content}
          </p>
        </div>
      </div>

      {/* 우측 상단 타임스탬프 */}
      <div className="flex flex-col items-end justify-between self-stretch shrink-0 pl-1">
        <span className="text-[10px] text-stone-400 font-mono">
          {item.time}
        </span>
      </div>
    </div>
  )
}

export default function NotificationScreen({
  notifications,
  settings,
  onBack,
  onMarkAllAsRead,
  onReadNotification,
  onDeleteNotification,
  onUpdateSettings,
  onNavigateToShop,
  onNavigateToLounge,
  onNavigateToMy,
}: Props) {
  const [tab, setTab] = useState<TabFilter>('all')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 2500)
  }

  const unreadCount = notifications.filter(n => !n.isRead).length

  // 탭별 알림 필터
  const filteredNotifications = notifications.filter(item => {
    if (tab === 'all') return true
    if (tab === 'activity') return item.type === 'like' || item.type === 'comment'
    if (tab === 'shop') return item.type === 'shop'
    if (tab === 'system') return item.type === 'level' || item.type === 'notice'
    return true
  })

  // 탭별 읽지 않은 알림 카운트
  const unreadByTab = {
    all: unreadCount,
    activity: notifications.filter(n => !n.isRead && (n.type === 'like' || n.type === 'comment')).length,
    shop: notifications.filter(n => !n.isRead && n.type === 'shop').length,
    system: notifications.filter(n => !n.isRead && (n.type === 'level' || n.type === 'notice')).length,
  }

  const handleNotificationClick = (item: AppNotification) => {
    if (!item.isRead) {
      onReadNotification(item.id)
    }
    if (item.type === 'like' || item.type === 'comment') {
      if (onNavigateToLounge) onNavigateToLounge()
    } else if (item.type === 'shop' && item.targetShopId && onNavigateToShop) {
      onNavigateToShop(item.targetShopId)
    } else if (item.type === 'level' && onNavigateToMy) {
      onNavigateToMy()
    }
  }

  const handleToggleSetting = (key: keyof NotificationSettings) => {
    const updated = { ...settings, [key]: !settings[key] }
    onUpdateSettings(updated)
    showToast('알림 설정이 저장되었습니다.')
  }

  const getIconByType = (type: AppNotification['type']) => {
    switch (type) {
      case 'like':
        return (
          <div className="w-8 h-8 rounded-[8px] bg-red-50 text-[#E60000] border border-red-200/60 flex items-center justify-center shrink-0">
            <Heart className="w-4 h-4 fill-[#E60000] text-[#E60000]" />
          </div>
        )
      case 'comment':
        return (
          <div className="w-8 h-8 rounded-[8px] bg-blue-50 text-blue-600 border border-blue-200/60 flex items-center justify-center shrink-0">
            <MessageSquare className="w-4 h-4 text-blue-600" />
          </div>
        )
      case 'shop':
        return (
          <div className="w-8 h-8 rounded-[8px] bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center shrink-0">
            <Soup className="w-4 h-4 text-amber-600" />
          </div>
        )
      case 'level':
        return (
          <div className="w-8 h-8 rounded-[8px] bg-purple-50 text-purple-600 border border-purple-200/60 flex items-center justify-center shrink-0">
            <Trophy className="w-4 h-4 text-purple-600" />
          </div>
        )
      case 'notice':
        return (
          <div className="w-8 h-8 rounded-[8px] bg-stone-100 text-stone-700 border border-stone-200 flex items-center justify-center shrink-0">
            <Megaphone className="w-4 h-4 text-stone-700" />
          </div>
        )
    }
  }

  const getTypeBadge = (type: AppNotification['type'], isRead: boolean) => {
    if (isRead) {
      const label =
        type === 'like'
          ? '공감'
          : type === 'comment'
          ? '댓글'
          : type === 'shop'
          ? '라멘집'
          : type === 'level'
          ? '승급'
          : '공지'
      return (
        <span className="text-[9.5px] font-bold text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded shrink-0">
          {label}
        </span>
      )
    }
    switch (type) {
      case 'like':
        return (
          <span className="text-[9.5px] font-bold text-[#E60000] bg-red-100/80 px-1.5 py-0.5 rounded shrink-0">
            공감
          </span>
        )
      case 'comment':
        return (
          <span className="text-[9.5px] font-bold text-blue-600 bg-blue-100/80 px-1.5 py-0.5 rounded shrink-0">
            댓글
          </span>
        )
      case 'shop':
        return (
          <span className="text-[9.5px] font-bold text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded shrink-0">
            라멘집
          </span>
        )
      case 'level':
        return (
          <span className="text-[9.5px] font-bold text-purple-700 bg-purple-100/80 px-1.5 py-0.5 rounded shrink-0">
            승급
          </span>
        )
      case 'notice':
        return (
          <span className="text-[9.5px] font-bold text-stone-700 bg-stone-200/80 px-1.5 py-0.5 rounded shrink-0">
            공지
          </span>
        )
    }
  }

  const getEmptyMessage = () => {
    switch (tab) {
      case 'activity':
        return {
          title: '활동 알림이 없습니다',
          desc: '라멘로그를 작성하고 라멘러들과 소통하면 알림이 도착합니다.',
        }
      case 'shop':
        return {
          title: '관심 라멘집 소식이 없습니다',
          desc: '자주 가는 라멘집을 저장하면 신메뉴와 계절 한정 소식을 받아볼 수 있습니다.',
        }
      case 'system':
        return {
          title: '새로운 시스템 알림이 없습니다',
          desc: '활동 등급 승급 및 서비스 주요 업데이트 소식이 여기에 표시됩니다.',
        }
      default:
        return {
          title: '도착한 알림이 없습니다',
          desc: '새로운 라멘로그 반응이나 관심 매장의 소식이 생기면 알려드릴게요.',
        }
    }
  }

  return (
    <div className="h-full overflow-y-auto no-scrollbar bg-[#FBFBFB] text-[#25282B] relative selection:bg-[#E60000] selection:text-white flex flex-col">
      {/* 1. 상단 네비게이션 헤더 */}
      <header className="bg-white px-3.5 pt-3.5 pb-3 border-b border-[#EAEAEA] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#25282B] hover:bg-[#F2F2F2] active:scale-95 transition-all -ml-1 shrink-0"
            aria-label="뒤로가기"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1.5">
            <h1 className="text-[16px] font-black tracking-tight text-[#25282B]">
              알림
            </h1>
            {unreadCount > 0 && (
              <span className="text-[10px] font-black bg-[#E60000] text-white px-1.5 py-0.2 rounded-full min-w-[18px] text-center leading-tight">
                {unreadCount}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllAsRead}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-stone-500 hover:text-[#E60000] transition-colors px-2 py-1 rounded-[6px] hover:bg-stone-50 active:scale-95"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>모두 읽음</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-stone-600 hover:text-[#25282B] hover:bg-[#F2F2F2] active:scale-95 transition-all"
            aria-label="알림 설정"
            title="알림 설정"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. 카테고리 필터 탭 (Pills with top-right clean red dot) */}
      <div className="px-3.5 py-2.5 bg-white border-b border-[#EAEAEA] overflow-x-auto no-scrollbar flex items-center gap-1.5 shrink-0">
        {[
          { key: 'all', label: '전체' },
          { key: 'activity', label: '활동' },
          { key: 'shop', label: '관심 라멘집' },
          { key: 'system', label: '승급·공지' },
        ].map(t => {
          const isActive = tab === t.key
          const unreadInTab = unreadByTab[t.key as TabFilter]
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key as TabFilter)}
              className={`relative px-3.5 py-1.5 rounded-[8px] text-[11.5px] font-bold transition-all shrink-0 active:scale-95 ${
                isActive
                  ? 'bg-[#25282B] text-white shadow-2xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70 border border-transparent'
              }`}
            >
              <span>{t.label}</span>
              {unreadInTab > 0 && (
                <span className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-[#E60000]" />
              )}
            </button>
          )
        })}
      </div>

      {/* 3. 알림 아이템 목록 피드 (보더 없이 은은한 틴트와 뱃지로 차별화) */}
      <div className="flex-1 bg-white">
        {filteredNotifications.length === 0 ? (
          <div className="py-24 text-center space-y-3 px-6 anim-fade-in select-none">
            <div className="w-13 h-13 rounded-full bg-stone-100 flex items-center justify-center mx-auto text-stone-400">
              <Bell className="w-6 h-6 stroke-[1.5]" />
            </div>

            <div>
              <p className="text-[14.5px] font-black text-[#25282B]">
                {getEmptyMessage().title}
              </p>
              <p className="text-[11.5px] text-stone-400 mt-1 max-w-xs mx-auto leading-snug">
                {getEmptyMessage().desc}
              </p>
            </div>
          </div>
        ) : (
          filteredNotifications.map(item => (
            <NotificationItem
              key={item.id}
              item={item}
              icon={getIconByType(item.type)}
              typeBadge={getTypeBadge(item.type, item.isRead)}
              onClick={() => handleNotificationClick(item)}
            />
          ))
        )}
      </div>

      {/* 4. 알림 수신 설정 바텀 시트 (모바일 화면 내에 엄격히 구속됨) */}
      {isSettingsOpen && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end overflow-hidden" role="presentation">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs anim-fade-in"
            onClick={() => setIsSettingsOpen(false)}
            aria-label="알림 설정 닫기"
            role="button"
            tabIndex={0}
          />
          <section className="relative w-full bg-white rounded-t-[20px] shadow-2xl border-t border-stone-200 anim-slide-up z-10 flex flex-col max-h-[85%] text-[#25282B]">
            {/* 드래그 핸들 */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-stone-300" />
            </div>

            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3 shrink-0">
              <h3 className="text-[15.5px] font-black text-[#25282B] flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-[#E60000]" />
                <span>알림 수신 설정</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-400 hover:text-[#25282B] transition-colors"
                aria-label="닫기"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3.5 overflow-y-auto no-scrollbar">
              <p className="text-[11.5px] text-stone-500 leading-snug">
                라오타에서 수신하고 싶은 푸시 알림 항목을 설정할 수 있습니다.
              </p>

              {/* 1. 마스터 푸시 알림 (Featured Card) */}
              <div className="p-3.5 bg-stone-50 rounded-[12px] border border-stone-200/80 flex items-center justify-between">
                <div>
                  <p className="text-[12.5px] font-black text-[#25282B]">앱 푸시 알림 받기</p>
                  <p className="text-[10.5px] text-stone-500 mt-0.5">라오타의 모든 주요 알림을 기기로 수신합니다.</p>
                </div>
                <ToggleSwitch
                  checked={settings.pushEnabled}
                  onChange={() => handleToggleSetting('pushEnabled')}
                />
              </div>

              {/* 2. 세부 항목 리스트 */}
              <div className="divide-y divide-stone-100 border border-stone-200 rounded-[12px] overflow-hidden bg-white">
                {/* 라멘로그 공감 */}
                <div className="p-3 flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <p className="text-[12px] font-bold text-[#25282B]">라멘로그 공감(좋아요)</p>
                    <p className="text-[10px] text-stone-400 mt-0.5">내 라멘로그에 다른 라멘러가 공감했을 때</p>
                  </div>
                  <ToggleSwitch
                    disabled={!settings.pushEnabled}
                    checked={settings.likesEnabled}
                    onChange={() => handleToggleSetting('likesEnabled')}
                  />
                </div>

                {/* 댓글 알림 */}
                <div className="p-3 flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <p className="text-[12px] font-bold text-[#25282B]">게시글 및 라멘로그 댓글</p>
                    <p className="text-[10px] text-stone-400 mt-0.5">내 글이나 리뷰에 새 댓글이 달렸을 때</p>
                  </div>
                  <ToggleSwitch
                    disabled={!settings.pushEnabled}
                    checked={settings.commentsEnabled}
                    onChange={() => handleToggleSetting('commentsEnabled')}
                  />
                </div>

                {/* 등급 승급 & 리마인더 */}
                <div className="p-3 flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <p className="text-[12px] font-bold text-[#25282B]">등급 승급 & 라멘로그 리마인더</p>
                    <p className="text-[10px] text-stone-400 mt-0.5">라멘 활동 등급 승급 및 라멘로그 캘린더 리마인드</p>
                  </div>
                  <ToggleSwitch
                    disabled={!settings.pushEnabled}
                    checked={settings.levelUpEnabled}
                    onChange={() => handleToggleSetting('levelUpEnabled')}
                  />
                </div>

                {/* 관심 라멘집 소식 */}
                <div className="p-3 flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <p className="text-[12px] font-bold text-[#25282B]">관심 라멘집 신메뉴/속보</p>
                    <p className="text-[10px] text-stone-400 mt-0.5">찜해둔 라멘집의 계절 한정 메뉴 및 휴무 소식</p>
                  </div>
                  <ToggleSwitch
                    disabled={!settings.pushEnabled}
                    checked={settings.shopNewsEnabled}
                    onChange={() => handleToggleSetting('shopNewsEnabled')}
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-stone-100 bg-white shrink-0">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="w-full h-10 rounded-[8px] bg-[#25282B] hover:bg-black text-white font-bold text-[12.5px] active:scale-98 transition-all shadow-xs"
              >
                설정 완료
              </button>
            </div>
          </section>
        </div>
      )}

      {/* 5. 하단 피드백 토스트 (모바일 화면 내에 구속) */}
      {toastMsg && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#25282B]/95 backdrop-blur-md text-white text-[11.5px] font-bold px-3.5 py-2 rounded-full shadow-lg anim-fade-in-up flex items-center gap-1.5 whitespace-nowrap pointer-events-none">
          <Check className="w-3.5 h-3.5 text-[#E60000]" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  )
}
