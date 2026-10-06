# 배포 테스트 이슈 정리 및 수정 계획

> 작성일: 2026-10-02 · 대상 브랜치: `chore/expo-sdk-upgrade` 기준 코드

## 확정된 결정

| 항목 | 결정 |
|---|---|
| 게임 종료 후 방 처리 | 같은 방 대기실로 복귀 (새 `gameId`로 재대결 가능) |
| 대기실·게임 중 유저 초대 | 초대 버튼 비활성 + 상태(대기실/게임 중) 표시 |
| 원형 스피너 범위 | Pull to Refresh + 버튼 내부 로딩 |
| 시상식 흐름 | 10초 진행. [한번 더!] → 즉시 대기실 복귀, [나가기] → 즉시 퇴장 + 대기실에서 제거. 10초 동안 미선택 → 나가기 처리. 대기실에서는 아직 시상식에 있는 유저를 "시상 진행 중.."으로 표시 |
| 모드2 종료 화면 | 시상식과 같은 규칙에 시간만 30초 (GIF 저장 시간 확보) |
| 뒤로가기 | 이탈하면 안 되는 화면을 모두 찾아 막음 (3-8) |

## 미결 항목

- [x] Railway 로그 확인: 2026-10-02 15:37~15:51 KST 사이 서버 프로세스 크래시·재시작 9회 → R1 확정 (상세는 R1·R8)
- [x] 운영 DB `WordPool` 카테고리별 단어 수: 확인 생략. R9는 대체 로직으로 크래시만 방지 (운영 시드 상태는 미확인)
- [x] A-3 증상: 새 게임 시작 직후 "정답입니다!" 오버레이(2초짜리)가 뜬 뒤 게임이 멈춤 → C10 참고
- [x] E-2 환경: 실기기, 앱을 재시작해도 계속 발생 → C9 원인 확정
- [x] E-3 온보딩: 사용자가 추후 직접 작업, 이번 범위에서 제외
- [x] F-2 위치: 친구 탭 > 요청 > 보낸 요청의 친구 닉네임 (`DARK_100`) → 시그니처 연핑크 `PRIMARY_100`

---

## 1. 문제 분류

### A. 게임 세션·동시성 (서버 핵심)
- **A-1** 게임 시작 순간 새 유저가 입장하면 게임 화면에 합류되고 전체가 멈춤
- **A-2** 동시 정답 시 전체 멈춤, 채팅 입력 잠김, 다음 출제자로 넘어가지 않음
- **A-3** 새 방에서 게임 시작 시 이전 게임에서 맞힌 문제가 정답으로 뜨고 멈춤
- **A-4** 끝난 게임이 계속 이어지는 느낌, 여러 방 동시 진행 시 혼선 우려
- **A-5** 전원 준비 완료가 아닌데도 게임이 시작됨

### B. 대기실 진입·이탈
- **B-1** 방 생성 후 진입 시 텅 빈 대기실이 보임
- **B-2** 대기실에서 뒤로가기 시 방 만들기 화면으로 돌아감 (홈으로 가야 함)
- **B-3** 대기실 퇴장 확인 얼럿 없음

### C. 초대·친구
- **C-1** 초대를 보낸 유저에 "초대됨" 표시 없음
- **C-2** 대기실에 있는 유저는 초대를 받아도 아무것도 안 뜸
- **C-3** 대기실에서 유저를 누르면 프로필 + 친구 추가 / 닫기가 필요

### D. 로딩·새로고침
- **D-1** 로딩 중 빈 상태 문구가 먼저 보임 (친구 목록 등)
- **D-2** Pull to Refresh 필요

### E. 앱 시작·인증
- **E-1** 스플래시 하얀 깜빡임
- **E-2** 애플 재로그인 시 `AuthorizationError 1000`
- **E-3** 온보딩 화면 필요

### F. UI 디테일
- **F-1** "친구 코드" → "해시태그" 문구 변경
- **F-2** 친구 요청 후 글자색 검정 → 흰색
- **F-3** Android 친구·요청 화면 블러 미적용

---

## 2. 원인 분석

### 서버

