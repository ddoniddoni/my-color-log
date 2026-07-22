# Google Stitch 프롬프트 — Color Log 친구방 중심 모바일 앱

> 제품: Color Log
> 플랫폼: React Native + Expo, iOS / Android  
> 핵심: 솔로 컬러 다이어리 + 2~6명 비공개 친구방 + 매일 같은 미션  
> 패키지 매니저는 디자인 단계와 무관하지만 개발 핸드오프는 npm 기준

---

## 1. 권장 사용 순서

1. 아래 Master Prompt로 전체 화면 시스템을 생성한다.
2. 가장 제품 방향에 가까운 변형을 선택한다.
3. Consistency Refinement Prompt로 색, 간격, 타이포, 컴포넌트를 통일한다.
4. 화면별 프롬프트로 누락 상태를 추가한다.
5. Prototype Flow Prompt로 화면 전환을 연결한다.
6. 디자인 비평 프롬프트로 공개 SNS, 게임 점수판, 웹 대시보드 느낌을 제거한다.
7. 이미지 또는 Figma 결과를 `PRD.md`, `DESIGN.md`, `AGENTS.md`와 함께 Codex에 전달한다.

---

## 2. Master Prompt

```text
Design a polished native mobile app called “Color Log” for iOS and Android.

Product concept:
“매일 하나의 색으로 내 하루를 기록하고, 친구방을 만들면 같은 미션으로 모인 서로 다른 하루를 함께 보는 컬러 포토 다이어리.”

The app must support two complete experiences:
1. Solo: a user receives one daily color mission and records 1–9 photos in a personal diary.
2. Private friend room: a user creates or joins one persistent room with 2–6 members. Every day all members in that room receive the exact same mission. Each person photographs their own real-life discoveries. The room shows member-by-member results, while every photo remains owned by and saved in the photographer’s personal diary.

Important product rules:
- A friend room persists across days; it is not a one-day invite or temporary match.
- The same room receives a new mission every KST day.
- In MVP, the mission is always a color-discovery mission.
- A user can have one active friend room in MVP.
- A room supports 2–6 active members.
- A photo is created once. It appears in the owner’s personal diary and, through sharing permission, in the active room. Never visually imply that the room owns the photo.
- Friend photos never mix into the user’s personal diary mosaic.
- The room is private and invite-only. No public feed, follower count, public search, leaderboard, chat, or comments.
- Progress is gentle: 1 photo means recorded, 6 means complete, 9 means full. Do not frame fewer photos as failure.
- The daily roulette reveals a server-defined color. It is not a user reroll mechanic.
- Offline-captured photos remain visible with calm sync indicators.

Brand feeling:
quiet discovery, warm observation, private memory, light connection, accumulated value.
Avoid childish color-game visuals, neon gaming UI, rainbow gradients, public social feed aesthetics, heavy habit dashboards, and scrapbook clutter.

Visual system:
- Warm neutral canvas such as #F7F5F1.
- White surfaces, soft gray borders, very subtle or no shadows.
- User photography is the strongest visual element.
- Today’s color is a dynamic accent used only for the hero disc, chips, selected states, thin progress accents, and calendar marks.
- System-native Korean typography with comfortable 16px body text.
- Rounded but not childish: 12–24px radii.
- Safe-area-aware native mobile layouts for a 390x844 portrait reference.
- Use straightforward stacks, flex layouts, adaptive photo mosaics, native bottom tabs, and reusable cards that can be implemented in React Native.

Bottom tabs must be exactly:
- 오늘
- 친구방
- 다이어리

Create a complete coherent screen set with realistic Korean copy and these states:
1. Three-step onboarding.
2. Nickname setup.
3. Daily color roulette reveal.
4. Today empty state.
5. Today with 3 photos.
6. Today completed with 6 photos.
7. Today full with 9 photos.
8. Full-screen camera.
9. Photo review after capture.
10. Friend Room tab with no active room.
11. Create Room screen with room name and optional emoji.
12. Invite screen with reusable 6-digit code, share link, expiration, current members, and remaining capacity.
13. Join Room preview with room name, owner, members, capacity, and clear privacy consent.
14. Active Friend Room with 2 members.
15. Active Friend Room with 6 members.
16. Active room where some members have no photos yet.
17. Room member day detail, read-only.
18. Room history by date.
19. Monthly personal diary calendar.
20. Personal diary day detail showing only the current user’s photos.
21. Offline, pending upload, failed upload, expired invite, room full, and already-in-another-room states.
22. Settings with active room management, transfer ownership, leave room, end room, sign out, and delete account.

Today screen hierarchy:
- Date and profile/settings.
- Daily color mission hero.
- Personal progress.
- Adaptive personal photo mosaic.
- Camera CTA.
- Active room summary with room name and member participation.
- Optional personal note.

Friend Room screen hierarchy:
- Room name, member count, invite/settings.
- Same daily mission hero for the whole room.
- Gentle copy: “같은 미션, 서로 다른 하루.”
- Member cards for 2–6 people, each clearly separated by owner.
- Each member card shows nickname, photo count, status, and up to three thumbnails.
- The current user card has a clear camera action.
- Do not make the cards look like a ranking or versus board.
- Add a calm room-history section.

Personal diary requirements:
- Monthly calendar colored by the assigned daily mission.
- Recorded vs unrecorded states must not rely on color alone.
- Day detail shows only the owner’s photos and captions.
- If the day was shared to a room, show a separate link such as “퇴근길 색수집단에서 함께 본 이날.”

Use natural Korean copy such as:
- “매일 하나의 색을 발견해요.”
- “한 장만 남겨도 오늘의 기록이에요.”
- “친구방을 만들면 같은 미션으로 서로 다른 하루가 보여요.”
- “같은 미션, 서로 다른 하루.”
- “우리 방에 세 가지 빨강이 모였어요.”
- “내 사진은 내 다이어리에 그대로 남아요.”
- “초대한 사람끼리만 보는 비공개 방이에요.”
- “민지의 오늘은 아직 비어 있어요.”
- “지금은 오프라인이에요. 사진은 안전하게 보관하고 있어요.”

Do not add unsupported features. Return production-ready high-fidelity mobile screens and a consistent reusable component system.
```

