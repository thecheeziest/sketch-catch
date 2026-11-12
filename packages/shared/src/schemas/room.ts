import { z } from 'zod';
import { MODE2_PLAYER_MIN, PENALTY_LOSER_MAX, PENALTY_TEXT_MAX_LENGTH } from '../constants/game.js';

// 방 코드: 6자리 영문 대문자/숫자
export const roomCodeSchema = z
  .string()
  .regex(/^[A-Z0-9]{6}$/, '방 코드는 영문 대문자/숫자 6자리여야 합니다');

export const categorySchema = z.enum([
  'ANIMAL',
  'FOOD',
  'OBJECT',
  'NATURE',
  'PLACE',
  'ACTION',
  'JOB',
  'PERSON',
  'MOVIE',
  'DRAMA',
  'VARIETY',
  'ANIMATION',
  'MEME',
  'CUSTOM',
]);

// 방에서 쓰는 제시어 카테고리 — 최소 1개는 선택해야 한다 (방 생성·설정 변경 공통)
// CUSTOM(직접 출제)은 없어졌다 — 업데이트 전 앱이 보내도 걸러 내고, 남은 카테고리로 검사한다
export const roomCategoriesSchema = z
  .array(categorySchema)
  .transform(categories => categories.filter(category => category !== 'CUSTOM'))
  .refine(categories => categories.length > 0, '카테고리를 1개 이상 골라 주세요');

// 방 비밀번호 — 잠금 방은 반드시 있어야 한다 (방 생성·설정 변경 공통). 초대 입장만 비밀번호 없이 들어온다
export const roomPasswordSchema = z.string().trim().min(1, '비밀번호를 입력해 주세요').max(20);

// 벌칙 — 무엇을 걸지(공백만은 불가)와 꼴찌 인원. 비속어 검사는 서버에서 따로 한다
export const roomPenaltySchema = z.object({
  loserCount: z.number().int().min(1).max(PENALTY_LOSER_MAX),
  text: z.string().trim().min(1, '무엇을 걸지 적어 주세요').max(PENALTY_TEXT_MAX_LENGTH),
});

// 꼴찌를 빼고도 최소 2명은 단상에 남아야 한다 — 벌칙 인원은 최대 인원 - 2까지
export function isPenaltyLoserCountValid(loserCount: number, playerCountMax: number): boolean {
  return loserCount <= playerCountMax - 2;
}

export const createRoomSchema = z
  .object({
    mode: z.union([z.literal(1), z.literal(2)]),
    review: z.boolean().optional(),
    playerCountMax: z.number().int().min(3).max(12),
    roundCount: z.number().int().min(1).max(20),
    drawTimer: z.number().int().min(40).max(90).multipleOf(5), // MD1-05
    answerTimer: z.number().int().min(5).max(30).optional(),
    categories: roomCategoriesSchema,
    title: z.string().max(20).optional(),
    locked: z.boolean().default(false),
    password: roomPasswordSchema.optional(),
    penalty: roomPenaltySchema.optional(),
  })
  .refine((value) => !value.locked || value.password !== undefined, {
    path: ['password'],
    message: '잠금 방은 비밀번호가 필요해요',
  })
  .refine((value) => value.mode !== 2 || value.playerCountMax >= MODE2_PLAYER_MIN, {
    path: ['playerCountMax'],
    message: `모드 2는 ${MODE2_PLAYER_MIN}명 이상 모여야 해요!`,
  })
  .refine((value) => value.penalty === undefined || value.mode === 1, {
    path: ['penalty'],
    message: '벌칙은 모드 1에서만 쓸 수 있어요',
  })
  .refine(
    (value) => value.penalty === undefined || isPenaltyLoserCountValid(value.penalty.loserCount, value.playerCountMax),
    { path: ['penalty', 'loserCount'], message: '벌칙 인원은 최대 인원보다 2명 이상 적어야 해요' },
  );

// 채팅: 최대 30자 (GAME-01)
export const chatMessageSchema = z.object({
  text: z.string().min(1).max(30),
});

export type RoomPenaltyInput = z.infer<typeof roomPenaltySchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
