CREATE TYPE public.complaint_status AS ENUM ('open', 'in_progress', 'resolved', 'rejected');
CREATE TYPE public.notification_type AS ENUM ('truck_nearby','truck_arrived','route_started','route_completed','announcement','emergency','complaint_update','system');

-- citizen_geofence_settings -------------------------------------------------
CREATE TABLE public.citizen_geofence_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  home_location geography(Point, 4326) NOT NULL,
  address text,
  ward text,
  radius_meters integer NOT NULL DEFAULT 500 CHECK (radius_meters IN (100, 250, 500, 1000)),
  notify_enabled boolean NOT NULL DEFAULT true,
  inside_truck_id uuid REFERENCES public.trucks(id) ON DELETE SET NULL,
  last_notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_geofence_gist ON public.citizen_geofence_settings USING GIST (home_location);
CREATE INDEX idx_geofence_enabled ON public.citizen_geofence_settings(notify_enabled) WHERE notify_enabled;
CREATE INDEX idx_geofence_user ON public.citizen_geofence_settings(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.citizen_geofence_settings TO authenticated;
GRANT ALL ON public.citizen_geofence_settings TO service_role;
ALTER TABLE public.citizen_geofence_settings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_geofence_updated BEFORE UPDATE ON public.citizen_geofence_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "Citizens manage own geofence" ON public.citizen_geofence_settings
  FOR ALL TO authenticated USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid());

-- notifications -------------------------------------------------------------
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL,
  type public.notification_type NOT NULL DEFAULT 'system',
  title text NOT NULL,
  body text NOT NULL,
  deep_link text,
  truck_id uuid REFERENCES public.trucks(id) ON DELETE SET NULL,
  read boolean NOT NULL DEFAULT false,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_recipient ON public.notifications(recipient_id, sent_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications(recipient_id) WHERE NOT read;
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_notifications_updated BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (recipient_id = auth.uid() OR public.is_admin());
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());

-- complaints ----------------------------------------------------------------
CREATE TABLE public.complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id uuid NOT NULL,
  category text NOT NULL,
  description text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 2000),
  location geography(Point, 4326),
  ward text,
  photo_url text,
  status public.complaint_status NOT NULL DEFAULT 'open',
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_complaints_citizen ON public.complaints(citizen_id, created_at DESC);
CREATE INDEX idx_complaints_status ON public.complaints(status);
GRANT SELECT, INSERT, UPDATE ON public.complaints TO authenticated;
GRANT ALL ON public.complaints TO service_role;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_complaints_updated BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "Citizens read own complaints" ON public.complaints
  FOR SELECT TO authenticated USING (citizen_id = auth.uid() OR public.is_admin());
CREATE POLICY "Citizens create complaints" ON public.complaints
  FOR INSERT TO authenticated WITH CHECK (citizen_id = auth.uid());
