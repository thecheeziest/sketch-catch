import { ApiError } from '@/shared/api';
import { getErrorMessage } from '@/shared/lib/getErrorMessage';

export function getAppleMigrationErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'MIGRATION_CODE_INVALID':
        return '코드가 만료되었거나 이미 사용됐어요. 기존 앱에서 새 코드를 받아주세요.';
      case 'MIGRATION_IDENTITY_IN_USE':
        return '이 Apple 계정에 이미 다른 게임 계정이 있어요. 기존 데이터는 유지되니 문의해주세요.';
      case 'MIGRATION_ACCOUNT_MISMATCH':
      case 'MIGRATION_PROOF_FAILED':
        return '현재 게임 계정에 사용한 Apple 계정으로 다시 확인해주세요.';
      case 'MIGRATION_SOURCE_REQUIRED':
        return '이전 코드는 기존 스케치캐치 앱에서 발급할 수 있어요.';
      case 'MIGRATION_TARGET_REQUIRED':
        return '새 스케치캐치 앱에서 이전 코드를 입력해주세요.';
      case 'MIGRATION_RATE_LIMITED':
        return '잠시 후 다시 코드를 발급해주세요. 재발급은 30초마다 가능해요.';
      case 'MIGRATION_UNAVAILABLE':
        return '계정 이전을 준비 중이에요. 잠시 후 다시 시도해주세요.';
    }
  }
  return getErrorMessage(error, { fallback: '계정을 연결하지 못했어요. 다시 시도해주세요.' });
}
