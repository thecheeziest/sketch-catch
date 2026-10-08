import { ResultOverlay } from '../ResultOverlay';

export function PromptWaitingOverlay() {
  return <ResultOverlay data={{ kind: 'waiting', id: 'prompt-waiting' }} />;
}
