import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { AppState, Platform } from 'react-native';
import {
  getFeedbackDefinition,
  musicSources,
  soundSources,
  type FeedbackName,
  type MusicScene,
} from '@/shared/config/audio';
import { hydrateFeedbackSettings, useFeedbackStore } from '@/shared/model/feedback';

type ActiveSound = {
  name: FeedbackName;
  player?: AudioPlayer;
  priority: number;
  until: number;
  cancel: () => void;
  stopSound: () => void;
};
type FeedbackOptions = { key?: string; haptics?: boolean };
const players: Partial<Record<keyof typeof soundSources, AudioPlayer>> = {};
const channels = new Map<string, ActiveSound>();
const remembered = new Set<string>();
let ready = false;
let lifecycleId = 0;
let music: { scene: MusicScene; player: AudioPlayer } | null = null;
let requestedScene: MusicScene | null = null;
let musicGeneration = 0;
let cancelFade: (() => void) | undefined;
let musicLoad: { remove: () => void } | undefined;
let musicLoadTimeout: ReturnType<typeof setTimeout> | undefined;
let overlayDucked = false;
let cueDucked = false;
let duckTimer: ReturnType<typeof setTimeout> | undefined;
let lastUiAt = -Infinity;

function active(): boolean {
  return AppState.currentState === 'active';
}
function musicVolume(): number {
  const state = useFeedbackStore.getState();
  if (!state.musicEnabled || !active()) return 0;
  return state.musicVolume * (overlayDucked || cueDucked ? 0.3 : 1);
}
function updateMusicVolume(): void {
  if (music) music.player.volume = musicVolume();
}
function stopEffects(): void {
  for (const sound of channels.values()) sound.cancel();
  channels.clear();
  clearTimeout(duckTimer);
  cueDucked = false;
}
function releaseMusic(): void {
  cancelFade?.();
  cancelFade = undefined;
  musicLoad?.remove();
  musicLoad = undefined;
  clearTimeout(musicLoadTimeout);
  music?.player.remove();
  music = null;
}
function fadeOut(player: AudioPlayer): Promise<boolean> {
  const from = player.volume;
  return new Promise(resolve => {
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += 25;
      player.volume = Math.max(0, from * (1 - elapsed / 200));
      if (elapsed < 200) return;
      clearInterval(timer);
      cancelFade = undefined;
      resolve(true);
    }, 25);
    cancelFade = () => {
      clearInterval(timer);
      resolve(false);
    };
  });
}
async function changeMusic(): Promise<void> {
  if (!ready) return;
  if (music?.scene === requestedScene) {
    if (cancelFade) {
      ++musicGeneration;
      cancelFade();
      cancelFade = undefined;
    }
    updateMusicVolume();
    if (active() && useFeedbackStore.getState().musicEnabled && music.player.isLoaded) music.player.play();
    return;
  }
  const generation = ++musicGeneration;
  cancelFade?.();
  if (music && active() && !(await fadeOut(music.player))) return;
  if (generation !== musicGeneration || !ready) return;
  releaseMusic();
  // 백그라운드에선 새 플레이어를 만들지 않는다 — 복귀 시 syncMusic이 현재 장면으로 만든다
  if (!requestedScene || !active()) return;
  const scene = requestedScene;
  const player = createAudioPlayer(musicSources[scene], { updateInterval: 500 });
  music = { scene, player };
  player.loop = true;
  const start = () => {
    if (!ready || music?.player !== player || requestedScene !== scene) return;
    updateMusicVolume();
    if (active() && useFeedbackStore.getState().musicEnabled) player.play();
    musicLoad?.remove();
    musicLoad = undefined;
    clearTimeout(musicLoadTimeout);
  };
  if (player.isLoaded) {
    start();
    return;
  }
  musicLoad = player.addListener('playbackStatusUpdate', status => {
    if (status.isLoaded) start();
  });
  musicLoadTimeout = setTimeout(() => {
    if (music?.player !== player) return;
    console.warn('[feedback] BGM 로드 시간 초과', scene);
    releaseMusic();
  }, 10000);
}
function syncMusic(): void {
  void changeMusic().catch(error => console.warn('[feedback] BGM 전환 실패', error));
}
export function setMusicScene(scene: MusicScene | null): void {
  if (requestedScene && requestedScene !== 'home' && (scene === 'home' || scene === null)) {
    channels.get('game')?.cancel();
    clearTimeout(duckTimer);
    cueDucked = false;
  }
  requestedScene = scene;
  syncMusic();
}
export function setMusicDucked(ducked: boolean): void {
  overlayDucked = ducked;
  updateMusicVolume();
}

