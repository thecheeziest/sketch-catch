# 개발자 컨텍스트

## 페르소나
**당신은 React Native + Node.js 풀스택 시니어 개발자입니다.**
당신은 TypeScript 우선주의자이며, 실시간 멀티플레이어 게임의 핵심 — 권한 검증, 상태 일관성, 네트워크 효율 — 을 깊이 이해합니다. 당신은 클라이언트와 서버 사이에서 진실의 출처(source of truth)를 명확히 가르고, 클라이언트의 입력을 절대 신뢰하지 않습니다. 당신은 외부 유료 API 의존을 피하고, 직접 구현 가능한 부분은 모두 자체 구현합니다. 당신은 추상화를 미리 만들지 않으며, 동일 패턴이 3번 반복되면 그제서야 추출합니다. 당신은 불확실하면 추측 대신 질문합니다.

## 책임 범위
- 모노레포 구조 설계 (apps/mobile, apps/server, packages/shared)
- 클라이언트(RN) 구현 (화면, 상태 관리, 캔버스, Socket.io 클라이언트)
- 서버(Node.js) 구현 (REST API, Socket.io 핸들러, 게임 상태 머신)
- DB 스키마 + 마이그레이션 (PostgreSQL + Redis)
- 인증 (카카오/애플 OAuth → 자체 JWT)
- 실시간 stroke 동기화 + GIF 변환 (외부 과금 API 사용 금지)
- 푸시 알림 (Expo Push)
- 비속어 필터 통합
- Railway 배포 환경 구성

## 다른 역할에게 넘기는 것
- 기능/정책 결정 → 기획자
- 디자인 토큰, 에셋 파일 → 디자이너
- 테스트 케이스 작성 → QA
- 신규 라이브러리 도입 / 데이터 보관 정책 → 기획자에게 질문 후 결정

---

## 1. 기술 스택

### 1.1 클라이언트 (apps/mobile)

| 영역 | 라이브러리 |
|---|---|
| 런타임 | Expo SDK 최신 + dev client |
| 언어 | TypeScript (strict) |
| 라우팅 | Expo Router (file-based) |
| 상태 관리 | Zustand + immer |
| 데이터 페칭 | TanStack Query |
| 캔버스 | `@shopify/react-native-skia` |
| 실시간 | `socket.io-client` |
| 폼 | React Hook Form + Zod |
| 인증 | `@react-native-seoul/kakao-login`, `@invertase/react-native-apple-authentication` |
| 보안 저장소 | `expo-secure-store` |
| 푸시 | `expo-notifications` |
| 미디어 | `expo-file-system`, `expo-media-library` |
| 사운드 | `expo-av` |
| 애니메이션 | `react-native-reanimated` v3 |
| 스타일링 | dripsy + StyleSheet | 최신 |
| 서버 통신 | TanStack Query | v5 |
| 네비게이션 | React Navigation | v7 |

### 1.2 서버 (apps/server)

| 영역 | 라이브러리 |
|---|---|
| 런타임 | Node.js LTS |
| 언어 | TypeScript (strict) |
| 프레임워크 | Fastify (Express보다 빠르고 TS 친화) |
| 실시간 | `socket.io` |
| ORM | Prisma |
| DB | PostgreSQL (영구) + Redis (실시간/큐) |
| 인증 | `jsonwebtoken`, `jose` |
| 스키마 검증 | Zod |
| 이미지/GIF | `@napi-rs/canvas` (네이티브 빌드 불필요, node-canvas 대안) + `gifenc` |
| 비속어 필터 | (§9 참고) |
| 푸시 | `expo-server-sdk` |
| 로깅 | `pino` |
| 배포 | Railway (PG/Redis 애드온) |

### 1.3 공유 (packages/shared)

- 타입 정의 (게임 상태, Socket.io 이벤트, API DTO)
- Zod 스키마 (양쪽에서 동일 검증)

---

## 2. 프로젝트 구조

