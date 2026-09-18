import { menuDistribution as sharedMenuDistribution, type DistributionSource, type MenuCategoryName } from '@raota/shared'

export type { DistributionSource } from '@raota/shared'

// 분포 계산은 packages/shared에 있고, 웹은 종류 이름에 브랜드 팔레트 색만 붙인다.
export const MENU_CATEGORIES: ReadonlyArray<{ name: MenuCategoryName; color: string; textColor: string }> = [
  { name: '돈코츠', color: 'bg-brand', textColor: 'text-white' },
  { name: '쇼유', color: 'bg-ink', textColor: 'text-white' },
  { name: '시오', color: 'bg-ink-faint', textColor: 'text-ink' },
  { name: '미소', color: 'bg-ink-muted', textColor: 'text-white' },
  { name: '기타', color: 'bg-line', textColor: 'text-ink' },
]

export function menuDistribution(source: DistributionSource | undefined) {
  const { total, items } = sharedMenuDistribution(source)
  return {
    total,
    items: items.map((item, index) => ({ ...MENU_CATEGORIES[index], ...item })),
  }
}
