import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { TopBar } from '../../lib/ui/TopBar';
import { ProgressDots } from '../../lib/ui/ProgressDots';
import { PillCard } from '../../lib/ui/PillCard';
import { Button } from '../../lib/ui/Button';
import { useDailyPills } from '../../hooks/useDailyPills';
import { supabase } from '../../lib/supabase';
import type { Category } from '../../lib/ui/categories';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_DISTANCE_THRESHOLD = 80;
const SWIPE_VELOCITY_THRESHOLD = 500;

export default function HoyScreen() {
  const router = useRouter();
  const { pills, isLoading, error, markAsRead, saveToLibrary, allRead, refetch } = useDailyPills();
  const [idx, setIdx] = useState(0);
  const [streak, setStreak] = useState(0);
  const [isAnon, setIsAnon] = useState(false);
  const translateX = useSharedValue(0);

  const allReadRef = useRef(false);
  useEffect(() => { allReadRef.current = allRead; }, [allRead]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      if (allReadRef.current) setIdx(0);

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
    }, []),
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

  const advance = async (save: boolean) => {
    const pill = pills[idx];
    if (!pill) return;
    if (save) {
      if (isAnon) {
        promptSignup();
        return;
      }
      await saveToLibrary(pill.id);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await markAsRead(pill.id);
    if (idx + 1 < pills.length) {
      setIdx(idx + 1);
    } else {
      router.push('/completed');
    }
  };

  const handleSave = async () => {
    const pill = pills[idx];
    if (!pill) return;
    if (isAnon) {
      promptSignup();
      return;
    }
    await saveToLibrary(pill.id);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const onSwipeForward = () => {
    translateX.value = 0;
    advance(false);
  };

  const onSwipeBack = () => {
    translateX.value = 0;
    if (idx > 0) setIdx(idx - 1);
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
        translateX.value = withSpring(0, { damping: 18, stiffness: 180 });
        return;
      }

      const isBackward = e.translationX > 0;

      // No hay píldora anterior → rebote
      if (isBackward && idx === 0) {
        translateX.value = withSpring(0, { damping: 18, stiffness: 180 });
        return;
      }

      const dir = isBackward ? 1 : -1;
      translateX.value = withTiming(
        dir * (SCREEN_WIDTH + 80),
        { duration: 220 },
        (finished) => {
          if (finished) runOnJS(isBackward ? onSwipeBack : onSwipeForward)();
        },
      );
    });

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { rotate: `${translateX.value / 30}deg` },
    ],
  }));

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

  const isSaved = pill.is_saved;
  const showBack = idx + 2 < pills.length;
  const showMid = idx + 1 < pills.length;

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <TopBar streak={streak} />
      <ProgressDots total={pills.length} current={idx} />
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 8 }}>
        <View style={{ flex: 1, position: 'relative' }}>
          {showBack && (
            <View
              pointerEvents="none"
              style={[
                styles.cardShell,
                { transform: [{ translateY: 16 }, { scale: 0.92 }], opacity: 0.3 },
              ]}
            />
          )}
          {showMid && (
            <View
              pointerEvents="none"
              style={[
                styles.cardShell,
                { transform: [{ translateY: 8 }, { scale: 0.96 }], opacity: 0.6 },
              ]}
            />
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
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 14 }}>
        <View style={{ flex: 1 }}>
          <Button variant="secondary" label="Saltar" onPress={() => advance(false)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button variant="primary" label="Guardar" onPress={() => advance(true)} />
        </View>
      </View>
      <View
        className="flex-row items-center justify-center"
        style={{ gap: 6, paddingVertical: 10 }}
      >
        <Ionicons name="swap-horizontal" size={14} color="#888885" />
        <Text
          className="font-body text-body-text-muted"
          style={{ fontSize: 11, lineHeight: 13 }}
        >
          Desliza o pulsa para avanzar
        </Text>
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E0DED8',
  },
});
