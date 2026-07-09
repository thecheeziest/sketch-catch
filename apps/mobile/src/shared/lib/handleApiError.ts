import { ApiError } from '@/shared/api';
import { useToastStore } from '@/shared/model';

type ErrorAction =
  | { type: 'setError'; message: string }
  | { type: 'toast'; message: string }
  | { type: 'toastAndClose'; message: string };

export const ERROR_HANDLERS: Record<string, ErrorAction> = {
  NICKNAME_CHANGE_COOLDOWN: { type: 'toastAndClose', message: '30일 이내 변경 불가' },
  NICKNAME_CODE_CONFLICT: { type: 'setError', message: '이미 사용 중인 닉네임+코드 조합이에요. 코드를 바꿔보세요.' },
  INVALID_FORMAT: { type: 'setError', message: '닉네임#코드 형식을 확인해주세요 (예: 스케치#AB12C)' },
  USER_NOT_FOUND: { type: 'setError', message: '사용자를 찾을 수 없어요. 닉네임과 코드를 확인해주세요.' },
  ALREADY_FRIENDS: { type: 'setError', message: '이미 친구인 사용자예요.' },
  REQUEST_ALREADY_SENT: { type: 'setError', message: '이미 친구 요청을 보낸 상태예요.' },
  SELF_REQUEST: { type: 'setError', message: '자기 자신에게 요청을 보낼 수 없어요.' },
  ROOM_NOT_FOUND: { type: 'setError', message: '방을 찾을 수 없습니다. 코드를 다시 확인하세요.' },
  INVALID_CODE: { type: 'setError', message: '방을 찾을 수 없습니다. 코드를 다시 확인하세요.' },
  ROOM_FULL: { type: 'setError', message: '방이 가득 찼습니다.' },
  ROOM_LOCKED: { type: 'setError', message: '잠긴 방입니다.' },
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
    fallbackMessage = '연결에 실패했어요. 잠시 후 다시 시도해주세요.',
    fallbackType,
    overrides,
  } = options;

  const useFallbackToast = fallbackType === 'toast' || (!fallbackType && !setError);

  if (!(err instanceof ApiError)) {
    if (useFallbackToast) useToastStore.getState().show(fallbackMessage);
    else setError?.(fallbackMessage);
    return;
  }

  const action = overrides?.[err.code] ?? ERROR_HANDLERS[err.code];

  if (!action) {
    if (useFallbackToast) useToastStore.getState().show(err.message || fallbackMessage);
    else setError?.(err.message || fallbackMessage);
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
