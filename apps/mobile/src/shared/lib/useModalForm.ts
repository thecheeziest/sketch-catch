import { useCallback, useState } from 'react';

export function useModalForm<T>(initialValue: T, onClose: () => void) {
  const [value, setValue] = useState<T>(initialValue);
  const [error, setError] = useState<string | undefined>(undefined);

  const handleClose = useCallback(() => {
    setValue(initialValue);
    setError(undefined);
    onClose();
  }, [initialValue, onClose]);

  return { value, setValue, error, setError, handleClose };
}
