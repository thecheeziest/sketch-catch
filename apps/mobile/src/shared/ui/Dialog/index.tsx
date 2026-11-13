import { type ReactNode, useEffect, useRef } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet } from 'react-native';
import { Text, View } from 'dripsy';
import { KeyboardAvoidingView, useKeyboardState } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/shared/config';
import { useTvDialog } from '@/shared/lib/useTvDialog';
import { PixelFrame } from '../PixelFrame';
import { Button, type ButtonColor } from '../Button';

// 키보드와 패널 사이 여백
const KEYBOARD_GAP = spacing.MD;
// 패널 안 KeyboardAwareScrollView의 bottomOffset (커서 기준이라 입력창 절반 높이 포함)
export const DIALOG_KEYBOARD_OFFSET = KEYBOARD_GAP + spacing.LG + spacing.XL;

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
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardState(state => state.isVisible);
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
      {/* 키보드가 올라오면 키보드 위 영역 안에서 패널을 가운데 정렬한다 */}
      <KeyboardAvoidingView behavior="padding" style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View
          style={[
            styles.center,
            {
              paddingTop: Math.max(insets.top, spacing.XL),
              paddingBottom: keyboardVisible ? KEYBOARD_GAP : Math.max(insets.bottom, spacing.XL),
            },
          ]}
          pointerEvents={closing ? 'none' : 'box-none'}
        >
          {/* 패널이 터치를 가져가면 iOS가 안쪽 ScrollView 스크롤을 막는다 — 배경 Pressable은 형제 뷰라 패널 터치로 닫히지 않는다 */}
          <Animated.View style={[styles.panel, { transform: [{ scaleX: scaleXAnim }, { scaleY: scaleYAnim }] }]}>
            {/* absoluteFill: 패널 높이 결정 후 배경을 pixel corner로 clip */}
            <PixelFrame borderColor={colors.SECONDARY_200} style={StyleSheet.absoluteFill}>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.DARK_300 }]} />
            </PixelFrame>
            {/* normal flow: 패널 높이 결정, z-order상 PixelFrame 위에 렌더링됨 */}
            <View sx={{ flexShrink: 1, padding: spacing.LG, gap: spacing.MD }}>
              <View
                sx={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.SM }}
              >
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
            <Animated.View
              style={[StyleSheet.absoluteFill, styles.flash, { opacity: flashAnim }]}
              pointerEvents="none"
            />
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: 'rgba(0,0,0,0.55)' },
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.MD,
  },
  // 화면(키보드 제외)보다 길면 패널을 줄여 안쪽 스크롤로 넘긴다
  panel: { flexShrink: 1 },
  flash: { backgroundColor: colors.LIGHT_100 },
});
