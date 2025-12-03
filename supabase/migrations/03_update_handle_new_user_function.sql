-- ============================================
-- UPDATE handle_new_user FUNCTION
-- ============================================
-- This updates the trigger function to read role from user metadata
-- If role is specified in metadata during signup, use that role
-- Otherwise default to 'dsr' role
-- ============================================

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    NEW.email
  );
  
  -- Check if role is specified in metadata, otherwise default to DSR
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'dsr')::app_role;
  
  -- Insert role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- VERIFICATION
-- ============================================
-- Test that the function exists and is correct
SELECT routine_name, routine_definition 
FROM information_schema.routines 
WHERE routine_name = 'handle_new_user';

-- ============================================
-- COMPLETE!
-- ============================================
-- Now when admins create users with role in metadata:
-- options: { data: { full_name: 'Name', role: 'tl' } }
-- The user will automatically get the correct role
-- ============================================
