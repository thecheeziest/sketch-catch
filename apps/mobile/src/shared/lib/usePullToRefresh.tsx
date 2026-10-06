import { type ReactElement, useCallback, useRef, useState } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, RefreshControl, type RefreshControlProps } from 'react-native';

// 이만큼 당기면 진행률 1(새로고침 발동 지점과 비슷한 거리)
const PULL_DISTANCE = 80;
// 당기는 동안 매 프레임 리렌더하지 않도록 진행률을 단계로 끊는다
const PROGRESS_STEPS = 12;

type PullToRefresh = {
  refreshing: boolean;
  // 0~1 — 당김 정도 (iOS 바운스 기준, Android는 새로고침 중에만 표시)
  pullProgress: number;
  refreshControl: ReactElement<RefreshControlProps>;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

/**
 * 네이티브 RefreshControl의 제스처·발동은 그대로 쓰고, 기본 인디케이터는 투명 처리한다.
 * 화면은 pullProgress/refreshing으로 PullRefreshIndicator(원형 픽셀 스피너)를 직접 그린다.
 */
export function usePullToRefresh(onRefresh: () => Promise<unknown>): PullToRefresh {
  const [refreshing, setRefreshing] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const progressRef = useRef(0);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    const raw = offsetY < 0 ? Math.min(1, -offsetY / PULL_DISTANCE) : 0;
    const stepped = Math.round(raw * PROGRESS_STEPS) / PROGRESS_STEPS;
    if (stepped === progressRef.current) return;
    progressRef.current = stepped;
    setPullProgress(stepped);
  }, []);

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={handleRefresh}
      tintColor="transparent"
      colors={['transparent']}
      progressBackgroundColor="transparent"
    />
  );

  return { refreshing, pullProgress, refreshControl, onScroll };
}
