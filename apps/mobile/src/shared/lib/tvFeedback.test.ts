import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  appState: 'active',
  appListener: undefined as ((state: string) => void) | undefined,
  os: 'ios',
  impact: vi.fn(() => Promise.resolve()),
  androidHaptic: vi.fn(() => Promise.resolve()),
  notification: vi.fn(() => Promise.resolve()),
  selection: vi.fn(() => Promise.resolve()),
  nextLoaded: true,
  loads: new Map<number, (status: { isLoaded: boolean }) => void>(),
  audioMode: vi.fn(() => Promise.resolve()),
  read: vi.fn(() => Promise.resolve(null as string | null)),
  write: vi.fn(() => Promise.resolve()),
  players: [] as Array<{
    isLoaded: boolean;
    loop: boolean;
    source: unknown;
    volume: number;
    play: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    seekTo: ReturnType<typeof vi.fn>;
    addListener: ReturnType<typeof vi.fn>;
  }>,
}));
vi.mock('@assets/audio/tv-on.wav', () => ({ default: 1 }));
vi.mock('@assets/audio/tv-off.wav', () => ({ default: 2 }));
vi.mock('@assets/audio/bgm-home.m4a', () => ({ default: 101 }));
vi.mock('@assets/audio/bgm-lobby.m4a', () => ({ default: 102 }));
vi.mock('@assets/audio/bgm-classic.m4a', () => ({ default: 103 }));
vi.mock('@assets/audio/bgm-relay.m4a', () => ({ default: 104 }));
vi.mock('@assets/audio/bgm-review.m4a', () => ({ default: 105 }));
vi.mock('@assets/audio/bgm-award.m4a', () => ({ default: 106 }));
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
  notificationAsync: native.notification,
  selectionAsync: native.selection,
  performAndroidHapticsAsync: native.androidHaptic,
  ImpactFeedbackStyle: { Light: 'light', Soft: 'soft', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
  AndroidHaptics: {
    Toggle_On: 'toggle-on',
    Toggle_Off: 'toggle-off',
    Confirm: 'confirm',
    Reject: 'reject',
    Clock_Tick: 'clock-tick',
  },
}));
vi.mock('expo-audio', () => ({
  setAudioModeAsync: native.audioMode,
  createAudioPlayer: (source: unknown) => {
    const index = native.players.length;
    const player = {
      isLoaded: native.nextLoaded,
      loop: false,
      source,
      volume: 1,
      play: vi.fn(),
      pause: vi.fn(),
      remove: vi.fn(),
      seekTo: vi.fn(() => Promise.resolve()),
      addListener: vi.fn((_event: string, callback: (status: { isLoaded: boolean }) => void) => {
        native.loads.set(index, callback);
        return { remove: () => native.loads.delete(index) };
      }),
    };
    native.players.push(player);
    return player;
  },
}));

let feedback: typeof import('./tvFeedback');
let engine: typeof import('./feedback');
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
  native.loads.clear();
  native.nextLoaded = true;
  native.read.mockResolvedValue(null);
  native.write.mockResolvedValue();
  feedback = await import('./tvFeedback');
  engine = await import('./feedback');
  preferences = await import('@/shared/model/feedback');
  dispose = feedback.initializeFeedback();
  await settle();
});
afterEach(() => {
  dispose();
  vi.useRealTimers();
});

