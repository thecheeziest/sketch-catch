import { playFeedback } from './feedback';

export { initializeFeedback } from './feedback';
export function playTvFeedback(transition: 'on' | 'off'): () => void {
  return playFeedback(transition === 'on' ? 'tvOn' : 'tvOff');
}
