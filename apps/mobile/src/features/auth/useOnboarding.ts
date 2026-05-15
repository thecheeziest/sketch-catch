import { create } from 'zustand';

type OnboardingState = {
  nickname: string;
  friendCode: string;
  setStep1: (nickname: string, friendCode: string) => void;
  reset: () => void;
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  nickname: '',
  friendCode: '',
  setStep1: (nickname, friendCode) => set({ nickname, friendCode }),
  reset: () => set({ nickname: '', friendCode: '' }),
}));

export function generateRandomFriendCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < 5; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
