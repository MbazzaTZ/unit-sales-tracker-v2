-- ============================================
-- COMMISSION SYSTEM - DATABASE SCHEMA
-- ============================================
-- Run this AFTER 00_master_schema.sql
-- This creates tables and triggers for the commission system
-- ============================================

-- ============================================
-- STEP 1: CREATE COMMISSION TABLES
-- ============================================

-- Commission rates table (upfront and activation commissions)
CREATE TABLE public.commission_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type TEXT NOT NULL UNIQUE, -- 'FS' or 'DO'
  upfront_amount DECIMAL(10, 2) NOT NULL,
  activation_amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DSTV packages table
CREATE TABLE public.dstv_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_name TEXT NOT NULL UNIQUE,
  monthly_price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Package commission rates table
CREATE TABLE public.package_commission_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_name TEXT NOT NULL UNIQUE,
  commission_amount DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DSR bonus tiers table
CREATE TABLE public.dsr_bonus_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name TEXT NOT NULL UNIQUE,
  min_sales INTEGER NOT NULL,
  bonus_amount DECIMAL(10, 2) NOT NULL,
  color TEXT DEFAULT '#000000',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- STEP 2: INSERT DEFAULT COMMISSION DATA
-- ============================================

-- Commission rates (DO and FS)
INSERT INTO public.commission_rates (product_type, upfront_amount, activation_amount) VALUES
('DO', 2000.00, 1500.00),
('FS', 5000.00, 1500.00);

-- DSTV packages
INSERT INTO public.dstv_packages (package_name, monthly_price) VALUES
('PREMIUM', 189000.00),
('COMPACT PLUS', 115000.00),
('COMPACT', 70000.00),
('FAMILY', 45000.00),
('ACCESS', 27500.00);

-- Package commission rates
INSERT INTO public.package_commission_rates (package_name, commission_amount) VALUES
('PREMIUM', 65000.00),
('COMPACT PLUS', 35000.00),
('COMPACT', 15000.00),
('FAMILY', 7500.00),
('ACCESS', 2750.00);

-- DSR bonus tiers
INSERT INTO public.dsr_bonus_tiers (tier_name, min_sales, bonus_amount, color) VALUES
('KURUTA', 5, 30000.00, '#CD7F32'),
('BRONZE', 10, 75000.00, '#CD7F32'),
('SILVER', 15, 125000.00, '#C0C0C0'),
('GOLD', 20, 200000.00, '#FFD700'),
('EMERALD', 30, 400000.00, '#50C878'),
('RUBY', 40, 600000.00, '#E0115F'),
('SAPPHIRE', 50, 850000.00, '#0F52BA'),
('DIAMOND', 75, 1200000.00, '#B9F2FF'),
('TANZANITE', 100, 2000000.00, '#5D3FD3');

-- ============================================
-- STEP 3: CREATE INDEXES
-- ============================================

CREATE INDEX idx_commission_rates_product_type ON public.commission_rates(product_type);
CREATE INDEX idx_dstv_packages_package_name ON public.dstv_packages(package_name);
CREATE INDEX idx_package_commission_rates_package_name ON public.package_commission_rates(package_name);
CREATE INDEX idx_dsr_bonus_tiers_min_sales ON public.dsr_bonus_tiers(min_sales);

-- ============================================
-- STEP 4: ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.commission_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dstv_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_commission_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dsr_bonus_tiers ENABLE ROW LEVEL SECURITY;

-- Everyone can view commission data
CREATE POLICY "Anyone can view commission rates" ON public.commission_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage commission rates" ON public.commission_rates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view DSTV packages" ON public.dstv_packages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage DSTV packages" ON public.dstv_packages FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view package commissions" ON public.package_commission_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage package commissions" ON public.package_commission_rates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view bonus tiers" ON public.dsr_bonus_tiers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage bonus tiers" ON public.dsr_bonus_tiers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- STEP 5: COMMISSION CALCULATION FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION public.calculate_sale_commission()
RETURNS TRIGGER AS $$
DECLARE
  v_upfront_amount DECIMAL(10, 2) := 0;
  v_activation_amount DECIMAL(10, 2) := 0;
  v_package_commission DECIMAL(10, 2) := 0;
  v_total_commission DECIMAL(10, 2) := 0;
BEGIN
  -- Get product commission (upfront + activation)
  SELECT upfront_amount, activation_amount
  INTO v_upfront_amount, v_activation_amount
  FROM public.commission_rates
  WHERE product_type = NEW.sale_type;
  
  -- Get package commission if applicable
  IF NEW.package_option = 'with-package' AND NEW.dstv_package IS NOT NULL THEN
    SELECT commission_amount
    INTO v_package_commission
    FROM public.package_commission_rates
    WHERE package_name = NEW.dstv_package;
  END IF;
  
  -- Calculate total commission
  v_total_commission := COALESCE(v_upfront_amount, 0) + COALESCE(v_activation_amount, 0) + COALESCE(v_package_commission, 0);
  
  -- Set the commission amount
  NEW.commission_amount := v_total_commission;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to calculate commission on sale insert/update
CREATE TRIGGER calculate_sale_commission_trigger
  BEFORE INSERT OR UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_sale_commission();

-- ============================================
-- STEP 6: UPDATE TIMESTAMP TRIGGERS
-- ============================================

CREATE TRIGGER on_commission_rates_updated
  BEFORE UPDATE ON public.commission_rates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_dstv_packages_updated
  BEFORE UPDATE ON public.dstv_packages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_package_commission_rates_updated
  BEFORE UPDATE ON public.package_commission_rates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_dsr_bonus_tiers_updated
  BEFORE UPDATE ON public.dsr_bonus_tiers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- COMPLETE!
-- ============================================
-- Commission system is now ready
-- DSR sales will automatically calculate commissions
-- Admins can manage all commission rates through the app
-- ============================================