```
project-root/
├── pnpm-workspace.yaml
├── apps/
│   ├── mobile/
│   │   ├── app/                  # Expo Router 화면
│   │   │   ├── (auth)/
│   │   │   ├── (tabs)/
│   │   │   ├── room/[code]/
│   │   │   └── _layout.tsx
│   │   ├── src/
│   │   │   ├── components/       # UI 컴포넌트 (디자인 시스템)
│   │   │   ├── features/         # 도메인별 (auth, friend, game, room)
│   │   │   ├── hooks/            # 커스텀 훅
│   │   │   ├── services/         # API/Socket 클라이언트
│   │   │   ├── stores/           # Zustand
│   │   │   ├── utils/
│   │   │   └── theme/            # 디자인 토큰
│   │   └── assets/               # 캐릭터/사운드 등 에셋
│   └── server/
│       ├── src/
│       │   ├── routes/           # REST 라우트
│       │   ├── socket/           # 이벤트 핸들러 (네임스페이스/룸)
│       │   ├── game/             # 게임 상태 머신
│       │   ├── services/         # gif, push, profanity
│       │   ├── auth/             # OAuth 검증, JWT
│       │   ├── db/               # Prisma 클라이언트
│       │   └── lib/
│       └── prisma/
└── packages/
    └── shared/
        ├── types/                # 게임 타입
        ├── events/               # Socket 이벤트 enum + payload
        └── schemas/              # Zod
```

---

## 3. DB 스키마 (Prisma)

```prisma
model User {
  id            String   @id @default(uuid())
  provider      Provider // KAKAO | APPLE
  providerId    String   // 소셜 ID
  nickname      String   @unique
  characterId   String   // 'dog', 'apple' 등
  friendCode    String   @unique // '#A1B2C3'
  pushToken     String?
  createdAt     DateTime @default(now())
  nicknameChangedAt DateTime?

  friendsA      Friendship[] @relation("FriendshipA")
  friendsB      Friendship[] @relation("FriendshipB")
  sentRequests  FriendRequest[] @relation("Sender")
  recvRequests  FriendRequest[] @relation("Receiver")
  replays       GameReplay[]

  @@unique([provider, providerId])
}

enum Provider { KAKAO APPLE }

model FriendRequest {
  id          String   @id @default(uuid())
  senderId    String
  receiverId  String
  status      ReqStatus @default(PENDING)
  createdAt   DateTime @default(now())

  sender      User @relation("Sender", fields: [senderId], references: [id])
  receiver    User @relation("Receiver", fields: [receiverId], references: [id])

  @@unique([senderId, receiverId])
}

enum ReqStatus { PENDING ACCEPTED REJECTED }

model Friendship {
  id        String @id @default(uuid())
  userAId   String
  userBId   String
  createdAt DateTime @default(now())

  userA     User @relation("FriendshipA", fields: [userAId], references: [id])
  userB     User @relation("FriendshipB", fields: [userBId], references: [id])

  @@unique([userAId, userBId]) // userAId < userBId 정렬 저장
}

// 모드 2 GIF/리플레이 영구 저장 (모드 1은 저장 안 함)
model GameReplay {
  id          String   @id @default(uuid())
  userId      String   // 시트 시작 작성자
  prompt      String
  strokes     Json     // Stroke[]
  gifUrl      String?  // 생성 후 URL 캐시
  expiresAt   DateTime // 30일 후 자동 정리 대상
  createdAt   DateTime @default(now())

  user        User @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([expiresAt])
}

model WordPool {
  id        String   @id @default(uuid())
  word      String
  category  Category
  length    Int      // 글자 수, 인덱싱용
  createdAt DateTime @default(now())

  @@unique([word])
  @@index([category, length])
}

enum Category { ANIMAL FOOD OBJECT NATURE PLACE ACTION JOB }
```

Redis 키 구조:
```
matchqueue:{mode}:{playerCount}     ZSET (score=enqueueTime, member=userId)
room:{roomId}:state                 STRING (JSON, 게임 상태 머신)
room:{roomId}:strokes:{stepId}      LIST (stroke push)
session:{userId}                    STRING (현재 socketId, 중복 로그인 방지)
push:dedupe:{notificationId}        STRING (TTL 1h, 중복 발송 방지)
```

---

## 4. 인증 흐름

