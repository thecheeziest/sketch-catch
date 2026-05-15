import React, { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import styled from 'styled-components/native';

type Props = {
  label?: string;
  hint?: string;
  error?: string;
  value: string;
  onChangeText: (text: string) => void;
  maxLength?: number;
  showCounter?: boolean;
  placeholder?: string;
  fadedValue?: boolean; // D-04: 친구코드 초기값 흐린 표시
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoCorrect?: boolean;
  onBlur?: () => void;
};

type InputState = 'default' | 'focus' | 'error';

const Wrap = styled.View`
  gap: ${({ theme }) => theme.spacing.xs}px;
`;

const LabelText = styled.Text`
  font-family: ${({ theme }) => theme.fontFamily.regular};
  font-size: ${({ theme }) => theme.typography.label.fontSize}px;
  line-height: ${({ theme }) => theme.typography.label.lineHeight}px;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const Field = styled(TextInput)<{ $state: InputState; $faded: boolean }>`
  height: 48px;
  border-width: 2px;
  border-color: ${({ theme, $state }) =>
    $state === 'error'
      ? theme.colors.destructive
      : $state === 'focus'
        ? theme.colors.accentPrimary
        : theme.colors.border};
  background-color: ${({ theme }) => theme.colors.background};
  padding-horizontal: ${({ theme }) => theme.spacing.md}px;
  color: ${({ theme }) => theme.colors.textPrimary};
  opacity: ${({ $faded }) => ($faded ? 0.35 : 1)};
  font-family: ${({ theme }) => theme.fontFamily.regular};
  font-size: ${({ theme }) => theme.typography.label.fontSize}px;
`;

const HintText = styled.Text`
  font-family: ${({ theme }) => theme.fontFamily.regular};
  font-size: ${({ theme }) => theme.typography.body.fontSize}px;
  line-height: ${({ theme }) => theme.typography.body.lineHeight}px;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const ErrorText = styled.Text`
  font-family: ${({ theme }) => theme.fontFamily.regular};
  font-size: ${({ theme }) => theme.typography.body.fontSize}px;
  line-height: ${({ theme }) => theme.typography.body.lineHeight}px;
  color: ${({ theme }) => theme.colors.destructive};
`;

const CounterRow = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

export function PixelInput(props: Props): React.JSX.Element {
  const [focused, setFocused] = useState(false);
  const state: InputState = props.error ? 'error' : focused ? 'focus' : 'default';

  const handleBlur = (): void => {
    setFocused(false);
    props.onBlur?.();
  };

  return (
    <Wrap>
      {props.label ? <LabelText allowFontScaling={false}>{props.label}</LabelText> : null}
      <Field
        $state={state}
        $faded={!!props.fadedValue}
        value={props.value}
        onChangeText={props.onChangeText}
        maxLength={props.maxLength}
        placeholder={props.placeholder}
        placeholderTextColor="#7A7660"
        autoCapitalize={props.autoCapitalize ?? 'none'}
        autoCorrect={props.autoCorrect ?? false}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        allowFontScaling={false}
      />
      <CounterRow>
        <View style={{ flex: 1 }}>
          {props.error ? (
            <ErrorText allowFontScaling={false}>{props.error}</ErrorText>
          ) : props.hint ? (
            <HintText allowFontScaling={false}>{props.hint}</HintText>
          ) : null}
        </View>
        {props.showCounter && props.maxLength ? (
          <HintText allowFontScaling={false}>
            {props.value.length} / {props.maxLength}
          </HintText>
        ) : null}
      </CounterRow>
    </Wrap>
  );
}
