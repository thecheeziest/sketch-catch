import { Text, View } from 'dripsy';
import { StyleSheet } from 'react-native';
import { SlotCard } from '@/features/room/ui/SlotCard';
import { colors, spacing, textSizes, fontFamily } from '@/shared/config';
import type { Player } from '@sketch-catch/shared';

type PodiumPlayer = {
  userId: string;
  nickname: string;
  characterId: string;
  score: number;
};

type Props = {
  rank: 1 | 2 | 3;
  player: PodiumPlayer;
  baseCardWidth: number;
};

const SCALE: Record<1 | 2 | 3, number> = {
  1: 1.4,
  2: 1.1,
  3: 0.9,
};

const RANK_LABEL_COLOR: Record<1 | 2 | 3, string> = {
  1: colors.PRIMARY_400,
  2: colors.SECONDARY_300,
  3: colors.SECONDARY_100,
};

export function PodiumSlot({ rank, player, baseCardWidth }: Props) {
  const cardWidth = Math.round(baseCardWidth * SCALE[rank]);

  // SlotCard는 Player | null을 받으므로 PodiumPlayer를 Player 형태로 변환한다.
  // 1위는 isHost=true → rainbow 테두리 애니메이션 재사용
  const slotPlayer: Player = {
    id: player.userId,
    nickname: player.nickname,
    friendCode: '',
    characterId: player.characterId,
    slot: rank,
    isHost: rank === 1,
    isReady: false,
    connected: true,
  };

  return (
    <View sx={{ alignItems: 'center' }}>
      <SlotCard player={slotPlayer} isMe={false} cardWidth={cardWidth} />
      <Text
        style={[
          styles.rankLabel,
          { color: RANK_LABEL_COLOR[rank] },
        ]}
      >
        {rank}위
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rankLabel: {
    fontFamily: fontFamily.BOLD,
    ...textSizes.B1,
    marginTop: spacing.XS,
  },
});
