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
      {/* 젓가락 2개 (Chopsticks) - 상단에서 면을 집어 든 대각선 */}
      <path d="M21 3.5L10.5 7" />
      <path d="M21 5.5L11.5 8.5" />

      {/* 젓가락에 걸려 내려오는 면발 (Lifting Noodles) */}
      <path d="M12 8.5V12" />
      <path d="M14.5 7.8V12" />
      <path d="M17 7.2V12" />

      {/* 라멘 돈부리 그릇 (Ramen Bowl) */}
      <path d="M3 11.5H21C21 16.5 17 20 12 20C7 20 3 16.5 3 11.5Z" />

      {/* 그릇 굽 받침대 (Bowl Foot Ring) */}
      <path d="M8.5 20V21.5H15.5V20" />
    </svg>
  )
}
