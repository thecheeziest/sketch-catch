import { z } from 'zod';

export const reportReasonSchema = z.enum(['ABUSE', 'SEXUAL', 'SPAM', 'OTHER']);

export const blockUserSchema = z.object({
  targetId: z.string().uuid(),
});

export const REPORT_DETAIL_MAX_LENGTH = 100;

// 채팅 신고는 messageId만 보낸다 — 원문은 서버가 보관한 메시지에서 찾는다.
// 사유가 '기타'면 직접 쓴 내용(detail)이 필요하고, 다른 사유에는 붙이지 않는다
export const reportUserSchema = z
  .object({
    targetId: z.string().uuid(),
    reason: reportReasonSchema,
    detail: z.string().trim().min(1, '신고 사유를 적어 주세요').max(REPORT_DETAIL_MAX_LENGTH).optional(),
    messageId: z.string().uuid().optional(),
  })
  .refine(value => (value.reason === 'OTHER') === (value.detail !== undefined), {
    path: ['detail'],
    message: '기타 사유는 내용을 적어 주세요',
  });

export type ReportUserInput = z.infer<typeof reportUserSchema>;