| # | 원인 | 근거 | 영향 |
|---|---|---|---|
| R1 | **확정**: 전역 에러 핸들러 없음. 소켓 핸들러가 `void handler()`로 호출되어 내부 에러 1건으로 Node 프로세스가 죽고 메모리 타이머가 전부 사라짐. 운영 로그에서 15분 동안 크래시·재시작 9회 확인 (`Error: WORD_POOL_EMPTY` at `pickWord ← startRound ← handleRoomStart`, `TypeError: Cannot read properties of null (reading 'drawerId')` at `handleChatSend`) | `apps/server/src/main.ts`, `socket/game.namespace.ts`, Railway 로그 | A-1, A-2, A-4 |
| R8 | **확정**: `handleRoomStart`가 `status=MODE1_ROUND_START`를 먼저 저장하고 `startRound`에서 `current`를 채움. 그 사이에 오는 채팅, 또는 `pickWord`가 실패해 `current=null`인 채로 남은 방의 채팅은 `current.drawerId`에서 TypeError → 크래시. 재시작 후에도 Redis에 같은 상태가 남아 있어 그 방에서 채팅할 때마다 다시 크래시 | `room.ts` `handleRoomStart`, `chat.ts` `handleChatSend` | A-1, A-2 |
| R9 | `WORD_POOL_EMPTY`: 시드에는 7개 카테고리마다 50개씩 있지만, 운영 배포 명령(`railway.json` startCommand)은 마이그레이션만 하고 시드는 실행하지 않음 → 운영 DB에 일부 카테고리 단어가 비어 있을 가능성 (추정, DB 직접 조회 필요) | `railway.json`, `prisma/seed.ts`, `services/word.service.ts` | A-1, A-2 |
| R2 | 락은 `room:join`에만 적용. ready·start·정답·라운드 종료·타이머는 락 없이 read-modify-write | `socket/handlers/room.ts`, `chat.ts`, `game.ts` | A-2 |
| R3 | 게임 세션 ID 없음. 다음 라운드 예약 `setTimeout(startRound, 3000)`을 추적·취소하지 않아 종료 후에도 라운드가 되살아남 | `socket/handlers/game.ts` `endRound` | A-3, A-4 |
| R4 | AWARD 후 방 상태 잔존, `room:start`가 `LOBBY` 상태를 확인하지 않음, `isReady`/`allReady` 초기화 없음 | `room.ts` `handleRoomStart`, `game.ts` `endGame` | A-4, A-5 |
| R5 | 진행 중인 게임에 처음 들어오는 유저도 입장 허용 | `room.ts` `handleRoomJoin` | A-1 |
| R6 | `allReady`를 ready 이벤트 때만 계산 (join/leave 시 재계산 없음) | `room.ts` `handleRoomReady` | A-5 |
| R7 | `recentMessages` Map을 정리하지 않음 (누수 + 이전 게임 데이터 잔존) | `chat.ts` | A-3 |

### 클라이언트

