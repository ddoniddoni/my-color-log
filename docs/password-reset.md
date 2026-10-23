# 비밀번호 재설정

요구사항: `PRD.md`의 FR-AUTH-005.

로그인 화면의 **비밀번호를 잊으셨나요?** → 이메일 입력 → 메일 링크 → 새 비밀번호와 확인 입력 → 변경 완료 → 로그인 순서다. 이메일 계정 존재 여부는 동일한 전송 안내로 감춘다. 전송 후 60초 동안 재전송 버튼을 비활성화하며 서버의 전송 제한도 안내한다.

## Supabase 운영 설정

1. 운영 프로젝트의 Authentication → URL Configuration → Redirect URLs에 `mycolorlog://auth/reset-password`를 추가한다. 개발·베타 앱은 각각 `mycolorlog-dev://auth/reset-password`, `mycolorlog-preview://auth/reset-password`를 사용하며 해당 서버에 별도로 허용한다. 앱은 `app.config.ts`로 결정된 네이티브 scheme을 우선하고, Expo 설정이 없는 도구에서만 `EXPO_PUBLIC_APP_SCHEME`을 fallback으로 사용한다. 커스텀 scheme을 바꾸면 네이티브 앱도 다시 빌드한다. [베타 빌드 안내](beta-builds.md)를 참고한다.
2. Authentication의 이메일 전송에 실제 사용 가능한 SMTP를 설정하고 발신 도메인을 확인한다. Supabase 기본 발송 서비스의 수신자 제한·전송 제한 때문에 일반 사용자에게 메일이 전달되지 않을 수 있다.
3. Reset Password 이메일 템플릿은 기본 `{{ .ConfirmationURL }}` 링크를 유지한다. 이 링크를 Supabase가 검증한 후 허용된 앱 주소로 돌려보낸다. 발송 업체의 링크 추적 기능은 인증 링크를 변형하지 않도록 끈다.
4. 테스트 계정으로 메일 수신, 링크 열기, 비밀번호 변경, 새 비밀번호 로그인을 확인한다. 이메일 확인(Confirm email)을 끄더라도 비밀번호 복구에는 이메일 발송이 필요하다.

`supabase/config.toml`에는 세 앱 variant의 로컬 개발용 허용 주소가 들어 있다. 이 파일 변경만으로 **운영 프로젝트의 Redirect URLs나 SMTP 설정이 바뀌지는 않는다**. 현재 공유 서버에 별도로 적용한 결과는 아래 운영 점검 기록을 참고한다.

### 공유 프로젝트에서 설정할 때

- 기존 다른 앱의 Site URL과 Redirect URLs를 유지한다. 필요한 Color Log 주소만 추가하고 `*` 허용 주소를 사용하지 않는다.
- SMTP 발신자, 이메일 템플릿, 전송 제한은 프로젝트 전체가 공유한다. Color Log 전용 브랜딩으로 일괄 변경하기 전에 다른 앱의 발송 요구를 확인한다. `cl_` 테이블 이름은 Auth 메일 설정을 분리하지 않는다.
- 저장소의 전체 `supabase/config.toml`을 운영 서버에 push하지 않는다. 이번 주소 추가는 CLI 2.121.0에서 **기존 허용 주소 + Color Log 주소를 담은 `auth.additional_redirect_urls`만 선언한 임시 설정**으로 수행했다. `config diff`에서 선언된 변경이 해당 항목 하나인지 검토한 뒤 적용하고 다시 조회했다. CLI 버전이 바뀌면 생략한 속성을 보존하는지 먼저 확인한다.
- SMTP 비밀번호/API 키는 앱의 `.env`, `EXPO_PUBLIC_*`, 저장소에 넣지 않는다. Supabase의 서버 설정에만 입력한다.

### 운영 점검 기록 — 2026-10-24

대상은 당시 로컬 `.env`가 가리키는 공유 Supabase 서버다. 다른 서버로 전환하면 동일 점검이 필요하다.

| 항목 | 결과 |
| --- | --- |
| 앱 복구 주소 | 개발·베타·운영의 정확한 주소 3개를 서버에 추가했다. 기존 다른 앱 주소 2개를 포함해 총 5개다. |
| 기존 공유 설정 | CLI 적용 결과는 `auth.additional_redirect_urls` 한 항목뿐이다. 적용 후 재조회한 다른 설정은 변경 전과 동일하다. |
| 메일 발송 환경 | 사용자 지정 SMTP, Send Email Hook, 비밀번호 변경 알림이 비활성 상태다. SMTP 연결과 실제 메일 전달 검증은 미완료다. |
| 서버 복구 흐름 | 각 variant별 임시 계정으로 복구 링크 생성 → 서버 검증 → 해당 앱 주소와 recovery 토큰 반환을 확인했다. |
| 일반 사용자 권한 | publishable key 클라이언트로 복구 세션 확인 → 비밀번호 변경 → 새 비밀번호 로그인에 성공했다. 이전 비밀번호와 사용한 복구 토큰은 거부됐다. |
| 테스트 데이터 | 생성한 임시 계정 3개는 세션 정리 후 삭제했다. 자격 증명과 복구 링크는 로그나 저장소에 남기지 않았다. |
| 실제 메일·기기 | 메일 발송과 iOS/Android 앱 실행은 수행하지 않았다. 아래 실제 기기 QA가 남아 있다. |

