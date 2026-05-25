-- Migration 007: "hora de drop" personal.
--
-- Cambio de SIGNIFICADO de user_preferences.notification_time (no de tipo): antes era la
-- hora que el usuario elegía a mano para el aviso; ahora es la hora de drop del usuario —
-- a esa hora (Europe/Madrid) aparece su set nuevo del día y, si tiene notificaciones
-- activas, salta el push. El sender ya matchea contra esta columna, así que no cambia.
--
-- Por defecto la hora de drop se deriva de created_at (la hora a la que se registró el
-- usuario). Aquí hacemos el backfill de las filas que aún no tienen valor; el onboarding
-- fija la columna para los usuarios nuevos.

-- notification_time es de tipo `time` en la BD: casteamos el timestamp truncado a time.
UPDATE public.user_preferences
SET notification_time =
  (date_trunc('hour', created_at AT TIME ZONE 'Europe/Madrid'))::time
WHERE notification_time IS NULL;

COMMENT ON COLUMN public.user_preferences.notification_time IS
  'Hora de drop del usuario (HH:MM, Europe/Madrid): a esta hora aparece su set diario y, si notification_enabled, salta el push. Por defecto = hora de created_at.';
