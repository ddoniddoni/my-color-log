# 오늘빛 — 기획·개발 문서 v0.2

React Native + Expo + TypeScript + Supabase로 만드는 **솔로 컬러 다이어리 + 2~6명 비공개 친구방** 앱 문서 세트다.

핵심 제품 구조:

```text
매일 서버가 오늘의 컬러 미션 확정
              ↓
솔로 사용자는 개인 기록
              ↓
친구방 멤버는 모두 같은 미션 수행
              ↓
사진 원본은 각자 개인 일일 기록에 한 번만 저장
              ↓
친구방은 참조 연결로 멤버별 결과 표시
              ↓
각자의 사진은 개인 다이어리에도 영구 보관
```

## 파일

- `PRD.md`: 제품 요구사항, 친구방 흐름, 데이터 모델, RLS, 수용 기준
- `AGENTS.md`: Codex와 코딩 에이전트의 비협상 구현 규칙
- `DESIGN.md`: React Native 디자인 시스템과 2~6명 방 화면 원칙
- `STITCH_PROMPTS.md`: Google Stitch 전체/화면별 디자인 프롬프트
- `CODEX_TASK_PROMPTS.md`: Codex에 순서대로 전달할 개발 작업 프롬프트
- `CHANGELOG.md`: v0.1에서 v0.2로 바뀐 핵심 결정

## 개발 전 확정값

- React Native + Expo + TypeScript
- Expo Router
- Supabase Auth/Postgres/Storage/Realtime
- npm only, `package-lock.json` 사용
- 사용자당 활성 친구방 1개
- 방장 포함 2~6명
- 방은 날짜가 지나도 유지
- 방 멤버는 매일 같은 서버 미션 수신
- MVP 미션 타입은 컬러
- 사진 원본은 개인 기록, 방은 참조만 사용
- 공개 피드/랭킹/채팅 없음

## 사용 순서

1. 저장소 루트에 `AGENTS.md`, `PRD.md`, `DESIGN.md`를 둔다.
2. `STITCH_PROMPTS.md`의 Master Prompt로 디자인을 만든다.
3. 2명과 6명 친구방 화면을 반드시 함께 생성한다.
4. Stitch 결과를 디자인 참고 자료로 저장소에 추가한다.
5. `CODEX_TASK_PROMPTS.md`의 0번부터 순서대로 Codex에 요청한다.
6. 각 단계에서 typecheck, lint, test와 RLS 검증 결과를 확인한다.

## 가장 중요한 구현 금지

- pnpm/yarn/bun 사용
- 1:1 pair 모델로 축소
- 방 정원을 UI에서만 검사
- 클라이언트가 공식 미션 결정
- 친구 사진을 내 기록에 복사
- 공개 Storage bucket
- service role key 앱 포함
- 업로드 성공 전 로컬 사진 삭제
