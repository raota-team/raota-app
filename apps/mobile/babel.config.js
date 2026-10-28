// Lingui 매크로(t``, msg``, plural …)를 빌드할 때 런타임 호출로 바꾼다. Metro와 Jest가 같은 설정을 쓴다
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ["babel-preset-expo"],
    plugins: ["@lingui/babel-plugin-lingui-macro"],
  }
}
