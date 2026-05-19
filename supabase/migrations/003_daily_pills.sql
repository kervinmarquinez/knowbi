-- shared_pills: cross-user cache to avoid regenerating identical pills
CREATE TABLE IF NOT EXISTS public.shared_pills (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  categories_hash TEXT NOT NULL,
  date DATE NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_pills_lookup
  ON public.shared_pills(categories_hash, date);

ALTER TABLE public.shared_pills ENABLE ROW LEVEL SECURITY;
-- No policies: only service role (edge functions) reads/writes shared_pills.

-- daily_pills: per-user pills assigned each day
CREATE TABLE IF NOT EXISTS public.daily_pills (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL,
  date DATE NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_saved BOOLEAN NOT NULL DEFAULT false,
  saved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.daily_pills
  ADD COLUMN IF NOT EXISTS saved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_daily_pills_user_date
  ON public.daily_pills(user_id, date);

CREATE INDEX IF NOT EXISTS idx_daily_pills_saved
  ON public.daily_pills(user_id, saved_at DESC)
  WHERE is_saved = true;

ALTER TABLE public.daily_pills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can SELECT own pills" ON public.daily_pills;
CREATE POLICY "Users can SELECT own pills"
  ON public.daily_pills FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can UPDATE own pills" ON public.daily_pills;
CREATE POLICY "Users can UPDATE own pills"
  ON public.daily_pills FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-stamp saved_at when a pill flips is_saved true→true (or false→true)
CREATE OR REPLACE FUNCTION public.stamp_saved_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_saved = true AND (OLD.is_saved = false OR OLD.saved_at IS NULL) THEN
    NEW.saved_at = now();
  ELSIF NEW.is_saved = false THEN
    NEW.saved_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS daily_pills_stamp_saved_at ON public.daily_pills;
CREATE TRIGGER daily_pills_stamp_saved_at
  BEFORE UPDATE OF is_saved ON public.daily_pills
  FOR EACH ROW
  EXECUTE FUNCTION public.stamp_saved_at();
