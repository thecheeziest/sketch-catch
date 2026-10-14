import { useEffect } from 'react';
import { usePathname } from 'expo-router';
import { useGameStore } from '@/features/game/model/useGameStore';
import { setMusicDucked, setMusicScene } from '@/shared/lib/feedback';
import { type MusicScene } from '@/shared/config/audio';

export function getMusicScene(path: string): MusicScene {
  if (path === '/room/create' || !path.startsWith('/room/')) return 'home';
  if (path.endsWith('/mode2-review')) return 'review';
  if (path.endsWith('/award') || path.endsWith('/mode2-end')) return 'award';
  if (path.endsWith('/mode2')) return 'relay';
  if (path.endsWith('/game')) return 'classic';
  return 'lobby';
}

export function useBackgroundMusic(enabled: boolean): void {
  const path = usePathname();
  const ended = useGameStore(state => state.roundResult !== null);
  useEffect(() => {
    setMusicScene(enabled ? getMusicScene(path) : null);
  }, [path, enabled]);
  useEffect(() => {
    setMusicDucked(enabled && path.endsWith('/game') && ended);
  }, [enabled, path, ended]);
  useEffect(
    () => () => {
      setMusicScene(null);
      setMusicDucked(false);
    },
    [],
  );
}
