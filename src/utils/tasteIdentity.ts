// 웹과 iOS 앱이 같은 원장·계산을 쓰도록 실제 구현은 packages/shared에 있다.
export {
  typeCountsWithLogs,
  DENSE_BROTH_THRESHOLD,
  tasteIdentity,
  metricsFromProfile,
  strongestAxes,
  RAMEN_ACTIVITY_LEVELS,
  getRamenActivityLevel,
} from '@raota/shared'
export type { TasteIdentity, MetricItem, RamenActivityLevel } from '@raota/shared'
