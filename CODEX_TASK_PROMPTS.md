# Codex 작업 프롬프트 모음 — 친구방 중심 v0.2

아래 프롬프트는 한 번에 하나씩 Codex에 전달한다. 전체 앱을 한 번에 요청하지 않는다. 각 작업 전에 `AGENTS.md`, `PRD.md`, `DESIGN.md`와 기존 코드를 읽게 한다.

---

## 0. 저장소 점검 및 계획

```text
Read AGENTS.md, PRD.md, DESIGN.md, package.json, app config, and every existing Supabase migration before changing anything.

Inspect and report:
1. Current Expo/React Native/TypeScript setup.
2. Navigation and folder structure.
3. Dependencies and package-manager state.
4. Supabase integration and migration history.
5. Any existing data model that conflicts with the v0.2 friend-room model.
6. The smallest ordered implementation plan.

Non-negotiable constraints:
- npm only. Never use pnpm, yarn, or bun.
- Keep package-lock.json.
- Do not upgrade unrelated dependencies.
- Do not create a public photo bucket or public social feed.
- Do not let the client choose the official daily mission.
- Do not implement a 1:1 pair model; the MVP room supports 2–6 active members.
- Do not copy a user’s entry or photos into room-owned records.

After inspection, apply only clearly safe foundational fixes. Run available typecheck, lint, and tests. Report exact commands and unresolved risks.
```

---

## 1. Phase 0 — 앱 기반

```text
Read AGENTS.md, PRD.md, and DESIGN.md. Implement only the project foundation.

Required:
- Expo Router shell for iOS and Android.
- Bottom tabs exactly: 오늘, 친구방, 다이어리.
- Safe-area-aware root layout.
- Strict TypeScript.
- Central design tokens.
- Reusable AppText, Button, IconButton, Surface, EmptyState, OfflineBanner, LoadingSkeleton.
- TanStack Query provider.
- Supabase client with React Native-compatible session storage.
- Runtime validation for public environment variables.
- Logging and analytics adapters with no-op development implementations.
- Top-level error recovery UI.
- npm scripts: start, ios, android, typecheck, lint, test, check.
- .env.example without secrets.

Do not implement camera, database migrations, or friend-room behavior yet unless safely integrating existing code. Use npm only and npx expo install for Expo-native modules. Do not prebuild or add ios/android directories without explicit approval.

Run npm run typecheck, npm run lint, and tests. Report exact results.
```

---

## 2. Slice 2A — 익명 시작과 온보딩

```text
Read PRD sections 10.1, 11.1, 12 S01-S03 and relevant AGENTS/DESIGN rules.

Implement:
- Session restoration.
- Three-step Korean onboarding including the persistent friend-room concept.
- Nickname validation, 2–12 characters.
- Supabase anonymous sign-in.
- profiles migration with RLS.
- Profile creation/upsert owned by auth.uid().
- Persist onboarding completion.
- Correct routing for loading, anonymous, onboarded, and failure states.

Never log secrets or user metadata. RLS must be enabled with the migration. Add tests for nickname validation, session routing, and DTO parsing. Use npm only and run all checks.
```

---

## 3. Slice 2B — 전역 일일 미션과 룰렛

```text
Read AGENTS date/mission rules and PRD sections 11.2, 12 S04-S05, 14, and 15.2–15.3.

Implement the server-defined MVP mission flow:
- color_palette and daily_missions migrations.
- mission_type supports 'color'; seed a curated color palette.
- One global daily mission per Asia/Seoul challenge_date for MVP.
- Repository/query for the KST date mission.
- Shared KST date key and next-midnight utilities.
- Reveal state persisted per date on device.
- Roulette/reveal animation that always ends at the server mission color.
- Reduced-motion fallback.
- Today empty screen.
- Cache and retry behavior.

Never save a client-random fallback as official. Add tests for UTC/KST boundaries, countdown, unique date mission, and reveal reset. Explain how development rows are populated. Use npm only and run all checks.
```

