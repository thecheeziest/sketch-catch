import { ApiError } from '@/shared/api';
import { useToastStore } from '@/shared/model';
import { DEFAULT_ERROR_MESSAGE, getErrorMessage } from './getErrorMessage';

type ErrorAction =
  | { type: 'setError'; message: string }
  | { type: 'toast'; message: string }
  | { type: 'toastAndClose'; message: string };

export const ERROR_HANDLERS: Record<string, ErrorAction> = {
  NICKNAME_CHANGE_COOLDOWN: { type: 'toastAndClose', message: '30일 이내 변경 불가' },
  NICKNAME_CODE_CONFLICT: { type: 'setError', message: '이미 사용 중인 닉네임+해시태그 조합이에요. 해시태그를 바꿔보세요.' },
  INVALID_FORMAT: { type: 'setError', message: '닉네임#해시태그 형식을 확인해주세요 (예: 스케치#AB12C)' },
  USER_NOT_FOUND: { type: 'setError', message: '사용자를 찾을 수 없어요. 닉네임과 해시태그를 확인해주세요.' },
  ALREADY_FRIENDS: { type: 'setError', message: '이미 친구인 사용자예요.' },
  REQUEST_ALREADY_SENT: { type: 'setError', message: '이미 친구 요청을 보낸 상태예요.' },
  SELF_REQUEST: { type: 'setError', message: '자기 자신에게 요청을 보낼 수 없어요.' },
  ROOM_NOT_FOUND: { type: 'setError', message: '방을 찾을 수 없습니다. 코드를 다시 확인하세요.' },
  INVALID_CODE: { type: 'setError', message: '방을 찾을 수 없습니다. 코드를 다시 확인하세요.' },
  ROOM_FULL: { type: 'setError', message: '방이 가득 찼습니다.' },
  ROOM_LOCKED: { type: 'setError', message: '잠긴 방입니다.' },
  GAME_IN_PROGRESS: { type: 'toast', message: '이미 게임이 진행 중인 방이에요.' },
  TARGET_BUSY: { type: 'toast', message: '친구가 이미 다른 방에 있어요.' },
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
    if (useFallbackToast) useToastStore.getState().show(message);
    else setError?.(message);
    return;
  }

  if (action.type === 'setError') {
    setError?.(action.message);
  } else if (action.type === 'toast') {
    useToastStore.getState().show(action.message);
  } else if (action.type === 'toastAndClose') {
    useToastStore.getState().show(action.message);
    onClose?.();
  }
}
