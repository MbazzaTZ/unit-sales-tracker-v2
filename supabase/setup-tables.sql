-- ============================================
-- Unit Sales Tracker - Complete Database Setup
-- ============================================
-- Copy and paste this ENTIRE file into Supabase SQL Editor
-- Then click RUN to create all tables

-- ============================================
-- STEP 1: CREATE ENUMS
-- ============================================

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'tl', 'dsr');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.stock_status AS ENUM ('unassigned', 'assigned-tl', 'assigned-team', 'assigned-dsr', 'sold-paid', 'sold-unpaid');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('paid', 'unpaid');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.sale_type AS ENUM ('FS', 'DO');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- STEP 2: CREATE TABLES
-- ============================================

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  region_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User roles table (separate for security)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'dsr',
  UNIQUE(user_id, role)
);

-- Regions table
CREATE TABLE IF NOT EXISTS public.regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  rsm_name TEXT,
  territories JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Team Leaders (TL) - links to profiles
CREATE TABLE IF NOT EXISTS public.team_leaders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
  monthly_target INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Teams
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tl_id UUID REFERENCES public.team_leaders(id) ON DELETE SET NULL,
  captain_name TEXT,
  region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DSRs
CREATE TABLE IF NOT EXISTS public.dsrs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  tl_id UUID REFERENCES public.team_leaders(id) ON DELETE SET NULL,
  region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock batches
