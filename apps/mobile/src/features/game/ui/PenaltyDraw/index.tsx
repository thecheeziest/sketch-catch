import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Image, Text, View } from 'dripsy';
import { AccessibilityInfo, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Canvas, LinearGradient, Oval, Path, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { PixelFrame } from '@/shared/ui/PixelFrame';
import { resultOverlay } from '@/features/game/config';
import { PixelChip, PixelSlab } from '@/features/game/ui/PixelSlab';
import { colors, fontFamily, getCharacterImageSource, spacing, textSizes } from '@/shared/config';
import type { PenaltyAwardPlayer } from '@/features/game/ui/PenaltyAward';
import { usePenaltyDrawTimeline } from '@/features/game/lib/usePenaltyDrawTimeline';
import {
  DRAW_LABEL_HEIGHT,
  DRAW_STAGE_HEIGHT,
  getDrawGeometry,
  groupDrawPlayers,
  layoutDrawSlots,
  type DrawGeometry,
  type DrawSlot,
} from '@/features/game/lib/penaltyDrawLayout';
import type { PenaltyDrawPhase } from '@/features/game/lib/penaltyDrawTimeline';

type Props = {
  text: string;
  // ranking 순서
  players: PenaltyAwardPlayer[];
  candidateIds: string[];
  loserIds: string[];
};

type SpotTarget = { x: number; final: boolean };

const CARD_TOP = spacing.SM;
const CARD_HEIGHT = 64;
const CONE_HALF_WIDTH = 80;
const MOVE_SPRING = { damping: 11, stiffness: 120 };
const DARK_PHASES: PenaltyDrawPhase[] = ['dark', 'cycle', 'pause', 'reveal'];
const PROMOTED_PHASES: PenaltyDrawPhase[] = ['promote', 'done'];
const TEXT_SHADOW = { textShadowColor: colors.BLACK, textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0 };
const SPOT_COLORS = {
  normal: { cone: ['rgba(255,244,200,0.04)', 'rgba(255,240,180,0.40)'], pool: 'rgba(255,236,160,0.55)' },
  final: { cone: ['rgba(255,120,100,0.10)', 'rgba(255,210,190,0.62)'], pool: 'rgba(255,140,120,0.75)' },
} as const;

type DrawCharacterProps = {
  player: PenaltyAwardPlayer;
  slot: DrawSlot;
  lit: boolean;
  despair: boolean;
  hop: boolean;
  tagged: boolean;
  litNameColor: boolean;
};

function DrawCharacter({ player, slot, lit, despair, hop, tagged, litNameColor }: DrawCharacterProps) {
  const x = useSharedValue(slot.centerX);
  const y = useSharedValue(slot.stageY);
  const size = useSharedValue(slot.size);
  const wobble = useSharedValue(0);
  const jump = useSharedValue(0);
  const imageSource = getCharacterImageSource(player.characterId);
  const dimmed = player.left || player.waiting === true;

  // 단상 이동 — 첫 배치는 즉시, 이후 변경은 스프링으로
  useEffect(() => {
    x.value = withSpring(slot.centerX, MOVE_SPRING);
    y.value = withSpring(slot.stageY, MOVE_SPRING);
    size.value = withSpring(slot.size, MOVE_SPRING);
  }, [slot.centerX, slot.stageY, slot.size, x, y, size]);

  // 최종 꼴등 — 고개 숙이고 흔들린다
  useEffect(() => {
    if (!despair) return undefined;
    wobble.value = withRepeat(withSequence(withTiming(1, { duration: 450 }), withTiming(0.5, { duration: 450 })), -1);
    return () => cancelAnimation(wobble);
  }, [despair, wobble]);

  // 생존 단상으로 올라갈 때 한 번 점프
  useEffect(() => {
    if (!hop) return;
    jump.value = withSequence(withTiming(-22, { duration: 260 }), withTiming(0, { duration: 260 }));
  }, [hop, jump]);

  const boxStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value - slot.boxWidth / 2 },
      { translateY: y.value - DRAW_LABEL_HEIGHT - size.value + jump.value },
    ],
  }));
  const imageStyle = useAnimatedStyle(() => ({
    width: size.value,
    height: size.value,
    transform: [{ rotate: `${wobble.value * -8}deg` }, { translateY: wobble.value * 6 }],
  }));

  const nameColor = litNameColor ? colors.ERROR_200 : colors.LIGHT_100;
  const scoreColor = litNameColor ? colors.ERROR_200 : colors.LIGHT_500;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.character, { width: slot.boxWidth, zIndex: lit ? 30 : 10, opacity: dimmed ? 0.35 : 1 }, boxStyle]}
    >
      {tagged && (
        <View sx={{ position: 'absolute', top: -18, backgroundColor: colors.ERROR_400, paddingHorizontal: 6 }}>
          <Text sx={{ ...textSizes.B4, fontFamily: fontFamily.REGULAR, color: colors.WHITE }}>벌칙</Text>
        </View>
      )}
      <Text sx={{ fontFamily: fontFamily.REGULAR, fontSize: 11, lineHeight: 16, color: nameColor }} numberOfLines={1}>
        {player.nickname}
      </Text>
      <Text sx={{ ...textSizes.B4, fontFamily: fontFamily.REGULAR, color: scoreColor }}>{player.score}점</Text>
      <Animated.View style={imageStyle}>
        {imageSource !== null ? (
          <Image source={imageSource} sx={{ width: '100%', height: '100%' }} resizeMode="contain" />
        ) : (
          <View sx={{ width: '100%', height: '100%', backgroundColor: colors.SECONDARY_400 }} />
        )}
      </Animated.View>
    </Animated.View>
  );
}

