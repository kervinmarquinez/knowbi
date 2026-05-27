# Rediseño estético de la tarjeta de píldora — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar profundidad y atractivo a la tarjeta de píldora reutilizando el sistema de color por categoría, sin dependencias nativas nuevas.

**Architecture:** Cambios de estilo + lógica de mapeo de color/icono por categoría. El proyecto solo tiene tests Jest de lógica pura (no hay render testing), así que se aplica TDD a la lógica testeable (rampas de color, mapa de iconos, guard de contraste AA) y verificación manual + `tsc`/`lint` a los cambios visuales (sombra, tinte, número fantasma, micro-bounce). Una vez `PillCard` adopta el tinte de su categoría, el stack de detrás del Home muestra los tintes "gratis" porque cada card es su propia píldora.

**Tech Stack:** React Native (Expo), NativeWind, react-native-reanimated, @expo/vector-icons (Ionicons), Jest (jest-expo).

**Despliegue:** todo es JS + estilos + Ionicons (ya instalado) → `eas update` basta, **no** hace falta `eas build`.

**Spec:** [docs/superpowers/specs/2026-05-27-rediseno-tarjeta-pildora-design.md](../specs/2026-05-27-rediseno-tarjeta-pildora-design.md)

---

## Estructura de archivos

| Archivo | Responsabilidad | Acción |
|---------|-----------------|--------|
| `lib/ui/categories.ts` | Rampas de color + mapa de iconos por categoría | Modificar |
| `lib/__tests__/categories.test.ts` | Invariantes de rampas/iconos (cobertura, sin amber) | Crear |
| `lib/contrast.ts` | Cálculo WCAG de ratio de contraste | Crear |
| `lib/__tests__/contrast.test.ts` | Verifica el ratio y el guard AA del cuerpo sobre cada tinte | Crear |
| `lib/ui/Badge.tsx` | Badge con icono + borde tintado sobre fondo blanco | Modificar |
| `lib/ui/SaveButton.tsx` | Micro-bounce 1.2→1.0 al pulsar | Modificar |
| `lib/ui/PillCard.tsx` | Fondo tintado, sombra, título editorial, número fantasma, regla de acento | Modificar |
| `app/pill/[id].tsx` | Coherencia: tinte de fondo + título en color de categoría | Modificar |

---

## Task 1: Reasignar rampas (Gastronomía/Economía) y añadir mapa de iconos

**Files:**
- Modify: `lib/ui/categories.ts:53-54` (rampas) y final del archivo (nuevo mapa)
- Test: `lib/__tests__/categories.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/__tests__/categories.test.ts`:

```ts
import { CATEGORIES, CATEGORY_RAMPS, CATEGORY_ICONS } from '../ui/categories';

// Color amber reservado a la racha (CLAUDE.md regla 2) y su tinte/texto.
const RESERVED_AMBER = ['#EF9F27', '#FAEEDA', '#633806'];

describe('CATEGORY_RAMPS', () => {
  it('tiene una rampa para cada categoría', () => {
    for (const c of CATEGORIES) {
      expect(CATEGORY_RAMPS[c]).toBeDefined();
      expect(CATEGORY_RAMPS[c].bg).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(CATEGORY_RAMPS[c].text).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('ninguna rampa usa el amber reservado a la racha', () => {
    for (const c of CATEGORIES) {
      const { bg, text } = CATEGORY_RAMPS[c];
      expect(RESERVED_AMBER).not.toContain(bg.toUpperCase());
      expect(RESERVED_AMBER).not.toContain(text.toUpperCase());
    }
  });

  it('Gastronomía y Economía tienen los colores reasignados', () => {
    expect(CATEGORY_RAMPS['Gastronomía']).toEqual({ bg: '#FBEAF1', text: '#8A2D5C' });
    expect(CATEGORY_RAMPS['Economía']).toEqual({ bg: '#ECF0E4', text: '#4C5A2E' });
  });
});

describe('CATEGORY_ICONS', () => {
  it('tiene un icono para cada categoría', () => {
    for (const c of CATEGORIES) {
      expect(typeof CATEGORY_ICONS[c]).toBe('string');
      expect(CATEGORY_ICONS[c].length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `npm test -- categories`
Expected: FAIL — `CATEGORY_ICONS` no existe (undefined) y las rampas de Gastronomía/Economía aún son las viejas (`#FAEEDA`).

