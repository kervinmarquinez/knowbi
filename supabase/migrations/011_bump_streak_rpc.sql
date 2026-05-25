-- Migration 011: racha atómica (nº4 del hardening).
--
-- Antes la racha se calculaba en el cliente (app/completed.tsx) con un patrón
-- leer→sumar→guardar sin candado: dos aperturas rápidas o dos dispositivos podían contar
-- de más o de menos. Aquí lo movemos a una función en la BD que lo hace todo en una sola
-- transacción con bloqueo de fila (FOR UPDATE), atada a auth.uid() para que cada usuario
-- solo afecte a su propia racha.
--
-- p_set_date = fecha del SET completado (windowDate del cliente), no el reloj: así es
-- robusta a zonas horarias y a cambios de la hora de drop. Devuelve la racha actual.

-- SECURITY INVOKER: el usuario ya tiene permiso por RLS sobre su propia fila de
-- user_streaks (políticas *_own), así que no hace falta DEFINER. Mínimo privilegio.
CREATE OR REPLACE FUNCTION public.bump_streak(p_set_date date)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row public.user_streaks%ROWTYPE;
  v_new_current integer;
  v_new_max integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'bump_streak: no authenticated user';
  END IF;

  -- Asegura la fila sin pisar una existente (idempotente ante carreras). El sentinel
  -- p_set_date - 2 garantiza que una fila recién creada caiga en la rama "primer día".
  INSERT INTO public.user_streaks (user_id, current_streak, max_streak, last_active_date)
  VALUES (v_user, 0, 0, p_set_date - 2)
  ON CONFLICT (user_id) DO NOTHING;

  -- Bloquea la fila: serializa llamadas concurrentes del mismo usuario.
  SELECT * INTO v_row FROM public.user_streaks WHERE user_id = v_user FOR UPDATE;

  IF v_row.last_active_date = p_set_date THEN
    RETURN v_row.current_streak;                 -- ya contado para este set
  ELSIF v_row.last_active_date = p_set_date - 1 THEN
    v_new_current := v_row.current_streak + 1;   -- día seguido
  ELSE
    v_new_current := 1;                          -- primer día o hueco > 1
  END IF;

  v_new_max := GREATEST(v_row.max_streak, v_new_current);

  UPDATE public.user_streaks
  SET current_streak = v_new_current,
      max_streak = v_new_max,
      last_active_date = p_set_date
  WHERE user_id = v_user;

  RETURN v_new_current;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bump_streak(date) TO anon, authenticated;
