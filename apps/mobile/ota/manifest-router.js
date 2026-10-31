// CloudFront Function(cloudfront-js-2.0, 뷰어 요청) raota-ota-manifest. 바꾸면 scripts/ota-deploy-router.mjs로 다시 올린다.
//
// 앱(expo-updates)은 켤 때 GET /manifest를 보낸다. 헤더의 채널·플랫폼·런타임 버전으로 KeyValueStore에서
// 지금 내보낼 서명된 매니페스트(S3 manifests/ 아래 multipart 파일)를 찾아 그 경로로 바꾼다.
// 없으면 204(업데이트 없음)를 바로 돌려준다. Expo Updates v1 명세: 빈 multipart 응답은 204로 대신할 수 있다.
import cf from "cloudfront"

const kvs = cf.kvs()

function noUpdate() {
  return {
    statusCode: 204,
    statusDescription: "No Content",
    headers: {
      "expo-protocol-version": { value: "1" },
      "expo-sfv-version": { value: "0" },
      "cache-control": { value: "private, max-age=0" },
    },
  }
}

function header(request, name) {
  const entry = request.headers[name]
  return entry ? entry.value : ""
}

async function handler(event) {
  const request = event.request
  const platform = header(request, "expo-platform")
  const runtime = header(request, "expo-runtime-version")
  const channel = header(request, "expo-channel-name") || "production"
  if ((platform !== "ios" && platform !== "android") || !/^[\w.-]{1,128}$/.test(runtime) || !/^[\w-]{1,64}$/.test(channel)) {
    return { statusCode: 400, statusDescription: "Bad Request" }
  }
  let manifest
  try {
    manifest = await kvs.get(`${channel}/${platform}/${runtime}`)
  } catch (error) {
    // 키가 없으면 이 런타임에 낸 업데이트가 아직 없다
    return noUpdate()
  }
  request.uri = `/manifests/${manifest}`
  request.querystring = {}
  return request
}
