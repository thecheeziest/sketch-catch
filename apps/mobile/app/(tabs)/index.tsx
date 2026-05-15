import styled from 'styled-components/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { PixelButton } from '@/components/PixelButton';
import { useMe } from '@/features/auth/useMe';

const Container = styled(SafeAreaView)`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.background};
  padding-horizontal: ${({ theme }) => theme.spacing.xl}px;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.lg}px;
`;

const Title = styled.Text`
  font-family: ${({ theme }) => theme.fontFamily.regular};
  font-size: ${({ theme }) => theme.typography.display.fontSize}px;
  color: ${({ theme }) => theme.colors.textPrimary};
  text-align: center;
`;

const Greeting = styled.Text`
  font-family: ${({ theme }) => theme.fontFamily.regular};
  font-size: ${({ theme }) => theme.typography.heading.fontSize}px;
  color: ${({ theme }) => theme.colors.textPrimary};
  text-align: center;
`;

export default function HomeStub(): React.JSX.Element {
  const { data: user } = useMe();
  return (
    <Container>
      <Title allowFontScaling={false}>스케치캐치</Title>
      {user ? (
        <Greeting allowFontScaling={false}>안녕하세요, {user.nickname}님</Greeting>
      ) : null}
      <Link href="/mypage" asChild>
        <PixelButton label="마이페이지" variant="secondary" />
      </Link>
    </Container>
  );
}
