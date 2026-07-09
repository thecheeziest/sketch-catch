import { View } from 'dripsy'

type PresenceStatus = 'ONLINE' | 'OFFLINE' | 'IN_LOBBY' | 'IN_GAME'

const DOT_COLOR: Record<PresenceStatus, string> = {
  ONLINE: '#4CAF50',
  OFFLINE: '#9E9E9E',
  IN_LOBBY: '#3377FF',
  IN_GAME: '#C8A84B',
}

type Props = { status: PresenceStatus }

export function PresenceDot({ status }: Props) {
  return <View sx={{ width: 10, height: 10, borderRadius: 5, backgroundColor: DOT_COLOR[status] }} />
}
