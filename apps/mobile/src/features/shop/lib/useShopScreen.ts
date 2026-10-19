import { useMemo, useState } from 'react';
import { getShopItemsByCategory, type ShopCategory, type ShopItem, type UserPrivate } from '@sketch-catch/shared';
import { useMe } from '@/features/auth/api';
import { handleApiError } from '@/shared/lib/handleApiError';
import { playFeedback } from '@/shared/lib/feedback';
import { useEquipItem, usePurchaseItem } from '../api/useShopMutations';

export type ShopTileState = 'EQUIPPED' | 'OWNED' | 'BUYABLE' | 'SHORT';

export type ShopTile = {
  key: string;
  item: ShopItem | null; // null = 기본 모습 (테두리·배경·채팅색 없음)
  name: string;
  state: ShopTileState;
  selected: boolean;
};

type Selection = Record<ShopCategory, string | null>;

export type ShopDialog = { kind: 'PURCHASE' | 'SHORT'; item: ShopItem } | null;

export const SHOP_TABS: { category: ShopCategory; label: string }[] = [
  { category: 'CHARACTER', label: '캐릭터' },
  { category: 'FRAME', label: '테두리' },
  { category: 'BACKGROUND', label: '배경' },
  { category: 'CHAT_COLOR', label: '채팅색' },
];

const DEFAULT_NAME: Record<Exclude<ShopCategory, 'CHARACTER'>, string> = {
  FRAME: '기본 테두리',
  BACKGROUND: '기본 배경',
  CHAT_COLOR: '기본 흰색',
};

function equippedOf(user: UserPrivate): Selection {
  return {
    CHARACTER: user.characterId,
    FRAME: user.frameId,
    BACKGROUND: user.backgroundId,
    CHAT_COLOR: user.chatColorId,
  };
}

function tileState(item: ShopItem | null, user: UserPrivate, equippedId: string | null): ShopTileState {
  const id = item?.id ?? null;
  if (id === equippedId) return 'EQUIPPED';
  if (item === null || user.ownedItemIds.includes(item.id)) return 'OWNED';
  return item.price <= user.coins ? 'BUYABLE' : 'SHORT';
}

/**
 * 꾸미기 화면 로직 — 탭, 입어보기(선택만 하고 저장 안 함), 장착·구매.
 * 화면을 나가면 선택은 버려지고 장착은 마지막 보유 아이템 그대로 남는다.
 */
export function useShopScreen() {
  const { data: user } = useMe();
  const purchase = usePurchaseItem();
  const equip = useEquipItem();
  const [tab, setTab] = useState<ShopCategory>('CHARACTER');
  const [override, setOverride] = useState<Partial<Selection>>({});
  const [dialog, setDialog] = useState<ShopDialog>(null);

  const equipped = useMemo(() => (user ? equippedOf(user) : null), [user]);
  const selection: Selection | null = equipped ? { ...equipped, ...override } : null;

  const tiles = useMemo<ShopTile[]>(() => {
    if (!user || !equipped) return [];
    const selectedId = tab in override ? (override[tab] ?? null) : equipped[tab];
    const items: (ShopItem | null)[] = getShopItemsByCategory(tab);
    const withDefault = tab === 'CHARACTER' ? items : [null, ...items];
    return withDefault.map(item => ({
      key: item?.id ?? `default-${tab}`,
      item,
      name: item?.name ?? DEFAULT_NAME[tab as Exclude<ShopCategory, 'CHARACTER'>],
      state: tileState(item, user, equipped[tab]),
      selected: (item?.id ?? null) === selectedId,
    }));
  }, [user, equipped, override, tab]);

  const current = tiles.find(t => t.selected) ?? null;
  const isTrying =
    !!user && !!selection && Object.values(selection).some(id => id !== null && !user.ownedItemIds.includes(id));

  // 장착이 끝나면 입어보기 표시를 지우고 서버의 장착값을 따른다
  const clearOverride = (category: ShopCategory): void =>
    setOverride(prev => {
      const next = { ...prev };
      delete next[category];
      return next;
    });

  const select = (tile: ShopTile): void => {
    playFeedback('select');
    setOverride(prev => ({ ...prev, [tab]: tile.item?.id ?? null }));
  };

  const equipCurrent = (): void => {
    if (!current || current.state !== 'OWNED') return;
    const itemId = current.item?.id ?? null;
    const input =
      tab === 'CHARACTER' ? { category: 'CHARACTER' as const, itemId: itemId ?? '' } : { category: tab, itemId };
    equip.mutate(input, {
      onSuccess: () => clearOverride(tab),
      onError: err => handleApiError(err),
    });
  };

  // 구매 버튼 — 잔액이 모자라면 부족 안내, 아니면 구매 확인
  const openPurchase = (): void => {
    if (!current?.item || (current.state !== 'BUYABLE' && current.state !== 'SHORT')) return;
    setDialog({ kind: current.state === 'SHORT' ? 'SHORT' : 'PURCHASE', item: current.item });
  };

  const confirmPurchase = (equipAfter: boolean): void => {
    if (dialog?.kind !== 'PURCHASE') return;
    const { item } = dialog;
    purchase.mutate(
      { itemId: item.id, equip: equipAfter },
      {
        onSuccess: () => {
          playFeedback('confirm');
          setDialog(null);
          if (equipAfter) clearOverride(item.category);
        },
        onError: err => {
          setDialog(null);
          handleApiError(err);
        },
      },
    );
  };

  return {
    user,
    tab,
    setTab,
    tiles,
    current,
    selection,
    isTrying,
    dialog,
    closeDialog: () => setDialog(null),
    select,
    equipCurrent,
    openPurchase,
    confirmPurchase,
    isEquipping: equip.isPending,
    isPurchasing: purchase.isPending,
  };
}
