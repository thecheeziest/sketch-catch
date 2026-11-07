import { Text, View } from 'dripsy';
import { StyleSheet } from 'react-native';
import { colors, spacing } from '@/shared/config';
import { FeedbackPressable } from '@/shared/ui/FeedbackPressable';
import { PixelSprite } from '@/shared/ui/PixelSprite';
import { BLOCK_SPRITE, REPORT_SPRITE } from '../../config/sprites';
import { useUserModeration } from '../../lib/useUserModeration';
import { type ModerationTarget, useReportStore } from '../../model';

type Props = {
  target: ModerationTarget;
  // 신고 창은 앱 루트의 별도 모달이라 프로필 모달을 먼저 닫는다 (iOS는 모달 위에 다른 모달을 못 띄운다).
  // 프로필 Dialog의 onDismissed에 useReportStore의 openQueued를 연결해야 신고 창이 이어서 열린다
  onCloseHost: () => void;
};

// 프로필 다이얼로그 오른쪽 위의 픽셀 아이콘 버튼 — 차단 / 신고
export function ModerationActions({ target, onCloseHost }: Props) {
  const { confirmBlock } = useUserModeration();
  const queueReport = useReportStore(s => s.queue);

  const handleReport = (): void => {
    queueReport(target);
    onCloseHost();
  };

  return (
    <View sx={{ flexDirection: 'row', alignSelf: 'flex-end', gap: spacing.MD }}>
      <FeedbackPressable
        onPress={() => confirmBlock(target)}
        hitSlop={8}
        style={styles.action}
        accessibilityRole="button"
        accessibilityLabel={`${target.nickname} 차단`}
      >
        <PixelSprite sprite={BLOCK_SPRITE} pixelSize={1.5} />
        <Text variant="B4" sx={{ color: colors.GRAY }}>
          차단
        </Text>
      </FeedbackPressable>
      <FeedbackPressable
        onPress={handleReport}
        hitSlop={8}
        style={styles.action}
        accessibilityRole="button"
        accessibilityLabel={`${target.nickname} 신고`}
      >
        <PixelSprite sprite={REPORT_SPRITE} pixelSize={1.5} />
        <Text variant="B4" sx={{ color: colors.GRAY }}>
          신고
        </Text>
      </FeedbackPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  action: { alignItems: 'center', gap: 2 },
});
