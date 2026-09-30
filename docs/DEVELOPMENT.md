# 회사 PC 등에서 개발 이어가기

회사 장비의 개발 도구 설치 및 업무 자료 취급 규칙에 맞춰 접근 가능한 GitHub 계정으로 저장소를 복제합니다. 실제 휴대전화 기록은 저장소에 없습니다.

```sh
git clone https://github.com/Primi68/Dock-management-AUS.git
cd Dock-management-AUS
npm ci
npm test
npx playwright install chromium
npm run test:ui
./gradlew :app:assembleDebug :app:lintDebug
```

JDK 17 / Android SDK Platform 35 및 Build Tools 35.0.0 / Gradle 8.11.1 / Node 22 사용. Gradle은 공식 체크섬을 고정한 Wrapper로 다운로드됩니다. Windows PowerShell에서는 `./gradlew.bat :app:assembleDebug :app:lintDebug`를 사용하세요. [AGP 8.9 공식 호환성](https://developer.android.com/build/releases/agp-8-9-0-release-notes)에 맞춰 AGP 8.9.2를 고정했습니다. Android Studio에서 프로젝트를 열고 SDK 위치를 설정하거나 ANDROID_HOME을 설정합니다. PC별 local.properties는 커밋하지 않습니다.

결과 APK: `app/build/outputs/apk/debug/app-debug.apk`. `npm run preview`는 PC 브라우저 확인용이며 Android 파일 선택기는 기기 검증이 필요합니다. 브라우저 미리보기는 브라우저 로컬 저장소를 사용합니다.

- assets/i18n.js: 한국어 원문을 키로 하는 영어 UI 사전과 매개변수 치환. 사용자 입력은 번역 함수에 전달하지 않습니다.
- assets/core.js: 순수 업무 규칙, 날짜, 차이, 백업 검증.
- assets/app.js 및 style.css: 입력·조회·설정 화면.
- MainActivity.java: 오프라인 WebView, 원자적 저장, Android 클립보드/파일 선택기.
- tests: 업무 로직 및 모바일 크기 브라우저 테스트.
- .github/workflows/android.yml: 일반 코드 push는 업무 규칙과 화면 검증만 실행. 최종 버전 태그에서 Android lint·에뮬레이터 검증·APK 빌드 후 미리보기 릴리스.

작업 단위가 완료될 때마다 코드를 commit/push합니다. 설명 문서는 요청된 수정과 최종 검증을 마친 시점에 함께 갱신하고, APK도 최종 버전으로 한 번만 빌드·배포합니다. 중간 코드 push마다 APK를 재배포하지 않습니다.

업데이트에는 versionCode 증가와 백업 스키마 호환성 유지가 필요합니다. 실제 자료를 테스트 fixture로 쓰지 않습니다. 0.3.4부터 GitHub 미리보기도 고정된 키의 release APK입니다. debug APK는 개발 확인용이며 배포하지 않습니다. 서명 키가 없을 때 임시 키를 생성하거나 debug APK로 대신 배포하지 않습니다.

## 고정 서명

GitHub Actions 저장소 비밀 설정 `DOCK_RELEASE_KEYSTORE_BASE64`와 `DOCK_RELEASE_KEYSTORE_PASSWORD`에 기존 키를 보관합니다. CI는 제한된 임시 파일로 복원하고 작업 종료 시 삭제합니다. 키와 비밀번호는 소스·로그·릴리스 첨부에 넣지 않습니다. 저장소에는 공개 정보인 `.github/release-certificate.sha256`만 두고 APK의 인증서 지문이 일치해야 배포합니다. 지문 오류를 피하려고 새 키를 생성하거나 기준 지문을 바꾸면 안 됩니다.

로컬 배포 빌드는 기존 키의 경로를 `DOCK_RELEASE_STORE_FILE`, 비밀번호를 `DOCK_RELEASE_STORE_PASSWORD` 환경 변수에 설정한 뒤 `./gradlew :app:assembleRelease :app:lintRelease`로 실행합니다. alias는 `dock-notes`이며 PKCS12 저장소와 키의 비밀번호가 같습니다. 비밀번호를 명령 인수·기록·프로젝트 파일에 직접 적지 않습니다. Android 테스트는 `-PdockTestBuildType=release :app:connectedReleaseAndroidTest`로 배포용 빌드에도 실행할 수 있습니다.

회사 또는 다른 GitHub 저장소로 옮길 때도 같은 키·비밀번호를 새 저장소의 비밀 설정으로 복사하고 applicationId를 유지합니다. GitHub 비밀 설정 값은 다시 읽는 용도의 백업이 아니므로 원본 키와 비밀번호를 별도로 안전하게 보관해야 합니다. 이 PC의 비밀번호 로컬 사본은 Windows DPAPI로 보호되어 다른 PC에서 파일만 복사해서는 해독할 수 없습니다. PC를 교체하기 전에 같은 Windows 계정에서 복구해 비밀번호 관리자 등에 옮기고, 암호화된 키 파일도 별도 보관하세요. 키를 잃어버렸다고 자동 재생성하지 않습니다.

기술 근거: [Android 앱 서명](https://developer.android.com/studio/publish/app-signing), [GitHub Actions 비밀 설정](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets).
