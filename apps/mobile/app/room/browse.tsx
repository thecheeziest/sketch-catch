import { FeedbackPressable } from '@/shared/ui/FeedbackPressable';
import { FriendPasswordModal } from '@/features/friends/ui';
import { useJoinRoom, useRoomList } from '@/features/room/api';
import { getRoomBlockReason } from '@/features/room/lib';
import { RoomListCard } from '@/features/room/ui';
import { colors, spacing } from '@/shared/config';
import { handleApiError, usePullToRefresh } from '@/shared/lib';
import { useToastStore } from '@/shared/model';
import { Badge, Button, FlatList, Icon, PullRefreshIndicator, SketchbookLoadingSpinner } from '@/shared/ui';
import { Text, View } from 'dripsy';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RoomListItem } from '@sketch-catch/shared';

export default function RoomBrowseScreen() {
  const router = useRouter();
  const [passwordRoomCode, setPasswordRoomCode] = useState<string | null>(null);

  const roomsQuery = useRoomList();
  const rooms = roomsQuery.data ?? [];
  const { refetch } = roomsQuery;
  const refresh = usePullToRefresh(useCallback(() => refetch(), [refetch]));
  const joinRoom = useJoinRoom();

  const handlePress = (room: RoomListItem): void => {
    const blockReason = getRoomBlockReason(room);
    if (blockReason) {
      useToastStore.getState().show(blockReason);
      return;
    }
    if (room.hasPassword) {
      setPasswordRoomCode(room.code);
      return;
    }
    joinRoom.mutate(
      { code: room.code },
      {
        onError: err => {
          handleApiError(err, {
            fallbackType: 'toast',
            fallbackMessage: '방 입장에 실패했어요. 다시 시도해 주세요!',
            overrides: {
              ROOM_NOT_FOUND: { type: 'toast', message: '이미 사라진 방이에요!' },
              ROOM_FULL: { type: 'toast', message: '방이 꽉 찼어요! 다른 방을 찾아볼까요?' },
              ROOM_LOCKED: { type: 'toast', message: '초대로만 들어갈 수 있는 방이에요!' },
            },
          });
          // 목록을 본 사이 방 상태가 바뀐 경우이므로 최신 목록으로 맞춘다
          void refetch();
        },
      },
    );
  };

  // 첫 로딩 중에는 빈 상태 문구 대신 스피너 — 로딩이 끝나고 0개일 때만 안내
  const emptyContent = (() => {
    if (roomsQuery.isLoading) {
      return <SketchbookLoadingSpinner size={160} accessibilityLabel="방 목록 불러오는 중" />;
    }
    if (roomsQuery.isError) {
      return (
        <Text sx={{ color: colors.LIGHT_500, textAlign: 'center' }}>
          {'방 목록을 불러오지 못했어요.\n아래로 당겨 다시 시도해 주세요!'}
        </Text>
      );
    }
    return (
      <>
        <Text sx={{ color: colors.LIGHT_500, textAlign: 'center' }}>
          {'지금 열린 방이 없어요.\n직접 방을 만들어 볼까요?'}
        </Text>
        <Button label="방 만들기" color="primary" onPress={() => router.replace('/room/create')} />
      </>
    );
  })();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.DARK_200 }} edges={['top', 'bottom']}>
      <View
        sx={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.MD, paddingVertical: spacing.SM }}
      >
        <FeedbackPressable feedback="cancel" onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Icon name="BACK" size={24} />
        </FeedbackPressable>
        <Text variant="T2" sx={{ flex: 1, textAlign: 'center', color: colors.LIGHT_100 }}>
          방 찾기
        </Text>
        <View sx={{ width: 32 }} />
      </View>

      <View sx={{ flex: 1 }}>
        <PullRefreshIndicator refreshing={refresh.refreshing} pullProgress={refresh.pullProgress} />
        <FlatList
          data={rooms}
          keyExtractor={item => item.code}
          renderItem={({ item }) => (
            <RoomListCard
              room={item}
              onPress={() => handlePress(item)}
              extraChips={item.penalty && <Badge label="벌칙" color={colors.WARNING_300} />}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={refresh.refreshControl}
          onScroll={refresh.onScroll}
          scrollEventThrottle={16}
          ListEmptyComponent={
            <View sx={{ alignItems: 'center', gap: spacing.LG, paddingTop: 48 }}>{emptyContent}</View>
          }
        />
      </View>

      <FriendPasswordModal
        visible={passwordRoomCode !== null}
        onClose={() => setPasswordRoomCode(null)}
        roomCode={passwordRoomCode ?? ''}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backBtn: { padding: spacing.XS },
  listContent: { paddingTop: spacing.SM, paddingBottom: spacing.XL, gap: spacing.MD, flexGrow: 1 },
});
