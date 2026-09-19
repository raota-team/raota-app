import {
  RAMEN_TYPES,
  REVISIT_SCORE,
  type ContentReport,
  type ContentReportReason,
  type RamenLog,
  type RamenLogComment,
  type TasteAxisKey,
} from "@raota/shared"

/*
 * 라운지(라멘로그 피드)의 순수 계산. 화면과 hook이 같이 쓰고, API가 붙어도 표시 규칙은 여기 남는다.
 */

export type LoungeSort = "latest" | "likes"

export const LOUNGE_SORTS: Array<{ value: LoungeSort; label: string }> = [
  { value: "latest", label: "최신순" },
  { value: "likes", label: "공감순" },
]

export const LOUNGE_ALL_TYPES = "전체"

/** 라멘 종류 필터. 기록 화면과 같은 RAMEN_TYPES 순서 */
export const LOUNGE_TYPE_FILTERS: string[] = [LOUNGE_ALL_TYPES, ...RAMEN_TYPES]

/** 한 번에 보여주는 라멘로그 수. 서버 커서 페이지 크기와 맞춘다 */
export const LOUNGE_PAGE_SIZE = 10

export const COMMENT_MAX_LENGTH = 300
/** 이 글자 수부터 남은 글자를 보여준다 */
export const COMMENT_COUNTER_FROM = 250

export const REPORT_REASONS: Array<{ value: ContentReportReason; label: string }> = [
  { value: "spam", label: "스팸·홍보" },
  { value: "abuse", label: "욕설·혐오" },
  { value: "sexual", label: "음란물" },
  { value: "privacy", label: "개인정보 노출" },
  { value: "other", label: "기타" },
]

export interface LoungeViewer {
  /** 로그인한 사용자 id. 비회원이면 null */
  userId: string | null
  hiddenAuthorIds: readonly string[]
  reports: readonly ContentReport[]
}

function isReported(reports: readonly ContentReport[], kind: ContentReport["kind"], id: number) {
  return reports.some((report) => report.kind === kind && report.targetId === id)
}

function isHiddenAuthor(viewer: LoungeViewer, authorId: string | undefined) {
  return Boolean(authorId) && viewer.hiddenAuthorIds.includes(authorId as string)
}

/** 작성 시각(ISO). 읽을 수 없으면 가장 오래된 것으로 본다 */
function timeOf(value: string) {
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : 0
}

/** 이 사람에게 보여도 되는 라멘로그인가: 공개 기록(내 기록은 비공개도), 숨긴 사람·신고한 글 제외 */
export function isLogVisibleTo(log: RamenLog, viewer: LoungeViewer): boolean {
  const own = Boolean(viewer.userId) && log.author.id === viewer.userId
  if (!log.isPublic && !own) return false
  if (own) return true
  return !isHiddenAuthor(viewer, log.author.id) && !isReported(viewer.reports, "log", log.id)
}

/**
 * 라운지 피드: 공개 라멘로그만(내 비공개 기록도 빼서 남이 보는 피드와 같게), 숨긴 사람·신고한 글 제외.
 * 최신순은 실제 작성 시각, 공감순은 공감 수(같으면 최신).
 */
export function selectLoungeLogs(
  logs: readonly RamenLog[],
  { type, sort }: { type: string; sort: LoungeSort },
  viewer: LoungeViewer,
): RamenLog[] {
  return logs
    .filter((log) => log.isPublic && isLogVisibleTo(log, viewer))
    .filter((log) => type === LOUNGE_ALL_TYPES || log.ramenType === type)
    .sort((a, b) =>
      sort === "likes"
        ? b.likes - a.likes || timeOf(b.createdAt) - timeOf(a.createdAt)
        : timeOf(b.createdAt) - timeOf(a.createdAt),
    )
}

/** 상세 화면의 댓글: 등록순, 숨긴 사람과 신고한 댓글 제외 */
export function selectVisibleComments(log: RamenLog, viewer: LoungeViewer): RamenLogComment[] {
  return (log.comments ?? [])
    .filter((comment) => comment.author.id === viewer.userId || (!isHiddenAuthor(viewer, comment.author.id) && !isReported(viewer.reports, "comment", comment.id)))
    .sort((a, b) => timeOf(a.createdAt) - timeOf(b.createdAt))
}

/** 기록 화면과 같은 한 마디. 좋고 나쁨(만족도·토핑)과 취향의 위치(육수·면)를 나눠 말한다 */
const AXIS_WORDS: Record<Exclude<TasteAxisKey, "revisit">, readonly string[]> = {
  satisfaction: ["아쉬웠어요", "그저 그랬어요", "괜찮았어요", "맛있었어요", "인생 라멘이에요"],
  brothDensity: ["아주 맑음", "맑은 편", "중간", "진한 편", "아주 진함"],
  noodleFirmness: ["아주 부드럽게", "부드러운 편", "중간", "단단한 편", "아주 단단하게"],
  topping: ["아쉬움", "조금 아쉬움", "보통", "좋음", "훌륭함"],
}