CREATE TABLE IF NOT EXISTS public.stock_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock items
CREATE TABLE IF NOT EXISTS public.stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  batch_id UUID REFERENCES public.stock_batches(id) ON DELETE SET NULL,
  status stock_status DEFAULT 'unassigned',
  assigned_to_tl UUID REFERENCES public.team_leaders(id) ON DELETE SET NULL,
  assigned_to_team UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  assigned_to_dsr UUID REFERENCES public.dsrs(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES auth.users(id),
  region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
  date_assigned TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id TEXT NOT NULL UNIQUE,
  stock_id UUID REFERENCES public.stock(id) ON DELETE SET NULL,
  dsr_id UUID REFERENCES public.dsrs(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  tl_id UUID REFERENCES public.team_leaders(id) ON DELETE SET NULL,
  region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
  smart_card_number TEXT NOT NULL,
  sn_number TEXT NOT NULL,
  payment_status payment_status DEFAULT 'unpaid',
  sale_type sale_type NOT NULL,
  package_option TEXT DEFAULT 'no-package',
  dstv_package TEXT,
  notes TEXT,
  tl_verified BOOLEAN DEFAULT FALSE,
  tl_verified_at TIMESTAMP WITH TIME ZONE,
  admin_approved BOOLEAN DEFAULT FALSE,
  admin_approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alerts
CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  entity_id UUID,
  entity_type TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- STEP 3: ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dsrs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 4: CREATE HELPER FUNCTIONS
-- ============================================

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- ============================================
-- STEP 5: CREATE RLS POLICIES
-- ============================================

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Anyone can view regions" ON public.regions;
DROP POLICY IF EXISTS "Admins can manage regions" ON public.regions;
DROP POLICY IF EXISTS "Anyone can view TLs" ON public.team_leaders;
DROP POLICY IF EXISTS "Admins can manage TLs" ON public.team_leaders;
DROP POLICY IF EXISTS "Anyone can view teams" ON public.teams;
DROP POLICY IF EXISTS "TLs and Admins can manage teams" ON public.teams;
DROP POLICY IF EXISTS "Anyone can view DSRs" ON public.dsrs;
DROP POLICY IF EXISTS "TLs and Admins can manage DSRs" ON public.dsrs;
DROP POLICY IF EXISTS "Anyone can view batches" ON public.stock_batches;
DROP POLICY IF EXISTS "Admins can manage batches" ON public.stock_batches;
DROP POLICY IF EXISTS "Anyone can view stock" ON public.stock;
DROP POLICY IF EXISTS "Admins can insert stock" ON public.stock;
DROP POLICY IF EXISTS "Admins and TLs can update stock" ON public.stock;
DROP POLICY IF EXISTS "Anyone can view sales" ON public.sales;
DROP POLICY IF EXISTS "DSRs can insert sales" ON public.sales;
DROP POLICY IF EXISTS "TLs and Admins can update sales" ON public.sales;
DROP POLICY IF EXISTS "Anyone can view alerts" ON public.alerts;
DROP POLICY IF EXISTS "System can manage alerts" ON public.alerts;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- RLS Policies for user_roles (only admins can manage)
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for regions (viewable by all, editable by admin)
CREATE POLICY "Anyone can view regions" ON public.regions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage regions" ON public.regions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for team_leaders
CREATE POLICY "Anyone can view TLs" ON public.team_leaders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage TLs" ON public.team_leaders FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for teams
CREATE POLICY "Anyone can view teams" ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "TLs and Admins can manage teams" ON public.teams FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tl'));

-- RLS Policies for dsrs
CREATE POLICY "Anyone can view DSRs" ON public.dsrs FOR SELECT TO authenticated USING (true);
CREATE POLICY "TLs and Admins can manage DSRs" ON public.dsrs FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tl'));

-- RLS Policies for stock_batches
CREATE POLICY "Anyone can view batches" ON public.stock_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage batches" ON public.stock_batches FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for stock
CREATE POLICY "Anyone can view stock" ON public.stock FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert stock" ON public.stock FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins and TLs can update stock" ON public.stock FOR UPDATE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tl'));

-- RLS Policies for sales
CREATE POLICY "Anyone can view sales" ON public.sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "DSRs can insert sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "TLs and Admins can update sales" ON public.sales FOR UPDATE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tl'));

-- RLS Policies for alerts
CREATE POLICY "Anyone can view alerts" ON public.alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "System can manage alerts" ON public.alerts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- STEP 6: CREATE TRIGGERS
-- ============================================

-- Trigger for profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'), NEW.email);
  
  -- Default role is DSR
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'dsr');
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- STEP 7: INSERT DEFAULT DATA
-- ============================================

-- No default regions - Admin will create their own regions
-- Use the Region Management page in the admin panel to add regions

-- ============================================
-- STEP 8: CREATE INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_stock_assigned_dsr ON public.stock(assigned_to_dsr);
CREATE INDEX IF NOT EXISTS idx_stock_status ON public.stock(status);
CREATE INDEX IF NOT EXISTS idx_sales_dsr_id ON public.sales(dsr_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at);
CREATE INDEX IF NOT EXISTS idx_dsrs_user_id ON public.dsrs(user_id);
CREATE INDEX IF NOT EXISTS idx_dsrs_team_id ON public.dsrs(team_id);
CREATE INDEX IF NOT EXISTS idx_teams_tl_id ON public.teams(tl_id);

-- ============================================
-- CREATE HELPFUL VIEWS
-- ============================================

-- View: DSR Stock with Details
CREATE OR REPLACE VIEW public.dsr_stock_view AS
SELECT 
  s.id,
  s.stock_id as smartcard_number,
  s.type as stock_type,
  s.status,
  s.date_assigned,
  s.created_at,
  d.user_id as dsr_user_id,
  p.full_name as dsr_name,
  t.name as team_name,
  r.name as region_name
FROM public.stock s
LEFT JOIN public.dsrs d ON s.assigned_to_dsr = d.id
LEFT JOIN public.profiles p ON d.user_id = p.id
LEFT JOIN public.teams t ON d.team_id = t.id
LEFT JOIN public.regions r ON s.region_id = r.id;

-- View: Sales with Full Details
CREATE OR REPLACE VIEW public.sales_full_view AS
SELECT 
  sale.id,
  sale.sale_id,
  sale.smart_card_number,
  sale.sn_number,
  sale.sale_type,
  sale.payment_status,
  sale.package_option,
  sale.dstv_package,
  sale.tl_verified,
  sale.admin_approved,
  sale.created_at,
  p.full_name as dsr_name,
  p.email as dsr_email,
  t.name as team_name,
  r.name as region_name
FROM public.sales sale
LEFT JOIN public.dsrs d ON sale.dsr_id = d.id
LEFT JOIN public.profiles p ON d.user_id = p.id
LEFT JOIN public.teams t ON sale.team_id = t.id
LEFT JOIN public.regions r ON sale.region_id = r.id;

-- ============================================
-- ADD NOTES COLUMN TO SALES (if needed)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sales' 
    AND column_name = 'notes'
  ) THEN
    ALTER TABLE public.sales ADD COLUMN notes TEXT;
  END IF;
