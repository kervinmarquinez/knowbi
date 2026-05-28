import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { TopBar } from '../../lib/ui/TopBar';
import { ProgressDots } from '../../lib/ui/ProgressDots';
import { PillCard } from '../../lib/ui/PillCard';
import { useDailyPills } from '../../hooks/useDailyPills';
import { useAndroidTabBarPad } from '../../lib/useAndroidTabBarPad';
import { supabase } from '../../lib/supabase';
import { isReviewing } from '../../lib/completedReview';
import type { Category } from '../../lib/ui/categories';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_DISTANCE_THRESHOLD = 80;
const SWIPE_VELOCITY_THRESHOLD = 500;
const DRAG_PROGRESS_DENOM = SCREEN_WIDTH / 2;
const FLY_OFF_X = -(SCREEN_WIDTH + 80);

const SPRING_RETURN = { damping: 15, stiffness: 120 };
const SPRING_DISMISS = { damping: 22, stiffness: 100, overshootClamping: true };

// Ventana de cards montadas alrededor del índice actual.
const WINDOW_BEHIND = 1; // la anterior (para retroceder)
const WINDOW_AHEAD = 3; // las siguientes apiladas detrás

type StackPill = {
  id: string;
  category: string;
  title: string;
  body: string;
  date: string;
  is_saved: boolean;
};

// Una card persistente. Su CONTENIDO nunca cambia (keyed por id); solo su POSICIÓN,
// derivada en el hilo de UI de (idxSV, translateX). Por eso avanzar no produce saltos:
// la card de detrás que ya muestra la siguiente píldora es la misma que pasa al frente.
function StackCard({
  pill,
  absIndex,
  idx,
  idxSV,
  translateX,
  total,
  onSave,
}: {
  pill: StackPill;
  absIndex: number;
  idx: number;
  idxSV: SharedValue<number>;
  translateX: SharedValue<number>;
  total: number;
  onSave?: () => void;
}) {
  const isFront = absIndex === idx;
  const offsetJS = absIndex - idx;
  const zIndex = offsetJS === 0 ? 30 : offsetJS < 0 ? 29 : Math.max(0, 21 - offsetJS);

  const animatedStyle = useAnimatedStyle(() => {
    const offset = absIndex - idxSV.value;
    const x = translateX.value;

    // Card del frente: sigue el arrastre con ligera rotación.
    if (offset === 0) {
      return { transform: [{ translateX: x }, { rotate: `${x / 30}deg` }], opacity: 1 };
    }

    // Cards de detrás: escalan/atenúan hacia el frente conforme se arrastra hacia delante.
    if (offset > 0) {
      const forwardP = Math.min(Math.max(0, -x) / DRAG_PROGRESS_DENOM, 1);
      const d = offset - forwardP; // profundidad continua: 0 = frente
      return {
        transform: [{ translateY: 8 * d }, { scale: 1 - 0.04 * d }],
        opacity: Math.max(0, Math.min(1, 1 - 0.35 * d)),
      };
    }

    // Cards anteriores: aparcadas fuera de pantalla a la izquierda; entran al retroceder.
    const px = x + offset * SCREEN_WIDTH;
    return { transform: [{ translateX: px }, { rotate: `${px / 30}deg` }], opacity: 1 };
  });

  return (
    <Animated.View
      pointerEvents={isFront ? 'box-none' : 'none'}
      style={[StyleSheet.absoluteFill, { zIndex }, animatedStyle]}
    >
      <PillCard
        pill={{
          category: pill.category as Category,
          title: pill.title,
          body: pill.body,
          date: pill.date,
        }}
        index={absIndex}
        total={total}
        saved={pill.is_saved}
        onSave={isFront ? onSave : undefined}
      />
    </Animated.View>
  );
}

