import React from 'react';
import { FlatList, Pressable } from 'react-native';
import styled from 'styled-components/native';
import { CHARACTER_IDS } from '@/constants/characters';

type Props = {
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const Cell = styled(Pressable)<{ $selected: boolean }>`
  width: 72px;
  height: 72px;
  border-width: 2px;
  border-color: ${({ theme, $selected }) =>
    $selected ? theme.colors.accentSecondary : theme.colors.border};
  background-color: ${({ theme, $selected }) =>
    $selected ? theme.colors.surface : theme.colors.background};
  align-items: center;
  justify-content: center;
  margin: ${({ theme }) => theme.spacing.xs}px;
`;

// 캐릭터 PNG 에셋 미존재 시 4색 placeholder 블록 — 실 에셋 추가 시 Image로 교체
const Placeholder = styled.View<{ $color: string }>`
  width: 60px;
  height: 60px;
  background-color: ${({ $color }) => $color};
`;

const PLACEHOLDER_COLORS = ['#C8A84B', '#7BA05B', '#C0524A', '#7A7660'];

export function CharacterGrid({ selectedId, onSelect }: Props): React.JSX.Element {
  return (
    <FlatList
      data={CHARACTER_IDS}
      numColumns={4}
      keyExtractor={(id) => id}
      contentContainerStyle={{ alignItems: 'center' }}
      renderItem={({ item, index }) => {
        const color = PLACEHOLDER_COLORS[index % PLACEHOLDER_COLORS.length]!;
        return (
          <Cell
            $selected={selectedId === item}
            onPress={() => onSelect(item)}
            style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
          >
            <Placeholder $color={color} />
          </Cell>
        );
      }}
    />
  );
}
