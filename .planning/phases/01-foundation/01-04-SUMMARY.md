---
phase: 01-foundation
plan: 04
subsystem: ui
tags: [expo, react-native, expo-router, styled-components, theme, eas, metro, pnpm-monorepo]

requires:
  - phase: 01-foundation/01-01
    provides: "pnpm workspace, tsconfig.base.json, pnpm-workspace.yaml (apps/* 매칭)"
  - phase: 01-foundation/01-02
    provides: "@sketch-catch/shared SHARED_PACKAGE_VERSION export, workspace:* 프로토콜"

provides:
  - "apps/mobile Expo SDK 51 + dev client 워크스페이스 (@sketch-catch/mobile)"
  - "EAS development profile (ios.simulator + android.apk)"
  - "Metro pnpm 모노레포 설정 (watchFolders + unstable_enableSymlinks)"
  - "UI-SPEC 정확 매칭 ThemeProvider 토큰 (8색상, 7 spacing, 4 typography, Galmuri11)"
  - "PixelButton 컴포넌트 (barrel pattern, UI-SPEC: height 48, borderWidth 2, borderRadius 0)"
  - "더미 Splash 화면 (스케치캐치, Display 28px)"
  - "더미 Home 화면 (로그인/방 만들기/방 입장 3버튼)"
  - "shared 패키지 import 검증 (SHARED_PACKAGE_VERSION)"

affects:
  - Phase 2 (인증 — 로그인 화면으로 교체, ThemeProvider 공유)
  - Phase 4 (방/로비 — HomeScreen 버튼 onPress 연결)
  - Phase 5 (게임 — Expo Router 라우팅 추가)

tech-stack:
  added:
    - "expo@^51.0.28"
    - "expo-dev-client@~4.0.25"
    - "expo-router@~3.5.23"
    - "expo-font@~12.0.10"
    - "expo-splash-screen@~0.27.5"
    - "styled-components@^6.1.13"
    - "react-native-safe-area-context@4.10.5"
    - "react-native-gesture-handler@~2.16.1"
    - "react-native-reanimated@~3.10.1"
    - "@types/styled-components-react-native@^5.2.5"
  patterns:
    - "Expo Router file-based routing: app/_layout.tsx + app/(group)/index.tsx"
    - "styled-components/native ThemeProvider: theme 토큰을 DefaultTheme extends로 타입 안전 사용"
    - "PixelButton: $variant transient prop으로 styled-components DOM prop 경고 방지"
    - "Metro pnpm 모노레포: watchFolders=[monorepoRoot] + nodeModulesPaths + unstable_enableSymlinks"

key-files:
  created:
    - apps/mobile/package.json
    - apps/mobile/tsconfig.json
    - apps/mobile/app.json
    - apps/mobile/eas.json
    - apps/mobile/babel.config.js
    - apps/mobile/metro.config.js
    - apps/mobile/index.ts
    - apps/mobile/.env.example
    - apps/mobile/.gitignore
    - apps/mobile/assets/fonts/.gitkeep
    - apps/mobile/src/theme/index.ts
    - apps/mobile/src/theme/styled.d.ts
    - apps/mobile/src/components/PixelButton/index.tsx
    - apps/mobile/app/_layout.tsx
    - apps/mobile/app/index.tsx
    - apps/mobile/app/(home)/_layout.tsx
    - apps/mobile/app/(home)/index.tsx
  modified: []

key-decisions:
  - "expo/tsconfig.base extends 선택: 루트 tsconfig.base.json 대신 expo/tsconfig.base — Expo가 RN 전용 jsx 설정을 이미 포함하므로 충돌 없이 strict 옵션만 추가"
  - "eas.json development profile만 정의: D-04 원칙 준수 — preview/production 프로파일 없음. EAS 단계는 사용자가 직접 설정"
  - "fontError도 진행 조건 처리: Galmuri11.ttf 파일 없이도 개발 더미 실행 가능하도록 fontError fallthrough 처리"

patterns-established:
  - "컴포넌트 barrel pattern: src/components/PixelButton/index.tsx (CLAUDE.md 규칙)"
  - "styled-components $variant transient prop 패턴: DOM 오염 방지"
  - "apps/mobile GestureHandlerRootView + SafeAreaProvider + ThemeProvider 래핑 순서"

requirements-completed: []

duration: 3min
completed: 2026-05-14
---

# Phase 01 Plan 04: apps/mobile Expo 워크스페이스 초기화 Summary

**Expo SDK 51 dev client 기반 pnpm 모노레포 모바일 워크스페이스 구성 — UI-SPEC 정확 매칭 ThemeProvider(8색상/7spacing/4타이포/Galmuri11) + PixelButton + 더미 Splash/Home 화면 typecheck 통과**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-14T00:31:03Z
- **Completed:** 2026-05-14T00:33:36Z
- **Tasks:** 2
- **Files created/modified:** 17

## Accomplishments

