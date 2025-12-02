-- ============================================
-- Delete Sample Regions
-- ============================================
-- Run this in Supabase SQL Editor to remove sample regions
-- This allows admin to start fresh with their own regions

-- Delete sample regions (only if they have no associated data)
DELETE FROM public.regions 
WHERE code IN ('NRB', 'MSA', 'KSM', 'NKR', 'ELD', 'RV', 'CST', 'CNT', 'WST', 'EST')
AND NOT EXISTS (
  SELECT 1 FROM public.team_leaders WHERE region_id = public.regions.id
)
AND NOT EXISTS (
  SELECT 1 FROM public.teams WHERE region_id = public.regions.id
)
AND NOT EXISTS (
  SELECT 1 FROM public.dsrs WHERE region_id = public.regions.id
)
AND NOT EXISTS (
  SELECT 1 FROM public.stock WHERE region_id = public.regions.id
)
AND NOT EXISTS (
  SELECT 1 FROM public.sales WHERE region_id = public.regions.id
);

-- Verify deletion
SELECT COUNT(*) as remaining_regions FROM public.regions;
