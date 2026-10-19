import { z } from 'zod';
import { CHARACTER_IDS } from '../constants/characters.js';

// 닉네임: 2~10자, 띄어쓰기 포함 가능 (CLAUDE.md / PROJECT.md)
export const nicknameSchema = z
  .string()
  .min(2, '닉네임은 2자 이상으로 지어 주세요!')
  .max(10, '닉네임은 10자까지만 쓸 수 있어요!');

// 친구코드: 3~5자리 영문/숫자 (저장은 대문자로 정규화)
export const friendCodeSchema = z
  .string()
  .regex(/^[A-Z0-9]{3,5}$/, '해시태그는 영문 대문자·숫자 3~5자리로 적어 주세요!')
  .transform((s) => s.toUpperCase());

// 친구코드 입력 — 사용자가 소문자로 입력해도 받아주기 위한 입력용 스키마
export const friendCodeInputSchema = z
  .string()
  .regex(/^[A-Za-z0-9]{3,5}$/, '해시태그는 영문·숫자 3~5자리로 적어 주세요!')
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

// POST /shop/purchase — 가격은 서버 카탈로그 기준, itemId만 받는다
export const purchaseSchema = z.object({
  itemId: z.string().min(1).max(40),
  equip: z.boolean().default(true),
});
export type PurchaseInput = z.infer<typeof purchaseSchema>;

// PATCH /me/equip — itemId null은 기본 모습으로 되돌림 (캐릭터는 null 불가)
export const equipSchema = z.discriminatedUnion('category', [
  z.object({ category: z.literal('CHARACTER'), itemId: characterIdSchema }),
  z.object({ category: z.literal('FRAME'), itemId: z.string().min(1).max(40).nullable() }),
  z.object({ category: z.literal('BACKGROUND'), itemId: z.string().min(1).max(40).nullable() }),
  z.object({ category: z.literal('CHAT_COLOR'), itemId: z.string().min(1).max(40).nullable() }),
]);
export type EquipInput = z.infer<typeof equipSchema>;
