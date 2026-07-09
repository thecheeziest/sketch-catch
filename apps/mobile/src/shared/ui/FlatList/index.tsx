import React from 'react'
import { FlatList as DripsyFlatList } from 'dripsy'
import type { FlatListProps } from 'react-native'

// dripsy FlatList 빌드 타입이 ItemT를 unknown으로 고정해 제네릭을 잃는다.
// 이 wrapper가 올바른 ItemT를 노출하면서 내부적으로 dripsy로 위임한다.
type DripsySxProp = React.ComponentProps<typeof DripsyFlatList>['sx']
type Props<T> = FlatListProps<T> & { sx?: DripsySxProp }

export function FlatList<T>(props: Props<T>) {
  return <DripsyFlatList {...(props as any)} />
}
