# AGENTS.md

이 문서는 Codex 및 저장소에서 작업하는 모든 코딩 에이전트의 실행 규칙이다. 제품 요구사항은 `PRD.md`, 시각 규칙은 `DESIGN.md`를 함께 읽는다.

---

## 1. 미션

React Native 기반의 iOS/Android 앱 **mycolorlog**를 구현한다.

제품의 핵심은 다음 두 문장으로 요약된다.

1. 사용자는 친구 없이도 매일 오늘의 색을 사진으로 기록할 수 있다.
2. 사용자는 지속형 비공개 친구방을 만들고, 2~6명의 멤버와 매일 같은 서버 미션을 수행할 수 있다.
3. 방에 보이는 사진은 각자의 개인 기록을 복제하지 않고 참조한다.

구현 의사결정에서 속도보다 다음을 우선한다.

1. 사진 유실 방지
2. 개인 데이터 소유권
3. 접근 권한과 RLS
4. 솔로 사용성
5. 친구방의 동일 미션과 공유 경험
6. 시각적 완성도

---

## 2. 작업 전 반드시 읽을 문서

1. `PRD.md`
2. `DESIGN.md`
3. 현재 작업과 관련된 기존 코드 및 테스트
4. `package.json`
5. `app.json` 또는 `app.config.ts`
6. `supabase/migrations/` 전체

문서와 코드가 충돌할 경우 임의로 추측하지 말고 다음 원칙을 따른다.

- 사용자 요청이 가장 우선이다.
- 그다음 이 `AGENTS.md`의 비협상 규칙을 따른다.
- 제품 동작은 `PRD.md`를 따른다.
- 화면 표현은 `DESIGN.md`를 따른다.
- 이미 배포된 DB 제약과 migration 이력을 파괴하지 않는다.

---

## 3. 비협상 규칙

### 3.1 패키지 매니저

- **npm만 사용한다.**
- `pnpm`, `yarn`, `bun` 명령을 사용하지 않는다.
- `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`를 만들지 않는다.
- `package-lock.json`을 커밋하고 의존성 기준으로 삼는다.
- 의존성 설치는 다음 중 하나만 사용한다.

```bash
npm install
npm install <package>
npm install -D <package>
npx expo install <expo-compatible-package>
```

- Expo 네이티브 모듈은 가능한 한 `npx expo install`로 설치하여 현재 Expo SDK와 호환되는 버전을 선택한다.
- 작업과 무관한 전체 의존성 업그레이드를 하지 않는다.
- `package-lock.json`의 대규모 변경이 발생하면 원인을 확인하고 작업 결과에 기록한다.

### 3.2 플랫폼과 프레임워크

- React Native + Expo + TypeScript를 사용한다.
- Expo Router를 사용한다.
- iOS와 Android를 모두 지원한다.
- 웹 버전은 MVP 범위가 아니다.
- 명시적 승인 없이 bare workflow로 eject하지 않는다.
- 명시적 승인 없이 `expo prebuild` 결과물인 `ios/`, `android/`를 저장소에 추가하지 않는다.
- Expo Go에서 불가능한 기능이 필요하면 development build를 사용한다. 기능을 제거하거나 가짜로 구현하지 않는다.

### 3.3 TypeScript

- `strict: true`를 유지한다.
- 새 코드에서 `any`를 사용하지 않는다.
- `@ts-ignore`, `@ts-nocheck`를 추가하지 않는다.
- 불가피한 외부 타입 문제는 최소 범위의 타입 가드 또는 어댑터로 격리한다.
- API/DB 응답은 런타임 검증이 필요한 경계에서 Zod 또는 명시적 파서를 사용한다.
- 컴포넌트 props와 도메인 타입을 분리한다.

### 3.4 보안

- 앱 코드에 Supabase service role key를 절대 넣지 않는다.
- 앱에 포함 가능한 것은 publishable/anon key뿐이며, RLS를 전제로 한다.
- 모든 사용자 데이터 테이블은 RLS가 켜져 있어야 한다.
- 사진 버킷을 public으로 만들지 않는다.
- public URL을 영구 저장하지 않는다.
- 사진은 `storage_path`만 저장하고 권한 검증 후 접근한다.
- 비밀 값, 실제 이메일, 토큰, 테스트 계정 자격 증명을 커밋하지 않는다.
- `.env`는 커밋하지 않는다.
- `.env.example`에는 이름과 설명만 넣고 실제 값은 넣지 않는다.

