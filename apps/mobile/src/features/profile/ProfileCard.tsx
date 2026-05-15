import React from 'react';
import { Pressable, View } from 'react-native';
import styled from 'styled-components/native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useToastStore } from '@/stores/toast';

type Props = {
  nickname: string;
  friendCode: string;
  characterId: string;
};

const Card = styled(Pressable)`
  background-color: ${({ theme }) => theme.colors.surface};
  border-width: 2px;
  border-color: ${({ theme }) => theme.colors.border};
  padding: ${({ theme }) => theme.spacing.lg}px;
  flex-direction: row;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md}px;
`;

// 캐릭터 PNG 에셋 미존재 — 단색 블록 placeholder (실 에셋 추가 시 Image 컴포넌트로 교체)
const CharacterPlaceholder = styled.View`
  width: 80px;
  height: 80px;
  background-color: ${({ theme }) => theme.colors.accentPrimary};
`;

const InfoArea = styled.View`
  flex: 1;
  flex-direction: row;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs}px;
`;

const NicknameCodeText = styled.Text`
  font-family: ${({ theme }) => theme.fontFamily.regular};
  font-size: ${({ theme }) => theme.typography.label.fontSize}px;
  line-height: ${({ theme }) => theme.typography.label.lineHeight}px;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

export function ProfileCard({ nickname, friendCode, characterId: _characterId }: Props): React.JSX.Element {
  const handlePress = async (): Promise<void> => {
    await Clipboard.setStringAsync(`${nickname}#${friendCode}`);
    useToastStore.getState().show('복사되었습니다');
  };

  return (
    <Card
      onPress={handlePress}
      style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
    >
      <CharacterPlaceholder />
      <InfoArea>
        <NicknameCodeText allowFontScaling={false}>
          {nickname}#{friendCode}
        </NicknameCodeText>
        <View>
          <Ionicons name="copy-outline" size={14} color="#7A7660" />
        </View>
      </InfoArea>
    </Card>
  );
}
