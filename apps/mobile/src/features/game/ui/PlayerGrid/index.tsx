import { FeedbackPressable } from '@/shared/ui/FeedbackPressable';
import { View } from 'dripsy';
import { useWindowDimensions } from 'react-native';
import type { Player } from '@sketch-catch/shared';
import { gameSurface } from '@/features/game/config';
import { PlayerCell } from '../PlayerCell';

const COLUMNS = 6;
const CELL_MARGIN = 3;
const GRID_PADDING = 12;

type Props = {
  players: Player[];
  availableWidth?: number;
  myId: string;
  drawerId: string;
  /** 정답 처리된 유저 (라운드 종료까지 유지) */
  solvedUserId: string | null;
  /** 이번 라운드에 추측을 1회 이상 발화한 유저 */
  guessedUserIds: Set<string>;
  /** 출제자 화면에서 플레이어 탭 시 선택 처리 (커스텀 라운드 정답 인정용) */
  isDrawerView?: boolean;
  selectedUserId?: string | null;
  onSelectPlayer?: (userId: string | null) => void;
};

export function PlayerGrid({
  players,
  availableWidth,
  myId,
  drawerId,
  solvedUserId,
  guessedUserIds,
  isDrawerView = false,
  selectedUserId,
  onSelectPlayer,
}: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const cellWidth = Math.floor(
    ((availableWidth ?? screenWidth) - GRID_PADDING * 2 - CELL_MARGIN * 2 * COLUMNS) / COLUMNS,
  );

  // 첫 칸은 항상 본인, 나머지는 입장 순서 (본인 제외)
  const me = players.find(p => p.id === myId) ?? null;
  const others = players.filter(p => p.id !== myId);

  const slots: (Player | null)[] = [me, ...others];
  const slotItems = slots;

  const handleCellPress = (player: Player | null): void => {
    if (!isDrawerView || player === null || player.left || onSelectPlayer === undefined) return;
    // 출제자 본인은 정답 인정 대상이 아니므로 선택 불가
    if (player.id === myId) return;
    if (selectedUserId === player.id) {
      onSelectPlayer(null);
    } else {
      onSelectPlayer(player.id);
    }
  };

  return (
    <View
      sx={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: GRID_PADDING,
        paddingBottom: GRID_PADDING,
        backgroundColor: gameSurface.PANEL,
      }}
    >
      {slotItems.map((player, index) => (
        <FeedbackPressable
          key={player?.id ?? `spacer-${index}`}
          onPress={() => handleCellPress(player)}
          disabled={!isDrawerView || player === null || player?.id === myId}
        >
          <PlayerCell
            player={player}
            isMe={player?.id === myId}
            isDrawer={player?.id === drawerId}
            isSolved={player != null && player.id === solvedUserId}
            hasGuessed={player != null && guessedUserIds.has(player.id)}
            isSelected={isDrawerView && player?.id === selectedUserId}
            isLeft={player?.left === true}
            cellWidth={cellWidth}
          />
        </FeedbackPressable>
      ))}
    </View>
  );
}
