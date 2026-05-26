import { View } from 'react-native';
import { Chip } from './Chip';
import { CATEGORIES } from './categories';

export function CategoryGrid({
  picked,
  onToggle,
}: {
  picked: string[];
  onToggle: (c: string) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {CATEGORIES.map((c) => (
        <Chip key={c} label={c} selected={picked.includes(c)} onPress={() => onToggle(c)} />
      ))}
    </View>
  );
}
