import { Stack } from 'expo-router';

export default function TabsLayout(): React.JSX.Element {
  // Phase 2는 탭 바 없이 단일 stack — 실제 탭은 Phase 4+에서 추가
  return <Stack screenOptions={{ headerShown: false }} />;
}
