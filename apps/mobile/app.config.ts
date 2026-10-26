import type { ConfigContext, ExpoConfig } from "expo/config"

// app.config는 Node에서 돈다. 앱 tsconfig에 Node 타입을 넣으면 앱 코드에도 Node 전역이 새므로 쓰는 함수만 좁혀 받는다
const { existsSync } = require("node:fs") as { existsSync(path: string): boolean }

/*
 * app.json(공통 설정) 위에 소셜 로그인 네이티브 설정을 얹는다.
 * 제공자 키는 저장소에 적지 않고 .env(커밋하지 않음)나 빌드 환경 변수에서 읽는다.
 * 키가 없으면 그 제공자의 네이티브 설정을 넣지 않는다. 빌드는 그대로 되고, 로그인 화면은 그 버튼을 숨긴다(src/auth/social.ts).
 * Sentry 소스맵 업로드도 같다. 업로드 토큰 파일(.env.sentry-build-plugin, 커밋하지 않음)이 있을 때만 출시 빌드에 업로드 단계를 넣는다.
 * 토큰 없이 단계를 넣으면 출시 빌드가 업로드 실패로 멈추기 때문이다. 오류 보고 자체는 DSN만 있으면 된다(src/monitoring.ts).
 */

const APPLE_TEAM_ID = "X72682FG29"
const SENTRY_ORG = "raota-ze"
const SENTRY_PROJECT = "raota-app"
/** Sentry 빌드 스크립트(node_modules/@sentry/react-native/scripts/sentry-xcode.sh)가 SENTRY_AUTH_TOKEN을 읽는 파일 */
const SENTRY_TOKEN_FILE = ".env.sentry-build-plugin"

/** iOS 클라이언트 ID(123-abc.apps.googleusercontent.com)를 뒤집은 URL 스킴(com.googleusercontent.apps.123-abc) */
function googleIosUrlScheme(clientId: string): string {
  return clientId.split(".").reverse().join(".")
}

type PluginEntry = NonNullable<ExpoConfig["plugins"]>[number]

export default ({ config, projectRoot }: ConfigContext): ExpoConfig => {
  // 빈 문자열이면 없는 것으로 본다
  const kakaoNativeAppKey = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY?.trim() || undefined
  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || undefined
  const uploadSentrySourceMaps = existsSync(`${projectRoot}/${SENTRY_TOKEN_FILE}`)

  const plugins: PluginEntry[] = [...(config.plugins ?? []), "expo-apple-authentication"]
  if (kakaoNativeAppKey) {
    // URL 스킴 kakao{키}, 카카오톡 앱 확인용 LSApplicationQueriesSchemes, 카카오톡에서 돌아오는 URL 처리(AppDelegate)
    plugins.push([
      "@react-native-kakao/core",
      { nativeAppKey: kakaoNativeAppKey, ios: { handleKakaoOpenUrl: true }, android: { authCodeHandlerActivity: true } },
    ])
  }
  if (googleIosClientId) {
    plugins.push(["@react-native-google-signin/google-signin", { iosUrlScheme: googleIosUrlScheme(googleIosClientId) }])
  }
  if (uploadSentrySourceMaps) {
    // 업로드 단계가 없어도 오류는 들어온다. 이 단계는 출시 빌드의 오류 위치를 원본 코드 줄로 보이게 할 뿐이다
    plugins.push(["@sentry/react-native/expo", { url: "https://sentry.io/", organization: SENTRY_ORG, project: SENTRY_PROJECT }])
  }

  return {
    ...config,
    name: config.name ?? "RAOTA",
    slug: config.slug ?? "raota",
    ios: { ...config.ios, appleTeamId: APPLE_TEAM_ID, usesAppleSignIn: true },
    plugins,
  }
}
