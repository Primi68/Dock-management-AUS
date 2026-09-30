#!/usr/bin/env bash
set -euo pipefail
apk="$1"
expected="$(tr -d '\r\n ' < .github/release-certificate.sha256)"
actual="$("$ANDROID_HOME/build-tools/35.0.0/apksigner" verify --print-certs "$apk" | sed -n 's/^Signer #1 certificate SHA-256 digest: //p')"
if [[ "$actual" != "$expected" ]]; then
  echo 'APK signing certificate does not match the pinned release identity.' >&2
  exit 1
fi
echo "Verified fixed release signing certificate: $actual"
