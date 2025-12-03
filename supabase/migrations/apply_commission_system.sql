-- ============================================
-- APPLY COMMISSION SYSTEM MIGRATION
-- This applies only the commission-related parts from comprehensive_update.sql
-- ============================================

-- Ensure sale_type enum has DVS
DO $$ 
BEGIN
  BEGIN
    ALTER TYPE public.sale_type ADD VALUE IF NOT EXISTS 'DVS';
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Create commission rates table
CREATE TABLE IF NOT EXISTS public.commission_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type TEXT NOT NULL,
  upfront_amount NUMERIC(10, 2) DEFAULT 0,
  activation_amount NUMERIC(10, 2) DEFAULT 0,
  package_commission_rate NUMERIC(5, 2) DEFAULT 0,
  description TEXT,
  effective_from DATE DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert commission rates (Fixed amounts per product type)
INSERT INTO public.commission_rates (product_type, upfront_amount, activation_amount, package_commission_rate, description) VALUES
  ('FS', 5000, 1500, 0, 'Full Set - Upfront: 5,000 TZS, Activation: 1,500 TZS'),
  ('DO', 2000, 1500, 0, 'Decoder Only - Upfront: 2,000 TZS, Activation: 1,500 TZS')
ON CONFLICT DO NOTHING;

-- Create package commission rates table
CREATE TABLE IF NOT EXISTS public.package_commission_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_name TEXT NOT NULL UNIQUE,
  commission_amount NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert package commission rates
INSERT INTO public.package_commission_rates (package_name, commission_amount) VALUES
  ('PREMIUM', 65000),
  ('COMPACT_PLUS', 35000),
  ('COMPACT', 17000),
  ('SHANGWE', 6000),
  ('FAMILY', 6000),
  ('ACCESS', 2750),
  ('BOMBA', 2750)
ON CONFLICT (package_name) DO UPDATE SET commission_amount = EXCLUDED.commission_amount;

-- Create DSTV packages table with actual prices
CREATE TABLE IF NOT EXISTS public.dstv_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_code TEXT NOT NULL UNIQUE,
  package_name TEXT NOT NULL,
  monthly_price NUMERIC(10, 2) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert DSTV Tanzania package prices
INSERT INTO public.dstv_packages (package_code, package_name, monthly_price, description) VALUES
  ('ACCESS', 'Access', 27500, 'Basic entertainment package'),
  ('BOMBA', 'Bomba', 27500, 'Basic entertainment package'),
  ('SHANGWE', 'Shangwe', 40000, 'Family entertainment package'),
  ('FAMILY', 'Family', 40000, 'Family entertainment package'),
  ('COMPACT', 'Compact', 68000, 'Popular entertainment package'),
  ('COMPACT_PLUS', 'Compact Plus', 118000, 'Premium entertainment package'),
  ('PREMIUM', 'Premium', 189000, 'All channels premium package')
ON CONFLICT (package_code) DO UPDATE SET
  monthly_price = EXCLUDED.monthly_price,
  description = EXCLUDED.description;

-- Create DSR bonus tiers table
CREATE TABLE IF NOT EXISTS public.dsr_bonus_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name TEXT NOT NULL,
  min_sales INTEGER NOT NULL,
  max_sales INTEGER NOT NULL,
  bonus_amount NUMERIC(10, 2) NOT NULL,
  requires_experience BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert bonus tier criteria
INSERT INTO public.dsr_bonus_tiers (tier_name, min_sales, max_sales, bonus_amount, requires_experience) VALUES
  ('KURUTA', 3, 4, 30000, FALSE),
  ('CHUMA', 1, 4, 0, TRUE),
  ('SHABA_1', 5, 9, 50000, FALSE),
  ('SHABA_2', 10, 14, 115000, FALSE),
  ('FEDHA_1', 15, 19, 200000, FALSE),
  ('FEDHA_2', 20, 24, 300000, FALSE),
  ('DHAHABU_1', 20, 24, 425000, FALSE),
  ('DHAHABU_2', 25, 44, 675000, FALSE),
  ('TANZANITE', 45, 999, 1000000, FALSE)
ON CONFLICT DO NOTHING;

-- Add commission columns to sales table
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS dstv_package_id UUID,
ADD COLUMN IF NOT EXISTS sale_amount NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS upfront_commission NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS activation_commission NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS package_commission NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS bonus_commission NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_commission NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS commission_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS commission_paid_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMP WITH TIME ZONE;

