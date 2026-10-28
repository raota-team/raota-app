import { t, ph, msg } from "@lingui/core/macro";
import { translate } from "@raota/shared"

/** 서버 Nickname.of와 같은 순서로 trim → NFKC → 길이·문자를 확인한다. */
export const NICKNAME_MIN = 2
export const NICKNAME_MAX = 12
export const NICKNAME_REQUIRED_ERROR = msg`닉네임을 입력해 주세요. ${NICKNAME_MIN}~${NICKNAME_MAX}자로 쓸 수 있어요.`

const ALLOWED_NICKNAME = /^[가-힣a-zA-Z0-9_]+$/

export interface NicknameValidation {
  display: string
  /** 서버의 대소문자 무시 중복 판별값 */
  normalized: string
  length: number
  error: string | null
}

export function validateNickname(raw: string | null | undefined): NicknameValidation {
  // Java String.trim()은 U+0020 이하만 지운다. NFKC 전에 잘라야 NBSP 같은 문자를 잘못 허용하지 않는다.
  const display = (raw ?? "").replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, "").normalize("NFKC")
  let length = 0
  for (const _point of display) length++
  const error = length === 0
    ? translate(NICKNAME_REQUIRED_ERROR)
    : length < NICKNAME_MIN
      ? t`닉네임이 너무 짧아요. ${ph({ count: NICKNAME_MIN - length })}자만 더 적어 주세요.`
      : length > NICKNAME_MAX
        ? t`닉네임은 ${ph({ max: NICKNAME_MAX })}자까지예요. 지금 ${ph({ count: length })}자예요.`
        : !ALLOWED_NICKNAME.test(display)
          ? t`닉네임은 한글·영문·숫자·밑줄만 쓸 수 있어요.`
          : null
  return { display, normalized: display.toLowerCase(), length, error }
}
