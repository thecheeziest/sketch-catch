import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { EquipInput, UserPrivate } from '@sketch-catch/shared';
import { apiPatch, apiPost, type ApiError } from '@/shared/api';
import { useAuthStore } from '@/shared/model';
import { ME_QUERY_KEY } from '@/features/auth/api';

type PurchaseVars = { itemId: string; equip: boolean };

// 구매·장착 응답은 갱신된 내 정보 전체 — 캐시와 인증 스토어를 함께 맞춘다
function applyMe(qc: QueryClient, user: UserPrivate): void {
  useAuthStore.getState().setUser(user);
  qc.setQueryData(ME_QUERY_KEY, user);
}

export function usePurchaseItem() {
  const qc = useQueryClient();
  return useMutation<UserPrivate, ApiError, PurchaseVars>({
    mutationFn: vars => apiPost<UserPrivate>('/shop/purchase', vars),
    onSuccess: user => applyMe(qc, user),
  });
}

export function useEquipItem() {
  const qc = useQueryClient();
  return useMutation<UserPrivate, ApiError, EquipInput>({
    mutationFn: input => apiPatch<UserPrivate>('/me/equip', input),
    onSuccess: user => applyMe(qc, user),
  });
}
