import { useEffect } from 'react';
import { View, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LogoWordmark } from '../lib/ui/LogoWordmark';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { getOrCreateSession } from '../lib/auth';
import { ensurePushTokenRegistered } from '../lib/notifications';


export default function Splash() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    let timerId: ReturnType<typeof setTimeout> | undefined;

    const minDelay = new Promise<void>((resolve) => {
      timerId = setTimeout(resolve, 1200);
    });
    const bootstrap = getOrCreateSession()
      .then(async (session) => {
        ensurePushTokenRegistered(session.user.id);
        const categories = await AsyncStorage.getItem('user_categories');
        return { ok: true as const, hasCategories: !!categories, session };
      })
      .catch((err) => {
        console.error('getOrCreateSession failed', err);
        return { ok: false as const };
      });

    Promise.all([minDelay, bootstrap]).then(([, result]) => {
      if (!mounted) return;
      if (!result.ok) {
        router.replace('/(onboarding)/welcome');
        return;
      }
      router.replace(result.hasCategories ? '/(tabs)' : '/(onboarding)/welcome');
    });

    return () => {
      mounted = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [router]);

  return (
    <View className="flex-1 bg-surface items-center justify-center">
      <Image
        source={require('../assets/mascot-head.png')}
        style={{ width: 132, height: 132 }}
        resizeMode="contain"
      />
      <View className="items-center mt-6">
        <LogoWordmark height={72} />
      </View>
      <PulseDots />
    </View>
  );
}

function PulseDots() {
  return (
    <View className="absolute self-center flex-row" style={{ bottom: 88, gap: 8 }}>
      {[0, 160, 320].map((delay) => (
        <Dot key={delay} delay={delay} />
      ))}
    </View>
  );
}

function Dot({ delay }: { delay: number }) {
  const v = useSharedValue(0);

  useEffect(() => {
    v.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 440, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 660, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
      ),
    );
  }, [delay, v]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.25 + v.value * 0.75,
    transform: [{ scale: 0.85 + v.value * 0.15 }],
  }));

  return (
    <Animated.View
      style={[
        { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#7F77DD' },
        style,
      ]}
    />
  );
}
