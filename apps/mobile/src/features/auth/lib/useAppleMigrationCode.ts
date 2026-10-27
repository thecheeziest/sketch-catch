import { useMutation } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import type { AppleMigrationCodeResponse } from '@sketch-catch/shared';
import { apiPost } from '@/shared/api';
import { useToastStore } from '@/shared/model/toast';
import { requestAppleCredentials } from './requestAppleCredentials';

export function useAppleMigrationCode() {
  const issue = useMutation({
    retry: false,
    mutationFn: async () => {
      const { identityToken } = await requestAppleCredentials();
      return apiPost<AppleMigrationCodeResponse>('/me/apple-migration-code', { identityToken });
    },
  });

  const copyCode = async () => {
    if (!issue.data) return;
    if (Date.parse(issue.data.expiresAt) <= Date.now()) {
      useToastStore.getState().show('코드가 만료됐어요. 새 코드를 받아주세요.', 'error');
      return;
    }
    try {
      const copied = await Clipboard.setStringAsync(issue.data.code);
      if (!copied) throw new Error('Clipboard write failed');
      useToastStore.getState().show('이전 코드를 복사했어요. 새 앱에서 입력해주세요.', 'success');
    } catch {
      useToastStore.getState().show('복사하지 못했어요. 코드를 길게 눌러 복사해주세요.', 'error');
    }
  };
  return { issue, copyCode };
}
