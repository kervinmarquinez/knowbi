-- Migration 005: preparación para crons (generator + sender)
--
-- Cambios:
--   1. Drop tabla huérfana push_tokens (creada manualmente en remoto, 0 filas).
--      El código real guarda el token en user_preferences.expo_push_token.
--   2. Añadir last_active_at: el cron generador filtra usuarios activos
--      (abrieron la app en las últimas 24h) para no quemar tokens en
--      usuarios fantasma.
--   3. Índices para que las queries de ambos crons sean O(log n).

-- 1. Cleanup
DROP TABLE IF EXISTS public.push_tokens CASCADE;

-- 2. Nueva columna
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- 3. Índices

-- Generador cron: busca usuarios cuyo last_active_at >= NOW() - INTERVAL '24 hours'
CREATE INDEX IF NOT EXISTS idx_user_prefs_last_active
  ON public.user_preferences (last_active_at)
  WHERE last_active_at IS NOT NULL;

-- Sender cron: busca usuarios cuyo notification_time = 'HH:MM' actual (Madrid)
-- Solo indexamos filas elegibles para recibir push.
CREATE INDEX IF NOT EXISTS idx_user_prefs_notif_time
  ON public.user_preferences (notification_time)
  WHERE notification_enabled = true AND expo_push_token IS NOT NULL;
