import { Text, View } from 'dripsy';
import { StyleSheet } from 'react-native';
import { colors, textSizes } from '@/shared/config';
import { Icon } from '@/shared/ui/Icon';

type Props = {
  roundIndex: number;
  roundCount: number;
  onBack: () => void;
};

export function GameHeader({ roundIndex, roundCount, onBack }: Props) {
  return (
    <View style={styles.container}>
      {/* 뒤로가기 */}
      <View style={styles.left}>
        <Icon name="BACK" size={24} onPress={onBack} />
      </View>

      {/* 라운드 표시 — 중앙 */}
      <View style={styles.center}>
        <Text sx={{ ...textSizes.T3, color: colors.LIGHT_100 }}>
          {`라운드 ${roundIndex + 1}/${roundCount}`}
        </Text>
      </View>

      {/* 타이머 플레이스홀더 — Plan 07에서 useGameTimer 연결 */}
      <View style={styles.right} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  left: {
    width: 40,
    alignItems: 'flex-start',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  right: {
    width: 40,
    alignItems: 'flex-end',
  },
});
