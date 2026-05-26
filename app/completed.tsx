import { useEffect, useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  withRepeat,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { TopBar } from '../lib/ui/TopBar';
import { Button } from '../lib/ui/Button';
import { Flame } from '../lib/ui/Flame';
import { supabase } from '../lib/supabase';
import { windowDate, dropHourFromHHMM } from '../lib/dropWindow';
import { markReviewing } from '../lib/completedReview';

Animated.addWhitelistedNativeProps({ text: true });
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export default function CompletedScreen() {
  const router = useRouter();
  const [streak, setStreak] = useState<number | null>(null);
  const [nextDropHHMM, setNextDropHHMM] = useState<string | null>(null);
  const [setDate, setSetDate] = useState<string | null>(null);

  // --- Coreografía de entrada (Reanimated, hilo de UI) ---
  const titleOpacity = useSharedValue(0);
  const titleY = useSharedValue(-16);
  const flameScale = useSharedValue(0);
  const glow = useSharedValue(0);
  const numberOpacity = useSharedValue(0);
  const numberScale = useSharedValue(0.6);
  const subtitleOpacity = useSharedValue(0);
  const buttonsOpacity = useSharedValue(0);
  const buttonsY = useSharedValue(24);
  const count = useSharedValue(0);

  // Entrada de los elementos que no dependen del número (al montar)
  useEffect(() => {
    titleOpacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
    titleY.value = withSpring(0, { damping: 14, stiffness: 120 });

    flameScale.value = withDelay(250, withSpring(1, { damping: 7, stiffness: 150 }));
    glow.value = withDelay(
      250,
      withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }), -1, true),
    );

    buttonsOpacity.value = withDelay(1000, withTiming(1, { duration: 400 }));
    buttonsY.value = withDelay(1000, withSpring(0, { damping: 16, stiffness: 140 }));

    // Háptica sincronizada con el rebote de la llama
    const t = setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animación de entrada solo al montar; las deps son shared values estables
  }, []);

  // Conteo del número + clímax, una vez que la racha llega de Supabase
  useEffect(() => {
    if (streak === null) return;
    numberOpacity.value = withTiming(1, { duration: 300 });
    numberScale.value = withSequence(
      withSpring(1.15, { damping: 6, stiffness: 160 }),
      withSpring(1, { damping: 12, stiffness: 160 }),
    );
    count.value = withTiming(streak, { duration: 800, easing: Easing.out(Easing.cubic) });
    subtitleOpacity.value = withDelay(400, withTiming(1, { duration: 400 }));

    const t = setTimeout(
      () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
      800,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo depende de streak; el resto son shared values estables
  }, [streak]);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }],
  }));
  const flameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: flameScale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0.25, 0.55]),
    transform: [{ scale: interpolate(glow.value, [0, 1], [1, 1.18]) }],
  }));
  const numberStyle = useAnimatedStyle(() => ({
    opacity: numberOpacity.value,
    transform: [{ scale: numberScale.value }],
  }));
  const subtitleStyle = useAnimatedStyle(() => ({ opacity: subtitleOpacity.value }));
  const buttonsStyle = useAnimatedStyle(() => ({
    opacity: buttonsOpacity.value,
    transform: [{ translateY: buttonsY.value }],
  }));
  const countProps = useAnimatedProps(() => ({ text: String(Math.round(count.value)) }) as object);

  useEffect(() => {
    let cancelled = false;

    async function syncStreak() {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) return;
      const userId = userData.user.id;

      // La racha se ata a la FECHA DEL SET completado (no al reloj): así es robusta a
      // zonas horarias y a que el usuario cambie su hora de drop en Ajustes.
      let hhmm = await AsyncStorage.getItem('notification_time');
      if (!hhmm) {
        const { data: prefRow } = await supabase
          .from('user_preferences')
          .select('notification_time')
          .eq('user_id', userId)
          .maybeSingle();
        hhmm = prefRow?.notification_time ?? null;
      }
      const dropHour = dropHourFromHHMM(hhmm);
      setNextDropHHMM(`${String(dropHour).padStart(2, '0')}:00`);

      const today = windowDate(dropHour);
      setSetDate(today);

      // Toda la lógica de racha (alta/incremento/reset, idempotente) ocurre de forma
      // atómica en la BD vía RPC, evitando carreras del read-modify-write anterior.
      const { data, error: rpcErr } = await supabase.rpc('bump_streak', { p_set_date: today });
      if (rpcErr) {
        console.error('bump_streak error', rpcErr);
        return;
      }
      if (!cancelled) setStreak(typeof data === 'number' ? data : 0);
    }

    syncStreak();
    return () => {
      cancelled = true;
    };
  }, []);

  // Show the last known value while loading to keep the layout stable
  const displayStreak = streak ?? '—';

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      <TopBar streak={streak ?? 0} />
      <View className="flex-1 items-center justify-center" style={{ paddingHorizontal: 20 }}>
        <Animated.Text style={titleStyle} className="font-display text-ink text-center">
          <Text style={{ fontSize: 28, lineHeight: 28 * 1.2 }}>¡Ya tienes las 5 de hoy!</Text>
        </Animated.Text>

        {/* Llama con glow que late */}
        <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 32 }}>
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor: '#FAEEDA',
              },
              glowStyle,
            ]}
          />
          <Animated.View style={flameStyle}>
            <Flame size={96} />
          </Animated.View>
        </View>

        <Animated.View
          accessible
          accessibilityRole="text"
          accessibilityLabel={
            streak === null
              ? 'Cargando racha'
              : `Racha actual: ${streak} ${streak === 1 ? 'día seguido' : 'días seguidos'}`
          }
          style={[{ alignItems: 'center', marginTop: 16 }, numberStyle]}
        >
          <AnimatedTextInput
            editable={false}
            accessibilityElementsHidden
            importantForAccessibility="no"
            defaultValue="0"
            animatedProps={countProps}
            className="font-display text-amber"
            style={{
              fontSize: 64,
              lineHeight: 70,
              padding: 0,
              textAlign: 'center',
              color: '#EF9F27',
              minWidth: 120,
            }}
          />
          <Text
            className="font-body text-body-text-muted"
            style={{ fontSize: 14, lineHeight: 14, marginTop: 6 }}
          >
            días seguidos
          </Text>
        </Animated.View>

        <Animated.Text
          style={[
            { fontSize: 14, lineHeight: 14 * 1.6, marginTop: 32, maxWidth: 280 },
            subtitleStyle,
          ]}
          className="font-body text-body-text text-center"
        >
          Llevas {displayStreak} días seguidos. Eso es mucho más que la mayoría.
        </Animated.Text>

        {nextDropHHMM ? (
          <Animated.Text
            style={[
              { fontSize: 13, lineHeight: 13 * 1.5, marginTop: 18, maxWidth: 280 },
              subtitleStyle,
            ]}
            className="font-body text-body-text-muted text-center"
          >
            Tus próximas 5 llegan a las {nextDropHHMM}.
          </Animated.Text>
        ) : null}
      </View>
      <Animated.View style={[{ paddingHorizontal: 20, paddingBottom: 12, gap: 8 }, buttonsStyle]}>
        <Button
          variant="primary"
          label="Volver a las píldoras de hoy"
          onPress={async () => {
            // Marcamos relectura de este set para que el Home no rebote de vuelta aquí.
            if (setDate) await markReviewing(setDate);
            router.replace('/(tabs)');
          }}
        />
        <Button
          variant="secondary"
          label="Ver mis guardadas"
          onPress={() => router.replace('/(tabs)/guardados')}
        />
      </Animated.View>
    </SafeAreaView>
  );
}
