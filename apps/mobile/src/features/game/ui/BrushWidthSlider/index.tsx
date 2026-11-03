import { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet } from 'react-native';
import { Text, View } from 'dripsy';
import { fontFamily } from '@/shared/config';
import { PixelFrame } from '@/shared/ui/PixelFrame';
import { toolbar } from '@/features/game/config';

const MIN_WIDTH = 1;
const MAX_WIDTH = 32;
const THUMB_SIZE = 22;

type Props = { value: number; onChange: (width: number) => void };

export function BrushWidthSlider({ value, onChange }: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const current = useRef({ value, onChange, trackWidth });
  current.current = { value, onChange, trackWidth };
  const startX = useRef(0);
  const updateAt = (x: number): void => {
    const usable = current.current.trackWidth - THUMB_SIZE;
    if (usable <= 0) return;
    const ratio = Math.min(1, Math.max(0, (x - THUMB_SIZE / 2) / usable));
    current.current.onChange(Math.round(MIN_WIDTH + ratio * (MAX_WIDTH - MIN_WIDTH)));
  };
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: event => {
          startX.current = event.nativeEvent.locationX;
          updateAt(startX.current);
        },
        onPanResponderMove: (_event, gesture) => updateAt(startX.current + gesture.dx),
        onPanResponderTerminationRequest: () => false,
      }),
    [],
  );
  const ratio = (value - MIN_WIDTH) / (MAX_WIDTH - MIN_WIDTH);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>굵기 {value}</Text>
      <View
        {...responder.panHandlers}
        style={styles.trackArea}
        onLayout={event => setTrackWidth(event.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="펜 굵기"
        accessibilityValue={{ min: MIN_WIDTH, max: MAX_WIDTH, now: value }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={event => {
          const delta = event.nativeEvent.actionName === 'increment' ? 1 : -1;
          onChange(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, value + delta)));
        }}
      >
        <View pointerEvents="none" style={styles.track} />
        <View
          pointerEvents="none"
          style={[styles.fill, { width: THUMB_SIZE / 2 + ratio * Math.max(0, trackWidth - THUMB_SIZE) }]}
        />
        <View pointerEvents="none" style={[styles.thumb, { left: ratio * Math.max(0, trackWidth - THUMB_SIZE) }]}>
          <PixelFrame
            borderColor={toolbar.SWATCH_SELECTED}
            borderWidth={2}
            notchSize={3}
            style={StyleSheet.absoluteFill}
          >
            <View style={[StyleSheet.absoluteFill, { backgroundColor: toolbar.SIZE_BTN_SELECTED_BG }]} />
          </PixelFrame>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { width: 58, fontFamily: fontFamily.REGULAR, fontSize: 12, color: toolbar.LABEL_FG },
  trackArea: { flex: 1, height: 44, justifyContent: 'center' },
  track: {
    position: 'absolute',
    left: THUMB_SIZE / 2,
    right: THUMB_SIZE / 2,
    height: 6,
    backgroundColor: toolbar.SIZE_GROUP_BG,
  },
  fill: { height: 6, backgroundColor: toolbar.SWATCH_SELECTED },
  thumb: { position: 'absolute', width: THUMB_SIZE, height: THUMB_SIZE },
});
