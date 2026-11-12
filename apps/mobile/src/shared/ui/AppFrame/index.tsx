import type { ReactNode } from 'react';
import { View } from 'dripsy';
import { APP_MAX_WIDTH, colors } from '@/shared/config';

type Props = { children: ReactNode };

// 넓은 창(폴드 펼침·태블릿·가로 회전)에서도 세로형 화면을 최대 폭 기둥 안에서 가운데 정렬해 그린다
export function AppFrame({ children }: Props) {
  return (
    <View sx={sxStyles.backdrop}>
      <View sx={sxStyles.frame}>{children}</View>
    </View>
  );
}

const sxStyles = {
  backdrop: { flex: 1, alignItems: 'center', backgroundColor: colors.DARK_500 },
  frame: { flex: 1, width: '100%', maxWidth: APP_MAX_WIDTH, overflow: 'hidden', backgroundColor: colors.DARK_200 },
} as const;