function SpotlightLayer({ targets, coneTop, poolY }: { targets: SpotTarget[]; coneTop: number; poolY: number }) {
  return (
    <Canvas style={[StyleSheet.absoluteFill, styles.spotlight]} pointerEvents="none">
      {targets.map(({ x, final }) => {
        const palette = final ? SPOT_COLORS.final : SPOT_COLORS.normal;
        const cone = `M ${x - 6} ${coneTop} L ${x + 6} ${coneTop} L ${x + CONE_HALF_WIDTH} ${poolY} L ${x - CONE_HALF_WIDTH} ${poolY} Z`;
        return [
          <Path key={`cone-${x}`} path={cone}>
            <LinearGradient start={vec(x, coneTop)} end={vec(x, poolY)} colors={[...palette.cone]} />
          </Path>,
          <Oval key={`pool-${x}`} x={x - 72} y={poolY - 14} width={144} height={28}>
            <RadialGradient c={vec(x, poolY)} r={72} colors={[palette.pool, 'rgba(0,0,0,0)']} />
          </Oval>,
          <Rect
            key={`lamp-${x}`}
            x={x - 14}
            y={coneTop - 12}
            width={28}
            height={12}
            color={final ? colors.ERROR_300 : colors.WARNING_200}
          />,
        ];
      })}
    </Canvas>
  );
}

function IntroBanner() {
  const shake = useSharedValue(0);
  const scale = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 7, stiffness: 220 });
    shake.value = withSequence(
      withTiming(-6, { duration: 60 }),
      withTiming(6, { duration: 60 }),
      withTiming(-4, { duration: 60 }),
      withTiming(4, { duration: 60 }),
      withTiming(0, { duration: 60 }),
    );
  }, [scale, shake]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }, { scale: scale.value }] }));

  return (
    <Animated.View style={style}>
      <Text sx={{ ...sxStyles.banner, color: colors.ERROR_300, ...TEXT_SHADOW }}>
        {'최종 꼴등 뽑기를\n진행합니다..!'}
      </Text>
    </Animated.View>
  );
}

function DrumText() {
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 180 }), -1, true);
    return () => cancelAnimation(opacity);
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={style}>
      <Text sx={{ fontFamily: fontFamily.REGULAR, ...textSizes.B1, color: colors.WARNING_200, ...TEXT_SHADOW }}>
        두구두구두구...
      </Text>
    </Animated.View>
  );
}

function PopIn({ children }: { children: ReactNode }) {
  const scale = useSharedValue(0.2);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 8, stiffness: 200 });
  }, [scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return <Animated.View style={[styles.center, style]}>{children}</Animated.View>;
}

