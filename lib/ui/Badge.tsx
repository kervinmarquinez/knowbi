import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CATEGORY_RAMPS, CATEGORY_ICONS, type Category } from './categories';

export function Badge({ category }: { category: Category }) {
  const ramp = CATEGORY_RAMPS[category];
  return (
    <View
      className="self-start flex-row items-center gap-1.5 px-3 rounded-badge"
      style={{
        backgroundColor: '#FFFFFF',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: ramp.text,
        height: 26,
      }}
    >
      <Ionicons name={CATEGORY_ICONS[category]} size={13} color={ramp.text} />
      <Text className="font-body-medium" style={{ fontSize: 11, lineHeight: 11, color: ramp.text }}>
        {category}
      </Text>
    </View>
  );
}
