---
phase: 02-auth-profile
plan: "08"
subsystem: mobile-auth-screens
tags: [auth, onboarding, expo-router, authgate, kakao, apple, zustand]
dependency_graph:
  requires: ["02-04", "02-06", "02-07"]
  provides: ["AUTH-01", "AUTH-02", "AUTH-03", "AUTH-04", "AUTH-05"]
  affects: ["apps/mobile/app/_layout.tsx", "apps/mobile/app/index.tsx", "apps/mobile/app/(auth)", "apps/mobile/app/(tabs)"]
tech_stack:
  added: []
  patterns:
    - "AuthGate: isLoaded gate + Redirect 분기 (Pitfall 6 회피)"
    - "D-04: 친구코드 fadedValue prop으로 opacity 0.35 흐린 표시"
    - "onboarding step1→step2 데이터는 Zustand store (URL params 노출 방지)"
key_files:
  created:
    - apps/mobile/app/(tabs)/_layout.tsx
    - apps/mobile/app/(tabs)/index.tsx
    - apps/mobile/app/(auth)/_layout.tsx
    - apps/mobile/app/(auth)/login.tsx
    - apps/mobile/app/(auth)/onboarding/_layout.tsx
    - apps/mobile/app/(auth)/onboarding/step1.tsx
    - apps/mobile/app/(auth)/onboarding/step2.tsx
    - apps/mobile/src/features/auth/useOnboarding.ts
  modified:
    - apps/mobile/app/_layout.tsx
    - apps/mobile/app/index.tsx
decisions:
  - "Stack.Protected 미지원 (Expo Router 3.5): Stack.Screen redirect prop으로 대체"
  - "login.tsx 에러 핸들러: err.message 우선, fallback으로 네트워크 에러 카피 표시"
metrics:
  duration: "~8min"
  completed_date: "2026-05-15"
  tasks_completed: 2
  files_created: 8
  files_modified: 2
---

# Phase 02 Plan 08: 로그인 + 온보딩 + AuthGate Summary

로그인 화면(카카오/애플) + 2단계 온보딩(닉네임+코드→캐릭터) + SecureStore hydration AuthGate 구현 — 신규/기존 사용자 모두 앱 진입 흐름 완결.

## What Was Built

**Task 1: _layout 재구성 + (tabs) 스텁**

- `apps/mobile/app/_layout.tsx`: QueryClientProvider + ThemeProvider + AuthGate 구조로 전면 교체. `hydrateAuthStore()` useEffect, `isLoaded` gate (null 반환으로 Pitfall 6 redirect 루프 차단), ToastHost 렌더링.
- `apps/mobile/app/index.tsx`: 기존 SplashRoute 제거, `Redirect` 기반 단순 분기 (`/(tabs)` vs `/(auth)/login`).
- `apps/mobile/app/(tabs)/_layout.tsx`: Phase 2 단일 Stack 레이아웃 (탭 바는 Phase 4+에서).
- `apps/mobile/app/(tabs)/index.tsx`: `useMe()` 연동 임시 홈 스텁 ("스케치캐치" + "안녕하세요, {닉네임}님").

**Task 2: (auth) 그룹 — 로그인 + 2단계 온보딩**

- `useOnboarding.ts`: step1→step2 임시 저장 Zustand store (`useOnboardingStore`) + `generateRandomFriendCode()` 헬퍼.
- `(auth)/_layout.tsx`, `onboarding/_layout.tsx`: 단순 Stack 그룹 레이아웃.
- `login.tsx`: 카카오/애플 SocialButton, `Platform.OS === 'ios'` 애플 버튼 조건부, `needsOnboarding` 분기 라우팅, 에러 시 toast.
- `onboarding/step1.tsx`: 닉네임(2~10자) + 친구코드(5자리, D-04 흐린 기본값) 입력, zod 클라이언트 검증, blur 에러 표시.
- `onboarding/step2.tsx`: CharacterGrid 4열 선택, 미선택 시 "시작하기" opacity 0.4 + disabled, `useUpdateMe` PATCH, `NICKNAME_CODE_CONFLICT` 에러 시 toast + step1으로 back.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - API 대응] Stack.Protected 대체**
- **Found during:** Task 1 구현
- **Issue:** Expo Router 3.5(`~3.5.23`)는 `Stack.Protected` API 미지원
- **Fix:** 플랜 NOTE 지침에 따라 `Stack.Screen redirect={condition}` prop 방식으로 대체
- **Files modified:** `apps/mobile/app/_layout.tsx`
- **Commit:** 014fc6a

## Known Stubs

| File | Stub | Reason |
|------|------|--------|
| `apps/mobile/app/(tabs)/index.tsx` | `/mypage` Link | Plan 09에서 mypage 라우트 구현 예정 |
| `apps/mobile/app/(home)/` | 기존 더미 홈 디렉토리 | Plan 09에서 mypage와 함께 정리 예정 (라우팅에는 영향 없음) |

## Commits

| Task | Commit | Message |
|------|--------|---------|
| Task 1 | 014fc6a | feat(02-08): AuthGate + (tabs) 스텁 — QueryClientProvider, hydrateAuthStore, ToastHost |
| Task 2 | 29dc108 | feat(02-08): 로그인 화면 + 2단계 온보딩 (카카오/애플, 닉네임/코드/캐릭터) |

## Checkpoint Reached

Task 3은 `checkpoint:human-verify` (실기기/시뮬레이터 수동 검증). 코드 레벨 구현은 완결되었으며, 카카오 SDK OAuth + 실기기 검증이 필요합니다.

**검증 체크리스트:**
1. 카카오 콘솔 OpenID Connect 활성화 + `KAKAO_NATIVE_APP_KEY` app.json 교체
2. 서버 실행 (`pnpm --filter @sketch-catch/server dev`)
3. iOS 시뮬레이터 빌드 (`npx expo run:ios`)
4. 앱 실행 → 로그인 화면 노출 확인 (애플 버튼 iOS only)
5. 카카오 로그인 → 신규면 step1 이동
6. step1 친구코드 흐린 기본값(opacity 0.35) 확인
7. 닉네임 "1" blur → 에러 메시지 확인
8. 정상 입력 → step2 → 캐릭터 미선택 시 "시작하기" 비활성(opacity 0.4)
9. 캐릭터 선택 → "시작하기" → 홈 ("안녕하세요, {닉네임}님") 확인
10. 앱 재시작 → 홈 직접 진입 (AUTH-05 자동 로그인)
11. 다른 기기 동일 계정 로그인 → 첫 기기 토스트 + 로그인 화면 복귀 (D-06)

## Self-Check: PASSED

All created files verified to exist and commits confirmed in git log.