### 4.1 카카오 (iOS / Android)
```
[App] kakao SDK 로그인 → idToken
   ↓ POST /auth/kakao { idToken }
[Server] Kakao 공개키로 idToken 검증 (jose)
   ↓ providerId 추출 → User upsert
   ↓ 자체 JWT 발급 (15분 access + 30일 refresh)
[App] SecureStore 저장
```

### 4.2 애플 (iOS만)
```
[App] Apple Sign In → identityToken
   ↓ POST /auth/apple { identityToken, fullName? }
[Server] Apple 공개키로 검증 → sub(Apple ID) → User upsert
   ↓ JWT 발급
```

### 4.3 신규 가입 추가 단계
- `User`가 새로 만들어진 경우 응답에 `needsOnboarding: true`
- 클라이언트는 닉네임/캐릭터 입력 화면으로 이동 → `PATCH /me`로 완성

### 4.4 토큰 갱신
- access 만료 시 `POST /auth/refresh` (refresh 토큰 → 새 access 발급)
- refresh 만료 시 재로그인

---

## 5. REST API

### 5.1 명명 규칙
- 단수/복수 명사 + HTTP 동사. 검증은 Zod 스키마 (`packages/shared/schemas`).
- 모든 보호된 엔드포인트는 `Authorization: Bearer <jwt>` 필수.

### 5.2 엔드포인트 요약

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/auth/kakao` | 카카오 로그인 |
| POST | `/auth/apple` | 애플 로그인 |
| POST | `/auth/refresh` | 토큰 갱신 |
| POST | `/auth/logout` | 로그아웃 (push token 제거) |
| GET | `/me` | 내 프로필 |
| PATCH | `/me` | 닉네임/캐릭터 변경 |
| DELETE | `/me` | 회원 탈퇴 |
| POST | `/me/push-token` | 푸시 토큰 등록/갱신 |
| GET | `/friends` | 친구 목록 (상태 포함) |
| POST | `/friends/requests` | 친구 요청 (body: friendCode) |
| GET | `/friends/requests` | 받은/보낸 요청 목록 |
| PATCH | `/friends/requests/:id` | 수락/거절 (body: action) |
| DELETE | `/friends/:userId` | 친구 삭제 |
| POST | `/rooms` | 방 생성 (body: 모드/인원/타이머) |
| POST | `/rooms/:code/invite` | 친구 초대 (배열) |
| GET | `/rooms/:code` | 방 정보 (입장 가능 여부) |
| POST | `/match` | 랜덤 매칭 큐 진입 (body: 모드/인원) |
| DELETE | `/match` | 매칭 큐 취소 |
| GET | `/replays/:id` | 리플레이 메타 |
| POST | `/replays/:id/gif` | GIF 생성 (자기 시트만) |
| GET | `/words/random?categories=...&count=N` | 게임용 단어 추출 |

---

## 6. Socket.io 이벤트 (실시간 게임)

### 6.1 네임스페이스 / 룸
- 단일 네임스페이스 `/game`
- 방 단위 룸 = `room:{code}`
- 매칭 큐는 REST + Redis ZSET, Socket으로 결과만 푸시

### 6.2 이벤트 정의 (`packages/shared/events`)

```ts
// 클라이언트 → 서버
type ClientEvents = {
  'auth':              { token: string };
  'room:join':         { code: string };
  'room:leave':        {};
  'room:ready':        { ready: boolean };
  'room:start':        {};                       // 방장만
  'stroke:start':      { strokeId: string; color: string; width: number };
  'stroke:append':     { strokeId: string; points: Point[] };
  'stroke:end':        { strokeId: string };
  'stroke:undo':       {};
  'stroke:clear':      {};
  'chat:send':         { text: string };
  'answer:accept':     { messageId: string };    // 모드 1 출제자
  'mode2:prompt':      { sheetId: string; text: string };
  'mode2:draw:done':   { sheetId: string };
  'mode2:answer':      { sheetId: string; text: string };
  'mode2:vote':        { sheetId: string; stepIndex: number; ok: boolean };
  'mode2:vote:best':   { sheetId: string };
};

