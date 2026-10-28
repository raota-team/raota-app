import { t } from "@lingui/core/macro";
import * as AppleAuthentication from "expo-apple-authentication"
import * as Crypto from "expo-crypto"
import { Platform } from "react-native"
import { initializeKakaoSDK } from "@react-native-kakao/core"
import { login as kakaoLogin, logout as kakaoLogout } from "@react-native-kakao/user"
import { GoogleSignin, isErrorWithCode, statusCodes } from "@react-native-google-signin/google-signin"

import type { AuthProvider } from "@raota/shared"
import type { OauthLoginRequest } from "../api/types"

/*
 * 제공자 SDK에서 서버(#44) 로그인에 낼 자격 증명을 받는다. 서버가 검증하는 값에 맞춘다.
 * - 카카오: 액세스 토큰(서버가 app_id를 확인하고 회원 번호를 읽는다)
 * - Google: ID 토큰. aud가 웹 클라이언트 ID여야 해서 webClientId를 넘긴다
 * - Apple: identityToken + authorizationCode + 원문 nonce. Apple에는 SHA-256 hex를 넘기고 서버가 원문을 해시해 비교한다
 *
 * 키는 .env에서 읽는다(Metro는 process.env.EXPO_PUBLIC_*를 글자 그대로 쓴 자리만 바꾼다).
 * 키가 없는 제공자는 쓸 수 없는 것으로 보고 로그인 화면이 버튼을 숨긴다. 네이티브 설정도 app.config.ts가 같은 기준으로 뺀다.
 * 토큰은 로그·분석에 남기지 않는다.
 */

export type SocialProvider = Extract<AuthProvider, "apple" | "kakao" | "google">

const KAKAO_NATIVE_APP_KEY = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY?.trim() || null
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() || null
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() || null

/** 사용자가 제공자 화면을 닫았다. 오류 안내 없이 로그인 화면에 머문다 */
export class SocialSignInCancelled extends Error {
  constructor(readonly provider: SocialProvider) {
    super(t`로그인을 취소했어요.`)
    this.name = "SocialSignInCancelled"
  }
}

/** 이 빌드에서 쓸 수 있는 로그인 수단. Apple은 iOS에서만, 카카오·Google은 키가 있을 때만 */
export function availableSocialProviders(): SocialProvider[] {
  const providers: SocialProvider[] = []
  if (Platform.OS === "ios") providers.push("apple")
  if (KAKAO_NATIVE_APP_KEY) providers.push("kakao")
  // iOS SDK는 iOS 클라이언트 ID가 있어야 열린다. 다른 플랫폼은 웹 클라이언트 ID만 있으면 된다
  if (GOOGLE_WEB_CLIENT_ID && (Platform.OS !== "ios" || GOOGLE_IOS_CLIENT_ID)) providers.push("google")
  return providers
}

let kakaoReady: Promise<void> | null = null
let googleConfigured = false

/** SDK 초기화는 앱 실행마다 한 번. 로그인과 로그아웃이 같이 쓴다 */
function prepareKakao(appKey: string): Promise<void> {
  kakaoReady ??= initializeKakaoSDK(appKey).catch((error: unknown) => {
    kakaoReady = null
    throw error
  })
  return kakaoReady
}

function prepareGoogle(webClientId: string) {
  if (googleConfigured) return
  GoogleSignin.configure({ webClientId, iosClientId: GOOGLE_IOS_CLIENT_ID ?? undefined })
  googleConfigured = true
}

async function kakaoCredential(): Promise<OauthLoginRequest> {
  if (!KAKAO_NATIVE_APP_KEY) throw new Error(t`카카오 로그인이 설정되지 않았어요.`)
  await prepareKakao(KAKAO_NATIVE_APP_KEY)
  try {
    const token = await kakaoLogin()
    return { provider: "KAKAO", accessToken: token.accessToken }
  } catch (error) {
    // 카카오톡·카카오계정 화면에서 닫거나(Cancelled) 동의하지 않으면(AccessDenied) 취소로 본다
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined
    if (code === "Cancelled" || code === "AccessDenied") throw new SocialSignInCancelled("kakao")
    throw error
  }
}

async function googleCredential(): Promise<OauthLoginRequest> {
  if (!GOOGLE_WEB_CLIENT_ID) throw new Error(t`Google 로그인이 설정되지 않았어요.`)
  prepareGoogle(GOOGLE_WEB_CLIENT_ID)
  try {
    const response = await GoogleSignin.signIn()
    if (response.type === "cancelled") throw new SocialSignInCancelled("google")
    if (!response.data.idToken) throw new Error(t`Google에서 로그인 정보를 받지 못했어요.`)
    return { provider: "GOOGLE", idToken: response.data.idToken }
  } catch (error) {
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) throw new SocialSignInCancelled("google")
    throw error
  }
}

async function appleCredential(): Promise<OauthLoginRequest> {
  // 원문 nonce는 서버로, 해시는 Apple로 간다. Apple이 ID 토큰의 nonce 클레임에 해시를 그대로 담는다
  const nonce = Crypto.randomUUID()
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce, {
    encoding: Crypto.CryptoEncoding.HEX,
  })
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    })
    if (!credential.identityToken || !credential.authorizationCode) {
      throw new Error(t`Apple에서 로그인 정보를 받지 못했어요.`)
    }
    return {
      provider: "APPLE",
      idToken: credential.identityToken,
      authorizationCode: credential.authorizationCode,
      nonce,
    }
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined
    if (code === "ERR_REQUEST_CANCELED") throw new SocialSignInCancelled("apple")
    throw error
  }
}

/** 제공자 로그인 화면을 열고 서버에 낼 자격 증명을 돌려준다. 사용자가 닫으면 SocialSignInCancelled */
export function socialCredential(provider: SocialProvider): Promise<OauthLoginRequest> {
  if (provider === "kakao") return kakaoCredential()
  if (provider === "google") return googleCredential()
  return appleCredential()
}

/**
 * 로그아웃·탈퇴·세션 종료 때 제공자 SDK에 남은 로그인도 지운다. 다음 로그인 때 계정을 다시 고를 수 있게 한다.
 * 이미 지워졌거나 SDK를 못 쓰는 환경이어도 앱 로그아웃은 막지 않는다. Apple은 앱이 지울 세션이 없다.
 */
export async function signOutSocialProviders(): Promise<void> {
  await Promise.allSettled([
    (async () => {
      if (!KAKAO_NATIVE_APP_KEY) return
      await prepareKakao(KAKAO_NATIVE_APP_KEY)
      await kakaoLogout()
    })(),
    (async () => {
      if (!GOOGLE_WEB_CLIENT_ID) return
      prepareGoogle(GOOGLE_WEB_CLIENT_ID)
      await GoogleSignin.signOut()
    })(),
  ])
}