### 3.5 데이터 소유권

- 일일 기록과 사진의 소유자는 촬영 사용자다.
- 친구방에 사진/개인 일일 기록 복사본을 만들지 않는다.
- 공유는 `entry_room_shares` 연결 레코드로 표현한다.
- 방 나가기/종료 시 내 다이어리 데이터를 삭제하지 않는다.
- 다른 사용자의 사진을 내 다이어리 쿼리에 합치지 않는다.
- 오늘 탭과 친구방 탭의 촬영은 같은 개인 일일 기록을 사용한다.

### 3.6 날짜

- MVP 날짜 경계는 `Asia/Seoul`이다.
- 날짜 비교를 로컬 기기 자정에만 의존하지 않는다.
- 도메인에서 사용하는 날짜 키는 `YYYY-MM-DD` 형식의 KST date key다.
- timestamp는 UTC `timestamptz`로 저장한다.
- `new Date().toISOString().slice(0, 10)`를 KST 날짜 계산 용도로 사용하지 않는다.
- 날짜 로직은 공통 유틸리티와 테스트에 둔다.

### 3.7 오늘의 미션

- 클라이언트가 랜덤으로 오늘의 미션이나 방 미션을 확정하지 않는다.
- 룰렛은 서버 결과 공개 애니메이션이다.
- 같은 날짜에 재실행하거나 재설치해도 서버 결과는 동일해야 한다.
- 같은 `room_id + date_key`의 모든 멤버는 같은 `mission_id`를 받아야 한다.
- MVP의 방 미션은 해당 날짜 전역 일일 미션을 참조한다.
- 서버 데이터가 없을 때 임의 색이나 미션을 저장하지 않는다.

### 3.8 친구방 불변식

- MVP에서 한 사용자는 활성 친구방 최대 3개에 속할 수 있다.
- 한 방은 준비 상태 1명, 활성 상태 2~6명을 허용한다.
- 정원 검증과 초대 사용 횟수 증가는 서버 트랜잭션에서 원자적으로 처리한다.
- 방당 활성 owner는 한 명이다.
- 방 일일 미션은 `room_id + date_key`당 하나다.
- 개인 기록 미션과 방 일일 미션이 일치할 때만 공유 연결을 만든다.
- 방을 나간 사용자는 다른 멤버 기록을 더 이상 읽을 수 없어야 한다.
- 방을 나가거나 방이 종료되어도 본인 개인 기록과 사진은 유지한다.

### 3.9 사진

- base64 사진을 DB나 AsyncStorage에 저장하지 않는다.
- 로컬 파일 URI와 최소 메타데이터만 큐에 저장한다.
- 촬영 즉시 로컬에 안전하게 저장한 뒤 업로드한다.
- 업로드가 성공하기 전에 로컬 파일을 삭제하지 않는다.
- 업로드는 idempotent해야 한다.
- 삭제 요청과 늦은 업로드 재시도가 충돌하지 않도록 취소 상태를 관리한다.
- 썸네일 화면에서 원본 이미지를 무분별하게 로드하지 않는다.

---

## 4. 권장 초기화 명령

새 저장소라면 다음 흐름을 사용한다.

```bash
npx create-expo-app@latest mycolorlog
cd mycolorlog
npm install
```

현재 저장소가 이미 존재하면 재초기화하지 않는다. 기존 `package.json`, Expo SDK, Router 구조를 먼저 확인한다.

---

## 5. 기본 기술 선택

### 앱

- React Native
- Expo
- TypeScript
- Expo Router

### 서버/데이터

- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Supabase Realtime 또는 포그라운드 재조회
- Supabase Edge Functions는 권한이 중요한 서버 작업에만 사용

### 상태

- TanStack Query: 서버 상태
- 작은 로컬 store 또는 Context: 촬영 드래프트, 룰렛 공개 여부, 일시적 UI 상태
- AsyncStorage: 비민감 영속 큐/캐시
- SecureStore: 인증 저장 어댑터와 민감한 로컬 값

### UI

- React Native `StyleSheet`
- 중앙 디자인 토큰
- `react-native-safe-area-context`
- Expo 아이콘 또는 저장소 표준 아이콘 세트
- 필요한 경우 `react-native-reanimated`

### 폼/검증

