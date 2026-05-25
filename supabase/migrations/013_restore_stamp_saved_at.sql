-- Migration 013: restaurar el sellado de saved_at en daily_pills.
--
-- La migración 003 definía la función stamp_saved_at() + trigger daily_pills_stamp_saved_at,
-- pero en producción no existen (drift). Resultado: saved_at quedaba NULL en todas las
-- píldoras guardadas y la pantalla de Guardadas (que ordena por saved_at DESC) salía en
-- orden arbitrario. Aquí recreamos el mecanismo y rellenamos las filas existentes.

CREATE OR REPLACE FUNCTION public.stamp_saved_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.is_saved = true AND (OLD.is_saved = false OR OLD.saved_at IS NULL) THEN
    NEW.saved_at = now();
  ELSIF NEW.is_saved = false THEN
    NEW.saved_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS daily_pills_stamp_saved_at ON public.daily_pills;
CREATE TRIGGER daily_pills_stamp_saved_at
  BEFORE UPDATE OF is_saved ON public.daily_pills
  FOR EACH ROW
  EXECUTE FUNCTION public.stamp_saved_at();

-- Backfill de las filas ya guardadas que se quedaron sin saved_at. No sabemos la fecha
-- real de guardado, así que usamos created_at como aproximación estable para el orden.
UPDATE public.daily_pills
SET saved_at = created_at
WHERE is_saved = true AND saved_at IS NULL;
