import { FontAwesome } from '@expo/vector-icons'
import { Text } from 'dripsy'
import { Pressable } from 'react-native'
import { fontFamily } from '@/shared/config'

// TEXT_ICONS: Mona 픽셀 폰트로 렌더링되는 ASCII 문자
const TEXT_ICONS = {
  ADD_FRIEND: '+',
  BACK: '<',
  CHEVRON_RIGHT: '>',
  CLOSE: 'X',
} as const

// FA_ICONS: FontAwesome 벡터 아이콘 (이모지 대체)
const FA_ICONS = {
  HOME: 'home',
  FRIENDS: 'users',
  SETTINGS: 'cog',
  LOCK: 'lock',
  LOCK_OPEN: 'unlock',
  COPY: 'clone',
  ERASER: 'eraser',
  TRASH: 'trash',
  UNDO: 'undo',
} as const

export type IconName = keyof typeof TEXT_ICONS | keyof typeof FA_ICONS

type Props = {
  name: IconName
  size?: number
  color?: string
  opacity?: number
  onPress?: () => void
}

function IconContent({ name, size = 24, color = '#FAFAF0', opacity = 1 }: Omit<Props, 'onPress'>) {
  if (name in TEXT_ICONS) {
    return (
      <Text
        sx={{ fontFamily: fontFamily.BOLD, fontSize: size, lineHeight: size, opacity, color }}
        // Mona 픽셀 폰트는 em box 상단에 글리프가 치우쳐 있어 수동 보정 필요
        style={{ includeFontPadding: false, marginTop: Math.round(size * 0.2) }}
        allowFontScaling={false}
      >
        {TEXT_ICONS[name as keyof typeof TEXT_ICONS]}
      </Text>
    )
  }
  return (
    <FontAwesome
      name={FA_ICONS[name as keyof typeof FA_ICONS]}
      size={size}
      color={color}
      style={{ opacity }}
    />
  )
}

export function Icon({ name, size = 24, color = '#FAFAF0', opacity = 1, onPress }: Props) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} hitSlop={8}>
        <IconContent name={name} size={size} color={color} opacity={opacity} />
      </Pressable>
    )
  }
  return <IconContent name={name} size={size} color={color} opacity={opacity} />
}
