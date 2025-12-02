-- Create enums
CREATE TYPE public.app_role AS ENUM ('admin', 'tl', 'dsr');
CREATE TYPE public.stock_status AS ENUM ('unassigned', 'assigned-tl', 'assigned-team', 'assigned-dsr', 'sold-paid', 'sold-unpaid');
CREATE TYPE public.payment_status AS ENUM ('paid', 'unpaid');
CREATE TYPE public.sale_type AS ENUM ('FS', 'DO');

-- Profiles table
CREATE TABLE public.profiles (
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
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'dsr',
  UNIQUE(user_id, role)
);

-- Regions table
CREATE TABLE public.regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Team Leaders (TL) - links to profiles
CREATE TABLE public.team_leaders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
  monthly_target INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Teams
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tl_id UUID REFERENCES public.team_leaders(id) ON DELETE SET NULL,
  captain_name TEXT,
  region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DSRs
CREATE TABLE public.dsrs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  tl_id UUID REFERENCES public.team_leaders(id) ON DELETE SET NULL,
  region_id UUID REFERENCES public.regions(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock batches
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
  tl_verified BOOLEAN DEFAULT FALSE,
  tl_verified_at TIMESTAMP WITH TIME ZONE,
  admin_approved BOOLEAN DEFAULT FALSE,
  admin_approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alerts
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  entity_id UUID,
  entity_type TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
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

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default regions
INSERT INTO public.regions (name, code) VALUES
  ('Nairobi', 'NRB'),
  ('Mombasa', 'MSA'),
  ('Kisumu', 'KSM'),
  ('Nakuru', 'NKR'),
  ('Eldoret', 'ELD'),
  ('Rift Valley', 'RV'),
  ('Coast', 'CST'),
  ('Central', 'CNT'),
  ('Western', 'WST'),
  ('Eastern', 'EST');