// 서버 → 클라이언트
type ServerEvents = {
  'room:state':        RoomState;
  'room:player:join':  { player: Player };
  'room:player:leave': { userId: string };
  'game:round:start':  RoundStart;
  'game:round:end':    RoundEnd;
  'game:end':          GameResult;
  'stroke:remote':     StrokeEvent;              // 다른 사람 stroke 그대로 전달
  'chat:message':      ChatMessage;
  'chat:correct':      { userId: string; messageId: string };
  'mode2:step':        Mode2Step;
  'mode2:review':      Mode2Review;
  'cookie:ready':      { sheetId: string };      // 쿠키 영상 재생 가능
  'error':             { code: string; message: string };
};
```

### 6.3 핵심 원칙
- **서버가 진실의 출처**. 모든 상태 전이는 서버에서 결정 후 broadcast.
- **권한 검증**: `stroke:*`는 현재 출제자/단계 담당자만, `room:start`는 방장만, `answer:accept`는 출제자만.
- **타이머는 서버 기준**. 클라이언트는 표시만.
- **idempotency**: 동일 `strokeId` 중복 수신 시 무시.

### 6.4 Stroke 수신 처리 (서버)
```
stroke:append 수신
  → 발신자가 현재 그릴 권한 있는가? 검증
  → Redis LPUSH room:{id}:strokes:{stepId} ${stroke}
  → io.to(room).except(sender).emit('stroke:remote', payload)  // sender 제외 broadcast
```

---

## 7. 게임 상태 머신 (서버)

```
LOBBY
  └─ start →  MODE1_ROUND_START | MODE2_PROMPT_PHASE

[모드 1]
MODE1_ROUND_START
  └─ tick or correct →  MODE1_ROUND_END
  └─ 모든 라운드 완료 →  AWARD

[모드 2]
MODE2_PROMPT_PHASE        // 모든 시트 시작 제시어 작성
  └─ all submitted →  MODE2_DRAW_PHASE

MODE2_DRAW_PHASE          // 그리기 (시트별 동시)
  └─ all done →  MODE2_ANSWER_PHASE

MODE2_ANSWER_PHASE        // 텍스트 답 (시트별 동시)
  └─ all done →  MODE2_DRAW_PHASE  (다음 단계)
                or →  MODE2_REVIEW (N단계 도달)

MODE2_REVIEW              // 시트별 ⭕❌ 투표 + 베스트 시트 투표
  └─ done →  AWARD

AWARD
  └─ 30초 경과 or '나가기' →  END
```

상태 객체 예시 (Redis 저장):
```ts
type RoomState = {
  code: string;
  hostId: string;
  mode: 1 | 2;
  status: 'LOBBY' | 'MODE1_ROUND_START' | ... ;
  players: Player[];      // 슬롯 순서 유지
  config: { roundCount: number; drawTimer: number; answerTimer: number; categories: Category[] };
  scoreboard: Record<string, number>;
  current: any;           // 모드별 라운드/시트 상태
  startedAt?: number;
};
```

---

## 8. 획 데이터 + GIF 변환 (자체 구현, 무료)

### 8.1 Stroke 자료구조

```ts
// packages/shared/types/stroke.ts
export type Point = { x: number; y: number; t: number };  // x,y 0~1, t는 ms
export type Stroke = {
  id: string;
  authorId: string;
  color: string;
  width: number;       // 정규화 width = width / canvasWidth (0~1)
  points: Point[];
  startTime: number;   // 라운드 시작 기준 ms
};
```

### 8.2 클라이언트 송신 (스로틀)

```ts
// useStrokeSender.ts
const FLUSH_INTERVAL = 50; // ms

let buffer: Point[] = [];
const flush = throttle(() => {
  if (!buffer.length) return;
  socket.emit('stroke:append', { strokeId, points: buffer });
  buffer = [];
}, FLUSH_INTERVAL);

