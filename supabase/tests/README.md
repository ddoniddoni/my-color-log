# DB 계약 테스트

`room_visibility_contract.sql`은 PRD `FR-MISSION-004`, `FR-ROOM-009`의 방 날짜 경계와 읽기 권한을 검증한다.

## 실행

전체 migration이 적용된 **로컬 또는 폐기 가능한 Supabase DB**에서 실행한다.

현재 테스트는 `cl_` 테이블과 `cl_private` 함수를 대상으로 한다. 공유 운영 프로젝트에는 실행하지 않는다. 최초 설치와 운영 검증은 [공유 Supabase 안내](../../docs/shared-supabase.md)를 따른다.

각 계약은 필요한 테스트 사용자를 트랜잭션 안에서 직접 만들고 롤백한다. 기존 계정·프로필을 준비할 필요가 없으며 다른 사용자의 행을 fixture로 재사용하지 않는다. npm DB 명령은 고정한 CLI 버전과 `--local --yes`를 사용한다.

```sh
npm run test:db:room-visibility
```

이 명령은 `--local`을 사용한다. 다른 테스트 DB를 지정할 때는 Supabase CLI의 `db query --db-url … --file supabase/tests/room_visibility_contract.sql`을 사용한다.

- fixture 생성에는 `postgres` 권한이 필요하다. 실제 조회는 JWT 사용자 ID를 설정하고 `SET LOCAL ROLE authenticated`로 전환해 RLS를 적용한다.
- 테스트 사용자, 방, 미션, 사진 메타데이터와 Storage object 메타데이터를 트랜잭션 안에서 생성하고 마지막에 `ROLLBACK`한다. 실제 사진 파일이나 이메일은 생성하지 않는다.
- Storage 메타데이터를 직접 만드는 SQL 테스트이므로 운영 DB에서는 실행하지 않는다.
- 기존 사용자나 프로필이 없어도 실행할 수 있다.

## 검증 범위

- LA·키리티마티·서울의 가입 당일 허용과 가입 전날 차단
- 뉴욕의 DST 전환 전후, SQL 세션/개인 프로필과 방의 시간대가 서로 다른 경우
- 방 기준 미래 날짜 차단
- 방 조회 RPC, 일일 기록, 사진, 공유 연결, 방 미션, Storage RLS의 일치
- 외부 사용자, 탈퇴·강퇴·재가입, 공유 취소·연결 없음, 종료된 방의 접근 차단
- 공유 취소·방 종료 이후에도 본인 기록과 사진 접근 유지
- 인증 ID가 없는 호출 차단, private helper 권한, 공개 중복 helper 제거

12개 날짜 사례와 상태 변경을 조합해 744개 조회 결과를 비교한다. helper 권한과 인증 ID 검증도 별도로 실행한다. 이 테스트는 DB 권한을 검증하며 Auth의 JWT 발급·검증, Storage HTTP API의 signed URL 발급 및 실제 기기 사진 열기는 별도 통합 QA 대상이다.

`cl_namespace_contract.sql`은 다른 앱의 `profiles` 테이블과 광범위한 Storage 정책을 로컬 트랜잭션에서 흉내 낸다. Color Log 사진 접근 차단, 다른 버킷 접근 보존, 서비스 전용 삭제 RPC, 공유 Auth·다른 앱 프로필 보존과 방장 위임을 확인하고 롤백한다. `profiles(id, nickname)`을 사용하는 폐기 가능한 fixture이므로 실제 공유 서버에 실행하면 안 된다.

```sh
npm run test:db:namespace
```

`mission_palette_contract.sql`은 `20261021180718_refresh_cl_mission_palette.sql` 이후 실행한다. 활성 10색, 보라·와인 토큰, 비활성 코랄·라임 보존, 모든 색상에 대한 중복 없는 10칸 공개, 목표 색 포함과 재조회 안정성, 같은 날짜의 개인·친구방 미션 일치, 서로 다른 개인 시간대 계정의 결과 일치, 신규 미션의 활성 후보만 사용, 인증 없는 호출 차단을 검증한다. 365개의 예시 과거 날짜를 생성하고 모두 롤백한다. 따라서 공유 운영 서버에서 실행하면 안 된다.

```sh
npm run test:db:mission-palette
```

2026-10-22에는 폐기 가능한 PostgreSQL 18.4에서 Auth 함수·Storage 메타데이터의 테스트 대역과 실제 `authenticated` DB role을 사용해 7개 SQL 계약을 독립 설치 및 기존 33개 migration 뒤 업데이트 각각에서 통과했다. 별도 세션 8개의 동일 날짜 동시 요청 수렴도 확인했다. migration 전후 기존 색상 필드·미션·기록·사진·방 연결·다른 앱 데이터와 공개 RPC 정의/권한을 비교해 변경 없음을 확인했다. 이 결과는 실제 Supabase Auth/Storage HTTP 통합 검증을 대신하지 않는다.
