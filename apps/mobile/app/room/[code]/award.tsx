import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from 'dripsy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CLIENT_EVENT } from '@sketch-catch/shared';
import { useGameStore } from '@/features/game/model/useGameStore';
import { useRoomStore } from '@/shared/model/room';
import { useChatSender } from '@/features/game/api/useChatSender';
import { PodiumSlot } from '@/features/game/ui';
import { ChatInputBar } from '@/features/game/ui/ChatInputBar';
import { FlatList } from '@/shared/ui';
import { Button } from '@/shared/ui/Button';
import { colors, spacing, textSizes, fontFamily } from '@/shared/config';

export default function AwardScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { width } = useWindowDimensions();
  const socket = useRoomStore((s) => s.socket);
  const result = useGameStore((s) => s.result);
  const roomState = useRoomStore((s) => s.roomState);
  const { sendChat } = useChatSender();

  const [countdown, setCountdown] = useState(30);

  // 소켓 연결 후 방 재입장
  useEffect(() => {
    if (!socket || !code) return;
    const handleConnect = (): void => {
      socket.emit(CLIENT_EVENT.ROOM_JOIN, { code });
    };
    socket.on('connect', handleConnect);
    if (socket.connected) handleConnect();
    return () => {
      socket.off('connect', handleConnect);
    };
  }, [socket, code]);

  // 30초 자동 종료 (AWRD-03)
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          router.replace('/(tabs)');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const ranking = result?.ranking ?? [];
  const players = roomState?.players ?? [];

  // userId → characterId 맵
  const characterMap = Object.fromEntries(
    players.map((p) => [p.id, p.characterId])
  );

  // ranking 항목을 PodiumPlayer 형태로 변환 — 중도 퇴장 여부(left)도 함께 전달
  const toPodiumPlayer = (item: { userId: string; rank: number; score: number }) => ({
    userId: item.userId,
    nickname: players.find((p) => p.id === item.userId)?.nickname ?? item.userId,
    characterId: characterMap[item.userId] ?? 'cat',
    score: item.score,
    left: players.find((p) => p.id === item.userId)?.left === true,
  });

  const rank1 = ranking.find((r) => r.rank === 1);
  const rank2 = ranking.find((r) => r.rank === 2);
  const rank3 = ranking.find((r) => r.rank === 3);
  // 4위 이하 목록
  const restRanking = ranking.filter((r) => r.rank >= 4);

  // 시상대 baseCardWidth: 화면 너비를 3등분에서 약간 여유 있게
  const baseCardWidth = Math.floor(width / 4.5);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* 타이틀 */}
      <Text
        style={styles.title}
        sx={{ color: colors.LIGHT_100, textAlign: 'center' }}
      >
        게임 종료
      </Text>

      {/* 인원 부족 조기 종료 안내 배너 (D-05, OFFL-03) */}
      {result?.endReason === 'INSUFFICIENT_PLAYERS' && (
        <Text sx={{ ...textSizes.B3, color: colors.GRAY, textAlign: 'center', paddingBottom: spacing.XS }}>
          인원이 부족해 조기 종료되었어요
        </Text>
      )}

      {/* 시상대 — 2위(왼쪽 하단), 1위(가운데 상단), 3위(오른쪽 최하단) */}
      <View
        sx={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'center',
          paddingHorizontal: spacing.MD,
          paddingBottom: spacing.MD,
          gap: spacing.XS,
        }}
      >
        {rank2 != null ? (
          <PodiumSlot rank={2} player={toPodiumPlayer(rank2)} baseCardWidth={baseCardWidth} />
        ) : (
          <View sx={{ width: Math.round(baseCardWidth * 1.1) }} />
        )}
        {rank1 != null && (
          <PodiumSlot rank={1} player={toPodiumPlayer(rank1)} baseCardWidth={baseCardWidth} />
        )}
        {rank3 != null ? (
          <PodiumSlot rank={3} player={toPodiumPlayer(rank3)} baseCardWidth={baseCardWidth} />
        ) : (
          <View sx={{ width: Math.round(baseCardWidth * 0.9) }} />
        )}
      </View>

      {/* 4위 이하 점수 목록 */}
      {restRanking.length > 0 && (
        <FlatList
          data={restRanking}
          keyExtractor={(item) => item.userId}
          style={styles.scoreList}
          renderItem={({ item }) => {
            const player = toPodiumPlayer(item);
            return (
              <View
                sx={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingHorizontal: spacing.MD,
                  paddingVertical: spacing.XS,
                }}
              >
                <Text
                  sx={{ ...textSizes.B1, color: player.left ? colors.GRAY : colors.LIGHT_100 }}
                  style={player.left ? { textDecorationLine: 'line-through' } : undefined}
                >
                  {item.rank}위 {player.nickname}{player.left ? ' (나감)' : ''}
                </Text>
                <Text sx={{ ...textSizes.B1, color: player.left ? colors.GRAY : colors.ACCENT_300 }}>
                  {item.score}점
                </Text>
              </View>
            );
          }}
        />
      )}

      {/* 소감 채팅 (AWRD-03) */}
      <ChatInputBar isDrawer={false} onSend={sendChat} />

      {/* Footer: 자동 종료 타이머 + 나가기 버튼 */}
      <View
        sx={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: spacing.MD,
          paddingVertical: spacing.SM,
          backgroundColor: colors.DARK_300,
        }}
      >
        <Text sx={{ ...textSizes.B3, color: colors.GRAY }}>
          {countdown}초 후 자동 종료
        </Text>
        <Button
          label="나가기"
          color="primary"
          height={36}
          onPress={() => router.replace('/(tabs)')}
        />
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
  scoreList: {
    maxHeight: 160,
  },
});
