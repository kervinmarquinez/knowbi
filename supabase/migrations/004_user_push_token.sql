-- Add Expo push token to user_preferences
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

CREATE INDEX IF NOT EXISTS idx_user_preferences_expo_push_token
  ON public.user_preferences(expo_push_token)
  WHERE expo_push_token IS NOT NULL;
