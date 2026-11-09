import { type ReactNode, useEffect, useRef } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet } from 'react-native';
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
  headerRight?: ReactNode;
  children?: ReactNode;
  buttons?: DialogButton[];
  dismissible?: boolean; // false면 백드롭 탭/하드웨어 뒤로가기로 닫히지 않음 (기본 true)
  // 네이티브 모달까지 완전히 닫힌 뒤 호출 — iOS는 모달이 닫히는 중에 다른 모달을 띄우면 무시되므로 이어서 열 때 쓴다
  onDismissed?: () => void;
};

export function Dialog({
  visible,
  onClose,
  title,
  headerRight,
  children,
  buttons,
  dismissible = true,
  onDismissed,
}: Props) {
  const { rendered, closing, dismiss, overlayAnim, scaleXAnim, scaleYAnim, flashAnim } = useTvDialog(visible, onClose);
  // Android Modal은 onDismiss를 지원하지 않아 렌더가 끝나는 시점을 닫힘 완료로 본다
  const wasRendered = useRef(rendered);
  useEffect(() => {
    if (Platform.OS === 'android' && wasRendered.current && !rendered) onDismissed?.();
    wasRendered.current = rendered;
  }, [rendered, onDismissed]);
  // 부모가 선택값·입력값을 지워도 TV가 꺼지는 동안 마지막 화면을 유지한다.
  const content = useRef({ title, headerRight, children, buttons });
  if (visible && !closing) content.current = { title, headerRight, children, buttons };
  const displayed = content.current;

  return (
    <Modal
      visible={rendered}
      transparent
      animationType="none"
      onRequestClose={dismissible ? dismiss : () => {}}
      onDismiss={onDismissed}
      statusBarTranslucent
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { opacity: overlayAnim }]} pointerEvents="none" />
      <Pressable style={StyleSheet.absoluteFill} onPress={dismissible ? dismiss : undefined} />
      <View style={styles.center} pointerEvents={closing ? 'none' : 'box-none'}>
        {/* 패널이 터치를 가져가면 iOS가 안쪽 ScrollView 스크롤을 막는다 — 배경 Pressable은 형제 뷰라 패널 터치로 닫히지 않는다 */}
        <Animated.View style={[styles.panel, { transform: [{ scaleX: scaleXAnim }, { scaleY: scaleYAnim }] }]}>
          {/* absoluteFill: 패널 높이 결정 후 배경을 pixel corner로 clip */}
          <PixelFrame borderColor={colors.SECONDARY_200} style={StyleSheet.absoluteFill}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.DARK_300 }]} />
          </PixelFrame>
          {/* normal flow: 패널 높이 결정, z-order상 PixelFrame 위에 렌더링됨 */}
          <View sx={{ padding: spacing.LG, gap: spacing.MD }}>
            <View sx={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.SM }}>
              <Text variant="T2" sx={{ color: colors.SECONDARY_100, flexShrink: 1 }}>
                {displayed.title}
              </Text>
              {displayed.headerRight}
            </View>
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
