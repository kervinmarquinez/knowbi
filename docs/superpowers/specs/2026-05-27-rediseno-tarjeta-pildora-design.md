# Rediseño estético de la tarjeta de píldora

**Fecha:** 2026-05-27
**Estado:** aprobado, pendiente de plan de implementación
**Dirección elegida:** A (color por categoría) + B (editorial) combinadas

## Contexto

La tarjeta de píldora es el núcleo de Knowbi: el usuario ve 5 cada día. Hoy
([lib/ui/PillCard.tsx](../../../lib/ui/PillCard.tsx)) es funcional pero plana.
Diagnóstico:

1. **Sin contraste de superficie.** Card blanco puro `#FFFFFF` sobre fondo casi
   blanco `#F7F7FC`, separados solo por una línea de pelo `#E0DED8`. La tarjeta
   apenas se distingue del fondo.
2. **Sin elevación.** El stack de detrás tiene profundidad (escala/translateY/
   opacity), pero la card del frente no tiene sombra → se ve plana.
3. **Color infrautilizado.** Existen 6 familias de color por categoría y solo
   aparecen en un badge de 24px. Las 5 píldoras diarias se ven idénticas.
4. **Vacío vertical.** El cuerpo está capado a 4 líneas (regla de producto), lo
   que deja espacio en blanco sin jerarquía ni anclaje visual.
5. **Gap conocido:** el micro-bounce 1.2→1.0 del bookmark que especifica
   CLAUDE.md no está implementado ([lib/ui/SaveButton.tsx](../../../lib/ui/SaveButton.tsx)
   es un `Pressable` plano).

## Objetivo

Dar atractivo y profundidad a la tarjeta reutilizando el sistema de color
existente, sin dependencias nativas nuevas (solo `eas update`), respetando las
reglas de producto de CLAUDE.md.

## Diseño

### Anatomía de la tarjeta

```
┌─────────────────────────────────┐  ← fondo tintado con color de categoría
│  [◆ icono]  Ciencia              │     (bg de la rampa, muy claro)
│                                  │  ← sombra suave: la card flota
│  Título más grande y con         │     sobre #F7F7FC
│  presencia editorial             │
│                                  │        01   ← número índice "fantasma"
│  Cuerpo 2-4 líneas, DM Sans,     │             (Nunito, color categoría,
│  ritmo vertical cómodo.          │             baja opacidad) como grafismo
│  ──────────────                  │  ← regla de acento tintada
│  1 de 5 · 27 may      [🔖]       │  ← bookmark con micro-bounce
└─────────────────────────────────┘
```

### Cambios concretos

| Elemento | Hoy | Nuevo |
|----------|-----|-------|
| Fondo card | `#FFFFFF` | Tinte de categoría (`bg` de la rampa) |
| Elevación | Solo hairline border | Sombra suave (iOS-like) en la card del frente |
| Badge | Punto de color + label | Icono Ionicons por categoría + label + borde tintado |
| Título | Nunito 700, 22px | Nunito 700, 24-26px, `letterSpacing: -0.3` |
| Grafismo | — | Número índice "01" grande, Nunito display, color de categoría, baja opacidad |
| Divisor | Hairline gris `#E0DED8` | Regla de acento tintada con color de categoría |
| Bookmark | Pressable plano | Micro-bounce scale 1.2→1.0 en 200ms |
| Stack detrás | Cards blancas escaladas | Asoman su tinte de categoría → se intuye variedad |

### Reasignación de color: Gastronomía y Economía

Hoy ambas comparten amber-soft `#FAEEDA` / text `#633806`, que choca con la
regla 2 de CLAUDE.md ("el amber `#EF9F27` es exclusivo de la racha"). Se les
asignan dos familias nuevas, inequívocamente distintas del amber:

| Categoría | bg nuevo | text nuevo | Idea |
|-----------|----------|------------|------|
| Gastronomía | `#FBEAF1` | `#8A2D5C` | Baya/vino — cálido, apetitoso |
| Economía | `#ECF0E4` | `#4C5A2E` | Oliva/verde — crecimiento |

Hex tentativos: deben validarse para contraste AA del cuerpo `#444441` sobre el
nuevo `bg` y se ajustan al verlos en pantalla.

### Mapa de iconos (Ionicons, ya es dependencia)

| Categoría | Icono | Categoría | Icono |
|-----------|-------|-----------|-------|
| Ciencia | `flask` | Psicología | `happy` |
| Historia | `hourglass` | Literatura | `book` |
| Astronomía | `planet` | Geografía | `earth` |
| Arte | `color-palette` | Medicina | `medkit` |
| Tecnología | `hardware-chip` | Deporte | `fitness` |
| Música | `musical-notes` | Economía | `trending-up` |
| Gastronomía | `restaurant` | Arquitectura | `business` |
| Naturaleza | `leaf` | Cine | `film` |

Variante `-outline` para el badge.

## Reglas de producto respetadas

- **Regla 2 (amber exclusivo de racha):** ninguna tarjeta usa amber; Gastronomía
  y Economía se reasignan; el número fantasma usa color de categoría, nunca amber.
- **Regla 3 (Nunito solo en títulos/display/racha):** título y número fantasma
  son Nunito (display); cuerpo y footer siguen en DM Sans.
- **Regla 4 (cuerpo ≤ 4 líneas):** sin cambios; el número fantasma rellena el
  vacío vertical, no más texto.
- **Regla 8 (pantalla 10 reutiliza la 06):** el detalle [pill/[id].tsx](../../../app/pill/[id].tsx)
  hereda Badge + tinte para mantener coherencia.
- **Regla 10 (build):** todo es JS + estilos + Ionicons (ya instalado) →
  **basta `eas update`, no hace falta `eas build`**.

## Archivos afectados

- [lib/ui/categories.ts](../../../lib/ui/categories.ts) — nuevas rampas
  (Gastronomía/Economía) + mapa de iconos por categoría.
- [lib/ui/Badge.tsx](../../../lib/ui/Badge.tsx) — icono en vez del punto, borde tintado.
- [lib/ui/PillCard.tsx](../../../lib/ui/PillCard.tsx) — fondo tintado, sombra,
  título editorial, número fantasma, regla de acento.
- [lib/ui/SaveButton.tsx](../../../lib/ui/SaveButton.tsx) — micro-bounce.
- [app/(tabs)/index.tsx](../../../app/(tabs)/index.tsx) — el stack de detrás
  asoma el tinte de categoría.
- [app/pill/[id].tsx](../../../app/pill/[id].tsx) — coherencia (hereda Badge/tinte).

## Criterios de éxito

1. Las 5 píldoras del día se distinguen visualmente entre sí por color.
2. La card del frente se percibe elevada sobre el fondo (sombra).
3. El bookmark hace micro-bounce al guardar.
4. Gastronomía y Economía no usan amber; ninguna tarjeta usa amber.
5. Contraste del cuerpo sobre cualquier tinte de categoría cumple AA.
6. No se introducen dependencias nativas (despliegue por `eas update`).

## Fuera de alcance (fase 2)

- Dirección C: texturas/patrones por categoría, blur real en el stack
  (`expo-blur` requeriría `eas build`).
- Ilustración o imágenes generadas por píldora.
