import { Text, View } from 'dripsy';
import { StyleSheet } from 'react-native';
import type { ShopItem } from '@sketch-catch/shared';
import { colors, spacing } from '@/shared/config';
import { Dialog } from '@/shared/ui/Dialog';
import { PixelFrame } from '@/shared/ui/PixelFrame';
import { ShopItemPreview } from '../ShopItemPreview';

type Props = {
  visible: boolean;
  item: ShopItem | null;
  coins: number;
  characterId: string;
  onClose: () => void;
  onPlay: () => void;
};

// 한 판 평균 획득량 — 몇 판이면 모이는지 안내용 (모드1 4인 기준 2~3등 수준)
const AVERAGE_COINS_PER_GAME = 40;

export function NotEnoughCoinDialog({ visible, item, coins, characterId, onClose, onPlay }: Props) {
  const price = item?.price ?? 0;
  const shortage = Math.max(0, price - coins);
  const progress = price > 0 ? Math.min(1, coins / price) : 0;
  const games = Math.max(1, Math.ceil(shortage / AVERAGE_COINS_PER_GAME));

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      title="코인이 모자라요"
      buttons={[
        { label: '닫기', color: 'light', onPress: onClose },
        { label: '게임하러 가기', color: 'primary', onPress: onPlay },
      ]}
    >
      {item && (
        <View sx={{ alignItems: 'center', gap: spacing.MD }}>
          <ShopItemPreview item={item} characterId={characterId} size={96} />
          <Text variants={['bold', 'T3']} sx={{ color: colors.LIGHT_100 }}>
            {item.name}
          </Text>
          <View sx={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text variants={['bold', 'H3']} sx={{ color: colors.WARNING_400 }}>
              {shortage}
            </Text>
            <Text sx={{ color: colors.LIGHT_300 }}>코인이 더 필요해요</Text>
          </View>
          <View sx={{ alignSelf: 'stretch', gap: 6 }}>
            <View
              style={styles.track}
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: price, now: coins }}
            >
              <PixelFrame borderColor={colors.DARK_100} borderWidth={2} notchSize={3} style={StyleSheet.absoluteFill}>
                <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.DARK_400 }]} />
                <View style={[styles.fill, { width: `${progress * 100}%` }]} />
              </PixelFrame>
            </View>
            <View sx={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text sx={{ fontSize: 12, color: colors.LIGHT_500 }}>
                {coins} / {price}
              </Text>
              <Text sx={{ fontSize: 12, color: colors.LIGHT_500 }}>약 {games}판이면 모여요</Text>
            </View>
          </View>
        </View>
      )}
    </Dialog>
  );
}

const styles = StyleSheet.create({
  track: { height: 14 },
  fill: { height: '100%', backgroundColor: colors.WARNING_400 },
});
