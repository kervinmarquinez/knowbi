import { View, Text } from 'react-native';

export function StreakPill({ count }: { count: number }) {
  return (
    <View
      className="flex-row items-center gap-1.5 px-3 rounded-badge bg-amber-soft"
      style={{ height: 28 }}
    >
      <View className="bg-amber" style={{ width: 8, height: 8, borderRadius: 4 }} />
      <Text className="font-display-bold text-amber" style={{ fontSize: 13, lineHeight: 13 }}>
        {count}
      </Text>
    </View>
  );
}
