# Dock Notes · Android MVP

노트앱의 자유로움을 유지하면서 반복 작업만 줄이는 개인용 Dock 점검 기록장.

**다음 점검 → 이전 기록 복사 → 달라진 부분 수정 → 저장 후 엑셀 작업 시 참고**

- Android 8 이상. 오프라인, 계정·서버·인터넷 권한 없음.
- Dock 1~20 오름차순. 제목은 설정에서만 수정.
- 새 컨테이너는 전체 강조, 같은 컨테이너의 변경은 해당 항목만 강조.
- 평일 07:30 / 09:30 / 11:30 / 13:30 / 15:30 기본값. 시간·요일·구역 변경 가능.
- 새 점검은 현재 시각 이후의 다음 예정 시간으로 시작합니다. 예: 07:40 → 09:30. 작성 중 기록은 그대로 이어집니다.
- 설정 → 언어 설정에서 한국어 / English 선택. 입력한 기록과 구역 제목은 그대로 유지.
- 자동 임시 저장, 이력, 텍스트 복사·내보내기, JSON 백업·복원.
- 아이템 코드 최대 3개. 엑셀/WMS 자동 연동 없음.
- Ready to drop에서 컨테이너 번호나 코드를 입력하면 Full로 자동 전환. 입력과 상태 전환을 한 번에 되돌릴 수 있습니다.
- 모든 Dock에서 코드 먼저, 번호 나중에 입력 가능. 번호 변경은 입력 내용을 유지하며, 내용 초기화는 확인 후 실행.
- 0.3.4부터 고정 키로 서명한 배포용 APK를 제공합니다. 이후 같은 키의 새 버전은 기록을 유지하며 업데이트할 수 있습니다.

[APK Releases](https://github.com/Primi68/Dock-management-AUS/releases) · [제품 명세](docs/SPEC.md) · [설치 안내](docs/INSTALL.md) · [개발 이어가기](docs/DEVELOPMENT.md) · [데이터 원칙](docs/PRIVACY.md) · [검증](docs/VERIFICATION.md)

비공개 저장소 접근 계정으로 로그인하여 APK를 받으세요. 실제 현장 번호·업무 기록·사진은 이 저장소에 포함하지 않습니다.

```sh
npm ci
npm test
npx playwright install chromium
npm run test:ui
./gradlew :app:assembleDebug :app:lintDebug
```

JDK 17 / SDK 35 / Gradle 8.11.1. 앱에 포함된 HTML/CSS/JS와 Android Java 호스트로 동작하며 외부 웹사이트에 접속하지 않습니다.
