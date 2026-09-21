const { withAppDelegate } = require("expo/config-plugins")

/*
 * iOS 27 SDK부터 UIKit은 씬(Scene) 생명주기를 채택하지 않은 앱을 실행하자마자 종료한다
 * (_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption, SIGTRAP).
 *
 * expo 패키지에는 이미 ExpoAppSceneDelegate가 들어 있는데 SDK 57의 prebuild 템플릿이
 * 그것을 쓰지 않는다(SDK 58 템플릿부터 기본으로 들어간다). 그래서 여기서 템플릿이 만든
 * AppDelegate를 SDK 58과 같은 모양으로 고친다:
 *
 *   - AppDelegate가 ExpoReactNativeFactoryProvider를 따른다(씬 델리게이트가 팩토리를 가져간다)
 *   - 창을 만들고 React Native를 띄우는 일을 SceneDelegate로 넘긴다
 *   - SceneDelegate를 같은 파일에 둔다. 새 파일을 만들면 Xcode 프로젝트에도 등록해야 하는데,
 *     같은 모듈 안이면 Info.plist의 $(PRODUCT_MODULE_NAME).SceneDelegate가 그대로 찾아간다
 *
 * Info.plist의 UIApplicationSceneManifest는 app.json에 있다.
 * SDK 58로 올라가면 이 플러그인은 지워도 된다.
 */

const PROVIDER = "class AppDelegate: ExpoAppDelegate {"
const PROVIDER_DONE = "class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {"

const STARTS_REACT_NATIVE = `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif
`
const STARTS_REACT_NATIVE_DONE = `    // 창을 만들고 React Native를 띄우는 일은 SceneDelegate가 한다(iOS 27 SDK가 씬을 요구한다)
`

const SCENE_DELEGATE = `
@objc(SceneDelegate)
class SceneDelegate: ExpoAppSceneDelegate {
  // 설정은 ExpoAppSceneDelegate가 한다. 여기는 config plugin이 끼어들 자리.
}
`

function patch(contents) {
  if (contents.includes("class SceneDelegate")) return contents

  if (!contents.includes(PROVIDER)) {
    throw new Error(
      `withIosSceneLifecycle: AppDelegate에서 "${PROVIDER}"를 찾지 못했다. ` +
        "prebuild 템플릿이 바뀌었을 수 있으니 SDK 58 템플릿과 비교해 보고, " +
        "이미 SceneDelegate가 들어왔다면 이 플러그인을 지워라.",
    )
  }
  if (!contents.includes(STARTS_REACT_NATIVE)) {
    throw new Error(
      "withIosSceneLifecycle: AppDelegate에서 React Native를 띄우는 블록을 찾지 못했다. " +
        "템플릿이 바뀌었으니 이 플러그인을 다시 맞춰야 한다.",
    )
  }

  return (
    contents.replace(PROVIDER, PROVIDER_DONE).replace(STARTS_REACT_NATIVE, STARTS_REACT_NATIVE_DONE) + SCENE_DELEGATE
  )
}

module.exports = function withIosSceneLifecycle(config) {
  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== "swift") {
      throw new Error(`withIosSceneLifecycle: Swift AppDelegate를 기대했는데 ${cfg.modResults.language}가 왔다`)
    }
    cfg.modResults.contents = patch(cfg.modResults.contents)
    return cfg
  })
}