---

## 3. Consistency Refinement Prompt

```text
Refine all generated screens into one consistent native mobile design system.

Keep the bottom tabs exactly: 오늘, 친구방, 다이어리.
Use one warm neutral base system and inject only the current daily color as a dynamic accent.
Normalize typography, spacing, button heights, corner radii, icon stroke, headers, safe-area padding, photo mosaic gaps, empty states, and status badges.

Make ownership unmistakable:
- each member has a separate card or section,
- room photos are never merged into one ownerless collage,
- the personal diary contains only the current user’s photos.

Make the 2-member and 6-member room screens feel like the same component system. Use a vertical list or responsive two-column card grid that remains readable on narrow phones. Remove all ranking, versus, winner, loser, score-difference, public-feed, follower, chat, and comment patterns.

Ensure Korean copy is concise, warm, and non-judgmental. Ensure color names are always written as text for accessibility.
```

---

## 4. 화면별 프롬프트

### 4.1 온보딩

```text
Design three swipeable onboarding screens for Color Log.

1. “매일 하나의 색을 발견해요.” Show one calm color disc and small real-life photo fragments.
2. “스쳐 간 장면은 나만의 다이어리에 쌓여요.” Show a personal monthly color archive and photo pages.
3. “친구방을 만들면 같은 미션으로 서로 다른 하루가 보여요.” Show 3–4 clearly separate personal photo cards connected by one shared color mission. Add “초대한 사람끼리만 보는 비공개 방이에요.”

Primary final CTA: “오늘의 색 만나기.”
Do not show a public feed, follower graph, chat, leaderboard, or merged group collage.
```

### 4.2 닉네임 설정

```text
Design a calm nickname setup screen.
Headline: “어떻게 불러드릴까요?”
Body: “다이어리와 친구방에서 보여줄 이름이에요.”
Input length: 2–12 characters with character count.
Primary CTA: “시작하기.”
Secondary reassurance: “나중에 설정에서 바꿀 수 있어요.”
Do not add profile-photo selection yet.
```

### 4.3 오늘의 컬러 룰렛

```text
Design a daily color reveal screen. The roulette is a reveal animation for an already server-selected result, not a reroll game.

Use a warm neutral full screen with a centered restrained color wheel or sequence of color discs. It should decelerate and stop on “체리 레드.” Then reveal:
- “오늘의 색”
- “체리 레드”
- “오늘 스쳐 간 체리 레드를 찾아보세요.”
- CTA “찾으러 가기”

Add a reduced-motion alternative using fade and scale only. No casino styling, spin-again button, coins, confetti, or score.
```

