# 공유 Supabase에 Color Log 설치

요구사항: FR-AUTH-001/004, FR-MISSION-004, FR-PHOTO-005/007, FR-ROOM-005/009. 개인·친구방별 시간대와 기존 제품 동작을 유지하면서 다른 앱과 데이터베이스 이름을 구분한다.

## 객체 이름

- 테이블 14개와 공개 RPC·인덱스·트리거: `cl_` 접두사
- 내부 권한 함수와 설치 이력: `cl_private`
- 비공개 사진 버킷: `cl-entry-photos` (JPEG, 최대 8 MiB)
- 서버 함수: `cl-delete-my-account`, `cl-notify-room-photo`
- 실시간 구독: `cl_entry_room_shares`, `cl_room_photo_reactions`

Auth는 Supabase 프로젝트 전체가 공유한다. 테이블 접두사는 Auth 계정·이메일 설정·비밀번호를 분리하지 않는다. 기존 공유 계정으로 로그인한 이용자는 Color Log 프로필을 별도로 만든다. 다른 앱의 `profiles` 테이블이나 Auth 가입 트리거는 변경하지 않는다.

## 새 프로젝트에 최초 설치

`.env`의 `EXPO_PUBLIC_SUPABASE_URL`과 공개 키를 대상 프로젝트로 설정한다. 서버 키나 DB 비밀번호는 앱에 넣지 않는다.

```sh
npm run db:install:colorlog
npm run db:verify:colorlog
```

다른 환경 파일을 사용한다면 `-- --env-file /path/to/.env`를 추가한다. 스크립트는 URL에서 대상 프로젝트를 확인하고 명시적으로 지정하므로 기존 CLI 링크에 의존하지 않는다. Supabase CLI 로그인과 대상 프로젝트의 관리 권한이 필요하다.

최초 설치에는 `20261019130440_create_cl_namespace.sql` **한 파일만** 적용한다. 기존 32개 migration은 이전 전용 프로젝트의 이력으로 보존한다. 공유 프로젝트에서 `supabase db push`, 과거 migration 일괄 실행, `db reset`을 실행하지 않는다. 기존 테이블을 rename하거나 이전 사진·사용자 데이터를 자동 복사하지 않는다. 이미 `cl_` 객체가 있다면 덮어쓰지 않고 트랜잭션 전체가 중단된다.

이후 변경은 새로운 timestamp migration으로 작성하고 해당 파일만 명시적으로 적용한다. 공유 `supabase_migrations` 이력 대신 `cl_private.schema_migrations`에 Color Log 적용 버전을 기록한다.

서버 함수는 대상 프로젝트를 명시해 두 개만 배포한다.

```sh
npx --yes supabase@2.121.0 functions deploy cl-delete-my-account cl-notify-room-photo --project-ref <대상-project-ref> --use-api
```

`--prune`이나 전체 함수 배포를 사용하지 않는다. 이메일 확인·SMTP·비밀번호 복구 Redirect URLs는 공유 설정이므로 다른 서비스의 기존 값을 보존하며 설정한다.

## 팔레트 업데이트 (준비 완료, 공유 서버 미적용)

기존 설치에는 `20261021180718_refresh_cl_mission_palette.sql` **한 파일만** 적용한다. 새 프로젝트도 최초 설치 명령 후 이 migration을 추가 적용해야 현재 팔레트가 된다. 서버의 기존 활성 목록이 검토 당시와 다르거나 새 slug가 이미 있으면 전체 트랜잭션이 실패하므로 원인을 확인한 뒤 별도 migration으로 조정한다. 기존 행을 덮어써서 통과시키지 않는다.

```sh
npx --yes supabase@2.121.0 db query --linked --project-ref <.env의-대상-project-ref> --yes --file supabase/migrations/20261021180718_refresh_cl_mission_palette.sql
npm run db:verify:colorlog
```

독립 설치 기준 전체 팔레트 행은 12개, 활성 후보는 10개다. 과거 색이 더 있는 환경에서는 전체 행 수가 더 클 수 있다. 검증 결과의 `active_palette_slugs`에 `royal-purple`, `deep-wine`이 있고 `coral-pink`, `lime-green`이 없는지 확인한다. 기존 미션과 비활성 색은 그대로 남으며, 이미 결정된 오늘 색도 교체하지 않는다. 새 이력 버전은 migration 내부에서 `cl_private.schema_migrations`에 원자적으로 기록된다.

