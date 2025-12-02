-- ============================================
-- Fix Sunday Ngonyani - Add to Team Leaders
-- ============================================
-- This user has DSR role but is not in team_leaders table

BEGIN;

-- Step 1: Get Sunday Ngonyani's user_id
DO $$ 
DECLARE
  user_uuid UUID;
BEGIN
  -- Get the user_id
  SELECT id INTO user_uuid
  FROM public.profiles
  WHERE email = 'tlruvuma@sales.com'
  LIMIT 1;

  IF user_uuid IS NOT NULL THEN
    RAISE NOTICE 'Found user: %', user_uuid;

    -- Step 2: Insert into team_leaders table if not exists
    INSERT INTO public.team_leaders (user_id, region_id, monthly_target)
    VALUES (user_uuid, NULL, 0)
    ON CONFLICT (user_id) DO NOTHING;

    -- Step 3: Delete DSR role
    DELETE FROM public.user_roles
    WHERE user_id = user_uuid AND role = 'dsr';

    -- Step 4: Insert TL role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (user_uuid, 'tl'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    RAISE NOTICE 'Successfully converted user to TL';
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
  CASE WHEN tl.id IS NOT NULL THEN 'Is TL ✓' ELSE 'Not TL' END as tl_status,
  tl.monthly_target
FROM public.profiles p
LEFT JOIN public.user_roles ur ON p.id = ur.user_id
LEFT JOIN public.team_leaders tl ON p.id = tl.user_id
WHERE p.email = 'tlruvuma@sales.com';
