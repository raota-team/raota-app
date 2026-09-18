import { useEffect, useRef, useState } from 'react'
import { Bell, Heart, MessageSquare, Megaphone, Trophy, Settings, ChevronLeft, Check, CheckCheck, X } from 'lucide-react'
import RamenIcon from '../components/icons/RamenIcon'
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

/** 토글 스위치. 보이는 트랙은 44×24지만 버튼 히트 영역은 44×44 이상이다. 이름은 labelledBy로 연결한다. */
function ToggleSwitch({
  checked,
  onChange,
  labelledBy,
  disabled = false,
}: {
  checked: boolean
  onChange: () => void
  labelledBy: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={onChange}
      className={`flex h-11 min-w-11 shrink-0 items-center justify-end ${disabled ? 'cursor-not-allowed' : ''}`}
    >
      <span
        aria-hidden="true"
        className={`relative inline-flex h-6 w-11 rounded-full transition-colors duration-200 ${
          disabled ? 'bg-[#E2E2E2] opacity-60' : checked ? 'bg-[#E60000]' : 'bg-[#BEBEBE]'
        }`}
      >
        <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </span>
    </button>
  )
}

const TYPE_LABEL: Record<AppNotification['type'], string> = {
  like: '공감',
  comment: '댓글',
  shop: '라멘집',
  level: '승급',
  notice: '공지',
}

function TypeIcon({ type }: { type: AppNotification['type'] }) {
  const cls = 'h-4 w-4'
  const icon =
    type === 'like' ? (
      <Heart className={`${cls} fill-[#E60000] text-[#E60000]`} />
    ) : type === 'comment' ? (
      <MessageSquare className={cls} />
    ) : type === 'shop' ? (
      <RamenIcon className={cls} />
    ) : type === 'level' ? (
      <Trophy className={cls} />
    ) : (
      <Megaphone className={cls} />
    )
  return (
    <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F2F2F2] text-[#25282B]">
      {icon}
    </span>
  )
}

