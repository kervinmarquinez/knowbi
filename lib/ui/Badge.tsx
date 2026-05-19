import { View, Text } from 'react-native';
import { CATEGORY_RAMPS, type Category } from './categories';

export function Badge({ category }: { category: Category }) {
  const ramp = CATEGORY_RAMPS[category];
  return (
    <View
      className="self-start flex-row items-center gap-1.5 px-3 rounded-badge"
      style={{ backgroundColor: ramp.bg, height: 24 }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ramp.text }} />
      <Text
        className="font-body-medium"
        style={{ fontSize: 11, lineHeight: 11, color: ramp.text }}
      >
        {category}
      </Text>
    </View>
  );
}
