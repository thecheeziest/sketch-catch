import { z } from 'zod';

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
]);

export const createRoomSchema = z.object({
  mode: z.union([z.literal(1), z.literal(2)]),
  playerCountMax: z.number().int().min(3).max(12),
  roundCount: z.number().int().min(1).max(20),
  drawTimer: z.number().int().min(10).max(60).multipleOf(5), // MD1-05
  answerTimer: z.number().int().min(5).max(30).optional(),
  categories: z.array(categorySchema).min(1),
});

// 채팅: 최대 30자 (GAME-01)
export const chatMessageSchema = z.object({
  text: z.string().min(1).max(30),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
