import { Stack } from 'expo-router';

export default function HomeLayout(): React.JSX.Element {
  return <Stack screenOptions={{ headerShown: false }} />;
}
