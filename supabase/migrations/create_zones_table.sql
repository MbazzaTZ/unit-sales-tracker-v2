-- ============================================
-- Create Zones Table
-- ============================================
-- Zones are higher-level groupings that contain multiple regions
-- Run this in Supabase SQL Editor

-- Create zones table
CREATE TABLE IF NOT EXISTS public.zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  zonal_manager TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add zone_id to regions table to link regions to zones
ALTER TABLE public.regions 
ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES public.zones(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_regions_zone_id ON public.regions(zone_id);

-- Insert some sample zones (optional - remove if not needed)
INSERT INTO public.zones (name, code, zonal_manager) 
VALUES 
  ('Northern Zone', 'NZ', NULL),
  ('Southern Zone', 'SZ', NULL),
  ('Eastern Zone', 'EZ', NULL),
  ('Western Zone', 'WZ', NULL),
  ('Central Zone', 'CZ', NULL)
ON CONFLICT (code) DO NOTHING;

-- Verify the table was created
SELECT * FROM public.zones ORDER BY name;
