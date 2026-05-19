import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { getSession, getEffectiveCategories } from '../lib/auth';

const POLL_INTERVAL_MS = 200;
const POLL_TIMEOUT_MS = 5000;

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const route = async () => {
      const start = Date.now();
      while (Date.now() - start < POLL_TIMEOUT_MS) {
        const session = await getSession();
        if (session && session.user.is_anonymous === false) {
          if (cancelled) return;
          const cats = await getEffectiveCategories();
          if (cancelled) return;
          router.replace(
            cats.length >= 3 ? '/(tabs)' : '/(onboarding)/categories?from=onboarding',
          );
          return;
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
      if (!cancelled) router.replace('/(auth)/welcome');
    };

    route();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F7F7FC',
      }}
    >
      <ActivityIndicator size="large" color="#7F77DD" />
    </View>
  );
}
