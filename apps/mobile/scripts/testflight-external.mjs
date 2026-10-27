#!/usr/bin/env node
/**
 * 업로드한 빌드를 TestFlight 테스터에게 보낸다(App Store Connect API).
 *
 *   node scripts/testflight-external.mjs --build 8 --notes "이번 빌드에서 바뀐 것"
 *
 * 1. 그 빌드 번호가 처리 완료(VALID)될 때까지 기다린다(최대 60분)
 * 2. "테스트할 내용"(한국어)을 적는다. 이미 있으면 바꾼다
 * 3. 자동 배포가 꺼진 내부 그룹과 모든 외부 그룹에 넣는다
 * 4. 외부 베타 심사에 제출한다. 통과하면 외부 테스터에게 메일이 간다
 * 이미 된 단계는 건너뛰므로 같은 빌드에 다시 돌려도 된다.
 *
 * 키: ~/.appstoreconnect/raota.json 의 {"keyId","issuerId"}와
 * ~/.appstoreconnect/private_keys/AuthKey_{keyId}.p8. 키 파일은 저장소에 두지 않는다.
 */
import { sign } from "node:crypto"
import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { parseArgs } from "node:util"

const BUNDLE_ID = "com.raota.app"
const API = "https://api.appstoreconnect.apple.com"

const { values } = parseArgs({ options: { build: { type: "string" }, notes: { type: "string" } } })
if (!values.build || !values.notes) {
  console.error('사용법: node scripts/testflight-external.mjs --build 8 --notes "이번 빌드에서 바뀐 것"')
  process.exit(1)
}

const config = JSON.parse(readFileSync(`${homedir()}/.appstoreconnect/raota.json`, "utf8"))
const privateKey = readFileSync(`${homedir()}/.appstoreconnect/private_keys/AuthKey_${config.keyId}.p8`)

function token() {
  const part = (value) => Buffer.from(JSON.stringify(value)).toString("base64url")
  const now = Math.floor(Date.now() / 1000)
  const unsigned = `${part({ alg: "ES256", kid: config.keyId, typ: "JWT" })}.${part({ iss: config.issuerId, iat: now, exp: now + 15 * 60, aud: "appstoreconnect-v1" })}`
  // JWT의 ES256 서명은 DER가 아니라 r‖s 64바이트다
  return `${unsigned}.${sign("sha256", Buffer.from(unsigned), { key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url")}`
}

async function api(path, init = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
  })
  const text = await response.text()
  const body = text ? JSON.parse(text) : null
  if (!response.ok) {
    const detail = body?.errors?.map((error) => `${error.code}: ${error.detail}`).join("; ") ?? text
    throw new Error(`${init.method ?? "GET"} ${path} → ${response.status} ${detail}`)
  }
  return body
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const app = (await api(`/v1/apps?filter[bundleId]=${BUNDLE_ID}`)).data[0]
if (!app) throw new Error(`${BUNDLE_ID} 앱을 찾지 못했어요`)

// 1) 처리 완료 대기
let build
for (let waited = 0; ; waited += 30) {
  build = (await api(`/v1/builds?filter[app]=${app.id}&filter[version]=${values.build}&fields[builds]=version,processingState`)).data[0]
  const state = build?.attributes.processingState
  if (state === "VALID") break
  if (state === "FAILED" || state === "INVALID") throw new Error(`빌드 ${values.build} 처리 실패: ${state}`)
  if (waited >= 60 * 60) throw new Error(`빌드 ${values.build}이 60분 안에 처리되지 않았어요(${state ?? "아직 안 보임"})`)
  console.log(`빌드 ${values.build} 처리 대기 중… (${state ?? "아직 안 보임"})`)
  await sleep(30_000)
}
console.log(`✓ 빌드 ${values.build} 처리 완료`)

// 2) 테스트할 내용
const localization = (await api(`/v1/builds/${build.id}/betaBuildLocalizations`)).data.find((item) => item.attributes.locale === "ko")
if (localization) {
  await api(`/v1/betaBuildLocalizations/${localization.id}`, {
    method: "PATCH",
    body: JSON.stringify({ data: { type: "betaBuildLocalizations", id: localization.id, attributes: { whatsNew: values.notes } } }),
  })
} else {
  await api(`/v1/betaBuildLocalizations`, {
    method: "POST",
    body: JSON.stringify({ data: { type: "betaBuildLocalizations", attributes: { locale: "ko", whatsNew: values.notes }, relationships: { build: { data: { type: "builds", id: build.id } } } } }),
  })
}
console.log("✓ 테스트할 내용")

// 3) 그룹에 넣기. 자동 배포(hasAccessToAllBuilds)가 켜진 내부 그룹은 이미 받는다
const groups = (await api(`/v1/apps/${app.id}/betaGroups?limit=200`)).data
for (const group of groups) {
  if (group.attributes.isInternalGroup && group.attributes.hasAccessToAllBuilds) {
    console.log(`✓ 내부 "${group.attributes.name}": 자동 배포로 받음`)
    continue
  }
  const has = (await api(`/v1/betaGroups/${group.id}/builds?limit=200&fields[builds]=version`)).data.some((item) => item.id === build.id)
  if (!has) {
    await api(`/v1/betaGroups/${group.id}/relationships/builds`, { method: "POST", body: JSON.stringify({ data: [{ type: "builds", id: build.id }] }) })
  }
  console.log(`✓ ${group.attributes.isInternalGroup ? "내부" : "외부"} "${group.attributes.name}"에 추가`)
}

// 4) 외부 베타 심사 제출(아직 제출 전일 때만)
const beta = (await api(`/v1/builds/${build.id}/buildBetaDetail`)).data.attributes
if (beta.externalBuildState === "READY_FOR_BETA_SUBMISSION") {
  await api(`/v1/betaAppReviewSubmissions`, {
    method: "POST",
    body: JSON.stringify({ data: { type: "betaAppReviewSubmissions", relationships: { build: { data: { type: "builds", id: build.id } } } } }),
  })
}
const after = (await api(`/v1/builds/${build.id}/buildBetaDetail`)).data.attributes
console.log(`✓ 외부 상태: ${after.externalBuildState} (내부: ${after.internalBuildState})`)
