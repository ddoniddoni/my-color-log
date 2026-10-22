# 친구방 사진 알림

요구사항: FR-NOTIFY-002. 사진 업로드/공유 → DB 대기열 → 예약 실행 → Expo → APNs/FCM 흐름이다. 아침·저녁 개인 알림은 기존 로컬 예약을 유지한다.

## 구현

- `20261022111011_reliable_cl_room_push_queue.sql`은 `cl_room_push_jobs`와 필요한 `cl_` RPC/트리거만 추가한다. 기존 이력과 다른 앱 객체를 변경하지 않는다. 사진 저장 및 공유 연결과 같은 DB 트랜잭션에서 예약하므로 앱이 종료돼도 예약이 남는다. 외부 네트워크 요청은 사진 트랜잭션에서 실행하지 않는다. DB 저장 자체가 실패하면 기존 사진 큐가 로컬 원본을 보존하고 업로드를 다시 시도한다.
- 같은 방·작성자·수신자·날짜·기기당 한 작업이다. 새 사진이 있을 때만 예약하며 과거 기록을 일괄 발송하지 않는다. 기존 `cl_room_photo_push_deliveries` 기록도 중복 방지에 사용한다. 설치된 구버전 앱의 `cl-notify-room-photo` 호출은 동일 대기열에 넣는 호환 경로다.
- worker는 회당 최대 12건, HTTP 동시 요청 4개로 처리한다. `FOR UPDATE SKIP LOCKED`와 3분 lease를 사용하며 이전 lease의 늦은 결과는 저장하지 않는다. 네트워크/429/5xx와 `MessageRateExceeded`는 1분부터 최대 1시간까지 간격을 늘려 총 8회 이내 재시도한다. 첫 예약 24시간 뒤에는 발송하지 않는다.
- Expo 접수 티켓을 저장하고 15분 뒤 receipt를 조회한다. receipt가 아직 없으면 조회만 재시도하고, 티켓 생성 후 23시간이 지나면 `unknown`으로 종료한다. `DeviceNotRegistered`이면 해당 등록만 비활성화한다. 인증서/발신자 설정 오류는 `failed`에 원인 코드를 남긴다.
- 실제 발송 직전 사진·공유·미션·방 상태·양쪽 멤버십·방 시간대 가입일·기기 등록 세대·Auth 세션 존재/만료를 다시 확인한다. 기존 기기는 앱을 다시 열어 세션 정보를 등록해야 한다. 설정 ON은 이후의 사진에 적용하며 이미 지난 사진을 소급해서 보내지 않는다.
- 앱 복귀·네트워크 복구·네이티브 토큰 변경 시 재등록한다. 자동 동기화에서는 권한 팝업을 띄우지 않는다. OFF 동기화도 재시도하며, 로그아웃은 기기 비활성화를 확인한 후 세션을 해지한다. 해제에 실패하면 로그아웃 실패를 안내하고 다시 시도할 수 있게 한다.
- payload에는 방/사진/날짜/수신 계정 식별자만 포함한다. 표시 문구는 방 이름과 작성자 닉네임을 사용한다. 사진 URL·캡션·인증 토큰을 넣지 않고 로그에는 처리 건수와 고정 오류 코드만 남긴다. 종료한 작업 메타데이터는 30일 뒤 정리한다.

## 상태와 운영 확인

| 상태 | 의미 |
| --- | --- |
| `pending` | 최초 발송 또는 일시 오류 재시도 대기 |
| `awaiting_receipt` | Expo가 접수했고 Apple·Google 전달 결과를 기다림 |
| `provider_accepted` | APNs/FCM이 접수한 것을 확인 |
| `failed` | 영구 오류, 발송 횟수 초과 또는 만료 |
| `unknown` | receipt를 끝내 확인하지 못함 |
| `cancelled` | 사진/공유/방/기기/세션 접근 조건이 바뀜 |

`provider_accepted`는 기기 화면 표시나 읽음 확인이 아니다. Expo에 요청이 도착한 직후 응답이나 DB 저장이 실패하면 재시도로 중복 표시될 가능성은 남는다. 기기 푸시 전송과 DB 커밋을 원자적으로 묶을 수 없으므로 exactly-once를 보장하지 않는다. 이미 OS에 전달된 알림은 로그아웃/탈퇴로 회수할 수 없으며, 새 payload의 계정 식별자로 잘못된 계정의 화면 이동을 차단한다.

