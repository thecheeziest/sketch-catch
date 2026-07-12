import { Button } from '@/shared/ui/Button';

type Props = {
  ready: boolean;
  onSave: () => void;
};

export function SaveGifButton({ ready, onSave }: Props) {
  return (
    <Button
      label={ready ? '갤러리에 저장하기' : 'GIF를 만들고 있어요...'}
      color="primary"
      height={48}
      disabled={!ready}
      onPress={onSave}
    />
  );
}
