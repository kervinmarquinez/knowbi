import { View, Text, StyleSheet } from 'react-native';
import { Badge } from './Badge';
import { SaveButton } from './SaveButton';
import type { Category } from './categories';
import { formatPillDate } from '../formatPillDate';

type Pill = {
  category: Category;
  title: string;
  body: string;
  date?: string;
};

export function PillCard({
  pill,
  index,
  total,
  saved,
  onSave,
}: {
  pill: Pill;
  index: number;
  total: number;
  saved: boolean;
  onSave?: () => void;
}) {
  const dateLabel = pill.date ? formatPillDate(pill.date) : '';
  return (
    <View className="flex-1 bg-white rounded-card" style={styles.card}>
      <Badge category={pill.category} />
      <Text
        className="font-display-bold text-ink"
        style={{ fontSize: 22, lineHeight: 22 * 1.3, marginTop: 16, marginBottom: 12 }}
      >
        {pill.title}
      </Text>
      <Text
        className="font-body text-body-text"
        style={{ fontSize: 15, lineHeight: 15 * 1.65, flex: 1 }}
        numberOfLines={8}
      >
        {pill.body}
      </Text>
      <View style={styles.divider} />
      <View className="flex-row items-center justify-between" style={{ marginTop: 14 }}>
        <Text
          className="font-body text-body-text-muted"
          style={{ fontSize: 11, lineHeight: 13 }}
        >
          {index + 1} de {total}{dateLabel ? ` · ${dateLabel}` : ''}
        </Text>
        <SaveButton saved={saved} onPress={onSave} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E0DED8',
    padding: 20,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0DED8',
    marginTop: 14,
  },
});