- 단순 입력은 제어 컴포넌트로 충분하다.
- 복잡한 폼에만 React Hook Form + Zod를 사용한다.
- 불필요한 라이브러리를 추가하지 않는다.

---

## 6. 권장 npm 스크립트

`package.json`에는 최소 다음 스크립트를 제공한다. Expo 템플릿과 충돌하면 기존 명령을 존중하되 동일 역할을 유지한다.

```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "jest",
    "test:watch": "jest --watch",
    "check": "npm run typecheck && npm run lint && npm test"
  }
}
```

명령 실행 규칙:

- 기능 구현 후 관련 테스트를 먼저 실행한다.
- 완료 전 `npm run typecheck`와 `npm run lint`를 실행한다.
- 테스트가 구축되어 있으면 `npm test -- --runInBand` 또는 저장소 표준 명령을 실행한다.
- 실패를 숨기기 위해 스크립트를 약화하지 않는다.

---

## 7. 권장 디렉터리 구조

저장소의 기존 구조가 있다면 그것을 우선한다. 새 프로젝트라면 다음 구조를 기준으로 한다.

```text
app/
  _layout.tsx
  index.tsx
  onboarding/
  auth/
  camera.tsx
  photo-review.tsx
  invite/
  settings/
  (tabs)/
    _layout.tsx
    today.tsx
    room.tsx
    diary.tsx

src/
  components/
    ui/
    feedback/
    layout/
  design/
    tokens.ts
    theme.ts
  features/
    auth/
      api/
      components/
      hooks/
      model/
    missions/
      api/
      components/
      model/
    entries/
      api/
      components/
      hooks/
      model/
    camera/
      components/
      hooks/
      model/
    sync/
      queue/
      hooks/
      model/
    rooms/
      api/
      components/
      hooks/
      model/
    diary/
      api/
      components/
      hooks/
      model/
  lib/
    supabase/
    query/
    analytics/
    logging/
    env/
  utils/
    dates/
    images/
    errors/
  types/

tests/
supabase/
  migrations/
  functions/
  seed.sql
assets/
```

---

## 8. 모듈 경계

### 8.1 화면

`app/` 파일은 라우팅과 화면 조합만 담당한다.

금지:

- 화면 파일에서 긴 Supabase 쿼리 작성
- 화면 파일에서 이미지 업로드 파이프라인 구현
- 화면 파일에서 KST 날짜 계산 복제
- 화면 파일에 색상/간격 하드코딩 반복

### 8.2 feature

각 feature는 가능한 한 다음 경계를 가진다.

- `api/`: repository와 DTO 변환
- `model/`: 도메인 타입, 순수 함수, 스키마
- `hooks/`: query/mutation과 화면용 조합
- `components/`: feature 전용 UI

### 8.3 공통 UI

공통 컴포넌트는 제품 의미를 모르는 범용 요소여야 한다.

예:

- `AppText`
- `Button`
- `IconButton`
- `Surface`
- `StatusBadge`
- `EmptyState`
- `OfflineBanner`
- `LoadingSkeleton`

제품 의미가 강한 컴포넌트는 feature에 둔다.

예:

- `DailyMissionHero`
- `PhotoMosaic`
- `RoomMemberProgressCard`
- `ColorCalendarDay`

---

## 9. 서버 상태 규칙

- Supabase SDK 호출은 repository에 둔다.
- repository는 DB row를 그대로 UI에 흘리지 않고 도메인 모델로 변환한다.
- TanStack Query key는 중앙 팩토리로 관리한다.

예시:

```ts
export const queryKeys = {
  dailyMission: (dateKey: string) => ['dailyMission', dateKey] as const,
  dailyEntry: (userId: string, dateKey: string) =>
    ['dailyEntry', userId, dateKey] as const,
  activeRoom: (userId: string) => ['activeRoom', userId] as const,
  roomDay: (roomId: string, dateKey: string) =>
    ['roomDay', roomId, dateKey] as const,
  roomHistory: (roomId: string, cursor?: string) =>
    ['roomHistory', roomId, cursor ?? null] as const,
  diaryMonth: (userId: string, monthKey: string) =>
    ['diaryMonth', userId, monthKey] as const,
};
```

- mutation 성공 후 필요한 query만 갱신한다.
- 전체 캐시 무효화를 남발하지 않는다.
- optimistic UI는 사진 로컬 저장처럼 사용자가 즉시 봐야 하는 곳에만 사용하며 rollback 규칙을 구현한다.

