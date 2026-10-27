import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';
import { useAuthStore } from '@/shared/model/auth';

// api/client.ts, shared/model/room.ts와 동일한 Android 에뮬레이터 호스트 대체 패턴
const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace('localhost', DEV_HOST);

export function useGifDownload() {
  const saveGif = async (sheetId: string): Promise<void> => {
    const token = useAuthStore.getState().accessToken;

    const { status } = await MediaLibrary.requestPermissionsAsync(true);
    if (status !== 'granted') {
      throw new Error('MEDIA_PERMISSION_DENIED');
    }

    const localUri = `${FileSystem.cacheDirectory}sketch-catch-${Date.now()}.gif`;
    // 서버가 저장 요청 때 GIF를 만들기 때문에 응답까지 수 초가 걸릴 수 있다
    const { uri, status: httpStatus } = await FileSystem.downloadAsync(`${BASE_URL}/replays/${sheetId}/gif`, localUri, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // 실패 응답(만료·권한 없음)의 JSON 본문이 .gif로 갤러리에 들어가지 않게 막는다
    if (httpStatus !== 200) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
      throw new Error(`GIF_DOWNLOAD_FAILED_${httpStatus}`);
    }

    await MediaLibrary.createAssetAsync(uri);
  };

  return { saveGif };
}
