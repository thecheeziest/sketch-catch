import { useMemo, useState } from 'react';
import { getShopItemsByCategory, type ShopCategory, type ShopItem, type UserPrivate } from '@sketch-catch/shared';
import { useMe } from '@/features/auth/api';
import { handleApiError } from '@/shared/lib/handleApiError';
import { playFeedback } from '@/shared/lib/feedback';
import { useEquipAll, useEquipItem, usePurchaseItem } from '../api/useShopMutations';
import { equippedFirst, getEquipChanges, isInWardrobe, type CosmeticsView, type Selection } from './wardrobe';

export type ShopTileState = 'EQUIPPED' | 'OWNED' | 'BUYABLE' | 'SHORT';

export type ShopTile = {
  key: string;
  item: ShopItem | null; // null = 기본 모습 (테두리·배경·채팅색 없음)
  name: string;
  state: ShopTileState;
  selected: boolean;
};

export type ShopDialog = { kind: 'PURCHASE' | 'SHORT'; item: ShopItem } | { kind: 'SAVE' } | null;

export type CosmeticsTransition = 'curtain' | 'coins';

export const SHOP_TABS: { category: ShopCategory; label: string }[] = [
  { category: 'CHARACTER', label: '캐릭터' },
  { category: 'FRAME', label: '테두리' },
  { category: 'BACKGROUND', label: '배경' },
  { category: 'CHAT_COLOR', label: '채팅색' },
];

const DEFAULT_NAME: Record<Exclude<ShopCategory, 'CHARACTER'>, string> = {
  FRAME: '기본 테두리',
  BACKGROUND: '기본 배경',
  CHAT_COLOR: '기본 채팅색',
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
 * 꾸미기 화면 로직 — 캐치샵/내 옷장 전환, 탭, 입어보기(선택만 하고 저장 안 함), 장착·구매·옷장 저장.
 * 화면을 나가거나 샵↔옷장을 전환하면 선택은 버려지고 장착은 서버 값 그대로 남는다.
 */
export function useShopScreen(initialView: CosmeticsView) {
  const me = useMe();
  const user = me.data;
  const purchase = usePurchaseItem();
  const equip = useEquipItem();
  const equipAll = useEquipAll();
  const [view, setView] = useState<CosmeticsView>(initialView);
  // 진입 게이트: 내 정보가 없거나 갱신 중이면 덮개(옷장=커튼, 샵=코인)로 막고, 최신 값이 오면 걷는다.
  // 한 번 들어온 뒤의 백그라운드 갱신은 막지 않는다.
  const entryReady = user !== undefined && !me.isFetching && !me.isError;
  const [entered, setEntered] = useState(entryReady);
  const [transition, setTransition] = useState<CosmeticsTransition | null>(null);
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
    const visible =
      view === 'wardrobe' ? withDefault.filter(item => isInWardrobe(item, user.ownedItemIds, equipped[tab])) : withDefault;
    const result = visible.map(item => ({
      key: item?.id ?? `default-${tab}`,
      item,
      name: item?.name ?? DEFAULT_NAME[tab as Exclude<ShopCategory, 'CHARACTER'>],
      state: tileState(item, user, equipped[tab]),
      selected: (item?.id ?? null) === selectedId,
    }));
    return view === 'wardrobe' ? equippedFirst(result) : result;
  }, [user, equipped, override, tab, view]);

  const current = tiles.find(t => t.selected) ?? null;
  const changes = useMemo(() => (equipped ? getEquipChanges(equipped, override) : null), [equipped, override]);
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

  // 샵 → 옷장은 커튼, 옷장 → 샵은 코인 비. 화면이 가려진 순간 뷰를 바꿔 스택 없이 탭처럼 전환한다
  const switchView = (): void => {
    if (transition) return;
    playFeedback('select');
    setTransition(view === 'shop' ? 'curtain' : 'coins');
  };

  const onTransitionCovered = (): void => {
    setView(prev => (prev === 'shop' ? 'wardrobe' : 'shop'));
    setOverride({});
    setDialog(null);
  };

  const openSave = (): void => {
    if (changes) setDialog({ kind: 'SAVE' });
  };

  const confirmSave = (): void => {
    if (dialog?.kind !== 'SAVE' || !changes) return;
    equipAll.mutate(changes, {
      onSuccess: () => {
        playFeedback('confirm');
        setDialog(null);
        setOverride({});
      },
      onError: err => {
        setDialog(null);
        handleApiError(err);
      },
    });
  };

  return {
    user,
    entry: {
      covering: !entered,
      ready: entryReady,
      failed: me.isError && !me.isFetching,
      retry: () => void me.refetch(),
      onDone: () => setEntered(true),
    },
    view,
    transition,
    switchView,
    onTransitionCovered,
    onTransitionDone: () => setTransition(null),
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
    canSave: changes !== null,
    openSave,
    confirmSave,
    isSaving: equipAll.isPending,
  };
}