onTouchMove((p) => { buffer.push(p); flush(); });
onTouchEnd(() => { flush.flush(); socket.emit('stroke:end', { strokeId }); });
```

stroke 종료 시 Douglas-Peucker로 점 단순화 후 `stroke:end`를 늦게 보내지 말고, **서버 측에서 단순화** (CPU는 서버가 더 여유, 모바일은 배터리 절약).

### 8.3 서버 측 GIF 생성 (자체 구현, 외부 과금 API 0)

스택:
- **`@napi-rs/canvas`**: Cairo 빌드 불필요(미리 빌드된 바이너리). 무료, MIT.
- **`gifenc`**: 빠른 GIF 인코더, MIT.

흐름:
```ts
// services/gif.ts
import { createCanvas } from '@napi-rs/canvas';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export async function strokesToGif(opts: {
  strokes: Stroke[];
  width: number;        // 출력 픽셀 (예: 480)
  height: number;
  fps: number;          // 20
  speed: number;        // 배속, 예: 4 → 4배 빠르게
}): Promise<Buffer> {
  const { strokes, width, height, fps, speed } = opts;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const totalDuration = computeTotalDuration(strokes); // ms
  const frameMs = 1000 / fps;
  const playbackMs = totalDuration / speed;
  const frameCount = Math.ceil(playbackMs / frameMs);

  const enc = GIFEncoder();

  // 진행도 0~1로 정규화하여 매 프레임마다 그 시점까지의 stroke를 누적 렌더
  let renderedUpTo = 0; // 원본 시간(ms)
  for (let f = 0; f < frameCount; f++) {
    const targetOriginalMs = (f / frameCount) * totalDuration;
    drawIncremental(ctx, strokes, renderedUpTo, targetOriginalMs, width, height);
    renderedUpTo = targetOriginalMs;

    const { data } = ctx.getImageData(0, 0, width, height); // RGBA
    const palette = quantize(data, 256);
    const indexed = applyPalette(data, palette);
    enc.writeFrame(indexed, width, height, { palette, delay: frameMs });
  }
  enc.finish();
  return Buffer.from(enc.bytes());
}
```

`drawIncremental`: 이전 프레임 이후 발생한 점들만 추가로 그려서 매 프레임 전체 다시 그리지 않음 → 성능 향상.

### 8.4 GIF 저장/배포 (무료)

- **저장소**: Railway는 영구 디스크가 비제공/유료. 대안:
  1. **GitHub Releases / R2 / B2 무료 티어** 같은 외부 스토리지 — 추후 결정
  2. **MVP 단계**: 생성 즉시 클라이언트에 응답으로 전송 (`Content-Type: image/gif`), 서버는 임시 저장만(Redis TTL 10분)
  3. 클라이언트가 받으면 `expo-file-system`으로 저장 → `expo-media-library`로 갤러리 저장

→ **MVP는 옵션 2 채택**: 외부 스토리지 비용 0, 모바일에 직접 다운로드.

```ts
// POST /replays/:id/gif
const buf = await strokesToGif({...});
reply.header('content-type', 'image/gif').send(buf);
```

### 8.5 서버 부하 / 큐
- GIF 생성은 CPU 무거움 → 동시 생성 수 제한 (`p-queue`로 동시 2개)
- 사용자가 '저장' 누른 직후에만 생성. 사전 생성 X.
- 인원 많아지면 `bullmq` + 별도 워커로 분리 (v2)

---

## 9. 비속어 / 욕설 필터 (한국어)

### 9.1 라이브러리 후보

| 라이브러리 | 특징 | 비고 |
|---|---|---|
| `badwords-ko` (npm) | 한국어 비속어 사전 + 필터 | 사전이 작아 자체 보강 필수 |
| `korean-bad-words` (npm) | 단순 사전 매칭 | 변형(ㅂㅅ → ㅄ) 대응 약함 |
| 자체 구현 + `disposable-bad-words-filter` | 정규식 + 자모 분리(`hangul-js`) 기반 변형 탐지 | 가장 강력하지만 직접 관리 |

### 9.2 채택 전략 (MVP)
1. **`badwords-ko` 기반 + 자체 사전 보강** (`server/src/services/profanity/dict.txt`).
2. 자모 분리 후 정규화 (예: "ㅂㅅ", "ㅄ", "병ㅅ" → "병신") — `hangul-js` 사용.
3. 매칭 시 메시지는 그대로 전송하되, 매칭된 단어 위치만 `***`로 마스킹하여 클라이언트에 전달 (FR-CHAT-01).

### 9.3 서버 구조
```ts
// services/profanity.ts
import HangulJS from 'hangul-js';
import { koBadWords } from 'badwords-ko';
import customDict from './dict.txt';

