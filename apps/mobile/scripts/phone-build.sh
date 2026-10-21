#!/bin/bash
# 유료 팀(X72682FG29)으로 실기기 개발 빌드를 설치한다.
#   UDID=<기기 UDID> apps/mobile/scripts/phone-build.sh
# - Sign in with Apple·푸시 권한은 prebuild가 만든 entitlements 그대로 서명한다(예전 개인 팀용 빈 entitlements 덮어쓰기는 없앴다).
# - ip.txt에 Mac IP 대신 네트워크 이름(.local)을 넣어, 와이파이가 바뀌어도 다시 빌드하지 않게 한다.
#   폰과 Mac은 같은 와이파이여야 하고, 기기끼리 통신을 막는 네트워크에서는 안 된다.
set -euo pipefail
UDID=${UDID:-00008140-001A309114DB001C}
TEAM_ID=X72682FG29
IOS_DIR="$(cd "$(dirname "$0")/../ios" && pwd)"
APP="$IOS_DIR/build/device/Build/Products/Debug-iphoneos/RAOTA.app"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

cd "$IOS_DIR"
xcodebuild -workspace RAOTA.xcworkspace -scheme RAOTA -configuration Debug -destination "id=$UDID" \
  -derivedDataPath build/device -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
  DEVELOPMENT_TEAM="$TEAM_ID" build | grep -E "error:|BUILD (SUCCEEDED|FAILED)"

# ip.txt를 바꾸면 서명이 깨지므로 같은 인증서와 권한으로 앱 묶음만 다시 서명한다
printf "%s.local\n" "$(scutil --get LocalHostName)" > "$APP/ip.txt"
codesign -d --entitlements :- "$APP" > "$WORK/app.entitlements" 2>/dev/null
IDENTITY=$(codesign -dvv "$APP" 2>&1 | sed -n 's/^Authority=\(Apple Development.*\)$/\1/p' | head -n 1)
codesign --force --sign "$IDENTITY" --entitlements "$WORK/app.entitlements" --generate-entitlement-der "$APP"

xcrun devicectl device install app --device "$UDID" "$APP"
xcrun devicectl device process launch --device "$UDID" com.raota.app
