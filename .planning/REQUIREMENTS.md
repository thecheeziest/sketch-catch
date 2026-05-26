# Requirements: 스케치캐치 (Sketch Catch)

**Defined:** 2026-05-13
**Core Value:** 친구들이 30초 안에 방을 만들고 바로 그림 게임을 시작할 수 있어야 한다 — 설치 직후 즉시 플레이.

## v1 Requirements

### Authentication (AUTH)

- [x] **AUTH-01**: 카카오 소셜 로그인으로 가입/로그인 가능 (iOS/Android)
- [x] **AUTH-02**: iOS에서 애플 로그인으로 가입/로그인 가능
- [x] **AUTH-03**: 신규 가입 시 닉네임(2~10자, 띄어쓰기 포함 가능) + 친구코드(5자리 영문/숫자, 직접 입력 또는 랜덤 생성) + 캐릭터(20종 중 1개) 선택 가능
- [x] **AUTH-04**: `닉네임#코드` 조합이 이미 존재하면 가입/변경 불가 (같은 닉네임이라도 코드가 다르면 허용)
- [x] **AUTH-05**: 로그인 상태가 앱 재시작 후에도 유지됨 (JWT SecureStore)

### Profile (PROF)

- [x] **PROF-01**: 닉네임 변경 가능 (30일 1회 제한, 변경 시 닉네임+코드 조합 중복 검사)
- [x] **PROF-02**: 친구코드 변경 가능 (5자리 영문/숫자, 변경 시 닉네임+코드 조합 중복 검사)
- [x] **PROF-03**: 캐릭터 변경 가능 (제한 없음)
- [x] **PROF-04**: 마이페이지에서 `닉네임#코드` 전체 확인 및 복사 가능
- [x] **PROF-05**: 로그아웃 및 회원 탈퇴 가능 (탈퇴 시 데이터 삭제)

### Friends (FRND)

- [x] **FRND-01**: 친구코드(`닉네임#코드` 또는 코드만 5자리)로 친구 요청 가능
- [x] **FRND-02**: 받은 친구 요청을 수락/거절 가능
- [x] **FRND-03**: 친구 목록에서 온라인/오프라인/게임 중 상태 확인 가능
- [x] **FRND-04**: 친구 삭제 가능 (양방향 동시 삭제)

### Room & Matching (ROOM)

- [x] **ROOM-01**: 방 생성 시 6자리 방 코드 자동 발급, 인원(3~12)/모드(1 or 2)/라운드/타이머 설정 가능
- [x] **ROOM-02**: 방 코드 직접 입력으로 방 입장 가능
- [x] **ROOM-03**: 랜덤 매칭 큐 진입 가능 (6/8/10명 선택, 30초 타임아웃 시 연장/취소 안내)
- [x] **ROOM-04**: 매칭 중 취소 가능 (큐 즉시 제거)

### Lobby (LBBY)

- [x] **LBBY-01**: 인원 수만큼 빈 슬롯이 표시되고, 입장 시 해당 슬롯 채워짐
- [x] **LBBY-02**: 일반 참가자는 준비 완료 토글, 방장은 전원 준비 완료 시 게임 시작 가능
- [x] **LBBY-03**: 방장 나가면 다음 입장 순서 참가자가 자동으로 방장 승계

### Game Mode 1 — Classic (MD1)

- [x] **MD1-01**: 출제자가 라운드마다 순환되며 제시어를 받음 (다른 참가자에게는 안 보임)
- [x] **MD1-02**: 채팅 정확 일치(공백/대소문자 무시)로 자동 정답 처리 가능
- [x] **MD1-03**: 출제자가 채팅 메시지를 길게 눌러 수동 정답 인정 가능
- [x] **MD1-04**: 점수 계산 — 맞힌 사람: `max(100, 1000 - 경과초×30)`, 출제자: 맞힌 점수의 50% (최대 500)
- [x] **MD1-05**: 타이머 10~60초, 5초 단위 설정 가능 (기본 30초)

### Game Mode 2 — Phone Game (MD2)

- [ ] **MD2-01**: N명 참가 시 N개 시트가 동시 진행, 매 단계마다 시트가 시계방향으로 넘어감
- [ ] **MD2-02**: 그리기(기본 30초)/텍스트 답(기본 10초) 단계가 교대 반복, 작성자에게 돌아오면 종료
- [ ] **MD2-03**: 시트 리뷰 단계에서 각 단계마다 ⭕/❌ 투표 가능 (본인 시트 제외)
- [ ] **MD2-04**: 베스트 시트(가장 웃긴 시트) 투표 가능
- [ ] **MD2-05**: 투표 기반 점수 부여 (단계 ⭕ 과반: +100, 시트 전체 ⭕: +500, 베스트: +200)

### Drawing & Canvas (DRAW)

- [x] **DRAW-01**: Skia 캔버스에서 출제자/담당자의 stroke가 다른 참가자 화면에 실시간 동기화됨 (50ms throttle batch)
- [x] **DRAW-02**: 출제자/담당자만 색상(6개)/굵기(3단계) 선택, 지우개, 전체 지우기, 되돌리기(1단계) 사용 가능
- [x] **DRAW-03**: 출제자가 아닌 사람이 보낸 stroke 이벤트는 서버에서 거부됨

### Game Common (GAME)

- [x] **GAME-01**: 인게임 채팅 가능 (최대 30자, 비속어 필터링 `***` 처리, 출제 중 출제자 채팅 불가)
- [ ] **GAME-02**: 채팅 메시지가 발신자 캐릭터 액자 위 말풍선으로 2.5초 표시됨
- [x] **GAME-03**: 카테고리별(7개) 제시어 풀에서 단어 추출 가능, 방장이 카테고리 다중 선택 가능 (총 350개 이상)

