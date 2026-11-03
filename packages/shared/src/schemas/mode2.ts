import { z } from 'zod';
import { PROMPT_MAX_LENGTH } from '../constants/game.js';

// 추측 답안도 다음 그림의 제시어가 되므로 공백 포함 15자.
export const mode2PromptSchema = z.object({
  sheetId: z.string(),
  text: z.string().trim().min(1).max(PROMPT_MAX_LENGTH),
});
export const mode2AnswerSchema = z.object({
  sheetId: z.string(),
  text: z.string().trim().min(1).max(PROMPT_MAX_LENGTH),
});

export type Mode2PromptInput = z.infer<typeof mode2PromptSchema>;
export type Mode2AnswerInput = z.infer<typeof mode2AnswerSchema>;
