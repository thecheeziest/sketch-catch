import React, { useState } from 'react'
import { FlatList, Pressable, SafeAreaView, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SegmentedTab } from '@/shared/ui/SegmentedTab'
import { FriendItem } from '@/shared/ui/FriendItem'
import { RequestItem } from '@/shared/ui/RequestItem'
import { AddFriendModal } from '@/features/friends/ui/AddFriendModal'
import { DeleteFriendModal } from '@/features/friends/ui/DeleteFriendModal'
import { useFriends } from '@/features/friends/api/useFriends'
import { useFriendRequests } from '@/features/friends/api/useFriendRequests'
import { useRespondRequest } from '@/features/friends/api/useRespondRequest'
import { useToastStore } from '@/shared/model/toast'
import { colors, fontFamily, typography } from '@/shared/config/theme'

type DeleteTarget = {
  friendshipId: string
  userId: string
  nickname: string
}

export default function FriendsScreen(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<0 | 1>(0)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)

  const { data: friends = [] } = useFriends()
  const { data: requests = [] } = useFriendRequests()
  const respondRequest = useRespondRequest()

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* 헤더 */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          paddingHorizontal: 16,
          paddingVertical: 8,
        }}
      >
        <Pressable
          onPress={() => setAddModalOpen(true)}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="person-add-outline" size={24} color={colors.textPrimary} />
        </Pressable>
      </View>

      {/* 세그먼트 탭 */}
      <SegmentedTab
        tabs={['내 친구', '요청']}
        activeIndex={activeTab}
        onTabPress={(index) => setActiveTab(index as 0 | 1)}
        badgeIndex={requests.length > 0 ? 1 : undefined}
      />

      {/* 내 친구 탭 */}
      {activeTab === 0 && (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.friendshipId}
          renderItem={({ item }) => (
            <FriendItem
              friend={item}
              onLongPress={() =>
                setDeleteTarget({
                  friendshipId: item.friendshipId,
                  userId: item.userId,
                  nickname: item.nickname,
                })
              }
            />
          )}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', paddingTop: 48 }}>
              <Text
                style={{
                  fontFamily: fontFamily.regular,
                  fontSize: typography.body.fontSize,
                  lineHeight: typography.body.lineHeight,
                  color: colors.textSecondary,
                  textAlign: 'center',
                }}
                allowFontScaling={false}
              >
                {'아직 친구가 없어요.\n우상단 버튼으로 친구를 추가해보세요!'}
              </Text>
            </View>
          }
        />
      )}

      {/* 요청 탭 */}
      {activeTab === 1 && (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RequestItem
              request={item}
              onAccept={() =>
                respondRequest.mutate(
                  { requestId: item.id, action: 'ACCEPT' },
                  {
                    onSuccess: () =>
                      useToastStore.getState().show(`${item.sender.nickname}님과 친구가 됐어요!`),
                    onError: () =>
                      useToastStore.getState().show('연결에 실패했어요. 잠시 후 다시 시도해주세요.'),
                  },
                )
              }
              onReject={() =>
                respondRequest.mutate(
                  { requestId: item.id, action: 'REJECT' },
                  {
                    onSuccess: () => useToastStore.getState().show('요청을 거절했어요'),
                    onError: () =>
                      useToastStore.getState().show('연결에 실패했어요. 잠시 후 다시 시도해주세요.'),
                  },
                )
              }
              isLoading={respondRequest.isPending}
            />
          )}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', paddingTop: 48 }}>
              <Text
                style={{
                  fontFamily: fontFamily.regular,
                  fontSize: typography.body.fontSize,
                  lineHeight: typography.body.lineHeight,
                  color: colors.textSecondary,
                }}
                allowFontScaling={false}
              >
                받은 친구 요청이 없어요
              </Text>
            </View>
          }
        />
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
    </SafeAreaView>
  )
}
