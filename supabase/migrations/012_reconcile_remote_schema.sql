-- Migration 012: reconciliación del drift de esquema (hecha a mano por inspección del
-- esquema en vivo, sin Docker). Hace que un rebuild desde migraciones reproduzca la BD de
-- producción a nivel FUNCIONAL, y es idempotente (segura de re-aplicar sobre la BD actual,
-- donde estos objetos ya existen).
--
-- Diferencias COSMÉTICAS que NO reproducimos a propósito (no afectan a la app y su
-- transformación sería arriesgada o innecesaria):
--   · user_preferences / user_streaks usan `id` como PK en producción; las migraciones
--     dejan `user_id` como PK. `user_id` es UNIQUE en ambos casos —que es lo que usa la
--     app para upsert y lookup—, así que es indiferente.
--   · Triggers updated_at redundantes (set_updated_at) que hay en producción:
--     update_updated_at_column ya cubre updated_at en estas tablas.
--
-- A REVISAR aparte (fuera del alcance de este fix): en producción no aparece el trigger
-- daily_pills_stamp_saved_at de la migración 003, que sella saved_at al guardar.

-- ── Columnas que faltaban en las migraciones ────────────────────────────────────────
ALTER TABLE public.daily_pills  ADD COLUMN IF NOT EXISTS read_at timestamptz;
ALTER TABLE public.shared_pills ADD COLUMN IF NOT EXISTS used_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.user_streaks ADD COLUMN IF NOT EXISTS total_pills_read  integer NOT NULL DEFAULT 0;
ALTER TABLE public.user_streaks ADD COLUMN IF NOT EXISTS total_pills_saved integer NOT NULL DEFAULT 0;
ALTER TABLE public.user_streaks ALTER COLUMN last_active_date DROP NOT NULL;

-- ── notification_time: TEXT → time (en prod ya es time; el guard lo hace solo en rebuild)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_preferences'
      AND column_name = 'notification_time' AND data_type = 'text'
  ) THEN
    ALTER TABLE public.user_preferences DROP CONSTRAINT IF EXISTS notification_time_format;
    ALTER TABLE public.user_preferences
      ALTER COLUMN notification_time TYPE time USING notification_time::time;
  END IF;
END $$;

-- ── Políticas RLS: nombres *_own definitivos, con (select auth.uid()) para que se evalúe
--    una vez por query y no por fila (advisor auth_rls_initplan). Idempotente. ─────────
-- daily_pills
DROP POLICY IF EXISTS "Users can SELECT own pills" ON public.daily_pills;
DROP POLICY IF EXISTS "Users can UPDATE own pills" ON public.daily_pills;
DROP POLICY IF EXISTS daily_pills_select_own ON public.daily_pills;
DROP POLICY IF EXISTS daily_pills_insert_own ON public.daily_pills;
DROP POLICY IF EXISTS daily_pills_update_own ON public.daily_pills;
DROP POLICY IF EXISTS daily_pills_delete_own ON public.daily_pills;

CREATE POLICY daily_pills_select_own ON public.daily_pills FOR SELECT
  USING ((select auth.uid()) = user_id);
CREATE POLICY daily_pills_insert_own ON public.daily_pills FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY daily_pills_update_own ON public.daily_pills FOR UPDATE
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY daily_pills_delete_own ON public.daily_pills FOR DELETE
  USING ((select auth.uid()) = user_id);

-- user_preferences
DROP POLICY IF EXISTS "Users can SELECT own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can INSERT own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can UPDATE own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS user_preferences_select_own ON public.user_preferences;
DROP POLICY IF EXISTS user_preferences_insert_own ON public.user_preferences;
DROP POLICY IF EXISTS user_preferences_update_own ON public.user_preferences;
DROP POLICY IF EXISTS user_preferences_delete_own ON public.user_preferences;

CREATE POLICY user_preferences_select_own ON public.user_preferences FOR SELECT
  USING ((select auth.uid()) = user_id);
CREATE POLICY user_preferences_insert_own ON public.user_preferences FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY user_preferences_update_own ON public.user_preferences FOR UPDATE
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY user_preferences_delete_own ON public.user_preferences FOR DELETE
  USING ((select auth.uid()) = user_id);
