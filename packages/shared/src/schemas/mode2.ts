import { z } from 'zod';

// PROMPT/ANSWER 단계 텍스트 입력 (UI-SPEC 기준 최대 40자)
export const mode2PromptSchema = z.object({ sheetId: z.string(), text: z.string().min(1).max(40) });
export const mode2AnswerSchema = z.object({ sheetId: z.string(), text: z.string().min(1).max(40) });

export type Mode2PromptInput = z.infer<typeof mode2PromptSchema>;
export type Mode2AnswerInput = z.infer<typeof mode2AnswerSchema>;
