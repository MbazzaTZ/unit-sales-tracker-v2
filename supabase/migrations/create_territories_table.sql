-- ============================================
-- Create Territories Table
-- ============================================
-- Territories are sub-divisions within regions, assigned to TSMs
-- Run this in Supabase SQL Editor

-- Create territories table
CREATE TABLE IF NOT EXISTS public.territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  region_id UUID REFERENCES public.regions(id) ON DELETE CASCADE,
  tsm_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(region_id, code)
);

-- Add territory_id to team_leaders table to link TLs to territories
ALTER TABLE public.team_leaders 
ADD COLUMN IF NOT EXISTS territory_id UUID REFERENCES public.territories(id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_territories_region_id ON public.territories(region_id);
CREATE INDEX IF NOT EXISTS idx_team_leaders_territory_id ON public.team_leaders(territory_id);

-- Verify the table was created
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'territories'
ORDER BY ordinal_position;
