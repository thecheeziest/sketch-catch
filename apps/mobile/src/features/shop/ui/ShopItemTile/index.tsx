import { Image, Text, View } from 'dripsy';
import { StyleSheet } from 'react-native';
import type { ShopCategory } from '@sketch-catch/shared';
import { COIN_SPRITE, colors, fontFamily, getCharacterImageSource, getChatTextColor } from '@/shared/config';
import { CosmeticAvatar } from '@/shared/ui/CosmeticAvatar';
import { FeedbackPressable } from '@/shared/ui/FeedbackPressable';
import { PixelFrame } from '@/shared/ui/PixelFrame';
import { PixelSprite } from '@/shared/ui/PixelSprite';
import type { ShopTile } from '../../lib/useShopScreen';

type Props = {
  tile: ShopTile;
  category: ShopCategory;
  characterId: string; // 테두리·배경 탭에서 내 캐릭터에 입혀 보여준다
  width: number;
  onPress: () => void;
};

const PREVIEW_SIZE = 56;

function TilePreview({ tile, category, characterId }: Pick<Props, 'tile' | 'category' | 'characterId'>) {
  const id = tile.item?.id ?? null;
  switch (category) {
    case 'CHARACTER': {
      const source = id ? getCharacterImageSource(id) : null;
      return source !== null ? <Image source={source} sx={{ width: 60, height: 60 }} resizeMode="contain" /> : null;
    }
    case 'FRAME':
      return (
        <CosmeticAvatar
          characterId={characterId}
          frameId={id}
          size={PREVIEW_SIZE}
          defaultBorderColor={colors.SECONDARY_300}
          defaultBackgroundColor={colors.DARK_100}
        />
      );
    case 'BACKGROUND':
      return (
        <CosmeticAvatar
          characterId={characterId}
          backgroundId={id}
          size={PREVIEW_SIZE}
          defaultBorderColor={colors.DARK_100}
          defaultBackgroundColor={colors.DARK_100}
        />
      );
    case 'CHAT_COLOR':
      return (
        <Text sx={{ fontFamily: fontFamily.BOLD, fontSize: 20, lineHeight: 28, color: getChatTextColor(id) ?? colors.LIGHT_100 }}>
          가나다
        </Text>
      );
  }
}

function TileStatus({ tile }: { tile: ShopTile }) {
  if (tile.state === 'EQUIPPED') return <Text sx={{ fontSize: 12, color: colors.ACCENT_300 }}>장착중</Text>;
  if (tile.state === 'OWNED') return <Text sx={{ fontSize: 12, color: colors.LIGHT_500 }}>보유</Text>;
  return (
    <View sx={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <PixelSprite sprite={COIN_SPRITE} pixelSize={1.5} />
      <Text sx={{ fontSize: 12, color: tile.state === 'BUYABLE' ? colors.WARNING_400 : colors.GRAY }}>{tile.item?.price}</Text>
    </View>
  );
}

export function ShopItemTile({ tile, category, characterId, width, onPress }: Props) {
  const locked = tile.state === 'BUYABLE' || tile.state === 'SHORT';
  return (
    <FeedbackPressable
      onPress={onPress}
      feedback={false}
      accessibilityRole="button"
      accessibilityState={{ selected: tile.selected }}
      accessibilityLabel={`${tile.name}, ${locked ? `${tile.item?.price}코인` : '보유'}`}
      style={[styles.tile, { width }]}
    >
      <PixelFrame
        borderColor={tile.selected ? colors.WARNING_200 : colors.DARK_100}
        borderWidth={tile.selected ? 3 : 2}
        style={StyleSheet.absoluteFill}
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.DARK_200 }]} />
      </PixelFrame>
      <View style={[styles.preview, tile.state === 'SHORT' && styles.dimmed]}>
        <TilePreview tile={tile} category={category} characterId={characterId} />
      </View>
      <View style={styles.status}>
        <TileStatus tile={tile} />
      </View>
    </FeedbackPressable>
  );
}

const styles = StyleSheet.create({
  tile: { height: 118 },
  preview: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 8 },
  status: { height: 30, alignItems: 'center', justifyContent: 'center' },
  dimmed: { opacity: 0.4 },
});
