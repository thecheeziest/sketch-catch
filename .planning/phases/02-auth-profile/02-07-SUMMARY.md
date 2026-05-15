---
phase: 02-auth-profile
plan: "07"
subsystem: mobile-auth-infra
tags: [auth, zustand, tanstack-query, fetch-wrapper, secure-store, oauth, kakao, apple]
dependency_graph:
  requires: ["02-01", "02-03"]
  provides: ["mobile-auth-store", "mobile-api-client", "mobile-auth-hooks"]
  affects: ["02-08", "02-09"]
tech_stack:
  added: []
  patterns:
    - "Zustand + immer: auth store (isLoaded/isAuthenticated/tokens/user)"
    - "fetch wrapper: 401→refresh→retry(1회)→SESSION_REPLACED 토스트+clearAuth"
    - "TanStack Query: useMe(query), useUpdateMe/useDeleteMe/useKakaoLogin/useAppleLogin(mutation)"
    - "SecureStore 두 키 분리: Pitfall 5 2KB 한도 회피"
    - "hydrateAuthStore: Promise.all + useAuthStore.setState 직접 호출"
key_files:
  created:
    - apps/mobile/src/stores/auth.ts
    - apps/mobile/src/services/api.ts
    - apps/mobile/src/services/queryClient.ts
    - apps/mobile/src/features/auth/useKakaoLogin.ts
    - apps/mobile/src/features/auth/useAppleLogin.ts
    - apps/mobile/src/features/auth/useMe.ts
    - apps/mobile/src/features/auth/useUpdateMe.ts
    - apps/mobile/src/features/auth/useDeleteMe.ts
    - apps/mobile/src/features/auth/useLogout.ts
  modified:
    - apps/mobile/src/__tests__/auth-store.test.ts
decisions:
  - "setTokens를 async로 정의 — SecureStore.setItemAsync await 후 상태 갱신 보장"
  - "hydrateAuthStore를 store action이 아닌 외부 함수로 분리 — 루트 레이아웃 useEffect에서 호출"
  - "테스트에서 vi.resetModules 대신 useAuthStore.setState(초기값)으로 리셋 — expo/tsconfig.base dynamic import 타입 에러 회피"
  - "api.ts SESSION_REPLACED: 401 refresh 응답 body에서 에러 코드 확인 후 토스트+clearAuth"
metrics:
  duration: "~3min"
  completed_date: "2026-05-15"
  tasks_completed: 2
  files_created: 9
  files_modified: 1
---

# Phase 02 Plan 07: 모바일 인증 인프라 Summary

JWT 인터셉터(401→refresh→retry→D-06 토스트), SecureStore hydration(AUTH-05), OAuth 훅 6개(카카오/애플/me/updateMe/deleteMe/logout)를 갖춘 모바일 인증 인프라 레이어 구축 완료.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Auth store + fetch wrapper + queryClient + 단위 테스트 | 09f1165 | auth.ts, api.ts, queryClient.ts, auth-store.test.ts |
| 2 | 6개 인증/프로필 훅 | 1442ce4 | useKakaoLogin, useAppleLogin, useMe, useUpdateMe, useDeleteMe, useLogout |

## What Was Built

### Task 1: Auth Store + Fetch Wrapper + QueryClient

**`apps/mobile/src/stores/auth.ts`**
- Zustand + immer store: `isLoaded`, `isAuthenticated`, `accessToken`, `refreshToken`, `user: UserPrivate | null`
- Actions: `setTokens` (SecureStore 저장 + 상태 갱신), `setUser`, `clearAuth` (SecureStore 삭제 + 상태 초기화), `setLoaded`
- `SECURE_STORE_KEYS.ACCESS = 'sketch_catch_access'`, `SECURE_STORE_KEYS.REFRESH = 'sketch_catch_refresh'` (Pitfall 5 회피)
- `hydrateAuthStore()`: Promise.all로 두 키 동시 읽기 → `useAuthStore.setState` 직접 호출 (AUTH-05)

**`apps/mobile/src/services/api.ts`**
- `ApiError` class (status, code, payload)
- `request<T>`: Authorization Bearer 자동 부착, 401 수신 시 refresh 시도 → 성공 시 재시도(1회) → 실패 시 SESSION_REPLACED 토스트(D-06) + clearAuth
- `apiGet`, `apiPost`, `apiPatch`, `apiDelete` export

**`apps/mobile/src/services/queryClient.ts`**
- `staleTime: 30_000`, `retry: 1` (queries), `retry: 0` (mutations)

**`apps/mobile/src/__tests__/auth-store.test.ts`**
- it.todo 5개 → 실 테스트 5개 (expo-secure-store Map 기반 mock)
- AUTH-05 hydration 포함, 모두 PASS

### Task 2: 6개 인증/프로필 훅

| 훅 | 역할 |
|----|------|
| `useKakaoLogin` | kakao SDK `idToken` → POST /auth/kakao → setTokens+setUser |
| `useAppleLogin` | apple Auth `identityToken` → POST /auth/apple → setTokens+setUser |
| `useMe` | GET /me (enabled=isAuthenticated), ME_QUERY_KEY export |
| `useUpdateMe` | PATCH /me → setUser + qc.setQueryData(ME_QUERY_KEY) |
| `useDeleteMe` | DELETE /me → clearAuth |
| `useLogout` | POST /auth/logout + kakaoLogout + clearAuth (각 실패 무시) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 테스트 dynamic import → static import로 변경**
- **Found during:** Task 1 TDD GREEN (typecheck)
- **Issue:** `vi.resetModules()` + `await import('@/stores/auth')` 패턴이 `expo/tsconfig.base` module 미설정으로 TS1323 에러 발생
- **Fix:** static import + `beforeEach`에서 `useAuthStore.setState(초기값)` 직접 리셋으로 변경 — 동일한 테스트 격리 효과
- **Files modified:** apps/mobile/src/__tests__/auth-store.test.ts
- **Commit:** 09f1165

## Known Stubs

None.

## Verification Results

- `pnpm --filter @sketch-catch/mobile test`: 6 tests PASS (5 auth-store + 1 smoke)
- `pnpm --filter @sketch-catch/mobile typecheck`: exit 0

## Self-Check: PASSED