---

## 10. 로컬 촬영 큐

### 10.1 목적

촬영과 네트워크 업로드를 분리해 사진 유실을 막는다.

### 10.2 최소 큐 모델

```ts
type UploadStatus =
  | 'local_saved'
  | 'pending'
  | 'uploading'
  | 'synced'
  | 'failed'
  | 'cancelled';

type PendingPhoto = {
  id: string;
  userId: string;
  entryId: string;
  dateKey: string;
  missionId: string;
  localUri: string;
  position: number;
  caption: string | null;
  capturedAt: string;
  status: UploadStatus;
  retryCount: number;
  lastErrorCode: string | null;
};
```

### 10.3 규칙

- UUID를 촬영 시점에 생성한다.
- 큐 변경은 원자적으로 영속 저장한다.
- 앱 시작, 포그라운드 복귀, 네트워크 복구 시 재시도한다.
- 동시에 너무 많은 업로드를 시작하지 않는다.
- 재시도에는 지수 백오프와 최대 간격을 둔다.
- 영구 오류와 일시 오류를 구분한다.
- 서버에 같은 `photo.id`가 있으면 성공으로 수렴할 수 있어야 한다.
- 삭제된 사진의 큐 항목은 `cancelled` 처리 후 업로드하지 않는다.

---

## 11. 인증 규칙

### 11.1 익명 사용자

- 첫 사용은 Supabase anonymous sign-in을 기본으로 한다.
- 익명 사용자도 `authenticated` role을 사용하므로 RLS에서 JWT의 anonymous claim을 필요한 곳에 확인한다.
- 익명 사용자가 로그아웃하면 동일 계정 복구가 불가능할 수 있으므로 로그아웃 동작 전 안내한다.

### 11.2 영구 계정 연결

- 친구방 생성/초대 수락 전에 계정 연결을 요구한다.
- 이메일·비밀번호 회원가입과 로그인을 MVP 기본 방식으로 한다.
- 기존 익명 사용자 ID에 identity를 연결한다.
- 새 계정을 만들고 데이터를 복사하는 방식은 피한다.
- identity 충돌은 명시적 오류와 복구 안내를 제공한다.

### 11.3 세션 저장

- React Native 환경에 맞는 storage adapter를 사용한다.
- 앱 포그라운드/백그라운드 전환 시 token refresh 규칙을 공식 문서에 맞게 구현한다.
- 앱 시작마다 불필요한 강제 로그인을 만들지 않는다.

---

## 12. Supabase migration 규칙

- 모든 스키마 변경은 timestamp 기반 새 migration으로 추가한다.
- 이미 적용된 migration을 수정해서 이력을 바꾸지 않는다.
- 테이블 생성 시 가능한 한 같은 migration 또는 직후 migration에서 RLS를 활성화한다.
- policy 이름은 대상과 동작을 분명히 표현한다.
- 함수의 `search_path`를 명시한다.
- `security definer` 함수는 최소화하고 권한을 검토한다.
- destructive migration은 명확한 주석과 데이터 보존 전략 없이 작성하지 않는다.
- seed 데이터는 재실행 가능해야 한다.

예시 파일명:

```text
supabase/migrations/20260716090000_create_color_palette.sql
supabase/migrations/20260716091000_create_daily_entries.sql
supabase/migrations/20260716092000_create_rooms.sql
supabase/migrations/20260716093000_create_room_daily_missions.sql
```

---

## 13. RLS 체크리스트

새 테이블 또는 policy를 추가할 때 반드시 확인한다.

- [ ] RLS가 활성화되어 있는가?
- [ ] 자기 데이터 SELECT가 가능한가?
- [ ] 자기 데이터 INSERT의 `with check`가 안전한가?
- [ ] 자기 데이터 UPDATE에서 소유자 변경이 차단되는가?
- [ ] 자기 데이터 DELETE만 가능한가?
- [ ] 친구방 공유 읽기는 활성 멤버 + 공유 연결을 모두 확인하는가?
- [ ] 방 일일 미션과 개인 기록 미션이 일치하는가?
- [ ] 다른 방 사용자가 접근할 수 없는가?
- [ ] 방 나가기/종료 후 다른 멤버 접근이 사라지는가?
- [ ] 활성 멤버 6명과 사용자당 활성 방 최대 3개 제한이 서버에서 강제되는가?
- [ ] 동시 초대 수락이 정원을 초과하지 않는가?
- [ ] 익명 사용자가 친구방 기능에 접근하지 못하도록 필요한 제한이 있는가?
- [ ] Storage object policy가 DB 정책과 같은 소유권을 보장하는가?
- [ ] SQL 테스트 또는 수동 침투 테스트가 있는가?

