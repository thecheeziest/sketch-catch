import { z } from 'zod';

export const kakaoLoginSchema = z.object({
  idToken: z.string().min(1),
});

export const appleLoginSchema = z.object({
  identityToken: z.string().min(1),
  fullName: z
    .object({
      familyName: z.string().nullable(),
      givenName: z.string().nullable(),
    })
    .optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export type KakaoLoginInput = z.infer<typeof kakaoLoginSchema>;
export type AppleLoginInput = z.infer<typeof appleLoginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;

// 자체 JWT 응답 (POST /auth/kakao, POST /auth/apple)
export const authSuccessResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  needsOnboarding: z.boolean(),
  user: z.object({
    id: z.string(),
    nickname: z.string(),
    friendCode: z.string(),
    characterId: z.string(),
    provider: z.enum(['KAKAO', 'APPLE']),
    createdAt: z.string(),
    nicknameChangedAt: z.string().nullable(),
  }),
});
export type AuthSuccessResponse = z.infer<typeof authSuccessResponseSchema>;

// POST /auth/refresh 응답
export const refreshResponseSchema = z.object({
  accessToken: z.string(),
});
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;

// 서버 에러 응답 (공통)
export const authErrorSchema = z.object({
  error: z.enum([
    'INVALID_TOKEN',
    'UNAUTHORIZED',
    'SESSION_REPLACED',
    'NICKNAME_CODE_CONFLICT',
    'NICKNAME_CHANGE_COOLDOWN',
    'NOT_FOUND',
  ]),
  message: z.string().optional(),
  nextChangeAt: z.string().optional(), // NICKNAME_CHANGE_COOLDOWN 응답 시
});
export type AuthError = z.infer<typeof authErrorSchema>;
