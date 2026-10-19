import { Redirect } from 'expo-router';
import { useIsSignedIn } from '@/features/auth/lib';

export default function IndexRoute() {
  const isSignedIn = useIsSignedIn();
  return <Redirect href={isSignedIn ? '/(tabs)' : '/(auth)/login'} />;
}
