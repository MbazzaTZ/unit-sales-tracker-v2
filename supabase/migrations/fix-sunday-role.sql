-- ============================================
-- Fix Sunday Ngonyani's Role Immediately
-- ============================================
-- This fixes the role for Sunday Ngonyani specifically

BEGIN;

-- Find Sunday Ngonyani's user_id
DO $$ 
DECLARE
  user_uuid UUID;
BEGIN
  -- Get the user_id
  SELECT id INTO user_uuid
  FROM public.profiles
  WHERE full_name ILIKE '%sunday%ngonyani%'
  LIMIT 1;

  IF user_uuid IS NOT NULL THEN
    -- Delete DSR role if exists
    DELETE FROM public.user_roles
    WHERE user_id = user_uuid AND role = 'dsr';

    -- Delete from dsrs table if exists
    DELETE FROM public.dsrs
    WHERE user_id = user_uuid;

    -- Insert TL role if not exists
    INSERT INTO public.user_roles (user_id, role)
    VALUES (user_uuid, 'tl'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    RAISE NOTICE 'Fixed role for user: %', user_uuid;
  ELSE
    RAISE NOTICE 'User not found';
  END IF;
END $$;

COMMIT;

-- Verify the fix
SELECT 
  p.full_name,
  p.email,
  ur.role,
  CASE WHEN tl.id IS NOT NULL THEN 'Yes' ELSE 'No' END as is_team_leader
FROM public.profiles p
LEFT JOIN public.user_roles ur ON p.id = ur.user_id
LEFT JOIN public.team_leaders tl ON p.id = tl.user_id
WHERE p.full_name ILIKE '%sunday%ngonyani%';
