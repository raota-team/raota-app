import {
  RAMEN_TYPES,
  TASTE_AXES,
  TASTE_FIELDS,
  type CreateRamenLogInput,
  type TasteAxisKey,
  type TasteNoteKey,
  type TasteNotes,
  type TasteScores,
} from "@raota/shared"

export type RecordValidationField =
  | "shopId"
  | "menuName"
  | "ramenType"
  | "visitedAt"
  | "scores"
  | "tasteNotes"
  | "note"

export interface RecordValidationError {
  field: RecordValidationField
  /** field가 scores일 때 비어 있는 축 */
  axis?: TasteAxisKey
  message: string
}

export interface RecordDraft
  extends Omit<
    CreateRamenLogInput,
    "shopId" | "menuName" | "ramenType" | "note" | "tasteNotes" | "scores" | "revisit"
  > {
  shopId?: number | null
  menuName?: string | null
  ramenType?: string | null
  note?: string | null
  tasteNotes?: TasteNotes | null
  /** 아직 고르지 않은 축은 비어 있다 */
  scores?: Partial<TasteScores> | null
  revisit?: CreateRamenLogInput["revisit"] | null
}

/** 메모 최대 길이. 메모는 선택이다. */
export const RECORD_NOTE_MAX_LENGTH = 500

export interface RecordValidationOptions {
  validShopIds?: Iterable<number>
  now?: Date
}

const TASTE_NOTE_KEYS: TasteNoteKey[] = [
  "broth",
  "noodle",
  "seasoning",
  "topping",
]
const TASTE_OPTIONS = new Map(
  TASTE_FIELDS.map((field) => [field.key, new Set(field.options)] as const),
)

/** 맛 태그는 선택이다. 고른 태그가 모두 허용된 보기인지만 확인한다. */
export function hasValidTasteNotes(tasteNotes: TasteNotes | null | undefined): boolean {
  if (!tasteNotes) return true
  if (typeof tasteNotes !== "object") return false
  return TASTE_NOTE_KEYS.every((key) => {
    const notes = (tasteNotes as Partial<TasteNotes>)[key]
    if (notes === undefined) return true
    const allowed = TASTE_OPTIONS.get(key)
    return (
      Array.isArray(notes) &&
      notes.every((note) => typeof note === "string" && Boolean(allowed?.has(note)))
    )
  })
}

/** 받침이 있으면 "을", 없으면 "를" */
export function withObjectParticle(word: string): string {
  const last = word.charCodeAt(word.length - 1)
  if (last < 0xac00 || last > 0xd7a3) return `${word}를`
  return (last - 0xac00) % 28 === 0 ? `${word}를` : `${word}을`
}

const isScore = (value: unknown) =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5

/**
 * 아직 고르지 않은 5축. 재방문 의사는 revisit 답으로 채워지므로 revisit이 없을 때만 빠진 것으로 본다.
 * 순서는 화면 순서(TASTE_AXES)와 같아 첫 항목으로 바로 스크롤할 수 있다.
 */
export function missingScoreAxes(draft: Pick<RecordDraft, "scores" | "revisit">): TasteAxisKey[] {
  return TASTE_AXES.filter(({ key }) =>
    key === "revisit" ? !draft.revisit : !isScore(draft.scores?.[key]),
  ).map(({ key }) => key)
}

function isValidCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export function validateRecordDraft(
  draft: RecordDraft,
  options: RecordValidationOptions = {},
): RecordValidationError[] {
  const errors: RecordValidationError[] = []
  const validShopIds = options.validShopIds
    ? new Set(options.validShopIds)
    : null

  if (!draft.shopId || draft.shopId <= 0) {
    errors.push({
      field: "shopId",
      message: "먼저 방문한 매장을 선택해주세요.",
    })
  } else if (validShopIds && !validShopIds.has(draft.shopId)) {
    errors.push({
      field: "shopId",
      message: "선택한 매장 정보를 찾을 수 없습니다.",
    })
  }
  if (!draft.menuName?.trim()) {
    errors.push({
      field: "menuName",
      message: "먹은 메뉴를 선택하거나 입력해주세요.",
    })
  }
  if (!draft.ramenType?.trim() || !RAMEN_TYPES.includes(draft.ramenType)) {
    errors.push({ field: "ramenType", message: "라멘 계보를 선택해주세요." })
  }

  const visitedAt = draft.visitedAt?.trim() ?? ""
  const now = options.now ?? new Date()
  const endOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  )
  if (
    !isValidCalendarDate(visitedAt) ||
    new Date(`${visitedAt}T00:00:00`).getTime() > endOfToday.getTime()
  ) {
    errors.push({
      field: "visitedAt",
      message: "방문일을 오늘 이전의 올바른 날짜로 선택해주세요.",
    })
  }
  for (const axis of missingScoreAxes(draft)) {
    const label = TASTE_AXES.find(({ key }) => key === axis)?.label ?? axis
    errors.push({ field: "scores", axis, message: `${withObjectParticle(label)} 골라주세요.` })
  }
  if (!hasValidTasteNotes(draft.tasteNotes)) {
    errors.push({ field: "tasteNotes", message: "맛 태그는 보기에서만 고를 수 있어요." })
  }
  if ((draft.note?.length ?? 0) > RECORD_NOTE_MAX_LENGTH) {
    errors.push({
      field: "note",
      message: `메모는 ${RECORD_NOTE_MAX_LENGTH}자까지 남길 수 있어요. 지금 ${draft.note?.length}자예요.`,
    })
  }

  return errors
}

export function firstRecordValidationMessage(
  draft: RecordDraft,
  options?: RecordValidationOptions,
): string | null {
  return validateRecordDraft(draft, options)[0]?.message ?? null
}
