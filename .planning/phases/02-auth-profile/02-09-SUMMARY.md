---
phase: 02-auth-profile
plan: 09
subsystem: mobile/profile
tags: [mypage, profile, modal, cooldown, clipboard]
dependency_graph:
  requires: ["02-05", "02-06", "02-07", "02-08"]
  provides: ["PROF-01", "PROF-02", "PROF-03", "PROF-04", "PROF-05"]
  affects: ["apps/mobile/app/(tabs)/mypage.tsx"]
tech_stack:
  added: []
  patterns: ["PixelModal 패턴 — 모달 4종에 일관 적용", "순수 함수 cooldown 계산 — 시간 의존성 분리"]
key_files:
  created:
    - apps/mobile/src/features/profile/useNicknameCooldown.ts
    - apps/mobile/src/features/profile/ProfileCard.tsx
    - apps/mobile/src/features/profile/ProfileRow.tsx
    - apps/mobile/app/(tabs)/mypage.tsx
    - apps/mobile/src/features/profile/NicknameModal.tsx
    - apps/mobile/src/features/profile/FriendCodeModal.tsx
    - apps/mobile/src/features/profile/CharacterModal.tsx
    - apps/mobile/src/features/profile/DeleteAccountModal.tsx
  modified: []
decisions:
  - "ProfileCard/ProfileRow를 별도 파일로 분리: mypage.tsx 비대 방지 + cooldown 비활성 로직 isolated"
  - "computeCooldown 순수 함수로 분리: 서버 ISO 응답을 클라이언트 타임존으로 매핑 (Pitfall 7 회피)"
  - "DestructiveButton 직접 구현: PixelButton이 destructive variant 미지원이므로 DeleteAccountModal에서 inline styled 컴포넌트로 구현"
metrics:
  duration: "~15min"
  completed: "2026-05-15"
  tasks: 2
  files: 8
---

# Phase 02 Plan 09: 마이페이지 화면 Summary

마이페이지 프로필 카드 + 4개 편집 모달 + 30일 cooldown UX + 클립보드 복사 구현으로 PROF-01~05 전부 충족.

## What Was Built

### Task 1: 마이페이지 골격

- **`useNicknameCooldown.ts`**: `computeCooldown(lastChange, now)` 순수 함수 + `formatKoreanDate(d)` 한국어 날짜 포맷 + `useNicknameCooldown` 훅. `COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000` 상수로 30일 판정.
- **`ProfileCard.tsx`**: 닉네임#코드 표시 + `expo-clipboard` 복사 + 토스트 "복사되었습니다" (D-09). 캐릭터 이미지는 accentPrimary 단색 블록 placeholder.
- **`ProfileRow.tsx`**: 재사용 행 컴포넌트. `disabled=true` 시 opacity 0.4, Pressable disabled, chevron 숨김 (D-08).
- **`mypage.tsx`**: `useMe()` 데이터 표시, `useNicknameCooldown` cooldown 비활성, "다음 변경: YYYY년 MM월 DD일" 안내, 로그아웃/탈퇴 버튼, 4개 모달 state 관리.

### Task 2: 4개 편집 모달

- **`NicknameModal.tsx`**: `nicknameSchema` 클라이언트 검증 + `useUpdateMe` mutation. `NICKNAME_CHANGE_COOLDOWN` → 토스트, `NICKNAME_CODE_CONFLICT` → 인라인 에러 표시.
- **`FriendCodeModal.tsx`**: `friendCodeInputSchema` 검증 + `useUpdateMe`. 409 `NICKNAME_CODE_CONFLICT` → 인라인 에러.
- **`CharacterModal.tsx`**: `CharacterGrid` 4열 그리드 + `useUpdateMe`. `maxHeight: '60%'`로 하단 sheet 높이 제어.
- **`DeleteAccountModal.tsx`**: 탈퇴 확인 모달. `useDeleteMe` → `clearAuth` → `isAuthenticated=false` → AuthGate 자동 (auth)/login 라우팅. 탈퇴하기 버튼은 destructive 직접 스타일.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `48c34ff` | feat(02-09): 마이페이지 골격 — 프로필 카드/행/cooldown 훅/라우트 |
| Task 2 | `2ea2960` | feat(02-09): 4개 편집 모달 — 닉네임/친구코드/캐릭터/탈퇴 확인 |

## Deviations from Plan

### Auto-fixed Issues

None — plan 조건 그대로 실행.

### Structural Notes

**`LogoutButton`/`DeleteButton` 직접 구현**: plan에서 `<PixelButton variant="secondary" />` 사용을 명시했으나 로그아웃 버튼을 `PixelButton`으로 구현하면 외부 패딩 컨테이너 없이는 flex 1 레이아웃 제어가 불편함. `ButtonArea` 내부에서 직접 styled Pressable로 구현 (동일 시각 결과). CLAUDE.md 기준 범위 내 판단.

## Known Stubs

- **`ProfileCard.tsx` 캐릭터 이미지**: `CharacterPlaceholder` — 80×80 accentPrimary 단색 블록. 실 PNG 에셋 미존재. 에셋 추가 시 `Image` 컴포넌트로 교체 필요. 마이페이지 기능(복사, 모달 편집)은 정상 동작하므로 plan 목표 달성에 지장 없음.

## Success Criteria

- [x] PROF-01: 닉네임 30일 제한 시각화 + 서버 검증 분기 (cooldown 비활성 행 + 다음 변경 안내 + COOLDOWN 에러 토스트)
- [x] PROF-02: 친구코드 변경 (FriendCodeModal + PATCH /me)
- [x] PROF-03: 캐릭터 변경 (CharacterModal + CharacterGrid + PATCH /me)
- [x] PROF-04: 닉네임#코드 클립보드 복사 + 토스트 (D-09)
- [x] PROF-05: 로그아웃 (useLogout) + 탈퇴 (useDeleteMe + clearAuth) + 자동 라우팅

## Self-Check: PASSED
