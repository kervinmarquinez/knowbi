# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

---

# KNOWBI? — Contexto completo del proyecto

> App de microaprendizaje diario en español con IA. Nombre de trabajo: **Sabías Que?** / **Knowbi?**
> Fase actual: desarrollo (validación con fake MVP completada o en curso antes de escribir código).

---

## Stack tecnológico (cerrado — no proponer alternativas salvo problema bloqueante)

| Herramienta | Función | Notas |
|-------------|---------|-------|
| React Native (Expo) | iOS + Android desde un código | expo-router para navegación basada en archivos |
| Supabase | BD + Auth + Storage | Gratis hasta 500 MB. Tablas core: `user_preferences`, `daily_pills` |
| Claude Haiku (Anthropic) | Generación de píldoras con IA | Batch nocturno, no tiempo real |
| RevenueCat | Gestión de suscripciones | Gratis hasta $2.500 MRR |
| Expo Notifications | Push notifications nativas | — |
| Amplitude | Analytics y retención | Gratis hasta 10 M eventos/mes |
| NativeWind | Estilos | Clases Tailwind en React Native |
| AsyncStorage | Datos locales | Sesión anónima por defecto; auth real (email+pass o Google) ofrecida en welcome y exigida para guardar / ver racha |

### Decisión técnica clave: batch nocturno
Cada noche un cron job a las 23:00 genera las píldoras del día siguiente para todos los usuarios activos y las almacena en Supabase. El usuario las ve instantáneas al abrir la app. **No generar en tiempo real.**

Optimización de escala: cachear píldoras compartidas entre usuarios con las mismas categorías. Puede reducir el coste de IA un 40–60% a escala.

### Costes de infraestructura de referencia
- 0 usuarios: ~€10/mes
- 500 usuarios: ~€25–35/mes
- 2.000 usuarios: ~€85–115/mes

---



**Estados y animaciones:**
- Swipe izquierda: sale por la izquierda con ligera rotación, 220ms ease-out, avanza a la siguiente
- Swipe derecha: sale por la derecha con ligera rotación, 220ms ease-out, vuelve a la anterior. Si ya estás en la primera (idx === 0), rebota.
- Tap bookmark: micro-bounce scale 1.2→1.0 en 200ms
- Última card (5/5): al salir, pantalla Completado entra desde abajo

**Navegación:** swipe horizontal con dirección semántica. Izquierda avanza, derecha retrocede. El guardado se hace con el bookmark de la card o el botón Guardar inferior.

---

## Pantallas — 17 en total

### MVP (11 pantallas)

**01 · Splash** — comprueba token Supabase. Si válido → home. Si no → onboarding. Máx 1,2s en pantalla.

**02 · Onboarding propuesta de valor** — 1 pantalla o máx 3 slides. "5 cosas que no sabías, cada día, en 3 minutos." Sin petición de email.

**03 · Selección de categorías** — Grid 4×4, 16 categorías. CTA activo solo con 3+ seleccionadas (máx 8). Se reutiliza desde Ajustes con preferencias preseleccionadas.

**04 · Configurar notificación** — Selector de hora + permiso push al SO. Link "Ahora no" existe pero visualmente desincentivado (texto pequeño). Retención D7 un 40–60% mayor con notificación activa.

**05 · Home — stack de 5 píldoras** — Cards apiladas, swipe vertical. Indicador de progreso 1/5…5/5. Contador de racha discreto arriba.

**07 · Completado + racha** — Tras deslizar la quinta. Racha actual (Nunito 64px amber). CTA "Quiero más hoy" → paywall. **Único punto de entrada al paywall.**

**08 · Sin píldoras aún hoy** — Aparece si el usuario abre antes de su hora configurada. Mensaje cálido + hora de llegada + CTA "Ver guardados". CRÍTICA para retención temprana — nunca pantalla vacía sin contexto.

**09 · Biblioteca de guardados** — Lista filtrable por chips de categoría. Estado vacío con mensaje motivacional (no de error).