function Flash() {
  const opacity = useSharedValue(0.9);

  useEffect(() => {
    opacity.value = withTiming(0, { duration: 380 });
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, style]} />;
}

/** 벌칙 방 꼴등 추첨 — 경계 동점자에게 핀 조명을 돌린 뒤 서버가 뽑은 꼴등을 공개하고, 나머지는 생존 단상으로 올린다. */
export function PenaltyDraw({ text, players, candidateIds, loserIds }: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const groups = useMemo(
    () =>
      groupDrawPlayers(
        players.map(p => p.userId),
        candidateIds,
        loserIds,
      ),
    [players, candidateIds, loserIds],
  );
  const { phase, spot } = usePenaltyDrawTimeline(groups.candidateIds.length);
  const promoted = PROMOTED_PHASES.includes(phase);
  const dark = DARK_PHASES.includes(phase);
  const revealed = phase === 'reveal' || promoted;

  const geometry: DrawGeometry = useMemo(() => getDrawGeometry(size.width, size.height), [size]);
  const beforeSlots = useMemo(() => layoutDrawSlots(groups, geometry, false), [groups, geometry]);
  const slots = promoted ? layoutDrawSlots(groups, geometry, true) : beforeSlots;

  const pickedNames = players
    .filter(p => groups.pickedIds.includes(p.userId))
    .map(p => p.nickname)
    .join(', ');
  const candidateScore = players.find(p => p.userId === groups.candidateIds[0])?.score ?? 0;

  // 결과 공개를 스크린리더에도 알린다
  const announced = useRef(false);
  useEffect(() => {
    if (phase !== 'reveal' || announced.current) return;
    announced.current = true;
    AccessibilityInfo.announceForAccessibility(`진짜 꼴등은 ${pickedNames}`);
  }, [phase, pickedNames]);

  const overlay = useSharedValue(0);
  useEffect(() => {
    let target = 0;
    if (dark) target = phase === 'reveal' ? 0.9 : 0.86;
    overlay.value = withTiming(target, { duration: 80 });
  }, [dark, phase, overlay]);
  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.value }));

  const spotTargets: SpotTarget[] = (() => {
    if (phase === 'cycle' && spot >= 0) {
      const slot = beforeSlots.get(groups.candidateIds[spot] ?? '');
      return slot ? [{ x: slot.centerX, final: false }] : [];
    }
    if (phase !== 'reveal') return [];
    return groups.pickedIds.flatMap(id => {
      const slot = beforeSlots.get(id);
      return slot ? [{ x: slot.centerX, final: true }] : [];
    });
  })();

  const isLit = (userId: string) => {
    if (phase === 'cycle') return groups.candidateIds[spot] === userId;
    return phase === 'reveal' && groups.pickedIds.includes(userId);
  };

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize(prev => (prev.width === width && prev.height === height ? prev : { width, height }));
  };

  const messageTop = geometry.topStage.y + DRAW_STAGE_HEIGHT + spacing.SM;
  const messageBottom = size.height - geometry.bottomStage.y + 68 + DRAW_LABEL_HEIGHT + spacing.SM;

  return (
    <View sx={{ flex: 1 }} onLayout={onLayout}>
      {size.width > 0 && (
        <>
          <View style={[styles.card, { top: CARD_TOP, height: CARD_HEIGHT }]}>
            <PixelFrame borderColor={colors.WARNING_300} borderWidth={2} style={StyleSheet.absoluteFill}>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.BLACK }]} />
            </PixelFrame>
            <View sx={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.MD }}>
              <Text variants={['bold', 'B3']} sx={{ color: colors.WARNING_300 }}>
                오늘의 벌칙
              </Text>
              <Text sx={{ ...textSizes.B1, color: colors.LIGHT_100, textAlign: 'center' }} numberOfLines={1}>
                {text}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.stage,
              { left: geometry.topStage.x, top: geometry.topStage.y, width: geometry.topStage.width },
              styles.safeStage,
            ]}
          >
            <View style={[styles.stageEdge, { backgroundColor: colors.SECONDARY_200 }]} />
          </View>
          <View
            style={[
              styles.stage,
              { left: geometry.bottomStage.x, top: geometry.bottomStage.y, width: geometry.bottomStage.width },
              styles.loserStage,
            ]}
          >
            <View style={[styles.stageEdge, { backgroundColor: colors.ERROR_300 }]} />
          </View>
          <Text
            sx={{ ...sxStyles.caption, top: geometry.bottomStage.y + DRAW_STAGE_HEIGHT + spacing.XS }}
            numberOfLines={1}
          >
            {`동점 ${candidateScore}점 ${groups.candidateIds.length}명 중 ${groups.pickedIds.length}명 벌칙`}
          </Text>

          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.overlay, overlayStyle]} />
          <SpotlightLayer
            targets={spotTargets}
            coneTop={CARD_TOP + CARD_HEIGHT + 12}
            poolY={geometry.bottomStage.y + 4}
          />

          {players.map(player => {
            const slot = slots.get(player.userId);
            if (!slot) return null;
            const picked = groups.pickedIds.includes(player.userId);
            return (
              <DrawCharacter
                key={player.userId}
                player={player}
                slot={slot}
                lit={isLit(player.userId)}
                despair={revealed && picked}
                hop={promoted && groups.survivorIds.includes(player.userId)}
                tagged={groups.sureLoserIds.includes(player.userId) || (promoted && picked)}
                litNameColor={revealed && picked}
              />
            );
          })}

          <View pointerEvents="none" style={[styles.message, { top: messageTop, bottom: messageBottom }]}>
            {(phase === 'intro' || phase === 'dark') && <IntroBanner />}
            {(phase === 'cycle' || phase === 'pause') && <DrumText />}
            {phase === 'reveal' && (
              <PopIn>
                <PixelSlab
                  bg={resultOverlay.WRONG.ACCENT}
                  footColor={resultOverlay.WRONG.ACCENT_DARK}
                  footHeight={6}
                  paddingH={18}
                  paddingV={11}
                >
                  <Text style={{ fontFamily: fontFamily.BOLD, fontSize: 21, color: resultOverlay.WRONG.ON_ACCENT }}>
                    진짜 꼴등을 소개합니다!
                  </Text>
                </PixelSlab>
                <PixelChip bg={resultOverlay.WRONG.CHIP_BG} paddingH={10} paddingV={5}>
                  <Text style={{ fontFamily: fontFamily.REGULAR, fontSize: 12, color: resultOverlay.WRONG.CHIP_FG }}>
                    {pickedNames}
                  </Text>
                </PixelChip>
              </PopIn>
            )}
            {promoted && (
              <PopIn>
                <Text sx={{ fontFamily: fontFamily.REGULAR, ...textSizes.B1, color: colors.LIGHT_100, ...TEXT_SHADOW }}>
                  <Text sx={{ color: colors.ERROR_200 }}>{pickedNames}</Text> 벌칙 당첨!
                </Text>
              </PopIn>
            )}
          </View>

          {phase === 'reveal' && <Flash />}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { position: 'absolute', left: spacing.MD, right: spacing.MD },
  stage: {
    position: 'absolute',
    height: DRAW_STAGE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 단상 윗면 하이라이트
  stageEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  safeStage: { backgroundColor: colors.SECONDARY_500 },
  loserStage: { backgroundColor: colors.DARK_100 },
  overlay: { backgroundColor: colors.DARK_500, zIndex: 20 },
  spotlight: { zIndex: 22 },
  character: { position: 'absolute', left: 0, top: 0, alignItems: 'center' },
  message: {
    position: 'absolute',
    left: spacing.MD,
    right: spacing.MD,
    zIndex: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: { alignItems: 'center', gap: spacing.SM },
  flash: { backgroundColor: colors.WHITE, zIndex: 45 },
});

const sxStyles = {
  banner: { fontFamily: fontFamily.BOLD, fontSize: 22, lineHeight: 32, textAlign: 'center' },
  caption: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: fontFamily.REGULAR,
    ...textSizes.B4,
    color: colors.LIGHT_500,
  },
} as const;
