import MaskedView from '@react-native-masked-view/masked-view';
import { Text, View } from 'dripsy';
import { memo, useMemo, useState } from 'react';
import {
  BlendMode,
  Canvas,
  Group,
  PaintStyle,
  Paragraph,
  Skia,
  TileMode,
  useFonts,
  vec,
} from '@shopify/react-native-skia';
import Galmuri11 from '@assets/fonts/Galmuri11.ttf';
import { StyleSheet, useWindowDimensions, type StyleProp, type TextLayoutEvent, type TextStyle } from 'react-native';
import { colors, fontFamily, getChatItem } from '@/shared/config';

type Props = {
  children: string;
  itemId?: string | null;
  color?: string;
  style?: StyleProp<TextStyle>;
};

const OUTLINE_OFFSETS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const;

// 한글·이모지를 분해하지 않고 같은 너비의 Text를 겹쳐 줄바꿈과 글자 확대를 일치시킨다.
export const CosmeticChatText = memo(function CosmeticChatText({ children, itemId, color, style }: Props) {
  const item = getChatItem(itemId);
  const textStyle = [styles.text, item?.rarity === 'LEGENDARY' && !color && styles.legendaryText, style];
  const faceStyle = [textStyle, { color: color ?? item?.color ?? colors.LIGHT_100 }];
  // 정답 등의 명시적 색상은 꾸미기 효과보다 우선한다.
  if (color || !item || item.rarity !== 'LEGENDARY') return <Text style={faceStyle}>{children}</Text>;

  if (item.hollow && item.bands) {
    return (
      <HollowChatText bands={item.bands} textStyle={textStyle}>
        {children}
      </HollowChatText>
    );
  }

  return (
    <View style={styles.wrapper} accessible accessibilityRole="text" accessibilityLabel={children}>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {item.outlines?.flatMap((outline, ring) =>
          OUTLINE_OFFSETS.map(([x, y], index) => (
            <Text
              key={`outline-${ring}-${index}`}
              accessible={false}
              style={[
                textStyle,
                styles.layer,
                {
                  color: outline.color,
                  transform: [{ translateX: x * outline.width }, { translateY: y * outline.width }],
                },
              ]}
            >
              {children}
            </Text>
          )),
        )}
        {item.shadows?.map((shadow, index) => (
          <Text
            key={`shadow-${index}`}
            accessible={false}
            style={[
              textStyle,
              styles.layer,
              {
                color: shadow.color,
                transform: [{ translateX: shadow.x }, { translateY: shadow.y }],
                textShadowColor: shadow.color,
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: shadow.blur ?? 0,
              },
            ]}
          >
            {children}
          </Text>
        ))}
        <Text style={[faceStyle, item.bands && styles.measure]} accessible={false}>
          {children}
        </Text>
        {!!item.bands && (
          <MaskedView
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            androidRenderingMode="software"
            maskElement={
              <Text style={[textStyle, styles.mask]} accessible={false}>
                {children}
              </Text>
            }
          >
            <View style={styles.bands}>
              {item.bands.map((band, index) => (
                <View key={index} style={[styles.band, { backgroundColor: band }]} />
              ))}
            </View>
          </MaskedView>
        )}
      </View>
    </View>
  );
});

// 이모지는 원래 색으로 한 번만 표시하고, 외곽선 효과는 문자에만 적용한다.
const EMOJI_RUN =
  /((?:\p{Extended_Pictographic}|\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3)(?:[\uFE0F\uFE0E]|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:[\uFE0F\uFE0E]|\p{Emoji_Modifier})?)*)/u;

// 투명한 글자 내부는 배경색으로 덮지 않고 DstOut으로 지워 어느 말풍선 위에서도 비워 둔다.
function HollowChatText({
  children,
  bands,
  textStyle,
}: {
  children: string;
  bands: readonly string[];
  textStyle: StyleProp<TextStyle>;
}) {
  const fonts = useFonts({ Galmuri11: [Galmuri11] });
  const { fontScale } = useWindowDimensions();
  const [lines, setLines] = useState<TextLayoutEvent['nativeEvent']['lines']>([]);
  const fontSize = (StyleSheet.flatten(textStyle)?.fontSize ?? 13) * fontScale;
  const paragraphs = useMemo(() => {
    if (!fonts) return [];
    return lines.map(line => {
      const stroke = Skia.Paint();
      stroke.setStyle(PaintStyle.Stroke);
      stroke.setStrokeWidth(1.5);
      stroke.setShader(
        Skia.Shader.MakeLinearGradient(
          vec(0, 0),
          vec(Math.max(line.width, 1), 0),
          bands.map(band => Skia.Color(band)),
          null,
          TileMode.Clamp,
        ),
      );
      const erase = Skia.Paint();
      erase.setBlendMode(BlendMode.DstOut);
      const make = (paint: typeof stroke) => {
        const builder = Skia.ParagraphBuilder.Make({}, fonts);
        line.text
          .replace(/\n$/, '')
          .split(EMOJI_RUN)
          .forEach((run, index) => {
            if (!run) return;
            if (index % 2 === 1) {
              builder.pushStyle({ fontFamilies: ['Galmuri11'], fontSize, color: Skia.Color('transparent') });
            } else {
              builder.pushStyle({ fontFamilies: ['Galmuri11'], fontSize }, paint);
            }
            builder.addText(run).pop();
          });
        const paragraph = builder.build();
        paragraph.layout(Math.max(line.width + 32, 32));
        return paragraph;
      };
      const outline = make(stroke);
      const cutout = make(erase);
      const baseline = outline.getLineMetrics()[0]?.baseline ?? line.ascender;
      return { outline, cutout, x: line.x + 3, y: line.y + line.ascender - baseline + 3, width: line.width + 32 };
    });
  }, [fonts, lines, bands, fontSize]);

  return (
    <View style={styles.wrapper} accessible accessibilityRole="text" accessibilityLabel={children}>
      <Text
        style={[textStyle, styles.transparentText]}
        accessible={false}
        onTextLayout={event => {
          const next = event.nativeEvent.lines;
          setLines(previous => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next));
        }}
      >
        {children.split(EMOJI_RUN).map((run, index) => (
          <Text key={index} style={[textStyle, index % 2 === 1 ? styles.emoji : styles.transparentText]}>
            {run}
          </Text>
        ))}
      </Text>
      <Canvas
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {paragraphs.map((line, index) => (
          <Group key={index} layer>
            <Paragraph paragraph={line.outline} x={line.x} y={line.y} width={line.width} />
            <Paragraph paragraph={line.cutout} x={line.x} y={line.y} width={line.width} />
          </Group>
        ))}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  text: { fontFamily: fontFamily.REGULAR, fontSize: 13, lineHeight: 20, flexShrink: 1 },
  legendaryText: { lineHeight: 22 },
  // 2px 외곽선·그림자를 레이아웃 안에 확보해 말풍선과 목록 가장자리에서 잘리지 않게 한다.
  wrapper: { flexShrink: 1, minWidth: 0, padding: 3 },
  layer: { position: 'absolute', top: 0, left: 0, right: 0 },
  measure: { opacity: 0 },
  transparentText: { color: 'transparent' },
  emoji: { color: '#FFFFFF' },
  mask: { color: '#000000', textShadowColor: 'transparent' },
  bands: { flex: 1 },
  band: { flex: 1 },
});
