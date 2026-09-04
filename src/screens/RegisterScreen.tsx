import { useState, useRef } from 'react'
import { ChevronLeft, ChevronRight, Check, Soup, X, RotateCw, Camera, MapPin, Sparkles, BookOpen, Compass } from 'lucide-react'
import type { UserProfile } from '../types'

interface Props {
  onBack: () => void
  onLoginClick: () => void
  onRegisterSuccess: (user: UserProfile) => void
}

const AVATAR_PRESETS = [
  { id: 'shoyu', emoji: '🍜', label: '쇼유파' },
  { id: 'chashu', emoji: '🥩', label: '차슈러버' },
  { id: 'tamago', emoji: '🥚', label: '아지타마' },
  { id: 'spicy', emoji: '🌶️', label: '매운맛파' },
  { id: 'menma', emoji: '🎋', label: '멘마수집' },
]

const RAMEN_STYLE_OPTIONS = [
  { name: '쇼유 (간장)', key: '쇼유' },
  { name: '돈코츠 (돼지뼈)', key: '돈코츠' },
  { name: '토리파이탄 (닭백탕)', key: '토리파이탄' },
  { name: '시오 (소금)', key: '시오' },
  { name: '미소 (된장)', key: '미소' },
  { name: '츠케멘', key: '츠케멘' },
  { name: '마제소바', key: '마제소바' },
]

const QUICK_BIO_TAGS = [
  '진한 국물파',
  '자가제면 탐험가',
  '라멘 성지순례 중',
  '꼬들면 애호가',
]

