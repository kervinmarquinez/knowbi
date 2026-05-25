-- Migration 010: blindar el search_path de las funciones (nº5 del hardening).
--
-- El advisor de seguridad marca update_updated_at_column y set_updated_at con search_path
-- mutable: un search_path no fijado permite, en ciertos contextos, que se resuelvan objetos
-- de un esquema controlado por el atacante. Fijarlo a '' obliga a usar nombres calificados
-- (las funciones ya usan funciones de pg_catalog como now()).
--
-- set_updated_at puede no existir en una BD recreada desde el repo (entró fuera de las
-- migraciones), así que su ALTER va protegido por una comprobación de existencia.

ALTER FUNCTION public.update_updated_at_column() SET search_path = '';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'set_updated_at'
  ) THEN
    ALTER FUNCTION public.set_updated_at() SET search_path = '';
  END IF;
END $$;
