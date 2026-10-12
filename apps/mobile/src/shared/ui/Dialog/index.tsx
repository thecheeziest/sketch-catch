import { type ReactNode, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet } from 'react-native';
import { Text, View } from 'dripsy';
import { colors, spacing } from '@/shared/config';
import { useTvDialog } from '@/shared/lib/useTvDialog';
import { PixelFrame } from '../PixelFrame';
import { Button, type ButtonColor } from '../Button';

export type DialogButton = {
  label: string;
  color?: ButtonColor;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  buttons?: DialogButton[];
  dismissible?: boolean; // false면 백드롭 탭/하드웨어 뒤로가기로 닫히지 않음 (기본 true)
};

export function Dialog({ visible, onClose, title, children, buttons, dismissible = true }: Props) {
  const { rendered, closing, dismiss, overlayAnim, scaleXAnim, scaleYAnim, flashAnim } = useTvDialog(visible, onClose);
  // 부모가 선택값·입력값을 지워도 TV가 꺼지는 동안 마지막 화면을 유지한다.
  const content = useRef({ title, children, buttons });
  if (visible && !closing) content.current = { title, children, buttons };
  const displayed = content.current;

  return (
    <Modal
      visible={rendered}
      transparent
      animationType="none"
      onRequestClose={dismissible ? dismiss : () => {}}
      statusBarTranslucent
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { opacity: overlayAnim }]} pointerEvents="none" />
      <Pressable style={StyleSheet.absoluteFill} onPress={dismissible ? dismiss : undefined} />
      <View style={styles.center} pointerEvents={closing ? 'none' : 'box-none'}>
        <Animated.View
          style={[styles.panel, { transform: [{ scaleX: scaleXAnim }, { scaleY: scaleYAnim }] }]}
          onStartShouldSetResponder={() => true}
        >
          {/* absoluteFill: 패널 높이 결정 후 배경을 pixel corner로 clip */}
          <PixelFrame borderColor={colors.SECONDARY_200} style={StyleSheet.absoluteFill}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.DARK_300 }]} />
          </PixelFrame>
          {/* normal flow: 패널 높이 결정, z-order상 PixelFrame 위에 렌더링됨 */}
          <View sx={{ padding: spacing.LG, gap: spacing.MD }}>
            <Text variant="T2" sx={{ color: colors.SECONDARY_100 }}>
              {displayed.title}
            </Text>
            {displayed.children}
            {displayed.buttons && displayed.buttons.length > 0 && (
              <View sx={{ flexDirection: 'row', gap: 8 }}>
                {displayed.buttons.map((btn, i) => (
                  <View key={i} sx={{ flex: 1 }}>
                    <Button
                      label={btn.label}
                      color={btn.color ?? 'primary'}
                      onPress={btn.onPress}
                      disabled={closing || btn.disabled}
                      loading={btn.loading}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
          <Animated.View style={[StyleSheet.absoluteFill, styles.flash, { opacity: flashAnim }]} pointerEvents="none" />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: 'rgba(0,0,0,0.55)' },
  center: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    paddingHorizontal: spacing.MD,
  },
  panel: {},
  flash: { backgroundColor: colors.LIGHT_100 },
});
