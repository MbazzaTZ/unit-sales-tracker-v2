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

-- Insert commission rates
INSERT INTO public.commission_rates (product_type, upfront_amount, activation_amount, package_commission_rate, description) VALUES
  ('FS', 5000, 3000, 10.00, 'Full Set - Upfront: 5,000 TZS, Activation: 3,000 TZS, Package: 10%'),
  ('DO', 2000, 1500, 8.00, 'Decoder Only - Upfront: 2,000 TZS, Activation: 1,500 TZS, Package: 8%'),
  ('DVS', 1500, 1000, 5.00, 'Digital Virtual Stock - Upfront: 1,500 TZS, Activation: 1,000 TZS, Package: 5%')
ON CONFLICT DO NOTHING;

-- Add commission columns to sales table
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS dstv_package_id UUID,
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
  p_package_id UUID,
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
  v_package_price NUMERIC;
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
  
  -- Calculate upfront commission
  v_upfront := v_rate.upfront_amount;
  
  -- Calculate activation and package commission
  IF p_payment_status = 'paid' AND (p_admin_approved IS NULL OR p_admin_approved = TRUE) THEN
    v_activation := v_rate.activation_amount;
    v_status := 'approved';
    
    -- Calculate package commission if package selected
    IF p_package_id IS NOT NULL THEN
      SELECT monthly_price INTO v_package_price
      FROM public.dstv_packages
      WHERE id = p_package_id;
      
      IF v_package_price IS NOT NULL THEN
        v_package := (v_package_price * v_rate.package_commission_rate) / 100;
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
BEGIN
  -- Calculate commission
  SELECT * INTO v_commission
  FROM public.calculate_sale_commission(
    NEW.sale_type,
    NEW.dstv_package_id,
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
  BEFORE INSERT OR UPDATE OF payment_status, admin_approved, dstv_package_id
  ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sale_commission();

-- Enable RLS
ALTER TABLE public.commission_rates ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT ON public.commission_rates TO authenticated;

SELECT 'Commission system migration applied successfully' as status;
