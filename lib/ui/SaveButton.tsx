import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export function SaveButton({ saved, onPress }: { saved: boolean; onPress?: () => void }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    scale.value = withSequence(
      withTiming(1.2, { duration: 100 }),
      withTiming(1, { duration: 100 }),
    );
    onPress?.();
  };

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Quitar de guardadas' : 'Guardar píldora'}
      className={
        saved
          ? 'bg-primary-soft border-primary-soft border items-center justify-center rounded-icon-btn'
          : 'bg-white border-gray-border border items-center justify-center rounded-icon-btn'
      }
      style={{ width: 28, height: 28 }}
    >
      <Animated.View style={animatedStyle}>
        <Ionicons
          name={saved ? 'bookmark' : 'bookmark-outline'}
          size={14}
          color={saved ? '#534AB7' : '#1A1A2E'}
        />
      </Animated.View>
    </Pressable>
  );
}
