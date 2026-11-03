import { FeedbackPressable } from '@/shared/ui/FeedbackPressable';
import { StyleSheet } from 'react-native';
import { Text, View } from 'dripsy';
import { fontFamily } from '@/shared/config';
import { Icon } from '@/shared/ui/Icon';
import { PixelFrame } from '@/shared/ui/PixelFrame';
import { toolbar } from '@/features/game/config';
import { useGameStore } from '@/features/game/model/useGameStore';
import { useShallow } from 'zustand/react/shallow';
import { useStrokeSender } from '@/features/game/api/useStrokeSender';
import { BrushWidthSlider } from '../BrushWidthSlider';
import { ColorPicker } from '../ColorPicker';
import { type FeedbackName } from '@/shared/config/audio';

type LabeledButtonProps = {
  label: string;
  icon: 'ERASER' | 'UNDO' | 'TRASH' | 'PAINT';
  bg: string;
  ring: string;
  labelColor: string;
  active?: boolean;
  onPress: () => void;
};

function LabeledButton({ label, icon, bg, ring, labelColor, active = false, onPress }: LabeledButtonProps) {
  let feedback: FeedbackName = 'tool';
  if (icon === 'UNDO') feedback = 'undo';
  if (icon === 'TRASH') feedback = 'clear';
  return (
    <FeedbackPressable feedback={feedback} onPress={onPress} accessibilityLabel={label} style={styles.labeledButton}>
      <PixelFrame borderColor={active ? toolbar.SWATCH_SELECTED : ring} borderWidth={3} style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: bg }]} />
      </PixelFrame>
      <View style={styles.labeledButtonContent}>
        <Icon name={icon} size={15} color={labelColor} />
        <Text sx={{ fontFamily: fontFamily.REGULAR, fontSize: 11, lineHeight: 13, color: labelColor }}>{label}</Text>
      </View>
    </FeedbackPressable>
  );
}

export function ToolbarRow({ realtime = true }: { realtime?: boolean }) {
  const {
    color,
    width,
    eraser,
    paint,
    setColor,
    setWidth,
    setEraser,
    setPaint,
    clearRemote,
    requestDrawerClear,
    requestDrawerUndo,
  } = useGameStore(
    useShallow(s => ({
      color: s.color,
      width: s.width,
      eraser: s.eraser,
      paint: s.paint,
      setColor: s.setColor,
      setWidth: s.setWidth,
      setEraser: s.setEraser,
      setPaint: s.setPaint,
      clearRemote: s.clearRemote,
      requestDrawerClear: s.requestDrawerClear,
      requestDrawerUndo: s.requestDrawerUndo,
    })),
  );
  const sender = useStrokeSender(realtime); // ToolbarRow는 출제자 전용

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

      <BrushWidthSlider value={width} onChange={setWidth} />
      <View style={styles.toolRow}>
        <LabeledButton
          label="페인트"
          icon="PAINT"
          bg={toolbar.ERASER_BG}
          ring={toolbar.ERASER_RING}
          labelColor={toolbar.LABEL_FG}
          active={paint}
          onPress={() => setPaint(!paint)}
        />
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
          label="처음으로"
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
