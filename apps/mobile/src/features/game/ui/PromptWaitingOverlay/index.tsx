import { ResultOverlay } from '../ResultOverlay';

type Props = {
  /** 기본값: '제시어 입력 중..' */
  title?: string;
  /** 기본값: '출제자가 제시어를 입력하고 있어요' */
  message?: string;
};

export function PromptWaitingOverlay({ title, message }: Props) {
  return <ResultOverlay data={{ kind: 'waiting', id: 'prompt-waiting', title, message }} />;
}
