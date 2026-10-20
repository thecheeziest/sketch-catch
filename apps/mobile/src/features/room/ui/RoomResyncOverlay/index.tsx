import { View } from 'dripsy';
import { colors } from '@/shared/config';
import { useRoomStore } from '@/shared/model';
import { SketchbookLoadingSpinner } from '@/shared/ui';

// 백그라운드 복귀 후 방 자리를 확인하는 동안 화면 전체를 덮어 조작을 막는다
export function RoomResyncOverlay() {
  const isResyncing = useRoomStore(s => s.isResyncing);
  if (!isResyncing) return null;

  return (
    <View sx={sxStyles.overlay} accessibilityViewIsModal>
      <SketchbookLoadingSpinner size={200} accessibilityLabel="방 연결 확인 중" />
    </View>
  );
}

const sxStyles = {
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.DARK_200,
  },
} as const;
