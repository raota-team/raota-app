/**
 * 런타임 버전(app.json runtimeVersion: fingerprint)을 계산할 때 뺄 것.
 * package.json의 scripts는 네이티브 앱에 들어가지 않는데 기본값으로는 지문에 들어가, npm 스크립트 하나만 바꿔도
 * 런타임 버전이 바뀌고 OTA 업데이트가 이미 출시한 앱에 내려가지 않게 된다.
 * @type {import("expo/fingerprint").Config}
 */
module.exports = {
  sourceSkips: ["PackageJsonScriptsAll"],
}