| # | 원인 | 근거 | 영향 |
|---|---|---|---|
| C1 | 게임 리스너를 게임 화면 마운트 후 등록 → 첫 `game:round:start`를 놓침. 모드1은 재입장해도 현재 라운드를 다시 보내지 않음 | `app/room/[code]/game.tsx`, `features/game/model/useGameStore.ts` | A-1, A-2 |
| C2 | 리스너 `off` 없음 → 화면 재진입 시 중복 등록 | 동일 | A-3 |
| C3 | 채팅 입력은 다음 `round:start` 수신 전까지 잠김 | `game.tsx` `getInputBarState` | A-2 |
| C4 | `roomState`가 null이어도 빈 슬롯 렌더 | `app/room/[code]/index.tsx` | B-1 |
| C5 | 뒤로가기가 `router.back()`이고 얼럿·하드웨어 백 처리 없음 | 동일 | B-2, B-3 |
| C6 | 네이티브 스플래시 배경 `#FAFAF0`과 JS 스플래시 오버레이 `#1E1C2C`의 색 불일치 | `app.json`, `app/_layout.tsx` | E-1 |
| C7 | expo-blur 57 Android는 `blurTarget` + `BlurTargetView`가 필요한데 미지정 | `app/(tabs)/friends.tsx` | F-3 |
| C8 | `ListEmptyComponent`가 로딩 상태를 구분하지 않음 | `friends.tsx` | D-1 |
| C9 | **확정**: 현재 네이티브 빌드에 `com.apple.developer.applesignin` entitlement가 없음. Expo SDK 57 prebuild는 `ios.usesAppleSignIn: true`여도 `expo-apple-authentication`이 설치돼 있을 때만 entitlement를 추가하고, 없으면 경고만 냄. 이 프로젝트는 `@invertase/react-native-apple-authentication`을 사용하므로 SDK 업그레이드 후 prebuild(2026-10-02)에서 누락됨 | `ios/SketchCatch/SketchCatch.entitlements`(`aps-environment`만 있음), `@expo/prebuild-config@57` `expo-apple-authentication.js` | E-2 |
| C10 | **유력 가설**: 방 소켓이 앱 전역 싱글턴. `connect()`는 이미 연결돼 있으면 기존 소켓을 그대로 쓰고, 이전 방 레이아웃의 `disconnect()`는 나중에 실행될 수 있음. 초대 푸시로 방을 옮기면 이전 방 화면 위에 `router.push`로 새 방이 쌓이고, 같은 소켓에서 leave/join만 함. 이전 게임 리스너도 해제되지 않음 → 이전 방의 `game:round:end`를 새 게임 화면이 받아 오버레이 표시 → 이후 이전 레이아웃이 정리되면서 공용 소켓을 끊어 새 게임이 멈춤 | `shared/model/room.ts` `connect`, `app/room/[code]/_layout.tsx`, `features/push/ui/NotificationGate`, `features/push/lib/useNotificationListeners.ts` | A-3 |

---

## 3. AS-IS / TO-BE

### 3-1. 게임 세션·동시성

| 영역 | AS-IS | TO-BE |
|---|---|---|
| 에러 내성 | 핸들러 에러 = 프로세스 종료 | 소켓 핸들러 공통 래퍼(try/catch → 로그 + 소켓 `error` 전송) + `unhandledRejection` 로깅. `pickWord` 실패 시 기본 카테고리로 대체 |
| 라운드 시작 (R8) | 상태를 먼저 저장하고 `current`는 나중에 채움, 핸들러는 `current`를 null 체크 없이 사용 | `current`와 상태를 한 번에 저장. 모든 핸들러에서 `current`가 null이면 무시 |
| 제시어 풀 (R9) | 비어 있으면 throw | 선택한 카테고리 중 단어가 있는 카테고리로 대체하고, 그래도 없으면 게임을 시작하지 않고 방장에게 에러 전송. 운영 DB 시드 상태를 확인한 뒤 보충 |
| 상태 변경 | join만 락 | ready·start·leave·정답·라운드 종료·타이머 콜백 전부 `withRoomLock` |
| 게임 식별 | 방 코드만 있음 | 시작할 때마다 `gameId` 발급. 타이머·이벤트에 `gameId + roundIndex` 포함, 다르면 무시 |
| 타이머 | Map 2개 + 추적하지 않는 setTimeout | 방 단위 타이머 레지스트리. 종료·방 삭제 시 전부 해제 |
| 상태 머신 | start가 status를 확인하지 않음 | `LOBBY → IN_GAME → AWARD → LOBBY(복귀)`. start는 `LOBBY`에서만 허용 |
| 게임 종료 | AWARD 상태가 남아 재시작 가능 | `endGame`: gameId 무효화, 타이머 해제. 대기실 복귀 시 `status=LOBBY`, `isReady=false`, `allReady=false`, `scoreboard`·`current`·`turnSchedule` 초기화, `left` 유저 제거 |
| 입장 정책 | 진행 중에도 신규 입장 가능 | `LOBBY`가 아니면 신규 유저 거부(`GAME_IN_PROGRESS`), 기존 유저 재접속만 허용 |
| allReady | ready 이벤트 때만 계산 | join·leave·ready·호스트 승계 때마다 재계산. start 시점에 재검증 |
| 동시 정답 | 2번 처리 | 락 안에서 `status`·`roundIndex` 확인 후 최초 1명만 처리 |
| 재접속 동기화 | 모드1은 재전송 없음 | `room:join` 시 현재 라운드 스냅샷 재전송 (출제자에게만 제시어, 남은 시간 포함) |
| 메모리 | `recentMessages` 계속 누적 | 방·게임 단위로 관리, 종료 시 정리 |
| 배포 전제 | 명시 없음 | 메모리 타이머는 단일 인스턴스 전제임을 명시 (확장 시 Redis adapter 필요) |

