import { useEffect, useState } from 'react'
import { ChevronLeft, Eye, EyeOff, KeyRound, Mail, Compass } from 'lucide-react'
import RamenIcon from '../components/icons/RamenIcon'
import { DEMO_USER } from '../data/demoProfile'
import type { UserProfile } from '../types'

interface Props {
  onBack: () => void
  /** 로그인하지 않고 비회원으로 둘러보기 */
  onGuestBrowse?: () => void
  onRegisterClick: () => void
  onLoginSuccess: (user: UserProfile) => void
}

type Provider = 'kakao' | 'google' | 'passkey' | 'email' | 'demo'

const PROVIDER_LABEL: Record<Exclude<Provider, 'email' | 'demo'>, string> = {
  kakao: '카카오',
  google: 'Google',
  passkey: '패스키',
}

/** 프로토타입 로그인. 실제 기록이 없으므로 새 사용자와 같은 0그릇에서 시작한다. */
const buildPrototypeUser = (provider: Exclude<Provider, 'demo'>, nickname: string, email: string): UserProfile => ({
  id: `user-${provider}-${Date.now()}`,
  name: nickname,
  nickname,
  email,
  avatar: null,
  level: '라멘 입문자',
  levelNumber: 1,
  membershipNo: `#RT-${Math.floor(1000 + Math.random() * 9000)}`,
  bio: '라오타에서 나만의 한 그릇을 찾는 중입니다.',
  favoriteRamenType: undefined,
  visitedCount: 0,
  revisitCount: 0,
  isLoggedIn: true,
})

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function LoginScreen({ onBack, onGuestBrowse, onRegisterClick, onLoginSuccess }: Props) {
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const isLoading = loadingProvider !== null

  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => setToastMessage(null), 2500)
    return () => clearTimeout(timer)
  }, [toastMessage])

  const finish = (provider: Provider, user: UserProfile, delay: number) => {
    setLoadingProvider(provider)
    setTimeout(() => {
      setLoadingProvider(null)
      onLoginSuccess(user)
    }, delay)
  }

  const handleDemoLogin = () => finish('demo', DEMO_USER, 600)

  const handleSocialLogin = (provider: 'kakao' | 'google' | 'passkey') =>
    finish(provider, buildPrototypeUser(provider, `${PROVIDER_LABEL[provider]} 라멘러`, `${provider}_user@raota.net`), 800)

  const validate = () => {
    const next: { email?: string; password?: string } = {}
    const trimmed = email.trim()
    if (!trimmed) next.email = '이메일 주소를 입력해 주세요. 예: ramen@example.com'
    else if (!EMAIL_PATTERN.test(trimmed)) next.email = '이메일 형식이 아닙니다. @와 도메인을 포함해 다시 입력해 주세요.'
    if (!password) next.password = '비밀번호를 입력해 주세요.'
    else if (password.length < 8) next.password = `비밀번호는 8자 이상입니다. 지금 ${password.length}자예요.`
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    const trimmed = email.trim()
    finish('email', buildPrototypeUser('email', trimmed.split('@')[0] || '라멘러', trimmed), 800)
  }

  const Spinner = ({ dark = false }: { dark?: boolean }) => (
    <span aria-hidden="true" className={`h-4 w-4 animate-spin rounded-full border-2 border-t-transparent ${dark ? 'border-[#25282B]' : 'border-white'}`} />
  )

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
        <h1 className="text-[17px] font-black tracking-tight text-[#25282B]">로그인</h1>
        <button
          type="button"
          onClick={onRegisterClick}
          className="flex min-h-11 items-center rounded-[6px] px-2.5 text-[14px] font-black text-[#E60000]"
        >
          회원가입
        </button>
      </header>

      <div className="no-scrollbar flex-1 overflow-y-auto">
        <div className="anim-fade-in mx-auto flex min-h-full w-full max-w-[390px] flex-col px-5 pb-6 pt-6">
          {/* 브랜드 */}
          <div className="mb-7 text-center">
            <img src="/logo.png" alt="RAOTA" className="mx-auto mb-3 h-14 w-14 object-contain" />
            <h2 className="mx-auto mb-2 max-w-[18rem] break-keep text-[24px] font-black leading-tight text-[#25282B]">
              <span className="block">좋았던 한 그릇을</span>
              <span className="block text-[#E60000]">잊지 않도록</span>
            </h2>
            <p className="mx-auto max-w-xs break-keep text-[14px] leading-relaxed text-[#6B6E73]">
              가고 싶은 곳, 다녀온 곳, 다시 먹고 싶은 한 그릇을 라오타에 모아두세요.
            </p>
          </div>

          {/* 간편 로그인 */}
          <div className="space-y-2.5">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleSocialLogin('kakao')}
              className="relative flex h-12 w-full items-center justify-center rounded-[60px] bg-[#FEE500] text-[15px] font-bold text-[#191919] transition-opacity active:opacity-90 disabled:opacity-60"
            >
              <span aria-hidden="true" className="absolute left-5 flex items-center text-[#191919]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3C6.477 3 2 6.477 2 10.767c0 2.766 1.87 5.187 4.675 6.485-.205.768-.744 2.783-.852 3.203-.133.522.191.516.402.377.275-.182 4.37-2.96 5.09-3.46.88.13 1.777.195 2.685.195 5.523 0 10-3.477 10-7.767C22 6.477 17.523 3 12 3z" />
                </svg>
              </span>
              {loadingProvider === 'kakao' ? (
                <span className="flex items-center gap-2">
                  <Spinner dark />
                  카카오 로그인 중
                </span>
              ) : (
                <span>카카오로 시작하기</span>
              )}
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleSocialLogin('google')}
              className="relative flex h-12 w-full items-center justify-center rounded-[60px] border border-[#E2E2E2] bg-white text-[15px] font-bold text-[#25282B] transition-colors hover:border-[#BEBEBE] active:opacity-90 disabled:opacity-60"
            >
              <svg aria-hidden="true" className="absolute left-5 h-5 w-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {loadingProvider === 'google' ? (
                <span className="flex items-center gap-2">
                  <Spinner dark />
                  Google 로그인 중
                </span>
              ) : (
                <span>Google로 시작하기</span>
              )}
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleSocialLogin('passkey')}
              className="relative flex h-12 w-full items-center justify-center rounded-[60px] bg-[#E60000] text-[15px] font-bold text-white transition-opacity active:opacity-90 disabled:opacity-60"
            >
              <KeyRound aria-hidden="true" className="absolute left-5 h-5 w-5" />
              {loadingProvider === 'passkey' ? (
                <span className="flex items-center gap-2">
                  <Spinner />
                  패스키 인증 중
                </span>
              ) : (
                <span>패스키로 시작하기</span>
              )}
            </button>

            <div className="relative py-2" aria-hidden="true">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#E2E2E2]" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-[13px] font-bold text-[#6B6E73]">또는</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowEmailForm(prev => !prev)}
                aria-expanded={showEmailForm}
                aria-controls="email-login-form"
                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[6px] border border-[#E2E2E2] bg-white text-[14px] font-bold text-[#25282B] transition-colors hover:border-[#BEBEBE]"
              >
                <Mail className="h-4 w-4 text-[#6B6E73]" aria-hidden="true" />
                {showEmailForm ? '이메일 로그인 접기' : '이메일로 로그인'}
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleDemoLogin}
                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[6px] bg-[#25282B] text-[14px] font-bold text-white transition-opacity active:opacity-90 disabled:opacity-60"
              >
                {loadingProvider === 'demo' ? (
                  <>
                    <Spinner />
                    <span>접속 중</span>
                  </>
                ) : (
                  <>
                    <RamenIcon className="h-4 w-4" aria-hidden="true" />
                    <span>데모 계정으로 체험</span>
                  </>
                )}
              </button>
            </div>

            {showEmailForm && (
              <form id="email-login-form" onSubmit={handleEmailSubmit} noValidate className="anim-fade-in space-y-3 border-t border-[#F2F2F2] pt-3 text-left">
                <div>
                  <label htmlFor="login-email" className="mb-1 block text-[13px] font-bold text-[#4A4D52]">
                    이메일 주소
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={e => {
                      setEmail(e.target.value)
                      if (errors.email) setErrors(prev => ({ ...prev, email: undefined }))
                    }}
                    placeholder="ramen@example.com"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? 'login-email-error' : undefined}
                    className={`h-12 w-full rounded-[6px] border bg-white px-3.5 text-[15px] text-[#25282B] outline-none transition-colors placeholder:text-[#6B6E73] ${
                      errors.email ? 'border-[#E60000]' : 'border-[#E2E2E2] focus:border-[#E60000]'
                    }`}
                  />
                  {errors.email && (
                    <p id="login-email-error" role="alert" className="mt-1 text-[13px] font-medium text-[#E60000]">
                      {errors.email}
                    </p>
                  )}
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label htmlFor="login-password" className="text-[13px] font-bold text-[#4A4D52]">
                      비밀번호
                    </label>
                    <button
                      type="button"
                      onClick={() => setToastMessage('가입한 이메일로 재설정 링크를 보내드립니다.')}
                      className="-my-2 min-h-11 px-1 text-[13px] font-bold text-[#6B6E73] transition-colors hover:text-[#E60000]"
                    >
                      비밀번호 찾기
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={e => {
                        setPassword(e.target.value)
                        if (errors.password) setErrors(prev => ({ ...prev, password: undefined }))
                      }}
                      placeholder="8자 이상"
                      aria-invalid={Boolean(errors.password)}
                      aria-describedby={errors.password ? 'login-password-error' : undefined}
                      className={`h-12 w-full rounded-[6px] border bg-white pl-3.5 pr-12 text-[15px] text-[#25282B] outline-none transition-colors placeholder:text-[#6B6E73] ${
                        errors.password ? 'border-[#E60000]' : 'border-[#E2E2E2] focus:border-[#E60000]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(prev => !prev)}
                      aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                      aria-pressed={showPassword}
                      className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-[#6B6E73] hover:text-[#25282B]"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p id="login-password-error" role="alert" className="mt-1 text-[13px] font-medium text-[#E60000]">
                      {errors.password}
                    </p>
                  )}
                </div>

                <label className="flex min-h-11 cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="h-5 w-5 cursor-pointer accent-[#E60000]" />
                  <span className="text-[14px] font-medium text-[#4A4D52]">로그인 상태 유지</span>
                </label>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-[60px] bg-[#25282B] text-[15px] font-bold text-white transition-opacity active:opacity-90 disabled:opacity-60"
                >
                  {loadingProvider === 'email' ? (
                    <>
                      <Spinner />
                      로그인 중
                    </>
                  ) : (
                    '로그인'
                  )}
                </button>
              </form>
            )}
          </div>

          {/* 하단 */}
          <div className="mt-auto space-y-1 pt-8 text-center">
            {onGuestBrowse && (
              <button
                type="button"
                onClick={onGuestBrowse}
                className="mx-auto flex min-h-11 items-center justify-center gap-1.5 px-3 text-[14px] font-bold text-[#4A4D52] transition-colors hover:text-[#25282B]"
              >
                <Compass className="h-4 w-4" aria-hidden="true" />
                로그인 없이 둘러보기
              </button>
            )}
            <p className="flex min-h-11 items-center justify-center gap-1 text-[14px] text-[#6B6E73]">
              아직 계정이 없으신가요?
              <button type="button" onClick={onRegisterClick} className="min-h-11 px-1 font-black text-[#E60000] underline-offset-2 hover:underline">
                회원가입
              </button>
            </p>
          </div>
        </div>
      </div>

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
