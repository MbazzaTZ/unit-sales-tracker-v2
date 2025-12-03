-- ============================================
-- GRANT ADMIN ACCESS TO USER
-- ============================================
-- Run this in Supabase SQL Editor to make a user admin
-- ============================================

-- Delete DSR role
DELETE FROM public.user_roles 
WHERE user_id = '06b83457-e8e4-4553-80cf-1bd9911ec008' AND role = 'dsr';

-- Add admin role
INSERT INTO public.user_roles (user_id, role) 
VALUES ('06b83457-e8e4-4553-80cf-1bd9911ec008', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Verify the change
SELECT 
  u.email,
  u.id,
  ur.role,
  p.full_name
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id
LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.id = '06b83457-e8e4-4553-80cf-1bd9911ec008';

-- ============================================
-- COMPLETE!
-- ============================================
-- User 06b83457-e8e4-4553-80cf-1bd9911ec008 is now an admin
-- ============================================
