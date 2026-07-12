import type { Mode2Phase } from '@sketch-catch/shared';
import { Button } from '@/shared/ui/Button';

type Props = {
  phase: Mode2Phase;
  disabled: boolean;
  onSubmit: () => void;
};

const SUBMIT_LABEL: Record<Mode2Phase, string> = {
  PROMPT: '적었어요!',
  DRAW: '완성!',
  ANSWER: '제출!',
};

export function SubmitStepButton({ phase, disabled, onSubmit }: Props) {
  return <Button height={48} color="primary" label={SUBMIT_LABEL[phase]} disabled={disabled} onPress={onSubmit} />;
}