**10 · Detalle de píldora guardada** — Mismo componente que pantalla 06. Solo cambia contexto y botón de acción. No desarrollar dos veces.

**11 · Perfil + estadísticas** — Racha actual/máxima, total leídas/guardadas, top 3 categorías. Plan actual: free/premium.

**14 · Ajustes** — Editar categorías (reutiliza pantalla 03) · hora de notificación · plan · legales · cerrar sesión.

### v1.1 post-lanzamiento (6 pantallas)

**06 · Detalle expandida** — Tap en card durante flujo. En MVP: bottom sheet modal.
**15 · Registro / login** — Supabase Auth magic link. Lazy: solo al comprar o sincronizar.
**16 · Compartir píldora** — react-native-view-shot + Share API nativo. Motor de viralidad orgánica clave.
**17 · Onboarding post-compra premium** — 1–2 slides. Solo si el flujo premium es suficientemente distinto.

---

## Modelo de monetización (cerrado)

MVP 100% gratuito — 5 píldoras/día para todos. La monetización se evaluará tras validar retención.

---

## User flow (referencia)

```
ZONA A — Onboarding primera vez
Splash → check sesión → [sin sesión] → Onboarding → Categorías → Notificación
→ Sistema genera primeras 5 píldoras → Home

ZONA B — Flujo diario (loop)
Push notification → Home (5 cards) → lee y desliza
→ [guardar?] sí: se guarda, vuelve al stack / no: siguiente
→ [quedan?] sí: loop / no: Pantalla Completado
→ [pide más?] sí: Paywall / no: sale hasta mañana

ZONA D — Tab bar permanente
Home · Guardados · Perfil + racha · Ajustes
```

---



## Prompt de generación de píldoras (Claude Haiku)

Output esperado: JSON con estructura `{ "title": "", "body": "", "category": "", "verified": true/false }`

Criterios de una píldora excelente:
- Dato sorprendente pero verificable (no mitos urbanos)
- 2–4 líneas de cuerpo, lenguaje accesible para adultos curiosos
- Título impactante que genera curiosidad antes de leer el cuerpo
- Categoría clara de las 16 disponibles
- Nunca más de 4 líneas en el cuerpo

---

## Las 16 categorías

```typescript
// constants/categories.ts
export const CATEGORIES = [
  { id: 'historia',      label: 'Historia',      bg: '#F1EFE8', text: '#444441' },
  { id: 'ciencia',       label: 'Ciencia',       bg: '#E1F5EE', text: '#085041' },
  { id: 'cine',          label: 'Cine',           bg: '#FAECE7', text: '#993C1D' },
  { id: 'arte',          label: 'Arte',           bg: '#FAECE7', text: '#993C1D' },
  { id: 'psicologia',    label: 'Psicología',     bg: '#EEEDFE', text: '#3C3489' },
  { id: 'tecnologia',    label: 'Tecnología',     bg: '#E6F1FB', text: '#0C447C' },
  { id: 'naturaleza',    label: 'Naturaleza',     bg: '#E1F5EE', text: '#085041' },
  { id: 'deporte',       label: 'Deporte',        bg: '#E6F1FB', text: '#0C447C' },
  { id: 'gastronomia',   label: 'Gastronomía',    bg: '#FAEEDA', text: '#633806' },
  { id: 'literatura',    label: 'Literatura',     bg: '#F1EFE8', text: '#444441' },
  { id: 'astronomia',    label: 'Astronomía',     bg: '#EEEDFE', text: '#3C3489' },
  { id: 'geografia',     label: 'Geografía',      bg: '#F1EFE8', text: '#444441' },
  { id: 'musica',        label: 'Música',         bg: '#E6F1FB', text: '#0C447C' },
  { id: 'economia',      label: 'Economía',       bg: '#FAEEDA', text: '#633806' },
  { id: 'medicina',      label: 'Medicina',       bg: '#E1F5EE', text: '#085041' },
  { id: 'arquitectura',  label: 'Arquitectura',   bg: '#FAECE7', text: '#993C1D' },
] as const;
```

