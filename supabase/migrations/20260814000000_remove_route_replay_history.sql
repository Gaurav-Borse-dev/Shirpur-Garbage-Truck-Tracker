-- Migration: Remove Route Replay & Optimize GPS storage to live location only

-- 1. Drop unused location history table if it exists
DROP TABLE IF EXISTS public.truck_location_history CASCADE;

-- 2. Update ingest_truck_location_for to eliminate location history inserts
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

  -- Maintain only current live position (16 trucks max)
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
