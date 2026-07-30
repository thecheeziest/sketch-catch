import { useMutation } from '@tanstack/react-query';
import { apiPost, ApiError } from '@/shared/api';

export function useRegisterPushToken() {
  return useMutation<{ ok: true }, ApiError, { token: string }>({
    mutationFn: (input) => apiPost('/me/push-token', input),
  });
}
