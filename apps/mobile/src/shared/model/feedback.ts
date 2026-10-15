import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

type FeedbackPreferences = {
  soundEnabled: boolean;
  soundVolume: number;
  musicEnabled: boolean;
  musicVolume: number;
};

type FeedbackState = FeedbackPreferences & {
  hydrated: boolean;
  updatePreferences: (preferences: Partial<FeedbackPreferences>) => void;
};

const STORAGE_KEY = 'sketch_catch_feedback';
let hydration: Promise<void> | undefined;
let pendingWrite = Promise.resolve();

export const useFeedbackStore = create<FeedbackState>()(set => ({
  soundEnabled: true,
  soundVolume: 0.6,
  musicEnabled: true,
  musicVolume: 0.35,
  hydrated: false,
  updatePreferences: preferences => {
    const next = { ...preferences };
    if (next.soundVolume !== undefined) {
      if (!Number.isFinite(next.soundVolume)) return;
      next.soundVolume = Math.max(0, Math.min(1, next.soundVolume));
    }
    if (next.musicVolume !== undefined) {
      if (!Number.isFinite(next.musicVolume)) return;
      next.musicVolume = Math.max(0, Math.min(1, next.musicVolume));
    }
    set(next);
    const { soundEnabled, soundVolume, musicEnabled, musicVolume } = useFeedbackStore.getState();
    // 빠르게 토글해도 이전 저장이 나중 설정을 덮어쓰지 않도록 순서대로 기록한다.
    pendingWrite = pendingWrite
      .then(() =>
        SecureStore.setItemAsync(
          STORAGE_KEY,
          JSON.stringify({ soundEnabled, soundVolume, musicEnabled, musicVolume }),
        ),
      )
      .catch(error => console.warn('[feedback] 설정 저장 실패', error));
  },
}));

export function hydrateFeedbackSettings(): Promise<void> {
  if (hydration) return hydration;
  hydration = (async () => {
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_KEY);
      const preferences: unknown = stored ? JSON.parse(stored) : null;
      if (preferences !== null && typeof preferences === 'object') {
        const next: Partial<FeedbackPreferences> = {};
        if ('musicEnabled' in preferences && typeof preferences.musicEnabled === 'boolean')
          next.musicEnabled = preferences.musicEnabled;
        if (
          'musicVolume' in preferences &&
          typeof preferences.musicVolume === 'number' &&
          Number.isFinite(preferences.musicVolume)
        )
          next.musicVolume = Math.max(0, Math.min(1, preferences.musicVolume));
        if ('soundEnabled' in preferences && typeof preferences.soundEnabled === 'boolean') {
          next.soundEnabled = preferences.soundEnabled;
        }
        if (
          'soundVolume' in preferences &&
          typeof preferences.soundVolume === 'number' &&
          Number.isFinite(preferences.soundVolume)
        ) {
          next.soundVolume = Math.max(0, Math.min(1, preferences.soundVolume));
        }
        useFeedbackStore.setState(next);
      }
    } catch (error) {
      console.warn('[feedback] 설정 복원 실패', error);
    } finally {
      useFeedbackStore.setState({ hydrated: true });
    }
  })();
  return hydration;
}
