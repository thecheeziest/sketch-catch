import { describe, expect, it } from 'vitest';
import { getDrawGeometry, groupDrawPlayers, layoutDrawSlots } from './penaltyDrawLayout';

const geometry = getDrawGeometry(390, 600);

describe('groupDrawPlayers', () => {
  it('확정 꼴등·후보·당첨·생존을 ranking 순서대로 나눈다', () => {
    const groups = groupDrawPlayers(['a', 'b', 'c', 'd', 'e'], ['b', 'c', 'd'], ['c', 'e']);
    expect(groups).toEqual({
      safeIds: ['a'],
      sureLoserIds: ['e'],
      candidateIds: ['b', 'c', 'd'],
      pickedIds: ['c'],
      survivorIds: ['b', 'd'],
    });
  });
});

describe('layoutDrawSlots', () => {
  const groups = groupDrawPlayers(['a', 'b', 'c', 'd', 'e'], ['c', 'd', 'e'], ['d']);

  it('이동 전에는 후보 전원이 꼴등 단상에 선다', () => {
    const slots = layoutDrawSlots(groups, geometry, false);
    expect(['c', 'd', 'e'].map(id => slots.get(id)!.stage)).toEqual(['bottom', 'bottom', 'bottom']);
    expect(['a', 'b'].map(id => slots.get(id)!.stage)).toEqual(['top', 'top']);
  });

  it('이동 후에는 당첨자만 꼴등 단상에 남고 가운데 선다', () => {
    const slots = layoutDrawSlots(groups, geometry, true);
    expect(['a', 'b', 'c', 'e'].every(id => slots.get(id)!.stage === 'top')).toBe(true);
    const loser = slots.get('d')!;
    expect(loser.stage).toBe('bottom');
    expect(loser.centerX).toBe(geometry.bottomStage.x + geometry.bottomStage.width / 2);
  });

  it('인원이 많아도 캐릭터가 단상 밖으로 나가지 않는다', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `p${i}`);
    const slots = layoutDrawSlots(groupDrawPlayers(ids, [], ['p11']), geometry, true);
    const top = [...slots.values()].filter(slot => slot.stage === 'top');
    for (const slot of top) {
      expect(slot.centerX - slot.size / 2).toBeGreaterThanOrEqual(geometry.topStage.x - 8);
      expect(slot.centerX + slot.size / 2).toBeLessThanOrEqual(geometry.topStage.x + geometry.topStage.width + 8);
    }
  });
});
