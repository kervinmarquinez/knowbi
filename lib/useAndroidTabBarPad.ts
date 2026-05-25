import { PixelRatio } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// La barra de pestañas nativa (Material 3, edge-to-edge) crece con la escala de fuente del
// sistema. Con fuente estándar mide ~80dp; con fuente agrandada es más alta y tapaba el
// contenido inferior del Home (layout fijo, sin scroll). Crecemos el padding en proporción a la
// escala para no depender del número mágico.
export function useAndroidTabBarPad() {
  const insets = useSafeAreaInsets();
  if (process.env.EXPO_OS !== 'android') return 0;
  const extra = 32 * Math.max(0, PixelRatio.getFontScale() - 1);
  return insets.bottom + 80 + extra;
}
