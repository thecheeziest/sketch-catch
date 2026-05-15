import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import styled from 'styled-components/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SocialButton } from '@/components/SocialButton';
import { useKakaoLogin } from '@/features/auth/useKakaoLogin';
import { useAppleLogin } from '@/features/auth/useAppleLogin';
import { useToastStore } from '@/stores/toast';

const Container = styled(SafeAreaView)`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.background};
  padding-horizontal: ${({ theme }) => theme.spacing.xl}px;
`;

const LogoArea = styled.View`
  flex: 6;
  align-items: center;
  justify-content: center;
`;

const AppName = styled.Text`
  font-family: ${({ theme }) => theme.fontFamily.regular};
  font-size: ${({ theme }) => theme.typography.display.fontSize}px;
  line-height: ${({ theme }) => theme.typography.display.lineHeight}px;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const ButtonArea = styled.View`
  flex: 4;
  gap: ${({ theme }) => theme.spacing.sm}px;
  justify-content: center;
`;

export default function LoginScreen(): React.JSX.Element {
  const router = useRouter();

  const kakaoLogin = useKakaoLogin();
  const appleLogin = useAppleLogin();

  const handleLoginSuccess = (needsOnboarding: boolean): void => {
    if (needsOnboarding) {
      router.replace('/(auth)/onboarding/step1');
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleError = (err: Error): void => {
    useToastStore.getState().show(err.message || '연결에 실패했어요. 잠시 후 다시 시도해주세요.');
  };

  return (
    <Container>
      <LogoArea>
        <AppName allowFontScaling={false}>스케치캐치</AppName>
      </LogoArea>
      <ButtonArea>
        <SocialButton
          provider="kakao"
          disabled={kakaoLogin.isPending}
          onPress={() => {
            kakaoLogin.mutate(undefined, {
              onSuccess: (data) => handleLoginSuccess(data.needsOnboarding),
              onError: handleError,
            });
          }}
        />
        {Platform.OS === 'ios' && (
          <SocialButton
            provider="apple"
            disabled={appleLogin.isPending}
            onPress={() => {
              appleLogin.mutate(undefined, {
                onSuccess: (data) => handleLoginSuccess(data.needsOnboarding),
                onError: handleError,
              });
            }}
          />
        )}
      </ButtonArea>
    </Container>
  );
}
