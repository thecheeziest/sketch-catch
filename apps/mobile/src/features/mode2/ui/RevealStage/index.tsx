import { useEffect } from 'react';
import { View } from 'dripsy';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { Mode2RevealEntry } from '@sketch-catch/shared';
import { spacing } from '@/shared/config';
import { playFeedback } from '@/shared/lib/feedback';
import { CanvasStage } from '@/features/game/ui';
import { useRevealScene } from '../../lib/useRevealPlayback';
import { PixelSpeechBubble } from '../PixelSpeechBubble';
import { ReferenceCanvas } from '../ReferenceCanvas';
import { RevealGuesser } from '../RevealGuesser';
import { RevealPainter } from '../RevealPainter';

type Props = {
  entries: Mode2RevealEntry[];
  startedAt: number;
  characterOf: (userId: string | null | undefined) => string;
  // 실시간 발표일 때만 — 발표가 넘어갈 때마다 효과음을 낸다 (다시 보기에서는 조용히 재생)
  feedbackKey?: string;
};

// 맞히는 사람 영역 높이 고정 — 비어 있어도 스케치북 크기가 흔들리지 않게 한다
const GUESSER_AREA_HEIGHT = 112;
// 하단에서 정답을 말한 사람이 상단으로 올라오는 연출 — 상단 대기 시간(MODE2_REVEAL_MOVE_MS) 안에 끝난다
const MOVE_UP = FadeInDown.duration(400).withInitialValues({ transform: [{ translateY: 160 }] });

// 공개식 재생 영역 — 시계(30fps)는 이 컴포넌트 안에서만 돈다
export function RevealStage({ entries, startedAt, characterOf, feedbackKey }: Props) {
  const scene = useRevealScene(entries, startedAt);
  const isEntryStart = scene.phase === 'lead';

  useEffect(() => {
    if (feedbackKey && isEntryStart) playFeedback('frame', { key: `${feedbackKey}:${scene.entryIndex}:frame` });
  }, [feedbackKey, isEntryStart, scene.entryIndex]);

  return (
    <>
      <View sx={{ alignItems: 'center', gap: 12, paddingHorizontal: spacing.MD, paddingTop: spacing.SM }}>
        <Animated.View
          key={`${scene.entryIndex}:${scene.painterId ?? 'none'}`}
          entering={scene.entryIndex > 0 ? MOVE_UP : undefined}
        >
          <RevealPainter characterId={characterOf(scene.painterId)} />
        </Animated.View>
        <PixelSpeechBubble text={scene.painterText} tail="up" />
      </View>

      <View sx={{ flex: 1, paddingHorizontal: spacing.MD, paddingVertical: spacing.SM }}>
        <CanvasStage>
          <ReferenceCanvas strokes={scene.strokes} />
        </CanvasStage>
      </View>

      <View sx={{ height: GUESSER_AREA_HEIGHT, paddingHorizontal: spacing.MD, justifyContent: 'flex-end' }}>
        {scene.guesser && (
          <RevealGuesser
            key={scene.guesser.authorId}
            characterId={characterOf(scene.guesser.authorId)}
            text={scene.guesser.text}
            icon={scene.guesser.icon}
          />
        )}
      </View>
    </>
  );
}
