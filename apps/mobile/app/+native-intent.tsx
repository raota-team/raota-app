/**
 * 앱 밖에서 들어온 링크를 라우팅하기 전에 거른다(expo-router +native-intent).
 *
 * 카카오톡으로 로그인하면 카카오톡이 kakao{네이티브 앱 키}://oauth?code=... 로 앱을 다시 연다.
 * 이 링크는 카카오 SDK가 AppDelegate에서 받아 로그인을 끝내는데, 씬 생명주기(expo의 SceneEventForwarder)가
 * 같은 링크를 React Native Linking에도 넘겨서 라우터가 /oauth를 열려다 404 화면을 띄웠다
 * (2026.10.26, 카카오톡이 깔린 실기기에서만. 시뮬레이터는 카카오톡이 없어 웹 로그인으로 돌아와 이 링크가 없다).
 * 카카오 링크는 라우팅하지 않는다. null이면 라우터가 이동하지 않는다.
 */
const KAKAO_LINK = /^kakao[0-9a-z]+:\/\//i

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string | null {
  return KAKAO_LINK.test(path) ? null : path
}
