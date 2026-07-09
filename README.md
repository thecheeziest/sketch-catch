# 스케치캐치 (Sketch Catch)
> React Native(Expo) + Node.js(Socket.io) 기반 실시간 그림 퀴즈 게임 앱

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

---

## 설치 가이드

### 1. 필수 도구 설치

#### Node.js

```bash
# nvm 사용 권장
nvm install   # .nvmrc의 버전(20.x)으로 자동 설치
nvm use
```

#### pnpm (패키지 매니저)

```bash
corepack enable
corepack prepare pnpm@9.12.0 --activate
```

#### Colima + Docker (로컬 DB/Redis 런타임)

```bash
brew install colima docker
```

> **`pnpm dev`가 Colima 상태를 자동 확인하고, 꺼져 있으면 시작해 준다.** 수동으로 `colima start`를 실행하지 않아도 된다.

#### Expo / EAS CLI

```bash
npm i -g eas-cli
```

#### iOS 시뮬레이터 / Android 에뮬레이터

- iOS: Xcode 설치 후 시뮬레이터 실행
- Android: Android Studio 설치 후 에뮬레이터 생성

---

### 2. 프로젝트 셋업 (최초 1회)

```bash
# 의존성 설치
pnpm install

# 환경변수 설정
cp apps/server/.env.example apps/server/.env
cp apps/mobile/.env.example apps/mobile/.env

# DB 스키마 마이그레이션 (PostgreSQL이 뜬 후 실행)
pnpm --filter @sketch-catch/server prisma:migrate
```

`apps/server/.env`에서 채워야 할 항목:
- `KAKAO_REST_KEY`, `APPLE_BUNDLE_ID`: 소셜 로그인 키 (Phase 2에서 필요)
- 나머지(`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`)는 기본값 그대로 OK

#### iOS dev client 빌드 (최초 1회)

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli build --profile development --platform ios --local
# 빌드된 .app 파일을 시뮬레이터에 드래그 앤 드롭
```

#### Android dev client 빌드 (최초 1회)

```bash
cd apps/mobile
npx eas-cli build --profile development --platform android --local
# 빌드된 .apk를 에뮬레이터에 드래그 앤 드롭 또는 adb install
```

---

### 3. Galmuri11 폰트 배치 (최초 1회)

[Galmuri11.ttf](https://github.com/quiple/galmuri/releases)를 다운로드해 아래 경로에 저장한다.

```
apps/mobile/assets/fonts/Galmuri11.ttf
```

---

## 개발 환경 명령어

### 서버

```bash
cd apps/server
pnpm dev
# Colima(Docker 런타임) + PostgreSQL + Redis를 자동으로 확인/시작한 뒤 서버를 띄운다.
# 서버: http://localhost:3000  헬스체크: GET /health
```

### 모바일 (시뮬레이터/에뮬레이터에 dev client가 이미 설치된 경우)

```bash
cd apps/mobile
pnpm ios:dev     # iOS 시뮬레이터 실행 + Metro 번들러 시작
pnpm aos:dev     # Android 에뮬레이터 실행 + Metro 번들러 시작
pnpm start       # Metro 번들러만 띄움 (시뮬레이터/에뮬레이터는 별도 실행)
```

### 코드 품질 (루트에서)

```bash
pnpm typecheck   # 전체 워크스페이스 TypeScript 타입 검사
pnpm lint        # 전체 워크스페이스 ESLint
pnpm build       # 전체 워크스페이스 빌드
pnpm format      # Prettier 포맷 (저장 전 정리)
```

### DB 관련

```bash
cd apps/server
pnpm prisma:migrate   # 마이그레이션 파일 생성 및 DB 반영
pnpm prisma:studio    # Prisma Studio (브라우저에서 DB 직접 조회/수정)
pnpm db:seed          # 초기 데이터 삽입
```

---

## 배포

- **서버**: `main` 브랜치 push → Railway 자동 배포
  - Railway 환경변수 필요: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `KAKAO_REST_KEY`, `APPLE_BUNDLE_ID`
  - 빌드: `apps/server/Dockerfile` 사용
  - 헬스체크: `GET /health`
- **모바일**: EAS Build로 dev client 또는 production 빌드 (별도 페이즈)

## CI

PR 생성 시 GitHub Actions 자동 실행:

- `pnpm install --frozen-lockfile`
- `pnpm --filter @sketch-catch/server prisma:generate`
- `pnpm -r run lint`
- `pnpm -r run typecheck`
- `pnpm -r run build`

모든 단계 통과 시에만 머지 가능.

---

## 문서

- [`docs/DEVELOPER.md`](./docs/DEVELOPER.md): 기술 스택, Prisma 스키마, Socket.io 이벤트, 환경변수, 코딩 규칙
- [`.planning/PROJECT.md`](./.planning/PROJECT.md): 프로젝트 비전, 요구사항, 의사결정
- [`.planning/ROADMAP.md`](./.planning/ROADMAP.md): 페이즈 로드맵
- [`CLAUDE.md`](./CLAUDE.md): Claude/AI 작업 가이드라인

## 라이선스

개인 학습 프로젝트 — 라이선스 미지정.

Galmuri11 폰트는 MIT 라이선스 ([quiple/galmuri](https://github.com/quiple/galmuri)).
