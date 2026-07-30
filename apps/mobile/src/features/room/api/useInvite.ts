import { useMutation } from '@tanstack/react-query';
import { apiPost, ApiError } from '@/shared/api';

export function useInvite(code: string) {
  return useMutation<{ ok: true }, ApiError, { target: string }>({
    mutationFn: ({ target }) => apiPost<{ ok: true }>(`/rooms/${code}/invite`, { target }),
  });
}