### 3-2. 클라이언트 게임 흐름

| 영역 | AS-IS | TO-BE |
|---|---|---|
| 리스너 | 게임 화면 마운트 시 등록, 해제 없음 | `room/[code]/_layout`에서 소켓 생성 직후 1회 등록, 언마운트 시 해제 |
| 스토어 | 게임 화면 진입 시 reset | 방 진입·이탈·대기실 복귀 시 reset + `gameId`가 다른 이벤트는 무시 |
| 채팅 잠김 | 다음 round:start까지 잠김 | 서버 수정이 근본 해결. 보조로 `round:end` 후 일정 시간 안에 다음 라운드가 없으면 재동기화 |
| 소켓 수명 (C10) | 전역 싱글턴, 이미 연결돼 있으면 재사용, 이전 방 정리가 늦게 실행될 수 있음 | 방 코드 단위로 소켓 소유: 다른 방으로 이동하면 이전 소켓을 먼저 `ROOM_LEAVE` 후 끊고 새로 연결. `disconnect`는 자기가 만든 소켓만 정리. 초대로 방을 옮길 때는 `replace` 사용 |
| 이벤트 필터 | 없음 | 모든 게임 이벤트에 `code + gameId`를 포함하고, 현재 방·게임과 다르면 무시 |
| 진단 로그 | 없음 | 개발 빌드에서 `room:join`/`round:start`/`round:end` 수신 시 `code·gameId·roundIndex`를 `console.log`로 확인 |
| 시상식 | 30초 후 홈으로 자동 퇴장, 버튼은 [나가기]만 | 10초 카운트다운 + [한번 더!] / [나가기] (상세는 3-2-1) |

#### 3-2-1. 시상식 → 대기실 복귀

| 영역 | AS-IS | TO-BE |
|---|---|---|
| 서버 상태 | `endGame` → `AWARD`로 끝 | `endGame` → `AWARD` + 전원 `inAward=true` + 10초 서버 타이머(`gameId`로 보호) |
| [한번 더!] | 없음 | 신규 이벤트 `room:rematch` → 해당 유저 `inAward=false`, `isReady=false` → 해당 유저만 대기실로 이동 |
| [나가기] | `router.replace('/(tabs)')` (`ROOM_LEAVE` 없이 소켓 끊김에 의존) | `ROOM_LEAVE` 전송 → 서버에서 즉시 제거·방장 승계 → 홈 |
| 10초 만료 | 클라이언트 30초 타이머 | 서버 타이머가 `inAward=true`인 유저를 일괄 제거 → `status=LOBBY` + 세션 초기화. 클라이언트 카운트다운은 표시용 |
| 조기 전환 | 없음 | 남은 `inAward` 유저가 0명이면 10초 전이라도 즉시 `LOBBY` 전환 |
| 대기실 표시 | 해당 없음 | `inAward=true`인 슬롯에 "시상 진행 중.." 표시. 해당 유저가 남아 있는 동안 준비·시작 비활성 |
| 전원 이탈 | 해당 없음 | 남은 유저 0명이면 방 삭제 |

### 3-3. 대기실

| 항목 | AS-IS | TO-BE |
|---|---|---|
| B-1 | 빈 슬롯 렌더 | 내 플레이어가 포함된 `room:state`를 받기 전까지 스케치북 스피너 + "대기실 입장 중" |
| B-2 | `router.back()` | `ROOM_LEAVE` 후 `router.replace('/(tabs)')`, 방 만들기 → 대기실은 `replace` |
| B-3 | 얼럿 없음 | 헤더 뒤로가기, iOS 스와이프, Android 하드웨어 뒤로가기 모두 확인 얼럿 |
| A-5 | 클라이언트는 `allReady`로 비활성 처리됨 | 서버 재계산(3-1)으로 해결, 클라이언트 유지 |

