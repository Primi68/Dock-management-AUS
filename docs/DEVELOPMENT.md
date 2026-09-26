# 회사 PC 등에서 개발 이어가기

회사 장비의 개발 도구 설치 및 업무 자료 취급 규칙에 맞춰 접근 가능한 GitHub 계정으로 저장소를 복제합니다. 실제 휴대전화 기록은 저장소에 없습니다.

```sh
git clone https://github.com/Primi68/Dock-management-AUS.git
cd Dock-management-AUS
npm ci
npm test
npx playwright install chromium
npm run test:ui
gradle :app:assembleDebug :app:lintDebug
```

JDK 17 / Android SDK Platform 35 및 Build Tools 35.0.0 / Gradle 8.11.1 / Node 22 사용. [AGP 8.9 공식 호환성](https://developer.android.com/build/releases/agp-8-9-0-release-notes)에 맞춰 AGP 8.9.2를 고정했습니다. Android Studio에서 프로젝트를 열고 SDK 위치를 설정하거나 ANDROID_HOME을 설정합니다. PC별 local.properties는 커밋하지 않습니다.

결과 APK: `app/build/outputs/apk/debug/app-debug.apk`. `npm run preview`는 PC 브라우저 확인용이며 Android 파일 선택기는 기기 검증이 필요합니다. 브라우저 미리보기는 브라우저 로컬 저장소를 사용합니다.

- assets/core.js: 순수 업무 규칙, 날짜, 차이, 백업 검증.
- assets/app.js 및 style.css: 입력·조회·설정 화면.
- MainActivity.java: 오프라인 WebView, 원자적 저장, Android 클립보드/파일 선택기.
- tests: 업무 로직 및 모바일 크기 브라우저 테스트.
- .github/workflows/android.yml: 테스트, lint, APK 빌드와 버전 태그 기반 미리보기 릴리스.

업데이트에는 versionCode 증가와 백업 스키마 호환성 유지가 필요합니다. 실제 자료를 테스트 fixture로 쓰지 않습니다. 장기 배포 전 서명 키를 안전하게 관리해야 하며 서명 변경 시 백업·복원 절차를 지킵니다. 현재는 개발용 미리보기 서명입니다.
