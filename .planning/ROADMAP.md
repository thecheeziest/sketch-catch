# Roadmap: 스케치캐치 (Sketch Catch)

## Overview

모노레포 기반 프로젝트 셋업부터 시작해, 카카오 인증과 친구 시스템을 구축하고, 방/로비 흐름을 완성한 뒤, 실시간 캔버스와 게임 모드 1을 붙여 MVP를 완성한다. 이후 게임 모드 2(전언게임)와 GIF 내보내기를 추가하고, 마지막으로 푸시 알림과 오프라인 처리로 앱을 견고하게 마무리한다.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - 모노레포 초기화, DB 스키마, 공유 타입, CI 파이프라인
- [ ] **Phase 2: Auth & Profile** - 카카오/애플 로그인, 가입 플로우, 마이페이지
- [ ] **Phase 3: Friends** - 친구코드 기반 친구 추가/목록/상태 표시
- [ ] **Phase 4: Room & Lobby** - 방 생성/입장/랜덤 매칭, 대기실 슬롯/준비/방장 승계
- [ ] **Phase 5: Game Mode 1** - 실시간 캔버스, 클래식 캐치마인드, 시상식
- [ ] **Phase 6: Game Mode 2 & GIF** - 전언게임, GIF 생성/저장
- [ ] **Phase 7: Polish** - 푸시 알림, 오프라인/연결 끊김 처리

## Phase Details

### Phase 1: Foundation
**Goal**: 개발을 시작할 수 있는 모노레포 환경과 공유 인프라가 갖춰진다
**Depends on**: Nothing (first phase)
**Requirements**: (없음 — 인프라 페이즈, 요구사항은 모든 기능의 전제조건)
**Success Criteria** (what must be TRUE):
  1. `apps/mobile`, `apps/server`, `packages/shared` 세 워크스페이스가 각자 빌드/실행된다
  2. PostgreSQL + Redis가 Railway에 프로비저닝되고 서버에서 연결된다
  3. `packages/shared`의 타입·Zod 스키마·Socket.io 이벤트 상수를 mobile과 server에서 import해 쓸 수 있다
  4. EAS Build로 Expo dev client가 빌드되고 시뮬레이터에서 실행된다
**Plans**: 5 plans

Plans:
- [ ] 01-foundation/01-01-PLAN.md — 모노레포 루트 + packages/shared 스캐폴딩
- [ ] 01-foundation/01-02-PLAN.md — 공유 패키지 타입/이벤트/Zod 스키마/상수
- [ ] 01-foundation/01-03-PLAN.md — apps/server Fastify+Prisma+Redis+docker-compose+/health
- [ ] 01-foundation/01-04-PLAN.md — apps/mobile Expo+EAS+ThemeProvider+더미 화면
- [ ] 01-foundation/01-05-PLAN.md — GitHub Actions CI + Railway 자동 배포 + README
**UI hint**: yes

### Phase 2: Auth & Profile
**Goal**: 사용자가 카카오(또는 애플) 로그인으로 가입하고, 닉네임/캐릭터를 설정하며, 마이페이지에서 프로필을 관리할 수 있다
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, PROF-01, PROF-02, PROF-03, PROF-04, PROF-05
**Success Criteria** (what must be TRUE):
  1. 카카오 계정으로 앱 가입 후 닉네임·친구코드·캐릭터를 설정하면 홈 화면에 진입한다
  2. 앱을 완전히 종료하고 재시작해도 로그인 상태가 유지된다
  3. iOS에서 애플 계정으로도 동일한 가입 흐름이 작동한다
  4. 같은 `닉네임#코드` 조합으로 중복 가입/변경을 시도하면 오류 메시지가 표시된다
  5. 마이페이지에서 닉네임(30일 1회), 친구코드, 캐릭터를 변경할 수 있고, 로그아웃/탈퇴가 동작한다
**Plans**: TBD
**UI hint**: yes

### Phase 3: Friends
**Goal**: 사용자가 친구코드로 친구를 추가하고, 요청을 수락/거절하며, 친구 목록에서 온라인 상태를 확인할 수 있다
**Depends on**: Phase 2
**Requirements**: FRND-01, FRND-02, FRND-03, FRND-04
**Success Criteria** (what must be TRUE):
  1. `닉네임#코드` 또는 코드 5자리만 입력해 친구 요청을 보낼 수 있다
  2. 받은 친구 요청을 수락하면 양쪽 모두의 친구 목록에 상대가 나타난다
  3. 친구 목록에서 각 친구의 온라인/오프라인/게임 중 상태가 실시간으로 표시된다
  4. 친구를 삭제하면 양측 목록에서 동시에 사라진다
