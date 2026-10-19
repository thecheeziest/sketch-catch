import { useRouter } from 'expo-router';
import { ScrollView, Text, View } from 'dripsy';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  NotEnoughCoinDialog,
  PurchaseDialog,
  ShopActionBar,
  ShopItemTile,
  ShopStage,
  ShopTabs,
  useShopScreen,
} from '@/features/shop';
import { colors, spacing } from '@/shared/config';
import { CoinChip, Icon, PixelLoadingSpinner } from '@/shared/ui';
import { FeedbackPressable } from '@/shared/ui/FeedbackPressable';

const COLUMNS = 3;
const GRID_GAP = 14;

// 꾸미기 상점 — 캐릭터·테두리·배경·채팅색을 입어 보고, 보유한 것은 장착, 없는 것은 코인으로 산다
export default function ShopScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const shop = useShopScreen();
  const tileWidth = Math.floor((width - spacing.MD * 2 - GRID_GAP * (COLUMNS - 1)) / COLUMNS);

  if (!shop.user || !shop.selection) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <PixelLoadingSpinner size={32} accessibilityLabel="불러오는 중" />
      </SafeAreaView>
    );
  }

  const { user, selection } = shop;
  const dialogItem = shop.dialog?.item ?? null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View sx={sxStyles.header}>
        <FeedbackPressable
          feedback="cancel"
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
        >
          <Icon name="BACK" size={24} />
        </FeedbackPressable>
        <Text variants={['bold', 'T2']} sx={{ flex: 1, color: colors.LIGHT_100 }}>
          꾸미기
        </Text>
        <CoinChip label={String(user.coins)} accessibilityLabel={`보유 코인 ${user.coins}개`} />
      </View>

      <ShopStage nickname={user.nickname} selection={selection} isTrying={shop.isTrying} />

      <View sx={{ paddingVertical: spacing.MD }}>
        <ShopTabs active={shop.tab} onChange={shop.setTab} />
      </View>

      <ScrollView contentContainerStyle={styles.grid}>
        {shop.tiles.map(tile => (
          <ShopItemTile
            key={tile.key}
            tile={tile}
            category={shop.tab}
            characterId={selection.CHARACTER ?? user.characterId}
            width={tileWidth}
            onPress={() => shop.select(tile)}
          />
        ))}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.DARK_400 }}>
        <ShopActionBar
          category={shop.tab}
          current={shop.current}
          coins={user.coins}
          isEquipping={shop.isEquipping}
          onEquip={shop.equipCurrent}
          onPurchase={shop.openPurchase}
        />
      </SafeAreaView>

      <PurchaseDialog
        visible={shop.dialog?.kind === 'PURCHASE'}
        item={dialogItem}
        coins={user.coins}
        characterId={user.characterId}
        loading={shop.isPurchasing}
        onClose={shop.closeDialog}
        onConfirm={shop.confirmPurchase}
      />
      <NotEnoughCoinDialog
        visible={shop.dialog?.kind === 'SHORT'}
        item={dialogItem}
        coins={user.coins}
        characterId={user.characterId}
        onClose={shop.closeDialog}
        onPlay={() => {
          // 상점은 홈 헤더에서만 열리므로 뒤로 가면 홈이다
          shop.closeDialog();
          router.back();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.DARK_300 },
  center: { alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    paddingHorizontal: spacing.MD,
    paddingTop: spacing.SM,
    paddingBottom: spacing.LG,
  },
});

const sxStyles = {
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.SM,
    paddingHorizontal: spacing.SM,
    paddingRight: spacing.MD,
    paddingBottom: spacing.SM,
  },
};
