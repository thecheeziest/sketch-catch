# 스케치캐치 (Sketch Catch)

## What This Is

React Native(Expo) + Node.js(Socket.io) 기반의 실시간 멀티플레이어 그림 맞추기 게임 앱. 친구와 그림을 그리고 맞히며, 픽셀아트 감성의 캐릭터와 UI로 구성된다. 모드 1(클래식 캐치마인드)과 모드 2(전언게임/Gartic Phone) 두 가지 게임 방식을 제공하며, 모드 2의 그림 과정은 GIF로 저장해 SNS 공유가 가능하다. 20~30대 친구 그룹을 타겟으로 하는 캐주얼 모바일 게임. RN 스터디 목적으로 제작.

## Core Value

친구들이 30초 안에 방을 만들고 바로 그림 게임을 시작할 수 있어야 한다 — 설치 직후 즉시 플레이.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**MVP (출시 필수)**
- [ ] 카카오 소셜 로그인 (iOS/Android) + 최초 가입 플로우 (닉네임 2~12자 + 캐릭터 선택)
- [ ] 마이페이지 (닉네임 변경 30일 1회, 캐릭터 변경, 로그아웃/탈퇴)
- [ ] 친구코드(`#A1B2C3`) 기반 친구 추가/수락/거절/삭제
- [ ] 친구 목록 (온라인/오프라인/게임 중 상태 표시)
- [ ] 친구 초대 방 생성 (6자리 코드, 인원 3~12, 모드/라운드/타이머 설정)
- [ ] 대기실 (슬롯 표시, 준비 완료, 방장 승계)
- [ ] 게임 모드 1 — 클래식 캐치마인드 (출제자 순환, 자동/수동 정답 처리, 점수 계산)
- [ ] 인게임 채팅 (30자, 비속어 필터, 출제자 채팅 불가, 말풍선 표시 2.5초)
- [ ] 카테고리별 제시어 풀 (7개 카테고리 × 50개 이상)
- [ ] 시상식 (1~3위 표시, 빵빠레, 소감 채팅, 30초 자동 종료)
- [ ] 오프라인/연결 끊김 처리 (30초 grace, 자동 퇴장, 인원 부족 종료)

**v1 (출시 직후)**
- [ ] 게임 모드 2 — 전언게임 (N개 시트 동시 진행, 그림/텍스트 교대, 시트 리뷰 투표)
- [ ] 모드 2 체인 보너스 점수 (단계 ⭕/❌ 투표 기반)
- [ ] 모드 2 쿠키 영상 (그림 과정 배속 재생 + GIF 저장)
- [ ] 랜덤 매칭 (6/8/10명, 30초 타임아웃)
- [ ] 푸시 알림 (친구 요청, 수락, 게임 초대) — Expo Push
- [ ] 애플 로그인 (iOS 전용)

### Out of Scope

- 다크모드 — v2. MVP 범위 외
- 닉네임 검색 — v2. 친구코드로만 검색 (중복 닉네임 허용 구조)
- 게임 기록/통계 — v2
- 캐릭터 추가 시즌 — v2
- 예약 게임/시작 임박 알림 — v2
- 딥링크 방 입장 — 방 코드 직접 입력 방식 채택 (구현 단순화)
- 유료 결제/광고 — 무료 모델 유지 정책
- 외부 유료 API (GIF 변환 등) — 자체 구현 원칙
- 제시어 난이도 옵션 — v2

## Context

- **학습 목적**: RN 스터디 프로젝트. 실시간 통신(Socket.io), Skia 캔버스, 소셜 인증, 친구 시스템, 미디어 변환(GIF)이 핵심 학습 포인트.
- **모노레포 구조**: `apps/mobile` (Expo dev client), `apps/server` (Fastify + Socket.io), `packages/shared` (타입/이벤트/Zod 스키마 공유)
- **픽셀아트 테마**: 8px 그리드, 제한된 팔레트(6색+그레이), 픽셀 폰트(NeoDunggeunmo), 안티앨리어싱 금지
- **캐릭터**: 동물 10종 + 과일 10종, 64×64px PNG, AI 생성(Gemini) + 후처리
- **에셋 정책**: 무료 라이선스(CC0/Pixabay/Mixkit)만 사용. CC-BY는 CREDITS.md에 명시.
- **한국어 전용**: 비속어 필터는 `badwords-ko` + 자체 사전 + 자모 분리 정규화(hangul-js)

## Constraints

- **플랫폼**: Expo dev client 필수 — react-native-skia, 카카오 SDK 등 네이티브 모듈 사용
- **패키지 매니저**: pnpm workspace (모노레포)
- **DB**: PostgreSQL (영구) + Redis (실시간/큐) — Railway 배포
- **인증**: iOS = 카카오 + 애플, Android = 카카오만 (Apple 정책)
- **GIF 변환**: 서버 자체 구현만 (`@napi-rs/canvas` + `gifenc`). 외부 과금 API 금지
- **비용**: Railway 무료/저비용 티어 가정. 에셋은 전부 무료 라이선스
- **보안**: 서버가 진실의 출처. 클라이언트 입력 절대 신뢰 금지. 모든 stroke 권한 검증
- **성능**: 캔버스 60fps 목표, stroke 50ms throttle batch 전송

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Expo dev client (not bare workflow) | 네이티브 모듈 필요 (Skia, 카카오) + EAS 빌드 편의 | — Pending |
| Fastify (not Express) | 더 빠름, TypeScript 친화, 스키마 기반 직렬화 | — Pending |
| `@napi-rs/canvas` (not node-canvas) | Cairo 빌드 불필요, 미리 빌드된 바이너리 → Railway 배포 간소화 | — Pending |
| 방 코드 방식 (not 딥링크) | 구현 단순화. 딥링크는 RN에서 설정 복잡 | — Pending |
| MVP는 모드 1만 | 모드 2(전언게임)는 상태 관리 복잡 → v1으로 분리. 모드 1 먼저 검증 | — Pending |
| GIF MVP = 직접 응답 방식 | 외부 스토리지 비용 0. 생성 후 클라이언트에 직접 전송, Redis TTL 10분 | — Pending |
| 다중 디바이스 동시 로그인 정책 | 미결 — 기존 세션 끊기 vs 차단 선택 필요 | — Pending |
| 동점자 시상 정책 | 미결 — 1위 동점 2명일 때 처리 방식 결정 필요 | — Pending |
| 회원 탈퇴 시 GIF 보관 | 미결 — 즉시 삭제 vs 30일 유예 | — Pending |

## Evolution

이 문서는 페이즈 전환과 마일스톤 경계마다 업데이트된다.

**각 페이즈 전환 후** (`/gsd:transition`):
1. 무효화된 요구사항 → Out of Scope로 이동 (사유 포함)
2. 검증된 요구사항 → Validated로 이동 (페이즈 참조 포함)
3. 새로 발생한 요구사항 → Active에 추가
4. 기록할 결정 → Key Decisions에 추가
5. "What This Is" 여전히 정확한가? → 변화 시 업데이트

**각 마일스톤 후** (`/gsd:complete-milestone`):
1. 전체 섹션 리뷰
2. Core Value 점검 — 여전히 올바른 우선순위인가?
3. Out of Scope 감사 — 이유가 여전히 유효한가?
4. Context 업데이트

---
*Last updated: 2026-05-13 after initialization*
