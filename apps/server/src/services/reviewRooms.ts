import type { Player } from '@sketch-catch/shared';
import { env } from '../lib/env.js';

export function canUseReviewRoom(userId: string): boolean {
  return env.REVIEW_USER_IDS.includes(userId);
}

export function createReviewBots(code: string): Player[] {
  return ['cat', 'rabbit'].map((characterId, index) => ({
    id: `review-bot-${characterId}-${code}`,
    nickname: `그림봇${index + 1}`,
    characterId,
    friendCode: 'BOT00',
    statusMessage: '자동으로 참여하는 체험용 봇',
    slot: index + 1,
    isHost: false,
    isReady: true,
    connected: true,
    isBot: true,
  }));
}
