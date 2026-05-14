import { useEffect } from 'react';
import { router } from 'expo-router';
import styled from 'styled-components/native';
import { SafeAreaView } from 'react-native-safe-area-context';

const Container = styled(SafeAreaView)`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.background};
  align-items: center;
  justify-content: center;
`;

const AppName = styled.Text`
  font-family: ${({ theme }) => theme.fontFamily.regular};
  font-size: ${({ theme }) => theme.typography.display.fontSize}px;
  line-height: ${({ theme }) => theme.typography.display.lineHeight}px;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

export default function SplashRoute(): React.JSX.Element {
  useEffect(() => {
    // 짧은 노출 후 홈으로 (UI-SPEC: 정적 화면, 짧은 노출)
    const timer = setTimeout(() => {
      router.replace('/(home)');
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Container>
      <AppName allowFontScaling={false}>스케치캐치</AppName>
    </Container>
  );
}