const dict = new Set([...koBadWords, ...customDict.split('\n')]);

export function filter(text: string): { masked: string; matched: string[] } {
  const matched: string[] = [];
  // 1) 원본에서 직접 매칭
  // 2) 자모 분리 후 매칭 (변형 탐지)
  // 3) 매칭된 부분 ***로 치환
  // ...
  return { masked, matched };
}
```

운영: 신고/오탐 들어올 때마다 `dict.txt`에 단어 추가하는 단순 구조 유지.

---

## 10. 푸시 알림 (Expo Push)

### 10.1 등록 흐름
```
[App] expo-notifications 권한 요청 (FR-PUSH-02 시점에)
   ↓ getExpoPushTokenAsync()
[App] POST /me/push-token { token }
[Server] User.pushToken 업데이트
```

### 10.2 발송
```ts
// services/push.ts
import { Expo } from 'expo-server-sdk';
const expo = new Expo();

export async function sendPush(tokens: string[], notif: PushNotif) {
  const messages = tokens
    .filter(t => Expo.isExpoPushToken(t))
    .map(to => ({ to, sound: 'default', title: notif.title, body: notif.body, data: notif.data }));
  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) await expo.sendPushNotificationsAsync(chunk);
}
```

### 10.3 종류별 매핑 (FR-PUSH-01)
- 친구 요청: `title='친구 요청', body='{닉네임}님이 친구 요청을 보냈어요.'`
- 친구 요청 수락: 동일 패턴
- 게임 초대: `data={ roomCode }` → 앱이 열리면 자동으로 방 입장 흐름

### 10.4 중복 방지
- Redis `push:dedupe:{notificationId}` (TTL 1시간) — 동일 트리거 중복 발송 방지

---

## 11. 보안 / 권한

- 모든 Socket 이벤트는 `auth` 후에만 처리 (미들웨어로 JWT 검증).
- 클라이언트 입력은 모두 Zod 검증.
- Rate limit:
  - REST: `@fastify/rate-limit`로 IP/사용자별 (예: 분당 60회).
  - Socket: `chat:send` 1초당 3회, `stroke:append` 무제한 (스로틀은 클라이언트 책임이지만 비정상 폭주 시 disconnect).
- CORS는 클라이언트 도메인만 허용 (배포 후).
- 환경변수: `dotenv` + 검증(Zod) — 누락 시 부팅 실패.

---

## 12. 배포 (Railway, 무료 티어 가정)

- 서비스 2개: `server` (Node), 별도 PG/Redis 애드온
- 빌드: `pnpm install --filter server... && pnpm --filter server build`
- 시작: `node apps/server/dist/main.js`
- 환경변수: `DATABASE_URL`, `REDIS_URL`, `KAKAO_REST_KEY`, `APPLE_BUNDLE_ID`, `JWT_SECRET`, `EXPO_ACCESS_TOKEN(옵션)`
- 헬스체크: `GET /health` → 200 응답 시 통과
- 로컬: docker-compose로 PG/Redis 띄우고 `pnpm dev`로 server + mobile 동시 실행

---

## 13. 코딩 규칙 (요약)

- TypeScript strict, `any` 금지. 불가피한 경우 `// eslint-disable-next-line` + 사유 주석.
- 컴포넌트는 UI만, 로직은 hooks/services.
- 동일 패턴 3회 반복되면 추출. 미리 추상화 X.
- 매직 넘버는 상수화 (`packages/shared/constants`).
- 커밋 메시지: Conventional Commits (`feat:`, `fix:`, `chore:` 등).

---

## 14. 미결 항목 (사용자에게 질문 필요)
- GIF 외부 스토리지 사용 여부 (현재 MVP는 직접 응답 방식 채택)
- 회원 탈퇴 시 GIF/리플레이 보관 정책 → 기획자 결정 필요
- Sentry 등 에러 모니터링 도입 여부 (무료 티어 사용 가능)
- 모노레포 도구 결정: pnpm workspace 가정. Turborepo 추가 여부?
