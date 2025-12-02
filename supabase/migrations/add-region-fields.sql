-- ============================================
-- Update Regions Table Structure
-- ============================================
-- Run this in Supabase SQL Editor to update the structure

-- Add RSM name column if not exists
ALTER TABLE public.regions 
ADD COLUMN IF NOT EXISTS rsm_name TEXT;

-- Remove old single territory/tsm columns if they exist
ALTER TABLE public.regions 
DROP COLUMN IF EXISTS territory,
DROP COLUMN IF EXISTS tsm_name;

-- Add territories JSONB column to store multiple territory-TSM pairs
ALTER TABLE public.regions 
ADD COLUMN IF NOT EXISTS territories JSONB DEFAULT '[]'::jsonb;

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'regions'
ORDER BY ordinal_position;