- [ ] **Step 3: Implementar el cambio mínimo**

En `lib/ui/categories.ts`, reemplazar las dos líneas de las rampas amber:

```ts
  Gastronomía: { bg: '#FBEAF1', text: '#8A2D5C' },
  Economía: { bg: '#ECF0E4', text: '#4C5A2E' },
```

Y añadir al final del archivo el mapa de iconos (import de tipo arriba, junto al resto):

```ts
import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export const CATEGORY_ICONS: Record<Category, IoniconName> = {
  Ciencia: 'flask',
  Historia: 'hourglass',
  Astronomía: 'planet',
  Arte: 'color-palette',
  Tecnología: 'hardware-chip',
  Música: 'musical-notes',
  Gastronomía: 'restaurant',
  Naturaleza: 'leaf',
  Cine: 'film',
  Psicología: 'happy',
  Literatura: 'book',
  Geografía: 'earth',
  Medicina: 'medkit',
  Deporte: 'fitness',
  Economía: 'trending-up',
  Arquitectura: 'business',
};
```

El `import type` se borra en compilación, así que no añade dependencia en runtime y el test Jest no carga `@expo/vector-icons`.

- [ ] **Step 4: Ejecutar el test para verificar que pasa**

Run: `npm test -- categories`
Expected: PASS (3 + 1 tests verdes).

- [ ] **Step 5: Commit**

```bash
git add lib/ui/categories.ts lib/__tests__/categories.test.ts
git commit -m "feat(categories): reasignar rampas amber y añadir mapa de iconos"
```

---

## Task 2: Guard de contraste AA del cuerpo sobre cada tinte

**Files:**
- Create: `lib/contrast.ts`
- Test: `lib/__tests__/contrast.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `lib/__tests__/contrast.test.ts`:

```ts
import { contrastRatio } from '../contrast';
import { CATEGORIES, CATEGORY_RAMPS } from '../ui/categories';

const BODY_TEXT = '#444441'; // color del cuerpo de la píldora

describe('contrastRatio', () => {
  it('da ~21 entre negro y blanco', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
  });

  it('es simétrico', () => {
    expect(contrastRatio('#444441', '#E1F5EE')).toBeCloseTo(
      contrastRatio('#E1F5EE', '#444441'),
      5,
    );
  });
});