### 4.4 오늘 — 빈 상태

```text
Design the Today tab with zero photos.
Show date, time remaining, daily color hero, a large camera CTA “첫 번째 색 발견하기,” and “한 장만 남겨도 오늘의 기록이에요.”
If an active room exists, show a subtle room summary card:
“퇴근길 색수집단 · 4명” and “모두 같은 체리 레드를 찾고 있어요.”
Bottom tabs: 오늘 selected, 친구방, 다이어리.
```

### 4.5 오늘 — 진행/완성 상태

```text
Create three variants of the Today tab using the same component system:
- 3 photos: “체리 레드를 3장 모았어요.”
- 6 photos: “6장의 체리 레드로 오늘을 완성했어요.”
- 9 photos: “오늘의 색을 가득 채웠어요.”

Use an adaptive personal PhotoMosaic: 3 photos as a balanced layout, 6 as a stable grid, 9 as 3x3. Keep the camera action available until 9. Show a small line “퇴근길 색수집단에도 보여요.” Do not imply that the room owns the photos.
```

### 4.6 카메라

```text
Design a minimal full-screen camera for one-handed use.
Controls: close, flash, large shutter, and a small “오늘의 체리 레드” chip. Respect safe areas and high contrast over the live preview.
Do not add filters, stickers, beauty tools, gallery carousel, public posting, or audience controls.
```

### 4.7 사진 검토

```text
Design the post-capture review screen.
Show the photo large, “다시 찍기,” “이 사진 사용,” optional caption placeholder “이 장면을 한마디로 남겨보세요,” and a daily-color chip.
Show “저장하면 내 오늘 다이어리에 추가돼요.”
When an active room exists, show a clear but calm line: “퇴근길 색수집단에도 함께 보여요.”
Do not add a public audience selector.
```

### 4.8 친구방 — 없음

```text
Design the Friend Room tab with no active room.
Headline: “같은 미션, 서로 다른 하루.”
Body: “친구방을 만들면 매일 같은 색을 받고 각자의 발견을 함께 볼 수 있어요.”
Reassurance: “내 사진은 내 다이어리에 그대로 남아요.”
Privacy: “초대한 사람끼리만 보는 비공개 방이에요.”
Primary CTA: “친구방 만들기.”
Secondary CTA: “초대 코드 입력.”
Use a refined visual of 3–4 separate photo cards connected by one shared color disc.
```

### 4.9 친구방 만들기

```text
Design a Create Friend Room screen.
Header: “친구방 만들기.”
Fields:
- Room name, example “퇴근길 색수집단,” 2–20 characters.
- Optional emoji or simple icon selector.
Explain: “방장 포함 최대 6명까지 함께할 수 있어요.”
Explain: “방은 매일 유지되고, 자정이 지나면 새 미션이 열려요.”
Primary CTA: “방 만들기.”
Keep it simple and native; no cover-photo editor or public discoverability settings.
```

### 4.10 친구 초대

```text
Design a room invite screen.
Show room name, current members “1 / 6명,” and member avatars or initials.
Show a large reusable 6-digit code such as “482 719,” copy action, native share-link action, expiration “24시간 동안 유효해요,” and remaining capacity “5명 더 참여할 수 있어요.”
Add quiet actions for “초대 취소” and “새 코드 만들기.”
Explain that only people with the code/link can join. Do not request contact-list permission or show public user search.
```

### 4.11 친구방 참여 확인

```text
Design a Join Room preview reached from a link or code.
Show:
- Room name and emoji
- Owner nickname
- Current member avatars
- “4 / 6명” capacity
- Today’s shared color mission preview
- Consent text: “참여하면 이 방의 멤버에게 내 오늘 기록이 보여요. 내 사진은 내 다이어리에도 그대로 남아요.”
Primary CTA: “이 방에 참여하기.”
Secondary CTA: “취소.”
Also create an error variant: “이미 다른 친구방에 참여 중이에요.”
```

### 4.12 친구방 — 활성 2명

