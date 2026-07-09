import { Pressable, StyleSheet } from 'react-native';
import { View } from 'dripsy';
import { colors } from '@/shared/config';
import { Icon } from '@/shared/ui/Icon';
import { useGameStore } from '@/features/game/model/useGameStore';
import { useStrokeSender } from '@/features/game/api/useStrokeSender';
import { ColorPicker } from '../ColorPicker';

// 굵기 3단계: 도트 표시 크기 / 실제 stroke width
const WIDTH_OPTIONS = [
  { width: 3, dotSize: 8, label: '얇게' },
  { width: 8, dotSize: 14, label: '보통' },
  { width: 16, dotSize: 22, label: '굵게' },
] as const;

export function ToolbarRow() {
  const { color, width, eraser, setColor, setWidth, setEraser, clearRemote } = useGameStore();
  const sender = useStrokeSender(true); // ToolbarRow는 출제자 전용

  const handleClear = (): void => {
    sender.clear();
    clearRemote();
  };

  const handleUndo = (): void => {
    sender.undo();
  };

  return (
    <View sx={sxStyles.container}>
      <ColorPicker value={eraser ? '' : color} onChange={setColor} />

      {/* 굵기 3단계 도트 */}
      <View sx={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {WIDTH_OPTIONS.map((opt) => {
          const isSelected = !eraser && width === opt.width;
          return (
            <Pressable
              key={opt.width}
              onPress={() => {
                setWidth(opt.width);
                setEraser(false);
              }}
              hitSlop={8}
              accessibilityLabel={`굵기 선택: ${opt.label}`}
              style={styles.widthDotWrapper}
            >
              <View
                style={[
                  styles.widthDot,
                  {
                    width: opt.dotSize,
                    height: opt.dotSize,
                    borderRadius: opt.dotSize / 2,
                    backgroundColor: isSelected ? colors.PRIMARY_400 : colors.LIGHT_500,
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </View>

      {/* 지우개 */}
      <Pressable
        onPress={() => setEraser(!eraser)}
        hitSlop={8}
        accessibilityLabel="지우개"
        style={[styles.iconBtn, eraser && { backgroundColor: colors.PRIMARY_400 }]}
      >
        <Icon name="ERASER" size={18} color={eraser ? colors.DARK_500 : colors.LIGHT_100} />
      </Pressable>

      {/* 전체 지우기 */}
      <Pressable
        onPress={handleClear}
        hitSlop={8}
        accessibilityLabel="전체 지우기"
        style={styles.iconBtn}
      >
        <Icon name="TRASH" size={18} color={colors.LIGHT_100} />
      </Pressable>

      {/* 되돌리기 */}
      <Pressable
        onPress={handleUndo}
        hitSlop={8}
        accessibilityLabel="되돌리기"
        style={styles.iconBtn}
      >
        <Icon name="UNDO" size={18} color={colors.LIGHT_100} />
      </Pressable>
    </View>
  );
}

const sxStyles = {
  container: {
    height: 56,
    backgroundColor: colors.DARK_100,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 8,
    gap: 8,
  },
};

const styles = StyleSheet.create({
  widthDotWrapper: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  widthDot: {},
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.DARK_300,
  },
});
