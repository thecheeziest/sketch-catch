import type { EquipAllInput, ShopCategory, ShopItem } from '@sketch-catch/shared';

export type CosmeticsView = 'shop' | 'wardrobe';

export type Selection = Record<ShopCategory, string | null>;

// 라우트 파라미터는 외부 입력이므로 알 수 없는 값은 캐치샵으로 연다
export function parseCosmeticsView(value: unknown): CosmeticsView {
  return value === 'wardrobe' ? 'wardrobe' : 'shop';
}

// 옷장에는 기본 모습, 보유 아이템, 지금 장착 중인 아이템만 보인다
export function isInWardrobe(item: ShopItem | null, ownedItemIds: readonly string[], equippedId: string | null): boolean {
  return item === null || item.id === equippedId || ownedItemIds.includes(item.id);
}

// 입어 본 값 중 현재 장착과 다른 카테고리만 저장 요청에 담는다. 바뀐 게 없으면 null
export function getEquipChanges(equipped: Selection, override: Partial<Selection>): EquipAllInput | null {
  const changes: Partial<Selection> = {};
  for (const category of Object.keys(override) as ShopCategory[]) {
    const id = override[category];
    if (id === undefined || id === equipped[category]) continue;
    changes[category] = id;
  }
  if (Object.keys(changes).length === 0) return null;
  // 옷장의 캐릭터 탭에는 기본(null) 타일이 없어 CHARACTER는 항상 아이템 ID다
  return changes as EquipAllInput;
}

// 옷장에서는 저장된 장착템을 앞으로 보낸다. 안정 정렬이라 등급·분류 그룹 안에서만 첫 카드가 되고 나머지 순서는 유지된다
export function equippedFirst<T extends { state: string }>(tiles: T[]): T[] {
  return [...tiles].sort((a, b) => Number(b.state === 'EQUIPPED') - Number(a.state === 'EQUIPPED'));
}
