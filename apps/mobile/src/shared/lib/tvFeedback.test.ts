import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  appState: 'active',
  appListener: undefined as ((state: string) => void) | undefined,
  os: 'ios',
  impact: vi.fn(() => Promise.resolve()),
  androidHaptic: vi.fn(() => Promise.resolve()),
  audioMode: vi.fn(() => Promise.resolve()),
  read: vi.fn(() => Promise.resolve(null as string | null)),
  write: vi.fn(() => Promise.resolve()),
  players: [] as Array<{
    isLoaded: boolean;
    volume: number;
    play: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    seekTo: ReturnType<typeof vi.fn>;
  }>,
}));
vi.mock('@assets/audio/tv-on.wav', () => ({ default: 1 }));
vi.mock('@assets/audio/tv-off.wav', () => ({ default: 2 }));
vi.mock('expo-secure-store', () => ({ getItemAsync: native.read, setItemAsync: native.write }));
vi.mock('react-native', () => ({
  AppState: {
    get currentState() {
      return native.appState;
    },
    addEventListener: (_event: string, callback: (state: string) => void) => {
      native.appListener = callback;
      return { remove: vi.fn() };
    },
  },
  Platform: {
    get OS() {
      return native.os;
    },
  },
}));
vi.mock('expo-haptics', () => ({
  impactAsync: native.impact,
  performAndroidHapticsAsync: native.androidHaptic,
  ImpactFeedbackStyle: { Light: 'light', Soft: 'soft' },
  AndroidHaptics: { Toggle_On: 'toggle-on', Toggle_Off: 'toggle-off' },
}));
vi.mock('expo-audio', () => ({
  setAudioModeAsync: native.audioMode,
  createAudioPlayer: () => {
    const player = {
      isLoaded: true,
      volume: 1,
      play: vi.fn(),
      pause: vi.fn(),
      remove: vi.fn(),
      seekTo: vi.fn(() => Promise.resolve()),
    };
    native.players.push(player);
    return player;
  },
}));

let feedback: typeof import('./tvFeedback');
let preferences: typeof import('@/shared/model/feedback');
let dispose: () => void;
async function settle() {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
}
beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.useFakeTimers();
  native.appState = 'active';
  native.os = 'ios';
  native.players = [];
  native.read.mockResolvedValue(null);
  native.write.mockResolvedValue();
  feedback = await import('./tvFeedback');
  preferences = await import('@/shared/model/feedback');
  dispose = feedback.initializeFeedback();
  await settle();
});
afterEach(() => {
  dispose();
  vi.useRealTimers();
});

describe('TV 효과음·햅틱', () => {
  it('모든 모달이 플레이어 2개를 공유하며 켜짐 90ms·꺼짐 160ms에 햅틱을 낸다', async () => {
    feedback.playTvFeedback('on');
    await settle();
    expect(native.players).toHaveLength(2);
    expect(native.players[0]?.play).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(89);
    expect(native.impact).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(native.impact).toHaveBeenLastCalledWith('light');
    feedback.playTvFeedback('off');
    await settle();
    vi.advanceTimersByTime(160);
    expect(native.impact).toHaveBeenLastCalledWith('soft');
    expect(native.players[1]?.play).toHaveBeenCalledOnce();
  });

  it('효과음과 햅틱을 각각 끌 수 있다', async () => {
    preferences.useFeedbackStore.getState().updatePreferences({ soundEnabled: false });
    feedback.playTvFeedback('on');
    await settle();
    vi.advanceTimersByTime(90);
    expect(native.players[0]?.play).not.toHaveBeenCalled();
    expect(native.impact).toHaveBeenCalledOnce();
    preferences.useFeedbackStore.getState().updatePreferences({ soundEnabled: true, hapticsEnabled: false });
    feedback.playTvFeedback('off');
    await settle();
    vi.advanceTimersByTime(160);
    expect(native.players[1]?.play).toHaveBeenCalledOnce();
    expect(native.impact).toHaveBeenCalledOnce();
  });

  it('백그라운드 전환은 재생·예약 햅틱을 취소하고 복귀 후 밀린 소리를 내지 않는다', async () => {
    feedback.playTvFeedback('on');
    native.appState = 'background';
    native.appListener?.('background');
    await settle();
    vi.advanceTimersByTime(200);
    expect(native.players[0]?.play).not.toHaveBeenCalled();
    expect(native.impact).not.toHaveBeenCalled();
    feedback.playTvFeedback('off');
    native.appState = 'active';
    native.appListener?.('active');
    await settle();
    vi.advanceTimersByTime(200);
    expect(native.players[1]?.play).not.toHaveBeenCalled();
  });

  it('늦게 끝난 seek는 취소된 열림음을 다시 재생하지 않는다', async () => {
    let finishSeek: (() => void) | undefined;
    native.players[0]?.seekTo.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          finishSeek = resolve;
        }),
    );
    const cancel = feedback.playTvFeedback('on');
    cancel();
    finishSeek?.();
    await settle();
    vi.advanceTimersByTime(100);
    expect(native.players[0]?.play).not.toHaveBeenCalled();
    expect(native.impact).not.toHaveBeenCalled();
  });

  it('Android는 전원 토글 햅틱을 사용한다', () => {
    native.os = 'android';
    feedback.playTvFeedback('on');
    vi.advanceTimersByTime(90);
    expect(native.androidHaptic).toHaveBeenCalledWith('toggle-on');
    feedback.playTvFeedback('off');
    vi.advanceTimersByTime(160);
    expect(native.androidHaptic).toHaveBeenCalledWith('toggle-off');
    expect(native.impact).not.toHaveBeenCalled();
  });

  it('준비되지 않은 음원은 재생하지 않고 예약된 햅틱도 해제 시 취소한다', () => {
    const player = native.players[0];
    if (player) player.isLoaded = false;
    feedback.playTvFeedback('on');
    expect(player?.seekTo).not.toHaveBeenCalled();
    dispose();
    vi.advanceTimersByTime(200);
    expect(native.impact).not.toHaveBeenCalled();
    expect(player?.remove).toHaveBeenCalledOnce();
  });
});
