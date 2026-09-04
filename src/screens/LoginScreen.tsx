import { useState } from 'react'
import { ChevronLeft, Eye, EyeOff } from 'lucide-react'
import RamenIcon from '../components/icons/RamenIcon'
import type { UserProfile } from '../types'



interface Props {
  onBack: () => void
  onRegisterClick: () => void
  onLoginSuccess: (user: UserProfile) => void
}

type LoginTab = 'social' | 'email'

export default function LoginScreen({ onBack, onRegisterClick, onLoginSuccess }: Props) {
  const [tab, setTab] = useState<LoginTab>('social')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 2500)
  }

  const handleDemoLogin = () => {
    setIsLoading(true)
    setLoadingProvider('demo')
    setTimeout(() => {
      const demoUser: UserProfile = {
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
      setIsLoading(false)
      setLoadingProvider(null)
      onLoginSuccess(demoUser)
    }, 600)
  }

  const handleSocialLogin = (provider: 'kakao' | 'google' | 'passkey') => {
    setIsLoading(true)
    setLoadingProvider(provider)

    setTimeout(() => {
      let nickname = '라멘러버'
      let ramenType = '쇼유'
      if (provider === 'kakao') nickname = '카카오면마'
      else if (provider === 'google') nickname = '구글쇼유마스터'
      else if (provider === 'passkey') nickname = '생체보안라멘'

      const user: UserProfile = {
        id: `user-${provider}-${Date.now()}`,
        name: nickname,
        nickname: nickname,
        email: `${provider}_user@raota.net`,
        avatar: null,
        level: '라멘을 즐기는 자',
        levelNumber: 2,
        membershipNo: `#RT-${Math.floor(1000 + Math.random() * 9000)}`,
        bio: `${provider.toUpperCase()} 인증으로 가입한 라멘 탐험가입니다.`,
        favoriteRamenType: ramenType,
        visitedCount: 5,
        revisitCount: 3,
        isLoggedIn: true,
      }
      setIsLoading(false)
      setLoadingProvider(null)
      onLoginSuccess(user)
    }, 800)
  }

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      showToast('이메일과 비밀번호를 모두 입력해주세요.')
      return
    }

    setIsLoading(true)
    setLoadingProvider('email')

    setTimeout(() => {
      const user: UserProfile = {
        id: `user-email-${Date.now()}`,
        name: email.split('@')[0] || '라멘탐험가',
        nickname: email.split('@')[0] || '라멘탐험가',
        email: email,
        avatar: null,
        level: '라멘을 즐기는 자',
        levelNumber: 2,
        membershipNo: `#RT-${Math.floor(1000 + Math.random() * 9000)}`,
        bio: '라오타에서 나만의 한 그릇을 찾는 중입니다.',
        favoriteRamenType: '쇼유',
        visitedCount: 3,
        revisitCount: 1,
        isLoggedIn: true,
      }
      setIsLoading(false)
      setLoadingProvider(null)
      onLoginSuccess(user)
    }, 800)
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
          로그인
        </h1>

        <button
          type="button"
          onClick={onRegisterClick}
          className="text-[12px] font-black text-[#E60000] hover:opacity-80 px-1 py-1 transition-opacity"
        >
          회원가입
        </button>
      </header>

      {/* 2. 본문 컨테이너 (네이티브 모바일 풀 와이드 레이아웃) */}
      <div className="flex-1 px-6 py-6 flex flex-col justify-between max-w-[390px] mx-auto w-full anim-fade-in">
        <div className="w-full text-center">
          
          {/* 브랜드 아이덴티티 영역 */}
          <div className="mb-7 pt-2">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-100/80 border border-stone-200/60 shadow-xs">
              <img
                src="/logo.png"
                alt="RAOTA Logo"
                className="h-11 w-11 object-contain"
              />
            </div>
            <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#e60000]">
              RAOTA LOGIN
            </p>
            <h2 className="mx-auto mb-2 max-w-[18rem] break-keep text-2xl font-black leading-tight text-[#25282b]">
              <span className="block">좋았던 한 그릇을</span>
              <span className="block text-[#e60000]">잊지 않도록</span>
            </h2>
            <p className="mx-auto max-w-xs break-keep text-[12px] leading-relaxed text-[#7e7e7e]">
              가고 싶은 곳, 다녀온 곳, 다시 먹고 싶은 한 그릇을 라오타에 모아두세요.
            </p>
          </div>

          {/* 소셜 및 간편 로그인 옵션 */}
          <div className="space-y-2.5">
            {/* Kakao Login Button */}
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleSocialLogin('kakao')}
              className="relative flex w-full items-center justify-center rounded-[10px] border border-stone-200 bg-white px-4 py-3.5 font-bold text-[#25282b] text-[13px] transition-all hover:border-[#e60000] active:scale-98 disabled:opacity-60 shadow-2xs"
            >
              <span className="absolute left-4 flex items-center text-[#3c1e1e]">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3C6.477 3 2 6.477 2 10.767c0 2.766 1.87 5.187 4.675 6.485-.205.768-.744 2.783-.852 3.203-.133.522.191.516.402.377.275-.182 4.37-2.96 5.09-3.46.88.13 1.777.195 2.685.195 5.523 0 10-3.477 10-7.767C22 6.477 17.523 3 12 3z"/>
                </svg>
              </span>
              {loadingProvider === 'kakao' ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-[#25282b] border-t-transparent rounded-full animate-spin" />
                  카카오 로그인 중...
                </span>
              ) : (
                <span>카카오로 시작하기</span>
              )}
            </button>

            {/* Google Login Button */}
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleSocialLogin('google')}
              className="relative flex w-full items-center justify-center rounded-[10px] border border-stone-200 bg-white px-4 py-3.5 font-bold text-[#25282b] text-[13px] transition-all hover:border-[#e60000] active:scale-98 disabled:opacity-60 shadow-2xs"
            >
              <svg className="w-4.5 h-4.5 absolute left-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {loadingProvider === 'google' ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-[#25282B] border-t-transparent rounded-full animate-spin" />
                  Google 로그인 중...
                </span>
              ) : (
                <span>Google로 시작하기</span>
              )}
            </button>

            {/* Divider */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-stone-200"></div>
              </div>
              <div className="relative flex justify-center text-[11px]">
                <span className="bg-white px-3 text-stone-400 font-bold">또는</span>
              </div>
            </div>

            {/* Passkey Login Button (raota-front 공식 스펙) */}
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleSocialLogin('passkey')}
              className="group relative flex w-full items-center justify-center rounded-[10px] bg-[#e60000] hover:bg-[#CC0000] px-4 py-3.5 font-bold text-white text-[13px] transition-all active:scale-98 shadow-xs disabled:opacity-60"
            >
              <svg className="w-5 h-5 absolute left-4 text-white stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/>
                <path d="M14 13.12c0 2.38 0 6.38-1 8.88"/>
                <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/>
                <path d="M2 12a10 10 0 0 1 18-6"/>
                <path d="M2 16h.01"/>
                <path d="M21.8 16c.2-2 .131-5.354 0-6"/>
                <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/>
                <path d="M8.65 22c.21-.66.45-1.32.57-2"/>
                <path d="M9 6.8a6 6 0 0 1 9 5.2v2"/>
              </svg>
              {loadingProvider === 'passkey' ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  패스키 인증 중...
                </span>
              ) : (
                <span>패스키로 시작하기</span>
              )}
            </button>

            {/* 탭 토글 바 (이메일 로그인 / 1초 체험) */}
            <div className="pt-2.5 border-t border-stone-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setTab(tab === 'email' ? 'social' : 'email')}
                className="flex-1 py-2.5 rounded-[8px] border border-stone-200 bg-stone-50 hover:bg-stone-100 text-[11.5px] font-bold text-stone-700 transition-colors"
              >
                {tab === 'email' ? '간편 로그인 접기' : '이메일로 로그인'}
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleDemoLogin}
                className="flex-1 py-2.5 rounded-[8px] bg-[#25282B] hover:bg-black active:scale-98 text-white text-[11.5px] font-bold transition-all shadow-xs disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {loadingProvider === 'demo' ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>접속 중...</span>
                  </>
                ) : (
                  <span>게스트로 둘러보기</span>
                )}
              </button>
            </div>

            {/* 이메일 로그인 인라인 폼 */}
            {tab === 'email' && (
              <form onSubmit={handleEmailSubmit} className="pt-3 space-y-3 text-left anim-fade-in border-t border-stone-100">
                <div>
                  <label className="block text-[11px] font-black text-stone-500 mb-1">
                    이메일 주소
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="ramen@example.com"
                    className="w-full rounded-[8px] border border-stone-200 bg-white px-3.5 py-2.5 text-[12px] font-bold text-[#25282B] transition-colors focus:border-[#e60000] focus:outline-none placeholder:text-stone-300"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-black text-stone-500">
                      비밀번호
                    </label>
                    <button
                      type="button"
                      onClick={() => showToast('가입하신 이메일로 비밀번호 재설정 링크를 보내드립니다.')}
                      className="text-[10px] font-bold text-stone-400 hover:text-[#e60000] transition-colors"
                    >
                      비밀번호 찾기
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="8자 이상 영문, 숫자 조합"
                      className="w-full rounded-[8px] border border-stone-200 bg-white pl-3.5 pr-10 py-2.5 text-[12px] font-bold text-[#25282B] transition-colors focus:border-[#e60000] focus:outline-none placeholder:text-stone-300"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={e => setRememberMe(e.target.checked)}
                      className="w-3.5 h-3.5 rounded-xs accent-[#e60000] cursor-pointer"
                    />
                    <span className="text-[11px] font-medium text-stone-600">
                      로그인 상태 유지
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-1 rounded-[8px] bg-[#25282B] hover:bg-black py-3 font-bold text-white text-[12px] transition-colors shadow-xs disabled:opacity-60"
                >
                  로그인 완료
                </button>
              </form>
            )}
          </div>
        </div>

        {/* 하단 회원가입 안내 */}
        <div className="pt-4 text-center">
          <p className="text-[12px] text-stone-500">
            아직 계정이 없으신가요?{' '}
            <button
              type="button"
              onClick={onRegisterClick}
              className="font-black text-[#e60000] hover:underline underline-offset-2 ml-1"
            >
              회원가입
            </button>
          </p>
        </div>
      </div>

      {/* 토스트 알림 */}
      {toastMessage && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none anim-fade-in-up">
          <div className="bg-[#25282B]/95 backdrop-blur-md text-white text-[12px] font-bold px-4 py-2.5 rounded-[32px] shadow-[0_8px_24px_rgba(0,0,0,0.25)] flex items-center gap-2 whitespace-nowrap border border-white/15">
            <RamenIcon className="w-4 h-4 text-[#E60000] shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

    </div>


  )
}

