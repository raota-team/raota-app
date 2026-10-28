import { defineConfig } from "@lingui/cli"

/**
 * 앱(apps/mobile)과 웹(src)이 같은 번역을 쓴다. 한국어 원문이 메시지이고, 다른 언어는 PO에 번역한다.
 * 문구를 바꾸면 `pnpm i18n:extract` → PO 번역 → `pnpm i18n:compile` 순서로 갱신한다(packages/shared/src/i18n/README.md).
 */
export default defineConfig({
  sourceLocale: "ko",
  locales: ["ko", "en", "zh", "ja", "es"],
  fallbackLocales: { default: "ko" },
  catalogs: [
    {
      path: "<rootDir>/packages/shared/src/i18n/locales/{locale}/messages",
      include: ["<rootDir>/apps/mobile/app", "<rootDir>/apps/mobile/src", "<rootDir>/src", "<rootDir>/packages/shared/src"],
      exclude: ["**/node_modules/**", "**/__tests__/**", "**/*.test.*"],
    },
  ],
  compileNamespace: "ts",
})
