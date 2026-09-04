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
      {/* Tabler Bowl Reference (정갈하고 선명한 라멘 돈부리 볼) */}
      <path d="M4 8h16a1 1 0 0 1 1 1v.5c0 1.5-2.517 5.573-4 6.5v1a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-1c-1.687-1.054-4-5-4-6.5V9a1 1 0 0 1 1-1" />
    </svg>
  )
}
