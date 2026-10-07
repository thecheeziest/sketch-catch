import { ApiError } from '@/shared/api';

export const DEFAULT_ERROR_MESSAGE = '연결에 실패했어요. 잠시 후 다시 시도해주세요.';
const SERVER_ERROR_MESSAGE = '서버에 문제가 생겼어요. 잠시 후 다시 시도해주세요.';
const NETWORK_ERROR_MESSAGE = '네트워크 연결을 확인한 뒤 다시 시도해주세요.';

type ErrorMessageOptions = {
  /** 원인을 특정할 수 없는 에러에 보여줄 문구 */
  fallback?: string;
  /** 서버 장애(5xx)에 보여줄 문구 — 화면 맥락(로그인 등)에 맞게 바꿔 쓴다 */
  serverMessage?: string;
};

/**
 * 에러를 사용자용 안내 문구로 변환한다.
 * 서버·SDK의 원문 메시지(`ApiError 502: UNKNOWN_ERROR` 등)는 사용자에게 노출하지 않는다.
 */
export function getErrorMessage(err: unknown, options: ErrorMessageOptions = {}): string {
  const { fallback = DEFAULT_ERROR_MESSAGE, serverMessage = SERVER_ERROR_MESSAGE } = options;

  if (err instanceof ApiError) {
    return err.status >= 500 ? serverMessage : fallback;
  }
  // RN fetch는 오프라인·DNS 실패 등 네트워크 오류를 TypeError로 던진다
  if (err instanceof TypeError) {
    return NETWORK_ERROR_MESSAGE;
  }
  return fallback;
}
