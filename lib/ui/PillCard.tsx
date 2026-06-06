import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge } from './Badge';
import { SaveButton } from './SaveButton';
import { CATEGORY_RAMPS, type Category } from './categories';
import { formatPillDate } from '../formatPillDate';

// Tope de escalado de fuente del SO en la card del Home: la card es de tamaño fijo
// (no scrollea), así que sin tope la fuente máxima de accesibilidad desborda y trunca el
// cuerpo. A escala normal no se activa. La lectura completa sin truncar va por el sheet
// expandido (tap en la card → PillDetailView con ScrollView).
const TITLE_MAX_FONT_SCALE = 1.3;
const BODY_MAX_FONT_SCALE = 1.25;

type Pill = {
  category: Category;
  title: string;
  body: string;
  date?: string;
  is_read?: boolean;
};

export function PillCard({
  pill,
  index,
  total,
  saved,
  onSave,
  onPress,
}: {
  pill: Pill;
  index: number;
  total: number;
  saved: boolean;
  onSave?: () => void;
  onPress?: () => void;
}) {
  const ramp = CATEGORY_RAMPS[pill.category];
  const dateLabel = pill.date ? formatPillDate(pill.date) : '';
  return (
    <View className="flex-1 rounded-card" style={[styles.card, { backgroundColor: ramp.bg }]}>
      <Text
        className="font-display"
        style={[styles.ghostNumber, { color: ramp.text }]}
        allowFontScaling={false}
        accessible={false}
        importantForAccessibility="no"
      >
        {String(index + 1).padStart(2, '0')}
      </Text>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={onPress ? 'Ver píldora completa' : undefined}
        style={styles.tapArea}
      >
        <View className="flex-row items-center justify-between">
          <Badge category={pill.category} />
          {pill.is_read === false ? (
            <View
              accessibilityLabel="Píldora nueva"
              className="flex-row items-center gap-1.5 px-3 rounded-badge"
              style={{ backgroundColor: ramp.text, height: 26 }}
            >
              <Ionicons name="sparkles" size={12} color="#FFFFFF" />
              <Text
                className="font-body-medium"
                style={{ fontSize: 11, lineHeight: 11, color: '#FFFFFF' }}
                maxFontSizeMultiplier={BODY_MAX_FONT_SCALE}
              >
                Nueva
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          className="font-display-bold"
          style={[styles.title, { color: ramp.text }]}
          maxFontSizeMultiplier={TITLE_MAX_FONT_SCALE}
        >
          {pill.title}
        </Text>
        <Text
          className="font-body text-body-text"
          style={styles.body}
          numberOfLines={8}
          maxFontSizeMultiplier={BODY_MAX_FONT_SCALE}
        >
          {pill.body}
        </Text>
      </Pressable>
      <View style={[styles.divider, { borderTopColor: ramp.text }]} />
      <View className="flex-row items-center justify-between" style={{ marginTop: 14 }}>
        <Text
          className="font-body text-body-text-muted"
          style={styles.meta}
          maxFontSizeMultiplier={BODY_MAX_FONT_SCALE}
        >
          {index + 1} de {total}
          {dateLabel ? ` · ${dateLabel}` : ''}
        </Text>
        <SaveButton saved={saved} onPress={onSave} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 24,
    overflow: 'hidden',
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  tapArea: {
    flex: 1,
  },
  ghostNumber: {
    position: 'absolute',
    right: 16,
    top: 48,
    fontSize: 96,
    lineHeight: 96,
    opacity: 0.07,
  },
  title: {
    fontSize: 25,
    lineHeight: 25 * 1.25,
    letterSpacing: -0.3,
    marginTop: 16,
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    lineHeight: 15 * 1.65,
    flex: 1,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    opacity: 0.18,
    marginTop: 14,
  },
  meta: {
    fontSize: 12,
    lineHeight: 13,
  },
});