---

## 4. Slice 2C — 첫 사진 로컬 기록

```text
Read AGENTS photo rules and PRD sections 10.1, 11.3, 11.4, 12 S06-S08.

Implement a local-first capture flow:
- Camera permission allowed, denied, permanently denied states.
- Full-screen Expo camera.
- Capture and review.
- Retake, use photo, optional caption.
- Normalize/compress for later upload.
- Stable UUID at capture time.
- Persist PendingPhoto with userId, entryId, missionId, dateKey, localUri, position, caption, timestamps, and status.
- Show the local photo immediately on Today.
- Adaptive PhotoMosaic initially for 1–4, extensible to 9.
- SyncBadge.
- App-restart recovery.

Do not upload in this slice unless an existing queue is already proven. Do not store base64 or delete local files. Add state-machine and serialization tests. Use npm only and run checks.
```

---

## 5. Slice 3 — 개인 일일 기록과 업로드 큐

```text
Read AGENTS data ownership/photo queue/RLS/date rules and PRD sections 15.4–15.5, 16–19, and acceptance criteria.

Implement:
- daily_entries and entry_photos migrations.
- Private Storage bucket and policies.
- Unique personal entry per user/mission and per user/date for MVP.
- Maximum nine photos enforced by the database.
- Owner consistency enforcement.
- Idempotent get-or-create entry.
- Idempotent photo upload using client UUID.
- Persistent upload queue with local_saved/pending/uploading/synced/failed/cancelled.
- Bounded retry and resume on launch, foreground, and network recovery.
- Local visibility during pending/failure.
- Delete/cancel protection against late upload recreation.
- Today support for 1–9 photos, reorder, delete, 1/6/9 states.

Store only storage_path, never public URLs. Keep local source until sync is confirmed. Add race, limit, queue, retry, and delete-conflict tests. Run all checks.
```

---

## 6. Slice 4 — 개인 다이어리

```text
Read PRD sections 11.6, 12 S16-S17 and DESIGN diary rules.

Implement:
- Month navigation.
- Efficient month summary using daily mission color and personal recorded state.
- Accessible ColorCalendarDay.
- Today, selected, recorded, unrecorded past, future-disabled states.
- Selected-day preview.
- Personal day detail with only current-user photos, captions, and note.
- Edit own note/caption and delete own photo.
- Empty past date still shows the assigned mission color.
- A separate room-day link when the personal entry is shared, without mixing room-member photos.

Do not preload full-resolution photos for the month. Add tests for calendar states, future blocking, and personal-only filtering. Use npm only and run checks.
```

---

## 7. Slice 5A — 익명 계정의 이메일 OTP 연결

```text
Read AGENTS authentication rules and PRD FR-AUTH-002.

Implement account upgrade while preserving the existing auth user id:
- Email entry and one-time code flow.
- Link identity to the anonymous user.
- Preserve all existing entries and photos under the same user id.
- Friendly Korean errors for conflict, expired/wrong code, rate limit, and network failure.
- Require permanent account before creating or joining a friend room.
- Warn anonymous users before sign-out.

Do not create a second account and copy data. Follow the official flow compatible with repository versions. Add UI/routing tests where feasible. Use npm only and run checks.
```

---

## 8. Slice 5B — 친구방 스키마와 안전한 초대

```text
Read PRD sections 10.3–10.4, 11.5 FR-ROOM-001 through FR-ROOM-004, 15.6–15.10, 17, and AGENTS friend-room invariants.

Implement the friend-room foundation:
- rooms, room_members, room_invites, room_invite_uses, and room_daily_missions migrations.
- Room name 2–20 characters, optional emoji, max_members 2–6.
- Creator becomes active owner.
- One active room per user, enforced server-side.
- One active owner per room.
- Room create UI.
- Reusable invite with secure random token/hash, 6-digit display code, 24-hour expiration, max_uses/use_count, revoke, and regenerate.
- Join preview with room name, owner, members, current capacity, and privacy consent.
- Atomic acceptance that prevents self-accept, duplicate membership, invite overuse, room over-capacity, and joining while already in another active room.
- room_daily_missions unique per room/date and bound server-side to that date’s global daily_missions row.
- Friend Room empty/create/invite/join states.

RLS and concurrency are release-blocking. Add SQL/integration tests or documented reproducible checks for simultaneous final-seat acceptance and unrelated-user access. Use npm only and run checks.
```

