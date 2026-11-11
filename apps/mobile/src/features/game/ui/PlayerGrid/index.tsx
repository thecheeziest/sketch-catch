import { View } from 'dripsy';
import { useAppDimensions } from '@/shared/lib/useAppDimensions';
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
};

export function PlayerGrid({ players, availableWidth, myId, drawerId, solvedUserId, guessedUserIds }: Props) {
  const { width: screenWidth } = useAppDimensions();
  const cellWidth = Math.floor(
    ((availableWidth ?? screenWidth) - GRID_PADDING * 2 - CELL_MARGIN * 2 * COLUMNS) / COLUMNS,
  );

  // 첫 칸은 항상 본인, 나머지는 입장 순서 (본인 제외)
  const me = players.find(p => p.id === myId) ?? null;
  const others = players.filter(p => p.id !== myId);

  const slots: (Player | null)[] = [me, ...others];
  const slotItems = slots;

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
        <PlayerCell
          key={player?.id ?? `spacer-${index}`}
          player={player}
          isMe={player?.id === myId}
          isDrawer={player?.id === drawerId}
          isSolved={player != null && player.id === solvedUserId}
          hasGuessed={player != null && guessedUserIds.has(player.id)}
          isSelected={false}
          isLeft={player?.left === true}
          cellWidth={cellWidth}
        />
      ))}
    </View>
  );
}
