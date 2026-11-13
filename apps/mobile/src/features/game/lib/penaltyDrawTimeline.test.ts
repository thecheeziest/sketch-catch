import { describe, expect, it } from 'vitest';
import { PENALTY_DRAW_TIMING } from '@/features/game/config/penaltyDraw';
import { buildPenaltyDrawTimeline, getSpotGaps } from './penaltyDrawTimeline';

describe('getSpotGaps', () => {
  it('후보 3명이면 3바퀴, 총 9번 비춘다', () => {
    expect(getSpotGaps(3)).toHaveLength(9);
  });

  it('후보 수와 무관하게 순회 전체 길이가 같다', () => {
    for (const count of [2, 3, 5, 12]) {
      const total = getSpotGaps(count).reduce((sum, gap) => sum + gap, 0);
      expect(Math.abs(total - PENALTY_DRAW_TIMING.SPOT_TOTAL_MS)).toBeLessThanOrEqual(count * 3);
    }
  });

  it('마지막 바퀴는 점점 느려진다', () => {
    const gaps = getSpotGaps(3);
    expect(gaps[6]!).toBeGreaterThan(gaps[5]!);
    expect(gaps[7]!).toBeGreaterThan(gaps[6]!);
    expect(gaps[8]!).toBeGreaterThan(gaps[7]!);
  });
});

describe('buildPenaltyDrawTimeline', () => {
  const timeline = buildPenaltyDrawTimeline(3);

  it('이벤트가 시간순이다', () => {
    const times = timeline.map(event => event.at);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('조명은 1, 2, 3 순서로 3바퀴 돌고 매번 탁 소리를 낸다', () => {
    const spots = timeline.filter(event => event.frame.phase === 'cycle');
    expect(spots.map(event => event.frame.spot)).toEqual([0, 1, 2, 0, 1, 2, 0, 1, 2]);
    expect(spots.every(event => event.sound === 'spotlight')).toBe(true);
  });

  it('순회가 끝난 뒤 공개 전까지 암전한다', () => {
    const pause = timeline.find(event => event.frame.phase === 'pause');
    expect(pause!.at).toBe(PENALTY_DRAW_TIMING.SPOT_START_MS + getSpotGaps(3).reduce((sum, gap) => sum + gap, 0));
    expect(pause!.at).toBeLessThan(PENALTY_DRAW_TIMING.REVEAL_MS);
  });

  it('단계와 효과음이 플로우 순서대로 나온다', () => {
    const steps = timeline.filter(event => event.frame.phase !== 'cycle').map(e => [e.frame.phase, e.sound]);
    expect(steps).toEqual([
      ['intro', 'drawSting'],
      ['intro', 'drawDrumroll'],
      ['dark', 'lightOff'],
      ['pause', undefined],
      ['reveal', 'drawFail'],
      ['promote', 'drawPromote'],
      ['done', undefined],
    ]);
  });

  it('후보가 많아도 공개 시점 전에 순회가 끝난다', () => {
    const pause = buildPenaltyDrawTimeline(12).find(event => event.frame.phase === 'pause');
    expect(pause!.at).toBeLessThan(PENALTY_DRAW_TIMING.REVEAL_MS);
  });
});
