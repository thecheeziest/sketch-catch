import { Pressable, StyleSheet } from 'react-native';
import { Text, View } from 'dripsy';
import { fontFamily } from '@/shared/config';
import { Icon } from '@/shared/ui/Icon';
import { PixelFrame } from '@/shared/ui/PixelFrame';
import { toolbar } from '@/features/game/config';
import { useGameStore } from '@/features/game/model/useGameStore';
import { useStrokeSender } from '@/features/game/api/useStrokeSender';
import { ColorPicker } from '../ColorPicker';

// 브러시 3단: 실제 stroke width(불변) / 도트 표시 크기(디자인값)
const WIDTH_OPTIONS = [
  { width: 3, dotSize: 6, label: '얇게' },
  { width: 8, dotSize: 12, label: '보통' },
  { width: 16, dotSize: 19, label: '굵게' },
] as const;

type LabeledButtonProps = {
  label: string;
  icon: 'ERASER' | 'UNDO' | 'TRASH';
  bg: string;
  ring: string;
  labelColor: string;
  active?: boolean;
  onPress: () => void;
};

function LabeledButton({ label, icon, bg, ring, labelColor, active = false, onPress }: LabeledButtonProps) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} style={styles.labeledButton}>
      <PixelFrame
        borderColor={active ? toolbar.SWATCH_SELECTED : ring}
        borderWidth={3}
        style={StyleSheet.absoluteFill}
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: bg }]} />
      </PixelFrame>
      <View style={styles.labeledButtonContent}>
        <Icon name={icon} size={15} color={labelColor} />
        <Text sx={{ fontFamily: fontFamily.REGULAR, fontSize: 11, lineHeight: 13, color: labelColor }}>{label}</Text>
      </View>
    </Pressable>
  );
}

export function ToolbarRow() {
  const { color, width, eraser, setColor, setWidth, setEraser, clearRemote, requestDrawerClear, requestDrawerUndo } =
    useGameStore();
  const sender = useStrokeSender(true); // ToolbarRow는 출제자 전용

  const handleClear = (): void => {
    sender.clear();
    clearRemote();
    requestDrawerClear();
  };

  const handleUndo = (): void => {
    sender.undo();
    requestDrawerUndo();
  };

  return (
    <View style={styles.container}>
      <ColorPicker value={eraser ? '' : color} onChange={setColor} />

      <View style={styles.toolRow}>
        <View style={styles.sizeGroup}>
          {WIDTH_OPTIONS.map((opt) => {
            const isSelected = !eraser && width === opt.width;
            return (
              <Pressable
                key={opt.width}
                onPress={() => {
                  setWidth(opt.width);
                  setEraser(false);
                }}
                accessibilityLabel={`굵기 ${opt.label}`}
                style={styles.sizeButton}
              >
                {isSelected && (
                  <PixelFrame
                    borderColor={toolbar.SIZE_BTN_SELECTED_RING}
                    borderWidth={3}
                    notchSize={3}
                    style={StyleSheet.absoluteFill}
                  >
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: toolbar.SIZE_BTN_SELECTED_BG }]} />
                  </PixelFrame>
                )}
                {!isSelected && (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: toolbar.SIZE_BTN_BG }]} />
                )}
                <View
                  style={{
                    width: opt.dotSize,
                    height: opt.dotSize,
                    borderRadius: opt.dotSize / 2,
                    backgroundColor: toolbar.SIZE_DOT,
                  }}
                />
              </Pressable>
            );
          })}
        </View>

        <LabeledButton
          label="지우개"
          icon="ERASER"
          bg={toolbar.ERASER_BG}
          ring={toolbar.ERASER_RING}
          labelColor={toolbar.LABEL_FG}
          active={eraser}
          onPress={() => setEraser(!eraser)}
        />
        <LabeledButton
          label="이전으로"
          icon="UNDO"
          bg={toolbar.UNDO_BG}
          ring={toolbar.UNDO_RING}
          labelColor={toolbar.LABEL_FG}
          onPress={handleUndo}
        />
        <LabeledButton
          label="전부지우기"
          icon="TRASH"
          bg={toolbar.CLEAR_BG}
          ring={toolbar.CLEAR_RING}
          labelColor={toolbar.CLEAR_LABEL_FG}
          onPress={handleClear}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: toolbar.CONTAINER,
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 10,
    gap: 8,
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
  },
  sizeGroup: {
    flexDirection: 'row',
    gap: 2,
    padding: 3,
    backgroundColor: toolbar.SIZE_GROUP_BG,
  },
  sizeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labeledButton: {
    flex: 1,
    minWidth: 0,
    height: 50,
  },
  labeledButtonContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
  },
});
