-- Create user_streaks table
CREATE TABLE IF NOT EXISTS public.user_streaks (
  user_id UUID NOT NULL PRIMARY KEY,
  current_streak INT NOT NULL DEFAULT 0,
  max_streak INT NOT NULL DEFAULT 0,
  last_active_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create index on updated_at for audit queries (optional but useful)
CREATE INDEX idx_user_streaks_updated_at ON public.user_streaks(updated_at);

-- Enable Row Level Security
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can SELECT only their own row
CREATE POLICY "Users can SELECT own streak"
  ON public.user_streaks
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can INSERT only with their own user_id
CREATE POLICY "Users can INSERT own streak"
  ON public.user_streaks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can UPDATE only their own row
CREATE POLICY "Users can UPDATE own streak"
  ON public.user_streaks
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating updated_at
CREATE OR REPLACE TRIGGER update_user_streaks_updated_at
  BEFORE UPDATE ON public.user_streaks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