END $$;

-- ============================================
-- INSERT TEST DATA (OPTIONAL - Uncomment to use)
-- ============================================

-- ============================================
-- MAKE USER ADMIN
-- ============================================
-- Set user 5dd0f1f6-2386-4c0f-9158-a57a13632c8b as admin

-- Update user role to admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('5dd0f1f6-2386-4c0f-9158-a57a13632c8b', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Remove DSR role if exists
DELETE FROM public.user_roles 
WHERE user_id = '5dd0f1f6-2386-4c0f-9158-a57a13632c8b' 
AND role = 'dsr';

-- Test Team Leader
-- INSERT INTO public.team_leaders (user_id, region_id, monthly_target)
-- SELECT 
--   (SELECT id FROM auth.users WHERE email = 'your-tl-email@example.com' LIMIT 1),
--   (SELECT id FROM public.regions WHERE code = 'NRB' LIMIT 1),
--   100
-- WHERE NOT EXISTS (
--   SELECT 1 FROM public.team_leaders WHERE user_id = (SELECT id FROM auth.users WHERE email = 'your-tl-email@example.com' LIMIT 1)
-- );

-- Test Team
-- INSERT INTO public.teams (name, region_id, captain_name)
-- VALUES ('Alpha Team', (SELECT id FROM public.regions WHERE code = 'NRB' LIMIT 1), 'John Doe')
-- ON CONFLICT DO NOTHING;

-- Test Stock Batch
-- INSERT INTO public.stock_batches (batch_number)
-- VALUES ('BATCH-001')
-- ON CONFLICT (batch_number) DO NOTHING;

-- Test Stock Items (DO type)
-- INSERT INTO public.stock (stock_id, type, batch_id, status)
-- SELECT 
--   '1234567890' || generate_series(1, 10),
--   'DO',
--   (SELECT id FROM public.stock_batches WHERE batch_number = 'BATCH-001'),
--   'unassigned'
-- WHERE NOT EXISTS (SELECT 1 FROM public.stock WHERE type = 'DO' LIMIT 1);

-- Test Stock Items (FS type)
-- INSERT INTO public.stock (stock_id, type, batch_id, status)
-- SELECT 
--   '9876543210' || generate_series(1, 10),
--   'FS',
--   (SELECT id FROM public.stock_batches WHERE batch_number = 'BATCH-001'),
--   'unassigned'
-- WHERE NOT EXISTS (SELECT 1 FROM public.stock WHERE type = 'FS' LIMIT 1);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify your setup:

-- Check all tables exist
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Check regions
-- SELECT * FROM public.regions ORDER BY name;

-- Check current user and role
-- SELECT 
--   p.full_name, 
--   p.email, 
--   ur.role 
-- FROM public.profiles p 
-- JOIN public.user_roles ur ON p.id = ur.user_id 
-- WHERE p.id = auth.uid();

-- ============================================
-- SETUP COMPLETE ✅
-- ============================================
-- Your database is ready!
-- 
-- Next steps:
-- 1. Create a user account (Sign Up in your app)
-- 2. Update user role in Supabase dashboard if needed
-- 3. Add test stock items
-- 4. Components will now fetch from these tables
