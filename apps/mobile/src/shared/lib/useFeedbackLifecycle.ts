import { useEffect } from 'react';
import { initializeFeedback } from './feedback';

export function useFeedbackLifecycle(): void {
  useEffect(() => initializeFeedback(), []);
}