- `apps/mobile` Expo SDK 51 + dev client 워크스페이스 생성 — pnpm workspace 인식 확인
- Metro pnpm 모노레포 설정 완료 (watchFolders + unstable_enableSymlinks + nodeModulesPaths)
- UI-SPEC ThemeProvider 토큰 정확 구현 (8색상, 7 spacing, 4 typography, fontFamily Galmuri11)
- PixelButton 컴포넌트 barrel pattern 생성 — height 48, borderWidth 2, borderRadius 0 (픽셀 스타일)
- 더미 Splash/Home 화면 구현 — `pnpm --filter @sketch-catch/mobile typecheck` 통과

## Task Commits

각 태스크를 개별 커밋으로:

1. **Task 1: Expo 프로젝트 + EAS development profile + Metro pnpm 모노레포 설정** - `34d6725` (chore)
2. **Task 2: ThemeProvider + Galmuri11 폰트 로딩 + 더미 Splash/Home 화면** - `95bd049` (feat)

**Plan metadata:** (이후 final commit)

## Files Created/Modified

- `apps/mobile/package.json` - @sketch-catch/mobile, Expo SDK 51, styled-components, workspace:* 의존성
- `apps/mobile/tsconfig.json` - expo/tsconfig.base extends, strict, paths @/* 별칭
- `apps/mobile/app.json` - slug: sketch-catch, developmentClient, expo-router + expo-font 플러그인
- `apps/mobile/eas.json` - development profile만 (simulator: true, apk)
- `apps/mobile/babel.config.js` - babel-preset-expo + react-native-reanimated/plugin
- `apps/mobile/metro.config.js` - watchFolders + unstable_enableSymlinks + nodeModulesPaths
- `apps/mobile/index.ts` - expo-router/entry
- `apps/mobile/.env.example` - EXPO_PUBLIC_API_URL, EXPO_PUBLIC_SOCKET_URL
- `apps/mobile/.gitignore` - .expo, ios, android, 키 파일 제외
- `apps/mobile/assets/fonts/.gitkeep` - Galmuri11.ttf 배치 안내
- `apps/mobile/src/theme/index.ts` - UI-SPEC 정확 매칭 theme 상수 + Theme 타입
- `apps/mobile/src/theme/styled.d.ts` - DefaultTheme extends Theme
- `apps/mobile/src/components/PixelButton/index.tsx` - variant(primary/secondary/outline), barrel pattern
- `apps/mobile/app/_layout.tsx` - ThemeProvider + useFonts(Galmuri11) + @sketch-catch/shared import
- `apps/mobile/app/index.tsx` - Splash 화면 (스케치캐치, Display 28px, 0.8s 후 (home)으로 전환)
- `apps/mobile/app/(home)/_layout.tsx` - HomeLayout Stack
- `apps/mobile/app/(home)/index.tsx` - 로그인/방 만들기/방 입장 더미 버튼

## Decisions Made

- **expo/tsconfig.base extends**: 루트 tsconfig.base.json 대신 Expo 제공 base 사용 — RN 전용 jsx 설정 충돌 방지
- **eas.json development profile만**: D-04 원칙. preview/production 없음
- **fontError fallthrough**: Galmuri11.ttf 파일 없이 개발 더미 동작 허용 (폰트 에러도 로딩 완료로 처리)

## Deviations from Plan

None - 플랜에 명시된 그대로 실행.

## Issues Encountered

None.

## User Setup Required

실제 시뮬레이터 실행 전 필요한 설정:

1. **Galmuri11.ttf 배치**: `apps/mobile/assets/fonts/Galmuri11.ttf`
   - 출처: https://github.com/quiple/galmuri (MIT 라이선스)
2. **Expo 계정 + EAS 로그인**: `npx eas-cli login`
3. **Dev client 빌드**: `eas build --profile development --platform ios`
4. **아이콘/스플래시 이미지**: `assets/icon.png`, `assets/splash.png`, `assets/adaptive-icon.png` 배치

## Known Stubs

- `apps/mobile/app/(home)/index.tsx`: 버튼 3개 `onPress` 핸들러 없음 (더미) — Phase 2(로그인), Phase 4(방 만들기/입장) 에서 연결 예정
- `apps/mobile/app/_layout.tsx`: `require('../assets/fonts/Galmuri11.ttf')` — 실제 폰트 파일 없음, 사용자가 배치 필요

## Next Phase Readiness

- Phase 2 (인증): ThemeProvider + Expo Router 라우팅 기반 준비 완료, 카카오 로그인 화면 추가 가능
- Phase 4 (방/로비): HomeScreen 버튼 onPress에 라우터 연결만 추가하면 됨
- `@sketch-catch/shared` import 검증 완료 — 타입/이벤트/스키마/상수 즉시 사용 가능

## Self-Check: PASSED

- 17개 파일 모두 존재 확인
- 커밋 `34d6725` (Task 1), `95bd049` (Task 2) 모두 존재 확인
- `pnpm --filter @sketch-catch/mobile typecheck` 에러 없음
- eas.json preview/production 없음 확인
- 8개 색상 토큰 모두 존재 확인
- PixelButton barrel pattern 확인

---
*Phase: 01-foundation*
*Completed: 2026-05-14*