CREATE POLICY "Admins update complaints" ON public.complaints
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- feedback ------------------------------------------------------------------
CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (comment IS NULL OR char_length(comment) <= 1000),
  truck_id uuid REFERENCES public.trucks(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_feedback_citizen ON public.feedback(citizen_id, created_at DESC);
GRANT SELECT, INSERT ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Citizens read own feedback" ON public.feedback
  FOR SELECT TO authenticated USING (citizen_id = auth.uid() OR public.is_admin());
CREATE POLICY "Citizens create feedback" ON public.feedback
  FOR INSERT TO authenticated WITH CHECK (citizen_id = auth.uid());

-- analytics_daily -----------------------------------------------------------
CREATE TABLE public.analytics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day date NOT NULL UNIQUE,
  total_stops_completed integer NOT NULL DEFAULT 0,
  missed_stops integer NOT NULL DEFAULT 0,
  active_trucks integer NOT NULL DEFAULT 0,
  active_drivers integer NOT NULL DEFAULT 0,
  complaints_opened integer NOT NULL DEFAULT 0,
  avg_rating numeric(3,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_analytics_day ON public.analytics_daily(day DESC);
GRANT SELECT ON public.analytics_daily TO authenticated;
GRANT ALL ON public.analytics_daily TO service_role;
ALTER TABLE public.analytics_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read analytics" ON public.analytics_daily
  FOR SELECT TO authenticated USING (public.is_admin());

-- audit_logs ----------------------------------------------------------------
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity text,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_actor ON public.audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_action ON public.audit_logs(action, created_at DESC);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (public.is_admin());

-- notification_retry_queue --------------------------------------------------
CREATE TABLE public.notification_retry_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES public.notifications(id) ON DELETE CASCADE,
  device_token text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_retry_next ON public.notification_retry_queue(next_attempt_at);
GRANT ALL ON public.notification_retry_queue TO service_role;
ALTER TABLE public.notification_retry_queue ENABLE ROW LEVEL SECURITY;

-- eta_cache -----------------------------------------------------------------
CREATE TABLE public.eta_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  truck_id uuid REFERENCES public.trucks(id) ON DELETE CASCADE,
  distance_m double precision NOT NULL,
  duration_s double precision NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_eta_expires ON public.eta_cache(expires_at);
GRANT ALL ON public.eta_cache TO service_role;
ALTER TABLE public.eta_cache ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- GPS INGEST + GEOFENCE ENGINE
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.ingest_truck_location(
  _lat double precision,
  _lng double precision,
  _heading double precision DEFAULT 0,
  _speed_kmh double precision DEFAULT 0,
  _accuracy_m double precision DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_truck_id uuid;
  v_driver_id uuid;
  v_point geography(Point, 4326);
  v_prev public.truck_live_location%ROWTYPE;
  v_gap_s double precision;
  v_jump_m double precision;
  v_route_id uuid;
  v_notified integer := 0;
  v_row record;
BEGIN
  IF _lat IS NULL OR _lng IS NULL
     OR _lat < -90 OR _lat > 90 OR _lng < -180 OR _lng > 180 THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'invalid_coordinates');
  END IF;

  SELECT id, assigned_truck_id INTO v_driver_id, v_truck_id
  FROM public.drivers WHERE user_id = auth.uid();

  IF v_truck_id IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'no_assigned_truck');
  END IF;

  v_point := ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography;

  SELECT * INTO v_prev FROM public.truck_live_location WHERE truck_id = v_truck_id;

  IF FOUND THEN
    v_gap_s := GREATEST(EXTRACT(EPOCH FROM (now() - v_prev.fixed_at)), 0.001);
    -- throttle implausible ping frequency (min 1s between accepted fixes)
    IF v_gap_s < 1 THEN
      RETURN jsonb_build_object('accepted', false, 'reason', 'rate_limited');
    END IF;
    v_jump_m := ST_Distance(v_prev.location, v_point);
    -- reject teleports: > 150 km/h implied speed over the gap
    IF (v_jump_m / v_gap_s) > 41.7 AND v_jump_m > 300 THEN
      RETURN jsonb_build_object('accepted', false, 'reason', 'implausible_jump');
    END IF;
  END IF;

  IF _speed_kmh IS NULL OR _speed_kmh < 0 OR _speed_kmh > 150 THEN
    _speed_kmh := 0;
  END IF;

  SELECT id INTO v_route_id FROM public.routes
  WHERE assigned_truck_id = v_truck_id AND status = 'in_progress'
  ORDER BY started_at DESC NULLS LAST LIMIT 1;

  INSERT INTO public.truck_live_location
    (truck_id, location, previous_location, heading, speed_kmh, accuracy_m, sequence_no, fixed_at)
  VALUES (v_truck_id, v_point, NULL, COALESCE(_heading, 0), _speed_kmh, _accuracy_m, 1, now())
  ON CONFLICT (truck_id) DO UPDATE SET
    previous_location = public.truck_live_location.location,
    location = EXCLUDED.location,
    heading = EXCLUDED.heading,
    speed_kmh = EXCLUDED.speed_kmh,
    accuracy_m = EXCLUDED.accuracy_m,
    sequence_no = public.truck_live_location.sequence_no + 1,
    fixed_at = now();

  INSERT INTO public.truck_location_history (truck_id, route_id, location, heading, speed_kmh)
  VALUES (v_truck_id, v_route_id, v_point, COALESCE(_heading, 0), _speed_kmh);

  UPDATE public.drivers
  SET last_heartbeat = now(),
      trip_distance_m = trip_distance_m + COALESCE(v_jump_m, 0)
  WHERE id = v_driver_id;

  -- geofence: trucks entering a resident's radius
  FOR v_row IN
    SELECT g.id, g.user_id, g.radius_meters
    FROM public.citizen_geofence_settings g
    WHERE g.notify_enabled
      AND g.inside_truck_id IS DISTINCT FROM v_truck_id
      AND ST_DWithin(g.home_location, v_point, g.radius_meters)
  LOOP
    INSERT INTO public.notifications (recipient_id, type, title, body, deep_link, truck_id)
    VALUES (
      v_row.user_id, 'truck_nearby', 'Garbage truck nearby',
      'A collection truck is within ' || v_row.radius_meters || ' m of your home.',
      '/resident', v_truck_id
    );
    UPDATE public.citizen_geofence_settings
    SET inside_truck_id = v_truck_id, last_notified_at = now()
    WHERE id = v_row.id;
    v_notified := v_notified + 1;
  END LOOP;

  -- geofence exit: clear the dedup flag once the truck leaves
  UPDATE public.citizen_geofence_settings g
  SET inside_truck_id = NULL
  WHERE g.inside_truck_id = v_truck_id
    AND NOT ST_DWithin(g.home_location, v_point, g.radius_meters);

  RETURN jsonb_build_object(
    'accepted', true,
    'truck_id', v_truck_id,
    'route_id', v_route_id,
    'notified', v_notified
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_truck_location(double precision, double precision, double precision, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ingest_truck_location(double precision, double precision, double precision, double precision, double precision) TO authenticated;

-- nearest trucks for a citizen ----------------------------------------------
CREATE OR REPLACE FUNCTION public.nearest_trucks(
  _lat double precision,
  _lng double precision,
  _radius_m integer DEFAULT 5000,
  _limit integer DEFAULT 10
)
RETURNS TABLE (
  truck_id uuid,
  truck_code text,
  status public.truck_status,
  lat double precision,
  lng double precision,
  heading double precision,
  speed_kmh double precision,
  distance_m double precision,
  fixed_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    t.id, t.truck_code, t.status,
    ST_Y(l.location::geometry), ST_X(l.location::geometry),
    l.heading, l.speed_kmh,
    ST_Distance(l.location, ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography),
    l.fixed_at
  FROM public.truck_live_location l
  JOIN public.trucks t ON t.id = l.truck_id
  WHERE ST_DWithin(l.location, ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography, _radius_m)
    AND t.status <> 'offline'
  ORDER BY 8
  LIMIT LEAST(GREATEST(_limit, 1), 50);
$$;
REVOKE ALL ON FUNCTION public.nearest_trucks(double precision, double precision, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nearest_trucks(double precision, double precision, integer, integer) TO authenticated;

-- realtime -------------------------------------------------------------------
ALTER TABLE public.truck_live_location REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.route_stops REPLICA IDENTITY FULL;
ALTER TABLE public.routes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.truck_live_location;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.route_stops;
ALTER PUBLICATION supabase_realtime ADD TABLE public.routes;