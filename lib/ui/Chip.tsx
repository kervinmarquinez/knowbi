import { Pressable, Text, View } from 'react-native';

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      className={
        selected
          ? 'flex-row items-center gap-1.5 px-4 rounded-badge bg-primary-soft'
          : 'flex-row items-center gap-1.5 px-4 rounded-badge bg-white border border-gray-border'
      }
      style={{ height: 36 }}
    >
      {selected && (
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#3C3489' }} />
      )}
      <Text
        className={selected ? 'font-body-medium text-primary-text' : 'font-body-medium text-ink'}
        style={{ fontSize: 14, lineHeight: 14 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
