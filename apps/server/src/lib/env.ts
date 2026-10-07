import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  KAKAO_REST_KEY: z.string().optional(),
  KAKAO_ISSUER: z.string().default('https://kauth.kakao.com'),
  APPLE_ISSUER: z.string().default('https://appleid.apple.com'),
  APPLE_BUNDLE_ID: z.string().default('com.sketchcatch.app'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  JWT_SECRET: z
    .string()
    .min(16, 'JWT_SECRET must be at least 16 chars')
    .default('dev-secret-replace-me-with-strong-key'),
  EXPO_ACCESS_TOKEN: z.string().optional(),
  // 카카오/애플 인증 없이 테스트 계정으로 로그인하는 개발 전용 라우트 — production에서는 값과 무관하게 비활성
  ENABLE_DEV_LOGIN: z
    .enum(['true', 'false'])
    .default('false')
    .transform(v => v === 'true'),
  // 강제 업데이트 — 플랫폼별 최소 빌드 번호(iOS CFBundleVersion / Android versionCode). 미설정이면 차단하지 않는다.
  // 릴리스마다 새 빌드 번호로 올린다. 업데이트 링크는 출시 전 TestFlight·내부 테스트, 출시 후 스토어 링크로 교체.
  MIN_BUILD_IOS: z.coerce.number().int().positive().optional(),
  MIN_BUILD_ANDROID: z.coerce.number().int().positive().optional(),
  APP_UPDATE_URL_IOS: z.string().url().optional(),
  APP_UPDATE_URL_ANDROID: z.string().url().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
