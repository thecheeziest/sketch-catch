import { z } from 'zod';

// 닉네임: 2~10자, 띄어쓰기 포함 가능 (CLAUDE.md / PROJECT.md)
export const nicknameSchema = z
  .string()
  .min(2, '닉네임은 2자 이상이어야 합니다')
  .max(10, '닉네임은 10자 이하여야 합니다');

// 친구코드: 5자리 영문/숫자 (저장은 대문자로 정규화)
export const friendCodeSchema = z
  .string()
  .regex(/^[A-Z0-9]{5}$/, '친구코드는 영문 대문자/숫자 5자리여야 합니다')
  .transform((s) => s.toUpperCase());

// 친구코드 입력 — 사용자가 소문자로 입력해도 받아주기 위한 입력용 스키마
export const friendCodeInputSchema = z
  .string()
  .regex(/^[A-Za-z0-9]{5}$/, '친구코드는 영문/숫자 5자리여야 합니다')
  .transform((s) => s.toUpperCase());

// 캐릭터 ID — 동물 10종 + 과일 10종 (구체적 ID 풀은 Phase 2에서 확정)
export const characterIdSchema = z.string().min(1).max(40);

export const onboardingSchema = z.object({
  nickname: nicknameSchema,
  friendCode: friendCodeSchema,
  characterId: characterIdSchema,
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
