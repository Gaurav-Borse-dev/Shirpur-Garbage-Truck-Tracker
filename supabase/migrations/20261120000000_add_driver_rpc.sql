-- ================================================================
-- RPC: create_driver
-- Creates or updates a driver in a SINGLE database transaction.
-- Called from the app via sb.rpc('create_driver', {...})
-- This avoids multiple sequential HTTP requests that fail on Render.
-- ================================================================

CREATE OR REPLACE FUNCTION public.create_driver(
  p_name       TEXT,
  p_phone      TEXT,
  p_license_no TEXT DEFAULT 'N/A',
  p_truck_id   UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user_id    UUID;
  v_driver_id  UUID;
  v_action     TEXT;
BEGIN
  -- 1. Look up existing profile by phone (try multiple formats)
  SELECT user_id INTO v_user_id
  FROM profiles
  WHERE phone = p_phone
     OR phone = '91' || p_phone
     OR phone = '+91' || p_phone
  LIMIT 1;

  IF v_user_id IS NULL THEN
    -- 2a. No existing profile — generate a new UUID and create one
    v_user_id := gen_random_uuid();

    INSERT INTO profiles (user_id, full_name, phone)
    VALUES (v_user_id, p_name, p_phone)
    ON CONFLICT (user_id) DO UPDATE
      SET full_name  = EXCLUDED.full_name,
          phone      = EXCLUDED.phone,
          updated_at = now();
  ELSE
    -- 2b. Profile exists — update name/phone
    UPDATE profiles
    SET full_name  = p_name,
        phone      = p_phone,
        updated_at = now()
    WHERE user_id = v_user_id;
  END IF;

  -- 3. Check if a driver row already exists for this user
  SELECT id INTO v_driver_id
  FROM drivers
  WHERE user_id = v_user_id;

  IF v_driver_id IS NOT NULL THEN
    -- Update existing driver
    UPDATE drivers
    SET assigned_truck_id = COALESCE(p_truck_id, assigned_truck_id),
        license_no        = p_license_no,
        updated_at        = now()
    WHERE id = v_driver_id;

    v_action := 'updated';
  ELSE
    -- Create new driver
    INSERT INTO drivers (user_id, license_no, assigned_truck_id)
    VALUES (v_user_id, p_license_no, p_truck_id)
    RETURNING id INTO v_driver_id;

    v_action := 'created';
  END IF;

  -- 4. Ensure user_roles has driver role
  INSERT INTO user_roles (user_id, role)
  VALUES (v_user_id, 'driver')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- 5. Return result as JSON
  RETURN json_build_object(
    'ok',       true,
    'driverId', v_driver_id,
    'userId',   v_user_id,
    'action',   v_action
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'ok',    false,
    'error', SQLERRM
  );
END;
$fn$;

-- Allow the service role to call this function
GRANT EXECUTE ON FUNCTION public.create_driver(TEXT, TEXT, TEXT, UUID) TO service_role;
