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
