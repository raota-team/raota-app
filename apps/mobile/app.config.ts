import type { ConfigContext, ExpoConfig } from "expo/config"

/*
 * app.json(공통 설정) 위에 소셜 로그인 네이티브 설정을 얹는다.
 * 제공자 키는 저장소에 적지 않고 .env(커밋하지 않음)나 빌드 환경 변수에서 읽는다.
 * 키가 없으면 그 제공자의 네이티브 설정을 넣지 않는다. 빌드는 그대로 되고, 로그인 화면은 그 버튼을 숨긴다(src/auth/social.ts).
 */

const APPLE_TEAM_ID = "X72682FG29"

/** iOS 클라이언트 ID(123-abc.apps.googleusercontent.com)를 뒤집은 URL 스킴(com.googleusercontent.apps.123-abc) */
function googleIosUrlScheme(clientId: string): string {
  return clientId.split(".").reverse().join(".")
}

type PluginEntry = NonNullable<ExpoConfig["plugins"]>[number]

export default ({ config }: ConfigContext): ExpoConfig => {
  // 빈 문자열이면 없는 것으로 본다
  const kakaoNativeAppKey = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY?.trim() || undefined
  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || undefined

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

  return {
    ...config,
    name: config.name ?? "RAOTA",
    slug: config.slug ?? "raota",
    ios: { ...config.ios, appleTeamId: APPLE_TEAM_ID, usesAppleSignIn: true },
    plugins,
  }
}
