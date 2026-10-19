import { View } from 'dripsy';
import { spacing } from '@/shared/config';
import { PixelLoadingSpinner } from '@/shared/ui/PixelLoadingSpinner';

type Props = {
  refreshing: boolean;
  pullProgress: number;
};

// 리스트 상단에 겹쳐 그리는 Pull to Refresh 인디케이터 — usePullToRefresh와 함께 쓴다
export function PullRefreshIndicator({ refreshing, pullProgress }: Props) {
  if (!refreshing && pullProgress === 0) return null;
  return (
    <View
      pointerEvents="none"
      sx={{ position: 'absolute', top: spacing.SM, left: 0, right: 0, alignItems: 'center', zIndex: 1 }}
    >
      <PixelLoadingSpinner size={28} refreshing={refreshing} progress={refreshing ? 1 : pullProgress} />
    </View>
  );
}