---

## 9. Slice 5C — 친구방 오늘 보드와 개인 기록 공유

```text
Read PRD sections 10.5–10.7, 11.5 FR-ROOM-005 through FR-ROOM-010, 12 S13-S15, 15.11, 17, and DESIGN room rules.

Implement:
- entry_room_shares migration and RLS.
- Explicit consent when joining that current/future daily entries are visible in the room.
- If the current-day personal entry already exists and its mission matches room_daily_missions, link it by reference.
- Capturing from Today or Friend Room writes to the same personal daily entry.
- Active room day query returning mission, active members, each member’s shared entry summary, photo count, and thumbnails.
- 2-member and 6-member RoomDailyBoard layouts.
- Current-user camera action.
- Read-only member day detail.
- Room history by date, respecting joined_at visibility.
- Refresh on foreground and optional narrowly scoped Realtime subscription.
- Personal diary remains personal-only.
- Leaving a room stops future sharing and removes access to other members while preserving own diary.
- Owner transfer and room end flows with atomic server operations.

Never copy photos or entries into room-owned rows. Never allow a member to update/delete another member’s data. Test unrelated-user denial, left-member denial, matching mission requirement, reference-only sharing, owner transfer, and room end. Use npm only and run checks.
```

---

## 10. Slice 6 — 안정화와 출시 점검

```text
Read the full AGENTS definition of done and PRD acceptance criteria. Harden the MVP without adding P1/P2 features.

Verify and fix:
- Cold start and session/active-room recovery.
- KST date rollover in foreground/background.
- Capture before midnight and upload after midnight.
- room_daily_missions rollover and identical mission for every member.
- Offline capture of nine photos and later sync.
- Force-close during upload and queue recovery.
- Camera permission variants.
- Invite expiration, revoke, multi-use count, self-accept, duplicate join, existing-room conflict, and simultaneous final-seat acceptance.
- 2-member and 6-member room layouts.
- New member cannot see pre-join room records.
- Owner transfer, member leave, room end, and RLS access removal.
- Account deletion and Storage cleanup.
- Safe areas, keyboard avoidance, large text, reduced motion.
- No public URLs, service role key, friend photos in personal diary, client-random mission, or duplicated room photo records.
- Korean loading, empty, offline, room-full, invite-expired, and error copy.

Run npm run check and supported integration tests. Produce a passed/failed/manual-device release checklist. Never claim an unrun check passed.
```

---

## 11. P1 — 콜라주 공유

```text
Implement personal collage export for 1–9 current-user photos with optional date, color name, and subtle app mark. Save to device and open native share sheet. Never include other room members without a separately approved explicit-consent design. Preserve aspect ratios and output quality. Use npm only and test layout selection.
```

---

## 12. P1 — 비차단 색상 점수

```text
Prototype an optional local-first color-match score. Let the user tap an image region, sample pixels, and compare with the daily target color. Always allow “이 사진 사용” even for a low score. Do not upload sampled pixel data separately. Keep behind a feature flag. Inspect Expo compatibility before adding a native dependency. Use npm only and test pure color-distance functions.
```

---

## 13. Codex 작업 결과 형식

```text
In your final response, include:
1. What was implemented.
2. Main files changed.
3. Database migrations, constraints, functions, and RLS changes.
4. Commands actually run and their exact results.
5. Manual iOS/Android checks still required.
6. Known risks and intentionally deferred items.
Do not state that a check passed unless you actually ran it.
```