export default function RegisterScreen({ onBack, onLoginClick, onRegisterSuccess }: Props) {
  const [nickname, setNickname] = useState('')
  const [bio, setBio] = useState('')
  const [selectedAvatarPreset, setSelectedAvatarPreset] = useState<string>('shoyu')
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string | null>(null)
  const [favoriteStyle, setFavoriteStyle] = useState<string>('쇼유')

  // 약관 동의
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [agreeMarketing, setAgreeMarketing] = useState(false)
  const [termsModalType, setTermsModalType] = useState<'terms' | 'privacy' | null>(null)

  const [isLoading, setIsLoading] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [onboardingTab, setOnboardingTab] = useState<'map' | 'log' | 'ai'>('map')
  const [registeredUser, setRegisteredUser] = useState<UserProfile | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)


  const fileInputRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 2500)
  }

  // 전체 동의 체크 여부
  const isAllAgreed = agreeTerms && agreePrivacy && agreeMarketing

  const handleToggleAllAgreed = () => {
    const nextState = !isAllAgreed
    setAgreeTerms(nextState)
    setAgreePrivacy(nextState)
    setAgreeMarketing(nextState)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast('이미지 크기는 5MB 이하여야 합니다.')
        return
      }
      const reader = new FileReader()
      reader.onload = ev => {
        setUploadedAvatarUrl(ev.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  // 닉네임 유효성
  const isNicknameValid = nickname.trim().length >= 2 && nickname.trim().length <= 12
  const isFormValid = isNicknameValid && agreeTerms && agreePrivacy

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nickname.trim()) {
      showToast('닉네임을 입력해주세요.')
      return
    }
    if (!isNicknameValid) {
      showToast('닉네임은 2자 이상 12자 이하여야 합니다.')
      return
    }
    if (!agreeTerms || !agreePrivacy) {
      showToast('필수 약관에 동의해주세요.')
      return
    }

    setIsLoading(true)

    setTimeout(() => {
      const newMembershipNo = `#RT-${Math.floor(1000 + Math.random() * 9000)}`
      const newUser: UserProfile = {
        id: `user-${Date.now()}`,
        name: nickname.trim(),
        nickname: nickname.trim(),
        email: `${nickname.trim().toLowerCase()}@raota.net`,
        avatar: uploadedAvatarUrl,
        level: '라멘 입문자',
        levelNumber: 1,
        membershipNo: newMembershipNo,
        bio: bio.trim() || '라오타에서 첫 라멘로그를 시작하는 라멘 입문자입니다.',
        favoriteRamenType: favoriteStyle,
        visitedCount: 0,
        revisitCount: 0,
        isLoggedIn: true,
      }

      setIsLoading(false)
      setRegisteredUser(newUser)
      setIsCompleted(true)
    }, 600)
  }

  // 🌟 가입 완료 축하 화면 (라오타 공식 가입 완료 & 인터랙티브 온보딩 가이드 뷰)
  if (isCompleted && registeredUser) {
    return (
      <div className="h-full flex flex-col justify-between bg-[#FFFFFF] text-[#25282B] overflow-y-auto no-scrollbar p-5 anim-fade-in">
        <div className="pt-2 text-center space-y-3">
          {/* 상단 라오타 공식 로고 & 웰컴 타이틀 */}
          <div>
            <img src="/logo.png" alt="RAOTA" className="w-14 h-14 object-contain mx-auto drop-shadow-sm mb-1.5" />
            <h2 className="text-[20px] font-black text-[#25282B] tracking-tight leading-snug">
              {registeredUser.nickname}님, 반가워요!
            </h2>
            <p className="text-[12px] text-[#7E7E7E] mt-0.5 font-medium">
              라오타의 핵심 기능 3가지를 미리 둘러보세요
            </p>
          </div>

          {/* 3단 인터랙티브 온보딩 탭 바 */}
          <div className="flex rounded-[8px] bg-[#F2F2F2] p-1 gap-1 border border-[#E2E2E2]">
            <button
              type="button"
              onClick={() => setOnboardingTab('map')}
              className={`flex-1 py-2 rounded-[6px] text-[11.5px] font-black transition-all flex items-center justify-center gap-1.5 ${
                onboardingTab === 'map'
                  ? 'bg-white text-[#25282B] shadow-xs'
                  : 'text-[#7E7E7E] hover:text-[#25282B]'
              }`}
            >
              <MapPin className={`w-3.5 h-3.5 ${onboardingTab === 'map' ? 'text-[#E60000]' : 'text-[#7E7E7E]'}`} />
              <span>라멘 지도</span>
            </button>

            <button
              type="button"
              onClick={() => setOnboardingTab('log')}
              className={`flex-1 py-2 rounded-[6px] text-[11.5px] font-black transition-all flex items-center justify-center gap-1.5 ${
                onboardingTab === 'log'
                  ? 'bg-white text-[#25282B] shadow-xs'
                  : 'text-[#7E7E7E] hover:text-[#25282B]'
              }`}
            >
              <Soup className={`w-3.5 h-3.5 ${onboardingTab === 'log' ? 'text-[#E60000]' : 'text-[#7E7E7E]'}`} />
              <span>라멘로그</span>
            </button>

            <button
              type="button"
              onClick={() => setOnboardingTab('ai')}
              className={`flex-1 py-2 rounded-[6px] text-[11.5px] font-black transition-all flex items-center justify-center gap-1.5 ${
                onboardingTab === 'ai'
                  ? 'bg-white text-[#25282B] shadow-xs'
                  : 'text-[#7E7E7E] hover:text-[#25282B]'
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 ${onboardingTab === 'ai' ? 'text-[#E60000]' : 'text-[#7E7E7E]'}`} />
              <span>AI 큐레이터</span>
            </button>
          </div>

          {/* 탭별 실제 UI 항목 프리뷰 & 가이드 */}
          <div className="bg-[#F9F9F9] rounded-[8px] border border-[#E2E2E2] p-4 text-left space-y-3.5 anim-fade-in key={onboardingTab}">
            {/* 1. 라멘 지도 탭: 실제 매장 카드 실물 렌더링 + 기능 설명 */}
            {onboardingTab === 'map' && (
              <>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] font-black text-[#E60000] tracking-wider uppercase">FEATURE 01</span>
                    <span className="text-[10px] font-bold text-[#2E7D32]">● 서울 120여 개 매장 연동</span>
                  </div>
                  <h3 className="text-[15px] font-black text-[#25282B]">
                    내 주변 라멘집 실시간 탐색
                  </h3>
                  <p className="text-[12px] text-[#7E7E7E] leading-relaxed pt-0.5">
                    전국 라멘 전문점의 실시간 영업 여부, 라스트오더, 시그니처 메뉴 라인업을 지도에서 한눈에 확인하고 바로 찾아갈 수 있습니다.
                  </p>
                </div>

                {/* 실제 매장 카드 프리뷰 */}
                <div className="bg-white rounded-[6px] border border-[#E2E2E2] p-3 shadow-xs space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-[4px] overflow-hidden bg-[#F2F2F2] flex-shrink-0 border border-[#E2E2E2]">
                      <img
                        src="https://images.unsplash.com/photo-1742633882713-593c13e90231?w=200&h=200&fit=crop&auto=format&q=80"
                        alt="멘야준"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between">
                        <h4 className="text-[13.5px] font-black text-[#25282B] truncate">멘야준 · 망원 본점</h4>
                        <span className="text-[11px] font-bold text-[#E60000]">240m</span>
                      </div>
                      <p className="text-[11px] text-[#7E7E7E] truncate">특제 쇼유 라멘 · 맑은 닭오리 육수</p>
                      <div className="flex items-center gap-1.5 mt-1 text-[10px]">
                        <span className="text-[#2E7D32] font-bold">● 영업 중</span>
                        <span className="text-stone-300">·</span>
                        <span className="text-[#7E7E7E]">LO 20:30</span>
                        <span className="text-stone-300">·</span>
                        <span className="text-[#7E7E7E]">라멘로그 128개</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#F2F2F2] flex items-center justify-between text-[10.5px]">
                    <div className="flex gap-1">
                      <span className="bg-[#F2F2F2] text-[#25282B] px-2 py-0.5 rounded-[32px] font-bold">#자가제면</span>
                      <span className="bg-[#F2F2F2] text-[#25282B] px-2 py-0.5 rounded-[32px] font-bold">#특제쇼유</span>
                    </div>
                    <span className="text-[#E60000] font-black">지도에서 확인 →</span>
                  </div>
                </div>
              </>
            )}

            {/* 2. 완식 기록 탭: 실제 라멘로그 시트 실물 렌더링 + 기능 설명 */}
            {onboardingTab === 'log' && (
              <>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] font-black text-[#E60000] tracking-wider uppercase">FEATURE 02</span>
                    <span className="text-[10px] font-bold bg-red-50 text-[#E60000] px-2 py-0.5 rounded-[32px]">라멘 입맛 분석</span>
                  </div>
                  <h3 className="text-[15px] font-black text-[#25282B]">
                    한 그릇 라멘로그 & 5가지 입맛 기록
                  </h3>
                  <p className="text-[12px] text-[#7E7E7E] leading-relaxed pt-0.5">
                    오늘 먹은 라멘의 육수 농도, 면 삶기, 국물 완식 여부를 꼼꼼히 기록하여 나만의 미각 DNA와 월별 라멘로그 캘린더를 완성하세요.
                  </p>
                </div>

                {/* 실제 라멘로그 카드 프리뷰 */}
                <div className="bg-white rounded-[6px] border border-[#E2E2E2] p-3 shadow-xs space-y-2.5">
                  <div className="flex items-center justify-between pb-2 border-b border-[#F2F2F2] text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-[#E60000] text-white flex items-center justify-center text-[9px] font-black">✓</span>
                      <span className="font-black text-[#25282B]">라멘로그 등록 완료</span>
                    </div>
                    <span className="text-[10px] text-[#7E7E7E]">오늘 방문</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-[4px] overflow-hidden bg-[#F2F2F2] flex-shrink-0 border border-[#E2E2E2]">
                      <img
                        src="https://images.unsplash.com/photo-1742633882711-ef7b3cee63d7?w=200&h=200&fit=crop&auto=format&q=80"
                        alt="오레노라멘"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[13.5px] font-black text-[#25282B]">오레노라멘 · 토리파이탄</h4>
                      <p className="text-[11px] text-[#7E7E7E] mt-0.5">“거품을 낸 닭백탕 육수의 크리미함이 일품”</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        <span className="text-[9.5px] font-bold bg-[#F2F2F2] text-[#25282B] px-1.5 py-0.2 rounded-[4px]">농후 육수</span>
                        <span className="text-[9.5px] font-bold bg-[#F2F2F2] text-[#25282B] px-1.5 py-0.2 rounded-[4px]">카타멘(단단)</span>
                        <span className="text-[9.5px] font-bold bg-red-50 text-[#E60000] px-1.5 py-0.2 rounded-[4px]">국물 완식 🍜</span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* 3. AI 큐레이터 탭: 실제 AI 추천 카드 실물 렌더링 + 기능 설명 */}
            {onboardingTab === 'ai' && (
              <>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] font-black text-[#E60000] tracking-wider uppercase">FEATURE 03</span>
                    <span className="text-[10px] font-bold text-[#E60000] bg-[#E60000]/10 px-2 py-0.5 rounded-[32px]">3초 핀포인트</span>
                  </div>
                  <h3 className="text-[15px] font-black text-[#25282B]">
                    취향 기반 3초 핀포인트 큐레이터
                  </h3>
                  <p className="text-[12px] text-[#7E7E7E] leading-relaxed pt-0.5">
                    원하는 국물과 분위기를 선택하면 인공지능이 120여 개 매장 DB를 실시간 대조해 실패 없는 오늘의 1순위 라멘집을 즉시 찾아드립니다.
                  </p>
                </div>

                {/* 실제 AI 추천 카드 프리뷰 */}
                <div className="bg-white rounded-[6px] border border-[#E2E2E2] p-3 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#E60000]" />
                      <span className="text-[11px] font-black text-[#E60000]">AI 분석 오늘의 1순위</span>
                    </div>
                    <span className="text-[10px] font-bold text-[#7E7E7E]">초정밀 매칭</span>
                  </div>

                  <div className="flex items-center gap-2.5 p-2 bg-[#F9F9F9] rounded-[4px] border border-[#E2E2E2]">
                    <div className="w-11 h-11 rounded-[4px] overflow-hidden bg-stone-200 flex-shrink-0">
                      <img
                        src="https://images.unsplash.com/photo-1760971578858-b6bbe21078f5?w=150&h=150&fit=crop&auto=format&q=80"
                        alt="담택"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[12.5px] font-black text-[#25282B]">담택 · 유자 시오 라멘</h4>
                      <p className="text-[10.5px] text-[#7E7E7E] leading-snug truncate">
                        선택하신 맑은 국물과 감칠맛 조건에 완벽히 부합
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>


        <div className="pt-4 pb-2">
          <button
            type="button"
            onClick={() => onRegisterSuccess(registeredUser)}
            className="w-full h-13 rounded-[60px] bg-[#E60000] hover:bg-[#CC0000] active:scale-98 text-white font-black text-[14px] transition-all shadow-md flex items-center justify-center gap-2"
          >
            <span>라오타 시작하기</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    )
  }




  return (
    <div className="h-full flex flex-col bg-[#FFFFFF] text-[#25282B] overflow-y-auto no-scrollbar relative selection:bg-[#E60000] selection:text-white">
      {/* 1. 상단 네비게이션 헤더 */}
      <header className="bg-white px-5 pt-3.5 pb-3 border-b border-[#E2E2E2] flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-[#F2F2F2] hover:bg-[#EAEAEA] active:scale-95 flex items-center justify-center text-[#25282B] transition-all"
          aria-label="뒤로가기"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <h1 className="text-[14px] font-black tracking-tight text-[#25282B]">
          회원가입
        </h1>

        <button
          type="button"
          onClick={onLoginClick}
          className="text-[12px] font-bold text-[#E60000] hover:opacity-80 px-1 py-1 transition-opacity"
        >
          로그인
        </button>
      </header>

      {/* 2. 본문 컨테이너 (raota-front 공식 모바일 스펙) */}
      <div className="flex-1 px-4 py-6 max-w-[400px] mx-auto w-full anim-fade-in">
        <div className="overflow-hidden rounded-sm border border-stone-200 bg-white p-6 sm:p-8 shadow-xs">
          <div className="mb-7">
            <p className="text-[10px] font-black text-[#E60000] uppercase tracking-[0.2em] mb-1">
              STEP 01
            </p>
            <h2 className="mb-1.5 text-2xl font-black tracking-tight text-[#25282b]">
              반가워요! <br />
              <span className="text-[#e60000]">기본 정보</span>를 알려주세요
            </h2>
            <p className="text-[12px] font-medium text-[#7e7e7e]">
              라오타에서 사용하실 닉네임과 취향을 설정합니다.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* A. Profile Image Upload */}
            <div className="flex flex-col items-center">
              <div
                className="relative group cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-stone-200 bg-stone-100 transition-colors group-hover:border-[#e60000]">
                  {uploadedAvatarUrl ? (
                    <img src={uploadedAvatarUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl">
                      {AVATAR_PRESETS.find(a => a.id === selectedAvatarPreset)?.emoji || '🍜'}
                    </span>
                  )}
                </div>
                <div className="absolute bottom-0 right-0 rounded-full border-2 border-white bg-[#25282b] p-1.5 text-white shadow-xs">
                  <Camera className="w-3.5 h-3.5" />
                </div>

                {uploadedAvatarUrl && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation()
                      setUploadedAvatarUrl(null)
                    }}
                    className="absolute -right-1 -top-1 rounded-full border border-stone-200 bg-white p-1 text-stone-400 transition-colors hover:text-[#e60000]"
                  >
                    ✕
                  </button>
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageChange}
              />
              <span className="text-[11px] text-stone-400 mt-2 font-bold uppercase tracking-widest">
                프로필 이미지 등록
              </span>

              {/* 빠른 캐릭터 프리셋 바 */}
              <div className="flex items-center gap-1.5 mt-2.5">
                {AVATAR_PRESETS.map(preset => {
                  const isSelected = !uploadedAvatarUrl && selectedAvatarPreset === preset.id
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setUploadedAvatarUrl(null)
                        setSelectedAvatarPreset(preset.id)
                      }}
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[13px] transition-all ${
                        isSelected
                          ? 'bg-red-50 border border-[#e60000] scale-110 shadow-xs'
                          : 'bg-stone-100 border border-stone-200 hover:bg-stone-200'
                      }`}
                      title={preset.label}
                    >
                      {preset.emoji}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* B. 닉네임 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-black text-stone-500 uppercase tracking-wider">
                  닉네임 <span className="text-[#e60000]">*</span>
                </label>
                <span className="text-[10.5px] font-mono text-stone-400">
                  {nickname.length}/12
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="예: 라멘러버, 멘마수집가"
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  maxLength={12}
                  className={`w-full rounded-sm border bg-white px-4 py-3 text-[13px] font-bold text-[#25282b] transition-colors focus:outline-none placeholder:text-stone-300 ${
                    nickname.length > 0 && isNicknameValid
                      ? 'border-emerald-500 focus:border-emerald-500'
                      : 'border-stone-200 focus:border-[#e60000]'
                  }`}
                />
                {nickname.length > 0 && (
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold">
                    {isNicknameValid ? (
                      <span className="text-emerald-600">✓ 사용 가능</span>
                    ) : (
                      <span className="text-[#e60000]">2~12자</span>
                    )}
                  </div>
                )}
              </div>
              <p className="mt-1.5 text-[11px] font-medium text-stone-400">
                한글, 영문, 숫자 조합 2~12자 이내
              </p>
            </div>

            {/* C. 선호 스타일 */}
            <div>
              <label className="block text-xs font-black text-stone-500 uppercase tracking-wider mb-2">
                선호 라멘 스타일 (선택)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {RAMEN_STYLE_OPTIONS.map(style => {
                  const isSelected = favoriteStyle === style.key
                  return (
                    <button
                      key={style.key}
                      type="button"
                      onClick={() => setFavoriteStyle(style.key)}
                      className={`px-3 py-1.5 rounded-sm text-[11px] font-bold transition-all active:scale-95 ${
                        isSelected
                          ? 'bg-[#e60000] text-white shadow-xs'
                          : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200'
                      }`}
                    >
                      {style.name}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* D. 한줄 소개 및 빠른 태그 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-black text-stone-500 uppercase tracking-wider">
                  한줄 소개 (선택)
                </label>
                <span className="text-[10.5px] font-mono text-stone-400">
                  {bio.length}/60
                </span>
              </div>
              <textarea
                placeholder="라멘에 진심인 편입니다. 깊은 국물 맛을 찾아다녀요."
                value={bio}
                onChange={e => setBio(e.target.value)}
                maxLength={60}
                className="min-h-[72px] w-full resize-none rounded-sm border border-stone-200 bg-white px-3.5 py-2.5 text-xs transition-colors focus:border-[#e60000] focus:outline-none placeholder:text-stone-300 font-medium text-[#25282B]"
              />
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-1">
                {QUICK_BIO_TAGS.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setBio(tag)}
                    className="px-2 py-0.5 rounded-xs bg-stone-100 hover:bg-stone-200 text-[10px] text-stone-600 font-medium shrink-0 transition-colors"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* E. 이용약관 동의 (raota-front 공식 커스텀 체크박스) */}
            <div className="pt-3 border-t border-stone-100 space-y-2.5">
              {/* 전체 동의 */}
              <label className="flex items-center gap-2.5 cursor-pointer pb-2 border-b border-stone-100 font-black text-[12px] text-[#25282b]">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={isAllAgreed}
                    onChange={handleToggleAllAgreed}
                  />
                  <div className="flex h-4.5 w-4.5 items-center justify-center rounded-xs border border-stone-300 transition-colors peer-checked:border-[#e60000] peer-checked:bg-[#e60000]">
                    <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                  </div>
                </div>
                <span>약관 전체 동의</span>
              </label>

              <div className="space-y-2 pt-0.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={agreeTerms}
                        onChange={e => setAgreeTerms(e.target.checked)}
                      />
                      <div className="flex h-4 w-4 items-center justify-center rounded-xs border border-stone-300 transition-colors peer-checked:border-[#e60000] peer-checked:bg-[#e60000]">
                        <Check className="w-3 h-3 text-white stroke-[3]" />
                      </div>
                    </div>
                    <span className="text-[11.5px] text-stone-600">
                      <strong className="text-[#e60000]">[필수]</strong> 서비스 이용약관 동의
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setTermsModalType('terms')}
                    className="text-[10.5px] text-stone-400 hover:text-stone-700 underline"
                  >
                    보기
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={agreePrivacy}
                        onChange={e => setAgreePrivacy(e.target.checked)}
                      />
                      <div className="flex h-4 w-4 items-center justify-center rounded-xs border border-stone-300 transition-colors peer-checked:border-[#e60000] peer-checked:bg-[#e60000]">
                        <Check className="w-3 h-3 text-white stroke-[3]" />
                      </div>
                    </div>
                    <span className="text-[11.5px] text-stone-600">
                      <strong className="text-[#e60000]">[필수]</strong> 개인정보 수집 및 이용 동의
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setTermsModalType('privacy')}
                    className="text-[10.5px] text-stone-400 hover:text-stone-700 underline"
                  >
                    보기
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={agreeMarketing}
                        onChange={e => setAgreeMarketing(e.target.checked)}
                      />
                      <div className="flex h-4 w-4 items-center justify-center rounded-xs border border-stone-300 transition-colors peer-checked:border-[#e60000] peer-checked:bg-[#e60000]">
                        <Check className="w-3 h-3 text-white stroke-[3]" />
                      </div>
                    </div>
                    <span className="text-[11.5px] text-stone-600">
                      <span className="text-stone-400 font-bold">[선택]</span> 라멘 추천 및 정보 수신 동의
                    </span>
                  </label>
                  <span className="text-[10.5px] text-stone-300">선택</span>
                </div>
              </div>
            </div>

            {/* F. 가입 완료 버튼 */}
            <button
              type="submit"
              disabled={!isFormValid || isLoading}
              className="flex w-full items-center justify-center space-x-2 rounded-sm bg-[#e60000] hover:bg-[#CC0000] py-4 text-sm font-black uppercase tracking-widest text-white transition-opacity active:scale-98 disabled:cursor-not-allowed disabled:opacity-50 shadow-xs"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>회원가입 처리 중...</span>
                </span>
              ) : (
                <>
                  <span>회원가입 완료</span>
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* 하단 로그인 이동 */}
        <div className="mt-4 text-center text-xs">
          <span className="text-stone-500">이미 계정이 있으신가요? </span>
          <button
            type="button"
            onClick={onLoginClick}
            className="font-black text-[#25282b] hover:text-[#e60000] underline underline-offset-2 transition-colors ml-1"
          >
            로그인하기
          </button>
        </div>
      </div>

      {/* 약관 상세 모달 */}
      {termsModalType && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end" role="presentation">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs anim-fade-in"
            onClick={() => setTermsModalType(null)}
          />
          <section className="relative w-full mx-auto bg-white rounded-t-[20px] shadow-2xl border-t border-stone-200 anim-slide-up z-10 flex flex-col max-h-[75%] text-[#25282B]">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-stone-300" />
            </div>
            <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3.5">
              <h3 className="text-[16px] font-black text-[#25282B]">
                {termsModalType === 'terms' ? '서비스 이용약관' : '개인정보 수집 및 이용 동의'}
              </h3>
              <button
                type="button"
                onClick={() => setTermsModalType(null)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:text-[#E60000]"
              >
                ✕
              </button>
            </div>
            <div className="p-5 overflow-y-auto text-[12px] text-stone-600 space-y-3 leading-relaxed">
              {termsModalType === 'terms' ? (
                <>
                  <p><strong>제1조 (목적)</strong><br />본 약관은 RAOTA(라오타) 서비스의 이용과 관련하여 회사와 회원 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.</p>
                  <p><strong>제2조 (회원의 의무)</strong><br />회원은 라멘 방문 기록 및 리뷰 작성 시 타인의 권리를 침해하거나 허위 사실을 유포하지 않아야 합니다.</p>
                  <p><strong>제3조 (서비스 제공 및 변경)</strong><br />라오타는 회원의 라멘로그 분석, 취향 리포트 생성 및 라멘집 추천 서비스를 상시 제공합니다.</p>

                </>
              ) : (
                <>
                  <p><strong>1. 수집하는 개인정보 항목</strong><br />닉네임, 프로필 이미지, 선호 라멘 스타일, 라멘로그 데이터</p>
                  <p><strong>2. 수집 및 이용 목적</strong><br />회원 식별, 라멘로그 캘린더 동기화, 맞춤형 라멘 큐레이션 및 등급 산정</p>
                  <p><strong>3. 보유 및 이용 기간</strong><br />회원 탈퇴 시까지 보관하며, 탈퇴일로부터 30일 후 모든 정보는 영구 파기됩니다.</p>
                </>
              )}
            </div>
            <div className="p-4 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setTermsModalType(null)}
                className="w-full h-11 rounded-[6px] bg-[#25282B] text-white font-bold text-[13px]"
              >
                확인
              </button>
            </div>
          </section>
        </div>
      )}

      {/* 토스트 알림 */}
      {toastMessage && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none anim-fade-in-up">
          <div className="bg-[#25282B]/95 backdrop-blur-md text-white text-[12px] font-bold px-4 py-2.5 rounded-[32px] shadow-[0_8px_24px_rgba(0,0,0,0.25)] flex items-center gap-2 whitespace-nowrap border border-white/15">
            <Soup className="w-4 h-4 text-[#E60000] shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

    </div>



  )
}