-- Create calculate_sale_commission function
CREATE OR REPLACE FUNCTION public.calculate_sale_commission(
  p_sale_type TEXT,
  p_package_name TEXT,
  p_payment_status TEXT,
  p_admin_approved BOOLEAN
)
RETURNS TABLE (
  upfront NUMERIC,
  activation NUMERIC,
  package_comm NUMERIC,
  total NUMERIC,
  status TEXT
) AS $$
DECLARE
  v_rate RECORD;
  v_package_commission NUMERIC;
  v_upfront NUMERIC := 0;
  v_activation NUMERIC := 0;
  v_package NUMERIC := 0;
  v_total NUMERIC := 0;
  v_status TEXT := 'pending';
BEGIN
  -- Get commission rate for product type
  SELECT * INTO v_rate
  FROM public.commission_rates
  WHERE product_type = p_sale_type AND is_active = TRUE
  ORDER BY effective_from DESC
  LIMIT 1;
  
  IF v_rate IS NULL THEN
    RETURN QUERY SELECT 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC, 'no-rate'::TEXT;
    RETURN;
  END IF;
  
  -- Calculate upfront commission (always paid on sale creation)
  v_upfront := v_rate.upfront_amount;
  
  -- Calculate activation and package commission (only if paid and approved)
  IF p_payment_status = 'paid' AND (p_admin_approved IS NULL OR p_admin_approved = TRUE) THEN
    v_activation := v_rate.activation_amount;
    v_status := 'approved';
    
    -- Get fixed package commission amount
    IF p_package_name IS NOT NULL THEN
      SELECT commission_amount INTO v_package_commission
      FROM public.package_commission_rates
      WHERE package_name = UPPER(p_package_name);
      
      IF v_package_commission IS NOT NULL THEN
        v_package := v_package_commission;
      END IF;
    END IF;
  ELSIF p_admin_approved = FALSE THEN
    v_status := 'rejected';
  ELSIF p_payment_status = 'unpaid' THEN
    v_status := 'pending-payment';
  END IF;
  
  v_total := v_upfront + v_activation + v_package;
  
  RETURN QUERY SELECT v_upfront, v_activation, v_package, v_total, v_status;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function
CREATE OR REPLACE FUNCTION public.update_sale_commission()
RETURNS TRIGGER AS $$
DECLARE
  v_commission RECORD;
  v_package_name TEXT;
  v_package_price NUMERIC := 0;
  v_device_price NUMERIC := 0;
BEGIN
  -- Get package name from package_option field
  v_package_name := NEW.package_option;
  
  -- Get package price if package selected
  IF v_package_name IS NOT NULL AND v_package_name != 'no-package' THEN
    SELECT monthly_price INTO v_package_price
    FROM public.dstv_packages
    WHERE UPPER(package_code) = UPPER(v_package_name)
       OR UPPER(package_name) = UPPER(v_package_name);
    
    IF v_package_price IS NULL THEN
      v_package_price := 0;
    END IF;
  END IF;
  
  -- Calculate device price based on sale type
  IF NEW.sale_type = 'FS' THEN
    v_device_price := 65000;
  ELSIF NEW.sale_type = 'DO' THEN
    v_device_price := 25000;
  ELSE
    v_device_price := 0;
  END IF;
  
  -- Calculate total sale amount
  NEW.sale_amount := v_device_price + v_package_price;
  
  -- Calculate commission
  SELECT * INTO v_commission
  FROM public.calculate_sale_commission(
    NEW.sale_type,
    v_package_name,
    NEW.payment_status,
    NEW.admin_approved
  );
  
  -- Update commission fields
  NEW.upfront_commission := v_commission.upfront;
  NEW.activation_commission := v_commission.activation;
  NEW.package_commission := v_commission.package_comm;
  NEW.total_commission := v_commission.total;
  NEW.commission_status := v_commission.status;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_calculate_commission ON public.sales;
CREATE TRIGGER trigger_calculate_commission
  BEFORE INSERT OR UPDATE OF payment_status, admin_approved, package_option, sale_type
  ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sale_commission();

-- Enable RLS
ALTER TABLE public.commission_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_commission_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dsr_bonus_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dstv_packages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for dstv_packages (drop if exists first)
DROP POLICY IF EXISTS "Anyone can view active packages" ON public.dstv_packages;
CREATE POLICY "Anyone can view active packages" ON public.dstv_packages
  FOR SELECT USING (is_active = TRUE);

-- Grant permissions
GRANT SELECT ON public.commission_rates TO authenticated;
GRANT SELECT ON public.package_commission_rates TO authenticated;
GRANT SELECT ON public.dsr_bonus_tiers TO authenticated;
GRANT SELECT ON public.dstv_packages TO authenticated;

SELECT 'Commission system migration applied successfully' as status;
