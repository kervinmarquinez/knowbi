import { Pressable, Text, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';

const VARIANT_STYLES: Record<
  Variant,
  { container: string; label: string; height: number; fontSize: number }
> = {
  primary: { container: 'bg-primary', label: 'text-white', height: 50, fontSize: 15 },
  secondary: {
    container: 'bg-white border border-gray-border',
    label: 'text-ink',
    height: 50,
    fontSize: 15,
  },
  ghost: { container: 'bg-transparent', label: 'text-primary', height: 32, fontSize: 13 },
  destructive: {
    container: 'bg-transparent border border-destructive',
    label: 'text-destructive',
    height: 50,
    fontSize: 15,
  },
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  variant = 'primary',
  label,
  onPress,
  disabled,
  style,
}: {
  variant?: Variant;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const scale = useSharedValue(1);
  const v = VARIANT_STYLES[variant];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPressIn={() => {
        scale.value = withTiming(0.97, { duration: 100, easing: Easing.out(Easing.ease) });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 100, easing: Easing.out(Easing.ease) });
      }}
      onPress={onPress}
      disabled={disabled}
      className={`${v.container} rounded-button items-center justify-center w-full`}
      style={[{ height: v.height, opacity: disabled ? 0.4 : 1 }, animatedStyle, style]}
    >
      <Text
        className={`font-body-medium ${v.label}`}
        style={{ fontSize: v.fontSize, lineHeight: v.fontSize * 1.2 }}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}
