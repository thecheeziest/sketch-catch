import { useMutation } from '@tanstack/react-query';
import { apiDelete, ApiError } from '@/shared/api';

export function useUnregisterPushToken() {
  return useMutation<void, ApiError, void>({
    mutationFn: () => apiDelete('/me/push-token'),
  });
}
