-- ============================================
-- Fix Existing TL Roles
-- ============================================
-- Run this in Supabase SQL Editor to fix TL users who were created with DSR role

-- IMPORTANT: Run this ENTIRE script in one go

-- This will find all users in team_leaders table and fix their roles

-- Step 1: Delete DSR role for all TL users
-- Step 2: Insert TL role for all TL users

BEGIN;

-- Delete DSR role for users who are in team_leaders table
DELETE FROM public.user_roles
WHERE user_id IN (
  SELECT user_id FROM public.team_leaders
)
AND role = 'dsr';

-- Insert TL role for all users in team_leaders table (if not exists)
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'tl'::app_role
FROM public.team_leaders
WHERE user_id NOT IN (
  SELECT user_id FROM public.user_roles WHERE role = 'tl'
)
ON CONFLICT (user_id, role) DO NOTHING;

COMMIT;

-- Verify the changes
SELECT 
  p.full_name,
  p.email,
  ur.role,
  CASE WHEN tl.id IS NOT NULL THEN 'Yes' ELSE 'No' END as is_team_leader
FROM public.profiles p
JOIN public.user_roles ur ON p.id = ur.user_id
LEFT JOIN public.team_leaders tl ON p.id = tl.user_id
WHERE tl.id IS NOT NULL
ORDER BY p.full_name;