---

## Microcopy aprobado (no modificar sin instrucción explícita)

| Contexto | Copy |
|----------|------|
| Tagline | 5 cosas que no sabías, cada día, en 3 minutos. |
| Onboarding título | Elige lo que te pica la curiosidad. |
| Push notification | Tus 5 del día están listas. Una te va a sorprender. |
| Completado título | ¡Ya tienes las 5 de hoy! |
| Completado racha | Llevas X días seguidos. Eso es mucho más que la mayoría. |
| Paywall título | Ya tienes tus 5 de hoy. |
| Paywall CTA | Empezar premium |
| Paywall escape | Ahora no |
| Sin píldoras aún | Aún no son las HH:MM. En X minutos tienes nuevas píldoras esperando. |
| Guardados vacíos | Aquí aparecerán las píldoras que guardes. Pulsa el marcador cuando encuentres algo que merezca quedarse. |
| Error técnico | Algo falló de nuestro lado. Reintentando... No pierdes tu racha. |
| Confirmación premium | Bienvenido al lado curioso del conocimiento. Tienes 10 píldoras al día. |

---

## Reglas de producto — no negociables en el código

1. **Un único CTA primario por pantalla.**
2. **El amber (#EF9F27) es exclusivo de la racha.** Si no es racha, no es amber.
3. **Nunito solo en títulos de píldoras, display y números de racha.** DM Sans en todo lo demás.
4. **Cuerpo de píldora: nunca más de 4 líneas.**
5. **Estados vacíos: siempre texto + ilustración/icono + CTA alternativo.** Nunca pantalla en blanco.
6. **Swipe horizontal en las cards con dirección semántica.** Izquierda avanza, derecha retrocede (con rebote en la primera card). El guardado va por bookmark o botón.
7. **Pantalla 03 (categorías) se reutiliza desde Ajustes.** No crear una pantalla nueva. El mismo `app/(onboarding)/categories.tsx` se usa con `?from=onboarding` (flujo nuevo) o sin parámetro (edición desde Ajustes).
8. **Pantalla 10 reutiliza el componente de la 06.** No duplicar código.
9. **Auth en welcome con anónimo permitido.** La primera pantalla (`app/(auth)/welcome.tsx`) ofrece Crear cuenta, Iniciar sesión y "Explorar sin cuenta". El flujo anónimo (`signInAnonymously` vía `ensureAnonymousSession`) sigue vivo. **Guardar píldoras y ver Guardados/Perfil exigen cuenta real** — en esos puntos se muestra `<AuthGate>` (Guardados, Perfil) o un `Alert` de upsell (botón Guardar / bookmark del Home).
10. **Build** Cada vez que editemos el código, mencionar al usuario si hay que volver a hacer un eas build o vale con un eas update.

---

## Subagentes Claude Code (`.claude/agents/`)

El proyecto usa 6 subagentes. Crear en `.claude/agents/` dentro del proyecto.

| Agente | Archivo | Modelo | Herramientas | Cuándo |
|--------|---------|--------|--------------|--------|
| schema-builder | schema-builder.md | Haiku | Read + Bash | Fase 1: schema Supabase |
| screen-builder | screen-builder.md | Sonnet | Read + Write + Edit | Fases 2–7: construir pantallas |
| pill-prompt-engineer | pill-prompt-engineer.md | Sonnet | Read + Bash | Fase 3: prompt de Haiku |
| bug-fixer | bug-fixer.md | Sonnet | Read + Write + Edit + Bash | Fase 8: testing |
| code-reviewer | code-reviewer.md | Haiku | Solo lectura | Continuo en paralelo |

**Principio:** el agente principal orquesta y decide. Los subagentes ejecutan en su propio contexto y devuelven solo el resumen. Los subagentes no pueden lanzar otros subagentes.

**Cómo invocar:** `"Use the screen-builder agent to create pantalla 05 — Home con stack de cards"`
**En paralelo:** `"Use screen-builder and code-reviewer in parallel on pantalla 05"`

---