describe('guard AA: cuerpo sobre el tinte de cada categoría', () => {
  it('todas las rampas cumplen AA (≥ 4.5:1) para el texto del cuerpo', () => {
    for (const c of CATEGORIES) {
      const ratio = contrastRatio(BODY_TEXT, CATEGORY_RAMPS[c].bg);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });
});
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `npm test -- contrast`
Expected: FAIL — `lib/contrast.ts` no existe (Cannot find module).

- [ ] **Step 3: Implementar el cálculo de contraste WCAG**

Crear `lib/contrast.ts`:

```ts
// Ratio de contraste WCAG 2.x entre dos colores hex (#RRGGBB).

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
```

- [ ] **Step 4: Ejecutar el test para verificar que pasa**

Run: `npm test -- contrast`
Expected: PASS. (Todos los tintes son muy claros y el cuerpo `#444441` es oscuro → ratio ~8:1, holgadamente sobre 4.5.)

- [ ] **Step 5: Commit**

```bash
git add lib/contrast.ts lib/__tests__/contrast.test.ts
git commit -m "test(a11y): guard de contraste AA del cuerpo sobre tintes de categoría"
```

---

## Task 3: Badge con icono y borde tintado

**Files:**
- Modify: `lib/ui/Badge.tsx` (archivo completo)

- [ ] **Step 1: Reemplazar el contenido de `lib/ui/Badge.tsx`**

El fondo del badge pasa a blanco (porque la card ya estará tintada con el mismo color, y un badge tintado sobre card tintada desaparecería). Borde e icono en el color de texto de la categoría.

```tsx
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
```

- [ ] **Step 2: Typecheck y lint**

Run: `npx tsc --noEmit`
Expected: sin errores. (Si el nombre de un icono no existe en Ionicons, `CATEGORY_ICONS` ya falló en compilación en Task 1; aquí se confirma su uso.)

Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add lib/ui/Badge.tsx
git commit -m "feat(badge): icono de categoría y borde tintado sobre fondo blanco"
```

---

## Task 4: Micro-bounce del bookmark

**Files:**
- Modify: `lib/ui/SaveButton.tsx` (archivo completo)

- [ ] **Step 1: Reemplazar el contenido de `lib/ui/SaveButton.tsx`**

Micro-bounce scale 1.2→1.0 en 200ms (100+100) con Reanimated (ya es dependencia). Cierra el gap del spec de CLAUDE.md.

```tsx
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export function SaveButton({ saved, onPress }: { saved: boolean; onPress?: () => void }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    scale.value = withSequence(
      withTiming(1.2, { duration: 100 }),
      withTiming(1, { duration: 100 }),
    );
    onPress?.();
  };

  return (
    <Pressable
      onPress={handlePress}
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
      <Animated.View style={animatedStyle}>
        <Ionicons
          name={saved ? 'bookmark' : 'bookmark-outline'}
          size={14}
          color={saved ? '#534AB7' : '#1A1A2E'}
        />
      </Animated.View>
    </Pressable>
  );
}
```

- [ ] **Step 2: Typecheck y lint**

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 3: Verificación manual**

Run: `npx expo start` y abrir en el dispositivo/emulador.
Observar: al pulsar el bookmark de una píldora, el icono hace un pequeño rebote (crece a 1.2× y vuelve a 1.0 en ~200ms). El estado guardado (relleno púrpura) cambia como antes.

- [ ] **Step 4: Commit**

```bash
git add lib/ui/SaveButton.tsx
git commit -m "feat(save-button): micro-bounce 1.2→1.0 al pulsar el bookmark"
```

---

## Task 5: Rediseño de PillCard (tinte, sombra, título editorial, número fantasma)

**Files:**
- Modify: `lib/ui/PillCard.tsx` (archivo completo)

- [ ] **Step 1: Reemplazar el contenido de `lib/ui/PillCard.tsx`**

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { Badge } from './Badge';
import { SaveButton } from './SaveButton';
import { CATEGORY_RAMPS, type Category } from './categories';
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
  const ramp = CATEGORY_RAMPS[pill.category];
  const dateLabel = pill.date ? formatPillDate(pill.date) : '';
  return (
    <View className="flex-1 rounded-card" style={[styles.card, { backgroundColor: ramp.bg }]}>
      <Text
        className="font-display"
        style={[styles.ghostNumber, { color: ramp.text }]}
        allowFontScaling={false}
      >
        {String(index + 1).padStart(2, '0')}
      </Text>
      <Badge category={pill.category} />
      <Text
        className="font-display-bold"
        style={[styles.title, { color: ramp.text }]}
      >
        {pill.title}
      </Text>
      <Text
        className="font-body text-body-text"
        style={styles.body}
        numberOfLines={8}
      >
        {pill.body}
      </Text>
      <View style={[styles.divider, { borderTopColor: ramp.text }]} />
      <View className="flex-row items-center justify-between" style={{ marginTop: 14 }}>
        <Text className="font-body text-body-text-muted" style={styles.meta}>
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
});
```

