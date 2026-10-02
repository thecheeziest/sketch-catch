import { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from 'dripsy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CLIENT_EVENT } from '@sketch-catch/shared';
import { useAuthStore, useRoomStore, useToastStore } from '@/shared/model';
import { useMode2Store, useGifDownload, SheetGifTabs, SaveGifButton } from '@/features/mode2';
import type { SheetGifTabItem } from '@/features/mode2/ui/SheetGifTabs';
import { GifPreviewPlayer, PixelFrame, Button } from '@/shared/ui';
import { colors, spacing, textSizes, fontFamily } from '@/shared/config';

// api/client.ts, shared/model/room.ts와 동일한 Android 에뮬레이터 호스트 대체 패턴
const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace('localhost', DEV_HOST);

export default function Mode2EndScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const socket = useRoomStore((s) => s.socket);
  const roomState = useRoomStore((s) => s.roomState);
  const review = useMode2Store((s) => s.review);
  const gifs = useMode2Store((s) => s.gifs);
  const accessToken = useAuthStore((s) => s.accessToken);
  const { saveGif } = useGifDownload();

  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  // 소켓 재연결 시 방 재입장 + cookie:ready 계속 수신 위한 리스너 재등록 안전장치
  useEffect(() => {
    if (!socket || !code) return;
    const handleConnect = (): void => {
      socket.emit(CLIENT_EVENT.ROOM_JOIN, { code });
    };
    socket.on('connect', handleConnect);
    if (socket.connected) handleConnect();
    useMode2Store.getState().registerMode2Listeners();
    return () => {
      socket.off('connect', handleConnect);
    };
  }, [socket, code]);

  const sheets: SheetGifTabItem[] = useMemo(
    () =>
      (review?.sheets ?? []).map((sheet, index) => {
        const owner = roomState?.players.find((p) => p.id === sheet.ownerId);
        return {
          sheetId: sheet.sheetId,
          nickname: owner?.nickname ?? '',
          characterId: owner?.characterId ?? '',
          label: `${index + 1}번째 시트`,
        };
      }),
    [review, roomState]
  );

  useEffect(() => {
    if (selectedSheetId === null && sheets.length > 0) {
      setSelectedSheetId(sheets[0]!.sheetId);
    }
  }, [sheets, selectedSheetId]);

  const gifUrl = selectedSheetId !== null ? gifs[selectedSheetId] : undefined;
  const isReady = gifUrl != null;

  const handleSave = async (): Promise<void> => {
    if (selectedSheetId === null) return;
    try {
      await saveGif(selectedSheetId);
      setSaveFailed(false);
      useToastStore.getState().show('저장 완료! 갤러리에서 확인하세요');
    } catch {
      setSaveFailed(true);
      useToastStore.getState().show('저장에 실패했어요. 사진 접근 권한을 확인해주세요');
    }
  };

  const handleExit = (): void => {
    socket?.emit(CLIENT_EVENT.ROOM_LEAVE);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Text style={styles.title} sx={{ color: colors.LIGHT_100, textAlign: 'center' }}>
        게임 종료
      </Text>

      <SheetGifTabs sheets={sheets} selectedId={selectedSheetId} onSelect={setSelectedSheetId} />

      <View sx={{ flex: 1, paddingHorizontal: spacing.MD, paddingVertical: spacing.SM }}>
        <PixelFrame borderColor={colors.SECONDARY_300} style={StyleSheet.absoluteFill}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.DARK_300 }]} />
          {isReady && gifUrl != null ? (
            <GifPreviewPlayer
              uri={`${BASE_URL}${gifUrl}`}
              headers={accessToken != null ? { Authorization: `Bearer ${accessToken}` } : undefined}
              style={{ flex: 1 }}
            />
          ) : (
            <View sx={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text sx={{ ...textSizes.B1, color: colors.GRAY }}>GIF를 만들고 있어요...</Text>
            </View>
          )}
        </PixelFrame>
      </View>

      <View sx={{ paddingHorizontal: spacing.MD, paddingBottom: spacing.SM, gap: spacing.SM }}>
        <SaveGifButton ready={isReady} onSave={handleSave} />
        {saveFailed && (
          <Button label="설정으로 이동" color="light" height={36} onPress={() => Linking.openSettings()} />
        )}
      </View>

      <View
        sx={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          paddingHorizontal: spacing.MD,
          paddingVertical: spacing.SM,
          backgroundColor: colors.DARK_300,
        }}
      >
        <Button label="나가기" color="light" height={36} onPress={handleExit} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.DARK_200,
  },
  title: {
    fontFamily: fontFamily.REGULAR,
    ...textSizes.T1,
    paddingTop: spacing.MD,
    paddingBottom: spacing.SM,
  },
});
