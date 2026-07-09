import { View } from 'dripsy';
import { Pressable, useWindowDimensions } from 'react-native';
import type { Player, ChatMessage } from '@sketch-catch/shared';
import { spacing } from '@/shared/config';
import { PlayerCell } from '../PlayerCell';

const COLUMNS = 6;
const ROWS = 2;
const MAX_SLOTS = COLUMNS * ROWS; // 12

type Props = {
  players: Player[];
  myId: string;
  drawerId: string;
  /** 출제자 화면에서 플레이어 탭 시 선택 처리 */
  isDrawerView?: boolean;
  selectedUserId?: string | null;
  onSelectPlayer?: (userId: string | null) => void;
  activeBubbles?: Record<string, ChatMessage | null>;
  correctUserId?: string | null;
  onBubbleExpire?: (userId: string) => void;
};

export function PlayerGrid({
  players,
  myId,
  drawerId,
  isDrawerView = false,
  selectedUserId,
  onSelectPlayer,
  activeBubbles = {},
  correctUserId,
  onBubbleExpire,
}: Props) {
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

  const handleCellPress = (player: Player | null): void => {
    if (!isDrawerView || player === null || player.left || onSelectPlayer === undefined) return;
    if (selectedUserId === player.id) {
      onSelectPlayer(null);
    } else {
      onSelectPlayer(player.id);
    }
  };

  return (
    <View sx={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.MD }}>
      {slotItems.map((player, index) => (
        <Pressable
          key={player?.id ?? `spacer-${index}`}
          onPress={() => handleCellPress(player)}
          disabled={!isDrawerView || player === null}
        >
          <PlayerCell
            player={player}
            isMe={player?.id === myId}
            isDrawer={player?.id === drawerId}
            isSelected={player?.id === selectedUserId}
            isLeft={player?.left === true}
            cellWidth={cellWidth}
            activeBubble={player != null ? (activeBubbles[player.id] ?? null) : null}
            isCorrectBubble={player != null && player.id === correctUserId}
            onBubbleExpire={
              player != null && onBubbleExpire != null
                ? () => onBubbleExpire(player.id)
                : undefined
            }
          />
        </Pressable>
      ))}
    </View>
  );
}
