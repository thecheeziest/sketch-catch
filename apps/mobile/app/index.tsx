import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/auth';

export default function IndexRoute(): React.JSX.Element {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return <Redirect href={isAuthenticated ? '/(tabs)' : '/(auth)/login'} />;
}