**Plans**: TBD
**UI hint**: yes

### Phase 4: Room & Lobby
**Goal**: 사용자가 방을 만들거나 코드로 입장해 대기실에서 준비하고, 랜덤 매칭으로도 게임을 시작할 수 있다
**Depends on**: Phase 3
**Requirements**: ROOM-01, ROOM-02, ROOM-03, ROOM-04, LBBY-01, LBBY-02, LBBY-03
**Success Criteria** (what must be TRUE):
  1. 방 생성 후 6자리 코드가 발급되고, 다른 사용자가 해당 코드로 입장하면 슬롯이 채워진다
  2. 모든 참가자가 준비 완료를 누르면 방장에게 게임 시작 버튼이 활성화된다
  3. 방장이 나가면 다음 입장 순서 참가자가 자동으로 방장이 된다
  4. 랜덤 매칭 큐에 진입 후 인원이 채워지면 자동으로 방이 만들어지고, 30초 내 미충족 시 연장/취소 안내가 표시된다
**Plans**: TBD
**UI hint**: yes

### Phase 5: Game Mode 1
**Goal**: 방에서 게임을 시작하면 실시간 캔버스로 그림을 그리고 채팅으로 맞히는 클래식 캐치마인드 한 판을 끝까지 완주할 수 있다
**Depends on**: Phase 4
**Requirements**: MD1-01, MD1-02, MD1-03, MD1-04, MD1-05, DRAW-01, DRAW-02, DRAW-03, GAME-01, GAME-02, GAME-03, AWRD-01, AWRD-02, AWRD-03
**Success Criteria** (what must be TRUE):
  1. 출제자의 Skia 캔버스 stroke가 50ms throttle batch로 다른 참가자 화면에 실시간 동기화된다
  2. 채팅에 정확한 정답을 입력하거나 출제자가 수동 인정하면 점수가 즉시 계산되고 표시된다
  3. 출제자가 아닌 참가자가 stroke 이벤트를 보내도 서버에서 거부된다
  4. 채팅 메시지가 캐릭터 액자 위 말풍선으로 2.5초 동안 표시되고, 비속어는 `***`로 대체된다
  5. 모든 라운드 종료 후 시상식 화면이 표시되고 30초 후 자동 종료된다
**Plans**: TBD
**UI hint**: yes

### Phase 6: Game Mode 2 & GIF
**Goal**: 전언게임 모드로 한 판을 완주하고, 종료 후 그림 과정이 GIF로 기기에 저장된다
**Depends on**: Phase 5
**Requirements**: MD2-01, MD2-02, MD2-03, MD2-04, MD2-05, GIF-01, GIF-02, GIF-03
**Success Criteria** (what must be TRUE):
  1. N명 참가 시 N개 시트가 동시 진행되며, 매 단계마다 시트가 시계방향으로 넘어간다
  2. 그리기/텍스트 단계가 교대 반복되고, 시트가 최초 작성자에게 돌아오면 리뷰 단계로 전환된다
  3. 시트 리뷰에서 단계별 ⭕/❌ 투표와 베스트 시트 투표가 동작하고 점수가 부여된다
  4. 게임 종료 후 해당 시트 참여자가 GIF 저장을 요청하면 기기 갤러리에 저장된다
  5. 비참여자가 GIF 저장을 요청하면 서버에서 거부된다
**Plans**: TBD
**UI hint**: yes

### Phase 7: Polish
**Goal**: 친구 관련 푸시 알림이 전달되고, 연결이 끊겨도 게임이 우아하게 복구되거나 종료된다
**Depends on**: Phase 6
**Requirements**: PUSH-01, PUSH-02, PUSH-03, OFFL-01, OFFL-02, OFFL-03, OFFL-04, OFFL-05
**Success Criteria** (what must be TRUE):
  1. 친구 요청/수락/게임 초대가 오면 앱이 백그라운드 상태여도 푸시 알림이 도착한다
  2. 게임 중 연결이 끊겨도 30초 내 복귀하면 진행 상황이 복원된다
  3. 30초 초과 이탈 시 자동 퇴장되고 남은 참가자에게 알림이 표시된다
  4. 게임 중 인원이 3명 미만이 되면 즉시 종료되고 진행분 결과가 표시된다
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/5 | In Progress|  |
| 2. Auth & Profile | 0/? | Not started | - |
| 3. Friends | 0/? | Not started | - |
| 4. Room & Lobby | 0/? | Not started | - |
| 5. Game Mode 1 | 0/? | Not started | - |
| 6. Game Mode 2 & GIF | 0/? | Not started | - |
| 7. Polish | 0/? | Not started | - |
