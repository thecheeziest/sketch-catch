import { ApiError } from '@/shared/api';
import { useToastStore } from '@/shared/model';
import { DEFAULT_ERROR_MESSAGE, getErrorMessage } from './getErrorMessage';

type ErrorAction =
  | { type: 'setError'; message: string }
  | { type: 'toast'; message: string }
  | { type: 'toastAndClose'; message: string };

export const ERROR_HANDLERS: Record<string, ErrorAction> = {
  NICKNAME_CHANGE_COOLDOWN: { type: 'toastAndClose', message: '닉네임은 30일에 한 번만 바꿀 수 있어요!' },
  NICKNAME_CODE_CONFLICT: { type: 'setError', message: '앗, 누군가 먼저 쓰고 있는 조합이에요! 해시태그를 살짝 바꿔 볼까요?' },
  INVALID_FORMAT: { type: 'setError', message: '닉네임#해시태그 형식으로 적어 주세요! (예: 스케치#AB12C)' },
  USER_NOT_FOUND: { type: 'setError', message: '친구를 찾지 못했어요. 닉네임과 해시태그를 한 번 더 확인해 주세요!' },
  ALREADY_FRIENDS: { type: 'setError', message: '이미 친구 사이예요!' },
  REQUEST_ALREADY_SENT: { type: 'setError', message: '이미 친구 요청을 보냈어요! 답장을 기다려 볼까요?' },
  SELF_REQUEST: { type: 'setError', message: '나에게는 친구 요청을 보낼 수 없어요!' },
  ROOM_NOT_FOUND: { type: 'setError', message: '방을 찾지 못했어요! 코드를 확인해 주세요' },
  INVALID_CODE: { type: 'setError', message: '방을 찾지 못했어요! 코드를 확인해 주세요' },
  ROOM_FULL: { type: 'setError', message: '방이 꽉 찼어요! 다른 방을 찾아볼까요?' },
  ROOM_LOCKED: { type: 'setError', message: '잠겨 있는 방이에요!' },
  GAME_IN_PROGRESS: { type: 'toast', message: '이미 게임이 한창이에요!' },
  TARGET_BUSY: { type: 'toast', message: '친구가 다른 방에서 놀고 있어요!' },
  INVITE_COOLDOWN: { type: 'toast', message: '방금 초대했어요! 잠시 후 다시 보낼 수 있어요' },
  NOT_FRIENDS: { type: 'toast', message: '친구에게만 초대를 보낼 수 있어요!' },
  NOT_IN_ROOM: { type: 'toast', message: '방에 들어와 있을 때만 초대할 수 있어요!' },
  INSUFFICIENT_COINS: { type: 'toast', message: '코인이 부족해요! 게임하고 모아 볼까요?' },
  ALREADY_OWNED: { type: 'toast', message: '이미 가지고 있는 아이템이에요!' },
  ITEM_NOT_OWNED: { type: 'toast', message: '아직 가지고 있지 않은 아이템이에요!' },
  ITEM_NOT_FOUND: { type: 'toast', message: '지금은 살 수 없는 아이템이에요!' },
};

type HandleApiErrorOptions = {
  setError?: (msg: string) => void;
  onClose?: () => void;
  fallbackMessage?: string;
  /** unknown 에러 코드 처리 방식. 기본: setError가 있으면 'setError', 없으면 'toast' */
  fallbackType?: 'setError' | 'toast';
  overrides?: Partial<Record<string, ErrorAction>>;
};

export function handleApiError(err: unknown, options: HandleApiErrorOptions = {}): void {
  const {
    setError,
    onClose,
    fallbackMessage = DEFAULT_ERROR_MESSAGE,
    fallbackType,
    overrides,
  } = options;

  const useFallbackToast = fallbackType === 'toast' || (!fallbackType && !setError);

  const action = err instanceof ApiError ? (overrides?.[err.code] ?? ERROR_HANDLERS[err.code]) : undefined;

  if (!action) {
    const message = getErrorMessage(err, { fallback: fallbackMessage });
    if (useFallbackToast) useToastStore.getState().show(message, 'error');
    else setError?.(message);
    return;
  }

  if (action.type === 'setError') {
    setError?.(action.message);
  } else if (action.type === 'toast') {
    useToastStore.getState().show(action.message, 'error');
  } else if (action.type === 'toastAndClose') {
    useToastStore.getState().show(action.message, 'error');
    onClose?.();
  }
}
