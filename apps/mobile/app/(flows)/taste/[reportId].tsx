import { useLocalSearchParams } from "expo-router"

import { MonthlyTasteView } from "./archive"

/**
 * 특정 달의 취향 변화. reportId는 월 id('2026-08')나 이번 달('current-month')이다.
 * 밖에서 들어온 id가 원장에 없으면 가장 최근 달을 보여준다.
 */
export default function MonthlyTasteReportScreen() {
  const { reportId } = useLocalSearchParams<{ reportId?: string }>()
  return <MonthlyTasteView initialSelectedId={typeof reportId === "string" ? reportId : undefined} />
}
