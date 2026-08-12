ALTER TABLE public.notification_prefs
  ADD COLUMN IF NOT EXISTS permission_state text NOT NULL DEFAULT 'default';

ALTER TABLE public.notification_prefs
  ADD CONSTRAINT notification_prefs_permission_state_check
  CHECK (permission_state IN ('default','granted','denied','unsupported'));