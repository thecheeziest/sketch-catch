import { useMutation } from '@tanstack/react-query';
import type { ReportUserInput } from '@sketch-catch/shared';
import { apiPost } from '@/shared/api';

export function useReportUser() {
  return useMutation({
    mutationFn: (input: ReportUserInput) => apiPost('/reports', input),
  });
}
