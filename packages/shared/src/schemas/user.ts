import { z } from 'zod';
import { CHARACTER_IDS } from '../constants/characters.js';

// 닉네임: 2~10자, 띄어쓰기 포함 가능 (CLAUDE.md / PROJECT.md)
export const nicknameSchema = z
  .string()
  .min(2, '닉네임은 2자 이상이어야 합니다')
  .max(10, '닉네임은 10자 이하여야 합니다');

// 친구코드: 3~5자리 영문/숫자 (저장은 대문자로 정규화)
export const friendCodeSchema = z
  .string()
  .regex(/^[A-Z0-9]{3,5}$/, '해시태그는 영문 대문자/숫자 3~5자리여야 합니다')
  .transform((s) => s.toUpperCase());

// 친구코드 입력 — 사용자가 소문자로 입력해도 받아주기 위한 입력용 스키마
export const friendCodeInputSchema = z
  .string()
  .regex(/^[A-Za-z0-9]{3,5}$/, '해시태그는 영문/숫자 3~5자리여야 합니다')
  .transform((s) => s.toUpperCase());

// 캐릭터 ID — 동물 10종 + 과일 10종 (CHARACTER_IDS 풀로 검증)
export const characterIdSchema = z.enum(CHARACTER_IDS as unknown as [string, ...string[]]);

export const onboardingSchema = z.object({
  nickname: nicknameSchema,
  friendCode: friendCodeSchema,
  characterId: characterIdSchema,
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

// PATCH /me 입력 — 모든 필드는 선택적, 최소 1개 이상 포함되어야 함
export const updateMeSchema = z
  .object({
    nickname: nicknameSchema.optional(),
    friendCode: friendCodeInputSchema.optional(),
    characterId: characterIdSchema.optional(),
  })
  .refine(
    (v) => v.nickname !== undefined || v.friendCode !== undefined || v.characterId !== undefined,
    { message: '변경할 항목을 1개 이상 포함해주세요' }
  );
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
