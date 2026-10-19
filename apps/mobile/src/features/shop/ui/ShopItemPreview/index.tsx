import { Text } from 'dripsy';
import type { ShopItem } from '@sketch-catch/shared';
import { colors, fontFamily } from '@/shared/config';
import { CosmeticAvatar } from '@/shared/ui/CosmeticAvatar';

type Props = {
  item: ShopItem;
  characterId: string;
  size: number;
};

// 구매 확인·코인 부족 안내에서 쓰는 아이템 미리보기 — 내 캐릭터에 입혀서 보여준다
export function ShopItemPreview({ item, characterId, size }: Props) {
  if (item.category === 'CHAT_COLOR') {
    return (
      <Text sx={{ fontFamily: fontFamily.BOLD, fontSize: 28, lineHeight: 40, color: item.color }}>가나다</Text>
    );
  }
  return (
    <CosmeticAvatar
      characterId={item.category === 'CHARACTER' ? item.id : characterId}
      frameId={item.category === 'FRAME' ? item.id : null}
      backgroundId={item.category === 'BACKGROUND' ? item.id : null}
      size={size}
      defaultBorderColor={colors.SECONDARY_300}
      defaultBackgroundColor={colors.DARK_100}
    />
  );
}
