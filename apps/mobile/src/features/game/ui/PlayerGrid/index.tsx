import { View } from 'dripsy';
import { useWindowDimensions } from 'react-native';
import type { Player } from '@sketch-catch/shared';
import { spacing } from '@/shared/config';
import { PlayerCell } from '../PlayerCell';

const COLUMNS = 6;
const ROWS = 2;
const MAX_SLOTS = COLUMNS * ROWS; // 12

type Props = {
  players: Player[];
  myId: string;
  drawerId: string;
};

export function PlayerGrid({ players, myId, drawerId }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const cellWidth = Math.floor(
    (screenWidth - spacing.MD * 2 - spacing.XS * 2 * COLUMNS) / COLUMNS
  );

  // 첫 칸은 항상 본인, 나머지는 입장 순서 (본인 제외)
  const me = players.find((p) => p.id === myId) ?? null;
  const others = players.filter((p) => p.id !== myId);

  const slots: (Player | null)[] = [me, ...others];
  // 12칸 미만은 null spacer로 채움
  while (slots.length < MAX_SLOTS) {
    slots.push(null);
  }
  const slotItems = slots.slice(0, MAX_SLOTS);

  return (
    <View sx={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.MD }}>
      {slotItems.map((player, index) => (
        <PlayerCell
          key={player?.id ?? `spacer-${index}`}
          player={player}
          isMe={player?.id === myId}
          isDrawer={player?.id === drawerId}
          cellWidth={cellWidth}
        />
      ))}
    </View>
  );
}
