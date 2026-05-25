# Reconciliación de esquema (migraciones ↔ BD real)

> **Estado: CERRADO** ✅ (sin Docker, vía migración `012_reconcile_remote_schema.sql`).
> El repo (`supabase/migrations/` 001–012) ya reproduce la BD de producción a nivel
> funcional. No hace falta `supabase db pull`.

## Qué pasaba

La BD de producción tenía objetos creados fuera del repo (drift): el repo no podía
recrear la BD. Detectado por advisors + inspección del esquema en vivo.

## Cómo se resolvió

1. **Historial alineado** (hecho con `migration repair`, sin Docker):
   - Se registró la `007` (estaba aplicada a mano sin registrar).
   - Se quitaron del historial las entradas con timestamp de los applies por MCP; las
     migraciones quedaron como `008`–`011`.
2. **Migración `012_reconcile_remote_schema.sql`** captura el resto del drift de forma
   idempotente (segura de re-aplicar sobre la BD actual):
   - Columnas que faltaban: `daily_pills.read_at`, `shared_pills.used_count`,
     `user_streaks.total_pills_read/saved`, `user_streaks.last_active_date` nullable.
   - `user_preferences.notification_time` TEXT → `time` (con guard para rebuilds).
   - Políticas RLS de `daily_pills` y `user_preferences` con nombres `*_own` definitivos
     y `(select auth.uid())` (también limpia el advisor `auth_rls_initplan`).

## Diferencias cosméticas NO reproducidas (a propósito)

- `user_preferences` / `user_streaks` usan `id` como PK en producción; las migraciones
  dejan `user_id` como PK. `user_id` es UNIQUE en ambos casos (lo que usa la app para
  upsert/lookup), así que es indiferente.
- Triggers `updated_at` redundantes (`set_updated_at`) que hay en prod:
  `update_updated_at_column` ya cubre `updated_at`.

## A revisar aparte (fuera de este hardening)

- En producción **no aparece** el trigger `daily_pills_stamp_saved_at` de la migración
  003, que sella `saved_at` al guardar una píldora. Conviene comprobar que `saved_at` se
  está rellenando en prod (lo usa el orden de la biblioteca de guardados).

## Detalle menor del historial

La `012` quedó registrada en remoto con versión timestamp (la asigna el apply por MCP),
mientras el archivo local es `012_…`. Es inofensivo: la migración es idempotente, así que
un `db push` futuro la re-aplica sin romper nada. Si quieres el historial 100% pristino:
`supabase migration repair --status reverted <timestamp_de_012>` y luego `supabase db push`.

## Regla a partir de ahora

Cero ediciones manuales en Supabase Studio. Todo cambio de esquema entra por un archivo de
migración commiteado.