서비스 역할로만 테스트해서 RLS를 우회하지 않는다. 실제 anon/publishable key 세션으로 접근 테스트를 수행한다.

---

## 14. 날짜 유틸리티

날짜 관련 코드는 `src/utils/dates/`에 둔다.

최소 함수:

```ts
getKstDateKey(date?: Date): string;
getKstMonthKey(date?: Date): string;
getMillisecondsUntilNextKstMidnight(now?: Date): number;
isFutureKstDate(dateKey: string, now?: Date): boolean;
```

필수 테스트:

- UTC 날짜와 KST 날짜가 다른 시각
- KST 자정 1초 전/후
- 연말/연초
- 윤년 2월
- 앱 기기 타임존이 미국/유럽이어도 같은 결과

---

## 15. 디자인 구현 규칙

- `DESIGN.md`의 토큰을 코드로 옮긴다.
- Stitch 산출물은 시각 참고 자료이지 웹 HTML을 그대로 React Native에 붙이는 소스가 아니다.
- CSS 단위를 React Native 레이아웃에 맞게 재해석한다.
- 오늘의 색은 동적 accent token으로 전달한다.
- 앱 기본 표면은 중립색을 유지한다.
- 색만으로 완료/오류/업로드 상태를 전달하지 않는다.
- 화면마다 임의의 hex를 추가하지 않는다.
- 같은 역할의 컴포넌트를 화면마다 새로 만들지 않는다.
- safe area, 키보드, 작은 기기, 큰 글자 크기를 확인한다.
- 플랫폼별 기본 상호작용을 존중한다.

---

## 16. 접근성 규칙

- 아이콘 단독 버튼은 `accessibilityLabel` 필수
- 셔터 버튼은 역할과 상태를 읽을 수 있어야 함
- 사진 순서 변경에는 드래그 외 대체 조작 고려
- 최소 터치 영역 44×44 수준
- Dynamic Type에서 텍스트 잘림 금지
- 모션 감소 설정 확인
- 색 이름 텍스트 병기
- 대조가 낮은 오늘의 컬러에는 `onColorHex` 또는 안전한 텍스트 토큰 사용
- 로딩 스피너만 보여주지 말고 가능한 경우 상태 문구 제공

---

## 17. 오류 처리

### 17.1 사용자 메시지

내부 에러 원문을 그대로 노출하지 않는다.

좋은 예:

- “연결되면 자동으로 다시 올릴게요.”
- “카메라를 사용하려면 설정에서 권한을 허용해 주세요.”
- “초대가 만료됐어요. 친구에게 새 초대를 부탁해 주세요.”

나쁜 예:

- `StorageApiError: row-level security policy violation`
- `Network request failed`
- `JWT expired`

### 17.2 로깅

- 로깅 어댑터를 사용한다.
- 토큰, 이메일, 캡션, 사진 URL 전체를 로그에 남기지 않는다.
- 에러 범주와 operation ID를 남긴다.
- 사용자에게 재시도 가능한지 구분한다.

---

## 18. 테스트 전략

### 18.1 단위 테스트 우선 대상

- KST 날짜 계산
- 일일 기록 상태 계산
- 1/6/9 진행 문구
- 사진 position 재정렬
- 업로드 큐 상태 전이
- 재시도 정책
- 초대 만료 판정
- 도메인 DTO 변환

### 18.2 컴포넌트 테스트 우선 대상

- 오늘 빈 상태
- 업로드 실패 배지와 재시도
- 9장일 때 추가 버튼 비활성화
- 친구방 없음/준비/2명/6명 상태
- 색 이름 병기와 접근성 레이블

### 18.3 통합 테스트 우선 대상

- 첫 사진이 일일 기록을 생성
- 같은 날짜 중복 기록 생성 충돌 처리
- 익명 계정 → 이메일 계정 연결 후 데이터 유지
- 초대 수락 후 기존 당일 기록 공유
- 방 나가기/종료 후 다른 멤버 읽기 권한 제거
- 사진 삭제 후 Storage/DB/화면 정합성