describe('TV 효과음·햅틱', () => {
  it('모든 모달이 TV 플레이어를 공유하며 켜짐 90ms·꺼짐 160ms에 햅틱을 낸다', async () => {
    feedback.playTvFeedback('on');
    await settle();
    expect(native.players).toHaveLength(14);
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

  it('효과음을 꺼도 햅틱은 항상 실행된다', async () => {
    preferences.useFeedbackStore.getState().updatePreferences({ soundEnabled: false });
    feedback.playTvFeedback('on');
    await settle();
    vi.advanceTimersByTime(90);
    expect(native.players[0]?.play).not.toHaveBeenCalled();
    expect(native.impact).toHaveBeenCalledOnce();
    preferences.useFeedbackStore.getState().updatePreferences({ soundEnabled: true });
    feedback.playTvFeedback('off');
    await settle();
    vi.advanceTimersByTime(160);
    expect(native.players[1]?.play).toHaveBeenCalledOnce();
    expect(native.impact).toHaveBeenCalledTimes(2);
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

  it('Android도 iOS와 같은 진동 경로를 사용한다', () => {
    native.os = 'android';
    feedback.playTvFeedback('on');
    vi.advanceTimersByTime(90);
    expect(native.impact).toHaveBeenCalled();
    expect(native.androidHaptic).not.toHaveBeenCalled();
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

describe('게임 오디오 재생 제어', () => {
  it('방에서 홈으로 나오면 지난 결과음·예약 햅틱을 취소하되 TV 종료는 유지한다', async () => {
    engine.setMusicScene('classic');
    await settle();
    engine.playFeedback('correct');
    feedback.playTvFeedback('off');
    engine.setMusicScene('home');
    await settle();
    vi.advanceTimersByTime(160);
    expect(native.players[10]?.play).not.toHaveBeenCalled();
    expect(native.notification).not.toHaveBeenCalled();
    expect(native.players[1]?.play).toHaveBeenCalledOnce();
    expect(native.impact).toHaveBeenLastCalledWith('soft');
  });
  it('같은 이벤트 키와 연타를 재생하지 않고 결과음이 낮은 우선순위 알림을 막는다', async () => {
    engine.playFeedback('correct', { key: 'game:1:result' });
    await settle();
    engine.playFeedback('correct', { key: 'game:1:result' });
    engine.playFeedback('tick');
    await settle();
    expect(native.players[10]?.play).toHaveBeenCalledOnce();
    expect(native.players[3]?.play).not.toHaveBeenCalled();
    vi.advanceTimersByTime(800);
    engine.playFeedback('tap');
    engine.playFeedback('tap');
    await settle();
    expect(native.players[2]?.play).toHaveBeenCalledOnce();
  });

  it('오답은 짧은 햅틱 두 번, 타이머 틱은 햅틱 없이 재생한다', () => {
    engine.playFeedback('wrong');
    vi.advanceTimersByTime(0);
    expect(native.impact).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(110);
    expect(native.impact).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(200);
    engine.playFeedback('tick');
    vi.advanceTimersByTime(100);
    expect(native.impact).toHaveBeenCalledTimes(2);
    expect(native.notification).not.toHaveBeenCalled();
  });

  it('기본 클릭 직후 제출 결과음은 클릭을 대체한다', async () => {
    engine.playFeedback('tap');
    engine.playFeedback('submit');
    await settle();
    expect(native.players[2]?.play).not.toHaveBeenCalled();
    expect(native.players[4]?.play).toHaveBeenCalledOnce();
  });

  it('BGM은 같은 화면군에서 위치를 유지하고 효과음·햅틱 설정과 독립적이다', async () => {
    engine.setMusicScene('home');
    await settle();
    const bgm = native.players[14];
    expect(bgm?.loop).toBe(true);
    expect(bgm?.source).toBe(101);
    engine.setMusicScene('home');
    preferences.useFeedbackStore.getState().updatePreferences({ soundEnabled: false });
    expect(native.players).toHaveLength(15);
    expect(bgm?.seekTo).not.toHaveBeenCalled();
    expect(bgm?.pause).not.toHaveBeenCalled();
    preferences.useFeedbackStore.getState().updatePreferences({ musicEnabled: false });
    expect(bgm?.pause).toHaveBeenCalledOnce();
    preferences.useFeedbackStore.getState().updatePreferences({ musicEnabled: true });
    expect(native.players).toHaveLength(15);
    expect(bgm?.volume).toBe(0.35);
  });

  it('결과 연출 때 BGM을 낮추고, 백그라운드에서는 멈추고 복귀하면 재개한다', async () => {
    engine.setMusicScene('classic');
    await settle();
    const bgm = native.players[14];
    engine.setMusicDucked(true);
    expect(bgm?.volume).toBeCloseTo(0.105);
    engine.setMusicDucked(false);
    expect(bgm?.volume).toBe(0.35);
    native.appState = 'background';
    native.appListener?.('background');
    expect(bgm?.pause).toHaveBeenCalledOnce();
    native.appState = 'active';
    native.appListener?.('active');
    expect(native.players).toHaveLength(15);
    expect(bgm?.play).toHaveBeenCalledTimes(2);
  });

  it('빠른 화면 전환은 마지막 곡만 만들고 이전 플레이어를 해제한다', async () => {
    engine.setMusicScene('home');
    await settle();
    engine.setMusicScene('lobby');
    engine.setMusicScene('classic');
    vi.advanceTimersByTime(200);
    await settle();
    expect(native.players).toHaveLength(16);
    expect(native.players[15]?.source).toBe(103);
    expect(native.players[14]?.remove).toHaveBeenCalledOnce();
  });

  it('페이드 도중 원래 화면으로 돌아가도 같은 BGM을 처음부터 다시 만들지 않는다', async () => {
    engine.setMusicScene('home');
    await settle();
    engine.setMusicScene('lobby');
    vi.advanceTimersByTime(100);
    engine.setMusicScene('home');
    vi.advanceTimersByTime(200);
    await settle();
    expect(native.players).toHaveLength(15);
    expect(native.players[14]?.remove).not.toHaveBeenCalled();
    expect(native.players[14]?.volume).toBe(0.35);
  });

  it('늦게 로딩된 BGM은 백그라운드에서 시작하지 않고 복귀 때만 재생한다', async () => {
    native.nextLoaded = false;
    engine.setMusicScene('review');
    await settle();
    native.appState = 'background';
    native.appListener?.('background');
    const bgm = native.players[14];
    if (bgm) bgm.isLoaded = true;
    native.loads.get(14)?.({ isLoaded: true });
    expect(bgm?.play).not.toHaveBeenCalled();
    native.appState = 'active';
    native.appListener?.('active');
    expect(bgm?.play).toHaveBeenCalledOnce();
  });
});
