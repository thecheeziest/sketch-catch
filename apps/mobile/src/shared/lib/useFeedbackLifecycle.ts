import { useEffect } from 'react';
import { initializeFeedback } from './tvFeedback';

export function useFeedbackLifecycle(): void {
  useEffect(() => initializeFeedback(), []);
}