### 18.4 실제 기기 QA

카메라와 파일 시스템은 시뮬레이터만으로 완료 판정하지 않는다.

최소 확인:

- iOS 실제 기기 1대
- Android 실제 기기 1대
- 권한 최초 허용/거부/영구 거부
- 오프라인 촬영 후 재연결
- 앱 강제 종료 후 큐 복구
- KST 자정 전후
- 큰 글자 크기

---

## 19. 구현 순서

한 번에 전체 앱을 만들지 말고 수직 슬라이스로 진행한다.

### Slice 1 — 앱 기반

- Expo Router
- 디자인 토큰
- 환경 변수 검증
- Supabase 클라이언트
- QueryClient
- 공통 오류/로딩 컴포넌트

### Slice 2 — 솔로 첫 기록

- 익명 세션
- 닉네임
- 오늘의 전역 미션 조회
- 룰렛 공개
- 카메라 촬영
- 로컬 저장
- 오늘 화면에 1장 표시

### Slice 3 — 동기화와 9장

- 이미지 처리
- 업로드 큐
- 재시도
- 1~9장 모자이크
- 삭제/재정렬
- 1/6/9 상태

### Slice 4 — 다이어리

- 월 요약 쿼리
- 달력
- 날짜 상세
- 메모/캡션 편집

### Slice 5 — 계정 연결과 친구방

- 이메일·비밀번호 회원가입과 로그인
- 친구방 생성과 이름 설정
- 2~6명 방 멤버
- 다중 사용 초대 생성/수락
- 방 일일 미션 바인딩
- 개인 기록 공유 연결
- 멤버 보드와 방 기록
- 실시간 갱신/재조회
- 방장 위임, 나가기, 종료

### Slice 6 — 출시 안정화

- RLS 테스트
- 계정 삭제
- 오프라인 엣지 케이스
- 접근성
- 성능
- 오류 카피

---

## 20. 작업 수행 프로토콜

각 작업에서 다음 순서를 따른다.

1. 관련 PRD 요구사항 ID를 확인한다.
2. 현재 코드와 migration을 읽는다.
3. 최소 변경 범위를 정한다.
4. 도메인 로직 테스트를 먼저 작성하거나 동시에 작성한다.
5. 구현한다.
6. 관련 테스트를 실행한다.
7. `npm run typecheck`를 실행한다.
8. `npm run lint`를 실행한다.
9. 변경 파일과 데이터/보안 영향을 자체 검토한다.
10. 작업 결과에 다음을 요약한다.
    - 구현 내용
    - 주요 파일
    - 실행한 검증 명령
    - 남은 위험 또는 후속 작업

사용자에게 작업 시간을 약속하거나 백그라운드 완료를 말하지 않는다. 현재 세션에서 가능한 범위까지 구현하고 검증한다.

---

## 21. Git Flow와 PR 규칙

- 일상 개발의 통합 브랜치는 `develop`, 안정적인 릴리스 브랜치는 `main`으로 둔다.
- 작업은 최신 `develop`에서 만든 짧은 수명의 작업 브랜치에서 수행한다.
- 브랜치 이름은 목적을 드러내며 `feature/*`, `fix/*`, `docs/*`, `refactor/*`, `test/*`, `chore/*` 접두사를 사용한다.
- 하나의 브랜치와 PR에는 하나의 집중된 변경만 담는다. 무관한 리팩터링·의존성 업데이트는 섞지 않는다.
- 커밋은 Conventional Commits 형식 `type(scope): subject`를 사용한다. 주요 type은 `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`, `ci`, `perf`, `revert`다.
- push 또는 PR 생성 전 관련 `lint`, `typecheck`, 테스트를 통과시킨다. DB 변경은 migration 재적용과 RLS 검증을, Expo 네이티브 의존성 변경은 iOS와 Android development build 확인을 추가한다.
- PR과 최종 보고에는 변경 파일 요약, 실행한 검증 명령 및 결과, 데이터/보안 영향, 남은 위험 또는 수동 QA 항목을 정확히 기록한다. 실행하지 못한 검증은 통과했다고 주장하지 않는다.
- 이 규칙은 Git 저장소가 초기화된 뒤 적용한다. 저장소 초기화, 브랜치 생성, 커밋, push, PR 생성은 사용자가 명시적으로 요청한 경우에만 수행한다.

