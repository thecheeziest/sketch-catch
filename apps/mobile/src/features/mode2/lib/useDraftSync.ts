import { useCallback, useEffect, useRef } from 'react';
import { type Mode2Draft, useMode2Sender } from '@/features/mode2/api/useMode2Sender';

// 입력·획이 멈춘 뒤 이 시간 후에 초안을 보낸다 — 서버 마감 여유(MODE2_SUBMIT_GRACE_MS)보다 짧아야 마지막 입력도 반영된다
const DRAFT_DEBOUNCE_MS = 400;

// 작성 중인 내용을 서버에 초안으로 동기화한다. 시간 초과 시 서버가 이 초안으로 자동 제출한다.
export function useDraftSync(sheetId: string | undefined, stepKey: string) {
  const { syncDraft } = useMode2Sender();
  const syncRef = useRef(syncDraft);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    syncRef.current = syncDraft;
  });

  // 단계가 바뀌면 이전 단계의 대기 중 초안은 버린다
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    },
    [stepKey],
  );

  return useCallback(
    (draft: Mode2Draft): void => {
      if (!sheetId) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        syncRef.current(sheetId, draft);
      }, DRAFT_DEBOUNCE_MS);
    },
    [sheetId],
  );
}
