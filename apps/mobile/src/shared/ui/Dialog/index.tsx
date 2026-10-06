import { Text, View } from 'dripsy'
import { colors, spacing, textSizes } from '@/shared/config';
import { type ReactNode, useCallback, useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet } from 'react-native';
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
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const scaleXAnim = useRef(new Animated.Value(0.05)).current;
  const scaleYAnim = useRef(new Animated.Value(0)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const dismiss = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    Animated.parallel([
      Animated.timing(overlayAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(scaleYAnim, {
          toValue: 0.02,
          duration: 160,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scaleXAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
      ]),
    ]).start(() => {
      closing.current = false;
      onCloseRef.current();
    });
  }, [overlayAnim, scaleXAnim, scaleYAnim]);

  useEffect(() => {
    if (visible) {
      closing.current = false;
      scaleXAnim.setValue(0.05);
      scaleYAnim.setValue(0.02);
      overlayAnim.setValue(0);
      flashAnim.setValue(0);

      Animated.parallel([
        Animated.timing(overlayAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(scaleXAnim, {
            toValue: 1,
            duration: 90,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scaleYAnim, {
            toValue: 1,
            duration: 200,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(flashAnim, { toValue: 0.85, duration: 60, useNativeDriver: true }),
          Animated.timing(flashAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
        ]),
      ]).start();
    }
  }, [visible, overlayAnim, scaleXAnim, scaleYAnim, flashAnim]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={dismissible ? dismiss : () => {}}
      statusBarTranslucent
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.overlay, { opacity: overlayAnim }]}
        pointerEvents="none"
      />
      <Pressable style={StyleSheet.absoluteFill} onPress={dismissible ? dismiss : undefined} />
      <View style={styles.center} pointerEvents="box-none">
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
              {title}
            </Text>
            {children}
            {buttons && buttons.length > 0 && (
              <View sx={{ flexDirection: 'row', gap: 8 }}>
                {buttons.map((btn, i) => (
                  <View key={i} sx={{ flex: 1 }}>
                    <Button
                      label={btn.label}
                      color={btn.color ?? 'primary'}
                      onPress={btn.onPress}
                      disabled={btn.disabled}
                      loading={btn.loading}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.flash, { opacity: flashAnim }]}
            pointerEvents="none"
          />
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