export default function HoyScreen() {
  const router = useRouter();
  const {
    pills,
    isLoading,
    isGenerating,
    error,
    markAsRead,
    setSaved,
    syncSavedStates,
    allRead,
    refetch,
  } = useDailyPills();
  const [idx, setIdx] = useState(0);
  const [streak, setStreak] = useState(0);
  const [isAnon, setIsAnon] = useState(false);
  const translateX = useSharedValue(0);
  const idxSV = useSharedValue(0);
  const androidTabBarPad = useAndroidTabBarPad();
  // Necesario en los useEffect de redirección: si Home se monta/queda activo sin foco
  // (p. ej. usuario navegando a /(tabs)/guardados desde fuera), evitamos que dispare
  // router.replace y hijackee al usuario fuera de su destino real.
  const isFocused = useIsFocused();

  // Espejo de idx en el hilo de UI para posicionar las cards sin esperar al render.
  useEffect(() => {
    idxSV.value = idx;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- idxSV es shared value (identidad estable)
  }, [idx]);

  const allReadRef = useRef(false);
  useEffect(() => {
    allReadRef.current = allRead;
  }, [allRead]);
  const isLoadingRef = useRef(isLoading);
  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);
  const errorRef = useRef(error);
  useEffect(() => {
    errorRef.current = error;
  }, [error]);
  const pillsRef = useRef(pills);
  useEffect(() => {
    pillsRef.current = pills;
  }, [pills]);

  // Si el set del día ya está leído, aterrizamos en Completado por defecto (opción A), salvo
  // que el usuario haya pulsado "Volver a las píldoras de hoy" para releer este set (flag de
  // relectura por fecha). Lee de refs para no dispararse durante el swipe en vivo: ese caso
  // lo maneja goCompleted con un push.
  const routeOrReset = useCallback(async () => {
    if (isLoadingRef.current || errorRef.current || pillsRef.current.length === 0) return;
    if (!allReadRef.current) return;
    const setDate = pillsRef.current[0]?.date;
    if (setDate && (await isReviewing(setDate))) {
      setIdx(0);
      return;
    }
    router.replace('/completed');
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      translateX.value = 0;
      syncSavedStates();
      void routeOrReset();

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
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- translateX es shared value (identidad estable)
    }, [syncSavedStates, routeOrReset]),
  );

  // Cold-start: al terminar la carga inicial, evalúa el aterrizaje. Clave solo en isLoading
  // (no en allRead) para no colisionar con el push de goCompleted durante el swipe en vivo.
  // Guard de foco: si esta pestaña no es la activa, no redirigimos — un router.replace
  // desde una pestaña en segundo plano arrastraría al usuario fuera de su destino real.
  useEffect(() => {
    if (!isLoading && isFocused) void routeOrReset();
  }, [isLoading, isFocused, routeOrReset]);

  useEffect(() => {
    if (!isLoading && !error && pills.length === 0 && isFocused) {
      router.replace('/no-pills');
    }
  }, [isLoading, error, pills.length, router, isFocused]);

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

  // Commits de avance/retroceso. idxSV ya se actualizó en el hilo de UI dentro del
  // gesto; aquí solo sincronizamos el estado de React (contenido de la ventana).
  const commitForward = () => {
    const pill = pills[idx];
    setIdx(idx + 1);
    if (pill) void markAsRead(pill.id);
  };

  const commitBack = () => {
    if (idx > 0) setIdx(idx - 1);
  };

  const goCompleted = () => {
    const pill = pills[idx];
    if (pill) void markAsRead(pill.id);
    router.push('/completed');
  };

  const pillsLen = pills.length;

  // Tap en las flechas: misma mecánica que el swipe (animación de salida + commit), con
  // velocidad 0. Se ignora si ya hay una animación en curso para no descuadrar el índice.
  const tapForward = () => {
    if (translateX.value !== 0) return;
    const isLast = idx + 1 >= pillsLen;
    translateX.value = withSpring(FLY_OFF_X, SPRING_DISMISS, (finished) => {
      if (!finished) return;
      if (isLast) {
        runOnJS(goCompleted)();
        return;
      }
      idxSV.value = idxSV.value + 1;
      translateX.value = 0;
      runOnJS(commitForward)();
    });
  };

  const tapBack = () => {
    if (idx === 0 || translateX.value !== 0) return;
    translateX.value = withSpring(SCREEN_WIDTH, SPRING_DISMISS, (finished) => {
      if (!finished) return;
      idxSV.value = idxSV.value - 1;
      translateX.value = 0;
      runOnJS(commitBack)();
    });
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
        translateX.value = withSpring(0, SPRING_RETURN);
        return;
      }

      const isBackward = e.translationX > 0;

      if (isBackward && idx === 0) {
        translateX.value = withSpring(0, SPRING_RETURN);
        return;
      }

      if (isBackward) {
        translateX.value = withSpring(
          SCREEN_WIDTH,
          { ...SPRING_DISMISS, velocity: e.velocityX },
          (finished) => {
            if (!finished) return;
            idxSV.value = idxSV.value - 1;
            translateX.value = 0;
            runOnJS(commitBack)();
          },
        );
        return;
      }

      const isLast = idx + 1 >= pillsLen;
      translateX.value = withSpring(
        FLY_OFF_X,
        { ...SPRING_DISMISS, velocity: e.velocityX },
        (finished) => {
          if (!finished) return;
          if (isLast) {
            runOnJS(goCompleted)();
            return;
          }
          idxSV.value = idxSV.value + 1;
          translateX.value = 0;
          runOnJS(commitForward)();
        },
      );
    });

  if (isGenerating) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center" edges={['top']}>
        <ActivityIndicator size="large" color="#7F77DD" />
        <Text
          className="font-body text-body-text"
          style={{ fontSize: 15, textAlign: 'center', marginHorizontal: 32, marginTop: 20 }}
        >
          Preparando tus 5 píldoras…
        </Text>
      </SafeAreaView>
    );
  }

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
        <Text
          className="font-body text-body-text"
          style={{ fontSize: 15, textAlign: 'center', marginHorizontal: 32 }}
        >
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

  const canGoBack = idx > 0;

  // Ventana de cards montadas (anterior + actual + siguientes apiladas). Cada una
  // mantiene su identidad por id, así que al cambiar idx no se desmontan ni cambian
  // de contenido: solo recalculan su posición.
  const windowCards: { pill: StackPill; absIndex: number }[] = [];
  for (let i = idx - WINDOW_BEHIND; i <= idx + WINDOW_AHEAD; i++) {
    const p = pills[i];
    if (p) windowCards.push({ pill: p, absIndex: i });
  }

  return (
    <SafeAreaView
      className="flex-1 bg-surface"
      edges={['top']}
      style={androidTabBarPad ? { paddingBottom: androidTabBarPad } : undefined}
    >
      <TopBar streak={streak} />
      <ProgressDots total={pills.length} current={idx} />
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 8 }}>
        <GestureDetector gesture={pan}>
          <View style={{ flex: 1, position: 'relative' }}>
            {windowCards.map(({ pill: p, absIndex }) => (
              <StackCard
                key={p.id}
                pill={p}
                absIndex={absIndex}
                idx={idx}
                idxSV={idxSV}
                translateX={translateX}
                total={pills.length}
                onSave={handleSave}
              />
            ))}
          </View>
        </GestureDetector>
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
        <TouchableOpacity
          onPress={tapBack}
          disabled={!canGoBack}
          accessibilityRole="button"
          accessibilityLabel="Píldora anterior"
          hitSlop={16}
          style={{ opacity: canGoBack ? 1 : 0.3 }}
        >
          <Ionicons name="arrow-back" size={16} color="#888885" />
        </TouchableOpacity>
        <Text style={styles.hintText}>Desliza</Text>
        <TouchableOpacity
          onPress={tapForward}
          accessibilityRole="button"
          accessibilityLabel="Píldora siguiente"
          hitSlop={16}
        >
          <Ionicons name="arrow-forward" size={16} color="#888885" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hintText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
    color: '#888885',
  },
});
