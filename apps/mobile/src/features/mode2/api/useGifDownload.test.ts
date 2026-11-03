import { beforeEach, describe, expect, it, vi } from 'vitest';
const media = vi.hoisted(() => ({ permissions: vi.fn(), create: vi.fn() }));
const files = vi.hoisted(() => ({ download: vi.fn(), remove: vi.fn() }));
vi.mock('expo-media-library', () => ({ requestPermissionsAsync: media.permissions, Asset: { create: media.create } }));
vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  downloadAsync: files.download,
  deleteAsync: files.remove,
}));
vi.mock('@/shared/model/auth', () => ({ useAuthStore: { getState: () => ({ accessToken: 'test-token' }) } }));
import { useGifDownload } from './useGifDownload';

beforeEach(() => {
  vi.clearAllMocks();
  media.permissions.mockResolvedValue({ status: 'granted' });
  media.create.mockResolvedValue({ id: 'saved' });
  files.download.mockResolvedValue({ uri: 'file:///cache/replay.gif', status: 200 });
  files.remove.mockResolvedValue(undefined);
});
describe('GIF 갤러리 저장', () => {
  it('다운로드 후 SDK 57 Asset.create로 저장하고 임시 파일을 정리한다', async () => {
    await useGifDownload().saveGif('sheet');
    expect(media.create).toHaveBeenCalledWith('file:///cache/replay.gif');
    expect(files.remove).toHaveBeenCalledWith('file:///cache/replay.gif', { idempotent: true });
  });
  it('서버 오류 본문은 갤러리에 저장하지 않는다', async () => {
    files.download.mockResolvedValue({ uri: 'file:///cache/replay.gif', status: 403 });
    await expect(useGifDownload().saveGif('sheet')).rejects.toThrow('GIF_DOWNLOAD_FAILED_403');
    expect(media.create).not.toHaveBeenCalled();
    expect(files.remove).toHaveBeenCalledOnce();
  });
  it('권한 거절 시 다운로드하지 않고 설정 안내용 오류를 반환한다', async () => {
    media.permissions.mockResolvedValue({ status: 'denied' });
    await expect(useGifDownload().saveGif('sheet')).rejects.toThrow('MEDIA_PERMISSION_DENIED');
    expect(files.download).not.toHaveBeenCalled();
  });
  it('갤러리 저장 실패에도 임시 파일을 정리한다', async () => {
    media.create.mockRejectedValue(new Error('SAVE_FAILED'));
    await expect(useGifDownload().saveGif('sheet')).rejects.toThrow('SAVE_FAILED');
    expect(files.remove).toHaveBeenCalledOnce();
  });
});
