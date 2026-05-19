import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { TopBar } from '../../lib/ui/TopBar';
import { ProgressDots } from '../../lib/ui/ProgressDots';
import { PillCard } from '../../lib/ui/PillCard';
import { useDailyPills } from '../../hooks/useDailyPills';
import { supabase } from '../../lib/supabase';
import type { Category } from '../../lib/ui/categories';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_DISTANCE_THRESHOLD = 80;
const SWIPE_VELOCITY_THRESHOLD = 500;
const DRAG_PROGRESS_DENOM = SCREEN_WIDTH / 2;

export default function HoyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { pills, isLoading, error, markAsRead, setSaved, syncSavedStates, allRead, refetch } = useDailyPills();
  const [idx, setIdx] = useState(0);
  const [streak, setStreak] = useState(0);
  const [isAnon, setIsAnon] = useState(false);
  const translateX = useSharedValue(0);
  const androidTabBarPad =
    process.env.EXPO_OS === 'android' ? insets.bottom + 80 : 0;

  const allReadRef = useRef(false);
  useEffect(() => { allReadRef.current = allRead; }, [allRead]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      if (allReadRef.current) setIdx(0);

      syncSavedStates();

      async function loadStreak() {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;
        if (!session) return;
        if (!cancelled) setIsAnon(session.user.is_anonymous === true);
        if (session.user.is_anonymous) return;

        const { data, error: streakErr } = await supabase
          .from('user_streaks')
          .select('current_streak')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (streakErr) {
          console.error('home streak fetch error', streakErr);
          return;
        }
        if (!cancelled) setStreak(data?.current_streak ?? 0);
      }

      loadStreak();
      return () => { cancelled = true; };
    }, [syncSavedStates]),
  );

  useEffect(() => {
    if (!isLoading && !error && pills.length === 0) {
      router.replace('/no-pills');
    }
  }, [isLoading, error, pills.length, router]);

  const promptSignup = useCallback(() => {
    Alert.alert(
      'Crea una cuenta para guardar',
      'Necesitas una cuenta para guardar tus píldoras favoritas y verlas cuando quieras.',
      [
        { text: 'Ahora no', style: 'cancel' },
        { text: 'Iniciar sesión', onPress: () => router.push('/(auth)/login?from=save') },
        { text: 'Crear cuenta', onPress: () => router.push('/(auth)/signup?from=save') },
      ],
    );
  }, [router]);

  const advance = async () => {
    const pill = pills[idx];
    if (!pill) return;
    await markAsRead(pill.id);
    if (idx + 1 < pills.length) {
      setIdx(idx + 1);
    } else {
      router.push('/completed');
    }
  };

  const goBack = () => {
    if (idx > 0) setIdx(idx - 1);
  };

  const handleSave = async () => {
    const pill = pills[idx];
    if (!pill) return;
    if (isAnon && !pill.is_saved) {
      promptSignup();
      return;
    }
    await setSaved(pill.id, !pill.is_saved);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const onSwipeForward = () => {
    translateX.value = 0;
    advance();
  };

  const onSwipeBackward = () => {
    goBack();
    translateX.value = 0;
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-20, 20])
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      const shouldDismiss =
        Math.abs(e.translationX) > SWIPE_DISTANCE_THRESHOLD ||
        Math.abs(e.velocityX) > SWIPE_VELOCITY_THRESHOLD;

      if (!shouldDismiss) {
        translateX.value = withSpring(0, { damping: 15, stiffness: 120 });
        return;
      }

      const isBackward = e.translationX > 0;

      if (isBackward && idx === 0) {
        translateX.value = withSpring(0, { damping: 15, stiffness: 120 });
        return;
      }

      const target = isBackward ? SCREEN_WIDTH : -(SCREEN_WIDTH + 80);
      translateX.value = withSpring(
        target,
        { velocity: e.velocityX, damping: 22, stiffness: 100, overshootClamping: true },
        (finished) => {
          if (finished) runOnJS(isBackward ? onSwipeBackward : onSwipeForward)();
        },
      );
    });

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { rotate: `${translateX.value / 30}deg` },
    ],
  }));

  const animatedPrevStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value - SCREEN_WIDTH }],
  }));

  const animatedMidStyle = useAnimatedStyle(() => {
    const forwardP = Math.min(Math.max(0, -translateX.value) / DRAG_PROGRESS_DENOM, 1);
    return {
      transform: [
        { translateY: interpolate(forwardP, [0, 1], [8, 0], Extrapolation.CLAMP) },
        { scale: interpolate(forwardP, [0, 1], [0.96, 1], Extrapolation.CLAMP) },
      ],
      opacity: interpolate(forwardP, [0, 1], [0.6, 1], Extrapolation.CLAMP),
    };
  });

  const animatedBackStyle = useAnimatedStyle(() => {
    const forwardP = Math.min(Math.max(0, -translateX.value) / DRAG_PROGRESS_DENOM, 1);
    return {
      transform: [
        { translateY: interpolate(forwardP, [0, 1], [16, 8], Extrapolation.CLAMP) },
        { scale: interpolate(forwardP, [0, 1], [0.92, 0.96], Extrapolation.CLAMP) },
      ],
      opacity: interpolate(forwardP, [0, 1], [0.3, 0.6], Extrapolation.CLAMP),
    };
  });

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center" edges={['top']}>
        <ActivityIndicator size="large" color="#7F77DD" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center" edges={['top']}>
        <Text className="font-body text-body-text" style={{ fontSize: 15, textAlign: 'center', marginHorizontal: 32 }}>
          Algo falló. Tira hacia abajo para reintentar.
        </Text>
        <TouchableOpacity onPress={refetch} style={{ marginTop: 20 }}>
          <Text style={{ fontSize: 15, color: '#7F77DD', fontWeight: '600' }}>Reintentar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const pill = pills[idx];
  if (!pill) return null;

  const prevPill = idx > 0 ? pills[idx - 1] : null;
  const isSaved = pill.is_saved;
  const showBack = idx + 2 < pills.length;
  const showMid = idx + 1 < pills.length;
  const canGoBack = idx > 0;

  return (
    <SafeAreaView
      className="flex-1 bg-surface"
      edges={['top']}
      style={androidTabBarPad ? { paddingBottom: androidTabBarPad } : undefined}
    >
      <TopBar streak={streak} />
      <ProgressDots total={pills.length} current={idx} />
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 8 }}>
        <View style={{ flex: 1, position: 'relative' }}>
          {showBack && (
            <Animated.View
              pointerEvents="none"
              style={[styles.cardShell, animatedBackStyle]}
            />
          )}
          {showMid && (
            <Animated.View
              pointerEvents="none"
              style={[styles.cardShell, animatedMidStyle]}
            />
          )}
          {prevPill && (
            <Animated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, animatedPrevStyle]}
            >
              <PillCard
                pill={{ category: prevPill.category as Category, title: prevPill.title, body: prevPill.body, date: prevPill.date }}
                index={idx - 1}
                total={pills.length}
                saved={prevPill.is_saved}
              />
            </Animated.View>
          )}
          <GestureDetector gesture={pan}>
            <Animated.View style={[StyleSheet.absoluteFill, animatedCardStyle]}>
              <PillCard
                pill={{ category: pill.category as Category, title: pill.title, body: pill.body, date: pill.date }}
                index={idx}
                total={pills.length}
                saved={isSaved}
                onSave={handleSave}
              />
            </Animated.View>
          </GestureDetector>
        </View>
      </View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 40,
          paddingVertical: 16,
        }}
      >
        <Ionicons
          name="arrow-back"
          size={16}
          color="#888885"
          style={{ opacity: canGoBack ? 1 : 0.3 }}
        />
        <Text style={styles.hintText}>Desliza</Text>
        <Ionicons name="arrow-forward" size={16} color="#888885" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  cardShell: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E0DED8',
  },
  hintText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    color: '#888885',
  },
});