### GIF & Replay (GIF)

- [ ] **GIF-01**: 모드 2 종료 후 서버에서 GIF 생성 가능 (stroke 데이터 기반, napi-rs/canvas + gifenc)
- [ ] **GIF-02**: 해당 시트 참여자만 GIF 저장 요청 가능, 비참여자 요청은 서버에서 거부
- [ ] **GIF-03**: GIF가 기기 갤러리에 저장됨 (expo-file-system + expo-media-library)

### Award (AWRD)

- [ ] **AWRD-01**: 게임 종료 후 1위 캐릭터 액자 확대 + 빵빠레 사운드로 시상식 표시
- [ ] **AWRD-02**: 2~3위 좌우 배치 표시 (인원 부족 시 생략)
- [ ] **AWRD-03**: 시상식 중 소감 채팅 가능, 30초 후 자동 종료 또는 나가기 버튼

### Push Notifications (PUSH)

- [ ] **PUSH-01**: 친구 요청 수신 시 푸시 알림
- [ ] **PUSH-02**: 내 친구 요청 수락 시 푸시 알림
- [ ] **PUSH-03**: 친구에게 게임 초대 받을 시 푸시 알림 (클릭 시 방 자동 입장 흐름)

### Offline Handling (OFFL)

- [ ] **OFFL-01**: 연결 끊김 후 30초 내 복귀 시 자리 유지 및 진행 상황 동기화
- [ ] **OFFL-02**: 30초 초과 시 자동 퇴장 처리, 다른 참가자에게 알림
- [ ] **OFFL-03**: 게임 중 인원 3명 미만 되면 즉시 게임 종료, 진행분만 결과 표시
- [ ] **OFFL-04**: 출제자 이탈(모드 1) 시 해당 라운드 무효 + 다음 출제자로 스킵
- [ ] **OFFL-05**: 시트 담당자 이탈(모드 2) 시 빈 시트 처리 후 다음 단계 진행

---

## v2 Requirements

### Profile
- **PROF-V2-01**: 닉네임 검색 기능

### Social
- **SOCL-V2-01**: 게임 기록/통계 열람

### Content
- **CONT-V2-01**: 캐릭터 추가 시즌 (테마별)

### Game
- **GAME-V2-01**: 예약 게임 + 시작 임박 알림
- **GAME-V2-02**: 제시어 난이도 옵션 (★~★★★)

### UI
- **UI-V2-01**: 다크모드

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| 딥링크 방 입장 | 방 코드 직접 입력 방식 채택 — RN 딥링크 설정 복잡도 대비 UX 이득 미미 |
| 유료 결제/광고 | 무료 모델 유지 정책 |
| 외부 유료 GIF API | 서버 자체 구현 원칙 (napi-rs/canvas + gifenc) |
| 닉네임 검색 | 닉네임이 중복 허용 구조라 코드 없이 검색 불가 — v2로 |
| 다중 디바이스 동시 로그인 | 기존 세션 끊기로 처리 (미결 → 개발 시 결정) |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 2 | Complete |
| AUTH-02 | Phase 2 | Complete |
| AUTH-03 | Phase 2 | Complete |
| AUTH-04 | Phase 2 | Complete |
| AUTH-05 | Phase 2 | Complete |
| PROF-01 | Phase 2 | Complete |
| PROF-02 | Phase 2 | Complete |
| PROF-03 | Phase 2 | Complete |
| PROF-04 | Phase 2 | Complete |
| PROF-05 | Phase 2 | Complete |
| FRND-01 | Phase 3 | Complete |
| FRND-02 | Phase 3 | Complete |
| FRND-03 | Phase 3 | Complete |
| FRND-04 | Phase 3 | Complete |
| ROOM-01 | Phase 4 | Complete |
| ROOM-02 | Phase 4 | Complete |
| ROOM-03 | Phase 4 | Complete |
| ROOM-04 | Phase 4 | Complete |
| LBBY-01 | Phase 4 | Complete |
| LBBY-02 | Phase 4 | Complete |
| LBBY-03 | Phase 4 | Complete |
| MD1-01 | Phase 5 | Complete |
| MD1-02 | Phase 5 | Complete |
| MD1-03 | Phase 5 | Complete |
| MD1-04 | Phase 5 | Complete |
| MD1-05 | Phase 5 | Complete |
| DRAW-01 | Phase 5 | Complete |
| DRAW-02 | Phase 5 | Complete |
| DRAW-03 | Phase 5 | Complete |
| GAME-01 | Phase 5 | Complete |
| GAME-02 | Phase 5 | Pending |
| GAME-03 | Phase 5 | Complete |
| AWRD-01 | Phase 5 | Pending |
| AWRD-02 | Phase 5 | Pending |
| AWRD-03 | Phase 5 | Pending |
| MD2-01 | Phase 6 | Pending |
| MD2-02 | Phase 6 | Pending |
| MD2-03 | Phase 6 | Pending |
| MD2-04 | Phase 6 | Pending |
| MD2-05 | Phase 6 | Pending |
| GIF-01 | Phase 6 | Pending |
| GIF-02 | Phase 6 | Pending |
| GIF-03 | Phase 6 | Pending |
| PUSH-01 | Phase 7 | Pending |
| PUSH-02 | Phase 7 | Pending |
| PUSH-03 | Phase 7 | Pending |
| OFFL-01 | Phase 7 | Pending |
| OFFL-02 | Phase 7 | Pending |
| OFFL-03 | Phase 7 | Pending |
| OFFL-04 | Phase 7 | Pending |
| OFFL-05 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 47 total
- Mapped to phases: 47 ✓
- Unmapped: 0

---
*Requirements defined: 2026-05-13*
*Last updated: 2026-05-13 after roadmap creation*
