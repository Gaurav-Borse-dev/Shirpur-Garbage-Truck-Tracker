-- Migration: 20260815000000_p0_security_and_transactions.sql
-- P0 Fixes: Secure Driver Ingestion, Out-of-order GPS Protection, Atomic Stop Completion

-- ===========================================================================
-- 1. SECURE DRIVER INGESTION & OUT-OF-ORDER GPS PROTECTION
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.ingest_truck_location_for(
  _truck_id uuid,
  _driver_id uuid,
  _lat double precision,
  _lng double precision,
  _heading double precision DEFAULT 0,
  _speed_kmh double precision DEFAULT 0,
  _accuracy_m double precision DEFAULT NULL,
  _fixed_at timestamptz DEFAULT NULL
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
  v_fix_timestamp timestamptz;
BEGIN
  IF _lat IS NULL OR _lng IS NULL
     OR _lat < -90 OR _lat > 90 OR _lng < -180 OR _lng > 180 THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'invalid_coordinates');
  END IF;

  IF _truck_id IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'no_assigned_truck');
  END IF;

  v_fix_timestamp := COALESCE(_fixed_at, now());
  v_point := ST_SetSRID(ST_MakePoint(_lng, _lat), 4326)::geography;

  SELECT * INTO v_prev FROM public.truck_live_location WHERE truck_id = _truck_id;

  IF FOUND THEN
    -- Out-of-order GPS protection: Reject fixes with timestamp older than existing fixed_at
    IF v_fix_timestamp < v_prev.fixed_at THEN
      RETURN jsonb_build_object('accepted', false, 'reason', 'out_of_order');
    END IF;

    v_gap_s := GREATEST(EXTRACT(EPOCH FROM (v_fix_timestamp - v_prev.fixed_at)), 0.001);
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

  -- Maintain only current live position (16 trucks max)
  INSERT INTO public.truck_live_location
    (truck_id, location, previous_location, heading, speed_kmh, accuracy_m, sequence_no, fixed_at)
  VALUES (_truck_id, v_point, NULL, COALESCE(_heading, 0), _speed_kmh, _accuracy_m, 1, v_fix_timestamp)
  ON CONFLICT (truck_id) DO UPDATE SET
    previous_location = public.truck_live_location.location,
    location = EXCLUDED.location,
    heading = EXCLUDED.heading,
    speed_kmh = EXCLUDED.speed_kmh,
    accuracy_m = EXCLUDED.accuracy_m,
    sequence_no = public.truck_live_location.sequence_no + 1,
    fixed_at = EXCLUDED.fixed_at
  WHERE EXCLUDED.fixed_at >= public.truck_live_location.fixed_at;

  UPDATE public.trucks
  SET status = 'collecting'::truck_status
  WHERE id = _truck_id AND status IN ('offline'::truck_status, 'available'::truck_status);

  IF _driver_id IS NOT NULL THEN
    UPDATE public.drivers
    SET last_heartbeat = v_fix_timestamp,
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
    SET inside_truck_id = _truck_id, last_notified_at = v_fix_timestamp
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

-- Authenticated wrapper enforcing auth.uid() matching drivers.user_id
CREATE OR REPLACE FUNCTION public.ingest_truck_location(
  _lat double precision,
  _lng double precision,
  _heading double precision DEFAULT 0,
  _speed_kmh double precision DEFAULT 0,
  _accuracy_m double precision DEFAULT NULL,
  _fixed_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_truck_id uuid;
  v_driver_id uuid;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'unauthorized');
  END IF;

  SELECT id, assigned_truck_id INTO v_driver_id, v_truck_id
  FROM public.drivers WHERE user_id = v_user_id;

  IF v_driver_id IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'not_a_driver');
  END IF;

  IF v_truck_id IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'no_assigned_truck');
  END IF;

  RETURN public.ingest_truck_location_for(
    v_truck_id, v_driver_id, _lat, _lng, _heading, _speed_kmh, _accuracy_m, COALESCE(_fixed_at, now())
  );
END;
$function$;

-- Strict execution privileges
REVOKE ALL ON FUNCTION public.ingest_truck_location_for(uuid, uuid, double precision, double precision, double precision, double precision, double precision, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_truck_location_for(uuid, uuid, double precision, double precision, double precision, double precision, double precision, timestamptz) TO service_role;

REVOKE ALL ON FUNCTION public.ingest_truck_location(double precision, double precision, double precision, double precision, double precision, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ingest_truck_location(double precision, double precision, double precision, double precision, double precision, timestamptz) TO authenticated;


-- ===========================================================================
-- 2. ATOMIC STOP COMPLETION TRANSACTION FUNCTION
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.complete_route_stop_atomic(
  _stop_id uuid,
  _driver_id uuid DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_stop public.route_stops%ROWTYPE;
  v_route public.routes%ROWTYPE;
  v_truck_id uuid;
  v_now timestamptz := now();
  v_today date := CURRENT_DATE;
BEGIN
  IF _stop_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'missing_stop_id');
  END IF;

  -- Lock stop row to prevent concurrent race conditions
  SELECT * INTO v_stop FROM public.route_stops WHERE id = _stop_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'stop_not_found');
  END IF;

  -- Idempotency check: prevent duplicate completion
  IF v_stop.status = 'completed'::stop_status THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_completed', 'completed_at', v_stop.completed_at);
  END IF;

  -- Get parent route details
  SELECT * INTO v_route FROM public.routes WHERE id = v_stop.route_id;
  v_truck_id := v_route.assigned_truck_id;

  -- 1. Complete route_stops
  UPDATE public.route_stops
  SET status = 'completed'::stop_status,
      completed_at = v_now,
      notes = COALESCE(_notes, notes)
  WHERE id = _stop_id;

  -- 2. Insert collection_history record
  INSERT INTO public.collection_history (
    truck_id, route_id, stop_id, driver_id, status, completed_at, notes
  ) VALUES (
    v_truck_id, v_stop.route_id, _stop_id, _driver_id, 'completed'::stop_status, v_now, _notes
  );

  -- 3. Atomically update analytics_daily
  INSERT INTO public.analytics_daily (day, total_stops_completed)
  VALUES (v_today, 1)
  ON CONFLICT (day) DO UPDATE SET
    total_stops_completed = public.analytics_daily.total_stops_completed + 1,
    updated_at = v_now;

  RETURN jsonb_build_object(
    'success', true,
    'stop_id', _stop_id,
    'route_id', v_stop.route_id,
    'truck_id', v_truck_id,
    'completed_at', v_now
  );
EXCEPTION
  WHEN OTHERS THEN
    -- PL/pgSQL automatically rolls back all steps on unhandled exception
    RETURN jsonb_build_object('success', false, 'reason', 'transaction_error', 'message', SQLERRM);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.complete_route_stop_atomic(uuid, uuid, text) TO authenticated, service_role;
