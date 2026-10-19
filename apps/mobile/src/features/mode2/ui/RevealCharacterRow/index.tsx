import { ScrollView, View } from 'dripsy';
import { StyleSheet, useWindowDimensions } from 'react-native';
import type { Player } from '@sketch-catch/shared';
import { spacing } from '@/shared/config';
import { FeedbackPressable } from '@/shared/ui/FeedbackPressable';
import { Icon } from '@/shared/ui/Icon';
import { PixelLoadingSpinner } from '@/shared/ui/PixelLoadingSpinner';
import { gameSurface, gameText } from '@/features/game/config';
import { PlayerCell } from '@/features/game/ui/PlayerCell';

export type RevealSaveState = 'disabled' | 'ready' | 'saving';

type Props = {
  players: Player[];
  myId: string;
  /** 지금 발표 중(또는 다시 보는 중)인 시트의 원조자 — 모드 1 출제자 테두리로 표시 */
  highlightedId: string | null;
  /** 실시간 공개식 동안은 순서대로 함께 봐야 하므로 막아 둔다 */
  selectable: boolean;
  onSelect: (playerId: string) => void;
  saveState: RevealSaveState;
  onSave: () => void;
};

const SAVE_SLOT_WIDTH = 40;
const MAX_CELL_WIDTH = 56;
const CELL_MARGIN = 3;

// 정답 공개식 상단 — 참가자 전원 + 맨 오른쪽 GIF 저장 아이콘
export function RevealCharacterRow({ players, myId, highlightedId, selectable, onSelect, saveState, onSave }: Props) {
  const { width } = useWindowDimensions();
  const available = width - spacing.MD * 2 - SAVE_SLOT_WIDTH;
  const cellWidth = Math.min(MAX_CELL_WIDTH, Math.floor(available / Math.max(1, players.length)) - CELL_MARGIN * 2);

  return (
    <View
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.MD,
        backgroundColor: gameSurface.PANEL,
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cells}
        sx={{ flex: 1 }}
      >
        {players.map(player => (
          <FeedbackPressable
            key={player.id}
            feedback={selectable ? 'select' : false}
            pressScale={selectable ? 0.94 : undefined}
            disabled={!selectable}
            onPress={() => onSelect(player.id)}
            accessibilityRole="button"
            accessibilityLabel={`${player.nickname}의 정답 발표식 보기`}
            accessibilityState={{ disabled: !selectable, selected: player.id === highlightedId }}
          >
            <PlayerCell
              player={player}
              isMe={player.id === myId}
              isDrawer={player.id === highlightedId}
              isSolved={false}
              hasGuessed={false}
              isSelected={false}
              isLeft={player.left === true}
              cellWidth={Math.max(40, cellWidth)}
            />
          </FeedbackPressable>
        ))}
      </ScrollView>
      <View sx={{ width: SAVE_SLOT_WIDTH, alignItems: 'flex-end', justifyContent: 'center' }}>
        {saveState === 'saving' ? (
          <PixelLoadingSpinner size={20} accessibilityLabel="GIF 저장 중" />
        ) : (
          <FeedbackPressable
            feedback={saveState === 'ready' ? 'select' : false}
            disabled={saveState !== 'ready'}
            onPress={onSave}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="정답 발표식 GIF 저장"
            accessibilityState={{ disabled: saveState !== 'ready' }}
          >
            <Icon name="SAVE" size={22} color={gameText.PRIMARY} opacity={saveState === 'ready' ? 1 : 0.3} />
          </FeedbackPressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cells: {
    alignItems: 'center',
    paddingVertical: 6,
  },
});
