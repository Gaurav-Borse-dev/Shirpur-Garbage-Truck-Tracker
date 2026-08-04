CREATE TYPE public.stop_status AS ENUM ('pending', 'en_route', 'completed', 'skipped');
CREATE TYPE public.route_status AS ENUM ('scheduled', 'in_progress', 'paused', 'completed', 'cancelled');

-- truck_live_location -------------------------------------------------------
CREATE TABLE public.truck_live_location (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id uuid NOT NULL UNIQUE REFERENCES public.trucks(id) ON DELETE CASCADE,
  location geography(Point, 4326) NOT NULL,
  previous_location geography(Point, 4326),
  heading double precision NOT NULL DEFAULT 0,
  speed_kmh double precision NOT NULL DEFAULT 0,
  accuracy_m double precision,
  sequence_no bigint NOT NULL DEFAULT 0,
  fixed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_live_location_gist ON public.truck_live_location USING GIST (location);
CREATE INDEX idx_live_location_truck ON public.truck_live_location(truck_id);
GRANT SELECT ON public.truck_live_location TO authenticated;
GRANT ALL ON public.truck_live_location TO service_role;
ALTER TABLE public.truck_live_location ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_live_location_updated BEFORE UPDATE ON public.truck_live_location
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "Signed in users read live locations" ON public.truck_live_location
  FOR SELECT TO authenticated USING (true);

-- truck_location_history ----------------------------------------------------
CREATE TABLE public.truck_location_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id uuid NOT NULL REFERENCES public.trucks(id) ON DELETE CASCADE,
  route_id uuid,
  location geography(Point, 4326) NOT NULL,
  heading double precision NOT NULL DEFAULT 0,
  speed_kmh double precision NOT NULL DEFAULT 0,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_history_truck_time ON public.truck_location_history(truck_id, recorded_at DESC);
CREATE INDEX idx_history_gist ON public.truck_location_history USING GIST (location);
GRANT SELECT ON public.truck_location_history TO authenticated;
GRANT ALL ON public.truck_location_history TO service_role;
ALTER TABLE public.truck_location_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read location history" ON public.truck_location_history
  FOR SELECT TO authenticated USING (public.is_admin());

-- routes --------------------------------------------------------------------
CREATE TABLE public.routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  ward text NOT NULL,
  assigned_truck_id uuid REFERENCES public.trucks(id) ON DELETE SET NULL,
  assigned_driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  scheduled_date date NOT NULL DEFAULT CURRENT_DATE,
  status public.route_status NOT NULL DEFAULT 'scheduled',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_routes_truck_date ON public.routes(assigned_truck_id, scheduled_date);
CREATE INDEX idx_routes_status ON public.routes(status);
CREATE INDEX idx_routes_ward ON public.routes(ward);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routes TO authenticated;
GRANT ALL ON public.routes TO service_role;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_routes_updated BEFORE UPDATE ON public.routes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "Signed in users read routes" ON public.routes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Drivers update own route" ON public.routes
  FOR UPDATE TO authenticated
  USING (assigned_truck_id = public.current_driver_truck())
  WITH CHECK (assigned_truck_id = public.current_driver_truck());
CREATE POLICY "Admins manage routes" ON public.routes
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER TABLE public.truck_location_history
  ADD CONSTRAINT fk_history_route FOREIGN KEY (route_id) REFERENCES public.routes(id) ON DELETE SET NULL;

-- route_stops ---------------------------------------------------------------
CREATE TABLE public.route_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  sequence_no integer NOT NULL,
  name text NOT NULL,
  address text,
  location geography(Point, 4326) NOT NULL,
  status public.stop_status NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (route_id, sequence_no)
);
CREATE INDEX idx_stops_route ON public.route_stops(route_id, sequence_no);
CREATE INDEX idx_stops_status ON public.route_stops(status);
CREATE INDEX idx_stops_gist ON public.route_stops USING GIST (location);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_stops TO authenticated;
GRANT ALL ON public.route_stops TO service_role;
ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_stops_updated BEFORE UPDATE ON public.route_stops
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "Signed in users read stops" ON public.route_stops
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Drivers update own stops" ON public.route_stops
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.routes r WHERE r.id = route_id AND r.assigned_truck_id = public.current_driver_truck()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.routes r WHERE r.id = route_id AND r.assigned_truck_id = public.current_driver_truck()));
CREATE POLICY "Admins manage stops" ON public.route_stops
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- collection_history --------------------------------------------------------
CREATE TABLE public.collection_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id uuid NOT NULL REFERENCES public.trucks(id) ON DELETE CASCADE,
  route_id uuid REFERENCES public.routes(id) ON DELETE SET NULL,
  stop_id uuid REFERENCES public.route_stops(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  status public.stop_status NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_collection_truck_time ON public.collection_history(truck_id, completed_at DESC);
CREATE INDEX idx_collection_date ON public.collection_history(completed_at DESC);
GRANT SELECT ON public.collection_history TO authenticated;
GRANT ALL ON public.collection_history TO service_role;
ALTER TABLE public.collection_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in users read collection history" ON public.collection_history
  FOR SELECT TO authenticated USING (true);