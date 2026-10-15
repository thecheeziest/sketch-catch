import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  read: vi.fn(() => Promise.resolve(null as string | null)),
  write: vi.fn((_key: string, _value: string) => Promise.resolve()),
}));
vi.mock('expo-secure-store', () => ({ getItemAsync: storage.read, setItemAsync: storage.write }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  storage.read.mockResolvedValue(null);
  storage.write.mockResolvedValue();
});

describe('효과음 설정 저장', () => {
  it('기존 TV 설정을 유지하면서 새 BGM 설정은 기본값으로 복원한다', async () => {
    storage.read.mockResolvedValue(JSON.stringify({ soundEnabled: false, soundVolume: 0.2 }));
    const { useFeedbackStore, hydrateFeedbackSettings } = await import('./feedback');
    await hydrateFeedbackSettings();
    expect(useFeedbackStore.getState()).toMatchObject({
      soundEnabled: false,
      musicEnabled: true,
      musicVolume: 0.35,
    });
  });
  it('BGM 음소거·볼륨도 재실행 후 복원하고 잘못된 볼륨 업데이트는 무시한다', async () => {
    storage.read.mockResolvedValue(JSON.stringify({ musicEnabled: false, musicVolume: 0.1 }));
    const { useFeedbackStore, hydrateFeedbackSettings } = await import('./feedback');
    await hydrateFeedbackSettings();
    expect(useFeedbackStore.getState()).toMatchObject({ musicEnabled: false, musicVolume: 0.1 });
    useFeedbackStore.getState().updatePreferences({ musicVolume: NaN });
    expect(useFeedbackStore.getState().musicVolume).toBe(0.1);
  });
  it('재실행 때 음소거·볼륨을 복원하고 중복 초기화는 한 번만 읽는다', async () => {
    storage.read.mockResolvedValue(JSON.stringify({ soundEnabled: false, soundVolume: 0.2 }));
    const { useFeedbackStore, hydrateFeedbackSettings } = await import('./feedback');
    await Promise.all([hydrateFeedbackSettings(), hydrateFeedbackSettings()]);
    expect(storage.read).toHaveBeenCalledOnce();
    expect(useFeedbackStore.getState()).toMatchObject({
      soundEnabled: false,
      soundVolume: 0.2,
      hydrated: true,
    });
  });

  it('손상된 저장값도 초기화를 끝내 기본 설정으로 동작한다', async () => {
    storage.read.mockResolvedValue('{broken');
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { useFeedbackStore, hydrateFeedbackSettings } = await import('./feedback');
    await hydrateFeedbackSettings();
    expect(useFeedbackStore.getState()).toMatchObject({ soundEnabled: true, hydrated: true });
    expect(warning).toHaveBeenCalledOnce();
    warning.mockRestore();
  });

  it('저장된 타입을 검증하고 볼륨을 유효 범위로 제한한다', async () => {
    storage.read.mockResolvedValue(JSON.stringify({ soundEnabled: 'false', soundVolume: 10 }));
    const { useFeedbackStore, hydrateFeedbackSettings } = await import('./feedback');
    await hydrateFeedbackSettings();
    expect(useFeedbackStore.getState()).toMatchObject({ soundEnabled: true, soundVolume: 1 });
  });

  it('빠른 설정 변경을 순서대로 저장하고 저장 실패 후에도 다음 변경을 기록한다', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    storage.write.mockRejectedValueOnce(new Error('storage unavailable'));
    const { useFeedbackStore, hydrateFeedbackSettings } = await import('./feedback');
    await hydrateFeedbackSettings();
    useFeedbackStore.getState().updatePreferences({ soundEnabled: false });
    useFeedbackStore.getState().updatePreferences({ soundEnabled: true, soundVolume: 0.2 });
    await vi.waitFor(() => expect(storage.write).toHaveBeenCalledTimes(2));
    const first: unknown = JSON.parse(storage.write.mock.calls[0]?.[1] ?? '{}');
    const second: unknown = JSON.parse(storage.write.mock.calls[1]?.[1] ?? '{}');
    expect(first).toMatchObject({ soundEnabled: false });
    expect(second).toMatchObject({ soundEnabled: true, soundVolume: 0.2 });
    warning.mockRestore();
  });
});
