-- Notification preferences (keyed by cookie-session subject, not Supabase auth)
CREATE TABLE public.notification_prefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_role text NOT NULL CHECK (subject_role IN ('resident','driver','admin')),
  subject_key text NOT NULL,
  nearby_alerts_enabled boolean NOT NULL DEFAULT true,
  alert_frequency text NOT NULL DEFAULT 'immediate'
    CHECK (alert_frequency IN ('immediate','every_15m','hourly','daily')),
  last_alert_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_role, subject_key)
);

GRANT ALL ON public.notification_prefs TO service_role;
ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read notification prefs" ON public.notification_prefs
  FOR SELECT TO authenticated USING (is_admin());

CREATE TABLE public.device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_role text NOT NULL CHECK (subject_role IN ('resident','driver','admin')),
  subject_key text NOT NULL,
  token text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'web' CHECK (platform IN ('web','android','ios')),
  user_agent text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  failure_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.device_tokens TO service_role;
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read device tokens" ON public.device_tokens
  FOR SELECT TO authenticated USING (is_admin());

CREATE INDEX idx_device_tokens_subject ON public.device_tokens (subject_role, subject_key) WHERE revoked_at IS NULL;

CREATE TABLE public.push_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_role text NOT NULL,
  subject_key text NOT NULL,
  token_id uuid REFERENCES public.device_tokens(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text,
  kind text NOT NULL DEFAULT 'generic',
  success boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.push_deliveries TO service_role;
ALTER TABLE public.push_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read push deliveries" ON public.push_deliveries
  FOR SELECT TO authenticated USING (is_admin());

CREATE INDEX idx_push_deliveries_created ON public.push_deliveries (created_at DESC);

CREATE TRIGGER update_notification_prefs_updated_at BEFORE UPDATE ON public.notification_prefs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_device_tokens_updated_at BEFORE UPDATE ON public.device_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_push_deliveries_updated_at BEFORE UPDATE ON public.push_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Lifecycle cleanup: drop revoked/stale tokens and old delivery logs
CREATE OR REPLACE FUNCTION public.prune_push_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.device_tokens
   WHERE (revoked_at IS NOT NULL AND revoked_at < now() - interval '7 days')
      OR last_seen_at < now() - interval '90 days'
      OR failure_count >= 5;
  DELETE FROM public.push_deliveries WHERE created_at < now() - interval '30 days';
END;
$$;

REVOKE ALL ON FUNCTION public.prune_push_data() FROM anon, authenticated;

SELECT cron.schedule('prune-push-data', '30 3 * * *', $$SELECT public.prune_push_data();$$);