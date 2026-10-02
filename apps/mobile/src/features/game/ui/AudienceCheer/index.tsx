import { useEffect } from 'react';
import { Image, ScrollView, Text, View } from 'dripsy';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors, fontFamily, getCharacterImageSource, spacing, textSizes } from '@/shared/config';

export type AudiencePlayer = {
  userId: string;
  nickname: string;
  characterId: string;
  rank: number;
  score: number;
  left: boolean;
};

type Props = {
  /** 순위권(1~3위) 밖 플레이어 목록 — 방청석처럼 응원봉을 흔드는 연출로 표시 */
  players: AudiencePlayer[];
};

const STICK_COLORS = [
  colors.PRIMARY_300,
  colors.INFO_300,
  colors.ACCENT_300,
  colors.WARNING_300,
  colors.SECONDARY_300,
];

function CheerStick({ index, dimmed }: { index: number; dimmed: boolean }) {
  const swing = useSharedValue(0);

  useEffect(() => {
    if (dimmed) return undefined;
    swing.value = withDelay(
      index * 120,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 380, easing: Easing.inOut(Easing.quad) }),
          withTiming(-1, { duration: 380, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      ),
    );
    return undefined;
  }, [swing, index, dimmed]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${swing.value * 22}deg` }] }));

  return (
    <Animated.View
      style={[styles.stick, style, { backgroundColor: STICK_COLORS[index % STICK_COLORS.length] }]}
    />
  );
}

function AudienceCard({ player, index }: { player: AudiencePlayer; index: number }) {
  const bob = useSharedValue(0);

  useEffect(() => {
    if (player.left) return undefined;
    bob.value = withDelay(
      index * 90,
      withRepeat(withSequence(withTiming(-4, { duration: 420 }), withTiming(0, { duration: 420 })), -1, true),
    );
    return undefined;
  }, [bob, index, player.left]);

  const bobStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value }] }));
  const imageSource = getCharacterImageSource(player.characterId);

  return (
    <View sx={{ alignItems: 'center', width: 64, marginHorizontal: spacing.XS }}>
      <CheerStick index={index} dimmed={player.left} />
      <Animated.View style={bobStyle}>
        {imageSource !== null ? (
          <Image
            source={imageSource}
            sx={{ width: 40, height: 40, opacity: player.left ? 0.35 : 1 }}
            resizeMode="contain"
          />
        ) : (
          <View sx={{ width: 40, height: 40, backgroundColor: colors.SECONDARY_400, opacity: player.left ? 0.35 : 1 }} />
        )}
      </Animated.View>
      <Text
        sx={{ fontFamily: fontFamily.REGULAR, fontSize: 10, color: player.left ? colors.GRAY : colors.LIGHT_100, marginTop: 2 }}
        numberOfLines={1}
      >
        {player.rank}위 {player.nickname}
      </Text>
      <Text sx={{ ...textSizes.B4, color: player.left ? colors.GRAY : colors.ACCENT_300 }}>{player.score}점</Text>
    </View>
  );
}

/** 순위권 밖 참가자를 관중석처럼 늘어세워 응원봉을 흔드는 애니메이션으로 보여준다. */
export function AudienceCheer({ players }: Props) {
  if (players.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      sx={{ height: 100 }}
      contentContainerSx={{ alignItems: 'flex-end', paddingHorizontal: spacing.MD }}
    >
      {players.map((p, i) => (
        <AudienceCard key={p.userId} player={p} index={i} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stick: {
    width: 4,
    height: 20,
    borderRadius: 2,
    marginBottom: 2,
  },
});
