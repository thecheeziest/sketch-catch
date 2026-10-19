import { Text, View } from 'dripsy'
import { colors, spacing } from '@/shared/config'
import { Button } from '@/shared/ui'

type Props = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (n: number) => void
}

export function StepperField({ label, value, min, max, step = 1, onChange }: Props) {
  const canDecrement = value > min
  const canIncrement = value < max

  return (
    <View sx={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text sx={{ flex: 1, color: colors.LIGHT_500 }}>{label}</Text>
      <View sx={{ flexDirection: 'row', alignItems: 'center', gap: spacing.SM }}>
        <Button
          label="-"
          color="dark"
          textColor={colors.WHITE}
          pressedTextColor={colors.PRIMARY_300}
          height={40}
          style={{ width: 40 }}
          disabled={!canDecrement}
          onPress={() => onChange(value - step)}
        />
        <Text sx={{ color: colors.WHITE, minWidth: 32, textAlign: 'center' }}>{value}</Text>
        <Button
          label="+"
          color="dark"
          textColor={colors.WHITE}
          pressedTextColor={colors.PRIMARY_300}
          height={40}
          style={{ width: 40 }}
          disabled={!canIncrement}
          onPress={() => onChange(value + step)}
        />
      </View>
    </View>
  )
}
