import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Check, X, Camera, MapPin, Sparkles } from 'lucide-react'
import RamenIcon from '../components/icons/RamenIcon'
import PolicySheet from '../components/PolicySheet'
import type { UserProfile } from '../types'

interface Props {
  onBack: () => void
  onLoginClick: () => void
  onRegisterSuccess: (user: UserProfile) => void
}

/** 프로필 캐릭터. 이모지는 사용자가 고르는 아바타 콘텐츠다. */
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

const QUICK_BIO_TAGS = ['진한 국물파', '자가제면 탐험가', '라멘 성지순례 중', '꼬들면 애호가']

const ONBOARDING_FEATURES = [
  { icon: MapPin, title: '내 주변 라멘집 찾기', desc: '지도에서 영업 여부와 라스트오더를 확인하고 바로 찾아가요.' },
  { icon: RamenIcon, title: '한 그릇 라멘로그', desc: '먹은 라멘을 5가지 축으로 기록하면 취향 리포트가 쌓여요.' },
  { icon: Sparkles, title: 'AI 큐레이터', desc: '원하는 국물과 분위기를 고르면 오늘의 한 곳을 골라 드려요.' },
]

const NICKNAME_MIN = 2
const NICKNAME_MAX = 12

/** 커스텀 체크박스: 입력은 sr-only, 보이는 상자는 20px, 라벨 전체가 44px 히트 영역이다 */
function CheckRow({
  id,
  checked,
  onChange,
  children,
  strong = false,
}: {
  id: string
  checked: boolean
  onChange: (next: boolean) => void
  children: React.ReactNode
  strong?: boolean
}) {
  return (
    <label htmlFor={id} className={`flex min-h-11 flex-1 cursor-pointer items-center gap-2.5 ${strong ? 'text-[15px] font-black text-[#25282B]' : 'text-[14px] text-[#4A4D52]'}`}>
      <input id={id} type="checkbox" className="peer sr-only" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span
        aria-hidden="true"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border border-[#BEBEBE] bg-white transition-colors peer-checked:border-[#E60000] peer-checked:bg-[#E60000] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#E60000] [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100"
      >
        <Check className="h-3.5 w-3.5 stroke-[3] text-white" />
      </span>
      <span>{children}</span>
    </label>
  )
}

export default function RegisterScreen({ onBack, onLoginClick, onRegisterSuccess }: Props) {
  const [nickname, setNickname] = useState('')
  const [bio, setBio] = useState('')
  const [selectedAvatarPreset, setSelectedAvatarPreset] = useState<string>('shoyu')
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string | null>(null)
  const [favoriteStyle, setFavoriteStyle] = useState<string>('쇼유')

  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [agreeMarketing, setAgreeMarketing] = useState(false)
  const [termsModalType, setTermsModalType] = useState<'terms' | 'privacy' | null>(null)

  const [isLoading, setIsLoading] = useState(false)
  const [registeredUser, setRegisteredUser] = useState<UserProfile | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const nicknameRef = useRef<HTMLInputElement>(null)
  const termsTriggerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => setToastMessage(null), 2500)
    return () => clearTimeout(timer)
  }, [toastMessage])

  const closeTerms = useCallback(() => setTermsModalType(null), [])

  const isAllAgreed = agreeTerms && agreePrivacy && agreeMarketing
  const handleToggleAllAgreed = (next: boolean) => {
    setAgreeTerms(next)
    setAgreePrivacy(next)
    setAgreeMarketing(next)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setToastMessage('이미지는 5MB 이하만 올릴 수 있어요.')
      return
    }
    const reader = new FileReader()
    reader.onload = ev => setUploadedAvatarUrl(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const trimmedNickname = nickname.trim()
  const isNicknameValid = trimmedNickname.length >= NICKNAME_MIN && trimmedNickname.length <= NICKNAME_MAX
  const nicknameError =
    trimmedNickname.length === 0
      ? '닉네임을 입력해 주세요. 2~12자로 쓸 수 있어요.'
      : trimmedNickname.length < NICKNAME_MIN
        ? `닉네임이 너무 짧아요. ${NICKNAME_MIN - trimmedNickname.length}자만 더 적어 주세요.`
        : null
  const showNicknameError = (submitAttempted || nickname.length > 0) && nicknameError
  const isFormValid = isNicknameValid && agreeTerms && agreePrivacy
  const agreementError = submitAttempted && (!agreeTerms || !agreePrivacy) ? '필수 약관 두 가지에 동의해야 가입할 수 있어요.' : null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitAttempted(true)
    if (!isNicknameValid) {
      nicknameRef.current?.focus()
      return
    }
    if (!agreeTerms || !agreePrivacy) return

    setIsLoading(true)
    setTimeout(() => {
      // 새 사용자는 기록이 없다. 데모 계정 수치를 빌려오지 않는다.
      const newUser: UserProfile = {
        id: `user-${Date.now()}`,
        name: trimmedNickname,
        nickname: trimmedNickname,
        email: undefined,
        avatar: uploadedAvatarUrl,
        level: '라멘 입문자',
        levelNumber: 1,
        membershipNo: `#RT-${Math.floor(1000 + Math.random() * 9000)}`,
        bio: bio.trim() || undefined,
        favoriteRamenType: favoriteStyle,
        visitedCount: 0,
        revisitCount: 0,
        isLoggedIn: true,
      }
      setIsLoading(false)
      setRegisteredUser(newUser)
    }, 600)
  }

  // ==========================================
  // 가입 완료
  // ==========================================
  if (registeredUser) {
    const presetEmoji = AVATAR_PRESETS.find(a => a.id === selectedAvatarPreset)?.emoji ?? '🍜'
    return (
      <div className="anim-fade-in flex h-full flex-col bg-white text-[#25282B]">
        <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-4 pt-8">
          <div className="text-center">
            <span className="mx-auto mb-3 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-[#F2F2F2] text-[36px]">
              {registeredUser.avatar ? <img src={registeredUser.avatar} alt="" className="h-full w-full object-cover" /> : <span aria-hidden="true">{presetEmoji}</span>}
            </span>
            <h2 className="text-[24px] font-black leading-snug tracking-tight text-[#25282B]">{registeredUser.nickname}님, 반가워요</h2>
            <p className="mt-1 text-[14px] text-[#6B6E73]">
              {registeredUser.level} Lv.{registeredUser.levelNumber} · 첫 그릇을 기록하면 취향 분석이 시작돼요
            </p>
          </div>

          <ul className="mt-8 divide-y divide-[#F2F2F2] border-y border-[#E2E2E2]">
            {ONBOARDING_FEATURES.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="flex items-start gap-3 py-4">
                <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFF0F0] text-[#E60000]">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-black text-[#25282B]">{title}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-[#6B6E73]">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="shrink-0 px-5 pb-5 pt-2">
          <button
            type="button"
            onClick={() => onRegisterSuccess(registeredUser)}
            className="flex h-13 w-full items-center justify-center gap-2 rounded-[60px] bg-[#E60000] text-[15px] font-black text-white transition-opacity active:opacity-90"
          >
            <span>라오타 시작하기</span>
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    )
  }

  // ==========================================
  // 가입 폼
  // ==========================================
  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-white text-[#25282B]">
      <header className="flex shrink-0 items-center justify-between border-b border-[#E2E2E2] bg-white py-1 pl-1 pr-1.5">
        <button
          type="button"
          onClick={onBack}
          className="flex h-11 w-11 items-center justify-center rounded-full text-[#25282B] transition-colors hover:bg-[#F2F2F2]"
          aria-label="뒤로가기"
        >
          <ChevronLeft className="h-6 w-6" aria-hidden="true" />
        </button>
        <h1 className="text-[17px] font-black tracking-tight text-[#25282B]">회원가입</h1>
        <button type="button" onClick={onLoginClick} className="flex min-h-11 items-center rounded-[6px] px-2.5 text-[14px] font-black text-[#E60000]">
          로그인
        </button>
      </header>

      <div className="no-scrollbar flex-1 overflow-y-auto">
        <div className="anim-fade-in mx-auto w-full max-w-[400px] px-5 pb-8 pt-6">
          <div className="mb-6">
            <h2 className="mb-1.5 text-[24px] font-black leading-tight tracking-tight text-[#25282B]">
              반가워요!
              <br />
              <span className="text-[#E60000]">기본 정보</span>를 알려주세요
            </h2>
            <p className="text-[14px] text-[#6B6E73]">라오타에서 쓸 닉네임과 취향을 정합니다.</p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            {/* 프로필 이미지 */}
            <div className="flex flex-col items-center">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="프로필 사진 올리기"
                  className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-[#E2E2E2] bg-[#F2F2F2] transition-colors hover:border-[#E60000]"
                >
                  {uploadedAvatarUrl ? (
                    <img src={uploadedAvatarUrl} alt="올린 프로필 사진" className="h-full w-full object-cover" />
                  ) : (
                    <span aria-hidden="true" className="text-[40px]">
                      {AVATAR_PRESETS.find(a => a.id === selectedAvatarPreset)?.emoji ?? '🍜'}
                    </span>
                  )}
                </button>
                <span aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 rounded-full border-2 border-white bg-[#25282B] p-1.5 text-white">
                  <Camera className="h-3.5 w-3.5" />
                </span>
                {uploadedAvatarUrl && (
                  <button
                    type="button"
                    onClick={() => setUploadedAvatarUrl(null)}
                    aria-label="올린 사진 지우기"
                    className="absolute -right-3 -top-3 flex h-11 w-11 items-center justify-center"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#E2E2E2] bg-white text-[#6B6E73]">
                      <X className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </button>
                )}
              </div>
              <input type="file" ref={fileInputRef} className="sr-only" accept="image/*" onChange={handleImageChange} tabIndex={-1} aria-hidden="true" />
              <p className="mt-2 text-[13px] font-bold text-[#6B6E73]">사진을 올리거나 캐릭터를 고르세요</p>

              <div role="group" aria-label="프로필 캐릭터" className="mt-1 flex items-center gap-0.5">
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
                      aria-label={preset.label}
                      aria-pressed={isSelected}
                      className="flex h-11 w-11 items-center justify-center"
                    >
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full border text-[17px] transition-colors ${
                          isSelected ? 'border-[#E60000] bg-[#FFF0F0]' : 'border-[#E2E2E2] bg-[#F2F2F2]'
                        }`}
                      >
                        {preset.emoji}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 닉네임 */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="register-nickname" className="text-[14px] font-black text-[#25282B]">
                  닉네임 <span className="text-[#E60000]">*</span>
                </label>
                <span className="text-[13px] text-[#6B6E73]" aria-live="polite">
                  {nickname.length}/{NICKNAME_MAX}
                </span>
              </div>
              <div className="relative">
                <input
                  id="register-nickname"
                  ref={nicknameRef}
                  type="text"
                  autoComplete="nickname"
                  placeholder="예: 라멘러버, 멘마수집가"
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  maxLength={NICKNAME_MAX}
                  aria-invalid={Boolean(showNicknameError)}
                  aria-describedby={showNicknameError ? 'register-nickname-error' : 'register-nickname-hint'}
                  className={`h-12 w-full rounded-[6px] border bg-white px-4 pr-24 text-[15px] font-bold text-[#25282B] outline-none transition-colors placeholder:font-normal placeholder:text-[#6B6E73] ${
                    showNicknameError ? 'border-[#E60000]' : isNicknameValid ? 'border-[#25282B]' : 'border-[#E2E2E2] focus:border-[#E60000]'
                  }`}
                />
                {nickname.length > 0 && isNicknameValid && (
                  <span className="absolute right-3.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5 text-[13px] font-bold text-[#25282B]">
                    <Check className="h-4 w-4 text-[#E60000]" aria-hidden="true" />
                    사용 가능
                  </span>
                )}
              </div>
              {showNicknameError ? (
                <p id="register-nickname-error" role="alert" className="mt-1.5 text-[13px] font-medium text-[#E60000]">
                  {nicknameError}
                </p>
              ) : (
                <p id="register-nickname-hint" className="mt-1.5 text-[13px] text-[#6B6E73]">
                  한글, 영문, 숫자 2~12자
                </p>
              )}
            </div>

            {/* 선호 스타일 */}
            <fieldset>
              <legend className="mb-1 text-[14px] font-black text-[#25282B]">선호 라멘 스타일 (선택)</legend>
              <div className="flex flex-wrap gap-x-1 gap-y-0">
                {RAMEN_STYLE_OPTIONS.map(style => {
                  const isSelected = favoriteStyle === style.key
                  return (
                    <button key={style.key} type="button" onClick={() => setFavoriteStyle(style.key)} aria-pressed={isSelected} className="flex min-h-11 items-center">
                      <span
                        className={`rounded-[32px] px-3.5 py-1.5 text-[13px] font-bold transition-colors ${
                          isSelected ? 'bg-[#E60000] text-white' : 'bg-[#F2F2F2] text-[#4A4D52]'
                        }`}
                      >
                        {style.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            {/* 한줄 소개 */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="register-bio" className="text-[14px] font-black text-[#25282B]">
                  한줄 소개 (선택)
                </label>
                <span className="text-[13px] text-[#6B6E73]">{bio.length}/60</span>
              </div>
              <textarea
                id="register-bio"
                placeholder="라멘에 진심인 편입니다. 깊은 국물 맛을 찾아다녀요."
                value={bio}
                onChange={e => setBio(e.target.value)}
                maxLength={60}
                className="min-h-[72px] w-full resize-none rounded-[6px] border border-[#E2E2E2] bg-white px-3.5 py-2.5 text-[14px] text-[#25282B] outline-none transition-colors placeholder:text-[#6B6E73] focus:border-[#E60000]"
              />
              <div role="group" aria-label="소개 추천 문구" className="no-scrollbar flex items-center gap-1 overflow-x-auto">
                {QUICK_BIO_TAGS.map(tag => (
                  <button key={tag} type="button" onClick={() => setBio(tag)} className="flex min-h-11 shrink-0 items-center">
                    <span className="rounded-[32px] bg-[#F2F2F2] px-3 py-1 text-[13px] font-medium text-[#4A4D52]">+ {tag}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 약관 */}
            <div className="border-t border-[#E2E2E2] pt-3">
              <div className="border-b border-[#F2F2F2]">
                <CheckRow id="agree-all" checked={isAllAgreed} onChange={handleToggleAllAgreed} strong>
                  약관 전체 동의
                </CheckRow>
              </div>

              <div className="pt-1">
                <div className="flex items-center justify-between gap-2">
                  <CheckRow id="agree-terms" checked={agreeTerms} onChange={setAgreeTerms}>
                    <strong className="text-[#E60000]">[필수]</strong> 서비스 이용약관 동의
                  </CheckRow>
                  <button
                    type="button"
                    onClick={e => {
                      termsTriggerRef.current = e.currentTarget
                      setTermsModalType('terms')
                    }}
                    aria-haspopup="dialog"
                    aria-label="서비스 이용약관 보기"
                    className="min-h-11 min-w-11 shrink-0 px-2 text-[13px] text-[#6B6E73] underline underline-offset-2 hover:text-[#25282B]"
                  >
                    보기
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <CheckRow id="agree-privacy" checked={agreePrivacy} onChange={setAgreePrivacy}>
                    <strong className="text-[#E60000]">[필수]</strong> 개인정보 수집 및 이용 동의
                  </CheckRow>
                  <button
                    type="button"
                    onClick={e => {
                      termsTriggerRef.current = e.currentTarget
                      setTermsModalType('privacy')
                    }}
                    aria-haspopup="dialog"
                    aria-label="개인정보 수집 및 이용 동의 보기"
                    className="min-h-11 min-w-11 shrink-0 px-2 text-[13px] text-[#6B6E73] underline underline-offset-2 hover:text-[#25282B]"
                  >
                    보기
                  </button>
                </div>

                <CheckRow id="agree-marketing" checked={agreeMarketing} onChange={setAgreeMarketing}>
                  <span className="font-bold text-[#6B6E73]">[선택]</span> 라멘 추천 및 소식 수신 동의
                </CheckRow>
              </div>
              {agreementError && (
                <p role="alert" className="mt-1 text-[13px] font-medium text-[#E60000]">
                  {agreementError}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={`flex h-13 w-full items-center justify-center gap-2 rounded-[60px] bg-[#E60000] text-[15px] font-black text-white transition-opacity active:opacity-90 ${
                !isFormValid || isLoading ? 'opacity-50' : ''
              }`}
            >
              {isLoading ? (
                <>
                  <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>가입 처리 중</span>
                </>
              ) : (
                <>
                  <span>회원가입 완료</span>
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          <p className="mt-2 flex min-h-11 items-center justify-center gap-1 text-center text-[14px] text-[#6B6E73]">
            이미 계정이 있으신가요?
            <button type="button" onClick={onLoginClick} className="min-h-11 px-1 font-black text-[#25282B] underline underline-offset-2 hover:text-[#E60000]">
              로그인하기
            </button>
          </p>
        </div>
      </div>

      {/* 약관 상세 시트 */}
      {termsModalType && (
        <PolicySheet
          type={termsModalType}
          title={termsModalType === 'terms' ? '서비스 이용약관' : '개인정보 수집 및 이용 동의'}
          onClose={closeTerms}
          footer={
            <button
              type="button"
              onClick={() => {
                if (termsModalType === 'terms') setAgreeTerms(true)
                else setAgreePrivacy(true)
                closeTerms()
              }}
              className="h-12 w-full rounded-[60px] bg-[#25282B] text-[15px] font-bold text-white transition-opacity active:opacity-90"
            >
              확인하고 동의
            </button>
          }
        />
      )}

      {toastMessage && (
        <div
          role="status"
          className="anim-fade-in-up pointer-events-none absolute bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-[32px] bg-[#25282B] px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
        >
          <RamenIcon className="h-4 w-4 shrink-0 text-[#E60000]" aria-hidden="true" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  )
}
