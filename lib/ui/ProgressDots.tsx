import { View } from 'react-native';

export function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <View className="flex-row items-center justify-center" style={{ gap: 6, paddingVertical: 12 }}>
      {Array.from({ length: total }).map((_, i) => {
        const done = i < current;
        const active = i === current;
        const width = active ? 18 : 6;
        const radius = active ? 3 : 3;
        const color = done || active ? '#7F77DD' : '#E0DED8';
        return (
          <View
            key={i}
            style={{ width, height: 6, borderRadius: radius, backgroundColor: color }}
          />
        );
      })}
    </View>
  );
}
