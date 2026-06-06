import { useEffect } from 'react';
import { Modal, View, Pressable, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { PillDetailView } from './PillDetailView';
import { Button } from './Button';
import { CATEGORY_RAMPS, type Category } from './categories';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SPRING_OPEN = { damping: 22, stiffness: 180 };
const TIMING_CLOSE = { duration: 220 };
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;

type SheetPill = {
  category: string;
  title: string;
  body: string;
  date: string;
};

// Bottom-sheet del flujo diario (pantalla 06): muestra el cuerpo completo y scrolleable de
// la píldora del Home sin truncar, sea cual sea el tamaño de fuente. Controlado por `pill`:
// no-nulo abre. Para cerrar, animamos la salida y SOLO al terminar avisamos al padre con
// `onClose` (que pone pill=null y desmonta) — así no hace falta estado espejo y la salida
// nunca se corta. Reutiliza PillDetailView y el `onSave` gateado del Home (regla #9).
export function ExpandedPillSheet({
  pill,
  saved,
  onClose,
  onSave,
}: {
  pill: SheetPill | null;
  saved: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  // Animación de entrada al abrir. Solo escribe shared values (sin setState).
  useEffect(() => {
    if (pill) {
      translateY.value = withSpring(0, SPRING_OPEN);
      backdropOpacity.value = withTiming(1, { duration: 200 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shared values: identidad estable
  }, [pill]);

  // Cierre desde JS (backdrop / botón atrás): anima y al terminar avisa al padre.
  const animateClose = () => {
    backdropOpacity.value = withTiming(0, { duration: 200 });
    translateY.value = withTiming(SCREEN_HEIGHT, TIMING_CLOSE, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  };

  const dragToDismiss = Gesture.Pan()
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        // Cierre en el hilo de UI (sin salto de hilo) para una salida fluida tras el arrastre.
        backdropOpacity.value = withTiming(0, { duration: 200 });
        translateY.value = withTiming(SCREEN_HEIGHT, TIMING_CLOSE, (finished) => {
          if (finished) runOnJS(onClose)();
        });
      } else {
        translateY.value = withSpring(0, SPRING_OPEN);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  if (!pill) return null;

  const ramp = CATEGORY_RAMPS[pill.category as Category];

  return (
    <Modal
      transparent
      visible
      animationType="none"
      onRequestClose={animateClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={animateClose}
            accessibilityLabel="Cerrar"
          />
        </Animated.View>
        <Animated.View style={[styles.sheet, { backgroundColor: ramp.bg }, sheetStyle]}>
          <GestureDetector gesture={dragToDismiss}>
            <View style={styles.handleArea}>
              <View style={styles.handle} />
            </View>
          </GestureDetector>
          <PillDetailView
            category={pill.category as Category}
            title={pill.title}
            body={pill.body}
            date={pill.date}
            footer={
              <View style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 12 }}>
                <Button
                  variant={saved ? 'ghost' : 'primary'}
                  label={saved ? 'Quitar de guardadas' : 'Guardar'}
                  onPress={onSave}
                />
              </View>
            }
          />
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    backgroundColor: 'rgba(26, 26, 46, 0.45)',
  },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  handleArea: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(26, 26, 46, 0.18)',
  },
});