```text
Design the active Friend Room tab for two members.
Top: room name, “2명,” invite button, settings, date, and the exact shared color mission.
Title: “같은 미션, 서로 다른 하루.”
Show two equal member cards, one for “나” and one for “민지.” Each card has name, photo count, gentle status, and adaptive photo previews. The current user card has a camera action.
Do not use versus symbols, score bars, winner/loser, ranking, or merged ownership.
Add a calm “지난 미션” section below.
```

### 4.13 친구방 — 활성 6명

```text
Design the same active Friend Room experience for six members on a narrow phone.
Use a readable vertical list or responsive two-column cards. Each member card shows avatar/initial, nickname, 0–9 count, one gentle status line, and up to three small thumbnails.
Keep the daily mission visible without occupying the whole screen. The current user’s camera action must remain easy to reach. Avoid a dense dashboard, leaderboard, or tiny unreadable cards.
```

### 4.14 친구방 — 미참여 멤버 상태

```text
Refine the room screen for a day when some members have not photographed anything.
Use copy such as:
- “민지의 오늘은 아직 비어 있어요.”
- “조금 뒤 다른 빨강이 찾아올지도 몰라요.”
Do not label anyone incomplete, late, losing, or failed. Do not add a prominent nag button.
```

### 4.15 방 멤버 날짜 상세

```text
Design a read-only room member day detail.
Show member name, date, shared color mission, 1–9 photos, and captions. Make it clear this is the member’s record.
Do not show edit, delete, save-to-my-diary, or re-upload actions. A subtle emoji reaction placeholder may be shown only as a future-state annotation, not a required MVP control.
```

### 4.16 친구방 기록

```text
Design a Room History screen.
Show chronological daily mission cards with date, color name, participating-member count, and a few member thumbnails. Selecting a date opens a member-by-member shared-day view.
For a new member, show an access boundary message for days before joining: “이 방에 참여한 날부터 기록을 볼 수 있어요.”
Do not merge all members’ photos into one ownerless archive.
```

### 4.17 다이어리 — 월/날짜 상세

```text
Design two personal Diary screens.

Monthly calendar:
- Header “2026년 7월”
- Previous/next controls
- “이번 달 12일을 기록했어요.”
- Each past date carries that day’s assigned color.
- Recorded and unrecorded states differ by fill, border, or photo indicator, not color alone.
- Future dates disabled.

Day detail:
- Date and color name
- Only the current user’s 1–9 photos and captions
- Optional personal note and edit action
- If shared to a room, separate link: “퇴근길 색수집단에서 함께 본 이날.”
Never mix other members’ photos into the personal mosaic.
```

### 4.18 오프라인과 오류

```text
Create consistent calm states:
- Offline banner: “지금은 오프라인이에요. 사진은 안전하게 보관하고 있어요.”
- Pending photo: “연결되면 업로드.”
- Failed upload: “아직 올리지 못했어요” + “다시 시도.”
- Invite expired: “초대가 만료됐어요.”
- Room full: “이 친구방은 6명으로 가득 찼어요.”
- Existing active room: “먼저 현재 친구방을 나가야 새 방에 참여할 수 있어요.”
Keep local photos visible and never block camera capture because of upload failure.
```

### 4.19 설정과 방 관리

```text
Design Settings with native grouped sections:
1. Profile and account status.
2. Notifications.
3. Photo save-to-device preference.
4. Active Friend Room: room name, member count, invite management.
5. Room actions: transfer ownership, leave room; show end-room only to owner.
6. Privacy and help.
7. Sign out.
8. Delete account as a separated destructive action.
Explain that leaving a room never deletes the user’s personal diary.
```

---

## 5. Prototype Flow Prompt

```text
Connect the screens into a coherent native mobile prototype:

Solo flow:
Onboarding → nickname → daily color reveal → Today empty → camera → photo review → Today with one photo → Diary month → personal day detail.

Create-room flow:
Friend Room empty → create room → invite screen → active room waiting for friends → friend joins → active 2-member room → active 6-member room.

Join-room flow:
Invite link/code → join preview → consent → active room. If the user already has Today photos, show them immediately in the room after consent because the personal entry is referenced, not copied.

Daily room flow:
Active room → camera → photo review → the same photo appears in the user’s Today mosaic and their room member card → open another member’s read-only detail → room history → selected past room day.

Management flow:
Room settings → invite management → transfer ownership or leave room → personal diary remains available.

Use push navigation for details, modal presentation for camera/photo review, and persistent bottom tabs for 오늘/친구방/다이어리. Preserve current mission state across all screens.
```

