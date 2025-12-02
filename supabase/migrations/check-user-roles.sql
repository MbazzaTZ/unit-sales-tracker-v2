-- ============================================
-- Check Current User Roles
-- ============================================
-- Run this to see what roles Sunday Ngonyani has

SELECT 
  p.full_name,
  p.email,
  ur.role,
  CASE WHEN tl.id IS NOT NULL THEN 'Is TL' ELSE 'Not TL' END as tl_status,
  CASE WHEN d.id IS NOT NULL THEN 'Is DSR' ELSE 'Not DSR' END as dsr_status
FROM public.profiles p
LEFT JOIN public.user_roles ur ON p.id = ur.user_id
LEFT JOIN public.team_leaders tl ON p.id = tl.user_id
LEFT JOIN public.dsrs d ON p.id = d.user_id
WHERE p.full_name ILIKE '%sunday%' OR p.full_name ILIKE '%ngonyani%'
ORDER BY ur.role;
