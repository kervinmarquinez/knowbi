import { type ReactNode } from 'react';
import { Text, ScrollView } from 'react-native';
import { Badge } from './Badge';
import { CATEGORY_RAMPS, type Category } from './categories';
import { formatPillDate } from '../formatPillDate';

// Vista presentacional del contenido completo de una píldora: badge + título + fecha +
// cuerpo en ScrollView (sin numberOfLines → nunca trunca, da igual el tamaño de fuente).
// Compartida entre el detalle de guardada (pantalla 10) y el sheet expandido del flujo
// diario (pantalla 06). Pura: sin fetch ni supabase; el `footer` (p. ej. botón Guardar) lo
// inyecta cada contenedor.
export function PillDetailView({
  category,
  title,
  body,
  date,
  footer,
}: {
  category: Category;
  title: string;
  body: string;
  date: string;
  footer?: ReactNode;
}) {
  return (
    <>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <Badge category={category} />
        <Text
          className="font-display-bold"
          style={{
            fontSize: 26,
            lineHeight: 26 * 1.25,
            marginTop: 16,
            letterSpacing: -0.26,
            color: CATEGORY_RAMPS[category].text,
          }}
        >
          {title}
        </Text>
        <Text
          className="font-body text-body-text-muted"
          style={{ fontSize: 12, lineHeight: 14, marginTop: 8 }}
        >
          {formatPillDate(date)}
        </Text>
        <Text
          className="font-body text-body-text"
          style={{ fontSize: 16, lineHeight: 16 * 1.6, marginTop: 16 }}
        >
          {body}
        </Text>
      </ScrollView>
      {footer}
    </>
  );
}
