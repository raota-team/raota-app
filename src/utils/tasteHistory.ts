// 웹과 iOS 앱이 같은 원장·계산을 쓰도록 실제 구현은 packages/shared에 있다.
export { reportMonthIndex, chronologicalReports, shortReportMonth, CURRENT_MONTH_ID, currentMonthReport, isPastReport } from '@raota/shared'
export type { CurrentMonthReport } from '@raota/shared'
