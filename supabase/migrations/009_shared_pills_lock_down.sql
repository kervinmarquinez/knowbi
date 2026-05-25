-- Migration 009: cerrar la lectura de shared_pills (nº6 del hardening).
--
-- shared_pills es la caché interna de píldoras generadas. El diseño original (migración
-- 003) decía "sin políticas: solo el service role accede". En algún momento se añadió fuera
-- del repo una política `shared_pills_select_authenticated` que deja a CUALQUIER usuario
-- (incl. anónimo) leer toda la caché. La app nunca consulta shared_pills directamente
-- (solo las Edge Functions, que usan service_role), así que quitarla no rompe el cliente.
--
-- RLS sigue habilitado; al quedar sin políticas, ningún rol normal puede leer/escribir y
-- solo el service_role (que salta RLS) accede, como estaba previsto.

DROP POLICY IF EXISTS shared_pills_select_authenticated ON public.shared_pills;
