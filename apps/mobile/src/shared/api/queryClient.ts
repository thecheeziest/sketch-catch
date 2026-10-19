import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState } from 'react-native';

// RN에는 window focus 이벤트가 없어 기본값은 항상 "포커스됨"이다 — 백그라운드에서 refetchInterval 폴링이 멈추도록 AppState에 연결한다
focusManager.setEventListener(handleFocus => {
  const subscription = AppState.addEventListener('change', state => handleFocus(state === 'active'));
  return () => subscription.remove();
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
