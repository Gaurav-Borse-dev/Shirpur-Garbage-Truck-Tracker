-- Migration: 20260831000000_dustbin_bookings.sql
-- Adds a table for community dustbin booking requests from residents.

CREATE TABLE IF NOT EXISTS public.dustbin_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_phone text NOT NULL,
  city text NOT NULL DEFAULT 'Shirpur',
  address text NOT NULL,
  reason text NOT NULL,
  from_date date NOT NULL,
  to_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for resident phone lookups
CREATE INDEX IF NOT EXISTS idx_dustbin_bookings_phone ON public.dustbin_bookings (resident_phone);

-- Index for admin status filtering
CREATE INDEX IF NOT EXISTS idx_dustbin_bookings_status ON public.dustbin_bookings (status);

-- Enable RLS
ALTER TABLE public.dustbin_bookings ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (admin operations via server functions)
CREATE POLICY "service_role_all" ON public.dustbin_bookings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read all bookings (filtered by phone in server functions)
CREATE POLICY "authenticated_read" ON public.dustbin_bookings
  FOR SELECT
  TO authenticated
  USING (true);
