-- Migration 008: normalizar las políticas RLS de user_streaks.
--
-- La tabla acumuló DOS juegos de políticas equivalentes: las antiguas "Users can ..." de
-- la migración 001 y unas nuevas user_streaks_*_own que se añadieron fuera del repo. Tener
-- ambas obliga a Postgres a evaluar las dos en cada query (advisor de rendimiento
-- multiple_permissive_policies). Aquí dejamos UN solo juego.
--
-- Además escribimos auth.uid() como (select auth.uid()) para que se evalúe una vez por
-- query y no por fila (advisor auth_rls_initplan), que es la forma recomendada por Supabase.
--
-- Idempotente: borra ambos juegos y recrea el definitivo, así queda igual se ejecute sobre
-- la BD real (con drift) o sobre una BD recreada desde migraciones.

DROP POLICY IF EXISTS "Users can SELECT own streak" ON public.user_streaks;
DROP POLICY IF EXISTS "Users can INSERT own streak" ON public.user_streaks;
DROP POLICY IF EXISTS "Users can UPDATE own streak" ON public.user_streaks;
DROP POLICY IF EXISTS user_streaks_select_own ON public.user_streaks;
DROP POLICY IF EXISTS user_streaks_insert_own ON public.user_streaks;
DROP POLICY IF EXISTS user_streaks_update_own ON public.user_streaks;
DROP POLICY IF EXISTS user_streaks_delete_own ON public.user_streaks;

CREATE POLICY user_streaks_select_own
  ON public.user_streaks FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY user_streaks_insert_own
  ON public.user_streaks FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY user_streaks_update_own
  ON public.user_streaks FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY user_streaks_delete_own
  ON public.user_streaks FOR DELETE
  USING ((select auth.uid()) = user_id);
