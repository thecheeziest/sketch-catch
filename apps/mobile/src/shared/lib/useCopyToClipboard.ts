import * as Clipboard from 'expo-clipboard';
import { useToastStore } from '@/shared/model';

export async function copyToClipboard(text: string, successMessage = '복사되었습니다'): Promise<void> {
  await Clipboard.setStringAsync(text);
  useToastStore.getState().show(successMessage);
}
