#!/usr/bin/env bash
set -euo pipefail
./gradlew --no-daemon -PdockTestBuildType=release :app:connectedReleaseAndroidTest
bash .github/scripts/verify-signature.sh app/build/outputs/apk/release/app-release.apk
bash .github/scripts/verify-signature.sh dist/Dock-Notes-0.3.4-preview.apk
adb install -r app/build/outputs/apk/release/app-release.apk
adb install -r app/build/outputs/apk/androidTest/release/app-release-androidTest.apk
instrument() {
  local output
  output="$(adb shell am instrument -w -r -e class "$1" -e upgradePhase "$2" com.primi.docknotes.test/androidx.test.runner.AndroidJUnitRunner)"
  printf '%s\n' "$output"
  grep -q 'OK (1 test)' <<< "$output"
}
instrument 'com.primi.docknotes.OfflineSmokeTest#offlineBridgePersistsAndSurvivesActivityRecreation' seed
instrument 'com.primi.docknotes.SignedUpdateTest#checkpointBeforeUpdate' before
# This APK was independently built on the build job's fresh runner.
adb install -r dist/Dock-Notes-0.3.4-preview.apk
instrument 'com.primi.docknotes.SignedUpdateTest#installedUpdatePreservesData' after