관리자 권한에서 민감한 payload 없이 상태를 확인한다:

```sql
select state, last_error_code, count(*)
from public.cl_room_push_jobs
group by state, last_error_code;

select count(*) as waiting, min(next_attempt_at) as earliest_due
from public.cl_room_push_jobs
where state in ('pending', 'awaiting_receipt');
```

대기열과 worker RPC는 `service_role` 전용이다. 일반/익명 사용자는 조회·조작할 수 없다. `cl_enqueue_my_room_photo_push`만 본인 사진을 확인한 후 호출할 수 있다.

## 공유 Supabase에 적용하는 순서

2026-10-23 현재 `.env` 대상 공유 서버에 알림 migration·두 서버 함수·전용 비밀·스케줄러 적용을 완료했다. Android 베타 앱의 FCM V1 키와 EAS 파일 변수도 등록했다. 아래는 새 환경에 적용할 때의 순서다. 이미 적용된 환경에는 migration을 다시 실행하지 않는다. 공유 서버에는 `db push`나 전체 migration 재적용을 하지 않는다. 최종 앱 빌드와 실제 기기 수신 검증은 아직 남아 있다.

1. `.env`가 가리키는 프로젝트를 명시적으로 확인한다. 기존 `cl_` 설치 뒤 **새 migration 파일 하나만** 적용한다. 이 작업은 팔레트 migration과 독립적이다. 적용 버전은 `cl_private.schema_migrations`에 기록된다.
2. `cl-process-room-push`와 수정한 `cl-notify-room-photo`를 같은 프로젝트에 배포한다. 구버전 직접 발송 함수 교체를 마치기 전에는 worker를 활성화하지 않는다. 기존 앱의 호출과 새 트리거가 동시에 있어도 같은 대기열로 수렴한다.
3. Edge Function 비밀 환경 변수 `CL_PUSH_WORKER_SECRET`에 무작위 32자 이상의 값을 설정한다. Supabase Vault의 `cl_push_worker_secret`에 같은 값을, `cl_push_worker_url`에 해당 프로젝트의 `/functions/v1/cl-process-room-push` HTTPS URL을 저장한다. 비밀은 앱 `.env`, SQL 파일, Git에 넣지 않는다.
4. Expo Enhanced Push Security를 사용하는 프로젝트는 Edge Function의 `EXPO_ACCESS_TOKEN`도 설정한다. worker는 있을 때 Authorization 헤더로 전달한다. Supabase 서버 키는 기본 Edge Function 환경의 secret/service-role 키를 사용한다.
5. 플랫폼별 자격 증명을 준비한다. Android는 앱 변형별 패키지의 FCM v1 서비스 계정 자격 증명을 EAS에 등록하고, 해당 패키지의 `google-services.json`을 EAS **파일 환경 변수** `GOOGLE_SERVICES_JSON`으로 제공한다. `app.config.ts`가 그 파일 경로를 `android.googleServicesFile`에 연결한다. iOS는 유료 Apple Developer 계정의 APNs 키와 Push Notifications entitlement가 필요하다. `IOS_PERSONAL_TEAM=1` 개발 빌드는 원격 푸시를 지원하지 않는다. 앱에서도 이 상태를 별도로 안내한다. 자격 증명과 Firebase JSON은 커밋하지 않는다.
6. 해당 프로젝트에서 `pg_cron`, `pg_net`, Vault를 확인하고 `supabase/operations/enable_room_push_worker.sql`을 실행한다. `cl-room-push-worker` 하나만 분당 실행하며 다른 앱의 작업에는 손대지 않는다. `verify_jwt=false`인 worker는 별도 secret 헤더를 필수 검증한다. 공개 키나 사용자 JWT만으로 실행할 수 없다.
7. 최종 앱 빌드를 설치하고 두 테스트 계정으로 실제 발송을 확인한다. 정상 티켓·receipt와 설정/오류 상황을 함께 확인한다.