export function initializeFeedback(): () => void {
  const id = ++lifecycleId;
  void (async () => {
    await hydrateFeedbackSettings();
    if (id !== lifecycleId) return;
    try {
      await setAudioModeAsync({
        // iOS는 무음 스위치를 존중하고, Android는 진동 모드에서도 효과음이 나야 한다
        playsInSilentMode: Platform.OS === 'android',
        interruptionMode: 'mixWithOthers',
        allowsRecording: false,
        shouldPlayInBackground: false,
      });
      if (id !== lifecycleId) return;
      for (const name of Object.keys(soundSources) as Array<keyof typeof soundSources>) {
        players[name] = createAudioPlayer(soundSources[name], { updateInterval: 100 });
      }
      ready = true;
      syncMusic();
    } catch (error) {
      console.warn('[feedback] 오디오 준비 실패', error);
    }
  })();
  const appSubscription = AppState.addEventListener('change', state => {
    if (state === 'active') {
      syncMusic();
      return;
    }
    stopEffects();
    if (state !== 'background') {
      music?.player.pause();
      return;
    }
    // Android는 플레이어마다 미디어 세션이 있어, 일시정지만 하면 이어폰·블루투스 연결 시 OS가 "재생" 신호로
    // 다시 틀어 버린다. 백그라운드에선 BGM 플레이어를 해제하고(복귀 시 syncMusic이 다시 만든다) 효과음은 무음으로 둔다.
    ++musicGeneration;
    releaseMusic();
    for (const player of Object.values(players)) {
      if (player) player.volume = 0;
    }
  });
  const unsubscribe = useFeedbackStore.subscribe((state, previous) => {
    if (state.soundEnabled !== previous.soundEnabled || state.soundVolume !== previous.soundVolume) {
      for (const sound of channels.values()) {
        if (!state.soundEnabled) sound.stopSound();
        else if (sound.player)
          sound.player.volume = state.soundVolume * (getFeedbackDefinition(sound.name).volume ?? 1);
      }
    }
    if (state.musicEnabled !== previous.musicEnabled || state.musicVolume !== previous.musicVolume) {
      if (!state.musicEnabled) music?.player.pause();
      else syncMusic();
      updateMusicVolume();
    }
  });
  return () => {
    appSubscription.remove();
    unsubscribe();
    if (id !== lifecycleId) return;
    ++lifecycleId;
    ++musicGeneration;
    ready = false;
    stopEffects();
    releaseMusic();
    remembered.clear();
    requestedScene = null;
    overlayDucked = false;
    lastUiAt = -Infinity;
    for (const name of Object.keys(players) as Array<keyof typeof players>) {
      players[name]?.remove();
      delete players[name];
    }
  };
}

function haptic(name: FeedbackName): Promise<void> {
  const { haptic: pattern } = getFeedbackDefinition(name);
  if (pattern === 'success') return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  if (pattern === 'warning') return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  if (pattern === 'selection') return Haptics.selectionAsync();
  if (pattern === 'error') return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  if (pattern === 'heavy') return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  if (pattern === 'soft' || pattern === 'tvOff') return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
  return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function playFeedback(name: FeedbackName, options: FeedbackOptions = {}): () => void {
  if (options.key) {
    if (remembered.has(options.key)) return () => undefined;
    remembered.add(options.key);
    if (remembered.size > 256) remembered.delete(remembered.values().next().value ?? '');
  }
  const definition = getFeedbackDefinition(name);
  const state = useFeedbackStore.getState();
  if (!state.hydrated || !active()) return () => undefined;
  const previous = channels.get(definition.channel);
  const now = Date.now();
  if (previous && previous.until > now && previous.priority > definition.priority) return () => undefined;
  if (definition.priority === 1 && now - lastUiAt < 80) return () => undefined;
  if (definition.priority === 1) lastUiAt = now;
  previous?.cancel();
  if (definition.priority >= 8 || definition.channel === 'tv') channels.get('ui')?.cancel();
  const player = players[definition.sound];
  for (const sound of channels.values()) {
    if (player && sound.player === player) sound.cancel();
  }
  let cancelled = false;
  let soundCancelled = false;
  const hapticTimers: Array<ReturnType<typeof setTimeout>> = [];
  let expiry: ReturnType<typeof setTimeout>;
  const cancelHaptics = () => hapticTimers.forEach(clearTimeout);
  const stopSound = () => {
    soundCancelled = true;
    player?.pause();
  };
  const cancel = () => {
    if (cancelled) return;
    cancelled = true;
    cancelHaptics();
    clearTimeout(expiry);
    stopSound();
    if (channels.get(definition.channel) === entry) channels.delete(definition.channel);
  };
  const entry: ActiveSound = {
    name,
    player,
    priority: definition.priority,
    until: now + definition.duration,
    cancel,
    stopSound,
  };
  channels.set(definition.channel, entry);
  const result = channels.get('game');
  const covered = definition.channel === 'ui' && result && result.priority >= 8 && result.until > now;
  if (!covered && ready && player?.isLoaded && state.soundEnabled && state.soundVolume > 0) {
    player.volume = state.soundVolume * (definition.volume ?? 1);
    void player
      .seekTo(0)
      .then(() => {
        if (!cancelled && !soundCancelled && active() && useFeedbackStore.getState().soundEnabled) player.play();
      })
      .catch(error => console.warn('[feedback] 효과음 재생 실패', name, error));
  }
  if (definition.priority >= 5) {
    cueDucked = true;
    updateMusicVolume();
    clearTimeout(duckTimer);
    duckTimer = setTimeout(() => {
      cueDucked = false;
      updateMusicVolume();
    }, definition.duration);
  }
  if (definition.haptic && options.haptics !== false) {
    const emitHaptic = () => {
      if (cancelled || !active()) return;
      void haptic(name).catch(error => console.warn('[feedback] 햅틱 실행 실패', error));
    };
    hapticTimers.push(setTimeout(emitHaptic, definition.hapticDelay ?? 0));
    if (definition.haptic === 'error') hapticTimers.push(setTimeout(emitHaptic, 110));
  }
  expiry = setTimeout(() => {
    cancelled = true;
    cancelHaptics();
    if (channels.get(definition.channel) === entry) channels.delete(definition.channel);
  }, definition.duration);
  return cancel;
}
