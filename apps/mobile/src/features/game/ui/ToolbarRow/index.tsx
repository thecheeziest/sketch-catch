import { Pressable, StyleSheet } from 'react-native';
import { View } from 'dripsy';
import { colors } from '@/shared/config';
import { Button } from '@/shared/ui/Button';
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
      <Button
        label="지우개"
        color={eraser ? 'primary' : 'light'}
        height={44}
        onPress={() => setEraser(!eraser)}
      />

      {/* 전체 지우기 */}
      <Button
        label="전체"
        color="dark"
        height={44}
        onPress={handleClear}
      />

      {/* 되돌리기 */}
      <Button
        label="되돌리기"
        color="dark"
        height={44}
        onPress={handleUndo}
      />
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
});