서버 검증은 관리자 `generateLink`로 **메일을 보내지 않고** 링크를 만들었다. 관리자 권한은 임시 계정과 링크 생성·정리에만 사용했고, 비밀번호 변경과 로그인은 일반 사용자 API로 검증했다. 이 결과는 SMTP 전송, 받은편지함 도착, 이메일 템플릿, 기기에서 앱 열기 검증을 대신하지 않는다.

### 남은 메일 연결 순서

1. 사용할 발신 도메인과 메일 발송 서비스를 정한다. 공유 프로젝트의 다른 앱도 같은 발신 설정을 쓰는지 확인한다.
2. 발송 서비스에서 도메인을 검증하고 안내하는 DNS 레코드를 등록한다. 인증 메일의 링크 추적은 끈다.
3. Supabase Custom SMTP에 호스트·포트·사용자·비밀 키·발신 주소·발신 이름을 설정한다. 기존 Site URL, 이메일 확인 정책, 다른 앱의 템플릿을 함께 덮어쓰지 않는다.
4. 합의한 테스트 수신 주소로 앱의 재설정 요청을 보내 실제 도착과 링크를 확인한다. 서버 전송 제한과 발송 서비스의 실패 기록도 확인한다.
5. 마지막 통합 기기 QA에서 앱 종료·실행 상태의 메일 링크, 비밀번호 변경과 재로그인을 확인한다.

### 발송 환경 준비 — Resend

2026-10-24 기준 발신 도메인과 기존 메일 서비스가 없어 **Resend Free + 소유 도메인의 인증 메일용 하위 도메인**을 권장 구성으로 준비했다. 계정 생성·도메인 구매·SMTP 활성화는 수행하지 않았으며, 실제 메일 수신 검증과 함께 출시 전 후속 작업으로 남긴다.

- Resend Free: 월 3,000건, 하루 100건. 인증 메일 전송량은 공유 프로젝트 전체 사용량을 합산해 판단한다. [현재 요금](https://resend.com/pricing)
- 도메인은 별도 비용이다. Cloudflare의 일반 `.com` 표준 등록·갱신 가격은 현재 연 $10.46이며, 원하는 이름의 등록 가능 여부·프리미엄 가격·결제 총액은 별도로 확인한다. [도메인 가격](https://pricing.registrar.cloudflare.com/)
- 도메인 인증 전 `resend.dev` 발신 주소는 Resend 계정 본인 주소로만 테스트할 수 있다. 이 제한된 발신자를 공유 Supabase의 운영 SMTP로 설정하지 않는다. [테스트 발송 제한](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain)

도메인을 확보하면 `auth.<소유 도메인>`을 Resend에 등록한다. Resend가 실제로 생성한 DKIM·SPF 관련 DNS 값을 그대로 추가하고 `Verified` 상태를 확인한다. DMARC도 설정하고 인증 메일의 클릭·열람 추적을 끈다. 기존 루트 도메인의 메일 수신용 MX 레코드는 유지한다. [도메인 연결 안내](https://resend.com/docs/add-a-domain)

Supabase에 입력할 값은 다음과 같다. 발신 주소와 이름은 같은 서버를 쓰는 다른 앱까지 고려해 확정한다.

| 항목 | 설정 |
| --- | --- |
| SMTP host | `smtp.resend.com` |
| SMTP port | `465` |
| SMTP username | `resend` |
| SMTP password | Resend에서 발급한 전용 API 키. 문서·앱 환경 변수에 기록하지 않는다. |
| Sender email | 인증 완료한 하위 도메인의 `no-reply` 주소 |
| Sender name | 공유 앱에 적합한 발신자 이름 — 도메인 선택 후 확정 |

[Resend의 Supabase SMTP 설정](https://resend.com/docs/send-with-supabase-smtp)을 기준으로 한다. API 키는 전송 권한과 사용할 도메인 범위를 제한하고, 실제 값은 Supabase 서버 설정에만 전달한다. [API 키 관리](https://resend.com/docs/dashboard/api-keys/introduction)

연결 후 Supabase의 Auth 전송 제한을 조회한다. Resend의 일·월 한도와 Supabase의 시간당 한도는 별개이며, 메일 업체 연결만으로 기존 서버 제한이 풀렸다고 가정하지 않는다. 발신자와 전송 제한 외의 공유 Auth 정책은 유지한다. [Supabase SMTP 안내](https://supabase.com/docs/guides/auth/auth-smtp)

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

2026-10-24 운영 점검에서는 복구 관련 테스트 5개 suite·48개가 통과했고, `npm run check`도 통과했다(typecheck, lint, Jest 76개 suite·362개, 색 강조 도구 10개, 빌드 설정 테스트 21개). 빌드 설정 테스트는 Node 테스트이며 네이티브 앱 빌드를 실행한 것은 아니다.

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
