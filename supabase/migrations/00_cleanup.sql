-- ============================================
-- CLEANUP SCRIPT - DROP ALL EXISTING OBJECTS
-- ============================================
-- Run this FIRST to completely clean your database
-- WARNING: This will delete ALL data!
-- ============================================

-- Drop all policies first (they depend on tables)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "Users can view all profiles" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Users can update own profile" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Users can view all roles" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Admins can manage roles" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Anyone can view zones" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Admins can manage zones" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Anyone can view regions" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Admins can manage regions" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Anyone can view territories" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Admins can manage territories" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Anyone can view TLs" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Admins can manage TLs" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Anyone can view teams" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "TLs and Admins can manage teams" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Anyone can view DSRs" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "TLs and Admins can manage DSRs" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Anyone can view batches" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Admins can manage batches" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Anyone can view stock" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Admins can insert stock" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Admins and TLs can update stock" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Anyone can view sales" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "DSRs can insert sales" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "TLs and Admins can update sales" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Anyone can view managers" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Admins can manage managers" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Anyone can view DEs" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Admins can manage DEs" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Anyone can view agents" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "DEs and Admins can manage agents" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Anyone can view agent sales" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "DEs and Admins can manage agent sales" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Users can view own notifications" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Users can update own notifications" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "System can create notifications" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Anyone can view commission rates" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Admins can manage commission rates" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Anyone can view DSTV packages" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Admins can manage DSTV packages" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Anyone can view package commissions" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Admins can manage package commissions" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Anyone can view bonus tiers" ON public.' || quote_ident(r.tablename);
        EXECUTE 'DROP POLICY IF EXISTS "Admins can manage bonus tiers" ON public.' || quote_ident(r.tablename);
    END LOOP;
END $$;

-- Drop triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;
DROP TRIGGER IF EXISTS calculate_sale_commission_trigger ON public.sales;
DROP TRIGGER IF EXISTS on_commission_rates_updated ON public.commission_rates;
DROP TRIGGER IF EXISTS on_dstv_packages_updated ON public.dstv_packages;
DROP TRIGGER IF EXISTS on_package_commission_rates_updated ON public.package_commission_rates;
DROP TRIGGER IF EXISTS on_dsr_bonus_tiers_updated ON public.dsr_bonus_tiers;

-- Drop functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_sale_commission() CASCADE;

-- Drop tables (in reverse dependency order)
DROP TABLE IF EXISTS public.agent_sales CASCADE;
DROP TABLE IF EXISTS public.agents CASCADE;
DROP TABLE IF EXISTS public.distribution_executives CASCADE;
DROP TABLE IF EXISTS public.managers CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.sales CASCADE;
DROP TABLE IF EXISTS public.stock CASCADE;
DROP TABLE IF EXISTS public.stock_batches CASCADE;
DROP TABLE IF EXISTS public.dsrs CASCADE;
DROP TABLE IF EXISTS public.teams CASCADE;
DROP TABLE IF EXISTS public.team_leaders CASCADE;
DROP TABLE IF EXISTS public.territories CASCADE;
DROP TABLE IF EXISTS public.regions CASCADE;
DROP TABLE IF EXISTS public.zones CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop commission tables
DROP TABLE IF EXISTS public.dsr_bonus_tiers CASCADE;
DROP TABLE IF EXISTS public.package_commission_rates CASCADE;
DROP TABLE IF EXISTS public.dstv_packages CASCADE;
DROP TABLE IF EXISTS public.commission_rates CASCADE;

-- Drop enums
DROP TYPE IF EXISTS public.manager_type CASCADE;
DROP TYPE IF EXISTS public.sale_type CASCADE;
DROP TYPE IF EXISTS public.payment_status CASCADE;
DROP TYPE IF EXISTS public.stock_status CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;

-- Verify cleanup
SELECT 
  'Tables' as object_type,
  COUNT(*) as remaining
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'

UNION ALL

SELECT 
  'Enums' as object_type,
  COUNT(*) as remaining
FROM pg_type 
WHERE typtype = 'e' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')

UNION ALL

SELECT 
  'Functions' as object_type,
  COUNT(*) as remaining
FROM pg_proc 
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- ============================================
-- CLEANUP COMPLETE!
-- ============================================
-- Now run 00_master_schema.sql
-- ============================================
