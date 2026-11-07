import { Modal, StyleSheet } from 'react-native';
import { Text, View } from 'dripsy';
import { colors, spacing, textSizes } from '@/shared/config';
import { SketchbookLoadingSpinner } from '@/shared/ui';
import { useStepMessage } from '../../lib/useStepMessage';

// GIF 변환이 오래 걸려 무엇을 하는 중인지 순서대로 알려 준다
const SAVING_MESSAGES = [
  '그림 확인 중..',
  '스케치북 뜯는 중..',
  '그림 모으는 중..',
  '스케치북 이어 붙이는 중..',
  '저장 준비 중..',
] as const;
const MESSAGE_INTERVAL_MS = 5000;

type Props = { visible: boolean };

// GIF 저장 중 화면 전체를 막는 로딩 — 저장이 끝날 때까지 다른 조작(다시 보기·나가기)을 막는다
export function GifSavingOverlay({ visible }: Props) {
  const message = useStepMessage(SAVING_MESSAGES, MESSAGE_INTERVAL_MS, visible);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => undefined}>
      <View style={styles.backdrop}>
        <SketchbookLoadingSpinner size={200} accessibilityLabel="GIF 저장 중" />
        <Text sx={{ ...textSizes.B2, color: colors.LIGHT_100 }} accessibilityLiveRegion="polite">
          {message}
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.MD,
    backgroundColor: 'rgba(29, 22, 41, 0.85)',
  },
});
