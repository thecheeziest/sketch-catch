import type { ShopItem } from '@sketch-catch/shared';
import { colors } from '@/shared/config';
import { CosmeticAvatar } from '@/shared/ui/CosmeticAvatar';
import { CosmeticChatText } from '@/shared/ui/CosmeticChatText';

type Props = {
  item: ShopItem;
  characterId: string;
  size: number;
};

// 구매 확인·코인 부족 안내에서 쓰는 아이템 미리보기 — 내 캐릭터에 입혀서 보여준다
export function ShopItemPreview({ item, characterId, size }: Props) {
  if (item.category === 'CHAT_COLOR') {
    return <CosmeticChatText itemId={item.id}>정답 고양이! ✨</CosmeticChatText>;
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