중지할 때는 `select cron.unschedule('cl-room-push-worker');`로 이 작업만 멈춘다. 사용자 사진이나 대기열을 삭제하지 않는다. 설정 오류를 수정한 뒤 재시도가 필요한 `failed` 작업은 접근 조건과 만료 시각을 검토한 후 관리자 운영 절차로 처리한다. 무조건 전체 재발송하지 않는다.

설치 후 관리자 권한으로 `supabase/operations/check_room_push_worker.sql`을 실행하면 migration, RLS, worker RPC 권한, Vault 이름 존재, 최근 Cron 실행과 worker HTTP 응답을 함께 확인할 수 있다. Cron의 `succeeded`는 HTTP 요청 예약 성공이므로 worker의 HTTP 200 및 `errors = 0`도 확인한다. 이 검사 역시 실제 기기 수신을 증명하지 않는다. 작업 명령·Vault 값·기기 토큰·사진 payload는 출력하지 않는다.

## Android 연결 상태

2026-10-23 사용자 요청으로 전용 Firebase 프로젝트 `mycolorlog-ddoni`(표시 이름 Color Log)를 생성했다. Spark 요금제를 유지하고 Analytics·Gemini·선택적 Google 개발자 프로그램 가입은 사용하지 않았다.

| 항목 | 적용 상태 |
| --- | --- |
| Android 앱 | `com.ddoni.mycolorlog.preview` / Color Log Beta |
| Firebase 프로젝트 번호 | `507456832042` |
| EAS FCM V1 자격 증명 | 해당 베타 앱 식별자에 등록 완료 |
| 발송용 서비스 계정 | `colorlog-expo-push`, `roles/firebasecloudmessaging.admin`만 부여 |
| EAS 파일 변수 | `preview`의 `GOOGLE_SERVICES_JSON`, `FILE_BASE64` / `SECRET` |
| 개발용·출시용 Android | Firebase 앱/자격 증명/파일 변수 등록 전 |
| 실제 기기 수신 | 최종 앱 빌드 후 확인 예정 |

새 환경이나 다른 앱 변형을 연결할 때의 절차:

1. Color Log용 Firebase 프로젝트를 정한다. 기존 다른 앱의 프로젝트를 사용할 경우에도 Android 앱 식별자는 아래와 같이 별도 등록한다.
2. 우선 `com.ddoni.mycolorlog.preview`를 Android 앱으로 등록하고 해당 앱의 `google-services.json`을 준비한다. 개발용은 `com.ddoni.mycolorlog.dev`, 출시용은 `com.ddoni.mycolorlog`이며 각각 파일·패키지 일치 여부를 확인한다.
3. FCM V1 전송용 서비스 계정 JSON을 EAS의 해당 Android 식별자에 등록한다. 전용 서비스 계정에 `roles/firebasecloudmessaging.admin`을 부여하며 프로젝트 Owner/Editor 또는 Firebase 전체 관리자 권한은 부여하지 않는다. 비밀키를 채팅이나 Git에 붙이지 않는다. 키 생성·보관·회전은 Firebase/EAS의 자격 증명 관리 경로를 사용한다.
4. 앱 등록용 `google-services.json`은 EAS `preview` 환경의 파일 변수 `GOOGLE_SERVICES_JSON`으로 제공한다. FCM 서비스 계정 JSON과 서로 다른 파일이다. 앱 코드에 서비스 계정 JSON을 포함하지 않는다.
5. 최종 Android 빌드에 파일을 반영하고, 두 테스트 계정으로 알림 ON → 친구방 사진 공유 → 티켓·receipt → 앱 종료 상태 수신·클릭을 확인한다. 플랫폼 설정 변경은 Metro 새로고침만으로 반영되지 않는다.

로컬 `.env`에는 JSON 경로를 추가하지 않았다. 로컬 Android 빌드가 필요하면 해당 앱 설정 파일을 별도로 준비해 `GOOGLE_SERVICES_JSON`에 경로를 제공한다. `SECRET` 파일 변수는 EAS 서버의 빌드 작업에 제공되며 로컬로 내려받을 수 없다. EAS용 FCM 서비스 계정 JSON을 앱 설정 파일로 지정하면 안 된다.

