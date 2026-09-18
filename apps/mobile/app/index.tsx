import { Redirect } from "expo-router"

/**
 * 앱은 네이티브 홈으로 바로 연다.
 * 예전 웹앱 감싸기 화면(Vite 개발 서버를 WebView로 띄움)은 개발용으로 /dev-webview에 남겨 둔다.
 */
export default function Index() {
  return <Redirect href="/native" />
}
