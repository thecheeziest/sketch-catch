FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY patches ./patches
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY . .
RUN pnpm --filter @sketch-catch/shared build
RUN pnpm --filter @sketch-catch/server prisma:generate
RUN pnpm --filter @sketch-catch/server build

# Pitfall 2 스모크 테스트 전용 스테이지 — node:20-alpine(musl) 실제 컨테이너에서 한글 GIF 텍스트 프레임 렌더링 확인
# build 스테이지(소스 + devDependencies 포함)를 그대로 사용해 tsx로 TS 스크립트를 직접 실행한다.
# 사용: docker build -f apps/server/Dockerfile --target gif-font-smoke -t sketch-gif-smoke . && docker run --rm sketch-gif-smoke
# NOTE: runner보다 반드시 앞에 위치해야 함 — --target 미지정 시 Docker는 마지막 스테이지를 기본 빌드 대상으로 삼음
# (Railway railway.json도 target 미지정 → 프로덕션 배포가 runner를 빌드하도록 runner를 항상 마지막 스테이지로 유지)
FROM build AS gif-font-smoke
WORKDIR /app/apps/server
CMD ["pnpm", "exec", "tsx", "scripts/gif-font-smoke.ts"]

FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
COPY --from=build /app/apps/server/prisma ./apps/server/prisma
COPY --from=build /app/apps/server/assets ./apps/server/assets
EXPOSE 3000
CMD ["sh", "-c", "cd apps/server && pnpm prisma migrate deploy && node dist/main.js"]
