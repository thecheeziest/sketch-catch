import React from 'react';
import { Pressable, type PressableProps } from 'react-native';
import styled from 'styled-components/native';

type Variant = 'primary' | 'secondary' | 'outline';

type Props = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: Variant;
};

// UI-SPEC: height 48, borderRadius 0, borderWidth 2, borderColor #2C2C1E
const Container = styled(Pressable)<{ $variant: Variant }>`
  height: 48px;
  border-width: 2px;
  border-color: ${({ theme }) => theme.colors.textPrimary};
  align-items: center;
  justify-content: center;
  padding-horizontal: ${({ theme }) => theme.spacing.md}px;
  background-color: ${({ theme, $variant }) =>
    $variant === 'primary'
      ? theme.colors.accentPrimary
      : theme.colors.surface};
  ${({ theme, $variant }) =>
    $variant === 'outline'
      ? `border-color: ${theme.colors.accentSecondary};`
      : ''}
`;

const Label = styled.Text`
  font-family: ${({ theme }) => theme.fontFamily.regular};
  font-size: ${({ theme }) => theme.typography.label.fontSize}px;
  line-height: ${({ theme }) => theme.typography.label.lineHeight}px;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

export function PixelButton({ label, variant = 'secondary', ...rest }: Props): React.JSX.Element {
  return (
    <Container $variant={variant} {...rest}>
      <Label allowFontScaling={false}>{label}</Label>
    </Container>
  );
}
