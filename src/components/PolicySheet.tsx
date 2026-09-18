import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

export type PolicyType = 'terms' | 'privacy'

/** 홈 푸터와 회원가입이 함께 쓰는 약관 본문. 출시 전 법무 검토를 거친 전문으로 교체한다. */
export const POLICIES: Record<PolicyType, { title: string; sections: Array<{ heading: string; body: string }> }> = {
  terms: {
    title: '서비스 이용약관',
    sections: [
      { heading: '제1조 (목적)', body: '본 약관은 RAOTA(라오타) 서비스의 이용과 관련하여 회사와 회원 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.' },
      { heading: '제2조 (회원의 의무)', body: '회원은 라멘 방문 기록 및 리뷰 작성 시 타인의 권리를 침해하거나 허위 사실을 유포하지 않아야 합니다.' },
      { heading: '제3조 (서비스 제공 및 변경)', body: '라오타는 회원의 라멘로그 분석, 취향 리포트 생성 및 라멘집 추천 서비스를 상시 제공합니다.' },
    ],
  },
  privacy: {
    title: '개인정보처리방침',
    sections: [
      { heading: '1. 수집하는 개인정보 항목', body: '닉네임, 프로필 이미지, 선호 라멘 스타일, 라멘로그 데이터' },
      { heading: '2. 수집 및 이용 목적', body: '회원 식별, 라멘로그 캘린더 동기화, 맞춤형 라멘 큐레이션 및 등급 산정' },
      { heading: '3. 보유 및 이용 기간', body: '회원 탈퇴 시까지 보관하며, 탈퇴일로부터 30일 후 모든 정보는 영구 파기됩니다.' },
      { heading: '4. 문의', body: '개인정보 관련 문의는 contact@raota.net 으로 보내주세요.' },
    ],
  },
}

interface Props {
  type: PolicyType
  /** 시트 제목. 기본은 문서 이름 */
  title?: string
  onClose: () => void
  /** 하단 행동 영역. 없으면 "닫기" 버튼 */
  footer?: ReactNode
}

/** 앱 열 안에서 열리는 약관 바텀시트. Escape로 닫히고, 열릴 때 닫기 버튼으로 포커스가 간다. */
export default function PolicySheet({ type, title, onClose, footer }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const policy = POLICIES[type]
  const titleId = `policy-sheet-title-${type}`

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus?.({ preventScroll: true })
    }
  }, [onClose])

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end">
      <button type="button" className="anim-fade-in absolute inset-0 bg-black/50" onClick={onClose} aria-label={`${policy.title} 닫기`} tabIndex={-1} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="anim-slide-up relative z-10 flex max-h-[75%] w-full flex-col rounded-t-[12px] bg-white text-[#25282B] shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
      >
        <div aria-hidden="true" className="flex justify-center pb-1 pt-3">
          <span className="h-1 w-10 rounded-full bg-[#E2E2E2]" />
        </div>
        <div className="flex items-center justify-between border-b border-[#F2F2F2] py-1 pl-5 pr-2">
          <h2 id={titleId} className="text-[17px] font-black text-[#25282B]">
            {title ?? policy.title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-11 w-11 items-center justify-center rounded-full text-[#6B6E73] hover:bg-[#F2F2F2] hover:text-[#25282B]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-3 overflow-y-auto p-5 text-[14px] leading-relaxed text-[#4A4D52]">
          {policy.sections.map(section => (
            <p key={section.heading}>
              <strong className="text-[#25282B]">{section.heading}</strong>
              <br />
              {section.body}
            </p>
          ))}
        </div>
        <div className="border-t border-[#F2F2F2] p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          {footer ?? (
            <button
              type="button"
              onClick={onClose}
              className="h-12 w-full rounded-[60px] bg-[#25282B] text-[15px] font-bold text-white transition-opacity active:opacity-90"
            >
              닫기
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
