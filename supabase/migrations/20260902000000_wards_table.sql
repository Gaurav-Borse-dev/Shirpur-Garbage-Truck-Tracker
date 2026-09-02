-- wards table for dynamic ward management
CREATE TABLE IF NOT EXISTS public.wards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed existing Shirpur wards
INSERT INTO public.wards (name) VALUES
  ('Shirpur Ward 1 — Old City'),
  ('Shirpur Ward 2 — Station Road'),
  ('Shirpur Ward 3 — Tilak Nagar'),
  ('Shirpur Ward 4 — Subhash Nagar'),
  ('Shirpur Ward 5 — Gandhi Chowk'),
  ('Shirpur Ward 6 — Bhadgaon Road'),
  ('Shirpur Ward 7 — Shahada Road'),
  ('Shirpur Ward 8 — Thakkar Bappa Nagar'),
  ('Shirpur Ward 9 — Karwand Naka'),
  ('Shirpur Ward 10 — Boradi Road'),
  ('Shirpur Ward 11 — Sangvi'),
  ('Shirpur Ward 12 — Thalner Road'),
  ('Shirpur Ward 13 — Arthe'),
  ('Shirpur Ward 14 — Mukti Dham'),
  ('Shirpur Ward 15 — NMU Campus'),
  ('Shirpur Ward 16 — Dondaicha Road')
ON CONFLICT (name) DO NOTHING;

-- RLS
ALTER TABLE public.wards ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.wards TO authenticated;
GRANT ALL ON public.wards TO service_role;

CREATE POLICY "Anyone can read wards" ON public.wards
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage wards" ON public.wards
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
