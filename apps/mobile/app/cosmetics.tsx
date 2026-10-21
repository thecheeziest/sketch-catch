import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'dripsy';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CoinRainTransition,
  CurtainTransition,
  NotEnoughCoinDialog,
  PurchaseDialog,
  ShopActionBar,
  ShopStage,
  ShopTabs,
  WARDROBE_BUTTON_BORDER,
  WARDROBE_SPRITE,
  parseCosmeticsView,
  useShopScreen,
} from '@/features/shop';
import { colors, spacing } from '@/shared/config';
import { Button, CoinChip, Dialog, Icon, PixelFrame, PixelLoadingSpinner, PixelSprite } from '@/shared/ui';
import { FeedbackPressable } from '@/shared/ui/FeedbackPressable';
import { ShopCatalog } from '@/features/shop/ui/ShopCatalog';

const COLUMNS = 3;
const GRID_GAP = 14;

// 꾸미기 — 캐치샵(사고 입어 보기)과 내 옷장(보유템 골라 저장)을 한 화면 안에서 탭처럼 전환한다.
// 둘 사이는 스택을 쌓지 않으므로 뒤로가기·스와이프는 항상 홈으로 간다.
export default function CosmeticsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ view?: string }>();
  const { width } = useWindowDimensions();
  const [initialView] = useState(() => parseCosmeticsView(params.view));
  const shop = useShopScreen(initialView);
  const tileWidth = Math.floor((width - spacing.MD * 2 - GRID_GAP * (COLUMNS - 1)) / COLUMNS);

  // 진입 로딩 덮개 — 옷장은 닫힌 커튼, 샵은 쏟아지는 코인 위에 스피너(실패 시 재시도)를 띄운다
  const EntryCover = initialView === 'wardrobe' ? CurtainTransition : CoinRainTransition;
  const entryCover = shop.entry.covering && (
    <EntryCover startCovered ready={shop.entry.ready} onDone={shop.entry.onDone}>
      {shop.entry.failed ? (
        <View sx={sxStyles.entryError}>
          <Text variants={['bold', 'T3']} sx={{ color: colors.LIGHT_100 }}>
            불러오지 못했어요
          </Text>
          <View sx={{ flexDirection: 'row', gap: spacing.SM }}>
            <Button label="홈으로" color="dark" onPress={() => router.back()} style={styles.entryBtn} />
            <Button label="다시 시도" color="secondary" onPress={shop.entry.retry} style={styles.entryBtn} />
          </View>
        </View>
      ) : (
        <PixelLoadingSpinner size={40} accessibilityLabel="불러오는 중" />
      )}
    </EntryCover>
  );

  if (!shop.user || !shop.selection) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        {entryCover || <PixelLoadingSpinner size={32} accessibilityLabel="불러오는 중" />}
      </SafeAreaView>
    );
  }

  const { user, selection } = shop;
  const isWardrobe = shop.view === 'wardrobe';
  const dialogItem = shop.dialog && shop.dialog.kind !== 'SAVE' ? shop.dialog.item : null;

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
          {isWardrobe ? '내 옷장' : '캐치샵'}
        </Text>
        {!isWardrobe && (
          // 코인 칩과 같은 픽셀 테두리·배경으로 눌리는 버튼임을 드러낸다 (아이콘 버튼 PixelFrame 금지 규칙의 의도적 예외)
          <FeedbackPressable
            feedback={false}
            onPress={shop.switchView}
            pressScale={0.95}
            accessibilityRole="button"
            accessibilityLabel="내 옷장 열기"
            hitSlop={6}
            style={styles.wardrobeBtn}
          >
            <PixelFrame
              borderColor={WARDROBE_BUTTON_BORDER}
              borderWidth={2}
              notchSize={4}
              style={StyleSheet.absoluteFill}
            >
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.DARK_400 }]} />
            </PixelFrame>
            <PixelSprite sprite={WARDROBE_SPRITE} pixelSize={2} />
          </FeedbackPressable>
        )}
        <CoinChip
          label={String(user.coins)}
          onPress={isWardrobe ? shop.switchView : undefined}
          accessibilityLabel={isWardrobe ? `보유 코인 ${user.coins}개, 캐치샵 열기` : `보유 코인 ${user.coins}개`}
        />
      </View>

      <ShopStage nickname={user.nickname} selection={selection} isTrying={shop.isTrying} />

      <View sx={{ paddingVertical: spacing.MD }}>
        <ShopTabs active={shop.tab} onChange={shop.setTab} />
      </View>

      <ShopCatalog
        key={shop.view}
        tiles={shop.tiles}
        category={shop.tab}
        characterId={selection.CHARACTER ?? user.characterId}
        tileWidth={tileWidth}
        onSelect={shop.select}
      />

      <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.DARK_400 }}>
        <ShopActionBar
          view={shop.view}
          category={shop.tab}
          current={shop.current}
          coins={user.coins}
          isEquipping={shop.isEquipping}
          onEquip={shop.equipCurrent}
          onPurchase={shop.openPurchase}
          canSave={shop.canSave}
          isSaving={shop.isSaving}
          onSave={shop.openSave}
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
          // 꾸미기 화면은 홈 헤더에서만 열리므로 뒤로 가면 홈이다
          shop.closeDialog();
          router.back();
        }}
      />
      <Dialog
        visible={shop.dialog?.kind === 'SAVE'}
        onClose={shop.closeDialog}
        dismissible={!shop.isSaving}
        title="이대로 저장할까요?"
        buttons={[
          { label: '취소', color: 'dark', onPress: shop.closeDialog, disabled: shop.isSaving },
          { label: '저장', color: 'secondary', onPress: shop.confirmSave, loading: shop.isSaving },
        ]}
      />

      {entryCover}
      {shop.transition === 'curtain' && (
        <CurtainTransition onCovered={shop.onTransitionCovered} onDone={shop.onTransitionDone} />
      )}
      {shop.transition === 'coins' && (
        <CoinRainTransition onCovered={shop.onTransitionCovered} onDone={shop.onTransitionDone} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.DARK_300 },
  center: { alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  entryBtn: { width: 120 },
  wardrobeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});

const sxStyles = {
  entryError: {
    alignItems: 'center' as const,
    gap: spacing.MD,
    padding: spacing.LG,
    backgroundColor: colors.DARK_300,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.SM,
    paddingHorizontal: spacing.SM,
    paddingRight: spacing.MD,
    paddingBottom: spacing.SM,
  },
};
