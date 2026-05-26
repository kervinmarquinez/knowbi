import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function SaveButton({ saved, onPress }: { saved: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
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
      <Ionicons
        name={saved ? 'bookmark' : 'bookmark-outline'}
        size={14}
        color={saved ? '#534AB7' : '#1A1A2E'}
      />
    </Pressable>
  );
}
