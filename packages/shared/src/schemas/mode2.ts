import { z } from 'zod';

// PROMPT/ANSWER 단계 텍스트 입력 (UI-SPEC 기준 최대 40자)
export const mode2PromptSchema = z.object({ sheetId: z.string(), text: z.string().min(1).max(40) });
export const mode2AnswerSchema = z.object({ sheetId: z.string(), text: z.string().min(1).max(40) });

// 최종 판정 1회 (D-02)
export const mode2JudgeFinalSchema = z.object({ sheetId: z.string(), ok: z.boolean() });

export const mode2VoteBestSchema = z.object({ sheetId: z.string() });

export type Mode2PromptInput = z.infer<typeof mode2PromptSchema>;
export type Mode2AnswerInput = z.infer<typeof mode2AnswerSchema>;
export type Mode2JudgeFinalInput = z.infer<typeof mode2JudgeFinalSchema>;
export type Mode2VoteBestInput = z.infer<typeof mode2VoteBestSchema>;
