import { useState } from 'react';
import { useRouter } from 'expo-router';
import styled from 'styled-components/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PixelInput } from '@/components/PixelInput';
import { PixelButton } from '@/components/PixelButton';
import { useOnboardingStore, generateRandomFriendCode } from '@/features/auth/useOnboarding';
import { nicknameSchema, friendCodeInputSchema } from '@sketch-catch/shared';

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

const FieldGap = styled.View`
  gap: ${({ theme }) => theme.spacing.md}px;
`;

export default function OnboardingStep1(): React.JSX.Element {
  const router = useRouter();

  const [nickname, setNickname] = useState('');
  const [friendCode, setFriendCode] = useState(() => generateRandomFriendCode());
  const [nicknameError, setNicknameError] = useState('');
  const [friendCodeError, setFriendCodeError] = useState('');
  // D-04: 사용자가 한 번도 수정 안 했으면 흐린 표시
  const [friendCodeFaded, setFriendCodeFaded] = useState(true);

  const handleNicknameBlur = (): void => {
    const result = nicknameSchema.safeParse(nickname);
    if (!result.success) {
      setNicknameError(result.error.issues[0]?.message ?? '닉네임을 확인해주세요.');
    } else {
      setNicknameError('');
    }
  };

  const handleFriendCodeBlur = (): void => {
    const result = friendCodeInputSchema.safeParse(friendCode);
    if (!result.success) {
      setFriendCodeError('친구코드는 5자리 영문/숫자만 입력할 수 있어요.');
    } else {
      setFriendCodeError('');
    }
  };

  const handleNext = (): void => {
    const nicknameResult = nicknameSchema.safeParse(nickname);
    const friendCodeResult = friendCodeInputSchema.safeParse(friendCode);

    const newNicknameError = nicknameResult.success
      ? ''
      : (nicknameResult.error.issues[0]?.message ?? '닉네임을 확인해주세요.');
    const newFriendCodeError = friendCodeResult.success
      ? ''
      : '친구코드는 5자리 영문/숫자만 입력할 수 있어요.';

    setNicknameError(newNicknameError);
    setFriendCodeError(newFriendCodeError);

    if (!nicknameResult.success || !friendCodeResult.success) return;

    useOnboardingStore.getState().setStep1(nickname, friendCode.toUpperCase());
    router.push('/(auth)/onboarding/step2');
  };

  return (
    <Container>
      <StepIndicator allowFontScaling={false}>1 / 2</StepIndicator>
      <Title allowFontScaling={false}>캐릭터 이름을 정해주세요</Title>
      <FieldGap>
        <PixelInput
          label="닉네임"
          hint="2~10자, 띄어쓰기 포함 가능"
          error={nicknameError}
          value={nickname}
          onChangeText={(text) => {
            setNickname(text);
            if (nicknameError) setNicknameError('');
          }}
          maxLength={10}
          showCounter
          onBlur={handleNicknameBlur}
        />
        <PixelInput
          label="친구코드"
          hint="5자리 영문/숫자 (영문 대소문자 구분 없음)"
          error={friendCodeError}
          value={friendCode}
          onChangeText={(text) => {
            setFriendCode(text);
            setFriendCodeFaded(false);
            if (friendCodeError) setFriendCodeError('');
          }}
          maxLength={5}
          autoCapitalize="characters"
          fadedValue={friendCodeFaded}
          onBlur={handleFriendCodeBlur}
        />
      </FieldGap>
      <PixelButton
        label="다음"
        variant="primary"
        onPress={handleNext}
        style={{ marginTop: 32 }}
      />
    </Container>
  );
}
