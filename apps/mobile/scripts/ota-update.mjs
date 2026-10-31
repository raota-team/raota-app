#!/usr/bin/env node
/**
 * 스토어 심사 없이 JS·이미지 변경을 출시 앱에 보낸다(자체 OTA 서버, Expo Updates v1 명세).
 *
 *   pnpm ota --message "식권 문구 수정"     지금 코드를 내보낸다
 *   pnpm ota --rollback                      바로 전 배포로 되돌린다(전이 없으면 앱에 들어 있는 JS로). 거듭 쓰면 한 칸씩 더 뒤로 간다
 *   옵션: --channel production(기본) --platform ios(기본)|android
 *
 * 앱은 켤 때 새 업데이트를 내려받고 다음 실행부터 적용한다(app.json updates).
 *
 * 구성(AWS 787262016445, ap-northeast-2, 태그 Project=raota):
 * - S3 raota-ota-787262016445: assets/{md5}(파일, 바뀌지 않음), manifests/{채널}/{플랫폼}/{런타임}/{id}.multipart(서명한 응답)·.json(기록)
 * - CloudFront dhqibujigcqbq.cloudfront.net(EXN78PF86QNF3): /manifest는 함수 raota-ota-manifest(소스 ota/manifest-router.js)가
 *   KeyValueStore raota-ota의 "{채널}/{플랫폼}/{런타임}" 값으로 지금 매니페스트를 고르고, 없으면 204. 나머지 경로는 S3 파일
 * - 서명 키: ~/.raota-ota/keys/private-key.pem(저장소 밖). 백업은 SSM /raota/ota/code-signing-private-key.
 *   다른 Mac에서는 aws ssm get-parameter --with-decryption으로 받아 같은 경로에 둔다. 키를 잃으면 새 인증서로 스토어 빌드를 다시 해야 한다.
 *
 * 보낼 수 없는 것: 네이티브 라이브러리 추가·업그레이드, 권한, Expo SDK, 아이콘, app.json 네이티브 설정.
 * 이런 변경은 런타임 버전(runtimeVersion: fingerprint)이 바뀌어 기존 앱에는 내려가지 않는다. 새 스토어 빌드부터 다시 보낼 수 있다.
 * 런타임 버전은 .env·Sentry 토큰 파일 유무에도 따라 달라지므로, 출시 빌드를 만든 것과 같은 환경에서 보낸다.
 * KeyValueStore를 바꾼 뒤 모든 CloudFront 지점에 퍼지기까지 1분 남짓 걸린다.
 */
import { execFileSync } from "node:child_process"
import { createHash, randomUUID, sign } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import path from "node:path"
import { parseArgs } from "node:util"

const BUCKET = "raota-ota-787262016445"
const REGION = "ap-northeast-2"
const CDN = "https://dhqibujigcqbq.cloudfront.net"
const KVS_ARN = "arn:aws:cloudfront::787262016445:key-value-store/4060ec80-e7fd-4659-8dfb-37e456c8bebc"
const PRIVATE_KEY = process.env.RAOTA_OTA_PRIVATE_KEY ?? path.join(homedir(), ".raota-ota/keys/private-key.pem")
// app.json updates.codeSigningMetadata.keyid와 같아야 한다
const KEY_ID = "main"
const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", otf: "font/otf", ttf: "font/ttf", json: "application/json" }

const { values } = parseArgs({
  options: {
    message: { type: "string" },
    rollback: { type: "boolean", default: false },
    channel: { type: "string", default: "production" },
    platform: { type: "string", default: "ios" },
  },
})
const { channel, platform } = values
if ((!values.message && !values.rollback) || !["ios", "android"].includes(platform)) {
  console.error('사용법: pnpm ota --message "이번 업데이트에서 바뀐 것"  |  pnpm ota --rollback')
  process.exit(1)
}
const projectRoot = path.resolve(import.meta.dirname, "..")
const privateKey = readFileSync(PRIVATE_KEY, "utf8")

const run = (command, args, options = {}) =>
  execFileSync(command, args, { cwd: projectRoot, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], maxBuffer: 64 * 1024 * 1024, ...options })
