import {
  RAMEN_TYPES,
  TASTE_FIELDS,
  type CreateRamenLogInput,
  type TasteNoteKey,
  type TasteNotes,
} from "@raota/shared"

export type RecordValidationField = "shopId" | "menuName" | "ramenType" | "visitedAt" | "tasteNotes" | "note"

export interface RecordValidationError {
  field: RecordValidationField
  message: string
}

export interface RecordDraft
  extends Omit<CreateRamenLogInput, "shopId" | "menuName" | "ramenType" | "note"> {
  shopId?: number | null
  menuName?: string | null
  ramenType?: string | null
  note?: string | null
}

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

export function hasCompleteTasteNotes(
  tasteNotes: TasteNotes | unknown,
): tasteNotes is TasteNotes {
  if (!tasteNotes || typeof tasteNotes !== "object") return false
  return TASTE_NOTE_KEYS.every((key) => {
    const notes = (tasteNotes as Partial<TasteNotes>)[key]
    const allowed = TASTE_OPTIONS.get(key)
    return (
      Array.isArray(notes) &&
      notes.length > 0 &&
      notes.every(
        (note) => typeof note === "string" && Boolean(allowed?.has(note)),
      )
    )
  })
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
  if (!hasCompleteTasteNotes(draft.tasteNotes)) {
    errors.push({
      field: "tasteNotes",
      message: "국물·면·간·토핑에서 느낌을 하나 이상 골라주세요.",
    })
  }
  if ((draft.note?.trim().length ?? 0) < 5) {
    errors.push({
      field: "note",
      message: "다음의 나를 위해 5자 이상 시식 메모를 남겨주세요.",
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
