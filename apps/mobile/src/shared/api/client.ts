import { Platform } from 'react-native';
import { useAuthStore, useToastStore } from '@/shared/model';

const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace('localhost', DEV_HOST) ?? `http://${DEV_HOST}:3000`;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public payload?: unknown
  ) {
    super(`ApiError ${status}: ${code}`);
    this.name = 'ApiError';
  }
}

/**
 * 내부 fetch wrapper.
 * - Authorization Bearer 헤더 자동 부착
 * - 401 수신 시 refresh 토큰으로 재시도 (1회)
 * - SESSION_REPLACED 오류면 D-06 토스트 + clearAuth
 */
async function request<T>(url: string, init?: RequestInit, retryAttempt = 0): Promise<T> {
  const { accessToken, refreshToken, setTokens, clearAuth } = useAuthStore.getState();

  const res = await fetch(`${BASE_URL}${url}`, {
    ...init,
    headers: {
      ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  });

  if (res.status === 401 && retryAttempt === 0) {
    if (refreshToken) {
      const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
        headers: { 'Content-Type': 'application/json' },
      });

      if (refreshRes.ok) {
        const data = (await refreshRes.json()) as { accessToken: string };
        await setTokens({ accessToken: data.accessToken });
        // 재시도 (1회 한도 — retryAttempt=1)
        return request<T>(url, init, 1);
      }

      // refresh 실패 — 에러 코드 확인
      const errorBody = await refreshRes.json().catch(() => ({}));
      if ((errorBody as { error?: string }).error === 'SESSION_REPLACED') {
        // D-06: 다른 기기 로그인 토스트
        useToastStore.getState().show('다른 기기에서 로그인되었습니다');
      }
    }

    await clearAuth();
    throw new ApiError(401, 'SESSION_EXPIRED');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'UNKNOWN_ERROR' }));
    const errorBody = body as { error?: string };
    throw new ApiError(res.status, errorBody.error ?? 'UNKNOWN_ERROR', body);
  }

  // 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export function apiGet<T>(url: string, init?: Omit<RequestInit, 'method' | 'body'>): Promise<T> {
  return request<T>(url, { ...init, method: 'GET' });
}

export function apiPost<T>(url: string, body?: unknown): Promise<T> {
  return request<T>(url, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  return request<T>(url, {
    method: 'PATCH',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiDelete(url: string): Promise<void> {
  return request<void>(url, { method: 'DELETE' });
}
