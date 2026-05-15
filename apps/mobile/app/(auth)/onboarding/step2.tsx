import { useState } from 'react';
import { useRouter } from 'expo-router';
import styled from 'styled-components/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CharacterGrid } from '@/components/CharacterGrid';
import { PixelButton } from '@/components/PixelButton';
import { useUpdateMe } from '@/features/auth/useUpdateMe';
import { useOnboardingStore } from '@/features/auth/useOnboarding';
import { useToastStore } from '@/stores/toast';
import { ApiError } from '@/services/api';

const Container = styled(SafeAreaView)`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.background};
  padding-horizontal: ${({ theme }) => theme.spacing.xl}px;
`;

const StepIndicator = styled.Text`
  font-family: ${({ theme }) => theme.fontFamily.regular};
  font-size: ${({ theme }) => theme.typography.body.fontSize}px;
  line-height: ${({ theme }) => theme.typography.body.lineHeight}px;
  color: ${({ theme }) => theme.colors.textSecondary};
  text-align: right;
  margin-top: ${({ theme }) => theme.spacing.md}px;
`;

const Title = styled.Text`
  font-family: ${({ theme }) => theme.fontFamily.regular};
  font-size: ${({ theme }) => theme.typography.heading.fontSize}px;
  line-height: ${({ theme }) => theme.typography.heading.lineHeight}px;
  color: ${({ theme }) => theme.colors.textPrimary};
  margin-top: ${({ theme }) => theme.spacing['2xl']}px;
  margin-bottom: ${({ theme }) => theme.spacing.lg}px;
`;

export default function OnboardingStep2(): React.JSX.Element {
  const router = useRouter();
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const updateMe = useUpdateMe();

  const handleStart = (): void => {
    if (!selectedCharacterId) return;

    const { nickname, friendCode } = useOnboardingStore.getState();

    updateMe.mutate(
      { nickname, friendCode, characterId: selectedCharacterId },
      {
        onSuccess: () => {
          useOnboardingStore.getState().reset();
          router.replace('/(tabs)');
        },
        onError: (err) => {
          if (err instanceof ApiError && err.code === 'NICKNAME_CODE_CONFLICT') {
            useToastStore
              .getState()
              .show('이미 사용 중인 닉네임+코드 조합이에요. 코드를 바꿔보세요.');
            router.back();
          } else {
            useToastStore
              .getState()
              .show('연결에 실패했어요. 잠시 후 다시 시도해주세요.');
          }
        },
      }
    );
  };

  return (
    <Container>
      <StepIndicator allowFontScaling={false}>2 / 2</StepIndicator>
      <Title allowFontScaling={false}>캐릭터를 선택해주세요</Title>
      <CharacterGrid selectedId={selectedCharacterId} onSelect={setSelectedCharacterId} />
      <PixelButton
        label="시작하기"
        variant="primary"
        disabled={!selectedCharacterId || updateMe.isPending}
        onPress={handleStart}
        style={[{ marginTop: 32 }, !selectedCharacterId ? { opacity: 0.4 } : null]}
      />
    </Container>
  );
}
