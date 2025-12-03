-- ============================================
-- UNIT SALES TRACKER - MASTER DATABASE SCHEMA
-- ============================================
-- Complete database schema for Unit Sales Tracker
-- Run this in a CLEAN Supabase database
-- 
-- This migration creates:
-- - Enums for user roles, stock status, payment status, sale types
-- - Core tables: profiles, user_roles, zones, regions, territories
-- - Organization: team_leaders, teams, dsrs
-- - Stock: stock_batches, stock
-- - Sales: sales
-- - Managers: managers (TSM/RSM)
-- - Distribution: distribution_executives, agents, agent_sales
-- - System: notifications
-- - All foreign keys, indexes, and RLS policies
-- ============================================

-- ============================================
-- STEP 1: CREATE ENUMS
-- ============================================

CREATE TYPE public.app_role AS ENUM ('admin', 'tl', 'dsr', 'manager', 'de');
CREATE TYPE public.stock_status AS ENUM ('unassigned', 'assigned-tl', 'assigned-team', 'assigned-dsr', 'sold-paid', 'sold-unpaid');
CREATE TYPE public.payment_status AS ENUM ('paid', 'unpaid');
CREATE TYPE public.sale_type AS ENUM ('FS', 'DO', 'DVS');
CREATE TYPE public.manager_type AS ENUM ('TSM', 'RSM');

-- ============================================
-- STEP 2: CREATE CORE TABLES
-- ============================================

-- Profiles table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User roles table (for role-based access control)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'dsr',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- ============================================
-- STEP 3: ORGANIZATIONAL HIERARCHY
-- ============================================

-- Zones (highest level - managed by Zonal Manager)
CREATE TABLE public.zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  zonal_manager TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Regions (belong to zones)
CREATE TABLE public.regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  zone_id UUID REFERENCES public.zones(id) ON DELETE SET NULL,
  rsm_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Territories (belong to regions, assigned to TSMs)
CREATE TABLE public.territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  region_id UUID NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  tsm_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT territories_region_code_unique UNIQUE (region_id, code)
);

-- Team Leaders (TL) - manage teams and DSRs
CREATE TABLE public.team_leaders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
  territory_id UUID REFERENCES public.territories(id) ON DELETE SET NULL,
  monthly_target INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Teams (belong to TL, have DSRs)
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tl_id UUID REFERENCES public.team_leaders(id) ON DELETE SET NULL,
  captain_name TEXT,
  region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
  territory_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DSRs (Direct Sales Representatives)
CREATE TABLE public.dsrs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  dsr_number TEXT,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  tl_id UUID REFERENCES public.team_leaders(id) ON DELETE SET NULL,
  region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
  territory_name TEXT,
  zone_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- STEP 4: STOCK MANAGEMENT
-- ============================================

-- Stock batches (for batch uploads)
CREATE TABLE public.stock_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock items
CREATE TABLE public.stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL, -- FS, DO, DVS
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

-- ============================================
-- STEP 5: SALES
-- ============================================

