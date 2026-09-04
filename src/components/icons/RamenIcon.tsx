import React from 'react'

export interface RamenIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string
  size?: number | string
  strokeWidth?: number | string
  color?: string
}

/**
 * 🍜 Hugeicons Noodles 레퍼런스 스타일 라멘 벡터 아이콘 컴포넌트
 * - 깊고 둥근 일본식 라멘 돈부리 그릇
 * - 젓가락으로 면을 살짝 들어올린(lifting noodles) 모션
 * - Lucide 아이콘 규격(viewBox 0 0 24 24, stroke-based, currentColor)과 100% 호환
 */
export default function RamenIcon({
  className = '',
  size,
  strokeWidth = 2,
  color = 'currentColor',
  ...props
}: RamenIconProps) {
  const width = size || props.width
  const height = size || props.height

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      width={width}
      height={height}
      {...props}
    >
      {/* 따뜻한 라멘 국물 수증기 (Steam 2줄) */}
      <path d="M7 4c-.8 1.5.8 2.5 0 4" />
      <path d="M11 2.5c-.8 1.8.8 2.8 0 4.5" />

      {/* 우측 젓가락 2개 (Chopsticks) */}
      <path d="M15 11l7-6" />
      <path d="M17.5 11l4.5-3.5" />

      {/* 라멘 돈부리 그릇 (Ramen Bowl) */}
      <path d="M2 11h20c0 5.5-4 9-10 9S2 16.5 2 11Z" />

      {/* 그릇 굽 받침대 (Bowl Foot Ring) */}
      <path d="M8 20v1.5h8V20" />
    </svg>
  )
}
