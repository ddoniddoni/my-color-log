# 베타 빌드와 실기기 검증

관련 요구사항: PRD §19 오프라인 및 동기화, §21 접근성, §26 품질 수용 기준과 FR-AUTH-005, FR-NOTIFY-001.

EAS 프로젝트는 [@ddoni/mycolorlog](https://expo.dev/accounts/ddoni/projects/mycolorlog)다. `app.json`에 공개 프로젝트 ID와 소유자를 연결하고, `app.config.ts`가 빌드별 네이티브 이름·식별자·딥링크를 결정한다. DB migration과 RLS는 변경하지 않는다.

네이티브 빌드 준비 중 Expo Doctor가 기존 Hermes 메모리 회귀를 검출해 같은 SDK 57 안에서 Expo `57.0.6 → 57.0.30`, React Native `0.86.0 → 0.86.3`, Hermes `250829098.0.14 → 250829098.0.17`과 Expo 호환 패키지를 정렬했다. Jest 프리셋도 RN 버전에 맞추고 Jest 타입은 실제 Jest 29에 맞췄다. `package-lock.json` 변경은 이 호환성 정렬과 전이 의존성 교체에 따른 것이며 Supabase·TanStack Query·Skia 버전은 유지한다. [Expo SDK 57 수정 내역](https://expo.dev/changelog/sdk-57#known-regressions)을 근거로 했다.

## 빌드 구분

| 프로필 | 앱 이름 | iOS / Android 식별자 | 딥링크 scheme | 설치 방식 |
| --- | --- | --- | --- | --- |
| development | Color Log Dev | com.ddoni.mycolorlog.dev | mycolorlog-dev | 개발 클라이언트, Metro 필요 |
| preview | Color Log Beta | com.ddoni.mycolorlog.preview | mycolorlog-preview | Android APK / 등록된 iPhone의 ad hoc 빌드 |
| preview-simulator | Color Log Beta | com.ddoni.mycolorlog.preview | mycolorlog-preview | Mac의 iOS Simulator 전용 |
| production | Color Log | com.ddoni.mycolorlog | mycolorlog | TestFlight / 스토어 배포용 |

개발·베타·출시 앱은 함께 설치할 수 있다. 기기 내 파일과 큐는 별도 앱에 보관하지만, 같은 Supabase 서버에 같은 계정으로 로그인하면 서버 기록은 공유된다. 베타 검증에는 별도 테스트 계정을 사용한다. 기존 앱에서 베타 앱으로 로컬 업로드 대기 사진을 옮기지 않는다.

`APP_VARIANT`를 생략하면 기존 출시 식별자를 유지한다. EAS 각 프로필은 이를 명시한다. 네이티브 앱 설정에서 scheme을 읽어 복구 링크 생성과 수신에 같이 사용하므로, 로컬 `.env`의 오래된 scheme이 베타 앱을 출시 앱으로 보내지 않는다. Expo Push Token의 프로젝트 ID도 연결된 네이티브 EAS 설정을 우선한다.

## 서버 설정과 업로드 범위

EAS 프로젝트의 **Environment variables**에서 각 environment에 다음 두 공개 값을 설정한다.

- `EXPO_PUBLIC_SUPABASE_URL`: HTTPS 프로젝트 URL
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: publishable key 또는 legacy anon key

`development` / `preview` / `production`은 각각 해당 이름의 EAS environment를 사용한다. `preview-simulator`는 `preview`를 사용한다. 사용자 선택에 따라 현재 로컬 앱의 공개 서버 설정 두 값을 `preview`에 등록했다. 이는 별도 테스트 DB를 생성한 것이 아니다. EAS development 빌드 전에 development 환경을, 출시 서버가 확정되면 production 환경을 별도로 설정한다. 로컬 `start:dev`는 기존 `.env`를 사용한다.

`.easignore`는 로컬 `.env*`, 인증서, 서명 정보, Supabase 서버 소스와 로컬 도구 자료를 업로드에서 제외한다. 로컬 `.env` 전체를 EAS에 업로드하지 않는다. `eas-build-post-install`은 공개 서버 값 누락과 service-role/secret key 오입력을 검출하고 네이티브 빌드 전에 중단한다. 검증 실패 메시지에 값은 출력하지 않는다. `EXPO_PUBLIC_` 값은 앱에서 읽을 수 있으므로 서버 비밀을 넣을 수 없다.

서명 키는 EAS credentials에 보관한다. 로컬 `credentials.json`과 인증서를 커밋하지 않는다. FCM/APNs 설정은 빌드 서명과 별개다. Android 친구방 원격 푸시에는 해당 variant 식별자로 등록한 Firebase 설정과 FCM V1 자격 증명이, iOS에는 APNs 설정이 필요하다. 현재 앱에는 Firebase 설정 파일을 추가하지 않았다.

## 빌드와 설치

명령은 npm을 사용하며 EAS CLI는 `25.2.0`으로 고정했다.

```sh
# Android 기기와 에뮬레이터에 직접 설치할 APK
npm run build:preview:android

# Apple Developer 유료 계정과 EAS에 등록한 테스트 iPhone 필요
npx --yes eas-cli@25.2.0 device:create
npm run build:preview:ios

# Apple Developer 가입 없이 생성 가능. 실제 iPhone에는 설치할 수 없음
npm run build:preview:simulator

# development environment를 설정한 뒤 개발 클라이언트 생성
npx --yes eas-cli@25.2.0 build --profile development --platform android

# 설치된 개발 클라이언트용 Metro
npm run start:dev

# 출시 서버·서명·심사 준비 이후 실행. 스토어 자동 제출은 하지 않음
npm run build:production
```

빌드 완료 후 EAS 빌드 상세 페이지의 설치 링크를 사용한다. preview 앱은 Metro 없이 실행된다. iPhone ad hoc 빌드는 프로비저닝에 포함된 기기만 설치할 수 있다. 새 iPhone 추가 후에는 해당 기기를 포함해 다시 빌드하거나 resign한다. 외부 테스터의 TestFlight 배포는 production 빌드와 App Store Connect 제출 과정이 별도로 필요하다.

`version`은 `app.json`에서 관리한다. iOS build number와 Android version code는 EAS remote version을 사용하며 preview·production 빌드마다 증가한다. 재빌드로 번호가 건너뛰어도 정상이다. 시뮬레이터 빌드는 증가시키지 않는다.

## 생성한 Android 베타와 설치 확인

2026-10-19에 `preview` 프로필의 네이티브 빌드가 완료됐다. Android 기기에서 [빌드 상세·설치 페이지](https://expo.dev/accounts/ddoni/projects/mycolorlog/builds/19911ad1-ccc2-4b31-8adf-89d783577465)를 열어 APK를 설치한다.

- 앱: **Color Log Beta 1.0.0 (versionCode 3)**
- 패키지: `com.ddoni.mycolorlog.preview`
- 서버: 기존 `.env`와 같은 Supabase, 별도 테스트 계정 사용
- APK 크기: 188,776,689 bytes
- APK SHA-256: `d21aeb27ad3874dc145f01abdd1ec49031195a0aae599fb50303482298d6bca4`

Pixel 9 에뮬레이터(Android 17 / API 37)에 APK를 설치하고 Metro 없이 실행했다. 온보딩 3단계와 로그인 화면, 실행 중·완전 종료 상태에서 베타 복구 링크 열기, 만료 안내 후 로그인 복귀를 확인했다. 복구 링크는 토큰 없는 `error_code=otp_expired` 테스트 입력이므로 실제 이메일 발송·유효 토큰 교환·비밀번호 변경을 검증한 것은 아니다. 테스트 계정 로그인과 촬영 검증은 수행하지 않았다.

첫 빌드는 archive 제외 패턴이 `src/lib/supabase`까지 제거해 번들 생성에 실패했다. 루트 한정 패턴으로 수정한 뒤 위 빌드에서 정상 완료했다. 로컬 APK와 화면 캡처는 `/tmp`에 두며 저장소에는 포함하지 않는다.

## 비밀번호 재설정과 초대

실제 사용하는 Supabase 프로젝트의 Auth → URL Configuration에 설치할 variant의 주소를 허용해야 한다.

```text
mycolorlog-dev://auth/reset-password
mycolorlog-preview://auth/reset-password
mycolorlog://auth/reset-password
```

같은 서버를 쓸 때만 세 주소를 함께 등록한다. 서버를 분리하면 각 서버에는 해당 앱 주소를 등록한다. 이 저장소의 빌드 설정만으로 운영 Auth 설정이나 SMTP가 바뀌지는 않는다. 이메일 전송과 만료 링크 검증은 [비밀번호 재설정 안내](password-reset.md)를 따른다.

초대 링크는 링크를 만든 앱의 scheme을 사용한다. 베타 사용자끼리 링크를 공유한다. 서로 다른 variant를 사용한다면 같은 서버인지 확인하고 앱 안에서 6자리 초대 코드를 입력한다. 이 단계에서는 설치되지 않은 앱으로 보내는 HTTPS 설치 안내 페이지나 Universal/App Links를 추가하지 않았다.

## 실기기 QA 기록

각 결과에는 기종·OS·앱 버전/빌드 번호·서버 환경·수행 날짜를 기록한다. 아래 항목은 자동 테스트 통과와 구분하며, 실행하지 않은 항목은 완료 표시하지 않는다.

| 확인 항목 | iOS 실기기 | Android 실기기 |
| --- | --- | --- |
| 새 설치 → 가입/로그인 → 오늘 색 공개 → 첫 사진 → 앱 재실행 | 미실행 | 미실행 |
| 카메라·사진·알림 권한 최초 허용, 거부, 설정에서 재허용 | 미실행 | 미실행 |
| 오늘 미션 조회 → 비행기 모드 → 촬영 → 강제 종료 → 초안/확정 사진 복구 → 재연결 | 미실행 | 미실행 |
| 업로드 중 삭제, 재촬영, 9장 제한, 다른 기기에서 수정 후 동기화 | 미실행 | 미실행 |
| 개인/방 시간대의 자정 전후, 백그라운드 복귀, 공개 중 종료 | 미실행 | 미실행 |
| 메일 복구 링크를 종료·백그라운드·실행 상태에서 열고 새 비밀번호로 로그인 | 미실행 | 미실행 |
| 알림 예약 → 앱 종료 후 수신 → 오늘 화면, 기록 후 저녁 알림 취소 | 미실행 | 미실행 |
| 두 계정으로 방 생성·초대·사진 공유·탈퇴 후 권한 제거 | 미실행 | 미실행 |
| 작은 화면·큰 글자·화면 읽기·모션 감소 | 미실행 | 미실행 |

실기기 카메라·오프라인 복구·메일 앱·알림 검증을 모두 끝내기 전에는 출시 QA 완료로 보지 않는다. iOS 시뮬레이터 결과는 iPhone 카메라 검증을 대신하지 않는다. 마지막 사진 복구 migration의 운영 DB 적용 여부도 [통합 작업 기록](photo-data-integrity.md)과 별도로 확인한다.

## 로컬 검증 명령

```sh
npm run test:build
npm run typecheck
npm run lint
npm test -- --runInBand
APP_VARIANT=preview EXPO_NO_DOTENV=1 npx expo config --type introspect
```

EAS 업로드 목록은 `eas build:inspect --platform android --profile preview --stage archive --output /tmp/mycolorlog-beta-archive-check`로 검토한다. 제외된 디렉터리가 빈 폴더로 남을 수 있으므로 실제 파일 목록을 확인한다. 원격 빌드 결과와 설치 검증은 별도로 기록한다.

`.easignore`의 서버 제외 패턴은 반드시 `/supabase/`처럼 저장소 루트로 한정한다. `supabase/`로 쓰면 앱의 `src/lib/supabase`도 제외되어 클라우드 번들 생성이 실패한다. 업로드 검사에서는 앱의 모든 `app/`, `src/`, `assets/` 파일과 lockfile이 포함되는지 비교한다.

## 검증 결과와 남은 범위

- 타입 검사, lint, Jest 62개 suite·276개 테스트, 빌드 환경 검증 10개 테스트 통과.
- SDK 정렬 후 Expo Doctor 21/21 통과, iOS·Android JS/Hermes 번들 생성 통과.
- React Doctor 변경 코드 6개 검사에서 진단 없음.
- EAS archive에서 앱 소스 전체 포함과 `.env`·서버 소스 제외 확인.
- Android preview 네이티브 빌드·APK 설치와 에뮬레이터의 온보딩·로그인 화면·복구 딥링크 기본 동작 확인.
- 기존 로컬 `android/` 폴더를 건드리지 않고, 업로드 archive의 깨끗한 설정에서 베타 scheme만 등록되고 마이크 권한이 제외됨을 확인했다.
- 사용자 선택에 따라 Android 배포를 먼저 진행한다. Apple Developer 유료 계정이 없어 iPhone용 서명 빌드와 설치는 아직 진행하지 않았다. iOS 시뮬레이터 프로필은 준비했지만 이번 작업에서 원격 시뮬레이터 빌드는 실행하지 않는다.
- Supabase Auth redirect allowlist·SMTP, FCM/APNs 자격 증명, 실기기 QA는 별도 확인이 필요하다. 테스트용 계정의 비밀번호는 문서나 저장소에 기록하지 않는다.
- 설치 과정의 `npm audit`에는 전이 의존성 경고 72건(critical 1, high 56, moderate 15)이 남아 있다. critical 항목은 `react-devtools-core`의 `shell-quote@1.10.0`이며 기존 lockfile에도 같은 버전이 있었다. 이번 SDK 호환성 수정과 별도로 배포 도구의 보안 업데이트 범위를 검토해야 하며, Expo Doctor 통과를 의존성 보안 검사 통과로 해석하지 않는다.

공식 참고: [EAS 빌드 프로필](https://docs.expo.dev/build/eas-json/), [앱 variant](https://docs.expo.dev/build-reference/variants/), [내부 배포](https://docs.expo.dev/build/internal-distribution/), [환경 변수](https://docs.expo.dev/eas/environment-variables/), [버전 관리](https://docs.expo.dev/build-reference/app-versions/).