---

## 22. 코드 리뷰 체크리스트

### 기능

- [ ] PRD 수용 기준을 만족하는가?
- [ ] 솔로 흐름이 친구방 기능 없이도 완결되는가?
- [ ] 친구방 화면에서 데이터 복사가 아니라 참조가 사용되는가?
- [ ] 같은 방 멤버가 같은 날짜에 같은 mission_id를 보는가?
- [ ] 2명과 6명 레이아웃이 모두 동작하는가?
- [ ] 1/6/9 상태가 일관적인가?

### 데이터

- [ ] 중복 일일 기록이 방지되는가?
- [ ] 사진 최대 9장이 DB에서도 보장되는가?
- [ ] 삭제와 늦은 업로드가 충돌하지 않는가?
- [ ] KST 날짜가 올바른가?

### 보안

- [ ] RLS가 있는가?
- [ ] 다른 사용자의 private storage 경로를 추측해도 읽을 수 없는가?
- [ ] service role key가 없는가?
- [ ] 초대 토큰 원문을 저장하지 않는가?

### UX

- [ ] 사진 업로드 중에도 로컬 결과를 볼 수 있는가?
- [ ] 네트워크 오류가 촬영을 막지 않는가?
- [ ] 색만으로 상태를 전달하지 않는가?
- [ ] 작은 화면/큰 글자에서 사용할 수 있는가?

### 유지보수

- [ ] 새 의존성이 정말 필요한가?
- [ ] 중복 컴포넌트/유틸리티를 만들지 않았는가?
- [ ] 도메인 로직이 화면에 묻혀 있지 않은가?
- [ ] 테스트가 행동을 검증하고 구현 세부사항에 과도하게 결합되지 않았는가?

---

## 23. 금지 사항

- `pnpm`, `yarn`, `bun` 사용
- 공개 Storage bucket
- 앱에 service role key 포함
- 클라이언트 랜덤으로 오늘의 미션 또는 방 미션 확정
- 사진 base64 저장
- 친구 사진을 내 개인 일일 기록 테이블에 복사
- 1:1 pair 구조를 친구방 MVP로 고정
- 방 정원과 활성 방 제한을 UI에서만 검사
- 화면 컴포넌트에서 직접 복잡한 SQL/RPC 호출
- KST 날짜 로직 복제
- 테스트 통과를 위해 타입/린트 규칙 비활성화
- 요청되지 않은 대규모 리팩터링
- 관련 없는 패키지 업그레이드
- mock 데이터를 실제 성공 경로처럼 남겨두기
- 사진 업로드 성공 전 로컬 원본 삭제
- RLS 없이 UI에서만 접근 제한
- 색상 검증 실패로 MVP 사진 저장 차단
- 공개 피드, 랭킹, 채팅을 선제적으로 구현

---

## 24. 환경 변수

예시 이름:

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
EXPO_PUBLIC_APP_SCHEME=mycolorlog
```

규칙:

- 앱에서 필요한 공개 값만 `EXPO_PUBLIC_` 사용
- 서버 전용 비밀은 Edge Function 환경에만 저장
- 시작 시 환경 변수 스키마를 검증하고 누락 시 개발자에게 명확한 오류를 제공

---

## 25. 완료 정의

기능은 다음 조건을 모두 만족해야 완료다.

- PRD 수용 기준 충족
- iOS/Android 동작 고려
- 로딩/빈 상태/오류 상태 구현
- 접근성 레이블과 터치 영역 검토
- 관련 테스트 통과
- typecheck 통과
- lint 통과
- DB 변경 시 migration과 RLS 포함
- 환경 변수 또는 설정 변경 문서화
- 사용하지 않는 코드와 debug log 제거
- 사용자 사진/개인정보가 로그에 노출되지 않음

---

## 26. 공식 문서 우선순위

라이브러리 사용법이 불확실하면 블로그보다 공식 문서를 우선한다.

- Expo: https://docs.expo.dev/
- React Native: https://reactnative.dev/docs/getting-started
- Supabase Expo: https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native
- Supabase Anonymous Auth: https://supabase.com/docs/guides/auth/auth-anonymous
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security

최신 공식 문서와 현재 저장소 버전이 다르면 현재 `package.json`과 lockfile의 버전에 맞는 문서를 확인한 뒤 구현한다.
