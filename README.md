# 스케치캐치 (Sketch Catch)

React Native(Expo) + Node.js(Socket.io) 기반의 실시간 멀티플레이어 그림 맞추기 게임 앱.

> 친구들이 30초 안에 방을 만들고 바로 그림 게임을 시작할 수 있어야 한다 — 설치 직후 즉시 플레이.

## 모노레포 구조

```
.
├── apps/
│   ├── mobile/     # Expo dev client (RN 앱)
│   └── server/     # Fastify + Socket.io + Prisma
├── packages/
│   └── shared/     # 공유 타입/Zod 스키마/Socket 이벤트 상수
├── docs/           # 개발자 컨텍스트 (DEVELOPER.md)
└── .planning/      # 페이즈/플랜 문서
```

## 요구사항

- Node.js `>= 20.11.0` (`.nvmrc` 참고)
- pnpm `9.12.0` (`corepack enable && corepack prepare pnpm@9.12.0 --activate`)
- Docker Desktop (로컬 PostgreSQL + Redis용)
- Expo 계정 + EAS CLI (`npm i -g eas-cli` 또는 `npx eas-cli`)
- iOS 시뮬레이터 또는 Android Emulator

## 로컬 개발 셋업

### 1. 의존성 설치

```bash
pnpm install
```

### 2. 로컬 인프라 부팅 (PostgreSQL + Redis)

```bash
docker compose up -d
```

상태 확인:

```bash
docker compose ps
```

### 3. 환경변수 설정

```bash
cp apps/server/.env.example apps/server/.env
cp apps/mobile/.env.example apps/mobile/.env
```

- `apps/server/.env`: `DATABASE_URL`, `REDIS_URL`은 docker-compose 기본값 그대로 OK. `KAKAO_REST_KEY`, `APPLE_BUNDLE_ID`, `JWT_SECRET`은 Phase 2 인증 작업 시 채움.
- `apps/mobile/.env`: `EXPO_PUBLIC_API_URL`은 로컬에서 `http://localhost:3000` 그대로 OK.

### 4. Prisma 마이그레이션

```bash
pnpm --filter @sketch-catch/server prisma:migrate
```

### 5. 서버 부팅

```bash
pnpm --filter @sketch-catch/server dev
```

`GET http://localhost:3000/health` → `{ "status": "ok", "db": true, "redis": true }` 확인.

### 6. 모바일 부팅

#### 사전: Galmuri11 폰트 배치

[Galmuri11.ttf](https://github.com/quiple/galmuri/releases)를 다운로드해 `apps/mobile/assets/fonts/Galmuri11.ttf`로 저장.

#### iOS 시뮬레이터 (최초 1회만 EAS Build로 dev client 빌드)

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli build --profile development --platform ios --local
# 빌드된 .app을 시뮬레이터에 드래그
```

이후 일상 개발:

```bash
pnpm --filter @sketch-catch/mobile start
```

#### Android Emulator

```bash
cd apps/mobile
npx eas-cli build --profile development --platform android --local
pnpm --filter @sketch-catch/mobile start
```

## 빈번한 명령어

```bash
pnpm typecheck            # 전체 워크스페이스 typecheck
pnpm lint                 # 전체 워크스페이스 lint
pnpm build                # 전체 워크스페이스 build
pnpm format               # prettier 포맷
pnpm --filter @sketch-catch/server dev
pnpm --filter @sketch-catch/server prisma:studio
pnpm --filter @sketch-catch/mobile start
```

## 배포

- **서버**: main 브랜치에 push → Railway가 자동 배포
  - Railway 서비스에 환경변수 설정 필요: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `KAKAO_REST_KEY`, `APPLE_BUNDLE_ID`
  - 빌드는 `apps/server/Dockerfile` 사용
  - 헬스체크: `GET /health`
- **모바일**: EAS Build로 dev client 또는 production 빌드 (별도 페이즈)

## CI

PR 생성 시 GitHub Actions가 자동 실행:

- `pnpm install --frozen-lockfile`
- `pnpm --filter @sketch-catch/server prisma:generate`
- `pnpm -r run lint`
- `pnpm -r run typecheck`
- `pnpm -r run build`

모든 단계 통과 시에만 머지 가능 (브랜치 보호 규칙 권장).

## 문서

- [`docs/DEVELOPER.md`](./docs/DEVELOPER.md): 기술 스택, Prisma 스키마, Socket.io 이벤트, 환경변수, 코딩 규칙
- [`.planning/PROJECT.md`](./.planning/PROJECT.md): 프로젝트 비전, 요구사항, 의사결정
- [`.planning/ROADMAP.md`](./.planning/ROADMAP.md): 페이즈 로드맵
- [`CLAUDE.md`](./CLAUDE.md): Claude/AI 작업 가이드라인

## 라이선스

개인 학습 프로젝트 — 라이선스 미지정.

Galmuri11 폰트는 MIT 라이선스 ([quiple/galmuri](https://github.com/quiple/galmuri)).
