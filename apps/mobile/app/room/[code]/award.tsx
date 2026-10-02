import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from 'dripsy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CLIENT_EVENT } from '@sketch-catch/shared';
import { useGameStore } from '@/features/game/model/useGameStore';
import { useChatSender } from '@/features/game/api/useChatSender';
import { useRoomStore } from '@/shared/model/room';
import { PodiumSlot, ChatStream, ChatInputBar } from '@/features/game/ui';
import { AudienceCheer } from '@/features/game/ui/AudienceCheer';
import { Button } from '@/shared/ui/Button';
import { colors, spacing, textSizes, fontFamily } from '@/shared/config';

export default function AwardScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { width } = useWindowDimensions();
  const socket = useRoomStore((s) => s.socket);
  const result = useGameStore((s) => s.result);
  const chatMessages = useGameStore((s) => s.chatMessages);
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
  // 4위 이하 — 인원이 4명 이상일 때만 방청석 연출로 노출
  const restRanking = ranking.length >= 4 ? ranking.filter((r) => r.rank >= 4) : [];
  const audiencePlayers = useMemo(
    () => restRanking.map((item) => ({ ...toPodiumPlayer(item), rank: item.rank })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [restRanking, players],
  );

  // 채팅 스트림 — 게임 진행 중과 동일하게 우상단에 말풍선으로 표시 (정답 판정 없는 자유 채팅)
  const streamItems = useMemo(
    () =>
      chatMessages.slice(-5).map((m) => ({
        id: m.id,
        nickname: m.nickname,
        text: m.text,
        characterId: characterMap[m.userId] ?? '',
        isCorrect: false,
        createdAt: m.createdAt,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chatMessages, players],
  );

  // 시상대 baseCardWidth: 화면 너비를 3등분에서 약간 여유 있게
  const baseCardWidth = Math.floor(width / 4.5);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* 타이틀 + 나가기 */}
      <View
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.MD,
          paddingTop: spacing.MD,
        }}
      >
        <Text style={styles.title} sx={{ color: colors.LIGHT_100 }}>
          게임 종료
        </Text>
        <Button
          label="나가기"
          color="primary"
          height={32}
          onPress={() => router.replace('/(tabs)')}
        />
      </View>

      {/* 자동 종료 안내 — 나가기 버튼과 분리된 별도 자리에서 알림만 한다 */}
      <Text sx={{ ...textSizes.B4, color: colors.GRAY, textAlign: 'center', paddingTop: spacing.XS }}>
        {countdown}초 후 자동으로 나가져요
      </Text>

      {/* 인원 부족 조기 종료 안내 배너 (D-05, OFFL-03) */}
      {result?.endReason === 'INSUFFICIENT_PLAYERS' && (
        <Text sx={{ ...textSizes.B3, color: colors.GRAY, textAlign: 'center', paddingTop: spacing.XS }}>
          인원이 부족해 조기 종료되었어요
        </Text>
      )}

      {/* 시상대 + 방청석 + 채팅 말풍선 */}
      <View sx={{ flex: 1, position: 'relative' }}>
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

        {/* 4위 이하 — 응원봉 흔드는 방청석 연출 */}
        <AudienceCheer players={audiencePlayers} />

        {/* 채팅 말풍선 — 게임 진행 화면과 동일하게 우상단에 겹쳐 표시 */}
        <ChatStream items={streamItems} />
      </View>

      {/* 하단바 — 게임 진행 때와 동일한 채팅 입력창 (자동 종료 안내/나가기 버튼은 두지 않는다) */}
      <KeyboardAvoidingView behavior="padding">
        <ChatInputBar isDrawer={false} onSend={sendChat} placeholder="채팅을 입력하세요" />
      </KeyboardAvoidingView>
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
  },
});
