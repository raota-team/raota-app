// 웹과 iOS 앱이 같은 원장·계산을 쓰도록 실제 구현은 packages/shared에 있다.
export {
  DEMO_BOWLS,
  MENU_CATEGORY_NAMES,
  menuCategoryOf,
  isoDate,
  bowlFromLog,
  bowlsFromLogs,
  monthKeyOfDate,
  bowlsInMonth,
  typeCountsOf,
  styleRowsOf,
  shopVisitsOf,
  longestStreak,
  PAST_REPORTS,
} from '@raota/shared'
export type { DemoBowl, MenuCategoryName, StyleRow, ShopVisit, PastReportItem, BowlLogLike } from '@raota/shared'
