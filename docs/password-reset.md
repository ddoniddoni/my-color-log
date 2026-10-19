# 비밀번호 재설정

요구사항: `PRD.md`의 FR-AUTH-005.

로그인 화면의 **비밀번호를 잊으셨나요?** → 이메일 입력 → 메일 링크 → 새 비밀번호와 확인 입력 → 변경 완료 → 로그인 순서다. 이메일 계정 존재 여부는 동일한 전송 안내로 감춘다. 전송 후 60초 동안 재전송 버튼을 비활성화하며 서버의 전송 제한도 안내한다.

## Supabase 운영 설정

1. 운영 프로젝트의 Authentication → URL Configuration → Redirect URLs에 `mycolorlog://auth/reset-password`를 추가한다. 개발·베타 앱은 각각 `mycolorlog-dev://auth/reset-password`, `mycolorlog-preview://auth/reset-password`를 사용하며 해당 서버에 별도로 허용한다. 앱은 `app.config.ts`로 결정된 네이티브 scheme을 우선하고, Expo 설정이 없는 도구에서만 `EXPO_PUBLIC_APP_SCHEME`을 fallback으로 사용한다. 커스텀 scheme을 바꾸면 네이티브 앱도 다시 빌드한다. [베타 빌드 안내](beta-builds.md)를 참고한다.
2. Authentication의 이메일 전송에 실제 사용 가능한 SMTP를 설정하고 발신 도메인을 확인한다. Supabase 기본 발송 서비스의 수신자 제한·전송 제한 때문에 일반 사용자에게 메일이 전달되지 않을 수 있다.
3. Reset Password 이메일 템플릿은 기본 `{{ .ConfirmationURL }}` 링크를 유지한다. 이 링크를 Supabase가 검증한 후 허용된 앱 주소로 돌려보낸다. 발송 업체의 링크 추적 기능은 인증 링크를 변형하지 않도록 끈다.
4. 테스트 계정으로 메일 수신, 링크 열기, 비밀번호 변경, 새 비밀번호 로그인을 확인한다. 이메일 확인(Confirm email)을 끄더라도 비밀번호 복구에는 이메일 발송이 필요하다.

`supabase/config.toml`에는 로컬 개발용 허용 주소가 추가되어 있다. 이 파일 변경만으로 **운영 프로젝트의 Redirect URLs나 SMTP 설정이 바뀌지는 않는다**. 이 작업에서는 운영 설정 변경 및 실제 이메일 발송을 수행하지 않았다.

선택적으로 이메일 템플릿에서 앱이 직접 OTP를 검증하도록 다음 링크를 사용할 수도 있다. 기본 템플릿에는 변경이 필요 없다.

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">비밀번호 재설정</a>
```

## 인증 및 데이터 경계

- 메일 요청은 `resetPasswordForEmail`과 명시적인 implicit flow를 사용한다. 기본 링크의 `access_token`/`refresh_token` 또는 위 템플릿의 `token_hash`를 지원한다. PKCE의 `code`만 포함한 링크는 지원하지 않는다.
- `app/+native-intent.tsx`가 종료 상태와 실행 상태의 외부 링크를 가로채고 `/auth/reset-password?recoveryId=...`로 바꾼다. 인증 정보는 라우트 파라미터, 로그, Query 캐시, AsyncStorage, SecureStore에 쓰지 않는다.
- 복구용 Supabase 클라이언트는 고유 storage key를 쓰며 `persistSession`, `autoRefreshToken`, `detectSessionInUrl`을 모두 끈다. 서버가 복구 세션을 확인한 뒤에만 `updateUser({ password })`를 허용한다.
- 복구 과정에서 앱의 기존 로그인 계정으로 전환하거나 기존 사진 큐를 초기화하지 않는다. 비밀번호 변경 후 서버의 세션 만료 정책은 그대로 적용된다.
- 중복 링크 수신은 진행 중인 동일 복구 요청을 재사용한다. 새 링크가 들어오면 이전 요청 결과를 무시한다. 화면을 닫거나 저장을 마치면 복구 클라이언트를 정리한다. 앱을 종료하면 메모리의 복구 상태는 사라지므로 링크를 다시 열거나 새 메일을 요청한다.
- 진행 중인 HTTP 요청은 화면을 닫아도 서버에서 완료될 수 있다. 늦은 응답으로 닫힌 화면이나 새 복구 시도를 변경하지 않는다.
- 기존 사진 선택 복구와 친구방 알림의 자동 이동은 복구 화면을 덮어쓰지 않도록 제한한다.
- DB 스키마, RLS, Storage 권한, 의존성에는 변경이 없다.

## 검증

```bash
npm test -- --runInBand passwordRecovery
npm run typecheck
npm run lint
npm test -- --runInBand
npx react-doctor@latest --verbose --scope changed
```

자동 테스트는 링크 검증·민감 파라미터 제거, 메모리 세션 분리, 중복 링크·중복 저장, 입력 검증, 만료·재시도, 이전 요청의 늦은 응답, 화면 종료 시 정리를 확인한다. 실제 SMTP와 네이티브 메일 앱의 동작을 대신하지 않는다.

### 실제 기기 출시 QA

iOS 및 Android development/release build에서 확인한다. Expo Go의 주소는 앱의 고정 scheme과 달라 출시 딥링크 검증에 사용하지 않는다.

- [ ] 로그인 화면에서 정상 이메일·잘못된 이메일·미가입 이메일을 입력하고 안내와 전송 제한을 확인한다.
- [ ] 앱 종료 상태, 백그라운드 상태, 실행 상태에서 메일 링크를 연다.
- [ ] 만료·이미 사용된 링크, 일부 인증 정보가 빠진 링크에서 새 메일을 요청한다.
- [ ] 링크를 연 직후 오프라인으로 전환하고 재연결 후 재시도한다.
- [ ] 8자 미만·확인 불일치·기존 비밀번호·서버 강도 제한을 확인한다.
- [ ] 저장 버튼 연타, 링크 중복 수신, 이전 링크 검증 중 새 링크 수신, 하드웨어 뒤로 가기를 확인한다.
- [ ] 다른 계정으로 로그인한 상태에서 복구해도 앱 계정과 업로드 대기 사진이 섞이지 않는지 확인한다.
- [ ] 변경 후 새 비밀번호 로그인 성공과 이전 비밀번호 로그인 실패를 확인한다.
- [ ] 알림·갤러리 복구가 재설정 화면을 덮지 않는지 확인한다.
- [ ] 작은 화면, 큰 글자, 키보드, 화면 읽기, 밝은/어두운 테마, 한국어/영어를 확인한다.

공식 문서: [Supabase 비밀번호 복구](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail), [네이티브 딥링크](https://supabase.com/docs/guides/auth/native-mobile-deep-linking), [이메일 템플릿](https://supabase.com/docs/guides/auth/auth-email-templates), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Expo native intent](https://docs.expo.dev/router/advanced/native-intent/).
