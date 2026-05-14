import styled from 'styled-components/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PixelButton } from '@/components/PixelButton';

const Container = styled(SafeAreaView)`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.background};
  justify-content: center;
  padding-horizontal: ${({ theme }) => theme.spacing.xl}px;
`;

const ButtonStack = styled.View`
  gap: ${({ theme }) => theme.spacing.md}px;
`;

export default function HomeScreen(): React.JSX.Element {
  // UI-SPEC: 버튼은 onPress 핸들러 없이 렌더링만 (더미)
  return (
    <Container>
      <ButtonStack>
        <PixelButton label="로그인" variant="secondary" />
        <PixelButton label="방 만들기" variant="primary" />
        <PixelButton label="방 입장" variant="outline" />
      </ButtonStack>
    </Container>
  );
}