-- Sales table (DSR sales)
CREATE TABLE public.sales (
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
  tl_verified BOOLEAN DEFAULT false,
  admin_approved BOOLEAN DEFAULT false,
  commission_amount DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- STEP 6: MANAGERS (TSM / RSM)
-- ============================================

-- Managers table (Territory Sales Manager or Regional Sales Manager)
CREATE TABLE public.managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  manager_type manager_type NOT NULL,
  zone_id UUID REFERENCES public.zones(id) ON DELETE SET NULL,
  territories TEXT[] DEFAULT '{}', -- Array of territory IDs for TSM
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- STEP 7: DISTRIBUTION EXECUTIVES & AGENTS
-- ============================================

-- Distribution Executives
CREATE TABLE public.distribution_executives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  territory TEXT,
  region TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agents (managed by DE)
CREATE TABLE public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  de_id UUID REFERENCES public.distribution_executives(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  phone_number TEXT,
  location TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent sales
CREATE TABLE public.agent_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  de_id UUID REFERENCES public.distribution_executives(id) ON DELETE CASCADE NOT NULL,
  sale_amount DECIMAL(10, 2) NOT NULL,
  product_type TEXT,
  sale_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- STEP 8: NOTIFICATIONS
-- ============================================

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info', -- info, success, warning, error
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- STEP 9: CREATE INDEXES
-- ============================================

-- User roles indexes
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);

-- Organizational hierarchy indexes
CREATE INDEX idx_regions_zone_id ON public.regions(zone_id);
CREATE INDEX idx_territories_region_id ON public.territories(region_id);
CREATE INDEX idx_team_leaders_region_id ON public.team_leaders(region_id);
CREATE INDEX idx_team_leaders_territory_id ON public.team_leaders(territory_id);
CREATE INDEX idx_team_leaders_user_id ON public.team_leaders(user_id);
CREATE INDEX idx_teams_tl_id ON public.teams(tl_id);
CREATE INDEX idx_teams_region_id ON public.teams(region_id);
CREATE INDEX idx_dsrs_user_id ON public.dsrs(user_id);
CREATE INDEX idx_dsrs_team_id ON public.dsrs(team_id);
CREATE INDEX idx_dsrs_tl_id ON public.dsrs(tl_id);
CREATE INDEX idx_dsrs_region_id ON public.dsrs(region_id);

-- Stock indexes
CREATE INDEX idx_stock_batch_id ON public.stock(batch_id);
CREATE INDEX idx_stock_status ON public.stock(status);
CREATE INDEX idx_stock_assigned_to_tl ON public.stock(assigned_to_tl);
CREATE INDEX idx_stock_assigned_to_team ON public.stock(assigned_to_team);
CREATE INDEX idx_stock_assigned_to_dsr ON public.stock(assigned_to_dsr);
CREATE INDEX idx_stock_region_id ON public.stock(region_id);

-- Sales indexes
CREATE INDEX idx_sales_dsr_id ON public.sales(dsr_id);
CREATE INDEX idx_sales_team_id ON public.sales(team_id);
CREATE INDEX idx_sales_tl_id ON public.sales(tl_id);
CREATE INDEX idx_sales_region_id ON public.sales(region_id);
CREATE INDEX idx_sales_payment_status ON public.sales(payment_status);
CREATE INDEX idx_sales_created_at ON public.sales(created_at);

-- Manager indexes
CREATE INDEX idx_managers_user_id ON public.managers(user_id);
CREATE INDEX idx_managers_zone_id ON public.managers(zone_id);
CREATE INDEX idx_managers_type ON public.managers(manager_type);

-- DE and Agent indexes
CREATE INDEX idx_de_user_id ON public.distribution_executives(user_id);
CREATE INDEX idx_agents_de_id ON public.agents(de_id);
CREATE INDEX idx_agent_sales_agent_id ON public.agent_sales(agent_id);
CREATE INDEX idx_agent_sales_de_id ON public.agent_sales(de_id);
CREATE INDEX idx_agent_sales_date ON public.agent_sales(sale_date);

-- Notification indexes
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at);

-- ============================================
-- STEP 10: HELPER FUNCTIONS
-- ============================================

-- Function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(user_id UUID, check_role app_role)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = $1 AND user_roles.role = $2
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 11: ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dsrs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribution_executives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- User roles policies
CREATE POLICY "Users can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Zones policies
CREATE POLICY "Anyone can view zones" ON public.zones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage zones" ON public.zones FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Regions policies
CREATE POLICY "Anyone can view regions" ON public.regions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage regions" ON public.regions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Territories policies
CREATE POLICY "Anyone can view territories" ON public.territories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage territories" ON public.territories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Team Leaders policies
CREATE POLICY "Anyone can view TLs" ON public.team_leaders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage TLs" ON public.team_leaders FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Teams policies
CREATE POLICY "Anyone can view teams" ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "TLs and Admins can manage teams" ON public.teams FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tl'));

-- DSRs policies
CREATE POLICY "Anyone can view DSRs" ON public.dsrs FOR SELECT TO authenticated USING (true);
CREATE POLICY "TLs and Admins can manage DSRs" ON public.dsrs FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tl'));

-- Stock batches policies
CREATE POLICY "Anyone can view batches" ON public.stock_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage batches" ON public.stock_batches FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Stock policies
CREATE POLICY "Anyone can view stock" ON public.stock FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert stock" ON public.stock FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins and TLs can update stock" ON public.stock FOR UPDATE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tl'));

-- Sales policies
CREATE POLICY "Anyone can view sales" ON public.sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "DSRs can insert sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "TLs and Admins can update sales" ON public.sales FOR UPDATE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tl'));

-- Managers policies
CREATE POLICY "Anyone can view managers" ON public.managers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage managers" ON public.managers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Distribution Executives policies
CREATE POLICY "Anyone can view DEs" ON public.distribution_executives FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage DEs" ON public.distribution_executives FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Agents policies
CREATE POLICY "Anyone can view agents" ON public.agents FOR SELECT TO authenticated USING (true);
CREATE POLICY "DEs and Admins can manage agents" ON public.agents FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'de'));

-- Agent sales policies
CREATE POLICY "Anyone can view agent sales" ON public.agent_sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "DEs and Admins can manage agent sales" ON public.agent_sales FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'de'));

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================
-- STEP 12: TRIGGERS
-- ============================================

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    NEW.email
  );
  
  -- Insert default DSR role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'dsr');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to update profile timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- COMPLETE!
-- ============================================
-- Run this entire script in Supabase SQL Editor
-- Then proceed with commission system migration
-- ============================================
