-- Deduplicación del push diario: última fecha (hora Madrid) en que se envió el push.
-- Evita reenviar si el usuario cambia su hora de notificación a una posterior el mismo día.
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS last_push_date DATE;