function NotificationItem({ item, onClick }: { item: AppNotification; onClick: () => void }) {
  return (
    <li className="border-b border-[#F2F2F2] last:border-b-0">
      <button
        type="button"
        onClick={onClick}
        aria-label={`${item.isRead ? '' : '읽지 않음, '}${TYPE_LABEL[item.type]}: ${item.title}`}
        className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors ${item.isRead ? 'bg-white' : 'bg-[#FFF7F7]'}`}
      >
        <TypeIcon type={item.type} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="shrink-0 rounded-[4px] bg-[#F2F2F2] px-1.5 py-0.5 text-[12px] font-bold text-[#4A4D52]">{TYPE_LABEL[item.type]}</span>
            <p className={`truncate text-[14px] ${item.isRead ? 'font-semibold text-[#4A4D52]' : 'font-black text-[#25282B]'}`}>{item.title}</p>
          </div>
          <p className={`mt-0.5 line-clamp-2 break-keep text-[13px] leading-snug ${item.isRead ? 'text-[#6B6E73]' : 'text-[#25282B]'}`}>{item.content}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
          <span className="text-[12px] text-[#6B6E73]">{item.time}</span>
          {!item.isRead && <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#E60000]" />}
        </div>
      </button>
    </li>
  )
}

const SETTING_ROWS: { key: Exclude<keyof NotificationSettings, 'pushEnabled'>; title: string; desc: string }[] = [
  { key: 'likesEnabled', title: '라멘로그 공감', desc: '내 라멘로그에 다른 라멘러가 공감했을 때' },
  { key: 'commentsEnabled', title: '게시글 및 라멘로그 댓글', desc: '내 글이나 기록에 새 댓글이 달렸을 때' },
  { key: 'levelUpEnabled', title: '등급 승급과 기록 리마인더', desc: '활동 등급 승급, 라멘로그 캘린더 리마인드' },
  { key: 'shopNewsEnabled', title: '관심 라멘집 소식', desc: '찜한 라멘집의 한정 메뉴, 휴무 소식' },
]

export default function NotificationScreen({
  notifications,
  settings,
  onBack,
  onMarkAllAsRead,
  onReadNotification,
  onUpdateSettings,
  onNavigateToShop,
  onNavigateToLounge,
  onNavigateToMy,
}: Props) {
  const [tab, setTab] = useState<TabFilter>('all')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const settingsCloseRef = useRef<HTMLButtonElement>(null)
  const settingsTriggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!toastMsg) return
    const timer = setTimeout(() => setToastMsg(null), 2500)
    return () => clearTimeout(timer)
  }, [toastMsg])

  // 설정 시트: 열리면 닫기 버튼으로 포커스, Escape로 닫고 포커스를 되돌린다
  useEffect(() => {
    if (!isSettingsOpen) return
    settingsCloseRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSettingsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      settingsTriggerRef.current?.focus()
    }
  }, [isSettingsOpen])

  const unreadCount = notifications.filter(n => !n.isRead).length

  const matchesTab = (item: AppNotification, key: TabFilter) => {
    if (key === 'all') return true
    if (key === 'activity') return item.type === 'like' || item.type === 'comment'
    if (key === 'shop') return item.type === 'shop'
    return item.type === 'level' || item.type === 'notice'
  }

  const filteredNotifications = notifications.filter(item => matchesTab(item, tab))

  const TABS: { key: TabFilter; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'activity', label: '활동' },
    { key: 'shop', label: '관심 라멘집' },
    { key: 'system', label: '승급·공지' },
  ]

  const handleNotificationClick = (item: AppNotification) => {
    if (!item.isRead) onReadNotification(item.id)
    if (item.type === 'like' || item.type === 'comment') onNavigateToLounge?.()
    else if (item.type === 'shop' && item.targetShopId) onNavigateToShop?.(item.targetShopId)
    else if (item.type === 'level') onNavigateToMy?.()
  }

  const handleToggleSetting = (key: keyof NotificationSettings) => {
    onUpdateSettings({ ...settings, [key]: !settings[key] })
    setToastMsg('알림 설정을 저장했습니다.')
  }

  const emptyMessage =
    tab === 'activity'
      ? { title: '활동 알림이 없습니다', desc: '라멘로그를 남기고 라멘러들과 소통하면 알림이 도착합니다.' }
      : tab === 'shop'
        ? { title: '관심 라멘집 소식이 없습니다', desc: '자주 가는 라멘집을 찜하면 한정 메뉴와 휴무 소식을 받아볼 수 있습니다.' }
        : tab === 'system'
          ? { title: '승급·공지 알림이 없습니다', desc: '활동 등급 승급과 서비스 업데이트 소식이 여기에 표시됩니다.' }
          : { title: '도착한 알림이 없습니다', desc: '라멘로그에 반응이 오거나 관심 라멘집에 소식이 생기면 알려드릴게요.' }

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-white text-[#25282B]">
      <header className="flex shrink-0 items-center justify-between border-b border-[#E2E2E2] bg-white py-1 pl-1 pr-1.5">
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            onClick={onBack}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#25282B] transition-colors hover:bg-[#F2F2F2]"
            aria-label="뒤로가기"
          >
            <ChevronLeft className="h-6 w-6" aria-hidden="true" />
          </button>
          <div className="flex items-center gap-1.5">
            <h1 className="text-[20px] font-black tracking-tight text-[#25282B]">알림</h1>
            {unreadCount > 0 && (
              <span className="min-w-[20px] rounded-full bg-[#E60000] px-1.5 py-0.5 text-center text-[12px] font-black leading-none text-white">
                {unreadCount}
                <span className="sr-only">개 읽지 않음</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllAsRead}
              className="flex min-h-11 items-center gap-1 rounded-[6px] px-2.5 text-[13px] font-bold text-[#4A4D52] transition-colors hover:text-[#E60000]"
            >
              <CheckCheck className="h-4 w-4" aria-hidden="true" />
              <span>모두 읽음</span>
            </button>
          )}
          <button
            ref={settingsTriggerRef}
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[#25282B] transition-colors hover:bg-[#F2F2F2]"
            aria-label="알림 설정"
            aria-haspopup="dialog"
          >
            <Settings className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div role="group" aria-label="알림 종류" className="no-scrollbar flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-[#E2E2E2] bg-white px-4">
        {TABS.map(t => {
          const isActive = tab === t.key
          const unreadInTab = notifications.filter(n => !n.isRead && matchesTab(n, t.key)).length
          return (
            <button key={t.key} type="button" onClick={() => setTab(t.key)} aria-pressed={isActive} className="flex min-h-11 shrink-0 items-center">
              <span
                className={`inline-flex items-center gap-1.5 rounded-[32px] px-3.5 py-1.5 text-[13px] font-bold transition-colors ${
                  isActive ? 'bg-[#25282B] text-white' : 'bg-[#F2F2F2] text-[#4A4D52]'
                }`}
              >
                {t.label}
                {unreadInTab > 0 && (
                  <span className={`text-[12px] ${isActive ? 'text-white/80' : 'text-[#E60000]'}`}>
                    {unreadInTab}
                    <span className="sr-only">개 읽지 않음</span>
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto bg-white">
        {filteredNotifications.length === 0 ? (
          <div className="anim-fade-in px-6 py-20 text-center">
            <span aria-hidden="true" className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#F2F2F2] text-[#6B6E73]">
              <Bell className="h-6 w-6 stroke-[1.5]" />
            </span>
            <p className="text-[15px] font-black text-[#25282B]">{emptyMessage.title}</p>
            <p className="mx-auto mt-1 max-w-xs text-[13px] leading-snug text-[#6B6E73]">{emptyMessage.desc}</p>
          </div>
        ) : (
          <ul aria-label="알림 목록">
            {filteredNotifications.map(item => (
              <NotificationItem key={item.id} item={item} onClick={() => handleNotificationClick(item)} />
            ))}
          </ul>
        )}
      </div>

      {isSettingsOpen && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end overflow-hidden">
          <button
            type="button"
            className="anim-fade-in absolute inset-0 bg-black/50"
            onClick={() => setIsSettingsOpen(false)}
            aria-label="알림 설정 닫기"
            tabIndex={-1}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-settings-title"
            className="anim-slide-up relative z-10 flex max-h-[85%] w-full flex-col rounded-t-[12px] bg-white text-[#25282B] shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
          >
            <div aria-hidden="true" className="flex shrink-0 justify-center pb-1 pt-3">
              <span className="h-1 w-10 rounded-full bg-[#E2E2E2]" />
            </div>

            <div className="flex shrink-0 items-center justify-between border-b border-[#F2F2F2] py-1 pl-5 pr-2">
              <h2 id="notification-settings-title" className="flex items-center gap-1.5 text-[17px] font-black text-[#25282B]">
                <Bell className="h-4 w-4 text-[#E60000]" aria-hidden="true" />
                <span>알림 수신 설정</span>
              </h2>
              <button
                ref={settingsCloseRef}
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-full text-[#6B6E73] transition-colors hover:bg-[#F2F2F2] hover:text-[#25282B]"
                aria-label="닫기"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="no-scrollbar overflow-y-auto px-5 py-2">
              <p className="py-2 text-[13px] leading-snug text-[#6B6E73]">받고 싶은 푸시 알림만 골라 켜 두세요.</p>

              <div className="flex items-center justify-between gap-3 border-b border-[#E2E2E2] py-2">
                <div className="min-w-0">
                  <p id="setting-push-title" className="text-[15px] font-black text-[#25282B]">
                    앱 푸시 알림 받기
                  </p>
                  <p className="mt-0.5 text-[13px] text-[#6B6E73]">끄면 아래 항목도 모두 받지 않습니다.</p>
                </div>
                <ToggleSwitch checked={settings.pushEnabled} labelledBy="setting-push-title" onChange={() => handleToggleSetting('pushEnabled')} />
              </div>

              <ul className="divide-y divide-[#F2F2F2]">
                {SETTING_ROWS.map(row => (
                  <li key={row.key} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p id={`setting-${row.key}-title`} className={`text-[14px] font-bold ${settings.pushEnabled ? 'text-[#25282B]' : 'text-[#6B6E73]'}`}>
                        {row.title}
                      </p>
                      <p className="mt-0.5 text-[13px] text-[#6B6E73]">{row.desc}</p>
                    </div>
                    <ToggleSwitch
                      disabled={!settings.pushEnabled}
                      checked={settings[row.key]}
                      labelledBy={`setting-${row.key}-title`}
                      onChange={() => handleToggleSetting(row.key)}
                    />
                  </li>
                ))}
              </ul>
            </div>

            <div className="shrink-0 border-t border-[#F2F2F2] bg-white p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="h-12 w-full rounded-[60px] bg-[#25282B] text-[15px] font-bold text-white transition-opacity active:opacity-90"
              >
                설정 완료
              </button>
            </div>
          </section>
        </div>
      )}

      {toastMsg && (
        <div
          role="status"
          className="anim-fade-in-up pointer-events-none absolute bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-[32px] bg-[#25282B] px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
        >
          <Check className="h-4 w-4 text-[#E60000]" aria-hidden="true" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  )
}
