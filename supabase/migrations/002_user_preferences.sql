-- Create user_preferences table
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID NOT NULL PRIMARY KEY,
  categories TEXT[] NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  notification_enabled BOOLEAN NOT NULL DEFAULT false,
  notification_time TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT categories_length CHECK (array_length(categories, 1) BETWEEN 3 AND 8),
  CONSTRAINT plan_valid CHECK (plan IN ('free', 'premium')),
  CONSTRAINT notification_time_format CHECK (notification_time IS NULL OR notification_time ~ '^[0-2][0-9]:[0-5][0-9]$')
);

-- Create index on updated_at for audit queries
CREATE INDEX idx_user_preferences_updated_at ON public.user_preferences(updated_at);

-- Enable Row Level Security
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can SELECT only their own row
CREATE POLICY "Users can SELECT own preferences"
  ON public.user_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can INSERT only with their own user_id
CREATE POLICY "Users can INSERT own preferences"
  ON public.user_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can UPDATE only their own row
CREATE POLICY "Users can UPDATE own preferences"
  ON public.user_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger for auto-updating updated_at
CREATE OR REPLACE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
