import { useEffect } from 'react';
import { Modal, Pressable, Text, View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Button } from './Button';

export function PaywallSheet({
  visible,
  onClose,
  onUpgrade,
}: {
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  const translateY = useSharedValue(600);

  useEffect(() => {
    translateY.value = withTiming(visible ? 0 : 600, {
      duration: 250,
      easing: Easing.out(Easing.ease),
    });
  }, [visible, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={onClose}>
        <View className="flex-1 justify-end">
          <Pressable onPress={() => {}}>
            <Animated.View style={[styles.sheet, animatedStyle]} className="bg-white">
              <View style={styles.handle} />
              <Text
                className="font-display text-ink text-center"
                style={{ fontSize: 24, marginTop: 6 }}
              >
                Ya tienes tus 5 de hoy.
              </Text>
              <Text
                className="font-body text-body-text text-center"
                style={{ fontSize: 14, lineHeight: 14 * 1.65, marginTop: 14, marginHorizontal: 6 }}
              >
                Por menos de un café al mes, aprende el doble cada día — y no pierdas ninguna
                curiosidad que ya encontraste.
              </Text>
              <View style={{ marginTop: 20, gap: 8 }}>
                <Button variant="primary" label="Empezar premium" onPress={onUpgrade} />
                <Button variant="ghost" label="Ahora no" onPress={onClose} />
              </View>
            </Animated.View>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 32,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0DED8',
    alignSelf: 'center',
    marginBottom: 6,
  },
});
