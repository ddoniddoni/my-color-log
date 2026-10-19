# DB 계약 테스트

`room_visibility_contract.sql`은 PRD `FR-MISSION-004`, `FR-ROOM-009`의 방 날짜 경계와 읽기 권한을 검증한다.

## 실행

전체 migration이 적용된 **로컬 또는 폐기 가능한 Supabase DB**에서 실행한다.

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
