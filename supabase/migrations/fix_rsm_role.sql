-- ============================================
-- FIX RSM ROLE FOR USER
-- ============================================
-- This user was created before the role fix
-- Need to change from 'dsr' to 'manager'
-- ============================================

-- Delete DSR role
DELETE FROM public.user_roles 
WHERE user_id = 'afe6878f-4ba8-48ac-b75f-d467dc013be5' AND role = 'dsr';

-- Add manager role
INSERT INTO public.user_roles (user_id, role) 
VALUES ('afe6878f-4ba8-48ac-b75f-d467dc013be5', 'manager')
ON CONFLICT (user_id, role) DO NOTHING;

-- Verify the change
SELECT 
  u.email,
  u.id,
  ur.role,
  p.full_name,
  m.manager_type
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id
LEFT JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.managers m ON m.user_id = u.id
WHERE u.id = 'afe6878f-4ba8-48ac-b75f-d467dc013be5';

-- ============================================
-- COMPLETE!
-- ============================================
-- User afe6878f-4ba8-48ac-b75f-d467dc013be5 now has manager role
-- They should be able to access RSM features
-- ============================================
