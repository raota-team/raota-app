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
      {/* 상단 젓가락 (Chopsticks) */}
      <path d="M7 3l15 1.5" />
      <path d="M7 5.8l15 1.5" />

      {/* 좌측 사각 김 (Nori seaweed slice) */}
      <path d="M3.5 13.5l1-5h3l-.5 5" />

      {/* 젓가락에 걸쳐 높고 길게 흘러내리는 3줄 S자 웨이브 면발 (Lifting Noodles) */}
      <path d="M11 4.5c-1.5 2 1.5 4.5 0 8.5" />
      <path d="M14.5 5c-1.5 2 1.5 4.5 0 8" />
      <path d="M18 5.5c-1.5 2 1.5 4.5 0 7.5" />

      {/* 라멘 돈부리 그릇 (Ramen Bowl) */}
      <path d="M2 13h20c0 4.8-3.8 8-10 8S2 17.8 2 13Z" />

      {/* 그릇 굽 받침대 (Bowl Foot Ring) */}
      <path d="M8 21v1.5h8V21" />
    </svg>
  )
}
