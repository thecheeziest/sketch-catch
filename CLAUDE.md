<!-- GSD:project-start source:PROJECT.md -->
## Project

**스케치캐치 (Sketch Catch)**

React Native(Expo) + Node.js(Socket.io) 기반의 실시간 멀티플레이어 그림 맞추기 게임 앱. 친구와 그림을 그리고 맞히며, 픽셀아트 감성의 캐릭터와 UI로 구성된다. 모드 1(클래식 캐치마인드)과 모드 2(전언게임/Gartic Phone) 두 가지 게임 방식을 제공하며, 모드 2의 그림 과정은 GIF로 저장해 SNS 공유가 가능하다. 20~30대 친구 그룹을 타겟으로 하는 캐주얼 모바일 게임. RN 스터디 목적으로 제작.

**Core Value:** 친구들이 30초 안에 방을 만들고 바로 그림 게임을 시작할 수 있어야 한다 — 설치 직후 즉시 플레이.

### Constraints

- **플랫폼**: Expo dev client 필수 — react-native-skia, 카카오 SDK 등 네이티브 모듈 사용
- **패키지 매니저**: pnpm workspace (모노레포)
- **DB**: PostgreSQL (영구) + Redis (실시간/큐) — Railway 배포
- **인증**: iOS = 카카오 + 애플, Android = 카카오만 (Apple 정책). 닉네임 2~10자(띄어쓰기 포함), 친구코드 5자리 영문/숫자 직접 설정(미설정 시 랜덤), `닉네임#코드` 조합 단위로 중복 검사
- **GIF 변환**: 서버 자체 구현만 (`@napi-rs/canvas` + `gifenc`). 외부 과금 API 금지
- **비용**: Railway 무료/저비용 티어 가정. 에셋은 전부 무료 라이선스
- **보안**: 서버가 진실의 출처. 클라이언트 입력 절대 신뢰 금지. 모든 stroke 권한 검증
- **성능**: 캔버스 60fps 목표, stroke 50ms throttle batch 전송
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
