#!/bin/bash
# 개인(무료) 팀으로 실기기 개발 빌드를 설치한다. 무료 서명은 7일마다 만료되니 그때 다시 돌린다.
#   UDID=<기기 UDID> apps/mobile/scripts/phone-build.sh
# - 개인 팀은 푸시 권한을 못 쓰므로 빌드할 때만 빈 entitlements로 덮는다(추적 파일은 그대로).
# - ip.txt에 Mac IP 대신 네트워크 이름(.local)을 넣어, 와이파이가 바뀌어도 다시 빌드하지 않게 한다.
#   폰과 Mac은 같은 와이파이여야 하고, 기기끼리 통신을 막는 네트워크에서는 안 된다.
set -euo pipefail
UDID=${UDID:-00008140-001A309114DB001C}
IOS_DIR="$(cd "$(dirname "$0")/../ios" && pwd)"
APP="$IOS_DIR/build/device/Build/Products/Debug-iphoneos/RAOTA.app"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

cat > "$WORK/personal.entitlements" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict/></plist>
PLIST

cd "$IOS_DIR"
xcodebuild -workspace RAOTA.xcworkspace -scheme RAOTA -configuration Debug -destination "id=$UDID" \
  -derivedDataPath build/device -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
  CODE_SIGN_ENTITLEMENTS="$WORK/personal.entitlements" build | grep -E "error:|BUILD (SUCCEEDED|FAILED)"

# ip.txt를 바꾸면 서명이 깨지므로 같은 인증서와 권한으로 앱 묶음만 다시 서명한다
printf "%s.local\n" "$(scutil --get LocalHostName)" > "$APP/ip.txt"
codesign -d --entitlements :- "$APP" > "$WORK/app.entitlements" 2>/dev/null
IDENTITY=$(codesign -dvv "$APP" 2>&1 | sed -n 's/^Authority=\(Apple Development.*\)$/\1/p' | head -n 1)
codesign --force --sign "$IDENTITY" --entitlements "$WORK/app.entitlements" --generate-entitlement-der "$APP"

xcrun devicectl device install app --device "$UDID" "$APP"
xcrun devicectl device process launch --device "$UDID" com.raota.app
