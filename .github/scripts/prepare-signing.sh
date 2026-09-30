#!/usr/bin/env bash
set -euo pipefail
: "${DOCK_RELEASE_KEYSTORE_BASE64:?Missing fixed signing key}"
: "${DOCK_RELEASE_STORE_PASSWORD:?Missing signing password}"
umask 077
signing_dir="$(mktemp -d "$RUNNER_TEMP/dock-signing.XXXXXX")"
printf '%s' "$DOCK_RELEASE_KEYSTORE_BASE64" | base64 --decode > "$signing_dir/release.keystore"
echo "DOCK_RELEASE_STORE_FILE=$signing_dir/release.keystore" >> "$GITHUB_ENV"
