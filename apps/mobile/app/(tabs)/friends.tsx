import { useFriendRequests, useFriends, useRespondRequest, useSentFriendRequests } from '@/features/friends/api';
import { AddFriendModal, DeleteFriendModal, FriendPasswordModal } from '@/features/friends/ui';
import { useJoinRoom } from '@/features/room/api';
import { colors } from '@/shared/config';
import { handleApiError } from '@/shared/lib';
import { usePresenceStore, useToastStore } from '@/shared/model';
import type { FriendRoom } from '@/shared/model';
import { FlatList, FriendItem, Icon, ProfileHeader, RequestItem, SegmentedTab } from '@/shared/ui';
import { useQueryClient } from '@tanstack/react-query';
import mainBackground from '@assets/main-background.png';
import { Text, View } from 'dripsy';
import { BlurView } from 'expo-blur';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ImageBackground, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type DeleteTarget = {
  friendshipId: string;
  userId: string;
  nickname: string;
};

type JoinTarget = {
  room: FriendRoom;
};

export default function FriendsScreen() {
  const [activeTab, setActiveTab] = useState<0 | 1>(0);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [joinTarget, setJoinTarget] = useState<JoinTarget | null>(null);

  const queryClient = useQueryClient();
  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: ['friends'] });
    }, [queryClient])
  );

  const { data: friends = [] } = useFriends();
  const { data: requests = [] } = useFriendRequests();
  const { data: sentRequests = [] } = useSentFriendRequests();

  // 친구 목록이 갱신될 때마다 presence 구독 대상 동기화
  useEffect(() => {
    const ids = friends.map((f) => f.userId);
    if (ids.length > 0) usePresenceStore.getState().subscribe(ids);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friends.map((f) => f.userId).join(',')]);
  const respondRequest = useRespondRequest();
  const joinRoom = useJoinRoom();

  const handleJoinPress = (room: FriendRoom): void => {
    if (room.hasPassword) {
      setJoinTarget({ room });
    } else {
      joinRoom.mutate(
        { code: room.code },
        {
          onError: (err) => handleApiError(err, {
            fallbackType: 'toast',
            fallbackMessage: '방 입장에 실패했습니다.',
            overrides: {
              ROOM_FULL: { type: 'toast', message: '방이 꽉 찼어요 T.T' },
              ROOM_LOCKED: { type: 'toast', message: '비밀번호가 필요한 방이에요.' },
            },
          }),
        },
      );
    }
  };

  return (
    <ImageBackground source={mainBackground} style={{ flex: 1 }} resizeMode="cover">
      <SafeAreaView style={{ flex: 1 }} edges={['bottom', 'left', 'right']}>
        <ProfileHeader
          rightSlot={
            <Pressable
              onPress={() => setAddModalOpen(true)}
              style={({ pressed }) => [
                { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Icon name="ADD_FRIEND" size={30} />
            </Pressable>
          }
        />

        <SegmentedTab
          tabs={['내 친구', '요청']}
          activeIndex={activeTab}
          onTabPress={index => setActiveTab(index as 0 | 1)}
          badges={[undefined, requests.length || undefined]}
        />

        {activeTab === 0 && (
          <View style={{ flex: 1 }}>
            <BlurView intensity={50} tint="light" style={StyleSheet.absoluteFillObject} />
            <FlatList
              data={friends}
              keyExtractor={item => item.friendshipId}
              contentContainerStyle={{ paddingBottom: 56 }}
              renderItem={({ item, index }) => (
                <FriendItem
                  friend={item}
                  index={index}
                  onLongPress={() =>
                    setDeleteTarget({
                      friendshipId: item.friendshipId,
                      userId: item.userId,
                      nickname: item.nickname,
                    })
                  }
                  onJoin={item.room?.joinable ? () => handleJoinPress(item.room!) : undefined}
                />
              )}
              ListEmptyComponent={
                <View sx={{ flex: 1, alignItems: 'center', paddingTop: 48 }}>
                  <Text sx={{ color: colors.PRIMARY_100, textAlign: 'center' }}>
                    {'아직 친구가 없어요.\n우상단 버튼으로 친구를 추가해보세요!'}
                  </Text>
                </View>
              }
            />
          </View>
        )}

        {activeTab === 1 && (
          <View style={{ flex: 1 }}>
            <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFillObject} />
            <FlatList
              data={requests}
              keyExtractor={item => `recv-${item.id}`}
              contentContainerStyle={{ paddingBottom: 56 }}
              renderItem={({ item }) => (
                <RequestItem
                  request={item}
                  onAccept={() =>
                    respondRequest.mutate(
                      { requestId: item.id, action: 'ACCEPT' },
                      {
                        onSuccess: () => useToastStore.getState().show(`${item.sender.nickname}님과 친구가 됐어요!`),
                        onError: () => useToastStore.getState().show('연결에 실패했어요. 잠시 후 다시 시도해주세요.'),
                      },
                    )
                  }
                  onReject={() =>
                    respondRequest.mutate(
                      { requestId: item.id, action: 'REJECT' },
                      {
                        onSuccess: () => useToastStore.getState().show('요청을 거절했어요'),
                        onError: () => useToastStore.getState().show('연결에 실패했어요. 잠시 후 다시 시도해주세요.'),
                      },
                    )
                  }
                  isLoading={respondRequest.isPending}
                />
              )}
              ListHeaderComponent={
                requests.length === 0 ? (
                  <View sx={{ alignItems: 'center', paddingTop: 48, paddingBottom: sentRequests.length > 0 ? 24 : 0 }}>
                    <Text sx={{ color: colors.PRIMARY_100 }}>받은 친구 요청이 없어요</Text>
                  </View>
                ) : null
              }
              ListFooterComponent={
                sentRequests.length > 0 ? (
                  <View sx={{ marginTop: 24 }}>
                    <Text sx={{ color: colors.LIGHT_500, paddingHorizontal: 16, paddingBottom: 8 }}>보낸 요청</Text>
                    {sentRequests.map(item => (
                      <View
                        key={`sent-${item.id}`}
                        sx={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          height: 64,
                          paddingHorizontal: 16,
                          gap: 12,
                        }}
                      >
                        <Text variant="B4" sx={{ flex: 1, color: colors.DARK_100 }}>
                          {item.receiver.nickname}#{item.receiver.friendCode}
                        </Text>
                        <Text sx={{ color: colors.LIGHT_500 }}>대기 중</Text>
                      </View>
                    ))}
                  </View>
                ) : null
              }
            />
          </View>
        )}

        <AddFriendModal visible={addModalOpen} onClose={() => setAddModalOpen(false)} />

        {deleteTarget !== null && (
          <DeleteFriendModal
            visible={true}
            onClose={() => setDeleteTarget(null)}
            friendNickname={deleteTarget.nickname}
            friendUserId={deleteTarget.userId}
          />
        )}

        {joinTarget !== null && (
          <FriendPasswordModal
            visible={true}
            onClose={() => setJoinTarget(null)}
            roomCode={joinTarget.room.code}
          />
        )}
      </SafeAreaView>
    </ImageBackground>
  );
}