공식 절차: [Expo FCM V1 자격 증명](https://docs.expo.dev/push-notifications/fcm-credentials/), [FCM API 역할](https://docs.cloud.google.com/iam/docs/roles-permissions/firebasecloudmessaging). iOS 원격 푸시 설정과 유료 Apple 계정 가입은 별도로 보류한다.

## 검증과 남은 확인

- 자동 테스트: HTTP/Expo 오류, 지수 재시도, receipt 조회/만료, 무효 토큰, DB 결과 저장 실패, 기기 등록/회전/권한 철회/로그아웃/이전 계정 알림 차단.
- `room_push_contract.sql`: 일반 사용자 접근 차단, 본인 사진만 예약, 사진/공유 저장 순서, 중복 방지, lease, receipt 상태 전이, 방 날짜/권한/기기/세션 재확인, 사진/개인 기록 보존.
- 실제 Supabase Cron·Vault·pg_net과 Auth 세션 연동 검증은 아래 2026-10-23 기록과 같다. APNs/FCM 기기 수신은 별도 운영 통합 QA이며 로컬 PostgreSQL·HTTP 대역이나 빈 대기열 실행으로 대신하지 않는다.
- 앱 빌드, 실기기 연결/설치/발송은 전체 변경 후 최종 검증 단계에서 수행한다.

참고: [Expo 재시도·receipt](https://docs.expo.dev/push-notifications/sending-notifications/), [Supabase 예약 실행](https://supabase.com/docs/guides/functions/schedule-functions), [플랫폼 자격 증명](https://docs.expo.dev/push-notifications/push-notifications-setup/).

## 2026-10-22 검증 기록

- `npm test -- --runInBand`: 75 suites / 360 tests 통과.
- `npm run typecheck`, `npm run lint`: 통과, 린트 경고 없음.
- `npm run test:build`: 설정 검사 17개 통과. 네이티브 앱을 빌드하는 명령이 아니며 iOS/Android 앱 빌드는 수행하지 않았다.
- `npx --yes deno@2.5.4 check --no-lock supabase/functions/cl-process-room-push/index.ts supabase/functions/cl-notify-room-photo/index.ts`: 서버 함수 타입 검사 통과.
- 폐기용 PostgreSQL에 Color Log 독립 설치 및 전체 migration 이력 설치 각각에서 SQL 계약 8개 통과. Auth 함수·세션과 Storage 메타데이터는 로컬 테스트 대역이며 조회/변경은 실제 `authenticated`/`service_role`로 검증했다.
- 독립 DB 세션 4개의 동시 claim에서 기기별 단일 처리 확인. 실제 worker와 로컬 DB를 연결하고 Expo HTTP만 대체하여, 한 기기 성공·다른 기기 503 → 실패 기기만 재발송 → receipt 확인 → 무효 기기만 비활성화 흐름과 개인 사진 보존을 확인했다.
- React Doctor 변경 범위 검사: 93점, 새 진단 없음. `git diff --check` 통과.
- 검증용 PostgreSQL 종료 확인. 공유 서버, APNs/FCM 자격 증명, 실제 푸시 발송, 실기기 연결은 변경/실행하지 않았다.

## 2026-10-23 서버 적용 기록

- 최신 `develop`에서 `chore/activate-room-push` 작업을 시작했다. 배포 전에 `config.toml`의 worker `entrypoint`가 `cl-notify-room-photo`를 가리키는 오류를 발견했다. 재현 테스트 실패를 확인한 뒤 각 함수의 실행 경로를 명시하고 회귀 검사 4개를 추가했다.
- 공유 서버에 `20261022111011_reliable_cl_room_push_queue.sql` 하나만 적용했다. 팔레트 migration과 다른 프로젝트의 테이블·이력은 변경하지 않았다.
- `cl-notify-room-photo`와 `cl-process-room-push`를 API 방식으로 배포하고 서버 메타데이터의 실제 실행 경로를 확인했다. 기존 계정 삭제 함수의 소스 해시는 그대로다.
- 48바이트 무작위 worker 비밀을 Edge 환경과 전용 Vault 항목에 설정했다. `pg_net`을 활성화하고 기존 Cron/Vault를 유지했으며 `cl-room-push-worker`만 분당 실행하도록 등록했다. 생성한 비밀은 저장소·앱 환경·로그에 넣지 않았다.
- 예약 실행의 `succeeded`와 worker HTTP 200, 빈 대기열 응답 `claimed=0 / processed=0 / errors=0`을 확인했다. 비밀 누락·오류·공개 키·사용자 JWT만으로 호출한 요청은 HTTP 401이었다. 등록 기기가 없어 실제 푸시는 보내지 않았다.
- 실제 Auth 임시 계정을 관리자 API로 생성한 뒤, 앱의 publishable key로 로그인하여 기기 등록/세션 연결, 알림 OFF, 로그아웃한 세션의 등록 차단을 확인했다. 일반 사용자·공개 클라이언트의 대기열 조회/claim은 `42501`, 호환 함수의 본인 소유가 아닌 사진 요청은 HTTP 403이었다. 사진·친구방을 만들지 않았고 검증 후 임시 계정·프로필·기기는 정리했다.
- 기존 개인 기록·사진 건수, 다른 앱 Cron의 활성 상태와 실행 주기가 유지됐다. 검증 종료 시 알림 기기와 작업은 0건이다.
- security advisor에서 대기열 테이블 경고는 없었다. 기기 등록·해제·본인 사진 enqueue의 `authenticated SECURITY DEFINER` 경고 3개는 의도된 공개 RPC이며, 사용자/소유권/세션 검사와 실제 공개 키 접근 검증으로 검토했다. worker RPC는 service role 전용이다. 공유 프로젝트 전체의 기존 경고를 모두 해소했다고 판단하지 않는다.
- `npm run check`: 타입·린트, Jest 75 suites / 360 tests, 색 강조 도구 10개, 설정 검사 21개 통과. 두 Edge Function의 Deno 타입 검사 통과. 앱 빌드·기기 연결·설치·실제 APNs/FCM 수신은 수행하지 않았다.
- Android Firebase/FCM 연결 결과는 아래와 같다. 최종 빌드 및 두 계정 실기기 수신 검증은 남아 있다. Apple 유료 가입과 iOS 원격 푸시는 보류 상태다.

## 2026-10-23 Android FCM 적용 기록

- 전용 Firebase 프로젝트와 Android 베타 앱을 생성하고, 앱 설정 JSON의 프로젝트 ID·프로젝트 번호·패키지를 확인했다. EAS의 기존 Android 서명 키는 변경하지 않았다.
- FCM 전용 서비스 계정 키를 EAS의 베타 앱 식별자에 등록하고, EAS 자격 증명 화면에서 프로젝트·계정·키 ID를 다시 확인했다. 앱 설정 JSON은 `preview` 환경의 비밀 파일 변수로 등록했다. 두 파일의 Firebase 프로젝트가 일치한다.
- 서비스 계정의 Google OAuth 인증 HTTP 200, FCM V1 `validate_only=true` 요청 HTTP 200을 확인했다. 이 요청은 메시지를 전달하지 않으며 실제 기기나 Expo 토큰을 사용하지 않았다. [FCM 검증 모드 문서](https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages/send)
- 다운로드 도구의 임시 파일 정리로 첫 번째 키를 보존하지 못해 일반 다운로드로 키를 교체했다. 첫 키는 EAS나 앱에 등록하지 않았으며 Google Cloud에서 폐기했다. 서버 목록에는 EAS에 등록한 활성 키 하나만 남은 것을 확인했다.
- 로컬 비밀 JSON은 권한 600인 임시 파일로 취급했고 등록·검증 후 제거했다. 다운로드 과정의 앱 설정 JSON 사본도 프로젝트 ID 확인 후 정리했다. 서비스 계정 비밀키·OAuth 토큰·앱 설정 JSON은 Git과 앱 소스에 포함하지 않았다.
- `APP_VARIANT=preview`와 준비한 JSON 경로를 지정한 `expo config --type public --json` 검사에서 Color Log Beta·베타 패키지·`android.googleServicesFile` 연결을 확인했다. 네이티브 빌드는 수행하지 않았다.
- EAS 등록과 FCM 검증 성공은 앱의 토큰 발급·Expo 전달·백그라운드 표시를 증명하지 않는다. 최종 베타 APK 설치 후 두 계정으로 알림 ON, 친구방 사진 공유, receipt, 앱 종료 상태 수신·탭 이동, OFF·로그아웃 차단을 확인한다.
