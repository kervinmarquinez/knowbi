import '../global.css';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Linking from 'expo-linking';
import {
  useFonts,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import { DMSans_400Regular, DMSans_500Medium } from '@expo-google-fonts/dm-sans';
import { configureNotificationHandler, ensureAndroidChannel } from '../lib/notifications';
import { initSentry, setSentryUser, wrap } from '../lib/sentry';
import { supabase } from '../lib/supabase';
import { completeOAuthFromUrl } from '../lib/auth';

initSentry();
configureNotificationHandler();

async function touchLastActive(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return;
  setSentryUser(userId);
  await supabase
    .from('user_preferences')
    .update({ last_active_at: new Date().toISOString() })
    .eq('user_id', userId);
}

function RootLayout() {
  const [fontsLoaded] = useFonts({
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    DMSans_400Regular,
    DMSans_500Medium,
  });

  useEffect(() => {
    ensureAndroidChannel().catch((e) => console.warn('ensureAndroidChannel', e));

    touchLastActive().catch((e) => console.warn('touchLastActive', e));
    const appStateSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') touchLastActive().catch((e) => console.warn('touchLastActive', e));
    });

    const handleAuthDeepLink = (url: string) => {
      if (!url.includes('auth-callback')) return;
      completeOAuthFromUrl(url).catch((e) => console.warn('oauth deep link', e));
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleAuthDeepLink(url);
    });

    const linkingSub = Linking.addEventListener('url', ({ url }) => {
      handleAuthDeepLink(url);
    });

    return () => {
      appStateSub.remove();
      linkingSub.remove();
    };
  }, []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F7F7FC' } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="auth-callback" />
          <Stack.Screen name="completed" />
          <Stack.Screen name="no-pills" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default wrap(RootLayout);
