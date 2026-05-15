import React from 'react'
import { View, StyleSheet } from 'react-native'

type PresenceStatus = 'ONLINE' | 'OFFLINE' | 'IN_GAME'

const DOT_COLOR: Record<PresenceStatus, string> = {
  ONLINE: '#4CAF50',
  OFFLINE: '#9E9E9E',
  IN_GAME: '#C8A84B',
}

type Props = { status: PresenceStatus }

export function PresenceDot({ status }: Props): React.JSX.Element {
  return <View style={[styles.dot, { backgroundColor: DOT_COLOR[status] }]} />
}

const styles = StyleSheet.create({
  dot: { width: 10, height: 10, borderRadius: 5 },
})
