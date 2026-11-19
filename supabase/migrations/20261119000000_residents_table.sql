-- Stores every resident/driver phone number on login
CREATE TABLE IF NOT EXISTS public.residents (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  phone       text NOT NULL UNIQUE,
  first_seen  timestamptz NOT NULL DEFAULT now(),
  last_seen   timestamptz NOT NULL DEFAULT now(),
  login_count integer NOT NULL DEFAULT 1
);

-- Index for fast phone lookups
CREATE INDEX IF NOT EXISTS idx_residents_phone ON public.residents (phone);

-- RLS
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.residents
  FOR ALL
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON public.residents TO authenticated;
GRANT ALL ON public.residents TO service_role;

-- Function to upsert a resident phone and increment login count
CREATE OR REPLACE FUNCTION public.upsert_resident_phone(p_phone text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.residents (phone)
  VALUES (p_phone)
  ON CONFLICT (phone)
  DO UPDATE SET
    last_seen = now(),
    login_count = residents.login_count + 1;
END;
$$;
