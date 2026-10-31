#!/usr/bin/env node
/**
 * 스토어 심사 없이 JS·이미지 변경을 출시 앱에 보낸다(EAS Update, 채널 production).
 *
 *   pnpm ota --message "식권 문구 수정"
 *
 * 앱은 켤 때 새 업데이트를 내려받고 다음 실행부터 적용한다(app.json updates).
 *
 * 보낼 수 없는 것: 네이티브 라이브러리 추가·업그레이드, 권한, Expo SDK, 아이콘, app.json 네이티브 설정.
 * 이런 변경은 런타임 버전(runtimeVersion: fingerprint)이 바뀌므로, 업데이트를 올려도 기존 앱에는 내려가지 않는다.
 * 새 빌드를 올려 심사받아야 하고, 그 빌드부터 다시 이 명령으로 보낼 수 있다.
 * 런타임 버전은 이 Mac의 .env·Sentry 토큰 파일 유무에도 따라 달라지므로, 출시 빌드를 만든 것과 같은 환경에서 보낸다.
 *
 * 되돌리기: npx eas update:rollback (또는 expo.dev 프로젝트의 Updates에서 이전 업데이트로 되돌린다)
 */
import { spawnSync } from "node:child_process"
import { parseArgs } from "node:util"

const { values } = parseArgs({ options: { message: { type: "string" } } })
if (!values.message) {
  console.error('사용법: pnpm ota --message "이번 업데이트에서 바뀐 것"')
  process.exit(1)
}

// iOS만 출시했다. Android를 출시하면 --platform all로 바꾼다
const result = spawnSync(
  "npx",
  ["eas", "update", "--channel", "production", "--platform", "ios", "--message", values.message, "--non-interactive"],
  { stdio: "inherit" },
)
process.exit(result.status ?? 1)
