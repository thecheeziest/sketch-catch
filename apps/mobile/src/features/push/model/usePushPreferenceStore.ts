import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

type PushPreferenceState = {
  enabled: boolean;
  hydrated: boolean;
  setEnabled: (enabled: boolean) => void;
};

const STORAGE_KEY = 'sketch_catch_push_enabled';
let hydration: Promise<void> | undefined;

export const usePushPreferenceStore = create<PushPreferenceState>()(set => ({
  enabled: true,
  hydrated: false,
  setEnabled: enabled => {
    set({ enabled });
    SecureStore.setItemAsync(STORAGE_KEY, String(enabled)).catch(error =>
      console.warn('[push] 알림 설정 저장 실패', error),
    );
  },
}));

// 저장된 값이 없으면 기본값(켜짐)을 유지한다 — 설정을 읽기 전에 토큰을 등록하지 않도록 hydrated를 함께 확인한다
export function hydratePushPreference(): Promise<void> {
  if (hydration) return hydration;
  hydration = (async () => {
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_KEY);
      if (stored !== null) usePushPreferenceStore.setState({ enabled: stored === 'true' });
    } catch (error) {
      console.warn('[push] 알림 설정 복원 실패', error);
    } finally {
      usePushPreferenceStore.setState({ hydrated: true });
    }
  })();
  return hydration;
}
