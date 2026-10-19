import { FeedbackPressable } from '@/shared/ui/FeedbackPressable';
import { Badge, Icon, PixelFrame } from '@/shared/ui';
import { colors, spacing } from '@/shared/config';
import { ScrollView, Text, View } from 'dripsy';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import type { GameMode, RoomListItem, RoomListStatus } from '@sketch-catch/shared';
import { getRoomBlockReason } from '../../lib/getRoomBlockReason';
import { ALL_CATEGORIES, CATEGORY_LABEL } from '../CategorySelector';

type Props = {
  room: RoomListItem;
  onPress: () => void;
  // 상태·모드 chip 뒤에 붙는 추가 chip 자리 (예: 내기 옵션)
  extraChips?: ReactNode;
};

const STATUS_LABEL: Record<RoomListStatus, string> = { WAITING: '대기 중', PLAYING: '게임 중' };
const STATUS_COLOR: Record<RoomListStatus, string> = { WAITING: colors.ACCENT_200, PLAYING: colors.LIGHT_500 };
const MODE_LABEL: Record<GameMode, string> = { 1: '맞혀 볼래?', 2: '이어 그리자!' };
const MODE_COLOR: Record<GameMode, string> = { 1: colors.PRIMARY_100, 2: colors.SECONDARY_100 };

export function RoomListCard({ room, onPress, extraChips }: Props) {
  const dimmed = getRoomBlockReason(room) !== null;
  const isAllCategories = ALL_CATEGORIES.every(cat => room.categories.includes(cat));
  const categoryLabels = isAllCategories ? ['전체'] : room.categories.map(cat => CATEGORY_LABEL[cat]);
  const isLocked = room.hasPassword || room.inviteOnly;

  return (
    <FeedbackPressable
      onPress={onPress}
      feedback={dimmed ? 'cancel' : 'select'}
      style={({ pressed }) => [styles.card, dimmed ? styles.dimmed : pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${room.title}, ${STATUS_LABEL[room.status]}, ${room.playerCount}/${room.playerCountMax}명`}
    >
      <PixelFrame borderColor={colors.LIGHT_100} borderWidth={2} style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.DARK_100 }]} />
      </PixelFrame>
      <View sx={{ padding: spacing.MD, gap: spacing.SM }}>
        <View sx={{ flexDirection: 'row', alignItems: 'center', gap: spacing.XS }}>
          <Badge label={STATUS_LABEL[room.status]} color={STATUS_COLOR[room.status]} />
          <Badge label={MODE_LABEL[room.mode]} color={MODE_COLOR[room.mode]} />
          {extraChips}
          <View sx={{ flex: 1 }} />
          {isLocked && <Icon name="LOCK" size={14} />}
          <Text variant="B3" sx={{ color: colors.LIGHT_100 }}>
            {room.playerCount}/{room.playerCountMax}
          </Text>
        </View>
        <Text variants={['bold', 'B2']} numberOfLines={1} sx={{ color: colors.LIGHT_100 }}>
          {room.title}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.XS }}>
          {categoryLabels.map(label => (
            <Badge key={label} label={label} color={colors.LIGHT_300} />
          ))}
        </ScrollView>
      </View>
    </FeedbackPressable>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: spacing.MD },
  dimmed: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
});