### 3-4. 초대·친구

| 항목 | AS-IS | TO-BE |
|---|---|---|
| C-1 | 토스트만 | 보낸 대상 버튼 "초대됨" + 비활성 |
| C-2 | 푸시만 발송, 대기실에서 반응 없음 | 대기실·게임 중인 친구는 초대 버튼 비활성 + 상태 표시. 서버도 대상 presence가 `IN_LOBBY`/`IN_GAME`이면 거부 |
| C-3 | 슬롯 터치 반응 없음 | 프로필 Dialog(캐릭터 + 닉네임 + #해시태그), 친구가 아니면 [친구 추가] / [닫기] |

### 3-5. 로딩·새로고침

| 용도 | 스피너 |
|---|---|
| 화면 첫 진입, 전체 로딩 (친구 목록, 대기실 입장, 매칭) | 스케치북 스피너 |
| Pull to Refresh (친구 목록, 받은 요청, 홈) | 원형 스피너 |
| 버튼 내부 처리 중 (요청 보내기, 수락/거절, 초대, 입장) | 원형 스피너 (소형) |

- D-1: `isLoading`이면 스피너, 로딩 완료 후 0건일 때만 빈 상태 문구
- 스피너 2종은 구현 완료 (2026-10-02): 스케치북형 `SketchbookLoadingSpinner`는 전반적인 로딩용, 원형은 회전·당김 진행률을 지원하는 공용 스피너. 남은 작업은 화면에 적용하는 것뿐

### 3-6. 앱 시작·인증

| 항목 | AS-IS | TO-BE |
|---|---|---|
| E-1 | 네이티브 `#FAFAF0` / JS `#1E1C2C` | 네이티브 스플래시 배경을 `#1E1C2C`로 통일, 첫 프레임 로고 위치 일치 (재빌드 필요) |
| E-2 | 네이티브 entitlement에 Sign in with Apple 없음 | `app.json`의 `ios.entitlements`에 `"com.apple.developer.applesignin": ["Default"]`를 명시 → prebuild로 entitlement 생성 확인 → 재빌드. 추가로 에러 코드별 사용자 문구 (취소 1001은 무시) |
| E-3 | 프로필 설정(step1/2)만 있음 | 이번 범위 제외 (사용자가 직접 작업) |

### 3-7. UI 디테일

| 항목 | AS-IS | TO-BE |
|---|---|---|
| F-1 | "친구 코드" | UI 문구만 "해시태그", 식별자 `friendCode` 유지 |
| F-2 | 보낸 요청 닉네임 `colors.DARK_100` (`app/(tabs)/friends.tsx`) | `colors.PRIMARY_100` |
| F-3 | Android 블러 없음 | `BlurTargetView` + `blurTarget` ref + `blurMethod` (탭바·ProfileHeader도 점검) |

### 3-8. 뒤로가기 차단 화면 산출

| 화면 | AS-IS | TO-BE |
|---|---|---|
| `room/create` → 대기실 진입 | `router.push('/room/{code}')` (create가 스택에 남음) | `useCreateRoom`·`useJoinRoom`·푸시 진입을 `replace`로 → 대기실 아래에 create가 남지 않음 |
| `room/[code]/index` (대기실) | 헤더 백 `router.back()`, iOS 스와이프 허용, Android 하드웨어 백 처리 없음, 얼럿 없음 | 스와이프 차단 + 헤더·하드웨어 백 모두 "나가시겠어요?" 얼럿 → `ROOM_LEAVE` + `router.replace('/(tabs)')` |
| `room/[code]/game` | 스와이프 차단 + 하드웨어 백 얼럿 | 유지 |
| `room/[code]/mode2` | 위와 동일 | 유지 |
| `room/[code]/mode2-review` | 위와 동일 | 유지 |
| `room/[code]/award` | 스와이프 허용, 하드웨어 백 처리 없음 → 게임 이전 화면으로 이탈 가능 | 스와이프 차단, 하드웨어 백은 [나가기]와 동일하게 처리 |
| `room/[code]/mode2-end` | 스와이프 허용, 하드웨어 백 처리 없음 | award와 동일 처리 |
| 차단 공통 로직 | 화면마다 `BackHandler` 직접 작성 (game, mode2, mode2-review) | 3곳 이상에서 반복되므로 `shared/lib` 훅 하나로 통합 (React Navigation `usePreventRemove` 사용 가능 여부는 설치 버전 타입 확인 후 결정) |
| 온보딩·로그인·탭 | `replace` 기반 이동이라 이탈 경로 없음 | 변경 없음 |

---

## 4. 진행 순서

1. 서버 동시성·세션(3-1) → verify: Vitest로 동시 정답, 시작 직후 입장, 종료 후 예약 타이머, 미준비 시작, 대기실 복귀 테스트
2. 클라이언트 게임 흐름(3-2) → verify: 기기 2대 이상으로 첫 라운드 수신, 동시 정답, 복귀 후 재대결
3. 대기실(3-3) + 시상식 복귀(3-2-1) + 뒤로가기 차단(3-8) + 초대·친구(3-4) → verify: iOS 스와이프 / Android 하드웨어 백 / 헤더 백으로 화면마다 이탈 시도, 시상식 10초 만료·[한번 더!]·[나가기] 시나리오
4. 스피너·PTR(3-5) → verify: 느린 네트워크에서 빈 상태 문구가 먼저 뜨지 않는지 확인
5. 스플래시·블러·문구·온보딩(3-6, 3-7) → verify: iOS/Android 릴리스 빌드

## 5. 구현 현황 (2026-10-06)

| 항목 | 상태 | 검증 |
|---|---|---|
| A-1~A-5 서버 | 구현 | Vitest 163/163, 로컬 서버 실소켓 E2E 14/14 (테스트 계정 4개) |
| A-1 클라이언트 (첫 라운드 수신) | 구현 | 시뮬레이터 + 스크립트 플레이어로 확인: 시작 직후 라운드·출제자·힌트·타이머 표시 |
| A-2~A-4 클라이언트 (소켓 수명·gameId·리스너) | 구현 | 시뮬레이터에서 정답 → 다음 라운드 자동 진행 확인. 동시성은 실기기 테스트 필요 |
| 시상식 복귀 | 구현 | 시뮬레이터 확인: [한번 더!] → 대기실("시상 진행 중.." 표시·버튼 비활성) → 10초 만료 시 미선택 유저 제거·방장 승계 / 아무것도 안 누르면 10초 후 홈 |
| B-1~B-3, 뒤로가기 차단 | 구현 | 시뮬레이터 확인: 대기실·게임 헤더 뒤로가기 얼럿 → 홈(방 만들기 화면 아님), iOS 스와이프 차단 |
| C-1~C-3 | 구현 | 시뮬레이터 확인: 대기실 프로필(해시태그·"요청 보냄"). 초대는 실기기 테스트 필요 |
| D-1, D-2 | 구현 | 당겨서 새로고침 시 재요청 확인 (로컬 서버가 빨라 스피너 화면 캡처는 못 함) |
| E-1 스플래시 | `app.json` + iOS prebuild 반영 | 시뮬레이터 확인: 네이티브 스플래시가 어두운 배경 (Android는 다음 네이티브 빌드에 반영) |
| E-2 애플 | entitlement 추가, iOS prebuild 반영 | entitlements 파일 확인. 실기기 재로그인은 새 빌드로 확인 필요 |
| F-1, F-2 | 구현 | F-2 픽셀 색 확인(#FFD0E8) |
| F-3 | 구현 (Android 12+만 실제 블러) | Android 기기 확인 필요 |
| E-3 온보딩 | 제외 | - |

### 계획 대비 변경

- 뒤로가기 차단: 처음엔 `usePreventRemove`(모든 이동 가로채기)로 구현했으나, 가로챈 이동을 다시 dispatch하면 루트 스택 대상 이동(`router.replace('/(tabs)')`)이 무시되어 시상식에서 홈으로 가지 못하는 문제를 시뮬레이터에서 발견. 기존에 쓰던 방식으로 정리: `shared/lib/useHardwareBack`(Android 하드웨어 뒤로가기) + 방 스택·루트 `room` 라우트 `gestureEnabled: false`(iOS 스와이프) + 헤더 뒤로가기에서 직접 확인 얼럿
- 서버 추가 수정: REST·매칭으로 만든 방의 플레이어 `friendCode`가 빈 값이던 버그 수정 (대기실 프로필의 해시태그 표시·친구 추가에 필요)

### 검증 중 발견한 별도 이슈 → 처리 완료 (2026-10-06)

| 이슈 | 원인 | 처리 | 검증 |
|---|---|---|---|
| 그림판 크기 측정 실패 (`<Canvas onLayout>` 에러 토스트) | New Architecture에서 Skia Canvas의 `onLayout`이 호출되지 않아 창 크기 근사값으로 그려짐 → 기기마다 그림 좌표가 어긋날 수 있었음 | Canvas를 감싼 View의 `onLayout`으로 측정 | 시뮬레이터에서 그린 V가 터치 위치와 일치, 다른 플레이어가 받은 정규화 좌표도 일치 |
| SkPath deprecated 경고 | Skia 2.6부터 `SkPath.moveTo/lineTo` 직접 변경 deprecated | `shared/lib/strokePath.ts`(PathBuilder)로 통일 (DrawingCanvas·ReferenceCanvas), SketchbookLoadingSpinner도 PathBuilder로 변경 | 경고 0건 |
| `INVALID_TOKEN` 에러 토스트 | 토큰 만료(자동 갱신되는 정상 흐름)를 `console.error`로 기록 | 인증 만료는 `console.log`, 그 외 연결 오류는 `console.warn` (socket.io 자동 재연결) | 에러 토스트 0건 |
| `SafeAreaView` deprecated 경고 | dripsy 4.3.8이 RN `SafeAreaView`를 import (앱은 미사용) | `pnpm patch`로 dripsy를 View로 대체 (`patches/dripsy@4.3.8.patch`) | 경고 0건 |
| 방장 교체 시 제목 | 기본 제목이 이전 방장 이름으로 고정 | 기본 제목("OO님의 방"/"OO의 방")일 때만 새 방장 이름으로 변경, 직접 정한 제목 유지 | 단위 테스트 4건 |
| 랜덤 매칭 미동작 | `match:update`/`match:found`를 방 소켓으로만 보냈는데 홈에는 방 소켓이 없음 | presence 소켓(로그인 중 항상 연결)으로 전송·수신 | 시뮬레이터 + 스크립트 2명 매칭 → 방 자동 입장 확인 |
| 방 만들기 화면 스와이프 막힘 | 루트 `room` 라우트 전체에 `gestureEnabled: false` | `room/_layout`에서 방 만들기 화면만 스와이프 허용 | 시뮬레이터에서 방 만들기 스와이프 → 홈, 대기실은 차단 유지 |

> 개발 툴 자체 로그(`bundle scheme is file…`, `Sending websocketMessage…`)는 Expo dev launcher/Metro 내부 로그라 앱 코드와 무관 (릴리스 빌드 영향 없음)

## 6. 실기기 테스트 케이스

> 준비: 최신 서버 배포 + 최신 앱 빌드를 함께 배포. 서버만 먼저 배포하면 구버전 앱에 [한번 더!] 버튼이 없어 시상식 10초 후 전원 퇴장된다.
> 개발 빌드에서는 로그인 화면의 "테스트1~4" 버튼으로 기기마다 다른 계정을 쓸 수 있다 (로컬 서버 대상).

### 게임 진행 (3명 이상)
- [ ] 방 생성 직후 "대기실에 입장하고 있어요..." 스피너가 보이고, 빈 대기실이 보이지 않는다
- [ ] 한 명이라도 준비 전이면 방장 [게임 시작]이 비활성, 전원 준비 후 활성
- [ ] 전원 준비 후 시작 직전에 새 유저가 입장하면 시작 버튼이 다시 비활성
- [ ] 게임 시작 직후 다른 기기가 방 코드로 입장 시도 → "이미 게임이 진행 중인 방이에요." 토스트, 입장 불가
- [ ] 시작과 동시에 모든 기기에 첫 라운드(출제자·제시어·타이머)가 표시된다 (멈춤 없음)
- [ ] 남은 시간 10초 전후에 두 명이 동시에 정답 → 정답자 1명만 점수, 3초 후 다음 출제자로 넘어감, 채팅 정상
- [ ] 여러 라운드를 끝까지 진행해 시상식까지 도달
- [ ] 게임 중 앱을 백그라운드로 보냈다가 복귀 → 현재 라운드로 복구

### 시상식 (모드1 10초, 모드2 30초)
- [ ] 일부만 [한번 더!] → 누른 유저는 대기실로, 대기실 슬롯에 남은 유저는 "시상 진행 중.." 표시, 준비·시작 비활성
- [ ] 아무것도 안 누른 유저는 카운트다운 종료 시 홈으로, 대기실에서 제거
- [ ] [나가기] → 즉시 홈, 대기실에서 즉시 제거
- [ ] 전원 [한번 더!] → 카운트다운 전에 바로 대기실 전환
- [ ] 방장이 나가면 남은 유저 중 한 명이 방장 승계
- [ ] 대기실 복귀 후 다시 게임 시작 → 이전 게임 정답 오버레이가 뜨지 않음 (A-3 재현 시도)

### 여러 방 동시 진행 (2개 이상 방, 4명 이상)
- [ ] 방 A·방 B를 동시에 진행해도 채팅·정답·라운드가 섞이지 않음
- [ ] 방 A 게임 중 나간 유저가 새 방 C를 만들어 시작 → 방 A의 이벤트가 방 C에 보이지 않음

### 대기실·뒤로가기
- [ ] 대기실 헤더 뒤로가기 / iOS 스와이프 / Android 뒤로가기 → "대기실 나가기" 얼럿, 확인 시 홈 (방 만들기 화면 아님)
- [ ] 게임·모드2·리뷰 화면: 이탈 시 확인 얼럿/다이얼로그
- [ ] 시상식·모드2 종료 화면: 뒤로가기 = [나가기]와 동일

### 초대·친구
- [ ] 초대 보낸 친구는 버튼이 "초대됨"으로 바뀜
- [ ] 대기실·게임 중인 친구는 초대 버튼 비활성
- [ ] 대기실에서 다른 유저 슬롯 터치 → 프로필(캐릭터·닉네임#해시태그), 친구 아니면 [친구 추가], 요청 보낸 상태면 "요청 보냄", 친구면 [닫기]만
- [ ] 보낸 요청 닉네임이 연핑크로 표시

### 로딩·새로고침
- [ ] 친구 탭 첫 진입: 스피너 → 목록 (빈 상태 문구가 먼저 보이지 않음)
- [ ] 친구/요청 탭 당겨서 새로고침 → 원형 픽셀 스피너
- [ ] 친구 요청 보내기·수락/거절·초대·방 만들기·코드 입장 버튼 처리 중 원형 스피너

### 앱 시작·인증·기타
- [ ] 앱 첫 실행 시 하얀 화면 깜빡임 없이 어두운 스플래시 → 로고 애니메이션
- [ ] 애플 로그인 → 로그아웃 → 애플 재로그인 성공 (실기기, 새 빌드)
- [ ] "친구코드" 대신 "해시태그" 문구 (온보딩, 해시태그 변경, 친구 추가, 에러 문구)
- [ ] Android 12 이상: 친구·요청 화면 배경 블러

## 참고 자료

- [Redis: matchmaking and game session state](https://redis.io/tutorials/matchmaking-and-game-session-state-with-redis/)
- [DEV: Real-time multiplayer game server with Socket.io and Redis](https://dev.to/dowerdev/building-a-real-time-multiplayer-game-server-with-socketio-and-redis-architecture-and-583m)
- [DEV: Rock Paper Scissors is secretly a distributed systems problem](https://dev.to/ozgurozalp/rock-paper-scissors-is-secretly-a-distributed-systems-problem-21i9)
- [socket.io PR #5432](https://github.com/socketio/socket.io/pull/5432)
- [Apple Developer Forums: error 1000](https://developer.apple.com/forums/thread/685425)