---

## 6. 디자인 비평 요청 프롬프트

```text
Critique and revise the design against these product principles:

- Is solo use complete without a room?
- Is a friend room clearly persistent across days?
- Is it obvious that every room member receives the exact same daily mission?
- Does the design work for both 2 and 6 members?
- Are personal photos clearly owned by the photographer?
- Does the room feel intimate rather than competitive?
- Are user photos more important than cards, badges, and metrics?
- Does one photo still feel like a meaningful diary record?
- Does the personal diary contain only the current user’s photos?
- Is today’s color a restrained dynamic accent rather than a full-screen color flood?
- Are offline, loading, invite-expired, room-full, and upload-failed states covered?
- Does this feel like a native mobile app rather than a web dashboard?

Remove anything resembling a public social feed, leaderboard, versus board, follower system, chat app, generic habit tracker, or childish color game. Return a refined production-ready design.
```

---

## 7. 보정 프롬프트

### 7.1 다이어리 느낌 강화

```text
Make the product feel more like a lasting personal photo diary and less like a challenge dashboard. Increase photo prominence and whitespace. Reduce numerical widgets, badges, and card clutter. Keep 1/6/9 milestones as gentle feedback. Strengthen the monthly color archive and personal day page. Keep the friend room as a sharing layer, not the owner of the photos.
```

### 7.2 친구방 연결감 강화

```text
Strengthen quiet connection among 2–6 close friends without turning the product into social media or competition. Emphasize how one shared daily mission appears differently in each person’s life. Keep each member’s diary card visually distinct. Add small signs of presence such as “새 사진,” recent thumbnails, and shared-day titles. Avoid chat bubbles, follower counts, ranking, winner/loser language, versus symbols, and public reactions.
```

### 7.3 6명 방 가독성 개선

```text
Optimize the active room for six members on a 320–430px wide phone. Keep member names, progress, and thumbnails readable. Prefer a vertical list or simple responsive two-column grid. Keep the current user capture action easy to reach. Remove any tiny metrics, dense dashboard panels, and horizontal layouts that require scrolling sideways.
```

### 7.4 과한 컬러 제거

```text
Use the warm neutral base across the app. Apply the color of the day only to the hero disc, selected states, small chips, thin progress accents, and calendar marks. Remove rainbow gradients, multicolor backgrounds, neon effects, and decorative color blobs that compete with user photos.
```

### 7.5 React Native 구현 친화적

```text
Refine the screens for clean React Native + Expo implementation. Use vertical stacks, flex layouts, FlatList/SectionList-friendly room members, adaptive image mosaics, native bottom tabs, safe-area-aware headers, reusable buttons and surfaces, and consistent spacing tokens. Avoid web-only hover states, irregular masks, heavy blur, custom shaders, and overlapping desktop layouts.

Identify reusable components: DailyMissionHero, PhotoMosaic, ProgressSummary, RoomMemberProgressCard, RoomDailyBoard, ColorCalendarDay, SyncBadge, CaptureButton, RoomInviteCard, and RoomHistoryDayCard.
```

---

## 8. 최종 산출물 체크리스트

- [ ] 전체 화면 한 세트
- [ ] 오늘 0/3/6/9장 상태
- [ ] 카메라/사진 검토
- [ ] 친구방 없음/생성/초대/참여 확인
- [ ] 활성 친구방 2명 상태
- [ ] 활성 친구방 6명 상태
- [ ] 일부 멤버 미기록 상태
- [ ] 멤버 날짜 상세
- [ ] 방 날짜별 기록
- [ ] 개인 다이어리 월/날짜 상세
- [ ] 오프라인/업로드 실패/초대 만료/방 정원 초과/기존 방 충돌
- [ ] 설정과 방장 위임/나가기/종료
- [ ] 컴포넌트 이름과 상태 설명
- [ ] 390×844 기준과 작은 화면 변형
- [ ] 공개 SNS나 경쟁 UI가 제거됨

---

## 9. Codex 전달 시 함께 주는 문장

```text
Treat the Stitch output as visual intent, not as a replacement for PRD.md or AGENTS.md. Implement the room model and data ownership exactly as specified in PRD.md. A photo must be stored once in the owner’s personal entry and referenced by the room. The room supports 2–6 members, one active room per user in MVP, and one server-defined mission per room/date. Use npm only.
```
