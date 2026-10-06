import { useFriendRequests, useFriends, useRespondRequest, useSentFriendRequests } from '@/features/friends/api';
import { AddFriendModal, DeleteFriendModal, FriendPasswordModal } from '@/features/friends/ui';
import { useJoinRoom } from '@/features/room/api';
import { colors } from '@/shared/config';
import { handleApiError, usePullToRefresh } from '@/shared/lib';
import { usePresenceStore, useToastStore } from '@/shared/model';
import type { FriendRoom } from '@/shared/model';
import {
  FlatList,
  FriendItem,
  Icon,
  ProfileHeader,
  PullRefreshIndicator,
  RequestItem,
  SegmentedTab,
  SketchbookLoadingSpinner,
} from '@/shared/ui';
import { useQueryClient } from '@tanstack/react-query';
import mainBackground from '@assets/main-background.png';
import { Text, View } from 'dripsy';
import { BlurTargetView, BlurView, type BlurTargetViewProps } from 'expo-blur';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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

type BlurTargetRef = NonNullable<BlurTargetViewProps['ref']>['current'];

// Android는 BlurTargetView로 감싼 대상만 블러 처리할 수 있다 (iOS는 기존처럼 뒤 화면을 블러)
const ANDROID_BLUR_METHOD = 'dimezisBlurViewSdk31Plus' as const;

export default function FriendsScreen() {
  const [activeTab, setActiveTab] = useState<0 | 1>(0);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [joinTarget, setJoinTarget] = useState<JoinTarget | null>(null);

  const queryClient = useQueryClient();
  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: ['friends'] });
    }, [queryClient]),
  );

  const friendsQuery = useFriends();
  const requestsQuery = useFriendRequests();
  const sentRequestsQuery = useSentFriendRequests();
  const friends = friendsQuery.data ?? [];
  const requests = requestsQuery.data ?? [];
  const sentRequests = sentRequestsQuery.data ?? [];
  const blurTargetRef = useRef<BlurTargetRef>(null);

  const { refetch: refetchFriends } = friendsQuery;
  const { refetch: refetchRequests } = requestsQuery;
  const { refetch: refetchSentRequests } = sentRequestsQuery;
  const friendsRefresh = usePullToRefresh(useCallback(() => refetchFriends(), [refetchFriends]));
  const requestsRefresh = usePullToRefresh(
    useCallback(() => Promise.all([refetchRequests(), refetchSentRequests()]), [refetchRequests, refetchSentRequests]),
  );

  // 친구 목록이 갱신될 때마다 presence 구독 대상 동기화
  useEffect(() => {
    const ids = friends.map(f => f.userId);
    if (ids.length > 0) usePresenceStore.getState().subscribe(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friends.map(f => f.userId).join(',')]);
  const respondRequest = useRespondRequest();
  const joinRoom = useJoinRoom();

  const handleJoinPress = (room: FriendRoom): void => {
    if (room.hasPassword) {
      setJoinTarget({ room });
    } else {
      joinRoom.mutate(
        { code: room.code },
        {
          onError: err =>
            handleApiError(err, {
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

  // 첫 로딩 중에는 빈 상태 문구 대신 스피너 — 로딩이 끝나고 0건일 때만 안내
  const requestsHeader = (() => {
    if (requestsQuery.isLoading) {
      return (
        <View sx={{ alignItems: 'center', paddingTop: 48 }}>
          <SketchbookLoadingSpinner size={160} accessibilityLabel="친구 요청 불러오는 중" />
        </View>
      );
    }
    if (requests.length > 0) return null;
    return (
      <View sx={{ alignItems: 'center', paddingTop: 48, paddingBottom: sentRequests.length > 0 ? 24 : 0 }}>
        <Text sx={{ color: colors.PRIMARY_100 }}>받은 친구 요청이 없어요</Text>
      </View>
    );
  })();

  return (
    <View sx={{ flex: 1 }}>
      <BlurTargetView ref={blurTargetRef} style={StyleSheet.absoluteFill}>
        <ImageBackground source={mainBackground} style={StyleSheet.absoluteFill} resizeMode="cover" />
      </BlurTargetView>
      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
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
            <BlurView
              intensity={50}
              tint="light"
              blurTarget={blurTargetRef}
              blurMethod={ANDROID_BLUR_METHOD}
              style={StyleSheet.absoluteFill}
            />
            <PullRefreshIndicator refreshing={friendsRefresh.refreshing} pullProgress={friendsRefresh.pullProgress} />
            <FlatList
              data={friends}
              keyExtractor={item => item.friendshipId}
              contentContainerStyle={{ paddingBottom: 56 }}
              refreshControl={friendsRefresh.refreshControl}
              onScroll={friendsRefresh.onScroll}
              scrollEventThrottle={16}
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
                  isJoining={joinRoom.isPending}
                />
              )}
              ListEmptyComponent={
                // 첫 로딩 중에는 빈 상태 문구 대신 스피너 — 로딩이 끝나고 0명일 때만 안내
                friendsQuery.isLoading ? (
                  <View sx={{ alignItems: 'center', paddingTop: 48 }}>
                    <SketchbookLoadingSpinner size={160} accessibilityLabel="친구 목록 불러오는 중" />
                  </View>
                ) : (
                  <View sx={{ flex: 1, alignItems: 'center', paddingTop: 48 }}>
                    <Text sx={{ color: colors.PRIMARY_100, textAlign: 'center' }}>
                      {'아직 친구가 없어요.\n우상단 버튼으로 친구를 추가해보세요!'}
                    </Text>
                  </View>
                )
              }
            />
          </View>
        )}

        {activeTab === 1 && (
          <View style={{ flex: 1 }}>
            <BlurView
              intensity={50}
              tint="light"
              blurTarget={blurTargetRef}
              blurMethod={ANDROID_BLUR_METHOD}
              style={StyleSheet.absoluteFill}
            />
            <PullRefreshIndicator refreshing={requestsRefresh.refreshing} pullProgress={requestsRefresh.pullProgress} />
            <FlatList
              data={requests}
              keyExtractor={item => `recv-${item.id}`}
              contentContainerStyle={{ paddingBottom: 56 }}
              refreshControl={requestsRefresh.refreshControl}
              onScroll={requestsRefresh.onScroll}
              scrollEventThrottle={16}
              renderItem={({ item, index }) => (
                <RequestItem
                  request={item}
                  index={index}
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
                  isLoading={respondRequest.isPending && respondRequest.variables?.requestId === item.id}
                  disabled={respondRequest.isPending}
                />
              )}
              ListHeaderComponent={requestsHeader}
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
                        <Text variant="B4" sx={{ flex: 1, color: colors.PRIMARY_100 }}>
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
          <FriendPasswordModal visible={true} onClose={() => setJoinTarget(null)} roomCode={joinTarget.room.code} />
        )}
      </SafeAreaView>
    </View>
  );
}
