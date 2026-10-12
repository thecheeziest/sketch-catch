import tvOff from '@assets/audio/tv-off.wav';
import tvOn from '@assets/audio/tv-on.wav';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { AppState, Platform } from 'react-native';
import { hydrateFeedbackSettings, useFeedbackStore } from '@/shared/model/feedback';

type TvTransition = 'on' | 'off';
const SOURCES = { on: tvOn, off: tvOff };
const HAPTIC_DELAY = { on: 90, off: 160 };
let players: Partial<Record<TvTransition, AudioPlayer>> = {};
let ready = false;
let lifecycleId = 0;
let cancelCurrent: (() => void) | undefined;

function stopFeedback(): void {
  cancelCurrent?.();
  cancelCurrent = undefined;
}

export function initializeFeedback(): () => void {
  const id = ++lifecycleId;
  void (async () => {
    await hydrateFeedbackSettings();
    if (id !== lifecycleId) return;
    try {
      await setAudioModeAsync({
        playsInSilentMode: false,
        interruptionMode: 'mixWithOthers',
        allowsRecording: false,
        shouldPlayInBackground: false,
      });
      if (id !== lifecycleId) return;
      players.on = createAudioPlayer(SOURCES.on, { updateInterval: 100 });
      players.off = createAudioPlayer(SOURCES.off, { updateInterval: 100 });
      ready = true;
    } catch (error) {
      console.warn('[feedback] 오디오 준비 실패', error);
    }
  })();

  const appSubscription = AppState.addEventListener('change', state => {
    if (state !== 'active') stopFeedback();
  });
  const unsubscribe = useFeedbackStore.subscribe((state, previous) => {
    if (state.soundEnabled !== previous.soundEnabled || state.soundVolume !== previous.soundVolume) {
      for (const player of Object.values(players)) {
        player.volume = state.soundEnabled ? state.soundVolume : 0;
      }
    }
  });

  return () => {
    appSubscription.remove();
    unsubscribe();
    if (id !== lifecycleId) return;
    lifecycleId += 1;
    ready = false;
    stopFeedback();
    for (const player of Object.values(players)) player.remove();
    players = {};
  };
}

export function playTvFeedback(transition: TvTransition): () => void {
  stopFeedback();
  const preferences = useFeedbackStore.getState();
  if (!preferences.hydrated || AppState.currentState !== 'active') return () => undefined;

  let cancelled = false;
  let hapticTimer: ReturnType<typeof setTimeout> | undefined;
  const player = players[transition];
  const cancel = () => {
    if (cancelled) return;
    cancelled = true;
    clearTimeout(hapticTimer);
    player?.pause();
  };
  cancelCurrent = cancel;

  // 사전 로드가 끝나지 않은 경우 지나간 전환음을 뒤늦게 재생하지 않는다.
  if (ready && player?.isLoaded && preferences.soundEnabled && preferences.soundVolume > 0) {
    player.volume = preferences.soundVolume;
    void player
      .seekTo(0)
      .then(() => {
        if (cancelled || AppState.currentState !== 'active' || !useFeedbackStore.getState().soundEnabled) return;
        player.play();
      })
      .catch(error => console.warn('[feedback] TV 효과음 재생 실패', error));
  }

  if (preferences.hapticsEnabled) {
    hapticTimer = setTimeout(() => {
      if (cancelled || AppState.currentState !== 'active' || !useFeedbackStore.getState().hapticsEnabled) return;
      let feedback: Promise<void>;
      if (Platform.OS === 'android') {
        const pattern = transition === 'on' ? Haptics.AndroidHaptics.Toggle_On : Haptics.AndroidHaptics.Toggle_Off;
        feedback = Haptics.performAndroidHapticsAsync(pattern);
      } else {
        const style = transition === 'on' ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Soft;
        feedback = Haptics.impactAsync(style);
      }
      void feedback.catch(error => console.warn('[feedback] TV 햅틱 실행 실패', error));
    }, HAPTIC_DELAY[transition]);
  }
  return cancel;
}
