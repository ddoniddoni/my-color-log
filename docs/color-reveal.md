# 자정과 오늘의 색 공개

관련 요구사항: FR-MISSION-001, FR-MISSION-002, FR-MISSION-004. 개인·친구방별 기존 시간대 정책과 서버가 결정한 미션을 유지한다. DB와 RLS에는 변경이 없다.

## 화면과 동작

- 공개 전 `00:00`을 중심으로 실제 서버 팔레트의 얇은 컬러 링을 보여준다. 결과 색 이름은 공개 전 접근성 레이블에도 노출하지 않는다.
- 링이 1,650ms 동안 감속한 뒤 중앙에 색과 관찰 문구가 420ms 동안 나타난다. 결과는 자동으로 사라지지 않으며 사용자가 다음 화면으로 넘어간다.
- 모션 감소 시 회전·확대를 생략하고 180ms 페이드만 사용한다. 한국어·영어, 밝은·어두운 테마와 세로 스크롤을 지원한다.
- 공개 순간 `expo-haptics`로 iOS Soft / Android Confirm 피드백을 1회 제공한다. 모션 감소·백그라운드·웹에서는 생략한다. 모듈이 없거나 기기 설정으로 사용할 수 없어도 공개와 저장은 계속 동작한다.
- 날짜와 카운트다운을 하나의 시계에서 갱신한다. 백그라운드에서는 타이머를 멈추고 복귀 즉시 갱신한다. 자정 이후 새날 안내와 새 미션 공개 화면으로 전환한다.
- 날짜·계정·미션이 바뀌면 이전 연출을 취소한다. 늦게 끝난 로컬 저장은 시작 당시 계정과 날짜에만 적용한다.
- 결과를 보여줄 때 로컬 공개 이력을 저장한다. 저장 실패 시 같은 색을 유지하고 다시 저장할 수 있다. 저장된 당일 결과는 재실행 시 공개 연출을 건너뛴다.

## 로컬 이력과 의존성

공개 이력을 `@mycolorlog/mission-reveal/v2/{userId}/{dateKey}`로 분리했다. 계정 구분이 없던 v1 이력은 새 계정에 승계하지 않으므로 업데이트 직후 당일 연출이 한 번 다시 나타날 수 있다. 기록·사진에는 영향이 없다. 계정 삭제 시 v1·v2 공개 이력을 모두 정리한다.

`npx expo install expo-haptics`로 SDK 57 호환 버전 `~57.0.3`만 추가했다. lockfile에는 해당 패키지 한 개만 추가되었다. 기존 development build에서 햅틱을 사용하려면 네이티브 빌드를 다시 만들어야 한다. 별도 환경 변수나 서버 설정은 없다. [Expo Haptics 공식 문서](https://docs.expo.dev/versions/v57.0.0/sdk/haptics/).

## 검증

```bash
npm test -- --runInBand MissionReveal missionReveal dailyColorClock dailyMission
npm run typecheck
npm run lint
npm test -- --runInBand
npx expo install --check
CI=1 npx expo export --platform ios --platform android --output-dir /tmp/mycolorlog-midnight-reveal-export
```

테스트는 자정·DST·앱 복귀, 공개 중복 실행, 결과 유지, 저장 재시도, 계정·날짜 변경 중 늦은 완료, 오프라인 공개 이력, 모션 감소를 확인한다. 브라우저 검증은 실제 컴포넌트를 임시 테스트 데이터로 렌더링하며 제품에 미리보기 경로나 테스트 데이터를 추가하지 않는다.

출시 전 실제 iOS/Android development build에서 햅틱 강도, 23:59:59 → 00:00, 공개 중 앱 종료·복귀, VoiceOver/TalkBack, 큰 글자와 작은 화면을 확인한다. 번들 생성과 브라우저 검증은 네이티브 빌드·실기기 검증을 대신하지 않는다.