Notas de diseño aplicadas:
- Se elimina el `borderWidth`/`borderColor` gris: el tinte + la sombra ya separan la card del fondo `#F7F7FC`.
- `overflow: 'hidden'` recorta el número fantasma a las esquinas redondeadas.
- El número fantasma es el primer hijo (se pinta detrás) con opacidad 0.07 → no compite con el texto.
- Título y número usan `ramp.text` (Nunito display) — nunca amber, respeta reglas 2 y 3.

- [ ] **Step 2: Typecheck y lint**

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 3: Verificación manual**

Run: `npx expo start` y abrir el Home.
Observar:
1. Cada una de las 5 píldoras tiene un fondo de color distinto según su categoría.
2. La card del frente proyecta una sombra suave y se percibe elevada sobre el fondo.
3. Hay un número grande "01"…"05" muy tenue arriba a la derecha.
4. El badge se lee bien (blanco con borde de color) sobre la card tintada.
5. El cuerpo se lee con comodidad sobre cualquier tinte.
6. Al deslizar, las cards de detrás asoman ya con su propio color.

- [ ] **Step 4: Commit**

```bash
git add lib/ui/PillCard.tsx
git commit -m "feat(pill-card): tinte por categoría, sombra, título editorial y número fantasma"
```

---

## Task 6: Coherencia en el detalle de píldora

**Files:**
- Modify: `app/pill/[id].tsx:75` (SafeAreaView) y `app/pill/[id].tsx:104-109` (título)

- [ ] **Step 1: Tintar el fondo y el título del detalle con el color de categoría**

El detalle ya usa `Badge` (hereda el icono automáticamente de Task 3). Para coherencia con la card, tintar el fondo de la pantalla y el título cuando hay píldora cargada.

Añadir el import de las rampas junto a los demás imports (tras la línea 10):

```tsx
import { CATEGORY_RAMPS } from '../../lib/ui/categories';
```

Reemplazar la apertura del `SafeAreaView` (línea 75):

```tsx
    <SafeAreaView
      className="flex-1"
      edges={['top', 'bottom']}
      style={{ backgroundColor: pill ? CATEGORY_RAMPS[pill.category].bg : '#F7F7FC' }}
    >
```

Reemplazar el `Text` del título (líneas 104-109) para usar el color de categoría:

```tsx
            <Text
              className="font-display-bold"
              style={{
                fontSize: 26,
                lineHeight: 26 * 1.25,
                marginTop: 16,
                letterSpacing: -0.26,
                color: CATEGORY_RAMPS[pill.category].text,
              }}
            >
              {pill.title}
            </Text>
```

El estado `notFound` y el de carga (`pill === null`) mantienen el fondo `#F7F7FC` por el fallback del `style`.

- [ ] **Step 2: Typecheck y lint**

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 3: Verificación manual**

Run: `npx expo start`, ir a Guardados y abrir una píldora guardada.
Observar: el detalle tiene el mismo tinte de fondo que la card, el badge muestra el icono y el título va en el color de la categoría. El botón Guardar/Quitar sigue funcionando.

- [ ] **Step 4: Commit**

```bash
git add app/pill/[id].tsx
git commit -m "feat(pill-detail): tinte de categoría coherente con la tarjeta"
```

---

## Verificación final

- [ ] `npm test` — toda la suite verde (incluye Task 1 y 2).
- [ ] `npx tsc --noEmit` — sin errores de tipos.
- [ ] `npm run lint` — sin errores nuevos.
- [ ] QA manual en dispositivo (Home + detalle): los 6 criterios de éxito del spec se cumplen.
- [ ] Despliegue por `eas update` (no `eas build`): confirmar al usuario.

## Criterios de éxito (del spec)

1. Las 5 píldoras del día se distinguen por color → Task 5.
2. La card del frente se percibe elevada (sombra) → Task 5.
3. El bookmark hace micro-bounce → Task 4.
4. Ninguna tarjeta usa amber; Gastronomía/Economía reasignadas → Task 1 (test) + Task 5.
5. Contraste del cuerpo cumple AA sobre cualquier tinte → Task 2 (test).
6. Sin dependencias nativas; despliegue por `eas update` → toda la implementación.