복구 역시 새 timestamp migration을 추가하여 `coral-pink`·`lime-green`을 활성화하고 `royal-purple`·`deep-wine`을 비활성화한다. 새 색을 참조하는 미션이 생길 수 있으므로 색상 행·미션·사진을 삭제하거나 기존 migration을 편집하지 않는다. 색 인식 개선(D/E) 확인 후 적용하며, 앱 빌드·기기 검증은 전체 수정이 끝난 마지막 단계에서 진행한다.

## 권한과 탈퇴

모든 Color Log 테이블에 RLS를 적용한다. 사진 버킷에는 제한 정책도 추가하여 다른 앱이 광범위한 허용 정책을 만들더라도 Color Log 사진을 공개하지 못하게 한다. 이 제한은 다른 버킷에서는 항상 통과한다.

탈퇴 함수는 요청자의 Auth 토큰을 검증하고 Color Log 사진 파일, 프로필과 연결 데이터를 정리한다. 남은 멤버에게 방장을 위임한다. `auth.admin.deleteUser`와 전체 세션 해지는 사용하지 않으며 공유 Auth 계정과 다른 앱의 데이터·세션은 유지한다. 앱 안내와 공개 삭제 문서도 이 범위를 표시한다.

## 검증 및 앱 배포

SQL 계약 테스트는 [테스트 안내](../supabase/tests/README.md)에 따라 폐기 가능한 로컬 DB에서만 실행한다. 공유 운영 프로젝트에서는 `db:verify:colorlog`의 읽기 전용 검사와 새로 만든 전용 QA 계정으로 검증한다.

2026-10-19 설치 시 기존 27개 테이블·함수·정책·기본 권한·Auth 트리거·버킷 2개의 정의를 전후 비교했다. 기존 객체 정의는 동일하다. 새 테이블 14개는 모두 RLS가 켜져 있고 색상 10개와 비공개 버킷을 확인했다. Supabase Advisor의 Color Log 항목은 의도적으로 인증 사용자에게 공개한 권한 검사 RPC와 소유자/친구방 공유 정책 중첩 경고이며, 오류 등급 항목은 없다.

실제 publishable key 로그인 세션으로 24개 항목을 확인했다. 프로필 격리, 사진 업로드·signed URL, 익명/다른 사용자 접근 차단, 방 공유·나간 뒤 접근 차단, 서버 함수 2개, 탈퇴 후 사진 정리·방장 위임·공유 Auth와 다른 앱 프로필/세션 보존을 통과했다. 임시 QA 계정과 사진·방은 검증 후 삭제했다. 사진 알림은 등록된 수신 기기가 없는 경로를 검증했으며 실제 푸시 수신 검증은 아니다.

별도로 공개 키를 사용한 일반 이메일·비밀번호 회원가입 → 본인 `cl_profiles` 저장 → 오늘의 색 조회 3개 항목을 통과했다. 확인 당시 프로젝트는 이메일 가입 허용·이메일 자동 확인 상태였으며, Auth 설정을 변경하지 않았다. 이 검증도 생성한 계정을 정리했다. SQL 계약 6개는 독립 설치와 기존 32개 이력 뒤 설치 모두 통과했다. 앱 검증은 typecheck·lint, Jest 62개 suite/276개 테스트, 빌드 환경 10개 테스트를 통과했다.

후속 오류: 기존 `join_room_by_code`는 방을 나간 멤버가 재가입할 때 기존 멤버십 행을 재활성화하지 않고 INSERT하여 `23505`가 발생한다. 새 초대를 사용해도 동일하다. 이 작업은 기존 동작을 이름만 분리하므로 재가입 정책·사용 횟수 처리는 별도 수정 대상으로 남긴다. 탈퇴와 방장 위임 검증은 별도의 새 방에서 수행했다.

기존 APK는 이전 서버 주소와 이전 테이블명이 들어 있으므로 새 코드와 환경 변수로 다시 빌드해야 한다. `.env`만 바꿔도 이미 설치한 앱은 바뀌지 않는다. 서버 전용 비밀을 EAS의 `EXPO_PUBLIC_` 변수로 등록하지 않는다.

새 Android 베타 1.0.0(4) 빌드와 에뮬레이터의 로그인 → 프로필 저장 → 오늘의 색 공개를 확인했다. 설치 링크와 기기 QA 범위는 [베타 빌드 기록](beta-builds.md)을 참고한다.
