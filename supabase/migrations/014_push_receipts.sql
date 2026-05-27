-- Receipts de push: guarda el ticket_id que Expo devuelve al ACEPTAR cada push.
-- Una 2ª pasada (~15 min después, dentro de send-daily-pushes) consulta
-- /push/getReceipts con esos IDs y, ante DeviceNotRegistered, pone
-- user_preferences.expo_push_token = NULL para que la app re-registre un token
-- fresco al siguiente arranque (ensurePushTokenRegistered). El ticket "ok" solo
-- significa "aceptado por Expo", no "entregado" — el receipt es la verdad.
--
-- Se guarda expo_push_token para anular de forma CONDICIONAL: si el usuario
-- re-registró otro token en la ventana de 15 min, no se pisa el nuevo.

CREATE TABLE IF NOT EXISTS public.push_receipts (
  ticket_id TEXT NOT NULL PRIMARY KEY,
  user_id UUID NOT NULL,
  expo_push_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_push_receipts_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- La 2ª pasada selecciona por antigüedad (created_at < now() - 15 min) y borra lo procesado.
CREATE INDEX IF NOT EXISTS idx_push_receipts_created_at ON public.push_receipts (created_at);

-- RLS habilitado sin políticas: solo el service_role (que salta RLS) accede.
-- Igual que shared_pills (migración 009). El cliente nunca toca esta tabla.
ALTER TABLE public.push_receipts ENABLE ROW LEVEL SECURITY;