const AXIS_LABELS: Record<TasteAxisKey, string> = {
  satisfaction: "전체 만족도",
  brothDensity: "육수 농도",
  noodleFirmness: "면 삶기",
  topping: "토핑",
  revisit: "재방문 의사",
}

export interface TasteSummaryRow {
  key: TasteAxisKey
  label: string
  /** "진한 편", "맛있었어요", "자주 감" */
  word: string
  /** 좋고 나쁨 항목(만족도·토핑)의 점수. 취향 위치 항목은 점수가 좋고 나쁨이 아니라서 없다 */
  score?: number
}

function wordOf(key: Exclude<TasteAxisKey, "revisit">, score: number) {
  const index = Math.min(5, Math.max(1, Math.round(score))) - 1
  return AXIS_WORDS[key][index]
}

/** 맛 평가 다섯 줄. 점수가 없는 옛 기록이면 빈 배열 */
export function tasteSummaryOf(log: Pick<RamenLog, "scores" | "revisit">): TasteSummaryRow[] {
  const scores = log.scores
  if (!scores) return []
  return [
    { key: "satisfaction", label: AXIS_LABELS.satisfaction, word: wordOf("satisfaction", scores.satisfaction), score: scores.satisfaction },
    { key: "brothDensity", label: AXIS_LABELS.brothDensity, word: wordOf("brothDensity", scores.brothDensity) },
    { key: "noodleFirmness", label: AXIS_LABELS.noodleFirmness, word: wordOf("noodleFirmness", scores.noodleFirmness) },
    { key: "topping", label: AXIS_LABELS.topping, word: wordOf("topping", scores.topping), score: scores.topping },
    { key: "revisit", label: AXIS_LABELS.revisit, word: log.revisit, score: REVISIT_SCORE[log.revisit] },
  ]
}

/**
 * 피드 카드의 한 줄 요약: "만족 4 · 육수 진한 편 · 면 부드러운 편".
 * 점수가 없으면 null. VoiceOver용 긴 문장도 함께 돌려준다
 */
export function compactTasteSummary(log: Pick<RamenLog, "scores" | "revisit">): { text: string; label: string } | null {
  const scores = log.scores
  if (!scores) return null
  const broth = wordOf("brothDensity", scores.brothDensity)
  const noodle = wordOf("noodleFirmness", scores.noodleFirmness)
  return {
    text: `만족 ${Math.round(scores.satisfaction)} · 육수 ${broth} · 면 ${noodle}`,
    label: `맛 평가: 전체 만족도 5점 중 ${Math.round(scores.satisfaction)}점, 육수 ${broth}, 면 ${noodle}`,
  }
}

/** 라멘로그의 맛 태그(국물 → 면 → 간 → 토핑 순) */
export function tasteTagsOf(log: Pick<RamenLog, "tasteNotes">): string[] {
  const { broth, noodle, seasoning, topping } = log.tasteNotes
  return [...broth, ...noodle, ...seasoning, ...topping]
}

/** 보여줄 사진 목록. photos가 없으면 대표 사진 하나 */
export function photosOf(log: Pick<RamenLog, "photos" | "imageUrl">): string[] {
  if (log.photos && log.photos.length > 0) return log.photos
  return log.imageUrl ? [log.imageUrl] : []
}

/** "라멘 미식가 (Lv.5)" → "라멘 미식가" (웹 라운지와 같은 표기) */
export function gradeTitleOf(level?: string): string {
  if (!level) return ""
  return level
    .replace(/\s*\(Lv\.\s*\d+\)/gi, "")
    .replace(/Lv\.\s*\d+\s*/gi, "")
    .trim()
}

/** "2026. 09. 18" → "9월 18일". 모양이 다르면 원문 */
export function formatVisitDate(visitedAt: string): string {
  const match = visitedAt.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/)
  if (!match) return visitedAt
  return `${Number(match[2])}월 ${Number(match[3])}일`
}

/**
 * 작성 시각을 짧게: 방금 전 · N분 전 · N시간 전 · 어제 · N일 전 · 9월 1일 · 2025년 9월 1일.
 * 읽을 수 없는 값은 원문
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const time = Date.parse(iso)
  if (!Number.isFinite(time)) return iso
  const minutes = Math.floor((now.getTime() - time) / 60000)
  if (minutes < 1) return "방금 전"
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days === 1) return "어제"
  if (days < 7) return `${days}일 전`
  const date = new Date(time)
  const label = `${date.getMonth() + 1}월 ${date.getDate()}일`
  return date.getFullYear() === now.getFullYear() ? label : `${date.getFullYear()}년 ${label}`
}