const aws = (...args) => run("aws", [...args, "--region", REGION, "--output", "json"])
const sha256 = (data) => createHash("sha256").update(data).digest("base64url")
const md5 = (data) => createHash("md5").update(data).digest("hex")

const runtime = JSON.parse(run("npx", ["expo-updates", "fingerprint:generate", "--platform", platform])).hash
const prefix = `${channel}/${platform}/${runtime}`

/** 서명한 매니페스트(또는 지시)를 multipart 응답으로 올리고, KeyValueStore가 그것을 가리키게 한다 */
function publish(part, body, record) {
  const json = JSON.stringify(body)
  const signature = sign("sha256", Buffer.from(json), privateKey).toString("base64")
  const boundary = `raota-${randomUUID()}`
  const parts = [
    ["content-type: application/json; charset=utf-8", `content-disposition: form-data; name="${part}"`, `expo-signature: sig="${signature}", keyid="${KEY_ID}"`, "", json],
    ["content-type: application/json", 'content-disposition: form-data; name="extensions"', "", JSON.stringify({ assetRequestHeaders: {} })],
  ]
  const multipart = parts.map((lines) => `--${boundary}\r\n${lines.join("\r\n")}\r\n`).join("") + `--${boundary}--\r\n`
  const dir = mkdtempSync(path.join(tmpdir(), "raota-ota-"))
  try {
    writeFileSync(path.join(dir, "response"), multipart)
    writeFileSync(path.join(dir, "record"), JSON.stringify({ ...record, part, body }))
    aws("s3api", "put-object", "--bucket", BUCKET, "--key", `manifests/${prefix}/${record.id}.multipart`, "--body", path.join(dir, "response"),
      "--content-type", `multipart/mixed; boundary=${boundary}`, "--cache-control", "private, max-age=0")
    aws("s3api", "put-object", "--bucket", BUCKET, "--key", `manifests/${prefix}/${record.id}.json`, "--body", path.join(dir, "record"),
      "--content-type", "application/json")
    const etag = JSON.parse(aws("cloudfront-keyvaluestore", "describe-key-value-store", "--kvs-arn", KVS_ARN)).ETag
    aws("cloudfront-keyvaluestore", "put-key", "--kvs-arn", KVS_ARN, "--if-match", etag, "--key", prefix, "--value", `${prefix}/${record.id}.multipart`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** 이 런타임에 낸 배포 기록(오래된 순) */
function history() {
  const listed = JSON.parse(aws("s3api", "list-objects-v2", "--bucket", BUCKET, "--prefix", `manifests/${prefix}/`) || "{}")
  return (listed.Contents ?? [])
    .filter((object) => object.Key.endsWith(".json"))
    .map((object) => JSON.parse(run("aws", ["s3", "cp", `s3://${BUCKET}/${object.Key}`, "-", "--region", REGION])))
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))
}

/**
 * 출시 번들의 Lingui 매크로는 원문을 빼고 메시지 ID만 남긴다. 새 문구가 카탈로그에 컴파일되지 않았으면 화면에 문구 대신 ID(예: vjfGik)가 보인다.
 * 추출·컴파일을 돌려 카탈로그가 바뀌면 멈춘다(바뀐 파일은 남겨 둔다: 번역을 채우고 커밋한 뒤 다시 보낸다)
 */
function assertCatalogsCompiled() {
  const repoRoot = path.resolve(projectRoot, "../..")
  const locales = "packages/shared/src/i18n/locales"
  const snapshot = () => run("git", ["-C", repoRoot, "status", "--porcelain", "--", locales]) + run("git", ["-C", repoRoot, "diff", "--", locales])
  const before = snapshot()
  for (const script of ["i18n:extract", "i18n:compile"]) run("pnpm", ["-C", repoRoot, script], { stdio: ["ignore", "ignore", "inherit"] })
  if (snapshot() !== before) {
    console.error("번역 카탈로그에 없는 문구가 있어요. locales/*/messages.po를 번역하고 pnpm i18n:compile 후 커밋한 다음 다시 보내 주세요.")
    process.exit(1)
  }
}

function release() {
  const dist = mkdtempSync(path.join(tmpdir(), "raota-ota-dist-"))
  try {
    assertCatalogsCompiled()
    run("npx", ["expo", "export", "--platform", platform, "--output-dir", dist], { stdio: ["ignore", "ignore", "inherit"] })
    const files = JSON.parse(readFileSync(path.join(dist, "metadata.json"), "utf8")).fileMetadata[platform]
    // 파일은 내용(md5) 주소라 한 번 올린 것은 다시 올리지 않는다. 명세상 한 번 낸 주소의 파일은 바뀌거나 사라지면 안 된다
    const upload = (file, contentType) => {
      const data = readFileSync(path.join(dist, file))
      const key = md5(data)
      try {
        aws("s3api", "head-object", "--bucket", BUCKET, "--key", `assets/${key}`)
      } catch {
        aws("s3api", "put-object", "--bucket", BUCKET, "--key", `assets/${key}`, "--body", path.join(dist, file),
          "--content-type", contentType, "--cache-control", "public, max-age=31536000, immutable")
      }
      return { hash: sha256(data), key, contentType, url: `${CDN}/assets/${key}` }
    }
    const launchAsset = upload(files.bundle, "application/javascript")
    const assets = files.assets.map(({ path: file, ext }) => ({ ...upload(file, MIME[ext] ?? "application/octet-stream"), fileExtension: `.${ext}` }))
    const expoClient = JSON.parse(run("npx", ["expo", "config", "--type", "public", "--json"]))
    const id = randomUUID()
    const createdAt = new Date().toISOString()
    const manifest = { id, createdAt, runtimeVersion: runtime, launchAsset, assets, metadata: {}, extra: { expoClient } }
    const commit = run("git", ["rev-parse", "--short", "HEAD"]).trim()
    publish("manifest", manifest, { id, contentId: id, publishedAt: createdAt, message: values.message, commit })
    console.log(`보냄: ${values.message}\n업데이트 ${id}, 파일 ${assets.length + 1}개, 커밋 ${commit}`)
  } finally {
    rmSync(dist, { recursive: true, force: true })
  }
}

function rollback() {
  const updates = history()
  const current = updates.at(-1)
  if (!current || current.part === "directive") {
    console.error(current ? "이미 앱에 들어 있는 JS로 되돌렸어요." : `런타임 ${runtime}에 낸 업데이트가 없어요. 되돌릴 것이 없습니다.`)
    process.exit(1)
  }
  // 처음 낸 순서(되돌림 제외)에서 지금 내용 바로 전 배포로 간다. 그래서 거듭 되돌리면 한 칸씩 뒤로 간다
  const releases = updates.filter((update) => update.part === "manifest" && !update.rollbackOf)
  const previous = releases[releases.findIndex((update) => update.id === current.contentId) - 1]
  const id = randomUUID()
  const publishedAt = new Date().toISOString()
  if (previous) {
    // 앱은 받은 것 중 createdAt이 가장 늦은 업데이트를 쓴다. 옛 매니페스트를 그대로 가리키면 이미 받은 새 것을 계속 쓰므로 새 id·시각으로 다시 낸다
    publish("manifest", { ...previous.body, id, createdAt: publishedAt },
      { id, contentId: previous.id, publishedAt, message: `되돌림: ${previous.message}`, commit: previous.commit, rollbackOf: current.id })
    console.log(`되돌림: ${current.message} → ${previous.message} (커밋 ${previous.commit})`)
  } else {
    publish("directive", { type: "rollBackToEmbedded", parameters: { commitTime: publishedAt } },
      { id, contentId: null, publishedAt, message: "앱에 들어 있는 JS로 되돌림", rollbackOf: current.id })
    console.log("되돌림: 앱에 들어 있는 JS로")
  }
}

if (values.rollback) rollback()
else release()
console.log(`런타임 ${runtime} · ${channel} · ${platform}. 1분 남짓 뒤부터 앱이 받습니다.`)
