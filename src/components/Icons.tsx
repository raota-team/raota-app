import React from 'react'

export function IconRamen({ className = 'w-4 h-4', fill = 'currentColor', stroke = 'currentColor' }: { className?: string; fill?: string; stroke?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 11C3 16.5 7 21 12 21C17 21 21 16.5 21 11H3Z" fill={fill} fillOpacity="0.15" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4 11C4 7 7 4 12 4C17 4 20 7 20 11" stroke={stroke} strokeWidth="2" strokeLinecap="round"/>
      <path d="M8 21H16" stroke={stroke} strokeWidth="2" strokeLinecap="round"/>
      <path d="M7 8V10M12 7V10M17 8V10" stroke={stroke} strokeWidth="2" strokeLinecap="round"/>
      <line x1="18" y1="3" x2="22" y2="7" stroke={stroke} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

export function IconTrophy({ className = 'w-4 h-4', fill = 'currentColor', stroke = 'currentColor' }: { className?: string; fill?: string; stroke?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 9H3C3 6.5 5 4.5 7 4.5H17C19 4.5 21 6.5 21 9H18" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M6 5V9C6 12.3137 8.68629 15 12 15C15.3137 15 18 12.3137 18 9V5H6Z" fill={fill} fillOpacity="0.15" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 15V18" stroke={stroke} strokeWidth="2" strokeLinecap="round"/>
      <path d="M8 21H16" stroke={stroke} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

export function IconSparkles({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      {/* 메인 4각 별 */}
      <path d="M11 2C11 6.97 6.97 11 2 11C6.97 11 11 15.03 11 20C11 15.03 15.03 11 20 11C15.03 11 11 6.97 11 2Z" />
      {/* 우상단 보조 4각 별 */}
      <path d="M19 2C19 4.21 17.21 6 15 6C17.21 6 19 7.79 19 10C19 7.79 20.79 6 23 6C20.79 6 19 4.21 19 2Z" opacity="0.9" />
    </svg>
  )
}


export function IconLightbulb({ className = 'w-4 h-4', stroke = 'currentColor' }: { className?: string; stroke?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-1 1.5-2.4 1.5-3.8 0-3.3-2.7-6-6-6S6 4.4 6 7.7c0 1.4.5 2.8 1.5 3.8.8.8 1.3 1.5 1.5 2.5"/>
      <path d="M9 18h6"/>
      <path d="M10 22h4"/>
    </svg>
  )
}


