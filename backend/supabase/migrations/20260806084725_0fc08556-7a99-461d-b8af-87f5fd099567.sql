-- 1. Seed the 16 Shirpur trucks (idempotent)
INSERT INTO public.trucks (truck_code, registration_no, capacity_kg, ward, status)
SELECT
  'GBR-' || lpad(i::text, 2, '0'),
  'MH18-GB-' || lpad((1000 + i)::text, 4, '0'),
  5000,
  'Shirpur Ward ' || i,
  'offline'::truck_status
FROM generate_series(1, 16) AS i
WHERE NOT EXISTS (
  SELECT 1 FROM public.trucks t WHERE t.truck_code = 'GBR-' || lpad(i::text, 2, '0')
);

-- 2. Core ingest implementation, callable with an explicit truck id (server-side)
CREATE OR REPLACE FUNCTION public.ingest_truck_location_for(
  _truck_id uuid,
  _driver_id uuid,
  _lat double precision,
  _lng double precision,
  _heading double precision DEFAULT 0,
  _speed_kmh double precision DEFAULT 0,
  _accuracy_m double precision DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
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

  IF _truck_id IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'no_assigned_truck');
  END IF;

  v_point := ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography;

  SELECT * INTO v_prev FROM public.truck_live_location WHERE truck_id = _truck_id;

  IF FOUND THEN
    v_gap_s := GREATEST(EXTRACT(EPOCH FROM (now() - v_prev.fixed_at)), 0.001);
    IF v_gap_s < 1 THEN
      RETURN jsonb_build_object('accepted', false, 'reason', 'rate_limited');
    END IF;
    v_jump_m := ST_Distance(v_prev.location, v_point);
    IF (v_jump_m / v_gap_s) > 41.7 AND v_jump_m > 300 THEN
      RETURN jsonb_build_object('accepted', false, 'reason', 'implausible_jump');
    END IF;
  END IF;

  IF _speed_kmh IS NULL OR _speed_kmh < 0 OR _speed_kmh > 150 THEN
    _speed_kmh := 0;
  END IF;

  SELECT id INTO v_route_id FROM public.routes
  WHERE assigned_truck_id = _truck_id AND status = 'in_progress'
  ORDER BY started_at DESC NULLS LAST LIMIT 1;

  INSERT INTO public.truck_live_location
    (truck_id, location, previous_location, heading, speed_kmh, accuracy_m, sequence_no, fixed_at)
  VALUES (_truck_id, v_point, NULL, COALESCE(_heading, 0), _speed_kmh, _accuracy_m, 1, now())
  ON CONFLICT (truck_id) DO UPDATE SET
    previous_location = public.truck_live_location.location,
    location = EXCLUDED.location,
    heading = EXCLUDED.heading,
    speed_kmh = EXCLUDED.speed_kmh,
    accuracy_m = EXCLUDED.accuracy_m,
    sequence_no = public.truck_live_location.sequence_no + 1,
    fixed_at = now();

  INSERT INTO public.truck_location_history (truck_id, route_id, location, heading, speed_kmh)
  VALUES (_truck_id, v_route_id, v_point, COALESCE(_heading, 0), _speed_kmh);

  UPDATE public.trucks
  SET status = 'collecting'::truck_status
  WHERE id = _truck_id AND status IN ('offline'::truck_status, 'available'::truck_status);

  IF _driver_id IS NOT NULL THEN
    UPDATE public.drivers
    SET last_heartbeat = now(),
        trip_distance_m = trip_distance_m + COALESCE(v_jump_m, 0)
    WHERE id = _driver_id;
  END IF;

  FOR v_row IN
    SELECT g.id, g.user_id, g.radius_meters
    FROM public.citizen_geofence_settings g
    WHERE g.notify_enabled
      AND g.inside_truck_id IS DISTINCT FROM _truck_id
      AND ST_DWithin(g.home_location, v_point, g.radius_meters)
  LOOP
    INSERT INTO public.notifications (recipient_id, type, title, body, deep_link, truck_id)
    VALUES (
      v_row.user_id, 'truck_nearby', 'Garbage truck nearby',
      'A collection truck is within ' || v_row.radius_meters || ' m of your home.',
      '/resident', _truck_id
    );
    UPDATE public.citizen_geofence_settings
    SET inside_truck_id = _truck_id, last_notified_at = now()
    WHERE id = v_row.id;
    v_notified := v_notified + 1;
  END LOOP;

  UPDATE public.citizen_geofence_settings g
  SET inside_truck_id = NULL
  WHERE g.inside_truck_id = _truck_id
    AND NOT ST_DWithin(g.home_location, v_point, g.radius_meters);

  RETURN jsonb_build_object(
    'accepted', true,
    'truck_id', _truck_id,
    'route_id', v_route_id,
    'notified', v_notified
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.ingest_truck_location_for(uuid, uuid, double precision, double precision, double precision, double precision, double precision) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_truck_location_for(uuid, uuid, double precision, double precision, double precision, double precision, double precision) TO service_role;

-- 3. Driver-facing wrapper keeps the original signature/behaviour
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
SET search_path TO 'public'
AS $function$
DECLARE
  v_truck_id uuid;
  v_driver_id uuid;
BEGIN
  SELECT id, assigned_truck_id INTO v_driver_id, v_truck_id
  FROM public.drivers WHERE user_id = auth.uid();

  IF v_truck_id IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'no_assigned_truck');
  END IF;

  RETURN public.ingest_truck_location_for(
    v_truck_id, v_driver_id, _lat, _lng, _heading, _speed_kmh, _accuracy_m
  );
END;
$function$;

-- 4. Background maintenance jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.mark_stale_drivers_offline()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
BEGIN
  WITH stale AS (
    UPDATE public.drivers d
    SET duty_state = 'offline'::duty_state, on_duty = false
    WHERE d.on_duty
      AND (d.last_heartbeat IS NULL OR d.last_heartbeat < now() - interval '5 minutes')
    RETURNING d.assigned_truck_id
  )
  SELECT count(*) INTO v_count FROM stale;

  UPDATE public.trucks t
  SET status = 'offline'::truck_status
  WHERE t.status <> 'offline'::truck_status
    AND t.status <> 'maintenance'::truck_status
    AND NOT EXISTS (
      SELECT 1 FROM public.truck_live_location l
      WHERE l.truck_id = t.id AND l.fixed_at > now() - interval '5 minutes'
    );

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_stale_drivers_offline() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.prune_tracking_data()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_deleted integer := 0;
BEGIN
  DELETE FROM public.truck_location_history
  WHERE recorded_at < now() - interval '30 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  DELETE FROM public.eta_cache WHERE expires_at < now();

  RETURN v_deleted;
END;
$function$;

REVOKE ALL ON FUNCTION public.prune_tracking_data() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('cleantrack-stale-drivers', 'cleantrack-prune-tracking');

SELECT cron.schedule(
  'cleantrack-stale-drivers',
  '*/2 * * * *',
  $$SELECT public.mark_stale_drivers_offline();$$
);

SELECT cron.schedule(
  'cleantrack-prune-tracking',
  '15 2 * * *',
  $$SELECT public.prune_tracking_data();$$
);